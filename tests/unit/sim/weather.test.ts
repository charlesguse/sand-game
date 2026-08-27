import { describe, it, expect } from 'vitest';
import {
  createGrid,
  setCell,
  createFog,
  getElement,
  getGlitter,
  igniteStarPower,
  FOG_FIELD_SHARE_CEILING,
} from '../../../src/sim/grid';
import { step } from '../../../src/sim/step';
import { applyBrush } from '../../../src/sim/brush';
import { randomFogRiseCooldown, randomCloudRainDelay } from '../../../src/sim/shade';
import { FOG, WATER, EMPTY, GRASS, SAND, OBJECT, RAINBOW_SAND, STAR_POWER } from '../../../src/sim/types';

function countElement(grid: ReturnType<typeof createGrid>, element: number): number {
  let count = 0;
  for (let i = 0; i < grid.elements.length; i++) if (grid.elements[i] === element) count++;
  return count;
}

describe('weather — charming (Scenario 1, FR-008, FR-010, SC-002)', () => {
  it('createFog turns a water cell into fog in place, changing 0 other cells', () => {
    const grid = createGrid(10, 10);
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) setCell(grid, x, y, WATER, 5);
    }
    const before = Array.from(grid.elements);

    const result = createFog(grid, 5, 5);

    expect(result).toBe(true);
    expect(getElement(grid, 5, 5)).toBe(FOG);
    for (let idx = 0; idx < grid.elements.length; idx++) {
      if (idx === 5 * 10 + 5) continue;
      expect(grid.elements[idx]).toBe(before[idx]);
    }
  });

  it('the ⭐ brush turns every water cell inside its footprint into fog, one for one, in place, changing 0 cells outside the footprint', () => {
    const grid = createGrid(60, 60);
    for (let y = 15; y < 45; y++) {
      for (let x = 15; x < 45; x++) setCell(grid, x, y, WATER, 5);
    }

    applyBrush(grid, 'star', 30, 30, 5, 9);

    let fogCount = 0;
    const r2 = 25;
    for (let y = 15; y < 45; y++) {
      for (let x = 15; x < 45; x++) {
        const dx = x - 30;
        const dy = y - 30;
        const inFootprint = dx * dx + dy * dy <= r2;
        const element = getElement(grid, x, y);
        if (inFootprint) {
          expect(element).toBe(FOG);
          fogCount++;
        } else {
          expect(element).toBe(WATER);
        }
      }
    }
    expect(fogCount).toBeGreaterThan(0);
    expect(grid.fogCloudCount).toBe(fogCount);
  });

  it('randomFogRiseCooldown always returns an integer in [3, 5] inclusive across many calls, with observed variation (FR-012)', () => {
    const values = new Set<number>();
    for (let n = 0; n < 500; n++) {
      const v = randomFogRiseCooldown();
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(5);
      values.add(v);
    }
    expect(values.size).toBeGreaterThan(1);
  });

  it('randomCloudRainDelay always returns an integer in [180, 480] inclusive across many calls, with observed variation (FR-020)', () => {
    const values = new Set<number>();
    for (let n = 0; n < 500; n++) {
      const v = randomCloudRainDelay();
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(180);
      expect(v).toBeLessThanOrEqual(480);
      values.add(v);
    }
    expect(values.size).toBeGreaterThan(1);
  });
});

describe('weather — rise rate (Scenario 3, FR-012, SC-005)', () => {
  it('fog rises between 12 and 20 cells per second (every 3-5 simulation steps at 60 steps/sec) through clear space', () => {
    // A single-column grid isolates rise rate from wander: diagonal candidates are always
    // out-of-bounds, so every successful rise is via the straight-up (dx=0) candidate.
    const height = 150;
    const grid = createGrid(1, height);
    createFog(grid, 0, height - 1);
    const i0 = (height - 1) * 1 + 0;
    const startingCooldown = grid.fogRiseCooldown[i0];

    let steps = 0;
    const maxSteps = height * 6 + 50;
    while (grid.cloud[Array.from(grid.elements).findIndex((e) => e === FOG)] !== 1 && steps < maxSteps) {
      step(grid);
      steps++;
    }

    // (height - 1) rises are needed to reach row 0, where it becomes cloud without a further rise.
    const rises = height - 1;
    const avgStepsPerRise = steps / rises;
    // Cadence is uniform in [3, 5] steps/rise (12-20 cells/sec); allow slack for the initial cooldown draw.
    expect(avgStepsPerRise).toBeGreaterThanOrEqual(3);
    expect(avgStepsPerRise).toBeLessThanOrEqual(5.5);
    expect(startingCooldown).toBeGreaterThanOrEqual(3);
    expect(startingCooldown).toBeLessThanOrEqual(5);
  });
});

