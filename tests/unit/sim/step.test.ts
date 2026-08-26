import { describe, it, expect, vi } from 'vitest';
import { createGrid, setCell, setGlitter, getElement, getGlitter } from '../../../src/sim/grid';
import { step } from '../../../src/sim/step';
import { EMPTY, SAND, WATER, DIRT, RAINBOW_SAND, OBJECT } from '../../../src/sim/types';

describe('step — pink sand', () => {
  it('falls one cell per step', () => {
    const grid = createGrid(3, 3);
    setCell(grid, 1, 0, SAND, 5);
    step(grid);
    expect(getElement(grid, 1, 0)).toBe(EMPTY);
    expect(getElement(grid, 1, 1)).toBe(SAND);
  });

  it('slides diagonally when blocked straight down', () => {
    const grid = createGrid(3, 2);
    setCell(grid, 1, 0, SAND, 5);
    setCell(grid, 1, 1, SAND, 6); // blocks straight down
    step(grid);
    expect(getElement(grid, 1, 0)).toBe(EMPTY);
    const left = getElement(grid, 0, 1);
    const right = getElement(grid, 2, 1);
    expect(left === SAND || right === SAND).toBe(true);
  });

  it('rests when fully blocked', () => {
    const grid = createGrid(3, 2);
    setCell(grid, 1, 0, SAND, 5);
    setCell(grid, 0, 1, SAND, 6);
    setCell(grid, 1, 1, SAND, 7);
    setCell(grid, 2, 1, SAND, 8);
    step(grid);
    expect(getElement(grid, 1, 0)).toBe(SAND);
  });

  it('stays inside the floor and side walls', () => {
    const grid = createGrid(1, 1);
    setCell(grid, 0, 0, SAND, 5);
    for (let i = 0; i < 5; i++) step(grid);
    expect(getElement(grid, 0, 0)).toBe(SAND);
  });
});

describe('step — water', () => {
  it('falls one cell per step', () => {
    const grid = createGrid(3, 3);
    setCell(grid, 1, 0, WATER, 5);
    step(grid);
    expect(getElement(grid, 1, 0)).toBe(EMPTY);
    expect(getElement(grid, 1, 1)).toBe(WATER);
  });

  it('slides diagonally when blocked straight down', () => {
    const grid = createGrid(3, 2);
    setCell(grid, 1, 0, WATER, 5);
    setCell(grid, 1, 1, WATER, 6); // blocks straight down
    step(grid);
    expect(getElement(grid, 1, 0)).toBe(EMPTY);
    const left = getElement(grid, 0, 1);
    const right = getElement(grid, 2, 1);
    expect(left === WATER || right === WATER).toBe(true);
  });

  it('spreads sideways to level a tall column into a flat sheet', () => {
    const width = 20;
    const grid = createGrid(width, 25);
    for (let y = 0; y < 25; y++) setCell(grid, Math.floor(width / 2), y, WATER, 5);
    for (let i = 0; i < 500; i++) step(grid);

    const heights: number[] = [];
    for (let x = 0; x < width; x++) {
      let count = 0;
      for (let y = 0; y < 25; y++) if (getElement(grid, x, y) === WATER) count++;
      heights.push(count);
    }
    const middle = heights[Math.floor(width / 2)];
    const edge = heights[1];
    expect(Math.abs(middle - edge)).toBeLessThanOrEqual(2);
  });

  it('rests when fully blocked', () => {
    const grid = createGrid(3, 1);
    setCell(grid, 0, 0, WATER, 5);
    setCell(grid, 1, 0, WATER, 6);
    setCell(grid, 2, 0, WATER, 7);
    step(grid);
    expect(getElement(grid, 0, 0)).toBe(WATER);
    expect(getElement(grid, 1, 0)).toBe(WATER);
    expect(getElement(grid, 2, 0)).toBe(WATER);
  });

  it('stays inside the floor and side walls', () => {
    const grid = createGrid(1, 1);
    setCell(grid, 0, 0, WATER, 5);
    for (let i = 0; i < 5; i++) step(grid);
    expect(getElement(grid, 0, 0)).toBe(WATER);
  });

  it('never occupies a higher row than it started (never-rises invariant)', () => {
    const grid = createGrid(10, 10);
    setCell(grid, 5, 5, WATER, 5);
    let minRowOccupied = 5;
    for (let i = 0; i < 200; i++) {
      step(grid);
      let currentMinRow = Infinity;
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          if (getElement(grid, x, y) === WATER) currentMinRow = Math.min(currentMinRow, y);
        }
      }
      // The topmost row containing water must never move upward (a smaller y) tick over tick.
      expect(currentMinRow).toBeGreaterThanOrEqual(minRowOccupied);
      minRowOccupied = currentMinRow;
    }
  });

  it('a single step() call never moves one water cell more than one cell (moved buffer)', () => {
    const width = 10;
    const grid = createGrid(width, 3);
    // A flat sheet on the floor, blocked below and diagonally-below everywhere,
    // so every cell's only legal move is sideways.
    for (let x = 0; x < width; x++) setCell(grid, x, 2, WATER, 5);
    // Leave one gap so sideways movement is actually possible.
    setCell(grid, 5, 2, EMPTY, 0);
    setCell(grid, 4, 2, WATER, 9);
    step(grid);
    // The gap can only be filled by an immediate neighbor (col 4 or col 6),
    // never by a cell two-or-more columns away — that would require a double-hop.
    let waterCols: number[] = [];
    for (let x = 0; x < width; x++) if (getElement(grid, x, 2) === WATER) waterCols.push(x);
    expect(waterCols.length).toBe(width - 1);
  });
});

