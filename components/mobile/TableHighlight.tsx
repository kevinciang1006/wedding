'use client';

import { Circle, Group, Layer, Rect } from 'react-konva';
import { useDocStore } from '@/stores/docStore';
import { useViewStore } from '@/stores/viewStore';
import { HIGHLIGHT_GLOW, HIGHLIGHT_RING } from '@/lib/canvasTokens';
import { MOBILE_RING_GLOW_PX, MOBILE_RING_PX } from '@/lib/constants';

interface TableHighlightProps {
  /** The searched guest's table, or `null` when nothing is found. */
  tableId: string | null;
}

/**
 * The one mark the mobile viewer adds to the plan: a warm ring around the
 * table the searched guest is sitting at.
 *
 * Both strokes are screen measures (`strokeScaleEnabled={false}`), so the
 * ring stays exactly as thick at fit-to-room zoom as it is zoomed in — it is
 * a piece of interface pointing at the table, not a feature of the furniture.
 * The halo is drawn as a second stroke on a path pushed
 * `(ring + glow) / 2` screen px outward, which puts its 5px band immediately
 * OUTSIDE the ring rather than straddling it — the geometry a CSS
 * `box-shadow: 0 0 0 5px` produces around a 2px border.
 *
 * Its own `Layer`, above the objects and `listening={false}`: on a surface
 * where nothing can be edited, a mark that could be clicked would be a lie.
 */
export function TableHighlight({ tableId }: TableHighlightProps) {
  const obj = useDocStore((s) => (tableId ? s.objects[tableId] : undefined));
  const scale = useViewStore((s) => s.scale);

  if (!obj || obj.type === 'label') return null;

  // Half the ring plus half the halo, in world cm — the offset that seats the
  // halo band just outside the ring at any zoom.
  const gap = ((MOBILE_RING_PX + MOBILE_RING_GLOW_PX) / 2) / scale;

  return (
    <Layer listening={false}>
      <Group x={obj.x} y={obj.y} rotation={obj.rotation}>
        {obj.type === 'roundTable' ? (
          <>
            <Circle
              radius={obj.diameter / 2 + gap}
              stroke={HIGHLIGHT_GLOW}
              strokeWidth={MOBILE_RING_GLOW_PX}
              strokeScaleEnabled={false}
            />
            <Circle
              radius={obj.diameter / 2}
              stroke={HIGHLIGHT_RING}
              strokeWidth={MOBILE_RING_PX}
              strokeScaleEnabled={false}
            />
          </>
        ) : (
          <>
            <Rect
              x={-obj.width / 2 - gap}
              y={-obj.height / 2 - gap}
              width={obj.width + gap * 2}
              height={obj.height + gap * 2}
              stroke={HIGHLIGHT_GLOW}
              strokeWidth={MOBILE_RING_GLOW_PX}
              strokeScaleEnabled={false}
            />
            <Rect
              x={-obj.width / 2}
              y={-obj.height / 2}
              width={obj.width}
              height={obj.height}
              stroke={HIGHLIGHT_RING}
              strokeWidth={MOBILE_RING_PX}
              strokeScaleEnabled={false}
            />
          </>
        )}
      </Group>
    </Layer>
  );
}
