import { describe, expect, it } from 'vitest';
import { getBounds, getBoundsAt } from '@/lib/geometry/bounds';
import { snapPosition } from '@/lib/geometry/snap';
import type { SceneObject } from '@/lib/types/doc';

const bar = (id: string, x: number, y: number): SceneObject =>
  ({ id, type: 'bar', x, y, rotation: 0, label: 'bar', z: 0, width: 200, height: 100 });

describe('getBounds', () => {
  it('builds an AABB around an unrotated box', () => {
    const b = getBounds(bar('a', 100, 50));
    expect(b).toMatchObject({ left: 0, right: 200, top: 0, bottom: 100, cx: 100, cy: 50 });
  });

  it('grows the AABB to contain a rotated box', () => {
    const b = getBounds({ ...bar('a', 0, 0), rotation: 90 });
    expect(b.width).toBeCloseTo(100, 6);
    expect(b.height).toBeCloseTo(200, 6);
  });

  it('includes the seat ring for a round table', () => {
    const table: SceneObject = {
      id: 't', type: 'roundTable', x: 0, y: 0, rotation: 0, label: 't', z: 0,
      diameter: 180, seatCount: 8,
    };
    // 180/2 + 35 seat offset + 20 seat radius
    expect(getBounds(table).width).toBeCloseTo(290, 6);
  });

  it('getBoundsAt relocates without mutating the object', () => {
    const obj = bar('a', 100, 50);
    expect(getBoundsAt(obj, 500, 500).cx).toBe(500);
    expect(obj.x).toBe(100);
  });
});

describe('bounds cover the seat ring', () => {
  it('covers seat ring on head table', () => {
    const headTable: SceneObject = {
      id: 'h', type: 'headTable', x: 0, y: 0, rotation: 0, label: 'h', z: 0,
      width: 480, height: 90, seatCount: 10,
    };
    expect(getBounds(headTable).top).toBeLessThanOrEqual(-100);
    expect(getBounds(headTable).bottom).toBeGreaterThanOrEqual(100);
  });

  it('covers seat ring on sweetheart table', () => {
    const sweetheart: SceneObject = {
      id: 's', type: 'sweetheart', x: 0, y: 0, rotation: 0, label: 's', z: 0,
      width: 150, height: 75,
    };
    // height/2 = 37.5, + pad (55) = 92.5 -> bounds reach ±92.5
    expect(getBounds(sweetheart).top).toBeLessThanOrEqual(-(75 / 2 + 35 + 20));
    expect(getBounds(sweetheart).bottom).toBeGreaterThanOrEqual(75 / 2 + 35 + 20);
  });

  it('covers seat ring on rect table', () => {
    const rectTable: SceneObject = {
      id: 'r', type: 'rectTable', x: 0, y: 0, rotation: 0, label: 'r', z: 0,
      width: 240, height: 90, seatsPerSide: 3,
    };
    expect(getBounds(rectTable).top).toBeLessThanOrEqual(-100);
    expect(getBounds(rectTable).bottom).toBeGreaterThanOrEqual(100);
  });
});

const scale = 1; // 8 screen px === 8 cm at scale 1

// Neighbours sit ~50 cm away on y. Keep them well inside SNAP_NEIGHBOUR_RANGE:
// a neighbour parked near the 300 cm boundary gets filtered before the snap
// threshold is ever evaluated, and the test then passes without testing anything.

