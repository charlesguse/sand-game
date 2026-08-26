import { describe, it, expect } from 'vitest';
import { createGrid, inBounds, getCell, setCell, clearGrid } from '../../../src/sim/grid';

describe('createGrid', () => {
  it('returns a fully-zeroed grid of the requested size', () => {
    const grid = createGrid(4, 3);
    expect(grid.width).toBe(4);
    expect(grid.height).toBe(3);
    expect(grid.cells.length).toBe(12);
    expect(grid.cells.every((v) => v === 0)).toBe(true);
  });
});

describe('inBounds', () => {
  const grid = createGrid(4, 3);

  it('is true for cells inside the grid', () => {
    expect(inBounds(grid, 0, 0)).toBe(true);
    expect(inBounds(grid, 3, 2)).toBe(true);
  });

  it('is false for cells outside the grid', () => {
    expect(inBounds(grid, -1, 0)).toBe(false);
    expect(inBounds(grid, 0, -1)).toBe(false);
    expect(inBounds(grid, 4, 0)).toBe(false);
    expect(inBounds(grid, 0, 3)).toBe(false);
  });
});

describe('getCell/setCell', () => {
  it('writes and reads a value in-bounds', () => {
    const grid = createGrid(4, 3);
    setCell(grid, 2, 1, 42);
    expect(getCell(grid, 2, 1)).toBe(42);
  });

  it('out-of-bounds reads return 0', () => {
    const grid = createGrid(4, 3);
    expect(getCell(grid, -1, 0)).toBe(0);
    expect(getCell(grid, 100, 100)).toBe(0);
  });

  it('out-of-bounds writes are no-ops', () => {
    const grid = createGrid(4, 3);
    setCell(grid, -1, 0, 5);
    setCell(grid, 100, 100, 5);
    expect(grid.cells.every((v) => v === 0)).toBe(true);
  });
});

describe('clearGrid', () => {
  it('zeroes every cell but preserves width/height', () => {
    const grid = createGrid(4, 3);
    setCell(grid, 0, 0, 9);
    setCell(grid, 3, 2, 7);
    clearGrid(grid);
    expect(grid.cells.every((v) => v === 0)).toBe(true);
    expect(grid.width).toBe(4);
    expect(grid.height).toBe(3);
  });
});
