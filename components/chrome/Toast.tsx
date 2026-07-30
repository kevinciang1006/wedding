'use client';

import { useEffect } from 'react';
import { useUiStore } from '@/stores/uiStore';

const AUTO_DISMISS_MS = 5000;

/**
 * Global notification: ink ground, a white message line, and an optional
 * mono detail line. Auto-dismisses after 5s. "Never animates beyond
 * appearing" per the token spec — there is no slide/fade transition here at
 * all, so there is nothing for `prefers-reduced-motion` to need to disable.
 * Fixed at the bottom-centre of the whole app (not just the canvas
 * viewport): it's a global notification, not scoped to one panel, so it
 * sits clear of the readout HUD (bottom-left) and the Inspector (top-right
 * of the canvas) regardless of which is showing.
 */
export function Toast() {
  const toast = useUiStore((s) => s.toast);
  const dismissToast = useUiStore((s) => s.dismissToast);

  // Depends on `toast` itself (not just whether it's present): showToast
  // creates a fresh object on every call, so a second toast arriving while
  // one is already showing restarts the 5s clock rather than being cut off
  // by the first toast's timer.
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(dismissToast, AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [toast, dismissToast]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 bg-ink px-4 py-2.5 shadow-screen">
      <div className="font-[family-name:var(--font-ui)] text-[12.5px] text-paper">{toast.message}</div>
      {toast.detail !== null && (
        <div className="mt-1 font-[family-name:var(--font-data)] text-[10px] text-[#9FAAB1]">{toast.detail}</div>
      )}
    </div>
  );
}
