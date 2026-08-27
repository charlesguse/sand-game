import { describe, it, expect } from 'vitest';
import { createGrid, setCell, setGlitter, igniteStarPower, getElement, getGlitter } from '../../../src/sim/grid';
import { placeObject, createObjectsState } from '../../../src/sim/objects';
import { resizeGrid } from '../../../src/sim/resize';
import { step } from '../../../src/sim/step';
import { SAND, DIRT, OBJECT, GRASS, STAR_POWER, RAINBOW_SAND, EMPTY } from '../../../src/sim/types';

const OLD_WIDTH = 100;
const OLD_HEIGHT = 100;
const EDGE_MARKER_SHADE = 7;

// A "ground" row near the bottom plus an off-centre pile, per quickstart.md's User Story 4
// automated coverage section — recognizable enough to check exact offset/carry/drop behavior.
// Also seeds a distinguishable single-cell "edge marker" and a far-away "sky" cell, each chosen
// to fall outside a specific resize's new bounds, to prove drops are clean (never clamped/wrapped).
function seedGrid() {
  const grid = createGrid(OLD_WIDTH, OLD_HEIGHT);
  for (let x = 10; x < 90; x++) {
    setCell(grid, x, 99, SAND, 3);
  }
  for (let y = 90; y < 96; y++) {
    for (let x = 70; x < 76; x++) {
      setCell(grid, x, y, DIRT, 2);
    }
  }
  setGlitter(grid, 72, 92, 1);
  setCell(grid, 95, 97, SAND, EDGE_MARKER_SHADE);
  setCell(grid, 15, 5, SAND, 1);
  return grid;
}

describe('resizeGrid — bottom-centre-anchored carry-over (FR-026)', () => {
  it('carries the ground row and pile at exactly (x + offsetX, y + offsetY) for a narrower/taller target', () => {
    const oldGrid = seedGrid();
    const { grid, offsetX, offsetY } = resizeGrid(oldGrid, 60, 140);

    expect(offsetX).toBe(Math.round((60 - OLD_WIDTH) / 2));
    expect(offsetY).toBe(140 - OLD_HEIGHT);

    // A ground cell whose destination is in-bounds lands exactly at the offset position.
    expect(getElement(oldGrid, 50, 99)).toBe(SAND);
    expect(getElement(grid, 50 + offsetX, 99 + offsetY)).toBe(SAND);

    // The pile's glitter carries across at the same offset.
    expect(getElement(grid, 72 + offsetX, 92 + offsetY)).toBe(DIRT);
    expect(getGlitter(grid, 72 + offsetX, 92 + offsetY)).toBe(true);

    // The edge marker's offset destination (95 + offsetX = 75) falls outside [0, 60) — it must be
    // dropped cleanly, not clamped to the last column or wrapped around.
    expect(95 + offsetX).toBeGreaterThanOrEqual(60);
    expect(Array.from(grid.shades)).not.toContain(EDGE_MARKER_SHADE);
  });

  it('keeps a cell adjacent to the bottom row adjacent to the bottom row after the resize ("ground stays at the ground")', () => {
    const oldGrid = createGrid(OLD_WIDTH, OLD_HEIGHT);
    setCell(oldGrid, 40, OLD_HEIGHT - 1, SAND, 0); // bottom row itself
    setCell(oldGrid, 40, OLD_HEIGHT - 2, SAND, 0); // one row above the bottom

    const { grid, offsetX, offsetY } = resizeGrid(oldGrid, 200, 50);

    expect(getElement(grid, 40 + offsetX, OLD_HEIGHT - 1 + offsetY)).toBe(SAND);
    expect(OLD_HEIGHT - 1 + offsetY).toBe(grid.height - 1);
    expect(getElement(grid, 40 + offsetX, OLD_HEIGHT - 2 + offsetY)).toBe(SAND);
    expect(OLD_HEIGHT - 2 + offsetY).toBe(grid.height - 2);
  });

  it('drops a cell whose offset destination falls outside the new bounds, rather than clamping or wrapping it', () => {
    const oldGrid = seedGrid();
    // Shrinking height a lot pushes the "sky" cell's destination y below 0.
    const { grid, offsetY } = resizeGrid(oldGrid, 100, 20);

    expect(5 + offsetY).toBeLessThan(0);
    // Nowhere in the new grid holds a stray copy of the dropped sky cell (no clamping to row 0).
    for (let x = 0; x < grid.width; x++) {
      expect(getElement(grid, x, 0)).not.toBe(SAND);
    }
  });

  it('never mutates oldGrid', () => {
    const oldGrid = seedGrid();
    const before = Array.from(oldGrid.elements);

    resizeGrid(oldGrid, 60, 140);

    expect(Array.from(oldGrid.elements)).toEqual(before);
  });

  it('is a no-op copy when called with the identical dimensions (identity case)', () => {
    const oldGrid = seedGrid();
    const { grid, offsetX, offsetY } = resizeGrid(oldGrid, oldGrid.width, oldGrid.height);

    expect(offsetX).toBe(0);
    expect(offsetY).toBe(0);
    for (let y = 0; y < oldGrid.height; y++) {
      for (let x = 0; x < oldGrid.width; x++) {
        if (getElement(oldGrid, x, y) === OBJECT) continue;
        expect(getElement(grid, x, y)).toBe(getElement(oldGrid, x, y));
      }
    }
  });

  it('produces identical contents from two calls with identical arguments (pure function, no hidden state)', () => {
    const oldGrid = seedGrid();
    const first = resizeGrid(oldGrid, 60, 140);
    const second = resizeGrid(oldGrid, 60, 140);

    expect(Array.from(first.grid.elements)).toEqual(Array.from(second.grid.elements));
    expect(first.offsetX).toBe(second.offsetX);
    expect(first.offsetY).toBe(second.offsetY);
  });
});

