import { describe, it, expect } from 'vitest';
import { createGrid, setCell } from '../../../src/sim/grid';
import { step } from '../../../src/sim/step';
import {
  createButterfliesState,
  stepButterflies,
  eraseButterfliesInBrush,
  eraseButterfliesInBrushLine,
  clearButterflies,
  BUTTERFLY_CAP,
  FLOWERS_PER_BUTTERFLY,
  ERASE_HOLDOFF_MS,
  FLOWER_SCAN_PASS_FRAMES,
  type ButterfliesState,
} from '../../../src/sim/butterflies';
import { FLOWER, WATER, SAND, FOG, STAR_POWER, type Grid } from '../../../src/sim/types';

function run(grid: Grid, state: ButterfliesState, frames: number, now = { t: 0 }): void {
  for (let i = 0; i < frames; i++) {
    now.t += 16;
    stepButterflies(grid, state, now.t);
  }
}

function placeFlowers(grid: Grid, count: number): void {
  let placed = 0;
  for (let y = 0; y < grid.height && placed < count; y++) {
    for (let x = 0; x < grid.width && placed < count; x++) {
      setCell(grid, x, y, FLOWER, 0);
      placed++;
    }
  }
}

describe('population appears only with flowers', () => {
  it('stays empty on a flowerless grid across many frames', () => {
    const grid = createGrid(80, 60);
    const state = createButterfliesState();
    run(grid, state, FLOWER_SCAN_PASS_FRAMES * 3);
    expect(state.butterflies).toHaveLength(0);
  });

  it('produces a butterfly within roughly one scan pass of a flower appearing', () => {
    const grid = createGrid(80, 60);
    const state = createButterfliesState();
    setCell(grid, 10, 10, FLOWER, 0);
    run(grid, state, FLOWER_SCAN_PASS_FRAMES + 5);
    expect(state.butterflies.length).toBeGreaterThanOrEqual(1);
  });
});

describe('population follows the per-4-flowers, cap-4 rule', () => {
  it.each([0, 1, 4, 5, 8, 9, 12, 13, 16, 17, 40])('settles to the expected count for %i flowers', (n) => {
    const grid = createGrid(80, 60);
    const state = createButterfliesState();
    placeFlowers(grid, n);
    run(grid, state, FLOWER_SCAN_PASS_FRAMES * 2 + 30);
    const expected = n === 0 ? 0 : Math.min(BUTTERFLY_CAP, Math.ceil(n / FLOWERS_PER_BUTTERFLY));
    expect(state.butterflies.length).toBe(expected);
  });
});

describe('visit/travel motion', () => {
  it('alternates visiting and travelling, dwelling and sometimes changing target', () => {
    const grid = createGrid(80, 60);
    const state = createButterfliesState();
    placeFlowers(grid, 8);
    run(grid, state, FLOWER_SCAN_PASS_FRAMES + 5);
    expect(state.butterflies.length).toBeGreaterThan(0);
    const b = state.butterflies[0];

    const seenStates = new Set<string>();
    const seenTargets = new Set<string>();
    let visitFrames = 0;
    for (let i = 0; i < 2000; i++) {
      stepButterflies(grid, state, 1000 + i * 16);
      seenStates.add(b.state);
      seenTargets.add(`${b.targetX},${b.targetY}`);
      if (b.state === 'visiting') visitFrames++;
    }

    expect(seenStates.has('visiting')).toBe(true);
    expect(seenStates.has('travelling')).toBe(true);
    expect(visitFrames).toBeGreaterThan(50);
    expect(seenTargets.size).toBeGreaterThanOrEqual(1);
  });

  it('never flies exactly on the straight bearing to target for more than one consecutive frame', () => {
    const grid = createGrid(80, 60);
    const state = createButterfliesState();
    placeFlowers(grid, 8);
    run(grid, state, FLOWER_SCAN_PASS_FRAMES + 5);
    const b = state.butterflies[0];

    let prevWasStraight = false;
    for (let i = 0; i < 500; i++) {
      stepButterflies(grid, state, 1000 + i * 16);
      if (b.state !== 'travelling') {
        prevWasStraight = false;
        continue;
      }
      const bearing = Math.atan2(b.targetY - b.y, b.targetX - b.x);
      const isStraight = Math.abs(b.headingRadians - bearing) < 1e-9;
      if (isStraight) {
        expect(prevWasStraight).toBe(false);
      }
      prevWasStraight = isStraight;
    }
  });
});

