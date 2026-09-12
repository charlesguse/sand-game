import { describe, it, expect } from 'vitest';
import { SIM_STEP_MS, MAX_STEPS_PER_FRAME, createSimClock, advanceSimClock } from '../../../src/lib/simClock';

describe('simClock — fixed 60Hz sim schedule decoupled from display refresh rate', () => {
  it('the first call starts the clock and runs exactly one step', () => {
    const clock = createSimClock();
    expect(advanceSimClock(clock, 1000)).toBe(1);
  });

  it('a steady 60fps display (16.667ms/frame) runs exactly one step every frame', () => {
    const clock = createSimClock();
    advanceSimClock(clock, 0);
    for (let i = 1; i <= 120; i++) {
      expect(advanceSimClock(clock, i * SIM_STEP_MS)).toBe(1);
    }
  });

  it('a steady 30fps display (half the rate) runs two steps every frame', () => {
    const clock = createSimClock();
    const frameMs = 1000 / 30;
    advanceSimClock(clock, 0);
    for (let i = 1; i <= 60; i++) {
      expect(advanceSimClock(clock, i * frameMs)).toBe(2);
    }
  });

  it('a steady 120fps display (double the rate) alternates 0 and 1, averaging one step per 16.67ms and never exceeding one per frame', () => {
    const clock = createSimClock();
    const frameMs = 1000 / 120;
    advanceSimClock(clock, 0);
    let totalSteps = 0;
    const frameCount = 240;
    for (let i = 1; i <= frameCount; i++) {
      const steps = advanceSimClock(clock, i * frameMs);
      expect(steps).toBeLessThanOrEqual(1);
      totalSteps += steps;
    }
    const elapsedMs = frameCount * frameMs;
    const expectedSteps = elapsedMs / SIM_STEP_MS;
    expect(totalSteps).toBeCloseTo(expectedSteps, 0);
  });

  it('a long gap (e.g. a backgrounded tab) is capped at MAX_STEPS_PER_FRAME and the rest of the backlog is dropped, not carried forward', () => {
    const clock = createSimClock();
    advanceSimClock(clock, 0);
    // The tab was hidden for 5 seconds — far more than MAX_STEPS_PER_FRAME steps' worth.
    const steps = advanceSimClock(clock, 5000);
    expect(steps).toBe(MAX_STEPS_PER_FRAME);

    // The very next frame, at a normal interval, proves the backlog was dropped rather than
    // queued: it returns to the steady-state single step instead of continuing to catch up.
    const nextSteps = advanceSimClock(clock, 5000 + SIM_STEP_MS);
    expect(nextSteps).toBe(1);
  });

  it('treats a non-finite nowMs as zero elapsed time and does not throw or corrupt the clock', () => {
    const clock = createSimClock();
    advanceSimClock(clock, 1000);
    expect(advanceSimClock(clock, Number.NaN)).toBe(0);
    expect(advanceSimClock(clock, Number.POSITIVE_INFINITY)).toBe(0);
    // The clock recovers cleanly once a valid timestamp resumes, diffed against the last good one.
    expect(advanceSimClock(clock, 1000 + SIM_STEP_MS)).toBe(1);
  });

  it('treats a backwards nowMs (time moving in reverse) as zero elapsed time', () => {
    const clock = createSimClock();
    advanceSimClock(clock, 1000);
    expect(advanceSimClock(clock, 900)).toBe(0);
    // Recovers once time moves forward again from the last known-good timestamp.
    expect(advanceSimClock(clock, 1000 + SIM_STEP_MS)).toBe(1);
  });

  it('is allocation-free on the hot path (SimClock is a plain, reusable object)', () => {
    const clock = createSimClock();
    expect(Object.keys(clock).sort()).toEqual(['accumulator', 'lastNow']);
  });
});
