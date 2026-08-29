import { describe, it, expect } from 'vitest';
import { createGrid } from '../../../src/sim/grid';
import { createObjectsState, placeObject, OBJECT_KINDS } from '../../../src/sim/objects';
import { OBJECT, type Grid } from '../../../src/sim/types';

function at(grid: Grid, x: number, y: number): number {
  return grid.elements[y * grid.width + x];
}

describe('flamingos are placeable objects', () => {
  it('stamps an OBJECT footprint into the grid', () => {
    const grid = createGrid(40, 40);
    const state = createObjectsState();
    placeObject(grid, state, 'flamingo', 20, 20);
    expect(state.byKind.flamingo).toHaveLength(1);
    expect(at(grid, 20, 20)).toBe(OBJECT);
  });

  it('is included in OBJECT_KINDS so every kind-driven loop covers it', () => {
    expect(OBJECT_KINDS).toContain('flamingo');
  });

  it('keeps its own cap of 3 without evicting the other kinds', () => {
    const grid = createGrid(80, 80);
    const state = createObjectsState();
    placeObject(grid, state, 'rainbow', 10, 10);
    placeObject(grid, state, 'unicorn', 30, 10);
    placeObject(grid, state, 'palm', 50, 10);
    for (let i = 0; i < 5; i++) placeObject(grid, state, 'flamingo', 10 + i * 9, 50);
    expect(state.byKind.flamingo).toHaveLength(3);
    expect(state.byKind.rainbow).toHaveLength(1);
    expect(state.byKind.unicorn).toHaveLength(1);
    expect(state.byKind.palm).toHaveLength(1);
  });

  it('starts with an empty flamingo list', () => {
    expect(createObjectsState().byKind.flamingo).toEqual([]);
  });
});
