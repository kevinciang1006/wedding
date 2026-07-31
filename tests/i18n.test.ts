import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { en } from '@/lib/i18n/en';
import { es } from '@/lib/i18n/es';
import { useT } from '@/lib/i18n/useT';
import { formatEventDate } from '@/lib/i18n/date';

describe('dictionaries', () => {
  it('have identical key sets', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
  });

  it('have no empty strings', () => {
    // Iterated separately, NOT as `{ ...en, ...es }`: the key sets are
    // identical by the test above, so spreading means `es` overwrites every
    // `en` value and English is never examined at all — the test would have
    // covered half of what its name claims.
    for (const [language, dict] of Object.entries({ en, es })) {
      for (const [key, value] of Object.entries(dict)) {
        expect(value.length, `empty ${language} translation for ${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('use the same interpolation tokens in both languages', () => {
    const tokens = (s: string): string[] => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(tokens(es[key]), `token mismatch on ${key}`).toEqual(tokens(en[key]));
    }
  });
});

describe('useT', () => {
  it('substitutes interpolation variables', () => {
    // useT() is a hook (it reads uiStore via useSyncExternalStore), so it can
    // only run inside a React render. renderToStaticMarkup gives it one
    // without needing jsdom: zustand's useStore always supplies a
    // getServerSnapshot, so this works in Node with no DOM.
    let result = '';
    function Harness() {
      const t = useT();
      result = t('guestCounter', { total: 142, seated: 118, unseated: 24 });
      return null;
    }
    renderToStaticMarkup(createElement(Harness));

    expect(result).toContain('142');
    expect(result).not.toContain('{total}');
  });
});

describe('formatEventDate', () => {
  it('falls back when there is no date', () => {
    expect(formatEventDate('en', null, 'no date set')).toBe('no date set');
  });

  it('falls back on a date string it cannot parse rather than printing "Invalid Date"', () => {
    // `isDoc` only checks that `eventDate` is a string, so an imported or
    // restored document can carry anything here.
    expect(formatEventDate('en', 'not-a-date', 'no date set')).toBe('no date set');
  });

  it('reads a plain yyyy-mm-dd as that calendar day, not as a UTC instant', () => {
    // The bug this guards: `new Date('2026-06-14')` parses as UTC midnight
    // and prints the 13th anywhere west of UTC. Asserted on the day number
    // rather than the whole string, which varies with the platform's ICU.
    expect(formatEventDate('en', '2026-06-14', 'x')).toContain('14');
    expect(formatEventDate('en', '2026-06-14', 'x')).toContain('2026');
    expect(formatEventDate('es', '2026-06-14', 'x')).toContain('14');
  });

  it('formats in the active language', () => {
    expect(formatEventDate('es', '2026-06-14', 'x')).not.toBe(formatEventDate('en', '2026-06-14', 'x'));
  });
});
