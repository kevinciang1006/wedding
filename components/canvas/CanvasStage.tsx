'use client';

import { Layer, Stage } from 'react-konva';
import { StaticLayer } from '@/components/canvas/StaticLayer';
import { ObjectsLayer } from '@/components/canvas/ObjectsLayer';
import type { Viewport } from '@/components/canvas/useViewport';

interface CanvasStageProps {
  viewport: Viewport;
}

/**
 * One `Stage`, three `Layer`s back to front: Static (room + grid, cached),
 * Objects (tables/props/labels/seats) and Overlay (Task 10) — the last an
 * empty placeholder here. Separate layers so panning or redrawing one never
 * forces a repaint of the others.
 *
 * Zoom/pan live entirely on the Stage's own `scaleX`/`scaleY`/`x`/`y`; every
 * child is drawn in room centimetres (1 cm = 1 Konva unit), never pre
 * multiplied by scale.
 */
export function CanvasStage({ viewport }: CanvasStageProps) {
  const {
    containerRef, stageRef, width, height, scale, x, y, cursor,
    handleWheel, handleMouseDown, handleDragStart, handleDragMove, handleDragEnd,
  } = viewport;

  return (
    <div ref={containerRef} className="h-full w-full overflow-hidden bg-canvas">
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        scaleX={scale}
        scaleY={scale}
        x={x}
        y={y}
        style={{ cursor }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
      >
        <StaticLayer />
        <ObjectsLayer />
        <Layer />
      </Stage>
    </div>
  );
}