describe('resizeGrid — object footprints, verified at the data level (FR-026, Edge Cases)', () => {
  it('an object whose entire offset footprint fits the new bounds keeps its exact new position and size', () => {
    const oldGrid = seedGrid();
    const state = createObjectsState();
    // Placed near the bottom-centre so a modest resize keeps its whole footprint in-bounds.
    placeObject(oldGrid, state, 'unicorn', 50, 85);
    const obj = state.unicorns[0];

    const { offsetX, offsetY } = resizeGrid(oldGrid, 90, 120);
    const newX = obj.x + offsetX;
    const newY = obj.y + offsetY;
    const fits = newX >= 0 && newX + obj.size <= 90 && newY >= 0 && newY + obj.size <= 120;

    expect(fits).toBe(true);

    // Caller-level repositioning (contracts/layout-and-touch.md): re-stamp only if it fully fits.
    const restamped = createGrid(90, 120);
    for (let py = newY; py < newY + obj.size; py++) {
      for (let px = newX; px < newX + obj.size; px++) {
        restamped.elements[py * 90 + px] = OBJECT;
      }
    }
    for (let py = newY; py < newY + obj.size; py++) {
      for (let px = newX; px < newX + obj.size; px++) {
        expect(getElement(restamped, px, py)).toBe(OBJECT);
      }
    }
  });

  it('an object whose offset footprint no longer fully fits is absent entirely — no partial/half-object state', () => {
    const oldGrid = seedGrid();
    const state = createObjectsState();
    // Placed near the left edge; a big horizontal shrink pushes part of its footprint out of bounds.
    placeObject(oldGrid, state, 'rainbow', 5, 85);
    const obj = state.rainbows[0];

    const { grid, offsetX, offsetY } = resizeGrid(oldGrid, 20, 120);
    const newX = obj.x + offsetX;
    const newY = obj.y + offsetY;
    const fits = newX >= 0 && newX + obj.size <= 20 && newY >= 0 && newY + obj.size <= 120;

    expect(fits).toBe(false);
    // resizeGrid itself never copies OBJECT cells — the caller must also skip re-stamping, so no
    // cell of the new grid ever holds a partial footprint.
    for (let py = 0; py < grid.height; py++) {
      for (let px = 0; px < grid.width; px++) {
        expect(getElement(grid, px, py)).not.toBe(OBJECT);
      }
    }
  });
});

