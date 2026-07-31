import { describe, expect, it } from 'vitest';
import { findGuestsByName, lookupSeat } from '@/lib/doc/lookup';
import { createEmptyDoc } from '@/stores/docStore';
import type { Doc, Guest, SceneObject } from '@/lib/types/doc';

function guest(id: string, name: string): Guest {
  return { id, name, group: null, dietary: null, rsvp: 'yes', plusOneOf: null };
}

const table: SceneObject = {
  id: 't1', type: 'roundTable', x: 500, y: 500, rotation: 0, label: 'Table 9', z: 0,
  diameter: 180, seatCount: 10,
};

/** Four guests, three of them seated at `t1` (seats 0, 3 and 4). */
function docWithSeating(): Doc {
  return {
    ...createEmptyDoc(),
    objects: { t1: table },
    objectOrder: ['t1'],
    guestOrder: ['g1', 'g2', 'g3', 'g4'],
    guests: {
      g1: guest('g1', 'Ana Marín'),
      g2: guest('g2', 'Julio Marín'),
      g3: guest('g3', 'Chidi Okonkwo'),
      g4: guest('g4', 'Rosa Iglesias'),
    },
    // Deliberately out of seat order in the map: the lookup must report
    // tablemates in SEAT order, not in whatever order the object happens
    // to enumerate its keys.
    seatAssignments: { 't1:4': 'g3', 't1:0': 'g2', 't1:3': 'g1' },
  };
}

describe('findGuestsByName', () => {
  it('returns nothing for an empty or whitespace-only query', () => {
    const doc = docWithSeating();
    expect(findGuestsByName(doc, '')).toEqual([]);
    expect(findGuestsByName(doc, '   ')).toEqual([]);
  });

  it('matches a case-insensitive substring of the name', () => {
    const found = findGuestsByName(docWithSeating(), 'OKONK');
    expect(found.map((g) => g.id)).toEqual(['g3']);
  });

  it('matches regardless of diacritics, in either direction', () => {
    // A guest typing their own name on a phone keyboard rarely reaches for
    // the accent, and a plan imported from a spreadsheet may have dropped it.
    const doc = docWithSeating();
    expect(findGuestsByName(doc, 'marin').map((g) => g.id)).toEqual(['g1', 'g2']);
    expect(findGuestsByName(doc, 'Marín').map((g) => g.id)).toEqual(['g1', 'g2']);
  });

  it('returns every guest sharing a name, in guestOrder, as separate matches', () => {
    const doc = docWithSeating();
    doc.guests.g4 = guest('g4', 'Ana Marín');
    const found = findGuestsByName(doc, 'ana marín');
    expect(found.map((g) => g.id)).toEqual(['g1', 'g4']);
  });
});

describe('lookupSeat', () => {
  it('returns null for a guest who has no seat', () => {
    expect(lookupSeat(docWithSeating(), 'g4')).toBeNull();
  });

  it('returns null for a guest who does not exist', () => {
    expect(lookupSeat(docWithSeating(), 'nobody')).toBeNull();
  });

  it('reports the table, a 1-based seat number, and the tablemates in seat order', () => {
    const found = lookupSeat(docWithSeating(), 'g1');
    expect(found).not.toBeNull();
    expect(found?.tableId).toBe('t1');
    expect(found?.tableLabel).toBe('Table 9');
    // 't1:3' is seat index 3; guests count seats from 1, matching the PDF.
    expect(found?.seatNumber).toBe(4);
    // g2 sits at seat 0, g3 at seat 4 — seat order, and never the guest themself.
    expect(found?.tablemates.map((g) => g.id)).toEqual(['g2', 'g3']);
  });

  it('returns null when the seat points at a table that no longer exists', () => {
    const doc = docWithSeating();
    doc.objects = {};
    doc.objectOrder = [];
    expect(lookupSeat(doc, 'g1')).toBeNull();
  });
});
