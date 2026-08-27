import { describe, it, expect } from 'vitest';
import { sceneRegions, generateLandscape1, generateLandscape2, loadScene } from '../../../src/sim/scenes';
import { createGrid, getElement, setCell, igniteStarPower } from '../../../src/sim/grid';
import {
  createObjectsState,
  placeObject,
  applyRainbowConversions,
  eraseObjectsInBrush,
} from '../../../src/sim/objects';
import { step } from '../../../src/sim/step';
import { DIRT, SAND, WATER, EMPTY, GRASS, STAR_POWER, type Grid } from '../../../src/sim/types';
import { GRID_WIDTH, GRID_HEIGHT } from '../../../src/lib/layout';

/** Topmost row in [y0, y1) for column x holding `element` (the terrain fill, ignoring any OBJECT overlay), or y1 if none. */
function topRow(grid: Grid, x: number, y0: number, y1: number, element: number): number {
  for (let y = y0; y < y1; y++) {
    if (getElement(grid, x, y) === element) return y;
  }
  return y1;
}

function heightProfile(
  grid: Grid,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  element: number = DIRT,
): number[] {
  const heights: number[] = [];
  for (let x = x0; x < x1; x++) heights.push(topRow(grid, x, y0, y1, element));
  return heights;
}

function countWater(grid: Grid): number {
  let count = 0;
  for (let i = 0; i < grid.elements.length; i++) if (grid.elements[i] === WATER) count++;
  return count;
}

function countGrass(grid: Grid): number {
  let count = 0;
  for (let i = 0; i < grid.elements.length; i++) if (grid.elements[i] === GRASS) count++;
  return count;
}

describe('scenes — generateLandscape1', () => {
  it('DIRT cells lie only within lowerPortion, with ≥2 crests and a valley between them', () => {
    const grid = createGrid(270, 160);
    const objects = createObjectsState();
    generateLandscape1(grid, objects);
    const regions = sceneRegions(270, 160);
    const { x0, x1, y0, y1 } = regions.lowerPortion;

    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        if (getElement(grid, x, y) === DIRT) {
          expect(x).toBeGreaterThanOrEqual(x0);
          expect(x).toBeLessThan(x1);
          expect(y).toBeGreaterThanOrEqual(y0);
          expect(y).toBeLessThan(y1);
        }
      }
    }

    const heights = heightProfile(grid, x0, x1, y0, y1);
    for (let i = 1; i < heights.length; i++) {
      expect(Math.abs(heights[i] - heights[i - 1])).toBeLessThanOrEqual(1);
    }

    const third = Math.floor(heights.length / 3);
    const leftThird = heights.slice(0, third);
    const rightThird = heights.slice(heights.length - third);
    const middleFifth = heights.slice(
      Math.floor(heights.length * 0.4),
      Math.floor(heights.length * 0.6),
    );
    const crest1 = Math.min(...leftThird);
    const crest2 = Math.min(...rightThird);
    const valley = Math.max(...middleFifth);

    expect(valley).toBeGreaterThan(crest1 + 5);
    expect(valley).toBeGreaterThan(crest2 + 5);
  });

  it('WATER fills the valley strictly below the surrounding crests, touching no column outside the valley span', () => {
    const grid = createGrid(270, 160);
    const objects = createObjectsState();
    generateLandscape1(grid, objects);
    const regions = sceneRegions(270, 160);
    const { x0, x1, y0, y1 } = regions.lowerPortion;
    const heights = heightProfile(grid, x0, x1, y0, y1);

    const third = Math.floor(heights.length / 3);
    let crest1Index = 0;
    for (let i = 1; i < third; i++) if (heights[i] < heights[crest1Index]) crest1Index = i;
    let crest2Index = heights.length - third;
    for (let i = heights.length - third; i < heights.length; i++) {
      if (heights[i] < heights[crest2Index]) crest2Index = i;
    }

    const waterColumns: { x: number; top: number }[] = [];
    for (let x = 0; x < grid.width; x++) {
      const top = topRowWithElement(grid, x, WATER);
      if (top !== -1) waterColumns.push({ x, top });
    }

    expect(waterColumns.length).toBeGreaterThan(0);

    const waterTop = waterColumns[0].top;
    for (const { x, top } of waterColumns) {
      expect(top).toBe(waterTop);
      expect(x).toBeGreaterThan(x0 + crest1Index);
      expect(x).toBeLessThan(x0 + crest2Index);
    }

    expect(waterTop).toBeGreaterThan(heights[crest1Index]);
    expect(waterTop).toBeGreaterThan(heights[crest2Index]);
  });

  it('places exactly one rainbow in the sky, clear of the scene’s own terrain/water', () => {
    const grid = createGrid(270, 160);
    const objects = createObjectsState();
    generateLandscape1(grid, objects);
    const regions = sceneRegions(270, 160);

    expect(objects.rainbows.length).toBe(1);
    const [rainbow] = objects.rainbows;
    expect(rainbow.x).toBeGreaterThanOrEqual(regions.sky.x0);
    expect(rainbow.x + rainbow.size).toBeLessThanOrEqual(regions.sky.x1);
    expect(rainbow.y).toBeGreaterThanOrEqual(regions.sky.y0);
    expect(rainbow.y + rainbow.size).toBeLessThanOrEqual(regions.sky.y1);

    const before = Array.from(grid.elements);
    applyRainbowConversions(grid, objects.rainbows);
    const after = Array.from(grid.elements);
    expect(after).toEqual(before);
  });

  it('places exactly one unicorn resting on the taller crest', () => {
    const grid = createGrid(270, 160);
    const objects = createObjectsState();
    generateLandscape1(grid, objects);
    const regions = sceneRegions(270, 160);
    const { x0, x1, y0, y1 } = regions.lowerPortion;
    const heights = heightProfile(grid, x0, x1, y0, y1);

    expect(objects.unicorns.length).toBe(1);
    const [unicorn] = objects.unicorns;
    const unicornColumnIndex = unicorn.x + Math.floor(unicorn.size / 2) - x0;
    const surface = heights[Math.max(0, Math.min(heights.length - 1, unicornColumnIndex))];
    expect(unicorn.y + unicorn.size).toBe(surface);
  });
});

