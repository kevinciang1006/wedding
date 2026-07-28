import { seatCountOf } from '@/lib/geometry/seats';
import { tableIdOfSeat } from '@/lib/doc/assignments';
import type { Doc } from '@/lib/types/doc';

export function tableFill(doc: Doc, tableId: string): { seated: number; total: number } {
  const obj = doc.objects[tableId];
  const total = obj ? seatCountOf(obj) : 0;
  let seated = 0;
  for (const seatId of Object.keys(doc.seatAssignments)) {
    if (tableIdOfSeat(seatId) === tableId) seated += 1;
  }
  return { seated, total };
}

/** Declined guests are kept in the list but never counted as needing a seat. */
export function seatingCounts(doc: Doc): { total: number; seated: number; unseated: number } {
  const total = doc.guestOrder.length;
  const seatedIds = new Set(Object.values(doc.seatAssignments));
  const seated = doc.guestOrder.filter((id) => seatedIds.has(id)).length;
  const declined = doc.guestOrder.filter((id) => doc.guests[id]?.rsvp === 'no').length;
  return { total, seated, unseated: total - seated - declined };
}

export function freeSeatCount(doc: Doc): number {
  const totalSeats = doc.objectOrder.reduce((sum, id) => {
    const obj = doc.objects[id];
    return sum + (obj ? seatCountOf(obj) : 0);
  }, 0);
  return totalSeats - Object.keys(doc.seatAssignments).length;
}
