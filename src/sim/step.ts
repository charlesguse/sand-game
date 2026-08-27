import { EMPTY, WATER, GRASS, RAINBOW_SAND, STAR_POWER, FOG, type Grid } from './types';
import { isPowder, isLiquid, isSolid } from './element';
import { setCell, setGlitter, igniteStarPower, createFog } from './grid';
import { randomShade, randomHue, randomCloudRainDelay, randomFogRiseCooldown } from './shade';

const HUE_STEP = 5;
const GRASS_HEIGHT_CEILING = 12;
const GRASS_FIELD_SHARE_CEILING = 0.25;
const GRASS_ABSORB_COOLDOWN = 10;
const STAR_POWER_IGNITE_DELAY = 10;
const FOG_MAX_LIFE = 1800;
const FOG_STUCK_LIMIT = 300;

function moveCell(grid: Grid, fromIndex: number, toIndex: number): void {
  grid.elements[toIndex] = grid.elements[fromIndex];
  grid.shades[toIndex] = grid.shades[fromIndex];
  grid.hues[toIndex] = grid.hues[fromIndex];
  grid.glitter[toIndex] = grid.glitter[fromIndex];
  grid.cloud[toIndex] = grid.cloud[fromIndex];
  grid.fogRiseCooldown[toIndex] = grid.fogRiseCooldown[fromIndex];
  grid.fogStuckSteps[toIndex] = grid.fogStuckSteps[fromIndex];
  grid.fogAge[toIndex] = grid.fogAge[fromIndex];
  grid.cloudRainDelay[toIndex] = grid.cloudRainDelay[fromIndex];
  grid.elements[fromIndex] = EMPTY;
  grid.shades[fromIndex] = 0;
  grid.hues[fromIndex] = 0;
  grid.glitter[fromIndex] = 0;
  grid.cloud[fromIndex] = 0;
  grid.fogRiseCooldown[fromIndex] = 0;
  grid.fogStuckSteps[fromIndex] = 0;
  grid.fogAge[fromIndex] = 0;
  grid.cloudRainDelay[fromIndex] = 0;
  grid.moved[fromIndex] = 1;
  grid.moved[toIndex] = 1;
  if (grid.elements[toIndex] === RAINBOW_SAND) {
    grid.hues[toIndex] = (grid.hues[toIndex] + HUE_STEP) % 256;
  }
}

function swapCells(grid: Grid, aIndex: number, bIndex: number): void {
  const aElement = grid.elements[aIndex];
  const aShade = grid.shades[aIndex];
  const aHue = grid.hues[aIndex];
  const aGlitter = grid.glitter[aIndex];
  const aCloud = grid.cloud[aIndex];
  const aFogRiseCooldown = grid.fogRiseCooldown[aIndex];
  const aFogStuckSteps = grid.fogStuckSteps[aIndex];
  const aFogAge = grid.fogAge[aIndex];
  const aCloudRainDelay = grid.cloudRainDelay[aIndex];
  grid.elements[aIndex] = grid.elements[bIndex];
  grid.shades[aIndex] = grid.shades[bIndex];
  grid.hues[aIndex] = grid.hues[bIndex];
  grid.glitter[aIndex] = grid.glitter[bIndex];
  grid.cloud[aIndex] = grid.cloud[bIndex];
  grid.fogRiseCooldown[aIndex] = grid.fogRiseCooldown[bIndex];
  grid.fogStuckSteps[aIndex] = grid.fogStuckSteps[bIndex];
  grid.fogAge[aIndex] = grid.fogAge[bIndex];
  grid.cloudRainDelay[aIndex] = grid.cloudRainDelay[bIndex];
  grid.elements[bIndex] = aElement;
  grid.shades[bIndex] = aShade;
  grid.hues[bIndex] = aHue;
  grid.glitter[bIndex] = aGlitter;
  grid.cloud[bIndex] = aCloud;
  grid.fogRiseCooldown[bIndex] = aFogRiseCooldown;
  grid.fogStuckSteps[bIndex] = aFogStuckSteps;
  grid.fogAge[bIndex] = aFogAge;
  grid.cloudRainDelay[bIndex] = aCloudRainDelay;
  grid.moved[aIndex] = 1;
  grid.moved[bIndex] = 1;
  if (grid.elements[aIndex] === RAINBOW_SAND) {
    grid.hues[aIndex] = (grid.hues[aIndex] + HUE_STEP) % 256;
  }
  if (grid.elements[bIndex] === RAINBOW_SAND) {
    grid.hues[bIndex] = (grid.hues[bIndex] + HUE_STEP) % 256;
  }
}

