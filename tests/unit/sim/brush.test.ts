import { describe, it, expect } from 'vitest';
import { createGrid, setCell, getElement, clearGrid } from '../../../src/sim/grid';
import { applyBrush } from '../../../src/sim/brush';
import {
  EMPTY,
  SAND,
  WATER,
  DIRT,
  RAINBOW_SAND,
  OBJECT,
  GRASS,
  STAR_POWER,
} from '../../../src/sim/types';
import { BRUSH_RADII } from '../../../src/lib/layout';

describe('brush — pink sand and eraser', () => {
  it('the sand brush paints only into empty footprint cells', () => {
    const grid = createGrid(5, 5);
    setCell(grid, 2, 2, SAND, 99); // pre-occupied — should be preserved
    applyBrush(grid, 'sand', 2, 2, 1, 10);
    expect(grid.shades[2 * 5 + 2]).toBe(99); // untouched, still original shade
    expect(getElement(grid, 1, 2)).toBe(SAND);
    expect(getElement(grid, 3, 2)).toBe(SAND);
  });

  it('the eraser clears any occupied cell', () => {
    const grid = createGrid(5, 5);
    applyBrush(grid, 'sand', 2, 2, 2, 10);
    applyBrush(grid, 'eraser', 2, 2, 2, 0);
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        expect(getElement(grid, x, y)).toBe(EMPTY);
      }
    }
  });

  it('clearGrid empties a populated grid', () => {
    const grid = createGrid(3, 3);
    applyBrush(grid, 'sand', 1, 1, 2, 10);
    clearGrid(grid);
    expect([...grid.elements]).toEqual(new Array(9).fill(0));
  });
});

describe('brush — water', () => {
  it('the water brush paints only into empty footprint cells and never overwrites sand', () => {
    const grid = createGrid(5, 5);
    setCell(grid, 2, 2, SAND, 99); // pre-occupied by sand — should be preserved
    applyBrush(grid, 'water', 2, 2, 1, 10);
    expect(getElement(grid, 2, 2)).toBe(SAND);
    expect(grid.shades[2 * 5 + 2]).toBe(99);
    expect(getElement(grid, 1, 2)).toBe(WATER);
    expect(getElement(grid, 3, 2)).toBe(WATER);
  });
});

describe('brush — sand overwrites water', () => {
  it('the sand brush overwrites water-occupied cells', () => {
    const grid = createGrid(5, 5);
    setCell(grid, 2, 2, WATER, 50);
    applyBrush(grid, 'sand', 2, 2, 0, 10);
    expect(getElement(grid, 2, 2)).toBe(SAND);
    expect(grid.shades[2 * 5 + 2]).toBe(10);
  });

  it('the water brush never overwrites a sand-occupied cell', () => {
    const grid = createGrid(5, 5);
    setCell(grid, 2, 2, SAND, 50);
    applyBrush(grid, 'water', 2, 2, 0, 10);
    expect(getElement(grid, 2, 2)).toBe(SAND);
    expect(grid.shades[2 * 5 + 2]).toBe(50);
  });
});

describe('brush — magic purple dirt', () => {
  it('the dirt brush paints into empty and water-occupied cells exactly like the sand brush', () => {
    const emptyGrid = createGrid(5, 5);
    applyBrush(emptyGrid, 'dirt', 2, 2, 1, 10);
    expect(getElement(emptyGrid, 2, 2)).toBe(DIRT);
    expect(getElement(emptyGrid, 1, 2)).toBe(DIRT);

    const waterGrid = createGrid(5, 5);
    setCell(waterGrid, 2, 2, WATER, 50);
    applyBrush(waterGrid, 'dirt', 2, 2, 0, 10);
    expect(getElement(waterGrid, 2, 2)).toBe(DIRT);
    expect(waterGrid.shades[2 * 5 + 2]).toBe(10);
  });

  it('the dirt brush is never overwritten by the water brush', () => {
    const grid = createGrid(5, 5);
    setCell(grid, 2, 2, DIRT, 50);
    applyBrush(grid, 'water', 2, 2, 0, 10);
    expect(getElement(grid, 2, 2)).toBe(DIRT);
    expect(grid.shades[2 * 5 + 2]).toBe(50);
  });
});

