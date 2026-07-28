'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type Konva from 'konva';
import { useDocStore } from '@/stores/docStore';
import { useViewStore } from '@/stores/viewStore';
import { FIT_PADDING, MAX_SCALE, MIN_SCALE, ZOOM_KEY_STEP } from '@/lib/constants';

// Safari has no `wheel`+`ctrlKey` pinch emulation; it fires these non-standard
// gesture events instead. `lib.dom.d.ts` doesn't know about them, so they're
// declared here rather than reached for with `any` at the call site.
declare global {
  interface GestureEvent extends UIEvent {
    readonly scale: number;
    readonly clientX: number;
    readonly clientY: number;
  }
  interface WindowEventMap {
    gesturestart: GestureEvent;
    gesturechange: GestureEvent;
  }
}

// How much a single wheel "notch" (deltaY ~100) changes scale under
// Ctrl/Cmd+wheel or trackpad-pinch-as-wheel. Exponential so repeated small
// deltas (trackpad) compose smoothly and large ones (a mouse wheel notch)
// don't feel like a jump-cut.
const WHEEL_ZOOM_SENSITIVITY = 0.002;

type CursorStyle = 'default' | 'grab' | 'grabbing';

export interface Viewport {
  containerRef: RefObject<HTMLDivElement | null>;
  stageRef: RefObject<Konva.Stage | null>;
  width: number;
  height: number;
  scale: number;
  x: number;
  y: number;
  cursor: CursorStyle;
  fitToRoom: () => void;
  resetZoom: () => void;
  zoomBy: (factor: number, pointer: Konva.Vector2d) => void;
  handleWheel: (e: Konva.KonvaEventObject<WheelEvent>) => void;
  handleMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  handleDragStart: () => void;
  handleDragMove: () => void;
  handleDragEnd: () => void;
}

function isEditableTarget(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
}

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

// Scale + position that puts the room's centre at the viewport's centre,
// shared by fit-to-room and reset-zoom (which only differ in what scale
// they centre at).
function centeredView(
  scale: number,
  viewportWidth: number,
  viewportHeight: number,
  room: { width: number; height: number },
): { scale: number; x: number; y: number } {
  const clamped = clampScale(scale);
  return {
    scale: clamped,
    x: viewportWidth / 2 - (room.width / 2) * clamped,
    y: viewportHeight / 2 - (room.height / 2) * clamped,
  };
}

// Last known pointer position for keyboard-triggered zoom, which has no
// pointer of its own. Konva remembers the last real pointer event even when
// no button is down; falling back to the viewport centre covers the case
// where the pointer has never entered the canvas at all.
function lastPointerOrCenter(stage: Konva.Stage | null, container: HTMLDivElement | null): Konva.Vector2d {
  const last = stage?.getPointerPosition();
  if (last) return last;
  if (container) {
    const rect = container.getBoundingClientRect();
    return { x: rect.width / 2, y: rect.height / 2 };
  }
  return { x: 0, y: 0 };
}

