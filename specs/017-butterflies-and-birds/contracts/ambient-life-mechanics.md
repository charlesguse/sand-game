# Contract: Ambient Life Mechanics (Butterflies & Birds)

This is not a network/API contract — Rainbow Sand is a single-page,
offline client (constitution Principle I). This document is the
per-module interface contract for the two new `src/sim/*` modules this
feature adds, and the exact, file-by-file diff surface against the rest
of the codebase — the same kind of contract `specs/011-persistent-undo-
history/contracts/persistent-history-mechanics.md` provides for its own
feature.

## `src/sim/butterflies.ts` (new)

```ts
export const BUTTERFLY_CAP: number; // 4
export const FLOWERS_PER_BUTTERFLY: number; // 4
export const ERASE_HOLDOFF_MS: number; // 3000

export interface Butterfly {
  readonly id: number;
  x: number;
  y: number;
  state: 'visiting' | 'travelling';
  targetX: number;
  targetY: number;
  headingRadians: number;
  wobblePhase: number;
  timer: number;
  facing: 1 | -1;
}

export interface ButterfliesState {
  butterflies: Butterfly[];
  nextId: number;
  flowerScan: { known: { x: number; y: number }[]; buffer: { x: number; y: number }[]; nextRow: number };
  recentErasesAt: number[];
}

export function createButterfliesState(): ButterfliesState;

/** Advances the flower scan by its per-frame bounded row budget, updates population against the (possibly just-refreshed) known flower list, and steps every butterfly's visit/travel state machine one frame. Never writes to `grid`. `now` is whatever clock the caller uses for the erase hold-off (PlayArea.svelte passes `performance.now()`; tests may pass a monotonically increasing counter). */
export function stepButterflies(grid: Grid, state: ButterfliesState, now: number): void;

/** Removes every butterfly within `radius` of (cx, cy); each removal records `now` into `recentErasesAt` (FR-026). Never touches `grid`. */
export function eraseButterfliesInBrush(state: ButterfliesState, cx: number, cy: number, radius: number, now: number): void;

/** Same as eraseButterfliesInBrush, applied along the Bresenham-interpolated line from `from` to `to` — mirrors objects.ts's eraseObjectsInBrushLine so a fast eraser drag cannot skip over a butterfly between two consecutive pointer samples (FR-025). */
export function eraseButterfliesInBrushLine(state: ButterfliesState, from: { x: number; y: number }, to: { x: number; y: number }, radius: number, now: number): void;

/** Empties `butterflies` (and resets the flower scan cursor) without touching `grid`. Used by clearAll(), loadScene(), and resize()'s re-derivation branch. */
export function clearButterflies(state: ButterfliesState): void;
```

**Invariants** (checked by `tests/unit/sim/butterflies.test.ts`, per
spec.md FR-036):
1. `state.butterflies.length <= BUTTERFLY_CAP` after every
   `stepButterflies` call, for any sequence of grid mutations.
2. With zero `FLOWER` cells anywhere in `grid`, after enough frames for
   one full scan pass, `state.butterflies.length === 0` and stays `0`.
3. After a first `FLOWER` cell appears, within one full scan pass'
   worth of frames (`~FLOWER_SCAN_PASS_FRAMES`), `state.butterflies.length
   >= 1`.
4. For flower counts `1, 4, 5, 8, 9, ..., 16, 17`, the eventual
   (post-scan-pass) butterfly count matches
   `Math.min(4, Math.ceil(n / 4))` exactly.
5. Every butterfly's `(x, y)` stays within `[0, grid.width) × [0,
   grid.height)` for every frame of a long run, including one that
   crosses SAND/DIRT/WATER/OBJECT terrain placed directly under its
   flight path.
6. No call to `stepButterflies`, `eraseButterfliesInBrush(Line)`, or
   `clearButterflies` ever writes to `grid.elements` or any other `Grid`
   field — asserted by snapshotting every `Grid` array before and after
   a long run with flowers present and butterflies actively
   visiting/travelling/being erased.
7. Erasing a butterfly removes it immediately; for `ERASE_HOLDOFF_MS`
   afterward, `state.butterflies.length` does not exceed
   `desiredCount - (still-active hold-off count)`; once that window
   elapses, the population returns to `desiredCount` on its own with no
   further input.
8. A butterfly `travelling` toward a target whose flower cell is removed
   from `grid` is, within one scan pass (or immediately at arrival if
   sooner), no longer targeting that now-empty coordinate.

## `src/sim/birds.ts` (new)

```ts
export const BIRD_CAP: number; // 3

export interface Bird {
  readonly id: number;
  palmId: number;
  destPalmId: number;
  x: number;
  y: number;
  state: 'perched' | 'hopping' | 'flying';
  timer: number;
  flightProgress: number;
  takeoffX: number;
  takeoffY: number;
  facing: 1 | -1;
}

export interface BirdsState {
  byPalmId: Map<number, Bird>;
  nextId: number;
  holdoffUntilByPalmId: Map<number, number>;
}

export function createBirdsState(): BirdsState;

