import { describe, it, expect } from 'vitest';
import { createGrid, setCell, getElement, getShade } from '../../../src/sim/grid';
import { step } from '../../../src/sim/step';
import { EMPTY, WATER, GRASS } from '../../../src/sim/types';

describe('grass — never moves (FR-004, SC-002)', () => {
  it('a planted grass cell stays at its (x, y) across any number of step() calls with nothing else on the field', () => {
    const grid = createGrid(5, 5);
    setCell(grid, 2, 4, GRASS, 10);
    for (let i = 0; i < 200; i++) step(grid);
    expect(getElement(grid, 2, 4)).toBe(GRASS);
    expect(getShade(grid, 2, 4)).toBe(10);
  });

  it('grass planted with EMPTY directly beneath it (mid-air) is its own root and does not fall', () => {
    const grid = createGrid(5, 5);
    setCell(grid, 2, 0, GRASS, 10);
    expect(grid.grassHeight[0 * grid.width + 2]).toBe(0);
    for (let i = 0; i < 200; i++) step(grid);
    expect(getElement(grid, 2, 0)).toBe(GRASS);
    for (let y = 1; y < 5; y++) expect(getElement(grid, 2, y)).toBe(EMPTY);
  });
});
