# Contract: `src/sim/*` core module (extends 001's contract)

This project has no network API. As in
`specs/001-falling-pink-sand/contracts/sim-core.md`, the interface contract
that matters is the boundary between the framework-free simulation core
(`src/sim/*`) and both (a) the Svelte UI shell that calls it every animation
frame and (b) the `vitest` unit tests that exercise it directly with no DOM
(constitution Principle V, FR-029). This document supersedes 001's contract
for the signatures that change and adds the ones that are new; anything not
mentioned here (e.g. `applyBrushLine`'s Bresenham behavior) is unchanged.

## `src/sim/types.ts`

```ts
export const EMPTY = 0;
export const SAND = 1;
export const WATER = 2;
export const DIRT = 3;

export type Element =
  | typeof EMPTY
  | typeof SAND
  | typeof WATER
  | typeof DIRT;

export interface Grid {
  readonly width: number;
  readonly height: number;
  readonly elements: Uint8Array; // length === width * height, row-major
  readonly shades: Uint8Array;   // same shape; meaningful iff elements[i] !== EMPTY
  readonly moved: Uint8Array;    // scratch only — see step.ts contract
}

export type Tool = 'sand' | 'water' | 'dirt' | 'eraser';
export type BrushSize = 'small' | 'medium' | 'large';
```

**Breaking change from 001**: `Grid.cells: Uint8ClampedArray` is replaced by
`elements` + `shades` + `moved`. `Tool` gains `'water'` and `'dirt'`.

## `src/sim/element.ts` (new)

```ts
export function isPowder(e: number): boolean; // SAND or DIRT
export function isLiquid(e: number): boolean; // WATER
```

**Contract**: pure functions of the element value, no grid access. Every
density comparison in `step.ts` and `brush.ts` goes through these two
functions rather than repeating `=== SAND || === DIRT` inline.

## `src/sim/grid.ts`

```ts
export function createGrid(width: number, height: number): Grid;

export function inBounds(grid: Grid, x: number, y: number): boolean;

export function getElement(grid: Grid, x: number, y: number): number; // EMPTY if out of bounds
export function getShade(grid: Grid, x: number, y: number): number;   // 0 if out of bounds or cell empty

export function setCell(
  grid: Grid,
  x: number,
  y: number,
  element: number,
  shade: number,
): void;

export function clearGrid(grid: Grid): void; // sets every cell's element to EMPTY, in place
```

**Contract**:
- `createGrid` returns a grid with `elements`, `shades`, and `moved` all
  zeroed (every cell empty).
- `getElement`/`getShade`/`setCell` on out-of-bounds `(x, y)` are no-ops
  (`getElement`/`getShade` return `0`) — same choke-point guarantee 001's
  `getCell`/`setCell` provided (FR-008 for water's walls/floor,
  inherited FR-020 for brush clipping).
- `setCell(grid, x, y, EMPTY, anything)` is the correct way to erase a
  single cell; the `shade` argument is ignored when `element === EMPTY`.
- `clearGrid` sets every cell's `elements` entry to `EMPTY` in place (no
  reallocation), leaves `width`/`height` untouched, and does not need to
  zero `shades` (never read for an empty cell) — this is what 🗑️ calls
  (FR-024); it must not touch tool/brush-size state, which the UI layer
  owns.
- **Removed from 001's contract**: `getCell`/`setCell(grid, x, y, value)`
  (single-number form). Callers use `getElement`/`getShade`/the new
  `setCell` signature instead.

## `src/sim/step.ts`

```ts
export function step(grid: Grid): void;
```

**Contract** (implements FR-004–FR-014, per research.md §3–§5):
- Mutates `grid.elements`/`grid.shades` in place; allocates nothing per call
  (`grid.moved` is preallocated in `createGrid` and only `.fill(0)`'d here —
  Principle IV).
- At the start of each call, `grid.moved.fill(0)`.
- Scans rows bottom to top, and left to right within a row. Skips any cell
  where `moved[i] === 1` (already handled earlier this tick as a move/swap
  destination in the current row).
