import { SEAT_OFFSET, SEAT_RADIUS } from '@/lib/constants';
import { rotatePoint } from '@/lib/geometry/vec';
import type { Cm, SceneObject } from '@/lib/types/doc';

export interface Aabb {
  left: Cm; right: Cm; top: Cm; bottom: Cm;
  cx: Cm; cy: Cm; width: Cm; height: Cm;
}

/** Half-extents of the object's own footprint, seats included, before rotation. */
export function localExtents(obj: SceneObject): { hw: Cm; hh: Cm } {
  switch (obj.type) {
    case 'roundTable': {
      const r = obj.diameter / 2 + SEAT_OFFSET + SEAT_RADIUS;
      return { hw: r, hh: r };
    }
    case 'rectTable': {
      const pad = SEAT_OFFSET + SEAT_RADIUS;
      return { hw: obj.width / 2, hh: obj.height / 2 + pad };
    }
    case 'headTable':
    case 'sweetheart': {
      // Seated on one edge only, but an AABB cannot pad asymmetrically without
      // also shifting its centre. Pad both sides fully: over-covering the empty
      // edge is harmless, under-covering the seated edge leaves chairs outside
      // the box and lets a neighbour snap flush into them.
      const pad = SEAT_OFFSET + SEAT_RADIUS;
      return { hw: obj.width / 2, hh: obj.height / 2 + pad };
    }
    case 'label':
      // A label has no box; approximate from the font size so it can still be selected and snapped.
      return { hw: Math.max(obj.label.length, 1) * obj.fontSize * 0.28, hh: obj.fontSize * 0.7 };
    default:
      return { hw: obj.width / 2, hh: obj.height / 2 };
  }
}

export function getBoundsAt(obj: SceneObject, x: Cm, y: Cm): Aabb {
  const { hw, hh } = localExtents(obj);
  const corners = [
    rotatePoint(-hw, -hh, obj.rotation), rotatePoint(hw, -hh, obj.rotation),
    rotatePoint(hw, hh, obj.rotation),   rotatePoint(-hw, hh, obj.rotation),
  ];
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const left = x + Math.min(...xs);
  const right = x + Math.max(...xs);
  const top = y + Math.min(...ys);
  const bottom = y + Math.max(...ys);
  return { left, right, top, bottom, cx: x, cy: y, width: right - left, height: bottom - top };
}

export function getBounds(obj: SceneObject): Aabb {
  return getBoundsAt(obj, obj.x, obj.y);
}