function topRowWithElement(grid: Grid, x: number, element: number): number {
  for (let y = 0; y < grid.height; y++) {
    if (getElement(grid, x, y) === element) return y;
  }
  return -1;
}

describe('scenes — generateLandscape1 determinism and at-rest stability', () => {
  it('produces byte-for-byte identical grid/objects across two fresh calls (FR-023)', () => {
    const gridA = createGrid(270, 160);
    const objectsA = createObjectsState();
    generateLandscape1(gridA, objectsA);

    const gridB = createGrid(270, 160);
    const objectsB = createObjectsState();
    generateLandscape1(gridB, objectsB);

    expect(Array.from(gridA.elements)).toEqual(Array.from(gridB.elements));
    expect(Array.from(gridA.shades)).toEqual(Array.from(gridB.shades));
    expect(Array.from(gridA.hues)).toEqual(Array.from(gridB.hues));

    const strip = (list: { kind: string; x: number; y: number; size: number }[]) =>
      list.map(({ kind, x, y, size }) => ({ kind, x, y, size }));
    expect(strip(objectsA.rainbows)).toEqual(strip(objectsB.rainbows));
    expect(strip(objectsA.unicorns)).toEqual(strip(objectsB.unicorns));
  });

  it('holds its hill shape with no drawing input, while its shoreline grass drinks a bounded amount at the water\'s edge and then halts (FR-020, FR-028a, SC-006, SC-022 — supersedes spec 004\'s exact water conservation for landscape-1 only)', () => {
    const grid = createGrid(270, 160);
    const objects = createObjectsState();
    generateLandscape1(grid, objects);
    const regions = sceneRegions(270, 160);
    const { x0, x1, y0, y1 } = regions.lowerPortion;

    const heightsBefore = heightProfile(grid, x0, x1, y0, y1);
    const waterBefore = countWater(grid);

    for (let i = 0; i < 2000; i++) step(grid);

    const heightsAfter = heightProfile(grid, x0, x1, y0, y1);
    const waterAfter = countWater(grid);

    expect(heightsAfter).toEqual(heightsBefore);
    expect(waterAfter).toBeLessThanOrEqual(waterBefore);
    expect(waterAfter).toBeGreaterThanOrEqual(waterBefore / 2); // SC-022: at least half the lake survives

    // Growth has halted — further steps change nothing more.
    for (let i = 0; i < 200; i++) step(grid);
    expect(countWater(grid)).toBe(waterAfter);
  });
});

