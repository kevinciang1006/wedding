'use client';

import { memo, useEffect, useRef, type ReactElement } from 'react';
import type Konva from 'konva';
import { Layer } from 'react-konva';
import { useDocStore } from '@/stores/docStore';
import { TableNode } from '@/components/canvas/objects/TableNode';
import { PropNode } from '@/components/canvas/objects/PropNode';
import { LabelNode } from '@/components/canvas/objects/LabelNode';

interface ObjectNodeProps { id: string }

/**
 * Routes an id to its node component. Kept out of `ObjectsLayer` itself so
 * that component can honour "subscribe to objectOrder only" literally —
 * the type lookup has to live one level below it, keyed by id, but it only
 * ever reads the one field (`type`) it needs to route, not the whole
 * object. The switch has no `default`: with every `ObjectType` member
 * covered and an explicit return type, TypeScript proves it exhaustive the
 * same way `lib/doc/factory.ts`'s `createObject` does, so adding an 11th
 * object type without a case here is a compile error, not a silent gap.
 */
const ObjectNode = memo(function ObjectNode({ id }: ObjectNodeProps): ReactElement | null {
  const type = useDocStore((s) => s.objects[id]?.type);
  if (type === undefined) return null; // deleted between the commit and this frame's paint
  switch (type) {
    case 'roundTable':
    case 'rectTable':
    case 'sweetheart':
    case 'headTable':
      return <TableNode id={id} />;
    case 'danceFloor':
    case 'stage':
    case 'bar':
    case 'buffet':
    case 'rect':
      return <PropNode id={id} />;
    case 'label':
      return <LabelNode id={id} />;
  }
});

/**
 * Renders every object in z-order. Subscribes to `objectOrder` alone —
 * never to `objects` — so adding, removing, or reordering objects is the
 * only thing that re-renders this component; editing one object's fields
 * (a drag, a rename, a seat assignment) is invisible here and handled
 * entirely inside that object's own node, per-id.
 */
export function ObjectsLayer() {
  const objectOrder = useDocStore((s) => s.objectOrder);
  const layerRef = useRef<Konva.Layer | null>(null);

  // Canvas text draws through the Canvas 2D `font` string, which — unlike
  // DOM text — never repaints itself when a webfont finishes swapping in.
  // Force one redraw once next/font's Newsreader/IBM Plex Mono are actually
  // ready, so labels drawn against the fallback font on first paint pick up
  // the real glyphs.
  useEffect(() => {
    document.fonts.ready.then(() => { layerRef.current?.batchDraw(); });
  }, []);

  return (
    // Listening (the Konva default) — Task 10 makes every table/prop/label
    // a click/drag/right-click target, via each node's own `useObjectDrag`.
    // Seats stay opted out individually within TableNode; Task 14 owns
    // making them real drop targets.
    <Layer ref={layerRef}>
      {objectOrder.map((id) => <ObjectNode key={id} id={id} />)}
    </Layer>
  );
}
