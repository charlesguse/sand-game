import { describe, it, expect } from 'vitest';
import {
  createGrid,
  setCell,
  setGlitter,
  igniteStarPower,
  getElement,
  getGlitter,
} from '../../../src/sim/grid';
import { step } from '../../../src/sim/step';
import { applyWand } from '../../../src/sim/wand';
import { randomBurnLife } from '../../../src/sim/shade';
import { EMPTY, GRASS, WATER, SAND, OBJECT, RAINBOW_SAND, STAR_POWER } from '../../../src/sim/types';

describe('starPower — never moves (FR-004, SC-002, Scenario 3)', () => {
  it("a star power cell's position is unchanged across any number of step() calls with nothing else on the field", () => {
    const grid = createGrid(20, 20);
    igniteStarPower(grid, 10, 10, false);
    const i = 10 * grid.width + 10;

    for (let n = 0; n < 200; n++) {
      step(grid);
      for (let idx = 0; idx < grid.elements.length; idx++) {
        if (idx === i) continue;
        expect(grid.elements[idx]).toBe(EMPTY);
      }
    }
  });
});

describe('starPower — burns out on its own (FR-002, FR-008, SC-003)', () => {
  it('on an empty field it burns out within starPowerLife steps (≤60) and leaves the cell EMPTY with 0 glitter and no other changed cells', () => {
    const grid = createGrid(20, 20);
    igniteStarPower(grid, 10, 10, false);
    const i = 10 * grid.width + 10;
    const life = grid.starPowerLife[i];
    expect(life).toBeLessThanOrEqual(60);

    for (let n = 0; n < life; n++) step(grid);

    expect(getElement(grid, 10, 10)).toBe(EMPTY);
    expect(getGlitter(grid, 10, 10)).toBe(false);
    for (let idx = 0; idx < grid.elements.length; idx++) {
      expect(grid.elements[idx]).toBe(EMPTY);
    }
  });
});

describe('starPower — randomBurnLife (FR-007)', () => {
  it('always returns an integer in [30, 60] inclusive across many calls, with observed variation', () => {
    const values = new Set<number>();
    for (let n = 0; n < 500; n++) {
      const life = randomBurnLife();
      expect(Number.isInteger(life)).toBe(true);
      expect(life).toBeGreaterThanOrEqual(30);
      expect(life).toBeLessThanOrEqual(60);
      values.add(life);
    }
    expect(values.size).toBeGreaterThan(1);
  });
});

describe('starPower — ignition (Scenario 1, 2, FR-011, FR-012, FR-013, FR-022, FR-036, SC-004)', () => {
  it('a GRASS cell painted directly with igniteStarPower(..., true) becomes fuelled star power immediately', () => {
    const grid = createGrid(5, 5);
    setCell(grid, 2, 2, GRASS, 5);

    igniteStarPower(grid, 2, 2, true);

    expect(getElement(grid, 2, 2)).toBe(STAR_POWER);
    expect(grid.starPowerFuelled[2 * 5 + 2]).toBe(1);
  });

  it('a star power cell ignites a GRASS neighbor once its own age reaches the ignite delay, and keeps doing so every qualifying step so late-arriving grass still catches', () => {
    const grid = createGrid(10, 10);
    igniteStarPower(grid, 5, 5, true);

    // Nine steps: age reaches 9, not yet the 10-step delay.
    for (let n = 0; n < 9; n++) step(grid);

    // Grass arrives late, adjacent to the already-burning cell.
    setCell(grid, 6, 5, GRASS, 5);

    // The 10th step: age reaches 10, and the newly-arrived grass neighbor catches immediately.
    step(grid);

    const ni = 5 * 10 + 6;
    expect(grid.elements[ni]).toBe(STAR_POWER);
    expect(grid.starPowerFuelled[ni]).toBe(1);
    expect(grid.starPowerAge[ni]).toBe(0);
    expect(grid.starPowerLife[ni]).toBeGreaterThanOrEqual(30);
    expect(grid.starPowerLife[ni]).toBeLessThanOrEqual(60);
    expect(getGlitter(grid, 6, 5)).toBe(true);
  });
});

describe('starPower — burn-front pace (Scenario 3, FR-012, SC-004)', () => {
  it('a solid 60-cell run of grass, lit at one end, is fully converted (ignited-then-glittered) within 360-1200 simulated steps', () => {
    const width = 70;
    const grid = createGrid(width, 5);
    const y = 2;
    for (let x = 5; x < 65; x++) setCell(grid, x, y, GRASS, 5); // 60 cells
    igniteStarPower(grid, 5, y, true); // lit at one end

    function countElement(element: number): number {
      let count = 0;
      for (let i = 0; i < grid.elements.length; i++) if (grid.elements[i] === element) count++;
      return count;
    }

    let steps = 0;
    const maxSteps = 1300;
    while ((countElement(GRASS) > 0 || countElement(STAR_POWER) > 0) && steps < maxSteps) {
      step(grid);
      steps++;
    }

    expect(countElement(GRASS)).toBe(0);
    expect(countElement(STAR_POWER)).toBe(0);
    expect(steps).toBeGreaterThanOrEqual(360);
    expect(steps).toBeLessThanOrEqual(1200);
  });
});

