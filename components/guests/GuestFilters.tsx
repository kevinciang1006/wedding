'use client';

import type { ChangeEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDocStore } from '@/stores/docStore';
import { useUiStore } from '@/stores/uiStore';
import { useT } from '@/lib/i18n/useT';
import { useCommitField } from '@/components/chrome/useCommitField';
import { seatingCounts } from '@/lib/doc/derive';
import { dietaryGuestCount, distinctGroups, hasUngroupedGuest, UNGROUPED } from '@/lib/doc/guestFilter';

const CHIP_BASE = 'flex h-6 shrink-0 items-center px-2 font-[family-name:var(--font-data)] text-[11px]';

function Chip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${CHIP_BASE} ${active ? 'border border-ink bg-ink text-paper' : 'border border-rule bg-paper text-text-body'}`}
    >
      {label}
    </button>
  );
}

/**
 * Search + the four filter chips. Search reuses `useCommitField` against
 * `filter.query` as its canonical value: typing buffers locally and the
 * list narrows on blur/Enter, not per keystroke — the same "commit on
 * leaving the field, Escape genuinely reverts" convention every other text
 * field in this app already follows (Inspector, top bar room dims), rather
 * than a second, live-per-keystroke filtering mechanism existing only here.
 * The `⌘K` mark next to it is a visual affordance only, per the brief — no
 * keydown handler backs it, and it's `aria-hidden` so it never claims a
 * shortcut that doesn't exist.
 *
 * The three boolean chips and the group `<select>` are mutually exclusive
 * (`uiStore.setFilter` always clears the other two when one is set) — one
 * active segment at a time, not independently togglable checkboxes.
 */
export function GuestFilters() {
  const t = useT();
  const filter = useUiStore((s) => s.filter);
  const setFilter = useUiStore((s) => s.setFilter);
  const total = useDocStore((s) => s.guestOrder.length);
  const unseated = useDocStore((s) => seatingCounts(s).unseated);
  const dietary = useDocStore((s) => dietaryGuestCount(s));
  const groups = useDocStore(useShallow((s) => distinctGroups(s)));
  const hasUngrouped = useDocStore((s) => hasUngroupedGuest(s));

  const searchField = useCommitField(filter.query, (text) => {
    setFilter({ query: text.trim() });
    return true;
  });

  function setChip(kind: 'all' | 'unseated' | 'dietary'): void {
    setFilter({ unseatedOnly: kind === 'unseated', dietaryOnly: kind === 'dietary', group: null });
  }

  function handleGroupChange(e: ChangeEvent<HTMLSelectElement>): void {
    const value = e.target.value;
    setFilter({ group: value === '' ? null : value, unseatedOnly: false, dietaryOnly: false });
  }

  const groupActive = filter.group !== null;
  const allActive = !filter.unseatedOnly && !filter.dietaryOnly && !groupActive;

  return (
    <div className="flex flex-col gap-2 border-b border-panel-border px-3 py-2.5">
      <div className="flex h-[26px] items-center gap-1.5 border border-rule bg-paper px-2">
        <input
          type="text"
          aria-label={t('searchGuests')}
          placeholder={t('searchGuests')}
          value={searchField.text}
          onChange={searchField.onChange}
          onBlur={searchField.onBlur}
          onKeyDown={searchField.onKeyDown}
          className="min-w-0 flex-1 bg-transparent font-[family-name:var(--font-ui)] text-[12px] text-ink outline-none placeholder:text-text-muted"
        />
        <span aria-hidden="true" className="shrink-0 font-[family-name:var(--font-data)] text-[10px] text-text-muted">
          ⌘K
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Chip active={allActive} label={t('allFilter', { count: total })} onClick={() => setChip('all')} />
        <Chip active={filter.unseatedOnly} label={t('unseatedFilter', { count: unseated })} onClick={() => setChip('unseated')} />
        <Chip active={filter.dietaryOnly} label={t('dietaryFilter', { count: dietary })} onClick={() => setChip('dietary')} />
        <div className={`relative flex h-6 shrink-0 items-center ${groupActive ? 'border border-ink bg-ink' : 'border border-rule bg-paper'}`}>
          <select
            aria-label={t('groupFilter')}
            value={filter.group ?? ''}
            onChange={handleGroupChange}
            className={`appearance-none bg-transparent py-0 pl-2 pr-4 font-[family-name:var(--font-data)] text-[11px] outline-none ${
              groupActive ? 'text-paper' : 'text-text-body'
            }`}
          >
            <option value="">{t('groupFilter')}</option>
            {groups.map((group) => <option key={group} value={group}>{group}</option>)}
            {hasUngrouped && <option value={UNGROUPED}>{t('noGroup')}</option>}
          </select>
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute right-1.5 font-[family-name:var(--font-data)] text-[9px] ${
              groupActive ? 'text-paper' : 'text-text-secondary'
            }`}
          >
            ▾
          </span>
        </div>
      </div>
    </div>
  );
}
