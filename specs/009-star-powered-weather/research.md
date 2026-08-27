# Phase 0 Research: Star-Powered Weather

This feature's spec carries no `[NEEDS CLARIFICATION]` marker — all three
that ever existed were already resolved on issue #21 before this planning
stage began, and `spec.md`'s own Assumptions/checklist Notes sections record
the resolutions (fuelled star power never steams water; clouds only ever
form against the sky; one gesture makes one round of weather). This document
resolves the remaining *implementation-technology* unknowns needed to fill
Technical Context and unblock Phase 1 design — how fog/cloud state is
represented alongside `007`/`008`'s existing per-cell arrays, how rising,
wandering, gathering, and raining fit the existing single-pass hot loop
without new allocations, how charming plugs into the existing brush and
star-power quench code paths, how the 20%-of-field sky limit is enforced at
a single chokepoint, and how fog/cloud's twinkle is rendered without a new
effects system.

This feature is a direct extension of `001-falling-pink-sand` through
`008-star-power-burns-grass`, whose `src/sim/*` (read from the checked-out
code) already establishes: `Grid` holds `elements`/`shades`/`moved`/`hues`/
`glitter` plus `007`'s `grassHeight`/`grassCooldown`/`grassCount` and `008`'s
`starPowerAge`/`starPowerLife`/`starPowerFuelled` as parallel `Uint8Array`s
(and one plain `grassCount` number) sized `width * height`; `step.ts`'s
single bottom-to-top, left-to-right pass dispatches each unvisited
(`!moved[i]`) cell to `stepPowder`, `stepLiquid`, `stepGrass`, or
`stepStarPower` by element type, using generic `moveCell`/`swapCells`
helpers that copy `elements`/`shades`/`hues`/`glitter` between two indices
and mark both `moved`; `grid.ts`'s `setCell(grid, x, y, element, shade)` is
the one chokepoint every brush/scene/eraser/growth/ignition write funnels
through, already resetting `glitter[i] = 0` and recomputing
`grassHeight`/`grassCooldown`/`grassCount` and
`starPowerAge`/`starPowerLife`/`starPowerFuelled` on every call, with
`igniteStarPower(grid, x, y, fuelled)` as the one chokepoint that *creates* a
star power cell; `brush.ts`/`wand.ts` apply a circular footprint
(`forEachFootprintCell`) per element/tool, with the wand's `applyWandCell`
already skipping `OBJECT`/`STAR_POWER` and otherwise glittering any
non-`EMPTY` cell; `objects.ts`'s `applyRainbowConversions` converts
`SAND`/`DIRT`/`WATER` to `RAINBOW_SAND` via direct array writes (no
`setCell`, since none of those three elements has running-total bookkeeping
to maintain), and `isUnicornTouched` already treats "any non-`EMPTY`,
non-`OBJECT` element" as touching; `scenes.ts` generates two deterministic
landscapes and `loadScene` always `clearGrid`s first; `resize.ts` copies
every per-cell array at a fixed bottom-centre offset, incrementing
`grassCount` for carried grass cells; `PlayArea.svelte` runs one
`requestAnimationFrame` loop (`step` → `applyRainbowConversions` →
`updateUnicorns` → `tickParticles` → `updateFlashMask` → `render`), with
`render()` applying a shimmer/flash brightness boost to any cell with
`glitter[i] === 1` regardless of element, and picking a base RGB via a
per-element `colorFor` switch over hand-picked 6–8-entry shade ramps;
`Toolbar.svelte`/`layout.ts` are already at whatever size five prior
features' controls fill.

## 1. Fog and cloud are one new element with a sub-state flag — extending star power's fuelled/unfuelled precedent

- **Decision**: Add a single new constant, `FOG = 8`, to `src/sim/types.ts`'s
  element constants and `Element` union — no second `CLOUD` element value.
  `Grid` gains a new `cloud: Uint8Array` (`0` or `1`) alongside `elements`:
  a cell with `elements[i] === FOG && cloud[i] === 0` is rising sparkle-mist;
  `elements[i] === FOG && cloud[i] === 1` is a gathered cloud. `step()`'s
  dispatcher gains one more branch, `else if (element === FOG)
  stepFog(grid, x, y, i)`, which itself branches on `cloud[i]` at its very
  top to call one of two private per-state functions.
