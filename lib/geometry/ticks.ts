import type { Cm } from '@/lib/types/doc';

export interface TickLadder { minor: Cm; major: Cm }

const STEPS: Cm[] = [5, 10, 25, 50, 100, 200, 500, 1000, 2000, 5000];

/**
 * Minimum on-screen spacing between minor ticks. 25 px is what makes the ruler
 * read as 1 m minor / 5 m major at the default fit-to-room zoom, matching the
 * design. Exported so the test can pin it rather than restate it.
 */
export const MIN_MINOR_PX = 25;

export function tickLadder(stageScale: number): TickLadder {
  const minor = STEPS.find((step) => step * stageScale >= MIN_MINOR_PX) ?? STEPS[STEPS.length - 1];
  return { minor, major: minor * 5 };
}