describe('alignment snapping', () => {
  it('snaps centre-x to a neighbour just inside the threshold', () => {
    // A narrow neighbour, so the only candidate in range is centre-to-centre —
    // with two equal-sized boxes, left/centre/right all tie and the test cannot
    // tell which edge kind resolved the match.
    const narrow: SceneObject = {
      id: 'b', type: 'bar', x: 500, y: 100, rotation: 0, label: 'b', z: 0, width: 20, height: 40,
    };
    const r = snapPosition({
      moving: bar('a', 0, 0), x: 501, y: 150,
      others: [narrow], stageScale: scale, gridEnabled: false,
    });
    expect(r.x).toBe(500);
    expect(r.snappedX).toBe(true);
  });

  it('does not snap just outside the threshold', () => {
    const r = snapPosition({
      moving: bar('a', 0, 0), x: 509, y: 150,
      others: [bar('b', 500, 100)], stageScale: scale, gridEnabled: false,
    });
    expect(r.x).toBe(509);
    expect(r.snappedX).toBe(false);
  });

  it('scales the threshold down as the stage zooms in', () => {
    const args = {
      moving: bar('a', 0, 0), x: 505, y: 150,
      others: [bar('b', 500, 100)], gridEnabled: false,
    };
    // The same 5 cm gap snaps at scale 1 (threshold 8 cm) and must not at
    // scale 4 (threshold 2 cm). Asserting both pins the division by scale.
    expect(snapPosition({ ...args, stageScale: 1 }).x).toBe(500);
    expect(snapPosition({ ...args, stageScale: 4 }).x).toBe(505);
  });

  it('snaps left edge to a neighbour left edge', () => {
    const r = snapPosition({
      moving: bar('a', 0, 0), x: 603, y: 150,
      others: [bar('b', 600, 100)], stageScale: scale, gridEnabled: false,
    });
    expect(r.x).toBe(600);
  });

  it('ignores neighbours beyond 300 cm', () => {
    const r = snapPosition({
      moving: bar('a', 0, 0), x: 503, y: 150,
      others: [bar('b', 500, 5000)], stageScale: scale, gridEnabled: false,
    });
    expect(r.x).toBe(503);
  });

  it('emits a guide on the matched line spanning both objects', () => {
    // A narrow neighbour, so exactly one candidate pair is inside the threshold:
    // the mover's centre-x (502) against the neighbour's centre-x (500).
    const narrow: SceneObject = {
      id: 'b', type: 'bar', x: 500, y: 100, rotation: 0, label: 'b', z: 0, width: 20, height: 40,
    };
    const r = snapPosition({
      moving: bar('a', 0, 0), x: 502, y: 150,
      others: [narrow], stageScale: scale, gridEnabled: false,
    });
    expect(r.x).toBe(500);
    const guide = r.guides.find((g) => g.axis === 'x');
    expect(guide).toBeDefined();
    if (!guide) return;
    expect(guide.at).toBe(500);
    expect(guide.from).toBeLessThanOrEqual(80);   // neighbour top
    expect(guide.to).toBeGreaterThanOrEqual(200); // mover bottom
  });

  it('picks the nearest candidate when several are in range', () => {
    // Both neighbours are genuinely in range. `near`'s centre sits 4 cm from the
    // mover's centre; `far`'s nearest edge sits 6 cm away. Deleting `near` would
    // resolve to 510 instead of 500, so this test really does compare the two.
    const near: SceneObject = {
      id: 'b', type: 'bar', x: 500, y: 100, rotation: 0, label: 'b', z: 0, width: 20, height: 40,
    };
    const far: SceneObject = {
      id: 'c', type: 'bar', x: 520, y: 200, rotation: 0, label: 'c', z: 0, width: 20, height: 40,
    };
    const r = snapPosition({
      moving: bar('a', 0, 0), x: 504, y: 150,
      others: [near, far], stageScale: scale, gridEnabled: false,
    });
    expect(r.x).toBe(500);
  });
});

describe('grid snapping', () => {
  it('rounds to the 25 cm step when enabled and nothing aligned', () => {
    const r = snapPosition({
      moving: bar('a', 0, 0), x: 508, y: 150,
      others: [], stageScale: scale, gridEnabled: true,
    });
    expect(r.x).toBe(500);
    expect(r.y).toBe(150);
  });

  it('defers to alignment snap on an axis that already snapped', () => {
    const r = snapPosition({
      moving: bar('a', 0, 0), x: 512, y: 150,
      others: [bar('b', 510, 100)], stageScale: scale, gridEnabled: true,
    });
    expect(r.x).toBe(510);  // alignment won, not the 500 grid line
    expect(r.y).toBe(150);  // free axis stays at moving position (not grid-snapped away from alignment)
  });

  it('leaves position untouched when disabled and nothing aligns', () => {
    const r = snapPosition({
      moving: bar('a', 0, 0), x: 508, y: 311,
      others: [], stageScale: scale, gridEnabled: false,
    });
    expect(r).toMatchObject({ x: 508, y: 311, guides: [] });
  });
});
