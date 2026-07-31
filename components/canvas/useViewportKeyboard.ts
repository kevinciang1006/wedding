'use client';

import { useEffect } from 'react';
import type { RefObject } from 'react';
import Konva from 'konva';
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
 * Space-held state is written to three places on every keydown/keyup (and on
 * `blur`, see below): the pre-existing `isSpaceHeldRef` (read synchronously
 * by `useViewport`'s `handleMouseDown`, mid-gesture, before a render could
 * ever catch up), `viewStore.spaceHeld` (read via `getState()`, not
 * subscribed, by `useObjectDrag`'s `onDragStart` as a safety-net check — a
 * subscription there would re-render every object node on every space press,
 * defeating their `React.memo`), and Konva's own global `Konva.dragButtons`.
 * That third one is the actual mechanism, not a mirror of the other two:
 * Konva reads `dragButtons` only in its auto-arm path (`Node.js:1410`,
 * inside `_listenDrag`'s `mousedown.konva` listener), which decides whether
 * a `draggable` node arms its *own* drag on mousedown. The Stage's own pan
 * goes through an explicit `stage.startDrag(e)` call (`useViewport.ts`),
 * which never consults `dragButtons` at all. So emptying `dragButtons` while
 * space is held stops every object from arming a competing drag, without
 * touching the Stage's pan — see `useObjectDrag.ts`'s `onDragStart` for why
 * that matters: Konva's `stopDrag()` is not scoped to one node, and calling
 * it to cancel an object's drag used to collaterally kill the Stage's
 * concurrent pan drag too.
 *
 * `CanvasStage.tsx` sets the module-scope default, `Konva.dragButtons = [0]`
 * (left-button only, Finding 1's middle-click fix). This hook only ever
 * toggles between that `[0]` and `[]` — never back to Konva's own factory
 * default `[0, 1]` — so the middle-click fix stays in force regardless of
 * space state.
 *
 * All three are restored on `blur` as well as on `keyup`: if the window
 * loses focus while space is physically held (e.g. an OS-level app switch),
 * `keyup` may never fire, and leaving `dragButtons` empty forever would
 * silently disable dragging every object.
 */
export function useViewportKeyboard({
  stageRef, containerRef, isSpaceHeldRef, fitToRoom, resetZoom, zoomBy, setCursor,
}: UseViewportKeyboardArgs): void {
  useEffect(() => {
    // The one place space-held state gets released, so keyup and blur can't
    // drift apart. Idempotent: safe to call when space wasn't actually held.
    function releaseSpace(): void {
      isSpaceHeldRef.current = false;
      useViewStore.getState().setSpaceHeld(false);
      Konva.dragButtons = [0];
      if (!stageRef.current?.isDragging()) setCursor('default');
    }

    function handleKeyDown(e: KeyboardEvent): void {
      if (isEditableTarget(document.activeElement)) return;

      if (e.code === 'Space') {
        if (!e.repeat) {
          e.preventDefault();
          isSpaceHeldRef.current = true;
          useViewStore.getState().setSpaceHeld(true);
          // Konva reads this global only in its auto-arm path (Node.js:1410); the
          // Stage's pan goes through an explicit startDrag(), which never consults
          // it. Emptying it while space is held stops objects arming a drag
          // without disabling the pan.
          Konva.dragButtons = [];
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
      releaseSpace();
    }

    // Covers the window losing focus while space is physically still held
    // (alt-tab, devtools, an OS-level dialog) — no keyup fires in that case,
    // so without this, dragButtons/spaceHeld could stay stuck disabling
    // every object's drag until the user happens to tap space again.
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', releaseSpace);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', releaseSpace);
    };
  }, [stageRef, containerRef, isSpaceHeldRef, fitToRoom, resetZoom, zoomBy, setCursor]);
}
