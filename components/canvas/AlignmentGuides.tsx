'use client';

import { Fragment } from 'react';
import { Line, Rect } from 'react-konva';
import { useViewStore } from '@/stores/viewStore';
import type { Guide } from '@/lib/geometry/snap';
import { COOL, ROOM_FILL } from '@/lib/canvasTokens';
import { GUIDE_MARKER_PX } from '@/lib/constants';

/** Line endpoints for one guide: an 'x' guide is vertical (constant x), a 'y' guide horizontal (constant y). */
function pointsOf(guide: Guide): number[] {
  return guide.axis === 'x'
    ? [guide.at, guide.from, guide.at, guide.to]
    : [guide.from, guide.at, guide.to, guide.at];
}

/**
 * Centre of the guide's own span — the point midway between the two matched
 * edges, along the line itself. The token spec calls for a marker "at the
 * matched centre" but a `Guide` only carries the shared coordinate and the
 * span it draws across, not which specific edge pair (left/cx/right)
 * produced it, so the span's own midpoint is the one unambiguous point
 * derivable from the data actually available here.
 */
function markerOf(guide: Guide): { x: number; y: number } {
  const mid = (guide.from + guide.to) / 2;
  return guide.axis === 'x' ? { x: guide.at, y: mid } : { x: mid, y: guide.at };
}

/**
 * Alignment guides published to `viewStore.guides` by `useObjectDrag`
 * during a drag: a 1px line spanning both objects, plus a 13px (screen-
 * constant) square marker at the line's own centre. `strokeScaleEnabled`
 * keeps line/marker stroke width constant on screen; the marker's own size
 * divides the screen-px constant by scale for the same reason
 * `SeatNode`'s dietary dot does.
 */
export function AlignmentGuides() {
  const guides = useViewStore((s) => s.guides);
  const scale = useViewStore((s) => s.scale);
  const markerSize = GUIDE_MARKER_PX / scale;

  return (
    <>
      {guides.map((guide, i) => {
        const marker = markerOf(guide);
        return (
          <Fragment key={`${guide.axis}-${i}`}>
            <Line
              points={pointsOf(guide)}
              stroke={COOL}
              strokeWidth={1}
              strokeScaleEnabled={false}
              listening={false}
            />
            <Rect
              x={marker.x}
              y={marker.y}
              width={markerSize}
              height={markerSize}
              offsetX={markerSize / 2}
              offsetY={markerSize / 2}
              fill={ROOM_FILL}
              stroke={COOL}
              strokeWidth={1.5}
              strokeScaleEnabled={false}
              listening={false}
            />
          </Fragment>
        );
      })}
    </>
  );
}
