import { describe, it, expect } from 'vitest';
import { createGrid, getCell, setCell } from '../../../src/sim/grid';
import { step } from '../../../src/sim/step';

describe('step', () => {
  it('falls a grain into an empty cell below', () => {
    const grid = createGrid(5, 5);
    setCell(grid, 2, 0, 100);
    step(grid);
    expect(getCell(grid, 2, 0)).toBe(0);
    expect(getCell(grid, 2, 1)).toBe(100);
  });

  it('slides into an available diagonal when blocked directly below', () => {
    // Run many trials to structurally verify: when below is blocked but
    // both diagonals are open, the grain always lands in one of them.
    // The blocker and open diagonals sit on the bottom row so they can't
    // themselves move away before the row above is scanned this tick.
    let landedLeft = 0;
    let landedRight = 0;
    for (let trial = 0; trial < 200; trial++) {
      const grid = createGrid(5, 5);
      setCell(grid, 2, 3, 100); // grain to move, one row above the floor
      setCell(grid, 2, 4, 200); // blocks straight down (floor, immovable)
      step(grid);
      expect(getCell(grid, 2, 3)).toBe(0);
      const left = getCell(grid, 1, 4);
      const right = getCell(grid, 3, 4);
      // exactly one of the diagonals received the grain
      expect([left, right].filter((v) => v === 100).length).toBe(1);
      if (left === 100) landedLeft++;
      if (right === 100) landedRight++;
      // the blocker never moved
      expect(getCell(grid, 2, 4)).toBe(200);
    }
    expect(landedLeft).toBeGreaterThan(0);
    expect(landedRight).toBeGreaterThan(0);
  });

  it('stays put when below, below-left, and below-right are all blocked', () => {
    const grid = createGrid(5, 5);
    setCell(grid, 2, 3, 100); // grain, one row above the floor
    setCell(grid, 1, 4, 10);
    setCell(grid, 2, 4, 20);
    setCell(grid, 3, 4, 30);
    step(grid);
    expect(getCell(grid, 2, 3)).toBe(100);
    expect(getCell(grid, 1, 4)).toBe(10);
    expect(getCell(grid, 2, 4)).toBe(20);
    expect(getCell(grid, 3, 4)).toBe(30);
  });

  it('stops at the floor', () => {
    const grid = createGrid(5, 5);
    setCell(grid, 2, 4, 100); // bottom row
    step(grid);
    expect(getCell(grid, 2, 4)).toBe(100);
  });

  it('stops at the side walls (off-grid treated as blocked, not empty)', () => {
    const grid = createGrid(5, 5);
    // One row above the floor, left edge: below and below-right are
    // occupied (on the immovable bottom row); below-left is off-grid,
    // which must count as blocked, not empty, or the grain would vanish
    // off the edge instead of resting.
    setCell(grid, 0, 3, 100);
    setCell(grid, 0, 4, 20);
    setCell(grid, 1, 4, 30);
    step(grid);
    expect(getCell(grid, 0, 3)).toBe(100);
    expect(getCell(grid, 0, 4)).toBe(20);
    expect(getCell(grid, 1, 4)).toBe(30);
  });

  it('never creates, destroys, or duplicates a grain byte value', () => {
    const grid = createGrid(6, 6);
    setCell(grid, 0, 0, 11);
    setCell(grid, 5, 0, 22);
    setCell(grid, 2, 2, 33);
    const totalBefore = Array.from(grid.cells).reduce((a, b) => a + b, 0);
    const countBefore = Array.from(grid.cells).filter((v) => v !== 0).length;
    for (let i = 0; i < 10; i++) step(grid);
    const totalAfter = Array.from(grid.cells).reduce((a, b) => a + b, 0);
    const countAfter = Array.from(grid.cells).filter((v) => v !== 0).length;
    expect(totalAfter).toBe(totalBefore);
    expect(countAfter).toBe(countBefore);
  });

  it('is idempotent on a fully-settled grid', () => {
    const grid = createGrid(4, 3);
    // Fill the bottom row completely — nothing can move further.
    setCell(grid, 0, 2, 1);
    setCell(grid, 1, 2, 2);
    setCell(grid, 2, 2, 3);
    setCell(grid, 3, 2, 4);
    step(grid);
    const snapshot = Array.from(grid.cells);
    step(grid);
    expect(Array.from(grid.cells)).toEqual(snapshot);
  });
});
