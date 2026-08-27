# Contract: Star power mechanics (extends prior specs' `src/sim/*`/`src/lib/*` contracts)

This project has no network API. As in `specs/007-water-drinking-grass/
contracts/grass-mechanics.md` (which itself extends 001–006's), the
interface contract that matters is the boundary between the framework-free
simulation core (`src/sim/*`), the UI-layer helpers (`src/lib/*`), the
Svelte shell that calls both, and the `vitest` unit tests that exercise
`src/sim/*` functions directly with no DOM (constitution Principle V,
FR-038). This document is purely additive or signature-widening except
where explicitly noted — every function listed in prior contracts not
mentioned here is unchanged.

## `src/sim/types.ts` (extended)

```ts
export const STAR_POWER = 7;

export type Element =
  | typeof EMPTY
  | typeof SAND
  | typeof WATER
  | typeof DIRT
  | typeof RAINBOW_SAND
  | typeof OBJECT
  | typeof GRASS
  | typeof STAR_POWER;

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
  readonly starPowerAge: Uint8Array;       // new — steps since creation, meaningful only where elements[i] === STAR_POWER
  readonly starPowerLife: Uint8Array;      // new — total burn life (30-60), fixed at creation, meaningful only where elements[i] === STAR_POWER
  readonly starPowerFuelled: Uint8Array;   // new — 0 or 1: was this cell ignited from grass?
}

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

**Contract**: `starPowerAge`/`starPowerLife`/`starPowerFuelled` follow the
array's existing `readonly` convention (the array *reference* is fixed for
the `Grid`'s life; contents are mutated in place). No new plain mutable
number field is added (unlike `grassCount`) — star power has no field-wide
running total to maintain (research.md §2).

## `src/sim/element.ts` (extended)

```ts
export function isPowder(e: number): boolean;   // unchanged
export function isLiquid(e: number): boolean;    // unchanged
export function isSolid(e: number): boolean;      // extended: isPowder(e) || e === GRASS || e === STAR_POWER
```

**Contract**: `isSolid`'s only consumer remains `step.ts`'s grass
sideways-growth support check (unchanged call sites) — research.md §12.

## `src/sim/shade.ts` (extended)

```ts
export function randomShade(): number;             // unchanged
export function randomBurnLife(): number;            // new — integer in [30, 60] inclusive (FR-007)
export function randomHue(): number;                  // new — moved here from objects.ts; integer in [0, 256)
```

**Contract**: `randomHue()` replaces `objects.ts`'s previously-private,
identically-behaved helper of the same name — `objects.ts`'s
`applyRainbowConversions` now imports it from `shade.ts` instead of
defining its own copy (research.md §6). No behavior change to
`applyRainbowConversions`.

## `src/sim/grid.ts` (extended)

```ts
export function createGrid(width: number, height: number): Grid;
  // extended: also allocates starPowerAge/starPowerLife/starPowerFuelled
  // as zero-filled Uint8Array(width * height)

export function setCell(grid: Grid, x: number, y: number, element: number, shade: number): void;
  // extended: in addition to its existing writes (elements/shades/glitter,
  // grassHeight/grassCooldown/grassCount from spec 007), also sets
  // starPowerAge[i] = 0 on every call, and starPowerLife[i] = 0 /
  // starPowerFuelled[i] = 0 whenever element !== STAR_POWER — see below

export function clearGrid(grid: Grid): void;
  // extended: in addition to its existing fills, also fills
  // starPowerAge/starPowerLife/starPowerFuelled to 0

export function igniteStarPower(grid: Grid, x: number, y: number, fuelled: boolean): void;
  // new — the only way a star power cell is created. No-op if (x, y) is
  // out of bounds. See contract below.

// unchanged: inBounds, getElement, getShade, setGlitter, getGlitter
```

**`setCell` extended contract** (applies on every call, for every
`element`, not just `STAR_POWER` — appended to spec 007's existing steps):

5. Set `starPowerAge[i] = 0`.
6. If `element !== STAR_POWER`: set `starPowerLife[i] = 0` and
   `starPowerFuelled[i] = 0`. Otherwise (becoming star power): leave
   `starPowerLife[i]`/`starPowerFuelled[i]` as they are — the caller
   (`igniteStarPower`, below) sets both immediately after `setCell`
   returns, in the same synchronous call.

`clearGrid`'s extended contract: existing fills (unchanged), plus
`starPowerAge.fill(0)`, `starPowerLife.fill(0)`,
`starPowerFuelled.fill(0)` (new).

**`igniteStarPower(grid, x, y, fuelled)` contract**:

1. If `!inBounds(grid, x, y)`, return — no-op.
2. Call `setCell(grid, x, y, STAR_POWER, randomShade())`.
3. Let `i = y * grid.width + x`. Set `starPowerFuelled[i] = fuelled ? 1 :
   0` and `starPowerLife[i] = randomBurnLife()`.
4. Call `setGlitter(grid, x, y, 1)` (twinkle — research.md §7).

**Invariant**: for every index where `elements[i] !== STAR_POWER`,
`starPowerAge[i] === starPowerLife[i] === starPowerFuelled[i] === 0` —
maintained by construction (every write that ends a cell's time as star
power goes through `setCell`, which zeroes all three; the only way to
*become* star power is `igniteStarPower`, which always sets a nonzero
`starPowerLife`).

## `src/sim/step.ts` (extended — internal additions, exported surface unchanged)

```ts
export function step(grid: Grid): void;
  // extended dispatcher: element === STAR_POWER now calls a new private
  // stepStarPower(grid, x, y, i) branch, alongside the existing
  // isPowder/isLiquid/GRASS branches — no change to step's own signature
  // or to stepPowder/stepLiquid/stepGrass themselves
```

**New private constant** (not exported):

```ts
const STAR_POWER_IGNITE_DELAY = 10;  // FR-011
```

**New private functions** (not exported — internal to `step.ts`, covered
by `tests/unit/sim/starPower.test.ts` via `step`'s own public behavior,
not by importing them directly):

- `stepStarPower(grid, x, y, i)`: see data-model.md's "Quench event" /
  "Burnout event" / "Ignition event" tables for the full precondition/
  effect contract. Allocation-free (no object/array literals) — plain
  index arithmetic, an `if`/`else if` chain for the four-neighbor quench
  scan, and a small nested `for` loop over the eight neighbors for
  ignition (research.md §5).
- `extinguishStarPower(grid, x, y, i)`: implements both the Quench and
  Burnout events' shared outcome table — `starPowerFuelled[i]` truthy →
  `setCell(grid, x, y, RAINBOW_SAND, randomShade())`, `hues[i] =
  randomHue()`, `setGlitter(grid, x, y, 1)`; falsy → `setCell(grid, x, y,
  EMPTY, 0)` (research.md §6).

**Contract**: `stepStarPower` never mutates the water cell that quenches
it (FR-017) — the quench check only reads `elements[waterIndex]`. Every
element/shade/hue/glitter mutation `stepStarPower`/`extinguishStarPower`
perform on any cell goes through `setCell`/`setGlitter`/`igniteStarPower`
(never direct array pokes), so `grid.ts`'s invariants above always hold
after `step()` returns.

## `src/sim/brush.ts` (extended)

```ts
export function forEachFootprintCell(...): void;    // unchanged
export function applyBrush(...): void;                // unchanged signature
export function applyBrushLine(...): void;             // unchanged signature
```

**`paintCell`'s extended contract** (private function, not exported):
gains two branches — `tool === 'star' && current === EMPTY` →
`igniteStarPower(grid, x, y, false)`; `tool === 'star' && current ===
GRASS` → `igniteStarPower(grid, x, y, true)`. No branch is added for any
other `current` value (`WATER`, `SAND`, `DIRT`, `RAINBOW_SAND`, `OBJECT`,
or an already-`STAR_POWER` cell) — the existing `if`/`else if` chain
already does nothing for values that match no branch (FR-005, FR-018).
The `eraser` branch is unchanged and already removes star power along
with every other element.

## `src/sim/wand.ts` (extended — the one genuinely necessary change)

```ts
export function applyWand(...): void;                        // unchanged signature
export function applyWandLine(...): void;                     // unchanged signature
export function unicornsTouchedByWandLine(...): void;          // unchanged
```

**`applyWandCell`'s extended contract** (private function, not exported):
gains one early return, inserted before the existing generic-glitter
rule: `if (element === OBJECT || element === STAR_POWER) return;`. The
existing `else if (isSprinkleSite(x, y))` sprinkle branch is unchanged
and was never reachable for a star-power-occupied cell regardless (it
only triggers when `element === EMPTY`) — research.md §9, FR-027.

## `src/sim/objects.ts` (unchanged)

No change — object placement, rainbow conversion (`SAND`/`DIRT`/`WATER`
only), and unicorn touch detection (`!== EMPTY && !== OBJECT`) are
already element-agnostic in exactly the way that leaves `STAR_POWER`
correctly untouched by conversion and correctly counted as "touching" for
celebration purposes, with zero code change (research.md §10, FR-028).
`applyRainbowConversions` imports `randomHue` from `shade.ts` instead of
defining it locally (research.md §6) — a call-site change, not a
behavior change.

## `src/sim/resize.ts` (extended)

```ts
export function resizeGrid(
  oldGrid: Grid,
  newWidth: number,
  newHeight: number,
): { grid: Grid; offsetX: number; offsetY: number };
  // signature unchanged; copy loop extended to also carry starPowerAge/
  // starPowerLife/starPowerFuelled per surviving cell
```

**Contract**: For every source index carried per the existing offset/
in-bounds/`OBJECT`-skip rule (spec 006, unchanged), also copies
`starPowerAge[srcIndex]` → `starPowerAge[destIndex]`,
`starPowerLife[srcIndex]` → `starPowerLife[destIndex]`, and
`starPowerFuelled[srcIndex]` → `starPowerFuelled[destIndex]` unchanged
(research.md §11) — a plain copy, exactly like `shades`/`hues`/`glitter`/
`grassHeight`/`grassCooldown` already are. No new counter accumulation is
needed (there is no `starPowerCount`).

## `src/sim/scenes.ts` (unchanged)

No change — neither `generateLandscape1` nor `generateLandscape2` ever
calls `igniteStarPower` or writes `STAR_POWER` (FR-030); `loadScene`'s
existing `clearGrid` call already wipes any star power from a
previously-live field before generating the chosen scene's contents
(research.md §10).

## `src/lib/PlayArea.svelte` (extended)

**Contract**:
- Imports `STAR_POWER` from `../sim/types`.
- Gains a `GOLD_RAMP: [number, number, number][]` constant (8 entries,
  pale-yellow to warm gold, mirroring `PINK_RAMP`/`GREEN_RAMP`'s existing
  shape).
- `colorFor(element, shade, hue)` gains one branch: `if (element ===
  STAR_POWER) return GOLD_RAMP[shade % GOLD_RAMP.length];` — inserted
  alongside the existing `SAND`/`WATER`/`DIRT`/`RAINBOW_SAND`/`GRASS`
  branches, same position in the `if`-chain style already used.
- No change to `render()`'s per-cell loop, glitter-shimmer logic, or any
  other function — star power's twinkle is produced entirely by
  `igniteStarPower` setting `glitter[i] = 1` at creation time
  (research.md §7); `render()` already applies its shimmer/flash-cap
  boost to any cell with `glitter[i] === 1`, regardless of element.

## `src/lib/Toolbar.svelte` (extended)

**Contract**:
- `.group.elements` gains a fifth `<button>` after the existing grass
  button: `class:selected={tool === 'star'}`, `aria-label="Star power"`,
  `onclick={() => onSelectTool('star')}`, glyph `⭐` — same markup pattern
  as the four existing element buttons in that group.
- No other markup, prop, or CSS change — the existing `.control`/`.group`
  styling and responsive wrap/rail rules (spec 006) apply to the new
  button automatically.

## Consumers

- `PlayArea.svelte` is the only runtime caller of `stepStarPower`
  (indirectly, via `step(grid)`), `igniteStarPower`/`setCell`'s
  star-power bookkeeping (indirectly, via `applyBrush`/`applyBrushLine`),
  and `colorFor`'s new branch (via `render`). The existing per-frame loop
  (`step` → `applyRainbowConversions` → `updateUnicorns` →
  `tickParticles` → `updateFlashMask` → `render`) is unaware star power
  exists as a concept — it simply calls `step`, which now also resolves
  quenching/burnout/ignition as part of its single pass, and `render`,
  whose existing glitter-shimmer branch already covers star power's
  twinkle with zero new awareness.
- `tests/unit/sim/starPower.test.ts` (new) imports `createGrid`/
  `setCell`/`igniteStarPower`/`getElement`/`getShade`/`getGlitter` from
  `grid.ts`, `step` from `step.ts`, `randomBurnLife` from `shade.ts`,
  `STAR_POWER`/`GRASS`/`WATER`/`EMPTY`/`RAINBOW_SAND` from `types.ts` —
  no DOM — and asserts the quench/burnout/ignition contract above
  directly against `Grid` state across repeated `step()` calls (FR-038).
- `tests/unit/sim/grid.test.ts`, `brush.test.ts`, `wand.test.ts`,
  `resize.test.ts`, `scenes.test.ts` each gain a small number of
  star-power-specific cases exercising the extensions documented above
  in their respective sections; every existing case in each file is
  unaffected (FR-036) — none of them import a removed or renamed export
  (`objects.ts`'s local `randomHue` is removed, but it was never
  exported, so no test imports it directly).
- `tests/unit/lib/layout.test.ts`'s `TOOLBAR_CONTROL_COUNT` constant
  moves from `15` to `16` (research.md §13) — its own assertions (fit,
  control size, drawing-region fill) are otherwise unchanged in shape.
