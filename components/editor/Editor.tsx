'use client';

import type { DragEvent } from 'react';
import { CanvasStage } from '@/components/canvas/CanvasStage';
import { ContextMenu } from '@/components/canvas/ContextMenu';
import { Ruler, RulerCorner } from '@/components/canvas/Ruler';
import { Readout } from '@/components/chrome/Readout';
import { ScaleBadge } from '@/components/chrome/ScaleBadge';
import { TopBar } from '@/components/chrome/TopBar';
import { ObjectPalette } from '@/components/chrome/ObjectPalette';
import { Toast } from '@/components/chrome/Toast';
import { Inspector } from '@/components/inspector/Inspector';
import { GuestPanel } from '@/components/guests/GuestPanel';
import { useDocStore } from '@/stores/docStore';
import { useUiStore } from '@/stores/uiStore';
import { useViewport } from '@/components/canvas/useViewport';
import { useKeyboard, placeObject } from '@/components/canvas/useKeyboard';
import { screenPointToRoomCm } from '@/lib/geometry/viewport';
import { isObjectType, PALETTE_DND_TYPE } from '@/lib/dnd';
import { RULER_SIZE } from '@/lib/constants';

// TEMP-TASK-13-SEED: manual verification hook, removed before commit.
if (typeof window !== 'undefined') {
  (window as unknown as { __setting: unknown }).__setting = { useDocStore, useUiStore };
}

/**
 * The client root. The 52px top bar is the first child of the outer column;
 * the 200px palette is the first child of the row; the 320px guest panel
 * (`GuestPanel`, Task 13) is the row's last child, shown whenever
 * `uiStore.guestPanelOpen` is true (default) — that flag predates this
 * task (Task 7) and has no toggle control wired to it yet, but respecting
 * it now costs nothing and means a future "hide panel" button needs no
 * change here.
 *
 * Inside that row, the canvas viewport is its own 2x2 CSS grid: a 28x28
 * corner cell, a top ruler spanning the canvas width and a left ruler
 * spanning its height (Task 11's gutters, each its own small unscaled Konva
 * `Stage`, sitting outside the main one), and the canvas area itself in the
 * remaining cell. `Ruler`'s `length` prop is `viewport.width`/
 * `viewport.height` — the exact pixel size `useElementSize` measures off
 * that same bottom-right cell — so a ruler tick and the room coordinate it
 * names line up pixel-for-pixel with the canvas beneath it. `Readout`
 * (bottom-left), `ScaleBadge` (bottom-right) and `Inspector` (top-right,
 * Task 12) are all absolutely positioned inside that bottom-right cell too
 * (not the outer page), so they float over the canvas viewport only, clear
 * of the ruler gutters and of each other.
 *
 * `useViewport` is called exactly once, here, because its `fitToRoom` /
 * `resetZoom` / `zoomBy` close over the Konva stage and container refs:
 * calling the hook a second place (e.g. inside `TopBar`) would create a
 * second, never-attached set of refs. Everything that needs the viewport —
 * the canvas and rulers, and now `TopBar`'s zoom stepper and
 * `ObjectPalette`'s click-to-place — receives this one instance as a prop.
 *
 * `useKeyboard` (selection/object shortcuts, plus Task 12's `T`
 * new-table-at-viewport-centre and `Cmd/Ctrl+E`) is called here too, rather
 * than composed inside `useViewport`, because unlike `useMarquee` it needs
 * neither the Stage nor the container ref — it only ever reads store state
 * via `getState()`, plus `viewport` itself (mirrored into a ref inside the
 * hook — see its own header comment) for the `T` shortcut's centre point.
 * `ContextMenu` and `Toast` are plain HTML, siblings of the canvas rather
 * than anything inside the Konva `Stage`.
 *
 * `onDragOver`/`onDrop` on the canvas viewport cell back the object
 * palette's drag-to-place: a native HTML5 drag carries `PALETTE_DND_TYPE` in
 * its `dataTransfer` (`ObjectPalette.tsx`'s row `onDragStart`), and the drop
 * point is converted from screen px to room cm via `viewport`'s own
 * scale/pan — the exact inverse of what the Konva `Stage` itself applies.
 */
export function Editor() {
  const viewport = useViewport();
  useKeyboard(viewport);
  const guestPanelOpen = useUiStore((s) => s.guestPanelOpen);

  function handleDragOver(e: DragEvent<HTMLDivElement>): void {
    if (!e.dataTransfer.types.includes(PALETTE_DND_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  function handleDrop(e: DragEvent<HTMLDivElement>): void {
    const type = e.dataTransfer.getData(PALETTE_DND_TYPE);
    if (!isObjectType(type)) return;
    e.preventDefault();
    const container = viewport.containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const point = screenPointToRoomCm(viewport, e.clientX - rect.left, e.clientY - rect.top);
    placeObject(type, point);
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      <TopBar viewport={viewport} />
      <div className="flex flex-1 overflow-hidden">
        <ObjectPalette viewport={viewport} />
        <div
          className="grid flex-1 overflow-hidden"
          // Tailwind's arbitrary-value classes can't interpolate a JS constant,
          // and `RULER_SIZE` is also what `Ruler`/`RulerCorner` themselves read
          // (`lib/constants.ts`) — driving the grid template from the same
          // constant, rather than restating `28px` here, is what makes a future
          // change to `RULER_SIZE` a one-line edit instead of a hunt for every
          // place the gutter width was typed out by hand.
          style={{
            gridTemplateColumns: `${RULER_SIZE}px 1fr`,
            gridTemplateRows: `${RULER_SIZE}px 1fr`,
          }}
        >
          <RulerCorner />
          <Ruler orientation="top" length={viewport.width} />
          <Ruler orientation="left" length={viewport.height} />
          <div className="relative overflow-hidden" onDragOver={handleDragOver} onDrop={handleDrop}>
            <CanvasStage viewport={viewport} />
            <Readout />
            <ScaleBadge />
            <Inspector />
          </div>
        </div>
        {guestPanelOpen && <GuestPanel />}
      </div>
      <ContextMenu />
      <Toast />
    </div>
  );
}
