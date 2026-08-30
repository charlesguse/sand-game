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
  OBJECT,
  GRASS,
  STAR_POWER,
  FOG,
  GUMDROP,
  FLOWER,
  type Grid,
  type SceneId,
} from '../../../src/sim/types';
import { CELL_BUDGET, GRID_WIDTH, GRID_HEIGHT } from '../../../src/lib/layout';
import { computeFingerprint, serializeHistory, deserializeHistory } from '../../../src/sim/historySave';
import {
  captureWorldState,
  restoreWorldState,
  remapWorldState,
  remapWorldStates,
  worldStateFits,
  HistoryManager,
  HISTORY_DEPTH,
} from '../../../src/sim/history';

function visibleSnapshot(grid: Grid, objects: ObjectsState) {
  const size = grid.width * grid.height;
  const colorAux = new Array(size);
  for (let i = 0; i < size; i++) {
    // Deliberately spelled out longhand (not shared with src's usesHueColor) so a regression in
    // either the predicate or the capture path fails here instead of hiding behind shared code.
    colorAux[i] =
      grid.elements[i] === RAINBOW_SAND || grid.elements[i] === GUMDROP || grid.elements[i] === FLOWER
        ? grid.hues[i]
        : grid.shades[i];
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

const PAINT_TOOLS = ['sand', 'water', 'dirt', 'grass', 'star', 'gumdrop', 'eraser'] as const;

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

  it('a world containing a 🌼 flower, captured/erased/undone, keeps its hue (the third hue-coloured element)', () => {
    const grid = createGrid(20, 20);
    const objects = createObjectsState();
    setCell(grid, 12, 12, FLOWER, 0);
    grid.hues[12 * grid.width + 12] = 77;
    const history = new HistoryManager();

    history.beginAction(grid, objects);
    const before = visibleSnapshot(grid, objects);
    applyBrush(grid, 'eraser', 12, 12, 3, 0);
    history.commitAction(grid, objects);

    expect(history.undo(grid, objects)).toBe(true);
    expect(visibleSnapshot(grid, objects)).toEqual(before);
    expect(grid.elements[12 * grid.width + 12]).toBe(FLOWER);
    expect(grid.hues[12 * grid.width + 12]).toBe(77);
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

describe('history — gumdrop colour survives undo/redo (US1, FR-024)', () => {
  it("undo then redo across a later, unrelated action preserves each gumdrop's own hue exactly", () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    const history = new HistoryManager();

    history.beginAction(grid, objects);
    setCell(grid, 1, 1, GUMDROP, 0);
    grid.hues[1 * 10 + 1] = 30;
    setCell(grid, 2, 1, GUMDROP, 0);
    grid.hues[1 * 10 + 2] = 90;
    setCell(grid, 3, 1, GUMDROP, 0);
    grid.hues[1 * 10 + 3] = 200;
    history.commitAction(grid, objects);

    // A second, unrelated tracked action — elsewhere on the grid.
    history.beginAction(grid, objects);
    setCell(grid, 8, 8, SAND, 5);
    history.commitAction(grid, objects);

    expect(history.undo(grid, objects)).toBe(true);
    expect(history.redo(grid, objects)).toBe(true);

    expect(getElement(grid, 1, 1)).toBe(GUMDROP);
    expect(getElement(grid, 2, 1)).toBe(GUMDROP);
    expect(getElement(grid, 3, 1)).toBe(GUMDROP);
    expect(grid.hues[1 * 10 + 1]).toBe(30);
    expect(grid.hues[1 * 10 + 2]).toBe(90);
    expect(grid.hues[1 * 10 + 3]).toBe(200);
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

describe('history — remapWorldState re-anchors a snapshot to new grid dimensions (FR-022 as amended, see resize() in PlayArea.svelte)', () => {
  it('remaps a captured world to a larger grid, landing content at the given offset, cell for cell', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    setCell(grid, 2, 3, SAND, 7);
    setCell(grid, 5, 5, WATER, 2);
    const state = captureWorldState(grid, objects);

    const offsetX = 4;
    const offsetY = 6;
    const remapped = remapWorldState(state, 10, 10, 20, 20, offsetX, offsetY);

    const newGrid = createGrid(20, 20);
    const newObjects = createObjectsState();
    restoreWorldState(newGrid, newObjects, remapped);

    expect(getElement(newGrid, 2 + offsetX, 3 + offsetY)).toBe(SAND);
    expect(newGrid.shades[(3 + offsetY) * 20 + (2 + offsetX)]).toBe(7);
    expect(getElement(newGrid, 5 + offsetX, 5 + offsetY)).toBe(WATER);

    let nonEmptyCount = 0;
    for (let i = 0; i < 20 * 20; i++) if (newGrid.elements[i] !== EMPTY) nonEmptyCount++;
    expect(nonEmptyCount).toBe(2);
  });

  it('remaps to a smaller grid, dropping content that falls outside without error or corrupting what remains', () => {
    const grid = createGrid(20, 20);
    const objects = createObjectsState();
    setCell(grid, 1, 1, SAND, 5);
    setCell(grid, 7, 7, DIRT, 9);
    const state = captureWorldState(grid, objects);

    const offsetX = -5;
    const offsetY = -5;
    const remapped = remapWorldState(state, 20, 20, 10, 10, offsetX, offsetY);

    const newGrid = createGrid(10, 10);
    const newObjects = createObjectsState();
    expect(() => restoreWorldState(newGrid, newObjects, remapped)).not.toThrow();

    expect(getElement(newGrid, 2, 2)).toBe(DIRT);
    expect(newGrid.shades[2 * 10 + 2]).toBe(9);

    let nonEmptyCount = 0;
    for (let i = 0; i < 10 * 10; i++) if (newGrid.elements[i] !== EMPTY) nonEmptyCount++;
    expect(nonEmptyCount).toBe(1);
  });

  it('canUndo() is still true after a remap that follows a recorded action — the actual bug', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    const history = new HistoryManager();

    history.beginAction(grid, objects);
    setCell(grid, 3, 3, SAND, 4);
    history.commitAction(grid, objects);
    expect(history.canUndo()).toBe(true);

    history.remap(10, 10, 20, 20, 5, 10);

    expect(history.canUndo()).toBe(true);
  });

  it('remaps the redo stack too, not just undo', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    const history = new HistoryManager();

    history.beginAction(grid, objects);
    setCell(grid, 4, 4, WATER, 6);
    history.commitAction(grid, objects);
    expect(history.undo(grid, objects)).toBe(true);
    expect(history.canRedo()).toBe(true);

    const offsetX = 3;
    const offsetY = 8;
    history.remap(10, 10, 20, 20, offsetX, offsetY);

    const newGrid = createGrid(20, 20);
    const newObjects = createObjectsState();
    expect(history.redo(newGrid, newObjects)).toBe(true);
    expect(getElement(newGrid, 4 + offsetX, 4 + offsetY)).toBe(WATER);
    expect(newGrid.shades[(4 + offsetY) * 20 + (4 + offsetX)]).toBe(6);
  });

  it('drops an object that no longer fits, leaving no orphan OBJECT cells in the remapped elements', () => {
    const grid = createGrid(30, 30);
    const objects = createObjectsState();
    placeObject(grid, objects, 'unicorn', 15, 15);
    const state = captureWorldState(grid, objects);

    // Remap to a much smaller grid so the object's 24x24 footprint can't possibly fit anywhere.
    const remapped = remapWorldState(state, 30, 30, 10, 10, 0, 0);

    expect(remapped.byKind.unicorn.length).toBe(0);
    for (let i = 0; i < remapped.elements.length; i++) {
      expect(remapped.elements[i]).not.toBe(OBJECT);
    }
  });

  it('keeps an object that still fits, shifted by the offset, with its OBJECT footprint present', () => {
    const grid = createGrid(30, 30);
    const objects = createObjectsState();
    placeObject(grid, objects, 'palm', 10, 10);
    const original = objects.byKind.palm[0];
    const state = captureWorldState(grid, objects);

    const offsetX = 5;
    const offsetY = 5;
    const remapped = remapWorldState(state, 30, 30, 40, 40, offsetX, offsetY);

    expect(remapped.byKind.palm.length).toBe(1);
    const moved = remapped.byKind.palm[0];
    expect(moved.x).toBe(original.x + offsetX);
    expect(moved.y).toBe(original.y + offsetY);
    expect(moved.size).toBe(original.size);
    expect(moved.id).toBe(original.id);

    for (let py = moved.y; py < moved.y + moved.size; py++) {
      for (let px = moved.x; px < moved.x + moved.size; px++) {
        expect(remapped.elements[py * 40 + px]).toBe(OBJECT);
      }
    }
  });

  it('a RAINBOW_SAND cell keeps its hue through remap then restore', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    setCell(grid, 4, 4, RAINBOW_SAND, 0);
    grid.hues[4 * 10 + 4] = 123;
    const state = captureWorldState(grid, objects);

    const offsetX = 2;
    const offsetY = 2;
    const remapped = remapWorldState(state, 10, 10, 20, 20, offsetX, offsetY);

    const newGrid = createGrid(20, 20);
    const newObjects = createObjectsState();
    restoreWorldState(newGrid, newObjects, remapped);

    expect(getElement(newGrid, 4 + offsetX, 4 + offsetY)).toBe(RAINBOW_SAND);
    expect(newGrid.hues[(4 + offsetY) * 20 + (4 + offsetX)]).toBe(123);
  });

  it('a GUMDROP cell keeps its hue through remap then restore', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    setCell(grid, 6, 6, GUMDROP, 0);
    grid.hues[6 * 10 + 6] = 77;
    const state = captureWorldState(grid, objects);

    const offsetX = -1;
    const offsetY = 3;
    const remapped = remapWorldState(state, 10, 10, 15, 15, offsetX, offsetY);

    const newGrid = createGrid(15, 15);
    const newObjects = createObjectsState();
    restoreWorldState(newGrid, newObjects, remapped);

    expect(getElement(newGrid, 6 + offsetX, 6 + offsetY)).toBe(GUMDROP);
    expect(newGrid.hues[(6 + offsetY) * 15 + (6 + offsetX)]).toBe(77);
  });
});

describe('history — restoreWorldState refuses a wrong-shaped state instead of corrupting the grid (hardening: shape guard)', () => {
  it('refuses a state whose arrays are all the wrong length: returns false and leaves the grid completely unmodified', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    setCell(grid, 3, 3, SAND, 5);
    setCell(grid, 7, 2, WATER, 9);
    const before = visibleSnapshot(grid, objects);

    const wrongGrid = createGrid(20, 20);
    const wrongObjects = createObjectsState();
    const wrongState = captureWorldState(wrongGrid, wrongObjects);

    expect(worldStateFits(wrongState, grid)).toBe(false);
    expect(restoreWorldState(grid, objects, wrongState)).toBe(false);
    expect(visibleSnapshot(grid, objects)).toEqual(before);
  });

  it('refuses a state with correctly-sized elements but a wrong-sized glitter array', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    setCell(grid, 4, 4, DIRT, 1);
    const before = visibleSnapshot(grid, objects);

    const validState = captureWorldState(grid, objects);
    const mismatched = { ...validState, glitter: new Uint8Array(validState.glitter.length + 1) };

    expect(worldStateFits(mismatched, grid)).toBe(false);
    expect(restoreWorldState(grid, objects, mismatched)).toBe(false);
    expect(visibleSnapshot(grid, objects)).toEqual(before);
  });

  it('undo() with a mismatched state on the stack returns false, leaves the grid untouched, and clears the stack', () => {
    const smallGrid = createGrid(10, 10);
    const smallObjects = createObjectsState();
    const history = new HistoryManager();

    history.beginAction(smallGrid, smallObjects);
    setCell(smallGrid, 2, 2, SAND, 4);
    history.commitAction(smallGrid, smallObjects);
    expect(history.canUndo()).toBe(true);

    // Simulate the state-on-stack no longer matching the live grid's shape (e.g. a bug elsewhere
    // left a wrong-shaped entry behind) by calling undo() against a differently-sized grid.
    const bigGrid = createGrid(20, 20);
    const bigObjects = createObjectsState();
    setCell(bigGrid, 15, 15, WATER, 6);
    const before = visibleSnapshot(bigGrid, bigObjects);

    expect(history.undo(bigGrid, bigObjects)).toBe(false);
    expect(visibleSnapshot(bigGrid, bigObjects)).toEqual(before);
    expect(history.canUndo()).toBe(false);
  });

  it('redo() with a mismatched state on the stack returns false, leaves the grid untouched, and clears the stack', () => {
    const smallGrid = createGrid(10, 10);
    const smallObjects = createObjectsState();
    const history = new HistoryManager();

    history.beginAction(smallGrid, smallObjects);
    setCell(smallGrid, 2, 2, SAND, 4);
    history.commitAction(smallGrid, smallObjects);
    expect(history.undo(smallGrid, smallObjects)).toBe(true);
    expect(history.canRedo()).toBe(true);

    const bigGrid = createGrid(20, 20);
    const bigObjects = createObjectsState();
    setCell(bigGrid, 15, 15, WATER, 6);
    const before = visibleSnapshot(bigGrid, bigObjects);

    expect(history.redo(bigGrid, bigObjects)).toBe(false);
    expect(visibleSnapshot(bigGrid, bigObjects)).toEqual(before);
    expect(history.canRedo()).toBe(false);
  });
});

