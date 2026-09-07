import { describe, it, expect } from 'vitest';
import { createGrid, setCell } from '../../../src/sim/grid';
import { createSeaLifeState, resetSeaLifeState, stepSeaLife } from '../../../src/sim/seaLife';
import { WATER, SAND, type Grid } from '../../../src/sim/types';

/** Hand-places a rectangular WATER region (and optionally other elements) into a fresh Grid. */
function withPool(width: number, height: number, pool: { x: number; y: number; w: number; h: number }): Grid {
  const grid = createGrid(width, height);
  for (let y = pool.y; y < pool.y + pool.h; y++) {
    for (let x = pool.x; x < pool.x + pool.w; x++) setCell(grid, x, y, WATER, 0);
  }
  return grid;
}

describe('createSeaLifeState / resetSeaLifeState', () => {
  it('starts with no creatures and a fresh, fully-unlabeled sweep', () => {
    const grid = createGrid(40, 30);
    const state = createSeaLifeState(grid);
    expect(state.fish).toHaveLength(0);
    expect(state.sharks).toHaveLength(0);
    expect(state.poolId).toHaveLength(40 * 30);
    expect(Array.from(state.poolId).every((v) => v === -1)).toBe(true);
    expect(state.sweepCursor).toBe(0);
  });

  it('reallocates to a new grid shape and clears everything, preserving identity', () => {
    const grid = withPool(40, 30, { x: 5, y: 5, w: 20, h: 20 });
    const state = createSeaLifeState(grid);
    for (let i = 0; i < 200; i++) stepSeaLife(grid, state);

    const bigger = withPool(60, 50, { x: 5, y: 5, w: 20, h: 20 });
    resetSeaLifeState(state, bigger);

    expect(state.fish).toHaveLength(0);
    expect(state.sharks).toHaveLength(0);
    expect(state.poolId).toHaveLength(60 * 50);
    expect(Array.from(state.poolId).every((v) => v === -1)).toBe(true);
    expect(state.sweepCursor).toBe(0);
  });
});

describe('stepSeaLife with zero creatures', () => {
  it('never touches any grid array over many frames', () => {
    const grid = withPool(50, 40, { x: 5, y: 5, w: 30, h: 20 });
    const state = createSeaLifeState(grid);
    const before = grid.elements.slice();
    for (let i = 0; i < 300; i++) stepSeaLife(grid, state);
    expect(grid.elements).toEqual(before);
  });

  it('runs indefinitely without throwing on a grid with no water at all', () => {
    const grid = createGrid(30, 20);
    for (let x = 0; x < 30; x++) setCell(grid, x, 19, SAND, 0);
    const state = createSeaLifeState(grid);
    expect(() => {
      for (let i = 0; i < 500; i++) stepSeaLife(grid, state);
    }).not.toThrow();
  });
});
