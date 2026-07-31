'use client';

import { Rect } from 'react-konva';
import { useViewStore } from '@/stores/viewStore';
import { OBJECT_STROKE } from '@/lib/canvasTokens';

/**
 * The only visible sign an Option/Alt-drag registered, now that the actual
 * duplicate is no longer inserted into `docStore` (and thus rendered as a
 * real object) until `dragEnd` — see `useObjectDrag.ts`'s header comment on
 * why the insert moved there. One dashed, unfilled rect per dragged object,
 * at its recorded drag-start position — `useObjectDrag.ts`'s `onDragStart`
 * computes these with `getBoundsAt` and clears them again in `onDragEnd`,
 * alongside `guides`/`dragDistance`, the same lifecycle those follow.
 * `listening={false}` (pure feedback, never a hit target) and
 * `strokeScaleEnabled={false}` (constant 1.5px on screen at any zoom) match
 * every other non-scaling stroke in this app; the `[4, 4]` dash reuses the
 * one dashed treatment already in the codebase (the dance floor's own
 * border in `PropNode.tsx`) rather than inventing a second dash cadence.
 */
export function DuplicateGhosts() {
  const ghosts = useViewStore((s) => s.duplicateGhosts);
  if (!ghosts) return null;
  return (
    <>
      {ghosts.map((ghost, i) => (
        <Rect
          key={`${ghost.x}-${ghost.y}-${i}`}
          x={ghost.x}
          y={ghost.y}
          width={ghost.width}
          height={ghost.height}
          stroke={OBJECT_STROKE}
          strokeWidth={1.5}
          dash={[4, 4]}
          strokeScaleEnabled={false}
          listening={false}
        />
      ))}
    </>
  );
}
