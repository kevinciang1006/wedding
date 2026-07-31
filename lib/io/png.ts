import { flushSync } from 'react-dom';
import { useViewStore } from '@/stores/viewStore';
import type { Cm } from '@/lib/types/doc';

// Konva rasterizes an export at CSS-pixel resolution by default, which looks
// soft next to the room's actual line weights once printed or viewed at
// 100%. 3x matches a typical print/retina target without the export taking
// noticeably longer for a room-sized canvas.
const PNG_PIXEL_RATIO = 3;

// Matches the `name="overlay-layer"` set on `OverlayLayer.tsx`'s own
// `<Layer>` — a Konva selector, not a CSS one, so this file can find that
// exact layer by name rather than assuming it's always the Stage's last
// child.
const OVERLAY_LAYER_SELECTOR = '.overlay-layer';

/**
 * The Overlay layer, narrowed to the one thing this file does to it: read
 * and toggle visibility. A real `Konva.Layer`'s `visible` is exactly this
 * shape (`Node`'s `GetSet<boolean, this>`), so a live Stage satisfies this
 * structurally with no cast — and so does a plain test double, which is the
 * point: it's what lets the overlay-restore-after-a-throw path (below) get
 * a real, deterministic test instead of only a live-browser probe.
 */
export interface VisibilityNode {
  visible(): boolean;
  visible(visible: boolean): this;
}

/**
 * The exact slice of `Konva.Stage` this file reads — a structural type
 * rather than importing `Konva.Stage` itself, same rationale as
 * `lib/geometry/viewport.ts`'s own `ViewportTransform`: this stays free of
 * a hard Konva dependency, and a real Stage still satisfies it with no cast
 * (Konva's own `x`/`y`/`scaleX`/`scaleY` are each callable with zero
 * arguments, and `findOne` narrowed to this file's one selector).
 */
export interface ExportStage {
  findOne(selector: string): VisibilityNode | undefined;
  x(): number;
  y(): number;
  scaleX(): number;
  scaleY(): number;
  toDataURL(config: { x: number; y: number; width: number; height: number; pixelRatio: number }): string;
}

/**
 * Rasterizes the room — not the whole viewport, and never whatever pan/zoom
 * the user happens to have open — as a PNG data URL.
 *
 * Konva's `toDataURL` crop rect (`x`/`y`/`width`/`height`) is expressed in
 * the Stage's own pre-transform pixel space, the same space `stage.x()`/
 * `stage.y()` are already in, NOT room centimetres — every shape underneath
 * is drawn in room cm and only becomes screen pixels once the Stage's own
 * scale/position transform (set by `useViewport`, live on `stage` itself)
 * is applied during that same draw. So the room's cm bounds are converted
 * through that live transform here, the mirror image of
 * `screenPointToRoomCm` (`lib/geometry/viewport.ts`), rather than being
 * passed through as if they were already pixels.
 *
 * The Overlay layer (marquee, alignment guides, the selection Transformer —
 * `OverlayLayer.tsx`) is hidden for the single synchronous frame this
 * captures, and restored in a `finally` so a `toDataURL` throw (an export
 * fired before the stage has ever laid out, for instance) can never leave
 * the editor's own canvas silently missing its overlay afterward.
 *
 * Hiding that layer is not the whole story, though: `TableNode`/`PropNode`/
 * `LabelNode` each recolour their own plate stroke or text fill when
 * `viewStore.selectedIds` names them (`COOL` instead of the default ink/grey)
 * as a permanent part of their own render output, entirely independent of
 * the Overlay layer — confirmed empirically, a selected table's blue plate
 * outline still baked into the PNG with the overlay hidden and nothing else
 * changed. So the current selection is cleared here too, and restored after.
 * Both go through `flushSync`: `useViewStore`'s `set()` updates the store
 * synchronously, but the resulting React re-render of those object nodes
 * (and thus their real Konva `stroke`/`fill`) does not land before this
 * function's next line without it — a plain `select([])` would still be
 * capturing the stale, still-selected stroke color. Because the entire
 * export — both `flushSync` calls and the synchronous `toDataURL` between
 * them — runs in one JS turn with no `await`, the browser never paints the
 * momentarily-cleared selection, so nothing visibly flashes for the user.
 */
export function exportPng(stage: ExportStage, room: { width: Cm; height: Cm }): string {
  const overlay = stage.findOne(OVERLAY_LAYER_SELECTOR);
  const wasVisible = overlay?.visible() ?? true;
  const previousSelection = useViewStore.getState().selectedIds;
  overlay?.visible(false);
  if (previousSelection.length > 0) flushSync(() => useViewStore.getState().select([]));
  try {
    return stage.toDataURL({
      x: stage.x(),
      y: stage.y(),
      width: room.width * stage.scaleX(),
      height: room.height * stage.scaleY(),
      pixelRatio: PNG_PIXEL_RATIO,
    });
  } finally {
    overlay?.visible(wasVisible);
    if (previousSelection.length > 0) flushSync(() => useViewStore.getState().select(previousSelection));
  }
}
