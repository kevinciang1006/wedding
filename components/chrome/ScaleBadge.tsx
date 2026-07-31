'use client';

import { useViewStore } from '@/stores/viewStore';
import { useT } from '@/lib/i18n/useT';

// Standard architectural drafting numbers — the set either side of a scale
// badge is expected to round to, rather than showing an arbitrary decimal.
const DRAFT_DENOMINATORS = [
  1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10, 15, 20, 25, 30, 40, 50,
  75, 100, 150, 200, 250, 300, 400, 500, 750, 1000,
];

/** Snap `raw` to the nearest value in `DRAFT_DENOMINATORS`. */
function nearestDraftValue(raw: number): number {
  return DRAFT_DENOMINATORS.reduce((closest, candidate) => (
    Math.abs(candidate - raw) < Math.abs(closest - raw) ? candidate : closest
  ), DRAFT_DENOMINATORS[0]);
}

function formatDenominator(d: number): string {
  return Number.isInteger(d) ? String(d) : d.toFixed(1);
}

/**
 * The current zoom as a drafting ratio. Below 100% this is a reduction —
 * `1 / scale` snapped to `DRAFT_DENOMINATORS`, giving "1 : N" — per the
 * brief's own formula. At or past 100% that same formula would round every
 * further zoom-in toward "1 : 1" (`DRAFT_DENOMINATORS` bottoms out at 1,
 * so there is no "1 : 0.5"), which reads as the badge freezing rather than
 * tracking the zoom. A drafting scale enlarged past life-size is
 * conventionally written the other way round — "2 : 1", not "1 : 0.5" — so
 * past 100% this snaps `scale` itself instead of its reciprocal, and the
 * ratio's numerator and denominator swap sides.
 */
function draftingRatio(scale: number): { left: number; right: number } {
  return scale >= 1
    ? { left: nearestDraftValue(scale), right: 1 }
    : { left: 1, right: nearestDraftValue(1 / scale) };
}

/** Bottom-right chrome: the current zoom re-expressed as an "N : N" drafting ratio, purely informational. */
export function ScaleBadge() {
  const scale = useViewStore((s) => s.scale);
  const t = useT();
  const { left, right } = draftingRatio(scale);

  return (
    <div className="border-rule absolute bottom-5 right-5 flex h-7 items-center gap-2 border bg-paper px-2.5">
      <span className="font-[family-name:var(--font-data)] text-[10px] text-text-secondary">{t('fit')}</span>
      <span className="bg-divider h-3.5 w-px" />
      <span className="font-[family-name:var(--font-data)] text-[10px] text-ink">
        {formatDenominator(left)} : {formatDenominator(right)}
      </span>
    </div>
  );
}