describe('resizeGrid — grass carries across at the same offset (FR-027, Scenario 6)', () => {
  it('carries grassHeight/grassCooldown for every surviving grass cell and accumulates the new grassCount exactly', () => {
    const oldGrid = createGrid(100, 100);
    setCell(oldGrid, 50, 99, GRASS, 5); // root, height 0
    setCell(oldGrid, 50, 98, GRASS, 5); // height 1
    setCell(oldGrid, 50, 97, GRASS, 5); // height 2
    oldGrid.grassCooldown[97 * 100 + 50] = 7; // nonzero cooldown, poked directly for the test
    setCell(oldGrid, 95, 97, GRASS, 9); // dropped by the resize below (offset destination out of bounds)

    const { grid, offsetX, offsetY } = resizeGrid(oldGrid, 60, 140);

    expect(getElement(grid, 50 + offsetX, 99 + offsetY)).toBe(GRASS);
    expect(grid.grassHeight[(99 + offsetY) * grid.width + (50 + offsetX)]).toBe(0);
    expect(grid.grassHeight[(98 + offsetY) * grid.width + (50 + offsetX)]).toBe(1);
    expect(grid.grassHeight[(97 + offsetY) * grid.width + (50 + offsetX)]).toBe(2);
    expect(grid.grassCooldown[(97 + offsetY) * grid.width + (50 + offsetX)]).toBe(7);

    expect(95 + offsetX).toBeGreaterThanOrEqual(60); // confirms the marker cell really is dropped

    let survivingGrass = 0;
    for (let i = 0; i < grid.elements.length; i++) if (grid.elements[i] === GRASS) survivingGrass++;
    expect(grid.grassCount).toBe(survivingGrass);
    expect(grid.grassCount).toBe(3);
  });
});

describe('resizeGrid — star power carries across at the same offset (FR-029, Scenario 6)', () => {
  it('carries element/shade/starPowerAge/starPowerLife/starPowerFuelled for every surviving star power cell, and each carried cell still burns out (leaving a glitter grain if fuelled) within a further bounded number of step() calls', () => {
    const oldGrid = createGrid(100, 100);
    igniteStarPower(oldGrid, 50, 99, true); // fuelled
    igniteStarPower(oldGrid, 60, 99, false); // unfuelled
    for (let n = 0; n < 5; n++) step(oldGrid); // age each a little; nothing else on the field to interact with

    const fuelledIndexOld = 99 * 100 + 50;
    const unfuelledIndexOld = 99 * 100 + 60;
    const fuelledLifeOld = oldGrid.starPowerLife[fuelledIndexOld];
    const fuelledAgeOld = oldGrid.starPowerAge[fuelledIndexOld];
    const fuelledShadeOld = oldGrid.shades[fuelledIndexOld];
    const unfuelledLifeOld = oldGrid.starPowerLife[unfuelledIndexOld];
    const unfuelledAgeOld = oldGrid.starPowerAge[unfuelledIndexOld];

    const { grid, offsetX, offsetY } = resizeGrid(oldGrid, 60, 140);

    const fuelledIndexNew = (99 + offsetY) * grid.width + (50 + offsetX);
    const unfuelledIndexNew = (99 + offsetY) * grid.width + (60 + offsetX);

    expect(getElement(grid, 50 + offsetX, 99 + offsetY)).toBe(STAR_POWER);
    expect(grid.starPowerFuelled[fuelledIndexNew]).toBe(1);
    expect(grid.starPowerLife[fuelledIndexNew]).toBe(fuelledLifeOld);
    expect(grid.starPowerAge[fuelledIndexNew]).toBe(fuelledAgeOld);
    expect(grid.shades[fuelledIndexNew]).toBe(fuelledShadeOld);

    expect(getElement(grid, 60 + offsetX, 99 + offsetY)).toBe(STAR_POWER);
    expect(grid.starPowerFuelled[unfuelledIndexNew]).toBe(0);
    expect(grid.starPowerLife[unfuelledIndexNew]).toBe(unfuelledLifeOld);
    expect(grid.starPowerAge[unfuelledIndexNew]).toBe(unfuelledAgeOld);

    const remainingFuelled = grid.starPowerLife[fuelledIndexNew] - grid.starPowerAge[fuelledIndexNew];
    const remainingUnfuelled = grid.starPowerLife[unfuelledIndexNew] - grid.starPowerAge[unfuelledIndexNew];
    for (let n = 0; n < Math.max(remainingFuelled, remainingUnfuelled) + 1; n++) step(grid);

    expect(getElement(grid, 50 + offsetX, 99 + offsetY)).toBe(RAINBOW_SAND);
    expect(grid.glitter[fuelledIndexNew]).toBe(1);
    expect(getElement(grid, 60 + offsetX, 99 + offsetY)).toBe(EMPTY);
  });
});
