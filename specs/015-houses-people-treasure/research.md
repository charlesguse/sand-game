# Phase 0 Research: Houses, People, And Treasure

No `[NEEDS CLARIFICATION]` markers remain in `spec.md` — both open questions
the lifecycle issue flagged (stars: ambient vs. button; the 320×568 toolbar
shortfall) were already resolved on issue #47 and recorded in
`checklists/requirements.md`. This document resolves the *how*, building on
the existing object/element machinery (`src/sim/objects.ts`, `src/sim/
element.ts`, `src/sim/types.ts`) and the toolbar-budget machinery specs 012/
013 already built (`src/lib/toolbarControls.ts`, `src/lib/layout.ts`).

## §1 Diamonds reuse the powder rule; no new movement code

**Decision**: `DIAMOND = 12` is added to `src/sim/types.ts`'s element
constants and `Element` union, and added to `isPowder()` in `src/sim/
element.ts` (`e === SAND || e === DIRT || e === RAINBOW_SAND || e ===
DIAMOND`) and to `isSolid()` (which already derives from `isPowder()`, so no
separate edit is needed there beyond the `isPowder` change flowing through).
`step.ts`'s dispatch loop needs no new branch — `isPowder(element)` already
routes to `stepPowder()`, which falls, slides, piles at the same angle of
repose as sand/dirt/rainbow sand, and sinks through `WATER`/`FOG` today
(`step.ts:107-148`, `isLiquid` check at line 118).

**Rationale**: FR-014 asks for "identical rules to pink sand... no new
movement rule." `isPowder` is exactly the shared predicate `stepPowder`
dispatches on (research: Explore report §1), so adding `DIAMOND` to that one
predicate is both necessary and sufficient — there is no separate "sand
rule" to duplicate.

**Alternatives considered**: A bespoke `stepDiamond` mirroring `stepPowder`
— rejected, it would be a byte-for-byte duplicate with no behavioral
difference, and FR-014 explicitly forbids a new movement rule. Adding
`DIAMOND` only to `isSolid` and giving it a distinct fall rule — rejected,
same reason.

## §2 `usesHueColor` and `visibleSnapshot` are deliberately left untouched (FR-016)

**Decision**: `DIAMOND` is **not** added to `usesHueColor()`
(`src/sim/element.ts:22-24`) or to the test-local `visibleSnapshot` helper in
`tests/unit/sim/history.test.ts`. Diamonds are colored from `shades[i]`
through a new fixed ramp in `src/lib/palette.ts` (§5), exactly like SAND/
DIRT/WATER, not from `hues[i]`.

**Rationale**: FR-016 requires this exact statement, and the doc comment
already on `usesHueColor` (`element.ts:16-20`) names the precise hazard this
spec must not reintroduce — a hue-coloured element left out of that
predicate (or out of `visibleSnapshot`) silently loses its color across
undo/redo and restore, which has happened once already. Diamonds staying
shade-coloured means both call sites need zero changes, which is the
simplest way to guarantee the hazard doesn't recur: there is nothing to
forget to add.

