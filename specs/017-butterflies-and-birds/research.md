# Phase 0 Research: Butterflies Over Her Flowers, Birds On Her Palms

This feature's spec carries no `[NEEDS CLARIFICATION]` marker — every
product-intent question it might have raised (persistence, numbers,
pathing over terrain, off-field flight limits, poke reactions, the erase
hold-off value) is already answered in `spec.md`'s own Assumptions
section, written at spec time against the issue's explicit asks. This
document resolves the remaining *implementation-technology* unknowns
needed to fill Technical Context and unblock Phase 1 design: how flower
locating can be bounded and amortized (FR-034) without a new `Grid`
field, how the erase hold-off (FR-026) is scoped without a "pool"
concept to hang it on, how a bird's short flight arc stays provably
in-bounds (FR-015), and why no code in `history.ts`/`save.ts`/`resize.ts`
needs to change at all.

## 1. Locating flowers: an amortized, row-bounded re-scan of `grid.elements`, not a new `Grid` counter

- **Decision**: `butterflies.ts` owns a small internal scan cursor
  (`nextRow`, an in-progress `buffer` array of `{x, y}` flower positions,
  and a `known` array holding the last *completed* pass's results).
  Every call to `stepButterflies` scans `Math.max(1, Math.ceil(grid.height
  / FLOWER_SCAN_PASS_FRAMES))` rows starting at `nextRow`, appending every
  `FLOWER` cell found to `buffer`. When `nextRow` reaches `grid.height`,
  `buffer` atomically replaces `known`. `FLOWER_SCAN_PASS_FRAMES = 60`, so
  a full pass takes about one second at the 60fps target (and
  proportionally longer, still bounded, at a lower frame rate — see
  below). All population math (`desiredCount`, spawn eligibility, target
  selection) reads `known`, never `buffer` or the live grid directly,
  except for one O(1) single-cell recheck at arrival (§3).
- **Rationale**: FR-034 is explicit — "bounded and spread out over time
  rather than repeated in full every frame, and its cost MUST NOT grow
  with how many flowers." A per-frame cost of `O(width)` (a bounded
  number of rows), summing to exactly one `O(width * height)` pass per
  ~60 frames, is the literal shape of that requirement, and it costs
  nothing extra to add a `Grid` field for: no new counter, no hook into
  `setCell`/`step.ts`'s flower-bloom code path (`stepGrass` in
  `step.ts`), so flower growth (spec 007) stays completely untouched
  (FR-037). The ~1-second pass cadence also directly produces FR-004/
  SC-001's "first butterfly within about a second" (worst case is
  arriving just after the scan passed that row) and FR-005's flicker
  guard for free: because `known` only ever changes atomically once per
  completed pass, a flower that appears and disappears faster than one
  pass simply never shows up in `known` at all, and `desiredCount`
  (derived from `known.length`) cannot itself change more than once per
  pass — there is no separate debounce timer to get wrong.
