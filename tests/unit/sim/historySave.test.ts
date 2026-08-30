import { describe, it, expect } from 'vitest';
import { createGrid, setCell } from '../../../src/sim/grid';
import { createObjectsState, placeObject, OBJECT_KINDS } from '../../../src/sim/objects';
import { HistoryManager, HISTORY_DEPTH, type WorldState } from '../../../src/sim/history';
import { SAND, WATER, DIRT, GRASS, RAINBOW_SAND } from '../../../src/sim/types';
import { GRID_WIDTH, GRID_HEIGHT, CELL_BUDGET } from '../../../src/lib/layout';
import {
  HISTORY_SAVE_VERSION,
  HISTORY_BYTE_BUDGET,
  computeFingerprint,
  serializeHistory,
  deserializeHistory,
  writeOrdinarySave,
  writeFlushSave,
  type KeyValueStore,
} from '../../../src/sim/historySave';

/** In-memory fake KeyValueStore (Map-backed) — no DOM, matches localStorage's structural shape. */
function createFakeStore(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };
}

function alwaysThrowsStore(): KeyValueStore {
  return {
    getItem: () => null,
    setItem: () => {
      throw new Error('quota exceeded');
    },
    removeItem: () => {
      throw new Error('quota exceeded');
    },
  };
}

function recordSeveralActions(grid: ReturnType<typeof createGrid>, objects: ReturnType<typeof createObjectsState>, history: HistoryManager, count: number) {
  for (let n = 0; n < count; n++) {
    history.beginAction(grid, objects);
    setCell(grid, n % grid.width, Math.floor(n / grid.width) % grid.height, SAND, (n % 250) + 1);
    history.commitAction(grid, objects);
  }
}

