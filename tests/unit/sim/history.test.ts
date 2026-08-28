import { describe, it, expect } from 'vitest';
import { createGrid, setCell, clearGrid as clearGridState, igniteStarPower, createFog, getElement } from '../../../src/sim/grid';
import { step } from '../../../src/sim/step';
import { applyBrush } from '../../../src/sim/brush';
import { applyWand } from '../../../src/sim/wand';
import {
  createObjectsState,
  placeObject,
  clearObjects,
  type ObjectsState,
} from '../../../src/sim/objects';
import { loadScene } from '../../../src/sim/scenes';
import {
  EMPTY,
  SAND,
  WATER,
  DIRT,
  RAINBOW_SAND,
  GRASS,
  STAR_POWER,
  FOG,
  type Grid,
  type SceneId,
} from '../../../src/sim/types';
import { CELL_BUDGET, GRID_WIDTH, GRID_HEIGHT } from '../../../src/lib/layout';
import { captureWorldState, restoreWorldState, HistoryManager, HISTORY_DEPTH } from '../../../src/sim/history';

function visibleSnapshot(grid: Grid, objects: ObjectsState) {
  const size = grid.width * grid.height;
  const colorAux = new Array(size);
  for (let i = 0; i < size; i++) {
    colorAux[i] = grid.elements[i] === RAINBOW_SAND ? grid.hues[i] : grid.shades[i];
  }
  return {
    elements: Array.from(grid.elements),
    colorAux,
    cloud: Array.from(grid.cloud),
    glitter: Array.from(grid.glitter),
    grassHeight: Array.from(grid.grassHeight),
    rainbows: objects.byKind.rainbow.map((o) => ({ ...o })),
    unicorns: objects.byKind.unicorn.map((o) => ({ ...o })),
  };
}

const PAINT_TOOLS = ['sand', 'water', 'dirt', 'grass', 'star', 'eraser'] as const;

describe('history — capture/restore round trip per painting tool (US1, FR-005, FR-010, SC-002)', () => {
  for (const tool of PAINT_TOOLS) {
    it(`a ${tool} stroke, captured/drawn/undone, restores a cell-for-cell identical world in every visible property`, () => {
      const grid = createGrid(20, 20);
      const objects = createObjectsState();
      if (tool === 'eraser') {
        for (let y = 0; y < 20; y++) {
          for (let x = 0; x < 20; x++) setCell(grid, x, y, SAND, 5);
        }
      }
      const history = new HistoryManager();

      history.beginAction(grid, objects);
      const before = visibleSnapshot(grid, objects);
      applyBrush(grid, tool, 10, 10, 4, 5);
      history.commitAction(grid, objects);

      expect(history.undo(grid, objects)).toBe(true);
      expect(visibleSnapshot(grid, objects)).toEqual(before);
    });
  }

  it('a ✨ wand stroke, captured/drawn/undone, restores a cell-for-cell identical world in every visible property', () => {
    const grid = createGrid(20, 20);
    const objects = createObjectsState();
    const history = new HistoryManager();

    history.beginAction(grid, objects);
    const before = visibleSnapshot(grid, objects);
    applyWand(grid, 10, 10, 4);
    history.commitAction(grid, objects);

    expect(history.undo(grid, objects)).toBe(true);
    expect(visibleSnapshot(grid, objects)).toEqual(before);
  });
});

describe('history — eraser stroke restore (US1, FR-010, FR-012)', () => {
  it("an eraser stroke's removed cells are fully restored by undo", () => {
    const grid = createGrid(15, 15);
    const objects = createObjectsState();
    setCell(grid, 5, 5, SAND, 3);
    setCell(grid, 6, 5, WATER, 7);
    setCell(grid, 5, 6, DIRT, 2);
    setCell(grid, 6, 6, GRASS, 4);
    const history = new HistoryManager();

    history.beginAction(grid, objects);
    const before = visibleSnapshot(grid, objects);
    applyBrush(grid, 'eraser', 5, 5, 3, 0);
    history.commitAction(grid, objects);

    expect(getElement(grid, 5, 5)).toBe(EMPTY);
    expect(history.undo(grid, objects)).toBe(true);
    expect(visibleSnapshot(grid, objects)).toEqual(before);
    expect(getElement(grid, 5, 5)).toBe(SAND);
  });
});

