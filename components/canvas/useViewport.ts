'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type Konva from 'konva';
import { useDocStore } from '@/stores/docStore';
import { useViewStore } from '@/stores/viewStore';
import { FIT_PADDING } from '@/lib/constants';
import { centredView, fitView, zoomAt } from '@/lib/geometry/viewport';
import { useElementSize } from '@/components/canvas/useElementSize';
import { useViewportKeyboard } from '@/components/canvas/useViewportKeyboard';
import { useGesturePinch } from '@/components/canvas/useGesturePinch';
import { useMarquee } from '@/components/canvas/useMarquee';

// How much a single wheel "notch" (deltaY ~100) changes scale under
// Ctrl/Cmd+wheel or trackpad-pinch-as-wheel. Exponential so repeated small
// deltas (trackpad) compose smoothly and large ones (a mouse wheel notch)
// don't feel like a jump-cut.
const WHEEL_ZOOM_SENSITIVITY = 0.002;

export type CursorStyle = 'default' | 'grab' | 'grabbing';

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

/**
 * Viewport transform maths and Konva pointer/drag wiring, composed with the
 * four concerns that live in their own hooks: `useElementSize` (container
 * measurement), `useViewportKeyboard` (window shortcuts + space-held
 * tracking), `useGesturePinch` (Safari pinch) and `useMarquee`
 * (`handleMouseDown`'s plain-left-drag branch, Task 10's marquee-select).
 * Kept split so this stays editable alongside Task 11 (which needs this same
 * pointer/scale plumbing for the rulers) without both landing in one large
 * file.
 */
export function useViewport(): Viewport {
  const room = useDocStore((s) => s.room);
  const setView = useViewStore((s) => s.setView);

  const { ref: containerRef, width, height } = useElementSize<HTMLDivElement>();
  const stageRef = useRef<Konva.Stage | null>(null);
  // Whether Space is currently held. Owned here, not in the keyboard hook:
  // handleMouseDown and handleDragEnd below need to read it synchronously,
  // and the keyboard hook only ever writes to it. A ref, not React state,
  // since reading it doesn't itself need to trigger a render.
  const isSpaceHeldRef = useRef(false);

  const [cursor, setCursor] = useState<CursorStyle>('default');

  // Zoom toward the pointer, never the origin (`zoomAt`, shared with the
  // mobile viewer). The CURRENT transform is read off the Konva node rather
  // than the store because this also has to be correct mid-gesture, before a
  // React render has caught up.
  const zoomToPointer = useCallback((stage: Konva.Stage, nextScale: number, pointer: Konva.Vector2d) => {
    setView(zoomAt({ scale: stage.scaleX(), x: stage.x(), y: stage.y() }, nextScale, pointer));
  }, [setView]);

  const fitToRoom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setView(fitView(rect.width, rect.height, room, FIT_PADDING));
  }, [room, setView, containerRef]);

  const resetZoom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setView(centredView(1, rect.width, rect.height, room));
  }, [room, setView, containerRef]);

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

  const { startMarquee } = useMarquee({ stageRef });

  // Space+left-drag or a middle-button drag pans. A plain left-drag on an
  // object never reaches here in a way that matters — Konva's own event
  // bubbling still fires this after the object's own mousedown handler, but
  // `startMarquee` no-ops unless the hit target is the Stage itself (empty
  // canvas), so it's harmless to always try it. `stage.startDrag()` begins a
  // Konva drag session without the Stage ever being `draggable` — which
  // matters because Konva's own `draggable` would accept a plain left-drag
  // too (its default `dragButtons` is `[0, 1]`), and that's exactly the case
  // this must NOT pan on.
  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const isMiddleButton = e.evt.button === 1;
    const isSpaceLeftDrag = e.evt.button === 0 && isSpaceHeldRef.current;
    if (isMiddleButton || isSpaceLeftDrag) {
      e.evt.preventDefault();
      stageRef.current?.startDrag(e);
      return;
    }
    if (e.evt.button === 0) startMarquee(e);
  }, [startMarquee]);

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

  useViewportKeyboard({
    stageRef, containerRef, isSpaceHeldRef, fitToRoom, resetZoom, zoomBy, setCursor,
  });
  useGesturePinch({ stageRef, containerRef, zoomToPointer });

  const scale = useViewStore((s) => s.scale);
  const x = useViewStore((s) => s.x);
  const y = useViewStore((s) => s.y);

  return {
    containerRef, stageRef, width, height,
    scale, x, y, cursor,
    fitToRoom, resetZoom, zoomBy, handleWheel, handleMouseDown,
    handleDragStart, handleDragMove, handleDragEnd,
  };
}
