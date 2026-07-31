'use client';

import Konva from 'konva';
import { useDocStore } from '@/stores/docStore';
import { useViewStore } from '@/stores/viewStore';
import type { ViewStoreState } from '@/stores/viewStore';
import { seatOfGuest } from '@/lib/doc/assignments';
import { flattenSeatPoints, nearestSeatWithin } from '@/lib/geometry/seatHitTest';
import { screenPointToRoomCm } from '@/lib/geometry/viewport';
import { GUEST_DRAG_ARM_PX, SEAT_DROP_RANGE } from '@/lib/constants';

/**
 * The seat, if any, within `SEAT_DROP_RANGE` of a client (screen) point —
 * reads the live Konva `Stage` directly rather than `viewStore`'s own
 * scale/x/y, the same reasoning `useViewport.ts`'s `zoomToPointer` gives for
 * doing the same: this needs to be correct on every raw pointermove of a
 * gesture, not just after React has caught up to a store write.
 *
 * `Konva.stages` is a flat global array of every mounted Stage, not just the
 * main canvas one — the two `Ruler` gutters each own their own small,
 * unscaled Stage too (`Ruler.tsx`), and mount BEFORE the main one in
 * `Editor.tsx`'s JSX order, so `Konva.stages[0]` is actually a ruler, not the
 * canvas. `CanvasStage.tsx` names its Stage `"main-stage"` specifically so
 * this can find the right one regardless of mount order — the same
 * name-based-lookup convention `lib/io/png.ts` already uses for
 * `OverlayLayer`'s `name="overlay-layer"`.
 */
function hitTestSeat(seatPoints: ReturnType<typeof flattenSeatPoints>, clientX: number, clientY: number): string | null {
  const stage = Konva.stages.find((s) => s.name() === 'main-stage');
  if (!stage) return null;
  const rect = stage.container().getBoundingClientRect();
  const world = screenPointToRoomCm(
    { width: stage.width(), height: stage.height(), scale: stage.scaleX(), x: stage.x(), y: stage.y() },
    clientX - rect.left,
    clientY - rect.top,
  );
  return nearestSeatWithin(seatPoints, world, SEAT_DROP_RANGE);
}

/**
 * The one commit a guest drag ever makes, fired exactly once at release —
 * never during the gesture (see `startGuestDrag`'s own header). Dropping on
 * a seat that already holds this exact guest is deliberately left to
 * `assignSeat`'s own no-op guard (`lib/doc/assignments.ts`) rather than
 * checked again here: calling `seatGuest` unconditionally and letting the
 * store's `commit` bail on zero patches is one fewer place this invariant
 * has to be kept in sync. Dropping off every seat unseats a *currently
 * seated* guest (dragging them "off the table"); dropping an already-
 * unseated guest off every seat is the true no-op the brief calls out
 * separately — there is no seat to clear, so nothing happens at all,
 * regardless of whether this guest's drag started at their own seat or at
 * their panel row.
 */
function resolveDrop(guestId: string): void {
  const hoveredSeatId = useViewStore.getState().hoveredSeatId;
  if (hoveredSeatId !== null) {
    const currentOccupant = useDocStore.getState().seatAssignments[hoveredSeatId] ?? null;
    if (currentOccupant !== guestId) {
      useDocStore.getState().seatGuest(hoveredSeatId, guestId);
      useViewStore.getState().setJustSeated(hoveredSeatId);
    }
    return;
  }
  const wasSeated = seatOfGuest(useDocStore.getState().seatAssignments, guestId) !== null;
  if (wasSeated) useDocStore.getState().unseat(guestId);
}