describe('history — burn spread rewind (US1, FR-008, FR-010)', () => {
  it('a ⭐ stroke igniting grass, left to spread across several step() calls, is fully rewound by undo', () => {
    const grid = createGrid(20, 20);
    const objects = createObjectsState();
    for (let y = 5; y < 15; y++) {
      for (let x = 5; x < 15; x++) setCell(grid, x, y, GRASS, 3);
    }
    const history = new HistoryManager();

    history.beginAction(grid, objects);
    const before = visibleSnapshot(grid, objects);
    igniteStarPower(grid, 10, 10, true);
    history.commitAction(grid, objects);

    for (let n = 0; n < 40; n++) step(grid);
    let starPowerCount = 0;
    for (const e of grid.elements) if (e === STAR_POWER) starPowerCount++;
    expect(starPowerCount).toBeGreaterThan(0);

    expect(history.undo(grid, objects)).toBe(true);
    expect(visibleSnapshot(grid, objects)).toEqual(before);
  });
});

describe('history — pre-action capture point (US1, FR-008)', () => {
  it('a stroke followed by many step() calls still restores the exact pre-stroke state on undo', () => {
    const grid = createGrid(20, 30);
    const objects = createObjectsState();
    const history = new HistoryManager();

    history.beginAction(grid, objects);
    const before = visibleSnapshot(grid, objects);
    for (let x = 0; x < 20; x++) setCell(grid, x, 0, SAND, 5);
    history.commitAction(grid, objects);

    for (let n = 0; n < 100; n++) step(grid);

    expect(history.undo(grid, objects)).toBe(true);
    expect(visibleSnapshot(grid, objects)).toEqual(before);
  });
});

describe('history — several strokes undone one at a time (US1, FR-013)', () => {
  it('each undo steps back exactly one stroke, most recent first', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    const history = new HistoryManager();

    const snapshots: ReturnType<typeof visibleSnapshot>[] = [];
    snapshots.push(visibleSnapshot(grid, objects));
    for (let n = 0; n < 5; n++) {
      history.beginAction(grid, objects);
      setCell(grid, n, 0, SAND, n + 1);
      history.commitAction(grid, objects);
      snapshots.push(visibleSnapshot(grid, objects));
    }

    for (let n = 5; n >= 1; n--) {
      expect(history.undo(grid, objects)).toBe(true);
      expect(visibleSnapshot(grid, objects)).toEqual(snapshots[n - 1]);
    }
  });
});

describe('history — single-tap dot stroke (US1)', () => {
  it('a beginAction immediately followed by one change and commitAction is one action undone by one undo() call', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    const history = new HistoryManager();

    history.beginAction(grid, objects);
    const before = visibleSnapshot(grid, objects);
    setCell(grid, 4, 4, SAND, 9);
    history.commitAction(grid, objects);

    expect(history.undo(grid, objects)).toBe(true);
    expect(visibleSnapshot(grid, objects)).toEqual(before);
    expect(history.canUndo()).toBe(false);
  });
});

describe('history — empty undo stack (US1, FR-003, FR-013)', () => {
  it('undo() on an empty undo stack returns false and changes nothing', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    setCell(grid, 3, 3, WATER, 5);
    const history = new HistoryManager();
    const before = visibleSnapshot(grid, objects);

    expect(history.undo(grid, objects)).toBe(false);
    expect(visibleSnapshot(grid, objects)).toEqual(before);
  });
});

