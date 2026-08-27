# Phase 1 Data Model: Shining Star Power

Derived from the spec's Key Entities section and research.md's decisions.
This extends `specs/007-water-drinking-grass/data-model.md`'s Element /
Grid / Grass cell / Root-height / Absorption-and-growth event / Grass
ceilings / Tool / Scene model (and, transitively, 001–006's every prior
entity). Everything there is reused as-is except `Grid`'s shape (below)
and `Tool`'s value set (below). This feature's new entities — Star power
cell, Fuel state, Burn life, Ignition event, Quench event, Burnout event —
are detailed in full below.

## Element (extended)

| Field | Type | Notes |
|---|---|---|
| `STAR_POWER` | `7` (new constant, `src/sim/types.ts`) | Added to the `Element` union alongside `EMPTY`/`SAND`/`WATER`/`DIRT`/`RAINBOW_SAND`/`OBJECT`/`GRASS`. |

**Validation rules**:
- A cell still holds at most one element (FR-001, unchanged invariant).
- `STAR_POWER` is neither `isPowder` nor `isLiquid` — a fourth static
  family alongside `GRASS` (research.md §1). `element.ts`'s `isSolid(e)`
  is extended to `isPowder(e) || e === GRASS || e === STAR_POWER`
  (research.md §12) — used only by grass's own sideways-growth support
  check; no other existing function's behavior changes.

## Grid (extended)

