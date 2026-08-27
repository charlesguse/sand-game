# Phase 0 Research: Shining Star Power

This feature's spec carries no `[NEEDS CLARIFICATION]` marker — every
product-intent question (star power is an action not a material, grass is
the only fuel, glitter is the existing glitter grain, water always wins and
is never spent, no scene is seeded with it) is already resolved in
`spec.md`'s own Assumptions/Superseded-requirements sections. This document
resolves the remaining *implementation-technology* unknowns needed to fill
Technical Context and unblock Phase 1 design — how star power's simulation
state is represented, how ignition/burnout/quenching fit the existing
single-pass hot loop without new allocations, how the toolbar/brush/wand/
eraser/objects/scenes integrate it, and how its "twinkle" is rendered
without a new effects system.

This feature is a direct extension of `001-falling-pink-sand` through
`007-water-drinking-grass`, whose `src/sim/*` (read from the checked-out
code) already establishes: `Grid` holds `elements`/`shades`/`moved`/`hues`/
`glitter` plus `007`'s `grassHeight`/`grassCooldown`/`grassCount` as
parallel `Uint8Array`s (and one plain number) sized `width * height`;
`step.ts`'s single bottom-to-top, left-to-right pass dispatches each
unvisited (`!moved[i]`) cell to `stepPowder`, `stepLiquid`, or `007`'s
`stepGrass` by element type; `grid.ts`'s `setCell(grid, x, y, element,
shade)` is the one chokepoint every brush/scene/eraser/growth write already
funnels through, and already resets `glitter[i] = 0` and recomputes
`grassHeight`/`grassCooldown`/`grassCount` on every call; `brush.ts`/
`wand.ts` apply a circular footprint (`forEachFootprintCell`) per element/
tool, with the wand's `applyWandCell` already glittering *any* non-`EMPTY`,
non-`OBJECT` cell regardless of its element (research finding below);
`objects.ts` treats "touching" as "any non-`EMPTY`, non-`OBJECT` element,"
already element-agnostic; `scenes.ts` generates two deterministic
landscapes; `resize.ts` copies every per-cell array at a fixed offset;
`PlayArea.svelte` runs one `requestAnimationFrame` loop (`step` →
`applyRainbowConversions` → `updateUnicorns` → `tickParticles` →
`updateFlashMask` → `render`), with `render()` applying a shimmer/flash
brightness boost to any cell with `glitter[i] === 1`, independent of what
element occupies it, and picking a base RGB via a per-element `colorFor`
switch over hand-picked shade ramps.

## 1. Star power is a new element that never moves — solidity is free, exactly as grass established

- **Decision**: Add `STAR_POWER = 7` to `src/sim/types.ts`'s element
  constants and `Element` union. `stepPowder` and `stepLiquid` are **not
  modified**. `step()`'s dispatcher gains one more `else if (element ===
  STAR_POWER) stepStarPower(grid, x, y, i);` alongside its existing
  `isPowder`/`isLiquid`/`GRASS` branches — no dispatch changes to any
  existing branch.
- **Rationale**: `stepPowder` only ever falls into `EMPTY` (or swaps
  through a liquid); `stepLiquid` only ever flows into `EMPTY`. Since
  `STAR_POWER` is neither `EMPTY`, `isPowder`, nor `isLiquid`, both
  functions already treat a star-power-occupied cell exactly like a sand/
  grass-occupied one — solid, blocking, nothing to special-case — with zero
  code change. This is FR-004 (never moves) and FR-005 (powders rest on it,
  water flows around it) satisfied entirely as a side effect of the
  existing element-classification design, exactly the precedent
  `007-water-drinking-grass`'s research.md §1 set for grass.
- **Alternatives considered**: None of substance — this is the same,
  already-proven pattern as grass; inventing a separate "doesn't move"
  branch would duplicate behavior the dispatcher already provides by
  omission.

## 2. Per-cell state: three new parallel arrays, no separate stored object, one creation chokepoint

- **Decision**: `Grid` gains three new `Uint8Array` fields sized `width *
  height`, allocated by `createGrid`:
  - `starPowerAge[i]`: simulation steps elapsed since this cell became
    star power, meaningful only where `elements[i] === STAR_POWER`.
    Increments by 1 each step this cell is processed and neither quenched
    nor burned out.
  - `starPowerLife[i]`: this cell's total burn life in steps (30–60,
    FR-007), fixed at creation and never modified afterward.
  - `starPowerFuelled[i]`: `1` if this cell was ignited from a `GRASS`
    cell (burns out into one glitter grain), `0` if it was drawn by the
    brush into an empty cell (burns out into nothing) — FR-008/FR-010's
    fuel-state distinction.

  No `starPowerCount` is added — unlike grass's field-share ceiling
  (FR-012 of spec 007), star power has no field-wide cap to enforce
  (its own transience, FR-002, is what bounds the worst case), so there is
  nothing a running total would gate.

  A single new exported function in `grid.ts`, `igniteStarPower(grid, x,
  y, fuelled)`, is the **only** way a star power cell is ever created:
  it calls `setCell(grid, x, y, STAR_POWER, randomShade())`, then sets
  `starPowerFuelled[i] = fuelled ? 1 : 0`, `starPowerLife[i] =
  randomBurnLife()` (§4), and relies on `setCell`'s own extension (§3) to
  have already zeroed `starPowerAge[i]`.
- **Rationale**: Fuel state and burn life are not structurally derivable
  from neighboring cells the way `grassHeight` is (data-model precedent) —
  they are *decided* at the moment of creation by whichever caller is
  igniting the cell (the brush, drawing unfuelled star power or converting
  grass; the burn front, igniting a grass neighbor). Funnelling both
  call sites through one `grid.ts` function is exactly the same
  call-site-drift defense `007`'s research.md §3 gives for
  `grassHeight`/`grassCount`: a future call site that wrote `STAR_POWER`
  via bare `setCell` and forgot to set `starPowerFuelled`/`starPowerLife`
  would create a cell that never burns out correctly, so there is exactly
  one function that can create a valid one.
- **Alternatives considered**: Packing fuel state into the element type
  itself (e.g., a second `FUELLED_STAR_POWER` element) — rejected: it
  would double every dispatch/render/eraser/wand branch's element check for
  no benefit over a one-bit flag, and the spec's own Key Entities section
  frames fuel state as "transient simulation state," not a distinct
  element. Extending `setCell`'s signature with optional fuelled/life
  parameters — rejected: `setCell` is called for every element on every
  brush stroke and scene cell; adding two parameters meaningful only for
  one element would force every other call site to pass `undefined`,
  where a dedicated wrapper (matching `objects.ts`'s `placeObject`
  building atop raw grid writes) reads as a purpose-built API instead.

## 3. `setCell`/`clearGrid` reset star-power bookkeeping exactly as they already reset grass's

- **Decision**: `setCell(grid, x, y, element, shade)` is extended: after
  its existing writes, always set `starPowerAge[i] = 0`; additionally, if
  `element !== STAR_POWER`, also set `starPowerLife[i] = 0` and
  `starPowerFuelled[i] = 0`. `clearGrid` additionally fills
  `starPowerAge`/`starPowerLife`/`starPowerFuelled` to `0`.
- **Rationale**: This mirrors `007`'s own `grassCooldown[i] = 0`-on-every-
  write / `grassHeight[i] = 0`-when-not-grass pattern exactly. Any cell
  whose element changes to something other than star power (erased,
  quenched, burned out, overwritten by a scene load) must not leave stale
  age/life/fuel bits behind for a future, unrelated write at that index to
  accidentally inherit. A write that *becomes* `STAR_POWER` only ever
  happens inside `igniteStarPower` (§2), which sets `starPowerLife`/
  `starPowerFuelled` itself in the same synchronous call immediately after
  `setCell` returns — so the brief in-between state is never observed.
- **Alternatives considered**: None of substance — this is the direct,
  minimal extension of an already-established chokepoint pattern.

## 4. Burn life: one exported random helper, alongside `randomShade`

- **Decision**: `src/sim/shade.ts` gains `randomBurnLife(): number`,
  returning a uniformly random integer in `[30, 60]` inclusive (FR-007):
  `30 + Math.floor(Math.random() * 31)`.
- **Rationale**: `shade.ts` is already the project's home for small,
  pure randomness helpers used by `grid.ts`/`brush.ts`; keeping burn-life
  randomization there (rather than a private constant buried in
  `step.ts`) makes it independently unit-testable (FR-038's "burn life
  bounds and the ragged variation within them") without exporting
  internals of `grid.ts` or `step.ts`.
- **Alternatives considered**: A fixed burn life (e.g., always 45 steps)
  — rejected outright by FR-007's explicit "varying from cell to cell so a
  burning patch flickers out raggedly rather than all at once."

## 5. `stepStarPower`: quench first, then age/burnout, then ignite — one branch, reusing `moved` exactly as grass does

- **Decision**: A new private function in `step.ts`, `stepStarPower(grid,
  x, y, i)`:
  1. **Quench check** (FR-016): scan the four orthogonal neighbors with a
     plain `if`/`else if` chain (no array literal, matching `stepGrass`'s
     own water-neighbor scan) for `WATER`. If found, call
     `extinguishStarPower(grid, x, y, i)` (§6) and return — quenching is
     unconditional on age, so a cell can be put out on the very step water
     arrives beside it.
  2. **Age and burnout** (FR-002, FR-007, FR-008): otherwise, let `age =
     starPowerAge[i] + 1`. If `age >= starPowerLife[i]`, call
     `extinguishStarPower(grid, x, y, i)` and return — this is FR-002's
     transience and FR-007's burn-life bound in one comparison, applying
     identically whether or not the cell ever had a grass neighbor.
     Otherwise, store `starPowerAge[i] = age`.
  3. **Ignite** (FR-011): if `age < STAR_POWER_IGNITE_DELAY` (10, taken
     directly from FR-011's literal "at least 10 simulation steps" — not a
     tunable choice), return. Otherwise, scan all eight neighbors (a small
     `for`-nested loop over `dy`/`dx` in `-1..1` skipping the center —
     allocation-free: only primitive bounds arithmetic, no array/object
     literal, matching Principle IV/FR-034) and, for every neighbor
     currently holding `GRASS`, call `igniteStarPower(grid, nx, ny, true)`
     and set `grid.moved[ni] = 1`.
- **Rationale**: Checking quench before burnout, and burnout before
  ignition, is the direct reading of the spec's own priority ("water
  always wins," FR-017's water is never spent, and a cell that has just
  aged out has nothing left to ignite with) — a cell cannot both go out
  and ignite a neighbor in the same step. Reusing `moved` for
  newly-ignited neighbors is exactly `007`'s research.md §5 precedent: the
  bottom-to-top scan can revisit a neighbor at `y - 1` (above the current
  cell) later in the very same pass, and without the flag that neighbor
  would immediately re-enter `stepStarPower` this frame, letting one
  frame's ignition silently cascade an extra step ahead of the intended
  pace; setting `moved` on cells below/beside (already visited this pass)
  is harmless, since the dispatcher will not revisit them anyway. A second
  ignited neighbor arriving at an already-just-ignited cell in the same
  scan is naturally prevented without any extra check: the first
  `igniteStarPower` call mutates `elements[ni]` away from `GRASS`
  in place, so a later neighbor's own 8-cell scan (if it happens to also
  border that cell) simply no longer sees `GRASS` there — the identical
  single-pass-mutation property `007`'s research.md §5 relies on for
  water-double-absorption.
- **Alternatives considered**: Igniting on the exact step `age === 10`
  only, rather than every step `age >= 10` — rejected: a grass neighbor
  that only *becomes* adjacent after step 10 (e.g., grass grew there under
  spec 007's own rule in the interim) would then never catch, violating
  FR-013's "the neighbouring grass catches within half a second" (measured
  from contact, not from the star power cell's own creation) and FR-036's
  requirement that spec 007's growth keep working unchanged alongside a
  burn. A separate "ignited" flag set once and never re-checked — rejected
  for the same reason: it cannot re-fire for grass that arrives late.

## 6. Burnout reuses the existing glitter grain unchanged — one small helper, one shared `randomHue`

- **Decision**: A private helper in `step.ts`, `extinguishStarPower(grid,
  x, y, i)`: if `starPowerFuelled[i]`, call `setCell(grid, x, y,
  RAINBOW_SAND, randomShade())`, then `grid.hues[i] = randomHue()`, then
  `setGlitter(grid, x, y, 1)` — producing exactly the toy's existing
  glitter grain (FR-009, FR-010). Otherwise, call `setCell(grid, x, y,
  EMPTY, 0)` (FR-008's unfuelled case).

  `randomHue()` (currently a private, non-exported function inside
  `objects.ts`, used only by `applyRainbowConversions`) moves to
  `shade.ts` as an exported function, alongside `randomShade`/
  `randomBurnLife`; `objects.ts` imports it instead of defining its own
  copy.
- **Rationale**: This is the direct implementation of FR-009/FR-010 ("one
  blade in, one speck of glitter out... the existing glitter grain")
  using the exact element+glitter-bit combination the wand's own sprinkle
  path (`wand.ts`'s `applyWandCell`) already produces for a freshly-
  sprinkled glitter grain — no new physics, no new element, satisfying
  the spec's explicit "this feature adds exactly one new element type and
  no new physics for glitter" (FR-009). Lifting `randomHue` to `shade.ts`
  is a small, in-place dedup: two call sites (`objects.ts`'s rainbow
  conversion, `step.ts`'s burn-glitter creation) need an unbiased random
  hue in `[0, 256)`, and `shade.ts` is already this project's home for
  exactly this class of tiny randomness helper (§4).
- **Alternatives considered**: A fixed or positionally-derived hue for
  burn-made glitter (like `scenes.ts`'s deterministic `positionalShade`)
  — rejected: burning is not a deterministic scene-generation event, and
  SC-005/visual-checks ask for glitter that reads as "multicoloured,"
  which a shared random hue (matching every other runtime glitter source)
  gives for free. Duplicating a second private `randomHue` inside
  `step.ts` instead of sharing `objects.ts`'s — rejected as needless
  duplication once both call sites need the identical distribution.

## 7. Twinkle reuses the existing glitter/shimmer/flash-cap pipeline — no new render mechanism

- **Decision**: `igniteStarPower` (§2) also calls `setGlitter(grid, x, y,
  1)` immediately after creating the cell. No other change to
  `render()`, `updateFlashMask`, or `FLASH_CAP` is needed. `PlayArea.
  svelte`'s `colorFor` gains one new branch: `if (element === STAR_POWER)
  return GOLD_RAMP[shade % GOLD_RAMP.length];`, using a new hand-picked
  `GOLD_RAMP` (pale-yellow to warm gold, mirroring `PINK_RAMP`/
  `GREEN_RAMP`'s existing 8-entry shape).
- **Rationale**: `wand.ts`'s `applyWandCell` already establishes that
  `grid.glitter` is a generic "this cell shimmers" flag, not an
  exclusively-glitter-grain flag: it sets `glitter[i] = 1` on *any*
  non-`EMPTY`, non-`OBJECT` element the wand dabs (sand, water, dirt,
  grass, rainbow sand alike), and `render()`'s existing per-cell loop
  already applies its brightness-oscillation shimmer plus the
  reservoir-sampled flash-cap boost to every cell with `glitter[i] === 1`
  regardless of element. Setting the same flag at star power's own
  creation time reuses that exact, already-tested pipeline for FR-003's
  "twinkle," satisfies FR-034's "twinkle must allocate nothing per frame
  and must not raise the sparkle flash caps" *by construction* (it is the
  same `FLASH_CAP = 24` reservoir, not a new one), and needs zero new
  render code beyond the one `colorFor` color-lookup branch every prior
  element already required. The flag is cleared automatically the moment
  the cell stops being star power, because `setCell` already zeroes
  `glitter[i]` on every write (unconditionally, for every element) — so
  quenching, burning out, erasing, or being overwritten by a scene load
  all correctly stop the twinkle with no extra code.
- **Alternatives considered**: A wholly separate rendering-only shimmer
  computed unconditionally for `element === STAR_POWER` in `render()`,
  independent of the `glitter` flag/flash-cap system — rejected as a
  second, parallel shimmer mechanism duplicating math `render()` already
  has, for a visual result indistinguishable from reusing the existing
  one, and it would not automatically get the occasional brighter
  flash-cap boost that makes existing glitter (and now star power) read as
  "twinkling" rather than merely "gently pulsing." A brand new
  `starPowerFlashMask`/second cap — rejected outright by FR-034's explicit
  "must not raise... above the fixed caps spec 005 already sets."

## 8. Brush: one new tool branch; water/other-element skip is automatic

- **Decision**: `types.ts`'s `Tool` union gains `'star'`. `brush.ts`'s
  `paintCell` gains two branches: `tool === 'star' && current === EMPTY`
  → `igniteStarPower(grid, x, y, false)` (FR-022's empty-cell deposit);
  `tool === 'star' && current === GRASS` → `igniteStarPower(grid, x, y,
  true)` (FR-022's grass-conversion). No branch is added for `WATER`,
  `SAND`, `DIRT`, `RAINBOW_SAND`, `OBJECT`, or an already-`STAR_POWER`
  cell — `paintCell`'s existing `if`/`else if` chain simply does nothing
  for those, since none of them equal `EMPTY` or `GRASS`.
- **Rationale**: This is the same "deposit into an allowed current state"
  pattern `sand`/`dirt`/`grass` already use, just with two allowed source
  states (`EMPTY`, `GRASS`) instead of one or two homogeneous ones, and
  each mapped to a different `fuelled` argument. FR-018's "MUST NOT place
  star power into a cell holding water" and FR-005's "no other element may
  move into [a star power cell], displace it, or pass through it" (which
  forbids the brush from *re*-igniting an already-burning cell and
  resetting its age/life) both fall out for free from the `if`/`else if`
  chain simply never matching those `current` values — no explicit
  exclusion code is needed, mirroring how the existing brush already
  excludes `SAND`/`DIRT`/`RAINBOW_SAND`/`OBJECT` from every other tool's
  branch.
- **Alternatives considered**: A single combined condition
  (`current === EMPTY || current === GRASS`) computing `fuelled` inline —
  rejected only for readability; behaviorally identical to two explicit
  branches.

## 9. The wand needs a real code change — the one place star power is *not* zero-diff

- **Decision**: `wand.ts`'s `applyWandCell` gains one more early return:
  `if (element === OBJECT || element === STAR_POWER) return;` — inserted
  before the existing `if (element !== EMPTY) setGlitter(...)` line.
- **Rationale**: This is the one place in the whole feature where the
  "everything else needs zero code" pattern (grass's own precedent, and
  every other consumer in this document) does **not** hold, and is worth
  flagging explicitly. `applyWandCell`'s existing rule glitters *any*
  non-`EMPTY`, non-`OBJECT` cell — before this feature, `GRASS` was
  swept up by that generic rule and correctly glittered by the wand
  (§7's own observation). Left unchanged, the same rule would also
  glitter a star power cell, which FR-027 explicitly forbids ("the
  sparkle wand MUST leave star power cells exactly as they are — neither
  glittered nor emptied nor retyped"). Excluding `STAR_POWER` the same way
  `OBJECT` is already excluded is the minimal fix; it does not touch the
  sprinkle branch (`else if (isSprinkleSite...)`), which only ever
  triggers on already-`EMPTY` cells and was never reachable for a
  star-power-occupied cell regardless.
- **Alternatives considered**: Special-casing `STAR_POWER` only where it
  is glittered via `igniteStarPower` (§7) rather than in the wand —
  rejected: the wand's own touch would still call `setGlitter(grid, x, y,
  1)` redundantly (harmless on its own, since the flag is already 1), but
  more importantly it would leave the wand able to *retype* nothing here
  only by accident, not by rule, and would not satisfy FR-027's explicit
  "MUST NOT sprinkle into them" wording as directly as an explicit skip
  does. Since a star power cell is never `EMPTY`, the sprinkle branch was
  already unreachable for it — the skip is needed only to block the
  glitter-touch branch.

## 10. Eraser, objects, and scenes: zero code change, verified by inspection

- **Decision**: No change to `brush.ts`'s `eraser` branch, to any function
  in `objects.ts`, or to `scenes.ts`.
- **Rationale**:
  - **Eraser** (FR-024): `setCell(grid, x, y, EMPTY, 0)` already zeroes
    `starPowerAge`/`starPowerLife`/`starPowerFuelled`/`glitter` for any
    cell it touches (§3, and the pre-existing `glitter[i] = 0` write) —
    "leaving those cells empty and producing no glitter" holds with no
    new code, exactly like grass's own eraser story.
  - **Rainbow conversion** (FR-028): `applyRainbowConversions` only
    converts `SAND`/`DIRT`/`WATER` cells; `STAR_POWER` is not in that set,
    so a star power cell inside a rainbow's zone is left alone
    automatically.
  - **Unicorn touch** (FR-028): `isUnicornTouched`'s rule ("any element
    that is not `EMPTY`/`OBJECT` counts as touching") already treats star
    power as "touching" with zero change — the ordinary celebration burst
    fires exactly as it does for any other element, and no new burst type
    is introduced because none is added anywhere.
  - **Scenes** (FR-030): neither `generateLandscape1` nor
    `generateLandscape2` ever calls `igniteStarPower` or writes
    `STAR_POWER`, so no scene can seed it; `loadScene`'s existing
    `clearGrid` call (§3) already wipes any star power from a
    previously-live field before generating the new scene's contents.
- **Alternatives considered**: None of substance — each of these is
  confirmed, minimal-diff reuse of existing generic mechanisms, exactly
  the story `007`'s research.md §6/§9 already told for grass's own
  interaction with these same three modules.

## 11. Resize: straight per-field copy, exactly like grass's height/cooldown

- **Decision**: `resizeGrid`'s existing copy loop (`resize.ts`) also
  copies `starPowerAge[srcIndex]` → `starPowerAge[destIndex]`,
  `starPowerLife[srcIndex]` → `starPowerLife[destIndex]`, and
  `starPowerFuelled[srcIndex]` → `starPowerFuelled[destIndex]` for every
  carried cell — no re-randomization, no reset.
- **Rationale**: FR-029 requires the carried cell to "remain star power,"
  "keep whether it is fuelled," and "still burn out normally afterwards,"
  but explicitly says "a cell's remaining burn life need not survive."
  Copying all three fields together (rather than resetting age/life and
  only carrying the fuel flag) is *simpler* than manufacturing a fresh
  random life mid-resize, and satisfies every FR-029 clause: "need not
  survive" permits, but does not require, discarding it, and a carried
  `(age, life)` pair copied together stays internally consistent
  (`age < life` still holds if it held before), so the cell keeps
  counting up and burns out/ignites/quenches exactly as it would have had
  the resize never happened — no new logic beyond the same field-by-field
  copy pattern `007`'s `grassHeight`/`grassCooldown` already established.
  No `starPowerCount` exists (§2), so — unlike grass's `resizeGrid`
  extension — there is nothing to accumulate during the copy pass.
- **Alternatives considered**: Resetting `starPowerAge = 0` and drawing a
  fresh `randomBurnLife()` for every carried star power cell at resize
  time — rejected as needless extra logic for a case the spec explicitly
  says is optional to preserve; the straight copy is both simpler and a
  strict superset of what FR-029 requires.

## 12. `isSolid` gains `STAR_POWER` — an internal-consistency choice, not a spec-mandated one

- **Decision**: `element.ts`'s `isSolid(e)` becomes `isPowder(e) || e ===
  GRASS || e === STAR_POWER`.
- **Rationale**: `isSolid` is used only by `007`'s own
  `pickGrowthTargetIndex`/`isSupported` (grass's sideways-growth support
  check: a horizontal growth target is only eligible if the cell directly
  beneath it is solid ground or the floor). A star power cell is static
  and occupies its cell for its whole burn life (§1) — exactly the same
  "does not move, blocks/supports things resting on it" property
  `isSolid` already exists to name for powders and grass. Treating it as
  support for sideways grass growth keeps FR-036's "grass drinks and
  grows exactly as spec 007 requires... while a burn is happening
  elsewhere on the field" true even in the narrow case where a grass
  cell's sideways growth target happens to sit directly above a
  currently-burning star power cell, rather than leaving that one
  interaction undefined by omission.
- **Alternatives considered**: Leaving `isSolid` unchanged — considered,
  since the spec never names this exact interaction and it is not in
  FR-038's required-coverage list; not adopted because a target resting
  above a "ground-like, non-empty, non-moving" cell that is *not* treated
  as support would be a small, silent inconsistency with every other
  static/solid element already in `isSolid`, for no offsetting benefit.
  This is called out below as a decision made without further
  clarification, not exercised by a dedicated test beyond what `grass.
  test.ts`'s existing sideways-growth coverage already exercises
  structurally.

## 13. Toolbar: one new button in the existing elements group

- **Decision**: `Toolbar.svelte`'s `.group.elements` gains a fifth button
  (⭐, `aria-label="Star power"`, `tool === 'star'`) after the existing
  sand/water/dirt/grass four, identical markup pattern (FR-020, FR-021).
  `tests/unit/lib/layout.test.ts`'s `TOOLBAR_CONTROL_COUNT` moves from
  `15` to `16` (`TOOLBAR_GROUP_COUNT` stays `5` — star power joins an
  existing group).
- **Rationale**: Direct continuation of `007`'s research.md §7 — grass
  joined the sand/water/dirt group the same way dirt joined sand/water in
  spec 002; star power joins the same group again, per the spec's own
  "grouped with the other element brushes" (FR-020). `computeToolbarLayout`
  (`layout.ts`, unchanged) already models an arbitrary control count via
  its wrap/rail arithmetic — 16 instead of 15 is exercised by the same
  existing test shape, not a new code path (FR-026).
- **Alternatives considered**: A new toolbar group for the single ⭐
  button — rejected; the spec explicitly asks for it grouped with the
  other element brushes, not a "tools" group of its own.

## 14. Test organization: a new `starPower.test.ts`, mirroring `grass.test.ts`'s precedent

- **Decision**: The bulk of FR-038's star-power-specific coverage (never
  moves; powders rest on it/water flows around it; burn-life bounds and
  ragged variation; unfuelled-leaves-nothing/fuelled-leaves-one-glitter;
  the glitter produced being the existing glitter grain; eight-neighbor
  ignition after the delay; burn-front pace; no grass changes with no
  star power; the burn refusing to cross non-grass cells; every burn
  terminating; quench-by-water within one step with water unchanged;
  grass beside a firebreak still drinking; grass drinking elsewhere on
  the field while a burn is in progress) lives in a new
  `tests/unit/sim/starPower.test.ts`, even though the implementation
  itself lives inside `step.ts`/`grid.ts` rather than a dedicated
  `starPower.ts` module — exactly `007`'s own precedent for
  `grass.test.ts` versus `stepGrass` living in `step.ts`. Small, targeted
  additions go into the existing files whose own concern each touches:
  `grid.test.ts` (`igniteStarPower`'s bookkeeping, `setCell`'s reset
  rule, `clearGrid`'s new fills), `brush.test.ts` (the `star` tool's
  deposit/ignite/skip rules), `wand.test.ts` (the new skip branch —
  FR-027), `resize.test.ts` (star power and its fuel state surviving a
  re-derivation), `scenes.test.ts` (zero star power in any loaded scene),
  and `tests/unit/lib/layout.test.ts` (`TOOLBAR_CONTROL_COUNT` 15 → 16).
  `objects.test.ts`, `step.test.ts`, and `element.test.ts` (which does
  not exist, per `007`'s own precedent) need no dedicated new cases
  beyond what `starPower.test.ts` already exercises through `step`'s
  public behavior.
- **Rationale**: Same reasoning `007`'s research.md §10 already gave:
  `step.ts` staying implementation-unified doesn't require its tests to
  stay file-unified, and FR-038's star-power rule list is large enough to
  warrant a dedicated home without cluttering `step.test.ts`'s existing
  powder/water tests or `grass.test.ts`'s existing grass-only ones.
- **Alternatives considered**: Adding star power's coverage directly into
  `grass.test.ts` (since the two features are fuel-and-fire coupled) —
  rejected: `grass.test.ts` is grass's own dedicated home per `007`'s
  precedent, and mixing two features' large rule sets into one file would
  make both harder to navigate; the one genuinely cross-feature scenario
  (grass drinking beside a firebreak, grass drinking elsewhere while a
  burn runs) is still exercised end-to-end via `createGrid`/`setCell`/
  `step` in `starPower.test.ts`, which is free to construct grass cells
  directly without needing anything from `grass.test.ts` itself.

## 15. No new runtime dependency

- **Decision**: This feature needs no new package, browser API, or build
  step — every new capability (one new element constant, three new
  `Uint8Array`s, one new tool string, one new toolbar button, one new
  shade ramp, two new small exported helpers in `shade.ts`, one new
  `grid.ts` function, one new `step.ts` dispatch branch, one new `wand.ts`
  early return) is built from mechanisms 001–007 already established.
- **Rationale**: Constitution Principle III and the project's unbroken
  precedent (every prior feature shipped with zero new dependencies).
- **Alternatives considered**: None — no candidate dependency was ever in
  scope for a feature this close to the existing engine's own primitives.

All Technical Context unknowns are resolved; nothing carries forward to
Phase 1 as unresolved.

## Decisions made without clarification

No spec-level `[NEEDS CLARIFICATION]` marker existed to resolve (every
product-intent question was already answered in `spec.md`'s own
Assumptions/Superseded-requirements sections before this planning stage
began). The following implementation-technology choices were made without
further clarification because the spec leaves them as implementation
detail, not product intent:

- The exact per-cell state representation (`starPowerAge`/`starPowerLife`/
  `starPowerFuelled` as three `Uint8Array`s on `Grid`, plus the
  `igniteStarPower` creation chokepoint, §2) and the decision not to add a
  running `starPowerCount` (§2, since nothing in the spec gates star
  power by a field-wide share the way grass's FR-012 does).
- Reusing the existing `glitter` flag/shimmer/flash-cap pipeline for
  star power's "twinkle" rather than building a second rendering
  mechanism (§7) — a direct, minimal-diff reading of FR-034's "must not
  raise the sparkle flash caps," but the specific mechanism (setting
  `glitter[i] = 1` at creation) is an implementation choice.
  the `GOLD_RAMP` color values themselves are a starting point for the
  maintainer's own visual-checks pass (constitution Principle V), not a
  pinned final palette.
- Ordering quench before burnout before ignition inside `stepStarPower`
  (§5), and igniting on every step `age >= 10` rather than only the exact
  step age crosses 10 (§5) — both direct readings of the spec's stated
  priorities and of FR-013/FR-036's requirement that late-arriving grass
  still catches, but the exact control-flow shape is implementation
  detail.
- Extending `isSolid` to include `STAR_POWER` for grass's own sideways-
  growth support check (§12) — an internal-consistency judgment call the
  spec does not name directly and FR-038 does not require a dedicated
  test for.
- Moving `randomHue()` from a private function inside `objects.ts` to a
  shared, exported function in `shade.ts` (§6) — a small in-place dedup
  enabled by, but not required by, this feature's own need for a random
  hue at burn-glitter creation time.
- Resize copying `starPowerAge`/`starPowerLife` verbatim rather than
  resetting them to a fresh random life (§11) — FR-029 permits either;
  the straight copy is simpler and a strict superset of what is required.