describe('scenes — loadScene(\'landscape1\')', () => {
  it('generates landscape 1 through the loadScene entry point', () => {
    const grid = createGrid(270, 160);
    const objects = createObjectsState();
    loadScene('landscape1', grid, objects);

    expect(objects.rainbows.length).toBe(1);
    expect(objects.unicorns.length).toBe(1);
    expect(countWater(grid)).toBeGreaterThan(0);
  });
});

describe('scenes — generateLandscape2', () => {
  it('SAND is the dominant terrain within lowerPortion, sloping monotonically (≤1 row/column)', () => {
    const grid = createGrid(270, 160);
    const objects = createObjectsState();
    generateLandscape2(grid, objects);
    const regions = sceneRegions(270, 160);
    const { x0, x1, y0, y1 } = regions.lowerPortion;

    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        if (getElement(grid, x, y) === SAND) {
          expect(x).toBeGreaterThanOrEqual(x0);
          expect(x).toBeLessThan(x1);
          expect(y).toBeGreaterThanOrEqual(y0);
          expect(y).toBeLessThan(y1);
        }
      }
    }

    const heights = heightProfile(grid, x0, x1, y0, y1, SAND);
    for (let i = 1; i < heights.length; i++) {
      const diff = heights[i] - heights[i - 1];
      expect(Math.abs(diff)).toBeLessThanOrEqual(1);
      expect(diff).toBeGreaterThanOrEqual(0);
    }
    expect(heights[heights.length - 1]).toBeGreaterThan(heights[0]);
  });

  it('a large WATER body fills the lower-elevation side within rightHalf, touching no column outside that span', () => {
    const grid = createGrid(270, 160);
    const objects = createObjectsState();
    generateLandscape2(grid, objects);
    const regions = sceneRegions(270, 160);

    const waterColumns: number[] = [];
    for (let x = 0; x < grid.width; x++) {
      if (topRowWithElement(grid, x, WATER) !== -1) waterColumns.push(x);
    }
    expect(waterColumns.length).toBeGreaterThan(20);
    for (const x of waterColumns) {
      expect(x).toBeGreaterThanOrEqual(regions.rightHalf.x0);
      expect(x).toBeLessThan(regions.rightHalf.x1);
    }
  });

  it('places exactly two rainbows in the sky, spaced apart, clear of the scene’s own terrain/water', () => {
    const grid = createGrid(270, 160);
    const objects = createObjectsState();
    generateLandscape2(grid, objects);
    const regions = sceneRegions(270, 160);

    expect(objects.rainbows.length).toBe(2);
    for (const rainbow of objects.rainbows) {
      expect(rainbow.x).toBeGreaterThanOrEqual(regions.sky.x0);
      expect(rainbow.x + rainbow.size).toBeLessThanOrEqual(regions.sky.x1);
      expect(rainbow.y).toBeGreaterThanOrEqual(regions.sky.y0);
      expect(rainbow.y + rainbow.size).toBeLessThanOrEqual(regions.sky.y1);
    }
    const [a, b] = objects.rainbows;
    expect(Math.abs(a.x - b.x)).toBeGreaterThan(a.size);

    const before = Array.from(grid.elements);
    applyRainbowConversions(grid, objects.rainbows);
    const after = Array.from(grid.elements);
    expect(after).toEqual(before);
  });

  it('places exactly one unicorn near the sand/water boundary, resting on the sloped surface', () => {
    const grid = createGrid(270, 160);
    const objects = createObjectsState();
    generateLandscape2(grid, objects);
    const regions = sceneRegions(270, 160);
    const { x0, x1, y0, y1 } = regions.lowerPortion;
    const heights = heightProfile(grid, x0, x1, y0, y1, SAND);

    expect(objects.unicorns.length).toBe(1);
    const [unicorn] = objects.unicorns;
    const columnIndex = unicorn.x + Math.floor(unicorn.size / 2) - x0;
    const surface = heights[Math.max(0, Math.min(heights.length - 1, columnIndex))];
    expect(unicorn.y + unicorn.size).toBe(surface);
    expect(Math.abs(unicorn.x - regions.rightHalf.x0)).toBeLessThan(30);
  });
});

