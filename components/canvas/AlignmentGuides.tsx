'use client';

import { Fragment } from 'react';
import { Line, Rect, Text } from 'react-konva';
import { useDocStore } from '@/stores/docStore';
import { useViewStore } from '@/stores/viewStore';
import { useT } from '@/lib/i18n/useT';
import { formatLength } from '@/lib/units/format';
import type { Guide } from '@/lib/geometry/snap';
import { COOL, COOL_DEEP, ROOM_FILL, canvasDataFont, measureMonoTextWidth } from '@/lib/canvasTokens';
import {
  GUIDE_MARKER_PX, MEASURE_BADGE_FONT_PX, MEASURE_BADGE_PAD_X_PX, MEASURE_BADGE_PAD_Y_PX, SNAP_LABEL_OFFSET_PX,
} from '@/lib/constants';

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
 * Anchor for the "snapped · axis value" label (Task 11): offset from the
 * guide's own marker so it never sits on top of it — to the side for an 'x'
 * guide (whose line runs vertically), above for a 'y' guide (whose line runs
 * horizontally), in both cases clear of the line itself rather than
 * crossing it.
 */
function labelAnchor(guide: Guide, marker: { x: number; y: number }, offset: number): { x: number; y: number } {
  return guide.axis === 'x' ? { x: marker.x + offset, y: marker.y } : { x: marker.x, y: marker.y - offset };
}

/**
 * Alignment guides published to `viewStore.guides` by `useObjectDrag`
 * during a drag: a 1px line spanning both objects, a 13px (screen-constant)
 * square marker at the line's own centre, and (Task 11) a small "snapped ·
 * axis value" label near the marker. `strokeScaleEnabled` keeps line/marker
 * stroke width constant on screen; the marker's own size and the label's
 * font/padding divide the relevant screen-px constant by scale for the same
 * reason `SeatNode`'s dietary dot does.
 */
export function AlignmentGuides() {
  const guides = useViewStore((s) => s.guides);
  const scale = useViewStore((s) => s.scale);
  const units = useDocStore((s) => s.units);
  const t = useT();
  const markerSize = GUIDE_MARKER_PX / scale;
  const fontSize = MEASURE_BADGE_FONT_PX / scale;
  const padX = MEASURE_BADGE_PAD_X_PX / scale;
  const padY = MEASURE_BADGE_PAD_Y_PX / scale;
  const offset = SNAP_LABEL_OFFSET_PX / scale;

  return (
    <>
      {guides.map((guide, i) => {
        const marker = markerOf(guide);
        const text = t('snappedTo', { axis: guide.axis, value: formatLength(guide.at, units) });
        const boxW = measureMonoTextWidth(text, fontSize) + padX * 2;
        const boxH = fontSize * 1.3 + padY * 2;
        const anchor = labelAnchor(guide, marker, offset);
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
            <Rect
              x={anchor.x}
              y={anchor.y}
              width={boxW}
              height={boxH}
              offsetX={boxW / 2}
              offsetY={boxH / 2}
              fill={ROOM_FILL}
              stroke={COOL}
              strokeWidth={1}
              strokeScaleEnabled={false}
              listening={false}
            />
            <Text
              x={anchor.x}
              y={anchor.y}
              width={boxW}
              height={boxH}
              offsetX={boxW / 2}
              offsetY={boxH / 2}
              text={text}
              fontFamily={canvasDataFont()}
              fontSize={fontSize}
              fill={COOL_DEEP}
              align="center"
              verticalAlign="middle"
              listening={false}
            />
          </Fragment>
        );
      })}
    </>
  );
}
