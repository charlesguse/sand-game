import { describe, it, expect } from 'vitest';
import { createGrid, setCell, getElement } from '../../../src/sim/grid';
import { step } from '../../../src/sim/step';
import {
  applyRainbowConversions,
  createObjectsState,
  placeObject,
  removeObject,
  isUnicornTouched,
  eraseObjectsInBrush,
  eraseObjectsInBrushLine,
  clearObjects,
} from '../../../src/sim/objects';
import { EMPTY, SAND, WATER, DIRT, RAINBOW_SAND, OBJECT, GRASS, type PlacedObject } from '../../../src/sim/types';
import { OBJECT_FOOTPRINT_SIZE } from '../../../src/lib/layout';

function rainbowAt(x: number, y: number, size = 1, id = 0): PlacedObject {
  return { id, kind: 'rainbow', x, y, size };
}

function unicornAt(x: number, y: number, size = 1, id = 0): PlacedObject {
  return { id, kind: 'unicorn', x, y, size };
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

  it("an object's x/y remain unchanged across any number of step() calls, including after cells beneath it are cleared", () => {
    const grid = createGrid(60, 60);
    const state = createObjectsState();

    placeObject(grid, state, 'unicorn', 30, 30);
    const [unicorn] = state.unicorns;
    const { x, y } = unicorn;

    for (let i = 0; i < 20; i++) step(grid);
    expect(state.unicorns[0].x).toBe(x);
    expect(state.unicorns[0].y).toBe(y);

    removeObject(grid, state, unicorn);
    for (let i = 0; i < 20; i++) step(grid);
    // The object is gone from state entirely, but this also confirms step() never
    // reintroduces or moves an OBJECT-marked cell once released to EMPTY.
    expect(getElement(grid, x, y)).toBe(EMPTY);
  });
});

describe('objects — isUnicornTouched', () => {
  it('returns true when any zone cell holds SAND/WATER/DIRT/RAINBOW_SAND', () => {
    const grid = createGrid(5, 5);
    setCell(grid, 1, 1, SAND, 5);
    expect(isUnicornTouched(grid, unicornAt(2, 2, 1))).toBe(true);

    const waterGrid = createGrid(5, 5);
    setCell(waterGrid, 1, 1, WATER, 5);
    expect(isUnicornTouched(waterGrid, unicornAt(2, 2, 1))).toBe(true);

    const dirtGrid = createGrid(5, 5);
    setCell(dirtGrid, 1, 1, DIRT, 5);
    expect(isUnicornTouched(dirtGrid, unicornAt(2, 2, 1))).toBe(true);

    const rainbowSandGrid = createGrid(5, 5);
    setCell(rainbowSandGrid, 1, 1, RAINBOW_SAND, 5);
    expect(isUnicornTouched(rainbowSandGrid, unicornAt(2, 2, 1))).toBe(true);
  });

  it('returns false when every zone cell is EMPTY or OBJECT', () => {
    const grid = createGrid(5, 5);
    setCell(grid, 1, 1, OBJECT, 0);
    expect(isUnicornTouched(grid, unicornAt(2, 2, 1))).toBe(false);

    const emptyGrid = createGrid(5, 5);
    expect(isUnicornTouched(emptyGrid, unicornAt(2, 2, 1))).toBe(false);
  });

  it('evaluates multiple unicorns independently', () => {
    const grid = createGrid(10, 10);
    setCell(grid, 1, 1, SAND, 5);
    const touchedUnicorn = unicornAt(2, 2, 1, 0);
    const untouchedUnicorn = unicornAt(7, 7, 1, 1);

    expect(isUnicornTouched(grid, touchedUnicorn)).toBe(true);
    expect(isUnicornTouched(grid, untouchedUnicorn)).toBe(false);
  });
});