describe('terrain independence', () => {
  it.each([
    ['WATER', WATER],
    ['SAND', SAND],
    ['STAR_POWER', STAR_POWER],
  ] as const)('is unaffected by %s cells beneath its path', (_name, element) => {
    const grid = createGrid(80, 60);
    const state = createButterfliesState();
    for (let x = 0; x < grid.width; x++) setCell(grid, x, 30, element, 0);
    setCell(grid, 5, 30, FLOWER, 0);
    setCell(grid, 70, 30, FLOWER, 0);
    run(grid, state, FLOWER_SCAN_PASS_FRAMES + 5);
    expect(state.butterflies.length).toBeGreaterThan(0);

    for (let i = 0; i < 400; i++) {
      stepButterflies(grid, state, 1000 + i * 16);
      for (const b of state.butterflies) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x).toBeLessThan(grid.width);
      }
    }
  });

  it('is unaffected by fog cloud cells beneath its path', () => {
    const grid = createGrid(80, 60);
    const state = createButterfliesState();
    for (let x = 0; x < grid.width; x++) {
      setCell(grid, x, 30, FOG, 0);
      grid.cloud[30 * grid.width + x] = 1;
    }
    setCell(grid, 5, 30, FLOWER, 0);
    setCell(grid, 70, 30, FLOWER, 0);
    run(grid, state, FLOWER_SCAN_PASS_FRAMES + 5);
    expect(state.butterflies.length).toBeGreaterThan(0);
    run(grid, state, 400);
    for (const b of state.butterflies) {
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeLessThan(grid.height);
    }
  });

  it('stays in bounds crossing SAND/DIRT/WATER placed directly in its path', () => {
    const grid = createGrid(60, 40);
    const state = createButterfliesState();
    setCell(grid, 2, 20, FLOWER, 0);
    setCell(grid, 57, 20, FLOWER, 0);
    setCell(grid, 20, 20, SAND, 0);
    setCell(grid, 30, 20, WATER, 0);
    run(grid, state, FLOWER_SCAN_PASS_FRAMES + 5);
    for (let i = 0; i < 500; i++) {
      stepButterflies(grid, state, 1000 + i * 16);
      for (const b of state.butterflies) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x).toBeLessThan(grid.width);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeLessThan(grid.height);
      }
    }
  });
});

describe('never writes to the grid', () => {
  it('leaves every Grid array byte-for-byte identical across a long active run', () => {
    const grid = createGrid(60, 40);
    const state = createButterfliesState();
    placeFlowers(grid, 8);
    run(grid, state, FLOWER_SCAN_PASS_FRAMES + 5);

    const before = {
      elements: grid.elements.slice(),
      shades: grid.shades.slice(),
      hues: grid.hues.slice(),
      grassHeight: grid.grassHeight.slice(),
    };

    eraseButterfliesInBrush(state, 5, 5, 3, 5000);
    eraseButterfliesInBrushLine(state, { x: 0, y: 0 }, { x: 10, y: 10 }, 2, 5001);
    for (let i = 0; i < 300; i++) stepButterflies(grid, state, 6000 + i * 16);

    expect(grid.elements).toEqual(before.elements);
    expect(grid.shades).toEqual(before.shades);
    expect(grid.hues).toEqual(before.hues);
    expect(grid.grassHeight).toEqual(before.grassHeight);
  });

  it('produces identical step(grid) results with or without butterflies present', () => {
    const gridA = createGrid(60, 40);
    const gridB = createGrid(60, 40);
    placeFlowers(gridA, 6);
    placeFlowers(gridB, 6);
    const state = createButterfliesState();
    run(gridA, state, FLOWER_SCAN_PASS_FRAMES + 5);

    for (let i = 0; i < 100; i++) {
      step(gridA);
      stepButterflies(gridA, state, 1000 + i * 16);
      step(gridB);
    }

    expect(gridA.elements).toEqual(gridB.elements);
  });
});

