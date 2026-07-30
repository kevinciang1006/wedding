'use client';

import { CanvasStage } from '@/components/canvas/CanvasStage';
import { ContextMenu } from '@/components/canvas/ContextMenu';
import { Ruler, RulerCorner } from '@/components/canvas/Ruler';
import { Readout } from '@/components/chrome/Readout';
import { ScaleBadge } from '@/components/chrome/ScaleBadge';
import { useViewport } from '@/components/canvas/useViewport';
import { useKeyboard } from '@/components/canvas/useKeyboard';

/**
 * The client root. The flex shell below is shaped so later tasks can add a
 * 52 px top bar as the first child of the outer column, a 200 px left
 * palette as the first child of the row, and a 320 px right guest panel as
 * its last child — all without restructuring this component.
 *
 * Inside that row, the canvas viewport is its own 2x2 CSS grid: a 28x28
 * corner cell, a top ruler spanning the canvas width and a left ruler
 * spanning its height (Task 11's gutters, each its own small unscaled Konva
 * `Stage`, sitting outside the main one), and the canvas area itself in the
 * remaining cell. `Ruler`'s `length` prop is `viewport.width`/
 * `viewport.height` — the exact pixel size `useElementSize` measures off
 * that same bottom-right cell — so a ruler tick and the room coordinate it
 * names line up pixel-for-pixel with the canvas beneath it. `Readout` and
 * `ScaleBadge` are absolutely positioned inside that bottom-right cell too
 * (not the outer page), so they float over the canvas viewport only, clear
 * of the ruler gutters.
 *
 * `useViewport` is called exactly once, here, because its `fitToRoom` /
 * `resetZoom` / `zoomBy` close over the Konva stage and container refs:
 * calling the hook a second place (e.g. inside a future top bar) would
 * create a second, never-attached set of refs. Everything that needs the
 * viewport — the canvas and rulers now, chrome later — receives this one
 * instance.
 *
 * `useKeyboard` (selection/object shortcuts) is called here too, rather
 * than composed inside `useViewport`, because unlike `useMarquee` it needs
 * neither the Stage nor the container ref — it only ever reads store state
 * via `getState()`. `ContextMenu` is plain HTML, a sibling of the canvas
 * rather than something inside the Konva `Stage`.
 */
export function Editor() {
  const viewport = useViewport();
  useKeyboard();

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <div className="grid flex-1 grid-cols-[28px_1fr] grid-rows-[28px_1fr] overflow-hidden">
          <RulerCorner />
          <Ruler orientation="top" length={viewport.width} />
          <Ruler orientation="left" length={viewport.height} />
          <div className="relative overflow-hidden">
            <CanvasStage viewport={viewport} />
            <Readout />
            <ScaleBadge />
          </div>
        </div>
      </div>
      <ContextMenu />
    </div>
  );
}
