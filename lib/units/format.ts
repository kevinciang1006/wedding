import { CM_PER_FOOT } from '@/lib/constants';
import type { Cm, Units } from '@/lib/types/doc';

export function cmToDisplay(cm: Cm, units: Units): number {
  return units === 'ft' ? cm / CM_PER_FOOT : cm / 100;
}

export function displayToCm(value: number, units: Units): Cm {
  return units === 'ft' ? value * CM_PER_FOOT : value * 100;
}

export function formatLength(cm: Cm, units: Units, dp = 2): string {
  return `${cmToDisplay(cm, units).toFixed(dp)} ${units}`;
}

/** Bare number for input fields — no unit suffix, no padding. */
export function formatValue(cm: Cm, units: Units, dp = 2): string {
  return cmToDisplay(cm, units).toFixed(dp);
}

export function formatDimensions(w: Cm, h: Cm, units: Units): string {
  return `${cmToDisplay(w, units).toFixed(2)} × ${cmToDisplay(h, units).toFixed(2)} ${units}`;
}

/** Returns null rather than NaN so callers cannot silently write garbage into the doc. */
export function parseLength(text: string, units: Units): Cm | null {
  const cleaned = text.trim().replace(/\s*(m|ft)\s*$/i, '').replace(',', '.');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return displayToCm(value, units);
}
