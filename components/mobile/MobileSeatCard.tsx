'use client';

import { useT } from '@/lib/i18n/useT';
import { MOBILE_TABLEMATE_CHIPS } from '@/lib/constants';
import type { SeatLookup } from '@/lib/doc/lookup';
import type { Guest } from '@/lib/types/doc';

interface MobileSeatCardProps {
  guest: Guest;
  /** `null` when this guest is on the list but has no seat yet. */
  seat: SeatLookup | null;
}

/**
 * The answer, in the warm ink this app reserves for people and seating: who
 * you are, which table, which seat.
 *
 * A guest with no seat gets the same card with `unseated` where the table
 * would be. Saying so plainly is the only honest option — the alternative,
 * treating them as not found, would tell somebody who is genuinely on the
 * list that they are not on it. Roughly a fifth of a real plan is unseated
 * at any given moment.
 */
export function MobileSeatCard({ guest, seat }: MobileSeatCardProps) {
  const t = useT();

  return (
    <div className="mx-4 mt-1 border border-warm bg-warm-card p-3.5">
      <div className="flex items-baseline gap-2">
        <span className="font-[family-name:var(--font-name)] text-[22px] leading-tight text-ink">{guest.name}</span>
        {guest.dietary !== null && (
          <span className="shrink-0 font-[family-name:var(--font-data)] text-[10px] text-warm-text">{guest.dietary}</span>
        )}
      </div>
      {seat ? (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="font-[family-name:var(--font-name)] text-[26px] leading-tight text-ink">{seat.tableLabel}</span>
          <span className="font-[family-name:var(--font-data)] text-[13px] text-warm-text">
            {t('seatNumber', { n: seat.seatNumber })}
          </span>
        </div>
      ) : (
        <div className="mt-2 font-[family-name:var(--font-data)] text-[13px] text-warm-text">{t('unseated')}</div>
      )}
    </div>
  );
}

/** Everyone else at the table, as name chips — the "do I know anyone" question, answered without a second search. */
export function MobileTablemates({ tablemates }: { tablemates: Guest[] }) {
  const t = useT();
  if (tablemates.length === 0) return null;

  const shown = tablemates.slice(0, MOBILE_TABLEMATE_CHIPS);
  const rest = tablemates.length - shown.length;

  return (
    <div className="flex flex-col gap-2 px-4 pt-4">
      <div className="font-[family-name:var(--font-data)] text-[10px] uppercase tracking-[0.1em] text-text-muted">
        {t('atYourTable')}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {shown.map((g) => (
          <span key={g.id} className="border border-divider px-2.5 py-1 font-[family-name:var(--font-ui)] text-[13px] text-ink">
            {g.name}
          </span>
        ))}
        {rest > 0 && (
          <span className="border border-divider px-2.5 py-1 font-[family-name:var(--font-ui)] text-[13px] text-text-secondary">
            {t('andMore', { count: rest })}
          </span>
        )}
      </div>
    </div>
  );
}
