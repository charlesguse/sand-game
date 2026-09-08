# Phase 0 Research: A Mermaid And Her Ice Cream

The spec (specs/016-mermaid-ice-cream/spec.md) already resolved its own
[NEEDS CLARIFICATION] items in its own **Assumptions** section (cap of 3,
confined-to-connected-water rule, flavour colours, no new sounds, ice cream
falls like a gumdrop, poke-not-summon, eraser reach). Those are treated as
given below, not re-litigated. What follows are the implementation-level
decisions the plan needed that the spec left to "whatever the maintainer
implementing it judges reasonable" — each is a real design choice made while
reading the existing codebase (`src/sim/pets.ts`, `history.ts`, `save.ts`,
`historySave.ts`, `toolbarControls.ts`), not a guess.

## 1. Mermaid movement: greedy neighbour stepping, not pathfinding

**Decision**: A mermaid's per-frame swim step evaluates only her own
up-to-8 neighbour cells (dx, dy ∈ {-1,0,1}, excluding (0,0)) that are WATER,
and steps to whichever one is closest (Chebyshev distance) to her current
target — ties broken randomly, mirroring `stepPoodle`'s left/right coin-flip.
No BFS, no stored path, no pool identity.

**Rationale**: `stepPoodle`'s existing gumdrop pursuit already proves this
shape works: bounded-window *target selection* (nearest gumdrop in a square
scan) plus purely local *movement* (one step toward the target every
`STEP_INTERVAL` frames) plus a patience/give-up counter that fires when local
movement stops making progress. That combination is exactly what "confined to
connected water, never stuck, never crosses dry land" needs for a mermaid,
and reusing it means the give-up mechanism that already proved out
(spec 016's whole "pet gets stuck" concern) needs zero new invention. A real
water-only BFS/pathfinder would guarantee reachability but costs more per
frame, needs to be re-run whenever the pool reshapes (every brush stroke), and
this codebase has no pathfinder anywhere to borrow from.

**Alternatives considered**: Full BFS shortest-path over the connected pool —
rejected as unbounded per-frame cost proportional to pool size, violating
FR-010's "bounded window that does not grow with canvas size" and constitution
Principle IV. Stored pool identity (tag each mermaid with "her" pool, recompute
on pour/erase) — rejected per the spec's own Assumptions section, which
already rejected this ("no pool identity is stored, so nothing can go stale").

## 2. Mermaid pursuit/give-up bookkeeping mirrors the poodle's, generalized to 2D

**Decision**: `pursuitX`/`pursuitBestDist`/`pursuitStaleFrames`/cooldown
become `pursuitX`/`pursuitY`/`pursuitBestDist`/`pursuitStaleFrames`/
`iceCreamCooldown` — same fields, same state machine, Chebyshev distance
instead of `Math.abs(x - poodle.x)`.

**Rationale**: FR-017 explicitly asks for "the same pursuit shape as the
poodle/gumdrop rule ... adapted to swimming." Reusing the field shape (not a
shared base class or generic `Pursuer` type — see §7 below) keeps the two
implementations easy to compare side by side and easy to diverge later
without fighting an abstraction.

## 3. No boredom delay before drifting

**Decision**: Unlike the poodle (`WANDER_IDLE_DELAY = 150` frames of standing
still before she starts wandering), a mermaid with nothing to pursue starts
her gentle drift immediately — there is no idle/boredom threshold.

