import { describe, it, expect } from 'vitest';
import { createGrid, setCell, getElement, getGlitter } from '../../../src/sim/grid';
import { applyWand, applyWandLine } from '../../../src/sim/wand';
import { applyRainbowConversions, createObjectsState, placeObject } from '../../../src/sim/objects';
import { forEachFootprintCell } from '../../../src/sim/brush';
import { SAND, WATER, DIRT, RAINBOW_SAND, EMPTY, OBJECT } from '../../../src/sim/types';

function coveredCells(cx: number, cy: number, radius: number): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  forEachFootprintCell(cx, cy, radius, (x, y) => cells.push({ x, y }));
  return cells;
}

describe('wand — conversion rule', () => {
  it('marks every seeded element type glittered without changing its element', () => {
    const grid = createGrid(10, 10);
    setCell(grid, 1, 1, SAND, 5);
    setCell(grid, 3, 1, WATER, 5);
    setCell(grid, 5, 1, DIRT, 5);
    setCell(grid, 7, 1, RAINBOW_SAND, 5);

    applyWand(grid, 1, 1, 0);
    applyWand(grid, 3, 1, 0);
    applyWand(grid, 5, 1, 0);
    applyWand(grid, 7, 1, 0);

    expect(getGlitter(grid, 1, 1)).toBe(true);
    expect(getElement(grid, 1, 1)).toBe(SAND);
    expect(getGlitter(grid, 3, 1)).toBe(true);
    expect(getElement(grid, 3, 1)).toBe(WATER);
    expect(getGlitter(grid, 5, 1)).toBe(true);
    expect(getElement(grid, 5, 1)).toBe(DIRT);
    expect(getGlitter(grid, 7, 1)).toBe(true);
    expect(getElement(grid, 7, 1)).toBe(RAINBOW_SAND);
  });

  it('is idempotent — repeated passes with identical arguments produce a byte-identical grid', () => {
    const grid = createGrid(10, 10);
    setCell(grid, 4, 4, SAND, 5);
    setCell(grid, 5, 5, WATER, 5);

    applyWand(grid, 4, 4, 3);
    const elementsAfterFirst = Array.from(grid.elements);
    const shadesAfterFirst = Array.from(grid.shades);
    const huesAfterFirst = Array.from(grid.hues);
    const glitterAfterFirst = Array.from(grid.glitter);

    applyWand(grid, 4, 4, 3);
    applyWand(grid, 4, 4, 3);

    expect(Array.from(grid.elements)).toEqual(elementsAfterFirst);
    expect(Array.from(grid.shades)).toEqual(shadesAfterFirst);
    expect(Array.from(grid.hues)).toEqual(huesAfterFirst);
    expect(Array.from(grid.glitter)).toEqual(glitterAfterFirst);
  });

  it('never empties, retypes, or displaces a seeded cell, and never glitters a cell outside its footprint', () => {
    const grid = createGrid(10, 10);
    setCell(grid, 4, 4, SAND, 5);
    setCell(grid, 8, 8, WATER, 5); // far outside the wand's footprint below

    applyWand(grid, 4, 4, 1);

    expect(getElement(grid, 4, 4)).toBe(SAND);
    expect(getElement(grid, 4, 4)).not.toBe(EMPTY);
    expect(getGlitter(grid, 8, 8)).toBe(false);
  });

  it('glitter survives rainbow conversion of a glittered grain', () => {
    const grid = createGrid(60, 60);
    const objects = createObjectsState();
    placeObject(grid, objects, 'rainbow', 30, 30);
    const [rainbow] = objects.rainbows;
    // Just outside the rainbow's footprint, inside its conversion zone border.
    const zoneX = rainbow.x - 1;
    const zoneY = rainbow.y + 1;
    setCell(grid, zoneX, zoneY, SAND, 5);
    applyWand(grid, zoneX, zoneY, 0);
    expect(getGlitter(grid, zoneX, zoneY)).toBe(true);

    applyRainbowConversions(grid, [rainbow]);

    expect(getElement(grid, zoneX, zoneY)).toBe(RAINBOW_SAND);
    expect(getGlitter(grid, zoneX, zoneY)).toBe(true);
  });
});

