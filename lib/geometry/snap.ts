import { GRID_SNAP_STEP, SNAP_NEIGHBOUR_RANGE, SNAP_PX } from '@/lib/constants';
import { getBounds, getBoundsAt, type Aabb } from '@/lib/geometry/bounds';
import type { Cm, SceneObject } from '@/lib/types/doc';

export interface Guide { axis: 'x' | 'y'; at: Cm; from: Cm; to: Cm }

export interface SnapResult {
  x: Cm; y: Cm; guides: Guide[]; snappedX: boolean; snappedY: boolean;
}

interface Candidate { value: Cm; delta: Cm; neighbour: Aabb }

const X_EDGES = ['left', 'cx', 'right'] as const;
const Y_EDGES = ['top', 'cy', 'bottom'] as const;

function best(
  moving: Aabb,
  neighbours: Aabb[],
  keys: readonly ('left' | 'cx' | 'right' | 'top' | 'cy' | 'bottom')[],
  threshold: Cm,
): Candidate | null {
  let winner: Candidate | null = null;
  for (const neighbour of neighbours) {
    for (const a of keys) {
      for (const b of keys) {
        const delta = neighbour[b] - moving[a];
        if (Math.abs(delta) > threshold) continue;
        if (!winner || Math.abs(delta) < Math.abs(winner.delta)) {
          winner = { value: neighbour[b], delta, neighbour };
        }
      }
    }
  }
  return winner;
}

function toStep(value: Cm, step: Cm): Cm {
  return Math.round(value / step) * step;
}

export function snapPosition(args: {
  moving: SceneObject;
  x: Cm;
  y: Cm;
  others: SceneObject[];
  stageScale: number;
  gridEnabled: boolean;
}): SnapResult {
  const { moving, x, y, others, stageScale, gridEnabled } = args;
  const threshold = SNAP_PX / stageScale;
  const box = getBoundsAt(moving, x, y);

  const nearby = others
    .filter((o) => Math.hypot(o.x - x, o.y - y) <= SNAP_NEIGHBOUR_RANGE)
    .map(getBounds);

  const hitX = best(box, nearby, X_EDGES, threshold);
  const hitY = best(box, nearby, Y_EDGES, threshold);

  let nextX = x + (hitX?.delta ?? 0);
  let nextY = y + (hitY?.delta ?? 0);

  // Grid snap only fills in axes alignment left free.
  if (gridEnabled && !hitX) nextX = toStep(nextX, GRID_SNAP_STEP);
  if (gridEnabled && !hitY) nextY = toStep(nextY, GRID_SNAP_STEP);

  const snapped = getBoundsAt(moving, nextX, nextY);
  const guides: Guide[] = [];
  if (hitX) {
    guides.push({
      axis: 'x',
      at: hitX.value,
      from: Math.min(snapped.top, hitX.neighbour.top),
      to: Math.max(snapped.bottom, hitX.neighbour.bottom),
    });
  }
  if (hitY) {
    guides.push({
      axis: 'y',
      at: hitY.value,
      from: Math.min(snapped.left, hitY.neighbour.left),
      to: Math.max(snapped.right, hitY.neighbour.right),
    });
  }

  return { x: nextX, y: nextY, guides, snappedX: Boolean(hitX), snappedY: Boolean(hitY) };
}
