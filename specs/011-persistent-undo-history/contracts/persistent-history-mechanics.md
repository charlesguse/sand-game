# Contract: Persistent history mechanics (extends prior specs' `src/sim/*`/`src/lib/*` contracts)

This project has no network API. As in `specs/010-undo-redo/contracts/
undo-redo-mechanics.md` (which itself extends 001–009's), the interface
contract that matters is the boundary between the framework-free
simulation core (`src/sim/*`), the Svelte shell that calls it, and the
`vitest` unit tests that exercise `src/sim/*` functions directly with no
DOM (constitution Principle V, FR-025). This document is purely
additive — every function in every prior contract not mentioned here is
**completely unchanged**, including every signature in `src/sim/save.ts`
(`SavedWorld`, `WireWorld`, `serializeWorld`, `deserializeWorld`,
`encodeBase64`, `decodeBase64`, `resyncNextId`) and every existing
`HistoryManager` method (`beginAction`, `commitAction`, `undo`, `redo`,
`canUndo`, `canRedo`, `reset`). This feature's new simulation-facing
surface is one new file, `src/sim/historySave.ts`, plus two additive
methods and one additive exported function on `src/sim/history.ts`.

## `src/sim/historySave.ts` (new)

```ts
import type { WorldState } from './history';

/** Bumped whenever this wire format's shape changes; deserializeHistory rejects any other value. Independent of save.ts's SAVE_VERSION. */
export const HISTORY_SAVE_VERSION = 1;

/** ~2 MB of serialized JSON characters (a conservative proxy for bytes — research.md §3). Decides how many undo steps survive a close; never the in-memory HISTORY_DEPTH cap. */
export const HISTORY_BYTE_BUDGET = 2 * 1024 * 1024;

/** Cheap, deterministic, synchronous hash (32-bit FNV-1a, hex-encoded) of a raw serialized-world JSON string, used to pair a history payload to the exact world save it was written beside (FR-017, research.md §2). Never throws. */
export function computeFingerprint(raw: string): string;

/**
 * Fills steps newest-first against HISTORY_BYTE_BUDGET, preserving relative order in the
 * output (FR-008/FR-009). steps is HistoryManager's own undo-stack order (oldest-first,
 * newest-last) — the same order getPersistableUndoStack() returns. Returns '' if even the
 * single newest step does not fit (FR-010), exactly serializeWorld's own failure-sentinel
 * convention. Never throws.
 */
export function serializeHistory(
  steps: readonly WorldState[],
  width: number,
  height: number,
  worldFingerprint: string,
): string;

export interface PersistedHistory {
  readonly width: number;
  readonly height: number;
  readonly steps: WorldState[]; // oldest-kept-first, newest-last; length <= HISTORY_DEPTH
}

/**
 * Parses and validates a persisted-history JSON string. Returns null on ANY invalid input —
 * wrong version, truncated data, corrupt base64, mismatched per-step array lengths,
 * hand-edited garbage, or a worldFingerprint that does not equal expectedFingerprint
 * (FR-017, FR-018) — and never throws. Defensively caps the returned steps array at
 * HISTORY_DEPTH even if a hand-edited payload's steps array is longer.
 */
export function deserializeHistory(raw: string, expectedFingerprint: string): PersistedHistory | null;

/** Structural subset of the DOM Storage interface — localStorage satisfies this with no adapter. Exists so the two functions below are unit-testable with a plain in-memory fake and no DOM (FR-025, research.md §4). */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * The existing debounced during-play save's storage-side effect. If worldJson === '' (the
 * serializeWorld failure sentinel), does nothing at all. Otherwise writes worldJson to
 * saveKey (returning early, touching nothing else, if that throws), then unconditionally
 * removes historyKey (FR-013a) — cheap discard, never serializes, never called with a
 * historyJson argument because ordinary saves never produce one.
 */
export function writeOrdinarySave(
  store: KeyValueStore,
  saveKey: string,
  historyKey: string,
  worldJson: string,
): void;

/**
 * The going-away flush's storage-side effect (FR-013). Same worldJson === ''/throws
 * short-circuit as writeOrdinarySave (leaving history untouched — nothing valid to pair it
 * against). Once the world write succeeds, writes historyJson to historyKey if non-empty, or
 * removes historyKey if historyJson === '' (the serializeHistory "nothing fit" sentinel) —
 * each step independently guarded so a history-write failure can never prevent the world
 * write or leave a stale history behind (FR-012, FR-019).
 */
export function writeFlushSave(
  store: KeyValueStore,
  saveKey: string,
  historyKey: string,
  worldJson: string,
  historyJson: string,
): void;
```

**Contract**:
- `computeFingerprint`/`serializeHistory`/`deserializeHistory` are pure
  functions of their inputs — no `localStorage`, no timers, no module-level
  mutable state, no DOM. `historySave.test.ts` exercises all three with
  plain strings and `WorldState` values only, exactly matching
  `save.test.ts`'s existing style for `serializeWorld`/`deserializeWorld`.
- `writeOrdinarySave`/`writeFlushSave` touch only the `KeyValueStore`
  passed in — no reference to the global `localStorage` anywhere in
  `historySave.ts` itself. `PlayArea.svelte` is the only caller that ever
  passes the real `localStorage`.
- `serializeHistory`/`deserializeHistory` never throw under any input,
  mirroring `serializeWorld`/`deserializeWorld`'s existing contract
  exactly — a corrupt or oversized input degrades to `''`/`null`, never an
  exception reaching a caller.
- `HISTORY_SAVE_VERSION` is independent of `save.ts`'s `SAVE_VERSION` — a
  future change to one format's shape never forces a version bump in the
  other.

## `src/sim/history.ts` (extended)

```ts
export class HistoryManager {
  // ... beginAction, commitAction, undo, redo, canUndo, canRedo, reset — all unchanged ...

  /** Live undo stack (oldest-first, newest-last), not cloned — read-only by convention, the one field this feature exposes for flushSave to read (research.md §8). */
  getPersistableUndoStack(): readonly WorldState[];

  /** Replaces the undo stack with states (already validated, already re-anchored if needed by the caller); clears the redo stack and any pending capture. The reopen-restore counterpart to reset() — called by tryRestore in place of today's unconditional reset() call. */
  restoreFromPersisted(states: WorldState[]): void;
}

/**
 * Re-anchors each of states to new dimensions via remapWorldState, keeping only those that
 * remap losslessly (wouldRemapLosslessly), preserving relative order — factored out of
 * HistoryManager.remap's own body (research.md §6) so the live-re-derivation path and the
 * reopen-restore path share one implementation and can never drift apart.
 */
export function remapWorldStates(
  states: readonly WorldState[],
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number,
  offsetX: number,
  offsetY: number,
): WorldState[];
```

**Contract**:
- `HistoryManager.remap`'s own observable behavior is byte-for-byte
  unchanged by the refactor — it now calls `remapWorldStates` internally
  for `undoStack` and `redoStack` in turn, but every existing
  `history.test.ts` assertion about `remap` continues to pass unmodified.
- `remapWorldStates` is pure with respect to its inputs (no mutation of
  `states` or its elements) — same purity guarantee `remapWorldState`
  itself already has.
- `getPersistableUndoStack`/`restoreFromPersisted` never touch `pending`
  except that `restoreFromPersisted` always sets it to `null` — an
  in-progress stroke's capture is never part of what gets persisted or
  restored (matching the "closing mid-stroke" edge case).
- Every existing `HistoryManager` method's signature and behavior
  (`beginAction`, `commitAction`, `undo`, `redo`, `canUndo`, `canRedo`,
  `reset`, `captureWorldState`, `restoreWorldState`, `worldStateFits`,
  `HISTORY_DEPTH`) is completely unchanged — this feature's diff to
  `history.ts` is strictly additive.

## `src/lib/PlayArea.svelte` (extended)

**Contract**:
- Imports `computeFingerprint`, `serializeHistory`, `deserializeHistory`,
  `writeOrdinarySave`, `writeFlushSave` from `../sim/historySave`, and
  `remapWorldStates` from `../sim/history` (alongside the existing
  `remapWorldState` import).
- Gains one new constant: `const HISTORY_KEY = 'rainbow-sand-history-v1';`
  (sibling to the existing `SAVE_KEY`).
- `saveNow()`'s existing body is replaced by a call to `writeOrdinarySave`
  with `localStorage`, `SAVE_KEY`, `HISTORY_KEY`, and the same
  `serializeWorld(grid, objectsState, petsState)` call it already makes —
  the try/catch and "keep whatever save exists on failure" behavior moves
  into `writeOrdinarySave` itself (contract above), so `saveNow`'s own
  observable behavior toward the world save is unchanged; it additionally
  now invalidates any stored history (FR-013a).
- Gains one new function, `flushSave()`, called wherever `saveNow` is
  called today from the two going-away moments
  (`handleVisibilityHidden`'s `document.visibilityState === 'hidden'`
  branch, and the `pagehide` listener) — `saveNow` itself is no longer
  called from either listener. `flushSave` serializes the world once,
  computes its fingerprint if serialization succeeded, serializes the
  history from `history.getPersistableUndoStack()` against that
  fingerprint and the live grid's dimensions, and calls `writeFlushSave`
  with `localStorage`, both keys, and both serialized strings (empty
  string for `historyJson` if serialization produced nothing or the world
  serialization itself failed).
- `scheduleSave()`'s debounce timer continues to call `saveNow` exactly as
  today — the during-play save path never writes history (FR-013).
- `tryRestore()`'s existing world-restore logic (reading `SAVE_KEY`,
  `deserializeWorld`, the `offsetX`/`offsetY` computation, `remapWorldState`
  for the world itself, `restoreWorldState`, `resyncNextId`, pet
  restoration) is **entirely unchanged** up through the point it currently
  calls `history.reset()`. That one call is replaced by the five-outcome
  branch data-model.md's "Reopen restore" table describes: read
  `HISTORY_KEY`, fingerprint the raw world string already in hand,
  `deserializeHistory`, check `persisted.width`/`persisted.height` against
  `saved.width`/`saved.height`, remap via `remapWorldStates` using the
  same `offsetX`/`offsetY` already computed for the world's own remap if
  the live grid's dimensions differ from `saved`'s, then call
  `history.restoreFromPersisted(steps)` — or `history.reset()` on any
  failure along the way. The existing single
  `onHistoryChange?.(history.canUndo(), history.canRedo())` call at the
  end of `tryRestore` is unchanged in position and shape, now reflecting
  whichever branch ran.