describe('starPower — burnout yields exactly one glitter grain per consumed blade (Scenario 4, FR-008, FR-009, FR-010, SC-005)', () => {
  it("a fuelled star power cell's burnout produces exactly one RAINBOW_SAND glitter grain in the same cell, changing no other cell in that transition", () => {
    const grid = createGrid(10, 10);
    igniteStarPower(grid, 5, 5, true);
    const i = 5 * 10 + 5;
    const life = grid.starPowerLife[i];

    for (let n = 0; n < life - 1; n++) step(grid);
    const before = Array.from(grid.elements);

    step(grid); // this step burns the cell out

    expect(getElement(grid, 5, 5)).toBe(RAINBOW_SAND);
    expect(getGlitter(grid, 5, 5)).toBe(true);
    const after = Array.from(grid.elements);
    for (let idx = 0; idx < after.length; idx++) {
      if (idx === i) continue;
      expect(after[idx]).toBe(before[idx]);
    }
  });

  it('a patch of N grass cells, run to a standstill after ignition, produces exactly N new glitter grains — nothing lost, nothing created for free', () => {
    const grid = createGrid(20, 20);
    let n = 0;
    for (let y = 5; y < 10; y++) {
      for (let x = 5; x < 10; x++) {
        setCell(grid, x, y, GRASS, 5);
        n++;
      }
    }
    igniteStarPower(grid, 5, 5, true); // lights the corner of the solid 5x5 patch

    for (let i = 0; i < 3000; i++) step(grid);

    let glitterGrains = 0;
    let leftover = 0;
    for (let idx = 0; idx < grid.elements.length; idx++) {
      if (grid.elements[idx] === RAINBOW_SAND && grid.glitter[idx] === 1) glitterGrains++;
      if (grid.elements[idx] === STAR_POWER || grid.elements[idx] === GRASS) leftover++;
    }
    expect(glitterGrains).toBe(n);
    expect(leftover).toBe(0);
  });
});

describe('starPower — burn-made glitter behaves identically to wand-sprinkled glitter (Scenario 5, SC-011)', () => {
  it('produces 0 differing cells after any number of further step() calls, for both a burn-produced grain and a wand-sprinkled grain', () => {
    // Both grains sit in a single-row grid so gravity can never move them — a deterministic "at rest" check.
    const burnGrid = createGrid(3, 1);
    igniteStarPower(burnGrid, 1, 0, true);
    const bi = 1;
    for (let n = 0; n < burnGrid.starPowerLife[bi]; n++) step(burnGrid);
    expect(getElement(burnGrid, 1, 0)).toBe(RAINBOW_SAND);
    const burnSnapshot = {
      elements: Array.from(burnGrid.elements),
      shades: Array.from(burnGrid.shades),
      hues: Array.from(burnGrid.hues),
      glitter: Array.from(burnGrid.glitter),
    };
    for (let n = 0; n < 100; n++) step(burnGrid);
    expect(Array.from(burnGrid.elements)).toEqual(burnSnapshot.elements);
    expect(Array.from(burnGrid.shades)).toEqual(burnSnapshot.shades);
    expect(Array.from(burnGrid.hues)).toEqual(burnSnapshot.hues);
    expect(Array.from(burnGrid.glitter)).toEqual(burnSnapshot.glitter);

    const wandGrid = createGrid(3, 1);
    applyWand(wandGrid, 0, 0, 0); // (0, 0) is a guaranteed sprinkle lattice site
    expect(getElement(wandGrid, 0, 0)).toBe(RAINBOW_SAND);
    const wandSnapshot = {
      elements: Array.from(wandGrid.elements),
      shades: Array.from(wandGrid.shades),
      hues: Array.from(wandGrid.hues),
      glitter: Array.from(wandGrid.glitter),
    };
    for (let n = 0; n < 100; n++) step(wandGrid);
    expect(Array.from(wandGrid.elements)).toEqual(wandSnapshot.elements);
    expect(Array.from(wandGrid.shades)).toEqual(wandSnapshot.shades);
    expect(Array.from(wandGrid.hues)).toEqual(wandSnapshot.hues);
    expect(Array.from(wandGrid.glitter)).toEqual(wandSnapshot.glitter);
  });
});