**Alternatives considered**: A hue-varied "sparkly rainbow diamond" —
rejected outright by FR-016/Assumptions ("rainbow sand already owns the
many-colours look"); would also require touching both `usesHueColor` and
`visibleSnapshot` in the same change, which the spec explicitly does not
authorize this feature to do.

## §3 Chest conversion mirrors `applyRainbowConversions`, with a narrower convertible set

**Decision**: A new `applyChestConversions(grid, chests)` function is added
to `src/sim/objects.ts`, structurally identical to `applyRainbowConversions`
(same one-cell-ring bounds math, same footprint-skip, same per-cell scan) but
with two differences:

1. The convertible-element set is `SAND | DIRT | WATER` — **not** `FOG`.
   Rainbow conversion decrements `grid.fogCloudCount` when it eats a fog
   cell (`objects.ts:38`); the chest must never touch `FOG` at all (FR-009),
   so it has no matching bookkeeping and no `FOG` branch.
2. The written result is `DIAMOND` with a fresh `randomShade()` (not a fresh
   hue) plus `setGlitter(grid, x, y, 1)` for the sparkle marking (FR-015) —
   rainbow conversion writes `grid.elements`/`grid.hues` directly without
   touching `glitter` because rainbow sand's "treasure" look comes entirely
   from its hue-driven color, not from the sparkle flag; diamonds are fixed-
   colour (§2), so the sparkle flag is what makes them read as glittering
   treasure instead of plain grey sand.

**Rationale**: FR-008 asks for the same "put it near the thing and the thing
changes it" zone rule the rainbow already uses (Assumptions: "the rainbow's
zone rule is adopted for the chest... so one tested zone rule serves both").
Reusing the exact bounds/footprint-skip arithmetic (rather than re-deriving
it) is what makes that assumption literally true and keeps the two functions
trivially comparable in review. The two differences above are forced by
FR-009 (never convert fog) and FR-015/FR-016 (diamonds read as sparkling via
the glitter flag, not via hue).

**Alternatives considered**: A single parametrized
`applyZoneConversion(grid, objects, { convertible, targetElement, assignColor
})` shared by both rainbow and chest — rejected: the two functions differ in
which elements they touch (rainbow includes FOG with cloud-count
bookkeeping; chest excludes it with none) and in how they color their output
(hue vs. shade+glitter), so a shared parametrized function would need enough
branching to express both cases that it stops reading as one rule — plain
duplication of the ~15-line bounds loop is simpler here and matches the
existing precedent of `applyRainbowConversions`/`isUnicornTouched` already
being separate, similarly-shaped functions in the same file rather than one
generic "zone scanner."

## §4 Overlap ordering (FR-011) is a call-order guarantee, not new state

**Decision**: `PlayArea.svelte`'s `frame()` calls `applyChestConversions(grid,
objectsState.byKind.chest)` immediately after the existing
`applyRainbowConversions(grid, objectsState.byKind.rainbow)` call
(`PlayArea.svelte:485`), within the same synchronous frame, before
`render()`. No new "already converted this step" flag is introduced.

**Rationale**: Both functions mutate `grid.elements` in place and only
convert cells whose *current* element is in their own convertible set.
Because rainbow always runs first in a given frame, a cell in both zones
that rainbow converts to `RAINBOW_SAND` this frame no longer matches the
chest's `SAND|DIRT|WATER` test when the chest's pass reaches it moments
later — the chest simply skips it. On every subsequent frame the cell is
`RAINBOW_SAND`, which matches neither function's convertible set, so it
never flips again. This makes FR-011's "no cell may alternate... across
steps" true by construction: the fixed call order means a doubly-zoned cell
is *always* resolved to rainbow sand, never diamond, with no race and no
extra bookkeeping.

**Alternatives considered**: Giving each object a "cells I've already
claimed this step" set to arbitrate order explicitly — rejected as
unnecessary complexity; the existing "both functions just read/write
`grid.elements` synchronously, in a fixed order" mechanism already the
codebase relies on for rainbow-vs-other-elements is sufficient and needs no
new per-cell state (Constitution IV: no new per-frame allocation).

## §5 Diamond color: a new fixed shade ramp, not hue

**Decision**: `src/lib/palette.ts` gets a new `DIAMOND_RAMP: Rgb[]` (icy
blue-white sparkle tones, sized and indexed by `shades[i] % length` exactly
like `PINK_RAMP`/`WATER_RAMP`), and `colorFor()` gets one new branch: `if
(element === DIAMOND) return DIAMOND_RAMP[shade % DIAMOND_RAMP.length];`.
Combined with the sparkle flag from §3, `render()`'s existing glitter-shimmer
code (`PlayArea.svelte:378-388`, unchanged) makes diamonds shimmer the same
way any other glittered material does.

**Rationale**: Directly implements FR-016 ("a single fixed colour... with the
ordinary per-cell shade variation") using the exact mechanism every other
fixed-colour powder already uses — no new rendering system, per constitution
Principle III.

**Alternatives considered**: Reusing `GOLD_RAMP` (already fixed-colour,
already in the file) instead of a new ramp — rejected only because gold is
already `STAR_POWER`'s color and FR-034 asks that diamonds be "distinguishable
from pink sand and gumdrops" at review time; a new, visually distinct
(cool-toned) ramp is the safer choice for that eyeball check, not a
technical requirement.

## §6 Chest's on-canvas appearance: a shared shape module, not two independent drawings

**Decision**: A new plain module, `src/lib/chestShape.ts`, exports the
chest's geometry as data — normalized rectangles/paths in a 0–1 unit box —
consumed by **both** a new `ChestIcon.svelte` (the toolbar control, an
inline `<svg>` built from the same data, following `BucketIcon.svelte`'s
precedent exactly) **and** a new branch in `PlayArea.svelte`'s
`drawObjectGlyph()` that maps the same data onto `ctx.fillRect`/`ctx.beginPath
()`+`ctx.fill()` calls scaled to the object's footprint size, replacing the
`ctx.fillText(emoji, ...)` call the other kinds use.

**Rationale**: The Explore research flagged that the bucket-icon precedent
only solved *toolbar* rendering (a Svelte-component SVG) and has no
canvas-context equivalent, while the chest is the first object that needs
*both* a toolbar icon and an on-canvas appearance with no emoji to fall back
on for either. Two independently hand-maintained drawings (one SVG path
data, one Canvas2D call sequence) would drift apart the first time either is
tweaked, with nothing to catch it. A single shared shape-data module is the
simplest way to keep them in visual lockstep without introducing a
rendering framework (constitution Principle III) — it's plain data, read by
two small, already-existing rendering surfaces.

**Alternatives considered**: Rendering the toolbar icon itself onto an
offscreen canvas and reusing that bitmap for both — rejected, this would
require a new asset-generation step and canvas-to-DOM plumbing for a control
button, more complex than the toolbar's existing plain-SVG-in-DOM pattern for
no benefit. Letting the two drawings differ slightly (toolbar icon flat,
canvas icon simplified for small footprint sizes) — rejected as unnecessary:
`OBJECT_FOOTPRINT_SIZE` (24px grid cells, rendered larger on-screen depending
on `cellSize`) is comparable in scale to the toolbar control's `1em` icon, so
one shape definition serves both without a legibility problem.

## §7 House and person need no new module

**Decision**: `house`/`person` are added to `ObjectKind`/`OBJECT_KINDS`
exactly like `palm`/`flamingo` — an `OBJECT_GLYPHS` entry (`🏠`, `🧑`) in
`PlayArea.svelte`, a `TOOLBAR_CONTROLS` entry, a `glyphFor`/`handleClick`/
`isSelected` case in `Toolbar.svelte`. Both hit the existing generic
`drawObjectGlyph` branch (`ctx.fillText(OBJECT_GLYPHS[obj.kind], cx, cy)`,
`PlayArea.svelte:343-346`) unchanged — neither needs the sway/bob/hop
animation branches `palm`/`flamingo` have, since FR-004 requires them to be
purely static.

**Rationale**: FR-004/FR-006 ask for exactly this — decorative, unanimated,
using a glyph with universal coverage on both maintainers' platforms. No new
research needed; this is the direct reuse case the spec's Assumptions
section names ("this feature adds kinds to an existing mechanism rather than
a parallel one").

## §8 Stars are a render-only, capped, allocation-free ambient system — modeled on `sparkle.ts`

**Decision**: A new module, `src/lib/stars.ts`, owns ambient twinkle state
entirely outside `Grid`/`WorldState`:

```ts
export const STAR_CAP = 16;
export const STAR_SKY_FRACTION = 1 / 3; // top third of the grid counts as "sky"