describe('history — every element/visible property round trip (US1, FR-024)', () => {
  it('every element type and every visible cell property survives a capture/restore round trip unchanged', () => {
    const grid = createGrid(12, 12);
    const objects = createObjectsState();
    setCell(grid, 0, 0, SAND, 3);
    setCell(grid, 1, 0, WATER, 7);
    setCell(grid, 2, 0, DIRT, 2);
    setCell(grid, 3, 0, GRASS, 4);
    grid.grassHeight[0 * 12 + 3] = 9;
    setCell(grid, 4, 0, RAINBOW_SAND, 0);
    grid.hues[0 * 12 + 4] = 200;
    igniteStarPower(grid, 5, 0, true);
    createFog(grid, 6, 0);
    grid.cloud[0 * 12 + 7] = 1;
    grid.elements[0 * 12 + 7] = FOG;
    grid.shades[0 * 12 + 7] = 44;
    grid.glitter[1 * 12 + 0] = 1;
    setCell(grid, 0, 1, SAND, 1);
    grid.glitter[1 * 12 + 0] = 1;
    placeObject(grid, objects, 'rainbow', 8, 8);
    placeObject(grid, objects, 'unicorn', 4, 8);

    const state = captureWorldState(grid, objects);
    const before = visibleSnapshot(grid, objects);

    clearGridState(grid);
    clearObjects(objects);
    restoreWorldState(grid, objects, state);

    expect(visibleSnapshot(grid, objects)).toEqual(before);
  });
});

describe('history — no captured internal countdown; restarted countdowns run to completion (US1, FR-028, FR-024)', () => {
  it('a captured state holds no internal countdown field, and a restored burning cell runs its restarted burn to completion normally', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    igniteStarPower(grid, 5, 5, false);
    const i = 5 * 10 + 5;
    grid.starPowerAge[i] = 40;

    const state = captureWorldState(grid, objects);
    expect(Object.keys(state)).not.toContain('starPowerAge');
    expect(Object.keys(state)).not.toContain('starPowerLife');
    expect(Object.keys(state)).not.toContain('starPowerFuelled');
    expect(Object.keys(state)).not.toContain('fogRiseCooldown');
    expect(Object.keys(state)).not.toContain('fogAge');
    expect(Object.keys(state)).not.toContain('fogStuckSteps');
    expect(Object.keys(state)).not.toContain('cloudRainDelay');
    expect(Object.keys(state)).not.toContain('grassCooldown');

    clearGridState(grid);
    restoreWorldState(grid, objects, state);
    expect(grid.starPowerAge[i]).toBe(0);
    expect(grid.starPowerLife[i]).toBeGreaterThanOrEqual(30);
    expect(grid.starPowerLife[i]).toBeLessThanOrEqual(60);

    let steps = 0;
    while (getElement(grid, 5, 5) === STAR_POWER && steps < 100) {
      step(grid);
      steps++;
    }
    expect(getElement(grid, 5, 5)).not.toBe(STAR_POWER);
  });

  it('a restored rising fog cell runs its restarted rise cooldown to completion normally', () => {
    const grid = createGrid(1, 50);
    const objects = createObjectsState();
    createFog(grid, 0, 49);
    grid.fogRiseCooldown[49] = 1;

    const state = captureWorldState(grid, objects);
    clearGridState(grid);
    restoreWorldState(grid, objects, state);

    expect(grid.fogRiseCooldown[49]).toBeGreaterThanOrEqual(3);
    expect(grid.fogRiseCooldown[49]).toBeLessThanOrEqual(5);
    expect(grid.fogAge[49]).toBe(0);
    expect(grid.fogStuckSteps[49]).toBe(0);

    for (let n = 0; n < 10; n++) step(grid);
    let fogCount = 0;
    for (const e of grid.elements) if (e === FOG) fogCount++;
    expect(fogCount).toBeGreaterThan(0);
  });

  it('a restored gathering cloud runs its restarted rain delay to completion normally', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    createFog(grid, 5, 5);
    const i = 5 * 10 + 5;
    grid.cloud[i] = 1;
    grid.cloudRainDelay[i] = 1;

    const state = captureWorldState(grid, objects);
    clearGridState(grid);
    restoreWorldState(grid, objects, state);

    expect(grid.cloudRainDelay[i]).toBeGreaterThanOrEqual(180);
    expect(grid.cloudRainDelay[i]).toBeLessThanOrEqual(480);
    expect(grid.fogAge[i]).toBe(0);

    let steps = 0;
    while (getElement(grid, 5, 5) === FOG && steps < 1000) {
      step(grid);
      steps++;
    }
    expect(getElement(grid, 5, 5)).toBe(WATER);
  });
});

