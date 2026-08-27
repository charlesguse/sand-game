# Phase 0 Research: Water-Drinking Grass

This feature's own Clarifications session (recorded in `spec.md`'s
Assumptions section — grass is static/a new solid family, growth is paid
for in water, fully grown grass stops drinking, one scene is seeded and one
is not) already resolved every product-intent question raised while
drafting. No `[NEEDS CLARIFICATION]` marker remains in `spec.md`. This
document resolves the remaining *implementation-technology* unknowns needed
to fill Technical Context and unblock Phase 1 design — how grass's
simulation state is represented, how absorption and growth combine into the
existing single-pass hot loop without new allocations, how the toolbar/
brush/wand/eraser integrate it, and how the landscape-1 scene seeds it
within SC-022's "at least half the lake survives" bound.

This feature is a direct extension of `001-falling-pink-sand` through
`006-phone-support`. The current `src/sim/*` (read from the checked-out
code) is: `Grid` holds `elements`/`shades`/`moved`/`hues`/`glitter` as
parallel `Uint8Array`s sized `width * height`; `step.ts`'s single loop scans
bottom-to-top, left-to-right, dispatching each unvisited (`!moved[i]`) cell
to `stepPowder` or `stepLiquid` by element type, mutating the grid in
place via two chokepoint helpers (`moveCell`/`swapCells`) that already
embed one element-specific special case (`RAINBOW_SAND`'s hue bump);
`grid.ts`'s `setCell(grid, x, y, element, shade)` is the chokepoint every
brush/scene/eraser write already funnels through; `brush.ts`/`wand.ts`
apply a circular footprint (`forEachFootprintCell`) per element/tool;
`objects.ts` places/removes/erases rainbows and unicorns; `scenes.ts`
generates two deterministic landscapes from a shared `sceneRegions` helper
and a positional (non-random) shade hash; `PlayArea.svelte` runs one
`requestAnimationFrame` loop (`step` → `applyRainbowConversions` →
`updateUnicorns` → `tickParticles` → `updateFlashMask` → `render`) against
one live `Grid`, with `render()` iterating every cell once and calling a
`colorFor(element, shade, hue)` switch to pick an RGB triple from one of
three hand-picked shade ramps (pink/blue/purple) or an HSL sweep for
rainbow sand.

## 1. Grass is a new element that is neither a powder nor a liquid — solidity is free

- **Decision**: Add `GRASS = 6` to `src/sim/types.ts`'s element constants
  and `Element` union, alongside a new `isSolid(e)` helper in `element.ts`
  (`isPowder(e) || e === GRASS`, matching the spec's own "Solid means a
  cell holding any powder or grass" definition). `stepPowder` and
  `stepLiquid` in `step.ts` are **not modified**.
- **Rationale**: `stepPowder` already falls only into a cell holding
  `EMPTY` (or sinks through a `isLiquid` cell) and otherwise rests;
  `stepLiquid` already falls/flows only into `EMPTY` cells. Since `GRASS`
  will be neither `EMPTY`, `isPowder`, nor `isLiquid`, both functions
  already treat a grass-occupied cell exactly like a sand/dirt-occupied one
  — solid, blocking, nothing to special-case — with zero code change. This
  satisfies FR-005 (powders rest on grass, water flows around it) entirely
  as a side effect of the existing element-classification design, which is
  the cheapest and least risky way to add a new "ground" element to this
  engine. `isSolid` is needed separately for FR-010's sideways-growth
  support check (§4), which must recognize grass *and* powder as support,
  a superset `isPowder` alone doesn't cover.
- **Alternatives considered**: Giving grass its own `stepGrass`-only
  "resting" branch that duplicates the "don't move" behavior explicitly —
  rejected as redundant: `step()`'s dispatcher only calls a step function
  for `isPowder`/`isLiquid` elements (§5); a `GRASS` cell simply never
  matches either, so "does not move" requires no code at all beyond the
  absorption/growth branch itself.

## 2. Per-cell grass state: two new parallel arrays, no "pending capacity" flag

- **Decision**: `Grid` gains two new `Uint8Array` fields sized
  `width * height`, allocated by `createGrid` alongside the existing ones:
  - `grassHeight[i]`: this cell's height above its root (0-12+, saturating
    at 255), meaningful only where `elements[i] === GRASS`.
  - `grassCooldown[i]`: simulation steps remaining before this grass cell
    may attempt to absorb water again, meaningful only where
    `elements[i] === GRASS`.

  `Grid` also gains one new **plain mutable number field**, `grassCount`,
  the live count of grass cells on the grid — not a typed array, since it
  is a single running total, not per-cell.

  There is **no** separate "absorbed water / pending sprout" flag. FR-007's
  "gains the capacity to sprout exactly one new grass cell" is implemented
  as a single atomic operation: a grass cell absorbs an adjacent water cell
  in the *same* simulation step it spends that capacity, by growing into an
  already-confirmed-eligible target (§4). This is possible only because
  FR-008 already requires eligibility (an empty, in-bounds, under-ceiling
  target existing) as a *precondition* for absorption in the first place —
  so "can this cell grow" and "does this cell have a valid target right
  now" are the same question, and there is never a moment where a cell
  holds "spent" water with nowhere to put it.
- **Rationale**: A persistent pending-capacity flag would need its own
  bookkeeping (when is it cleared if the target later becomes ineligible?
  what if two targets are ambiguous?) for no behavioral gain — FR-014
  ("each absorbed water cell yields at most one new grass cell") and
  FR-007/FR-010 read naturally as one atomic absorb-then-sprout event, and
  collapsing them into one step-local operation removes an entire class of
  cross-step consistency bugs while still satisfying every FR/SC (verified
  per-requirement in §4-§5 below). `grassHeight` must be stored (not
  recomputed by walking downward every step) because growth eligibility
  needs it on every grass cell adjacent to water, every step, and a column
  can in principle be taller than the 12-cell ceiling if the child
  hand-plants a tall stack (FR-011 only bounds *growth*, not planting) —
  walking an unbounded column every step would violate FR-031's "cost must
  not depend on anything beyond the play field's cell count." Storing it
  and updating it in O(1) at each cell's creation (§3) keeps every grass
  operation O(1) per cell touched. `grassCooldown` must be stored per-cell
  (not derived) because FR-009's "no more than one water cell per 10
  simulation steps" is a per-cell pacing rule across time, which nothing
  else in the grid state encodes.
- **Alternatives considered**: A single `Uint16Array` packing both height
  and cooldown into one field (bit-shifted) — rejected as a premature
  micro-optimization that complicates every read site for a memory saving
  irrelevant at the 43,200-cell budget (two more `Uint8Array`s is at most
  ~86KB at the ceiling). Recomputing height by walking downward each step —
  rejected in the rationale above. A boolean "has absorbed, ready to grow"
  latch checked on a *later* step — rejected because it reintroduces the
  cross-step consistency problem the atomic design avoids, without adding
  any FR/SC compliance the atomic design lacks.

## 3. `grassHeight`/`grassCount` bookkeeping lives entirely inside `grid.ts`'s existing chokepoints

- **Decision**: `setCell(grid, x, y, element, shade)` (`grid.ts`) is
  extended to: (a) look at the cell directly below the written cell — if
  `element === GRASS` and that neighbor already holds `GRASS`, set
  `grassHeight[i] = min(255, grassHeight[belowIndex] + 1)`; otherwise (no
  grass below, off the bottom edge, or the new element isn't grass) set
  `grassHeight[i] = 0`; (b) always reset `grassCooldown[i] = 0` when the
  cell's element changes to or from grass by this call — a freshly-created
  grass cell (whether hand-planted or grown) has never absorbed anything
  yet; (c) increment `grassCount` when the cell becomes grass and wasn't,
  decrement when it stops being grass and was. `clearGrid` additionally
  resets `grassCount = 0` and fills `grassHeight`/`grassCooldown` to 0
  (alongside its existing `elements`/`glitter` fills).
- **Rationale**: `setCell` is already the one function every grass-creating
  or grass-destroying call site funnels through — the brush (`grass`/
  `eraser`/any overwriting tool), the eraser and clear-all, scene
  generation (`scenes.ts`), and the growth rule itself (§5, which creates
  new grass cells by calling `setCell`, not by poking the arrays directly)
  — so this is the single place that keeps `grassHeight`/`grassCount`
  correct without duplicating the bookkeeping at every call site. It also
  means the "look at the cell below" rule for computing height is applied
  *uniformly* to every grass cell regardless of why it was created,
  which is exactly the general definition the spec gives root/height (a
  purely structural property of "what's in the cell below, right now") —
  a brush-planted floating blade (Edge Cases: "grass drawn in mid-air") and
  a grown blade both get height 0 or height-below+1 by the identical rule,
  with no special-casing needed for FR-004's mid-air case. This mirrors the
  project's existing precedent of embedding one element's special-case
  logic in a shared low-level function (`moveCell`/`swapCells`'s
  `RAINBOW_SAND` hue bump in `step.ts`).
- **Alternatives considered**: Computing `grassHeight` in the brush/scene/
  growth call sites individually instead of inside `setCell` — rejected as
  duplicated logic with a real risk of the three sites drifting apart
  (e.g., a future feature adding a fourth grass-creating call site and
  forgetting the height computation). Keeping `grassCount` as a
  module-level counter in `step.ts` instead of on `Grid` — rejected: a
  module-level variable would not survive `resizeGrid`'s fresh-`Grid`
  swap (`PlayArea.svelte` reassigns `grid` wholesale on re-derivation,
  spec 006), and would be wrong the moment two `Grid`s exist even
  momentarily (as they briefly do inside `resizeGrid` itself); a field on
  `Grid` is scoped correctly by construction.

## 4. Growth targeting: one allocation-free function encodes FR-008/010/011/012/013 together

- **Decision**: A private helper in `step.ts`, `pickGrowthTargetIndex(grid,
  x, y): number` (returns a flat array index, or `-1`), implements FR-010's
  preference order using only primitive index arithmetic (no `{x, y}`
  object literals, no arrays) so it stays allocation-free in the animation-
  frame hot loop (constitution Principle IV, FR-031):
  1. Directly above (`x, y-1`) — return if eligible.
  2. Diagonally above-left and above-right (`x-1, y-1` / `x+1, y-1`) — if
     both eligible, `Math.random() < 0.5` picks one; else return whichever
     one is eligible, if any.
  3. Left and right (`x-1, y` / `x+1, y`) — eligible only when the cell
     *directly beneath the target* is solid (`isSolid`, §1) or off the
     bottom edge (the floor itself counts as support, matching how
     `stepPowder`/`stepLiquid` already treat the floor as blocking).
  4. No eligible target anywhere in the order → `-1`.

  A target `(tx, ty)` is "eligible" (a second helper, `isEligibleTarget`)
  iff: in bounds; `elements[ty*width+tx] === EMPTY`; `grassCount` is still
  under the field-share ceiling (`floor(width * height * 0.25)`, FR-012);
  and the height that cell *would* have if grown there — computed by the
  same "look at the cell directly below" rule as §3, not by referencing the
  *absorbing* cell's own height — is `<= 12` (FR-011). Using the *target's*
  own would-be height (rather than the absorbing cell's height) is what
  makes the ceiling correct for every growth direction uniformly, including
  sideways growth onto the top of an unrelated, already-tall column: that
  column's own height is what must stay `<= 12`, regardless of which
  neighboring cell happened to trigger the growth.
- **Rationale**: This single function *is* FR-008's "cannot grow" test — a
  cell that finds no eligible target here is exactly a cell that "cannot
  grow" and therefore (§5) must not absorb, with no separate check needed.
  Deciding eligibility by the target's own resultant state (would-be height,
  current field share) rather than by properties of the source cell is what
  makes the height ceiling (SC-006: "no blade of grass has grown more than
  12 cells above its root," asserted over the *whole field*, not per
  absorbing cell) hold globally regardless of growth path. Bounds/emptiness/
  ceiling checks are ordered cheapest-first (bounds, then array read, then
  the counter compare, then the one recursive "look below" call) to keep
  the common "no growth possible" case fast.
- **Alternatives considered**: Gating eligibility on the *absorbing* cell's
  own `grassHeight` instead of the target's own would-be height — rejected:
  it under-counts height for sideways growth onto a pre-existing taller
  column (could let a column exceed 12 if approached sideways from a
  shorter neighbor), which SC-006 forbids unconditionally. A fixed
  (non-random) tie-break between the two diagonal targets — rejected: the
  spec explicitly calls for "chosen at random when both are eligible"
  (FR-010), and a fixed tie-break would make every blade lean the same way,
  reading as mechanical rather than "alive" (spec's visual-checks section).

## 5. Absorption + growth is one branch inside `step()`'s existing single pass; the `moved` flag prevents same-step cascades

- **Decision**: `step()`'s per-cell dispatch gains one more `else if`:
  `element === GRASS` calls a new private `stepGrass(grid, x, y, i)`. Its
  body: if `grassCooldown[i] > 0`, decrement it and return (no absorption
  attempt this step — this is FR-009's pacing, §2). Otherwise, scan the
  four orthogonal neighbors (up/down/left/right, plain `if`/`else if`
  chain, no array literal) for the first one holding `WATER`; if none,
  return (nothing to drink). Otherwise call `pickGrowthTargetIndex` (§4);
  if `-1`, return *without* touching the water cell (FR-008 — no target
  means no absorption). Otherwise: `setCell` the water cell's index to
  `EMPTY` (spending it), `setCell` the target index to `GRASS` with a fresh
  `randomShade()` (creating the sprout, which also updates `grassHeight`/
  `grassCount` per §3), set `grid.moved[targetIndex] = 1`, and set
  `grid.grassCooldown[i] = 10`.

  Setting `moved[targetIndex] = 1` reuses the *existing* per-step scratch
  array (already `fill(0)`'d at the top of every `step()` call, already
  the mechanism `stepPowder`/`stepLiquid` use to avoid double-processing a
  cell that already moved this pass) to prevent the newly-created cell from
  *also* attempting to grow within the same pass it was created — without
  this, a growth target created above the current scan row (not yet
  visited this bottom-to-top pass) or beside it could immediately chain
  into its own growth attempt in the same frame, letting one frame's worth
  of plentiful water cascade a whole column past the intended pace.
- **Rationale**: This keeps grass entirely inside the one existing
  per-frame grid pass (no second full-grid scan, preserving FR-031's "cost
  must not depend on anything beyond cell count" and the allocation-free
  hot loop) and reuses `moved` instead of adding a third bookkeeping array,
  since its "already resolved this step" meaning is already exactly what's
  needed. Scanning water neighbors with a plain `if`/`else if` chain
  (rather than building a small array of neighbor indices to loop over)
  avoids a per-cell allocation that would otherwise occur every step for
  every grass cell — the single largest steady-state cost in a "field full
  of grass" worst case (FR-030's explicit stress scenario). Two different
  grass cells that are both adjacent to the *same* single water cell in the
  same step cannot double-absorb it: whichever is visited first in the
  scan order sets that water cell to `EMPTY` immediately (in-place
  mutation), so the second one's neighbor scan simply no longer finds
  `WATER` there — the same single-pass-mutation property that already
  prevents `stepPowder`/`stepLiquid` from double-moving a cell.
- **Alternatives considered**: A second, separate full-grid pass just for
  grass (scan once for movement, once for grass) — rejected: doubles the
  per-frame grid traversal for no behavioral need, when a single dispatch
  branch inside the existing pass already suffices. Marking newly-grown
  cells with a *new* dedicated "grown this step" array instead of reusing
  `moved` — rejected as an unnecessary fourth per-cell array when `moved`'s
  existing semantics already fit exactly.

## 6. Brush, eraser, and wand: one new tool branch; eraser and wand need no change at all

- **Decision**: `brush.ts`'s `paintCell` gains one branch: `tool === 'grass'
  && (current === EMPTY || current === WATER)` → `setCell(grid, x, y,
  GRASS, shade)` — the same "deposit into empty or water, never onto
  another occupant" pattern `sand`/`dirt` already use (FR-020). `types.ts`'s
  `Tool` union gains `'grass'`. **No change** is needed to the `eraser`
  branch (`setCell(grid, x, y, EMPTY, 0)` already removes any occupant,
  grass included — FR-022) or to `wand.ts`'s `applyWandCell` (its existing
  rule — glitter any non-`EMPTY`, non-`OBJECT` cell — already covers
  `GRASS` with zero code change, FR-025).
- **Rationale**: This is the direct, minimal-diff consequence of grass
  being "just another element" to every generic, element-agnostic function
  in the codebase (eraser, wand, clear-all, `render`'s per-cell loop) — the
  only genuinely new code is where the codebase is *already*
  element-specific by design (the brush's per-tool `if`/`else if` chain,
  and `colorFor`'s per-element color switch, §8).
- **Alternatives considered**: None of substance — this is confirmed,
  minimal-diff reuse of existing generic mechanisms, not a design choice
  with real alternatives.

## 7. Toolbar: one new button in the existing elements group; the toolbar-fit test's control-count constant must move with it

- **Decision**: `Toolbar.svelte`'s `.group.elements` gains a fourth button
  (🌱, `aria-label="Grass"`, `tool === 'grass'`) after the existing sand/
  water/dirt three, using the identical markup pattern (FR-018, FR-019).
  `tests/unit/lib/layout.test.ts`'s `TOOLBAR_CONTROL_COUNT` constant moves
  from `14` to `15` (`TOOLBAR_GROUP_COUNT` stays `5` — grass joins an
  existing group, it doesn't create one).
- **Rationale**: Working `computeToolbarLayout`'s existing arithmetic
  (unchanged by this feature) for the representative phone-landscape-rail
  case at 15 controls instead of 14 still returns `fits: true` — the
  function wraps into an additional line rather than shrinking below
  `MIN_TOUCH_TARGET`, it just consumes a little more of the cross axis
  (`thickness`), which is exactly the behavior `computeToolbarLayout` was
  built to model (spec 006's own design). This confirms FR-024 ("adding the
  grass control MUST NOT push the toolbar out of spec 006's constraints")
  holds with no change to `layout.ts` itself — only the test's own
  hand-mirrored control count needs to move, per spec 006's own
  documented caveat that this constant is a hand-kept mirror of
  `Toolbar.svelte`'s real button count (not derived from the component, per
  constitution Principle V — no DOM in the test suite).
- **Alternatives considered**: A new toolbar group for grass — rejected;
  the spec explicitly asks for it "grouped with the other element brushes"
  (FR-018), matching how dirt joined the sand/water group in spec 002
  rather than getting its own.

## 8. Rendering: a fourth shade ramp, reusing the existing per-cell color pipeline unchanged

- **Decision**: `PlayArea.svelte` gains a `GREEN_RAMP` array (8
  hand-picked green triples, pale to deep, mirroring `PINK_RAMP`/
  `BLUE_RAMP`/`PURPLE_RAMP`'s existing shape) and one new line in
  `colorFor`: `if (element === GRASS) return GREEN_RAMP[shade %
  GREEN_RAMP.length];`. `render()`'s per-cell loop, glitter-shimmer
  handling, and every other rendering code path are **unchanged** — they
  already operate generically on `elements[i]`/`shades[i]`/`hues[i]`/
  `glitter[i]` for whatever element is present.
- **Rationale**: This is the same "one more entry in an element-keyed
  lookup" pattern the codebase already used for `DIRT` (spec 002) and
  `RAINBOW_SAND` (spec 003) — no new rendering mechanism, no per-frame cost
  change. 8 shades (matching `PINK_RAMP`/`PURPLE_RAMP`'s existing count)
  comfortably clears SC-011's "at least 6 distinguishable green shades."
- **Alternatives considered**: An HSL sweep like `RAINBOW_SAND`'s (a
  continuous hue range) instead of a hand-picked ramp — rejected: grass is
  a single fixed hue family with brightness variation ("a lively range of
  greens," not a rainbow), which is exactly what the pink/blue/purple ramps
  already model for the other single-hue elements; reusing that pattern
  keeps grass visually consistent with sand/water/dirt rather than reading
  like a second rainbow-sand.

## 9. Landscape-1 seeding: decorative hill-cap grass plus a small, deterministic, guaranteed-adjacent shoreline seed

- **Decision**: `generateLandscape1` (`scenes.ts`) gains two additive
  passes after its existing hill/lake/rainbow/unicorn generation, both
  using `setCell` (so §3's bookkeeping applies automatically) and both
  purely a function of the already-computed, deterministic `heights[]`
  profile and `waterSurfaceRow` (no `Math.random()`, preserving FR-028a's
  determinism):
  1. **Hill cap** (decorative, most of the visible "green hillside"): for
     every *dry* column (`heights[i] <= waterSurfaceRow` — i.e. not
     flooded), place one grass cell at `(x, heights[i] - 1)` — the empty
     air cell immediately above that column's existing dirt surface. This
     never overwrites dirt (the hill's shape, and every existing
     dirt-height-profile assertion in `scenes.test.ts`, are unaffected) and
     is deterministic by construction.
  2. **Shoreline seed** (small, deliberately water-adjacent, this is what
     drinks and grows on load): for a small fixed number of *flooded*
     columns nearest each crest (e.g. the first 2 flooded columns walking
     inward from `crest1`, and the last 2 walking inward from `crest2` —
     exact count tuned during implementation against SC-022, see below),
     place one grass cell at `(x, waterSurfaceRow - 1)` — the empty air
     cell immediately above that flooded column's water surface. This cell
     is *orthogonally adjacent, same column*, to a `WATER` cell by
     construction (that column's water always starts exactly at
     `waterSurfaceRow`), which is what guarantees Acceptance Scenario 10
     ("the grass at the water's edge drinks and grows a little") happens
     deterministically rather than incidentally.
- **Rationale**: Splitting "looks green" (pass 1, deliberately *not*
  touching water almost anywhere — a dry column's cap sits well away from
  the flooded columns' water except right at the shore transition) from
  "drinks at the shore" (pass 2, deliberately touching water at a small,
  fixed number of cells) is what makes FR-028a's "consumes no more than
  half the lake" tractable to reason about and to tune: only pass 2's seed
  cells can ever absorb anything on load (pass 1's cells are not adjacent
  to any water cell in the vast majority of columns, since a dry column's
  own dirt already fills every row down to and past the water line, so its
  cap sits on solid ground, not lakeside), so the total amount the scene
  *can* drink on load is bounded by a small, explicit, directly-controlled
  seed count — not by incidental geometry that would need re-deriving by
  hand for every grid size. Growth from each shoreline seed is further
  self-limiting even before the field-share/height ceilings: FR-010's
  preference order tries "straight up" first, so a seed cell's own children
  mostly climb away from the shoreline within a step or two rather than
  spreading sideways along it, keeping the number of cells simultaneously
  touching water small throughout the run (defense in depth alongside the
  hard FR-011/FR-012 backstops, which apply regardless).
- **Alternatives considered**: Seeding grass only on dry columns and
  relying on incidental adjacency at the dry/flooded boundary to produce
  *some* shoreline drinking — rejected: worked through precisely in
  drafting this document, a dry column's own dirt always extends down
  through and past `waterSurfaceRow` (it's solid ground, not a floating
  shelf), so its cap cell (one row *above* its own surface) is not
  guaranteed to land in the flooded neighbor's water-row range for every
  possible height-profile shape — an explicit, guaranteed-adjacent seed is
  simpler to reason about and to keep passing SC-022 than tuning incidental
  geometry. Seeding many shoreline columns for a lusher "wet meadow" look —
  rejected in favor of a small, explicit count specifically because it is
  the direct lever for SC-022's "at least half the lake survives," and a
  small count is trivially sufficient to produce the required "oh!"
  moment (Acceptance Scenario 10 only asks for "a little" growth, not a
  large one). The exact seed count (2 columns per shore in the decision
  above) is implementation detail within this strategy, to be validated
  (and adjusted if needed) against SC-022's automated assertion during
  implementation — recorded below under "Decisions made without
  clarification."

## 10. Test organization: a new `grass.test.ts` file, grouped by concern rather than by implementation file

- **Decision**: The bulk of FR-035's grass-specific coverage (no movement
  including mid-air; absorption + pacing; no-absorption-when-blocked;
  growth target order; height ceiling; field-share ceiling; one-blade-
  per-water-cell bound; no growth/no change without water) lives in a new
  `tests/unit/sim/grass.test.ts`, even though the implementation itself
  lives inside `step.ts`/`grid.ts` rather than a dedicated `grass.ts`
  module. Small, targeted additions go into the existing files whose
  own concern each touches: `grid.test.ts` (setCell's `grassHeight`/
  `grassCount` bookkeeping, §3), `brush.test.ts` (the new `grass` tool's
  deposit/non-overwrite rules), `wand.test.ts` (one line confirming grass
  glitters, §6), `resize.test.ts` (grass and its new per-cell arrays
  survive a re-derivation), `scenes.test.ts` (landscape-1's grass
  presence/determinism/proportionality and the "half the lake survives"
  assertion; landscape-2's continued zero-grass assertion).
- **Rationale**: `step.ts` staying implementation-unified (§5) doesn't
  require its test coverage to stay file-unified — FR-035 asks for a large,
  distinct set of grass-only rules, and grouping them in one file by
  *concern* (mirroring how `wand.test.ts` already tests a self-contained
  concern, "the wand," even though other files also touch the grid the
  wand operates on) keeps `step.test.ts`'s existing powder/water tests
  uncluttered and gives grass's own extensive rule set a single, obvious
  home.
- **Alternatives considered**: Adding a `describe('step — grass', ...)`
  block directly inside the existing `step.test.ts` — rejected only for
  file-size/organization reasons (FR-035's grass list is long enough to
  roughly double that file); behaviorally equivalent either way.

## 11. No new runtime dependency

- **Decision**: This feature needs no new package, browser API, or build
  step — every new capability (two new `Uint8Array`s, one new number field,
  one new element constant, one new tool string, one new toolbar button,
  one new shade ramp, two new deterministic scene-generation passes) is
  built from mechanisms 001–006 already established.
- **Rationale**: Constitution Principle III ("no other runtime dependencies
  without a spec explicitly justifying them") and the project's established
  precedent (every prior feature shipped with zero new dependencies).
- **Alternatives considered**: None — no candidate dependency was ever in
  scope for a feature this close to the existing engine's own primitives.

All Technical Context unknowns are resolved; nothing carries forward to
Phase 1 as unresolved.

## Decisions made without clarification

No spec-level `[NEEDS CLARIFICATION]` marker existed to resolve (every
product-intent question was already answered in `spec.md`'s own
Clarifications/Assumptions sections before this planning stage began). The
following implementation-technology choices were made without further
clarification because the spec leaves them as implementation detail, not
product intent — each is a reasonable, spec-consistent default that
`tasks`/`implement` should carry forward, adjusting the tunable numbers
below only if a concrete test run shows they don't hold:

- The exact per-cell state representation (`grassHeight`/`grassCooldown`
  as two `Uint8Array`s plus a `grassCount` number on `Grid`, §2) and the
  decision to make absorption-and-growth one atomic same-step operation
  rather than a persisted pending-capacity flag (§2).
- `GRASS_ABSORB_COOLDOWN = 10` steps as the literal pacing value (the
  spec's FR-009 states the constraint as "at most one per 10 steps"; 10 is
  the direct reading, not a separate choice).
- The field-share ceiling's exact comparison (`grassCount >= floor(width *
  height * 0.25)` blocks further growth, §4) — a direct, conservative
  reading of "MUST NOT grow once grass occupies 25%."
- The random tie-break between the two diagonal growth targets using
  `Math.random() < 0.5` (§4) — the spec requires randomness but not a
  specific distribution or source.
- The landscape-1 shoreline seed's exact column count (2 flooded columns
  walking inward from each crest, §9) — the spec requires "no more than
  half the lake" and "a little" growth but not an exact number; this
  starting value is the one to validate against SC-022 during
  implementation and adjust if the automated test shows it's too generous
  for some supported grid size.
- Housing grass's simulation logic inside `step.ts` (alongside
  `stepPowder`/`stepLiquid`) rather than a new dedicated `src/sim/grass.ts`
  module, while still giving it a dedicated test file (§5, §10) — an
  architectural-fit judgment call, not a product decision.