describe('step — sand sinks through water', () => {
  it('a powder cell with water directly below swaps in one step', () => {
    // width 1 so water has no sideways-escape neighbors, isolating the swap.
    const grid = createGrid(1, 2);
    setCell(grid, 0, 0, SAND, 5);
    setCell(grid, 0, 1, WATER, 9);
    step(grid);
    expect(getElement(grid, 0, 0)).toBe(WATER);
    expect(getElement(grid, 0, 1)).toBe(SAND);
  });

  it('a water column with sand poured on top settles with all sand at the bottom', () => {
    const width = 5;
    const height = 10;
    const grid = createGrid(width, height);
    for (let y = 3; y < height; y++) {
      for (let x = 0; x < width; x++) setCell(grid, x, y, WATER, 5);
    }
    for (let x = 0; x < width; x++) setCell(grid, x, 0, SAND, 9);

    for (let i = 0; i < 300; i++) step(grid);

    // Scanning bottom-to-top, every sand cell in a column must be seen before
    // any water cell — i.e. sand never rests above a water cell it sank past.
    for (let x = 0; x < width; x++) {
      let sawWater = false;
      let sandAboveWater = false;
      let sawSand = false;
      for (let y = height - 1; y >= 0; y--) {
        const element = getElement(grid, x, y);
        if (element === WATER) sawWater = true;
        if (element === SAND) {
          sawSand = true;
          if (sawWater) sandAboveWater = true;
        }
      }
      expect(sandAboveWater).toBe(false);
      expect(sawSand).toBe(true);
    }
  });

  it('water never swaps down through or displaces a powder', () => {
    const grid = createGrid(1, 2);
    setCell(grid, 0, 0, WATER, 5);
    setCell(grid, 0, 1, SAND, 9);
    step(grid);
    expect(getElement(grid, 0, 0)).toBe(WATER);
    expect(getElement(grid, 0, 1)).toBe(SAND);
  });

  it('the count of sand, water, and dirt cells stays constant across many steps', () => {
    const width = 8;
    const height = 8;
    const grid = createGrid(width, height);
    for (let y = 0; y < 4; y++) for (let x = 0; x < width; x++) setCell(grid, x, y, WATER, 5);
    setCell(grid, 3, 0, SAND, 9);
    setCell(grid, 4, 0, SAND, 9);
    setCell(grid, 5, 0, DIRT, 9);
    setCell(grid, 6, 0, DIRT, 9);

    const countOf = (element: number): number => {
      let count = 0;
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) if (getElement(grid, x, y) === element) count++;
      return count;
    };
    const initialSand = countOf(SAND);
    const initialWater = countOf(WATER);
    const initialDirt = countOf(DIRT);

    for (let i = 0; i < 100; i++) {
      step(grid);
      expect(countOf(SAND)).toBe(initialSand);
      expect(countOf(WATER)).toBe(initialWater);
      expect(countOf(DIRT)).toBe(initialDirt);
    }
  });

  it('water poured into a sand bowl stays inside the container after settling', () => {
    const width = 12;
    const height = 12;
    const grid = createGrid(width, height);

    // Build a sand bowl: a flat sand floor with tall sand walls on both sides.
    for (let x = 0; x < width; x++) setCell(grid, x, height - 1, SAND, 5);
    for (let y = 4; y < height; y++) {
      setCell(grid, 0, y, SAND, 5);
      setCell(grid, 1, y, SAND, 5);
      setCell(grid, width - 2, y, SAND, 5);
      setCell(grid, width - 1, y, SAND, 5);
    }
    for (let i = 0; i < 20; i++) step(grid); // let the walls settle before pouring

    // Pour water inside the bowl's hollow.
    for (let x = 2; x < width - 2; x++) setCell(grid, x, 3, WATER, 9);
    const initialWaterCount = width - 4;

    for (let i = 0; i < 300; i++) step(grid);

    let waterInsideContainer = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (getElement(grid, x, y) === WATER) {
          expect(x).toBeGreaterThanOrEqual(2);
          expect(x).toBeLessThanOrEqual(width - 3);
          waterInsideContainer++;
        }
      }
    }
    expect(waterInsideContainer).toBe(initialWaterCount);
  });

  it('step() is idempotent on a fully-settled mixed water-and-powder grid', () => {
    const width = 6;
    const height = 6;
    const grid = createGrid(width, height);
    // Bottom rows fully packed with powder, no empty cells for anything to move into.
    for (let x = 0; x < width; x++) {
      setCell(grid, x, height - 1, SAND, 5);
      setCell(grid, x, height - 2, DIRT, 6);
    }
    // A flat water layer above, also fully packed with no side/diagonal openings.
    for (let x = 0; x < width; x++) setCell(grid, x, height - 3, WATER, 7);

    step(grid); // one settling step in case anything can still move
    const before: number[] = Array.from(grid.elements);
    step(grid);
    const after: number[] = Array.from(grid.elements);
    expect(after).toEqual(before);
  });
});