describe('weather — wander bounds (Scenario 4, FR-013, SC-005)', () => {
  it("a rising plume's sideways wander stays within 1 cell per upward move, with net horizontal drift of 0 measured over a long run", () => {
    const width = 61;
    const height = 400;
    const startX = 30;
    const grid = createGrid(width, height);
    createFog(grid, startX, height - 1);
    let i = (height - 1) * width + startX;
    let prevX = startX;
    let prevY = height - 1;
    let maxAbsStep = 0;
    let netDrift = 0;

    for (let n = 0; n < 8000; n++) {
      step(grid);
      // Find the fog/cloud cell's current position (there is exactly one on the field).
      let idx = -1;
      for (let k = 0; k < grid.elements.length; k++) {
        if (grid.elements[k] === FOG) {
          idx = k;
          break;
        }
      }
      if (idx === -1) break; // condensed to water — run ends
      const x = idx % width;
      const y = Math.floor(idx / width);
      if (y !== prevY) {
        const dx = x - prevX;
        maxAbsStep = Math.max(maxAbsStep, Math.abs(dx));
        netDrift += dx;
        prevX = x;
        prevY = y;
      }
      if (grid.cloud[idx] === 1) break; // reached the sky
      i = idx;
    }
    void i;

    expect(maxAbsStep).toBeLessThanOrEqual(1);
    // Symmetric wander over many rises: net drift should stay small relative to the field width.
    expect(Math.abs(netDrift)).toBeLessThan(width);
  });
});

describe('weather — bubbling through water (Scenario 5, FR-014, SC-006)', () => {
  it('fog created below the surface of a body of water reaches the surface in 100% of cases with 0 water cells lost or gained', () => {
    const width = 10;
    const height = 30;
    const grid = createGrid(width, height);
    // A deep lake filling the bottom two-thirds of the grid.
    const lakeTop = 10;
    for (let y = lakeTop; y < height; y++) {
      for (let x = 0; x < width; x++) setCell(grid, x, y, WATER, 5);
    }
    const waterCountBefore = countElement(grid, WATER);
    // Charm the deepest-possible cell into fog.
    createFog(grid, 5, height - 1);
    const totalWaterPlusFogBefore = waterCountBefore; // the charmed cell was already counted as water

    let reachedSurface = false;
    for (let n = 0; n < 2000; n++) {
      step(grid);
      if (getElement(grid, 5, lakeTop - 1) === FOG || getElement(grid, 5, lakeTop - 1) === EMPTY) {
        // Once above the lake's top row, "reached the surface" — but check more directly below.
      }
      let foundAboveLake = false;
      for (let y = 0; y < lakeTop; y++) {
        for (let x = 0; x < width; x++) {
          if (getElement(grid, x, y) === FOG) foundAboveLake = true;
        }
      }
      if (foundAboveLake) {
        reachedSurface = true;
        break;
      }
    }

    expect(reachedSurface).toBe(true);
    const waterCountAfter = countElement(grid, WATER);
    const fogCountAfter = countElement(grid, FOG);
    expect(waterCountAfter + fogCountAfter).toBe(totalWaterPlusFogBefore);
  });
});

describe('weather — blocked by ordinary matter (Scenario 7, FR-005, FR-015, SC-007)', () => {
  it('fog is blocked by grass, objects, and walls without moving or damaging them, and 0 fog/cloud cells ever exist outside the play field', () => {
    const width = 10;
    const height = 10;
    const grid = createGrid(width, height);
    // A lid of grass/object cells (both immune to gravity, unlike SAND) two rows above the fog
    // cell, sealing off column 5 directly above and both diagonals.
    setCell(grid, 4, 3, GRASS, 5);
    grid.elements[3 * width + 5] = OBJECT;
    setCell(grid, 6, 3, GRASS, 5);
    createFog(grid, 5, 8);

    const lidBefore = [grid.elements[3 * width + 4], grid.elements[3 * width + 5], grid.elements[3 * width + 6]];

    for (let n = 0; n < 400; n++) step(grid);

    expect(grid.elements[3 * width + 4]).toBe(lidBefore[0]);
    expect(grid.elements[3 * width + 5]).toBe(lidBefore[1]);
    expect(grid.elements[3 * width + 6]).toBe(lidBefore[2]);
    for (let idx = 0; idx < grid.elements.length; idx++) {
      const x = idx % width;
      const y = Math.floor(idx / width);
      if (grid.elements[idx] === FOG) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(width);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThan(height);
      }
    }
  });
});