describe('scenes — generateLandscape2 determinism (FR-023)', () => {
  it('produces byte-for-byte identical grid/objects across two fresh calls', () => {
    const gridA = createGrid(270, 160);
    const objectsA = createObjectsState();
    generateLandscape2(gridA, objectsA);

    const gridB = createGrid(270, 160);
    const objectsB = createObjectsState();
    generateLandscape2(gridB, objectsB);

    expect(Array.from(gridA.elements)).toEqual(Array.from(gridB.elements));
    expect(Array.from(gridA.shades)).toEqual(Array.from(gridB.shades));
    expect(Array.from(gridA.hues)).toEqual(Array.from(gridB.hues));

    const strip = (list: { kind: string; x: number; y: number; size: number }[]) =>
      list.map(({ kind, x, y, size }) => ({ kind, x, y, size }));
    expect(strip(objectsA.rainbows)).toEqual(strip(objectsB.rainbows));
    expect(strip(objectsA.unicorns)).toEqual(strip(objectsB.unicorns));
  });
});

describe('scenes — loadScene', () => {
  it('clears every previous element/object before writing new contents regardless of prior state (FR-009)', () => {
    const grid = createGrid(270, 160);
    const objects = createObjectsState();
    setCell(grid, 5, 5, SAND, 10);
    placeObject(grid, objects, 'rainbow', 50, 50);
    for (let i = 0; i < 5; i++) step(grid);

    loadScene('landscape1', grid, objects);
    const freshGrid1 = createGrid(270, 160);
    const freshObjects1 = createObjectsState();
    generateLandscape1(freshGrid1, freshObjects1);
    expect(Array.from(grid.elements)).toEqual(Array.from(freshGrid1.elements));

    loadScene('landscape2', grid, objects);
    const freshGrid2 = createGrid(270, 160);
    const freshObjects2 = createObjectsState();
    generateLandscape2(freshGrid2, freshObjects2);
    expect(Array.from(grid.elements)).toEqual(Array.from(freshGrid2.elements));
  });

  it('loadScene(\'empty\', ...) leaves zero non-EMPTY cells and no objects (FR-011, SC-008)', () => {
    const grid = createGrid(270, 160);
    const objects = createObjectsState();
    setCell(grid, 5, 5, SAND, 10);
    placeObject(grid, objects, 'unicorn', 50, 50);
    for (let i = 0; i < 5; i++) step(grid);

    loadScene('empty', grid, objects);

    for (let i = 0; i < grid.elements.length; i++) expect(grid.elements[i]).toBe(EMPTY);
    expect(objects.rainbows.length).toBe(0);
    expect(objects.unicorns.length).toBe(0);
  });

  it('clears every existing grass cell along with everything else, with grassCount reset accordingly, before placing new contents (FR-028, Scenario 7)', () => {
    const grid = createGrid(270, 160);
    const objects = createObjectsState();
    setCell(grid, 5, 5, GRASS, 10);
    setCell(grid, 6, 5, GRASS, 11);
    expect(grid.grassCount).toBe(2);

    loadScene('empty', grid, objects);
    expect(grid.grassCount).toBe(0);
    for (let i = 0; i < grid.elements.length; i++) expect(grid.elements[i]).toBe(EMPTY);

    // Loading landscape-1 leaves no trace of the hand-drawn grass — only the scene's own.
    setCell(grid, 5, 5, GRASS, 10);
    loadScene('landscape1', grid, objects);
    const freshGrid = createGrid(270, 160);
    const freshObjects = createObjectsState();
    generateLandscape1(freshGrid, freshObjects);
    expect(Array.from(grid.elements)).toEqual(Array.from(freshGrid.elements));
    expect(grid.grassCount).toBe(freshGrid.grassCount);
  });
});

