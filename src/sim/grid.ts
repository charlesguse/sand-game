import { EMPTY, FOG, GRASS, STAR_POWER, type Grid } from './types';
import { randomShade, randomBurnLife, randomFogRiseCooldown } from './shade';

export const FOG_FIELD_SHARE_CEILING = 0.2;

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
    cloud: new Uint8Array(size),
    fogRiseCooldown: new Uint8Array(size),
    fogStuckSteps: new Uint16Array(size),
    fogAge: new Uint16Array(size),
    cloudRainDelay: new Uint16Array(size),
    fogCloudCount: 0,
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
  const wasFog = grid.elements[i] === FOG;
  const becomesFog = element === FOG;

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

  if (becomesFog && !wasFog) grid.fogCloudCount++;
  else if (!becomesFog && wasFog) grid.fogCloudCount--;

  if (element !== FOG) {
    grid.cloud[i] = 0;
    grid.fogRiseCooldown[i] = 0;
    grid.fogStuckSteps[i] = 0;
    grid.fogAge[i] = 0;
    grid.cloudRainDelay[i] = 0;
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
  grid.cloud.fill(0);
  grid.fogRiseCooldown.fill(0);
  grid.fogStuckSteps.fill(0);
  grid.fogAge.fill(0);
  grid.cloudRainDelay.fill(0);
  grid.fogCloudCount = 0;
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

/** The only way a fog cell is created. No-op if (x, y) is out of bounds or the sky is already full. */
export function createFog(grid: Grid, x: number, y: number): boolean {
  if (!inBounds(grid, x, y)) return false;
  if (grid.fogCloudCount >= Math.floor(grid.width * grid.height * FOG_FIELD_SHARE_CEILING)) return false;
  setCell(grid, x, y, FOG, randomShade());
  const i = y * grid.width + x;
  grid.cloud[i] = 0;
  grid.fogRiseCooldown[i] = randomFogRiseCooldown();
  grid.fogStuckSteps[i] = 0;
  grid.fogAge[i] = 0;
  setGlitter(grid, x, y, 1);
  return true;
}
