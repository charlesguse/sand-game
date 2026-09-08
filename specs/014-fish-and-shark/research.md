# Phase 0 Research: Fish And A Shark Living In Her Water

No `[NEEDS CLARIFICATION]` markers were left in `spec.md` — the three open
questions (threshold calibration, cap allocation order, eraser hold-off
duration) were resolved by @charlesguse on issue #45 and are recorded in
the spec's own Clarifications section. This document resolves the
remaining engineering *how*: the numbers and mechanisms the spec
deliberately leaves to implementation (exact speeds, hysteresis margins,
the sweep's cell budget, chase/scatter timings) are not spec ambiguities
requiring human sign-off — they are ordinary design decisions, recorded
here with rationale so a reviewer can retune any single one without
re-deriving the whole design.

## §1 The pool-measurement sweep is incremental and resumable, not per-frame-full

**Decision**: `SeaLifeState` carries a persistent, resumable flood-fill
over `grid.elements`: a reusable `poolId: Int32Array` (one label per
cell, `-1` = unlabeled), a reusable BFS queue sized to the grid, a
`sweepCursor` (next linear index to consider starting a new region from),
and a `sweepBudget` derived once from grid size:
`Math.ceil(width * height / SWEEP_TARGET_FRAMES)` with
`SWEEP_TARGET_FRAMES = 45`. Every call to `stepSeaLife` pops/pushes at
most `sweepBudget` cells: continuing whichever pool's flood-fill is
mid-flight, then advancing the cursor to start the next unlabeled water
cell's region once the queue drains, using 4-connectivity (cardinal
neighbors only) to define "connected body of water" (FR-002). When the
cursor reaches the end of the grid with an empty queue, the sweep is
complete: `poolSize` (one count per label) is authoritative, the
population reconciliation (§4) runs once, and the buffers reset to begin
the next sweep immediately — a continuous cycle, not a one-shot
recompute triggered by edits.

**Rationale**: FR-032 states plainly that "measuring pools MUST be
bounded and spread out over time rather than repeated in full every
frame" — a binding requirement, not an optimization the plan is free to
skip because a full recompute would likely also hit 60fps at the default
field size (43,200 cells is small; a full BFS every frame would probably
be fine in isolation). Reading it as binding keeps the design honest to
the spec's own stated cost model and gives headroom for larger custom
field sizes or slower devices without a design change. `SWEEP_TARGET_FRAMES
= 45` (~0.75s at 60fps) leaves margin under FR-007/FR-022/FR-028/FR-030's
"~1 second" bars once the reconciliation pass and a frame or two of
creature movement are added on top, while still keeping the per-frame
budget (~960 cells at the default size) trivially cheap next to `step()`'s
existing full-grid pass. 4-connectivity (not 8) is the simpler, more
literal reading of "connected body of water," and matches how
`step.ts`'s liquid/grass/star-power rules already treat adjacency
(cardinal neighbors) rather than introducing a diagonal-adjacency notion
nothing else in the sim uses.

