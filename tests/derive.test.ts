import { describe, expect, it, beforeEach } from 'vitest';
import { tableFill, seatingCounts, freeSeatCount } from '@/lib/doc/derive';
import { tableIdOfSeat, seatIndexOfSeat } from '@/lib/doc/assignments';
import { createEmptyDoc, useDocStore } from '@/stores/docStore';
import type { Doc, Guest } from '@/lib/types/doc';

describe('seatingCounts', () => {
  it('counts a guest both seated and declined only once (not double-subtracted)', () => {
    // Three guests: A seated+declined, B seated, C unseated+pending
    const doc: Doc = {
      ...createEmptyDoc(),
      guestOrder: ['a', 'b', 'c'],
      guests: {
        a: { id: 'a', name: 'A', rsvp: 'no', group: 'g1' } as Guest,
        b: { id: 'b', name: 'B', rsvp: 'yes', group: 'g1' } as Guest,
        c: { id: 'c', name: 'C', rsvp: 'pending', group: 'g1' } as Guest,
      },
      seatAssignments: { 't1:0': 'a', 't1:1': 'b' },
    };
    const counts = seatingCounts(doc);
    expect(counts).toEqual({ total: 3, seated: 2, unseated: 1 });
  });

  it('counts all guests unseated and pending', () => {
    const doc: Doc = {
      ...createEmptyDoc(),
      guestOrder: ['a', 'b', 'c'],
      guests: {
        a: { id: 'a', name: 'A', rsvp: 'pending', group: 'g1' } as Guest,
        b: { id: 'b', name: 'B', rsvp: 'pending', group: 'g1' } as Guest,
        c: { id: 'c', name: 'C', rsvp: 'pending', group: 'g1' } as Guest,
      },
      seatAssignments: {},
    };
    const counts = seatingCounts(doc);
    expect(counts).toEqual({ total: 3, seated: 0, unseated: 3 });
  });

  it('counts unseated as zero when every guest is declined', () => {
    const doc: Doc = {
      ...createEmptyDoc(),
      guestOrder: ['a', 'b'],
      guests: {
        a: { id: 'a', name: 'A', rsvp: 'no', group: 'g1' } as Guest,
        b: { id: 'b', name: 'B', rsvp: 'no', group: 'g1' } as Guest,
      },
      seatAssignments: {},
    };
    const counts = seatingCounts(doc);
    expect(counts).toEqual({ total: 2, seated: 0, unseated: 0 });
  });

  it('never returns negative unseated', () => {
    // Pathological: all guests seated and all declined
    const doc: Doc = {
      ...createEmptyDoc(),
      guestOrder: ['a', 'b'],
      guests: {
        a: { id: 'a', name: 'A', rsvp: 'no', group: 'g1' } as Guest,
        b: { id: 'b', name: 'B', rsvp: 'no', group: 'g1' } as Guest,
      },
      seatAssignments: { 't1:0': 'a', 't1:1': 'b' },
    };
    const counts = seatingCounts(doc);
    expect(counts).toEqual({ total: 2, seated: 2, unseated: 0 });
    expect(counts.unseated).toBeGreaterThanOrEqual(0);
  });
});

describe('tableFill', () => {
  it('counts seated and total for a round table with 10 seats and 3 filled', () => {
    const doc: Doc = {
      ...createEmptyDoc(),
      objects: {
        t1: {
          id: 't1',
          type: 'roundTable',
          x: 100,
          y: 100,
          rotation: 0,
          diameter: 150,
          seatCount: 10,
          label: 'Table 1',
          z: 0,
        },
      },
      objectOrder: ['t1'],
      seatAssignments: { 't1:0': 'g1', 't1:2': 'g2', 't1:5': 'g3' },
    };
    const fill = tableFill(doc, 't1');
    expect(fill).toEqual({ seated: 3, total: 10 });
  });

  it('returns zero-zero for a table id that does not exist', () => {
    const doc = createEmptyDoc();
    const fill = tableFill(doc, 'nonexistent');
    expect(fill).toEqual({ seated: 0, total: 0 });
  });
});

describe('freeSeatCount', () => {
  it('counts free seats across all tables', () => {
    const doc: Doc = {
      ...createEmptyDoc(),
      objects: {
        t1: {
          id: 't1',
          type: 'roundTable',
          x: 100,
          y: 100,
          rotation: 0,
          diameter: 150,
          seatCount: 8,
          label: 'Table 1',
          z: 0,
        },
        t2: {
          id: 't2',
          type: 'roundTable',
          x: 300,
          y: 100,
          rotation: 0,
          diameter: 150,
          seatCount: 10,
          label: 'Table 2',
          z: 0,
        },
      },
      objectOrder: ['t1', 't2'],
      seatAssignments: { 't1:0': 'g1', 't1:2': 'g2', 't1:5': 'g3', 't2:1': 'g4', 't2:3': 'g5' },
    };
    // Total seats: 8 + 10 = 18
    // Assignments: 5
    // Free: 13
    const free = freeSeatCount(doc);
    expect(free).toBe(13);
  });
});

