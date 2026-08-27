import { describe, it, expect } from 'vitest';
import { createGrid, setCell, getElement, getShade } from '../../../src/sim/grid';
import { step } from '../../../src/sim/step';
import { EMPTY, WATER, GRASS, SAND, DIRT, OBJECT, type Grid } from '../../../src/sim/types';
import { computePlayField } from '../../../src/lib/layout';

const GRASS_HEIGHT_CEILING = 12;
const GRASS_FIELD_SHARE_CEILING = 0.25;

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Runs step() until grid.elements stops changing between consecutive steps, or maxSteps is hit. */
function runUntilStandstill(grid: Grid, maxSteps: number): number {
  let previous = Array.from(grid.elements);
  for (let i = 0; i < maxSteps; i++) {
    step(grid);
    const current = Array.from(grid.elements);
    if (arraysEqual(previous, current)) return i + 1;
    previous = current;
  }
  return maxSteps;
}

/**
 * A walled GRASS container (immovable, so it never erodes like a powder wall would) holding a
 * narrow lawn base flooded with far more water than the height/field-share ceilings could ever
 * let it consume — a headless stand-in for "an effectively unlimited water supply against a
 * grass patch." Scales with the given grid size so it works at any supported play-field size.
 */
function buildFloodedGrassContainer(width: number, height: number): Grid {
  const grid = createGrid(width, height);
  const wallThickness = 2;
  const marginX = Math.max(4, Math.floor(width * 0.1));
  const marginTop = Math.max(4, Math.floor(height * 0.1));
  const left = marginX;
  const right = width - marginX - 1;
  const floorY = height - 1;
  const top = marginTop;

  for (let x = left; x <= right; x++) setCell(grid, x, floorY, GRASS, 5); // floor
  for (let y = top; y <= floorY; y++) {
    for (let t = 0; t < wallThickness; t++) {
      setCell(grid, left + t, y, GRASS, 5); // left wall
      setCell(grid, right - t, y, GRASS, 5); // right wall
    }
  }

  const interiorLeft = left + wallThickness;
  const interiorRight = right - wallThickness;
  const baseWidth = Math.min(10, interiorRight - interiorLeft - 1);
  const baseStart = interiorLeft + Math.floor((interiorRight - interiorLeft - baseWidth) / 2);
  const grassY = floorY - 1;
  for (let x = baseStart; x < baseStart + baseWidth; x++) setCell(grid, x, grassY, GRASS, 5); // lawn base

  for (let y = top + 1; y < grassY; y++) {
    for (let x = interiorLeft + 1; x < interiorRight; x++) setCell(grid, x, y, WATER, 5); // flood
  }

  return grid;
}

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

describe('grass — absorption (FR-007, FR-009)', () => {
  it('a water cell orthogonally adjacent to grass that can still grow is consumed within one step() and exactly one new grass cell appears', () => {
    const grid = createGrid(10, 10);
    setCell(grid, 5, 5, GRASS, 5);
    setCell(grid, 6, 5, WATER, 5); // orthogonally adjacent, to the right

    const grassCountBefore = grid.grassCount;
    step(grid);

    expect(getElement(grid, 6, 5)).toBe(EMPTY);
    expect(grid.grassCount).toBe(grassCountBefore + 1);
    expect(getElement(grid, 5, 4)).toBe(GRASS); // grown directly above — the top preference
  });

  it('a single grass cell absorbs at most one water cell per GRASS_ABSORB_COOLDOWN (10) steps even with unlimited adjacent water', () => {
    const grid = createGrid(20, 20);
    setCell(grid, 10, 15, GRASS, 5);

    const STEPS = 25;
    let absorptions = 0;
    for (let i = 0; i < STEPS; i++) {
      setCell(grid, 11, 15, WATER, 5); // refill an unlimited supply, orthogonally adjacent
      const before = grid.grassCount;
      step(grid);
      if (grid.grassCount > before) absorptions++;
    }

    expect(absorptions).toBeGreaterThan(0);
    expect(absorptions).toBeLessThanOrEqual(Math.floor(STEPS / 10) + 1);
  });
});

describe('grass — no absorption when it cannot grow (FR-008)', () => {
  it('a grass cell whose every eligible target is occupied does not absorb adjacent water; the water behaves as ordinary water', () => {
    // A dense 5x5 GRASS block (immovable, so it can't erode like a powder pile would) with a
    // single water cell carved out at its centre — every grass cell touching that water has
    // every one of its own targets occupied by more block grass, so none of them can grow. The
    // grid is large enough that the field-share ceiling never becomes the (wrong) reason nothing
    // grows.
    const grid = createGrid(40, 20);
    const bx = 15;
    const by = 5;
    for (let y = by; y <= by + 4; y++) {
      for (let x = bx; x <= bx + 4; x++) setCell(grid, x, y, GRASS, 5);
    }
    setCell(grid, bx + 2, by + 2, WATER, 5);

    const grassCountBefore = grid.grassCount;
    for (let i = 0; i < 50; i++) step(grid);

    expect(grid.grassCount).toBe(grassCountBefore);
    expect(getElement(grid, bx + 2, by + 2)).toBe(WATER);
  });
});

