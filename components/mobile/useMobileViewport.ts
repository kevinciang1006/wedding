'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type Konva from 'konva';
import { useDocStore } from '@/stores/docStore';
import { useViewStore } from '@/stores/viewStore';
import { useElementSize } from '@/components/canvas/useElementSize';
import { fitView, zoomAt } from '@/lib/geometry/viewport';
import { FIT_PADDING } from '@/lib/constants';

// Same feel as the editor's Ctrl/Cmd+wheel zoom — this path only exists for
// a narrow desktop window (a phone has no wheel), so it should not behave
// differently there than the editor does.
const WHEEL_ZOOM_SENSITIVITY = 0.002;

export interface MobileViewport {
  containerRef: RefObject<HTMLDivElement | null>;
  stageRef: RefObject<Konva.Stage | null>;
  width: number;
  height: number;
  scale: number;
  x: number;
  y: number;
  /** False for the duration of a two-finger gesture — see `handleTouchStart`. */
  draggable: boolean;
  fitToRoom: () => void;
  zoomBy: (factor: number) => void;
  handleWheel: (e: Konva.KonvaEventObject<WheelEvent>) => void;
  handleTouchStart: (e: Konva.KonvaEventObject<TouchEvent>) => void;
  handleTouchMove: (e: Konva.KonvaEventObject<TouchEvent>) => void;
  handleTouchEnd: (e: Konva.KonvaEventObject<TouchEvent>) => void;
  handleDragMove: () => void;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Pan and zoom for the read-only mobile plan: one finger drags, two fingers
 * pinch, and the +/− stepper zooms about the middle of the plan window.
 *
 * Deliberately NOT `useViewport`. That hook is the editor's, and half of what
 * it composes — marquee select, the space-to-pan keyboard model, cursor
 * states, object drag plumbing — is either meaningless or actively wrong on a
 * surface where nothing can be edited. What the two genuinely share is the
 * transform maths, and that lives in `lib/geometry/viewport.ts` (`zoomAt`,
 * `fitView`) where both call it, so the phone and the desktop cannot drift
 * apart on how zoom pins a point or where the scale limits are.
 *
 * Pan/zoom state still goes through `viewStore`, exactly as the editor's
 * does, because `Ruler` reads `scale`/`x`/`y` from there — that is what keeps
 * the mobile gutters aligned with the plan beneath them, with no second
 * mechanism.
 */
export function useMobileViewport(): MobileViewport {
  const room = useDocStore((s) => s.room);
  const setView = useViewStore((s) => s.setView);
  const scale = useViewStore((s) => s.scale);
  const x = useViewStore((s) => s.x);
  const y = useViewStore((s) => s.y);

  const { ref: containerRef, width, height } = useElementSize<HTMLDivElement>();
  const stageRef = useRef<Konva.Stage | null>(null);
  // Finger separation on the previous touchmove of the current pinch; 0
  // between pinches, so the first two-finger frame only records a baseline
  // and never zooms off a garbage ratio.
  const lastPinchDistRef = useRef(0);
  const [pinching, setPinching] = useState(false);

  const fitToRoom = useCallback(() => {
    if (width === 0 || height === 0) return;
    setView(fitView(width, height, room, FIT_PADDING));
  }, [width, height, room, setView]);

  // Reads the live Konva node rather than the store: mid-pinch, several
  // touchmove frames can land before React has re-rendered with the new
  // scale, and each must build on the last one's result.
  const zoomAtPoint = useCallback((nextScaleOf: (current: number) => number, point: { x: number; y: number }) => {
    const stage = stageRef.current;
    if (!stage) return;
    const current = { scale: stage.scaleX(), x: stage.x(), y: stage.y() };
    setView(zoomAt(current, nextScaleOf(current.scale), point));
  }, [setView]);

  const zoomBy = useCallback((factor: number) => {
    zoomAtPoint((current) => current * factor, { x: width / 2, y: height / 2 });
  }, [zoomAtPoint, width, height]);

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    if (e.evt.ctrlKey || e.evt.metaKey) {
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      zoomAtPoint((current) => current * Math.exp(-e.evt.deltaY * WHEEL_ZOOM_SENSITIVITY), pointer);
      return;
    }
    setView({ x: stage.x() - e.evt.deltaX, y: stage.y() - e.evt.deltaY });
  }, [zoomAtPoint, setView]);

  /**
   * A second finger landing ends the pan the first one started, and blocks
   * another from arming until every finger is off the glass.
   *
   * Without this the two gestures compose instead of taking turns, and
   * measurably so: a pinch that spread two fingers from 60 to 180px apart
   * zoomed correctly (0.131 -> 0.394) but ALSO panned the stage by exactly
   * the first finger's own -60px, because Konva's drag-and-drop moves the
   * node from its own rAF loop after our handler has already written the
   * zoomed transform. Stopping the drag is not enough on its own —
   * `draggable` has to go false too, or the next touchmove simply re-arms
   * it.
   */
  const handleTouchStart = useCallback((e: Konva.KonvaEventObject<TouchEvent>) => {
    if (e.evt.touches.length < 2) return;
    const stage = stageRef.current;
    // Imperative as well as via state: `setPinching` only lands on the next
    // render, and the drag has to be dead in this frame.
    if (stage) {
      if (stage.isDragging()) stage.stopDrag();
      stage.draggable(false);
    }
    setPinching(true);
  }, []);

  const handleTouchMove = useCallback((e: Konva.KonvaEventObject<TouchEvent>) => {
    const [t1, t2] = [e.evt.touches[0], e.evt.touches[1]];
    if (!t1 || !t2) return; // one finger: Konva's own Stage drag is panning
    e.evt.preventDefault();
    const stage = stageRef.current;
    const container = containerRef.current;
    if (!stage || !container) return;
    // Belt and braces against a drag armed before the second finger landed.
    if (stage.isDragging()) stage.stopDrag();

    const rect = container.getBoundingClientRect();
    const a = { x: t1.clientX - rect.left, y: t1.clientY - rect.top };
    const b = { x: t2.clientX - rect.left, y: t2.clientY - rect.top };
    const dist = distance(a, b);
    const last = lastPinchDistRef.current;
    lastPinchDistRef.current = dist;
    if (last === 0 || dist === 0) return;

    zoomAtPoint((current) => current * (dist / last), { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  }, [zoomAtPoint, containerRef]);

  // Lifting either finger ends this pinch: the next two-finger gesture must
  // start from a fresh baseline, not from the separation of the fingers that
  // just left. Panning only comes back once the LAST finger is up — lifting
  // one of two mid-pinch must not hand the remaining one a pan halfway
  // through the gesture.
  const handleTouchEnd = useCallback((e: Konva.KonvaEventObject<TouchEvent>) => {
    lastPinchDistRef.current = 0;
    if (e.evt.touches.length > 0) return;
    setPinching(false);
  }, []);

  const handleDragMove = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    setView({ x: stage.x(), y: stage.y() });
  }, [setView]);

  // Fit on mount, and re-fit whenever the room or the plan window's own size
  // changes (an orientation change is the case that matters on a phone).
  useEffect(() => {
    fitToRoom();
  }, [fitToRoom]);

  return {
    containerRef, stageRef, width, height, scale, x, y, draggable: !pinching,
    fitToRoom, zoomBy, handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd, handleDragMove,
  };
}