**Rationale**: FR-006 is explicit and stronger than the poodle's wander rule:
"She MUST NOT stand perfectly still indefinitely while she has water to move
in" — no "eventually" qualifier. The poodle's boredom delay exists because
she's usually actively following a finger and standing still while waiting is
the normal, expected state; a mermaid is never finger-followed (FR-011: "Ice
cream is the only way the child steers her"), so drifting *is* her normal
idle state from frame one.

## 4. Un-burying: bounded neighbourhood search, not a dig animation

**Decision**: When a mermaid's own cell becomes solid, she does not "dig"
scoop-by-scoop the way a poodle does (climbing straight up through displaced
material she's walking on). Instead, each frame she is buried, she scans a
small bounded neighbourhood (radius ~3, same shape as the placement search in
§5) for the nearest non-solid cell and, once one exists, steps directly to it
over a short fixed duration (mirrors `DIG_DURATION`'s cadence so it still
*reads* as an escape rather than a teleport, per FR-009's "within a bounded
number of frames").

**Rationale**: The poodle's dig-out rule is gravity-shaped (she's always
walking on a surface, so "up" is a well-defined escape direction). A mermaid
has no gravity relationship to the material burying her — sand poured into
her pool from any side — so "dig up" has no natural direction to reuse.
Search-and-relocate is the natural 2D analogue and stays within FR-010's
bounded-window-per-frame budget.

## 5. Placement snapping and no-water rest reuse existing primitives

**Decision**: `addMermaid(grid, pets, x, y)` runs one bounded square-window
scan (same shape as `nearestGumdropX`, predicate swapped to "is WATER") around
the tap to find the nearest water cell; if found, she's placed there. If not,
she's placed at `groundBelow(grid, x, y)` (the exact helper `stepPoodle`
already uses to rest a poodle on the first solid surface, or the floor) with
a `'resting'` state, and every frame thereafter (while resting) checks whether
her own cell has become WATER, transitioning to swimming the moment it does.

**Rationale**: Reuses two already-tested primitives (`groundBelow`, the
bounded-scan shape) instead of inventing new ones for a case (FR-008) that is
structurally identical to "gumdrop search but for water."

## 6. Toolbar count baseline: trust the dynamic count, not the issue's literal

**Decision**: The plan's "Toolbar cost" section reports the *actual* current
`shippedToolbarControls(...).length` values read from
`src/lib/toolbarControls.ts` (26/28) rather than the spec's FR-030 text
("from 24 to 26").

**Rationale**: `tests/unit/lib/layout.test.ts` computes `BASE_CONTROLS`/
`FULL_CONTROLS` directly from `shippedToolbarControls(...).length` — "never a
hand-maintained literal" per spec 013's SC-009 — so that dynamically-derived
number, not the issue author's recollection, is what the merge gate actually
enforces. The discrepancy (26/28 today vs. the issue's "24") doesn't change
what has to ship: two new unconditional controls, taking the pair to 28/30.
Flagged in the issue comment as a decision made without being able to ask,
since it's a factual correction to the spec's own stated numbers.

**Correction (Phase 9 convergence)**: The 26/28 baseline above was itself
computed before "Houses, People, And Treasure" (`tool-house`, `tool-person`,
`tool-chest`, three `objects` controls) landed at this branch's fork point.
Directly invoking `shippedToolbarControls(false, false).length` /
`shippedToolbarControls(true, true).length` against the current
`src/lib/toolbarControls.ts` (with this feature's two controls included)
returns 28/30, not 25/27 — so the true pre-feature baseline was 26/28, and
this feature's two additions land it at the current, correct 28/30.

## 7. No shared `Pet`/`Pursuer` abstraction between Poodle and Mermaid

**Decision**: `Mermaid` is its own interface and `stepMermaid` its own
function in `src/sim/pets.ts`, not a generalization of `Poodle`/`stepPoodle`
behind a shared base type or strategy interface.

**Rationale**: The two pets share a *shape* (bounded-scent pursuit +
patience/give-up + poke + reposition-on-resize) but differ in almost every
concrete rule: 1D ground movement with gravity vs. 2D water-only movement with
no gravity; boredom-gated wandering vs. immediate drifting; dig-up vs.
search-and-relocate; finger-followable vs. poke-only. Forcing that into one
abstraction now, for two pets, would cost more than it saves and risks
distorting the poodle's already-shipped, already-tested behaviour to fit a
shape a mermaid only partly matches — exactly the kind of premature
abstraction this repo's own contributing conventions warn against. A future
third swimming or walking pet is the point at which a real shared shape (if
any) would earn its keep.

## 8. Undo/redo grows a `mermaids` field; poodles stay out of scope

**Decision**: `src/sim/history.ts`'s `WorldState` gains a `mermaids:
{ x: number; y: number }[]` field, threaded through
`captureWorldState`/`restoreWorldState`/`remapWorldState`/`worldMatches`, and
every `HistoryManager` method (`beginAction`, `commitAction`, `undo`, `redo`)
gains a `PetsState` parameter alongside its existing `Grid`/`ObjectsState`
ones. Poodles are **not** added to `WorldState` — they remain outside
undo/redo exactly as they are today.

**Rationale**: This was a real discovery, not an assumption: nothing in the
current codebase makes a poodle's placement or position participate in
undo/redo at all (`WorldState` only ever captured grid + objects; neither
`history.ts` nor its tests mention poodles). FR-027 requires it for mermaids
specifically ("Undo and redo MUST round-trip mermaids and ice cream cells").
Since ice cream is a grid element, it round-trips automatically once it's
added to `usesHueColor` — no `history.ts` change needed for that half.
Extending `WorldState` to *also* cover poodles would be a bigger, riskier
change than this spec asks for and risks changing an already-shipped
behaviour (a placed poodle currently survives an undo that reverts the stroke
that placed it — flipping that now is out of scope and not requested by any
FR here).

On restore (undo/redo, or a reopened save), a mermaid is rebuilt from just her
saved `{x, y}` into a fresh default-activity mermaid (state `'drifting'`,
`timer = 0`, pursuit cleared) — matching the spec's own Key Entities note:
"Saved as a position; restored into a fresh pet with default activity."

## 9. Mermaid remap (both live re-derivation and frozen history snapshots) clamps, never drops

**Decision**: Both the *live* re-derivation path (`repositionMermaids`,
called from `PlayArea.svelte`'s `resize()`, mirroring `repositionPoodles`
exactly) and `history.ts`'s `remapWorldState` (which remaps *frozen* past
snapshots in the undo/redo stacks) clamp a mermaid's `(x, y)` into the new
grid's bounds rather than ever dropping her from the list.

**Rationale**: FR-028 explicitly requires the live path to "remap mermaids
the way poodles are remapped today — shifted by the same offset and clamped
in-bounds rather than dropped." The spec is silent on what happens to a
mermaid's position *inside a frozen undo-stack snapshot* specifically, but
since a lone `(x, y)` pair (unlike a `PlacedObject`'s footprint, which can
genuinely fail to fit and forces `wouldRemapLosslessly` to reject the whole
snapshot) is *always* clampable with zero information loss beyond "she's now
at the edge instead of exactly where she was," there is no reason to ever
treat a mermaid as the thing that makes a snapshot non-lossless. Concretely:
mermaids are remapped by clamping and never participate in
`wouldRemapLosslessly`'s reject-the-whole-snapshot decision — only grid cells
and `PlacedObject` footprints do, exactly as today.

## 10. No new sound; ice cream pouring reuses the existing pour-synthesis mechanism

**Decision**: Eating and poking a mermaid introduce **zero** new sound
(FR-023, FR-011) — eating plays nothing, poking reuses the existing
`playTrill()` call already fired for a poked poodle/object. Pouring ice cream,
however, gets its own `PourKind` entry (`'icecream'`) and pitch in
`src/lib/sound.ts`'s existing `POUR_PITCH` table, exactly like every other
paintable element (sand, water, dirt, grass, star, gumdrop) already has.

**Rationale**: FR-023 ("Eating MUST be silent — this feature adds no
sounds") and the Assumptions section's "No new sounds" note are both scoped
to the mermaid's reactions (eating, poke), which is where a genuinely new
sound *effect* would need designing. Pouring already has one universal
mechanism (`playPour(kind)` synthesizing a tone at a per-element pitch) that
every other pourable element uses; giving ice cream a pitch on that same
table is reuse, not a new sound in the sense either FR-023 or the issue's "no
sound required" note is guarding against — the mermaid herself still makes no
sound.

## 11. No inline SVG fallback shipped preemptively (unlike the sand bucket)

**Decision**: Ship 🧜 (U+1F9DC, Emoji 5.0) and 🍦 (Emoji 1.0) as literal glyphs
in the toolbar and on-canvas, the same way every existing pet/element glyph
ships. No `BucketIcon.svelte`-style inline SVG is added preemptively.

**Rationale**: `BucketIcon.svelte` exists because 🪣 is Emoji 13.0+ and
verifiably missing on Windows 10 / Fire's emoji font (a fact already
established in this repo — see `tests/unit/shell/toolbarGlyphs.test.ts`'s
"avoids Emoji 13.0+ glyphs" check). Both this feature's glyphs predate that
cutoff by years, so there is no established reason to expect the empty-box
failure FR-031 is guarding against. FR-031 itself is written conditionally
("if either draws as an empty box ... that control MUST ship an inline SVG
icon instead"), not as a blanket requirement — so the plan follows the same
shape as every other feature's cross-platform checklist item: ship the glyph,
and flag it for Charlie (Fire tablet / Windows) to actually verify, per
CLAUDE.md's "flag anything only the other device can verify instead of
assuming it works." If verification fails, the fallback is a same-shaped
follow-up (a new `MermaidIcon.svelte`/`IceCreamIcon.svelte`), not a redesign.

## 12. Mermaid eraser reach: reused `POKE_RADIUS`, poodle erasure not retrofitted

**Decision**: A new `eraseMermaidsInBrush`/`eraseMermaidsInBrushLine` pair
(mirroring `eraseObjectsInBrush`/`eraseObjectsInBrushLine`'s shape, operating
on `PetsState.mermaids` instead of `ObjectsState`) uses the existing
`POKE_RADIUS` constant as its circular reach. This feature does **not** add
poodle erasure.

**Rationale**: This was the other real discovery while reading the codebase:
despite FR-024's phrasing ("using the same reach and feel as erasing a
poodle"), **poodles are not currently erasable at all** — `clearAll()` clears
them, but the eraser tool's brush path
(`eraseObjectsInBrush(Line)`) only ever touches `ObjectsState`
(rainbow/unicorn/palm/flamingo), never `PetsState.poodles`, and no test in
`tests/unit/sim/pets.test.ts` exercises erasing a poodle. FR-024's mandate is
scoped to "ice cream cells" and "a mermaid" only — it does not require adding
poodle erasure as a side effect, and doing so would be scope creep beyond
this spec's FRs into an unrelated pre-existing gap. Reading "the same reach
... as erasing a poodle" as "the same *radius* used for poodle-directed touch
interaction generally" (i.e. `POKE_RADIUS`, the only poodle-scoped radius
that exists) resolves the FR without inventing new poodle behaviour this spec
never asked for. Flagged in the issue comment as a decision made without
clarification, since the spec's own wording assumes something the codebase
doesn't actually have yet.

## 13. Save/history format: no version bump, tolerant of a missing `mermaids` field

**Decision**: Neither `save.ts`'s `SAVE_VERSION` nor `historySave.ts`'s
`HISTORY_SAVE_VERSION` is bumped. `deserializeWorld`/`deserializeHistory`
treat a wire payload whose `mermaids` field is missing, not an array, or
individually malformed as `mermaids: []` for that entry rather than rejecting
the whole payload — the same "be lenient about what's new, strict about
what's there" shape already used for a good example: old, pre-`byKind` shaped
saves aren't a case this codebase has had to handle before, but the *new*
`ICE_CREAM` grid-element id needs no such handling at all, since no pre-existing
save's `elements` byte array can ever contain the value 11 (element IDs are
monotonically assigned; ID 11 didn't exist before, so no old byte was ever
written as 11).

**Rationale**: FR-029 requires "Restoring a saved world written before this
feature existed MUST succeed, yielding no mermaids and no ice cream, with no
error surface." The existing `SAVE_VERSION` gate is all-or-nothing
(`if (wire.version !== SAVE_VERSION) return null`) — bumping it would reject
*every* pre-existing save outright (losing the child's whole picture, not
just her mermaids), which is a strictly worse outcome than FR-029 asks for
and cuts directly against the toy's "nothing she made ever leaves the device"
persistence ethos. Making the new field optional-and-defaulted is strictly
additive to the wire format and achieves exactly what FR-029 describes with
no version-gate risk. The spec's own Assumptions section left this open
("the save version is bumped if the format's shape requires it") — this plan
judges that it does not require one.

## 14. One-cell shore-beached ice cream is reachable, by design (T057)

**Decision**: Ice cream painted exactly one cell onto dry land, immediately
touching a pool's edge, is treated as reachable and gets eaten — it is
**not** distinguished from ice cream poured into water. No "original
terrain" memory is added to grid cells to make that distinction possible.

**Rationale**: `swimToward`'s `allowTarget` exception (`src/sim/pets.ts`)
exists so a mermaid can step onto her own pursuit target even when that cell
holds `ICE_CREAM` rather than `WATER` — necessary for FR-018 (in-pool ice
cream is, by definition, a non-`WATER` cell once painted, and she must still
be able to reach it). The grid stores only a live element id per cell, with
no history of what a cell held immediately before it was painted, so
`allowTarget` cannot tell "ice cream poured into water, now occupying what
was a water cell" apart from "ice cream poured one cell onto the adjacent
shore" — both look identical: a non-`WATER` cell adjacent to her current
water. Recovering that distinction would mean carrying a per-cell "what was
here before" shadow value through paint/erase/undo/redo/save — a new piece
of persistent state this feature's data model does not otherwise need,
solely to make one narrow corner case (a single shore-adjacent cell, not the
common "many cells inland" unreachable case, which is unaffected and still
correctly given up on per FR-019/FR-020) behave less generously. Per the
constitution's kid-first rule against failure states, a mermaid stretching
one extra cell onto the sand to reach dessert reads as delightful rather
than broken, so this is accepted rather than "fixed."

## 15. Burial escape prefers water over any free cell (T058)

**Decision**: `nearestNonSolidCell` (the buried-mermaid escape search) now prefers the nearest
non-solid **WATER** cell, falling back to the nearest non-solid cell of any kind only when no
water at all is within `MERMAID_FREE_RADIUS`.

**Rationale**: The combined adversarial-terrain stress test added for T058 (walls, a split pool,
unreachable ice cream, and a mid-run burial, run together for 2,000 frames) reproduced a genuine
stuck state that no single-hazard test had caught: a mermaid buried right at her pool's edge, with
open water and an equally-close dry gap (e.g. the empty space above a solid wall separating two
pools) both within the escape radius, could randomly relocate onto the dry gap instead of back
into water — the original search only minimized distance, treating water and non-water free cells
identically. Landing on a gap that will never receive water leaves her permanently `resting`
there forever (FR-008's resting-until-water-reaches-her-cell rule has no path back for a cell nothing will ever paint), which is exactly the kind of stuck state SC-002 rules out. Preferring
water when any is in reach keeps her within her connected pool in the overwhelmingly common case
(she was in water before being buried, so nearby water usually still exists) while still honoring
FR-009's "water or free cell" fallback for the genuine no-water-nearby case research.md §4 already
covers.