describe('grass — growth target order and rejection (FR-010, FR-026)', () => {
  it('new grass appears only above, diagonally above, or (with support) sideways of existing grass — never below', () => {
    const grid = createGrid(20, 20);
    setCell(grid, 10, 15, GRASS, 5);
    const initialMaxGrassY = 15;

    for (let i = 0; i < 300; i++) {
      // Keep both sides supplied so growth keeps happening for the whole run.
      setCell(grid, 11, 15, WATER, 5);
      setCell(grid, 9, 15, WATER, 5);
      step(grid);
    }

    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        if (grid.elements[y * grid.width + x] === GRASS) {
          expect(y).toBeLessThanOrEqual(initialMaxGrassY);
        }
      }
    }
  });

  it('sideways growth requires solid support beneath the target; an unsupported sideways cell is skipped', () => {
    const grid = createGrid(9, 7);
    setCell(grid, 5, 5, GRASS, 5);
    setCell(grid, 5, 4, WATER, 5); // above: blocks the "above" target and supplies the water to absorb
    setCell(grid, 4, 4, GRASS, 5); // diagonally above-left: blocked
    setCell(grid, 6, 4, GRASS, 5); // diagonally above-right: blocked
    setCell(grid, 6, 6, SAND, 5); // supports the "right" sideways target at (6, 5)
    // (4, 6) is left EMPTY — the "left" sideways target at (4, 5) has no support beneath it.

    step(grid);

    expect(getElement(grid, 5, 4)).toBe(EMPTY); // the water was absorbed
    expect(getElement(grid, 6, 5)).toBe(GRASS); // grew sideways onto the supported target
    expect(getElement(grid, 4, 5)).toBe(EMPTY); // the unsupported target was never chosen
  });

  it.each([SAND, DIRT, WATER])(
    'a target cell already holding %s is never chosen as a growth target within the same step',
    (blockingElement) => {
      const grid = createGrid(10, 10);
      setCell(grid, 5, 5, GRASS, 5);
      setCell(grid, 5, 4, blockingElement, 5); // "above" target occupied
      setCell(grid, 5, 6, WATER, 5); // trigger water, orthogonally adjacent but never a growth target

      step(grid);

      expect(getElement(grid, 5, 4)).not.toBe(GRASS);
    },
  );

  it('a target cell already holding OBJECT is never chosen as a growth target within the same step', () => {
    const grid = createGrid(10, 10);
    setCell(grid, 5, 5, GRASS, 5);
    grid.elements[4 * grid.width + 5] = OBJECT; // "above" target occupied by an object footprint cell
    setCell(grid, 5, 6, WATER, 5); // trigger water, orthogonally adjacent but never a growth target

    step(grid);

    expect(getElement(grid, 5, 4)).toBe(OBJECT);
  });
});

describe('grass — buried grass (Edge Cases, User Story 2 Scenario 8)', () => {
  it('produces 0 new cells while buried, even with adjacent water, and resumes once the covering is removed', () => {
    // Same stable all-GRASS shell as the FR-008 case, except the cell directly above the test
    // subject is SAND — a literal "covering" — resting on solid grass with solid diagonal
    // supports on both sides, so it can't slide away on its own during the "still buried" phase.
    const grid = createGrid(40, 20);
    const bx = 15;
    const by = 5;
    for (let y = by; y <= by + 4; y++) {
      for (let x = bx; x <= bx + 4; x++) setCell(grid, x, y, GRASS, 5);
    }
    setCell(grid, bx + 2, by + 1, SAND, 5); // the covering, directly above the test subject
    setCell(grid, bx + 2, by + 3, WATER, 5); // trigger, directly below the test subject

    const grassCountBefore = grid.grassCount;
    for (let i = 0; i < 50; i++) step(grid);
    expect(grid.grassCount).toBe(grassCountBefore);

    // Uncover the grass by clearing the covering sand.
    setCell(grid, bx + 2, by + 1, EMPTY, 0);
    for (let i = 0; i < 50; i++) step(grid);

    expect(grid.grassCount).toBeGreaterThan(grassCountBefore);
  });
});

