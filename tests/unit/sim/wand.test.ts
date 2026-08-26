import { describe, it, expect } from 'vitest';
import { createGrid, setCell, getElement, getGlitter } from '../../../src/sim/grid';
import { applyWand, applyWandLine } from '../../../src/sim/wand';
import { applyRainbowConversions, createObjectsState, placeObject } from '../../../src/sim/objects';
import { SAND, WATER, DIRT, RAINBOW_SAND, EMPTY } from '../../../src/sim/types';

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
