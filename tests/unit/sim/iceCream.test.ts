import { describe, it, expect } from 'vitest';
import { createGrid, setCell, createFog } from '../../../src/sim/grid';
import { step } from '../../../src/sim/step';
import { applyBrush } from '../../../src/sim/brush';
import { SAND, FOG, ICE_CREAM, GUMDROP, WATER, type Grid } from '../../../src/sim/types';

function at(grid: Grid, x: number, y: number): number {
  return grid.elements[y * grid.width + x];
}

function settle(grid: Grid, steps: number): void {
  for (let i = 0; i < steps; i++) step(grid);
}

describe('painting ice cream (FR-012)', () => {
  it('produces ICE_CREAM cells at every brush size, each with a hue set at paint time', () => {
    for (const radius of [0, 2, 4]) {
      const grid = createGrid(30, 30);
      applyBrush(grid, 'icecream', 15, 15, radius, 0);
      let count = 0;
      for (let i = 0; i < grid.elements.length; i++) {
        if (grid.elements[i] === ICE_CREAM) {
          count++;
          expect(grid.hues[i]).toBeGreaterThanOrEqual(0);
        }
      }
      expect(count).toBeGreaterThan(0);
    }
  });
});

// A tiny deterministic PRNG so the two step() runs below make identical random choices
// (water's own sideways-flow tie-breaks) — stepGumdrop itself never calls Math.random, so with
// matched randomness the only difference between the two runs is GUMDROP vs. ICE_CREAM.
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('ice cream falls and rests exactly like a gumdrop (FR-015)', () => {
  it('poured above a pool falls and comes to rest cell-for-cell identically to a gumdrop poured in the same spot', () => {
    const iceCreamGrid = createGrid(20, 20);
    for (let y = 10; y < 20; y++) {
      for (let x = 0; x < 20; x++) setCell(iceCreamGrid, x, y, WATER, 0);
    }
    setCell(iceCreamGrid, 10, 0, ICE_CREAM, 0);

    const gumdropGrid = createGrid(20, 20);
    for (let y = 10; y < 20; y++) {
      for (let x = 0; x < 20; x++) setCell(gumdropGrid, x, y, WATER, 0);
    }
    setCell(gumdropGrid, 10, 0, GUMDROP, 0);

    const originalRandom = Math.random;
    try {
      Math.random = seededRandom(12345);
      settle(iceCreamGrid, 60);
      Math.random = seededRandom(12345);
      settle(gumdropGrid, 60);
    } finally {
      Math.random = originalRandom;
    }

    for (let i = 0; i < iceCreamGrid.elements.length; i++) {
      const iceCreamElement = iceCreamGrid.elements[i] === ICE_CREAM ? GUMDROP : iceCreamGrid.elements[i];
      expect(iceCreamElement).toBe(gumdropGrid.elements[i]);
    }
  });

  it('rests on dry land and never moves, melts, or disappears on its own', () => {
    const grid = createGrid(9, 9);
    setCell(grid, 4, 8, ICE_CREAM, 0);
    settle(grid, 60);
    expect(at(grid, 4, 8)).toBe(ICE_CREAM);
  });

  it('a cell with water directly below swaps in one step, exactly like a gumdrop', () => {
    const grid = createGrid(1, 2);
    setCell(grid, 0, 0, ICE_CREAM, 0);
    setCell(grid, 0, 1, WATER, 9);
    step(grid);
    expect(at(grid, 0, 0)).toBe(WATER);
    expect(at(grid, 0, 1)).toBe(ICE_CREAM);
  });

  it('a cell with fog directly below swaps in one step, exactly like a gumdrop', () => {
    const grid = createGrid(5, 5);
    createFog(grid, 0, 4);
    setCell(grid, 0, 3, ICE_CREAM, 0);
    step(grid);
    expect(at(grid, 0, 3)).toBe(FOG);
    expect(at(grid, 0, 4)).toBe(ICE_CREAM);
  });
});

describe('ice cream does not change any other element behaviour (FR-016)', () => {
  it('sand still falls and rests normally with ice cream elsewhere on the field', () => {
    const grid = createGrid(9, 9);
    setCell(grid, 2, 0, ICE_CREAM, 0);
    setCell(grid, 6, 0, SAND, 0);
    settle(grid, 30);
    expect(at(grid, 6, 8)).toBe(SAND);
    expect(at(grid, 2, 8)).toBe(ICE_CREAM);
  });
});