- **Rationale**: FR-001 explicitly leaves this choice to the plan ("Fog and
  cloud MAY be one new lightweight element in two states rather than two
  separate element types... either way the element set grows by at most one
  entry"), and the codebase already has exactly this shape of precedent:
  `STAR_POWER`'s `starPowerFuelled` flag distinguishes two behaviorally
  different sub-states of one element without doubling every dispatch/
  render/eraser/wand branch's element check. Fog and cloud are visually and
  behaviorally distinct (FR-002 vs FR-003, rising vs static) in exactly the
  same "one element, one flag" shape fuelled/unfuelled already is, so a
  second element constant would only duplicate every `element === FOG ||
  element === CLOUD` check this feature would otherwise need across
  `brush.ts`, `wand.ts`, `objects.ts`, `element.ts`, and `PlayArea.svelte`
  for no behavioral benefit — one comparison (`elements[i] === FOG`) is
  sufficient everywhere except the handful of places that must tell the two
  sub-states apart (rendering, and `step.ts`'s own dispatch), which read
  `cloud[i]` instead.
- **Alternatives considered**: Two separate elements (`FOG` and `CLOUD`) —
  rejected: doubles the element-equality checks needed in every generic
  consumer (brush "treat as empty," wand "skip," rainbow "convert," unicorn
  "touched by") for a distinction only `step.ts`'s own dispatch and
  `PlayArea.svelte`'s `colorFor` actually need to make, and the spec's own
  FR-001 explicitly favors the one-element-two-states framing. Packing the
  fog/cloud distinction into the existing `shades[i]` byte (e.g., shade `0`
  means cloud) — rejected: `shades[i]` already carries the per-cell color-
  ramp index used for FR-002's "per-cell shade variation," and overloading
  it with state semantics would make a charmed cell's random initial shade
  collide with the cloud sentinel.

## 2. Per-cell state: five new parallel arrays plus a running field-share count, one creation chokepoint that owns the sky limit

- **Decision**: `Grid` gains five new array fields, allocated by
  `createGrid`, plus one new plain number:
  - `cloud: Uint8Array` (`0`/`1`) — see §1.
  - `fogRiseCooldown: Uint8Array` — simulation steps remaining before this
    fog cell's next rise attempt; drawn fresh in `[3, 5]` (FR-012) whenever
    the cell is created or successfully rises, meaningful only where
    `elements[i] === FOG && cloud[i] === 0`.
  - `fogStuckSteps: Uint16Array` — consecutive simulation steps (not
    attempts) during which this fog cell has failed to rise at all; reset to
    `0` on every successful upward move, incremented every other step it is
    fog. Needs 16 bits because its condensation threshold (300, FR-016) and
    fogAge's (1800, next bullet) both exceed a `Uint8Array`'s 255 ceiling.
  - `fogAge: Uint16Array` — simulation steps since this cell most recently
    *entered its current sub-state*: reset to `0` when charming creates the
    cell, and reset to `0` again at the fog→cloud transition. While
    `cloud[i] === 0`, compared against `FOG_MAX_LIFE = 1800` (FR-016's "in
    any case" 30-second cap) to force condensation regardless of stuckness.
    While `cloud[i] === 1`, compared against this same cell's own
    `cloudRainDelay[i]` (next bullet) to trigger rain. One field serves both
    purposes — never both at once, since `cloud[i]` picks which meaning
    applies — exactly the same "one field, state-dependent meaning" shape
    `008`'s `starPowerAge` already has relative to `starPowerFuelled`.
  - `cloudRainDelay: Uint16Array` — this cloud cell's own total hold time in
    `[180, 480]` steps (FR-020), drawn once at the fog→cloud transition and
    never modified afterward, meaningful only where `cloud[i] === 1`.

  `Grid` also gains `fogCloudCount: number` — a running total of cells where
  `elements[i] === FOG` (fog and cloud together), maintained the same way
  `grassCount` already is. A single new exported function in `grid.ts`,
  `createFog(grid, x, y): boolean`, is the **only** way a fog cell is ever
  created: it first checks `fogCloudCount < Math.floor(width * height *
  FOG_FIELD_SHARE_CEILING)` (`FOG_FIELD_SHARE_CEILING = 0.20`, FR-011); if
  the sky is already full it returns `false` and touches nothing; otherwise
  it calls `setCell(grid, x, y, FOG, randomShade())`, sets
  `cloud[i] = 0`, `fogRiseCooldown[i] = randomFogRiseCooldown()` (§4),
  `fogStuckSteps[i] = 0`, `fogAge[i] = 0`, `setGlitter(grid, x, y, 1)`
  (twinkle, §8), and returns `true`.
- **Rationale**: Rise cadence, stuckness, total lifetime, and rain delay are
  none of them structurally derivable from neighboring cells the way
  `grassHeight` is — they are per-cell timers that must be drawn once and
  ticked, exactly the role `008`'s `starPowerAge`/`starPowerLife` already
  play. Funnelling every creation through one `grid.ts` function that
  *itself* enforces FR-011's ceiling — rather than requiring every caller
  (the brush, the star-power quench handler) to separately check a
  `canCharm`-style predicate first — makes it structurally impossible for a
  future call site to accidentally create fog past the ceiling: FR-011 is
  this feature's central safety/boundedness guarantee (the issue's own "it
  must settle rather than run away"), so it is worth enforcing at the one
  place fog can come into existence rather than trusting every caller to
  remember. This is a deliberately *stronger* guarantee than `008`'s own
  `isEligibleTarget` precedent (grass's field-share ceiling is checked by
  the caller, `pickGrowthTargetIndex` in `step.ts`, not inside a `grid.ts`
  chokepoint) — justified because grass's ceiling is a pacing nicety, while
  fog's ceiling is the difference between "settles" and "runs away."
- **Alternatives considered**: A separate `canCharm(grid): boolean` exported
  from `grid.ts` or `step.ts`, checked by each of the two call sites before
  calling an unconditional `createFog` — rejected per the rationale above:
  every future call site would need to remember to check it first, and nothing
  would stop a mistake. Storing `fogStuckSteps`/`fogAge`/`cloudRainDelay` as
  `Uint8Array`s with a lower cap (e.g., clamping the 1800-step lifetime down
  to 255) — rejected outright: it would silently violate FR-016's literal
  30-second/1800-step bound.

## 3. `setCell`/`clearGrid` reset fog bookkeeping and maintain `fogCloudCount`, exactly as they already do for grass and star power

- **Decision**: `setCell(grid, x, y, element, shade)` gains, after its
  existing writes: track `wasFog = elements[i] === FOG` before the write
  (alongside the existing `wasGrass` check) and `becomesFog = element ===
  FOG` after; increment/decrement `fogCloudCount` the same way `grassCount`
  already is. Always set `fogRiseCooldown[i] = 0`, `fogStuckSteps[i] = 0`,
  `fogAge[i] = 0`, `cloud[i] = 0`, `cloudRainDelay[i] = 0` whenever `element
  !== FOG`. `clearGrid` additionally fills all five new arrays to `0` and
  resets `fogCloudCount = 0`.
- **Rationale**: Direct extension of the exact `grassCount`/`starPowerAge`
  reset pattern `007`/`008` already established — any cell whose element
  changes away from `FOG` (erased, converted by a rainbow, painted over,
  condensed to water, rained out, overwritten by a scene load) must not
  leave stale timers behind for a future, unrelated write at that index to
  inherit. A write that *becomes* `FOG` only ever happens inside `createFog`
  (§2), which sets every fog-specific field itself in the same synchronous
  call immediately after `setCell` returns, so the momentarily-inconsistent
  state (freshly `FOG` but not yet timed) is never observed by any other
  code.
- **Alternatives considered**: None of substance — this is the minimal,
  direct extension of an already-twice-established chokepoint pattern.

## 4. Randomized timers: rise cooldown and rain delay, alongside `randomBurnLife`

- **Decision**: `src/sim/shade.ts` gains two exported helpers:
  `randomFogRiseCooldown(): number`, returning a uniform integer in `[3, 5]`
  inclusive (FR-012's 3–5-step rise cadence), and `randomCloudRainDelay():
  number`, returning a uniform integer in `[180, 480]` inclusive (FR-020's
  3–8-second hold time).
- **Rationale**: `shade.ts` is already this project's home for small, pure
  randomness helpers used by `grid.ts` (`randomBurnLife`, moved-in
  `randomHue`) — keeping these two alongside them makes both independently
  unit-testable (FR-042's "the rise rate... bounds" and "every cloud cell
  raining within its bounds") without exporting internals of `grid.ts` or
  `step.ts`.
- **Alternatives considered**: Fixed values (always rise every 4 steps;
  always rain at exactly 300 steps) — rejected outright by FR-012's and
  FR-020's own explicit "varying... so a plume is watched climbing" and "so
  a cloud patters raggedly rather than dumping all at once" wording.

## 5. `stepFog`'s fog branch: lifetime check, cooldown, then a bias-free three-way wander-rise, reusing `moved` and the sky-ceiling/cloud-above precedence FR-017 requires

- **Decision**: A new private function in `step.ts`, `stepFog(grid, x, y,
  i)`, dispatches immediately on `cloud[i]` (`1` → `stepCloud`, §6; `0` →
  the fog logic below). The fog branch, every step:
  1. **Total lifetime** (FR-016's "in any case"): `age = fogAge[i] + 1`;
     if `age >= FOG_MAX_LIFE` (1800), call `condenseFog(grid, x, y, i)`
     (§6) and return. Otherwise store `fogAge[i] = age`.
  2. **Cooldown** (FR-012's pacing): if `fogRiseCooldown[i] > 0`,
     decrement it, increment `fogStuckSteps[i]`, and — if that now reaches
     `FOG_STUCK_LIMIT` (300, FR-016) — condense and return; otherwise just
     return (waiting is not yet "stuck" in the sense of FR-024's settling
     guarantee, but it is still a step this cell did not rise, so the
     counter advances literally per FR-016's "consecutive simulation
     steps" wording).
  3. **Sky-ceiling / cloud-above precedence** (FR-017): let `aboveY = y -
     1`. If `aboveY < 0` (the sky ceiling itself) or `elements[aboveY *
     width + x] === FOG && cloud[aboveY * width + x] === 1`, call
     `becomeCloud(grid, x, y, i)` (§6) and return — checked *before* any
     wander logic, so a cell directly under the ceiling or an existing
     cloud always joins it rather than wandering sideways to look for
     another way up, matching the spec's explicit "clouds only ever form
     against the sky" decision.
  4. **Wander-rise**: draw a preferred horizontal offset uniformly from
     `{-1, 0, +1}`; try, in order, the preferred candidate, then straight
     up (`dx = 0`, if not already the preferred one), then the remaining
     diagonal — with the two-diagonal fallback order itself randomized
     when the preferred offset was `0`, so neither side is ever favored —
     stopping at the first candidate that is a legal target. The `dx = 0`
     candidate is a legal target if it is `EMPTY` (move) or `WATER` (swap
     — FR-014's bubbling); a `dx = ±1` candidate is a legal target only if
     it is `EMPTY` (diagonal wander never bubbles through water, and never
     displaces grass/powder/objects/another fog cell/the walls — FR-005,
     FR-015). On success: `moveCell`/`swapCells` (§9) into the chosen
     index, then at the *new* index set `fogRiseCooldown = randomFogRise
     Cooldown()` and `fogStuckSteps = 0`. On failure (none of the three is
     legal): increment `fogStuckSteps[i]`, and if it now reaches
     `FOG_STUCK_LIMIT`, condense.
- **Rationale**: Checking total lifetime first, unconditionally, is the
  direct reading of FR-016's "in any case" — a fog cell must age out at
  1800 steps whether or not it is presently mid-cooldown or genuinely
  stuck. Counting cooldown-waiting steps toward `fogStuckSteps` is the
  literal reading of "unable to rise for 300 *consecutive simulation
  steps*" (not "300 failed rise attempts") — in practice this never
  triggers spuriously for healthy fog, since a cell rising every 3–5 steps
  resets the counter to `0` on each success long before 300 accumulates;
  it only matters for fog that is *actually* boxed in. Checking the
  sky-ceiling/cloud-above condition before rolling a wander direction (not
  as a mere wander-fallback) is what makes FR-017's "fog blocked by
  ordinary matter... MUST NOT become cloud" vs "fog blocked by the sky
  ceiling or a cloud... MUST become cloud" a clean, unambiguous priority
  rather than something that only sometimes fires depending on the random
  wander roll. The three-way, always-rolled wander (rather than "only
  wander when blocked," which a naive port of `stepPowder`'s diagonal-
  fallback shape would produce) is required by Acceptance Scenario 4 under
  User Story 1 ("it wanders from side to side as it climbs... rather than
  rising in a rigid straight column") — a plume in open sky with nothing
  blocking it directly above must still visibly wobble, not march straight
  up, which only happens if the preferred direction is sometimes diagonal
  even when "straight" is open. The symmetric fallback order (mirrored for
  `dx = -1` vs `dx = +1`, and randomized when the preferred offset is `0`)
  is what gives SC-005's "net horizontal drift of `0` over a long run" —
  any asymmetric tie-break would introduce a slow, detectable bias over
  thousands of steps. Restricting diagonal wander to `EMPTY`-only (never
  bubbling through water diagonally) is a direct, minimal reading of
  FR-014's specific wording ("exchanging places with a water cell directly
  above it") — the spec never asks for diagonal bubbling, and this keeps a
  fully submerged fog cell rising in a straight column through the lake
  (SC-006) until it breaches the surface, where wandering then begins
  naturally once the water above the direct path runs out. Resetting
  `fogRiseCooldown`/`fogStuckSteps` at the cell's *new* index after a move
  (not the old one, which is about to become whatever the fog swapped
  with, or `EMPTY`) is required because `moveCell`/`swapCells` (§9) already
  carry the *old* cooldown/stuck values along with the move — re-drawing
  cooldown fresh and zeroing stuck after every successful rise is what
  produces FR-012's steady 3–5-step cadence rather than a cadence that
  drifts based on how many times the cell was previously blocked.
- **Alternatives considered**: Modeling fog's movement as a direct port of
  `stepPowder`'s "always prefer straight, fall back to diagonal only when
  blocked" shape — rejected per the rationale above, since it produces a
  rigid straight-line climb in open sky, failing the spec's own explicit
  "wobbles... rather than a rigid straight column" acceptance scenario.
  Letting diagonal wander also bubble through water — rejected as an
  unrequested extension of FR-014's literal "directly above" wording, and
  unnecessary for SC-006 (a straight-up-only bubble path already reaches
  the surface in 100% of cases). A single combined "attempted this step"
  counter instead of separate `fogRiseCooldown`/`fogStuckSteps` fields —
  rejected: cooldown-ticking and stuckness have different reset triggers
  (a successful rise resets both; a cooldown tick alone resets neither),
  so collapsing them into one field would conflate "hasn't tried yet" with
  "has tried and failed."

## 6. `becomeCloud`, `stepCloud`, `condenseFog`, and rain — each a one-line `setCell`-based transition, mirroring `extinguishStarPower`'s shape

- **Decision**: Four small private helpers in `step.ts`:
  - `becomeCloud(grid, x, y, i)`: sets `cloud[i] = 1`, `fogAge[i] = 0`,
    `cloudRainDelay[i] = randomCloudRainDelay()` (§4), `fogRiseCooldown[i]
    = 0`, `fogStuckSteps[i] = 0` — the cell's `elements[i]` stays `FOG`
    throughout (only the sub-state flag changes), so `fogCloudCount`
    (§2/§3) does not change either.
  - `stepCloud(grid, x, y, i)`: `age = fogAge[i] + 1`; if `age >=
    cloudRainDelay[i]`, call `rain(grid, x, y, i)`; otherwise store
    `fogAge[i] = age`. A cloud cell's `(x, y)` is never read for any
    movement decision — it does not call `moveCell`/`swapCells`/any
    neighbor scan at all (FR-018).
  - `condenseFog(grid, x, y, i)`: `setCell(grid, x, y, WATER,
    randomShade())` — turns a stuck or over-age fog cell into exactly one
    water cell in place (FR-016), which then falls under the existing
    `stepLiquid` rules on a later pass (or the next step, since `step()`'s
    single pass does not re-visit an index once its element has changed
    this tick unless a later cell moves into it).
  - `rain(grid, x, y, i)`: `setCell(grid, x, y, WATER, randomShade())` —
    functionally identical to `condenseFog`, kept as a separate,
    similarly-named function purely for readability at each call site
    (FR-020/FR-021).
- **Rationale**: Every one of these four events is, at the state-machine
  level, "this cell's element or sub-state changes in place," exactly the
  shape `008`'s `extinguishStarPower` already established for quench/
  burnout. None of them ever calls `moveCell`/`swapCells` (cloud never
  moves, and condensing/raining replace a cell's *contents* without
  relocating it), and each goes through `setCell`, so `grid.ts`'s
  invariants (§3) — including `fogCloudCount` staying accurate — hold
  automatically without any of these four functions needing to touch the
  counter directly (only `becomeCloud`, which does not change
  `elements[i]`, needs to *not* touch it, which it correctly does not).
- **Alternatives considered**: A single `resolveFogTimer(grid, x, y, i,
  outcome)` covering all four cases with a switch — rejected for
  readability; each event has a different precondition and a different,
  independently-named call site in `stepFog`/`stepCloud`, and the amount of
  logic in each is small enough that a shared wrapper would only add an
  extra indirection with no reuse benefit (unlike `extinguishStarPower`,
  which genuinely shares one outcome table between two distinct triggering
  events).

## 7. Charming: the ⭐ brush's new water branch and `stepStarPower`'s quench extension, both funnelled through `createFog`

- **Decision**: Two call sites, both calling the one `createFog` chokepoint
  (§2):
  - `brush.ts`'s `paintCell` gains one more branch: `tool === 'star' &&
    current === WATER` → `createFog(grid, x, y)` (ignoring its boolean
    result — if the sky is already full, the call is simply a no-op,
    matching FR-011's "the water stays water, with nothing on screen to
    tell her off"). No star power cell is ever placed into a water cell —
    this branch calls `createFog` directly, never `igniteStarPower`
    (FR-008, carrying forward `008`'s own FR-018 unchanged).
  - `step.ts`'s `stepStarPower` is extended: its existing four-neighbor
    quench scan is changed from a boolean `quenched` flag to remembering
    *which* orthogonal neighbor index first matched `WATER` (mirroring
    `stepGrass`'s own `waterIndex` pattern), call it `quenchWaterIndex`.
    When a match is found: read `fuelled = starPowerFuelled[i] === 1`
    *before* calling the existing `extinguishStarPower(grid, x, y, i)`
    (unchanged — still produces a glitter grain or `EMPTY` exactly as
    `008` wrote it); then, only if `!fuelled`, call `createFog(grid,
    quenchWaterIndex % width, Math.floor(quenchWaterIndex / width))` and,
    if it returned `true`, set `grid.moved[quenchWaterIndex] = 1` (see
    below) — a fuelled star power cell (the burn front) leaves the water
    completely untouched, exactly as `008`'s FR-016/FR-017 already
    required and as this spec's FR-007 explicitly re-affirms.
- **Rationale**: This is FR-007's and FR-008's central rule, and routing
  both call sites through the same `createFog` chokepoint means the 20%
  sky-limit gate (§2) applies uniformly with no duplicated capacity check.
  Reading `fuelled` before calling `extinguishStarPower` (rather than after)
  matters because `extinguishStarPower`'s own `setCell` call zeroes
  `starPowerFuelled[i]` as a side effect (§3 of `008`'s data-model) — by the
  time it returns, the fuel state that decided *this* star-power cell's own
  outcome is no longer readable at that index. Setting
  `grid.moved[quenchWaterIndex] = 1` mirrors `008`'s own research.md §5
  precedent for newly-ignited neighbors: the bottom-to-top scan could still
  visit `quenchWaterIndex` later in this same pass (e.g., a star power cell
  quenched by water directly *above* it, at `y - 1`, which the scan has not
  reached yet), and without the flag that freshly-created fog cell could be
  processed a second time in the same tick, letting one frame's charming
  silently race ahead of `stepFog`'s own 3–5-step pacing.
- **Alternatives considered**: Checking sky-fullness at each call site
  before calling an always-successful `createFog` — rejected per §2's
  rationale (single chokepoint is the stronger guarantee). Extinguishing
  the star power cell only *after* successfully charming the water (so a
  full sky would also leave the star power cell burning) — rejected: FR-011
  only gates *fog creation*, not the star-power cell's own independent
  extinguish rule (spec 008's water-always-wins guarantee), so the two must
  stay decoupled exactly as the spec's own wording keeps them.

## 8. Twinkle reuses the existing glitter/shimmer/flash-cap pipeline — no new render mechanism

- **Decision**: `createFog` (§2) calls `setGlitter(grid, x, y, 1)`
  immediately after creating the cell; `becomeCloud` does not need to (the
  cell's `glitter[i]` is already `1` from when it was fog, and
  `moveCell`/`swapCells`'s existing glitter-copy already carries it along
  during every rise, §9). No change to `render()`, `updateFlashMask`, or
  `FLASH_CAP` is needed.
- **Rationale**: Exactly `008`'s own research.md §7 precedent: `glitter` is
  already a generic "this cell shimmers" flag, not an exclusively-glitter-
  grain flag, and `render()`'s existing per-cell loop already applies its
  brightness-oscillation shimmer plus the reservoir-sampled flash-cap boost
  to any cell with `glitter[i] === 1` regardless of element. This
  satisfies FR-038's "must be a rendering effect that allocates nothing per
  frame and MUST NOT raise the number of simultaneous sparkle flashes...
  above the fixed caps spec 005 already sets" *by construction* — it is the
  same `FLASH_CAP = 24` reservoir fog/cloud now also compete for, not a
  second one. The flag is cleared automatically the moment a cell stops
  being `FOG`, because `setCell` already zeroes `glitter[i]` on every write
  unconditionally (§3) — so condensing, raining, being erased, rainbow-
  converted, or overwritten by a scene load all correctly stop the twinkle
  with no extra code.
- **Alternatives considered**: A second, fog/cloud-specific flash reservoir
  — rejected outright by FR-038's explicit "must not raise... above the
  fixed caps." Not glittering fog/cloud at all and relying solely on the
  new shade ramps (§17) for visual distinctiveness — rejected: FR-002's
  "carrying... a soft twinkle" and the spec's own visual-checks section
  ("the mist reads as pretty sparkle-mist") call for the same shimmering
  quality every other magical element in this toy already has.

## 9. `moveCell`/`swapCells` extended to carry the five new fog fields

- **Decision**: `step.ts`'s generic `moveCell(grid, fromIndex, toIndex)` and
  `swapCells(grid, aIndex, bIndex)` — used by `stepPowder`, `stepLiquid`,
  and now `stepFog` — are extended to also move/swap `cloud`,
  `fogRiseCooldown`, `fogStuckSteps`, `fogAge`, and `cloudRainDelay` between
  the two indices, using the exact same copy-then-zero-the-source-index
  shape already used for `elements`/`shades`/`hues`/`glitter`.
- **Rationale**: Fog and cloud are the first elements in this toy's history
  that need generic position-changing (`moveCell`/`swapCells`) rather than
  the in-place `setCell` transitions grass and star power exclusively use —
  a rising fog cell's cooldown/stuck/age state must travel with it, or the
  cadence and lifetime rules in §5 would reset incorrectly every time the
  cell moved. Extending the two already-shared helpers (rather than writing
  fog-specific `moveFogCell`/`swapFogCell` variants) keeps `stepPowder`/
  `stepLiquid`'s own call sites completely unchanged and avoids a second,
  parallel move/swap implementation; the five extra field copies are `O(1)`
  per call and add a small constant-factor cost to every mover (including
  plain sand/water, which now also copy five always-zero values along) —
  an accepted, deliberate trade-off in favor of one shared, uniform
  mechanism over per-element special-casing, matching this codebase's
  existing preference (Constitution Principle III) for reuse over
  invention.
- **Alternatives considered**: Special-casing `moveCell`/`swapCells` to only
  copy the fog fields when `elements[fromIndex] === FOG` — rejected: an
  `if` check per call would cost about as much as the five unconditional
  copies it is trying to avoid, for meaningfully more code and a second
  code path to keep in sync with the first.

## 10. `stepPowder`/`stepLiquid` extended so falling grains and water sink through fog/cloud exactly as they already sink through a liquid

- **Decision**: `stepPowder`'s "directly below" check gains `|| elements[
  belowIndex] === FOG` alongside its existing `isLiquid(elements[
  belowIndex])` swap condition (so a powder directly above fog/cloud swaps
  with it, sinking through). `stepLiquid`'s "directly below" check gains a
  new `else if (belowInBounds && elements[belowIndex] === FOG)
  swapCells(...)` branch alongside its existing `EMPTY`-only `moveCell`
  case. Neither function's diagonal-below checks are changed — diagonal
  sinking through fog/cloud is not something the spec requires (only "the
  cell directly above," FR-004), so leaving it unchanged is the minimal
  reading: a grain diagonally above fog simply does not take that diagonal
  path, which is not the same as fog "supporting" it (the grain is free to
  fall straight down, sit, or take the other diagonal exactly as it would
  with any other occupied diagonal neighbor it declines).
- **Rationale**: This is the direct implementation of FR-004 ("any powder
  or water occupying the cell directly above a fog or cloud cell MUST sink
  into it, the two exchanging places... MUST NOT support, hold up, or delay
  any grain by more than one simulation step") and SC-016 ("sinks through it
  within 1 simulation step in 100% of cases"). Reusing the exact `swapCells`
  call already used for sinking through water (rather than a new "sink
  through fog" code path) means fog/cloud automatically inherit every
  existing liquid-sink guarantee stepPowder/stepLiquid already provide,
  including interacting correctly with the diagonal-fall logic that comes
  after the straight-down check in `stepPowder`.
- **Alternatives considered**: Also extending the diagonal-below checks to
  admit `FOG` — rejected as an unrequested extension beyond FR-004's literal
  "directly above" wording, and unnecessary: nothing in the spec's
  acceptance scenarios or success criteria exercises a grain resting
  diagonally above fog needing to fall through it, only straight above.

## 11. Brush: every element brush treats fog/cloud as empty; one new star+water branch

- **Decision**: `brush.ts`'s `paintCell` computes `paintable = current ===
  EMPTY || current === FOG` once per call, and every existing branch's
  `current === EMPTY` check becomes `paintable` (sand/dirt/grass keep their
  additional `|| current === WATER` allowance unchanged; water/star gain
  `paintable` in place of their previous `current === EMPTY`-only check).
  The existing `star` + `GRASS` branch (ignite fuelled) is unchanged. One
  new branch is added: `tool === 'star' && current === WATER` →
  `createFog(grid, x, y)` (§7). The `eraser` branch is unchanged
  (`setCell(grid, x, y, EMPTY, 0)` already correctly removes fog/cloud via
  the generic reset in §3).
- **Rationale**: Direct implementation of FR-026 ("Every element brush and
  the eraser MUST treat fog and cloud as they treat empty cells... the mist
  there is simply gone"). Computing `paintable` once and substituting it
  for every existing `current === EMPTY` comparison is the minimal-diff way
  to extend five existing branches identically, rather than adding a
  parallel `|| current === FOG` to each one individually.
- **Alternatives considered**: A dedicated `isFog(e)` predicate in
  `element.ts` — considered for symmetry with `isPowder`/`isLiquid`/
  `isSolid`, but not adopted: every other single-element comparison in this
  codebase (`element === OBJECT`, `element === STAR_POWER`, `element ===
  GRASS`) is written as a direct equality check rather than a named
  predicate, and `FOG` is a single element value here (§1), not a family —
  a one-element "family" predicate would be a needless wrapper around
  `element === FOG`.

## 12. Wand: one more early-return skip, exactly star power's own precedent

- **Decision**: `wand.ts`'s `applyWandCell` early-return condition becomes
  `if (element === OBJECT || element === STAR_POWER || element === FOG)
  return;`.
- **Rationale**: Direct implementation of FR-030 ("The sparkle wand MUST
  leave fog and cloud exactly as they are — neither glittered, nor
  emptied, nor retyped... since they are not empty cells"), using the
  identical mechanism `008`'s research.md §9 already added for
  `STAR_POWER`. The existing `else if (isSprinkleSite(...))` sprinkle
  branch remains unreachable for a fog/cloud cell regardless (it only
  triggers when `element === EMPTY`).
- **Alternatives considered**: None of substance — this is the same
  one-line extension of an already-established pattern.

## 13. Rainbow conversion: one small addition; unicorn touch needs zero change

- **Decision**: `objects.ts`'s `applyRainbowConversions` condition gains
  `|| element === FOG` alongside its existing `SAND`/`DIRT`/`WATER` check;
  immediately before the direct `grid.elements[i] = RAINBOW_SAND` write,
  add `if (element === FOG) grid.fogCloudCount--;` (this function writes
  the array directly rather than calling `setCell`, exactly as it already
  does for `SAND`/`DIRT`/`WATER`, so it must maintain `fogCloudCount`
  itself — the one piece of bookkeeping this direct-write path needs that
  the other three converted elements never required). `isUnicornTouched`
  needs no change: its existing "any element that is not `EMPTY`/`OBJECT`"
  rule already counts a `FOG` cell (fog or cloud) as touching.
- **Rationale**: Direct implementation of FR-031 ("Placed rainbows MUST
  convert fog and cloud into rainbow sand exactly as they already convert
  water... Placed unicorns MUST celebrate when fog or cloud touches them
  under the existing... rule, with no new burst type"). The one-line
  `fogCloudCount--` is the only bookkeeping this function needs to add,
  since — unlike `setCell` — it does not go through the chokepoint that
  would otherwise maintain the counter automatically.
- **Alternatives considered**: Routing this conversion through `setCell`
  instead of a direct array write — rejected: `applyRainbowConversions`
  already writes `SAND`/`DIRT`/`WATER` directly for performance (no
  per-cell function-call overhead across a rainbow's whole zone every
  frame), and none of those three needs `setCell`'s bookkeeping either; only
  `fogCloudCount` needs manual maintenance here, which one decrement line
  provides without paying for a full `setCell` call.

## 14. Resize: straight per-field copy plus `fogCloudCount` bookkeeping, exactly grass's own precedent

- **Decision**: `resizeGrid`'s existing copy loop (`resize.ts`) also copies
  `cloud`, `fogRiseCooldown`, `fogStuckSteps`, `fogAge`, and
  `cloudRainDelay` for every carried cell, and adds `if (oldGrid.elements[
  srcIndex] === FOG) grid.fogCloudCount++;` alongside the existing `if
  (oldGrid.elements[srcIndex] === GRASS) grid.grassCount++;` line.
- **Rationale**: Direct implementation of FR-034 ("Play-field re-derivation
  MUST carry fog and cloud across on exactly the same best-effort, bottom-
  centre-anchored basis as every other element. A cell's rise, condense, or
  rain timer need not survive a re-derivation, but the cell MUST remain fog
  or cloud and MUST go on through the cycle normally afterwards"). Copying
  the timers verbatim (rather than resetting them) is simpler than
  manufacturing fresh random timers mid-resize and is a strict superset of
  what FR-034 requires — "need not survive" permits, but does not require,
  discarding them, exactly the judgment call `008`'s research.md §11 already
  made for `starPowerAge`/`starPowerLife`. `fogCloudCount` must be
  recomputed during resize (it is a running total on the *new* grid, which
  `createGrid` zero-initializes) exactly as `grassCount` already is.
- **Alternatives considered**: Resetting every carried fog cell's timers to
  fresh random draws at resize time — rejected as needless extra logic for
  a case FR-034 explicitly says is optional to preserve.

## 15. Scenes: zero change

- **Decision**: No change to `scenes.ts`.
- **Rationale**: Neither `generateLandscape1` nor `generateLandscape2` ever
  calls `createFog` or writes `FOG` (FR-035 — "No scene may be seeded with
  fog or cloud"); `loadScene`'s existing `clearGrid` call (§3) already wipes
  any fog/cloud from a previously-live field, including resetting
  `fogCloudCount` to `0`, before generating the chosen scene's contents.
- **Alternatives considered**: None of substance.

## 16. Toolbar: zero change — the one place this feature is structurally simpler than spec 008

- **Decision**: No change to `Toolbar.svelte` or `layout.ts`.
- **Rationale**: FR-027 explicitly forbids a new control ("This feature
  MUST NOT add any toolbar control. The whole cycle is emergent from the ⭐
  star power and 💧 water tools the child already has"). Unlike `008`,
  which added a fifth element button and bumped `tests/unit/lib/
  layout.test.ts`'s `TOOLBAR_CONTROL_COUNT` from 15 to 16, this feature
  needs no toolbar-layer change at all — `computeToolbarLayout`'s existing
  arithmetic, and its existing test coverage, are exercised at the same
  control count as spec 008 left them.
- **Alternatives considered**: A control to manually trigger rain, or to
  pause/clear weather specifically — rejected outright by FR-027 and by the
  issue's own framing ("No new toolbar button expected... though the spec
  may decide otherwise if a control genuinely helps"); nothing about this
  feature needs one, since erasing/clearing/waiting already cover every
  case a control might otherwise exist for (FR-036).

## 17. Rendering: two new shade ramps, one `colorFor` branch keyed on the cloud sub-state

- **Decision**: `PlayArea.svelte` imports `FOG` from `../sim/types`, gains
  two new 8-entry ramps — `FOG_RAMP` (pale pearly whites shading into
  palest lavender-pink, mirroring `PINK_RAMP`/`GOLD_RAMP`'s existing
  8-entry shape) and `CLOUD_RAMP` (brighter, higher-lightness off-whites —
  visibly the same family as `FOG_RAMP` but obviously thicker/lighter, per
  FR-003) — and `colorFor` gains a parameter, `isCloud: boolean`, with one
  new branch: `if (element === FOG) return isCloud ? CLOUD_RAMP[shade %
  CLOUD_RAMP.length] : FOG_RAMP[shade % FOG_RAMP.length];`. `render()`'s
  per-cell loop destructures `cloud` from `grid` alongside its existing
  fields and passes `cloud[i] === 1` as `colorFor`'s new argument.
- **Rationale**: Direct implementation of FR-002 ("pale pearly whites and
  palest lavender-pinks with a soft twinkle... MUST NOT read as grey
  smoke... carrying per-cell shade variation from the same per-cell shade
  mechanism the other elements use") and FR-003 ("a soft, fluffy, brighter
  mass — clearly the same family as fog but obviously thicker and settled
  — and MUST be distinguishable from fog at a glance"). Two ramps sharing
  one lookup mechanism (`shades[i] % rampLength`) is the same pattern every
  existing element already uses (`PINK_RAMP`, `BLUE_RAMP`, `PURPLE_RAMP`,
  `GREEN_RAMP`, `GOLD_RAMP`), so no new color-lookup mechanism is invented —
  only two new palettes and one new boolean parameter threading through an
  existing function.
- **Alternatives considered**: Deriving the fog-vs-cloud color purely from
  `shades[i]`'s value range (e.g., shades `0`–`127` are fog, `128`–`255`
  are cloud) instead of reading `cloud[i]` — rejected: it would tie a
  rendering distinction to the same byte `randomShade()` already uses for
  per-cell color variety, permanently halving each sub-state's available
  shade variety and coupling two independent concerns (color variation vs.
  simulation sub-state) that `cloud[i]` already exists to keep separate.

## 18. Test organization: a new `weather.test.ts`, small additions elsewhere, one superseded assertion in `starPower.test.ts`

- **Decision**: The bulk of FR-042's coverage lives in a new
  `tests/unit/sim/weather.test.ts` (mirroring `starPower.test.ts`'s own
  precedent of a dedicated file despite the implementation living in
  `step.ts`/`grid.ts`, not a `weather.ts` module). Small, targeted additions
  go into the existing files whose own concern each touches: `grid.test.ts`
  (`createFog`'s bookkeeping and ceiling-refusal, `setCell`'s reset rule,
  `clearGrid`'s new fills), `brush.test.ts` (the `star`-tool-on-`WATER`
  branch, every brush treating fog/cloud as empty), `wand.test.ts` (the new
  skip), `objects.test.ts` (rainbow conversion of fog/cloud, unicorn
  touched by fog/cloud), `resize.test.ts` (fog/cloud carried across a
  re-derivation), `scenes.test.ts` (zero fog/cloud in any generated scene).
  `starPower.test.ts` gets one existing assertion updated: its prior
  "quenching never spends the water" case (spec 008's now-superseded
  FR-017/SC-009, for the *unfuelled* case only) is replaced with "an
  unfuelled quench charms exactly the one adjacent water cell into fog,
  while a fuelled quench still leaves the water completely untouched" —
  the fuelled-case half of that old assertion is carried forward unchanged
  (this spec's own Superseded requirements section states exactly this
  split). `tests/unit/lib/layout.test.ts`, `tests/unit/sim/grass.test.ts`,
  and `tests/unit/sim/step.test.ts` need no change at all (§16; fog/cloud
  coverage lives in `weather.test.ts` instead of `step.test.ts`, mirroring
  how star-power coverage lives in `starPower.test.ts` instead).
- **Rationale**: Same reasoning `007`'s research.md §10 and `008`'s
  research.md §14 already gave: `step.ts` staying implementation-unified
  doesn't require its tests to stay file-unified, and FR-042's rule list is
  large enough (charming from two sources, rise/wander bounds, bubbling,
  blocking, condensing, gathering, raining, conservation, settling, no
  feedback, brush/eraser/wand/rainbow/unicorn/resize/scene interaction,
  byte-identical-with-nothing-on-the-field regression) to warrant a
  dedicated home.
- **Alternatives considered**: Leaving `starPower.test.ts`'s superseded
  assertion in place and adding a contradicting new one in `weather.test.ts`
  — rejected: two tests asserting opposite things about the same rule would
  make the suite's intent unreadable; the spec's own Superseded requirements
  section is explicit that this is a deliberate narrowing (fuelled case
  unchanged, unfuelled case superseded), so the existing test is updated in
  place to match, not left contradicted.

## 19. No new runtime dependency

- **Decision**: This feature needs no new package, browser API, or build
  step — every new capability (one new element constant, five new parallel
  arrays plus one running count, two new small exported helpers in
  `shade.ts`, one new `grid.ts` chokepoint function, four new `step.ts`
  private helpers plus one extended dispatcher branch, two extended generic
  move/swap helpers, two extended fall-through checks, one extended brush
  branch set, one extended wand skip, one extended rainbow-conversion
  condition, one extended resize copy loop, two new shade ramps, and one
  extended `colorFor` signature) is built from mechanisms 001–008 already
  established.
- **Rationale**: Constitution Principle III and the project's unbroken
  precedent (every prior feature shipped with zero new dependencies).
- **Alternatives considered**: None — no candidate dependency was ever in
  scope for a feature this close to the existing engine's own primitives.

All Technical Context unknowns are resolved; nothing carries forward to
Phase 1 as unresolved.

## Decisions made without clarification

No spec-level `[NEEDS CLARIFICATION]` marker existed to resolve (all three
that ever existed were already answered on issue #21, and `spec.md`'s own
Assumptions/checklist-Notes sections record the resolutions, before this
planning stage began). The following implementation-technology choices were
made without further clarification because the spec leaves them as
implementation detail, not product intent:

- Representing fog and cloud as one element (`FOG = 8`) plus a `cloud`
  sub-state flag, rather than two separate element constants (§1) — FR-001
  explicitly leaves this choice to the plan.
- The exact per-cell state shape (five new parallel arrays plus a running
  `fogCloudCount`, §2) and enforcing the FR-011 sky-limit *inside* the
  `createFog` chokepoint rather than requiring callers to check a separate
  predicate first (§2) — a deliberately stronger safety posture than
  `008`'s own grass-ceiling precedent, chosen because FR-011 is this
  feature's central boundedness guarantee.
- The specific wander algorithm — a uniformly-drawn preferred direction
  with a symmetric two-step fallback (§5) — is a direct reading of FR-013's
  bound and SC-005's zero-net-drift requirement, but the exact control-flow
  shape (as opposed to, e.g., a lookup-table or weighted-probability
  approach reaching the same bound) is implementation detail.
- Restricting diagonal wander to `EMPTY`-only targets, never bubbling
  through water diagonally (§5, §10) — a minimal reading of FR-014's
  "directly above" wording.
- Reusing the existing `glitter`/shimmer/flash-cap pipeline for fog and
  cloud's own twinkle (§8), exactly as `008` already did for star power —
  a direct, minimal-diff reading of FR-038's "must not raise the sparkle
  flash caps," but the specific mechanism is an implementation choice.
- The two new ramps' exact palette values (§17) are a starting point for
  the maintainer's own visual-checks pass (constitution Principle V), not a
  pinned final palette — the requirement is "pale pearly/lavender for fog,
  brighter/fluffier for cloud, distinguishable at a glance," not specific
  RGB values.
- Extending `stepPowder`/`stepLiquid`'s straight-down check only (not their
  diagonal-below checks) to admit sinking through fog/cloud (§10) — a
  minimal reading of FR-004's literal "directly above" wording, not
  exercised by a dedicated diagonal-sink test beyond what FR-042's
  "directly above" coverage already requires.