describe('starPower — a burn cannot cross a non-GRASS gap (Scenario 6, FR-014, SC-007)', () => {
  const gapCases: [string, number][] = [
    ['EMPTY', EMPTY],
    ['SAND', SAND],
    ['WATER', WATER],
    ['RAINBOW_SAND (glitter)', RAINBOW_SAND],
    ['OBJECT', OBJECT],
  ];

  it.each(gapCases)('a one-cell %s gap stops the burn — 0 cells of the far lawn ever catch', (_label, gapElement) => {
    const width = 20;
    const grid = createGrid(width, 3);
    const y = 1;
    for (let x = 0; x < 9; x++) setCell(grid, x, y, GRASS, 5); // near lawn
    setCell(grid, 9, y, gapElement, 5); // the gap
    if (gapElement === RAINBOW_SAND) setGlitter(grid, 9, y, 1);
    for (let x = 10; x < 19; x++) setCell(grid, x, y, GRASS, 5); // far lawn

    igniteStarPower(grid, 0, y, true); // light the near end

    for (let n = 0; n < 2000; n++) step(grid);

    for (let x = 10; x < 19; x++) {
      expect(getElement(grid, x, y)).toBe(GRASS);
    }
  });
});

describe('starPower — every burn terminates (Scenario 7, FR-015, SC-006)', () => {
  it('after running well past every possible burn life, 0 star power cells remain anywhere on the field', () => {
    const grid = createGrid(30, 30);
    for (let y = 10; y < 20; y++) {
      for (let x = 10; x < 20; x++) setCell(grid, x, y, GRASS, 5);
    }
    igniteStarPower(grid, 10, 10, true);

    for (let n = 0; n < 5000; n++) step(grid);

    let starPowerCount = 0;
    for (let idx = 0; idx < grid.elements.length; idx++) if (grid.elements[idx] === STAR_POWER) starPowerCount++;
    expect(starPowerCount).toBe(0);
  });
});

describe('starPower — burn-made glitter is never fuel (Scenario 8, FR-013)', () => {
  it('a glitter grain produced by burning is never re-ignited or converted by further contact with star power', () => {
    const grid = createGrid(5, 5);
    const y = 4; // bottom row — never falls once it becomes RAINBOW_SAND
    setCell(grid, 2, y, GRASS, 5);
    igniteStarPower(grid, 2, y, true);
    const i = y * 5 + 2;
    for (let n = 0; n < grid.starPowerLife[i]; n++) step(grid);
    expect(getElement(grid, 2, y)).toBe(RAINBOW_SAND);

    igniteStarPower(grid, 1, y, false);
    for (let n = 0; n < 60; n++) step(grid);

    expect(getElement(grid, 2, y)).toBe(RAINBOW_SAND);
  });
});

describe('starPower — inert without any star power on the field (Scenario 9, FR-013, SC-010)', () => {
  it("with grass on the field and 0 star power anywhere, running step() for 10,000 steps never spontaneously creates star power", () => {
    const grid = createGrid(15, 15);
    for (let x = 0; x < 15; x++) setCell(grid, x, 14, GRASS, 5);
    setCell(grid, 7, 13, WATER, 5);

    for (let n = 0; n < 10000; n++) step(grid);

    let starPowerCells = 0;
    for (let idx = 0; idx < grid.elements.length; idx++) if (grid.elements[idx] === STAR_POWER) starPowerCells++;
    expect(starPowerCells).toBe(0);
  });
});

describe('starPower — unrelated grass keeps drinking and growing elsewhere on the field (Scenario 10, FR-019, FR-036)', () => {
  it('a grass cell far from any burn, adjacent to its own water, keeps drinking and growing while a burn proceeds elsewhere on the same field', () => {
    const grid = createGrid(60, 20);
    for (let x = 0; x < 5; x++) setCell(grid, x, 19, GRASS, 5);
    igniteStarPower(grid, 0, 19, true);

    setCell(grid, 50, 19, GRASS, 5);
    setCell(grid, 50, 18, WATER, 5);

    function countGrassNear(): number {
      let count = 0;
      for (let y = 10; y < 20; y++) {
        for (let x = 45; x < 55; x++) {
          if (grid.elements[y * grid.width + x] === GRASS) count++;
        }
      }
      return count;
    }

    const before = countGrassNear();
    for (let n = 0; n < 200; n++) step(grid);
    const after = countGrassNear();

    expect(getElement(grid, 50, 19)).toBe(GRASS);
    expect(after).toBeGreaterThan(before);
  });
});