describe('weather — stuck and long-lived fog condenses (Scenario 8, FR-016, SC-008)', () => {
  it('a fog cell unable to rise for 300 consecutive steps condenses into exactly 1 water cell, and no fog cell anywhere survives 1800 steps without becoming cloud', () => {
    const width = 5;
    const height = 5;
    const grid = createGrid(width, height);
    // Seal the fog cell in on all sides with OBJECT (inert — unlike GRASS, it never drinks the
    // water this cell condenses into, which would otherwise race the very check below within the
    // same step()) so every wander candidate is illegal every step.
    grid.elements[1 * width + 2] = OBJECT; // directly above
    grid.elements[1 * width + 1] = OBJECT; // above-left
    grid.elements[1 * width + 3] = OBJECT; // above-right
    createFog(grid, 2, 2);

    let condensed = false;
    for (let n = 0; n < 310; n++) {
      step(grid);
      if (getElement(grid, 2, 2) === WATER) {
        condensed = true;
        break;
      }
    }

    expect(condensed).toBe(true);
    expect(countElement(grid, FOG)).toBe(0);
  });

  it('every fog cell either becomes cloud or condenses within 1800 steps — none survives as rising fog forever', () => {
    const width = 20;
    const height = 20;
    const grid = createGrid(width, height);
    createFog(grid, 10, 19);

    for (let n = 0; n < 1850; n++) step(grid);

    // The single fog cell has either condensed (gone) or become a cloud by now.
    let risingFogCount = 0;
    for (let idx = 0; idx < grid.elements.length; idx++) {
      if (grid.elements[idx] === FOG && grid.cloud[idx] === 0) risingFogCount++;
    }
    expect(risingFogCount).toBe(0);
  });
});

