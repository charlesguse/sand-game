import { describe, it, expect } from 'vitest';
import { createGrid } from '../../../src/sim/grid';
import { step } from '../../../src/sim/step';
import { GUMDROP } from '../../../src/sim/types';

/**
 * Every per-cell typed array on the Grid. When a new field is added to Grid,
 * add it here — this list is the contract moveCell/swapCells must honour.
 */
const PER_CELL_FIELDS = [
  'shades', 'hues', 'glitter', 'grassHeight', 'grassCooldown',
  'starPowerAge', 'starPowerLife', 'starPowerFuelled', 'cloud',
  'fogRiseCooldown', 'fogStuckSteps', 'fogAge', 'cloudRainDelay',
] as const;

describe('the Grid per-cell field list is complete', () => {
  it('names every typed array on the grid except elements and moved', () => {
    const grid = createGrid(4, 4);
    const actual = Object.keys(grid)
      .filter((k) => ArrayBuffer.isView((grid as never)[k]))
      .filter((k) => k !== 'elements' && k !== 'moved')
      .sort();
    expect(actual).toEqual([...PER_CELL_FIELDS].sort());
  });
});

describe('moving a cell carries its per-cell state with it', () => {
  it('transfers every per-cell field and clears the source', () => {
    const grid = createGrid(5, 5);
    const from = 0 * grid.width + 2;

    grid.elements[from] = GUMDROP;
    for (const field of PER_CELL_FIELDS) grid[field][from] = 7;

    step(grid);

    const to = 1 * grid.width + 2;
    expect(grid.elements[to]).toBe(GUMDROP);
    for (const field of PER_CELL_FIELDS) {
      expect({ field, value: grid[field][to] }).toEqual({ field, value: 7 });
      expect({ field, value: grid[field][from] }).toEqual({ field, value: 0 });
    }
  });
});
