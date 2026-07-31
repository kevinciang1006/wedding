'use client';

import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDocStore } from '@/stores/docStore';
import { useUiStore } from '@/stores/uiStore';
import { useT } from '@/lib/i18n/useT';
import { GuestChip } from '@/components/guests/GuestChip';
import { filterGuestIdsInGroup, groupCounts, UNGROUPED, type GuestFilter } from '@/lib/doc/guestFilter';

interface GuestGroupProps { groupKey: string; filter: GuestFilter }

/**
 * One disclosure section: `▾`/`▸`, the group's name, a mono `{total} ·
 * {seated} seated` summary, and — expanded — its chips.
 *
 * Subscribes independently to its own filtered membership
 * (`filterGuestIdsInGroup`, `useShallow`'d — a flat `string[]`, so two calls
 * returning the same ids in the same order compare equal by value and bail
 * the re-render even though each call builds a fresh array) and its own
 * true total/seated (`groupCounts`, same `useShallow` flat-object pattern
 * `tableFill` uses in `TableNode`). Neither reads any *other* group's slice
 * of the doc, so renaming or seating a guest in group A never invalidates
 * group B's subscriptions.
 *
 * `memo`'d on `groupKey` + `filter`: `filter` is the exact object
 * `useUiStore` holds (`GuestPanel.tsx` reads `s.filter` directly, no
 * `useShallow`), so it's referentially the same across any re-render that
 * didn't call `setFilter` — meaning a sibling group appearing/disappearing
 * in `GuestPanel`'s own list re-render doesn't cascade into every
 * *existing* group re-rendering too.
 */
export const GuestGroup = memo(function GuestGroup({ groupKey, filter }: GuestGroupProps) {
  const t = useT();
  const collapsed = useUiStore((s) => s.collapsedGroups.includes(groupKey));
  const toggleGroup = useUiStore((s) => s.toggleGroup);
  const ids = useDocStore(useShallow((s) => filterGuestIdsInGroup(s, groupKey, filter)));
  const counts = useDocStore(useShallow((s) => groupCounts(s, groupKey)));

  if (ids.length === 0) return null;

  const displayName = groupKey === UNGROUPED ? t('noGroup') : groupKey;

  return (
    <div className="border-b border-divider-light">
      <button
        type="button"
        onClick={() => toggleGroup(groupKey)}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left"
      >
        <span aria-hidden="true" className="w-2.5 shrink-0 font-[family-name:var(--font-data)] text-[9px] text-text-secondary">
          {collapsed ? '▸' : '▾'}
        </span>
        <span className="min-w-0 flex-1 truncate font-[family-name:var(--font-ui)] text-[11.5px] font-semibold text-ink">
          {displayName}
        </span>
        <span className="shrink-0 font-[family-name:var(--font-data)] text-[10px] text-text-secondary">
          {t('groupSummary', { total: counts.total, seated: counts.seated })}
        </span>
      </button>
      {!collapsed && (
        <div className="flex flex-col gap-px px-2 pb-1.5">
          {ids.map((id) => <GuestChip key={id} id={id} />)}
        </div>
      )}
    </div>
  );
});