/**
 * Arms and tracks one guest pointer-drag gesture, from a `pointerdown` on
 * either a `GuestChip`'s handle (panel origin) or an occupied `SeatNode`
 * (canvas origin) through to release. A plain function, not a hook — Konva
 * shapes render to `<canvas>`, not real DOM nodes, so `SeatNode` cannot
 * attach a React `onPointerMove` the way `GuestChip`'s handle can; both
 * origins instead call this same imperative entry point from their own
 * `pointerdown` handler. Critically, this also means `SeatNode` never calls
 * the `useGuestDrag()` hook below (which subscribes to `viewStore.guestDrag`,
 * changing on every pointermove of *any* guest drag) — doing so would
 * re-render every mounted seat on every frame of a drag it has nothing to do
 * with, exactly the isolation regression the brief warns has happened here
 * before.
 *
 * `setPointerCapture` on the gesture's origin element (the handle `<div>`,
 * or the canvas element under a Konva pointerdown's native `event.target`)
 * is what lets a single pair of `window` listeners track the whole gesture
 * correctly across the DOM/canvas boundary this app has: capture re-targets
 * subsequent pointer events to the origin element regardless of what the
 * pointer is visually over, and since that element is still inside the
 * document, those events keep bubbling up to `window` exactly as normal.
 * `clientX`/`clientY` are never affected by capture — only the event's
 * target/bubble path is — so the actual hit-testing below (which only ever
 * reads `clientX`/`clientY`, never `event.target`) works identically either
 * way.
 *
 * Arms after `GUEST_DRAG_ARM_PX` of movement: nothing is published to
 * `viewStore` — no ghost, no list placeholder, no seat hover — until that
 * threshold is crossed, so a plain click-and-release (a tap on the handle,
 * or a tap on a seat that should open `SeatMenu` instead) never flashes
 * drag UI. `onTap`, when given, fires once at release if the gesture never
 * armed — `SeatNode` uses it to open the click menu on an occupied seat
 * (mirroring the plain `onClick` an *empty* seat can use directly, since an
 * empty seat has no guest to drag in the first place and so never needs this
 * function at all).
 *
 * Never writes to `docStore` before release: every `pointermove` publishes
 * only to `viewStore` (the ghost position, the hovered seat), and the single
 * `docStore` write happens in `resolveDrop` at `pointerup`, once, so one
 * drag gesture is exactly one history entry.
 */
export function startGuestDrag(
  guestId: string,
  event: PointerEvent,
  onTap?: (clientX: number, clientY: number) => void,
): void {
  if (event.button !== 0) return;
  // Stops the browser's own text-selection/native-drag gesture from
  // starting alongside ours — this is a plain-pointer-events reimplementation
  // of drag-and-drop specifically so no native drag ever competes with it.
  event.preventDefault();

  const originTarget = event.target;
  if (originTarget instanceof Element) originTarget.setPointerCapture(event.pointerId);

  const pointerId = event.pointerId;
  const startX = event.clientX;
  const startY = event.clientY;
  let armed = false;

  // Snapshotted once for the whole gesture — see `flattenSeatPoints`'s own
  // header for why recomputing this per pointermove would be wasteful.
  const { objects, objectOrder } = useDocStore.getState();
  const seatPoints = flattenSeatPoints(objects, objectOrder);

  function stopTracking(): void {
    window.removeEventListener('pointermove', handleMove);
    window.removeEventListener('pointerup', handleUp);
    window.removeEventListener('pointercancel', handleCancel);
    if (originTarget instanceof Element && originTarget.hasPointerCapture(pointerId)) {
      originTarget.releasePointerCapture(pointerId);
    }
  }

  function handleMove(e: PointerEvent): void {
    if (e.pointerId !== pointerId) return;
    if (!armed) {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) < GUEST_DRAG_ARM_PX) return;
      armed = true;
    }
    useViewStore.getState().setGuestDrag({ guestId, x: e.clientX, y: e.clientY });
    useViewStore.getState().setHoveredSeat(hitTestSeat(seatPoints, e.clientX, e.clientY));
  }

  function handleUp(e: PointerEvent): void {
    if (e.pointerId !== pointerId) return;
    stopTracking();
    if (armed) {
      resolveDrop(guestId);
      useViewStore.getState().setGuestDrag(null);
      useViewStore.getState().setHoveredSeat(null);
    } else {
      onTap?.(e.clientX, e.clientY);
    }
  }

  // The browser/OS aborted the gesture (e.g. a system context menu
  // interrupted it) — abandon it exactly like releasing over nothing, never
  // committing a drop the user never actually chose.
  function handleCancel(e: PointerEvent): void {
    if (e.pointerId !== pointerId) return;
    stopTracking();
    useViewStore.getState().setGuestDrag(null);
    useViewStore.getState().setHoveredSeat(null);
  }

  window.addEventListener('pointermove', handleMove);
  window.addEventListener('pointerup', handleUp);
  window.addEventListener('pointercancel', handleCancel);
}

/**
 * Reactive access to the in-progress guest drag, for the two components that
 * actually need to re-render as it changes: `GuestDragGhost` (follows
 * `dragging.x`/`y`) and each `GuestChip` (only the one whose own id matches
 * `dragging?.guestId` cares — see that component's own selector). `start` is
 * `startGuestDrag` itself, exposed here too so a panel-origin call site can
 * get both `dragging` and `start` from one import.
 */
export function useGuestDrag(): { dragging: ViewStoreState['guestDrag']; start: typeof startGuestDrag } {
  const dragging = useViewStore((s) => s.guestDrag);
  return { dragging, start: startGuestDrag };
}
