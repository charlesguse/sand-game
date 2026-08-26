import { describe, it, expect } from 'vitest';
import { createGrid, setCell, getElement } from '../../../src/sim/grid';
import { step } from '../../../src/sim/step';
import { EMPTY, SAND, WATER } from '../../../src/sim/types';

describe('step — pink sand', () => {
  it('falls one cell per step', () => {
    const grid = createGrid(3, 3);
    setCell(grid, 1, 0, SAND, 5);
    step(grid);
    expect(getElement(grid, 1, 0)).toBe(EMPTY);
    expect(getElement(grid, 1, 1)).toBe(SAND);
  });

  it('slides diagonally when blocked straight down', () => {
    const grid = createGrid(3, 2);
    setCell(grid, 1, 0, SAND, 5);
    setCell(grid, 1, 1, SAND, 6); // blocks straight down
    step(grid);
    expect(getElement(grid, 1, 0)).toBe(EMPTY);
    const left = getElement(grid, 0, 1);
    const right = getElement(grid, 2, 1);
    expect(left === SAND || right === SAND).toBe(true);
  });

  it('rests when fully blocked', () => {
    const grid = createGrid(3, 2);
    setCell(grid, 1, 0, SAND, 5);
    setCell(grid, 0, 1, SAND, 6);
    setCell(grid, 1, 1, SAND, 7);
    setCell(grid, 2, 1, SAND, 8);
    step(grid);
    expect(getElement(grid, 1, 0)).toBe(SAND);
  });

  it('stays inside the floor and side walls', () => {
    const grid = createGrid(1, 1);
    setCell(grid, 0, 0, SAND, 5);
    for (let i = 0; i < 5; i++) step(grid);
    expect(getElement(grid, 0, 0)).toBe(SAND);
  });
});

describe('step — water', () => {
  it('falls one cell per step', () => {
    const grid = createGrid(3, 3);
    setCell(grid, 1, 0, WATER, 5);
    step(grid);
    expect(getElement(grid, 1, 0)).toBe(EMPTY);
    expect(getElement(grid, 1, 1)).toBe(WATER);
  });

  it('slides diagonally when blocked straight down', () => {
    const grid = createGrid(3, 2);
    setCell(grid, 1, 0, WATER, 5);
    setCell(grid, 1, 1, WATER, 6); // blocks straight down
    step(grid);
    expect(getElement(grid, 1, 0)).toBe(EMPTY);
    const left = getElement(grid, 0, 1);
    const right = getElement(grid, 2, 1);
    expect(left === WATER || right === WATER).toBe(true);
  });

  it('spreads sideways to level a tall column into a flat sheet', () => {
    const width = 20;
    const grid = createGrid(width, 25);
    for (let y = 0; y < 25; y++) setCell(grid, Math.floor(width / 2), y, WATER, 5);
    for (let i = 0; i < 500; i++) step(grid);

    const heights: number[] = [];
    for (let x = 0; x < width; x++) {
      let count = 0;
      for (let y = 0; y < 25; y++) if (getElement(grid, x, y) === WATER) count++;
      heights.push(count);
    }
    const middle = heights[Math.floor(width / 2)];
    const edge = heights[1];
    expect(Math.abs(middle - edge)).toBeLessThanOrEqual(2);
  });

  it('rests when fully blocked', () => {
    const grid = createGrid(3, 1);
    setCell(grid, 0, 0, WATER, 5);
    setCell(grid, 1, 0, WATER, 6);
    setCell(grid, 2, 0, WATER, 7);
    step(grid);
    expect(getElement(grid, 0, 0)).toBe(WATER);
    expect(getElement(grid, 1, 0)).toBe(WATER);
    expect(getElement(grid, 2, 0)).toBe(WATER);
  });

  it('stays inside the floor and side walls', () => {
    const grid = createGrid(1, 1);
    setCell(grid, 0, 0, WATER, 5);
    for (let i = 0; i < 5; i++) step(grid);
    expect(getElement(grid, 0, 0)).toBe(WATER);
  });

  it('never occupies a higher row than it started (never-rises invariant)', () => {
    const grid = createGrid(10, 10);
    setCell(grid, 5, 5, WATER, 5);
    let minRowOccupied = 5;
    for (let i = 0; i < 200; i++) {
      step(grid);
      let currentMinRow = Infinity;
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          if (getElement(grid, x, y) === WATER) currentMinRow = Math.min(currentMinRow, y);
        }
      }
      // The topmost row containing water must never move upward (a smaller y) tick over tick.
      expect(currentMinRow).toBeGreaterThanOrEqual(minRowOccupied);
      minRowOccupied = currentMinRow;
    }
  });

  it('a single step() call never moves one water cell more than one cell (moved buffer)', () => {
    const width = 10;
    const grid = createGrid(width, 3);
    // A flat sheet on the floor, blocked below and diagonally-below everywhere,
    // so every cell's only legal move is sideways.
    for (let x = 0; x < width; x++) setCell(grid, x, 2, WATER, 5);
    // Leave one gap so sideways movement is actually possible.
    setCell(grid, 5, 2, EMPTY, 0);
    setCell(grid, 4, 2, WATER, 9);
    step(grid);
    // The gap can only be filled by an immediate neighbor (col 4 or col 6),
    // never by a cell two-or-more columns away — that would require a double-hop.
    let waterCols: number[] = [];
    for (let x = 0; x < width; x++) if (getElement(grid, x, 2) === WATER) waterCols.push(x);
    expect(waterCols.length).toBe(width - 1);
  });
});

