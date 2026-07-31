'use client';

import { useCallback, useEffect, useRef } from 'react';
import type Konva from 'konva';
import { Rect, Transformer } from 'react-konva';
import { useShallow } from 'zustand/react/shallow';
import { useDocStore } from '@/stores/docStore';
import { useViewStore } from '@/stores/viewStore';
import { isProp, isTable, type SceneObject } from '@/lib/types/doc';
import { getBounds, unionBounds } from '@/lib/geometry/bounds';
import { COOL, ROOM_FILL, SELECTION_WASH } from '@/lib/canvasTokens';
import {
  ROTATE_HANDLE_OFFSET_PX, ROTATE_HANDLE_PX, ROTATION_SNAP,
  TRANSFORMER_ANCHOR_PX, TRANSFORMER_ANCHOR_STROKE_PX, TRANSFORMER_BORDER_DASH_PX, TRANSFORMER_BORDER_PX,
} from '@/lib/constants';

const RESIZE_ANCHORS = [
  'top-left', 'top-center', 'top-right',
  'middle-left', 'middle-right',
  'bottom-left', 'bottom-center', 'bottom-right',
];

function snapAngle(deg: number): number {
  return Math.round(deg / ROTATION_SNAP) * ROTATION_SNAP;
}

function isNode(value: Konva.Node | undefined): value is Konva.Node {
  return value !== undefined;
}

/**
 * The Konva `Transformer`, attached imperatively — by id lookup on the
 * Stage, in an effect — to whichever nodes `viewStore.selectedIds` names.
 * Every object node carries `id={obj.id}` (added alongside `useObjectDrag`,
 * which needs the same lookup for multi-select drag) specifically so this
 * and that hook can both find nodes by id without either owning a registry
 * of its own.
 *
 * Tables get `enabledAnchors={[]}` (rotate only — their dimensions come
 * from the inspector in Task 12; non-uniform scaling of a real table is
 * meaningless). Everything else gets full resize + rotate.
 *
 * Only ever attached to a *single* node at a time — `nodes([])` for zero or
 * 2+ selected, so `anyTable` below only ever describes that one object, not
 * a genuine multi-object mix. Not a simplification taken lightly: Konva's `Transformer`
 * registers its own drag proxy (`_proxyDrag`) on every node the moment it's
 * attached, and with 2+ nodes attached that proxy independently
 * `.startDrag()`s every *other* attached node the instant any one of them
 * gets dragged — which fires a second, competing 'dragend' (and a second
 * `docStore.commit`) on top of the one `useObjectDrag`'s own hand-rolled
 * multi-select sync already produces for that same gesture. That directly
 * breaks "one drag, one history entry" the moment 2+ objects are selected,
 * confirmed by instrumenting `commit` during a multi-select drag before this
 * guard existed. A multi-selection can still be dragged as one group — that
 * is entirely `useObjectDrag`'s own doing, independent of the Transformer —
 * it just doesn't get its own combined-box resize/rotate handles. Instead,
 * when 2+ objects are selected this renders a plain, non-interactive `Rect`
 * over the union of their bounds (below) — a real border and extent, just
 * without handles, which honestly signals group-resize isn't available
 * rather than showing nothing at all.
 *
 * One disclosed simplification against the token spec, because Konva's
 * `Transformer` has no supported hook for it without externally replicating
 * its internal (rotated) box geometry, which risks a visibly *misaligned*
 * decoration — worse than the plainer, always-correct default: the rotate
 * handle's connecting stem (Konva's own `rotateLineVisible`, on by default)
 * shares the border's dash pattern rather than being a distinct solid 1px
 * line, since both are drawn by one continuous path in `_createBack`'s
 * `sceneFunc`. The bounding box's own fill wash, by contrast, DOES have a
 * working hook — `.back` exposes a plain `fill()` setter that `update()`
 * never touches — set once in the attach effect below; confirmed empirically
 * (resize, rotate, and deselect/reselect) that it survives every Transformer
 * update cycle rather than being clobbered.
 */
