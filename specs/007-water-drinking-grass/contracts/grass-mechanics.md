# Contract: Grass mechanics (extends prior specs' `src/sim/*`/`src/lib/*` contracts)

This project has no network API. As in `specs/006-phone-support/contracts/
layout-and-touch.md` (which itself extends 001–005's), the interface
contract that matters is the boundary between the framework-free
simulation core (`src/sim/*`), the UI-layer helpers (`src/lib/*`), the
Svelte shell that calls both, and the `vitest` unit tests that exercise
`src/sim/*` functions directly with no DOM (constitution Principle V,
FR-035). This document is purely additive or signature-widening except
where explicitly noted — every function listed in prior contracts not
mentioned here is unchanged.

## `src/sim/types.ts` (extended)

```ts
export const GRASS = 6;

export type Element =
  | typeof EMPTY
  | typeof SAND
  | typeof WATER
  | typeof DIRT
  | typeof RAINBOW_SAND
  | typeof OBJECT
  | typeof GRASS;

export interface Grid {
  readonly width: number;
  readonly height: number;
  readonly elements: Uint8Array;
  readonly shades: Uint8Array;
  readonly moved: Uint8Array;
  readonly hues: Uint8Array;
  readonly glitter: Uint8Array;
  readonly grassHeight: Uint8Array;    // new — height above root, meaningful only where elements[i] === GRASS
  readonly grassCooldown: Uint8Array;  // new — steps until next eligible absorption, meaningful only where elements[i] === GRASS
  grassCount: number;                  // new — plain mutable field, not a typed array; live count of GRASS cells
}

export type Tool = 'sand' | 'water' | 'dirt' | 'grass' | 'rainbow' | 'unicorn' | 'eraser' | 'wand';
```

**Contract**: `grassHeight`/`grassCooldown` follow the array's existing
`readonly` convention (the array *reference* is fixed for the `Grid`'s
life; contents are mutated in place, exactly like `shades`/`hues`/
`glitter`). `grassCount` is **not** `readonly` — it is reassigned in place
by `setCell`/`clearGrid`/`resizeGrid` (below), the one field on `Grid` that
is a running total rather than per-cell state.

## `src/sim/element.ts` (extended)

```ts
export function isPowder(e: number): boolean;              // unchanged
export function isLiquid(e: number): boolean;               // unchanged
export function isSolid(e: number): boolean;                 // new: isPowder(e) || e === GRASS
```

**Contract**: `isSolid` is used only by `step.ts`'s sideways-growth support
check (research.md §4/§1) — it is not used by, and does not change,
`stepPowder`/`stepLiquid` (research.md §1).

## `src/sim/grid.ts` (extended)

```ts
export function createGrid(width: number, height: number): Grid;
  // extended: also allocates grassHeight/grassCooldown as zero-filled
  // Uint8Array(width * height); initializes grassCount = 0

export function setCell(grid: Grid, x: number, y: number, element: number, shade: number): void;
  // extended: in addition to its existing elements[i]/shades[i]/glitter[i]
  // writes, also maintains grassHeight[i]/grassCooldown[i]/grassCount —
  // see below

export function clearGrid(grid: Grid): void;
  // extended: in addition to elements.fill(EMPTY)/glitter.fill(0), also
  // fills grassHeight/grassCooldown to 0 and sets grassCount = 0

// unchanged: inBounds, getElement, getShade, setGlitter, getGlitter
```

**`setCell` extended contract** (applies on every call, for every
`element`, not just `GRASS`):

1. Let `i = y * grid.width + x`, `wasGrass = grid.elements[i] === GRASS`,
   `becomesGrass = element === GRASS`.
2. Perform the existing writes: `elements[i] = element`, `shades[i] =
   element === EMPTY ? 0 : shade`, `glitter[i] = 0`.
3. If `becomesGrass`: let `belowY = y + 1`; if `belowY < grid.height` and
   `elements[belowY * grid.width + x] === GRASS`, set `grassHeight[i] =
   min(255, grassHeight[belowIndex] + 1)`; otherwise set `grassHeight[i] =
   0`. Set `grassCooldown[i] = 0`.
   Else (not becoming grass): set `grassHeight[i] = 0`, `grassCooldown[i] =
   0`.
4. If `becomesGrass && !wasGrass`: `grassCount++`. Else if `!becomesGrass
   && wasGrass`: `grassCount--`. Else: unchanged.

`clearGrid`'s extended contract: `elements.fill(EMPTY)`,
`glitter.fill(0)` (unchanged), `grassHeight.fill(0)`,
`grassCooldown.fill(0)` (new), `grassCount = 0` (new).

**Invariant**: `grid.grassCount` always equals the number of indices where
`elements[i] === GRASS`, for every `Grid` at every point after any
`grid.ts`/`step.ts`/`resize.ts` function returns (never re-derived by
scanning — maintained incrementally at every mutation site).

## `src/sim/step.ts` (extended — internal additions, exported surface unchanged)

```ts
export function step(grid: Grid): void;
  // extended dispatcher: element === GRASS now calls a new private
  // stepGrass(grid, x, y, i) branch, alongside the existing isPowder/
  // isLiquid branches — no change to step's own signature or to the
  // stepPowder/stepLiquid functions themselves
```

**New private constants** (not exported):

```ts
const GRASS_HEIGHT_CEILING = 12;         // FR-011
const GRASS_FIELD_SHARE_CEILING = 0.25;  // FR-012
const GRASS_ABSORB_COOLDOWN = 10;        // FR-009
```

**New private functions** (not exported — internal to `step.ts`, covered
by `tests/unit/sim/grass.test.ts` via `step`'s own public behavior, not by
importing them directly):

- `stepGrass(grid, x, y, i)`: see data-model.md's "Absorption-and-growth
  event" state-transition table for the full precondition/effect contract.
  Allocation-free (no object/array literals) — plain index arithmetic and
  an `if`/`else if` neighbor scan only (research.md §5).
- `pickGrowthTargetIndex(grid, x, y): number`: returns a flat grid index or
  `-1`, implementing FR-010's preference order (above; diagonals with
  random tie-break; sideways requiring support) with eligibility folding in
  emptiness, the field-share ceiling, and the target's own would-be height
  ceiling. Allocation-free (research.md §4).
