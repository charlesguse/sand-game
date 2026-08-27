# Contract: Weather mechanics (extends prior specs' `src/sim/*`/`src/lib/*` contracts)

This project has no network API. As in `specs/008-star-power-burns-grass/
contracts/star-power-mechanics.md` (which itself extends 001–007's), the
interface contract that matters is the boundary between the framework-free
simulation core (`src/sim/*`), the UI-layer helpers (`src/lib/*`), the
Svelte shell that calls both, and the `vitest` unit tests that exercise
`src/sim/*` functions directly with no DOM (constitution Principle V,
FR-042). This document is purely additive or signature-widening except
where explicitly noted — every function listed in prior contracts not
mentioned here is unchanged.

## `src/sim/types.ts` (extended)

```ts
export const FOG = 8;

export type Element =
  | typeof EMPTY
  | typeof SAND
  | typeof WATER
  | typeof DIRT
  | typeof RAINBOW_SAND
  | typeof OBJECT
  | typeof GRASS
  | typeof STAR_POWER
  | typeof FOG;

export interface Grid {
  readonly width: number;
  readonly height: number;
  readonly elements: Uint8Array;
  readonly shades: Uint8Array;
  readonly moved: Uint8Array;
  readonly hues: Uint8Array;
  readonly glitter: Uint8Array;
  readonly grassHeight: Uint8Array;
  readonly grassCooldown: Uint8Array;
  grassCount: number;
  readonly starPowerAge: Uint8Array;
  readonly starPowerLife: Uint8Array;
  readonly starPowerFuelled: Uint8Array;
  readonly cloud: Uint8Array;              // new — 0/1: is this FOG cell a gathered cloud?
  readonly fogRiseCooldown: Uint8Array;    // new — steps until next rise attempt (fog only)
  readonly fogStuckSteps: Uint16Array;     // new — consecutive steps unable to rise (fog only)
  readonly fogAge: Uint16Array;             // new — steps in current sub-state (fog: vs FOG_MAX_LIFE; cloud: vs cloudRainDelay)
  readonly cloudRainDelay: Uint16Array;     // new — this cloud cell's own hold time (cloud only)
  fogCloudCount: number;                     // new — running total of FOG-element cells, like grassCount
}

// Tool is UNCHANGED — no new toolbar control (FR-027). The existing 'star'
// tool gains a new current-dependent brush behavior (see brush.ts, below)
// without any change to this type.
export type Tool =
  | 'sand'
  | 'water'
  | 'dirt'
  | 'grass'
  | 'star'
  | 'rainbow'
  | 'unicorn'
  | 'eraser'
  | 'wand';
```

**Contract**: `cloud`/`fogRiseCooldown`/`fogStuckSteps`/`fogAge`/
`cloudRainDelay` follow the array's existing `readonly` convention (the
array *reference* is fixed for the `Grid`'s life; contents are mutated in
place). `fogCloudCount` is a plain mutable `number`, exactly like
`grassCount` — not `readonly`.

## `src/sim/element.ts` (unchanged)

```ts
export function isPowder(e: number): boolean;   // unchanged
export function isLiquid(e: number): boolean;    // unchanged
export function isSolid(e: number): boolean;      // unchanged — already excludes FOG (FR-004)
```