function stepPowder(grid: Grid, x: number, y: number, i: number): void {
  const { width, height, elements } = grid;
  const belowY = y + 1;
  const belowInBounds = belowY < height;
  const belowIndex = belowInBounds ? belowY * width + x : -1;

  if (belowInBounds && elements[belowIndex] === EMPTY) {
    moveCell(grid, i, belowIndex);
    return;
  }

  if (belowInBounds && (isLiquid(elements[belowIndex]) || elements[belowIndex] === FOG)) {
    swapCells(grid, i, belowIndex);
    return;
  }

  const leftX = x - 1;
  const rightX = x + 1;
  const belowLeftIndex = belowInBounds && leftX >= 0 ? belowY * width + leftX : -1;
  const belowRightIndex = belowInBounds && rightX < width ? belowY * width + rightX : -1;
  const belowLeftOpen =
    belowLeftIndex >= 0 &&
    (elements[belowLeftIndex] === EMPTY || isLiquid(elements[belowLeftIndex]));
  const belowRightOpen =
    belowRightIndex >= 0 &&
    (elements[belowRightIndex] === EMPTY || isLiquid(elements[belowRightIndex]));

  const enter = (index: number): void => {
    if (elements[index] === EMPTY) moveCell(grid, i, index);
    else swapCells(grid, i, index);
  };

  if (belowLeftOpen && belowRightOpen) {
    const goLeft = Math.random() < 0.5;
    enter(goLeft ? belowLeftIndex : belowRightIndex);
  } else if (belowLeftOpen) {
    enter(belowLeftIndex);
  } else if (belowRightOpen) {
    enter(belowRightIndex);
  }
  // else: rest, no change.
}

function stepLiquid(grid: Grid, x: number, y: number, i: number): void {
  const { width, height, elements } = grid;
  const belowY = y + 1;
  const belowInBounds = belowY < height;
  const belowIndex = belowInBounds ? belowY * width + x : -1;

  if (belowInBounds && elements[belowIndex] === EMPTY) {
    moveCell(grid, i, belowIndex);
    return;
  }

  if (belowInBounds && elements[belowIndex] === FOG) {
    swapCells(grid, i, belowIndex);
    return;
  }

  const leftX = x - 1;
  const rightX = x + 1;
  const belowLeftOpen = belowInBounds && leftX >= 0 && elements[belowY * width + leftX] === EMPTY;
  const belowRightOpen =
    belowInBounds && rightX < width && elements[belowY * width + rightX] === EMPTY;

  if (belowLeftOpen && belowRightOpen) {
    const goLeft = Math.random() < 0.5;
    moveCell(grid, i, belowY * width + (goLeft ? leftX : rightX));
    return;
  } else if (belowLeftOpen) {
    moveCell(grid, i, belowY * width + leftX);
    return;
  } else if (belowRightOpen) {
    moveCell(grid, i, belowY * width + rightX);
    return;
  }

  const sideLeftOpen = leftX >= 0 && elements[y * width + leftX] === EMPTY;
  const sideRightOpen = rightX < width && elements[y * width + rightX] === EMPTY;

  if (sideLeftOpen && sideRightOpen) {
    const goLeft = Math.random() < 0.5;
    moveCell(grid, i, y * width + (goLeft ? leftX : rightX));
  } else if (sideLeftOpen) {
    moveCell(grid, i, y * width + leftX);
  } else if (sideRightOpen) {
    moveCell(grid, i, y * width + rightX);
  }
  // else: rest, no change.
}

function becomeCloud(grid: Grid, _x: number, _y: number, i: number): void {
  grid.cloud[i] = 1;
  grid.fogAge[i] = 0;
  grid.cloudRainDelay[i] = randomCloudRainDelay();
  grid.fogRiseCooldown[i] = 0;
  grid.fogStuckSteps[i] = 0;
}

function condenseFog(grid: Grid, x: number, y: number, _i: number): void {
  setCell(grid, x, y, WATER, randomShade());
}

function rain(grid: Grid, x: number, y: number, _i: number): void {
  setCell(grid, x, y, WATER, randomShade());
}

function stepCloud(grid: Grid, x: number, y: number, i: number): void {
  const age = grid.fogAge[i] + 1;
  if (age >= grid.cloudRainDelay[i]) {
    rain(grid, x, y, i);
    return;
  }
  grid.fogAge[i] = age;
}

