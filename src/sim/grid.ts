import { EMPTY, GRASS, STAR_POWER, type Grid } from './types';
import { randomShade, randomBurnLife } from './shade';

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
    grassHeight: new Uint8Array(size),
    grassCooldown: new Uint8Array(size),
    grassCount: 0,
    starPowerAge: new Uint8Array(size),
    starPowerLife: new Uint8Array(size),
    starPowerFuelled: new Uint8Array(size),
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
  const wasGrass = grid.elements[i] === GRASS;
  const becomesGrass = element === GRASS;

  grid.elements[i] = element;
  grid.shades[i] = element === EMPTY ? 0 : shade;
  grid.glitter[i] = 0;

  if (becomesGrass) {
    const belowY = y + 1;
    const belowIndex = belowY < grid.height ? belowY * grid.width + x : -1;
    grid.grassHeight[i] =
      belowIndex >= 0 && grid.elements[belowIndex] === GRASS
        ? Math.min(255, grid.grassHeight[belowIndex] + 1)
        : 0;
  } else {
    grid.grassHeight[i] = 0;
  }
  grid.grassCooldown[i] = 0;

  if (becomesGrass && !wasGrass) grid.grassCount++;
  else if (!becomesGrass && wasGrass) grid.grassCount--;

  grid.starPowerAge[i] = 0;
  if (element !== STAR_POWER) {
    grid.starPowerLife[i] = 0;
    grid.starPowerFuelled[i] = 0;
  }
}

export function clearGrid(grid: Grid): void {
  grid.elements.fill(EMPTY);
  grid.glitter.fill(0);
  grid.grassHeight.fill(0);
  grid.grassCooldown.fill(0);
  grid.grassCount = 0;
  grid.starPowerAge.fill(0);
  grid.starPowerLife.fill(0);
  grid.starPowerFuelled.fill(0);
}

export function setGlitter(grid: Grid, x: number, y: number, value: 0 | 1): void {
  if (!inBounds(grid, x, y)) return;
  grid.glitter[y * grid.width + x] = value;
}

export function getGlitter(grid: Grid, x: number, y: number): boolean {
  if (!inBounds(grid, x, y)) return false;
  return grid.glitter[y * grid.width + x] === 1;
}

/** The only way a star power cell is created. No-op if (x, y) is out of bounds. */
export function igniteStarPower(grid: Grid, x: number, y: number, fuelled: boolean): void {
  if (!inBounds(grid, x, y)) return;
  setCell(grid, x, y, STAR_POWER, randomShade());
  const i = y * grid.width + x;
  grid.starPowerFuelled[i] = fuelled ? 1 : 0;
  grid.starPowerLife[i] = randomBurnLife();
  setGlitter(grid, x, y, 1);
}
