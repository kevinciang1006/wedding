'use client';

import { Line, Rect, Text } from 'react-konva';
import { useDocStore } from '@/stores/docStore';
import { useViewStore } from '@/stores/viewStore';
import { formatLength } from '@/lib/units/format';
import { COOL, COOL_LIGHT, ROOM_FILL, canvasDataFont, measureMonoTextWidth } from '@/lib/canvasTokens';
import { DRAG_CAP_PX, MEASURE_BADGE_FONT_PX, MEASURE_BADGE_PAD_X_PX, MEASURE_BADGE_PAD_Y_PX } from '@/lib/constants';

/**
 * The live "how far have I dragged" tape measure: `viewStore.dragDistance`
 * is published every drag frame by `useObjectDrag` (read only here, never
 * written — this is a passive overlay, same rule as the readout) as the
 * gesture's start point, current point, and straight-line distance between
 * them. Drawn as a dashed line between those two points with perpendicular
 * end caps, plus a badge at the midpoint showing the distance in the active
 * unit. Font size, padding and cap length divide by `scale`: this lives
 * inside the main (scaled) Stage, and a badge that shrank with zoom-out
 * would stop being legible exactly when eyeballing the gap gets hardest.
 */
export function LiveDistance() {
  const drag = useViewStore((s) => s.dragDistance);
  const scale = useViewStore((s) => s.scale);
  const units = useDocStore((s) => s.units);

  if (!drag) return null;
  const dx = drag.to.x - drag.from.x;
  const dy = drag.to.y - drag.from.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return null; // guards the unit-vector divide below on a zero-length drag

  const ux = dx / dist;
  const uy = dy / dist;
  const px = -uy; // perpendicular unit vector, for the end caps
  const py = ux;
  const capHalf = DRAG_CAP_PX / 2 / scale;

  const midX = (drag.from.x + drag.to.x) / 2;
  const midY = (drag.from.y + drag.to.y) / 2;
  const label = formatLength(drag.cm, units);
  const fontSize = MEASURE_BADGE_FONT_PX / scale;
  const padX = MEASURE_BADGE_PAD_X_PX / scale;
  const padY = MEASURE_BADGE_PAD_Y_PX / scale;
  const badgeW = measureMonoTextWidth(label, fontSize) + padX * 2;
  const badgeH = fontSize * 1.3 + padY * 2;

  return (
    <>
      <Line
        points={[drag.from.x, drag.from.y, drag.to.x, drag.to.y]}
        stroke={COOL} strokeWidth={1} dash={[3, 3]} strokeScaleEnabled={false} listening={false}
      />
      <Line
        points={[
          drag.from.x - px * capHalf, drag.from.y - py * capHalf,
          drag.from.x + px * capHalf, drag.from.y + py * capHalf,
        ]}
        stroke={COOL_LIGHT} strokeWidth={1} strokeScaleEnabled={false} listening={false}
      />
      <Line
        points={[
          drag.to.x - px * capHalf, drag.to.y - py * capHalf,
          drag.to.x + px * capHalf, drag.to.y + py * capHalf,
        ]}
        stroke={COOL_LIGHT} strokeWidth={1} strokeScaleEnabled={false} listening={false}
      />
      <Rect
        x={midX} y={midY} width={badgeW} height={badgeH} offsetX={badgeW / 2} offsetY={badgeH / 2}
        fill={COOL} listening={false}
      />
      <Text
        x={midX} y={midY} width={badgeW} height={badgeH} offsetX={badgeW / 2} offsetY={badgeH / 2}
        text={label} fontFamily={canvasDataFont()} fontSize={fontSize} fill={ROOM_FILL}
        align="center" verticalAlign="middle" listening={false}
      />
    </>
  );
}