/** Picks the wander-rise candidate order for this attempt: the preferred offset, then straight up, then the remaining diagonal — with the straight/diagonal fallback order itself randomized when the preferred offset is 0 (research.md §5). */
function pickWanderOrder(): number[] {
  const preferred = Math.floor(Math.random() * 3) - 1; // -1, 0, or +1
  if (preferred === -1) return [-1, 0, 1];
  if (preferred === 1) return [1, 0, -1];
  return Math.random() < 0.5 ? [0, -1, 1] : [0, 1, -1];
}

function stepFog(grid: Grid, x: number, y: number, i: number): void {
  if (grid.cloud[i] === 1) {
    stepCloud(grid, x, y, i);
    return;
  }

  const age = grid.fogAge[i] + 1;
  if (age >= FOG_MAX_LIFE) {
    condenseFog(grid, x, y, i);
    return;
  }
  grid.fogAge[i] = age;

  if (grid.fogRiseCooldown[i] > 0) {
    grid.fogRiseCooldown[i]--;
    if (grid.fogRiseCooldown[i] > 0) {
      grid.fogStuckSteps[i]++;
      if (grid.fogStuckSteps[i] >= FOG_STUCK_LIMIT) {
        condenseFog(grid, x, y, i);
      }
      return;
    }
    // Cooldown reached 0 on this very step — fall through and attempt the rise now,
    // so a freshly-drawn cooldown of c steps produces a rise exactly c steps later (FR-012, SC-005).
  }

  const { width, elements } = grid;
  const aboveY = y - 1;
  if (aboveY < 0 || (elements[aboveY * width + x] === FOG && grid.cloud[aboveY * width + x] === 1)) {
    becomeCloud(grid, x, y, i);
    return;
  }

  const order = pickWanderOrder();
  for (const dx of order) {
    const nx = x + dx;
    if (nx < 0 || nx >= width) continue;
    const targetIndex = aboveY * width + nx;
    const targetElement = elements[targetIndex];
    const legal = dx === 0 ? targetElement === EMPTY || targetElement === WATER : targetElement === EMPTY;
    if (!legal) continue;

    if (targetElement === EMPTY) moveCell(grid, i, targetIndex);
    else swapCells(grid, i, targetIndex);
    grid.fogRiseCooldown[targetIndex] = randomFogRiseCooldown();
    grid.fogStuckSteps[targetIndex] = 0;
    return;
  }

  grid.fogStuckSteps[i]++;
  if (grid.fogStuckSteps[i] >= FOG_STUCK_LIMIT) {
    condenseFog(grid, x, y, i);
  }
}

function isSupported(grid: Grid, tx: number, ty: number): boolean {
  const belowY = ty + 1;
  if (belowY >= grid.height) return true;
  return isSolid(grid.elements[belowY * grid.width + tx]);
}

function computeWouldBeHeight(grid: Grid, tx: number, ty: number): number {
  const belowY = ty + 1;
  if (belowY >= grid.height) return 0;
  const belowIndex = belowY * grid.width + tx;
  return grid.elements[belowIndex] === GRASS ? Math.min(255, grid.grassHeight[belowIndex] + 1) : 0;
}

function isEligibleTarget(grid: Grid, tx: number, ty: number): boolean {
  if (tx < 0 || tx >= grid.width || ty < 0 || ty >= grid.height) return false;
  const index = ty * grid.width + tx;
  if (grid.elements[index] !== EMPTY) return false;
  if (grid.grassCount >= Math.floor(grid.width * grid.height * GRASS_FIELD_SHARE_CEILING)) return false;
  if (computeWouldBeHeight(grid, tx, ty) > GRASS_HEIGHT_CEILING) return false;
  return true;
}

function pickGrowthTargetIndex(grid: Grid, x: number, y: number): number {
  const { width } = grid;
  const aboveY = y - 1;

  if (isEligibleTarget(grid, x, aboveY)) return aboveY * width + x;

  const leftX = x - 1;
  const rightX = x + 1;
  const diagLeftEligible = isEligibleTarget(grid, leftX, aboveY);
  const diagRightEligible = isEligibleTarget(grid, rightX, aboveY);
  if (diagLeftEligible && diagRightEligible) {
    return Math.random() < 0.5 ? aboveY * width + leftX : aboveY * width + rightX;
  } else if (diagLeftEligible) {
    return aboveY * width + leftX;
  } else if (diagRightEligible) {
    return aboveY * width + rightX;
  }

  const sidewaysLeftEligible = isEligibleTarget(grid, leftX, y) && isSupported(grid, leftX, y);
  const sidewaysRightEligible = isEligibleTarget(grid, rightX, y) && isSupported(grid, rightX, y);
  if (sidewaysLeftEligible && sidewaysRightEligible) {
    return Math.random() < 0.5 ? y * width + leftX : y * width + rightX;
  } else if (sidewaysLeftEligible) {
    return y * width + leftX;
  } else if (sidewaysRightEligible) {
    return y * width + rightX;
  }

  return -1;
}

