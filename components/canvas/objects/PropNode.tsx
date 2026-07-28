'use client';

import { memo, useEffect, useRef } from 'react';
import type Konva from 'konva';
import { Group, Rect, Shape, Text } from 'react-konva';
import { useDocStore } from '@/stores/docStore';
import { getBounds, isOutsideRoom } from '@/lib/geometry/bounds';
import { isProp } from '@/lib/types/doc';
import { HATCH_BAND, OBJECT_STROKE, PROP_FILL, ROOM_FILL, TEXT_SECONDARY, canvasDataFont } from '@/lib/canvasTokens';
import { OUTSIDE_ROOM_OPACITY, PROP_LABEL_FONT_SIZE } from '@/lib/constants';

interface PropNodeProps { id: string }

const HATCH_BAND_WIDTH = 6; // cm, matches the design spec's 6px repeating-linear-gradient band

/**
 * Hand-drawn 45° two-tone hatch — Konva has no CSS repeating-gradient
 * equivalent, so this fills the clipped rect with the light band, then
 * strokes a series of parallel 45° lines in the dark band across it, wide
 * enough (`span`) that they cover the rect however it's sized.
 */
function drawHatch(ctx: Konva.Context, width: number, height: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  ctx.fillStyle = ROOM_FILL;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = HATCH_BAND;
  ctx.lineWidth = HATCH_BAND_WIDTH;
  const period = HATCH_BAND_WIDTH * 2;
  const span = width + height;
  for (let offset = -span; offset < span; offset += period) {
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset + height, height);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Bar/stage/buffet/rect share one plain-rect plate; dance floor swaps in
 * the hatch above and skips the shared fill. The hatch is cached (like the
 * room grid in StaticLayer) — it's the one shape here actually expensive
 * enough to redraw every frame — and re-cached whenever this object's own
 * data changes. That's broader than strictly necessary (a resize needs a
 * fresh cache, a plain move doesn't), but it only touches this one dance
 * floor's own effect, not the cross-object re-render this task's isolation
 * rule is actually about.
 */
export const PropNode = memo(function PropNode({ id }: PropNodeProps) {
  const obj = useDocStore((s) => s.objects[id]);
  const room = useDocStore((s) => s.room);
  const hatchRef = useRef<Konva.Shape | null>(null);

  useEffect(() => {
    if (!obj || obj.type !== 'danceFloor') return;
    hatchRef.current?.cache({ x: 0, y: 0, width: obj.width, height: obj.height });
  }, [obj]);

  if (!obj || !isProp(obj)) return null;

  const opacity = isOutsideRoom(getBounds(obj), room) ? OUTSIDE_ROOM_OPACITY : 1;
  const labelH = PROP_LABEL_FONT_SIZE * 1.3;

  return (
    <Group x={obj.x} y={obj.y} rotation={obj.rotation} opacity={opacity}>
      {obj.type === 'danceFloor' ? (
        <>
          <Shape
            ref={hatchRef}
            x={-obj.width / 2}
            y={-obj.height / 2}
            width={obj.width}
            height={obj.height}
            sceneFunc={(ctx) => drawHatch(ctx, obj.width, obj.height)}
          />
          <Rect
            x={-obj.width / 2}
            y={-obj.height / 2}
            width={obj.width}
            height={obj.height}
            stroke={OBJECT_STROKE}
            strokeWidth={1.5}
            dash={[4, 4]}
            strokeScaleEnabled={false}
          />
        </>
      ) : (
        <Rect
          x={-obj.width / 2}
          y={-obj.height / 2}
          width={obj.width}
          height={obj.height}
          fill={obj.type === 'rect' ? undefined : PROP_FILL}
          stroke={OBJECT_STROKE}
          strokeWidth={1.5}
          strokeScaleEnabled={false}
        />
      )}
      <Text
        text={obj.label.toUpperCase()}
        fontFamily={canvasDataFont()}
        fontSize={PROP_LABEL_FONT_SIZE}
        letterSpacing={PROP_LABEL_FONT_SIZE * 0.1}
        fill={TEXT_SECONDARY}
        width={obj.width}
        height={labelH}
        offsetX={obj.width / 2}
        offsetY={labelH / 2}
        align="center"
        verticalAlign="middle"
        wrap="none"
      />
    </Group>
  );
});
