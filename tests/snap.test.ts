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

const scale = 1; // 8 screen px === 8 cm at scale 1

describe('alignment snapping', () => {
  it('snaps centre-x to a neighbour just inside the threshold', () => {
    const r = snapPosition({
      moving: bar('a', 0, 0), x: 507, y: 399,
      others: [bar('b', 500, 100)], stageScale: scale, gridEnabled: false,
    });
    expect(r.x).toBe(500);
    expect(r.snappedX).toBe(true);
  });

  it('does not snap just outside the threshold', () => {
    const r = snapPosition({
      moving: bar('a', 0, 0), x: 509, y: 399,
      others: [bar('b', 500, 100)], stageScale: scale, gridEnabled: false,
    });
    expect(r.x).toBe(509);
    expect(r.snappedX).toBe(false);
  });

  it('scales the threshold down as the stage zooms in', () => {
    const r = snapPosition({
      moving: bar('a', 0, 0), x: 505, y: 400,
      others: [bar('b', 500, 100)], stageScale: 4, gridEnabled: false,
    });
    // threshold is 8/4 = 2 cm, so 5 cm away must not snap
    expect(r.x).toBe(505);
  });

  it('snaps left edge to a neighbour left edge', () => {
    const r = snapPosition({
      moving: bar('a', 0, 0), x: 603, y: 250,
      others: [bar('b', 600, 100)], stageScale: scale, gridEnabled: false,
    });
    expect(r.x).toBe(600);
  });

  it('ignores neighbours beyond 300 cm', () => {
    const r = snapPosition({
      moving: bar('a', 0, 0), x: 503, y: 5000,
      others: [bar('b', 500, 100)], stageScale: scale, gridEnabled: false,
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
      moving: bar('a', 0, 0), x: 502, y: 399,
      others: [narrow], stageScale: scale, gridEnabled: false,
    });
    expect(r.x).toBe(500);
    const guide = r.guides.find((g) => g.axis === 'x');
    expect(guide).toBeDefined();
    if (!guide) return;
    expect(guide.at).toBe(500);
    expect(guide.from).toBeLessThanOrEqual(80);   // neighbour top
    expect(guide.to).toBeGreaterThanOrEqual(449); // mover bottom
  });

  it('picks the nearest candidate when several are in range', () => {
    // Two narrow neighbours: centres at 500 (4 cm away) and 508 (4 cm away on the
    // other side). Widen the far one to 60 cm so its nearest edge sits 6 cm off,
    // leaving the 500 centre match unambiguously nearest.
    const near: SceneObject = {
      id: 'b', type: 'bar', x: 500, y: 100, rotation: 0, label: 'b', z: 0, width: 20, height: 40,
    };
    const far: SceneObject = {
      id: 'c', type: 'bar', x: 510, y: 200, rotation: 0, label: 'c', z: 0, width: 20, height: 40,
    };
    const r = snapPosition({
      moving: bar('a', 0, 0), x: 504, y: 400,
      others: [near, far], stageScale: scale, gridEnabled: false,
    });
    // 500 is 4 cm from the mover's centre; 510 is 6 cm. Nearest wins.
    expect(r.x).toBe(500);
  });
});

describe('grid snapping', () => {
  it('rounds to the 25 cm step when enabled and nothing aligned', () => {
    const r = snapPosition({
      moving: bar('a', 0, 0), x: 508, y: 311,
      others: [], stageScale: scale, gridEnabled: true,
    });
    expect(r.x).toBe(500);
    expect(r.y).toBe(300);
  });

  it('defers to alignment snap on an axis that already snapped', () => {
    const r = snapPosition({
      moving: bar('a', 0, 0), x: 512, y: 311,
      others: [bar('b', 510, 100)], stageScale: scale, gridEnabled: true,
    });
    expect(r.x).toBe(510);  // alignment won, not the 500 grid line
    expect(r.y).toBe(300);  // free axis still grid-snapped
  });

  it('leaves position untouched when disabled and nothing aligns', () => {
    const r = snapPosition({
      moving: bar('a', 0, 0), x: 508, y: 311,
      others: [], stageScale: scale, gridEnabled: false,
    });
    expect(r).toMatchObject({ x: 508, y: 311, guides: [] });
  });
});