describe('starPower — water quenches on contact (US3, Scenario 1, 2, FR-016, FR-017, SC-009)', () => {
  it('a star power cell orthogonally adjacent to WATER is extinguished within one step() call regardless of its age, even on the step it would otherwise ignite a neighbor, and the water cell is byte-identical before and after', () => {
    const priorStepsCases = [0, 5, 9]; // 9 is the step before it would otherwise reach the ignite delay
    for (const priorSteps of priorStepsCases) {
      // A single-row grid: gravity is a non-issue (nothing has a "below"), and the water sits at
      // the grid's right edge so it has no empty cell to flow sideways into, either — it can only
      // ever be moved by the quench logic itself, isolating that logic from ordinary powder/liquid physics.
      const grid = createGrid(3, 1);
      setCell(grid, 0, 0, GRASS, 5); // a fuel neighbor, to prove ignition never happens despite a qualifying age
      igniteStarPower(grid, 1, 0, true);

      for (let n = 0; n < priorSteps; n++) step(grid);

      setCell(grid, 2, 0, WATER, 7);
      const waterIndex = 2;
      const waterElementBefore = grid.elements[waterIndex];
      const waterShadeBefore = grid.shades[waterIndex];

      step(grid);

      expect(grid.elements[waterIndex]).toBe(waterElementBefore);
      expect(grid.shades[waterIndex]).toBe(waterShadeBefore);
      expect(getElement(grid, 1, 0)).toBe(RAINBOW_SAND); // fuelled — leaves a glitter grain
      expect(getGlitter(grid, 1, 0)).toBe(true);
      expect(getElement(grid, 0, 0)).toBe(GRASS); // never ignited
    }
  });

  it('pouring water directly beside a burning (fuelled) star power cell stops it immediately, leaving a glitter grain', () => {
    // Same single-row, edge-anchored shape as above, isolating the quench check from gravity.
    const grid = createGrid(3, 1);
    setCell(grid, 0, 0, GRASS, 5);
    igniteStarPower(grid, 0, 0, true);
    for (let n = 0; n < 3; n++) step(grid);

    setCell(grid, 1, 0, WATER, 5); // "pours" water directly beside the burning cell

    step(grid);

    expect(getElement(grid, 0, 0)).toBe(RAINBOW_SAND);
    expect(getGlitter(grid, 0, 0)).toBe(true);
  });
});

describe('starPower — a water firebreak fully separates a burn (US3, Scenario 3, FR-014, SC-007)', () => {
  it('a one-cell-wide stripe of water fully separating two halves of a lawn stops a burn lit on one side, even after running to a standstill', () => {
    const width = 21;
    const height = 10;
    const grid = createGrid(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < 10; x++) setCell(grid, x, y, GRASS, 5); // left half
      setCell(grid, 10, y, WATER, 5); // the firebreak stripe
      for (let x = 11; x < 21; x++) setCell(grid, x, y, GRASS, 5); // right half
    }
    igniteStarPower(grid, 0, 0, true);

    for (let n = 0; n < 3000; n++) step(grid);

    for (let y = 0; y < height; y++) {
      for (let x = 11; x < 21; x++) {
        expect(getElement(grid, x, y)).toBe(GRASS);
      }
    }
  });
});

describe('starPower — grass beside a firebreak keeps drinking and growing (US3, Scenario 6, FR-017a, FR-036)', () => {
  it("grass beside a water firebreak continues to drink and grow into it exactly per spec 007's rule, unaffected by quench events happening elsewhere on the same grid", () => {
    const grid = createGrid(30, 30);
    // A burn happening far away, quenched by its own water — "a quench event elsewhere." Sitting
    // right on the grid's true bottom row (y=29) means the resulting glitter grain has nowhere to
    // fall, so it stays checkable at the same cell for the whole 30-step run.
    const burnY = 29;
    setCell(grid, 2, burnY, GRASS, 5);
    igniteStarPower(grid, 2, burnY, true);
    setCell(grid, 3, burnY, WATER, 5);

    // A small, separate lawn with its own firebreak water, well under the field-share ceiling.
    setCell(grid, 20, 20, GRASS, 5);
    setCell(grid, 21, 20, WATER, 5);

    for (let n = 0; n < 30; n++) step(grid);

    expect(getElement(grid, 2, burnY)).toBe(RAINBOW_SAND); // the elsewhere burn was quenched as usual

    // The firebreak water was absorbed and new grass grew beside it, exactly like spec 007's rule.
    expect(getElement(grid, 21, 20)).toBe(EMPTY);
    let grownNearby = false;
    for (let y = 18; y <= 22; y++) {
      for (let x = 18; x <= 22; x++) {
        if (x === 20 && y === 20) continue;
        if (getElement(grid, x, y) === GRASS) grownNearby = true;
      }
    }
    expect(grownNearby).toBe(true);
  });
});
