import { describe, it, expect } from 'vitest';
import {
  createGrid,
  inBounds,
  getElement,
  getShade,
  setCell,
  clearGrid,
  setGlitter,
  getGlitter,
} from '../../../src/sim/grid';
import { EMPTY, SAND, GRASS } from '../../../src/sim/types';

describe('grid', () => {
  it('createGrid zeroes elements, shades, moved, and hues', () => {
    const grid = createGrid(4, 3);
    expect(grid.width).toBe(4);
    expect(grid.height).toBe(3);
    expect([...grid.elements]).toEqual(new Array(12).fill(0));
    expect([...grid.shades]).toEqual(new Array(12).fill(0));
    expect([...grid.moved]).toEqual(new Array(12).fill(0));
    expect(grid.hues.length).toBe(12);
    expect([...grid.hues]).toEqual(new Array(12).fill(0));
  });

  it('inBounds is true only for cells within width/height', () => {
    const grid = createGrid(3, 2);
    expect(inBounds(grid, 0, 0)).toBe(true);
    expect(inBounds(grid, 2, 1)).toBe(true);
    expect(inBounds(grid, -1, 0)).toBe(false);
    expect(inBounds(grid, 3, 0)).toBe(false);
    expect(inBounds(grid, 0, 2)).toBe(false);
  });

  it('setCell/getElement/getShade round-trip correctly', () => {
    const grid = createGrid(3, 3);
    setCell(grid, 1, 1, SAND, 42);
    expect(getElement(grid, 1, 1)).toBe(SAND);
    expect(getShade(grid, 1, 1)).toBe(42);
  });

  it('out-of-bounds reads return EMPTY/0, out-of-bounds writes are no-ops', () => {
    const grid = createGrid(2, 2);
    expect(getElement(grid, -1, 0)).toBe(EMPTY);
    expect(getShade(grid, 5, 5)).toBe(0);
    setCell(grid, -1, -1, SAND, 10);
    setCell(grid, 5, 5, SAND, 10);
    expect([...grid.elements]).toEqual(new Array(4).fill(0));
  });

  it('clearGrid zeroes elements without touching width/height', () => {
    const grid = createGrid(2, 2);
    setCell(grid, 0, 0, SAND, 5);
    setCell(grid, 1, 1, SAND, 6);
    clearGrid(grid);
    expect([...grid.elements]).toEqual(new Array(4).fill(0));
    expect(grid.width).toBe(2);
    expect(grid.height).toBe(2);
  });

  it('setCell resets a previously-set glitter bit when drawing a fresh element over the cell', () => {
    const grid = createGrid(2, 2);
    setCell(grid, 0, 0, SAND, 5);
    setGlitter(grid, 0, 0, 1);
    expect(getGlitter(grid, 0, 0)).toBe(true);
    setCell(grid, 0, 0, SAND, 6);
    expect(getGlitter(grid, 0, 0)).toBe(false);
  });

  it('clearGrid zeroes the glitter array alongside elements', () => {
    const grid = createGrid(2, 2);
    setCell(grid, 0, 0, SAND, 5);
    setGlitter(grid, 0, 0, 1);
    setCell(grid, 1, 1, SAND, 6);
    setGlitter(grid, 1, 1, 1);
    clearGrid(grid);
    expect([...grid.glitter]).toEqual(new Array(4).fill(0));
  });

  it('clearGrid on a grass-populated grid empties every cell and resets grassCount to 0 (FR-022)', () => {
    const grid = createGrid(3, 3);
    setCell(grid, 0, 0, GRASS, 5);
    setCell(grid, 1, 0, GRASS, 5);
    setCell(grid, 0, 1, GRASS, 5);
    expect(grid.grassCount).toBe(3);

    clearGrid(grid);

    expect([...grid.elements]).toEqual(new Array(9).fill(0));
    expect(grid.grassCount).toBe(0);
  });

  it('setCell bookkeeps grassHeight/grassCooldown/grassCount for grass (contracts/grass-mechanics.md)', () => {
    const grid = createGrid(2, 3);
    expect(grid.grassCount).toBe(0);

    // No grass below -> height 0, count 1.
    setCell(grid, 0, 2, GRASS, 5);
    expect(grid.grassHeight[2 * 2 + 0]).toBe(0);
    expect(grid.grassCount).toBe(1);

    // Grass planted on top of existing grass -> belowHeight + 1.
    setCell(grid, 0, 1, GRASS, 5);
    expect(grid.grassHeight[1 * 2 + 0]).toBe(1);
    expect(grid.grassCount).toBe(2);

    setCell(grid, 0, 0, GRASS, 5);
    expect(grid.grassHeight[0 * 2 + 0]).toBe(2);
    expect(grid.grassCount).toBe(3);

    // Overwriting a grass cell with a non-grass element resets height/cooldown and decrements count.
    setCell(grid, 0, 0, SAND, 5);
    expect(grid.grassHeight[0 * 2 + 0]).toBe(0);
    expect(grid.grassCooldown[0 * 2 + 0]).toBe(0);
    expect(grid.grassCount).toBe(2);

    // Overwriting a non-grass cell with non-grass leaves the count unchanged.
    setCell(grid, 0, 0, SAND, 6);
    expect(grid.grassCount).toBe(2);
  });
});
