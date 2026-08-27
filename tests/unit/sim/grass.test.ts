import { describe, it, expect } from 'vitest';
import { createGrid, setCell, getElement, getShade } from '../../../src/sim/grid';
import { step } from '../../../src/sim/step';
import { EMPTY, WATER, GRASS, SAND, DIRT, OBJECT } from '../../../src/sim/types';

describe('grass — never moves (FR-004, SC-002)', () => {
  it('a planted grass cell stays at its (x, y) across any number of step() calls with nothing else on the field', () => {
    const grid = createGrid(5, 5);
    setCell(grid, 2, 4, GRASS, 10);
    for (let i = 0; i < 200; i++) step(grid);
    expect(getElement(grid, 2, 4)).toBe(GRASS);
    expect(getShade(grid, 2, 4)).toBe(10);
  });

  it('grass planted with EMPTY directly beneath it (mid-air) is its own root and does not fall', () => {
    const grid = createGrid(5, 5);
    setCell(grid, 2, 0, GRASS, 10);
    expect(grid.grassHeight[0 * grid.width + 2]).toBe(0);
    for (let i = 0; i < 200; i++) step(grid);
    expect(getElement(grid, 2, 0)).toBe(GRASS);
    for (let y = 1; y < 5; y++) expect(getElement(grid, 2, y)).toBe(EMPTY);
  });
});

describe('grass — absorption (FR-007, FR-009)', () => {
  it('a water cell orthogonally adjacent to grass that can still grow is consumed within one step() and exactly one new grass cell appears', () => {
    const grid = createGrid(10, 10);
    setCell(grid, 5, 5, GRASS, 5);
    setCell(grid, 6, 5, WATER, 5); // orthogonally adjacent, to the right

    const grassCountBefore = grid.grassCount;
    step(grid);

    expect(getElement(grid, 6, 5)).toBe(EMPTY);
    expect(grid.grassCount).toBe(grassCountBefore + 1);
    expect(getElement(grid, 5, 4)).toBe(GRASS); // grown directly above — the top preference
  });

  it('a single grass cell absorbs at most one water cell per GRASS_ABSORB_COOLDOWN (10) steps even with unlimited adjacent water', () => {
    const grid = createGrid(20, 20);
    setCell(grid, 10, 15, GRASS, 5);

    const STEPS = 25;
    let absorptions = 0;
    for (let i = 0; i < STEPS; i++) {
      setCell(grid, 11, 15, WATER, 5); // refill an unlimited supply, orthogonally adjacent
      const before = grid.grassCount;
      step(grid);
      if (grid.grassCount > before) absorptions++;
    }

    expect(absorptions).toBeGreaterThan(0);
    expect(absorptions).toBeLessThanOrEqual(Math.floor(STEPS / 10) + 1);
  });
});

describe('grass — no absorption when it cannot grow (FR-008)', () => {
  it('a grass cell whose every eligible target is occupied does not absorb adjacent water; the water behaves as ordinary water', () => {
    // A dense 5x5 GRASS block (immovable, so it can't erode like a powder pile would) with a
    // single water cell carved out at its centre — every grass cell touching that water has
    // every one of its own targets occupied by more block grass, so none of them can grow. The
    // grid is large enough that the field-share ceiling never becomes the (wrong) reason nothing
    // grows.
    const grid = createGrid(40, 20);
    const bx = 15;
    const by = 5;
    for (let y = by; y <= by + 4; y++) {
      for (let x = bx; x <= bx + 4; x++) setCell(grid, x, y, GRASS, 5);
    }
    setCell(grid, bx + 2, by + 2, WATER, 5);

    const grassCountBefore = grid.grassCount;
    for (let i = 0; i < 50; i++) step(grid);

    expect(grid.grassCount).toBe(grassCountBefore);
    expect(getElement(grid, bx + 2, by + 2)).toBe(WATER);
  });
});

