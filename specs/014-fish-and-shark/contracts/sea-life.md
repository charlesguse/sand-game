# Contract: `src/sim/seaLife.ts`

This is the one new production module this feature adds. It follows the
same contract shape `src/sim/pets.ts` established for `PetsState`/
`Poodle`: a plain-TypeScript state container plus free functions that
take it and a `Grid` as parameters — no classes, no hidden module-level
state, nothing that would need a DOM or canvas to unit test.

## Types

```ts
export interface Fish {
  readonly id: number;
  x: number;
  y: number;
  dirX: -1 | 0 | 1;
  dirY: -1 | 0 | 1;
  bobPhase: number;
  turnCooldown: number;
  scatterTimer: number;
  fadeTimer: number;
}

export interface Shark {
  readonly id: number;
  x: number;
  y: number;
  facing: 1 | -1;
  targetFishId: number | null;
  chaseTimer: number;
  cruiseCooldown: number;
  fadeTimer: number;
}

export interface SeaLifeState {
  fish: Fish[];
  sharks: Shark[];
  nextId: number;
  poolId: Int32Array;
  poolSize: number[];
  spawnSample: number[][];
  sweepQueue: Int32Array;
  sweepQueueHead: number;
  sweepQueueTail: number;
  sweepCursor: number;
  sweepNextLabel: number;
  sweepBudget: number;
  eraserCooldowns: { x: number; y: number; framesRemaining: number }[];
}
```

## Constants (exported, so tests can reference them rather than
duplicating magic numbers — the same pattern `pets.ts` uses for
`POODLE_CAP`, `WANDER_RANGE`, etc.)

| Constant | Value | FR |
|---|---|---|
| `FISH_SPAWN_THRESHOLD` | `120` | FR-003 |
| `FISH_DESPAWN_THRESHOLD` | `110` | Edge Cases (hysteresis, research.md §4) |
| `SHARK_SPAWN_THRESHOLD` | `700` | FR-005 |
| `SHARK_DESPAWN_THRESHOLD` | `690` | Edge Cases |
| `FISH_PER_POOL_CAP` | `3` | FR-004 |
| `SHARK_PER_POOL_CAP` | `1` | FR-005 |
| `GLOBAL_FISH_CAP` | `6` | FR-006 |
| `GLOBAL_SHARK_CAP` | `2` | FR-006 |
| `SHARK_MIN_SEPARATION` | `2` | FR-017 |
| `ERASER_HOLD_OFF_FRAMES` | `180` (≈3s @60fps) | FR-025 |
| `SWEEP_TARGET_FRAMES` | `45` | FR-007, FR-022, FR-032 |

## Functions

### `createSeaLifeState(grid: Grid): SeaLifeState`

Allocates a new state sized to `grid`'s current dimensions, with no fish
or sharks and the sweep starting from cell 0. Called once, at the same
point `PlayArea.svelte` calls `createPetsState()`.

**Postconditions**: `state.fish.length === 0`, `state.sharks.length ===
0`, `state.poolId.length === grid.width * grid.height` (every entry
`-1`), `state.sweepCursor === 0`.

### `resetSeaLifeState(state: SeaLifeState, grid: Grid): void`

Reallocates `poolId`/`sweepQueue` to `grid`'s (possibly new) dimensions,
clears `fish`, `sharks`, and `eraserCooldowns`, and restarts the sweep
from cell 0. Mutates `state` in place (does not return a new object),
matching `resizeGrid`'s caller pattern where `PlayArea.svelte` already
holds one long-lived `petsState`/`objectsState` object across a
re-derivation.

**Called from** (every place `PlayArea.svelte` replaces or restores
`grid`'s contents wholesale, since fish/sharks are never saved or
undo-tracked, FR-027/FR-029):
- Grid resize / fullscreen re-derivation (alongside `repositionPoodles`)
- Loading a saved world at startup
- Undo / redo (`restoreWorldState`)
- Scene switch

**Postconditions**: same as `createSeaLifeState`, applied to the existing
`state` object (its identity is preserved — callers do not need to
re-bind their reference).