export function SelectionTransformer() {
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const selectedIds = useViewStore((s) => s.selectedIds);
  const scale = useViewStore((s) => s.scale);
  // useShallow: this only needs to re-render when the set of *objects*
  // named by selectedIds actually changes (to recompute anyTable below),
  // not on every unrelated docStore commit — s.objects itself gets a new
  // top-level reference on every commit, but Immer shares the untouched
  // per-id values, so this array is reference-stable unless a selected
  // object's own entry changed.
  const selectedObjects = useDocStore(useShallow((s): SceneObject[] => (
    selectedIds.map((id) => s.objects[id]).filter((o): o is SceneObject => o !== undefined)
  )));
  const anyTable = selectedObjects.some(isTable);
  // The Transformer itself is only ever attached to a single node (see the
  // doc comment below), which leaves 2+ selected objects with no resize/
  // rotate handles and, before this fix, no visual affordance at all — not
  // even a border. This is the fallback for that case: a plain, listening
  // -disabled Rect over the union of every selected object's own AABB, drawn
  // whenever there's more than one. It deliberately carries no handles: the
  // absence is honest feedback that group-resize isn't available, not a bug.
  const multiBounds = selectedObjects.length > 1 ? unionBounds(selectedObjects.map(getBounds)) : null;
  // `multiBounds` is derived from docStore, which this project's central
  // performance rule (see useObjectDrag.ts's onDragMove) deliberately never
  // writes to mid-drag — only .position() on the Konva nodes themselves, plus
  // viewStore.guides/dragDistance. Left alone, this box would sit still for
  // the whole gesture and only jump into place when dragEnd's commit lands —
  // exactly the interaction it exists to support. Every co-selected node
  // moves by the grabbed node's own delta (dragDistance.to - .from), so
  // offsetting the box by that same delta keeps it on the objects for the
  // whole drag. onDragEnd clears dragDistance to null in the same
  // synchronous batch as the commit that updates docStore (setDragDistance
  // runs before commit, both inside one Konva handler, both flushed as one
  // React update), so this offset and the box's own post-commit position
  // never both apply at once — no double-offset flash on release.
  const drag = useViewStore((s) => s.dragDistance);
  const dragDx = drag ? drag.to.x - drag.from.x : 0;
  const dragDy = drag ? drag.to.y - drag.from.y : 0;

  useEffect(() => {
    const tr = transformerRef.current;
    const stage = tr?.getStage();
    if (!tr || !stage) return;
    // See the doc comment above: deliberately never more than one node.
    const nodes = selectedIds.length === 1
      ? selectedIds.map((id) => stage.findOne(`#${id}`)).filter(isNode)
      : [];
    tr.nodes(nodes);
    // Transformer.update() (called by nodes()) sets stroke/dash/geometry on
    // `.back` every cycle but never touches fill — set once here, after
    // nodes(), and it survives resize/rotate/re-attach. Confirmed
    // empirically in a real browser (see Task 10's fix report); if this ever
    // stops surviving after a Konva upgrade, delete rather than fight it.
    tr.findOne<Konva.Shape>('.back')?.fill(SELECTION_WASH);
    tr.getLayer()?.batchDraw();
    // `selectedObjects` (shallow-stable, see above) is also a dependency,
    // not just `selectedIds`: undo/redo can remove the very object a
    // selection still names — nothing clears `selectedIds` itself when that
    // happens, since selection intentionally knows nothing about docStore
    // (Readout/Inspector both already degrade gracefully, hiding once their
    // object lookup returns `undefined`). Without this, `selectedIds`'s own
    // reference never changes across that undo, so this effect would never
    // re-run, and Konva's `Transformer` would keep pointing at a node
    // react-konva already unmounted — a ghost handle floating at its last
    // position rather than disappearing with the object it was attached to.
  }, [selectedIds, selectedObjects]);

  // Rotation snaps to 15° increments only while Shift is held — Konva's own
  // `rotationSnaps` mechanism snaps by proximity to a fixed angle list
  // regardless of any modifier key, which isn't this. `getActiveAnchor()`
  // distinguishes an actual rotate gesture from a resize gesture sharing
  // this same event; only 'rotater' should ever have its rotation coerced.
  const handleTransform = useCallback((e: Konva.KonvaEventObject<Event>) => {
    const tr = transformerRef.current;
    if (!tr || tr.getActiveAnchor() !== 'rotater') return;
    if (!(e.evt instanceof MouseEvent) || !e.evt.shiftKey) return;
    e.target.rotation(snapAngle(e.target.rotation()));
  }, []);

  // Konva applies scaleX/scaleY to the node on resize; the document stores
  // width/height in cm. Convert scale back into a dimension and reset the
  // node's own scale to 1 here, in the SAME commit as the position/rotation
  // — otherwise the next transform would compound on top of a stale scale.
  const handleTransformEnd = useCallback(() => {
    const tr = transformerRef.current;
    const nodes = tr?.nodes() ?? [];
    if (nodes.length === 0) return;
    useDocStore.getState().commit((d) => {
      for (const node of nodes) {
        const obj = d.objects[node.id()];
        if (!obj) continue;
        obj.x = node.x();
        obj.y = node.y();
        obj.rotation = node.rotation();
        if (obj.type === 'label') {
          obj.fontSize = Math.max(1, obj.fontSize * node.scaleY());
        } else if (isProp(obj)) {
          obj.width = Math.max(1, obj.width * node.scaleX());
          obj.height = Math.max(1, obj.height * node.scaleY());
        }
        node.scaleX(1);
        node.scaleY(1);
      }
    }, 'transform');
  }, []);

  return (
    <>
      {multiBounds && (
        <Rect
          x={multiBounds.left + dragDx}
          y={multiBounds.top + dragDy}
          width={multiBounds.width}
          height={multiBounds.height}
          fill={SELECTION_WASH}
          stroke={COOL}
          strokeWidth={1}
          dash={[4, 4]}
          strokeScaleEnabled={false}
          listening={false}
        />
      )}
      <Transformer
        ref={transformerRef}
        visible={selectedIds.length === 1}
        rotateEnabled
        resizeEnabled={!anyTable}
        enabledAnchors={anyTable ? [] : RESIZE_ANCHORS}
        anchorSize={TRANSFORMER_ANCHOR_PX / scale}
        anchorCornerRadius={0}
        anchorFill={ROOM_FILL}
        anchorStroke={COOL}
        anchorStrokeWidth={TRANSFORMER_ANCHOR_STROKE_PX / scale}
        borderStroke={COOL}
        borderStrokeWidth={TRANSFORMER_BORDER_PX / scale}
        borderDash={TRANSFORMER_BORDER_DASH_PX.map((d) => d / scale)}
        rotateAnchorOffset={ROTATE_HANDLE_OFFSET_PX / scale}
        anchorStyleFunc={(anchor) => {
          if (!anchor.hasName('rotater')) return;
          const size = ROTATE_HANDLE_PX / scale;
          anchor.width(size);
          anchor.height(size);
          anchor.offsetX(size / 2);
          anchor.offsetY(size / 2);
          anchor.cornerRadius(size / 2); // a square Rect with radius = half its size renders as a circle
        }}
        onTransform={handleTransform}
        onTransformEnd={handleTransformEnd}
      />
    </>
  );
}