- No other function (`resize`, `handlePointerDown`, `handlePointerUp`,
  `frame`, `render`, `clearAll`, `loadScene`, `undo`, `redo`, or any
  render-path helper) is touched at all — none of them call
  `historySave.ts` or `HISTORY_KEY` directly.

## Consumers

- `PlayArea.svelte` is the only runtime caller of every `historySave.ts`
  function and of `HistoryManager.getPersistableUndoStack`/
  `restoreFromPersisted`/`history.ts`'s exported `remapWorldStates`.
- `tests/unit/sim/historySave.test.ts` (new) imports
  `captureWorldState`/`WorldState`/`HistoryManager`/`remapWorldStates`
  from `history.ts`, `createGrid`/`setCell`/element constants from
  `grid.ts`/`types.ts`, `createObjectsState`/`placeObject` from
  `objects.ts`, and every export listed under `historySave.ts` above — no
  DOM — and asserts the codec/budget/rejection/storage-orchestration
  contract directly against plain strings, `WorldState` values, and an
  in-memory fake `KeyValueStore` (FR-025).
- `tests/unit/sim/history.test.ts` gains new, additive `describe` blocks
  for `getPersistableUndoStack`/`restoreFromPersisted`/`remapWorldStates`
  — every existing block in that file is unmodified.
- No other existing test file (`save.test.ts`, `grid.test.ts`,
  `step.test.ts`, `brush.test.ts`, `wand.test.ts`, `objects.test.ts`,
  `resize.test.ts`, `scenes.test.ts`, `grass.test.ts`, `starPower.test.ts`,
  `weather.test.ts`, `pets.test.ts`, `flamingo.test.ts`, `palm.test.ts`,
  `flower.test.ts`, `gumdrop.test.ts`, `cellFields.test.ts`,
  `tests/unit/lib/*.test.ts`) needs any change — this feature touches no
  code any of them exercise (FR-023).