describe('grass — no water anywhere (FR-016, SC-010)', () => {
  it('running step() 10,000 times with zero WATER cells produces 0 new grass cells and 0 changes to existing grass', () => {
    const grid = createGrid(10, 10);
    setCell(grid, 3, 9, GRASS, 5);
    setCell(grid, 3, 8, GRASS, 7); // stacked on top — height 1
    setCell(grid, 6, 5, GRASS, 20); // isolated, mid-air — height 0

    const elementsBefore = Array.from(grid.elements);
    const shadesBefore = Array.from(grid.shades);
    const grassHeightBefore = Array.from(grid.grassHeight);
    const grassCountBefore = grid.grassCount;

    for (let i = 0; i < 10000; i++) step(grid);

    expect(Array.from(grid.elements)).toEqual(elementsBefore);
    expect(Array.from(grid.shades)).toEqual(shadesBefore);
    expect(Array.from(grid.grassHeight)).toEqual(grassHeightBefore);
    expect(grid.grassCount).toBe(grassCountBefore);
  });
});

describe('grass — gentle and bounded under unlimited watering (FR-011, FR-012, SC-006)', () => {
  it('no blade exceeds the height ceiling once the field runs to a standstill', () => {
    const grid = buildFloodedGrassContainer(60, 30);
    runUntilStandstill(grid, 4000);

    for (let i = 0; i < grid.elements.length; i++) {
      if (grid.elements[i] === GRASS) {
        expect(grid.grassHeight[i]).toBeLessThanOrEqual(GRASS_HEIGHT_CEILING);
      }
    }
  });

  it('grass never exceeds the field-share ceiling once the field runs to a standstill', () => {
    const grid = buildFloodedGrassContainer(60, 30);
    runUntilStandstill(grid, 4000);

    expect(grid.grassCount / (grid.width * grid.height)).toBeLessThanOrEqual(GRASS_FIELD_SHARE_CEILING);
  });
});

describe('grass — a lake beside mature grass is never drained (FR-008, SC-007)', () => {
  it('once grass can no longer grow, further step() calls neither absorb nor grow anything, and all remaining water stays in place', () => {
    const grid = buildFloodedGrassContainer(60, 30);
    runUntilStandstill(grid, 4000);

    const countWater = (): number => {
      let count = 0;
      for (let i = 0; i < grid.elements.length; i++) if (grid.elements[i] === WATER) count++;
      return count;
    };

    const waterCountBefore = countWater();
    expect(waterCountBefore).toBeGreaterThanOrEqual(200);
    const grassCountBefore = grid.grassCount;

    // Ordinary water may still harmlessly shuffle position between equally-open neighbors (the
    // same "pools and levels" behavior every liquid has) — what must hold is that none of it is
    // ever absorbed and no further grass ever appears.
    for (let i = 0; i < 50; i++) step(grid);

    expect(countWater()).toBe(waterCountBefore);
    expect(grid.grassCount).toBe(grassCountBefore);
  });
});

describe('grass — pacing bounds total absorption over a run (FR-009, FR-014, SC-005, SC-008)', () => {
  it('a single grass cell beside a very large body of water absorbs at most floor(stepsRun / 10) water cells', () => {
    const grid = createGrid(80, 80);
    setCell(grid, 40, 60, GRASS, 5);
    // A very large body of water, far more than the pacing bound could ever consume.
    for (let y = 10; y < 60; y++) {
      for (let x = 10; x < 70; x++) setCell(grid, x, y, WATER, 5);
    }
    setCell(grid, 41, 60, WATER, 5); // orthogonally adjacent to the single grass cell

    const grassCountBefore = grid.grassCount;
    let waterCountBefore = 0;
    for (let i = 0; i < grid.elements.length; i++) if (grid.elements[i] === WATER) waterCountBefore++;

    const STEPS = 500;
    for (let i = 0; i < STEPS; i++) step(grid);

    let waterCountAfter = 0;
    for (let i = 0; i < grid.elements.length; i++) if (grid.elements[i] === WATER) waterCountAfter++;
    const waterAbsorbed = waterCountBefore - waterCountAfter;
    const newGrassCells = grid.grassCount - grassCountBefore;

    expect(waterAbsorbed).toBeLessThanOrEqual(Math.floor(STEPS / 10));
    expect(newGrassCells).toBeLessThanOrEqual(waterAbsorbed);
  });
});

describe('grass — the rules are size-independent (FR-032)', () => {
  it('the same height-ceiling and field-share-ceiling outcomes hold at a phone-sized grid', () => {
    const field = computePlayField(390, 700, true);
    const grid = buildFloodedGrassContainer(field.gridWidth, field.gridHeight);
    // The height/field-share ceilings are enforced synchronously on every write, so they hold at
    // any point in the run, not only at true standstill — a bounded run is enough to exercise
    // them at this (much larger) grid size without the cost of full-array standstill detection.
    for (let i = 0; i < 600; i++) step(grid);

    for (let i = 0; i < grid.elements.length; i++) {
      if (grid.elements[i] === GRASS) {
        expect(grid.grassHeight[i]).toBeLessThanOrEqual(GRASS_HEIGHT_CEILING);
      }
    }
    expect(grid.grassCount / (grid.width * grid.height)).toBeLessThanOrEqual(GRASS_FIELD_SHARE_CEILING);
  });
});
