# Phase 1 Data Model: Sparkle Magic Wand

Derived from the spec's Key Entities section and research.md's decisions.
This extends `specs/004-landscape-scenes/data-model.md`'s Element / Grid /
Cell / Occupant / PlacedObject / ObjectsState / Tool selection / Brush /
Stroke / Particle / Scene model. Everything there is reused as-is except
`Grid` and `Tool`, which gain the one additive field/value this feature
needs; a handful of new entities (Glittered state, Glitter grain, Wand
coverage, Sparkle flash, Celebration burst's new size variant) are detailed
in full below.

## Element (unchanged)

No new `Element` value is introduced (FR-017, SC-020). A glittered grain is
still exactly `SAND`/`WATER`/`DIRT`/`RAINBOW_SAND` for every physics and
interaction purpose (FR-007); a sprinkled glitter grain is `RAINBOW_SAND`,
indistinguishable from rainbow sand produced any other way (FR-017).

## Grid (extended)

| Field | Type | Notes |
|---|---|---|
| `width`, `height`, `elements`, `shades`, `moved`, `hues` | unchanged | As defined in 001–004. |
| `glitter` | `Uint8Array` (new) | One byte per cell, `0` or `1`. `1` means "this cell's occupant is glittered." Allocated in `createGrid` at the same size as every other per-cell array. Meaningful only in conjunction with a non-`EMPTY`, non-`OBJECT` `elements[i]` — a stray `1` on an `EMPTY` or `OBJECT` cell (which can only arise transiently, e.g. immediately after `placeObject` overwrites a previously-glittered grain's cell with `OBJECT` — see Validation rules below) is never interpreted as "a glittered grain" by rendering or by any FR/SC. |

**Validation rules**:
- `glitter[i] === 1` implies the cell is, or was until overwritten by an
  object, occupied by a glitterable element. Every code path that writes a
  *fresh* element into a cell (`setCell`, used by every brush stroke and by
  the eraser; `clearGrid`, used by clear-all and every scene load) resets
  `glitter[i]` to `0` first, so a newly drawn or erased cell never inherits
  a stale glitter bit from whatever occupied that cell before (research.md
  §3).
- `step.ts`'s `moveCell`/`swapCells` are the only two places a cell's
  *existing* glitter bit is ever relocated rather than reset — the moved-to
  cell receives the moved-from cell's bit, and the vacated cell's bit is
  cleared (`moveCell`) or exchanged (`swapCells`), matching how those same
  two functions already handle `elements`/`shades`/`hues` (FR-008,
  research.md §2).
- `applyRainbowConversions` (unchanged, `objects.ts`) never reads or writes
  `glitter` — a grain's glitter bit is therefore untouched by a rainbow
  conversion, which is exactly FR-009's "glitter MUST survive element
  transformation" requirement, satisfied with zero new code.
- `placeObject` (unchanged) overwrites a footprint's `elements[i]` to
  `OBJECT` without touching `glitter[i]`; a previously-glittered grain
  underneath an object therefore keeps a `glitter[i] === 1` byte that is
  simply inert while `elements[i] === OBJECT` (rendering never treats an
  `OBJECT` cell as glittered — research.md §7). If `removeObject` later
  reverts that cell to `EMPTY`, the stale `1` remains until the next
  `setCell` write to that cell resets it (per the first bullet above) — this
  is harmless because an `EMPTY` cell is likewise never rendered as
  glittered, and is the same "inert until next fresh write" pattern
  `elements`/`shades` already tolerate today (e.g. `removeObject` does not
  reset a reverted cell's `shades[i]` either).

## Tool (extended)

```ts
export type Tool = 'sand' | 'water' | 'dirt' | 'rainbow' | 'unicorn' | 'eraser' | 'wand';
```

**Validation rules**: `'wand'` participates in the existing "exactly one
tool selected at a time" rule exactly like every other `Tool` value — no
new selection state, no new rule (FR-001). `App.svelte`'s existing
`selectTool` handler needs no change: it already accepts any `Tool` value
and forwards it unchanged.

## Glittered state (new — a property, not a runtime object)

A per-grain "this grain sparkles" flag, represented at runtime by
`Grid.glitter[i]` (above). It has no independent identity or lifecycle
beyond that byte — there is no separate "Glittered state" record anywhere
in memory, matching the spec's own Key Entities framing ("a per-grain...
property carried alongside a grain's element type").

**State transitions**:

| From | Event | To |
|---|---|---|
| unglittered element | wand coverage reaches its cell | glittered (same element) — FR-006 |
| glittered element | wand coverage reaches its cell again | glittered, unchanged — FR-010 (idempotent) |
| glittered element | moves/falls/slides/swaps under `step()` | glittered, at the new cell; the vacated cell is unglittered — FR-008 |
| glittered element | converted to another element by an existing rule (rainbow contact) | glittered, as the new element — FR-009 |
| glittered element | erased, cleared, or the play area's scene is reloaded | unglittered (the cell becomes `EMPTY`, and glitter never survives a subsequent fresh `setCell` write) — FR-012 |
| any element, glittered or not | any amount of simulated time passes with no wand/eraser/clear/scene action | unchanged — FR-014 (never fades on its own) |

## Glitter grain (new — a specific `RAINBOW_SAND` cell, not a new Element)

The multicoloured speck the wand sprinkles into empty space: a cell with
`elements[i] === RAINBOW_SAND` and `glitter[i] === 1`, placed by the wand
rather than by a 🌈 rainbow's conversion or a hand-drawn 🌈 rainbow-sand tool
(there is no such tool — rainbow sand is only ever produced by conversion or
by the wand). It is fully indistinguishable, in stored state and in
behavior, from any other glittered rainbow-sand cell (FR-017) — "Glitter
grain" names *how a cell came to exist*, not a distinct runtime type.

**Validation rules**:
- Placed only into a cell that was `EMPTY` at the moment of placement, via
  the same `setCell(grid, x, y, RAINBOW_SAND, shade)` primitive every
  element uses (never a bespoke write path), immediately followed by
  setting that cell's `hues[i]` and `glitter[i]` directly (mirroring how
  `applyRainbowConversions` already sets `hues[i]` directly after writing
  `RAINBOW_SAND`).
- Whether a given empty cell within one wand pass becomes a glitter grain is
  determined solely by its `(x, y)` coordinates via the fixed lattice test
  (research.md §4) — never by `Math.random()`, never by how many other
  cells in the same pass were already sprinkled.
- Falls, tumbles, and piles under exactly the powder rules `RAINBOW_SAND`
  already obeys (`element.ts`'s `isPowder`, unchanged) — no separate
  physics path (FR-016).

## Wand coverage (new — reuses the existing brush-footprint concept)

The set of cells one wand press or drag touches: the same circular
footprint (`forEachFootprintCell`, now exported from `brush.ts`) and the
same Bresenham line-interpolation (mirroring `applyBrushLine`/
`eraseObjectsInBrushLine`) every other brush already uses, parameterized by
the currently selected `BrushSize`'s radius (`layout.ts`'s `BRUSH_RADII`,
unchanged) (FR-004).

| Function | Signature | Notes |
|---|---|---|
| `applyWand` | `(grid: Grid, cx: number, cy: number, radius: number) => void` | One dab: marks every covered non-`OBJECT`, non-`EMPTY` cell glittered; sprinkles glitter grains into covered `EMPTY` cells per the lattice test (research.md §4); skips `OBJECT` cells entirely (research.md §7). |
| `applyWandLine` | `(grid: Grid, from: {x,y}, to: {x,y}, radius: number) => void` | Bresenham-interpolates `applyWand` along the whole segment, exactly mirroring `applyBrushLine`'s shape, so a fast drag leaves no gaps (FR-003, US1 Acceptance Scenario 7). |
| `unicornsTouchedByWandLine` | `(state: ObjectsState, from: {x,y}, to: {x,y}, radius: number) => PlacedObject[]` | Bresenham-walks the same segment and returns every unicorn (deduplicated) whose footprint intersects any point on the path, reusing `objects.ts`'s now-exported `footprintIntersectsCircle` (research.md §8). Does not touch `Grid` or `rainbows` — rainbows are never inspected by wand code at all (research.md §7). |

**Validation rules**:
- `applyWand`/`applyWandLine` never call `setCell`/`setGlitter` for an
  `OBJECT` cell, and never call anything from `objects.ts` that would
  place, remove, or resize an object — the wand cannot affect
  `ObjectsState.rainbows`/`.unicorns` membership or geometry (FR-013,
  FR-011).
- Calling `applyWand`/`applyWandLine` any number of times with the same
  arguments against the same grid state produces a grid identical to a
  single call (FR-010, SC-005) — see research.md §4/§5 for why the design
  guarantees this rather than merely tending toward it.
- `unicornsTouchedByWandLine` allocates a small array (bounded by the
  existing per-kind cap of 3) once per call — this runs from `pointermove`,
  not from the animation-frame loop, matching the existing allocation
  profile of `eraseObjectsInBrushLine`/`placeObject` (research.md,
  Constraints).

## Sparkle flash (new — UI-layer rendering state, not simulation state)

A brief bright highlight shown on a bounded, randomly-refreshed subset of
currently-glittered cells each frame. Lives entirely in `src/lib/sparkle.ts`
and a `Uint8Array` mask owned by `PlayArea.svelte`, never in `Grid` — per
the spec's own Key Entities framing, it "hold[s] no simulation state."

| Concept | Type / Signature | Notes |
|---|---|---|
| `FLASH_CAP` | `number` (constant) | Fixed maximum simultaneous flashes, independent of how many cells are glittered (FR-022). |
| `createFlashMask` | `(width: number, height: number) => Uint8Array` | Allocated once, alongside `imageData`, in `PlayArea.svelte`'s `onMount`. |
| `updateFlashMask` | `(grid: Grid, mask: Uint8Array) => void` | Called once per animation frame, before `render()`. Clears `mask`, then reservoir-samples up to `FLASH_CAP` glittered/non-`EMPTY`/non-`OBJECT` cell indices from `grid.elements`/`grid.glitter` in a single forward pass, setting their mask bit. Allocates nothing (research.md §6). |

**Validation rules**:
- The count of set bits in `mask` after `updateFlashMask` never exceeds
  `FLASH_CAP`, regardless of how many cells in `grid` are glittered — with
  zero glittered cells the count is `0`; with every cell glittered the
  count is exactly `min(FLASH_CAP, width × height)` = `FLASH_CAP` (FR-022,
  SC-010).
- `mask` and `FLASH_CAP` are never read by `wand.ts`, `step.ts`, or any
  `tests/unit/sim/*` test — they are exercised only by `PlayArea.svelte`'s
  render path, per research.md §6's decision to keep this out of the
  automated-test surface.

## Celebration burst (extended — a size parameter, not a new mechanism)

Unchanged shape from `003` (`particles.ts`'s `spawnBurst`, drawing from a
capped `particles` array with oldest-evicted eviction at `MAX_PARTICLES`),
extended with:

- A `count` parameter (default `BURST_COUNT`, unchanged for the existing
  ordinary touch-celebration call site) so the wand can request a visibly
  larger burst (`WAND_BURST_COUNT`, a small multiple of `BURST_COUNT`) from
  the same function (FR-018, research.md §8).
- A third glyph, `'🎉'`, added to the existing `'✨'`/`'💖'` choice used by
  both burst sizes (research.md §9).
- A second per-unicorn cooldown field, `lastWandBurstAt`, alongside the
  existing `lastBurstAt`/`lastIdleAt` in `PlayArea.svelte`'s
  `unicornTimers` map entries, so wand-triggered bursts are spaced out
  (FR-019) independently of the ordinary touch-celebration cooldown and
  independently *per unicorn*, so one unicorn's cooldown never suppresses
  another's celebration in the same drag (FR-020, research.md §8).

**Validation rules**:
- A wand-triggered burst still funnels through the same `spawn()`/
  `MAX_PARTICLES` cap every other particle does — the oldest live glyphs
  (from any source) give way when the cap is reached (FR-021), with no new
  cap or separate particle list introduced.
- Every unicorn `unicornsTouchedByWandLine` returns for a given drag is
  offered a wand burst independently, gated only by its own
  `lastWandBurstAt` (US3 Acceptance Scenario 3).

## Superseded / extended contracts

- `003-rainbow-unicorn-magic`'s characterisation of the unicorn celebration
  as a single fixed burst size is superseded to the extent this feature adds
  a second, larger wand-triggered variant (FR-018); the ordinary touch
  celebration's size and cooldown are otherwise unchanged.
- `004-landscape-scenes`'s scene generation is otherwise unaffected: once
  `grid.ts`'s `clearGrid` clears `glitter` (§ Grid, above), every
  `loadScene` call already inherits "no glitter survives a scene load"
  (FR-012) with no change to `scenes.ts` itself.
- No other entity 001–004 already defined (`Element`, `Cell`, `Occupant`,
  `PlacedObject`, `ObjectsState`, `BrushSize`, `Brush`, `Stroke`, `Scene`,
  `SceneRegion`/`SceneRegions`) changes meaning, shape, or validation rules
  in this feature.