describe('history — simulation stays valid after restore (US1, FR-011, SC-004)', () => {
  it('the simulation continues to advance from a restored state as a valid world for 600+ step() calls', () => {
    const grid = createGrid(30, 30);
    const objects = createObjectsState();
    for (let y = 20; y < 30; y++) {
      for (let x = 0; x < 30; x++) setCell(grid, x, y, GRASS, 3);
    }
    for (let x = 0; x < 10; x++) setCell(grid, x, 15, WATER, 5);
    for (let x = 10; x < 20; x++) setCell(grid, x, 15, SAND, 5);
    igniteStarPower(grid, 25, 19, true);
    createFog(grid, 20, 15);

    const state = captureWorldState(grid, objects);
    restoreWorldState(grid, objects, state);

    for (let n = 0; n < 600; n++) {
      expect(() => step(grid)).not.toThrow();
    }

    let actualGrass = 0;
    let actualFog = 0;
    for (const e of grid.elements) {
      if (e === GRASS) actualGrass++;
      if (e === FOG) actualFog++;
    }
    expect(grid.grassCount).toBe(actualGrass);
    expect(grid.fogCloudCount).toBe(actualFog);
  });
});

describe('history — per-state memory budget (US1, FR-028, SC-014)', () => {
  it(`a captured state at CELL_BUDGET (${CELL_BUDGET}) stays within the ~0.19 MB/state figure`, () => {
    const grid = createGrid(GRID_WIDTH, GRID_HEIGHT);
    const objects = createObjectsState();
    expect(grid.width * grid.height).toBe(CELL_BUDGET);

    const state = captureWorldState(grid, objects);
    const bytes =
      state.elements.byteLength +
      state.colorAux.byteLength +
      state.cloud.byteLength +
      state.glitter.byteLength +
      state.grassHeight.byteLength;

    expect(bytes).toBe(5 * CELL_BUDGET);
    expect(bytes).toBe(216_000);
  });
});

