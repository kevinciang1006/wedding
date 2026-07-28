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

/** Seats spaced in equal slots along an edge, centred in each slot. Each seat's angle points toward the table centre. */
function alongEdge(count: number, width: Cm, y: Cm): LocalSeat[] {
  const slot = width / count;
  return Array.from({ length: count }, (_, k) => {
    const x = -width / 2 + slot * (k + 0.5);
    // Angle from this seat position toward the centre at (0, 0).
    // Direction: (-x, -y). Angle where sin(θ) = -x/d, cos(θ) = y/d (since -cos(θ) = -y/d).
    const angle = (Math.atan2(-x, y) * 180) / Math.PI;
    return { x, y, angle };
  });
}

function localSeats(obj: SceneObject): readonly LocalSeat[] {
  switch (obj.type) {
    case 'roundTable': {
      const radius = obj.diameter / 2 + SEAT_OFFSET;
      // Starting at -pi/2 puts seat 0 at the top.
      return Array.from({ length: obj.seatCount }, (_, i) => {
        const a = (Math.PI * 2 * i) / obj.seatCount - Math.PI / 2;
        return {
          x: Math.cos(a) * radius,
          y: Math.sin(a) * radius,
          // -90 turns the outward radial direction inward, matching the edge
          // convention below where a seat above the table faces down (180).
          angle: (a * 180) / Math.PI - 90,
        };
      });
    }
    case 'rectTable': {
      const y = obj.height / 2 + SEAT_OFFSET;
      const top = alongEdge(obj.seatsPerSide, obj.width, -y);
      // Index down one side, then back along the other, so seat order walks the table.
      const bottom = alongEdge(obj.seatsPerSide, obj.width, y).reverse();
      return [...top, ...bottom];
    }
    case 'headTable':
      return alongEdge(obj.seatCount, obj.width, -(obj.height / 2 + SEAT_OFFSET));
    case 'sweetheart':
      return alongEdge(2, obj.width, -(obj.height / 2 + SEAT_OFFSET));
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
