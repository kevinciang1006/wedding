'use client';

import { Stage } from 'react-konva';
import Konva from 'konva';
import { StaticLayer } from '@/components/canvas/StaticLayer';
import { ObjectsLayer } from '@/components/canvas/ObjectsLayer';
import { OverlayLayer } from '@/components/canvas/OverlayLayer';
import type { Viewport } from '@/components/canvas/useViewport';

// Konva arms a drag on every draggable node for any button in this global
// list (Node.js's own internal mousedown.konva listener), independently of
// our own onMouseDown/onDragStart handlers and unrestrained by
// preventDefault(). Its default, [0, 1], means a middle-click on top of a
// table/prop/label both pans the Stage (an explicit startDrag() call below)
// AND arms that object's own drag from the same pointer stream. Narrowing
// this once, module-wide, to left-button-only removes the object side of
// that without touching the Stage's own pan, which never went through this
// mechanism in the first place.
Konva.dragButtons = [0];

interface CanvasStageProps {
  viewport: Viewport;
}

// The browser's own right-click menu has no place over this canvas — every
// right-click here either opens `ContextMenu` (via an object node's own
// handler, which fires first and bubbles up here too) or lands on empty
// canvas, where there is nothing to show a native menu for either.
function handleContextMenu(e: Konva.KonvaEventObject<PointerEvent>): void {
  e.evt.preventDefault();
}

/**
 * One `Stage`, three `Layer`s back to front: Static (room + grid, cached),
 * Objects (tables/props/labels/seats) and Overlay (marquee, alignment
 * guides, the selection Transformer). Separate layers so panning or
 * redrawing one never forces a repaint of the others.
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
        onContextMenu={handleContextMenu}
      >
        <StaticLayer />
        <ObjectsLayer />
        <OverlayLayer />
      </Stage>
    </div>
  );
}
