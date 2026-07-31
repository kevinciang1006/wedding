'use client';

import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDocStore } from '@/stores/docStore';
import { useUiStore } from '@/stores/uiStore';
import { useT } from '@/lib/i18n/useT';
import { AddGuestForm } from '@/components/guests/AddGuestForm';
import { CsvImportDialog } from '@/components/guests/CsvImportDialog';
import { GuestFilters } from '@/components/guests/GuestFilters';
import { GuestGroup } from '@/components/guests/GuestGroup';
import { freeSeatCount, seatingCounts } from '@/lib/doc/derive';
import { groupBuckets } from '@/lib/doc/guestFilter';

/**
 * 320px right panel: header (title, add/import triggers, counter, progress
 * bar), filters, an optional inline add-guest form, the grouped guest list,
 * and a footer. `CsvImportDialog` is mounted here too (it renders `null`
 * when closed) since it's "opened from the panel" per the brief, not a
 * separate always-mounted-at-the-app-root surface like `Toast`.
 *
 * Re-render isolation: this component itself subscribes to `seatingCounts`
 * and `freeSeatCount` (both `useShallow`'d/plain flat reads, same idiom
 * `TableNode` uses for `tableFill`) purely for its own header/footer text —
 * those numbers changing on every seat/guest edit is expected and cheap
 * (this component's own JSX, not 142 chips). The list itself never
 * subscribes to guest data directly: `groupBuckets` (below) is the only
 * doc read here, and it returns a flat `string[]` of *bucket names* that
 * only changes when a group is created or emptied out entirely — not when
 * any individual guest's fields change. Each bucket name is handed to a
 * `memo`'d `GuestGroup` as a stable prop (`groupKey`, plus `filter`, which
 * is the literal object `uiStore` holds and so is reference-stable across
 * any render that didn't call `setFilter`), and `GuestGroup` in turn reads
 * its own membership/counts and hands each id to a `memo`'d `GuestChip`
 * reading only `s.guests[id]`. The result: renaming or seating one guest
 * re-renders that one `GuestChip` (and, if seating changed, its own group's
 * header count) — never a sibling chip in another group, and never this
 * top-level panel unless the *totals* it displays actually moved. Checked
 * by hand in the browser with a temporary render counter in `GuestChip`
 * (removed before commit — see the Task 13 report) while seating a single
 * guest with ~140 guests loaded across six groups.
 */
export function GuestPanel() {
  const t = useT();
  const [formOpen, setFormOpen] = useState(false);
  const counts = useDocStore(useShallow((s) => seatingCounts(s)));
  const free = useDocStore((s) => freeSeatCount(s));
  const groups = useDocStore(useShallow((s) => groupBuckets(s)));
  const filter = useUiStore((s) => s.filter);

  const counterText = t('guestCounter', { total: counts.total, seated: counts.seated, unseated: counts.unseated });
  // The header counter is one translated sentence, but only the seated
  // figure needs warm ink. Splitting the already-substituted string on the
  // literal " · " this app uses to join every mono-segment sentence
  // (`TopBar`'s date/saved-state line, `groupSummary` below) works
  // regardless of word order in either language, without threading a
  // second, JSX-aware interpolation scheme through `useT` just for this one
  // spot. `parts.length !== 3` only if a future dictionary edit changes the
  // segment count — the plain-text fallback keeps that a cosmetic
  // regression, not a broken render.
  const counterParts = counterText.split(' · ');
  const progressPct = counts.total === 0 ? 0 : Math.min(100, (counts.seated / counts.total) * 100);
  const seatRemainingDisabled = counts.unseated === 0 || free <= 0;

  return (
    <div className="flex w-[320px] shrink-0 flex-col overflow-hidden border-l border-panel-border bg-paper">
      <div className="flex items-center justify-between px-3 pt-3">
        <span className="font-[family-name:var(--font-ui)] text-[13.5px] font-semibold text-ink">{t('guests')}</span>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="font-[family-name:var(--font-ui)] text-[12px] font-medium text-cool"
          >
            {t('addGuest')}
          </button>
          <button
            type="button"
            onClick={() => useUiStore.getState().openDialog('csv')}
            className="font-[family-name:var(--font-ui)] text-[11px] text-cool"
          >
            {t('importGuestList')}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 px-3 pb-3 pt-2">
        <div className="font-[family-name:var(--font-data)] text-[10.5px] text-text-secondary">
          {counterParts.length === 3 ? (
            <>
              <span>{counterParts[0]} · </span>
              <span className="text-warm">{counterParts[1]}</span>
              <span> · {counterParts[2]}</span>
            </>
          ) : (
            counterText
          )}
        </div>
        <div className="h-[5px] w-full bg-hairline">
          <div className="h-full bg-warm" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <GuestFilters />
      <AddGuestForm open={formOpen} onClose={() => setFormOpen(false)} />

      <div className="flex-1 overflow-y-auto">
        {counts.total === 0 ? (
          <p className="px-3 py-3 font-[family-name:var(--font-ui)] text-[12px] text-text-secondary">
            {t('guestsLandHere')}
          </p>
        ) : (
          groups.map((groupKey) => <GuestGroup key={groupKey} groupKey={groupKey} filter={filter} />)
        )}
      </div>

      <div className="flex items-center justify-between border-t border-panel-border px-3 py-2.5">
        <span className="font-[family-name:var(--font-data)] text-[10.5px] text-text-secondary">
          {t('seatsFree', { count: free })}
        </span>
        <button
          type="button"
          disabled={seatRemainingDisabled}
          onClick={() => useDocStore.getState().seatAllRemaining()}
          className={`flex h-7 items-center px-3 font-[family-name:var(--font-ui)] text-[11.5px] ${
            seatRemainingDisabled ? 'border border-divider text-text-disabled' : 'border border-ink text-ink'
          }`}
        >
          {t('seatRemaining')}
        </button>
      </div>

      <CsvImportDialog />
    </div>
  );
}
