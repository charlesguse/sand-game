import { describe, it, expect } from 'vitest';
import { createGrid, setCell, igniteStarPower, getElement, getGlitter } from '../../../src/sim/grid';
import { step } from '../../../src/sim/step';
import { randomBurnLife } from '../../../src/sim/shade';
import { EMPTY } from '../../../src/sim/types';

describe('starPower — never moves (FR-004, SC-002, Scenario 3)', () => {
  it("a star power cell's position is unchanged across any number of step() calls with nothing else on the field", () => {
    const grid = createGrid(20, 20);
    igniteStarPower(grid, 10, 10, false);
    const i = 10 * grid.width + 10;

    for (let n = 0; n < 200; n++) {
      step(grid);
      for (let idx = 0; idx < grid.elements.length; idx++) {
        if (idx === i) continue;
        expect(grid.elements[idx]).toBe(EMPTY);
      }
    }
  });
});

describe('starPower — burns out on its own (FR-002, FR-008, SC-003)', () => {
  it('on an empty field it burns out within starPowerLife steps (≤60) and leaves the cell EMPTY with 0 glitter and no other changed cells', () => {
    const grid = createGrid(20, 20);
    igniteStarPower(grid, 10, 10, false);
    const i = 10 * grid.width + 10;
    const life = grid.starPowerLife[i];
    expect(life).toBeLessThanOrEqual(60);

    for (let n = 0; n < life; n++) step(grid);

    expect(getElement(grid, 10, 10)).toBe(EMPTY);
    expect(getGlitter(grid, 10, 10)).toBe(false);
    for (let idx = 0; idx < grid.elements.length; idx++) {
      expect(grid.elements[idx]).toBe(EMPTY);
    }
  });
});

describe('starPower — randomBurnLife (FR-007)', () => {
  it('always returns an integer in [30, 60] inclusive across many calls, with observed variation', () => {
    const values = new Set<number>();
    for (let n = 0; n < 500; n++) {
      const life = randomBurnLife();
      expect(Number.isInteger(life)).toBe(true);
      expect(life).toBeGreaterThanOrEqual(30);
      expect(life).toBeLessThanOrEqual(60);
      values.add(life);
    }
    expect(values.size).toBeGreaterThan(1);
  });
});