- For a powder cell (`isPowder`): tries fall (empty below) → sink-swap
  (water below) → diagonal slide into empty-or-water (random tie-break when
  both sides qualify) → rest, in that order. Fall/slide moves copy
  `(element, shade)` and zero the source's element to `EMPTY`; the sink-swap
  exchanges both cells' `(element, shade)` pairs. Marks both the source and
  destination index as `moved` on any change.
- For a liquid cell (`isLiquid`): tries fall (empty below) → diagonal slide
  into empty only (random tie-break) → sideways spread into empty only,
  same row (random tie-break) → rest, in that order. Never moves into a
  cell occupied by a powder, never moves to a row above its own. Marks both
  the source and destination index as `moved` on any change.
- Off-grid neighbors are always treated as blocked (never empty).
- Never creates, destroys, or duplicates an `(element, shade)` pair; every
  change is a move (one source → one previously-empty destination) or a
  swap (two occupied cells trade contents) — FR-003, SC-005.
- Idempotent on a fully-settled grid (calling `step` again produces no
  changes), same property 001 relied on for "piles look stable"; now also
  covers "a settled body of water stays settled" and "a resting swap
  configuration doesn't oscillate."

## `src/sim/brush.ts`

```ts
export function applyBrush(
  grid: Grid,
  tool: Tool,
  cx: number,
  cy: number,
  radius: number,
  shade: number, // ignored when tool === 'eraser'
): void;

export function applyBrushLine(
  grid: Grid,
  tool: Tool,
  from: { x: number; y: number },
  to: { x: number; y: number },
  radius: number,
  shade: number,
): void;
```

**Contract** (footprint math, clipping, and `applyBrushLine`'s Bresenham
interpolation are unchanged from 001; only the per-cell write predicate is
new):
- `applyBrush` touches every cell `(x, y)` with
  `(x-cx)^2 + (y-cy)^2 <= radius^2`, clipped silently to grid bounds.
  - `tool === 'sand'` or `tool === 'dirt'`: writes `(SAND|DIRT, shade)` into
    a footprint cell when its current element is `EMPTY` **or** `WATER`
    (FR-021) — a direct overwrite, not a swap; any water previously there is
    discarded.
  - `tool === 'water'`: writes `(WATER, shade)` into a footprint cell only
    when its current element is `EMPTY` (FR-022) — never overwrites a
    powder.
  - `tool === 'eraser'`: writes `EMPTY` into every footprint cell regardless
    of current contents (FR-023).
- `shade` is generated by the caller (UI layer, via `src/sim/shade.ts`) once
  per placed occupant and passed in, for every element — `applyBrush` does
  not decide shade values, keeping it a pure grid-mutation function that
  unit tests can call with a fixed shade regardless of which element is
  being tested.

## `src/sim/shade.ts` (unchanged from 001)

```ts
export function randomShade(): number; // 1..255
```

**Contract**: unchanged. Returns a value in `1–255`, never `0`. Called for
every newly-placed cell of any element (sand, water, or dirt) — the
returned byte's *meaning* (which color it maps to) is entirely a function
of which element it's paired with, decided outside `src/sim/*` (see
"Palette mapping," below).

## Palette mapping (UI/render layer, not `src/sim/*`)

Not part of the sim-core contract (mirrors 001's note that "exact palette is
a rendering detail, not a simulation one"), but documented here since it is
new surface area this feature adds: `PlayArea.svelte`'s per-frame
`putImageData` buffer fill reads `grid.elements[i]` to pick one of three
fixed color ramps (pink / blue / purple) and `grid.shades[i]` to index within
that ramp. This mapping has no exported contract of its own — it is a
private detail of the render loop, not called by tests or other modules.

## Consumers

- `PlayArea.svelte` is the only runtime caller of `step`, `applyBrush`/
  `applyBrushLine`, and `clearGrid` — it owns the `requestAnimationFrame`
  loop, calls `step(grid)` once per frame, translates pointer/touch events
  to grid coordinates, and re-renders via `putImageData`, now branching on
  `elements[i]` for color as described above.
- `tests/unit/sim/*.test.ts` import `src/sim/*` directly and assert on
  `grid.elements`/`grid.shades` contents after one or more `step`/
  `applyBrush` calls, with no DOM and no Svelte involved (FR-029).