describe('grass — growth target order and rejection (FR-010, FR-026)', () => {
  it('new grass appears only above, diagonally above, or (with support) sideways of existing grass — never below', () => {
    const grid = createGrid(20, 20);
    setCell(grid, 10, 15, GRASS, 5);
    const initialMaxGrassY = 15;

    for (let i = 0; i < 300; i++) {
      // Keep both sides supplied so growth keeps happening for the whole run.
      setCell(grid, 11, 15, WATER, 5);
      setCell(grid, 9, 15, WATER, 5);
      step(grid);
    }

    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        if (grid.elements[y * grid.width + x] === GRASS) {
          expect(y).toBeLessThanOrEqual(initialMaxGrassY);
        }
      }
    }
  });

  it('sideways growth requires solid support beneath the target; an unsupported sideways cell is skipped', () => {
    const grid = createGrid(9, 7);
    setCell(grid, 5, 5, GRASS, 5);
    setCell(grid, 5, 4, WATER, 5); // above: blocks the "above" target and supplies the water to absorb
    setCell(grid, 4, 4, GRASS, 5); // diagonally above-left: blocked
    setCell(grid, 6, 4, GRASS, 5); // diagonally above-right: blocked
    setCell(grid, 6, 6, SAND, 5); // supports the "right" sideways target at (6, 5)
    // (4, 6) is left EMPTY — the "left" sideways target at (4, 5) has no support beneath it.

    step(grid);

    expect(getElement(grid, 5, 4)).toBe(EMPTY); // the water was absorbed
    expect(getElement(grid, 6, 5)).toBe(GRASS); // grew sideways onto the supported target
    expect(getElement(grid, 4, 5)).toBe(EMPTY); // the unsupported target was never chosen
  });

  it.each([SAND, DIRT, WATER])(
    'a target cell already holding %s is never chosen as a growth target within the same step',
    (blockingElement) => {
      const grid = createGrid(10, 10);
      setCell(grid, 5, 5, GRASS, 5);
      setCell(grid, 5, 4, blockingElement, 5); // "above" target occupied
      setCell(grid, 5, 6, WATER, 5); // trigger water, orthogonally adjacent but never a growth target

      step(grid);

      expect(getElement(grid, 5, 4)).not.toBe(GRASS);
    },
  );

  it('a target cell already holding OBJECT is never chosen as a growth target within the same step', () => {
    const grid = createGrid(10, 10);
    setCell(grid, 5, 5, GRASS, 5);
    grid.elements[4 * grid.width + 5] = OBJECT; // "above" target occupied by an object footprint cell
    setCell(grid, 5, 6, WATER, 5); // trigger water, orthogonally adjacent but never a growth target

    step(grid);

    expect(getElement(grid, 5, 4)).toBe(OBJECT);
  });
});

describe('grass — buried grass (Edge Cases, User Story 2 Scenario 8)', () => {
  it('produces 0 new cells while buried, even with adjacent water, and resumes once the covering is removed', () => {
    // Same stable all-GRASS shell as the FR-008 case, except the cell directly above the test
    // subject is SAND — a literal "covering" — resting on solid grass with solid diagonal
    // supports on both sides, so it can't slide away on its own during the "still buried" phase.
    const grid = createGrid(40, 20);
    const bx = 15;
    const by = 5;
    for (let y = by; y <= by + 4; y++) {
      for (let x = bx; x <= bx + 4; x++) setCell(grid, x, y, GRASS, 5);
    }
    setCell(grid, bx + 2, by + 1, SAND, 5); // the covering, directly above the test subject
    setCell(grid, bx + 2, by + 3, WATER, 5); // trigger, directly below the test subject

    const grassCountBefore = grid.grassCount;
    for (let i = 0; i < 50; i++) step(grid);
    expect(grid.grassCount).toBe(grassCountBefore);

    // Uncover the grass by clearing the covering sand.
    setCell(grid, bx + 2, by + 1, EMPTY, 0);
    for (let i = 0; i < 50; i++) step(grid);

    expect(grid.grassCount).toBeGreaterThan(grassCountBefore);
  });
});

describe('grass — no water anywhere (FR-016, SC-010)', () => {
  it('running step() 10,000 times with zero WATER cells produces 0 new grass cells and 0 changes to existing grass', () => {
    const grid = createGrid(10, 10);
    setCell(grid, 3, 9, GRASS, 5);
    setCell(grid, 3, 8, GRASS, 7); // stacked on top — height 1
    setCell(grid, 6, 5, GRASS, 20); // isolated, mid-air — height 0

    const elementsBefore = Array.from(grid.elements);
    const shadesBefore = Array.from(grid.shades);
    const grassHeightBefore = Array.from(grid.grassHeight);
    const grassCountBefore = grid.grassCount;

    for (let i = 0; i < 10000; i++) step(grid);

    expect(Array.from(grid.elements)).toEqual(elementsBefore);
    expect(Array.from(grid.shades)).toEqual(shadesBefore);
    expect(Array.from(grid.grassHeight)).toEqual(grassHeightBefore);
    expect(grid.grassCount).toBe(grassCountBefore);
  });
});
