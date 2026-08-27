# Contract: Undo/redo mechanics (extends prior specs' `src/sim/*`/`src/lib/*` contracts)

This project has no network API. As in `specs/009-star-powered-weather/
contracts/weather-mechanics.md` (which itself extends 001–008's), the
interface contract that matters is the boundary between the framework-free
simulation core (`src/sim/*`), the UI-layer helpers (`src/lib/*`), the
Svelte shell that calls both, and the `vitest` unit tests that exercise
`src/sim/*` functions directly with no DOM (constitution Principle V,
FR-033). This document is purely additive — every function in every prior
contract not mentioned here is **completely unchanged**, including every
signature in `src/sim/types.ts`, `element.ts`, `shade.ts`, `grid.ts`,
`step.ts`, `brush.ts`, `wand.ts`, `objects.ts`, `scenes.ts`, and
`resize.ts`. This feature's entire simulation-facing surface is one new
file, `src/sim/history.ts`.

## `src/sim/history.ts` (new)

```ts
import type { Grid, ObjectsState, PlacedObject } from './types';

export const HISTORY_DEPTH = 10; // FR-019/FR-020

export interface WorldState {
  readonly elements: Uint8Array;
  readonly colorAux: Uint8Array;   // shades[i], except hues[i] for RAINBOW_SAND cells
  readonly cloud: Uint8Array;      // 0/1, meaningful only for FOG cells
  readonly glitter: Uint8Array;
  readonly grassHeight: Uint8Array;
  readonly rainbows: PlacedObject[];
  readonly unicorns: PlacedObject[];
}

/** Snapshots every visible property of grid/objects (FR-028). Allocates five typed arrays plus two small object-list clones. O(width * height). */
export function captureWorldState(grid: Grid, objects: ObjectsState): WorldState;

/** Writes state back into grid/objects in place; resets every excluded internal timer (grassCooldown, star-power age/life/fuelled, fog/cloud timers) to its own "freshly created" value (research.md §4); recomputes grassCount/fogCloudCount; leaves grid.moved and objects.nextId untouched. O(width * height). */
export function restoreWorldState(grid: Grid, objects: ObjectsState, state: WorldState): void;

/** Owns the bounded undo/redo stacks and the begin/commit/undo/redo/reset operations (research.md §3, §5). */
export class HistoryManager {
  /** Captures grid/objects' current state as the pending "before" snapshot for an action about to start (FR-008). */
  beginAction(grid: Grid, objects: ObjectsState): void;

  /** Compares the live grid/objects against the pending snapshot; discards it with no history change if identical (FR-007); otherwise pushes it onto the undo stack (evicting the oldest past HISTORY_DEPTH, FR-019) and clears the redo stack (FR-017). No-op if no action is pending. */
  commitAction(grid: Grid, objects: ObjectsState): void;

  /** Pops the most recent undo entry (false, no-op, if none — FR-013); captures the current state onto the redo stack (FR-015); restores the popped state; returns true. */
  undo(grid: Grid, objects: ObjectsState): boolean;

  /** Pops the most recent redo entry (false, no-op, if none — FR-016); captures the current state onto the undo stack; restores the popped state; returns true. */
  redo(grid: Grid, objects: ObjectsState): boolean;

  canUndo(): boolean;
  canRedo(): boolean;

  /** Clears both stacks and any pending capture (FR-022). */
  reset(): void;
}
```

**Contract**:
- `captureWorldState`/`restoreWorldState` are pure with respect to their
  inputs beyond the documented in-place mutation of `grid`/`objects` by
  `restoreWorldState` — neither reads or writes anything outside the
  passed `grid`/`objects` (no module-level mutable state, no DOM, no
  timers).
- `HistoryManager` holds all mutable undo/redo state privately; its only
  public surface is the six methods above. No getter exposes the raw
  stacks — only `canUndo()`/`canRedo()` booleans, matching exactly what
  `Toolbar.svelte` needs to decide dimming (FR-003).
- `beginAction` followed by `commitAction` with no intervening grid/objects
  mutation is always a no-op on history (FR-007) — this is the exact shape
  a no-op action (a 🗑️ tap on an already-empty field, a brush drag entirely
  off-canvas, etc.) produces.
- `undo()`/`redo()` never throw and never leave `grid`/`objects` partially
  restored — each either fully restores (returning `true`) or makes no
  change at all (returning `false`).
- Every array field on `WorldState` is independent per instance (no shared
  backing buffer between snapshots) — `captureWorldState` always allocates
  fresh `Uint8Array`s, so mutating `grid` after a capture never retroactively
  changes a previously-captured `WorldState`.

## `src/lib/Toolbar.svelte` (extended)

```ts
interface Props {
  tool: Tool;
  brushSize: BrushSize;
  canUndo: boolean;          // new
  canRedo: boolean;          // new
  onSelectTool: (tool: Tool) => void;
  onSelectBrushSize: (size: BrushSize) => void;
  onSelectScene: (sceneId: SceneId) => void;
  onClearAll: () => void;
  onUndo: () => void;        // new
  onRedo: () => void;        // new
}
```

**Contract**: one new `.group` (same `.group`/`.control` CSS classes as
every existing group) inserted in the DOM between the existing
`.group.actions` and `.group.scenes`, containing exactly two buttons:
↩️ (`aria-label="Undo"`, `disabled={!canUndo}`, `onclick={onUndo}`) and
↪️ (`aria-label="Redo"`, `disabled={!canRedo}`, `onclick={onRedo}`).
Neither button ever receives `class:selected` — they are action buttons
like the existing 🗑️ (`onClearAll`) button, which also has no `selected`
binding. Every existing prop, group, and button is otherwise unchanged.

## `src/lib/layout.ts` (unchanged)

No change — `computePlayField`/`computeToolbarLayout`/`MIN_TOUCH_TARGET`/
`CELL_BUDGET`/etc. are already generic over a control/group count, not
particular controls (research.md §10).

## `src/App.svelte` (extended)

**Contract**: gains `let canUndo = $state(false); let canRedo =
$state(false);`, a new callback `handleHistoryChange(nextCanUndo: boolean,
nextCanRedo: boolean): void` that assigns both, and two new handler
functions `undo(): void` / `redo(): void` that call `playArea.undo()` /
`playArea.redo()` (the same `bind:this`-imperative-method pattern
`clearAll`/`selectScene` already use for `clearAll`/`loadScene`). Passes
`onHistoryChange={handleHistoryChange}` to `<PlayArea>` and `{canUndo}`,
`{canRedo}`, `onUndo={undo}`, `onRedo={redo}` to `<Toolbar>`. No other
change — `tool`/`brushSize`/`selectTool`/`selectBrushSize`/`clearAll`/
`selectScene` are all unchanged.

## `src/lib/PlayArea.svelte` (extended)

**Contract**:
- Imports `HistoryManager` from `../sim/history` and instantiates one
  `const history = new HistoryManager();` at component-instance scope,
  alongside the existing `objectsState`.
- Gains one new prop: `onHistoryChange?: (canUndo: boolean, canRedo:
  boolean) => void`.
- `handlePointerDown`'s paint-tool branch calls `history.beginAction(grid,
  objectsState)` before the first `paintAt` call; its `rainbow`/`unicorn`
  branch wraps its single `placeObject` call with
  `beginAction`/`commitAction` back-to-back.
- `handlePointerUp` calls `history.commitAction(grid, objectsState)` after
  its existing `drawing = false; lastGridPos = null;`, then notifies
  `onHistoryChange?.(history.canUndo(), history.canRedo())`.
- The exported `clearAll()`/`loadScene()` methods each wrap their existing
  body with `beginAction`/`commitAction` and the same notify call — no
  other change to what either method does.
- Two new exported methods: `undo(): void` and `redo(): void`. Each first
  calls `handlePointerUp()` if `drawing` is `true` (FR-009), then calls
  `history.undo(grid, objectsState)` / `history.redo(grid, objectsState)`;
  if that returns `true`, notifies `onHistoryChange`. Neither clears
  `particles` (research.md §8, FR-026).
- `resize()`'s existing re-derivation branch (the one that calls
  `resizeGrid` and swaps to a new `Grid` instance) additionally calls
  `history.reset()` and notifies `onHistoryChange`. The non-re-deriving
  early-return branch is untouched.
- No other function (`frame`, `render`, `paintAt`, `clientToGrid`,
  `measureField`, `repositionObjects`, `updateUnicorns`, `colorFor`, every
  render-path helper) is touched at all.

## Consumers

- `PlayArea.svelte` is the only runtime caller of every `HistoryManager`
  method and of `captureWorldState`/`restoreWorldState` (indirectly,
  through `HistoryManager`). The existing per-frame loop (`step` →
  `applyRainbowConversions` → `updateUnicorns` → `tickParticles` →
  `updateFlashMask` → `render`) is completely unaware `history.ts` exists —
  nothing in `frame()` changes.
- `tests/unit/sim/history.test.ts` (new) imports `createGrid`/`setCell`/
  `clearGrid`/`igniteStarPower`/`createFog` from `grid.ts`, `step` from
  `step.ts`, `createObjectsState`/`placeObject`/`clearObjects` from
  `objects.ts`, every element constant from `types.ts`, and
  `captureWorldState`/`restoreWorldState`/`HistoryManager`/`HISTORY_DEPTH`
  from `history.ts` — no DOM — and asserts the capture/restore/no-op/bound/
  redo-invalidation/round-trip/budget contract above directly against
  `Grid`/`ObjectsState` state (FR-033).
- `tests/unit/lib/layout.test.ts` gains no new test, only its
  `TOOLBAR_CONTROL_COUNT`/`TOOLBAR_GROUP_COUNT` constants change (research.md
  §10) — every existing assertion in that file re-runs unchanged at the new
  count.
- No other existing test file (`grid.test.ts`, `step.test.ts`,
  `brush.test.ts`, `wand.test.ts`, `objects.test.ts`, `resize.test.ts`,
  `scenes.test.ts`, `grass.test.ts`, `starPower.test.ts`, `weather.test.ts`)
  needs any change — this feature touches no code any of them exercise
  (FR-023, FR-031).
