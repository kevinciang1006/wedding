import { seatIndexOfSeat, seatOfGuest, tableIdOfSeat } from '@/lib/doc/assignments';
import { getSeats } from '@/lib/geometry/seats';
import type { Doc, Guest } from '@/lib/types/doc';

/**
 * The two reads the mobile viewer makes, as pure functions over the parts of
 * the document they actually touch (`Pick`, not the whole `Doc` — these are
 * also called with the four narrow store slices the viewer subscribes to,
 * never with a reconstructed document).
 */
export type GuestIndex = Pick<Doc, 'guests' | 'guestOrder'>;
export type SeatIndex = Pick<Doc, 'guests' | 'objects' | 'seatAssignments'>;

export interface SeatLookup {
  tableId: string;
  tableLabel: string;
  /** 1-based, matching the PDF export's own seat numbering (`lib/io/pdf.ts`). */
  seatNumber: number;
  /** Everyone else seated at the same table, in seat-index order. */
  tablemates: Guest[];
}

/**
 * Lowercased and stripped of diacritics, so `marin` finds `Marín`. A guest
 * typing their own name into a phone rarely reaches for the accent key, and
 * a guest list imported from a spreadsheet may have lost the accents on the
 * way in — neither should be the difference between finding your seat and
 * being told you aren't on the list.
 */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/**
 * Every guest whose name contains `query`, in `guestOrder`. Returns all of
 * them rather than the first: two guests really can share a display name
 * (the sample wedding has such a pair), and silently picking one would tell
 * somebody they are sitting at a table they are not sitting at.
 */
export function findGuestsByName(doc: GuestIndex, query: string): Guest[] {
  const q = fold(query.trim());
  if (q === '') return [];
  const out: Guest[] = [];
  for (const id of doc.guestOrder) {
    const guest = doc.guests[id];
    if (guest && fold(guest.name).includes(q)) out.push(guest);
  }
  return out;
}

/** Where a guest is sitting, or `null` if they have no seat (or their seat's table has since been deleted). */
export function lookupSeat(doc: SeatIndex, guestId: string): SeatLookup | null {
  if (!doc.guests[guestId]) return null;
  const seatId = seatOfGuest(doc.seatAssignments, guestId);
  if (seatId === null) return null;
  const tableId = tableIdOfSeat(seatId);
  const table = doc.objects[tableId];
  if (!table) return null;

  // Walk the table's own seats rather than the assignment map's keys: seat
  // order is the order a guest reads them around the table, and object key
  // enumeration order is not that.
  const tablemates: Guest[] = [];
  for (const seat of getSeats(table)) {
    const occupantId = doc.seatAssignments[seat.id];
    if (occupantId === undefined || occupantId === guestId) continue;
    const occupant = doc.guests[occupantId];
    if (occupant) tablemates.push(occupant);
  }

  return {
    tableId,
    tableLabel: table.label,
    seatNumber: seatIndexOfSeat(seatId) + 1,
    tablemates,
  };
}
