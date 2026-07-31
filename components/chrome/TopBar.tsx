'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useDocStore } from '@/stores/docStore';
import { useUiStore } from '@/stores/uiStore';
import { useT } from '@/lib/i18n/useT';
import { formatEventDate } from '@/lib/i18n/date';
import { useCommitField } from '@/components/chrome/useCommitField';
import { ExportMenu } from '@/components/chrome/ExportMenu';
import { formatValue, parseLength } from '@/lib/units/format';
import { ROOM_WIDTH_INPUT_ID, ZOOM_KEY_STEP } from '@/lib/constants';
import type { Viewport } from '@/components/canvas/useViewport';
import type { Units } from '@/lib/types/doc';

interface TopBarProps { viewport: Viewport }

/**
 * The current time, refreshed on an interval so relative text ("saved 2m")
 * stays fresh. `Date.now()` never runs directly in the render body — that
 * would make this component's output depend on when React happened to call
 * it, which is exactly what React's purity rule for components rejects.
 * The initial reading instead comes from `useState`'s lazy initializer
 * (called once, on mount, a pattern React treats as pure by construction),
 * and every reading after that comes from `setInterval`'s own callback —
 * not a bare `setState` in the effect body itself, which the "no setState
 * directly in an effect" rule below would also reject.
 */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Compact, language-agnostic elapsed time (`5s`/`2m`/`1h`/`3d`) — same non-translated convention as the app's own `cm`/`m`/`ft` unit suffixes. */
function formatSavedAgo(savedAgo: (time: string) => string, lastSavedAt: number | null, now: number): string | null {
  if (lastSavedAt === null) return null;
  const seconds = Math.max(0, Math.round((now - lastSavedAt) / 1000));
  const compact = seconds < 60 ? `${seconds}s`
    : seconds < 3600 ? `${Math.round(seconds / 60)}m`
    : seconds < 86400 ? `${Math.round(seconds / 3600)}h`
    : `${Math.round(seconds / 86400)}d`;
  return savedAgo(compact);
}

interface SegmentedOption<T extends string> { value: T; label: string }

