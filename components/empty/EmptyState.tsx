'use client';

import type { ReactNode } from 'react';
import { useT } from '@/lib/i18n/useT';
import { createSampleWedding } from '@/lib/sample/sampleWedding';
import { ROOM_WIDTH_INPUT_ID } from '@/lib/constants';
import { createEmptyDoc, useDocStore } from '@/stores/docStore';
import { useUiStore } from '@/stores/uiStore';

/**
 * 72px line-drawing preview of a populated floor plan: the room outline, a
 * ring of round tables and a dashed dance floor — same square-corners/
 * circle-tables convention as `ObjectPalette`'s own glyphs, just composed
 * into one small scene instead of one shape per row.
 */
function SamplePreview() {
  const tables: [number, number][] = [
    [30, 25], [30, 70], [30, 115],
    [60, 25], [60, 70], [60, 115],
    [160, 25], [160, 70], [160, 115],
    [190, 25], [190, 70], [190, 115],
  ];
  return (
    <svg viewBox="0 0 220 140" width="113" height="72" className="text-ink" aria-hidden="true">
      <rect x="1" y="1" width="218" height="138" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="86" y="8" width="48" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="78" y="55" width="64" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
      {tables.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

/** 72px line-drawing preview of an empty room: the bare rectangle only — the visual counterpart to `SamplePreview` above. */
function EmptyPreview() {
  return (
    <svg viewBox="0 0 220 140" width="113" height="72" className="text-ink" aria-hidden="true">
      <rect x="1" y="1" width="218" height="138" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
    </svg>
  );
}

function startSample(): void {
  useDocStore.getState().replaceDoc(createSampleWedding());
  useUiStore.getState().setStarted(true);
}

function startEmpty(): void {
  useDocStore.getState().replaceDoc(createEmptyDoc());
  useUiStore.getState().setStarted(true);
  // The blank doc already has a default room size; the literal next step
  // for a from-scratch plan is typing the venue's real dimensions into the
  // top bar, so this hands focus straight there instead of leaving the
  // user to go find the field themselves. Deferred a frame so it runs after
  // this click's own re-render has actually mounted the (now-visible) top
  // bar input — synchronous focus here would target whatever was focused
  // before this button's own onClick handler ran.
  requestAnimationFrame(() => {
    document.getElementById(ROOM_WIDTH_INPUT_ID)?.focus();
  });
}

interface CardProps { preview: ReactNode; title: string; body: string; action: string; onAction: () => void }

/**
 * One of the two starting-point cards. Both callers below pass the exact
 * same border/button treatment — `1.5px` ink border, ink-ground/white-text
 * button, full card width from the shared `grid-cols-2` parent — so neither
 * card can read as the lesser option. `mt-auto` on the button plus the
 * grid's default `align-items: stretch` (not overridden here) is what keeps
 * both cards the same height even though the two body strings are
 * different lengths: the shorter card's extra space goes below its text,
 * not into a shorter card.
 */
function Card({ preview, title, body, action, onAction }: CardProps) {
  return (
    <div className="flex w-full flex-col items-start gap-3 border-[1.5px] border-ink bg-paper p-4">
      {preview}
      <div className="flex flex-col gap-1">
        <span className="font-[family-name:var(--font-ui)] text-[13.5px] font-semibold text-ink">{title}</span>
        <span className="font-[family-name:var(--font-ui)] text-[12px] text-text-secondary">{body}</span>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="mt-auto flex h-8 w-full items-center justify-center bg-ink px-3 font-[family-name:var(--font-ui)] text-[12.5px] font-medium text-paper"
      >
        {action}
      </button>
    </div>
  );
}

/**
 * First-load landing screen (Task 16). Rendered by `Editor.tsx` as an
 * overlay inside the canvas viewport cell — not a full-page takeover — so
 * the top bar (title, room dims, language) stays usable underneath, and the
 * always-mounted `GuestPanel` and `ObjectPalette` are visibly present
 * alongside it (palette dimmed to `opacity-45` and inert by `Editor.tsx`,
 * per the brief; the guest panel shows its own `guestsLandHere` copy
 * whenever the guest list is empty, independent of this component). That
 * lets someone import a CSV or add a guest by hand from here — via the
 * footer link below, or the always-present guest panel controls — before
 * ever picking a room.
 *
 * The two cards are deliberately symmetric (see `Card` above) — "start from
 * a sample" and "start empty" are equally valid ways in, not a recommended
 * path plus a fallback.
 */
export function EmptyState() {
  const t = useT();

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center overflow-y-auto bg-canvas px-6 py-10">
      <div className="flex w-full max-w-[720px] flex-col items-center gap-7">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-[family-name:var(--font-name)] text-[30px] text-ink">{t('emptyTitle')}</h1>
          <p className="max-w-[440px] font-[family-name:var(--font-ui)] text-[13px] text-text-secondary">{t('emptyBody')}</p>
        </div>

        <div className="grid w-full grid-cols-2 gap-4">
          <Card
            preview={<SamplePreview />}
            title={t('sampleTitle')}
            body={t('sampleBody')}
            action={t('openSample')}
            onAction={startSample}
          />
          <Card
            preview={<EmptyPreview />}
            title={t('emptyStartTitle')}
            body={t('emptyStartBody')}
            action={t('setRoomSize')}
            onAction={startEmpty}
          />
        </div>

        <div className="flex flex-col items-center gap-1">
          <p className="text-center font-[family-name:var(--font-ui)] text-[12px] text-text-secondary">
            {t('haveGuestList')}{' '}
            <button
              type="button"
              onClick={() => useUiStore.getState().openDialog('csv')}
              className="font-medium text-cool underline-offset-2 hover:underline"
            >
              {t('importCsv')}
            </button>
          </p>
          <p className="font-[family-name:var(--font-data)] text-[11px] text-text-muted">{t('csvColumns')}</p>
        </div>
      </div>
    </div>
  );
}