### `stepSeaLife(grid: Grid, state: SeaLifeState): void`

Advances the whole feature by one frame:

1. Decrement every `eraserCooldowns` entry's `framesRemaining`; drop
   entries that reach 0.
2. Advance the pool sweep by up to `state.sweepBudget` cells (research.md
   §1). If this call completes a full sweep, run the population
   reconciliation (research.md §4) — spawning into `state.fish`/
   `state.sharks` and starting `fadeTimer` countdowns as needed — then
   reset the sweep to begin again immediately.
3. Step every fish: fade-out countdown if `fadeTimer > 0` (removing it
   from `state.fish` once it reaches 0); otherwise check its current
   cell is still water (start fading immediately if not, research.md §2);
   otherwise advance `scatterTimer`/`turnCooldown`/`bobPhase` and move.
4. Step every shark: same fade/water-check pattern; otherwise chase-AI
   (research.md §6) and movement respecting `SHARK_MIN_SEPARATION`
   against every live fish (not just its target).

**Preconditions**: `state.poolId.length === grid.width * grid.height`
(guaranteed by `createSeaLifeState`/`resetSeaLifeState` being called
first on any dimension change — violating this is a caller bug, not a
condition this function defends against, matching how `stepPets` trusts
its caller).

**Postconditions**: no entry of `grid.elements`, `grid.shades`,
`grid.hues`, `grid.moved`, `grid.glitter`, `grid.grassHeight`,
`grid.grassCooldown`, `grid.starPowerAge`, `grid.starPowerLife`,
`grid.starPowerFuelled`, `grid.cloud`, `grid.fogRiseCooldown`,
`grid.fogStuckSteps`, `grid.fogAge`, `grid.cloudRainDelay`, or
`grid.grassCount`/`grid.fogCloudCount` changes value (FR-012). Every live
fish/shark's `(round(x), round(y))` cell is `WATER` unless its
`fadeTimer > 0` (FR-011). No live shark is ever closer than
`SHARK_MIN_SEPARATION` cells to any live fish (FR-017).

### `eraseSeaLifeInBrush(state: SeaLifeState, cx: number, cy: number, radius: number): void`

Removes (immediately, not via `fadeTimer`) every fish/shark within the
circular footprint centered at `(cx, cy)` with the given `radius`,
pushing one `eraserCooldowns` entry per removal at that creature's last
`(x, y)`. Mirrors `eraseObjectsInBrush`'s signature and footprint test
(`footprintIntersectsCircle`-equivalent, using each creature's point
position rather than an object's box).

### `eraseSeaLifeInBrushLine(state: SeaLifeState, from: {x,y}, to: {x,y}, radius: number): void`

Bresenham-interpolated repetition of `eraseSeaLifeInBrush` along the
segment, identical shape to `eraseObjectsInBrushLine`, so a fast eraser
drag whose pointer samples straddle a creature cannot skip over it
(FR-024).

### `clearSeaLife(state: SeaLifeState): void`

Empties `fish`, `sharks`, and `eraserCooldowns` in place. Called
alongside `clearPets`/`clearObjects` from 🗑️ (FR-026). Does not touch the
sweep buffers — the in-progress or next sweep simply measures whatever
`grid` looks like after the clear (typically empty) and reconciles
accordingly, with nothing special required for "the empty canvas stays
empty" (a fully-EMPTY grid produces zero pools, so reconciliation spawns
nothing).

## Rendering contract (informative — enforced in `PlayArea.svelte`, not this module)

`seaLife.ts` exposes no drawing function; `PlayArea.svelte`'s `render()`
draws `'🐠'` for each `state.fish` entry and `'🦈'` for each
`state.sharks` entry via `ctx.fillText`, flipped horizontally by
direction/facing exactly as the existing poodle/object glyph drawing
does, with the shark's glyph drawn at a visibly larger size than the
fish's (FR-013). `bobPhase` feeds a small vertical pixel offset applied
only at the draw call, never fed back into `x`/`y` (research.md §7). A
`fadeTimer > 0` creature is drawn at reduced opacity proportional to its
remaining fade, giving the "just fades out" look FR-023 asks for.
