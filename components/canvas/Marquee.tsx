'use client';

import { Rect } from 'react-konva';
import { useViewStore } from '@/stores/viewStore';
import { COOL, SELECTION_WASH } from '@/lib/canvasTokens';

/**
 * The rubber-band rect drawn while `useMarquee` is tracking a drag on empty
 * canvas. Pure feedback — `listening={false}` so it can never itself become
 * a hit target — and `strokeScaleEnabled={false}` so its 1px edge stays 1px
 * on screen at any zoom, same convention as every other non-scaling stroke
 * in this app (StaticLayer's wall, every object's plate).
 */
export function Marquee() {
  const marquee = useViewStore((s) => s.marquee);
  if (!marquee) return null;
  return (
    <Rect
      x={marquee.x}
      y={marquee.y}
      width={marquee.width}
      height={marquee.height}
      fill={SELECTION_WASH}
      stroke={COOL}
      strokeWidth={1}
      strokeScaleEnabled={false}
      listening={false}
    />
  );
}
