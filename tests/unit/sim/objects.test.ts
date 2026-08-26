import { describe, it, expect } from 'vitest';
import { createGrid, setCell, getElement } from '../../../src/sim/grid';
import { applyRainbowConversions, createObjectsState, placeObject, removeObject } from '../../../src/sim/objects';
import { EMPTY, SAND, WATER, DIRT, RAINBOW_SAND, OBJECT, type PlacedObject } from '../../../src/sim/types';
import { OBJECT_FOOTPRINT_SIZE } from '../../../src/lib/layout';

function rainbowAt(x: number, y: number, size = 1, id = 0): PlacedObject {
  return { id, kind: 'rainbow', x, y, size };
}

describe('objects — applyRainbowConversions', () => {
  it('converts SAND/DIRT/WATER cells inside a rainbow zone to RAINBOW_SAND with a fresh hue', () => {
    const grid = createGrid(5, 5);
    setCell(grid, 1, 1, SAND, 5);
    setCell(grid, 2, 1, DIRT, 5);
    setCell(grid, 1, 2, WATER, 5);
    const rainbow = rainbowAt(2, 2, 1);

    applyRainbowConversions(grid, [rainbow]);

    expect(getElement(grid, 1, 1)).toBe(RAINBOW_SAND);
    expect(getElement(grid, 2, 1)).toBe(RAINBOW_SAND);
    expect(getElement(grid, 1, 2)).toBe(RAINBOW_SAND);
    expect(grid.hues[1 * 5 + 1]).toBeGreaterThanOrEqual(0);
  });

  it('leaves cells outside every rainbow zone untouched', () => {
    const grid = createGrid(6, 6);
    setCell(grid, 0, 0, SAND, 5);
    const rainbow = rainbowAt(4, 4, 1);

    applyRainbowConversions(grid, [rainbow]);

    expect(getElement(grid, 0, 0)).toBe(SAND);
  });

  it('is idempotent on an already-converted RAINBOW_SAND cell', () => {
    const grid = createGrid(5, 5);
    setCell(grid, 1, 1, RAINBOW_SAND, 5);
    grid.hues[1 * 5 + 1] = 77;
    const rainbow = rainbowAt(2, 2, 1);

    applyRainbowConversions(grid, [rainbow]);
    applyRainbowConversions(grid, [rainbow]);

    expect(getElement(grid, 1, 1)).toBe(RAINBOW_SAND);
    expect(grid.hues[1 * 5 + 1]).toBe(77);
  });

  it('leaves OBJECT and EMPTY zone cells untouched', () => {
    const grid = createGrid(5, 5);
    setCell(grid, 1, 1, OBJECT, 0);
    const rainbow = rainbowAt(2, 2, 1);

    applyRainbowConversions(grid, [rainbow]);

    expect(getElement(grid, 1, 1)).toBe(OBJECT);
    expect(getElement(grid, 0, 0)).toBe(EMPTY);
  });

  it('converts independently across multiple rainbows with no combined effect', () => {
    const grid = createGrid(10, 10);
    setCell(grid, 1, 1, SAND, 5);
    setCell(grid, 8, 8, WATER, 5);
    const rainbowA = rainbowAt(2, 2, 1, 0);
    const rainbowB = rainbowAt(7, 7, 1, 1);

    applyRainbowConversions(grid, [rainbowA, rainbowB]);

    expect(getElement(grid, 1, 1)).toBe(RAINBOW_SAND);
    expect(getElement(grid, 8, 8)).toBe(RAINBOW_SAND);
  });
});

describe('objects — placeObject/removeObject', () => {
  it('placing clears any element occupying the new footprint', () => {
    const grid = createGrid(60, 60);
    setCell(grid, 10, 10, SAND, 5);
    const state = createObjectsState();

    placeObject(grid, state, 'rainbow', 10, 10);

    expect(getElement(grid, 10, 10)).toBe(OBJECT);
  });

  it('the per-type cap of 3 evicts the oldest object of that type and never refuses placement', () => {
    const grid = createGrid(200, 200);
    const state = createObjectsState();

    placeObject(grid, state, 'rainbow', 20, 20);
    placeObject(grid, state, 'rainbow', 60, 20);
    placeObject(grid, state, 'rainbow', 100, 20);
    const firstId = state.rainbows[0].id;
    placeObject(grid, state, 'rainbow', 140, 20);

    expect(state.rainbows.length).toBe(3);
    expect(state.rainbows.some((o) => o.id === firstId)).toBe(false);
  });

  it('reaching one type cap does not affect the other type count', () => {
    const grid = createGrid(200, 200);
    const state = createObjectsState();

    placeObject(grid, state, 'rainbow', 20, 20);
    placeObject(grid, state, 'rainbow', 60, 20);
    placeObject(grid, state, 'rainbow', 100, 20);
    placeObject(grid, state, 'rainbow', 140, 20);
    placeObject(grid, state, 'unicorn', 20, 100);

    expect(state.rainbows.length).toBe(3);
    expect(state.unicorns.length).toBe(1);
  });

  it('removing an object whose footprint overlaps a surviving object leaves the shared cells as OBJECT, but releases cells only the removed object covered', () => {
    const grid = createGrid(60, 60);
    const state = createObjectsState();

    // Two overlapping placements, offset so their footprints partially intersect.
    placeObject(grid, state, 'rainbow', 15, 15);
    placeObject(grid, state, 'unicorn', 15 + Math.floor(OBJECT_FOOTPRINT_SIZE / 2), 15);
    const [rainbow] = state.rainbows;
    const [unicorn] = state.unicorns;

    removeObject(grid, state, rainbow);

    // A cell in the overlap (covered by both) must remain OBJECT.
    const sharedX = unicorn.x;
    const sharedY = unicorn.y;
    expect(getElement(grid, sharedX, sharedY)).toBe(OBJECT);

    // A cell covered only by the removed rainbow (outside the unicorn's footprint) must be released to EMPTY.
    const rainbowOnlyX = rainbow.x;
    const rainbowOnlyY = rainbow.y;
    expect(getElement(grid, rainbowOnlyX, rainbowOnlyY)).toBe(EMPTY);
  });
});
