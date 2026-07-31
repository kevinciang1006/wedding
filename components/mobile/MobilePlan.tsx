'use client';

import { useEffect } from 'react';
import { Stage } from 'react-konva';
import { StaticLayer } from '@/components/canvas/StaticLayer';
import { ObjectsLayer } from '@/components/canvas/ObjectsLayer';
import { Ruler, RulerCorner } from '@/components/canvas/Ruler';
import { TableHighlight } from '@/components/mobile/TableHighlight';
import { useMobileViewport } from '@/components/mobile/useMobileViewport';
import { useT } from '@/lib/i18n/useT';
import { MOBILE_PLAN_HEIGHT_PX, RULER_SIZE, ZOOM_KEY_STEP } from '@/lib/constants';

interface MobilePlanProps {
  /** The searched guest's table, ringed and brought back into view. */
  tableId: string | null;
}

/**
 * The read-only plan: the same room, grid, tables, props and seats the editor
 * draws, at the same 1 cm = 1 Konva unit scale, with the same rulers beside
 * it — and nothing else.
 *
 * What is deliberately absent is the point of the screen. No overlay layer,
 * so no selection Transformer, no alignment guides, no drag-distance tape and
 * no duplicate ghosts; no readout, no scale badge, no inspector.
 * `ObjectsLayer` is mounted with `interactive={false}`, which turns off Konva
 * hit-testing for that whole subtree: a table cannot be picked up, a seat
 * cannot open its menu, a right-click has no context menu behind it. Nothing
 * on screen suggests an edit that cannot happen here.
 */
export function MobilePlan({ tableId }: MobilePlanProps) {
  const t = useT();
  // Destructured rather than kept as a `viewport` object, matching
  // `CanvasStage`: `react-hooks/refs` reads a property access that yields a
  // ref as accessing a ref during render, and taints every later read of the
  // same object.
  const {
    containerRef, stageRef, width, height, scale, x, y, draggable,
    fitToRoom, zoomBy, handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd, handleDragMove,
  } = useMobileViewport();

  // A guest who has already panned or zoomed, then searched, must not be
  // left looking at an empty corner of the room while their ring sits off
  // screen. Fitting the whole room is the one framing that is guaranteed to
  // contain the ring, and it also answers the question a guest is really
  // asking — where the table is in the room, not what it looks like closeup.
  useEffect(() => {
    if (tableId) fitToRoom();
  }, [tableId, fitToRoom]);

  return (
    // A fixed height, not a growing one. A phone is far taller than it is
    // wide, so fit-to-room here is always bound by WIDTH: handing this box
    // the page's spare vertical space does not make the room any bigger, it
    // just centres the same drawing inside a taller box and pushes it below
    // the fold. Measured at 390x844 — a 574px-tall box drew the identical
    // 184px-tall room as a 300px one, 150px further down the screen.
    <div
      className="relative mx-4 mt-3.5 shrink-0 border border-rule bg-canvas"
      style={{ height: MOBILE_PLAN_HEIGHT_PX }}
    >
      <div
        className="grid h-full w-full"
        style={{ gridTemplateColumns: `${RULER_SIZE}px 1fr`, gridTemplateRows: `${RULER_SIZE}px 1fr` }}
      >
        <RulerCorner />
        <Ruler orientation="top" length={width} />
        <Ruler orientation="left" length={height} />
        <div
          ref={containerRef}
          className="relative overflow-hidden bg-canvas"
          // The browser must not claim the gesture: without this, a drag
          // across the plan scrolls the page behind it and a pinch zooms the
          // whole document. Konva's own touch handling only ever sees what
          // the browser leaves it.
          style={{ touchAction: 'none' }}
        >
          <Stage
            ref={stageRef}
            width={width}
            height={height}
            scaleX={scale}
            scaleY={scale}
            x={x}
            y={y}
            draggable={draggable}
            onDragMove={handleDragMove}
            onDragEnd={handleDragMove}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <StaticLayer />
            <ObjectsLayer interactive={false} />
            <TableHighlight tableId={tableId} />
          </Stage>
        </div>
      </div>

      <span className="pointer-events-none absolute bottom-2.5 left-2.5 font-[family-name:var(--font-data)] text-[9.5px] text-text-secondary">
        {t('pinchToZoom')}
      </span>

      <div className="absolute bottom-2 right-2.5 flex flex-col border border-rule bg-paper">
        <button
          type="button"
          aria-label={t('zoomIn')}
          onClick={() => zoomBy(ZOOM_KEY_STEP)}
          className="flex h-7 w-7 items-center justify-center text-[15px] text-text-body"
        >
          +
        </button>
        <button
          type="button"
          aria-label={t('zoomOut')}
          onClick={() => zoomBy(1 / ZOOM_KEY_STEP)}
          className="flex h-7 w-7 items-center justify-center border-t border-divider text-[15px] text-text-body"
        >
          −
        </button>
      </div>
    </div>
  );
}
