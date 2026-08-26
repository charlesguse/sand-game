import type { Grid } from './types';

export function createGrid(width: number, height: number): Grid {
  return {
    width,
    height,
    cells: new Uint8ClampedArray(width * height),
  };
}

export function inBounds(grid: Grid, x: number, y: number): boolean {
  return x >= 0 && x < grid.width && y >= 0 && y < grid.height;
}

export function getCell(grid: Grid, x: number, y: number): number {
  if (!inBounds(grid, x, y)) return 0;
  return grid.cells[y * grid.width + x];
}

export function setCell(grid: Grid, x: number, y: number, value: number): void {
  if (!inBounds(grid, x, y)) return;
  grid.cells[y * grid.width + x] = value;
}

export function clearGrid(grid: Grid): void {
  grid.cells.fill(0);
}
