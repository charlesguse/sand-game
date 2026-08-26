# Contract: `src/sim/*` core module (extends 002's contract)

This project has no network API. As in `specs/002-water-and-purple-dirt/
contracts/sim-core.md` (which itself extends 001's), the interface contract
that matters is the boundary between the framework-free simulation core
(`src/sim/*`) and both (a) the Svelte UI shell that calls it every animation
frame and (b) the `vitest` unit tests that exercise it directly with no DOM
(constitution Principle V, FR-037). This document supersedes 002's contract
for the signatures that change and adds the ones that are new; anything not
mentioned here (footprint math, Bresenham line interpolation, `randomShade`,
etc.) is unchanged.

## `src/sim/types.ts`

```ts
export const EMPTY = 0;
export const SAND = 1;
export const WATER = 2;
export const DIRT = 3;
export const RAINBOW_SAND = 4;
export const OBJECT = 5;

export type Element =
  | typeof EMPTY
  | typeof SAND
  | typeof WATER
  | typeof DIRT
  | typeof RAINBOW_SAND
  | typeof OBJECT;

export interface Grid {
  readonly width: number;
  readonly height: number;
  readonly elements: Uint8Array; // length === width * height, row-major
  readonly shades: Uint8Array;   // meaningful iff elements[i] is SAND/WATER/DIRT
  readonly moved: Uint8Array;    // scratch only — see step.ts contract
  readonly hues: Uint8Array;     // new; meaningful iff elements[i] === RAINBOW_SAND
}

export type Tool = 'sand' | 'water' | 'dirt' | 'rainbow' | 'unicorn' | 'eraser';
export type BrushSize = 'small' | 'medium' | 'large';

export type ObjectKind = 'rainbow' | 'unicorn';

export interface PlacedObject {
  readonly id: number;
  readonly kind: ObjectKind;
  readonly x: number; // footprint top-left, grid cells
  readonly y: number;
  readonly size: number; // footprint is size x size cells
}

export interface ObjectsState {
  rainbows: PlacedObject[]; // length <= 3, oldest-first
  unicorns: PlacedObject[]; // length <= 3, oldest-first, independent cap
  nextId: number;
}
```

**Breaking change from 002**: `Grid` gains `hues: Uint8Array`. `Element`
gains `RAINBOW_SAND` and `OBJECT`. `Tool` gains `'rainbow'` and `'unicorn'`.
`PlacedObject`/`ObjectsState` are new.

## `src/sim/element.ts`

```ts
export function isPowder(e: number): boolean; // SAND, DIRT, or RAINBOW_SAND
export function isLiquid(e: number): boolean; // WATER (unchanged)
```

**Contract**: pure functions of the element value, no grid access.
`isPowder` now additionally returns `true` for `RAINBOW_SAND` (FR-019); no
other predicate returns `true` for `OBJECT` — it deliberately matches
neither `isPowder` nor `isLiquid`, which is what makes it inert to `step()`
(research.md §1) without any change to `step.ts` itself.

## `src/sim/grid.ts`

Unchanged signatures (`createGrid`, `inBounds`, `getElement`, `getShade`,
`setCell`, `clearGrid`), with one contract addition:

```ts
export function createGrid(width: number, height: number): Grid;
```

**Contract update**: `createGrid` now also zero-initializes `hues`
(`Uint8Array(width * height)`, all zero — meaningless until a cell becomes
`RAINBOW_SAND`). `clearGrid` is unchanged (`elements.fill(EMPTY)` only —
`hues`/`shades`/`moved` are never read for an `EMPTY` cell, so they don't
need clearing, matching 002's existing rationale).

## `src/sim/step.ts`

```ts
export function step(grid: Grid): void;
```

**Contract** (unchanged public signature and unchanged behavior for
`SAND`/`WATER`/`DIRT` — protects FR-036/SC-013):
- Still scans bottom-to-top, left-to-right, skipping `moved` cells, and
  still dispatches only `isPowder`/`isLiquid` cells to `stepPowder`/
  `stepLiquid` — `OBJECT` cells match neither and are silently skipped,
  requiring no change to this dispatch logic.
- `RAINBOW_SAND` is now a third member of the powder family: it falls,
  sink-swaps through water, diagonal-slides, and rests via exactly the same
  `stepPowder` logic as `SAND`/`DIRT` (FR-019), including being blocked by
  `OBJECT` cells the same way any powder is blocked by an occupied or
  off-grid neighbor (research.md §1, no `stepPowder` code change needed
  beyond `isPowder` already covering it).
- **New internal behavior** (not a new export): the internal `moveCell`/
  `swapCells` primitives, in addition to their existing element/shade
  carry-along, now also carry `hues[i]` along with the rest of the cell's
  data on every move/swap, and — only when the element landing at the
  destination index is `RAINBOW_SAND` — advance that destination's
  `hues[]` value by a fixed step, mod 256, as part of the same operation
  (research.md §4). A `RAINBOW_SAND` cell that is not moved or swapped this
  tick has its `hues[]` value left untouched, which is what freezes a
  settled grain's hue (FR-021, SC-021). This is an internal implementation
  detail of `step()`'s existing move primitives, not a new exported
  function — `step(grid)`'s signature and calling convention are unchanged.
- Does not know about `PlacedObject`/`ObjectsState` at all — objects are
  entirely opaque to `step()`, which only ever sees `OBJECT` as "a blocked
  cell" via `elements[]`.

## `src/sim/objects.ts` (new)

```ts
export function createObjectsState(): ObjectsState;

export function placeObject(
  grid: Grid,
  state: ObjectsState,
  kind: ObjectKind,
  cx: number,
  cy: number,
): void;

export function removeObject(grid: Grid, state: ObjectsState, obj: PlacedObject): void;

export function eraseObjectsInBrush(
  grid: Grid,
  state: ObjectsState,
  cx: number,
  cy: number,
  radius: number,
): void;

export function clearObjects(state: ObjectsState): void;

export function applyRainbowConversions(grid: Grid, rainbows: PlacedObject[]): void;

export function isUnicornTouched(grid: Grid, unicorn: PlacedObject): boolean;
```

**Contract**:
- `createObjectsState()` returns `{ rainbows: [], unicorns: [], nextId: 0 }`.
- `placeObject`: nudges `(cx, cy)` so the `size × size` footprint (using
  the shared `OBJECT_FOOTPRINT_SIZE` constant from `src/lib/layout.ts`)
  lies entirely in `[0, width) × [0, height)` (FR-004); if the target
  kind's list already has length 3, calls `removeObject` on element `0`
  (the oldest) first (FR-005); stamps every footprint cell's `elements[]`
  to `OBJECT`, discarding whatever was there (FR-006); appends a new
  `PlacedObject` with a fresh `id` (from `state.nextId++`) to the matching
  list. Never refuses, never no-ops — every call visibly places an object
  (FR-002, FR-004, FR-005).
- `removeObject`: removes `obj` from whichever list contains it (matched by
  `id`); for every cell in its footprint, sets `elements[]` back to `EMPTY`
  **unless** some other remaining object's footprint still covers that
  cell, in which case it is left as `OBJECT` (FR-012, and the "objects
  overlap" edge case). Never touches `shades`/`hues`/`moved` — those are
  meaningless once a cell is `EMPTY`.
- `eraseObjectsInBrush`: for every object in `state.rainbows` and
  `state.unicorns`, checks whether any cell of its footprint lies within
  the circle of radius `radius` centered at `(cx, cy)` (the same predicate
  `brush.ts`'s footprint math uses); if so, calls `removeObject` for that
  object in full (FR-031 — never a partial object). Callers invoke this
  once per eraser brush application, immediately before the existing
  `applyBrush(grid, 'eraser', cx, cy, radius, 0)` call (research.md §9).
- `clearObjects`: sets `state.rainbows = []` and `state.unicorns = []`.
  Does **not** touch `grid` — callers pair this with the existing
  `clearGrid(grid)` (FR-032).
- `applyRainbowConversions`: for each `PlacedObject` in `rainbows`, walks
  its zone (the one-cell ring around its footprint, clipped to grid
  bounds); for any zone cell whose current element is exactly `SAND`,
  `DIRT`, or `WATER`, sets that cell's element to `RAINBOW_SAND` and its
  `hues[]` to a fresh value; leaves `RAINBOW_SAND`, `OBJECT`, and `EMPTY`
  zone cells untouched (FR-014–FR-018). Allocates nothing; no return value.
  Callers invoke this once per tick, immediately after `step(grid)`.
- `isUnicornTouched`: walks the same zone shape for a single unicorn;
  returns `true` if any zone cell's element is neither `EMPTY` nor
  `OBJECT` (i.e. any element — `SAND`/`WATER`/`DIRT`/`RAINBOW_SAND` —
  is touching it), `false` otherwise (FR-023). Pure — reads `grid`,
  mutates nothing. Callers invoke this once per unicorn per tick and use
  the result to drive particle spawning/rate-limiting in
  `src/lib/particles.ts` (research.md §10) — this function itself has no
  concept of rate-limiting, idle timers, or particles.

## `src/sim/brush.ts`

Unchanged signatures and behavior for `'sand'`/`'water'`/`'dirt'`/
`'eraser'` (FR-036, protects 002's `brush.test.ts`). One contract
clarification, no signature change:

- `paintCell`'s existing predicates (`current === EMPTY`, `current ===
  WATER`) already exclude `OBJECT` and `RAINBOW_SAND` cells from every
  tool's overwrite rule except `'eraser'`, and `'eraser'`'s unconditional
  `setCell(grid, x, y, EMPTY, 0)` still fires on any cell including
  `OBJECT` ones — this is intentional and harmless: `eraseObjectsInBrush`
  (above) has already fully removed any object touched by this same brush
  application before `applyBrush` runs, so any `OBJECT` byte `applyBrush`
  would otherwise stomp on has already been cleared to `EMPTY` (or is
  untouched because it belongs to an object the brush didn't reach).
  `applyBrush` itself gains no new object-awareness.
- `'rainbow'`/`'unicorn'` are never passed as `tool` to `applyBrush`/
  `applyBrushLine` — the UI layer calls `placeObject` directly for those
  (research.md §8), so `paintCell`'s `if/else if` chain (which has no case
  for `'rainbow'`/`'unicorn'`) is simply never reached with those tool
  values.

## `src/sim/shade.ts` (unchanged from 001/002)

```ts
export function randomShade(): number; // 1..255
```

**Contract**: unchanged. Still called for every newly-placed `SAND`/
`WATER`/`DIRT` cell from a brush stroke. Not called for `RAINBOW_SAND`
(which gets a `hues[]` value from `applyRainbowConversions` instead, never
from a brush — FR-022, rainbow sand has no toolbar brush of its own) and
not called for `OBJECT` cells (objects have no per-cell shade at all).

## Layout constants (`src/lib/layout.ts`, extends 002)

```ts
export const OBJECT_FOOTPRINT_SIZE: number; // cells, square, shared by both object kinds
```

**Contract**: a plain exported constant (research.md §6), read by
`placeObject` and by the UI layer when computing an object's on-canvas
pixel bounds for glyph drawing. Not a function, not configurable at
runtime.

## `src/lib/particles.ts` (new, UI-layer, not part of the `src/sim/*` core)

```ts
export interface Particle {
  glyph: '✨' | '💖';
  x: number; // pixels
  y: number; // pixels
  spawnedAt: number; // performance.now() at spawn
}

export function spawnBurst(particles: Particle[], atX: number, atY: number, now: number): void;
export function spawnIdleSparkle(particles: Particle[], atX: number, atY: number, now: number): void;
export function tickParticles(particles: Particle[], now: number): void; // advances position, drops expired, enforces cap in place
```

**Contract**: pure, DOM-free array manipulation (safe to unit-test without
a browser, though FR-037 does not require it — research.md §10). Never
reads or writes `Grid`; never called from `src/sim/*`. `tickParticles`
mutates `particles` in place (removes expired entries, advances `x`/`y` for
the rest) and never lets its length exceed the documented cap (FR-028),
dropping new spawn requests or retiring the oldest particle as needed.

## Consumers

- `PlayArea.svelte` remains the only runtime caller of the sim core. Per
  frame it now calls, in order: `step(grid)` → `applyRainbowConversions(
  grid, objectsState.rainbows)` → for each unicorn, `isUnicornTouched(grid,
  unicorn)` to decide whether to `spawnBurst` (rate-limited) → its idle-
  sparkle timer check (`spawnIdleSparkle`) → `tickParticles` → `render()`
  (now also drawing `OBJECT` footprints as background, then each object's
  emoji glyph, then live particles, on top of the existing per-element
  `putImageData` pass, colorizing `RAINBOW_SAND` cells from `hues[]` via
  HSL→RGB instead of a fixed ramp — research.md §7).
- Pointer handling: object tools (`'rainbow'`/`'unicorn'`) call
  `placeObject` once on `pointerdown` only (research.md §8); the eraser
  additionally calls `eraseObjectsInBrush` before its existing `applyBrush`
  call (research.md §9); clear-all additionally calls `clearObjects`
  alongside the existing `clearGrid` call (FR-032).
- `tests/unit/sim/*.test.ts` import `src/sim/*` directly (`step`,
  `applyRainbowConversions`, `isUnicornTouched`, `placeObject`,
  `removeObject`, `eraseObjectsInBrush`) and assert on `grid.elements`/
  `grid.hues`/`ObjectsState` contents, with no DOM and no Svelte involved
  (FR-037). Particle timing/rendering is exercised manually per the spec's
  Visual checks section, not by `vitest`.
