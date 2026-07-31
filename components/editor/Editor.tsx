'use client';

import { useState } from 'react';
import type { DragEvent } from 'react';
import { CanvasStage } from '@/components/canvas/CanvasStage';
import { ContextMenu } from '@/components/canvas/ContextMenu';
import { SeatMenu } from '@/components/canvas/SeatMenu';
import { Ruler, RulerCorner } from '@/components/canvas/Ruler';
import { Readout } from '@/components/chrome/Readout';
import { ScaleBadge } from '@/components/chrome/ScaleBadge';
import { TopBar } from '@/components/chrome/TopBar';
import { ObjectPalette } from '@/components/chrome/ObjectPalette';
import { Toast } from '@/components/chrome/Toast';
import { Inspector } from '@/components/inspector/Inspector';
import { GuestPanel } from '@/components/guests/GuestPanel';
import { GuestDragGhost } from '@/components/dnd/GuestDragGhost';
import { EmptyState } from '@/components/empty/EmptyState';
import { PanelSheet, SheetBar, type SheetName } from '@/components/editor/PanelSheet';
import { MobileViewer } from '@/components/mobile/MobileViewer';
import { useLayout } from '@/components/mobile/useLayout';
import { useUiStore } from '@/stores/uiStore';
import { loadSavedDoc, useDocStore } from '@/stores/docStore';
import { useViewport } from '@/components/canvas/useViewport';
import { useKeyboard, placeObject } from '@/components/canvas/useKeyboard';
import { useT } from '@/lib/i18n/useT';
import { screenPointToRoomCm } from '@/lib/geometry/viewport';
import { isObjectType, PALETTE_DND_TYPE } from '@/lib/dnd';
import { RULER_SIZE } from '@/lib/constants';

/**
 * First-load restore (Task 16), run exactly once as plain module top-level
 * code rather than inside a React hook. This module is reachable only from
 * `app/page.tsx`'s `next/dynamic(..., { ssr: false })` import of `Editor` —
 * the same mechanism the file header below already relies on for Konva
 * needing `window` — so this line only ever executes in the browser, and it
 * runs once, synchronously, the moment the chunk is evaluated: before
 * React calls `Editor()` for the first time, and therefore before
 * `ObjectPalette`, `GuestPanel` or the `started` read below ever render.
 * There is no server-rendered HTML for this subtree to hydrate against, so
 * there is no mismatch to produce, and no flash of `EmptyState` before a
 * saved document loads — `uiStore.started` is already `true` by the time
 * anything reads it, if `loadSavedDoc()` found something.
 *
 * A React hook's lazy `useState` initializer was the other option, but
 * Strict Mode's dev-only double-invocation of initializers would run this
 * (and `replaceDoc`'s `history.clear()`) twice for no benefit — plain
 * module evaluation happens exactly once regardless of Strict Mode, with no
 * such risk.
 */
const savedDoc = loadSavedDoc();
if (savedDoc) {
  useDocStore.getState().replaceDoc(savedDoc);
  useUiStore.getState().setStarted(true);
}

/**
 * The client root, and the one place the three layouts are chosen between
 * (`useLayout`, a live `matchMedia` subscription — see that hook for why
 * this is not a media query).
 *
 * Below 768px the editor is not hidden, it is never mounted: `EditorShell`
 * and everything it composes — the Konva Stage, its three layers, a node per
 * object, `useViewport`'s ResizeObserver and window key listeners — do not
 * exist on a phone, which gets `MobileViewer` instead. Between 768 and
 * 1023px the editor is complete, with the palette and guest panel slid over
 * the canvas on demand rather than docked, and pointer targets grown to 44px
 * (`data-touch`, styled in `app/globals.css`).
 */
export function Editor() {
  const layout = useLayout();
  return layout === 'phone' ? <MobileViewer /> : <EditorShell touch={layout === 'tablet'} />;
}

/**
 * The 52px top bar is the first child of the outer column;
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
 *
 * `started` (Task 16, set above at module load or by a card in
 * `EmptyState`) gates two things here: the palette renders dimmed and
 * inert until it's true (there's nothing useful to place before the user
 * has picked a room), and `EmptyState` itself overlays the canvas viewport
 * cell — not the whole page — so the top bar, palette and guest panel stay
 * visibly present underneath it the whole time.
 *
 * `touch` (the 768–1023px layout) changes where the two panels live, never
 * what they are: the same `ObjectPalette` and `GuestPanel` instances render
 * inside a `PanelSheet` over the canvas instead of docked beside it, so
 * there is no second, narrow implementation of either panel to keep in step
 * with the real one. Which sheet is open is local state, not `uiStore`:
 * it is a property of this layout at this width, and would be meaningless
 * (and wrong, if it survived a resize) on the desktop layout, where both
 * panels are simply present.
 */
function EditorShell({ touch }: { touch: boolean }) {
  const t = useT();
  const viewport = useViewport();
  useKeyboard(viewport);
  const guestPanelOpen = useUiStore((s) => s.guestPanelOpen);
  const started = useUiStore((s) => s.started);
  const [sheet, setSheet] = useState<SheetName | null>(null);

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

  const palette = (
    <div className={`flex shrink-0 ${started ? '' : 'pointer-events-none opacity-45'}`}>
      <ObjectPalette viewport={viewport} />
    </div>
  );

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden" data-touch={touch ? 'true' : undefined}>
      <TopBar viewport={viewport} />
      {touch && <SheetBar open={sheet} onToggle={(name) => setSheet((open) => (open === name ? null : name))} />}
      <div className="relative flex flex-1 overflow-hidden">
        {!touch && palette}
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
            {!started && <EmptyState />}
          </div>
        </div>
        {!touch && guestPanelOpen && <GuestPanel />}
        {touch && sheet === 'palette' && (
          <PanelSheet side="left" label={t('place')} onClose={() => setSheet(null)}>
            {/* Every control inside the palette is a place-this-object
                action, so any click in there is done with the sheet: it
                closes so the object it just dropped at the viewport centre
                is actually visible.

                Bubble phase, NOT capture. On capture this runs BEFORE the
                palette row's own `onClick`, and unmounting the sheet mid
                dispatch means React never delivers the event to the button
                that was clicked — verified: the sheet closed and no object
                was placed, with Undo still disabled. */}
            <div onClick={() => setSheet(null)} className="flex">{palette}</div>
          </PanelSheet>
        )}
        {touch && sheet === 'guests' && (
          <PanelSheet side="right" label={t('guests')} onClose={() => setSheet(null)}>
            <GuestPanel />
          </PanelSheet>
        )}
      </div>
      <ContextMenu />
      <SeatMenu />
      <GuestDragGhost />
      <Toast />
    </div>
  );
}