| Field | Type | Notes |
|---|---|---|
| `elements`, `shades`, `moved`, `hues`, `glitter`, `grassHeight`, `grassCooldown`, `grassCount` | unchanged | `moved[i]` and `glitter[i]` each gain one new *use* this feature (a freshly-ignited star power cell gets `moved[targetIndex] = 1` for the rest of the step that created it, research.md §5; a star power cell's `glitter[i]` is set to `1` at creation for its twinkle, research.md §7) — additional uses of existing fields, not shape or meaning changes. |
| `starPowerAge` | `Uint8Array` (new) | Sized `width * height`. `starPowerAge[i]` is the number of simulation steps this cell has been star power, meaningful only where `elements[i] === STAR_POWER`. Reset to `0` by `setCell` on every write to index `i` (research.md §3), then incremented by `stepStarPower` while the cell is neither quenched nor burned out. |
| `starPowerLife` | `Uint8Array` (new) | Sized `width * height`. `starPowerLife[i]` is this cell's total burn life in simulation steps — an integer in `[30, 60]` (FR-007) drawn once at creation by `randomBurnLife()` (`shade.ts`) and never modified afterward, meaningful only where `elements[i] === STAR_POWER`. |
| `starPowerFuelled` | `Uint8Array` (new, `0` or `1`) | Sized `width * height`. `1` if this cell was ignited from a `GRASS` cell (burns out into a glitter grain); `0` if it was drawn by the ⭐ brush into an empty cell (burns out into nothing) — meaningful only where `elements[i] === STAR_POWER`. |

**Validation rules**:
- `createGrid(width, height)` allocates `starPowerAge`/`starPowerLife`/
  `starPowerFuelled` as zero-filled `Uint8Array(width * height)` —
  identical zero-init pattern to every existing `Grid` field.
- No `starPowerCount` field exists — unlike grass's field-share ceiling
  (spec 007 FR-012), nothing in this feature gates star power by a
  field-wide share (research.md §2); star power's worst case is bounded
  by its own transience (FR-002) and by grass's pre-existing field-share
  ceiling (spec 007 FR-012 — a burn can never touch more grass than
  already exists).
- `CELL_BUDGET = 43,200` (spec 006, unchanged) still bounds `width *
  height` for every `Grid` this feature's star-power logic ever runs
  against; the star-power rules' own per-step cost is `O(1)` per
  star-power cell visited (a fixed four-neighbor quench scan plus, once
  past the ignition delay, a fixed eight-neighbor ignition scan), so the
  existing budget is what keeps FR-034 satisfied, not a new cap.

## Star power cell (new)

A cell holding `STAR_POWER` (spec Key Entities: "a transient, static,
shining element"). Not a separate runtime object — represented purely by
`elements[i] === STAR_POWER` plus the parallel fields (`shades[i]`,
`glitter[i]`, `starPowerAge[i]`, `starPowerLife[i]`, `starPowerFuelled[i]`)
at the same index.

| Concept | Type / Signature | Notes |
|---|---|---|
| Creation | `igniteStarPower(grid: Grid, x: number, y: number, fuelled: boolean): void` (new, `grid.ts`) | The **only** way a star power cell is created (the ⭐ brush's two branches, or the burn front's own ignition scan — research.md §2, §5, §8) — never by direct array mutation elsewhere, so the age/life/fuel bookkeeping below always runs together. Calls `setCell(grid, x, y, STAR_POWER, randomShade())`, then sets `starPowerFuelled[i] = fuelled ? 1 : 0`, `starPowerLife[i] = randomBurnLife()`, and `setGlitter(grid, x, y, 1)` (twinkle, research.md §7). No-ops if `(x, y)` is out of bounds. |
| `setCell`'s extended contract | `(grid, x, y, element, shade) => void` | In addition to its existing behavior (unchanged from spec 007: write `elements[i]`/`shades[i]`/reset `glitter[i]`/maintain `grassHeight`/`grassCooldown`/`grassCount`), `setCell` now also: sets `starPowerAge[i] = 0` on every call, and additionally sets `starPowerLife[i] = 0`/`starPowerFuelled[i] = 0` whenever the written `element !== STAR_POWER` (research.md §3). |
| `clearGrid`'s extended contract | `(grid) => void` | In addition to its existing behavior (unchanged from spec 007), also fills `starPowerAge`/`starPowerLife`/`starPowerFuelled` to `0`. |

**Validation rules**:
- FR-004: a star power cell's `(x, y)` never changes except via a
  drawing tool, quenching, burnout, or a play-field re-derivation — there
  is no move/swap path for `STAR_POWER` anywhere in `step.ts` (research.md
  §1).
- FR-005: `stepPowder`/`stepLiquid` treat a star-power-occupied cell
  exactly as they treat any non-`EMPTY`, non-liquid cell — no star-power-
  specific code exists in either function (research.md §1).
- FR-006: star power never consumes, converts, moves, or removes any
  element other than `GRASS` — the only mutation `stepStarPower` ever
  performs on a neighboring cell is turning a `GRASS` neighbor into a
  fuelled star power cell (research.md §5); every other element type is
  never touched by any star-power code path.

## Fuel state (new — a stored per-cell flag, not a separate entity)

The spec's "fuelled"/"unfuelled" distinction (Key Entities: "whether a
star power cell is *fuelled*... or *unfuelled*... transient simulation
state the child never sees directly, only through what the cell leaves
behind") is stored as `starPowerFuelled[i]`, set once at creation
(`igniteStarPower`, above) and never changed for the cell's lifetime.

**Validation rules**:
- A cell created by the ⭐ brush painting into an `EMPTY` footprint cell
  is always `fuelled = false` (FR-022).
- A cell created by the ⭐ brush painting onto a `GRASS` footprint cell,
  or by the burn front igniting a `GRASS` neighbor, is always
  `fuelled = true` (FR-022, FR-011).
- Fuel state is read exactly once, at burnout/quench time
  (`extinguishStarPower`, below), to decide the cell's outcome — it has
  no other effect on the cell's behavior while burning (an unfuelled cell
  ignites neighboring grass and is quenched by water identically to a
  fuelled one).

## Burn life (new — a stored per-cell value, not a separate entity)

The spec's "burn life" (Key Entities: "the number of simulation steps a
star power cell shines for before burning out — 30 to 60 steps, varying
per cell") is stored as `starPowerLife[i]`, drawn once at creation from
`randomBurnLife()` (`shade.ts`, research.md §4) and compared against the
cell's own rising `starPowerAge[i]` every step it is neither quenched nor
already burned out.

**Validation rules**:
- `randomBurnLife()` always returns an integer in `[30, 60]` inclusive
  (FR-007) — the sole implementation of this bound; no other code path
  produces or clamps a `starPowerLife` value.
- A cell whose `starPowerAge[i]` reaches `starPowerLife[i]` burns out
  (Burnout event, below) on that same step, before any ignition check for
  that step runs (research.md §5).

## Ignition event (new — a same-step transition, not a stored entity)

The event of a star power cell that has been shining for at least 10
steps converting an adjacent `GRASS` cell into a new, fuelled star power
cell, as one atomic operation within `stepStarPower` (research.md §5).

| Precondition (all required) | Field(s) involved |
|---|---|
| The igniting cell is not quenched this step (no orthogonally adjacent `WATER`) | FR-016 |
| The igniting cell's `starPowerAge[i]` (after this step's increment) is `< starPowerLife[i]` — it has not itself just burned out | FR-007, FR-008 |
| The igniting cell's age is `>= 10` (`STAR_POWER_IGNITE_DELAY`) | FR-011 |
| The candidate neighbor (one of the igniting cell's eight neighbors) currently holds `GRASS` | FR-011, FR-013, FR-014 |

**State transition** (per candidate neighbor, per step):

| From | Event | To |
|---|---|---|
| `GRASS` | ignited by a qualifying star power neighbor | `STAR_POWER`, `starPowerFuelled = 1`, fresh `starPowerLife` (30–60), `starPowerAge = 0`, `glitter = 1`, `moved = 1` for the remainder of this step |

**Validation rules**:
- Every one of the igniting cell's eight neighbors (orthogonal and
  diagonal) is checked, every qualifying step — not just the step age
  first reaches 10 — so grass that becomes adjacent later (via spec
  007's own growth rule) still catches (FR-013, FR-036; research.md §5's
  "alternatives considered").