**Alternatives considered**: A full flood-fill recompute every frame —
rejected as the direct thing FR-032 forbids, and it would scale worse on
a larger custom field with no headroom left. Recomputing only when the
grid changes (dirty-flag driven) — rejected: it would need per-edit
invalidation plumbed through every tool (`brush.ts`, `wand.ts`, star
power's fog creation, evaporation in `step.ts`), touching files this
plan otherwise leaves untouched (FR-012's "no existing element behaviour"
risk), for a saving that isn't needed once the sweep is already this
cheap — continuous sweeping is simpler and self-correcting by
construction (it can never miss an edit, because it never assumes one
happened). A two-pass union-find labeling (classic connected-component
labeling) — rejected in favor of persistent BFS: a resumable queue is
easier to budget precisely per frame (pop exactly N items) than a
two-pass algorithm is to interrupt and resume partway through either
pass.

## §2 Movement never consults pool identity — only "is the next cell water, right now"

**Decision**: A fish or shark's per-frame movement step only ever asks
`grid.elements[y * width + x] === WATER` for its current cell and for
candidate next cells — it never reads `poolId`. Turning happens whenever
the intended next cell is not water (pool edge, sand, a placed object,
empty air, out of bounds) or occasionally at random (FR-010); the
creature's own occupied cell is re-checked every frame as an immediate
safety net, and any creature whose occupied cell is no longer WATER
starts fading that same frame, regardless of where the pool-measurement
sweep currently stands.

**Rationale**: A pool is *defined* as a connected component of water
cells (FR-002). A movement rule that only ever steps into an adjacent
water cell can, by that definition, never leave the connected component
it started in — pool containment (FR-011) falls out of the movement rule
for free, with no dependency on `poolId` being fresh. This also solves
the one real hazard called out in the Edge Cases — "a fish's pool cut in
half by a stroke of sand drawn straight through it while the fish is
mid-glide" — without special-casing it: the instant the fish's own cell
becomes non-water (drawn over directly), the very next frame's
current-cell check catches it and starts the gentle fade, which is
*faster* than the "~1 second" budget FR-022 allows for the general
pool-shrinks-below-threshold case, not slower. Keeping movement entirely
decoupled from the sweep's staleness (up to ~1 second, §1) means a
mid-sweep pool split or merge can never produce a visibly wrong
movement decision — only a population-count decision that is at most
~1 second delayed, exactly as the spec's own acceptance criteria allow.

**Alternatives considered**: Gating movement on the creature's cached
`poolId` (recomputed only once per sweep) — rejected: it would let a
fish glide through a wall of sand poured mid-sweep for up to ~1 second
before the next label refresh caught up, which directly contradicts "the
fish never leave the water" (User Story 1) and FR-011's "must never
overlap sand... must never leave the play field." Checking pool identity
on every step (rather than just "is it water") — rejected as strictly
more expensive for no behavioral difference, since containment is
already guaranteed by the connectivity argument above.

## §3 Spawn locations reuse a small reservoir sample collected during the sweep, not a second scan

**Decision**: While flood-filling a pool's region, the sweep reservoir-
samples up to 8 of that pool's cells as spawn candidates (`spawnSample:
number[]` per label, replacement-sampled with decreasing probability as
more cells are seen — the standard single-pass reservoir algorithm).
When the reconciliation step (§4) decides a pool should gain a fish or
shark, it picks uniformly from that pool's `spawnSample` rather than
re-scanning the pool's cells.

**Rationale**: Keeps spawning O(1) and allocation-free at spawn time,
and keeps the sweep itself the only O(pool size) pass — no second
per-pool cell enumeration is needed anywhere, which matters because a
700+-cell lake is exactly the case FR-032's cost bound is protecting
against. A held sample of 8 already gives visually scattered spawn points
across a pool without storing (or re-deriving) its full cell list.

**Alternatives considered**: Storing every pool's full cell list —
rejected, unbounded memory relative to how much water she draws, which is
the literal cost concern FR-032 raises for measurement and applies
equally to storage. Picking the flood-fill's *first* cell in a region as
the only spawn point — rejected, it would make every fish in a pool spawn
in the same corner (the BFS's starting cell), reading as mechanical
rather than "a moment later a little fish is there" appearing naturally
somewhere in her pond.

## §4 Population reconciliation: hysteresis, largest-pools-first, and the eraser hold-off

**Decision**: When a sweep completes, reconciliation runs once, in this
order:

1. Sort pools with `poolSize >= FISH_DESPAWN_THRESHOLD` (the lower edge
   of the hysteresis band, below) by size, descending.
2. Walk the sorted list once for fish, once for sharks, tracking a
   remaining global budget (6 fish / 2 sharks) that only ever decreases:
   - `size >= spawnThreshold`: target count grows with size, capped at
     the per-pool cap (`min(floor(size / threshold), perPoolCap)`),
     further capped by the remaining global budget.
   - `despawnThreshold <= size < spawnThreshold` (the hysteresis band):
     target count is whatever that pool currently has, clamped only by
     the remaining global budget — never grown, never shrunk by size
     alone. This is what stops a one-cell wobble at the exact threshold
     from flickering a creature in and out (Edge Cases).
   - `size < despawnThreshold`: target is 0.
   - A pool containing any live eraser-cooldown point (§5) has its
     target clamped to *at most* its current count this cycle — it may
     shrink or hold, but never grow, until the cooldown expires.
3. For every live fish/shark, look up its current cell's `poolId`
   (freshly relabeled this sweep); if that pool's live count now exceeds
   its target, the excess creatures (arbitrary choice — no individual
   identity is meaningful, FR-028) start fading.
4. For every pool whose target exceeds its live count, spawn the
   difference from that pool's reservoir sample (§3).

**Rationale**: Directly implements FR-006 ("largest pools first"),
FR-025 (hold-off without a replacement), and the Edge Case's flicker
concern. `FISH_DESPAWN_THRESHOLD`/`SHARK_DESPAWN_THRESHOLD` are set 10
cells below their spawn thresholds (110 / 690) — a small, deliberately
simple band: at the field's default resolution a "wobble... one cell
either side" from water sloshing is on the order of a handful of cells
across a full sweep window, not tens, so a 10-cell band comfortably
absorbs it without meaningfully delaying a genuine drain (which the
Acceptance Scenarios expect to clear a pool "within about a second"
regardless — a pool that's genuinely draining passes through the band and
below it well inside that window). Doing the size-based target
computation before consulting cooldowns (rather than folding hold-off
into the per-pool cap formula) keeps the two rules independently
readable and testable.

**Alternatives considered**: A consecutive-sweeps-below-threshold counter
instead of a size-based hysteresis band — rejected as more state for the
same outcome; a size band reuses the same `poolSize` value the rest of
reconciliation already computes, with nothing extra to carry between
sweeps per pool (which would in turn require pools to have a persistent
cross-sweep identity — exactly what §5 avoids needing). Applying global
caps per-kind-then-per-pool in a single interleaved pass rather than "all
pools' fish targets, then all pools' shark targets" — rejected as an
unnecessary interleaving; the two budgets (6 fish, 2 sharks) are
independent per FR-006 and nothing in the spec asks them to trade off
against each other.

## §5 The eraser hold-off tracks erased points, not persistent pool identity

**Decision**: `SeaLifeState.eraserCooldowns` is a small array of
`{ x, y, framesRemaining }`, naturally bounded (at most one entry per
recent erase event, and there are at most 8 creatures in existence to
erase at all). Erasing a creature pushes an entry at its last position
with `framesRemaining = ERASER_HOLD_OFF_FRAMES` (≈180 frames / 3s at
60fps); every `stepSeaLife` call decrements and drops expired entries.
Reconciliation (§4) checks, per pool, whether any live cooldown point's
current `poolId` lookup lands in that pool — if so, that pool's spawn
target is clamped as described above.

**Rationale**: The design in §1 deliberately gives pools no identity that
survives across sweeps (a pool is just "whatever `poolId` labels a
region as, this sweep") — simpler, and correct for every other
requirement (re-derivation, merges, splits all just "look right next
sweep" with no bookkeeping). The 3-second hold-off is the one requirement
that needs *something* to persist across sweeps, but it only needs to
persist a location and a countdown, not a pool's identity — checking "is
this point still inside a pool that's targeted for growth" against the
*current* sweep's fresh labeling is sufficient and correct even if the
pool has since changed shape (erasing a fish does not itself resize the
pool), and avoids needing to solve pool-identity matching across sweeps
(which merges/splits would make genuinely ambiguous) for a feature that
doesn't need it.

**Alternatives considered**: Giving each pool a stable ID derived from,
e.g., its minimum-index cell, and keying cooldowns to that ID — rejected;
fragile exactly when it matters (erasing near a pool's numerically-lowest
cell, or a split/merge within the 3-second window, changes the anchor),
and more state for a case the point-based approach already handles
correctly. A single global cooldown (suppress all spawning everywhere for
3 seconds after any erase) — rejected; FR-025 and Acceptance Scenario 5
are explicit that only *that pool* holds off, not the whole pond — a
global cooldown would visibly stall a fish arriving in an unrelated,
untouched lake just because she erased a fish somewhere else.

## §6 Shark targeting needs no pool-membership check either

**Decision**: A shark without an active target picks the globally
nearest live fish (Euclidean distance, no pool filtering) as its
`targetFishId`, with a chase timer (~5 seconds) that ends the pursuit
regardless of progress (FR-019), followed by a short cruise-only cooldown
before it may pick a new target.

**Rationale**: By §2's connectivity argument, a shark's own movement can
never cross into a fish's disconnected pool even if it is nominally
"targeting" a fish it cannot reach — it will simply make no progress
toward an unreachable fish and time out via the chase timer exactly as it
would time out chasing a reachable one that out-maneuvers it, producing
the same observable behavior ("cruises off or picks a different fish,"
FR-019) with no extra bookkeeping. This mirrors `pets.ts`'s own
`GUMDROP_PATIENCE` precedent (give up on a target that stops getting
closer) rather than introducing a new mechanism.

**Alternatives considered**: Filtering candidate targets to the shark's
own `poolId` before picking the nearest — rejected as unnecessary
complexity once the connectivity argument already makes an
out-of-pool target behaviorally inert (it can never be reached, so it
times out the same way); the filtered version would also need a
correctly-labeled `poolId` for the shark's *own* current cell, adding
back a dependency §2 specifically avoids.

## §7 Bob is a rendering-only offset, never part of a creature's logical position

**Decision**: `Fish.y`/`Shark.y` (used for every containment/movement
check) are never touched by the vertical "bob" a child sees. A `bobPhase`
counter (advanced every frame, wrapped) feeds a small sinusoidal pixel
offset applied only where `PlayArea.svelte` draws the glyph, exactly as
existing renders occasionally offset a poodle's glyph for a hop/trick
without moving its logical `x`/`y`.

**Rationale**: FR-009 asks for "a steady glide, and a gentle bob" as
visual flavor, while FR-011's containment guarantee (§2) depends on
`x`/`y` always being a real, checked-water position. Keeping the bob
purely cosmetic means the containment argument in §2 needs no exception
for it, and the bob can be tuned freely (amplitude, speed) with zero risk
of ever nudging a fish into a non-water cell.

**Alternatives considered**: Letting bob perturb `y` directly (with
movement re-validating the perturbed position against water each frame)
— rejected as needless extra water-checks for a purely decorative wiggle,
and it would make "gentle" harder to guarantee (a bob that occasionally
fails its water check would visibly stutter rather than smoothly
oscillate).
