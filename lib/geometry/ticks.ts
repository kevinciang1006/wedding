import type { Cm } from '@/lib/types/doc';

export interface TickLadder { minor: Cm; major: Cm }

const STEPS: Cm[] = [5, 10, 25, 50, 100, 200, 500, 1000, 2000, 5000];
const MIN_MINOR_PX = 25;

export function tickLadder(stageScale: number): TickLadder {
  const minor = STEPS.find((step) => step * stageScale >= MIN_MINOR_PX) ?? STEPS[STEPS.length - 1];
  return { minor, major: minor * 5 };
}