- `isEligibleTarget(grid, tx, ty): boolean`, `isSupported(grid, tx, ty):
  boolean`, `computeWouldBeHeight(grid, tx, ty): number`: small allocation-
  free helpers used only by `pickGrowthTargetIndex`.

**Contract**: `stepGrass` never moves, removes, or otherwise mutates the
cell at `(x, y)` itself except `grassCooldown[i]` — the invoking cell's
element/shade/height never change as a result of its own absorption
(matching FR-004: grass never moves, and "spending" absorbed water is not
a state change to the absorbing cell beyond its cooldown timer, per the
atomic same-step design in research.md §2). Every element/shade/height/
count mutation `stepGrass` performs on *other* cells goes through
`setCell` (never direct array pokes), so `grid.ts`'s invariants above
always hold after `step()` returns.

## `src/sim/brush.ts` (extended)

```ts
export function forEachFootprintCell(...): void;    // unchanged
export function applyBrush(...): void;                // unchanged signature
export function applyBrushLine(...): void;             // unchanged signature
```

**`paintCell`'s extended contract** (private function, not exported):
gains one branch — `tool === 'grass' && (current === EMPTY || current ===
WATER)` → `setCell(grid, x, y, GRASS, shade)`. The `eraser` branch
(`setCell(grid, x, y, EMPTY, 0)`) is unchanged and already removes grass
along with every other element.

## `src/sim/wand.ts` (unchanged)

`applyWandCell`'s existing rule (`element !== OBJECT && element !== EMPTY`
→ `setGlitter(grid, x, y, 1)`, else attempt a sprinkle) already covers
`GRASS` with zero code change (research.md §6) — no signature or behavior
change to any exported function.

## `src/sim/objects.ts` (unchanged)

No change — object placement, rainbow conversion, and unicorn touch
detection are element-agnostic aside from `EMPTY`/`OBJECT` checks that
already treat any other element (grass included) as "occupied," matching
FR-026 ("grass never grows into an object's cells" — objects hold `OBJECT`,
which is never `EMPTY`, so `pickGrowthTargetIndex`'s emptiness check
already excludes them).

## `src/sim/resize.ts` (extended)

```ts
export function resizeGrid(
  oldGrid: Grid,
  newWidth: number,
  newHeight: number,
): { grid: Grid; offsetX: number; offsetY: number };
  // signature unchanged; copy loop extended to also carry grassHeight/
  // grassCooldown per surviving cell and accumulate the new grid's
  // grassCount as it copies
```

