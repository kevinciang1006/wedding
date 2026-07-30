'use client';

import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDocStore } from '@/stores/docStore';
import { useT } from '@/lib/i18n/useT';
import { seatIndexOfSeat, seatOfGuest, tableIdOfSeat } from '@/lib/doc/assignments';
import type { TranslationKey } from '@/lib/i18n/en';
import type { Rsvp } from '@/lib/types/doc';

interface GuestChipProps { id: string }

const RSVP_LABEL_KEY: Record<Rsvp, TranslationKey> = {
  yes: 'confirmed',
  pending: 'waitingReply',
  no: 'declinedKept',
};

/**
 * Confirmed: filled warm. Pending: hollow warm ring — still warm ink, since
 * RSVP is human state, but visually "not yet." Declined: filled the cool
 * chrome grey (`#D6DDE1`, not a named token — this one value isn't reused
 * anywhere else the way the warm/cool/ink palette is) precisely because a
 * declined guest has *dropped out* of the human/warm story this dot
 * otherwise tells. `role="img"` + `aria-label` (not `aria-hidden`): this dot
 * is the only visual signal of "confirmed" vs "pending" — the declined case
 * also gets the chip's own strikethrough name, but the other two states
 * don't, so this can't be decorative-only.
 */
function RsvpDot({ rsvp, label }: { rsvp: Rsvp; label: string }) {
  const shared = 'h-[7px] w-[7px] shrink-0 rounded-full';
  if (rsvp === 'yes') {
    return <span role="img" aria-label={label} title={label} className={`${shared} bg-warm`} />;
  }
  if (rsvp === 'pending') {
    return <span role="img" aria-label={label} title={label} className={`${shared} border-[1.5px] border-warm bg-transparent`} />;
  }
  return <span role="img" aria-label={label} title={label} className={`${shared} bg-[#D6DDE1]`} />;
}

/**
 * Six 2x2px dots — the same plain-div-glyph convention `ObjectPalette`'s
 * `PaletteGlyph` uses rather than an icon library. Purely decorative here:
 * Task 14 owns the actual pointer drag this hints at, so the handle has no
 * `draggable`/pointer handlers of its own yet, and `aria-hidden` keeps a
 * not-yet-functional affordance out of the accessibility tree rather than
 * announcing a grip control that does nothing.
 */
function DragHandle() {
  return (
    <div aria-hidden="true" className="grid shrink-0 grid-cols-2 grid-rows-3 gap-[2px]">
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} className="h-[2px] w-[2px] bg-text-disabled" />
      ))}
    </div>
  );
}

/**
 * One guest row: drag handle, RSVP dot, name, an optional dietary badge, and
 * — when seated — a compact table/seat reference. Subscribes to exactly two
 * narrow slices: `s.guests[id]` (Immer keeps this reference stable across a
 * commit that doesn't touch this guest, the same reasoning `TableNode`
 * documents for `s.objects[id]`) and a `useShallow`'d flat object of
 * seat/table primitives derived from `s.seatAssignments`/`s.objects`. Wrapped
 * in `memo` on the single `id` prop so a parent `GuestGroup` re-render (its
 * own membership or count changing) never cascades into every sibling
 * chip — see `GuestPanel.tsx`'s header comment for how this was checked.
 */
export const GuestChip = memo(function GuestChip({ id }: GuestChipProps) {
  const t = useT();
  const guest = useDocStore((s) => s.guests[id]);
  const seatInfo = useDocStore(useShallow((s) => {
    const seatId = seatOfGuest(s.seatAssignments, id);
    if (seatId === null) return { seatId: null, tableLabel: null, seatIndex: 0 };
    const table = s.objects[tableIdOfSeat(seatId)];
    return { seatId, tableLabel: table?.label ?? null, seatIndex: seatIndexOfSeat(seatId) };
  }));

  if (!guest) return null;

  const declined = guest.rsvp === 'no';

  return (
    <div className="flex h-8 shrink-0 items-center gap-2 border border-divider bg-paper px-2">
      <DragHandle />
      <RsvpDot rsvp={guest.rsvp} label={t(RSVP_LABEL_KEY[guest.rsvp])} />
      <span
        className={`min-w-0 flex-1 truncate font-[family-name:var(--font-name)] text-[12.5px] ${
          declined ? 'text-text-muted line-through' : 'text-ink'
        }`}
      >
        {guest.name}
      </span>
      {guest.dietary !== null && (
        <span className="shrink-0 border border-flag-border px-[3px] font-[family-name:var(--font-data)] text-[9px] leading-[14px] text-flag">
          {guest.dietary}
        </span>
      )}
      {seatInfo.seatId !== null && seatInfo.tableLabel !== null && (
        <span className="max-w-16 shrink-0 truncate font-[family-name:var(--font-data)] text-[9.5px] text-text-secondary">
          {seatInfo.tableLabel}·{seatInfo.seatIndex + 1}
        </span>
      )}
    </div>
  );
});
