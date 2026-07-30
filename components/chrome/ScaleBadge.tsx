'use client';

import { useViewStore } from '@/stores/viewStore';
import { useT } from '@/lib/i18n/useT';

// Standard architectural drafting denominators — the set a "1 : N" scale
// badge is expected to round to, rather than showing an arbitrary decimal.
const DRAFT_DENOMINATORS = [
  1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10, 15, 20, 25, 30, 40, 50,
  75, 100, 150, 200, 250, 300, 400, 500, 750, 1000,
];

/** `1 / scale`, snapped to the nearest value in `DRAFT_DENOMINATORS`, per the brief's own formula. */
function draftingDenominator(scale: number): number {
  const raw = 1 / scale;
  return DRAFT_DENOMINATORS.reduce((closest, candidate) => (
    Math.abs(candidate - raw) < Math.abs(closest - raw) ? candidate : closest
  ), DRAFT_DENOMINATORS[0]);
}

function formatDenominator(d: number): string {
  return Number.isInteger(d) ? String(d) : d.toFixed(1);
}

/** Bottom-right chrome: the current zoom re-expressed as a "1 : N" drafting ratio, purely informational. */
export function ScaleBadge() {
  const scale = useViewStore((s) => s.scale);
  const t = useT();
  const denominator = draftingDenominator(scale);

  return (
    <div className="border-rule absolute bottom-5 right-5 flex h-7 items-center gap-2 border bg-paper px-2.5">
      <span className="font-[family-name:var(--font-data)] text-[10px] text-text-secondary">{t('fit')}</span>
      <span className="bg-divider h-3.5 w-px" />
      <span className="font-[family-name:var(--font-data)] text-[10px] text-ink">1 : {formatDenominator(denominator)}</span>
    </div>
  );
}