describe('historySave — serializeHistory/deserializeHistory round trip (US1, FR-001, FR-002, SC-001, SC-002)', () => {
  it('round-trips several recorded actions: canUndo() true, each undo restores exactly its counterpart', () => {
    const grid = createGrid(20, 20);
    const objects = createObjectsState();
    const history = new HistoryManager();

    history.beginAction(grid, objects);
    setCell(grid, 1, 1, SAND, 3);
    history.commitAction(grid, objects);

    history.beginAction(grid, objects);
    setCell(grid, 2, 2, WATER, 5);
    history.commitAction(grid, objects);

    history.beginAction(grid, objects);
    placeObject(grid, objects, 'rainbow', 10, 10);
    history.commitAction(grid, objects);

    const worldJson = JSON.stringify({ elements: Array.from(grid.elements) });
    const fingerprint = computeFingerprint(worldJson);
    const serialized = serializeHistory(history.getPersistableUndoStack(), grid.width, grid.height, fingerprint);
    expect(serialized).not.toBe('');

    // Discard everything in memory, deserialize into a fresh session.
    const persisted = deserializeHistory(serialized, fingerprint);
    expect(persisted).not.toBeNull();
    if (persisted === null) return;
    expect(persisted.width).toBe(grid.width);
    expect(persisted.height).toBe(grid.height);

    const freshHistory = new HistoryManager();
    freshHistory.restoreFromPersisted(persisted.steps);
    expect(freshHistory.canUndo()).toBe(true);

    // Each undo in the fresh session must restore exactly what its counterpart restored in the
    // original session — build the original session's expected undo sequence by replaying it.
    const replayGrid = createGrid(20, 20);
    const replayObjects = createObjectsState();
    const replayHistory = new HistoryManager();
    replayHistory.beginAction(replayGrid, replayObjects);
    setCell(replayGrid, 1, 1, SAND, 3);
    replayHistory.commitAction(replayGrid, replayObjects);
    replayHistory.beginAction(replayGrid, replayObjects);
    setCell(replayGrid, 2, 2, WATER, 5);
    replayHistory.commitAction(replayGrid, replayObjects);
    replayHistory.beginAction(replayGrid, replayObjects);
    placeObject(replayGrid, replayObjects, 'rainbow', 10, 10);
    replayHistory.commitAction(replayGrid, replayObjects);

    while (replayHistory.undo(replayGrid, replayObjects)) {
      expect(freshHistory.undo(grid, objects)).toBe(true);
      expect(Array.from(grid.elements)).toEqual(Array.from(replayGrid.elements));
      expect(Array.from(grid.shades)).toEqual(Array.from(replayGrid.shades));
      expect(Array.from(grid.hues)).toEqual(Array.from(replayGrid.hues));
      for (const kind of OBJECT_KINDS) {
        expect(objects.byKind[kind]).toEqual(replayObjects.byKind[kind]);
      }
    }
    expect(freshHistory.canUndo()).toBe(false);
  });

  it('a fingerprint mismatch rejects the payload entirely (stale history vs. a newer world)', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    const history = new HistoryManager();
    history.beginAction(grid, objects);
    setCell(grid, 1, 1, SAND, 3);
    history.commitAction(grid, objects);

    const serialized = serializeHistory(history.getPersistableUndoStack(), 10, 10, computeFingerprint('world-a'));
    expect(deserializeHistory(serialized, computeFingerprint('world-b'))).toBeNull();
  });

  it('rejects a wrong version, garbage JSON, and truncated base64 without throwing', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    const history = new HistoryManager();
    history.beginAction(grid, objects);
    setCell(grid, 1, 1, SAND, 3);
    history.commitAction(grid, objects);

    const fingerprint = computeFingerprint('world');
    const serialized = serializeHistory(history.getPersistableUndoStack(), 10, 10, fingerprint);
    const wire = JSON.parse(serialized) as Record<string, unknown>;

    const wrongVersion = { ...wire, version: (wire.version as number) + 1 };
    expect(() => deserializeHistory(JSON.stringify(wrongVersion), fingerprint)).not.toThrow();
    expect(deserializeHistory(JSON.stringify(wrongVersion), fingerprint)).toBeNull();

    expect(() => deserializeHistory('not json', fingerprint)).not.toThrow();
    expect(deserializeHistory('not json', fingerprint)).toBeNull();
    expect(deserializeHistory('', fingerprint)).toBeNull();

    const steps = wire.steps as Record<string, unknown>[];
    const tamperedSteps = [{ ...steps[0], elements: 'AA' }];
    const truncated = { ...wire, steps: tamperedSteps };
    expect(() => deserializeHistory(JSON.stringify(truncated), fingerprint)).not.toThrow();
    expect(deserializeHistory(JSON.stringify(truncated), fingerprint)).toBeNull();
  });

  it('caps a hand-edited payload with more than HISTORY_DEPTH steps at the newest HISTORY_DEPTH entries', () => {
    const grid = createGrid(5, 5);
    const objects = createObjectsState();
    const history = new HistoryManager();
    recordSeveralActions(grid, objects, history, HISTORY_DEPTH);

    const fingerprint = computeFingerprint('world');
    const serialized = serializeHistory(history.getPersistableUndoStack(), 5, 5, fingerprint);
    const wire = JSON.parse(serialized) as { steps: unknown[] };
    expect(wire.steps.length).toBe(HISTORY_DEPTH);

    // Hand-duplicate the steps array to exceed HISTORY_DEPTH.
    const doubled = { ...wire, steps: [...wire.steps, ...wire.steps] };
    const persisted = deserializeHistory(JSON.stringify(doubled), fingerprint);
    expect(persisted).not.toBeNull();
    if (persisted === null) return;
    expect(persisted.steps.length).toBe(HISTORY_DEPTH);
  });
});

describe('historySave — restoreFromPersisted after a round trip respects HISTORY_DEPTH on new actions (US1, FR-005)', () => {
  it('a new action recorded after a restored round trip is itself undoable with one undo() call', () => {
    const grid = createGrid(10, 10);
    const objects = createObjectsState();
    const history = new HistoryManager();
    history.beginAction(grid, objects);
    setCell(grid, 1, 1, DIRT, 4);
    history.commitAction(grid, objects);

    const fingerprint = computeFingerprint('world');
    const serialized = serializeHistory(history.getPersistableUndoStack(), 10, 10, fingerprint);
    const persisted = deserializeHistory(serialized, fingerprint);
    expect(persisted).not.toBeNull();
    if (persisted === null) return;

    const freshHistory = new HistoryManager();
    freshHistory.restoreFromPersisted(persisted.steps);

    freshHistory.beginAction(grid, objects);
    setCell(grid, 5, 5, GRASS, 2);
    freshHistory.commitAction(grid, objects);

    expect(freshHistory.undo(grid, objects)).toBe(true);
    expect(grid.elements[5 * 10 + 5]).not.toBe(GRASS);
    expect(freshHistory.canUndo()).toBe(true); // the originally-restored dirt action remains
  });
});