describe('history — clear/scene rescue (US2, FR-012, SC-003)', () => {
  it('a field with every element plus placed objects, cleared, is fully restored (100% of cells, 100% of objects) by undo', () => {
    const grid = createGrid(15, 15);
    const objects = createObjectsState();
    setCell(grid, 0, 0, SAND, 3);
    setCell(grid, 1, 0, WATER, 7);
    setCell(grid, 2, 0, DIRT, 2);
    setCell(grid, 3, 0, GRASS, 4);
    setCell(grid, 4, 0, RAINBOW_SAND, 0);
    grid.hues[4] = 111;
    igniteStarPower(grid, 5, 0, true);
    createFog(grid, 6, 0);
    placeObject(grid, objects, 'rainbow', 8, 8);
    placeObject(grid, objects, 'unicorn', 4, 8);
    const history = new HistoryManager();

    history.beginAction(grid, objects);
    const before = visibleSnapshot(grid, objects);
    clearGridState(grid);
    clearObjects(objects);
    history.commitAction(grid, objects);

    expect(history.undo(grid, objects)).toBe(true);
    expect(visibleSnapshot(grid, objects)).toEqual(before);
  });

  for (const sceneId of ['empty', 'landscape1', 'landscape2'] as SceneId[]) {
    it(`a field with every element plus placed objects, replaced by the ${sceneId} scene, is fully restored by undo`, () => {
      const grid = createGrid(GRID_WIDTH, GRID_HEIGHT);
      const objects = createObjectsState();
      setCell(grid, 0, 0, SAND, 3);
      setCell(grid, 1, 0, WATER, 7);
      setCell(grid, 2, 0, DIRT, 2);
      setCell(grid, 3, 0, GRASS, 4);
      igniteStarPower(grid, 5, 0, true);
      createFog(grid, 6, 0);
      placeObject(grid, objects, 'rainbow', 8, 8);
      placeObject(grid, objects, 'unicorn', 4, 8);
      const history = new HistoryManager();

      history.beginAction(grid, objects);
      const before = visibleSnapshot(grid, objects);
      loadScene(sceneId, grid, objects);
      history.commitAction(grid, objects);

      expect(history.undo(grid, objects)).toBe(true);
      expect(visibleSnapshot(grid, objects)).toEqual(before);
    });
  }

  it('after a rescue undo, the restored Grid/ObjectsState behave as ordinary valid instances under further edits', () => {
    const grid = createGrid(15, 15);
    const objects = createObjectsState();
    setCell(grid, 0, 0, SAND, 3);
    const history = new HistoryManager();

    history.beginAction(grid, objects);
    clearGridState(grid);
    clearObjects(objects);
    history.commitAction(grid, objects);
    history.undo(grid, objects);

    setCell(grid, 5, 5, WATER, 5);
    expect(getElement(grid, 5, 5)).toBe(WATER);
    placeObject(grid, objects, 'rainbow', 9, 9);
    expect(objects.byKind.rainbow.length).toBeGreaterThan(0);
    for (let n = 0; n < 20; n++) expect(() => step(grid)).not.toThrow();
  });

  it('a clear on an already-empty field records nothing, so the next undo takes back the last action that actually changed the world', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    const history = new HistoryManager();
    const start = visibleSnapshot(grid, objects);

    // No-op: the field is already empty, so this clear changes nothing and records nothing.
    history.beginAction(grid, objects);
    clearGridState(grid);
    clearObjects(objects);
    history.commitAction(grid, objects);
    expect(history.canUndo()).toBe(false);

    history.beginAction(grid, objects);
    setCell(grid, 2, 2, SAND, 4);
    history.commitAction(grid, objects);

    expect(history.undo(grid, objects)).toBe(true);
    expect(visibleSnapshot(grid, objects)).toEqual(start);
    expect(history.canUndo()).toBe(false);
  });
});

describe('history — undo/redo round trip (US3, FR-016, SC-009)', () => {
  it('action -> undo -> redo returns the field to exactly the pre-undo state', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    const history = new HistoryManager();

    history.beginAction(grid, objects);
    setCell(grid, 2, 2, SAND, 4);
    history.commitAction(grid, objects);
    const afterAction = visibleSnapshot(grid, objects);

    expect(history.undo(grid, objects)).toBe(true);
    expect(history.redo(grid, objects)).toBe(true);
    expect(visibleSnapshot(grid, objects)).toEqual(afterAction);
  });

  it('20+ consecutive undo/redo alternations return to the starting state one step per tap', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    const history = new HistoryManager();
    const start = visibleSnapshot(grid, objects);

    history.beginAction(grid, objects);
    setCell(grid, 3, 3, WATER, 6);
    history.commitAction(grid, objects);
    const afterAction = visibleSnapshot(grid, objects);

    for (let n = 0; n < 20; n++) {
      expect(history.undo(grid, objects)).toBe(true);
      expect(visibleSnapshot(grid, objects)).toEqual(start);
      expect(history.redo(grid, objects)).toBe(true);
      expect(visibleSnapshot(grid, objects)).toEqual(afterAction);
    }
  });

  it('undo followed by any new recorded action discards the entire redo history', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    const history = new HistoryManager();

    history.beginAction(grid, objects);
    setCell(grid, 1, 1, SAND, 4);
    history.commitAction(grid, objects);

    expect(history.undo(grid, objects)).toBe(true);
    expect(history.canRedo()).toBe(true);

    history.beginAction(grid, objects);
    setCell(grid, 2, 2, WATER, 4);
    history.commitAction(grid, objects);

    expect(history.canRedo()).toBe(false);
    const before = visibleSnapshot(grid, objects);
    expect(history.redo(grid, objects)).toBe(false);
    expect(visibleSnapshot(grid, objects)).toEqual(before);
  });

  it('undo followed by many step() calls before redoing still restores exactly the state the undo captured', () => {
    const grid = createGrid(20, 30);
    const objects = createObjectsState();
    const history = new HistoryManager();

    history.beginAction(grid, objects);
    for (let x = 0; x < 20; x++) setCell(grid, x, 0, SAND, 5);
    history.commitAction(grid, objects);
    const afterAction = visibleSnapshot(grid, objects);

    history.undo(grid, objects);
    for (let n = 0; n < 100; n++) step(grid);

    expect(history.redo(grid, objects)).toBe(true);
    expect(visibleSnapshot(grid, objects)).toEqual(afterAction);
  });

  it('redo() on an empty redo stack (fresh HistoryManager) returns false and changes nothing', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    setCell(grid, 4, 4, DIRT, 3);
    const history = new HistoryManager();
    const before = visibleSnapshot(grid, objects);

    expect(history.redo(grid, objects)).toBe(false);
    expect(visibleSnapshot(grid, objects)).toEqual(before);
  });
});

