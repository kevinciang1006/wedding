import { describe, expect, it } from 'vitest';
import { createObject } from '@/lib/doc/factory';
import { isTable } from '@/lib/types/doc';

describe('createObject', () => {
  it('gives a round table a real-world default: 180 cm, 10 seats', () => {
    const obj = createObject('roundTable', { x: 0, y: 0 });
    if (obj.type !== 'roundTable') throw new Error('wrong type');
    expect(obj.diameter).toBe(180);
    expect(obj.seatCount).toBe(10);
  });

  it('gives a sweetheart table exactly the two-seat footprint', () => {
    const obj = createObject('sweetheart', { x: 0, y: 0 });
    if (obj.type !== 'sweetheart') throw new Error('wrong type');
    expect(obj.width).toBe(150);
    expect(obj.height).toBe(75);
  });

  it('places the object at the requested centre with zero rotation', () => {
    const obj = createObject('bar', { x: 500, y: 250 });
    expect(obj.x).toBe(500);
    expect(obj.y).toBe(250);
    expect(obj.rotation).toBe(0);
  });

  it('produces unique ids', () => {
    const ids = new Set(Array.from({ length: 200 }, () => createObject('rect', { x: 0, y: 0 }).id));
    expect(ids.size).toBe(200);
  });

  it('marks exactly the four table types as tables', () => {
    const types = ['roundTable', 'rectTable', 'sweetheart', 'headTable', 'bar', 'label'] as const;
    const flags = types.map((t) => isTable(createObject(t, { x: 0, y: 0 })));
    expect(flags).toEqual([true, true, true, true, false, false]);
  });
});