describe('wand — sprinkle into empty space', () => {
  it('sprinkles some but no more than one third of the covered empty cells with glittered RAINBOW_SAND', () => {
    const grid = createGrid(30, 30);
    const cells = coveredCells(15, 15, 2);

    applyWand(grid, 15, 15, 2);

    let sprinkled = 0;
    for (const { x, y } of cells) {
      if (getElement(grid, x, y) === RAINBOW_SAND && getGlitter(grid, x, y)) sprinkled++;
    }
    expect(sprinkled).toBeGreaterThan(0);
    expect(sprinkled).toBeLessThanOrEqual(Math.floor(cells.length / 3));
  });

  it('sprinkled grains are multicoloured — more than one distinct hue among them', () => {
    const grid = createGrid(60, 60);
    const cells = coveredCells(30, 30, 7);

    applyWand(grid, 30, 30, 7);

    const hues = new Set<number>();
    for (const { x, y } of cells) {
      const i = y * grid.width + x;
      if (grid.elements[i] === RAINBOW_SAND) hues.add(grid.hues[i]);
    }
    expect(hues.size).toBeGreaterThan(1);
  });

  it('a sprinkled cell is structurally indistinguishable from any other glittered RAINBOW_SAND cell', () => {
    const grid = createGrid(30, 30);
    applyWand(grid, 15, 15, 2);

    const cells = coveredCells(15, 15, 2);
    const sprinkled = cells.find(({ x, y }) => getElement(grid, x, y) === RAINBOW_SAND);
    expect(sprinkled).toBeDefined();
    if (!sprinkled) return;
    expect(getElement(grid, sprinkled.x, sprinkled.y)).toBe(RAINBOW_SAND);
    expect(getGlitter(grid, sprinkled.x, sprinkled.y)).toBe(true);
  });

  it('a mixed region glitters occupied cells and sprinkles only originally-empty cells, with no overlap', () => {
    const grid = createGrid(30, 30);
    const cells = coveredCells(15, 15, 4);
    const occupied = cells.filter((_, idx) => idx % 2 === 0);
    const originallyEmpty = cells.filter((_, idx) => idx % 2 !== 0);
    for (const { x, y } of occupied) setCell(grid, x, y, SAND, 5);

    applyWand(grid, 15, 15, 4);

    for (const { x, y } of occupied) {
      expect(getElement(grid, x, y)).toBe(SAND);
      expect(getGlitter(grid, x, y)).toBe(true);
    }
    for (const { x, y } of originallyEmpty) {
      const element = getElement(grid, x, y);
      expect(element === EMPTY || element === RAINBOW_SAND).toBe(true);
    }
  });

  it('repeating a wand pass over a mixed/empty region is idempotent', () => {
    const grid = createGrid(30, 30);
    const cells = coveredCells(15, 15, 4);
    for (const { x, y } of cells.filter((_, idx) => idx % 2 === 0)) setCell(grid, x, y, SAND, 5);

    applyWand(grid, 15, 15, 4);
    const elementsAfterFirst = Array.from(grid.elements);
    const huesAfterFirst = Array.from(grid.hues);
    const glitterAfterFirst = Array.from(grid.glitter);

    applyWand(grid, 15, 15, 4);
    applyWand(grid, 15, 15, 4);

    expect(Array.from(grid.elements)).toEqual(elementsAfterFirst);
    expect(Array.from(grid.hues)).toEqual(huesAfterFirst);
    expect(Array.from(grid.glitter)).toEqual(glitterAfterFirst);
  });
});

describe('wand — objects are left untouched', () => {
  it('never glitters an OBJECT footprint cell and never alters the objects list', () => {
    const grid = createGrid(120, 60);
    const objects = createObjectsState();
    placeObject(grid, objects, 'rainbow', 20, 20);
    placeObject(grid, objects, 'unicorn', 80, 20);
    const rainbowBefore = { ...objects.rainbows[0] };
    const unicornBefore = { ...objects.unicorns[0] };

    applyWandLine(grid, { x: 0, y: 20 }, { x: 119, y: 20 }, 5);

    for (let py = rainbowBefore.y; py < rainbowBefore.y + rainbowBefore.size; py++) {
      for (let px = rainbowBefore.x; px < rainbowBefore.x + rainbowBefore.size; px++) {
        expect(getElement(grid, px, py)).toBe(OBJECT);
        expect(getGlitter(grid, px, py)).toBe(false);
      }
    }
    for (let py = unicornBefore.y; py < unicornBefore.y + unicornBefore.size; py++) {
      for (let px = unicornBefore.x; px < unicornBefore.x + unicornBefore.size; px++) {
        expect(getElement(grid, px, py)).toBe(OBJECT);
        expect(getGlitter(grid, px, py)).toBe(false);
      }
    }

    expect(objects.rainbows.length).toBe(1);
    expect(objects.unicorns.length).toBe(1);
    expect(objects.rainbows[0]).toEqual(rainbowBefore);
    expect(objects.unicorns[0]).toEqual(unicornBefore);
  });
});

describe('wand — applyWandLine leaves no gaps along a fast drag', () => {
  it('glitters every seeded cell along the interpolated segment', () => {
    const grid = createGrid(20, 5);
    for (let x = 0; x < 20; x++) setCell(grid, x, 2, SAND, 5);

    applyWandLine(grid, { x: 0, y: 2 }, { x: 19, y: 2 }, 0);

    for (let x = 0; x < 20; x++) {
      expect(getGlitter(grid, x, 2)).toBe(true);
      expect(getElement(grid, x, 2)).toBe(SAND);
    }
  });
});