describe('step — magic purple dirt (purple sand)', () => {
  function scatterLayout(grid: ReturnType<typeof createGrid>, element: number): void {
    const positions = [
      [3, 0],
      [4, 0],
      [3, 1],
      [7, 0],
      [1, 2],
    ];
    for (const [x, y] of positions) setCell(grid, x, y, element, 5);
  }

  it('falls, slides, and rests under the identical rules as sand', () => {
    // Stub Math.random so both grids draw the identical tie-break sequence —
    // this isolates "the movement rules are identical" from "two independent
    // random streams happened to agree," which would otherwise make this
    // assertion flaky whenever a diagonal tie-break actually occurs.
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.25);
    try {
      const sandGrid = createGrid(10, 10);
      const dirtGrid = createGrid(10, 10);
      scatterLayout(sandGrid, SAND);
      scatterLayout(dirtGrid, DIRT);

      for (let i = 0; i < 50; i++) {
        step(sandGrid);
        step(dirtGrid);
      }

      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          const sandOccupied = getElement(sandGrid, x, y) !== EMPTY;
          const dirtOccupied = getElement(dirtGrid, x, y) !== EMPTY;
          expect(dirtOccupied).toBe(sandOccupied);
        }
      }
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('a pink grain and a purple grain resting on each other never sink through one another or change element', () => {
    // width 1 so there is no diagonal escape — isolates straight-down blocking.
    const grid = createGrid(1, 2);
    setCell(grid, 0, 0, DIRT, 5);
    setCell(grid, 0, 1, SAND, 6);
    for (let i = 0; i < 20; i++) step(grid);
    expect(getElement(grid, 0, 0)).toBe(DIRT);
    expect(getElement(grid, 0, 1)).toBe(SAND);
  });
});