- A `GRASS` cell adjacent to two or more qualifying star power cells in
  the same step is ignited by whichever is visited first in `step()`'s
  existing scan order; the others' own neighbor scans then see
  `STAR_POWER`, not `GRASS`, at that index and do nothing further — no
  double-ignition, no special-casing needed (research.md §5, mirroring
  spec 007's water-double-absorption prevention).
- A newly-ignited cell cannot itself be quenched, burn out, or ignite a
  neighbor within the same `step()` pass — `moved[i] = 1` is checked by
  `step()`'s dispatcher before calling `stepStarPower` on any cell
  (research.md §5).

## Quench event (new — a same-step transition, not a stored entity)

The event of a star power cell orthogonally adjacent to `WATER` being put
out immediately, regardless of its age (FR-016).

| Precondition | Field(s) involved |
|---|---|
| At least one orthogonal neighbor holds `WATER` | FR-016 |

**State transition**:

| From | Event | To |
|---|---|---|
| `STAR_POWER`, `starPowerFuelled = 1` | quenched | `RAINBOW_SAND`, fresh `hue`/`shade`, `glitter = 1` (a glitter grain — FR-016) |
| `STAR_POWER`, `starPowerFuelled = 0` | quenched | `EMPTY` (FR-016) |

**Validation rules**:
- The water cell that quenches a star power cell is never read from,
  written to, or otherwise changed by the quench event itself (FR-017) —
  `stepStarPower`'s quench check only *reads* `elements[waterIndex]` to
  detect `WATER`; no `setCell`/`setGlitter` call ever targets that index.
- Quenching is checked before age/burnout and before ignition, every
  step, for every star power cell — a cell adjacent to water on the very
  step it would otherwise have ignited a neighbor is extinguished instead,
  igniting nothing further that step (research.md §5).
- Grass beside the water that forms a firebreak keeps drinking and
  growing under spec 007's unchanged `stepGrass` rule, since quenching
  never touches the water cell itself (FR-017a) — this can eventually
  narrow or open the firebreak, which is a deliberate, unprevented
  emergent interaction, not a bug.

## Burnout event (new — a same-step transition, not a stored entity)

The event of a star power cell's burn life elapsing on its own, with no
water involved (FR-002, FR-007, FR-008).

| Precondition | Field(s) involved |
|---|---|
| Not quenched this step | FR-016 (quench takes priority) |
| `starPowerAge[i] + 1 >= starPowerLife[i]` | FR-002, FR-007 |

**State transition**: identical outcome table to the Quench event above,
keyed on the same `starPowerFuelled[i]` value — `extinguishStarPower`
(`step.ts`, private) implements both events with one function, since a
cell's "how it ends" outcome depends only on its fuel state, never on
*why* it ended (research.md §6).

**Validation rules**:
- FR-002: every star power cell burns out within its own `starPowerLife`
  regardless of whether it ever had a grass neighbor — an unfuelled cell
  drawn onto empty ground follows this same table with `starPowerFuelled
  = 0`.
- FR-010: each burnout/quench of a `starPowerFuelled = 1` cell produces
  *exactly* one glitter grain, in the cell it occupied — never more,
  never fewer, and never for an unfuelled cell.
- FR-015: once no star power cell on the field has a `GRASS` neighbor
  (because the fire ran out of fuel or every neighbor is already
  star power/glitter), every remaining star power cell still burns out
  within its own `starPowerLife` via this same event, and the field
  reaches rest with `0` star power cells remaining — burnout requires no
  external trigger.

## Star power constants (new — pure constants, not stored state)

| Concept | Value | Notes |
|---|---|---|
| `STAR_POWER_IGNITE_DELAY` | `10` (constant, `step.ts`) | FR-011, taken directly from the spec's literal wording, not a tunable choice. |
| `STAR_POWER_MIN_LIFE` / `STAR_POWER_MAX_LIFE` | `30` / `60` (constants, `shade.ts`) | FR-007 — the inclusive bounds `randomBurnLife()` draws from. |

## Tool (extended)

| Field | Type | Notes |
|---|---|---|
| `Tool` | `'sand' \| 'water' \| 'dirt' \| 'grass' \| 'star' \| 'rainbow' \| 'unicorn' \| 'eraser' \| 'wand'` | Adds `'star'` (`src/sim/types.ts`). |

**Validation rules**:
- The `star` tool deposits an unfuelled star power cell (`igniteStarPower(
  grid, x, y, false)`) into a footprint cell iff that cell currently holds
  `EMPTY` (FR-022); it converts a `GRASS` footprint cell into a fuelled
  star power cell (`igniteStarPower(grid, x, y, true)`) (FR-022); it
  never overwrites `WATER` (FR-018), `SAND`, `DIRT`, `RAINBOW_SAND`,
  `OBJECT`, or an already-`STAR_POWER` cell (FR-005 — nothing may
  displace an existing star power cell).
- `eraser` needs no `Tool`-level change — it already operates
  generically on any occupied cell via `setCell(grid, x, y, EMPTY, 0)`
  (research.md §10).
- `wand` needs one change (research.md §9): `applyWandCell` now skips
  `STAR_POWER` the same way it already skips `OBJECT`, instead of
  glittering it via the generic "any occupied cell" rule.
- Pink sand (`'sand'`) remains the tool selected on page load — unchanged
  (FR-025).

## Scene (unchanged)

`generateLandscape1`, `generateLandscape2`, `sceneRegions`, and
`loadScene`'s clear-then-generate contract are all unchanged by this
feature (research.md §10) — no scene ever calls `igniteStarPower` or
writes `STAR_POWER` (FR-030), and `loadScene`'s existing `clearGrid` call
already wipes any star power present on the field before generating the
chosen scene (§ "Star power cell" above).

## Superseded / extended contracts

- Spec 007's superseding of spec 002's **FR-003** (element conservation)
  is further superseded, exactly as spec.md's own Superseded requirements
  section states: `GRASS` becoming `STAR_POWER` (ignition) and
  `STAR_POWER` becoming `RAINBOW_SAND` or `EMPTY` (burnout/quench) are
  simulation-driven element changes. With no star power on the field,
  every existing element-conservation invariant holds exactly as before
  (FR-036) — none of this feature's `setCell`/`stepStarPower` changes run
  unless a `STAR_POWER` cell is actually present.
- Spec 007's **FR-006** (grass is created/destroyed/converted only by
  the grass brush, the eraser, clear-all, scene loading, re-derivation,
  and grass's own growth rule) is superseded exactly as spec.md's own
  Superseded requirements section states: the ⭐ brush and the burn
  front's ignition scan are now also valid ways for a grass cell to stop
  being grass.
- Spec 005's **FR-017**/**FR-022** (glitter grains are placed only by the
  wand; the fixed sparkle-flash cap) are extended, not weakened: burned
  grass is a second source of the identical glitter grain (FR-009,
  FR-010), and the flash cap is never raised — star power's own twinkle
  and burn-made glitter share the exact same `FLASH_CAP = 24` reservoir
  every other glittered cell already competes for (research.md §7).
- No entity 001–007 already defined changes meaning, shape, or validation
  rules beyond `Grid` gaining `starPowerAge`/`starPowerLife`/
  `starPowerFuelled` and `Tool` gaining `'star'` (both covered above) —
  `PlacedObject`/`ObjectsState`/`PlayField`/`Re-derivation`/`Toolbar
  layout`/`Grass cell`/`Root-height`/`Absorption-and-growth event`/`Grass
  ceilings` and every other prior entity are unaffected; `resizeGrid`
  (spec 006) is extended only to also copy `starPowerAge`/
  `starPowerLife`/`starPowerFuelled` per carried cell (research.md §11,
  no accumulation needed since there is no `starPowerCount`) — its
  offset/drop/`OBJECT`-skip contract is otherwise unchanged (see
  `contracts/star-power-mechanics.md`).
