import { describe, it, expect } from 'vitest';
import { createGrid, setCell, getElement, clearGrid } from '../../../src/sim/grid';
import { applyBrush } from '../../../src/sim/brush';
import { EMPTY, SAND, WATER, DIRT } from '../../../src/sim/types';

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

describe('brush — magic purple dirt', () => {
  it('the dirt brush paints into empty and water-occupied cells exactly like the sand brush', () => {
    const emptyGrid = createGrid(5, 5);
    applyBrush(emptyGrid, 'dirt', 2, 2, 1, 10);
    expect(getElement(emptyGrid, 2, 2)).toBe(DIRT);
    expect(getElement(emptyGrid, 1, 2)).toBe(DIRT);

    const waterGrid = createGrid(5, 5);
    setCell(waterGrid, 2, 2, WATER, 50);
    applyBrush(waterGrid, 'dirt', 2, 2, 0, 10);
    expect(getElement(waterGrid, 2, 2)).toBe(DIRT);
    expect(waterGrid.shades[2 * 5 + 2]).toBe(10);
  });

  it('the dirt brush is never overwritten by the water brush', () => {
    const grid = createGrid(5, 5);
    setCell(grid, 2, 2, DIRT, 50);
    applyBrush(grid, 'water', 2, 2, 0, 10);
    expect(getElement(grid, 2, 2)).toBe(DIRT);
    expect(grid.shades[2 * 5 + 2]).toBe(50);
  });
});

describe('brush — eraser and clear-all across every element', () => {
  it('the eraser empties sand, water, and dirt cells alike inside its footprint', () => {
    const grid = createGrid(5, 1);
    setCell(grid, 0, 0, SAND, 5);
    setCell(grid, 1, 0, WATER, 5);
    setCell(grid, 2, 0, DIRT, 5);
    applyBrush(grid, 'eraser', 2, 0, 3, 0);
    for (let x = 0; x < 5; x++) expect(getElement(grid, x, 0)).toBe(EMPTY);
  });

  it('clearGrid empties a grid populated with all three elements', () => {
    const grid = createGrid(3, 1);
    setCell(grid, 0, 0, SAND, 5);
    setCell(grid, 1, 0, WATER, 5);
    setCell(grid, 2, 0, DIRT, 5);
    clearGrid(grid);
    expect([...grid.elements]).toEqual(new Array(3).fill(0));
  });
});