describe('objects — eraseObjectsInBrush', () => {
  it('removes the whole object when the brush touches any part of its footprint', () => {
    const grid = createGrid(60, 60);
    const state = createObjectsState();
    placeObject(grid, state, 'rainbow', 20, 20);
    const [rainbow] = state.rainbows;

    // Brush centered just outside the footprint's top-left corner, radius reaching in.
    eraseObjectsInBrush(grid, state, rainbow.x, rainbow.y, 2);

    expect(state.rainbows.length).toBe(0);
    for (let py = rainbow.y; py < rainbow.y + rainbow.size; py++) {
      for (let px = rainbow.x; px < rainbow.x + rainbow.size; px++) {
        expect(getElement(grid, px, py)).toBe(EMPTY);
      }
    }
  });

  it('leaves objects entirely outside the brush coverage untouched', () => {
    const grid = createGrid(200, 200);
    const state = createObjectsState();
    placeObject(grid, state, 'rainbow', 20, 20);
    placeObject(grid, state, 'unicorn', 150, 150);

    eraseObjectsInBrush(grid, state, 20, 20, 2);

    expect(state.rainbows.length).toBe(0);
    expect(state.unicorns.length).toBe(1);
  });
});

describe('objects — eraseObjectsInBrushLine', () => {
  it('erases an object straddled between two drag samples, which neither endpoint alone would touch', () => {
    const grid = createGrid(200, 60);
    const state = createObjectsState();
    placeObject(grid, state, 'rainbow', 100, 20);
    const [rainbow] = state.rainbows;
    const midY = rainbow.y + rainbow.size / 2;

    // Sanity check: the endpoints alone are far enough from the footprint to miss it.
    expect(footprintTouchesPoint(rainbow, 0, midY, 1)).toBe(false);
    expect(footprintTouchesPoint(rainbow, 199, midY, 1)).toBe(false);

    eraseObjectsInBrushLine(grid, state, { x: 0, y: midY }, { x: 199, y: midY }, 1);

    expect(state.rainbows.length).toBe(0);
  });

  it('leaves an object untouched when the whole line passes nowhere near its footprint', () => {
    const grid = createGrid(200, 200);
    const state = createObjectsState();
    placeObject(grid, state, 'rainbow', 20, 20);

    eraseObjectsInBrushLine(grid, state, { x: 150, y: 150 }, { x: 190, y: 190 }, 1);

    expect(state.rainbows.length).toBe(1);
  });
});

function footprintTouchesPoint(obj: PlacedObject, px: number, py: number, radius: number): boolean {
  const closestX = Math.max(obj.x, Math.min(px, obj.x + obj.size - 1));
  const closestY = Math.max(obj.y, Math.min(py, obj.y + obj.size - 1));
  const dx = closestX - px;
  const dy = closestY - py;
  return dx * dx + dy * dy <= radius * radius;
}

describe('objects — grass integration (FR-026, Scenario 5)', () => {
  it('placing a rainbow or unicorn over grass works exactly as it does over any other element', () => {
    const grid = createGrid(60, 60);
    setCell(grid, 10, 10, GRASS, 5);
    const state = createObjectsState();

    placeObject(grid, state, 'unicorn', 10, 10);

    expect(getElement(grid, 10, 10)).toBe(OBJECT);
  });

  it('rainbow conversion never converts a grass cell in its zone — grass is outside the conversion set', () => {
    const grid = createGrid(5, 5);
    setCell(grid, 1, 1, GRASS, 5);
    const rainbow = rainbowAt(2, 2, 1);

    applyRainbowConversions(grid, [rainbow]);

    expect(getElement(grid, 1, 1)).toBe(GRASS);
  });
});

describe('objects — clearObjects', () => {
  it('resets both rainbows and unicorns lists to empty without touching grid', () => {
    const grid = createGrid(60, 60);
    const state = createObjectsState();
    placeObject(grid, state, 'rainbow', 20, 20);
    placeObject(grid, state, 'unicorn', 40, 20);
    const rainbowCell = { x: state.rainbows[0].x, y: state.rainbows[0].y };

    clearObjects(state);

    expect(state.rainbows).toEqual([]);
    expect(state.unicorns).toEqual([]);
    // grid is untouched by clearObjects — the OBJECT cell byte is still there.
    expect(getElement(grid, rainbowCell.x, rainbowCell.y)).toBe(OBJECT);
  });
});