**Contract**: For every source index carried per the existing offset/
in-bounds/`OBJECT`-skip rule (spec 006, unchanged), also copies
`grassHeight[srcIndex]` → `grassHeight[destIndex]` and
`grassCooldown[srcIndex]` → `grassCooldown[destIndex]` unchanged, and
increments the new grid's `grassCount` once per copied `GRASS` cell (no
full-grid re-scan afterward — the count is accumulated in the same pass
that already visits every source cell). A cell's carried `grassHeight` is
**not** recomputed against its new neighbors after the offset — see
data-model.md's Root/height "stale height is conservative" validation rule
— it is a plain copy, exactly like `shades`/`hues`/`glitter` already are.

## `src/sim/scenes.ts` (extended — `generateLandscape1` only)

```ts
export function sceneRegions(...): SceneRegions;         // unchanged
export function generateLandscape1(grid: Grid, objects: ObjectsState): void;
  // extended: two additive grass-placement passes after its existing
  // hill/lake/rainbow/unicorn generation — see data-model.md's Scene
  // section for the exact placement rules
export function generateLandscape2(...): void;            // unchanged — places zero grass
export function loadScene(...): void;                      // unchanged
```

**Contract**: Both new passes call `setCell` only (never touch `elements`/
`shades` arrays directly), use only the already-computed `heights[]`/
`waterSurfaceRow`/`positionalShade` (no `Math.random()`), and never write
to a cell already holding `DIRT`/`WATER`/`OBJECT` (the hill-cap pass writes
to the previously-empty cell directly above each dry column's surface; the
shoreline-seed pass writes to the previously-empty cell directly above
each seeded flooded column's water surface) — every pre-existing spec 004
requirement for landscape-1's hills/lake/rainbow/unicorn continues to hold
unchanged.

## `src/lib/PlayArea.svelte` (extended)

**Contract**:
- Imports `GRASS` from `../sim/types`.
- Gains a `GREEN_RAMP: [number, number, number][]` constant (8 entries,
  pale-to-deep green, mirroring `PINK_RAMP`/`BLUE_RAMP`/`PURPLE_RAMP`'s
  existing shape).
- `colorFor(element, shade, hue)` gains one branch: `if (element === GRASS)
  return GREEN_RAMP[shade % GREEN_RAMP.length];` — inserted alongside the
  existing `SAND`/`WATER`/`DIRT`/`RAINBOW_SAND` branches, same position in
  the `if`-chain style already used.
- No change to `render()`'s per-cell loop, glitter-shimmer logic, or any
  other function — all already operate generically on whatever element is
  present (research.md §8).

## `src/lib/Toolbar.svelte` (extended)

**Contract**:
- `.group.elements` gains a fourth `<button>` after the existing dirt
  button: `class:selected={tool === 'grass'}`, `aria-label="Grass"`,
  `onclick={() => onSelectTool('grass')}`, glyph `🌱` — same markup pattern
  as the three existing element buttons in that group.
- No other markup, prop, or CSS change — the existing `.control`/`.group`
  styling and responsive wrap/rail rules (spec 006) apply to the new button
  automatically.

## Consumers

- `PlayArea.svelte` is the only runtime caller of `stepGrass` (indirectly,
  via `step(grid)`), `setCell`'s grass bookkeeping (indirectly, via
  `applyBrush`/`applyBrushLine`/`loadScene`/`clearGrid`), and `colorFor`'s
  new branch (via `render`). The existing per-frame loop (`step` →
  `applyRainbowConversions` → `updateUnicorns` → `tickParticles` →
  `updateFlashMask` → `render`) is unaware grass exists as a concept — it
  simply calls `step`, which now also resolves grass absorption/growth as
  part of its single pass, exactly as it's already unaware of the
  wand/eraser/rainbow-conversion rules it also triggers indirectly.
- `tests/unit/sim/grass.test.ts` (new) imports `createGrid`/`setCell`/
  `getElement`/`getShade` from `grid.ts`, `step` from `step.ts`, `GRASS`/
  `WATER`/`EMPTY` from `types.ts` — no DOM — and asserts the
  absorption/growth/ceiling/pacing contract above directly against `Grid`
  state across repeated `step()` calls (FR-035).
- `tests/unit/sim/grid.test.ts`, `brush.test.ts`, `wand.test.ts`,
  `resize.test.ts`, `scenes.test.ts` each gain a small number of grass-
  specific cases exercising the extensions documented above in their
  respective sections; every existing case in each file is unaffected
  (FR-033) — none of them import a removed or renamed export.
- `tests/unit/lib/layout.test.ts`'s `TOOLBAR_CONTROL_COUNT` constant moves
  from `14` to `15` (research.md §7) — its own assertions (fit, control
  size, drawing-region fill) are otherwise unchanged in shape.
