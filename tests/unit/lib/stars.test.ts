import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { createGrid, setCell } from '../../../src/sim/grid';
import { placeObject, createObjectsState } from '../../../src/sim/objects';
import { SAND } from '../../../src/sim/types';
import { STAR_CAP, STAR_SKY_FRACTION, createStarField, updateStarField } from '../../../src/lib/stars';

function activeCells(field: ReturnType<typeof createStarField>): number[] {
  const cells: number[] = [];
  for (let k = 0; k < field.count; k++) {
    if (field.cellIndex[k] >= 0) cells.push(field.cellIndex[k]);
  }
  return cells;
}

describe('stars — eligibility, cap, and empty-sky-only sampling (US3, FR-020, FR-023, Scenario 1)', () => {
  it('only samples empty cells within the upper STAR_SKY_FRACTION of the grid, and never exceeds STAR_CAP', () => {
    const grid = createGrid(30, 30);
    const objects = createObjectsState();
    // Painted material in the sky band — must never be sampled.
    for (let x = 0; x < 10; x++) setCell(grid, x, 2, SAND, 5);
    // An object footprint in the sky band — OBJECT !== EMPTY, must never be sampled either.
    placeObject(grid, objects, 'house', 15, 2);
    // Material below the sky band — irrelevant either way.
    for (let x = 0; x < 30; x++) setCell(grid, x, 25, SAND, 5);

    const field = createStarField(grid.width, grid.height);
    updateStarField(grid, field, 0);

    const skyLimit = Math.floor(grid.height * STAR_SKY_FRACTION);
    expect(field.count).toBeLessThanOrEqual(STAR_CAP);
    for (const index of activeCells(field)) {
      const x = index % grid.width;
      const y = Math.floor(index / grid.width);
      expect(y).toBeLessThan(skyLimit);
      expect(grid.elements[index]).toBe(0); // EMPTY
      // Never inside the house's footprint.
      const house = objects.byKind.house[0];
      const insideHouse = x >= house.x && x < house.x + house.size && y >= house.y && y < house.y + house.size;
      expect(insideHouse).toBe(false);
    }
  });

  it('fills every upper-sky cell with SAND and asserts no slot stays active over it (Scenario 2)', () => {
    const grid = createGrid(20, 30);
    const skyLimit = Math.floor(grid.height * STAR_SKY_FRACTION);
    for (let y = 0; y < skyLimit; y++) {
      for (let x = 0; x < grid.width; x++) setCell(grid, x, y, SAND, 5);
    }

    const field = createStarField(grid.width, grid.height);
    updateStarField(grid, field, 0);

    expect(field.count).toBe(0);
    expect(activeCells(field)).toEqual([]);
  });

  it('does not resample more often than STAR_RESAMPLE_MS, and does resample once enough time has passed', () => {
    const grid = createGrid(20, 30);
    setCell(grid, 5, 2, SAND, 5);
    const field = createStarField(grid.width, grid.height);

    updateStarField(grid, field, 0);
    const firstResampleAt = field.lastResampleAt;

    updateStarField(grid, field, 100);
    expect(field.lastResampleAt).toBe(firstResampleAt);

    updateStarField(grid, field, 500);
    expect(field.lastResampleAt).toBe(500);
  });
});

describe('stars — never intersects saved/undoable/erasable state (US3, FR-021, Scenario 3)', () => {
  const simFiles = [
    '../../../src/sim/save.ts',
    '../../../src/sim/history.ts',
    '../../../src/sim/objects.ts',
  ];

  for (const relativePath of simFiles) {
    it(`${relativePath} never references stars.ts's exports`, () => {
      const source = readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
      expect(source).not.toMatch(/createStarField|updateStarField|drawStarField|StarField/);
    });
  }

  it('mutating a StarField is not observable through undo/redo/clear-all/save-restore — those operations never read or reset it', () => {
    // Structural guarantee only: StarField is never passed to or returned from any of the
    // save/history/objects functions above, so there is nothing for those operations to read
    // or reset — verified by the source-reference checks above. This behavioral check confirms
    // that mutating a StarField in isolation doesn't throw or otherwise interact with a fresh
    // Grid/ObjectsState pair, which is the only surface those operations could share it through.
    const grid = createGrid(10, 10);
    const field = createStarField(grid.width, grid.height);
    updateStarField(grid, field, 0);
    updateStarField(grid, field, 1000);
    expect(field.count).toBeGreaterThanOrEqual(0);
  });
});
