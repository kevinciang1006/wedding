import { describe, expect, it } from 'vitest';
import { getSeats, seatCountOf } from '@/lib/geometry/seats';
import { SEAT_OFFSET } from '@/lib/constants';
import type { SceneObject } from '@/lib/types/doc';

const round = (over: Partial<Extract<SceneObject, { type: 'roundTable' }>> = {}): SceneObject => ({
  id: 't1', type: 'roundTable', x: 0, y: 0, rotation: 0, label: 'table 1', z: 0,
  diameter: 180, seatCount: 10, ...over,
});

describe('roundTable', () => {
  it('returns exactly seatCount seats for every count 1..16', () => {
    for (let n = 1; n <= 16; n += 1) {
      expect(getSeats(round({ seatCount: n }))).toHaveLength(n);
    }
  });

  it('puts seat 0 directly above the centre', () => {
    const [first] = getSeats(round({ seatCount: 8 }));
    expect(first.x).toBeCloseTo(0, 6);
    expect(first.y).toBeCloseTo(-(90 + SEAT_OFFSET), 6);
  });

  it('places every seat at radius + SEAT_OFFSET from the centre', () => {
    const expected = 90 + SEAT_OFFSET;
    for (const seat of getSeats(round({ seatCount: 12 }))) {
      expect(Math.hypot(seat.x, seat.y)).toBeCloseTo(expected, 6);
    }
  });

  it('spaces seats evenly', () => {
    const seats = getSeats(round({ seatCount: 6 }));
    const angles = seats.map((s) => Math.atan2(s.y, s.x));
    const gaps = angles.slice(1).map((a, i) => {
      const d = a - angles[i];
      return d < 0 ? d + Math.PI * 2 : d;
    });
    for (const gap of gaps) expect(gap).toBeCloseTo((Math.PI * 2) / 6, 6);
  });

  it('issues deterministic ids', () => {
    expect(getSeats(round({ seatCount: 3 })).map((s) => s.id)).toEqual(['t1:0', 't1:1', 't1:2']);
  });

  it('translates with the table', () => {
    const [seat] = getSeats(round({ seatCount: 4, x: 500, y: 300 }));
    expect(seat.x).toBeCloseTo(500, 6);
    expect(seat.y).toBeCloseTo(300 - (90 + SEAT_OFFSET), 6);
  });

  it('rotates about the table centre', () => {
    const [seat] = getSeats(round({ seatCount: 4, rotation: 90 }));
    expect(seat.x).toBeCloseTo(90 + SEAT_OFFSET, 6);
    expect(seat.y).toBeCloseTo(0, 6);
  });

  it('rotates about the centre even when translated', () => {
    const [seat] = getSeats(round({ seatCount: 4, rotation: 180, x: 1000, y: 800 }));
    expect(seat.x).toBeCloseTo(1000, 6);
    expect(seat.y).toBeCloseTo(800 + 90 + SEAT_OFFSET, 6);
  });
});

const rect: SceneObject = {
  id: 'r1', type: 'rectTable', x: 0, y: 0, rotation: 0, label: 'banquet', z: 0,
  width: 240, height: 90, seatsPerSide: 4,
};

describe('rectTable', () => {
  it('returns two seats per side', () => {
    expect(getSeats(rect)).toHaveLength(8);
  });

  it('indexes down one side then back along the other', () => {
    const seats = getSeats(rect);
    expect(seats.slice(0, 4).every((s) => s.y < 0)).toBe(true);
    expect(seats.slice(4).every((s) => s.y > 0)).toBe(true);
  });

  it('offsets seats SEAT_OFFSET beyond the long edges', () => {
    const seats = getSeats(rect);
    expect(seats[0].y).toBeCloseTo(-(45 + SEAT_OFFSET), 6);
    expect(seats[4].y).toBeCloseTo(45 + SEAT_OFFSET, 6);
  });

  it('centres seats within equal slots along the edge', () => {
    const seats = getSeats(rect).slice(0, 4);
    expect(seats.map((s) => s.x)).toEqual([-90, -30, 30, 90]);
  });

  it('mirrors the second side so seats face each other', () => {
    const seats = getSeats(rect);
    expect(seats[4].x).toBeCloseTo(90, 6);
    expect(seats[7].x).toBeCloseTo(-90, 6);
  });
});

describe('headTable', () => {
  const head: SceneObject = {
    id: 'h1', type: 'headTable', x: 0, y: 0, rotation: 0, label: 'head table', z: 0,
    width: 480, height: 90, seatCount: 8,
  };

  it('seats everyone on one edge so they face into the room', () => {
    const seats = getSeats(head);
    expect(seats).toHaveLength(8);
    expect(seats.every((s) => s.y < 0)).toBe(true);
  });

  it('spaces them evenly across the full width', () => {
    const xs = getSeats(head).map((s) => s.x);
    expect(xs[0]).toBeCloseTo(-210, 6);
    expect(xs[7]).toBeCloseTo(210, 6);
  });
});

describe('sweetheart', () => {
  it('is always exactly two seats on one edge', () => {
    const sweet: SceneObject = {
      id: 's1', type: 'sweetheart', x: 0, y: 0, rotation: 0, label: 'sweetheart', z: 0,
      width: 150, height: 75,
    };
    const seats = getSeats(sweet);
    expect(seats).toHaveLength(2);
    expect(seats.every((s) => s.y < 0)).toBe(true);
    expect(seats.map((s) => s.x)).toEqual([-37.5, 37.5]);
  });
});

describe('non-tables', () => {
  it('return no seats', () => {
    for (const type of ['danceFloor', 'stage', 'bar', 'buffet', 'rect'] as const) {
      const obj: SceneObject = { id: 'p', type, x: 0, y: 0, rotation: 0, label: type, z: 0, width: 100, height: 100 };
      expect(getSeats(obj)).toEqual([]);
    }
    const label: SceneObject = { id: 'l', type: 'label', x: 0, y: 0, rotation: 0, label: 'hi', z: 0, fontSize: 40 };
    expect(getSeats(label)).toEqual([]);
    expect(seatCountOf(label)).toBe(0);
  });
});

describe('memoisation', () => {
  it('reuses the cached shape when only position changes', () => {
    const a = getSeats(round({ x: 0, y: 0 }));
    const b = getSeats(round({ x: 900, y: 400 }));
    expect(b[0].x - a[0].x).toBeCloseTo(900, 6);
    expect(b).toHaveLength(a.length);
  });
});
