type SeatMap = Record<string, string>;

export function tableIdOfSeat(seatId: string): string {
  return seatId.slice(0, seatId.lastIndexOf(':'));
}

export function seatIndexOfSeat(seatId: string): number {
  return Number(seatId.slice(seatId.lastIndexOf(':') + 1));
}

export function seatOfGuest(map: SeatMap, guestId: string): string | null {
  for (const [seatId, id] of Object.entries(map)) {
    if (id === guestId) return seatId;
  }
  return null;
}

/**
 * A guest occupies at most one seat and a seat holds at most one guest.
 * If the target is taken, the two guests swap; if the mover had no seat,
 * the sitting guest is simply displaced.
 */
export function assignSeat(map: SeatMap, seatId: string, guestId: string): SeatMap {
  if (map[seatId] === guestId) return map;
  const next: SeatMap = { ...map };
  const from = seatOfGuest(next, guestId);
  const displaced = next[seatId];

  if (from !== null) delete next[from];
  next[seatId] = guestId;

  if (displaced !== undefined && displaced !== guestId) {
    if (from !== null) next[from] = displaced;
  }
  return next;
}

export function clearSeat(map: SeatMap, seatId: string): SeatMap {
  if (!(seatId in map)) return map;
  const next = { ...map };
  delete next[seatId];
  return next;
}

export function unseatGuest(map: SeatMap, guestId: string): SeatMap {
  const seatId = seatOfGuest(map, guestId);
  return seatId === null ? map : clearSeat(map, seatId);
}