export function useViewport(): Viewport {
  const room = useDocStore((s) => s.room);
  const setView = useViewStore((s) => s.setView);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  // Whether Space is currently held, tracked outside React state: it's read
  // synchronously inside the mousedown handler and doesn't itself affect
  // what's rendered, so a ref avoids a render on every keydown/keyup.
  const isSpaceHeldRef = useRef(false);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [cursor, setCursor] = useState<CursorStyle>('default');

  // The Stage needs explicit pixel dimensions (a <canvas> can't just be
  // told "100%"), so the container is measured and that measurement fed
  // back in as props.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Zoom toward the pointer, never the origin: reproject the pointer's
  // world-space position at the OLD scale, then choose x/y so that same
  // world point lands back under the pointer at the NEW scale. Reads the
  // Konva node directly (not the store) because this also has to be
  // correct mid-gesture, before a React render has caught up.
  const zoomToPointer = useCallback((stage: Konva.Stage, nextScale: number, pointer: Konva.Vector2d) => {
    const old = stage.scaleX();
    const clamped = clampScale(nextScale);
    const world = { x: (pointer.x - stage.x()) / old, y: (pointer.y - stage.y()) / old };
    setView({
      scale: clamped,
      x: pointer.x - world.x * clamped,
      y: pointer.y - world.y * clamped,
    });
  }, [setView]);

  const fitToRoom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const fit = Math.min(
      rect.width / (room.width + FIT_PADDING * 2),
      rect.height / (room.height + FIT_PADDING * 2),
    );
    setView(centeredView(fit, rect.width, rect.height, room));
  }, [room, setView]);

  const resetZoom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setView(centeredView(1, rect.width, rect.height, room));
  }, [room, setView]);

  const zoomBy = useCallback((factor: number, pointer: Konva.Vector2d) => {
    const stage = stageRef.current;
    if (!stage) return;
    zoomToPointer(stage, stage.scaleX() * factor, pointer);
  }, [zoomToPointer]);

  // A wheel event with no ctrl/meta is a two-finger trackpad scroll: it
  // translates the stage by the same raw screen-px delta the pointer
  // moved, exactly like Konva's own drag does. With ctrl/meta held it's
  // either an actual Ctrl/Cmd+wheel, or Chrome/Firefox's own emulation of
  // trackpad pinch — both arrive as the same event shape, so one branch
  // covers both.
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    if (e.evt.ctrlKey || e.evt.metaKey) {
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      zoomToPointer(stage, stage.scaleX() * Math.exp(-e.evt.deltaY * WHEEL_ZOOM_SENSITIVITY), pointer);
      return;
    }
    setView({ x: stage.x() - e.evt.deltaX, y: stage.y() - e.evt.deltaY });
  }, [zoomToPointer, setView]);

  // Space+left-drag or a middle-button drag pans; a plain left-drag does
  // nothing here (Task 10 gives it marquee-select / object-drag meaning).
  // `stage.startDrag()` begins a Konva drag session without the Stage ever
  // being `draggable` — which matters because Konva's own `draggable`
  // would accept a plain left-drag too (its default `dragButtons` is
  // `[0, 1]`), and that's exactly the case this must NOT pan on.
  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const isMiddleButton = e.evt.button === 1;
    const isSpaceLeftDrag = e.evt.button === 0 && isSpaceHeldRef.current;
    if (!isMiddleButton && !isSpaceLeftDrag) return;
    e.evt.preventDefault();
    stageRef.current?.startDrag(e);
  }, []);

  const handleDragStart = useCallback(() => setCursor('grabbing'), []);

  const handleDragMove = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    setView({ x: stage.x(), y: stage.y() });
  }, [setView]);

  const handleDragEnd = useCallback(() => {
    const stage = stageRef.current;
    if (stage) setView({ x: stage.x(), y: stage.y() });
    setCursor(isSpaceHeldRef.current ? 'grab' : 'default');
  }, [setView]);

  // Fit the room on mount. Also re-fits if the room's own dimensions ever
  // change (there's no resize feature yet, but immer's structural sharing
  // means `room` only changes reference when it's actually edited, so this
  // never fires on unrelated doc commits like seating a guest).
  useEffect(() => {
    fitToRoom();
  }, [fitToRoom]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (isEditableTarget(document.activeElement)) return;

      if (e.code === 'Space') {
        if (!e.repeat) {
          e.preventDefault();
          isSpaceHeldRef.current = true;
          if (!stageRef.current?.isDragging()) setCursor('grab');
        }
        return;
      }
      if (e.shiftKey && e.code === 'Digit1') {
        e.preventDefault();
        fitToRoom();
        return;
      }
      if (e.shiftKey && e.code === 'Digit0') {
        e.preventDefault();
        resetZoom();
        return;
      }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomBy(ZOOM_KEY_STEP, lastPointerOrCenter(stageRef.current, containerRef.current));
        return;
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        zoomBy(1 / ZOOM_KEY_STEP, lastPointerOrCenter(stageRef.current, containerRef.current));
      }
    }

    function handleKeyUp(e: KeyboardEvent): void {
      if (e.code !== 'Space') return;
      isSpaceHeldRef.current = false;
      if (!stageRef.current?.isDragging()) setCursor('default');
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [fitToRoom, resetZoom, zoomBy]);

  // Safari-only pinch: `gesturechange.scale` is relative to the gesture's
  // start, not the previous event, so the start scale is captured once in
  // `gesturestart` and every `gesturechange` multiplies from that baseline.
  useEffect(() => {
    let startScale = 1;

    function handleGestureStart(e: GestureEvent): void {
      e.preventDefault();
      startScale = stageRef.current?.scaleX() ?? 1;
    }

    function handleGestureChange(e: GestureEvent): void {
      e.preventDefault();
      const stage = stageRef.current;
      const el = containerRef.current;
      if (!stage || !el) return;
      const rect = el.getBoundingClientRect();
      zoomToPointer(stage, startScale * e.scale, { x: e.clientX - rect.left, y: e.clientY - rect.top });
    }

    window.addEventListener('gesturestart', handleGestureStart);
    window.addEventListener('gesturechange', handleGestureChange);
    return () => {
      window.removeEventListener('gesturestart', handleGestureStart);
      window.removeEventListener('gesturechange', handleGestureChange);
    };
  }, [zoomToPointer]);

  const scale = useViewStore((s) => s.scale);
  const x = useViewStore((s) => s.x);
  const y = useViewStore((s) => s.y);

  return {
    containerRef, stageRef, width: size.width, height: size.height,
    scale, x, y, cursor,
    fitToRoom, resetZoom, zoomBy, handleWheel, handleMouseDown,
    handleDragStart, handleDragMove, handleDragEnd,
  };
}
