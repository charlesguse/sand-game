import { describe, it, expect } from 'vitest';
import {
  createBirdsState,
  stepBirds,
  eraseBirdsInBrush,
  eraseBirdsInBrushLine,
  clearBirds,
  BIRD_CAP,
  type BirdsState,
} from '../../../src/sim/birds';
import { ERASE_HOLDOFF_MS } from '../../../src/sim/butterflies';
import type { PlacedObject } from '../../../src/sim/types';

let nextObjId = 0;
function palm(x: number, y: number, size = 24): PlacedObject {
  return { id: nextObjId++, kind: 'palm', x, y, size };
}

function run(palms: PlacedObject[], state: BirdsState, frames: number, startAt = 0, step = 16): number {
  let now = startAt;
  for (let i = 0; i < frames; i++) {
    now += step;
    stepBirds(palms, state, now);
  }
  return now;
}

describe('population appears only with palms', () => {
  it('stays empty with no palms across many frames', () => {
    const state = createBirdsState();
    run([], state, 200);
    expect(state.byPalmId.size).toBe(0);
  });

  it('gives one palm a bird at its top-center anchor within about a second', () => {
    const p = palm(100, 40);
    const state = createBirdsState();
    run([p], state, 70);
    expect(state.byPalmId.size).toBe(1);
    const bird = state.byPalmId.get(p.id)!;
    expect(bird.x).toBeCloseTo(p.x + p.size / 2);
    expect(bird.y).toBeCloseTo(p.y);
  });

  it('gives two and then three palms exactly one bird each, up to the cap', () => {
    const p1 = palm(20, 10);
    const p2 = palm(60, 15);
    const state = createBirdsState();
    run([p1, p2], state, 70);
    expect(state.byPalmId.size).toBe(2);
    expect(state.byPalmId.has(p1.id)).toBe(true);
    expect(state.byPalmId.has(p2.id)).toBe(true);

    const p3 = palm(100, 20);
    run([p1, p2, p3], state, 70);
    expect(state.byPalmId.size).toBe(Math.min(BIRD_CAP, 3));
    expect(state.byPalmId.has(p3.id)).toBe(true);
  });
});

describe('perched/hopping', () => {
  it('changes position at least once during a hopping interlude and tracks the live palm anchor', () => {
    const p = palm(50, 20);
    const state = createBirdsState();
    run([p], state, 5);

    const bird = state.byPalmId.get(p.id)!;
    const startX = bird.x;
    let moved = false;
    let now = 100;
    for (let i = 0; i < 6000; i++) {
      now += 16;
      stepBirds([p], state, now);
      if (Math.abs(bird.x - startX) > 0.01) moved = true;
    }
    expect(moved).toBe(true);

    // Now move the palm and confirm a perched/hopping bird tracks the new anchor.
    const movedPalm: PlacedObject = { ...p, x: p.x + 10, y: p.y + 2 };
    stepBirds([movedPalm], state, now + 16);
    if (bird.state !== 'flying') {
      expect(bird.x).toBeCloseTo(movedPalm.x + movedPalm.size / 2);
      expect(bird.y).toBeCloseTo(movedPalm.y);
    }
  });
});

describe('flight', () => {
  it('every completed flight ends perched on a live palm, across many flights (two/three palms)', () => {
    const p1 = palm(20, 10);
    const p2 = palm(150, 12);
    const p3 = palm(250, 8);
    const palms = [p1, p2, p3];
    const state = createBirdsState();
    run(palms, state, 5);

    let now = 100;
    let sawFlight = false;
    let sawLanding = false;
    for (let i = 0; i < 20000; i++) {
      now += 16;
      stepBirds(palms, state, now);
      for (const bird of state.byPalmId.values()) {
        if (bird.state === 'flying') sawFlight = true;
        if (bird.flightProgress === 1 && bird.state === 'perched') {
          sawLanding = true;
          expect(palms.some((p) => p.id === bird.palmId)).toBe(true);
        }
      }
    }
    expect(sawFlight).toBe(true);
    expect(sawLanding).toBe(true);
  });

  it('with one palm, keeps every sampled point in bounds and lands back on the same palm', () => {
    const gridWidth = 300;
    const gridHeight = 200;
    const p = palm(gridWidth - 24, 0); // pinned to the top-right edge
    const state = createBirdsState();
    run([p], state, 5);

    let now = 100;
    for (let i = 0; i < 20000; i++) {
      now += 16;
      stepBirds([p], state, now);
      for (const bird of state.byPalmId.values()) {
        expect(bird.x).toBeGreaterThanOrEqual(0);
        expect(bird.x).toBeLessThan(gridWidth);
        expect(bird.y).toBeGreaterThanOrEqual(0);
        expect(bird.y).toBeLessThan(gridHeight);
        expect(bird.palmId).toBe(p.id);
      }
    }
  });

  it('never mutates the palms array or any PlacedObject element', () => {
    const p1 = palm(20, 10);
    const p2 = palm(80, 15);
    const palms = [p1, p2];
    const frozenSnapshot = palms.map((p) => ({ ...p }));
    const state = createBirdsState();
    run(palms, state, 3000);
    expect(palms).toEqual(frozenSnapshot);
  });
});