function stepGrass(grid: Grid, x: number, y: number, i: number): void {
  if (grid.grassCooldown[i] > 0) {
    grid.grassCooldown[i]--;
    return;
  }

  const { width, height, elements } = grid;
  const upY = y - 1;
  const downY = y + 1;
  const leftX = x - 1;
  const rightX = x + 1;

  let waterIndex = -1;
  if (upY >= 0 && elements[upY * width + x] === WATER) {
    waterIndex = upY * width + x;
  } else if (downY < height && elements[downY * width + x] === WATER) {
    waterIndex = downY * width + x;
  } else if (leftX >= 0 && elements[y * width + leftX] === WATER) {
    waterIndex = y * width + leftX;
  } else if (rightX < width && elements[y * width + rightX] === WATER) {
    waterIndex = y * width + rightX;
  }
  if (waterIndex === -1) return;

  const targetIndex = pickGrowthTargetIndex(grid, x, y);
  if (targetIndex === -1) return;

  setCell(grid, waterIndex % width, Math.floor(waterIndex / width), EMPTY, 0);
  setCell(grid, targetIndex % width, Math.floor(targetIndex / width), GRASS, randomShade());
  grid.moved[targetIndex] = 1;
  grid.grassCooldown[i] = GRASS_ABSORB_COOLDOWN;
}

function extinguishStarPower(grid: Grid, x: number, y: number, i: number): void {
  if (grid.starPowerFuelled[i]) {
    setCell(grid, x, y, RAINBOW_SAND, randomShade());
    grid.hues[i] = randomHue();
    setGlitter(grid, x, y, 1);
  } else {
    setCell(grid, x, y, EMPTY, 0);
  }
}

function stepStarPower(grid: Grid, x: number, y: number, i: number): void {
  const { width, height, elements } = grid;
  const upY = y - 1;
  const downY = y + 1;
  const leftX = x - 1;
  const rightX = x + 1;

  let quenchWaterIndex = -1;
  if (upY >= 0 && elements[upY * width + x] === WATER) {
    quenchWaterIndex = upY * width + x;
  } else if (downY < height && elements[downY * width + x] === WATER) {
    quenchWaterIndex = downY * width + x;
  } else if (leftX >= 0 && elements[y * width + leftX] === WATER) {
    quenchWaterIndex = y * width + leftX;
  } else if (rightX < width && elements[y * width + rightX] === WATER) {
    quenchWaterIndex = y * width + rightX;
  }
  if (quenchWaterIndex !== -1) {
    const fuelled = grid.starPowerFuelled[i] === 1;
    extinguishStarPower(grid, x, y, i);
    if (!fuelled) {
      const created = createFog(grid, quenchWaterIndex % width, Math.floor(quenchWaterIndex / width));
      if (created) grid.moved[quenchWaterIndex] = 1;
    }
    return;
  }

  const age = grid.starPowerAge[i] + 1;
  if (age >= grid.starPowerLife[i]) {
    extinguishStarPower(grid, x, y, i);
    return;
  }
  grid.starPowerAge[i] = age;

  if (age < STAR_POWER_IGNITE_DELAY) return;

  for (let dy = -1; dy <= 1; dy++) {
    const ny = y + dy;
    if (ny < 0 || ny >= height) continue;
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      if (nx < 0 || nx >= width) continue;
      const ni = ny * width + nx;
      if (elements[ni] === GRASS) {
        igniteStarPower(grid, nx, ny, true);
        grid.moved[ni] = 1;
      }
    }
  }
}

/** Advances the simulation by one tick, mutating the grid in place. */
export function step(grid: Grid): void {
  const { width, height, elements, moved } = grid;
  moved.fill(0);

  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (moved[i]) continue;
      const element = elements[i];
      if (element === EMPTY) continue;

      if (isPowder(element)) {
        stepPowder(grid, x, y, i);
      } else if (isLiquid(element)) {
        stepLiquid(grid, x, y, i);
      } else if (element === GRASS) {
        stepGrass(grid, x, y, i);
      } else if (element === STAR_POWER) {
        stepStarPower(grid, x, y, i);
      } else if (element === FOG) {
        stepFog(grid, x, y, i);
      }
    }
  }
}