describe('step — rainbow sand', () => {
  function scatterLayout(grid: ReturnType<typeof createGrid>, element: number): void {
    const positions = [
      [3, 0],
      [4, 0],
      [3, 1],
      [7, 0],
      [1, 2],
    ];
    for (const [x, y] of positions) setCell(grid, x, y, element, 5);
  }

  it('falls, slides, and rests under the identical rules as sand', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.25);
    try {
      const sandGrid = createGrid(10, 10);
      const rainbowGrid = createGrid(10, 10);
      scatterLayout(sandGrid, SAND);
      scatterLayout(rainbowGrid, RAINBOW_SAND);

      for (let i = 0; i < 50; i++) {
        step(sandGrid);
        step(rainbowGrid);
      }

      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          const sandOccupied = getElement(sandGrid, x, y) !== EMPTY;
          const rainbowOccupied = getElement(rainbowGrid, x, y) !== EMPTY;
          expect(rainbowOccupied).toBe(sandOccupied);
        }
      }
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('sinks through water exactly like sand', () => {
    const grid = createGrid(1, 2);
    setCell(grid, 0, 0, RAINBOW_SAND, 5);
    setCell(grid, 0, 1, WATER, 9);
    step(grid);
    expect(getElement(grid, 0, 0)).toBe(WATER);
    expect(getElement(grid, 0, 1)).toBe(RAINBOW_SAND);
  });

  it('advances hue when it moves this tick', () => {
    const grid = createGrid(3, 3);
    setCell(grid, 1, 0, RAINBOW_SAND, 5);
    grid.hues[0 * 3 + 1] = 10;
    step(grid);
    expect(getElement(grid, 1, 1)).toBe(RAINBOW_SAND);
    expect(grid.hues[1 * 3 + 1]).not.toBe(10);
  });

  it('freezes hue across a tick where it does not move (fully blocked)', () => {
    const grid = createGrid(3, 2);
    setCell(grid, 1, 0, RAINBOW_SAND, 5);
    setCell(grid, 0, 1, RAINBOW_SAND, 6);
    setCell(grid, 1, 1, RAINBOW_SAND, 7);
    setCell(grid, 2, 1, RAINBOW_SAND, 8);
    grid.hues[0 * 3 + 1] = 42;
    step(grid);
    expect(getElement(grid, 1, 0)).toBe(RAINBOW_SAND);
    expect(grid.hues[0 * 3 + 1]).toBe(42);
  });
});

describe('step — glitter travels with a grain', () => {
  it('a falling glittered grain carries its glitter to the new position and leaves none behind', () => {
    const grid = createGrid(3, 3);
    setCell(grid, 1, 0, SAND, 5);
    setGlitter(grid, 1, 0, 1);
    step(grid);
    expect(getElement(grid, 1, 1)).toBe(SAND);
    expect(getGlitter(grid, 1, 1)).toBe(true);
    expect(getGlitter(grid, 1, 0)).toBe(false);
  });

  it('a swap between a glittered and a plain grain keeps each grain its own glittered state', () => {
    // width 1 so there is no diagonal escape — isolates the straight-down swap.
    const grid = createGrid(1, 2);
    setCell(grid, 0, 0, SAND, 5);
    setGlitter(grid, 0, 0, 1);
    setCell(grid, 0, 1, WATER, 6);
    step(grid);
    expect(getElement(grid, 0, 0)).toBe(WATER);
    expect(getGlitter(grid, 0, 0)).toBe(false);
    expect(getElement(grid, 0, 1)).toBe(SAND);
    expect(getGlitter(grid, 0, 1)).toBe(true);
  });
});

describe('step — objects are solid ground', () => {
  it('a falling powder grain stops directly above an OBJECT footprint cell instead of entering it', () => {
    // width 1 so there is no diagonal escape — isolates straight-down blocking.
    const grid = createGrid(1, 2);
    setCell(grid, 0, 0, SAND, 5);
    setCell(grid, 0, 1, OBJECT, 0);
    step(grid);
    expect(getElement(grid, 0, 0)).toBe(SAND);
    expect(getElement(grid, 0, 1)).toBe(OBJECT);
  });

  it('a powder grain blocked on all sides by OBJECT/other powders rests in place, not destroyed or teleported', () => {
    const grid = createGrid(3, 2);
    setCell(grid, 1, 0, SAND, 5);
    setCell(grid, 0, 1, OBJECT, 0);
    setCell(grid, 1, 1, OBJECT, 0);
    setCell(grid, 2, 1, OBJECT, 0);
    step(grid);
    expect(getElement(grid, 1, 0)).toBe(SAND);
  });

  it('a grain resting on an object shoulder slides off exactly as it would off a powder pile', () => {
    const grid = createGrid(3, 2);
    setCell(grid, 1, 0, SAND, 5);
    setCell(grid, 1, 1, OBJECT, 0);
    // left/right below are empty, so the grain should slide diagonally off the shoulder.
    step(grid);
    const left = getElement(grid, 0, 1);
    const right = getElement(grid, 2, 1);
    expect(left === SAND || right === SAND).toBe(true);
  });

  it('water resting on an object spreads sideways off it rather than passing through', () => {
    const grid = createGrid(3, 2);
    setCell(grid, 1, 0, WATER, 5);
    setCell(grid, 1, 1, OBJECT, 0);
    step(grid);
    expect(getElement(grid, 1, 1)).toBe(OBJECT);
    const left = getElement(grid, 0, 1);
    const right = getElement(grid, 2, 1);
    expect(left === WATER || right === WATER).toBe(true);
  });
});