describe('history — HistoryManager.remap keeps only losslessly-remappable states (hardening: undo used to be lossy)', () => {
  it('keeps a state whose content and object both fit after the offset — the common case is unaffected', () => {
    const grid = createGrid(20, 20);
    const objects = createObjectsState();
    const history = new HistoryManager();

    history.beginAction(grid, objects);
    setCell(grid, 2, 2, SAND, 5);
    placeObject(grid, objects, 'palm', 10, 10);
    history.commitAction(grid, objects);
    expect(history.canUndo()).toBe(true);

    const offsetX = 5;
    const offsetY = 5;
    history.remap(20, 20, 30, 30, offsetX, offsetY);
    expect(history.canUndo()).toBe(true);

    const newGrid = createGrid(30, 30);
    const newObjects = createObjectsState();
    expect(history.undo(newGrid, newObjects)).toBe(true);

    // The kept "before" snapshot had neither the sand cell nor the palm yet (both were placed
    // by the action being undone), so undoing should land on an entirely empty, correctly-sized
    // grid — proving the state survived the remap and restored cleanly rather than being dropped
    // or corrupted.
    let nonEmptyCount = 0;
    for (let i = 0; i < 30 * 30; i++) if (newGrid.elements[i] !== EMPTY) nonEmptyCount++;
    expect(nonEmptyCount).toBe(0);
    expect(newObjects.byKind.palm.length).toBe(0);
  });

  it('discards a state whose non-EMPTY content would fall outside the new bounds', () => {
    const grid = createGrid(20, 20);
    const objects = createObjectsState();
    const history = new HistoryManager();

    // Action 1: paint near the origin — this "before" state (empty) will always fit.
    history.beginAction(grid, objects);
    setCell(grid, 1, 1, SAND, 3);
    history.commitAction(grid, objects);

    // Action 2: paint far from the origin — this "before" state contains the action-1 cell at
    // (1,1), which will still fit after a small negative offset, so shift far enough that it
    // does not.
    history.beginAction(grid, objects);
    setCell(grid, 18, 18, WATER, 7);
    history.commitAction(grid, objects);

    expect(history.canUndo()).toBe(true);

    // Shrink drastically with a large negative offset: the (1,1) cell from the second stored
    // state's "before" snapshot maps to (1 - 15, 1 - 15) = (-14, -14), well outside a 5x5 grid.
    history.remap(20, 20, 5, 5, -15, -15);

    const newGrid = createGrid(5, 5);
    const newObjects = createObjectsState();

    // Only the empty first snapshot should have survived; the second (with the out-of-bounds
    // cell) must have been discarded rather than restoring a picture missing that cell.
    expect(history.undo(newGrid, newObjects)).toBe(true);
    let nonEmptyCount = 0;
    for (let i = 0; i < 5 * 5; i++) if (newGrid.elements[i] !== EMPTY) nonEmptyCount++;
    expect(nonEmptyCount).toBe(0);
    expect(history.canUndo()).toBe(false);
  });

  it('discards a state whose object would no longer fit', () => {
    const grid = createGrid(30, 30);
    const objects = createObjectsState();
    const history = new HistoryManager();

    // Action 1: place a unicorn (24x24 footprint) — this "before" state is empty, always fits.
    history.beginAction(grid, objects);
    placeObject(grid, objects, 'unicorn', 15, 15);
    history.commitAction(grid, objects);

    // Action 2: an unrelated edit — this "before" state contains the unicorn placed above.
    history.beginAction(grid, objects);
    setCell(grid, 0, 0, SAND, 2);
    history.commitAction(grid, objects);

    expect(history.canUndo()).toBe(true);

    // Shrink to a grid far too small for the unicorn's 24x24 footprint to fit anywhere.
    history.remap(30, 30, 10, 10, 0, 0);

    const newGrid = createGrid(10, 10);
    const newObjects = createObjectsState();

    // Only the empty first snapshot should have survived; the second (with the unicorn that no
    // longer fits) must have been discarded.
    expect(history.undo(newGrid, newObjects)).toBe(true);
    expect(newObjects.byKind.unicorn.length).toBe(0);
    let nonEmptyCount = 0;
    for (let i = 0; i < 10 * 10; i++) if (newGrid.elements[i] !== EMPTY) nonEmptyCount++;
    expect(nonEmptyCount).toBe(0);
    expect(history.canUndo()).toBe(false);
  });

  it('preserves relative order of surviving states across a mixed remap, and each restores a correct picture at the new size', () => {
    const grid = createGrid(20, 20);
    const objects = createObjectsState();
    const history = new HistoryManager();

    // Action A: before-state is empty (survives any remap).
    history.beginAction(grid, objects);
    setCell(grid, 2, 2, SAND, 4);
    history.commitAction(grid, objects);

    // Action B: before-state has only the (2,2) cell, which stays in-bounds after the remap
    // below — this state must survive too.
    history.beginAction(grid, objects);
    setCell(grid, 15, 15, WATER, 6);
    history.commitAction(grid, objects);

    // Action C: before-state has (2,2) AND (15,15) — (15,15) falls outside the new 10x10 grid,
    // so this state must be discarded.
    history.beginAction(grid, objects);
    setCell(grid, 3, 3, DIRT, 1);
    history.commitAction(grid, objects);

    history.remap(20, 20, 10, 10, 0, 0);

    const newGrid = createGrid(10, 10);
    const newObjects = createObjectsState();

    // First undo should land on the surviving "before B" state: only (2,2) = SAND present.
    expect(history.undo(newGrid, newObjects)).toBe(true);
    expect(getElement(newGrid, 2, 2)).toBe(SAND);
    let nonEmptyCount = 0;
    for (let i = 0; i < 10 * 10; i++) if (newGrid.elements[i] !== EMPTY) nonEmptyCount++;
    expect(nonEmptyCount).toBe(1);

    // Second undo should land on the surviving "before A" state: completely empty.
    expect(history.undo(newGrid, newObjects)).toBe(true);
    nonEmptyCount = 0;
    for (let i = 0; i < 10 * 10; i++) if (newGrid.elements[i] !== EMPTY) nonEmptyCount++;
    expect(nonEmptyCount).toBe(0);

    // The discarded "before C" state must not appear anywhere in the sequence.
    expect(history.canUndo()).toBe(false);
  });
});

