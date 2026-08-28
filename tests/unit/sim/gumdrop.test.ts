import { describe, it, expect } from 'vitest';
import { createGrid, setCell } from '../../../src/sim/grid';
import { step } from '../../../src/sim/step';
import { EMPTY, GUMDROP, SAND, type Grid } from '../../../src/sim/types';

function at(grid: Grid, x: number, y: number): number {
  return grid.elements[y * grid.width + x];
}

function settle(grid: Grid, steps: number): void {
  for (let i = 0; i < steps; i++) step(grid);
}

describe('gumdrops fall', () => {
  it('falls straight down through empty space', () => {
    const grid = createGrid(9, 9);
    setCell(grid, 4, 0, GUMDROP, 0);
    step(grid);
    expect(at(grid, 4, 0)).toBe(EMPTY);
    expect(at(grid, 4, 1)).toBe(GUMDROP);
  });

  it('comes to rest on the floor', () => {
    const grid = createGrid(9, 9);
    setCell(grid, 4, 0, GUMDROP, 0);
    settle(grid, 30);
    expect(at(grid, 4, 8)).toBe(GUMDROP);
  });

  it('stacks on top of another gumdrop instead of displacing it', () => {
    const grid = createGrid(9, 9);
    setCell(grid, 4, 8, GUMDROP, 0);
    setCell(grid, 4, 0, GUMDROP, 0);
    settle(grid, 30);
    expect(at(grid, 4, 8)).toBe(GUMDROP);
    expect(at(grid, 4, 7)).toBe(GUMDROP);
  });
});

describe('gumdrops heap instead of flowing flat', () => {
  it('keeps a tall column standing, where sand would collapse into a dune', () => {
    const gumdrops = createGrid(11, 11);
    for (let y = 4; y <= 10; y++) setCell(gumdrops, 5, y, GUMDROP, 0);
    settle(gumdrops, 60);

    const sand = createGrid(11, 11);
    for (let y = 4; y <= 10; y++) setCell(sand, 5, y, SAND, 0);
    settle(sand, 60);

    const columnHeight = (grid: Grid, element: number) => {
      let count = 0;
      for (let y = 0; y < grid.height; y++) if (at(grid, 5, y) === element) count++;
      return count;
    };

    expect(columnHeight(gumdrops, GUMDROP)).toBe(7);
    expect(columnHeight(sand, SAND)).toBeLessThan(7);
  });

  it('does not slide off the side of a pile', () => {
    const grid = createGrid(11, 11);
    setCell(grid, 5, 10, GUMDROP, 0);
    setCell(grid, 5, 9, GUMDROP, 0);
    settle(grid, 40);
    expect(at(grid, 4, 10)).toBe(EMPTY);
    expect(at(grid, 6, 10)).toBe(EMPTY);
    expect(at(grid, 5, 9)).toBe(GUMDROP);
  });
});

describe('gumdrops are candy-coloured', () => {
  it('gives gumdrops a hue so a poured handful is multicoloured', () => {
    const grid = createGrid(9, 9);
    setCell(grid, 1, 0, GUMDROP, 0);
    setCell(grid, 5, 0, GUMDROP, 0);
    expect(grid.hues[0 * grid.width + 1]).toBeGreaterThanOrEqual(0);
    expect(grid.hues[0 * grid.width + 5]).toBeGreaterThanOrEqual(0);
  });
});
