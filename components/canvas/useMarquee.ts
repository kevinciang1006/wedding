'use client';

import { useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import type Konva from 'konva';
import { useDocStore } from '@/stores/docStore';
import { useViewStore } from '@/stores/viewStore';
import { getBounds } from '@/lib/geometry/bounds';

interface UseMarqueeArgs {
  stageRef: RefObject<Konva.Stage | null>;
}

interface MarqueeRect { x: number; y: number; width: number; height: number }

function intersects(rect: MarqueeRect, box: { left: number; right: number; top: number; bottom: number }): boolean {
  return rect.x < box.right && rect.x + rect.width > box.left
    && rect.y < box.bottom && rect.y + rect.height > box.top;
}

/**
 * Marquee-select: mousedown on truly empty canvas (Konva's `e.target ===
 * stage`, i.e. the pointer hit no shape at all — every object node is a hit
 * target now, and `StaticLayer`'s room/grid stay `listening={false}`)
 * starts a rubber-band rect in room cm, published to `viewStore.marquee` for
 * `Marquee.tsx` to draw.
 *
 * Window-level move/up listeners rather than the Stage's own `onMouseMove`/
 * `onMouseUp` props, because the rect must keep tracking — and must still
 * resolve on release — even if the pointer leaves the canvas element
 * mid-drag. That's the same reason Konva's own `Transformer` attaches its
 * anchor-drag listeners to `window` instead of the shape (see
 * `_handleMouseDown` in konva/lib/shapes/Transformer.js), not a pattern
 * invented for this hook.
 */
export function useMarquee({ stageRef }: UseMarqueeArgs): {
  startMarquee: (e: Konva.KonvaEventObject<MouseEvent>) => void;
} {
  // Origin in room cm, plus whether Shift was held at mousedown (adds to the
  // existing selection instead of replacing it).
  const originRef = useRef<{ x: number; y: number; additive: boolean } | null>(null);

  const handleMove = useCallback((e: MouseEvent) => {
    const stage = stageRef.current;
    const origin = originRef.current;
    if (!stage || !origin) return;
    stage.setPointersPositions(e);
    const p = stage.getRelativePointerPosition();
    if (!p) return;
    useViewStore.getState().setMarquee({
      x: Math.min(origin.x, p.x),
      y: Math.min(origin.y, p.y),
      width: Math.abs(p.x - origin.x),
      height: Math.abs(p.y - origin.y),
    });
  }, [stageRef]);

  // Named function expression (not an arrow function assigned to `handleUp`)
  // so the self-removal below can reference this exact function via its own
  // internal binding, without reading the `const handleUp` closure variable
  // before its declaration finishes.
  const handleUp = useCallback(function onMarqueeUp() {
    window.removeEventListener('mousemove', handleMove);
    window.removeEventListener('mouseup', onMarqueeUp);
    const origin = originRef.current;
    originRef.current = null;
    const rect = useViewStore.getState().marquee;
    useViewStore.getState().setMarquee(null);
    if (!origin || !rect) return;

    const { objectOrder, objects } = useDocStore.getState();
    const hits = objectOrder.filter((id) => {
      const obj = objects[id];
      return obj !== undefined && intersects(rect, getBounds(obj));
    });

    if (origin.additive) {
      const { selectedIds, select } = useViewStore.getState();
      const merged = selectedIds.slice();
      for (const id of hits) if (!merged.includes(id)) merged.push(id);
      select(merged);
    } else {
      useViewStore.getState().select(hits);
    }
  }, [handleMove]);

  const startMarquee = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage || e.target !== stage) return;
    const p = stage.getRelativePointerPosition();
    if (!p) return;
    originRef.current = { x: p.x, y: p.y, additive: e.evt.shiftKey };
    useViewStore.getState().setMarquee({ x: p.x, y: p.y, width: 0, height: 0 });
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [stageRef, handleMove, handleUp]);

  return { startMarquee };
}
