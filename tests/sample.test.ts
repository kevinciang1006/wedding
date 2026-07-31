import { describe, expect, it } from 'vitest';
import { createSampleWedding } from '@/lib/sample/sampleWedding';
import { seatingCounts } from '@/lib/doc/derive';
import { seatCountOf } from '@/lib/geometry/seats';
import { getBounds } from '@/lib/geometry/bounds';

describe('sample wedding', () => {
  const doc = createSampleWedding();

  it('is a 22 x 14 m room', () => {
    expect(doc.room).toEqual({ width: 2200, height: 1400 });
  });

  it('has 120 guests across six named groups', () => {
    expect(doc.guestOrder).toHaveLength(120);
    const groups = new Set(doc.guestOrder.map((id) => doc.guests[id]?.group));
    expect(groups.size).toBe(6);
  });

  it('has twelve round tables of ten, a head table, a sweetheart, and four props', () => {
    const types = doc.objectOrder.map((id) => doc.objects[id]?.type);
    expect(types.filter((t) => t === 'roundTable')).toHaveLength(12);
    expect(types.filter((t) => t === 'headTable')).toHaveLength(1);
    expect(types.filter((t) => t === 'sweetheart')).toHaveLength(1);
    expect(types.filter((t) => t === 'danceFloor')).toHaveLength(1);
  });

  it('seats about 80 per cent of the guests', () => {
    const { seated, total } = seatingCounts(doc);
    expect(seated / total).toBeGreaterThan(0.75);
    expect(seated / total).toBeLessThan(0.85);
  });

  it('never seats a guest twice or double-books a seat', () => {
    const seats = Object.keys(doc.seatAssignments);
    const guests = Object.values(doc.seatAssignments);
    expect(new Set(seats).size).toBe(seats.length);
    expect(new Set(guests).size).toBe(guests.length);
  });

  it('assigns only seat ids that actually exist', () => {
    for (const seatId of Object.keys(doc.seatAssignments)) {
      const tableId = seatId.slice(0, seatId.lastIndexOf(':'));
      const index = Number(seatId.slice(seatId.lastIndexOf(':') + 1));
      const table = doc.objects[tableId];
      expect(table).toBeDefined();
      if (table) expect(index).toBeLessThan(seatCountOf(table));
    }
  });

  it('fits every object inside the room', () => {
    for (const id of doc.objectOrder) {
      const obj = doc.objects[id];
      if (!obj) continue;
      const b = getBounds(obj);
      expect(b.left).toBeGreaterThanOrEqual(0);
      expect(b.top).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(2200);
      expect(b.bottom).toBeLessThanOrEqual(1400);
    }
  });

  it('scatters dietary flags without flagging everyone', () => {
    const flagged = doc.guestOrder.filter((id) => doc.guests[id]?.dietary !== null);
    expect(flagged.length).toBeGreaterThan(5);
    expect(flagged.length).toBeLessThan(25);
  });
});