/** The `m|ft` and `EN|ES` toggles share this exact shape — active segment ink-filled with white text, a rule-coloured divider between segments. */
function Segmented<T extends string>({
  ariaLabel, options, value, onChange,
}: { ariaLabel: string; options: SegmentedOption<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex h-[26px] shrink-0 border border-rule bg-paper">
      {options.map((opt, i) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={`flex items-center px-2 font-[family-name:var(--font-data)] text-[11px] ${i > 0 ? 'border-l border-rule' : ''} ${
            value === opt.value ? 'bg-ink text-paper' : 'bg-paper text-text-secondary'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Divider() {
  return <div className="h-[22px] w-px shrink-0 bg-divider-light" />;
}

function RoomDimInput({ id, cm, units, ariaLabel, onCommitCm }: {
  id?: string; cm: number; units: Units; ariaLabel: string; onCommitCm: (cm: number) => void;
}) {
  const canonical = formatValue(cm, units);
  const field = useCommitField(canonical, (text) => {
    const parsed = parseLength(text, units);
    if (parsed === null) return false;
    onCommitCm(Math.max(1, parsed));
    return true;
  });
  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      value={field.text}
      onChange={field.onChange}
      onBlur={field.onBlur}
      onKeyDown={field.onKeyDown}
      className="w-11 bg-transparent text-right font-[family-name:var(--font-data)] text-[12px] font-medium text-ink outline-none"
    />
  );
}

interface IconButtonProps { label: string; enabled: boolean; onClick: () => void; children: ReactNode }

function IconButton({ label, enabled, onClick, children }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={!enabled}
      onClick={onClick}
      className={`flex h-[26px] w-7 items-center justify-center border bg-paper text-[13px] ${
        enabled ? 'border-rule text-text-body' : 'border-divider text-text-disabled'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * 52px top bar: wordmark, plan title + date/save-state on the left; room
 * dimensions, undo/redo, zoom, export and the language toggle on the right.
 * Receives the one `Viewport` instance `Editor.tsx` already owns — see that
 * file's header comment on why `useViewport()` is never called a second
 * time — so the zoom stepper drives the exact same stage the canvas does.
 */
export function TopBar({ viewport }: TopBarProps) {
  const t = useT();
  const language = useUiStore((s) => s.language);
  const setLanguage = useUiStore((s) => s.setLanguage);
  const title = useDocStore((s) => s.title);
  const eventDate = useDocStore((s) => s.eventDate);
  const units = useDocStore((s) => s.units);
  const room = useDocStore((s) => s.room);
  const lastSavedAt = useDocStore((s) => s.lastSavedAt);
  const canUndo = useDocStore((s) => s.canUndo);
  const canRedo = useDocStore((s) => s.canRedo);
  const undo = useDocStore((s) => s.undo);
  const redo = useDocStore((s) => s.redo);

  const now = useNow(30_000);

  const dateText = formatEventDate(language, eventDate, t('noDateSet'));
  const savedText = formatSavedAgo((time) => t('savedAgo', { time }), lastSavedAt, now);
  const subtitle = savedText ? `${dateText} · ${savedText}` : dateText;

  const zoomCentre = { x: viewport.width / 2, y: viewport.height / 2 };
  const zoomPercent = Math.round(viewport.scale * 100);

  return (
    // Everything except the plan title/date is `shrink-0`, and that one block
    // is `min-w-0` and truncates: at the narrow end of the editor's range
    // (768px, Spanish, where every label is longer) the bar is otherwise
    // over-full, and flex resolves that by shrinking every group past its
    // content — controls overlap each other and the title's text runs
    // straight through the room dimensions. The plan name is the one thing
    // here that can lose characters without losing meaning.
    // Below 1024px the gaps tighten and the wordmark drops to its mark
    // alone: nine 14px gaps plus the spelled-out name are 114px that the
    // plan's own title needs more at that width, and the mark still carries
    // the identity.
    <div className="flex h-[52px] shrink-0 items-center gap-3.5 border-b border-panel-border bg-paper px-3 max-lg:gap-2">
      <div className="flex shrink-0 items-center gap-2">
        <div className="relative h-5 w-5 border-[1.5px] border-ink">
          <div className="absolute left-[3px] top-[3px] h-1.5 w-1.5 rounded-full border-[1.5px] border-warm" />
          <div className="absolute bottom-[2px] right-[2px] h-[1.5px] w-2 bg-cool" />
        </div>
        <span className="font-[family-name:var(--font-ui)] text-[13px] font-bold uppercase tracking-[0.06em] text-ink max-lg:hidden">
          {t('appName')}
        </span>
      </div>

      <Divider />

      <div className="flex min-w-0 items-baseline gap-2">
        <span className="truncate font-[family-name:var(--font-name)] text-[16px] text-ink">
          {title || t('untitledPlan')}
        </span>
        {/* Hidden below 1024px — the tablet layout, where the bar is full
            and two truncating siblings would leave both showing an ellipsis
            and nothing else. The plan's name earns the remaining space; the
            date and save state are secondary, and the save state is not the
            only sign the document is safe. */}
        <span className="truncate font-[family-name:var(--font-data)] text-[10.5px] text-text-muted max-lg:hidden">
          {subtitle}
        </span>
      </div>

      <div className="min-w-0 flex-1" />

      <div className="flex shrink-0 items-center gap-2">
        <span className="font-[family-name:var(--font-data)] text-[11px] text-text-secondary">{t('room')}</span>
        <RoomDimInput
          id={ROOM_WIDTH_INPUT_ID}
          cm={room.width}
          units={units}
          ariaLabel={t('roomWidth')}
          onCommitCm={(cm) => useDocStore.getState().commit((d) => { d.room.width = cm; }, 'resize room')}
        />
        <span className="font-[family-name:var(--font-data)] text-[12px] text-text-secondary">×</span>
        <RoomDimInput
          cm={room.height}
          units={units}
          ariaLabel={t('roomHeight')}
          onCommitCm={(cm) => useDocStore.getState().commit((d) => { d.room.height = cm; }, 'resize room')}
        />
        <Segmented
          ariaLabel={t('units')}
          value={units}
          onChange={(v: Units) => useDocStore.getState().commit((d) => { d.units = v; }, 'change units')}
          options={[{ value: 'm', label: 'm' }, { value: 'ft', label: 'ft' }]}
        />
      </div>

      <Divider />

      <div className="flex shrink-0 gap-1">
        <IconButton label={t('undo')} enabled={canUndo} onClick={undo}>↶</IconButton>
        <IconButton label={t('redo')} enabled={canRedo} onClick={redo}>↷</IconButton>
      </div>

      <div className="flex h-[26px] shrink-0 items-center gap-1.5 border border-rule bg-paper px-1">
        <button
          type="button"
          aria-label={t('zoomOut')}
          onClick={() => viewport.zoomBy(1 / ZOOM_KEY_STEP, zoomCentre)}
          className="flex w-[18px] items-center justify-center text-[13px] text-text-body"
        >
          −
        </button>
        <span className="w-[38px] text-center font-[family-name:var(--font-data)] text-[11px] text-ink">
          {zoomPercent}%
        </span>
        <button
          type="button"
          aria-label={t('zoomIn')}
          onClick={() => viewport.zoomBy(ZOOM_KEY_STEP, zoomCentre)}
          className="flex w-[18px] items-center justify-center text-[13px] text-text-body"
        >
          +
        </button>
      </div>

      <ExportMenu viewport={viewport} />

      <Segmented
        ariaLabel={t('language')}
        value={language}
        onChange={setLanguage}
        options={[{ value: 'en', label: 'EN' }, { value: 'es', label: 'ES' }]}
      />
    </div>
  );
}