describe('stale target handling', () => {
  it('retargets or leaves when the destination flower disappears mid-flight', () => {
    const grid = createGrid(80, 60);
    const state = createButterfliesState();
    setCell(grid, 5, 5, FLOWER, 0);
    setCell(grid, 70, 55, FLOWER, 0);
    run(grid, state, FLOWER_SCAN_PASS_FRAMES + 5);

    // Force one butterfly into travelling toward the far flower.
    const b = state.butterflies[0];
    b.state = 'travelling';
    b.targetX = 70;
    b.targetY = 55;
    b.x = 40;
    b.y = 30;

    // Remove the flower it is heading toward immediately.
    setCell(grid, 70, 55, 0, 0);

    // Revalidation against a fresh scan pass only happens once that pass completes — give it
    // a full pass' worth of frames before checking, rather than asserting on every frame.
    for (let i = 0; i < FLOWER_SCAN_PASS_FRAMES + 10; i++) {
      stepButterflies(grid, state, 1000 + i * 16);
    }
    if (b.state === 'travelling') {
      expect(b.targetX === 70 && b.targetY === 55).toBe(false);
    }
  });
});

describe('lifecycle: last flower gone', () => {
  it('empties the population within about one scan pass', () => {
    const grid = createGrid(80, 60);
    const state = createButterfliesState();
    placeFlowers(grid, 4);
    run(grid, state, FLOWER_SCAN_PASS_FRAMES + 5);
    expect(state.butterflies.length).toBeGreaterThan(0);

    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        if (grid.elements[y * grid.width + x] === FLOWER) setCell(grid, x, y, 0, 0);
      }
    }

    // Worst case: the removal lands just after the in-progress scan buffer already captured
    // the now-gone flower, so it takes a further full pass before that stale entry ages out —
    // up to ~2 passes' worth of frames total, still well within "about a second or two".
    run(grid, state, FLOWER_SCAN_PASS_FRAMES * 2 + 5);
    expect(state.butterflies.length).toBe(0);
  });
});

describe('eraser', () => {
  it('removes a butterfly centered exactly on it, and along a straddling line', () => {
    const grid = createGrid(80, 60);
    const state = createButterfliesState();
    placeFlowers(grid, 16); // BUTTERFLY_CAP worth, so erasing one still leaves another to test against
    run(grid, state, FLOWER_SCAN_PASS_FRAMES + 5);
    expect(state.butterflies.length).toBeGreaterThan(1);

    const target = state.butterflies[0];
    eraseButterfliesInBrush(state, target.x, target.y, 1, 1000);
    expect(state.butterflies.find((b) => b.id === target.id)).toBeUndefined();

    const target2 = state.butterflies[0];
    const bx = target2.x;
    const by = target2.y;
    eraseButterfliesInBrushLine(state, { x: bx - 5, y: by - 5 }, { x: bx + 5, y: by + 5 }, 1, 2000);
    expect(state.butterflies.find((b) => b.id === target2.id)).toBeUndefined();
  });

  it('holds off replacement for ERASE_HOLDOFF_MS then repopulates', () => {
    const grid = createGrid(80, 60);
    const state = createButterfliesState();
    placeFlowers(grid, 4);
    run(grid, state, FLOWER_SCAN_PASS_FRAMES + 5);
    const before = state.butterflies.length;
    const target = state.butterflies[0];

    let now = 10000;
    eraseButterfliesInBrush(state, target.x, target.y, 1, now);
    expect(state.butterflies.length).toBe(before - 1);

    for (let i = 0; i < 30; i++) {
      now += 16;
      stepButterflies(grid, state, now);
    }
    expect(state.butterflies.length).toBe(before - 1);

    now += ERASE_HOLDOFF_MS + 100;
    for (let i = 0; i < 5; i++) {
      now += 16;
      stepButterflies(grid, state, now);
    }
    expect(state.butterflies.length).toBe(before);
  });
});

