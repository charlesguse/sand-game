import { describe, it, expect } from 'vitest';
import { createGrid, setCell } from '../../../src/sim/grid';
import { step } from '../../../src/sim/step';
import { isSolid, isPowder } from '../../../src/sim/element';
import { applyBrush } from '../../../src/sim/brush';
import { HistoryManager, captureWorldState, restoreWorldState } from '../../../src/sim/history';
import { createObjectsState } from '../../../src/sim/objects';
import { createPetsState } from '../../../src/sim/pets';
import { serializeWorld, deserializeWorld } from '../../../src/sim/save';
import { EMPTY, SAND, WATER, GRASS, FLOWER, type Grid } from '../../../src/sim/types';

/**
 * A 3-cell grass column at (x, baseY-2..baseY), built bottom-up so setCell's
 * height bookkeeping gives the top cell grassHeight 2 — mature enough to bloom.
 */
function plantColumn(grid: Grid, x: number, baseY: number): void {
  setCell(grid, x, baseY, GRASS, 0);
  setCell(grid, x, baseY - 1, GRASS, 0);
  setCell(grid, x, baseY - 2, GRASS, 0);
}

function countFlowers(grid: Grid): number {
  let n = 0;
  for (let i = 0; i < grid.elements.length; i++) {
    if (grid.elements[i] === FLOWER) n++;
  }
  return n;
}

describe('flowers grow from watered grass', () => {
  it('a watered mature grass column eventually blooms', () => {
    const grid = createGrid(30, 30);
    plantColumn(grid, 15, 25);
    // A little pocket so poured water sits still beside the top grass cell
    // (15, 23) instead of falling or flowing away: floor under it, wall left.
    setCell(grid, 14, 24, SAND, 0);
    setCell(grid, 13, 23, SAND, 0);
    // Keep the top cell watered, and trim any grass that grows into its sky
    // cell, so every drink is a fresh bloom opportunity: 1-in-6 per drink,
    // one drink per cooldown, is overwhelmingly certain within 3000 steps.
    let bloomed = false;
    for (let i = 0; i < 3000 && !bloomed; i++) {
      if (grid.elements[23 * grid.width + 14] === EMPTY) setCell(grid, 14, 23, WATER, 0);
      if (grid.elements[22 * grid.width + 15] === GRASS) setCell(grid, 15, 22, EMPTY, 0);
      step(grid);
      bloomed = countFlowers(grid) > 0;
    }
    expect(bloomed).toBe(true);
  });

  it('never blooms without water', () => {
    const grid = createGrid(30, 30);
    plantColumn(grid, 15, 25);
    for (let i = 0; i < 500; i++) step(grid);
    expect(countFlowers(grid)).toBe(0);
  });

  it('a flower is static: it never moves and sand rests on it', () => {
    const grid = createGrid(20, 30);
    // A 3-wide flower bed so dropped sand can't slide off diagonally.
    for (const x of [9, 10, 11]) setCell(grid, x, 20, FLOWER, 0);
    grid.hues[20 * grid.width + 10] = 99;
    setCell(grid, 10, 5, SAND, 3);
    for (let i = 0; i < 200; i++) step(grid);
    for (const x of [9, 10, 11]) expect(grid.elements[20 * grid.width + x]).toBe(FLOWER);
    expect(grid.hues[20 * grid.width + 10]).toBe(99);
    // The dropped sand came to rest directly on the middle flower.
    expect(grid.elements[19 * grid.width + 10]).toBe(SAND);
  });

  it('is solid but not a powder', () => {
    expect(isSolid(FLOWER)).toBe(true);
    expect(isPowder(FLOWER)).toBe(false);
  });

  it('flower hue survives an undo/redo round trip (the standing trap)', () => {
    const grid = createGrid(20, 20);
    const objects = createObjectsState();
    const history = new HistoryManager();
    setCell(grid, 10, 10, FLOWER, 0);
    grid.hues[10 * grid.width + 10] = 123;

    history.beginAction(grid, objects);
    applyBrush(grid, 'sand', 3, 3, 2, 5);
    history.commitAction(grid, objects);

    expect(history.undo(grid, objects)).toBe(true);
    expect(grid.elements[10 * grid.width + 10]).toBe(FLOWER);
    expect(grid.hues[10 * grid.width + 10]).toBe(123);

    expect(history.redo(grid, objects)).toBe(true);
    expect(grid.elements[10 * grid.width + 10]).toBe(FLOWER);
    expect(grid.hues[10 * grid.width + 10]).toBe(123);
  });

  it('flower hue survives serialize/deserialize', () => {
    const grid = createGrid(20, 20);
    const objects = createObjectsState();
    const pets = createPetsState();
    setCell(grid, 7, 8, FLOWER, 0);
    grid.hues[8 * grid.width + 7] = 200;

    const raw = serializeWorld(grid, objects, pets);
    const saved = deserializeWorld(raw);
    expect(saved).not.toBeNull();

    const fresh = createGrid(20, 20);
    const freshObjects = createObjectsState();
    expect(restoreWorldState(fresh, freshObjects, saved!.state)).toBe(true);
    expect(fresh.elements[8 * fresh.width + 7]).toBe(FLOWER);
    expect(fresh.hues[8 * fresh.width + 7]).toBe(200);
  });

  it('the eraser removes a flower', () => {
    const grid = createGrid(20, 20);
    setCell(grid, 10, 10, FLOWER, 0);
    grid.hues[10 * grid.width + 10] = 50;
    applyBrush(grid, 'eraser', 10, 10, 2, 0);
    expect(grid.elements[10 * grid.width + 10]).toBe(EMPTY);
  });

  it('capture/restore keeps a flower hue even when another element sits in shades at the same value', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    setCell(grid, 2, 2, FLOWER, 0);
    grid.hues[2 * grid.width + 2] = 4;
    setCell(grid, 3, 2, SAND, 4);

    const state = captureWorldState(grid, objects);
    const fresh = createGrid(10, 10);
    expect(restoreWorldState(fresh, createObjectsState(), state)).toBe(true);
    expect(fresh.hues[2 * fresh.width + 2]).toBe(4);
    expect(fresh.shades[2 * fresh.width + 2]).toBe(0);
    expect(fresh.shades[2 * fresh.width + 3]).toBe(4);
    expect(fresh.hues[2 * fresh.width + 3]).toBe(0);
  });
});