**Contract**: No change. `FOG` is deliberately excluded from every one of
these three predicates — it is neither a powder, a liquid, nor solid/
supporting ground (research.md §1, data-model.md's "Element" section).

## `src/sim/shade.ts` (extended)

```ts
export function randomShade(): number;                 // unchanged
export function randomBurnLife(): number;                // unchanged
export function randomHue(): number;                      // unchanged
export function randomFogRiseCooldown(): number;           // new — integer in [3, 5] inclusive (FR-012)
export function randomCloudRainDelay(): number;             // new — integer in [180, 480] inclusive (FR-020)
```

## `src/sim/grid.ts` (extended)

```ts
export function createGrid(width: number, height: number): Grid;
  // extended: also allocates cloud/fogRiseCooldown/fogStuckSteps/fogAge/
  // cloudRainDelay as zero-filled typed arrays, and initializes
  // fogCloudCount = 0

export function setCell(grid: Grid, x: number, y: number, element: number, shade: number): void;
  // extended: in addition to its existing writes (elements/shades/glitter,
  // grass and star-power bookkeeping from specs 007/008), also maintains
  // fogCloudCount (mirroring grassCount) and zeroes cloud/fogRiseCooldown/
  // fogStuckSteps/fogAge/cloudRainDelay whenever element !== FOG — see below

export function clearGrid(grid: Grid): void;
  // extended: in addition to its existing fills, also fills cloud/
  // fogRiseCooldown/fogStuckSteps/fogAge/cloudRainDelay to 0 and resets
  // fogCloudCount = 0

export function createFog(grid: Grid, x: number, y: number): boolean;
  // new — the only way a fog cell is created. Returns false (no-op) if
  // (x, y) is out of bounds or the FR-011 sky limit (fogCloudCount >=
  // floor(width * height * FOG_FIELD_SHARE_CEILING)) is already reached;
  // otherwise creates the cell and returns true. See contract below.

// unchanged: inBounds, getElement, getShade, setGlitter, getGlitter,
// igniteStarPower
```

**New exported constant**:

```ts
export const FOG_FIELD_SHARE_CEILING = 0.20;  // FR-011
```

**`setCell` extended contract** (applies on every call, for every
`element`, not just `FOG` — appended to spec 008's existing steps):

7. Track `wasFog = elements[i] === FOG` (before the write) and `becomesFog
   = element === FOG` (the value being written); increment `fogCloudCount`
   if `becomesFog && !wasFog`, decrement if `!becomesFog && wasFog` —
   mirroring `grassCount`'s existing bookkeeping exactly.
8. If `element !== FOG`: set `cloud[i] = 0`, `fogRiseCooldown[i] = 0`,
   `fogStuckSteps[i] = 0`, `fogAge[i] = 0`, `cloudRainDelay[i] = 0`.
   Otherwise (becoming `FOG`): leave all five as they are — the caller
   (`createFog`, below) sets the fog-specific ones itself immediately
   after `setCell` returns, in the same synchronous call.

`clearGrid`'s extended contract: existing fills (unchanged), plus
`cloud.fill(0)`, `fogRiseCooldown.fill(0)`, `fogStuckSteps.fill(0)`,
`fogAge.fill(0)`, `cloudRainDelay.fill(0)`, `fogCloudCount = 0` (new).

**`createFog(grid, x, y)` contract**:

1. If `!inBounds(grid, x, y)`, return `false` — no-op.
2. If `grid.fogCloudCount >= Math.floor(grid.width * grid.height *
   FOG_FIELD_SHARE_CEILING)`, return `false` — no-op (FR-011: the sky is
   full; the water stays water).
3. Call `setCell(grid, x, y, FOG, randomShade())`.
4. Let `i = y * grid.width + x`. Set `cloud[i] = 0`, `fogRiseCooldown[i] =
   randomFogRiseCooldown()`, `fogStuckSteps[i] = 0`, `fogAge[i] = 0`.
5. Call `setGlitter(grid, x, y, 1)` (twinkle — research.md §8).
6. Return `true`.

**Invariant**: for every index where `elements[i] !== FOG`, `cloud[i] ===
fogRiseCooldown[i] === fogStuckSteps[i] === fogAge[i] === cloudRainDelay[i]
=== 0` — maintained by construction (every write that ends a cell's time
as `FOG` goes through `setCell`, which zeroes all five; the only way to
*become* `FOG` is `createFog`, which always sets a nonzero
`fogRiseCooldown`). `grid.fogCloudCount === ` the number of indices where
`elements[i] === FOG`, maintained by `setCell` and by the one direct-write
consumer that bypasses it (`applyRainbowConversions`, below).

## `src/sim/step.ts` (extended — internal additions, exported surface unchanged)

```ts
export function step(grid: Grid): void;
  // extended dispatcher: element === FOG now calls a new private
  // stepFog(grid, x, y, i) branch, alongside the existing isPowder/
  // isLiquid/GRASS/STAR_POWER branches — no change to step's own
  // signature. stepStarPower is extended (see below); stepPowder/
  // stepLiquid/stepGrass keep their existing signatures but each gains one
  // new fall-through condition (see below).
```

**New private constants** (not exported):

```ts
const FOG_MAX_LIFE = 1800;   // FR-016 — total lifetime as fog before forced condensation
const FOG_STUCK_LIMIT = 300; // FR-016 — consecutive steps unable to rise before condensation
```

**`moveCell`/`swapCells` extended contract** (private, used by
`stepPowder`/`stepLiquid`/`stepFog`): each now also copies/swaps `cloud`,
`fogRiseCooldown`, `fogStuckSteps`, `fogAge`, `cloudRainDelay` between the
two indices, using the same copy-then-zero-the-source pattern already used
for `elements`/`shades`/`hues`/`glitter` (research.md §9). No change to
either function's call sites in `stepPowder`/`stepLiquid`.

**`stepPowder`/`stepLiquid` extended contract**: `stepPowder`'s existing
"directly below is a liquid → swap" condition gains `|| elements[
belowIndex] === FOG`; `stepLiquid` gains a new `else if (belowInBounds &&
elements[belowIndex] === FOG) swapCells(...)` branch alongside its existing
`EMPTY`-only case. Neither function's diagonal-below checks change
(research.md §10, FR-004).

**`stepStarPower` extended contract**: its existing four-neighbor quench
scan now remembers *which* neighbor index matched `WATER`
(`quenchWaterIndex`, or `-1` if none), matching `stepGrass`'s own
`waterIndex` pattern, instead of a boolean `quenched` flag. When a match is
found: read `fuelled = starPowerFuelled[i] === 1` *before* calling the
existing (unchanged) `extinguishStarPower(grid, x, y, i)`; then, only if
`!fuelled`, call `createFog(grid, quenchWaterIndex % width, Math.floor(
quenchWaterIndex / width))` and, if it returned `true`, set `grid.moved[
quenchWaterIndex] = 1` (research.md §7). `extinguishStarPower` itself is
**unchanged**.

**New private functions** (not exported — internal to `step.ts`, covered
by `tests/unit/sim/weather.test.ts` via `step`'s own public behavior, not
by importing them directly):

- `stepFog(grid, x, y, i)`: dispatches on `cloud[i]` — `1` calls
  `stepCloud`, `0` runs the fog logic (lifetime check → cooldown →
  sky-ceiling/cloud-above precedence → wander-rise). See data-model.md's
  "Rise event" / "Wander" / "Condense event" / "Become-cloud event" tables
  for the full precondition/effect contract. Allocation-free (no object/
  array literals) — plain index arithmetic and `if`/`else if` chains,
  matching `stepStarPower`'s existing discipline.
- `stepCloud(grid, x, y, i)`: increments `fogAge[i]`; if it reaches
  `cloudRainDelay[i]`, calls `rain(grid, x, y, i)`. Never calls
  `moveCell`/`swapCells` (FR-018).
- `becomeCloud(grid, x, y, i)`: sets `cloud[i] = 1`, `fogAge[i] = 0`,
  `cloudRainDelay[i] = randomCloudRainDelay()`, `fogRiseCooldown[i] = 0`,
  `fogStuckSteps[i] = 0`. Does not call `setCell` (`elements[i]` is
  already `FOG` and stays `FOG`) and therefore does not change
  `fogCloudCount`.
- `condenseFog(grid, x, y, i)`: `setCell(grid, x, y, WATER,
  randomShade())` (FR-016).
- `rain(grid, x, y, i)`: `setCell(grid, x, y, WATER, randomShade())`
  (FR-020/FR-021) — functionally identical to `condenseFog`, kept as a
  separate, similarly-named function for readability at each call site.

**Contract**: none of `stepFog`/`stepCloud`/`becomeCloud`/`condenseFog`/
`rain` ever mutates a cell other than the fog/cloud cell's own index and,
during a rise, the single candidate index it moves/swaps into — every
mutation goes through `setCell`/`setGlitter`/`moveCell`/`swapCells`/
`createFog` (never direct array pokes), so `grid.ts`'s invariants (above)
always hold after `step()` returns.

## `src/sim/brush.ts` (extended)

```ts
export function forEachFootprintCell(...): void;    // unchanged
export function applyBrush(...): void;                // unchanged signature
export function applyBrushLine(...): void;             // unchanged signature
```

**`paintCell`'s extended contract** (private function, not exported): a
`paintable = current === EMPTY || current === FOG` value is computed once
per call and substituted for every existing branch's previous `current ===
EMPTY` check (sand/dirt/grass keep their additional `|| current ===
WATER` allowance unchanged; water/star's checks become `paintable`). One
new branch is added: `tool === 'star' && current === WATER` → `createFog(
grid, x, y)` (ignoring the boolean result). The existing `star` + `GRASS`
branch (`igniteStarPower(grid, x, y, true)`) is unchanged. The `eraser`
branch is unchanged and already removes fog/cloud along with every other
element via `setCell`'s generic reset (FR-026, FR-028).

## `src/sim/wand.ts` (extended)

```ts
export function applyWand(...): void;                        // unchanged signature
export function applyWandLine(...): void;                     // unchanged signature
export function unicornsTouchedByWandLine(...): void;          // unchanged
```

**`applyWandCell`'s extended contract** (private function, not exported):
its early-return condition becomes `if (element === OBJECT || element ===
STAR_POWER || element === FOG) return;` — one more value added to the
existing skip check (research.md §12, FR-030).

## `src/sim/objects.ts` (extended — one small addition)

```ts
export function createObjectsState(...): ObjectsState;         // unchanged
export function applyRainbowConversions(grid: Grid, rainbows: PlacedObject[]): void;
  // extended: the per-cell condition gains `|| element === FOG`; converting
  // a FOG cell also decrements grid.fogCloudCount (research.md §13, FR-031)
export function placeObject(...): void;                        // unchanged
export function removeObject(...): void;                       // unchanged
export function isUnicornTouched(...): boolean;                 // unchanged — already covers FOG (FR-031)
export function footprintIntersectsCircle(...): boolean;         // unchanged
export function eraseObjectsInBrush(...): void;                   // unchanged
export function eraseObjectsInBrushLine(...): void;                // unchanged
export function clearObjects(...): void;                            // unchanged
```

**Contract**: `applyRainbowConversions` writes `grid.elements[i] =
RAINBOW_SAND` directly (not via `setCell`, exactly as it already does for
`SAND`/`DIRT`/`WATER`) and, when the cell being converted was `FOG`, also
decrements `fogCloudCount` immediately beforehand — the one piece of
bookkeeping this direct-write path needs that the other three converted
elements never required.

## `src/sim/resize.ts` (extended)

```ts
export function resizeGrid(
  oldGrid: Grid,
  newWidth: number,
  newHeight: number,
): { grid: Grid; offsetX: number; offsetY: number };
  // signature unchanged; copy loop extended to also carry cloud/
  // fogRiseCooldown/fogStuckSteps/fogAge/cloudRainDelay per surviving
  // cell, and to increment fogCloudCount for each carried FOG cell
```

**Contract**: For every source index carried per the existing offset/
in-bounds/`OBJECT`-skip rule (spec 006, unchanged), also copies the five
new fields unchanged (research.md §14) — a plain copy, exactly like
`shades`/`hues`/`glitter`/`grassHeight`/`grassCooldown`/`starPowerAge`
already are — and increments the new grid's `fogCloudCount` for every
carried cell whose `elements[srcIndex] === FOG`, mirroring the existing
`grassCount` accumulation line.

## `src/sim/scenes.ts` (unchanged)

No change — neither `generateLandscape1` nor `generateLandscape2` ever
calls `createFog` or writes `FOG` (FR-035); `loadScene`'s existing
`clearGrid` call already wipes any fog/cloud (and resets `fogCloudCount`)
from a previously-live field before generating the new scene's contents
(research.md §15).

## `src/lib/PlayArea.svelte` (extended)

**Contract**:
- Imports `FOG` from `../sim/types`.
- Gains two new `[number, number, number][]` constants, `FOG_RAMP` and
  `CLOUD_RAMP` (8 entries each, mirroring `PINK_RAMP`/`GOLD_RAMP`'s
  existing shape — research.md §17).
- `colorFor(element, shade, hue, isCloud)` gains a fourth parameter and one
  new branch: `if (element === FOG) return isCloud ? CLOUD_RAMP[shade %
  CLOUD_RAMP.length] : FOG_RAMP[shade % FOG_RAMP.length];` — inserted
  alongside the existing `SAND`/`WATER`/`DIRT`/`RAINBOW_SAND`/`GRASS`/
  `STAR_POWER` branches.
- `render()`'s per-cell loop destructures `cloud` from `grid` alongside its
  existing fields and passes `cloud[i] === 1` as `colorFor`'s new fourth
  argument.
- No other change to `render()`, the glitter-shimmer logic, or any other
  function — fog/cloud's twinkle is produced entirely by `createFog`/
  `becomeCloud`'s carrying-forward of `glitter[i] = 1` (research.md §8);
  `render()` already applies its shimmer/flash-cap boost to any cell with
  `glitter[i] === 1`, regardless of element.

## `src/lib/Toolbar.svelte` (unchanged)

No change — this feature adds no toolbar control (FR-027, research.md
§16).

## `src/lib/layout.ts` (unchanged)

No change — `TOOLBAR_CONTROL_COUNT`-style constants live only in the test
file (as before) and are unaffected, since no control is added.

## Consumers

- `PlayArea.svelte` is the only runtime caller of `stepFog`/`stepCloud`
  (indirectly, via `step(grid)`), `createFog`'s bookkeeping (indirectly,
  via `applyBrush`/`applyBrushLine`'s `star`-tool-on-`WATER` path and, via
  `step`, the star-power quench path), and `colorFor`'s new branch (via
  `render`). The existing per-frame loop (`step` → `applyRainbowConversions`
  → `updateUnicorns` → `tickParticles` → `updateFlashMask` → `render`) is
  otherwise unaware fog/cloud exist as a concept — it simply calls `step`,
  which now also resolves rising/wandering/gathering/raining as part of its
  single pass, and `render`, whose existing glitter-shimmer branch already
  covers fog/cloud's twinkle with zero new awareness.
- `tests/unit/sim/weather.test.ts` (new) imports `createGrid`/`setCell`/
  `createFog`/`getElement`/`getShade`/`getGlitter` from `grid.ts`, `step`
  from `step.ts`, `randomFogRiseCooldown`/`randomCloudRainDelay` from
  `shade.ts`, `FOG`/`WATER`/`EMPTY`/`GRASS`/`STAR_POWER`/`RAINBOW_SAND` from
  `types.ts` — no DOM — and asserts the charming/rise/wander/condense/
  become-cloud/rain/conservation/settling contract above directly against
  `Grid` state across repeated `step()` calls (FR-042).
- `tests/unit/sim/grid.test.ts`, `brush.test.ts`, `wand.test.ts`,
  `objects.test.ts`, `resize.test.ts`, `scenes.test.ts`,
  `starPower.test.ts` each gain a small number of fog/cloud-specific cases
  exercising the extensions documented above in their respective sections;
  every existing case in each file is unaffected (FR-040) except
  `starPower.test.ts`'s one superseded assertion (research.md §18).
- `tests/unit/lib/layout.test.ts` and `tests/unit/sim/grass.test.ts`/
  `step.test.ts` need **no** change (research.md §16, §18) — the one
  concrete difference from spec 008's own project structure, since this
  feature adds no toolbar control.