describe('Store actions with undo/redo', () => {
  beforeEach(() => {
    useDocStore.getState().replaceDoc(createEmptyDoc());
  });

  it('seatGuest and unseat are undoable', () => {
    const initial = { ...useDocStore.getState().seatAssignments };

    useDocStore.getState().seatGuest('t1:0', 'g1');
    const afterSeat = { ...useDocStore.getState().seatAssignments };
    expect(afterSeat).toEqual({ 't1:0': 'g1' });

    useDocStore.getState().unseat('g1');
    const afterUnseat = { ...useDocStore.getState().seatAssignments };
    expect(afterUnseat).toEqual({});

    useDocStore.getState().undo();
    expect(useDocStore.getState().seatAssignments).toEqual(afterSeat);

    useDocStore.getState().undo();
    expect(useDocStore.getState().seatAssignments).toEqual(initial);
  });
});

describe('seatGroupAt', () => {
  beforeEach(() => {
    useDocStore.getState().replaceDoc(createEmptyDoc());
  });

  it('fills only empty seats and does not displace pre-seated guests', () => {
    const doc: Doc = {
      ...createEmptyDoc(),
      objects: {
        t1: {
          id: 't1',
          type: 'roundTable',
          x: 100,
          y: 100,
          rotation: 0,
          diameter: 150,
          seatCount: 4,
          label: 'Table 1',
          z: 0,
        },
      },
      objectOrder: ['t1'],
      guestOrder: ['g1', 'g2', 'g3', 'g4'],
      guests: {
        g1: { id: 'g1', name: 'G1', rsvp: 'yes', group: 'grpA' } as Guest,
        g2: { id: 'g2', name: 'G2', rsvp: 'yes', group: 'grpA' } as Guest,
        g3: { id: 'g3', name: 'G3', rsvp: 'yes', group: 'grpA' } as Guest,
        g4: { id: 'g4', name: 'G4', rsvp: 'yes', group: 'grpA' } as Guest,
      },
      seatAssignments: { 't1:0': 'g1' }, // g1 already seated
    };
    useDocStore.getState().replaceDoc(doc);
    useDocStore.getState().seatGroupAt('t1', 'grpA');

    const assignments = useDocStore.getState().seatAssignments;
    // g1 should still be at t1:0, g2/g3/g4 fill t1:1, t1:2, t1:3
    expect(assignments['t1:0']).toBe('g1');
    expect(Object.keys(assignments).length).toBe(4);
  });

  it('skips declined guests entirely', () => {
    const doc: Doc = {
      ...createEmptyDoc(),
      objects: {
        t1: {
          id: 't1',
          type: 'roundTable',
          x: 100,
          y: 100,
          rotation: 0,
          diameter: 150,
          seatCount: 3,
          label: 'Table 1',
          z: 0,
        },
      },
      objectOrder: ['t1'],
      guestOrder: ['g1', 'g2', 'g3'],
      guests: {
        g1: { id: 'g1', name: 'G1', rsvp: 'yes', group: 'grpA' } as Guest,
        g2: { id: 'g2', name: 'G2', rsvp: 'no', group: 'grpA' } as Guest,
        g3: { id: 'g3', name: 'G3', rsvp: 'yes', group: 'grpA' } as Guest,
      },
      seatAssignments: {},
    };
    useDocStore.getState().replaceDoc(doc);
    useDocStore.getState().seatGroupAt('t1', 'grpA');

    const assignments = useDocStore.getState().seatAssignments;
    // Only g1 and g3 should be seated (g2 is declined)
    expect(Object.keys(assignments).length).toBe(2);
    // g2 should not appear anywhere (declined)
    const values = Object.values(assignments);
    expect(values).not.toContain('g2');
    expect(values).toContain('g1');
    expect(values).toContain('g3');
  });

  it('stops cleanly when the group is larger than free seats', () => {
    const doc: Doc = {
      ...createEmptyDoc(),
      objects: {
        t1: {
          id: 't1',
          type: 'roundTable',
          x: 100,
          y: 100,
          rotation: 0,
          diameter: 150,
          seatCount: 2,
          label: 'Table 1',
          z: 0,
        },
      },
      objectOrder: ['t1'],
      guestOrder: ['g1', 'g2', 'g3', 'g4'],
      guests: {
        g1: { id: 'g1', name: 'G1', rsvp: 'yes', group: 'grpA' } as Guest,
        g2: { id: 'g2', name: 'G2', rsvp: 'yes', group: 'grpA' } as Guest,
        g3: { id: 'g3', name: 'G3', rsvp: 'yes', group: 'grpA' } as Guest,
        g4: { id: 'g4', name: 'G4', rsvp: 'yes', group: 'grpA' } as Guest,
      },
      seatAssignments: {},
    };
    useDocStore.getState().replaceDoc(doc);

    // Call seatGroupAt should not throw, even though 4 guests > 2 seats
    useDocStore.getState().seatGroupAt('t1', 'grpA');

    const assignments = useDocStore.getState().seatAssignments;
    // Only 2 guests should be seated (table capacity)
    expect(Object.keys(assignments).length).toBe(2);
  });
});

describe('Parsing seat IDs with colons in table names', () => {
  it('parses a seat id with a colon in the table name', () => {
    const seatId = 'table:with:colon:3';
    expect(tableIdOfSeat(seatId)).toBe('table:with:colon');
    expect(seatIndexOfSeat(seatId)).toBe(3);
  });
});
