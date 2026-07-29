'use client';

import { useEffect } from 'react';
import type { RefObject } from 'react';
import type Konva from 'konva';
import { useViewStore } from '@/stores/viewStore';
import { ZOOM_KEY_STEP } from '@/lib/constants';
import type { CursorStyle } from '@/components/canvas/useViewport';

// Shared with useKeyboard.ts (Task 10) — the one guard every window-level
// shortcut in this app bails on, so a guest name typed into a future input
// never doubles as a nudge/duplicate/delete/undo command.
export function isEditableTarget(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
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

interface UseViewportKeyboardArgs {
  stageRef: RefObject<Konva.Stage | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  isSpaceHeldRef: RefObject<boolean>;
  fitToRoom: () => void;
  resetZoom: () => void;
  zoomBy: (factor: number, pointer: Konva.Vector2d) => void;
  setCursor: (cursor: CursorStyle) => void;
}

/**
 * Window-level keyboard shortcuts for the viewport: `Shift+1` fit, `Shift+0`
 * reset, `+`/`-` zoom, and tracking whether Space is currently held (read by
 * `useViewport`'s mouse handlers to arm space+drag panning). Every branch
 * bails when focus is in an editable element so typing a guest name never
 * nudges the canvas.
 *
 * Space-held state is written to two places on every keydown/keyup: the
 * pre-existing `isSpaceHeldRef` (read synchronously by `useViewport`'s
 * `handleMouseDown`, mid-gesture, before a render could ever catch up) and
 * `viewStore.spaceHeld` (read via `getState()`, not subscribed, by
 * `useObjectDrag`'s `onDragStart` — a subscription there would re-render
 * every object node on every space press, defeating their `React.memo`).
 * Both are updated from the same two handlers so they can never drift.
 */
export function useViewportKeyboard({
  stageRef, containerRef, isSpaceHeldRef, fitToRoom, resetZoom, zoomBy, setCursor,
}: UseViewportKeyboardArgs): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (isEditableTarget(document.activeElement)) return;

      if (e.code === 'Space') {
        if (!e.repeat) {
          e.preventDefault();
          isSpaceHeldRef.current = true;
          useViewStore.getState().setSpaceHeld(true);
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

    // No editable-target bail here: keyup only clears held state, never types.
    // Bailing could strand isSpaceHeldRef true if focus moves to an input mid-hold.
    function handleKeyUp(e: KeyboardEvent): void {
      if (e.code !== 'Space') return;
      isSpaceHeldRef.current = false;
      useViewStore.getState().setSpaceHeld(false);
      if (!stageRef.current?.isDragging()) setCursor('default');
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [stageRef, containerRef, isSpaceHeldRef, fitToRoom, resetZoom, zoomBy, setCursor]);
}