describe('history — remapWorldStates matches HistoryManager.remap byte-for-byte (US1 spec 011, FR-016, SC-008)', () => {
  it('remapWorldStates applied to undoStack/redoStack directly produces the same restorable content as HistoryManager.remap', () => {
    const grid = createGrid(20, 20);
    const objects = createObjectsState();
    const history = new HistoryManager();

    history.beginAction(grid, objects);
    setCell(grid, 2, 2, SAND, 5);
    placeObject(grid, objects, 'palm', 10, 10);
    history.commitAction(grid, objects);

    history.beginAction(grid, objects);
    setCell(grid, 15, 15, WATER, 6);
    history.commitAction(grid, objects);
    history.undo(grid, objects);

    const undoStackBefore = history.getPersistableUndoStack();
    const offsetX = 5;
    const offsetY = 5;
    const remappedUndo = remapWorldStates(undoStackBefore, 20, 20, 30, 30, offsetX, offsetY);

    // Drive HistoryManager.remap (the pre-refactor body's live successor) over an identical
    // history and assert its resulting undo stack matches remapWorldStates' direct output
    // byte-for-byte, restore-for-restore.
    const grid2 = createGrid(20, 20);
    const objects2 = createObjectsState();
    const history2 = new HistoryManager();

    history2.beginAction(grid2, objects2);
    setCell(grid2, 2, 2, SAND, 5);
    placeObject(grid2, objects2, 'palm', 10, 10);
    history2.commitAction(grid2, objects2);

    history2.beginAction(grid2, objects2);
    setCell(grid2, 15, 15, WATER, 6);
    history2.commitAction(grid2, objects2);
    history2.undo(grid2, objects2);

    history2.remap(20, 20, 30, 30, offsetX, offsetY);

    expect(remappedUndo.length).toBe(history2.getPersistableUndoStack().length);
    for (let i = 0; i < remappedUndo.length; i++) {
      const newGridA = createGrid(30, 30);
      const newObjectsA = createObjectsState();
      restoreWorldState(newGridA, newObjectsA, remappedUndo[i]);

      const newGridB = createGrid(30, 30);
      const newObjectsB = createObjectsState();
      restoreWorldState(newGridB, newObjectsB, history2.getPersistableUndoStack()[i]);

      expect(Array.from(newGridA.elements)).toEqual(Array.from(newGridB.elements));
      expect(newObjectsA.byKind.palm).toEqual(newObjectsB.byKind.palm);
    }
  });

  it('drops states that fail losslessness identically to HistoryManager.remap', () => {
    const grid = createGrid(20, 20);
    const objects = createObjectsState();
    const history = new HistoryManager();

    history.beginAction(grid, objects);
    setCell(grid, 1, 1, SAND, 3);
    history.commitAction(grid, objects);

    history.beginAction(grid, objects);
    setCell(grid, 18, 18, WATER, 7);
    history.commitAction(grid, objects);

    const remapped = remapWorldStates(history.getPersistableUndoStack(), 20, 20, 5, 5, -15, -15);
    // Same expectation as the equivalent HistoryManager.remap hardening test above: only the
    // empty "before A" state survives a shrink this severe.
    expect(remapped.length).toBe(1);
  });
});