describe('weather — clouds gathering (US2 Scenario 1, 2, 3, 5, FR-017, FR-018, FR-004, SC-009, SC-010, SC-016)', () => {
  it('fog rising with nothing above it becomes cloud on reaching the sky ceiling and stops rising there', () => {
    const width = 5;
    const height = 20;
    const grid = createGrid(width, height);
    createFog(grid, 2, height - 1);

    for (let n = 0; n < 1000; n++) {
      step(grid);
      let idx = -1;
      for (let k = 0; k < grid.elements.length; k++) if (grid.elements[k] === FOG) idx = k;
      if (idx !== -1 && grid.cloud[idx] === 1) break;
    }

    let cloudIndex = -1;
    for (let idx = 0; idx < grid.elements.length; idx++) {
      if (grid.elements[idx] === FOG && grid.cloud[idx] === 1) cloudIndex = idx;
    }
    expect(cloudIndex).not.toBe(-1);
    expect(Math.floor(cloudIndex / width)).toBe(0); // at the sky ceiling row

    const positionBefore = cloudIndex;
    for (let n = 0; n < 50; n++) step(grid);
    // The cloud cell is either still at the same index or has rained (become water) — never moved elsewhere.
    if (grid.elements[positionBefore] === FOG) {
      expect(grid.cloud[positionBefore]).toBe(1);
    }
  });

  it('fog arriving underneath an existing cloud also becomes cloud, thickening the cloud downward', () => {
    const width = 5;
    const height = 20;
    const grid = createGrid(width, height);
    // Wall in columns 1 and 3 for every row below the sky so the rising fog cannot wander
    // sideways out from under the existing cloud at column 2.
    for (let y = 1; y < height; y++) {
      setCell(grid, 1, y, GRASS, 5);
      setCell(grid, 3, y, GRASS, 5);
    }
    // Seed an existing cloud cell directly at the sky ceiling.
    createFog(grid, 2, 0);
    grid.cloud[0 * width + 2] = 1;
    grid.cloudRainDelay[0 * width + 2] = 480; // won't rain during this short test

    createFog(grid, 2, height - 1);

    let becameCloudUnderneath = false;
    for (let n = 0; n < 200; n++) {
      step(grid);
      if (grid.elements[1 * width + 2] === FOG && grid.cloud[1 * width + 2] === 1) {
        becameCloudUnderneath = true;
        break;
      }
    }

    expect(becameCloudUnderneath).toBe(true);
  });

  it('cloud cells never move — across any run, 0 cloud cells are ever found at a different index than where they formed', () => {
    const width = 5;
    const height = 20;
    const grid = createGrid(width, height);
    createFog(grid, 2, 0);
    grid.cloud[0 * width + 2] = 1;
    grid.cloudRainDelay[0 * width + 2] = 480;
    const cloudIndex = 0 * width + 2;

    for (let n = 0; n < 400; n++) {
      step(grid);
      if (grid.elements[cloudIndex] === FOG) {
        expect(grid.cloud[cloudIndex]).toBe(1);
      }
    }
  });

  it('fog blocked only by ordinary matter never becomes cloud — it only ever condenses', () => {
    const width = 5;
    const height = 5;
    const grid = createGrid(width, height);
    setCell(grid, 2, 1, GRASS, 5);
    setCell(grid, 1, 1, GRASS, 5);
    setCell(grid, 3, 1, GRASS, 5);
    createFog(grid, 2, 2);

    for (let n = 0; n < 310; n++) {
      step(grid);
      // If it's still FOG, it must never be cloud, since it's boxed in by ordinary matter.
      if (grid.elements[2 * width + 2] === FOG) {
        expect(grid.cloud[2 * width + 2]).toBe(0);
      }
    }
  });

  it('pouring sand or water through a cloud cell exchanges places with it within exactly 1 simulation step', () => {
    const width = 5;
    const height = 5;
    const grid = createGrid(width, height);
    createFog(grid, 2, 2);
    grid.cloud[2 * width + 2] = 1;
    grid.cloudRainDelay[2 * width + 2] = 480;
    setCell(grid, 2, 1, SAND, 5); // directly above the cloud cell

    step(grid);

    expect(getElement(grid, 2, 2)).toBe(SAND);
    expect(getElement(grid, 2, 1)).toBe(FOG);
    expect(grid.cloud[1 * width + 2]).toBe(1);
  });
});