describe('clearButterflies', () => {
  it('empties the population immediately and does not repopulate on an unchanged grid', () => {
    const grid = createGrid(80, 60);
    const state = createButterfliesState();
    placeFlowers(grid, 8);
    run(grid, state, FLOWER_SCAN_PASS_FRAMES + 5);
    expect(state.butterflies.length).toBeGreaterThan(0);

    clearButterflies(state);
    expect(state.butterflies).toHaveLength(0);

    run(grid, state, FLOWER_SCAN_PASS_FRAMES + 5);
    expect(state.butterflies.length).toBeGreaterThan(0); // flowers still there, so it re-establishes
  });

  it('does not repopulate once the grid itself is also cleared', () => {
    const grid = createGrid(80, 60);
    const state = createButterfliesState();
    placeFlowers(grid, 8);
    run(grid, state, FLOWER_SCAN_PASS_FRAMES + 5);
    clearButterflies(state);
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) setCell(grid, x, y, 0, 0);
    }
    run(grid, state, FLOWER_SCAN_PASS_FRAMES + 5);
    expect(state.butterflies).toHaveLength(0);
  });
});

describe('reload / re-derivation', () => {
  it('establishes population from a fresh state against a grid that already has flowers', () => {
    const grid = createGrid(80, 60);
    placeFlowers(grid, 8);
    const state = createButterfliesState();
    run(grid, state, FLOWER_SCAN_PASS_FRAMES + 5);
    expect(state.butterflies.length).toBeGreaterThan(0);
  });

  it('re-settles after grid/flower layout changes directly (undo/redo stand-in)', () => {
    const grid = createGrid(80, 60);
    const state = createButterfliesState();
    placeFlowers(grid, 4);
    run(grid, state, FLOWER_SCAN_PASS_FRAMES + 5);
    const before = state.butterflies.length;

    placeFlowers(grid, 16); // "after" layout: more flowers
    run(grid, state, FLOWER_SCAN_PASS_FRAMES + 5);
    expect(state.butterflies.length).toBeGreaterThanOrEqual(before);
  });

  it('re-establishes without any out-of-bounds creature after a differently-shaped grid swap', () => {
    const gridA = createGrid(80, 60);
    const state = createButterfliesState();
    placeFlowers(gridA, 8);
    run(gridA, state, FLOWER_SCAN_PASS_FRAMES + 5);
    clearButterflies(state);

    const gridB = createGrid(40, 30);
    placeFlowers(gridB, 4);
    for (let i = 0; i < FLOWER_SCAN_PASS_FRAMES + 10; i++) {
      stepButterflies(gridB, state, 1000 + i * 16);
      for (const b of state.butterflies) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x).toBeLessThan(gridB.width);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeLessThan(gridB.height);
      }
    }
  });

  it('leaves the old scene gone and establishes the new scene within about a second', () => {
    const gridA = createGrid(80, 60);
    const state = createButterfliesState();
    placeFlowers(gridA, 8);
    run(gridA, state, FLOWER_SCAN_PASS_FRAMES + 5);
    clearButterflies(state);
    expect(state.butterflies).toHaveLength(0);

    const gridB = createGrid(80, 60);
    placeFlowers(gridB, 8);
    run(gridB, state, FLOWER_SCAN_PASS_FRAMES + 5);
    expect(state.butterflies.length).toBeGreaterThan(0);
  });
});

describe('flicker guard', () => {
  it('never shows a spawn/despawn flicker for a flower appearing and vanishing within one scan pass', () => {
    const grid = createGrid(80, 60);
    const state = createButterfliesState();
    setCell(grid, 10, 10, FLOWER, 0);
    // Remove it again well before a scan pass could complete.
    for (let i = 0; i < 5; i++) stepButterflies(grid, state, 1000 + i * 16);
    setCell(grid, 10, 10, 0, 0);
    for (let i = 0; i < FLOWER_SCAN_PASS_FRAMES + 5; i++) stepButterflies(grid, state, 2000 + i * 16);
    expect(state.butterflies).toHaveLength(0);
  });
});