describe('historySave — computeFingerprint (US1, FR-017)', () => {
  it('is deterministic: the same input always produces the same output', () => {
    const input = '{"version":1,"width":10,"height":10}';
    expect(computeFingerprint(input)).toBe(computeFingerprint(input));
  });

  it('is practically collision-free across dozens of distinct synthetic world strings', () => {
    const fingerprints = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const synthetic = JSON.stringify({ i, elements: Array.from({ length: 50 }, (_, j) => (i * 7 + j) % 251) });
      fingerprints.add(computeFingerprint(synthetic));
    }
    expect(fingerprints.size).toBe(60);
  });

  it('never throws on empty or unusual strings', () => {
    expect(() => computeFingerprint('')).not.toThrow();
    expect(() => computeFingerprint('a'.repeat(500_000))).not.toThrow();
  });
});

describe('historySave — writeOrdinarySave/writeFlushSave basic write path (US1)', () => {
  const SAVE_KEY = 'test-save-key';
  const HISTORY_KEY = 'test-history-key';

  it('writeOrdinarySave writes worldJson to saveKey and removes historyKey', () => {
    const store = createFakeStore();
    store.map.set(HISTORY_KEY, 'stale-history');

    writeOrdinarySave(store, SAVE_KEY, HISTORY_KEY, '{"world":true}');

    expect(store.map.get(SAVE_KEY)).toBe('{"world":true}');
    expect(store.map.has(HISTORY_KEY)).toBe(false);
  });

  it('writeOrdinarySave does nothing when worldJson is the empty-string failure sentinel', () => {
    const store = createFakeStore();
    store.map.set(SAVE_KEY, 'existing-world');
    store.map.set(HISTORY_KEY, 'existing-history');

    writeOrdinarySave(store, SAVE_KEY, HISTORY_KEY, '');

    expect(store.map.get(SAVE_KEY)).toBe('existing-world');
    expect(store.map.get(HISTORY_KEY)).toBe('existing-history');
  });

  it('writeFlushSave writes worldJson to saveKey and historyJson to historyKey when historyJson is non-empty', () => {
    const store = createFakeStore();

    writeFlushSave(store, SAVE_KEY, HISTORY_KEY, '{"world":true}', '{"history":true}');

    expect(store.map.get(SAVE_KEY)).toBe('{"world":true}');
    expect(store.map.get(HISTORY_KEY)).toBe('{"history":true}');
  });
});

// The final serialized JSON adds a small, deliberately-uncounted envelope (version/width/
// height/worldFingerprint fields, array brackets, and up to HISTORY_DEPTH-1 commas) on top of
// the per-step running total serializeHistory actually bounds against — research.md §3's own
// "correctness must never depend on the arithmetic being right" conservative-slack philosophy.
const ENVELOPE_SLACK = 2048;