describe('scenes — size robustness (FR-022)', () => {
  const sizes: [number, number][] = [
    [150, 100],
    [GRID_WIDTH, GRID_HEIGHT],
    [500, 240],
  ];

  it.each(sizes)('generateLandscape1 stays within its regions at %ix%i', (width, height) => {
    const grid = createGrid(width, height);
    const objects = createObjectsState();
    generateLandscape1(grid, objects);
    const regions = sceneRegions(width, height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (getElement(grid, x, y) === DIRT) {
          expect(x).toBeGreaterThanOrEqual(regions.lowerPortion.x0);
          expect(x).toBeLessThan(regions.lowerPortion.x1);
          expect(y).toBeGreaterThanOrEqual(regions.lowerPortion.y0);
          expect(y).toBeLessThan(regions.lowerPortion.y1);
        }
      }
    }

    expect(objects.rainbows.length).toBe(1);
    const [rainbow] = objects.rainbows;
    expect(rainbow.y).toBeGreaterThanOrEqual(regions.sky.y0);
    expect(rainbow.y + rainbow.size).toBeLessThanOrEqual(regions.sky.y1);
    expect(objects.unicorns.length).toBe(1);
    expect(countWater(grid)).toBeGreaterThan(0);

    // FR-028a: grass is present on the hills, laid out within the same lowerPortion region.
    expect(countGrass(grid)).toBeGreaterThan(0);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (getElement(grid, x, y) === GRASS) {
          expect(x).toBeGreaterThanOrEqual(regions.lowerPortion.x0);
          expect(x).toBeLessThan(regions.lowerPortion.x1);
          expect(y).toBeGreaterThanOrEqual(regions.lowerPortion.y0);
          expect(y).toBeLessThan(regions.lowerPortion.y1);
        }
      }
    }
  });

  it.each(sizes)('generateLandscape2 stays within its regions at %ix%i', (width, height) => {
    const grid = createGrid(width, height);
    const objects = createObjectsState();
    generateLandscape2(grid, objects);
    const regions = sceneRegions(width, height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (getElement(grid, x, y) === SAND) {
          expect(x).toBeGreaterThanOrEqual(regions.lowerPortion.x0);
          expect(x).toBeLessThan(regions.lowerPortion.x1);
          expect(y).toBeGreaterThanOrEqual(regions.lowerPortion.y0);
          expect(y).toBeLessThan(regions.lowerPortion.y1);
        }
      }
    }

    expect(objects.rainbows.length).toBe(2);
    for (const rainbow of objects.rainbows) {
      expect(rainbow.y).toBeGreaterThanOrEqual(regions.sky.y0);
      expect(rainbow.y + rainbow.size).toBeLessThanOrEqual(regions.sky.y1);
    }
    expect(objects.unicorns.length).toBe(1);
    expect(countWater(grid)).toBeGreaterThan(0);

    // FR-028a: landscape-2 remains exactly as it was — not a blade of grass.
    expect(countGrass(grid)).toBe(0);
  });
});

describe('scenes — generateLandscape1 grass determinism (FR-028a, Scenario 9, SC-021)', () => {
  it('loading landscape-1 twice at the same size produces byte-identical grass placement', () => {
    const gridA = createGrid(270, 160);
    const objectsA = createObjectsState();
    generateLandscape1(gridA, objectsA);

    const gridB = createGrid(270, 160);
    const objectsB = createObjectsState();
    generateLandscape1(gridB, objectsB);

    const grassA = Array.from(gridA.elements).map((e, i) => (e === GRASS ? i : -1)).filter((i) => i !== -1);
    const grassB = Array.from(gridB.elements).map((e, i) => (e === GRASS ? i : -1)).filter((i) => i !== -1);
    expect(grassA).toEqual(grassB);
    expect(grassA.length).toBeGreaterThan(0);
    expect(Array.from(gridA.shades)).toEqual(Array.from(gridB.shades));
  });
});