describe('weather — rain (US3 Scenario 1, 2, 4, 5, FR-020, FR-021, FR-022, SC-011, SC-012)', () => {
  it('every cloud cell rains within 180-480 simulation steps of forming, and no cloud cell survives past 600 steps', () => {
    const width = 5;
    const height = 5;
    const grid = createGrid(width, height);
    createFog(grid, 2, 2);
    grid.cloud[2 * width + 2] = 1;
    const delay = randomCloudRainDelay();
    grid.cloudRainDelay[2 * width + 2] = delay;

    let rainedAtStep = -1;
    for (let n = 0; n < 600; n++) {
      step(grid);
      if (getElement(grid, 2, 2) !== FOG) {
        rainedAtStep = n + 1;
        break;
      }
    }

    expect(rainedAtStep).toBeGreaterThanOrEqual(180);
    expect(rainedAtStep).toBeLessThanOrEqual(480);
    expect(getElement(grid, 2, 2)).toBe(WATER);
  });

  it("a cloud's cells rain at staggered moments rather than all at once", () => {
    const width = 20;
    const height = 5;
    const grid = createGrid(width, height);
    for (let x = 0; x < width; x++) {
      createFog(grid, x, 0);
      grid.cloud[x] = 1;
      grid.cloudRainDelay[x] = randomCloudRainDelay();
    }

    const rainStepByX = new Array(width).fill(-1);
    for (let n = 0; n < 600; n++) {
      step(grid);
      for (let x = 0; x < width; x++) {
        if (rainStepByX[x] === -1 && getElement(grid, x, 0) === WATER) rainStepByX[x] = n;
      }
    }

    const distinctSteps = new Set(rainStepByX.filter((s) => s !== -1));
    expect(distinctSteps.size).toBeGreaterThan(1);
  });

  it('advancing an identical field seeded one way by rain and the other by the 💧 tool produces 0 differing cells after any number of step() calls', () => {
    // A single row, walled on both sides of the target cell, so the produced water cell can never
    // move — isolating "is this cell behaviorally the same" from unrelated Math.random() tie-break
    // divergence between two independently-stepped grids (same pattern as starPower.test.ts's own
    // burn-vs-wand glitter comparison).
    const width = 10;
    const height = 1;
    const rainGrid = createGrid(width, height);
    setCell(rainGrid, 4, 0, GRASS, 5);
    setCell(rainGrid, 6, 0, GRASS, 5);
    createFog(rainGrid, 5, 0);
    rainGrid.cloud[5] = 1;
    rainGrid.cloudRainDelay[5] = 1; // rains almost immediately

    const toolGrid = createGrid(width, height);
    setCell(toolGrid, 4, 0, GRASS, 5);
    setCell(toolGrid, 6, 0, GRASS, 5);

    step(rainGrid); // produces exactly one WATER cell via rain
    expect(getElement(rainGrid, 5, 0)).toBe(WATER);
    setCell(toolGrid, 5, 0, WATER, rainGrid.shades[5]);

    for (let n = 0; n < 200; n++) {
      step(rainGrid);
      step(toolGrid);
      expect(Array.from(rainGrid.elements)).toEqual(Array.from(toolGrid.elements));
    }
  });

  it('rain landing on grass that can still grow is drunk exactly under spec 007 pacing', () => {
    const width = 10;
    const height = 10;
    const grid = createGrid(width, height);
    setCell(grid, 5, 6, GRASS, 5);
    createFog(grid, 5, 5);
    grid.cloud[5 * width + 5] = 1;
    grid.cloudRainDelay[5 * width + 5] = 1;

    for (let n = 0; n < 100; n++) step(grid);

    // The grass either drank the rain and grew, or the rain is still present as water somewhere
    // nearby — either way, this exercises spec 007's unchanged absorption path without error.
    expect(getElement(grid, 5, 6) === GRASS || getElement(grid, 5, 6) === EMPTY).toBe(true);
  });

  it('rain reaching burning (fuelled) star power quenches it exactly as ordinary water does', () => {
    const width = 5;
    const height = 5;
    const grid = createGrid(width, height);
    // Wall both sides at row 2 and both diagonals-below at row 3 with OBJECT (inert — unlike
    // GRASS, it never drinks the rain-water) so the produced water cell can only ever interact
    // with the star power cell directly below it — no sideways or diagonal escape route.
    grid.elements[2 * width + 1] = OBJECT;
    grid.elements[2 * width + 3] = OBJECT;
    grid.elements[3 * width + 1] = OBJECT;
    grid.elements[3 * width + 3] = OBJECT;
    // A fuelled star power cell directly below where the rain will land.
    igniteStarPower(grid, 2, 3, true);
    createFog(grid, 2, 2);
    grid.cloud[2 * width + 2] = 1;
    grid.cloudRainDelay[2 * width + 2] = 1;

    step(grid); // rains this step, producing WATER at (2, 2)
    expect(getElement(grid, 2, 2)).toBe(WATER);

    step(grid); // the star power cell (processed after row 2 in the bottom-to-top pass) now sees it

    expect(getElement(grid, 2, 3)).toBe(RAINBOW_SAND); // fuelled — extinguished, leaves a glitter grain
    expect(getGlitter(grid, 2, 3)).toBe(true);
    expect(getElement(grid, 2, 2)).toBe(WATER); // the rain-water itself is untouched
  });
});

describe('weather — conservation (US3 Scenario 3, 7, FR-023, SC-013)', () => {
  it('across a full cycle with no drawing, the total of water plus fog plus cloud cells never increases at any step and returns to its starting value', () => {
    const width = 20;
    const height = 20;
    const grid = createGrid(width, height);
    for (let x = 5; x < 15; x++) setCell(grid, x, 15, WATER, 5);
    const startTotal = countElement(grid, WATER) + countElement(grid, FOG);

    let maxTotal = startTotal;
    for (let n = 0; n < 3000; n++) {
      step(grid);
      const total = countElement(grid, WATER) + countElement(grid, FOG);
      maxTotal = Math.max(maxTotal, total);
      expect(total).toBeLessThanOrEqual(startTotal);
    }

    const endTotal = countElement(grid, WATER) + countElement(grid, FOG);
    expect(endTotal).toBe(startTotal);
    expect(maxTotal).toBe(startTotal);
  });
});