describe('lifecycle: palm erased', () => {
  it('retargets the bird to a remaining palm rather than disappearing', () => {
    const p1 = palm(20, 10);
    const p2 = palm(150, 12);
    const state = createBirdsState();
    run([p1, p2], state, 5);
    expect(state.byPalmId.size).toBe(2);

    // Erase p1: only p2 remains live.
    let now = 200;
    for (let i = 0; i < 90; i++) {
      now += 16;
      stepBirds([p2], state, now);
    }
    expect(state.byPalmId.size).toBe(1);
    const bird = [...state.byPalmId.values()][0];
    expect(bird.state === 'flying' ? bird.destPalmId : bird.palmId).toBe(p2.id);
  });

  it('removes the bird within about a second when no palm remains', () => {
    const p1 = palm(20, 10);
    const state = createBirdsState();
    run([p1], state, 5);
    expect(state.byPalmId.size).toBe(1);

    let now = 200;
    for (let i = 0; i < 90; i++) {
      now += 16;
      stepBirds([], state, now);
    }
    expect(state.byPalmId.size).toBe(0);
  });

  it('removes a flying bird within about a second when every palm is erased mid-flight', () => {
    const p1 = palm(20, 10);
    const p2 = palm(150, 12);
    const state = createBirdsState();
    run([p1, p2], state, 5);

    let now = 200;
    // Run until at least one bird is flying.
    for (let i = 0; i < 5000; i++) {
      now += 16;
      stepBirds([p1, p2], state, now);
      if ([...state.byPalmId.values()].some((b) => b.state === 'flying')) break;
    }

    for (let i = 0; i < 90; i++) {
      now += 16;
      stepBirds([], state, now);
    }
    expect(state.byPalmId.size).toBe(0);
  });
});

describe('eraser', () => {
  it('removes a bird centered exactly on it, and along a straddling line', () => {
    const p1 = palm(40, 20);
    const p2 = palm(120, 30);
    const state = createBirdsState();
    run([p1, p2], state, 5);
    const bird1 = state.byPalmId.get(p1.id)!;

    eraseBirdsInBrush(state, bird1.x, bird1.y, 1, 1000);
    expect(state.byPalmId.has(p1.id)).toBe(false);

    const bird2 = state.byPalmId.get(p2.id)!;
    const bx = bird2.x;
    const by = bird2.y;
    eraseBirdsInBrushLine(state, { x: bx - 5, y: by - 5 }, { x: bx + 5, y: by + 5 }, 1, 3000);
    expect(state.byPalmId.has(p2.id)).toBe(false);
  });

  it('holds off replacement for ERASE_HOLDOFF_MS then repopulates', () => {
    const p = palm(40, 20);
    const state = createBirdsState();
    run([p], state, 5);
    const bird = state.byPalmId.get(p.id)!;

    let now = 10000;
    eraseBirdsInBrush(state, bird.x, bird.y, 1, now);
    expect(state.byPalmId.size).toBe(0);

    for (let i = 0; i < 30; i++) {
      now += 16;
      stepBirds([p], state, now);
    }
    expect(state.byPalmId.size).toBe(0);

    now += ERASE_HOLDOFF_MS + 100;
    for (let i = 0; i < 5; i++) {
      now += 16;
      stepBirds([p], state, now);
    }
    expect(state.byPalmId.size).toBe(1);
  });
});

describe('clearBirds', () => {
  it('empties both maps immediately without touching palms', () => {
    const p = palm(40, 20);
    const palms = [p];
    const state = createBirdsState();
    run(palms, state, 5);
    expect(state.byPalmId.size).toBe(1);

    clearBirds(state);
    expect(state.byPalmId.size).toBe(0);
    expect(state.holdoffUntilByPalmId.size).toBe(0);
    expect(palms).toEqual([p]);
  });
});

describe('reload / re-derivation', () => {
  it('establishes population from a fresh state against palms that already exist', () => {
    const p = palm(40, 20);
    const state = createBirdsState();
    run([p], state, 70);
    expect(state.byPalmId.size).toBe(1);
  });

  it('re-establishes with no out-of-bounds bird after a palm-list swap', () => {
    const p1 = palm(20, 10);
    const state = createBirdsState();
    run([p1], state, 5);
    clearBirds(state);

    const p2 = palm(10, 5, 12);
    let now = 1000;
    for (let i = 0; i < 200; i++) {
      now += 16;
      stepBirds([p2], state, now);
      for (const bird of state.byPalmId.values()) {
        expect(bird.x).toBeGreaterThanOrEqual(0);
        expect(bird.y).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('re-settles after a palm layout change applied directly (undo/redo stand-in)', () => {
    const p1 = palm(20, 10);
    const state = createBirdsState();
    let palms = [p1];
    run(palms, state, 70);
    expect(state.byPalmId.size).toBe(1);

    // "after" layout: undo/redo swaps which palms exist without any special call. The
    // retargeted bird takes a full flight (FLIGHT_DURATION_FRAMES) before landing and being
    // re-keyed to the new palm, so give it enough frames to complete that flight.
    const p2 = palm(80, 15);
    palms = [p2];
    run(palms, state, 300);
    expect(state.byPalmId.has(p2.id)).toBe(true);
  });

  it('leaves the old scene gone and establishes the new scene within about a second', () => {
    const p1 = palm(20, 10);
    const state = createBirdsState();
    run([p1], state, 5);
    clearBirds(state);
    expect(state.byPalmId.size).toBe(0);

    const p2 = palm(60, 25);
    run([p2], state, 70);
    expect(state.byPalmId.has(p2.id)).toBe(true);
  });
});
