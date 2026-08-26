import { EMPTY, type Grid } from './types';

export function createGrid(width: number, height: number): Grid {
  const size = width * height;
  return {
    width,
    height,
    elements: new Uint8Array(size),
    shades: new Uint8Array(size),
    moved: new Uint8Array(size),
    hues: new Uint8Array(size),
    glitter: new Uint8Array(size),
  };
}

export function inBounds(grid: Grid, x: number, y: number): boolean {
  return x >= 0 && x < grid.width && y >= 0 && y < grid.height;
}

export function getElement(grid: Grid, x: number, y: number): number {
  if (!inBounds(grid, x, y)) return EMPTY;
  return grid.elements[y * grid.width + x];
}

export function getShade(grid: Grid, x: number, y: number): number {
  if (!inBounds(grid, x, y)) return 0;
  return grid.shades[y * grid.width + x];
}

export function setCell(grid: Grid, x: number, y: number, element: number, shade: number): void {
  if (!inBounds(grid, x, y)) return;
  const i = y * grid.width + x;
  grid.elements[i] = element;
  grid.shades[i] = element === EMPTY ? 0 : shade;
  grid.glitter[i] = 0;
}

export function clearGrid(grid: Grid): void {
  grid.elements.fill(EMPTY);
  grid.glitter.fill(0);
}

export function setGlitter(grid: Grid, x: number, y: number, value: 0 | 1): void {
  if (!inBounds(grid, x, y)) return;
  grid.glitter[y * grid.width + x] = value;
}

export function getGlitter(grid: Grid, x: number, y: number): boolean {
  if (!inBounds(grid, x, y)) return false;
  return grid.glitter[y * grid.width + x] === 1;
}
