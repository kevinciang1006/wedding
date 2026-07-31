import { getSeats } from '@/lib/geometry/seats';
import { isTable } from '@/lib/types/doc';
import type { Cm, SceneObject } from '@/lib/types/doc';

export interface SeatPoint { id: string; x: Cm; y: Cm }

/**
 * Every seat's world-cm position, flattened across every table in the doc.
 * Pulled out as its own pure function (no Konva, no store) so a guest drag
 * can snapshot this ONCE at `pointerdown` and hand the same array to every
 * `pointermove` of that gesture — the thing that keeps hit-testing cheap.
 * `getSeats(obj)` itself walks a per-object-type shape cache (see
 * `lib/geometry/seats.ts`) but still re-does the rotate+translate into world
 * space on every call; calling it once per table per drag, rather than once
 * per table per pointermove frame, is what turns an O(objects × seats) cost
 * PER FRAME into a one-off O(objects × seats) cost per gesture followed by a
 * flat O(seats) scan per frame (see `nearestSeatWithin` below) — the doc
 * cannot change mid-drag (nothing here writes to it until release), so one
 * snapshot stays valid for the gesture's whole lifetime.
 */
export function flattenSeatPoints(objects: Record<string, SceneObject>, objectOrder: readonly string[]): SeatPoint[] {
  const points: SeatPoint[] = [];
  for (const id of objectOrder) {
    const obj = objects[id];
    if (!obj || !isTable(obj)) continue;
    for (const seat of getSeats(obj)) points.push({ id: seat.id, x: seat.x, y: seat.y });
  }
  return points;
}

/**
 * The closest seat to `point` (world cm) within `maxRange` cm, or `null` if
 * none qualify — a flat linear scan, deliberately not a spatial index.
 * `seats` is typically a few hundred entries even for a large wedding, and
 * this runs once per pointermove against a plain array of numbers: a spatial
 * grid would trade a real, load-bearing simplicity (see `flattenSeatPoints`'
 * own comment on WHY this stays cheap) for complexity this scale never
 * needs. Squared distance throughout — comparing against `maxRange *
 * maxRange` avoids a `Math.sqrt` per candidate, only the winner needs to be
 * identified, never its exact distance.
 */
export function nearestSeatWithin(seats: readonly SeatPoint[], point: { x: Cm; y: Cm }, maxRange: Cm): string | null {
  const maxRange2 = maxRange * maxRange;
  let nearestId: string | null = null;
  let nearestDist2 = maxRange2;
  for (const seat of seats) {
    const dx = seat.x - point.x;
    const dy = seat.y - point.y;
    const dist2 = dx * dx + dy * dy;
    if (dist2 <= nearestDist2) {
      nearestDist2 = dist2;
      nearestId = seat.id;
    }
  }
  return nearestId;
}
