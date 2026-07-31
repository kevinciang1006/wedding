import { describe, expect, it } from 'vitest';
import { cmToDisplay, displayToCm, formatLength, parseLength } from '@/lib/units/format';

describe('formatLength', () => {
  it('renders metres to 2dp with a unit suffix', () => {
    expect(formatLength(2200, 'm')).toBe('22.00 m');
    expect(formatLength(25, 'm')).toBe('0.25 m');
  });

  it('renders feet to 2dp with a unit suffix', () => {
    expect(formatLength(2200, 'ft')).toBe('72.18 ft');
  });
});

describe('round-trip', () => {
  it('survives cm -> m -> cm exactly', () => {
    for (const cm of [0, 1, 25, 180, 1400, 2200, 9999]) {
      expect(displayToCm(cmToDisplay(cm, 'm'), 'm')).toBeCloseTo(cm, 6);
    }
  });

  it('survives cm -> ft -> cm within a hundredth of a cm', () => {
    for (const cm of [0, 1, 25, 180, 1400, 2200, 9999]) {
      expect(displayToCm(cmToDisplay(cm, 'ft'), 'ft')).toBeCloseTo(cm, 2);
    }
  });
});

describe('parseLength', () => {
  it('accepts a bare number in the active unit', () => {
    expect(parseLength('22', 'm')).toBe(2200);
    expect(parseLength('72.18', 'ft')).toBeCloseTo(2200, 0);
  });

  it('accepts a trailing unit and stray whitespace', () => {
    expect(parseLength('  22.00 m ', 'm')).toBe(2200);
  });

  it('returns null for junk rather than NaN', () => {
    expect(parseLength('', 'm')).toBeNull();
    expect(parseLength('twelve', 'm')).toBeNull();
    expect(parseLength('-3', 'm')).toBeNull();
  });
});