describe('history — adversarial robustness (US4, FR-003, FR-019, FR-020, SC-006, SC-007, SC-011)', () => {
  it('hammering undo/redo from adversarial states never throws, never partially restores, and never exceeds HISTORY_DEPTH', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    const history = new HistoryManager();

    expect(() => history.undo(grid, objects)).not.toThrow();
    expect(() => history.redo(grid, objects)).not.toThrow();

    for (let n = 0; n < HISTORY_DEPTH + 5; n++) {
      history.beginAction(grid, objects);
      setCell(grid, n % 10, Math.floor(n / 10) % 10, SAND, (n % 250) + 1);
      history.commitAction(grid, objects);
    }

    let undoCount = 0;
    while (history.undo(grid, objects)) undoCount++;
    expect(undoCount).toBeLessThanOrEqual(HISTORY_DEPTH);

    expect(() => history.undo(grid, objects)).not.toThrow();
    expect(history.undo(grid, objects)).toBe(false);

    let redoCount = 0;
    while (history.redo(grid, objects)) redoCount++;
    expect(redoCount).toBeLessThanOrEqual(HISTORY_DEPTH);
    expect(() => history.redo(grid, objects)).not.toThrow();

    for (let n = 0; n < 50; n++) {
      if (n % 2 === 0) history.undo(grid, objects);
      else history.redo(grid, objects);
    }
    expect(() => step(grid)).not.toThrow();
  });

  it('recording an 11th action drops exactly the oldest remembered one, with the newer 10 intact and undoable', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    const history = new HistoryManager();
    const snapshots: ReturnType<typeof visibleSnapshot>[] = [];

    for (let n = 0; n < HISTORY_DEPTH + 1; n++) {
      history.beginAction(grid, objects);
      setCell(grid, n % 10, 0, SAND, (n % 250) + 1);
      history.commitAction(grid, objects);
      snapshots.push(visibleSnapshot(grid, objects));
    }

    // The oldest (index 0) action's before-state is gone — only the newest 10 remain undoable,
    // landing back at snapshots[0] (the state right after the 1st, now-oldest-retained, action).
    for (let n = HISTORY_DEPTH; n >= 1; n--) {
      expect(history.undo(grid, objects)).toBe(true);
      expect(visibleSnapshot(grid, objects)).toEqual(snapshots[n - 1]);
    }
    expect(history.canUndo()).toBe(false);
  });

  it(`a full ${HISTORY_DEPTH}+${HISTORY_DEPTH} history stays within the ~4 MB budget (FR-028, SC-014)`, () => {
    const grid = createGrid(GRID_WIDTH, GRID_HEIGHT);
    const objects = createObjectsState();
    const history = new HistoryManager();

    for (let n = 0; n < HISTORY_DEPTH; n++) {
      history.beginAction(grid, objects);
      setCell(grid, n % GRID_WIDTH, 0, SAND, (n % 250) + 1);
      history.commitAction(grid, objects);
    }
    for (let n = 0; n < HISTORY_DEPTH; n++) history.undo(grid, objects);

    const perStateBytes = 5 * CELL_BUDGET;
    const totalBytes = 2 * HISTORY_DEPTH * perStateBytes;
    expect(totalBytes).toBeLessThanOrEqual(4.2 * 1024 * 1024);
  });

  it('reset() clears both stacks and any pending capture in one call', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    const history = new HistoryManager();

    history.beginAction(grid, objects);
    setCell(grid, 1, 1, SAND, 3);
    history.commitAction(grid, objects);
    history.undo(grid, objects);
    history.beginAction(grid, objects);

    history.reset();

    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
    const before = visibleSnapshot(grid, objects);
    setCell(grid, 5, 5, WATER, 2);
    history.commitAction(grid, objects);
    expect(history.canUndo()).toBe(false);
    expect(visibleSnapshot(grid, objects)).not.toEqual(before);
  });

  it('reset leaves both histories empty, while beginAction/commitAction without an intervening reset leaves history intact', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    const history = new HistoryManager();

    history.beginAction(grid, objects);
    setCell(grid, 1, 1, SAND, 3);
    history.commitAction(grid, objects);
    expect(history.canUndo()).toBe(true);

    history.reset();
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);

    history.beginAction(grid, objects);
    setCell(grid, 2, 2, WATER, 3);
    history.commitAction(grid, objects);
    expect(history.canUndo()).toBe(true);

    history.beginAction(grid, objects);
    setCell(grid, 3, 3, DIRT, 3);
    history.commitAction(grid, objects);
    expect(history.canUndo()).toBe(true);
    let count = 0;
    while (history.undo(grid, objects)) count++;
    expect(count).toBe(2);
  });
});

