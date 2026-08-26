# Contract: Wand mechanics (extends 004's `src/sim/*` contract)

This project has no network API. As in
`specs/004-landscape-scenes/contracts/scene-generation.md` (which itself
extends 001–003's), the interface contract that matters is the boundary
between the framework-free simulation core (`src/sim/*`), the UI-layer
effect helpers (`src/lib/*`), the Svelte shell that calls both, and the
`vitest` unit tests that exercise `src/sim/*` directly with no DOM
(constitution Principle V, FR-027). This document is purely additive except
where a signature explicitly gains a parameter with a default — every other
function listed in prior contracts is unchanged and is not repeated here.

## `src/sim/types.ts` (extended)

```ts
export type Tool = 'sand' | 'water' | 'dirt' | 'rainbow' | 'unicorn' | 'eraser' | 'wand';

export interface Grid {
  readonly width: number;
  readonly height: number;
  readonly elements: Uint8Array;
  readonly shades: Uint8Array;
  readonly moved: Uint8Array;
  readonly hues: Uint8Array;
  readonly glitter: Uint8Array; // new — 0 or 1 per cell
}
```

**Addition only**: `Element`, `BrushSize`, `SceneId`, `ObjectKind`,
`PlacedObject`, `ObjectsState` are all unchanged.

## `src/sim/grid.ts` (extended)

```ts
export function createGrid(width: number, height: number): Grid; // unchanged signature — now also allocates `glitter`
export function setCell(grid: Grid, x: number, y: number, element: number, shade: number): void; // unchanged signature — now also resets glitter[i] to 0
export function clearGrid(grid: Grid): void; // unchanged signature — now also fills glitter to 0
export function setGlitter(grid: Grid, x: number, y: number, value: 0 | 1): void; // new
export function getGlitter(grid: Grid, x: number, y: number): boolean; // new
```

**Contract**:
- `createGrid(width, height)`: `glitter` is a `new Uint8Array(width *
  height)`, zero-initialized, same size/shape discipline as `elements`/
  `shades`/`hues`/`moved`.
- `setCell(grid, x, y, element, shade)`: behaves exactly as before for
  `elements`/`shades`, and additionally sets `grid.glitter[y * grid.width +
  x] = 0` whenever `(x, y)` is in bounds (out-of-bounds calls remain a
  no-op, unchanged). This is the only change to this function's behavior;
  its signature and its `elements`/`shades` behavior are identical to
  001–004.
- `clearGrid(grid)`: behaves exactly as before for `elements`
  (`elements.fill(EMPTY)`), and additionally calls `grid.glitter.fill(0)`.
  Signature unchanged.
- `setGlitter(grid, x, y, value)`: no-op if `(x, y)` is out of bounds
  (mirroring `setCell`'s existing bounds check); otherwise writes `value`
  to `grid.glitter[y * grid.width + x]` and touches nothing else — does
  **not** touch `elements`/`shades`/`hues`, which is what lets the wand
  mark an existing grain glittered without altering its element or shade
  (FR-006, FR-011).
- `getGlitter(grid, x, y)`: returns `false` if `(x, y)` is out of bounds
  (mirroring `getElement`/`getShade`'s existing bounds behavior); otherwise
  returns `grid.glitter[y * grid.width + x] === 1`.

## `src/sim/step.ts` (behavior change, no signature change)

`step(grid: Grid): void` keeps its existing signature and dispatch logic
unchanged. Its two private helpers change behavior only:

- `moveCell(grid, fromIndex, toIndex)`: in addition to its existing
  `elements`/`shades`/`hues` copy-then-zero-source behavior, copies
  `grid.glitter[fromIndex]` to `grid.glitter[toIndex]` and sets
  `grid.glitter[fromIndex] = 0`.
- `swapCells(grid, aIndex, bIndex)`: in addition to its existing
  `elements`/`shades`/`hues` swap, swaps `grid.glitter[aIndex]` and
  `grid.glitter[bIndex]`.

**Contract**: after any `step()` call, for every cell whose contents moved
or swapped, the moved/swapped grain's glitter bit is at its new index and
the cell it vacated (if any, i.e. `moveCell`'s source) has glitter `0`
(FR-008). No other `step()` behavior — powder/liquid dispatch, `moved`
bookkeeping, rainbow-sand hue cycling — changes in any way.

## `src/sim/brush.ts` (one export added, no behavior change)

```ts
export function forEachFootprintCell(
  cx: number,
  cy: number,
  radius: number,
  fn: (x: number, y: number) => void,
): void; // was private; now exported, identical implementation
```

**Contract**: identical behavior to today's private helper. `applyBrush`/
`applyBrushLine` are unchanged in every other respect.

## `src/sim/objects.ts` (one export added, no behavior change)

```ts
export function footprintIntersectsCircle(
  obj: PlacedObject,
  cx: number,
  cy: number,
  radius: number,
): boolean; // was private; now exported, identical implementation
```

**Contract**: identical behavior to today's private helper. Every other
export (`createObjectsState`, `placeObject`, `removeObject`,
`applyRainbowConversions`, `isUnicornTouched`, `eraseObjectsInBrush`,
`eraseObjectsInBrushLine`, `clearObjects`) is unchanged.

## `src/sim/wand.ts` (new)

```ts
export function applyWand(grid: Grid, cx: number, cy: number, radius: number): void;

export function applyWandLine(
  grid: Grid,
  from: { x: number; y: number },
  to: { x: number; y: number },
  radius: number,
): void;

export function unicornsTouchedByWandLine(
  objects: ObjectsState,
  from: { x: number; y: number },
  to: { x: number; y: number },
  radius: number,
): PlacedObject[];
```

**Contract**:
- `applyWand(grid, cx, cy, radius)`: iterates the circular footprint via
  `forEachFootprintCell` (imported from `brush.ts`). For each in-bounds
  covered cell `(x, y)` with index `i`:
  - if `grid.elements[i] === OBJECT`: does nothing (research.md §7).
  - else if `grid.elements[i] !== EMPTY`: calls `setGlitter(grid, x, y,
    1)` and does not call `setCell` or otherwise touch `elements[i]`/
    `shades[i]`/`hues[i]` (FR-006, FR-011).
  - else (`grid.elements[i] === EMPTY`): if `(x, y)` satisfies the fixed
    position-only lattice test (research.md §4), calls `setCell(grid, x,
    y, RAINBOW_SAND, <position-keyed shade>)` then sets `grid.hues[i] =
    <position-keyed hue>` then `setGlitter(grid, x, y, 1)`; otherwise does
    nothing to that cell.
  - Never calls anything from `objects.ts` — cannot place, remove, or
    resize any object (FR-013).
  - Allocates nothing: a single pass, no candidate array, no reservoir
    buffer (research.md §4).
- `applyWandLine(grid, from, to, radius)`: Bresenham-interpolates
  `applyWand` along the segment from `from` to `to` inclusive, identical
  interpolation shape to `applyBrushLine`/`eraseObjectsInBrushLine` (so a
  fast drag leaves no gaps — FR-003).
- `unicornsTouchedByWandLine(objects, from, to, radius)`: Bresenham-walks
  the same segment (identical interpolation shape) and returns every
  distinct `PlacedObject` in `objects.unicorns` for which
  `footprintIntersectsCircle(unicorn, x, y, radius)` is true for at least
  one point on the path. Returns `[]` if none. Does not read or write
  `objects.rainbows` or `Grid` at all.
- Calling `applyWand`/`applyWandLine` any number of times with unchanged
  arguments against the same starting grid state always produces the same
  resulting `elements`/`shades`/`hues`/`glitter` arrays (FR-010, SC-005).

## `src/lib/particles.ts` (extended)

```ts
export type Particle = { glyph: '✨' | '💖' | '🎉'; x: number; y: number; spawnedAt: number }; // glyph union widened

export function spawnBurst(
  particles: Particle[],
  atX: number,
  atY: number,
  now: number,
  count?: number, // new, defaults to the existing BURST_COUNT
): void;
```

**Contract**: `spawnBurst`'s existing call site (the ordinary touch
celebration in `PlayArea.svelte`'s `updateUnicorns`) is unaffected by
omitting the new parameter. A caller passing a larger `count` (the wand
burst) gets that many glyphs spawned via the same `spawn()` helper, subject
to the same `MAX_PARTICLES` cap and oldest-eviction behavior as any other
call (FR-021). `spawnIdleSparkle`/`tickParticles`/`PARTICLE_LIFETIME_MS` are
unchanged.

## `src/lib/sparkle.ts` (new)

```ts
export const FLASH_CAP: number;

export function createFlashMask(width: number, height: number): Uint8Array;

export function updateFlashMask(grid: Grid, mask: Uint8Array): void;
```

**Contract**: `createFlashMask` allocates a zero-filled `Uint8Array` sized
`width * height`, called once. `updateFlashMask` clears `mask` in place,
then performs a single forward pass over `grid`'s cells, reservoir-sampling
up to `FLASH_CAP` indices `i` where `grid.elements[i]` is glitterable
(non-`EMPTY`, non-`OBJECT`) and `grid.glitter[i] === 1`, setting `mask[i] =
1` for each sampled index. Allocates nothing per call (research.md §6). Not
imported by any `src/sim/*` module or `tests/unit/sim/*` test.

## `src/lib/PlayArea.svelte` (extended)

**Contract**: `paintAt` gains a branch for `tool === 'wand'`: calls
`applyWandLine`/`applyWand` (from `wand.ts`) instead of `applyBrushLine`/
`applyBrush`, and separately calls `unicornsTouchedByWandLine` against
`objectsState`; for each returned unicorn, checks/updates a
`lastWandBurstAt` cooldown (stored in the existing `unicornTimers` map
entry) before calling `spawnBurst(particles, atX, atY, now,
WAND_BURST_COUNT)`. `frame()` gains one call, `updateFlashMask(grid,
flashMask)`, before `render()`. `render()` reads `flashMask[i]` and
`grid.glitter[i]` to apply the flash highlight and the gentle shimmer
respectively, in addition to its existing `colorFor` lookup. `clearAll()`
and `loadScene()` need no changes — both already route through
`clearGridState`/`loadSceneState`, which already clear `glitter` per
`grid.ts`'s updated `clearGrid` contract.

## `src/lib/Toolbar.svelte` (extended)

**Contract**: adds one `<button class="control" class:selected={tool ===
'wand'} aria-label="Magic wand" onclick={() => onSelectTool('wand')}>✨
</button>`, participating in the existing `Props.onSelectTool` callback and
the existing `.control`/`.selected` CSS exactly like every element/eraser
button (FR-001). No new prop is added to `Toolbar`'s `Props` interface.

## `src/App.svelte` (no change needed)

**Contract**: `selectTool(next: Tool)` already accepts any `Tool` value and
assigns it to `tool` unchanged — `'wand'` requires no new handler, mirroring
how adding `'dirt'`/`'rainbow'`/`'unicorn'` in prior features needed none
either.

## Consumers

- `PlayArea.svelte` is the only runtime caller of `wand.ts`/`sparkle.ts`. A
  wand drag flows: `Toolbar` button `onclick` → `App.svelte`'s
  `selectTool('wand')` → subsequent `pointerdown`/`pointermove` →
  `PlayArea.paintAt` → `wand.ts`'s `applyWandLine` (grid/glitter) +
  `unicornsTouchedByWandLine` (burst check) → next animation frame's
  `updateFlashMask` + `render()` picks up the new glitter/grain state. The
  existing per-frame loop (`step` → `applyRainbowConversions` →
  `updateUnicorns` → `tickParticles` → `render`) is unaware a wand stroke
  just happened — it simply sees new grid/object/particle contents on its
  next tick, exactly as after a hand-drawn stroke (mirroring `004`'s
  scene-load consumer note).
- `tests/unit/sim/wand.test.ts` imports `applyWand`/`applyWandLine`/
  `unicornsTouchedByWandLine` from `src/sim/wand.ts`, plus
  `createGrid`/`setCell`/`getGlitter` from `grid.ts`,
  `createObjectsState`/`placeObject` from `objects.ts`, and `RAINBOW_SAND`/
  other element constants from `types.ts` — no DOM, no Svelte.
- `tests/unit/sim/step.test.ts` gains assertions built from
  `createGrid`/`setCell`/`setGlitter`/`step`/`getGlitter` that a glittered
  grain's bit travels on fall/slide/swap and is cleared at the vacated cell
  (FR-008) — no new import beyond what `grid.ts` already exports.