/** Ensures every live, non-held-off palm (up to BIRD_CAP total birds) has a bird; retargets or removes any bird whose owning/destination palm no longer exists; steps every bird's perch/hop/flight state machine one frame. Reads `palms` (ObjectsState.byKind.palm) only — never writes to it or to any Grid. */
export function stepBirds(palms: readonly PlacedObject[], state: BirdsState, now: number): void;

/** Removes every bird within `radius` of (cx, cy); each removal sets holdoffUntilByPalmId for that bird's palmId to now + ERASE_HOLDOFF_MS. */
export function eraseBirdsInBrush(state: BirdsState, cx: number, cy: number, radius: number, now: number): void;

/** Line-interpolated form of eraseBirdsInBrush, mirroring eraseObjectsInBrushLine. */
export function eraseBirdsInBrushLine(state: BirdsState, from: { x: number; y: number }, to: { x: number; y: number }, radius: number, now: number): void;

/** Empties byPalmId and holdoffUntilByPalmId. Used by clearAll(), loadScene(), and resize()'s re-derivation branch. */
export function clearBirds(state: BirdsState): void;
```

**Invariants** (checked by `tests/unit/sim/birds.test.ts`, per spec.md
FR-036):
1. `state.byPalmId.size <= Math.min(BIRD_CAP, palms.length)` after every
   `stepBirds` call.
2. With zero palms, `state.byPalmId.size === 0` and stays `0`.
3. For each of 1, 2, and 3 live palms, within about a second of frames
   every palm not on hold-off has exactly one bird, and no palm ever has
   more than one.
4. A `perched`/`hopping` bird's `(x, y)` always equals its palm's current
   top-center anchor (`obj.x + obj.size / 2`, `obj.y`) for whatever
   `obj` is currently in `palms` with that id — including after the
   palm's own sway/poke visuals change (those are drawn separately in
   `PlayArea.svelte` and do not move the underlying `PlacedObject`
   coordinates `stepBirds` reads).
5. Every `flying` bird's `(x, y)`, sampled every frame across many
   flights (including a single-palm loop and a two-or-three-palm
   crossing, and a palm placed at `y = 0` or against the grid's
   left/right edge), stays within `[0, grid.width) × [0, grid.height)`.
6. Every completed flight (`flightProgress` reaching `1`) ends with the
   bird's `state === 'perched'` and `palmId` equal to some id present in
   `palms` at that moment.
7. Erasing every palm mid-flight results in the flying bird being removed
   within about a second, never left in an unresolved `flying` state
   forever.
8. No call to `stepBirds`, `eraseBirdsInBrush(Line)`, or `clearBirds`
   ever mutates the `palms` array or any element of it.

## `PlayArea.svelte` wiring contract (the only modified file)

| Call site | Addition |
|---|---|
| Module-level state (beside `objectsState`/`petsState`) | `const butterfliesState = createButterfliesState();` / `const birdsState = createBirdsState();` |
| `frame(now)` | `stepButterflies(grid, butterfliesState, now); stepBirds(objectsState.byKind.palm, birdsState, now);` — placed after the existing `stepPets` call, before `render()`. |
| `render()` | One draw loop per kind, styled like the existing poodle loop: `ctx.font` set once per kind to a butterfly-/bird-sized value, `ctx.save()/translate/scale(-1,1) when facing===-1/fillText('🦋' or '🐦', 0, 0)/restore()` per creature. |
| `paintAt()`, `tool === 'eraser'` branch | `eraseButterfliesInBrush(Line)(butterfliesState, ...)` and `eraseBirdsInBrush(Line)(birdsState, ...)` called alongside the existing `eraseObjectsInBrush(Line)` call, same `from`/`pos`/`radius`, plus `performance.now()`. |
| `clearAll()` | `clearButterflies(butterfliesState); clearBirds(birdsState);` beside the existing `clearPets(petsState)` call. |
| `loadScene()` | Same two calls, beside the existing `clearPets(petsState)` call. |
| `resize()`, re-derivation branch | Same two calls, in place of a repositioning step (research.md §4) — added after the existing `repositionPoodles` call. |

**Explicitly not touched**: `tryRestore`, `saveNow`, `flushSave`,
`handlePointerDown`'s poke-check branch (FR-022: no new interaction),
`undo()`, `redo()`, and every function this table does not list.

## File-by-file diff surface (nothing else changes)

| File | Diff |
|---|---|
| `src/sim/butterflies.ts` | **New file.** |
| `src/sim/birds.ts` | **New file.** |
| `src/lib/PlayArea.svelte` | Additive only, per the table above. |
| `src/sim/types.ts`, `element.ts`, `shade.ts`, `grid.ts`, `step.ts`, `brush.ts`, `wand.ts`, `objects.ts`, `pets.ts`, `scenes.ts`, `resize.ts`, `history.ts`, `historySave.ts`, `save.ts` | **No diff.** |
| `src/App.svelte`, `src/lib/Toolbar.svelte`, `toolbarControls.ts`, `layout.ts`, `sound.ts`, `particles.ts`, `sparkle.ts` | **No diff.** |
| `tests/unit/sim/butterflies.test.ts` | **New file.** |
| `tests/unit/sim/birds.test.ts` | **New file.** |
| Every other test file | **No diff.** |