- **Alternatives considered**: A `Grid.flowerCount` field maintained
  incrementally inside `setCell`/`stepGrass`, mirroring `grassCount`/
  `fogCloudCount` — rejected because it only gives a *count*, not
  *positions*, and butterflies need actual flower coordinates to fly
  toward; maintaining a live *position list* incrementally inside
  `grid.ts`/`step.ts` would mean every one of those files takes on a
  dependency on this feature's own data structures, which is exactly the
  coupling `pets.ts`/`objects.ts` avoid today by living entirely outside
  `grid.ts`. A full `O(width * height)` scan once per frame — rejected
  outright by FR-034's explicit wording; at the default 270×160 field
  this is only 43,200 reads (cheap in isolation) but the requirement is
  about the feature's own cost *shape*, not a measured budget, and a
  full scan does not amortize as field size grows on a lower-end device.
  A frame-rate-independent (`performance.now()`-based) pass cadence
  instead of a frame-counted one — rejected as unnecessary complexity:
  every existing sim timer in this codebase (`STEP_INTERVAL`,
  `WANDER_IDLE_DELAY`, `EAT_DURATION`, fog's `FOG_STUCK_LIMIT`, etc.) is
  frame-counted against the 60fps target and is described as "about" a
  duration, exactly this spec's own "about a second" phrasing; a pass
  simply takes proportionally longer (up to ~2s) on a 30fps floor device,
  which is still within the spirit of "about a second" for a decorative
  feature and keeps this module's style consistent with every sibling
  module it sits beside.

## 2. Population math is a pure function of `known.length`; the per-4-flowers/cap-4 rule needs no extra state

- **Decision**: `desiredButterflyCount(knownFlowerCount) = knownFlowerCount
  === 0 ? 0 : Math.min(4, Math.ceil(knownFlowerCount / 4))`, recomputed
  every frame directly from `known.length` (cheap, `O(1)`) — not cached,
  not itself debounced again, because `known` already only changes once
  per scan pass (§1).
- **Rationale**: This is FR-003's rule verbatim ("one butterfly per 4
  flowers, rounded up, capped at 4"), and computing it fresh every frame
  from an already-debounced input is simpler and strictly equivalent to
  caching it and invalidating the cache on every `known` swap — there is
  no behavior difference, only one fewer piece of state to keep in sync.
- **Alternatives considered**: Recomputing `desiredButterflyCount` only at
  the moment `known` swaps (an explicit "pass completed" event) — rejected
  as needless: reading `.length` every frame is not the expensive part of
  this feature (the scan itself is, and it is already amortized), so
  gating the read behind an event adds a branch and a stored "last known
  desired count" field for zero measurable benefit.

## 3. Butterflies never "path" — they steer toward a target with added wobble, and a live single-cell recheck at arrival (not the scan) catches a just-vanished flower

- **Decision**: A travelling butterfly's heading is `atan2(targetY - y,
  targetX - x)` (pure bearing to target) perturbed by a small per-frame
  random wobble added to the heading actually flown, so the path curves
  and drifts rather than running dead straight (FR-008) while still
  making net progress toward the target. Position updates by a fixed
  `FLIGHT_SPEED` (cells/frame) along the wobbled heading every frame, with
  **no** collision/terrain check of any kind (FR-009) — the butterfly is
  drawn over whatever `grid.elements` holds at its position, never reads
  it for steering. On arrival (`distance(x, y, targetX, targetY) <=
  ARRIVE_RADIUS`), the module does one `O(1)` read of
  `grid.elements[targetY * width + targetX]`: if it is still `FLOWER`,
  the butterfly switches to `visiting`; if not (the flower vanished after
  the last completed scan pass but before arrival — a window bounded by
  one pass, ~1s), it immediately retargets from `known` (or leaves, if
  `known` is now empty) rather than lingering. Separately, every time a
  scan pass completes, every *currently travelling* butterfly's stored
  target coordinate is checked against the fresh `known` array; if it is
  no longer present, the butterfly retargets immediately instead of
  waiting to arrive at nothing.
- **Rationale**: This is FR-010's exact scenario ("if the flower a
  butterfly is travelling toward disappears... choose another flower or
  leave... never freeze, hover indefinitely, or head for an empty spot")
  implemented with the same ~1-pass latency budget the rest of this
  feature already uses (§1), rather than inventing a separate, tighter
  live-tracking mechanism for this one case. The two checkpoints (scan
  completion, and arrival) between them bound the worst case to "at most
  one pass of staleness, and never longer than that regardless of how
  long the flight takes" — a flight that takes multiple seconds gets
  re-validated at least once before it would otherwise arrive at nothing.
  No terrain interaction of any kind is the direct reading of FR-009 and
  the explicit rejected-alternative note already in spec.md's own
  Assumptions ("a turn-away rule was considered and rejected... risks a
  butterfly caught in a pocket of terrain").
- **Alternatives considered**: Any form of pathfinding or terrain
  avoidance — rejected by FR-009 and spec.md's own Assumptions, not just
  as an implementation-cost tradeoff. Re-validating every travelling
  butterfly's target every single frame against the live grid (an `O(1)`
  read per butterfly per frame, cheap given the ≤4 cap) instead of only
  at scan-pass boundaries — considered and not rejected on cost grounds
  (it would be just as cheap) but not chosen either, because it adds a
  second, redundant "is this still a flower" code path alongside the
  arrival check for a latency improvement (sub-frame vs. sub-pass) the
  spec's own "about a second" tolerances do not ask for; kept as a
  documented, trivial future tightening if a maintainer's eyeball check
  ever finds the ~1s window visible.

## 4. No repositioning helper for a re-derivation — butterflies/birds are cleared and left to re-establish, exactly like a fresh mount

- **Decision**: `PlayArea.svelte`'s `resize()` calls `clearButterflies`/
  `clearBirds` in its re-derivation branch (the same branch that already
  calls `repositionPoodles`/`repositionObjects`), rather than adding a
  `repositionButterflies`/`repositionBirds` offset-and-clamp helper
  mirroring `repositionPoodles`. `undo()`/`redo()`/`tryRestore`/
  `loadScene` need **no** butterflies/birds call related to
  re-establishing population at all beyond the `clearAll`/`loadScene`
  clears already needed for FR-027/FR-032 — because population is
  recomputed from the *live* grid/objects every frame (§1, §2), an undo
  that changes which flowers/palms exist is automatically reflected
  within about one scan pass with zero glue code, exactly as FR-030
  ("not part of an undo state; populations simply re-settle") describes.
- **Rationale**: FR-031 requires "nothing out of bounds, nothing
  stranded... no crash" after a re-derivation, and clearing outright
  trivially satisfies that (there is nothing left to be out of bounds)
  while costing less code than repositioning creatures whose *individual*
  continuity the spec explicitly does not require ("the same kind of
  creature, not necessarily the same individuals," FR-029). Since a fresh
  scan pass completes in about a second regardless of cause (mount,
  reload, resize, undo, scene switch), "cleared, then re-established
  within about a second" is a single behavior this feature implements
  once, not once per lifecycle event — which is also why `tryRestore`
  needs no call at all: the moment a mounted `PlayArea` first calls
  `frame()`, `butterfliesState`/`birdsState` start empty and the very
  first `stepButterflies`/`stepBirds` calls begin the same establishment
  process a fresh canvas already goes through, whether or not
  `tryRestore` just populated the grid with a saved picture.
- **Alternatives considered**: A `repositionButterflies`/
  `repositionBirds` pair mirroring `repositionPoodles`'s offset-and-clamp
  shape — rejected: preserving a butterfly's mid-flight position across a
  resize only to immediately re-validate its target against a
  now-possibly-very-different flower layout buys continuity the spec
  explicitly says is not needed, for real code (an offset/clamp helper,
  plus its own test coverage) that a clear-and-re-establish approach does
  not need at all. Leaving `butterfliesState`/`birdsState` completely
  untouched across a resize (no clear) — rejected: a butterfly's absolute
  `(x, y)` was chosen against the *old* grid's dimensions and could sit
  outside the new grid's bounds (a shrink) or reference a target flower
  position that the new grid's coordinate space no longer means the same
  thing at (FR-009's "always drawn inside the play field" would not hold
  for even one frame without an explicit clamp or clear).

## 5. Two sibling files (`butterflies.ts`, `birds.ts`), not one combined module

- **Decision**: Butterflies and birds are implemented as two separate
  files, each with its own state type, `create*State`/`step*`/
  `erase*InBrush(Line)`/`clear*` exports.
- **Rationale**: Their population mechanics are genuinely different
  shapes — butterflies are a global, count-derived population sourced
  from an amortized grid scan with no natural "owner" per creature; birds
  are a direct one-per-object map keyed on `PlacedObject.id` with no scan
  at all. This mirrors the existing `pets.ts` (independent creatures with
  their own movement AI) vs. `objects.ts` (placed things with a
  footprint, tracked `byKind`) split already established in this
  codebase, rather than inventing a shared "ambient creature" abstraction
  that would need to paper over the fact that one kind scans the grid and
  the other reads a `Record`/array directly.
- **Alternatives considered**: One `wildlife.ts` file exporting both —
  considered, and rejected only because the two population mechanisms
  share essentially no code (not even the erase-hold-off shape, §6) —
  a combined file would just be two unrelated sections back to back,
  with no reduction in total code and a less obvious 1:1 mapping to the
  spec's own two independently-priced user stories (P1 butterflies, P2
  birds).

## 6. The erase hold-off (FR-026) is scoped per population, not global-across-both-kinds and not per-flower/per-palm-slot for butterflies

- **Decision**: Each module keeps its own short list of recent
  eraser-removal timestamps (`recentErasesAt: number[]`, pruned of
  entries older than `ERASE_HOLDOFF_MS = 3000` every step). The number of
  *unexpired* entries is subtracted from `desiredCount` before deciding
  whether to spawn a new butterfly — so erasing 2 of 4 butterflies
  suppresses exactly 2 spawn slots for 3 seconds, not the whole
  population, and a flower-count change that raises `desiredCount` during
  that window still fills in around the held-off slots. Birds, being
  one-per-palm, hold off per palm id directly: erasing the bird on palm
  `A` sets a `holdoffUntil` timestamp keyed to `A`'s id in a small
  `Map<number, number>`, and the spawn check for palm `A` specifically
  (not any other palm) is skipped until that timestamp passes.
- **Rationale**: Spec 014's own FR-025 (the sibling feature this spec's
  Assumptions explicitly ties the ~3s value to) scopes its hold-off *per
  pool*, not globally across every fish everywhere — the shared intent
  across both features is "the specific population the child just acted
  on visibly holds off, not the whole toy's ambient life." Birds have an
  exact structural equivalent to "pool" (the palm slot), so the same
  per-slot shape applies directly. Butterflies have no such slot — they
  are not owned by any one flower for their lifetime (spec.md's own
  Assumptions: "not tied to any one flower") — so the closest faithful
  translation is a *count*-scoped hold-off: exactly as many spawns are
  suppressed as creatures were just erased, for the same 3 seconds,
  which reproduces the child-visible effect ("I erased two, and only
  those two stay gone for a few seconds") without inventing a
  per-flower identity this feature's data model otherwise has no use for.
- **Alternatives considered**: One global `holdoffUntil` timestamp per
  module that blocks *all* spawning (not just N slots) for 3 seconds
  after *any* erase — rejected: erasing one of four butterflies would
  then also prevent a *fifth* flower's newly-earned butterfly from
  appearing for 3 seconds, which is a stronger, unintended suppression
  the spec's population-growth requirement (FR-003/FR-004) does not ask
  for and an adult watching would likely read as a second bug rather than
  the eraser "plainly work[ing]" (SC-009's own framing). Keying
  butterflies' hold-off to the flower nearest the erase point — rejected
  per §3/Assumptions: butterflies are explicitly not bound to a single
  flower for their lifetime, so there is no stable "that flower's
  butterfly slot" identity to hold off in the first place; the erased
  butterfly could equally have been travelling between two flowers when
  the eraser caught it.

## 7. Bird flight is a parametrized arc (two palms) or a closed loop (one palm), with the peak height clamped to the shorter available headroom so the whole path is provably in-bounds

- **Decision**: A bird's flight is driven by `flightProgress` advancing
  `1 / FLIGHT_DURATION_FRAMES` per frame (`FLIGHT_DURATION_FRAMES` sized
  for "a couple of seconds," FR-016). Two-palm flights use a quadratic
  Bézier between the take-off perch and the landing perch, with the
  control point raised above the straight line between them by
  `arcHeight = min(ARC_HEIGHT_CELLS, min(startY, endY))` — i.e., never
  higher than the shorter of the two perch heights allows before it
  would cross `y = 0`. Single-palm flights ("off and back to the same
  tree") use a closed loop around the perch — `x = perchX + loopRadiusX *
  sin(2π · progress)`, `y = perchY - loopHeight · (1 - cos(2π ·
  progress)) / 2` — which returns exactly to `(perchX, perchY)` at both
  `progress = 0` and `progress = 1` by construction, with `loopHeight`
  and `loopRadiusX` each independently clamped so the loop's highest
  point and widest points stay within `[0, grid.height)` /
  `[0, grid.width)` given that particular palm's position. Every sampled
  point along either shape is therefore proven in-bounds by the clamp
  math itself, not by a runtime bounds check that could silently clip the
  visual.
- **Rationale**: FR-015/FR-016 require "every point along a flight stays
  inside the play field" and "in full view the whole way... never out
  past an edge," and spec.md's own edge case calls out a palm "placed
  high in the sky, half off the edge" needing "a take-off from a palm
  near an edge [to] still keep its whole arc in view." Deriving the
  clamp from each specific flight's own start/end heights and each
  palm's own distance to the nearest edge (rather than a single fixed
  arc height tuned for the middle of the field) is what makes that true
  for a palm placed anywhere the placement code allows it to be, not just
  in the common case.
- **Alternatives considered**: A single fixed arc height/loop size tuned
  to look good at the field center — rejected: it would need a runtime
  clamp-or-reject fallback for edge-placed palms anyway (per the spec's
  own edge case), at which point the height-aware clamp above is simpler
  to reason about and test than "usually a nice arc, except near an edge
  where it does something else." True physical projectile motion
  (gravity + initial velocity) — rejected as needless complexity for a
  purely decorative "couple of seconds" loop; a parametrized curve gives
  exact start/end/height control with no numerical tuning to make it
  "land" precisely on the destination perch at exactly `progress = 1`.

## 8. Nothing in `history.ts`/`save.ts`/`resize.ts` needs a new export, guard, or field

- **Decision**: Neither new module is imported by `history.ts`,
  `save.ts`, or `resize.ts`, and none of those three files gains any new
  code for this feature.
- **Rationale**: This falls directly out of §1's/§4's design choices
  (population sourced from the live grid/objects every frame; no
  persistence, no capture, no repositioning across a re-derivation) —
  it is the structural proof of FR-028 ("MUST NOT be saved individually"),
  FR-030 ("not part of an undo state"), and FR-033 ("no new element
  identity... per-cell formats... unchanged"), the same way spec 011's
  own plan treated "zero diff to `save.ts`" as the strongest possible
  evidence for its own analogous "world save behaves exactly as it does
  today" requirement.
- **Alternatives considered**: None seriously — the spec's own repeated,
  explicit "respawn-from-context... no round-trip to test" framing
  (Assumptions) directly names this as the intended design, not merely
  one option among several.

All Technical Context unknowns are resolved; nothing carries forward to
Phase 1 as unresolved.

## Decisions made without clarification

`spec.md` carries no `[NEEDS CLARIFICATION]` marker at all — every
product-intent question was already resolved in its own Assumptions
section at spec time. The following are this plan's own
implementation-technology choices, made because the spec leaves them as
implementation detail rather than product intent:

- **The row-bounded, ~1-second-cadence flower scan** (§1) and its
  frame-counted (not wall-clock) timing — FR-034 specifies the *shape*
  of the cost ("bounded... spread out... MUST NOT grow with flower
  count") but not a mechanism; the specific `FLOWER_SCAN_PASS_FRAMES =
  60` cadence and the atomic-swap-at-pass-completion design are this
  plan's reading, chosen to also satisfy FR-004/FR-005 for free (§1).
- **Recomputing `desiredButterflyCount` fresh every frame rather than
  caching it** (§2) — an internal simplification with no behavioral
  difference from caching-and-invalidating.
- **The live single-cell recheck at arrival plus per-pass target
  revalidation, rather than a per-frame live check, for FR-010's
  "target vanished" case** (§3) — a latency/complexity tradeoff within
  the spec's own "about a second" tolerance band, not a requirement the
  spec states a mechanism for.
- **Clearing (not repositioning) butterflies/birds on every
  re-derivation, and adding no call at all to `tryRestore`/`undo`/
  `redo`** (§4) — the spec requires the *outcome* ("re-derived... within
  about a second... not necessarily the same individuals"); clear-and-
  re-establish is this plan's chosen mechanism because it is strictly
  simpler than a repositioning helper for a guarantee the spec does not
  ask this feature to provide (individual continuity).
- **Two sibling files instead of one combined module** (§5) — a code
  organization choice with no behavioral consequence, following the
  existing `pets.ts`/`objects.ts` precedent of splitting by mechanism
  shape rather than by "creatures" vs. "not creatures."
- **Per-population-count hold-off for butterflies and per-palm-slot
  hold-off for birds, rather than one global hold-off** (§6) — FR-026
  specifies the *duration* (~3s, matching spec 014) and the *visible
  effect* ("the eraser is plainly seen to work... an erased garden is
  never permanently emptied") but not the exact scope; this plan reads
  "population" at the same granularity spec 014's own per-pool wording
  uses for its structurally closest available equivalent (a palm slot
  for birds; a suppressed-spawn-count for butterflies, which have no
  slot to hold off).
- **The specific arc/loop parametrization and its height/radius clamp
  formula for bird flights** (§7) — FR-015/FR-016 specify the *outcome*
  (in-bounds, in-view, a couple of seconds, always lands perched) but not
  a curve shape; a closed-form parametrized path was chosen over
  simulated physics specifically because it can be proven in-bounds by
  construction rather than checked at runtime.
