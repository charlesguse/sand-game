# Phase 1 Data Model: Star-Powered Weather

Derived from the spec's Key Entities section and research.md's decisions.
This extends `specs/008-star-power-burns-grass/data-model.md`'s Element /
Grid / Star power cell / Fuel state / Burn life / Ignition-Quench-Burnout
event / Tool / Scene model (and, transitively, 001–007's every prior
entity). Everything there is reused as-is except `Grid`'s shape (below),
`setCell`'s/`clearGrid`'s/`stepStarPower`'s extended contracts (below), and
`Tool`'s value set (unchanged — see "Tool" below). This feature's new
entities — Fog cell, Cloud sub-state, Charming, Rise event, Wander, Condense
event, Become-cloud event, Rain event, Sky limit — are detailed in full
below.

## Element (extended)

| Field | Type | Notes |
|---|---|---|
| `FOG` | `8` (new constant, `src/sim/types.ts`) | Added to the `Element` union alongside `EMPTY`/`SAND`/`WATER`/`DIRT`/`RAINBOW_SAND`/`OBJECT`/`GRASS`/`STAR_POWER`. Represents **both** fog and cloud (research.md §1) — which one a given cell is is carried by `Grid.cloud`, not by a second element value. |

**Validation rules**:
- A cell still holds at most one element (FR-001, unchanged invariant).
- `FOG` is neither `isPowder`, `isLiquid`, nor `isSolid` — `element.ts` is
  **unchanged** by this feature: `isSolid`'s existing `isPowder(e) || e ===
  GRASS || e === STAR_POWER` correctly excludes `FOG`, since fog/cloud must
  never be treated as support/ground (FR-004).

## Grid (extended)

| Field | Type | Notes |
|---|---|---|
| `elements`, `shades`, `moved`, `hues`, `glitter`, `grassHeight`, `grassCooldown`, `grassCount`, `starPowerAge`, `starPowerLife`, `starPowerFuelled` | unchanged | `moved[i]`, `glitter[i]`, and — newly this feature — `elements[i]`'s generic `moveCell`/`swapCells` copy path each gain further *uses* (a freshly-charmed fog cell gets `moved[i] = 1` for the rest of the step that created it when charmed via a quench mid-pass, research.md §7; a fog cell's `glitter[i]` is set to `1` at creation for its twinkle, research.md §8; `moveCell`/`swapCells` now also carry the five fields below, research.md §9) — additional uses of existing fields/mechanisms, not shape or meaning changes. |
| `cloud` | `Uint8Array` (new, `0` or `1`) | Sized `width * height`. `1` if this `FOG`-element cell is presently a gathered cloud; `0` if it is rising fog. Meaningful only where `elements[i] === FOG`. Reset to `0` by `setCell` whenever `element !== FOG` (research.md §3). Travels with the cell via `moveCell`/`swapCells` while fog (though a cloud cell, `cloud[i] === 1`, never itself calls `moveCell`/`swapCells` — FR-018). |
| `fogRiseCooldown` | `Uint8Array` (new) | Sized `width * height`. Simulation steps remaining before this fog cell's next rise attempt; drawn fresh in `[3, 5]` by `randomFogRiseCooldown()` (`shade.ts`) whenever the cell is created or successfully rises (FR-012). Meaningful only where `elements[i] === FOG && cloud[i] === 0`. Reset to `0` by `setCell`/`becomeCloud` when the cell stops being rising fog. |
| `fogStuckSteps` | `Uint16Array` (new) | Sized `width * height`. Consecutive simulation steps during which this fog cell has failed to rise; reset to `0` on every successful upward move, incremented every other step while fog (FR-016). `Uint16Array` because its 300-step threshold exceeds a `Uint8Array`'s 255 ceiling. Meaningful only while `elements[i] === FOG && cloud[i] === 0`. |
| `fogAge` | `Uint16Array` (new) | Sized `width * height`. Steps since this cell most recently entered its *current* sub-state — reset to `0` at charming and again at the fog→cloud transition. While `cloud[i] === 0`, compared against `FOG_MAX_LIFE = 1800` (FR-016). While `cloud[i] === 1`, compared against this same cell's own `cloudRainDelay[i]` (FR-020). `Uint16Array` for the same reason as `fogStuckSteps`. |
| `cloudRainDelay` | `Uint16Array` (new) | Sized `width * height`. This cloud cell's total hold time, drawn once in `[180, 480]` by `randomCloudRainDelay()` (`shade.ts`) at the fog→cloud transition, never modified afterward (FR-020). Meaningful only where `cloud[i] === 1`. |
| `fogCloudCount` | `number` (new, plain field like `grassCount`) | Running total of cells where `elements[i] === FOG` (fog and cloud combined). Maintained by `setCell` (§ below) and by every direct-array-write consumer that bypasses `setCell` for this element (today, only `applyRainbowConversions`, research.md §13). Used by `createFog` to enforce the FR-011 sky limit in `O(1)`. |

**Validation rules**:
- `createGrid(width, height)` allocates `cloud`/`fogRiseCooldown`/
  `fogStuckSteps`/`fogAge`/`cloudRainDelay` as zero-filled typed arrays —
  identical zero-init pattern to every existing `Grid` field — and
  initializes `fogCloudCount = 0`.
- `FOG_FIELD_SHARE_CEILING = 0.20` (constant, `grid.ts`, FR-011): `createFog`
  refuses to create a new fog cell whenever `fogCloudCount >= Math.floor(
  width * height * FOG_FIELD_SHARE_CEILING)`. Unlike grass's field-share
  ceiling (spec 007 FR-012, checked by the caller in `step.ts`), this
  ceiling is enforced *inside* the one function that can create fog
  (research.md §2) — a stronger guarantee than the caller-checks pattern,
  since FR-011 is this feature's central boundedness promise.
- `CELL_BUDGET = 43,200` (spec 006, unchanged) still bounds `width *
  height` for every `Grid` this feature's rules ever run against; every
  per-cell rule introduced here (`stepFog`'s fixed handful of neighbor
  reads, `createFog`'s `O(1)` ceiling check) is `O(1)` per cell, so the
  existing budget is what keeps FR-038 satisfied, not a new cap.

## Fog cell (new)

A cell holding `FOG` with `cloud[i] === 0` (spec Key Entities: "the rising
sparkle-mist"). Not a separate runtime object — represented purely by
`elements[i] === FOG && cloud[i] === 0` plus the parallel fields (`shades[i]`,
`glitter[i]`, `fogRiseCooldown[i]`, `fogStuckSteps[i]`, `fogAge[i]`) at the
same index.

| Concept | Type / Signature | Notes |
|---|---|---|
| Creation | `createFog(grid: Grid, x: number, y: number): boolean` (new, `grid.ts`) | The **only** way a fog cell is created (FR-009) — the ⭐ brush's water branch, or the star-power quench handler's charming (research.md §7) — never by direct array mutation elsewhere. Returns `false` and touches nothing if `(x, y)` is out of bounds or the FR-011 sky limit is already reached; otherwise calls `setCell(grid, x, y, FOG, randomShade())`, sets `cloud[i] = 0`, `fogRiseCooldown[i] = randomFogRiseCooldown()`, `fogStuckSteps[i] = 0`, `fogAge[i] = 0`, `setGlitter(grid, x, y, 1)` (twinkle, research.md §8), and returns `true`. |
| `setCell`'s extended contract | `(grid, x, y, element, shade) => void` | In addition to its existing behavior (unchanged from spec 008: write `elements[i]`/`shades[i]`/reset `glitter[i]`/maintain grass and star-power bookkeeping), `setCell` now also: tracks `wasFog`/`becomesFog` to maintain `fogCloudCount` (mirroring `grassCount`'s bookkeeping), and sets `cloud[i] = 0`, `fogRiseCooldown[i] = 0`, `fogStuckSteps[i] = 0`, `fogAge[i] = 0`, `cloudRainDelay[i] = 0` whenever the written `element !== FOG` (research.md §3). |
| `clearGrid`'s extended contract | `(grid) => void` | In addition to its existing behavior (unchanged from spec 008), also fills `cloud`/`fogRiseCooldown`/`fogStuckSteps`/`fogAge`/`cloudRainDelay` to `0` and resets `fogCloudCount = 0`. |

**Validation rules**:
- FR-004: fog/cloud are the lightest things on the field — `isSolid`
  excludes `FOG` (unchanged `element.ts`), and `stepPowder`/`stepLiquid`'s
  straight-down checks swap through a `FOG` cell exactly as they already
  swap through a liquid (research.md §10).
- FR-005: grass, star power, placed objects, and the play field's walls/
  floor/ceiling block fog and cloud — `stepFog`'s wander-rise (below) only
  ever targets a candidate cell that is `EMPTY` (diagonal) or `EMPTY`/
  `WATER` (straight up); every other element occupying a candidate cell is
  simply not a legal target, so fog never enters, exchanges with,
  displaces, or converts it.
- FR-006: fog and cloud are inert towards everything else — no code path
  anywhere has `stepFog`/`stepCloud`/`becomeCloud`/`condenseFog`/`rain`
  mutate any cell's contents other than the fog/cloud cell's own index and,
  during a rise, the single candidate cell it moves/swaps into.
- FR-009: fog appears only via `createFog` — no scene (FR-035), no powder/
  grass/glitter/object rule, and no cloud rule ever produces a fresh `FOG`
  cell from anything but a charming event.

## Cloud sub-state (new — a stored per-cell flag, not a separate entity)

The spec's "cloud" (Key Entities: "gathered fog at the sky ceiling... does
not move... grows downward... rains within a few seconds") is stored as
`cloud[i] === 1` on a cell that remains `elements[i] === FOG` throughout —
`fogCloudCount` therefore does not change at the fog→cloud transition
(`becomeCloud`, below), since the cell's *element* never changes, only its
sub-state.

**Validation rules**:
- A cell becomes a cloud only via `becomeCloud` (research.md §6), itself
  only ever called from `stepFog` when the direct-above cell is the sky
  ceiling (`y === 0`) or an existing cloud cell (FR-017) — never from any
  other trigger, and never seeded by a scene (FR-035).
- FR-018: cloud never moves — `stepCloud` never calls `moveCell`/
  `swapCells`; a cloud cell's `(x, y)` changes only via the child's own
  drawing tools (brush/eraser, treating it as empty — FR-026), a rainbow
  conversion (FR-031), clear-all (FR-028), or a play-field re-derivation
  (FR-034), none of which is a *simulation rule* moving it.
- FR-018/FR-019: cloud never blocks play beyond occupying its own cell —
  `stepPowder`/`stepLiquid` sink through it exactly as through fog
  (research.md §10, since both sub-states share `elements[i] === FOG`), and
  every brush paints through it (FR-026, research.md §11).

## Charming (new — a same-step or same-input-event transition, not a stored entity)

The act by which star power turns exactly one water cell into exactly one
fog cell (spec Key Entities). Two distinct triggers, both funnelled through
`createFog`:

| Trigger | Precondition | Effect |
|---|---|---|
| ⭐ brush over water (FR-008) | `paintCell`'s `current === WATER` under the `star` tool | `createFog(grid, x, y)` — every water cell inside the brush's footprint is charmed, one for one, subject to the sky limit (FR-011) |
| Unfuelled star power quenched by water (FR-007) | `stepStarPower` finds an orthogonally adjacent `WATER` cell and `starPowerFuelled[i] === 0` | The star-power cell extinguishes exactly as spec 008 requires (unchanged `extinguishStarPower`), **and** `createFog` is called at the one quenching water index found (research.md §7) |

**Validation rules**:
- FR-007's second sentence: a **fuelled** star power cell (the burn front)
  quenched by water leaves that water completely untouched — `stepStar
  Power` only calls `createFog` when `starPowerFuelled[i] === 0`, so the
  fuelled path is byte-identical to spec 008's own quench behavior, and
  spec 008's SC-007 (a one-cell water stripe protects the far lawn
  completely) continues to hold unchanged.
- FR-010: charming replaces the water cell in place — `createFog` calls
  `setCell` at the *same* `(x, y)` the water occupied, never a different
  index, and touches no other cell.
- FR-011: charming does not happen while `fogCloudCount` is already at or
  above the sky limit — `createFog` itself refuses (research.md §2); the
  ⭐ brush's water branch and `stepStarPower`'s quench branch each simply
  ignore a `false` return, leaving the water untouched with no visible
  effect (no message, no refusal the child can notice).
- FR-025: rain (an ordinary water cell produced by a cloud, below) never
  triggers charming — no code path calls `createFog` from `rain`,
  `condenseFog`, `stepCloud`, or `becomeCloud`; only the two triggers in
  the table above ever call it, and both require *star power* to be
  present, so the cycle cannot restart itself once it starts.

## Rise event (new — a same-step transition, not a stored entity)

The event of a fog cell (`cloud[i] === 0`) moving one cell upward, possibly
with a one-cell sideways wander, once its `fogRiseCooldown` reaches `0`
(spec Key Entities / FR-012 / FR-013 / FR-014).

| Precondition (all required) | Field(s) involved |
|---|---|
| `elements[i] === FOG && cloud[i] === 0` | — |
| `fogAge[i] + 1 < FOG_MAX_LIFE` (has not just hit its 1800-step cap) | FR-016 |
| `fogRiseCooldown[i] === 0` after this step's decrement | FR-012 |
| The direct-above cell is neither the sky ceiling nor an existing cloud (otherwise a Become-cloud event fires instead, below) | FR-017 |
| At least one of {preferred diagonal, straight up, other diagonal} is a legal target (see Wander, below) | FR-013, FR-014, FR-015 |

**State transition**: the fog cell's contents (`elements`/`shades`/`hues`/
`glitter`/`cloud`/`fogRiseCooldown`/`fogStuckSteps`/`fogAge`) move (if the
target was `EMPTY`) or swap (if the target was `WATER`, straight-up only —
FR-014) to the chosen target index; at the target index,
`fogRiseCooldown` is redrawn fresh (`[3, 5]`) and `fogStuckSteps` is reset
to `0`.

**Validation rules**:
- FR-012: an unobstructed fog cell rises exactly once every 3–5 steps (12–
  20 cells/second at 60 steps/second) — the cooldown redraw at the target
  index after every success is what produces this steady cadence
  (research.md §5).
- FR-013: the sideways component of any single rise is at most one cell,
  and — over a long run — has zero net bias, by the symmetric wander
  algorithm below (SC-005).
- FR-014: only the straight-up candidate may be `WATER` (a bubble-through
  swap); diagonal candidates require `EMPTY` (research.md §5, §10) — so a
  fully submerged fog cell rises in a straight column until it breaches the
  surface (SC-006).

## Wander (new — the rise event's direction-selection rule, not a stored entity)

Each rise attempt draws a preferred horizontal offset uniformly from `{-1,
0, +1}` and tries candidates in this order, stopping at the first legal
one:

1. The preferred candidate.
2. Straight up (`dx = 0`), if it was not already the preferred candidate.
3. The remaining diagonal, if it was not already tried — with the order of
   step 2 vs. step 3 itself randomized whenever the preferred offset was
   `0` (so neither diagonal side is ever systematically tried first).

A straight-up (`dx = 0`) candidate is legal if it is `EMPTY` or `WATER`; a
diagonal (`dx = ±1`) candidate is legal only if it is `EMPTY`. If none of
the three is legal, the cell is stuck this step (its `fogStuckSteps`
increments — see Condense event, below).

**Validation rules**:
- SC-005: because the preferred direction is drawn uniformly and the
  fallback order is mirror-symmetric, a fog cell's expected horizontal
  displacement per rise is exactly `0`, and its per-rise displacement is
  never more than `1` cell either way.
- Acceptance Scenario 4 (User Story 1): because the preferred direction is
  rolled *every* rise attempt (not only when blocked), a plume rising
  through open sky still visibly wobbles rather than marching in a rigid
  straight column.

## Condense event (new — a same-step transition, not a stored entity)

The event of a fog cell turning back into exactly one water cell, either
because it has been unable to rise for too long or because its total
lifetime as fog has elapsed (FR-016).

| Precondition (either) | Field(s) involved |
|---|---|
| `fogStuckSteps[i]` reaches `300` (consecutive steps without a successful rise, including cooldown-waiting steps) | FR-016 |
| `fogAge[i]` reaches `1800` (30 seconds as fog, regardless of stuckness) | FR-016 |

**State transition**: `FOG` (`cloud = 0`) → `WATER` (`condenseFog`, via
`setCell`, in place — research.md §6), which then falls under the existing
water rules on a later pass.

**Validation rules**:
- FR-016: this is the *only* way a fog cell disappears without first
  becoming cloud — every fog cell that never reaches the sky eventually
  condenses, bounding the sky's contents in time as well as in space
  (FR-011's own bound).
- The edge case "fog made under a lid of sand... if it stays stuck it
  turns back into a drop of water and falls" and "fog under a wide roof of
  grass... the same" are both instances of the `fogStuckSteps` trigger
  above — no lid- or roof-specific code exists; both are ordinary
  consequences of every wander candidate being illegal for 300 consecutive
  steps.

## Become-cloud event (new — a same-step transition, not a stored entity)

The event of a rising fog cell joining the sky, because the cell directly
above it is the play field's sky ceiling or an existing cloud cell
(FR-017).

| Precondition (either) | Field(s) involved |
|---|---|
| The direct-above cell is out of bounds (`y === 0`, the sky ceiling) | FR-017 |
| The direct-above cell holds `FOG` with `cloud = 1` | FR-017 |

**State transition**: `cloud[i]` `0 → 1`, `fogAge[i]` reset to `0`,
`cloudRainDelay[i]` drawn fresh (`[180, 480]`), `fogRiseCooldown[i]` and
`fogStuckSteps[i]` reset to `0` — `elements[i]` stays `FOG` throughout, so
`fogCloudCount` is unaffected (`becomeCloud`, research.md §6).

**Validation rules**:
- FR-017: this precondition is checked *before* any wander logic in
  `stepFog` (research.md §5), so a fog cell blocked only by ordinary matter
  (never sky/cloud directly above) never becomes cloud by this route — it
  only ever condenses (above) if it stays stuck long enough. Clouds
  therefore only ever form against the sky, exactly as the spec's resolved
  clarification requires.
- FR-018: once a cell becomes cloud, it is permanently done rising —
  `stepFog` dispatches to `stepCloud` (not the fog logic) for every
  subsequent step this cell is processed, and `stepCloud` never calls
  `moveCell`/`swapCells`.
- A cloud growing "downward" (Acceptance Scenario 2, User Story 2) is the
  natural, emergent consequence of every new fog cell arriving at the
  underside of an existing cloud independently triggering its own
  Become-cloud event — no explicit "grow the cloud" code exists.

## Rain event (new — a same-step transition, not a stored entity)

The event of a cloud cell turning into exactly one ordinary water cell
once its own hold time elapses (FR-020/FR-021).

| Precondition | Field(s) involved |
|---|---|
| `cloud[i] === 1` and `fogAge[i] + 1 >= cloudRainDelay[i]` | FR-020 |

**State transition**: `FOG` (`cloud = 1`) → `WATER` (`rain`, via `setCell`,
in place — research.md §6), which then falls, pools, flows, and levels
under the existing water rules exactly like any other water cell (FR-022).

**Validation rules**:
- FR-020: every cloud cell rains within `[180, 480]` steps (3–8 seconds) of
  forming — `cloudRainDelay` is drawn from exactly that range at creation
  and never widened, so the spec's separately-stated "no cloud cell may
  last longer than 600 steps (10 seconds)" hard cap holds automatically
  (`480 < 600`) without any additional enforcement code.
- FR-021/FR-022/SC-012: the produced cell is written via the same
  `setCell(grid, x, y, WATER, randomShade())` call every other water-
  creating code path in this toy uses — it carries no special flag, so
  advancing an identical field seeded one way by rain and the other by the
  💧 tool produces `0` differing cells after any number of `step()` calls.
- Because cloud cells rain independently of one another (each draws its
  own `cloudRainDelay` at its own moment of formation), a cloud's cells let
  go at staggered moments rather than all at once — the "patters raggedly"
  requirement (FR-020, visual checks) falls out of the per-cell timer
  design with no additional randomization needed.

## Sky limit (new — a derived quantity, not a stored entity beyond `fogCloudCount`)

The proportion of the play field (20%) that fog and cloud together may
occupy, above which no more water is charmed (spec Key Entities, FR-011).

**Validation rules**:
- `Math.floor(width * height * FOG_FIELD_SHARE_CEILING)` is the same
  fixed-fraction-of-the-derived-field shape spec 007's own
  `GRASS_FIELD_SHARE_CEILING` already established, so it is automatically
  correct at every play-field size and shape spec 006 derives (FR-039) —
  the limit is a proportion, not a fixed cell count.
- SC-014: from any starting arrangement, including a field entirely full of
  water charmed as hard as possible, `fogCloudCount` never exceeds this
  ceiling, because `createFog` (the only creation path) refuses once it is
  reached (research.md §2).

## Tool (unchanged)

`Tool`'s value set is **not** extended by this feature (FR-027 — no new
toolbar control). The existing `'star'` tool (spec 008) gains one more
`current`-dependent behavior in `paintCell` (charming over `WATER`,
research.md §7, §11) without any change to the `Tool` type itself.

**Validation rules**:
- Pink sand (`'sand'`) remains the tool selected on page load — unchanged
  (spec 008's FR-029, itself unchanged by this feature).
- The `star` tool's brush behavior over `EMPTY`/`GRASS` is exactly spec
  008's own `igniteStarPower`-based behavior, unchanged; its new behavior
  over `WATER` calls `createFog` instead (§ Charming, above) — the brush
  never places star power into a water cell, exactly as spec 008's FR-018
  already required and this spec's FR-008 re-affirms.

## Scene (unchanged)

`generateLandscape1`, `generateLandscape2`, `sceneRegions`, and
`loadScene`'s clear-then-generate contract are all unchanged by this
feature (research.md §15) — no scene ever calls `createFog` or writes
`FOG` (FR-035), and `loadScene`'s existing `clearGrid` call already wipes
any fog/cloud present on the field, including `fogCloudCount`, before
generating the chosen scene's contents.

## Superseded / extended contracts

- Spec 008's own superseding of spec 002's **FR-003**/**SC-005** (element
  conservation) is further superseded exactly as this spec's own Superseded
  requirements section states: `WATER` becoming `FOG` (charming), `FOG`
  condensing or raining back to `WATER`, and a rainbow converting `FOG` to
  `RAINBOW_SAND` are all simulation- or object-driven element changes. With
  no fog/cloud on the field, every existing element-conservation invariant
  holds exactly as before (FR-040) — none of this feature's new code paths
  run unless a `FOG` cell is actually present.
- Spec 008's **FR-017** (quenching never spends the water) and **SC-009**
  (100% of the water cells involved are still present afterwards) are
  superseded **only** for the unfuelled case, exactly as this spec's own
  Superseded requirements section states: one adjacent
  water cell becomes fog per such quench (subject to the sky limit), and it
  comes back as rain (FR-007, FR-023). The fuelled case (the burn front)
  is unchanged — spec 008's SC-007 (a one-cell water stripe protects the
  far lawn completely) continues to hold exactly as written.
- Spec 008's **FR-018** (the ⭐ brush must not place star power into a cell
  holding water) is extended rather than weakened: the brush still places
  no star power inside water, but the water inside its footprint is now
  charmed into fog (FR-008). Spec 008's own edge case "a ⭐ drag through the
  lake simply does nothing" no longer holds — it now makes mist.
- Spec 005's **FR-017**/**FR-022** (glitter grains are placed only by the
  wand; the fixed sparkle-flash cap) are extended, not weakened, exactly as
  spec 008 already extended them for star power: fog/cloud's own twinkle is
  a second reuse of the identical `glitter`/`FLASH_CAP = 24` mechanism, and
  the cap is never raised (research.md §8).
- Spec 003's **FR-014** (rainbow conversion) is extended to also cover
  `FOG` (FR-031), exactly as it already covers `SAND`/`DIRT`/`WATER`; spec
  003's **SC-005** (total occupied cells stay constant under the
  simulation) continues to be superseded to the same extent spec 008's own
  data-model already noted — condensing, raining, and charming each
  replace one occupied cell with one occupied cell, so the total is
  unaffected by those; a fog cell erased, wand-skipped-but-untouched, or
  rainbow-converted changes the total (or its composition) only under
  rules the earlier specs already sanction.
- No entity 001–008 already defined changes meaning, shape, or validation
  rules beyond `Grid` gaining `cloud`/`fogRiseCooldown`/`fogStuckSteps`/
  `fogAge`/`cloudRainDelay`/`fogCloudCount` (covered above) — `PlacedObject`/
  `ObjectsState`/`PlayField`/`Re-derivation`/`Toolbar layout`/`Grass cell`/
  `Root-height`/`Absorption-and-growth event`/`Grass ceilings`/`Star power
  cell`/`Fuel state`/`Burn life`/`Ignition event`/`Burnout event`/`Star
  power constants` and every other prior entity are unaffected;
  `resizeGrid` (spec 006) is extended only to also copy the five new
  per-cell fields and maintain `fogCloudCount` per carried cell
  (research.md §14) — its offset/drop/`OBJECT`-skip contract is otherwise
  unchanged (see `contracts/weather-mechanics.md`).