describe('scenes — interaction after load (US3)', () => {
  it('erases the scene’s own unicorn and rainbow exactly like hand-placed objects, releasing their footprint to EMPTY', () => {
    const grid = createGrid(270, 160);
    const objects = createObjectsState();
    loadScene('landscape1', grid, objects);

    const [sceneUnicorn] = objects.unicorns;
    eraseObjectsInBrush(
      grid,
      objects,
      sceneUnicorn.x + sceneUnicorn.size / 2,
      sceneUnicorn.y + sceneUnicorn.size / 2,
      2,
    );
    expect(objects.unicorns.length).toBe(0);
    for (let py = sceneUnicorn.y; py < sceneUnicorn.y + sceneUnicorn.size; py++) {
      for (let px = sceneUnicorn.x; px < sceneUnicorn.x + sceneUnicorn.size; px++) {
        expect(getElement(grid, px, py)).toBe(EMPTY);
      }
    }

    const [sceneRainbow] = objects.rainbows;
    eraseObjectsInBrush(
      grid,
      objects,
      sceneRainbow.x + sceneRainbow.size / 2,
      sceneRainbow.y + sceneRainbow.size / 2,
      2,
    );
    expect(objects.rainbows.length).toBe(0);
  });

  it('reaching the per-type cap of 3 evicts the scene’s own object first, since it was placed oldest (FR-014)', () => {
    const grid = createGrid(270, 160);
    const objects = createObjectsState();
    loadScene('landscape1', grid, objects);
    const sceneRainbowId = objects.rainbows[0].id;

    placeObject(grid, objects, 'rainbow', 50, 50);
    placeObject(grid, objects, 'rainbow', 100, 50);
    placeObject(grid, objects, 'rainbow', 150, 50);

    expect(objects.rainbows.length).toBe(3);
    expect(objects.rainbows.some((o) => o.id === sceneRainbowId)).toBe(false);
  });
});

function countStarPower(grid: Grid): number {
  let count = 0;
  for (let i = 0; i < grid.elements.length; i++) if (grid.elements[i] === STAR_POWER) count++;
  return count;
}

describe('scenes — loadScene clears star power (FR-030, Scenario 3, 4)', () => {
  it('clears every existing star power cell before generating the chosen scene\'s contents, with no error and nothing left burning', () => {
    const grid = createGrid(270, 160);
    const objects = createObjectsState();
    igniteStarPower(grid, 5, 5, true);
    igniteStarPower(grid, 6, 6, false);
    expect(countStarPower(grid)).toBe(2);

    loadScene('landscape1', grid, objects);

    expect(countStarPower(grid)).toBe(0);
  });

  const sizes: [number, number][] = [
    [150, 100],
    [GRID_WIDTH, GRID_HEIGHT],
    [500, 240],
  ];

  it.each(sizes)(
    'none of the three scenes ever contains a STAR_POWER cell immediately after loading, at %ix%i',
    (width, height) => {
      const grid = createGrid(width, height);
      const objects = createObjectsState();

      loadScene('empty', grid, objects);
      expect(countStarPower(grid)).toBe(0);

      loadScene('landscape1', grid, objects);
      expect(countStarPower(grid)).toBe(0);

      loadScene('landscape2', grid, objects);
      expect(countStarPower(grid)).toBe(0);
    },
  );

  it("landscape-1's grass/waterline growth behavior is unchanged from spec 007 even after star power has previously been on the field", () => {
    const grid = createGrid(270, 160);
    const objects = createObjectsState();
    igniteStarPower(grid, 5, 5, true);

    loadScene('landscape1', grid, objects);
    const regions = sceneRegions(270, 160);
    const { x0, x1, y0, y1 } = regions.lowerPortion;
    const heightsBefore = heightProfile(grid, x0, x1, y0, y1);
    const waterBefore = countWater(grid);

    for (let i = 0; i < 2000; i++) step(grid);

    const heightsAfter = heightProfile(grid, x0, x1, y0, y1);
    const waterAfter = countWater(grid);

    expect(heightsAfter).toEqual(heightsBefore);
    expect(waterAfter).toBeLessThanOrEqual(waterBefore);
    expect(waterAfter).toBeGreaterThanOrEqual(waterBefore / 2);
    expect(countStarPower(grid)).toBe(0);
  });
});