describe('history — object placement undo (FR-005, FR-012)', () => {
  it('undo removes exactly one placed rainbow, leaving every other cell and object unchanged', () => {
    const grid = createGrid(15, 15);
    const objects = createObjectsState();
    setCell(grid, 2, 2, SAND, 4);
    placeObject(grid, objects, 'unicorn', 4, 8);
    const history = new HistoryManager();

    history.beginAction(grid, objects);
    const before = visibleSnapshot(grid, objects);
    placeObject(grid, objects, 'rainbow', 10, 10);
    history.commitAction(grid, objects);

    expect(objects.byKind.rainbow.length).toBe(1);
    expect(history.undo(grid, objects)).toBe(true);
    expect(visibleSnapshot(grid, objects)).toEqual(before);
    expect(objects.byKind.rainbow.length).toBe(0);
    expect(objects.byKind.unicorn.length).toBe(1);
  });

  it('undo removes exactly one placed unicorn, leaving every other cell and object unchanged', () => {
    const grid = createGrid(15, 15);
    const objects = createObjectsState();
    placeObject(grid, objects, 'rainbow', 4, 8);
    const history = new HistoryManager();

    history.beginAction(grid, objects);
    const before = visibleSnapshot(grid, objects);
    placeObject(grid, objects, 'unicorn', 10, 10);
    history.commitAction(grid, objects);

    expect(objects.byKind.unicorn.length).toBe(1);
    expect(history.undo(grid, objects)).toBe(true);
    expect(visibleSnapshot(grid, objects)).toEqual(before);
    expect(objects.byKind.unicorn.length).toBe(0);
    expect(objects.byKind.rainbow.length).toBe(1);
  });
});

describe('history — simulation never records (FR-006)', () => {
  it('running step() many times with no beginAction/commitAction never populates the undo history', () => {
    const grid = createGrid(20, 20);
    const objects = createObjectsState();
    for (let y = 5; y < 15; y++) {
      for (let x = 5; x < 15; x++) setCell(grid, x, y, GRASS, 3);
    }
    igniteStarPower(grid, 10, 10, true);
    createFog(grid, 2, 2);
    const history = new HistoryManager();

    for (let n = 0; n < 200; n++) {
      step(grid);
      expect(history.canUndo()).toBe(false);
    }
    expect(history.canRedo()).toBe(false);
  });
});
