import { createObject } from '@/lib/doc/factory';
import { getSeats } from '@/lib/geometry/seats';
import type { Doc, Guest, Rsvp, SceneObject } from '@/lib/types/doc';

// Room: 22 x 14 m, matching the design brief exactly.
const ROOM_WIDTH = 2200;
const ROOM_HEIGHT = 1400;

// Twelve round tables in a 4 (columns) x 3 (rows) grid, two columns either
// side of a central aisle that holds the sweetheart table, dance floor and
// stage. Every value below was hand-checked against `getBounds` (which pads
// a round table's AABB by SEAT_OFFSET + SEAT_RADIUS = 55cm beyond its rim,
// giving a 180cm table a 145cm half-extent) so every seat ring clears both
// the room's walls and its neighbours — see the Task 16 report for the
// worked arithmetic.
const COLUMN_X = [330, 650, 1550, 1870];
const ROW_Y = [400, 700, 1000];

/** A copy of `obj` with its default factory label replaced by a more specific one — every sample object gets a name a planner would actually type, not a repeated generic noun. */
function withLabel(obj: SceneObject, label: string): SceneObject {
  return { ...obj, label };
}

// Name pools: Spanish (the Marín side) and Igbo (the Okonkwo side), mirroring
// the design's "Marín · Okonkwo" wedding. The two family groups lean on
// their own surname; the mixed friend/colleague groups draw from both pools,
// the way a real combined guest list does.
const SPANISH_FIRST = [
  'Sofía', 'Mateo', 'Valentina', 'Diego', 'Lucía', 'Javier', 'Camila', 'Alejandro', 'Elena', 'Pablo',
  'Isabella', 'Andrés', 'Carmen', 'Rodrigo', 'Marta', 'Iván', 'Beatriz', 'Emilio', 'Rosa', 'Fernando',
  'Adriana', 'Tomás', 'Paula', 'Nicolás', 'Victoria',
];
const SPANISH_LAST = [
  'Marín', 'García', 'López', 'Fernández', 'Ruiz', 'Torres', 'Navarro', 'Delgado', 'Cabrera', 'Vega',
  'Molina', 'Ortega', 'Reyes', 'Campos', 'Herrera',
];
const IGBO_FIRST = [
  'Chidinma', 'Emeka', 'Ngozi', 'Obinna', 'Adaeze', 'Chibueze', 'Amara', 'Kelechi', 'Chinonso', 'Ifeoma',
  'Uche', 'Nkechi', 'Chukwuemeka', 'Adanna', 'Ebuka', 'Chiamaka', 'Ikenna', 'Ogechi', 'Nnamdi', 'Chinwe',
  'Obiora', 'Nneka', 'Chiedozie', 'Amaka', 'Ekene',
];
const IGBO_LAST = [
  'Okonkwo', 'Nwachukwu', 'Okafor', 'Eze', 'Nwosu', 'Chukwuma', 'Obiora', 'Okoro', 'Uzoigwe', 'Madu',
  'Onyeka', 'Ibeh', 'Anyanwu', 'Okeke', 'Adiele',
];

/** A Spanish "First Last" pair, striding through the surname pool on a different step than `igboName` so the two pools don't fall into a matching rhythm. */
function spanishName(i: number): string {
  return `${SPANISH_FIRST[i % SPANISH_FIRST.length]} ${SPANISH_LAST[(i * 7 + 3) % SPANISH_LAST.length]}`;
}

function igboName(i: number): string {
  return `${IGBO_FIRST[i % IGBO_FIRST.length]} ${IGBO_LAST[(i * 5 + 2) % IGBO_LAST.length]}`;
}

/**
 * A family block's name: two guests in three carry the family surname
 * itself, the third carries a different surname from the same cultural
 * pool — a twenty-person "family" reads as one household plus in-laws and
 * cousins, not twenty siblings.
 */
function familyName(firstPool: string[], surname: string, altLast: string[], i: number): string {
  const first = firstPool[i % firstPool.length];
  if (i % 3 === 2) return `${first} ${altLast[(i * 3 + 1) % altLast.length]}`;
  return `${first} ${surname}`;
}

const DIETARY_CODES = ['GF', 'VG', 'DF', 'NUT'] as const;

/**
 * Every 11th guest (by global list position) carries a dietary code,
 * cycling through the four codes — 11 of 120 guests flagged, deterministic
 * and stable across runs (no `Math.random`).
 */
function dietaryFor(globalIndex: number): string | null {
  if (globalIndex % 11 !== 0) return null;
  return DIETARY_CODES[(globalIndex / 11) % DIETARY_CODES.length];
}

/**
 * RSVP by global list position, matching exactly how seating is filled
 * below: the first 96 guests (80%) are seated and confirmed; of the
 * remainder, the last four "Work — Chidi" colleagues have declined and the
 * twenty "Plus ones" are still pending — nobody who declined is ever seated.
 */
