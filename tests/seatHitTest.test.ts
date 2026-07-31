import { describe, expect, it } from 'vitest';
import { flattenSeatPoints, nearestSeatWithin } from '@/lib/geometry/seatHitTest';
import { createObject } from '@/lib/doc/factory';
import type { SceneObject } from '@/lib/types/doc';

describe('flattenSeatPoints', () => {
  it('collects every seat of every table, skipping props and labels', () => {
    const table = createObject('roundTable', { x: 0, y: 0 });
    const prop = createObject('danceFloor', { x: 500, y: 500 });
    const objects: Record<string, SceneObject> = { [table.id]: table, [prop.id]: prop };
    const points = flattenSeatPoints(objects, [table.id, prop.id]);
    expect(points).toHaveLength(table.type === 'roundTable' ? table.seatCount : 0);
    expect(points.every((p) => p.id.startsWith(table.id))).toBe(true);
  });

  it('skips a dangling id no longer present in objects', () => {
    const table = createObject('roundTable', { x: 0, y: 0 });
    const objects: Record<string, SceneObject> = { [table.id]: table };
    const points = flattenSeatPoints(objects, [table.id, 'gone']);
    expect(points).toHaveLength(table.type === 'roundTable' ? table.seatCount : 0);
  });
});

describe('nearestSeatWithin', () => {
  const seats = [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: 100, y: 0 },
    { id: 'c', x: 100, y: 100 },
  ];

  it('returns the closest seat inside range', () => {
    expect(nearestSeatWithin(seats, { x: 5, y: 0 }, 40)).toBe('a');
    expect(nearestSeatWithin(seats, { x: 95, y: 5 }, 40)).toBe('b');
  });

  it('returns null when nothing is within range', () => {
    expect(nearestSeatWithin(seats, { x: 50, y: 50 }, 40)).toBeNull();
  });

  it('picks the nearer of two seats both inside range', () => {
    const close = [{ id: 'near', x: 10, y: 0 }, { id: 'far', x: 30, y: 0 }];
    expect(nearestSeatWithin(close, { x: 0, y: 0 }, 40)).toBe('near');
  });

  it('treats an exact-range distance as still in range (inclusive boundary)', () => {
    expect(nearestSeatWithin([{ id: 'edge', x: 40, y: 0 }], { x: 0, y: 0 }, 40)).toBe('edge');
  });

  it('returns null for an empty seat list', () => {
    expect(nearestSeatWithin([], { x: 0, y: 0 }, 40)).toBeNull();
  });
});