describe('brush — grass', () => {
  it.each(Object.entries(BRUSH_RADII))(
    'the grass brush deposits into EMPTY/WATER footprint cells and never overwrites SAND/DIRT/RAINBOW_SAND/OBJECT (%s)',
    (_size, radius) => {
      const grid = createGrid(40, 40);
      // Seeded at distance 1 along each axis so every cell stays inside the footprint at every radius (>= 1).
      setCell(grid, 19, 20, SAND, 5);
      setCell(grid, 21, 20, DIRT, 5);
      setCell(grid, 20, 19, RAINBOW_SAND, 5);
      setCell(grid, 20, 21, WATER, 5);
      grid.elements[(20 + radius + 2) * grid.width + 20] = OBJECT; // well outside the footprint, unaffected either way

      applyBrush(grid, 'grass', 20, 20, radius, 9);

      expect(getElement(grid, 19, 20)).toBe(SAND);
      expect(getElement(grid, 21, 20)).toBe(DIRT);
      expect(getElement(grid, 20, 19)).toBe(RAINBOW_SAND);
      expect(getElement(grid, 20, 21)).toBe(GRASS); // water is claimed
      expect(getElement(grid, 20, 20 + radius + 2)).toBe(OBJECT);

      // A previously-empty cell within the footprint (but outside the seeded cells) got grass.
      expect(getElement(grid, 20 - radius, 20)).toBe(GRASS);
    },
  );

  it('the grass brush deposits GRASS into an empty field across its footprint', () => {
    const grid = createGrid(10, 10);
    applyBrush(grid, 'grass', 5, 5, 2, 5);
    expect(getElement(grid, 5, 5)).toBe(GRASS);
    expect(getElement(grid, 4, 5)).toBe(GRASS);
    expect(getElement(grid, 6, 5)).toBe(GRASS);
  });
});

describe('brush — star power', () => {
  it.each(Object.entries(BRUSH_RADII))(
    'the star brush deposits an unfuelled star power cell into EMPTY footprint cells and never overwrites WATER/SAND/DIRT/RAINBOW_SAND/OBJECT/STAR_POWER (%s)',
    (_size, radius) => {
      const grid = createGrid(40, 40);
      // Seeded at distance 1 along each axis so every cell stays inside the footprint at every radius (>= 1).
      setCell(grid, 19, 20, SAND, 5);
      setCell(grid, 21, 20, DIRT, 5);
      setCell(grid, 20, 19, RAINBOW_SAND, 5);
      setCell(grid, 20, 21, WATER, 5);
      grid.elements[(20 + radius + 2) * grid.width + 20] = OBJECT; // well outside the footprint, unaffected either way

      applyBrush(grid, 'star', 20, 20, radius, 9);

      expect(getElement(grid, 19, 20)).toBe(SAND);
      expect(getElement(grid, 21, 20)).toBe(DIRT);
      expect(getElement(grid, 20, 19)).toBe(RAINBOW_SAND);
      expect(getElement(grid, 20, 21)).toBe(WATER); // never overwrites water
      expect(getElement(grid, 20, 20 + radius + 2)).toBe(OBJECT);

      // A previously-empty cell within the footprint got an unfuelled star power cell.
      expect(getElement(grid, 20 - radius, 20)).toBe(STAR_POWER);
      const i = 20 * grid.width + (20 - radius);
      expect(grid.starPowerFuelled[i]).toBe(0);
    },
  );

  it('the star brush converts a GRASS footprint cell into a fuelled star power cell', () => {
    const grid = createGrid(10, 10);
    setCell(grid, 5, 5, GRASS, 5);

    applyBrush(grid, 'star', 5, 5, 0, 9);

    expect(getElement(grid, 5, 5)).toBe(STAR_POWER);
    expect(grid.starPowerFuelled[5 * 10 + 5]).toBe(1);
  });

  it('the star brush never overwrites an already-STAR_POWER cell in its footprint', () => {
    const grid = createGrid(10, 10);
    applyBrush(grid, 'star', 5, 5, 0, 9);
    const before = grid.starPowerLife[5 * 10 + 5];

    applyBrush(grid, 'star', 5, 5, 0, 9);

    expect(grid.starPowerLife[5 * 10 + 5]).toBe(before);
  });
});

describe('brush — eraser and clear-all across every element', () => {
  it('the eraser empties sand, water, and dirt cells alike inside its footprint', () => {
    const grid = createGrid(5, 1);
    setCell(grid, 0, 0, SAND, 5);
    setCell(grid, 1, 0, WATER, 5);
    setCell(grid, 2, 0, DIRT, 5);
    applyBrush(grid, 'eraser', 2, 0, 3, 0);
    for (let x = 0; x < 5; x++) expect(getElement(grid, x, 0)).toBe(EMPTY);
  });

  it.each(Object.entries(BRUSH_RADII))(
    'the eraser removes grass from every cell in its footprint, exactly as it does sand/water/dirt (%s, FR-022)',
    (_size, radius) => {
      const grid = createGrid(30, 30);
      applyBrush(grid, 'grass', 15, 15, radius, 5);
      expect(getElement(grid, 15, 15)).toBe(GRASS);

      applyBrush(grid, 'eraser', 15, 15, radius, 0);

      for (let y = 0; y < 30; y++) {
        for (let x = 0; x < 30; x++) expect(getElement(grid, x, y)).toBe(EMPTY);
      }
    },
  );

  it('clearGrid empties a grid populated with all three elements', () => {
    const grid = createGrid(3, 1);
    setCell(grid, 0, 0, SAND, 5);
    setCell(grid, 1, 0, WATER, 5);
    setCell(grid, 2, 0, DIRT, 5);
    clearGrid(grid);
    expect([...grid.elements]).toEqual(new Array(3).fill(0));
  });
});