interface StarField { /* fixed-size typed arrays: x, y, phaseOffset — no per-frame allocation */ }

export function createStarField(): StarField;
export function updateStarField(grid: Grid, field: StarField, now: number): void; // reservoir-resamples eligible empty-sky cells into field's slots on a slow interval, not every frame
export function drawStarField(ctx: CanvasRenderingContext2D, field: StarField, now: number): void; // fillText('⭐'/a small glyph) at each slot's fade-phase alpha
```

An "eligible" cell is `elements[i] === EMPTY` at a `y < grid.height *
STAR_SKY_FRACTION` — never `OBJECT`, never any material. `updateStarField`
reservoir-samples eligible cells the same way `updateFlashMask` already does
(`sparkle.ts:15-34`: single pass, `Math.random()`-gated replacement, no
allocation after the module's fixed-size arrays are created once), so adding
a star never costs more than a fixed, small amount of per-frame work
(FR-023). `PlayArea.svelte`'s `frame()` calls `updateStarField` (throttled —
research §8a) and `render()` calls `drawStarField` after the particle loop;
neither touches `grid`, `WorldState`, `objectsState`, `history`, or the save
codec.

**Rationale**: FR-021 requires stars to never be saved, undone, erased, or
cleared — the only way to guarantee that structurally (rather than by
remembering to exclude a field from every serializer) is to keep their state
entirely outside every structure those subsystems read (`WorldState`,
`SavedWorld`, `ObjectsState`). `particles.ts` and `sparkle.ts` are exactly
this pattern already: fixed-cap, render-only, module-owned state that
`captureWorldState`/`serializeWorld`/`clearObjects` never look at. FR-020's
"empty sky, never covers material" is the same eligibility test
`updateFlashMask` already applies for a different purpose (glittered,
non-empty, non-object cells) — flipping the polarity (empty, non-object)
gives the star eligibility rule for free.

**Alternatives considered**: Storing star state as new `Grid` typed arrays
(`grid.starPhase`, etc.) — rejected outright by FR-021: anything living on
`Grid` gets swept into `resizeGrid`/`remapWorldState`/`captureWorldState`
without an explicit exclusion, and forgetting that exclusion is exactly the
`usesHueColor`-shaped mistake this spec is careful to avoid elsewhere (§2).
A time-seeded pure function with no persistent state at all (recomputing
"which cells twinkle now" from `now` alone every frame) — rejected because it
can't express "this star is fading in/out over N frames" without a stored
phase per star, and would have to rescan the whole grid every frame for
eligibility rather than only on a resample interval.

### §8a Update cadence

**Decision**: `updateStarField` resamples eligible cells only every
`STAR_RESAMPLE_MS` (e.g. 400ms), not every animation frame; between
resamples the existing slots simply advance their fade phase. `drawStarField`
runs every frame (cheap: `STAR_CAP` `fillText` calls, same order of cost as
the existing particle-drawing loop).

**Rationale**: A full-grid eligibility scan every animation frame would cost
more than `updateFlashMask`'s equivalent scan (which already runs every
frame at similar grid sizes, so this alone would not blow the frame budget),
but there is no reason to reshuffle *which* cells twinkle 60 times a second —
a lazier resample keeps the same reservoir-sampling cost model while making
the fade-in/out visually readable (a star that changed location every
16ms would never look like it's fading, just static). Twinkle *animation*
(the fade) still updates every frame from each slot's stored phase.

## §9 Toolbar manifest: three new `'objects'`-group entries (FR-031, FR-032)

**Decision**: `TOOLBAR_CONTROLS` gains `tool-house`, `tool-person`,
`tool-chest` (group `'objects'`, ariaLabels "House", "Person", "Treasure
chest"), placed alongside the existing five object controls. This raises
`shippedToolbarControls(false, false).length` from 23 to 26 and
`shippedToolbarControls(true, true).length` from 25 to 28 — exactly FR-031's
stated counts, confirmed against the manifest read during research rather
than asserted as a new literal (`toolbarControls.ts` currently declares 6
elements + 5 objects + 4 actions + 2 history + 3 scenes + 3 sizes = 23
unconditional entries, matching FR-031's "23" exactly).

**Rationale**: FR-032 requires the new controls to be declared in the same
single source of truth the toolbar renders from and the automated check
reads — `toolbarControls.ts` already *is* that source (spec 012's FR-013),
so adding three entries there is the whole mechanism; no parallel constant
exists to update.

## §10 Dropping the 320×568 guaranteed-viewport row (FR-031a, FR-031b)

**Decision**: `tests/unit/lib/layout.test.ts`'s `VIEWPORT_TABLE` drops the
`{ label: 'small phone', width: 320, height: 568 }` row entirely, and the
`KNOWN_INFEASIBLE = new Set(['small phone:25'])` special-case (and its
dedicated "cannot clear both floors" test block, `layout.test.ts:216-235`)
is deleted rather than extended to `'small phone:26'`/`'small phone:28'`. A
comment at the `VIEWPORT_TABLE` declaration records why (FR-031a's reasoning
— no device either maintainer verifies on is smaller than 375×667). Every
other row must keep passing at the real 26/28 counts with no other
concession (FR-031b) — `computeToolbarLayout`/`toolbarThickness`/
`clearsAreaFillFloor` in `src/lib/layout.ts` need **no** code change, since
that whole apparatus already reports `fits` per-row from `controlCount`
directly; only the test's own table and known-infeasible bookkeeping change.

**Rationale**: This is FR-031a/b verbatim, and confirms (research: reading
`layout.ts`'s `computeToolbarLayout`/`toolbarThickness` in full) that the
sizing *rule* is control-count-agnostic — it was already built to react to
"however many controls exist," which is precisely what lets this feature
satisfy FR-032/SC-012 by changing only the manifest and the table, never the
rule itself.

**Alternatives considered**: Keeping the row and asserting `fits: false`
there (documenting it as a second known-infeasible case) — rejected by
FR-031a's explicit instruction to drop the row, not to accumulate a growing
infeasible-set; retaining a guarantee CI already knows is false for no real
device serves no one.

## §11 Backward-compatible restore: treat a missing kind list as empty (FR-028)

**Decision**: In both `src/sim/save.ts` (`deserializeWorld`, ~line 231-233)
and `src/sim/historySave.ts` (`deserializeHistory`'s per-step loop, ~line
195-196), the per-kind loop changes from:

```ts
const list = rawByKind[kind];
if (!Array.isArray(list)) return null;
```

to:

```ts
const list = rawByKind[kind];
const rawList = Array.isArray(list) ? list : [];
```

(with `rawList` used in place of `list` for the subsequent per-item
validation loop, which is otherwise unchanged — a *present but malformed*
list, or a list containing a malformed item, still rejects the whole payload
exactly as today; only a *missing* key is now tolerated). The same edit
lands twice (world save, persisted history) since both wire formats have the
identical `byKind: Record<string, WireObject[]>` shape and the identical
existing defect (research: Explore report §5).

**Rationale**: FR-028 states the exact failure mode this fixes — a
pre-upgrade save has no `"house"`/`"person"`/`"chest"` key at all, so
`rawByKind[kind]` is `undefined` and today's `Array.isArray(undefined) ===
false` rejects the *entire* payload, discarding a pre-upgrade world (and
separately, a pre-upgrade undo history) on first launch after this feature
ships. Treating "key absent" as "empty list of that kind" is the minimal
change that fixes exactly this without loosening any other validation (a
present-but-corrupt list is still rejected, preserving every other existing
guarantee `tests/unit/sim/save.test.ts`'s "never throws on garbage input"
suite already covers).

**Alternatives considered**: Defaulting the whole `byKind` object to `{}`
when absent, then looping — equivalent in effect but discovered later in the
existing code structure; the per-kind `rawList` default above is the
smaller, more local diff. Migrating old saves by writing a fresh
`"house": []` key on next save (rather than tolerating absence on read) —
unnecessary complexity; every future kind added by a later feature would
need the same read-side tolerance regardless, so fixing it on read is the
one change that also covers *this* feature's own future.

## §12 Everything else is free once `OBJECT_KINDS` is extended

**Decision**: No changes are needed to `eraseObjectsInBrush`/
`eraseObjectsInBrushLine`/`clearObjects`/`isCoveredByAnyObject`
(`objects.ts`), `remapWorldState`/`captureWorldState`/`restoreWorldState`
(`history.ts`), `resizeGrid` (`resize.ts`), or `repositionObjects`
(`PlayArea.svelte`) beyond `ObjectKind`'s type union and the `OBJECT_KINDS`
array/`createObjectsState()`'s `byKind` seed gaining `'house' | 'person' |
'chest'` — every one of those functions already iterates `OBJECT_KINDS`
generically (research: Explore report §2, §4, §6, confirmed by direct
reads of `history.ts:32-38`, `resize.ts`, `PlayArea.svelte:252-271`).
Diamonds need no `Grid`/`WorldState` shape change either — they are read and
written through the exact same `elements`/`shades`/`glitter` arrays every
other powder already uses.

**Rationale**: This is the direct payoff of FR-030's "existing behaviour
must not regress" and the spec's Assumption that "this feature adds kinds to
an existing mechanism rather than a parallel one" — confirming it in
research now (rather than discovering it mid-implementation) is what lets
`tasks.md` scope the *actual* touch points precisely instead of over-broadly
re-touching every subsystem defensively.

## §13 Performance headroom (FR-012)

**Decision**: No new performance work is needed beyond what §3's reused loop
shape already implies. `applyChestConversions`'s ring scan over a 24×24
footprint's one-cell border is ~104 cells; with the cap of 3 chests
(FR-003) that's ~312 cell reads per frame, the same order of magnitude as
the existing `applyRainbowConversions` call already running today at up to 3
rainbows with no measured frame-budget issue.

**Rationale**: Restates FR-012/SC-009 and confirms no new research or
benchmarking is required — the mechanism is a straight structural copy of
one already shipped and performing within budget (constitution Principle
IV).
