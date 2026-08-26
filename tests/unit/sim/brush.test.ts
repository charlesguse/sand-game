import { describe, it, expect } from 'vitest';
import { createGrid, setCell, getElement, clearGrid } from '../../../src/sim/grid';
import { applyBrush } from '../../../src/sim/brush';
import { EMPTY, SAND, WATER } from '../../../src/sim/types';

describe('brush — pink sand and eraser', () => {
  it('the sand brush paints only into empty footprint cells', () => {
    const grid = createGrid(5, 5);
    setCell(grid, 2, 2, SAND, 99); // pre-occupied — should be preserved
    applyBrush(grid, 'sand', 2, 2, 1, 10);
    expect(grid.shades[2 * 5 + 2]).toBe(99); // untouched, still original shade
    expect(getElement(grid, 1, 2)).toBe(SAND);
    expect(getElement(grid, 3, 2)).toBe(SAND);
  });

  it('the eraser clears any occupied cell', () => {
    const grid = createGrid(5, 5);
    applyBrush(grid, 'sand', 2, 2, 2, 10);
    applyBrush(grid, 'eraser', 2, 2, 2, 0);
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        expect(getElement(grid, x, y)).toBe(EMPTY);
      }
    }
  });

  it('clearGrid empties a populated grid', () => {
    const grid = createGrid(3, 3);
    applyBrush(grid, 'sand', 1, 1, 2, 10);
    clearGrid(grid);
    expect([...grid.elements]).toEqual(new Array(9).fill(0));
  });
});

describe('brush — water', () => {
  it('the water brush paints only into empty footprint cells and never overwrites sand', () => {
    const grid = createGrid(5, 5);
    setCell(grid, 2, 2, SAND, 99); // pre-occupied by sand — should be preserved
    applyBrush(grid, 'water', 2, 2, 1, 10);
    expect(getElement(grid, 2, 2)).toBe(SAND);
    expect(grid.shades[2 * 5 + 2]).toBe(99);
    expect(getElement(grid, 1, 2)).toBe(WATER);
    expect(getElement(grid, 3, 2)).toBe(WATER);
  });
});

describe('brush — sand overwrites water', () => {
  it('the sand brush overwrites water-occupied cells', () => {
    const grid = createGrid(5, 5);
    setCell(grid, 2, 2, WATER, 50);
    applyBrush(grid, 'sand', 2, 2, 0, 10);
    expect(getElement(grid, 2, 2)).toBe(SAND);
    expect(grid.shades[2 * 5 + 2]).toBe(10);
  });

  it('the water brush never overwrites a sand-occupied cell', () => {
    const grid = createGrid(5, 5);
    setCell(grid, 2, 2, SAND, 50);
    applyBrush(grid, 'water', 2, 2, 0, 10);
    expect(getElement(grid, 2, 2)).toBe(SAND);
    expect(grid.shades[2 * 5 + 2]).toBe(50);
  });
});
