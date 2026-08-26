import { describe, it, expect } from 'vitest';
import { sceneRegions, generateLandscape1, loadScene } from '../../../src/sim/scenes';
import { createGrid, getElement } from '../../../src/sim/grid';
import { createObjectsState } from '../../../src/sim/objects';
import { applyRainbowConversions } from '../../../src/sim/objects';
import { step } from '../../../src/sim/step';
import { DIRT, WATER, type Grid } from '../../../src/sim/types';

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

  it('holds its shape with no drawing input across many step() calls (FR-020, SC-006)', () => {
    const grid = createGrid(270, 160);
    const objects = createObjectsState();
    generateLandscape1(grid, objects);
    const regions = sceneRegions(270, 160);
    const { x0, x1, y0, y1 } = regions.lowerPortion;

    const heightsBefore = heightProfile(grid, x0, x1, y0, y1);
    const waterBefore = countWater(grid);

    for (let i = 0; i < 50; i++) step(grid);

    const heightsAfter = heightProfile(grid, x0, x1, y0, y1);
    const waterAfter = countWater(grid);

    expect(heightsAfter).toEqual(heightsBefore);
    expect(waterAfter).toBe(waterBefore);
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
