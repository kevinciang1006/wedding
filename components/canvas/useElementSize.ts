'use client';

import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export interface ElementSize<T extends HTMLElement> {
  ref: RefObject<T | null>;
  width: number;
  height: number;
}

/**
 * Measures an element's content-box size via `ResizeObserver`. Generic over
 * the element type so it can size a Konva Stage's container today and any
 * other layout that needs its own pixel dimensions later — Task 17's
 * responsive/mobile work is the next obvious consumer.
 */
export function useElementSize<T extends HTMLElement>(): ElementSize<T> {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, width: size.width, height: size.height };
}