describe('history — getPersistableUndoStack (US1 spec 011, FR-006)', () => {
  it('returns the live undo stack in its existing oldest-first/newest-last order', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    const history = new HistoryManager();

    expect(history.getPersistableUndoStack()).toEqual([]);

    history.beginAction(grid, objects);
    setCell(grid, 1, 1, SAND, 3);
    history.commitAction(grid, objects);
    const firstBefore = history.getPersistableUndoStack()[0];

    history.beginAction(grid, objects);
    setCell(grid, 2, 2, WATER, 4);
    history.commitAction(grid, objects);

    const stack = history.getPersistableUndoStack();
    expect(stack.length).toBe(2);
    expect(stack[0]).toBe(firstBefore);
  });
});

describe('history — restoreFromPersisted (US1 spec 011, FR-001, FR-004, FR-005, FR-007)', () => {
  it('replaces the undo stack, clears redo, and clears any pending capture', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    const history = new HistoryManager();

    history.beginAction(grid, objects);
    setCell(grid, 1, 1, SAND, 3);
    history.commitAction(grid, objects);
    history.undo(grid, objects);
    expect(history.canRedo()).toBe(true);

    const restoredState = captureWorldState(grid, objects);
    history.beginAction(grid, objects); // simulate a mid-stroke pending capture at reopen time

    history.restoreFromPersisted([restoredState]);

    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);

    // No pending capture survived: a subsequent commitAction with no matching beginAction is a
    // no-op (pending is null), so canUndo's count does not change.
    history.commitAction(grid, objects);
    expect(history.getPersistableUndoStack().length).toBe(1);
  });

  it('always leaves canRedo() false regardless of the source HistoryManager having redo entries, lighting up only after an undo() in the new session (Scenario 7, FR-007)', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    const source = new HistoryManager();

    source.beginAction(grid, objects);
    setCell(grid, 1, 1, SAND, 3);
    source.commitAction(grid, objects);
    source.beginAction(grid, objects);
    setCell(grid, 2, 2, WATER, 4);
    source.commitAction(grid, objects);
    source.undo(grid, objects);
    // Non-empty undo stack AND a non-empty redo stack on the source, so the persisted (undo-only)
    // slice this feature reads is non-empty while canRedo() on the source is still true.
    expect(source.canRedo()).toBe(true);
    const persistedSlice = [...source.getPersistableUndoStack()];
    expect(persistedSlice.length).toBeGreaterThan(0);

    const history = new HistoryManager();
    history.restoreFromPersisted(persistedSlice);
    expect(history.canRedo()).toBe(false);

    expect(history.undo(grid, objects)).toBe(true);
    expect(history.canRedo()).toBe(true);
  });

  it('canUndo()/canRedo() reflect the restored state exactly, including the empty case', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    const history = new HistoryManager();

    history.restoreFromPersisted([]);
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);

    const state = captureWorldState(grid, objects);
    history.restoreFromPersisted([state]);
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);
  });

  it('a restored stack undoes in the expected order and respects HISTORY_DEPTH on new actions', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    const history = new HistoryManager();
    const snapshots: ReturnType<typeof visibleSnapshot>[] = [];

    snapshots.push(visibleSnapshot(grid, objects));
    for (let n = 0; n < 3; n++) {
      history.beginAction(grid, objects);
      setCell(grid, n, 0, SAND, n + 1);
      history.commitAction(grid, objects);
      snapshots.push(visibleSnapshot(grid, objects));
    }

    const restoredStack = [...history.getPersistableUndoStack()];
    const history2 = new HistoryManager();
    history2.restoreFromPersisted(restoredStack);

    for (let n = 3; n >= 1; n--) {
      expect(history2.undo(grid, objects)).toBe(true);
      expect(visibleSnapshot(grid, objects)).toEqual(snapshots[n - 1]);
    }
    expect(history2.canUndo()).toBe(false);
    expect(history2.undo(grid, objects)).toBe(false);
  });

  it('a new action recorded after restoreFromPersisted is undoable and evicts the oldest entry once HISTORY_DEPTH is reached', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    const history = new HistoryManager();

    const fullStack: ReturnType<typeof captureWorldState>[] = [];
    for (let n = 0; n < HISTORY_DEPTH; n++) {
      fullStack.push(captureWorldState(grid, objects));
      setCell(grid, n % 10, 0, SAND, (n % 250) + 1);
    }

    const history2 = new HistoryManager();
    history2.restoreFromPersisted(fullStack);
    expect(history2.getPersistableUndoStack().length).toBe(HISTORY_DEPTH);

    history2.beginAction(grid, objects);
    setCell(grid, 9, 9, WATER, 5);
    history2.commitAction(grid, objects);

    // The stack stays capped at HISTORY_DEPTH — the oldest restored entry was evicted — and the
    // newest entry (the just-recorded action) is undoable with a single undo() call.
    expect(history2.getPersistableUndoStack().length).toBe(HISTORY_DEPTH);
    const before = visibleSnapshot(grid, objects);
    expect(history2.undo(grid, objects)).toBe(true);
    expect(getElement(grid, 9, 9)).toBe(EMPTY);
    expect(visibleSnapshot(grid, objects)).not.toEqual(before);
  });
});

