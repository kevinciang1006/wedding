'use client';

import { useEffect, useRef } from 'react';
import { Group, Layer, Rect, Shape } from 'react-konva';
import type Konva from 'konva';
import { useDocStore } from '@/stores/docStore';
import { useViewStore } from '@/stores/viewStore';
import { GRID_HIDE_BELOW, GRID_MAJOR, GRID_MINOR } from '@/lib/constants';
import { GRID_MAJOR_COLOR, GRID_MINOR_COLOR, ROOM_FILL, ROOM_WALL } from '@/lib/canvasTokens';

function drawGridLines(ctx: Konva.Context, shape: Konva.Shape, room: { width: number; height: number }, step: number): void {
  ctx.beginPath();
  for (let gx = step; gx < room.width; gx += step) {
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, room.height);
  }
  for (let gy = step; gy < room.height; gy += step) {
    ctx.moveTo(0, gy);
    ctx.lineTo(room.width, gy);
  }
  ctx.strokeShape(shape);
}

/**
 * Room outline and grid, `listening={false}` throughout — nothing here is
 * ever a hit target.
 *
 * The room `Rect` is drawn live every frame, deliberately NOT part of the
 * cache: `strokeScaleEnabled={false}` keeps a stroke at a constant screen
 * width only by re-measuring the current transform on every draw. Once a
 * shape is rasterized by `.cache()`, that guarantee is gone — the cached
 * bitmap is captured once (at the node's own, ancestor-transform-free
 * coordinate space) and is then stretched by whatever the Stage's *current*
 * scale happens to be when it's composited, so a cached "non-scaling" 2px
 * wall would visibly grow and blur at high zoom instead of staying 2px. A
 * single rect redraw is essentially free, so nothing is gained by caching
 * it anyway — the grid (many line segments) is the part actually worth it,
 * and a soft grid hairline at extreme zoom is inconsequential where a soft
 * wall would not be.
 */
export function StaticLayer() {
  const room = useDocStore((s) => s.room);
  const gridVisible = useViewStore((s) => s.gridVisible);
  const scale = useViewStore((s) => s.scale);
  const gridGroupRef = useRef<Konva.Group | null>(null);

  // Below GRID_HIDE_BELOW the lines would sit closer together on screen
  // than the grid is legible, so it disappears rather than turning to noise.
  const showGrid = gridVisible && scale >= GRID_HIDE_BELOW;

  // Re-rasterize only when the pixels themselves would change: the room's
  // size, or whether the grid should currently be drawn. `showGrid` folds
  // the scale threshold into one boolean that flips exactly once at the
  // 0.25 crossing rather than on every zoom frame — that (not the room-size
  // check) is what keeps `.cache()` off the pan/zoom hot path. Konva also
  // re-checks a node's own `visible` before it ever looks at that node's
  // cache, so toggling `showGrid` alone already hides/shows the grid
  // correctly without this call; it's kept as a defensive, spec-literal
  // invalidation rather than something the toggle strictly depends on.
  useEffect(() => {
    gridGroupRef.current?.cache({ x: 0, y: 0, width: room.width, height: room.height });
  }, [room.width, room.height, showGrid]);

  return (
    <Layer listening={false}>
      <Rect
        x={0}
        y={0}
        width={room.width}
        height={room.height}
        fill={ROOM_FILL}
        stroke={ROOM_WALL}
        strokeWidth={2}
        strokeScaleEnabled={false}
      />
      <Group
        ref={gridGroupRef}
        visible={showGrid}
        clipX={0}
        clipY={0}
        clipWidth={room.width}
        clipHeight={room.height}
      >
        <Shape
          stroke={GRID_MINOR_COLOR}
          strokeWidth={1}
          strokeScaleEnabled={false}
          sceneFunc={(ctx, shape) => drawGridLines(ctx, shape, room, GRID_MINOR)}
        />
        <Shape
          stroke={GRID_MAJOR_COLOR}
          strokeWidth={1}
          strokeScaleEnabled={false}
          sceneFunc={(ctx, shape) => drawGridLines(ctx, shape, room, GRID_MAJOR)}
        />
      </Group>
    </Layer>
  );
}
