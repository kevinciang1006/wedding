'use client';

import { useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';

interface UseCommitFieldResult {
  text: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * Local-buffer text input backed by a canonical committed value — shared by
 * the top bar's room width/height fields and every Inspector field.
 * Keystrokes only ever update this field's own display text; nothing
 * reaches the store until the field is left (blur, or Enter triggering
 * one). That mirrors the rest of the app's "one history entry per
 * completed gesture" rule (a drag commits once on dragEnd, not once per
 * frame) rather than spamming undo with one entry per keystroke.
 *
 * `commit` returns whether `text` parsed to something valid; `false` snaps
 * the field back to `canonical` instead of ever writing `NaN` (or a
 * half-typed value) into the doc. Escape reverts and blurs without
 * committing, mirroring the canvas's own Escape-cancels convention —
 * harmless to do here even though `useKeyboard.ts`'s own Escape handler
 * already bails on an editable target, since this is a completely separate,
 * field-local cancel.
 *
 * `text` re-syncs to `canonical` whenever it changes for a reason other than
 * this field's own commit — switching the selected object, or toggling the
 * active unit, both of which change what `formatValue` produces without
 * this field having done anything. That's done during render (the React-
 * docs "adjusting state when a prop changes" pattern: compare against the
 * previous value in state, call `setState` inline if it moved) rather than
 * in a `useEffect`, so a prop change and the field snapping to it land in
 * the same commit instead of a visible extra frame of stale text.
 */
export function useCommitField(canonical: string, commit: (text: string) => boolean): UseCommitFieldResult {
  const [text, setText] = useState(canonical);
  const [prevCanonical, setPrevCanonical] = useState(canonical);

  if (canonical !== prevCanonical) {
    setPrevCanonical(canonical);
    setText(canonical);
  }

  function onBlur(): void {
    if (!commit(text)) setText(canonical);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setText(canonical);
      e.currentTarget.blur();
    }
  }

  return { text, onChange: (e) => setText(e.target.value), onBlur, onKeyDown };
}