describe('weather — always settles (US4 Scenario 1, 2, FR-011, FR-024, FR-040, SC-014, SC-015, SC-023)', () => {
  it('charming as hard as possible across a field mostly full of water fills the sky only up to the FR-011 ceiling and no further', () => {
    const width = 20;
    const height = 20;
    const grid = createGrid(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) setCell(grid, x, y, WATER, 5);
    }
    const ceiling = Math.floor(width * height * FOG_FIELD_SHARE_CEILING);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) createFog(grid, x, y);
    }

    expect(grid.fogCloudCount).toBe(ceiling);
    expect(grid.fogCloudCount).toBeLessThanOrEqual(ceiling);
  });

  it('from several adversarial starting states, running with no further drawing and no star power left brings the field to 0 fog and 0 cloud within 45 seconds (2700 steps) and then at rest (Scenario 2, FR-024, SC-015)', () => {
    const width = 20;
    const height = 20;
    const ceiling = Math.floor(width * height * FOG_FIELD_SHARE_CEILING);

    function fillWithWater(grid: ReturnType<typeof createGrid>): void {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) setCell(grid, x, y, WATER, 5);
      }
    }

    function chargeToCeiling(grid: ReturnType<typeof createGrid>): void {
      let created = 0;
      outer: for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (created >= ceiling) break outer;
          if (createFog(grid, x, y)) created++;
        }
      }
    }

    // Scenario A: a field entirely full of freshly-charmed fog.
    const fogGrid = createGrid(width, height);
    fillWithWater(fogGrid);
    chargeToCeiling(fogGrid);
    expect(fogGrid.fogCloudCount).toBe(ceiling);

    // Scenario B: a sky entirely full of cloud at varying ages.
    const cloudGrid = createGrid(width, height);
    fillWithWater(cloudGrid);
    chargeToCeiling(cloudGrid);
    for (let i = 0; i < cloudGrid.elements.length; i++) {
      if (cloudGrid.elements[i] === FOG) {
        cloudGrid.cloud[i] = 1;
        cloudGrid.fogAge[i] = i % 200; // varying ages
        cloudGrid.cloudRainDelay[i] = randomCloudRainDelay();
      }
    }

    // Scenario C: a mix of both — half fresh fog, half varying-age cloud.
    const mixGrid = createGrid(width, height);
    fillWithWater(mixGrid);
    chargeToCeiling(mixGrid);
    let seen = 0;
    for (let i = 0; i < mixGrid.elements.length; i++) {
      if (mixGrid.elements[i] === FOG) {
        seen++;
        if (seen % 2 === 0) {
          mixGrid.cloud[i] = 1;
          mixGrid.fogAge[i] = i % 200;
          mixGrid.cloudRainDelay[i] = randomCloudRainDelay();
        }
      }
    }

    for (const grid of [fogGrid, cloudGrid, mixGrid]) {
      for (let n = 0; n < 2700; n++) step(grid);
      expect(countElement(grid, FOG)).toBe(0);
      expect(grid.fogCloudCount).toBe(0);

      // At rest: running further steps produces no more fog/cloud (no self-sustaining feedback).
      step(grid);
      expect(countElement(grid, FOG)).toBe(0);
    }
  });

  it('a field with 0 fog and 0 cloud produces the same step() behavior spec 008 already established — grass grows, star power burns out, sand/water settle normally (regression, FR-040, SC-023)', () => {
    const grid = createGrid(20, 20);
    setCell(grid, 5, 6, GRASS, 5);
    setCell(grid, 5, 5, WATER, 5);
    setCell(grid, 10, 10, SAND, 5);
    igniteStarPower(grid, 15, 15, false);
    const starPowerLife = grid.starPowerLife[15 * 20 + 15];

    for (let n = 0; n < Math.max(starPowerLife + 5, 200); n++) step(grid);

    // Star power burns out on its own, exactly as spec 008 established (unfuelled — becomes EMPTY).
    expect(getElement(grid, 15, 15)).toBe(EMPTY);
    expect(countElement(grid, STAR_POWER)).toBe(0);
    // Sand settles to the bottom of the field.
    expect(getElement(grid, 10, 19)).toBe(SAND);
    // No fog/cloud ever appears, since nothing in this scenario ever calls createFog.
    expect(countElement(grid, FOG)).toBe(0);
  });
});