function rsvpFor(globalIndex: number): Rsvp {
  if (globalIndex < 96) return 'yes';
  if (globalIndex < 100) return 'no';
  return 'pending';
}

interface GroupSpec { key: string; count: number; namer: (indexInGroup: number) => string }

const GROUPS: GroupSpec[] = [
  { key: 'Family — Marín', count: 20, namer: (i) => familyName(SPANISH_FIRST, 'Marín', SPANISH_LAST, i) },
  { key: 'Family — Okonkwo', count: 20, namer: (i) => familyName(IGBO_FIRST, 'Okonkwo', IGBO_LAST, i) },
  { key: 'College friends', count: 24, namer: (i) => (i % 2 === 0 ? spanishName(i + 1) : igboName(i + 1)) },
  { key: 'Work — Ana', count: 18, namer: (i) => (i % 2 === 0 ? spanishName(i + 2) : igboName(i + 2)) },
  { key: 'Work — Chidi', count: 18, namer: (i) => (i % 2 === 0 ? igboName(i + 3) : spanishName(i + 3)) },
  { key: 'Plus ones', count: 20, namer: (i) => (i % 2 === 0 ? spanishName(i + 4) : igboName(i + 4)) },
];

/** All 120 guests, in the fixed group order above — the same order seating (below) walks, so "seated" is always a guest-order prefix. */
function buildGuests(): Guest[] {
  const guests: Guest[] = [];
  let globalIndex = 0;
  for (const group of GROUPS) {
    for (let i = 0; i < group.count; i += 1) {
      guests.push({
        id: `sample-guest-${globalIndex}`,
        name: group.namer(i),
        group: group.key,
        dietary: dietaryFor(globalIndex),
        rsvp: rsvpFor(globalIndex),
        plusOneOf: null,
      });
      globalIndex += 1;
    }
  }
  return guests;
}

/**
 * A deterministic 120-guest sample wedding — Ana Marín and Chidi Okonkwo's
 * reception — filling a 22 x 14 m room: twelve round tables of ten flanking
 * a central aisle (sweetheart table, dance floor, stage), a head table, and
 * a bar and buffet up front. No `Math.random` anywhere: every name, dietary
 * flag, RSVP and seat comes from the guest's fixed position in `GROUPS`, so
 * this produces the exact same document on every call.
 */
export function createSampleWedding(): Doc {
  const objects: Record<string, SceneObject> = {};
  const objectOrder: string[] = [];

  function place(obj: SceneObject): SceneObject {
    objects[obj.id] = obj;
    objectOrder.push(obj.id);
    return obj;
  }

  const headTable = place(withLabel(createObject('headTable', { x: 1100, y: 120 }), 'Head table'));
  place(withLabel(createObject('sweetheart', { x: 1100, y: 330 }), 'Sweetheart table'));

  const roundTables: SceneObject[] = [];
  let tableNumber = 0;
  for (const y of ROW_Y) {
    for (const x of COLUMN_X) {
      tableNumber += 1;
      roundTables.push(place(withLabel(createObject('roundTable', { x, y }), `Table ${tableNumber}`)));
    }
  }

  place(withLabel(createObject('danceFloor', { x: 1100, y: 700 }), 'Dance floor'));
  place(withLabel(createObject('stage', { x: 1100, y: 1270 }), 'Stage'));
  place(withLabel(createObject('bar', { x: 200, y: 120 }), 'Bar'));
  place(withLabel(createObject('buffet', { x: 2000, y: 120 }), 'Buffet'));

  const guestList = buildGuests();
  const guests: Record<string, Guest> = {};
  const guestOrder: string[] = [];
  for (const guest of guestList) {
    guests[guest.id] = guest;
    guestOrder.push(guest.id);
  }

  // Seat the head table, then the twelve round tables in creation order,
  // filling every seat front-to-back until the 96-guest (80%) quota is
  // reached — tables fill up completely before the next one starts, so the
  // result reads as "still finishing the last couple of tables," not a
  // uniform half-empty room. The sweetheart table's two seats stay open:
  // they're for the couple, who are hosts here, not among the 120 guests.
  const seatSlots = [...getSeats(headTable), ...roundTables.flatMap((table) => getSeats(table))];
  const SEATED_COUNT = 96;
  const seatAssignments: Record<string, string> = {};
  for (let i = 0; i < SEATED_COUNT; i += 1) {
    seatAssignments[seatSlots[i].id] = guestOrder[i];
  }

  return {
    version: 1,
    title: 'Ana & Chidi',
    eventDate: '2026-10-17',
    room: { width: ROOM_WIDTH, height: ROOM_HEIGHT },
    units: 'm',
    objects,
    objectOrder,
    guests,
    guestOrder,
    seatAssignments,
  };
}
