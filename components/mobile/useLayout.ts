'use client';

import { useSyncExternalStore } from 'react';
import { PHONE_MAX_PX, TABLET_MAX_PX } from '@/lib/constants';

export type Layout = 'phone' | 'tablet' | 'desktop';

const PHONE_QUERY = `(max-width: ${PHONE_MAX_PX}px)`;
const TABLET_QUERY = `(max-width: ${TABLET_MAX_PX}px)`;

function currentLayout(): Layout {
  if (window.matchMedia(PHONE_QUERY).matches) return 'phone';
  if (window.matchMedia(TABLET_QUERY).matches) return 'tablet';
  return 'desktop';
}

// Both media queries share one callback, and the snapshot above re-derives
// the layout from scratch: crossing tablet -> desktop fires only the tablet
// list, while a single resize from phone straight to desktop fires both, and
// re-reading covers every one of those without tracking which list fired.
function subscribe(onChange: () => void): () => void {
  const phone = window.matchMedia(PHONE_QUERY);
  const tablet = window.matchMedia(TABLET_QUERY);
  phone.addEventListener('change', onChange);
  tablet.addEventListener('change', onChange);
  return () => {
    phone.removeEventListener('change', onChange);
    tablet.removeEventListener('change', onChange);
  };
}

/**
 * Which of the three layouts the viewport is currently in, from a live
 * `matchMedia` subscription rather than from CSS.
 *
 * CSS alone cannot express the decision this drives: below the phone
 * breakpoint the editor is not hidden but *never mounted*, so Konva never
 * builds a Stage, three Layers and a node per object for a surface that
 * cannot be edited. A `display: none` editor would still do all of that
 * work — and would still run its ResizeObserver, its window keyboard
 * listeners and a fit-to-room against a zero-sized container.
 *
 * `useSyncExternalStore`, not `useState` + an effect: it reads the snapshot
 * again immediately after subscribing, which closes the window where a
 * resize between first render and the listener being attached (a phone
 * rotated during startup) would otherwise be missed — without a `setState`
 * in an effect body. `getServerSnapshot` is never reached in practice
 * (`app/page.tsx` imports the editor with `ssr: false`) and returns the
 * full-editor layout only so that importing this from a server component
 * would degrade rather than throw on `window`.
 */
export function useLayout(): Layout {
  return useSyncExternalStore(subscribe, currentLayout, () => 'desktop');
}
