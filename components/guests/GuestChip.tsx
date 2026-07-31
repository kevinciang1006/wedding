'use client';

import { memo } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDocStore } from '@/stores/docStore';
import { useViewStore } from '@/stores/viewStore';
import { useT } from '@/lib/i18n/useT';
import { startGuestDrag } from '@/components/dnd/useGuestDrag';
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
 * `PaletteGlyph` uses rather than an icon library. `pointerdown` here is the
 * one entry point into `startGuestDrag` (`components/dnd/useGuestDrag.ts`):
 * that function itself withholds any visible effect (ghost, seat hover,
 * this chip's own placeholder) until the gesture crosses its arm threshold,
 * so a plain click-and-release on this handle does nothing more than a
 * click anywhere else on the chip would — never a phantom drag. Still
 * `aria-hidden`: dragging has no keyboard equivalent, and the accessible
 * path to reseating a guest is `SeatMenu`'s click-driven dropdown, not this
 * handle.
 */
function DragHandle({ guestId }: { guestId: string }) {
  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>): void {
    startGuestDrag(guestId, e.nativeEvent);
  }

  return (
    <div
      aria-hidden="true"
      onPointerDown={handlePointerDown}
      className="grid shrink-0 cursor-grab touch-none select-none grid-cols-2 grid-rows-3 gap-[2px]"
    >
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
 *
 * Two more slices back Task 14's "moving to {table}" placeholder, both
 * chosen so every chip OTHER than the one actually being dragged bails its
 * re-render even though `viewStore.guestDrag`/`hoveredSeatId` are themselves
 * changing on every pointermove of the gesture: `isDragging` is a primitive
 * boolean that flips for exactly one chip when a drag starts/ends, and
 * `hoveredSeatId` below is read as `null` for every OTHER chip regardless of
 * how often the real value changes, so the selector's output — not just its
 * reference — stays unchanged for them and zustand bails the re-render.
 * `movingToLabel` chains off that same gate for the same reason.
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
  const isDragging = useViewStore((s) => s.guestDrag?.guestId === id);
  const hoveredSeatId = useViewStore((s) => (isDragging ? s.hoveredSeatId : null));
  const movingToLabel = useDocStore((s) => (
    hoveredSeatId === null ? null : (s.objects[tableIdOfSeat(hoveredSeatId)]?.label ?? null)
  ));

  if (!guest) return null;

  if (isDragging) {
    return (
      <div className="flex h-8 shrink-0 items-center border border-dashed border-cool bg-cool-wash px-2">
        {movingToLabel !== null && (
          <span className="truncate font-[family-name:var(--font-ui)] text-[12px] text-cool-deep">
            {t('movingTo', { table: movingToLabel })}
          </span>
        )}
      </div>
    );
  }

  const declined = guest.rsvp === 'no';

  return (
    <div className="flex h-8 shrink-0 items-center gap-2 border border-divider bg-paper px-2">
      <DragHandle guestId={id} />
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
