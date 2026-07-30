import { describe, expect, it } from 'vitest';
import { screenPointToRoomCm, viewportCentreCm } from '@/lib/geometry/viewport';

describe('screenPointToRoomCm', () => {
  it('inverts the stage scale/translate at 100%, no pan', () => {
    const v = { width: 800, height: 600, scale: 1, x: 0, y: 0 };
    expect(screenPointToRoomCm(v, 100, 50)).toEqual({ x: 100, y: 50 });
  });

  it('accounts for pan and zoom together', () => {
    // A stage panned to (40, 20) and zoomed to 2x: a screen point at
    // (140, 120) sits at room (50, 50) — (140-40)/2, (120-20)/2.
    const v = { width: 800, height: 600, scale: 2, x: 40, y: 20 };
    expect(screenPointToRoomCm(v, 140, 120)).toEqual({ x: 50, y: 50 });
  });
});

describe('viewportCentreCm', () => {
  it('is the room point under the viewport centre pixel', () => {
    const v = { width: 800, height: 600, scale: 1, x: 0, y: 0 };
    expect(viewportCentreCm(v)).toEqual({ x: 400, y: 300 });
  });

  it('follows pan and zoom the same way a fitted room would', () => {
    // Centre pixel (500, 400) minus pan (100, 50), divided by scale 0.5:
    // (400, 350) / 0.5 = (800, 700).
    const v = { width: 1000, height: 800, scale: 0.5, x: 100, y: 50 };
    expect(viewportCentreCm(v)).toEqual({ x: 800, y: 700 });
  });
});