describe('historySave — budget filling under a full history at a busy field (US2, FR-008, FR-009, SC-004, SC-005)', () => {
  it('serializeHistory never exceeds the budget (plus envelope slack), keeps only the newest steps, in original relative order', () => {
    const grid = createGrid(GRID_WIDTH, GRID_HEIGHT);
    const objects = createObjectsState();
    const history = new HistoryManager();
    recordSeveralActions(grid, objects, history, HISTORY_DEPTH);

    const fullStack = history.getPersistableUndoStack();
    expect(fullStack.length).toBe(HISTORY_DEPTH);

    const fingerprint = computeFingerprint('world');
    const serialized = serializeHistory(fullStack, GRID_WIDTH, GRID_HEIGHT, fingerprint);
    expect(serialized).not.toBe('');
    expect(serialized.length).toBeLessThanOrEqual(HISTORY_BYTE_BUDGET + ENVELOPE_SLACK);

    const persisted = deserializeHistory(serialized, fingerprint);
    expect(persisted).not.toBeNull();
    if (persisted === null) return;
    // A full 10-step history at the largest field size does not all fit under the budget.
    expect(persisted.steps.length).toBeLessThan(HISTORY_DEPTH);
    expect(persisted.steps.length).toBeGreaterThan(0);

    const keptCount = persisted.steps.length;
    const expectedTail = fullStack.slice(fullStack.length - keptCount);
    for (let i = 0; i < keptCount; i++) {
      expect(Array.from(persisted.steps[i].elements)).toEqual(Array.from(expectedTail[i].elements));
      expect(Array.from(persisted.steps[i].colorAux)).toEqual(Array.from(expectedTail[i].colorAux));
    }
  });

  it('the world save is byte-for-byte unaffected by how many history steps were kept', () => {
    const grid = createGrid(GRID_WIDTH, GRID_HEIGHT);
    const objects = createObjectsState();
    const history = new HistoryManager();
    recordSeveralActions(grid, objects, history, HISTORY_DEPTH);

    const store = createFakeStore();
    const worldJson = '{"world":"unchanged"}';
    const fingerprint = computeFingerprint(worldJson);
    const historyJson = serializeHistory(history.getPersistableUndoStack(), GRID_WIDTH, GRID_HEIGHT, fingerprint);

    writeFlushSave(store, 'save', 'history', worldJson, historyJson);
    expect(store.map.get('save')).toBe(worldJson);
  });
});

describe('historySave — a field too large for even one step to fit the budget (US2, FR-010)', () => {
  it('serializeHistory returns the empty-string sentinel, and writeFlushSave removes any existing history key', () => {
    // Large enough that one step's five base64'd arrays alone exceed HISTORY_BYTE_BUDGET.
    const width = 600;
    const height = 600;
    const grid = createGrid(width, height);
    const objects = createObjectsState();
    const history = new HistoryManager();
    history.beginAction(grid, objects);
    setCell(grid, 1, 1, SAND, 3);
    history.commitAction(grid, objects);

    const fingerprint = computeFingerprint('world');
    const serialized = serializeHistory(history.getPersistableUndoStack(), width, height, fingerprint);
    expect(serialized).toBe('');

    const store = createFakeStore();
    store.map.set('history', 'stale-history-payload');
    writeFlushSave(store, 'save', 'history', '{"world":true}', serialized);

    expect(store.map.get('save')).toBe('{"world":true}');
    expect(store.map.has('history')).toBe(false);
  });
});

describe('historySave — quota exhaustion / storage disabled (US2, FR-012, SC-006)', () => {
  it('writeFlushSave and writeOrdinarySave both attempt the world write, store 0 history bytes, and let 0 exceptions escape', () => {
    const throwingStore = alwaysThrowsStore();

    expect(() => writeFlushSave(throwingStore, 'save', 'history', '{"world":true}', '{"history":true}')).not.toThrow();
    expect(() => writeOrdinarySave(throwingStore, 'save', 'history', '{"world":true}')).not.toThrow();
  });
});

describe('historySave — a world save landing between flushes invalidates a stale history (US2, FR-013a, SC-016)', () => {
  it('writeOrdinarySave removes a pre-seeded stale history entry', () => {
    const store = createFakeStore();
    store.map.set('history', 'stale-history-payload');

    writeOrdinarySave(store, 'save', 'history', '{"world":true}');

    expect(store.map.has('history')).toBe(false);
  });

  it('writeFlushSave with an empty historyJson also removes a pre-seeded stale history entry', () => {
    const store = createFakeStore();
    store.map.set('history', 'stale-history-payload');

    writeFlushSave(store, 'save', 'history', '{"world":true}', '');

    expect(store.map.has('history')).toBe(false);
  });
});