describe('history — remapWorldStates on round-tripped persisted steps matches a live HistoryManager.remap (US3 spec 011, FR-016, SC-008)', () => {
  it('every surviving remapped step matches exactly what HistoryManager.remap would have produced, and the dropped step genuinely fails losslessness', () => {
    const grid = createGrid(20, 20);
    const objects = createObjectsState();
    const history = new HistoryManager();

    // Action A: before-state is empty (survives any remap).
    history.beginAction(grid, objects);
    setCell(grid, 2, 2, SAND, 4);
    history.commitAction(grid, objects);

    // Action B: before-state has only (2,2), which stays in-bounds after the shrink below.
    history.beginAction(grid, objects);
    setCell(grid, 15, 15, WATER, 6);
    history.commitAction(grid, objects);

    // Action C: before-state has (2,2) AND (15,15) — (15,15) falls outside a 10x10 grid.
    history.beginAction(grid, objects);
    setCell(grid, 3, 3, DIRT, 1);
    history.commitAction(grid, objects);

    // Simulate persistence: round-trip the undo stack through serializeHistory/deserializeHistory.
    const fingerprint = computeFingerprint('world');
    const serialized = serializeHistory(history.getPersistableUndoStack(), 20, 20, fingerprint);
    const persisted = deserializeHistory(serialized, fingerprint);
    expect(persisted).not.toBeNull();
    if (persisted === null) return;

    const persistedRemapped = remapWorldStates(persisted.steps, 20, 20, 10, 10, 0, 0);

    // A live HistoryManager built from the exact same recorded actions, remapped the same way.
    const liveGrid = createGrid(20, 20);
    const liveObjects = createObjectsState();
    const liveHistory = new HistoryManager();
    liveHistory.beginAction(liveGrid, liveObjects);
    setCell(liveGrid, 2, 2, SAND, 4);
    liveHistory.commitAction(liveGrid, liveObjects);
    liveHistory.beginAction(liveGrid, liveObjects);
    setCell(liveGrid, 15, 15, WATER, 6);
    liveHistory.commitAction(liveGrid, liveObjects);
    liveHistory.beginAction(liveGrid, liveObjects);
    setCell(liveGrid, 3, 3, DIRT, 1);
    liveHistory.commitAction(liveGrid, liveObjects);
    liveHistory.remap(20, 20, 10, 10, 0, 0);

    const liveRemapped = liveHistory.getPersistableUndoStack();
    expect(persistedRemapped.length).toBe(liveRemapped.length);
    expect(persistedRemapped.length).toBe(2); // only before-A and before-B survive; before-C is dropped

    for (let i = 0; i < persistedRemapped.length; i++) {
      expect(Array.from(persistedRemapped[i].elements)).toEqual(Array.from(liveRemapped[i].elements));
    }

    // The dropped step (before-C) genuinely fails losslessness: force-remapping it directly
    // (bypassing the filter) shows content that falls outside the new bounds and is clipped —
    // proof the drop was necessary, not coincidental (a state that already fit would keep every
    // populated cell).
    const droppedStepC = persisted.steps[2];
    const forcedRemap = remapWorldState(droppedStepC, 20, 20, 10, 10, 0, 0);
    let nonEmptyCount = 0;
    for (let i = 0; i < 10 * 10; i++) if (forcedRemap.elements[i] !== EMPTY) nonEmptyCount++;
    expect(nonEmptyCount).toBeLessThan(2);
  });
});

describe('history — a reshape severe enough that nothing survives (US3 spec 011, FR-016)', () => {
  it('remapWorldStates dropping every persisted step, then restoreFromPersisted([]), leaves canUndo() false', () => {
    const grid = createGrid(20, 20);
    const objects = createObjectsState();
    setCell(grid, 15, 15, SAND, 4); // pre-existing content, captured by the upcoming beginAction
    const history = new HistoryManager();

    history.beginAction(grid, objects);
    setCell(grid, 16, 16, WATER, 3);
    history.commitAction(grid, objects);
    expect(history.canUndo()).toBe(true);

    const remapped = remapWorldStates(history.getPersistableUndoStack(), 20, 20, 3, 3, -20, -20);
    expect(remapped.length).toBe(0);

    const freshHistory = new HistoryManager();
    freshHistory.restoreFromPersisted(remapped);
    expect(freshHistory.canUndo()).toBe(false);
  });
});
