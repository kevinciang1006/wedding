import { describe, expect, it } from 'vitest';
import { assignSeat, seatOfGuest, unseatGuest } from '@/lib/doc/assignments';

type Map_ = Record<string, string>;

function invariants(map: Map_): void {
  const seats = Object.keys(map);
  expect(new Set(seats).size).toBe(seats.length);           // no seat twice
  const guests = Object.values(map);
  expect(new Set(guests).size).toBe(guests.length);         // no guest twice
}

describe('assignSeat', () => {
  it('seats a guest in an empty seat', () => {
    const map = assignSeat({}, 't1:0', 'g1');
    expect(map).toEqual({ 't1:0': 'g1' });
    invariants(map);
  });

  it('moves a guest rather than duplicating them', () => {
    let map: Map_ = assignSeat({}, 't1:0', 'g1');
    map = assignSeat(map, 't2:3', 'g1');
    expect(map).toEqual({ 't2:3': 'g1' });
    invariants(map);
  });

  it('swaps when the destination is occupied', () => {
    let map: Map_ = assignSeat({}, 't1:0', 'g1');
    map = assignSeat(map, 't2:3', 'g2');
    map = assignSeat(map, 't2:3', 'g1');
    expect(map).toEqual({ 't1:0': 'g2', 't2:3': 'g1' });
    invariants(map);
  });

  it('displaces the sitting guest when the mover was unseated', () => {
    let map: Map_ = assignSeat({}, 't1:0', 'g1');
    map = assignSeat(map, 't1:0', 'g2');
    expect(map).toEqual({ 't1:0': 'g2' });
    expect(seatOfGuest(map, 'g1')).toBeNull();
    invariants(map);
  });

  it('is a no-op when the guest is already in that seat', () => {
    const map = assignSeat(assignSeat({}, 't1:0', 'g1'), 't1:0', 'g1');
    expect(map).toEqual({ 't1:0': 'g1' });
  });
});

describe('unseatGuest', () => {
  it('removes the guest wherever they were', () => {
    const map = unseatGuest(assignSeat({}, 't4:2', 'g9'), 'g9');
    expect(map).toEqual({});
  });

  it('is a no-op for an unseated guest', () => {
    const map = assignSeat({}, 't1:0', 'g1');
    expect(unseatGuest(map, 'g2')).toEqual(map);
  });
});

describe('randomised sequence', () => {
  it('holds both invariants across 2000 mixed operations', () => {
    const seats = Array.from({ length: 40 }, (_, i) => `t${Math.floor(i / 8)}:${i % 8}`);
    const guests = Array.from({ length: 25 }, (_, i) => `g${i}`);
    let map: Map_ = {};
    let seed = 12345;
    const rand = (n: number): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };

    for (let i = 0; i < 2000; i += 1) {
      if (rand(4) === 0) {
        map = unseatGuest(map, guests[rand(guests.length)]);
      } else {
        map = assignSeat(map, seats[rand(seats.length)], guests[rand(guests.length)]);
      }
      invariants(map);
      expect(Object.keys(map).length).toBeLessThanOrEqual(guests.length);
    }
  });
});