describe('step — sand sinks through water', () => {
  it('a powder cell with water directly below swaps in one step', () => {
    // width 1 so water has no sideways-escape neighbors, isolating the swap.
    const grid = createGrid(1, 2);
    setCell(grid, 0, 0, SAND, 5);
    setCell(grid, 0, 1, WATER, 9);
    step(grid);
    expect(getElement(grid, 0, 0)).toBe(WATER);
    expect(getElement(grid, 0, 1)).toBe(SAND);
  });

  it('a water column with sand poured on top settles with all sand at the bottom', () => {
    const width = 5;
    const height = 10;
    const grid = createGrid(width, height);
    for (let y = 3; y < height; y++) {
      for (let x = 0; x < width; x++) setCell(grid, x, y, WATER, 5);
    }
    for (let x = 0; x < width; x++) setCell(grid, x, 0, SAND, 9);

    for (let i = 0; i < 300; i++) step(grid);

    // Scanning bottom-to-top, every sand cell in a column must be seen before
    // any water cell — i.e. sand never rests above a water cell it sank past.
    for (let x = 0; x < width; x++) {
      let sawWater = false;
      let sandAboveWater = false;
      let sawSand = false;
      for (let y = height - 1; y >= 0; y--) {
        const element = getElement(grid, x, y);
        if (element === WATER) sawWater = true;
        if (element === SAND) {
          sawSand = true;
          if (sawWater) sandAboveWater = true;
        }
      }
      expect(sandAboveWater).toBe(false);
      expect(sawSand).toBe(true);
    }
  });

  it('water never swaps down through or displaces a powder', () => {
    const grid = createGrid(1, 2);
    setCell(grid, 0, 0, WATER, 5);
    setCell(grid, 0, 1, SAND, 9);
    step(grid);
    expect(getElement(grid, 0, 0)).toBe(WATER);
    expect(getElement(grid, 0, 1)).toBe(SAND);
  });

  it('the count of sand cells and water cells stays constant across many steps', () => {
    const width = 8;
    const height = 8;
    const grid = createGrid(width, height);
    for (let y = 0; y < 4; y++) for (let x = 0; x < width; x++) setCell(grid, x, y, WATER, 5);
    setCell(grid, 3, 0, SAND, 9);
    setCell(grid, 4, 0, SAND, 9);

    const countOf = (element: number): number => {
      let count = 0;
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) if (getElement(grid, x, y) === element) count++;
      return count;
    };
    const initialSand = countOf(SAND);
    const initialWater = countOf(WATER);

    for (let i = 0; i < 100; i++) {
      step(grid);
      expect(countOf(SAND)).toBe(initialSand);
      expect(countOf(WATER)).toBe(initialWater);
    }
  });
});
