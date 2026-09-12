/**
 * A fixed-timestep wall-clock schedule for the simulation, decoupled from the display's own
 * refresh rate. `frame()` in PlayArea.svelte renders exactly once per `requestAnimationFrame`
 * callback but must step the simulation (sand falling, pets walking, etc.) a variable number of
 * times per callback so gameplay speed stays the same on a 30fps tablet, a 60Hz desktop, and a
 * 120Hz display alike. Pure and DOM-free (constitution Principle V) so it is unit-testable
 * without a browser.
 */

/** Target simulation rate: one step per 1000/60 ms of wall-clock time. */
export const SIM_STEP_MS = 1000 / 60;

/**
 * Upper bound on how many sim steps a single rAF callback may run. When the backlog exceeds
 * this (e.g. the tab was backgrounded and rAF paused), the excess is dropped rather than
 * "caught up" over subsequent frames — a paused toy should resume at normal speed, not fast-
 * forward through everything that would have happened while hidden.
 */
export const MAX_STEPS_PER_FRAME = 3;

/** Mutable fixed-timestep accumulator state. Create with `createSimClock()`. */
export interface SimClock {
  /** Wall-clock time (ms) of the last `advanceSimClock` call, or null before the first call. */
  lastNow: number | null;
  /** Wall-clock ms of elapsed time not yet converted into a sim step. */
  accumulator: number;
}

export function createSimClock(): SimClock {
  return { lastNow: null, accumulator: 0 };
}

/**
 * Guards `accumulator / SIM_STEP_MS` against floating-point rounding: e.g. `1000 / 30` divided
 * by `1000 / 60` is mathematically exactly 2, but IEEE-754 division can land a hair under 2,
 * which would floor to 1 and silently halve the simulation's effective rate on an exact 30fps
 * source. The epsilon is many orders of magnitude below any real elapsed-time difference.
 */
const EPSILON = 1e-9;

/**
 * Advances `clock` by the wall-clock time elapsed since the previous call and returns how many
 * fixed-size sim steps should run this rAF callback (0, 1, or more). Allocates nothing.
 *
 * - First call: starts the clock and returns 1 step (there is no prior timestamp to diff against).
 * - Non-finite or backwards `nowMs` (a clock glitch, or a caller passing a stale value): treated
 *   as zero elapsed time; `clock.lastNow` is left unchanged so a later, valid `nowMs` is still
 *   diffed against the last known-good timestamp rather than a corrupted one.
 * - A backlog bigger than `MAX_STEPS_PER_FRAME` steps' worth of time (the tab was hidden and rAF
 *   stopped firing) is capped at `MAX_STEPS_PER_FRAME` and the rest of the backlog is discarded.
 */
export function advanceSimClock(clock: SimClock, nowMs: number): number {
  if (clock.lastNow === null) {
    clock.lastNow = Number.isFinite(nowMs) ? nowMs : 0;
    clock.accumulator = 0;
    return 1;
  }

  let elapsed = nowMs - clock.lastNow;
  if (!Number.isFinite(elapsed) || elapsed < 0) {
    elapsed = 0;
  } else {
    clock.lastNow = nowMs;
  }

  clock.accumulator += elapsed;
  let steps = Math.floor(clock.accumulator / SIM_STEP_MS + EPSILON);

  if (steps > MAX_STEPS_PER_FRAME) {
    steps = MAX_STEPS_PER_FRAME;
    // Drop the rest of the backlog instead of carrying it forward to "catch up" later.
    clock.accumulator = 0;
  } else {
    clock.accumulator -= steps * SIM_STEP_MS;
  }

  return steps;
}
