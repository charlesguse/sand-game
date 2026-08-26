import { describe, it, expect } from 'vitest';
import { createGrid, getCell, setCell } from '../../../src/sim/grid';
import { applyBrush } from '../../../src/sim/brush';

describe('applyBrush eraser', () => {
  it('zeroes every cell (occupied or empty) inside the footprint', () => {
    const grid = createGrid(10, 10);
    setCell(grid, 5, 5, 111);
    setCell(grid, 6, 5, 222);
    applyBrush(grid, 'eraser', 5, 5, 2, 0);
    expect(getCell(grid, 5, 5)).toBe(0);
    expect(getCell(grid, 6, 5)).toBe(0);
  });

  it('leaves cells outside the footprint untouched', () => {
    const grid = createGrid(10, 10);
    setCell(grid, 0, 0, 99);
    applyBrush(grid, 'eraser', 8, 8, 2, 0);
    expect(getCell(grid, 0, 0)).toBe(99);
  });

  it('clips silently at grid bounds', () => {
    const grid = createGrid(5, 5);
    setCell(grid, 0, 0, 50);
    expect(() => applyBrush(grid, 'eraser', 0, 0, 3, 0)).not.toThrow();
    expect(getCell(grid, 0, 0)).toBe(0);
  });
});