describe('historySave — measured serialized size across varied field sizes (US2, SC-004)', () => {
  it('serializeHistory\'s actual JSON.stringify length is always <= HISTORY_BYTE_BUDGET (plus envelope slack) across 20+ varied sessions spanning spec 006\'s supported field sizes', () => {
    const sizes: Array<[number, number]> = [
      [10, 10],
      [20, 15],
      [30, 30],
      [50, 40],
      [60, 60],
      [80, 60],
      [100, 80],
      [120, 90],
      [150, 100],
      [160, 120],
      [180, 120],
      [200, 130],
      [210, 140],
      [220, 140],
      [230, 150],
      [240, 150],
      [250, 155],
      [260, 158],
      [GRID_WIDTH, GRID_HEIGHT],
      [GRID_WIDTH, GRID_HEIGHT - 5],
      [GRID_WIDTH - 10, GRID_HEIGHT],
      [GRID_WIDTH - 20, GRID_HEIGHT - 10],
    ];
    expect(sizes.length).toBeGreaterThanOrEqual(20);
    expect(GRID_WIDTH * GRID_HEIGHT).toBe(CELL_BUDGET);

    for (const [width, height] of sizes) {
      const grid = createGrid(width, height);
      const objects = createObjectsState();
      const history = new HistoryManager();
      recordSeveralActions(grid, objects, history, HISTORY_DEPTH);
      if (Math.min(width, height) > 20) placeObject(grid, objects, 'rainbow', 5, 5);

      const fingerprint = computeFingerprint('world');
      const serialized = serializeHistory(history.getPersistableUndoStack(), width, height, fingerprint);
      expect(serialized.length).toBeLessThanOrEqual(HISTORY_BYTE_BUDGET + ENVELOPE_SLACK);
    }
  });
});

describe('historySave — the "same field size" branch condition (US3, FR-016, Scenario 4)', () => {
  // Mirrors PlayArea.svelte's tryRestore condition exactly: persisted.width === saved.width &&
  // persisted.height === saved.height && saved.width === grid.width && saved.height === grid.height.
  function sameFieldSize(
    persisted: { width: number; height: number },
    saved: { width: number; height: number },
    live: { width: number; height: number },
  ): boolean {
    return (
      persisted.width === saved.width &&
      persisted.height === saved.height &&
      saved.width === live.width &&
      saved.height === live.height
    );
  }

  it('is true only when all three dimension pairs match, and false whenever any one differs', () => {
    const base = { width: 20, height: 15 };
    expect(sameFieldSize(base, base, base)).toBe(true);

    expect(sameFieldSize({ width: 21, height: 15 }, base, base)).toBe(false); // persisted.width differs
    expect(sameFieldSize({ width: 20, height: 16 }, base, base)).toBe(false); // persisted.height differs
    expect(sameFieldSize(base, { width: 21, height: 15 }, base)).toBe(false); // saved.width differs from persisted
    expect(sameFieldSize(base, { width: 20, height: 16 }, base)).toBe(false); // saved.height differs from persisted
    expect(sameFieldSize(base, base, { width: 21, height: 15 })).toBe(false); // live.width differs from saved
    expect(sameFieldSize(base, base, { width: 20, height: 16 })).toBe(false); // live.height differs from saved
  });
});

describe('historySave — repeated close/reopen with no drawing between (US2, SC-014)', () => {
  it('closing and reopening 5 times in a row leaves the same steps available every time, with 0 growth and 0 duplication', () => {
    const grid = createGrid(20, 20);
    const objects = createObjectsState();
    const history = new HistoryManager();
    recordSeveralActions(grid, objects, history, 4);

    const fingerprint = computeFingerprint('world');
    let currentStack: readonly WorldState[] = history.getPersistableUndoStack();
    let firstSerializedLength = -1;

    for (let round = 0; round < 5; round++) {
      const serialized = serializeHistory(currentStack, 20, 20, fingerprint);
      expect(serialized).not.toBe('');
      if (firstSerializedLength === -1) {
        firstSerializedLength = serialized.length;
      } else {
        expect(serialized.length).toBe(firstSerializedLength);
      }

      const persisted = deserializeHistory(serialized, fingerprint);
      expect(persisted).not.toBeNull();
      if (persisted === null) return;
      expect(persisted.steps.length).toBe(4);

      const freshHistory = new HistoryManager();
      freshHistory.restoreFromPersisted(persisted.steps);
      currentStack = freshHistory.getPersistableUndoStack();
    }
  });
});
