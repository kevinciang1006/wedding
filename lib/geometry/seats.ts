import { SEAT_OFFSET } from '@/lib/constants';
import { rotatePoint } from '@/lib/geometry/vec';
import type { Cm, SceneObject } from '@/lib/types/doc';

export interface Seat {
  id: string;
  index: number;
  x: Cm;
  y: Cm;
  angle: number; // degrees; the direction the seat faces, toward the table centre
}

interface LocalSeat { x: Cm; y: Cm; angle: number }

const shapeCache = new Map<string, readonly LocalSeat[]>();

function shapeKey(obj: SceneObject): string {
  switch (obj.type) {
    case 'roundTable': return `round:${obj.diameter}:${obj.seatCount}`;
    case 'rectTable':  return `rect:${obj.width}:${obj.height}:${obj.seatsPerSide}`;
    case 'headTable':  return `head:${obj.width}:${obj.height}:${obj.seatCount}`;
    case 'sweetheart': return `sweet:${obj.width}:${obj.height}`;
    default:           return `none:${obj.type}`;
  }
}

/** Seats spaced in equal slots along an edge, centred in each slot. */
function alongEdge(count: number, width: Cm, y: Cm, facing: number): LocalSeat[] {
  const slot = width / count;
  return Array.from({ length: count }, (_, k) => ({
    x: -width / 2 + slot * (k + 0.5),
    y,
    angle: facing,
  }));
}

function localSeats(obj: SceneObject): readonly LocalSeat[] {
  switch (obj.type) {
    case 'roundTable': {
      const radius = obj.diameter / 2 + SEAT_OFFSET;
      // Starting at -pi/2 puts seat 1 at the top.
      return Array.from({ length: obj.seatCount }, (_, i) => {
        const a = (Math.PI * 2 * i) / obj.seatCount - Math.PI / 2;
        return {
          x: Math.cos(a) * radius,
          y: Math.sin(a) * radius,
          angle: (a * 180) / Math.PI + 90, // faces inward
        };
      });
    }
    case 'rectTable': {
      const y = obj.height / 2 + SEAT_OFFSET;
      const top = alongEdge(obj.seatsPerSide, obj.width, -y, 180);
      // Index down one side, then back along the other, so seat order walks the table.
      const bottom = alongEdge(obj.seatsPerSide, obj.width, y, 0).reverse();
      return [...top, ...bottom];
    }
    case 'headTable':
      return alongEdge(obj.seatCount, obj.width, -(obj.height / 2 + SEAT_OFFSET), 180);
    case 'sweetheart':
      return alongEdge(2, obj.width, -(obj.height / 2 + SEAT_OFFSET), 180);
    default:
      return [];
  }
}

function cachedShape(obj: SceneObject): readonly LocalSeat[] {
  const key = shapeKey(obj);
  const hit = shapeCache.get(key);
  if (hit) return hit;
  const computed = localSeats(obj);
  shapeCache.set(key, computed);
  return computed;
}

export function getSeats(obj: SceneObject): Seat[] {
  return cachedShape(obj).map((seat, index) => {
    const rotated = rotatePoint(seat.x, seat.y, obj.rotation);
    return {
      id: `${obj.id}:${index}`,
      index,
      x: rotated.x + obj.x,
      y: rotated.y + obj.y,
      angle: seat.angle + obj.rotation,
    };
  });
}

export function seatCountOf(obj: SceneObject): number {
  return cachedShape(obj).length;
}
