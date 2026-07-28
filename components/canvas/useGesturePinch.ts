'use client';

import { useEffect } from 'react';
import type { RefObject } from 'react';
import type Konva from 'konva';

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

interface UseGesturePinchArgs {
  stageRef: RefObject<Konva.Stage | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  zoomToPointer: (stage: Konva.Stage, nextScale: number, pointer: Konva.Vector2d) => void;
}

/**
 * Safari-only pinch: `gesturechange.scale` is relative to the gesture's
 * start, not the previous event, so the start scale is captured once in
 * `gesturestart` and every `gesturechange` multiplies from that baseline.
 */
export function useGesturePinch({ stageRef, containerRef, zoomToPointer }: UseGesturePinchArgs): void {
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
  }, [stageRef, containerRef, zoomToPointer]);
}
