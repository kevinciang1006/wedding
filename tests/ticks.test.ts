import { describe, expect, it } from 'vitest';
import { tickLadder } from '@/lib/geometry/ticks';

describe('tickLadder', () => {
  it('uses 1 m minor / 5 m major at working zoom', () => {
    expect(tickLadder(0.38)).toEqual({ minor: 100, major: 500 });
  });

  it('coarsens as the stage zooms out so ticks never crowd', () => {
    const far = tickLadder(0.05);
    expect(far.minor).toBeGreaterThanOrEqual(500);
    expect(far.major).toBe(far.minor * 5);
  });

  it('refines as the stage zooms in', () => {
    const near = tickLadder(4);
    expect(near.minor).toBeLessThanOrEqual(25);
  });

  it('always keeps minor ticks at least 6 screen px apart', () => {
    for (const scale of [0.05, 0.1, 0.25, 0.38, 0.5, 1, 2, 4, 6]) {
      expect(tickLadder(scale).minor * scale).toBeGreaterThanOrEqual(6);
    }
  });

  it('always keeps major exactly five minors', () => {
    for (const scale of [0.05, 0.25, 1, 4]) {
      const { minor, major } = tickLadder(scale);
      expect(major).toBe(minor * 5);
    }
  });
});
