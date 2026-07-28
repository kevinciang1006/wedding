import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { en } from '@/lib/i18n/en';
import { es } from '@/lib/i18n/es';
import { useT } from '@/lib/i18n/useT';

describe('dictionaries', () => {
  it('have identical key sets', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
  });

  it('have no empty strings', () => {
    for (const [key, value] of Object.entries({ ...en, ...es })) {
      expect(value.length, `empty translation for ${key}`).toBeGreaterThan(0);
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
