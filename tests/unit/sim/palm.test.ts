import { describe, it, expect } from 'vitest';
import { createGrid } from '../../../src/sim/grid';
import { createObjectsState, placeObject } from '../../../src/sim/objects';
import { step } from '../../../src/sim/step';
import { OBJECT, SAND, EMPTY, type Grid } from '../../../src/sim/types';

function at(grid: Grid, x: number, y: number): number {
  return grid.elements[y * grid.width + x];
}

describe('palm trees are placeable objects', () => {
  it('stamps an OBJECT footprint into the grid', () => {
    const grid = createGrid(40, 40);
    const state = createObjectsState();
    placeObject(grid, state, 'palm', 20, 20);
    expect(state.byKind.palm).toHaveLength(1);
    expect(at(grid, 20, 20)).toBe(OBJECT);
  });

  it('keeps its own cap of 3 without evicting rainbows or unicorns', () => {
    const grid = createGrid(60, 60);
    const state = createObjectsState();
    placeObject(grid, state, 'rainbow', 10, 10);
    placeObject(grid, state, 'unicorn', 20, 10);
    for (let i = 0; i < 5; i++) placeObject(grid, state, 'palm', 10 + i * 8, 40);
    expect(state.byKind.palm).toHaveLength(3);
    expect(state.byKind.rainbow).toHaveLength(1);
    expect(state.byKind.unicorn).toHaveLength(1);
  });

  it('gives every object a unique id across all kinds', () => {
    const grid = createGrid(60, 60);
    const state = createObjectsState();
    placeObject(grid, state, 'palm', 10, 10);
    placeObject(grid, state, 'rainbow', 30, 10);
    placeObject(grid, state, 'unicorn', 10, 40);
    const ids = Object.values(state.byKind).flat().map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('sand piles against a palm trunk', () => {
  it('does not fall through the trunk', () => {
    const grid = createGrid(40, 40);
    const state = createObjectsState();
    placeObject(grid, state, 'palm', 20, 30);
    const trunkTop = state.byKind.palm[0].y;
    grid.elements[(trunkTop - 1) * grid.width + 20] = SAND;
    for (let i = 0; i < 20; i++) step(grid);
    expect(at(grid, 20, trunkTop)).toBe(OBJECT);
    expect(at(grid, 20, trunkTop - 1)).not.toBe(EMPTY);
  });
});
