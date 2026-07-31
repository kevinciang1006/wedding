import { describe, expect, it } from 'vitest';
import { centredView, fitView, screenPointToRoomCm, viewportCentreCm, zoomAt } from '@/lib/geometry/viewport';
import { MAX_SCALE, MIN_SCALE } from '@/lib/constants';

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

describe('zoomAt', () => {
  it('keeps the room point under the pointer pinned to the pointer', () => {
    const before = { scale: 0.5, x: 100, y: 50 };
    const pointer = { x: 300, y: 250 };
    const roomUnderPointer = screenPointToRoomCm({ width: 0, height: 0, ...before }, pointer.x, pointer.y);
    const after = zoomAt(before, 2, pointer);
    expect(after.scale).toBe(2);
    expect(screenPointToRoomCm({ width: 0, height: 0, ...after }, pointer.x, pointer.y)).toEqual(roomUnderPointer);
  });

  it('clamps to the scale limits and pins the pointer at the clamped scale', () => {
    const pointer = { x: 120, y: 90 };
    const tooFar = zoomAt({ scale: 1, x: 0, y: 0 }, MAX_SCALE * 10, pointer);
    expect(tooFar.scale).toBe(MAX_SCALE);
    // Pinning must use the CLAMPED scale, not the requested one: room (120,90)
    // sits under the pointer at scale 1, so it must still be there after.
    expect(tooFar.x).toBe(pointer.x - 120 * MAX_SCALE);
    expect(tooFar.y).toBe(pointer.y - 90 * MAX_SCALE);
    expect(zoomAt({ scale: 1, x: 0, y: 0 }, MIN_SCALE / 10, pointer).scale).toBe(MIN_SCALE);
  });
});

describe('centredView', () => {
  it('puts the room centre at the viewport centre', () => {
    const room = { width: 2200, height: 1400 };
    const view = centredView(0.5, 1000, 800, room);
    expect(view).toEqual({ scale: 0.5, x: 1000 / 2 - 1100 * 0.5, y: 800 / 2 - 700 * 0.5 });
    expect(viewportCentreCm({ width: 1000, height: 800, ...view })).toEqual({ x: 1100, y: 700 });
  });

  it('clamps the scale it is handed', () => {
    expect(centredView(MAX_SCALE * 2, 1000, 800, { width: 100, height: 100 }).scale).toBe(MAX_SCALE);
  });
});

describe('fitView', () => {
  it('fits the tighter of the two axes, with padding on both sides', () => {
    // 2200+2*150 = 2500 wide against 1000px -> 0.4; 1400+2*150 = 1700 against
    // 800px -> 0.4706. The width is the binding constraint.
    const view = fitView(1000, 800, { width: 2200, height: 1400 }, 150);
    expect(view.scale).toBeCloseTo(0.4, 10);
    expect(viewportCentreCm({ width: 1000, height: 800, ...view })).toEqual({ x: 1100, y: 700 });
  });

  it('leaves the padded room inside the viewport on both axes', () => {
    const room = { width: 2200, height: 1400 };
    const view = fitView(1000, 800, room, 150);
    expect(view.x).toBeGreaterThanOrEqual(0);
    expect(view.y).toBeGreaterThanOrEqual(0);
    expect(view.x + room.width * view.scale).toBeLessThanOrEqual(1000);
    expect(view.y + room.height * view.scale).toBeLessThanOrEqual(800);
  });
});
