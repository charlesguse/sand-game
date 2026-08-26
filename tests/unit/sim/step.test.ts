import { describe, it, expect } from 'vitest';
import { createGrid, setCell, getElement } from '../../../src/sim/grid';
import { step } from '../../../src/sim/step';
import { EMPTY, SAND } from '../../../src/sim/types';

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
