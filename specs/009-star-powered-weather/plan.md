# Implementation Plan: Star-Powered Weather

**Branch**: `spec/009-star-powered-weather` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-star-powered-weather/spec.md`

## Summary

Add fog/cloud as one new, transient element (`FOG = 8`, `src/sim/types.ts`)
representing both rising sparkle-mist and the gathered cloud it becomes,
distinguished by a single new `cloud: Uint8Array` sub-state flag rather
than a second element value — the same "one element, one flag" shape spec
008 already used for star power's fuelled/unfuelled distinction. Fog is the
lightest thing on the field: `stepPowder`/`stepLiquid` gain one fall-through
condition each so a grain or water cell directly above fog/cloud swaps
through it exactly as it already swaps through a liquid, and `isSolid`
needs **zero** change (fog was never solid to begin with). The whole cycle
is one new dispatch branch in `step()`, `stepFog`, which — for a rising fog
cell — every step: (1) ages it and forces condensation back to water past
1,800 steps regardless of circumstance (FR-016's "in any case"); (2) ticks
a 3–5-step rise cooldown, counting cooldown-waiting steps toward a 300-step
stuck-and-condense limit (FR-016); (3) once the cooldown elapses, checks
whether the cell directly above is the sky ceiling or an existing cloud —
if so, the cell joins the sky as cloud (FR-017), checked *before* any
sideways movement so clouds only ever form against the sky, exactly as the
spec's own resolved clarification requires; (4) otherwise rolls a
uniformly-random preferred horizontal offset in `{-1, 0, +1}` and tries it,
then straight up, then the remaining diagonal (with the two-diagonal
fallback order itself randomized when the roll was `0`), moving into the
first legal target — straight-up may be `EMPTY` or `WATER` (a bubble-
through swap, FR-014), diagonal must be `EMPTY` (FR-013) — so a plume
visibly wobbles even in open sky, never marches in a rigid column, and has
zero net horizontal drift over a long run. A cloud cell (`cloud[i] === 1`)
never moves; `stepCloud` only ticks a per-cell rain-delay timer (drawn once
at formation, `[180, 480]` steps) and, once it elapses, turns the cell into
exactly one ordinary water cell (FR-020/FR-021) — independently per cell,
so a cloud patters raggedly rather than dumping at once, with no extra
randomization needed beyond each cell's own timer. Charming — water turning
into fog — has exactly two triggers, both funnelled through one new
`grid.ts` chokepoint, `createFog(grid, x, y): boolean`, which itself
enforces the FR-011 sky limit (fog+cloud must stay under 20% of the field)
so no caller can ever accidentally create fog past it: the ⭐ brush's new
branch over `WATER`, and `stepStarPower`'s existing water-quench check
(extended to remember *which* neighbor was water, mirroring `stepGrass`'s
own pattern) calling `createFog` only when the quenched cell is
**unfuelled** — a fuelled star power cell (the burn front) still leaves the
water completely untouched, unchanged from spec 008, preserving its
one-drop-firebreak guarantee exactly as this spec's FR-007 requires.
Fog/cloud's twinkle reuses the existing `glitter`/shimmer/`FLASH_CAP = 24`
pipeline with zero new render mechanism, exactly as spec 008 already did
for star power's own twinkle. This feature adds **no toolbar control**
(FR-027) — the one place it is structurally simpler than spec 008: no
change to `Toolbar.svelte`, `layout.ts`, or `layout.test.ts`'s control
count. `moveCell`/`swapCells` (`step.ts`) are extended to carry five new
per-cell fields so a rising/bubbling fog cell's cooldown/stuck/age state
travels with it; the eraser, rainbow conversion (one added element check
plus a one-line counter decrement), unicorn touch, resize, and scene
loading each need only the small, targeted extension research.md details —
no new architecture, no new build tooling, no new runtime dependency.

## Technical Context

**Language/Version**: TypeScript 5.x, Node 22 (matches
`.github/workflows/deploy-pages.yml`) — unchanged from 001–008.

**Primary Dependencies**: `svelte` 5, `vite`, `@sveltejs/vite-plugin-svelte`,
`vite-plugin-singlefile`, `vitest`, `typescript` — unchanged; no new
runtime dependency (research.md §19). No new browser API is needed either
— fog and cloud are built entirely from existing `Grid`/`Uint8Array`/
`Uint16Array`/`canvas` mechanisms 001–008 already established, including
reusing the existing glitter/shimmer/flash-cap rendering pipeline verbatim
for their twinkle (research.md §8).

**Storage**: N/A — unchanged; nothing new is persisted (spec's own
Assumptions section: "no sound, no persistence, no new settings").

**Testing**: `vitest`, adding `tests/unit/sim/weather.test.ts` (new — the
bulk of FR-042's fog/cloud-specific coverage: charming by the ⭐ brush and
by an unfuelled star-power quench, one fog cell per water cell charmed, in
place; fuelled quenching leaving water untouched and a one-cell water
stripe still stopping a burn with 0 far-side cells catching; fog appearing
by no other means; the sky limit refusing further charming with no other
effect; the rise rate and sideways-wander bounds including zero net bias;
fog bubbling up through water with the water closing behind it; fog
blocked by grass/powders/objects/walls without moving them; stuck and
long-lived fog condensing to exactly one water cell; fog becoming cloud
only at the sky ceiling or under an existing cloud; cloud never moving and
clouds growing downward; every cloud cell raining within its bounds into
exactly one water cell, staggered rather than simultaneous; rain behaving
identically to poured water including grass drinking it and it quenching
star power; conservation across a full cycle with the water+fog+cloud
total never increasing; settling to 0/0 within 45 seconds from adversarial
starting states; no self-sustaining feedback; a field with no fog/cloud
producing byte-identical `step()` behavior to spec 008's own toy — research.
md §18) and small, targeted additions to `tests/unit/sim/grid.test.ts`
(`createFog`'s bookkeeping and ceiling-refusal, `setCell`'s reset rule,
`clearGrid`'s new fills), `tests/unit/sim/brush.test.ts` (the new `star`-on-
`WATER` branch, every brush treating fog/cloud as empty), `tests/unit/sim/
wand.test.ts` (the new skip), `tests/unit/sim/objects.test.ts` (rainbow
conversion of fog/cloud, unicorn touched by fog/cloud), `tests/unit/sim/
resize.test.ts` (fog/cloud carried across a re-derivation), `tests/unit/
sim/scenes.test.ts` (zero fog/cloud in any generated scene), and
`tests/unit/sim/starPower.test.ts` (one existing assertion narrowed to
match this spec's own superseding of spec 008's FR-017/SC-009 for the
unfuelled case only — research.md §18). `tests/unit/lib/layout.test.ts`,
`tests/unit/sim/grass.test.ts`, and `tests/unit/sim/step.test.ts` need
**no** change (research.md §16, §18). All plain, DOM-free TypeScript
against `Grid`/pure-function state (constitution Principle V, FR-042) — no
browser-automation infra is added. The genuinely DOM-only parts of this
feature (fog/cloud's on-screen legibility as magic sparkle-mist rather
than smoke, a plume's watchable wobble, bubbles reading as bubbles, the
cloud's several-second build-up being worth watching, rain's ragged
patter, the whole lake-to-mist-to-cloud-to-rain-to-lake loop staying
watchable and non-boring, Fire-7-tablet smoothness during a full sky with
rain falling) are the maintainer's on-device job per quickstart.md,
matching constitution Principle V's existing precedent.

**Target Platform**: Static single-file page opened via `file://` or
served from GitHub Pages; evergreen browsers on a mid-range laptop
(mouse/trackpad), a tablet, a mid-range phone (spec 006), and a low-end
tablet of the Amazon Fire 7 Kids class (spec 007/008's own binding
performance constraint, carried forward unchanged and now exercised
against this feature's own worst case — fog and cloud at the FR-011
ceiling, rain falling, a full lake below, grass drinking, and a lawn
burning, all at once, FR-037, SC-020).

**Project Type**: Single-page client-only web app — no backend/API.
Unchanged.

**Performance Goals**: Steady 60fps target, 30fps floor (constitution
Principle IV, FR-037), now required specifically in the combined worst
case named above. `stepFog`/`stepCloud`/`createFog` are each `O(1)` per
cell per step (a fixed handful of neighbor reads, no unbounded scan) and
allocate nothing (research.md §5, §6, §9) — no object/array literals, only
primitive index arithmetic — so fog/cloud's rules add no asymptotic cost
to the existing `O(cell count)` hot loop; `CELL_BUDGET = 43,200` (spec
006, unchanged) continues to bound the worst case regardless of how much
of the field is weather (FR-039). SC-021 requires the measured per-step
cost of a full sky with rain falling to stay within 20% of an equally-full
field of falling sand — a direct consequence of `stepFog`/`stepCloud` being
no more expensive per cell than `stepPowder`/`stepStarPower`, not a
separate optimization. `moveCell`/`swapCells` (used by every mover, not
just fog) each gain five extra field copies (research.md §9) — a small,
deliberately-accepted constant-factor cost shared by every existing mover,
still `O(1)` per call and asymptotically invisible against `CELL_BUDGET`.

**Constraints**: The per-frame simulation/effect/render path must stay
allocation-free (constitution Principle IV) — `stepFog`/`stepCloud`/
`becomeCloud`/`condenseFog`/`rain`/`createFog` are all written with plain
index arithmetic and no `{x, y}` object literals or neighbor arrays,
exactly matching `stepStarPower`'s own discipline (research.md §5, §6).
Fog and cloud's twinkle is required to add zero new allocation and zero
new sparkle-flash-cap headroom (FR-038) — satisfied by construction, since
it reuses the exact existing `glitter`/`FLASH_CAP = 24` mechanism rather
than adding a second one (research.md §8). Production build still emits
exactly one output file with zero runtime network requests (FR-041,
unchanged from every prior feature). Cloud must never move under any rule
(FR-018) — enforced by construction: `stepCloud` never calls `moveCell`/
`swapCells`. The FR-011 sky limit (20% of the field) must be impossible to
bypass — enforced by construction: `createFog` is the *only* function that
can write a fresh `FOG` cell (FR-009), and it checks the limit internally
before doing so (research.md §2), rather than trusting each of its two
callers to check first. This feature adds no toolbar control (FR-027) —
enforced by leaving `Toolbar.svelte`/`layout.ts` untouched.

**Scale/Scope**: One feature, four prioritized user stories (making
sparkle-mist off the lake; clouds gathering at the top; rain falling back
down; it always settles and belongs with everything else). Adds one new
file (`tests/unit/sim/weather.test.ts`); extends `Grid`'s shape (five new
typed arrays plus one new running-total number, no field removed) without
breaking any existing consumer's signature; extends `setCell`/`clearGrid`
(`grid.ts`, plus one new exported function, `createFog`, and one new
exported constant, `FOG_FIELD_SHARE_CEILING`), `step`'s dispatcher plus
five new private helpers and one extended existing private function
(`stepStarPower`) plus two extended generic helpers (`moveCell`/
`swapCells`) and two extended fall-through conditions
(`stepPowder`/`stepLiquid`) (`step.ts`), `paintCell` (`brush.ts`,
one new branch plus a substituted condition across five existing ones),
`applyWandCell` (`wand.ts`, one more value in an existing skip),
`applyRainbowConversions` (`objects.ts`, one more element check plus one
counter decrement), `resizeGrid`'s copy loop (`resize.ts`), `colorFor`
(`PlayArea.svelte`, one new parameter and branch, two new shade ramps),
and two new small exported helpers to `shade.ts`
(`randomFogRiseCooldown`, `randomCloudRainDelay`). No change to
`element.ts` (`isSolid` already correctly excludes `FOG` by omission —
research.md §1), `scenes.ts`, `sparkle.ts`, `particles.ts`, `layout.ts`,
`Toolbar.svelte`, `App.svelte`, `main.ts`, or `index.html`. No new
top-level architecture, no new build tooling.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. One Self-Contained Page | No new build step, asset, font, or runtime dependency; every new/changed file lives in `src/sim/*`/`src/lib/*`, already bundled into `dist/index.html` by `vite-plugin-singlefile` (FR-041). | PASS |
| II. Built For An Almost-5-Year-Old | No new control, message, confirmation, score, or failure state anywhere (FR-027, FR-036, SC-019, SC-024) — the whole cycle is emergent from the ⭐ and 💧 tools already on screen, silent and undoable by erasing, clearing, or waiting for the rain. Mouse and touch both remain fully supported via the existing generic brush machinery, unchanged. Fog is themed explicitly as pretty sparkle-mist (pale pearly/lavender, twinkling), never as smoke or anything alarming (FR-002); cloud reads as soft and fluffy, obviously the same family but thicker (FR-003). The loop is deliberately bounded and self-limiting (FR-011, FR-016, FR-020, FR-024) so nothing the child does can "break" the toy or leave it stuck. | PASS |
| III. Simple, Dependency-Light Svelte | No new dependency (research.md §19). Fog/cloud's simulation rules stay in the framework-free `src/sim/*` core, isolated from Svelte exactly like every existing element rule — `stepFog`/`stepCloud` live beside `stepPowder`/`stepLiquid`/`stepGrass`/`stepStarPower` in `step.ts` rather than inventing a parallel per-element architecture (research.md §5, §6, §18). Fog and cloud are represented as one element with a sub-state flag rather than two element constants, deliberately minimizing how many places need to special-case them (research.md §1) — the same reuse-over-invention posture spec 008 already established for its own fuelled/unfuelled distinction. This feature adds exactly one new element type, as the constitution's "new element types require a spec" product constraint requires and this document satisfies. | PASS |
| IV. Performance Is A Feature | The explicit new worst case — fog and cloud at the FR-011 ceiling, rain falling, a full lake below, grass drinking, and a lawn burning, all at once, on a Fire-7-class tablet — is exactly SC-020/SC-021's own named target. `stepFog`, `stepCloud`, `createFog`, and the extended `moveCell`/`swapCells` are deliberately allocation-free (research.md §5, §6, §9), keeping the hot loop's existing no-allocation discipline intact; fog/cloud's rules add `O(1)` work per fog/cloud cell to a loop that was already `O(cell count)`, and `CELL_BUDGET` (unchanged) continues to bound the worst case (SC-021). Twinkle reuses the existing `FLASH_CAP = 24` reservoir rather than adding a second cap or a second per-frame shimmer computation (FR-038, research.md §8). | PASS |
| V. Verifiable Without A Browser Harness | `npm run build` still emits a single `dist/index.html`; `tests/unit/sim/weather.test.ts` plus the small additions to six other existing test files cover every rule FR-042 lists — charming from both sources, rise/wander bounds and bias, bubbling, blocking, condensation, gathering, cloud immobility, staggered raining, rain-is-ordinary-water, conservation, settling, no feedback, brush/eraser/wand/rainbow/unicorn/resize/scene interaction, and byte-identical behavior with no fog/cloud on the field — directly against pure `Grid` state, no DOM. The genuinely DOM-only behaviors (fog's legibility as magic sparkle-mist, a plume's watchable wobble, bubbles reading as bubbles, the cloud's build-up being worth watching, rain's ragged patter, the whole loop staying watchable, Fire-7 smoothness under the combined worst case) are the maintainer's on-device job, per quickstart.md's explicit manual-check list — matching this principle's existing precedent from every prior feature's own visual-checks section. No browser-automation infra is added. | PASS |

No violations — Complexity Tracking is not needed. The most consequential
design decision — representing fog and cloud as one element with a
`cloud` sub-state flag rather than two element constants (research.md §1)
— is not a constitution trade-off; it is the more literal reading of
FR-001's own "MAY be one new lightweight element in two states... either
way the element set grows by at most one entry," taken together with the
codebase's existing fuelled/unfuelled precedent, and it is what keeps
every generic consumer (brush, wand, rainbow conversion, unicorn touch,
resize) needing only a single `element === FOG` check instead of two, in
direct service of both Principle III (simplicity, reuse over invention)
and Principle IV (fewer branches in the hot per-cell dispatch).

## Project Structure

### Documentation (this feature)

```text
specs/009-star-powered-weather/
├── plan.md                          # This file (/speckit-plan command output)
├── research.md                      # Phase 0 output
├── data-model.md                    # Phase 1 output
├── quickstart.md                    # Phase 1 output
├── contracts/
│   └── weather-mechanics.md         # Phase 1 output
└── tasks.md                         # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

This feature extends the scaffold established by `001-falling-pink-sand`
through `008-star-power-burns-grass` (not greenfield — `package.json`,
`src/sim/*`, `src/lib/*`, `tests/unit/*` already exist, including `008`'s
landed star-power rules). Files marked **(new)** are added by this feature;
files marked **(modified)** have their contents changed but keep their
existing responsibility; everything else is unchanged.

```text
index.html                  # unchanged
package.json                 # unchanged — no new dependency
tsconfig.json / vite.config.ts / vitest.config.ts   # unchanged

src/
├── main.ts                 # unchanged
├── App.svelte              # unchanged
├── lib/
│   ├── PlayArea.svelte     # (modified) FOG import; FOG_RAMP/CLOUD_RAMP constants; colorFor gains an isCloud parameter and a FOG branch; render()'s loop destructures `cloud` and passes it through — otherwise unchanged (twinkle comes free from the existing glitter-shimmer path, research.md §8)
│   ├── Toolbar.svelte      # unchanged — no new control (FR-027)
│   ├── layout.ts           # unchanged — GRID_WIDTH/GRID_HEIGHT/CELL_BUDGET/BRUSH_RADII/OBJECT_FOOTPRINT_SIZE/MIN_TOUCH_TARGET/computePlayField/computeToolbarLayout all unchanged
│   ├── particles.ts        # unchanged
│   └── sparkle.ts          # unchanged — FLASH_CAP/updateFlashMask reused verbatim, no change needed
└── sim/                    # framework-free, hot-path core (constitution III)
    ├── types.ts             # (modified) FOG = 8 added to Element; Grid gains cloud/fogRiseCooldown/fogStuckSteps/fogAge/cloudRainDelay/fogCloudCount — Tool unchanged (FR-027)
    ├── element.ts            # unchanged — isSolid already excludes FOG by omission (research.md §1)
    ├── shade.ts               # (modified) gains randomFogRiseCooldown() and randomCloudRainDelay() — randomShade/randomBurnLife/randomHue unchanged
    ├── grid.ts               # (modified) createGrid allocates the five new arrays and fogCloudCount; setCell maintains fogCloudCount and resets fog bookkeeping; clearGrid resets the new arrays/counter; new exported createFog(grid, x, y) and FOG_FIELD_SHARE_CEILING
    ├── step.ts               # (modified) step's dispatcher gains a FOG branch calling new private stepFog/stepCloud/becomeCloud/condenseFog/rain; moveCell/swapCells extended to carry the five new fields; stepPowder/stepLiquid gain one fall-through condition each; stepStarPower extended to remember the quenching water index and call createFog for the unfuelled case — extinguishStarPower itself unchanged
    ├── brush.ts               # (modified) paintCell's paintable check extended to include FOG; one new 'star'-on-WATER branch calling createFog — eraser branch unchanged
    ├── objects.ts             # (modified) applyRainbowConversions gains a FOG check plus a fogCloudCount decrement — isUnicornTouched, placement/removal/touch-detection logic otherwise unchanged
    ├── scenes.ts               # unchanged — no scene ever creates fog or cloud
    ├── wand.ts                 # (modified) applyWandCell's existing skip gains `|| element === FOG`
    └── resize.ts               # (modified) resizeGrid's copy loop also carries cloud/fogRiseCooldown/fogStuckSteps/fogAge/cloudRainDelay and accumulates fogCloudCount for carried FOG cells

tests/
└── unit/
    ├── lib/
    │   └── layout.test.ts    # unchanged — no new toolbar control (FR-027)
    └── sim/
        ├── grid.test.ts       # (modified) small additions — createFog's bookkeeping/ceiling-refusal, setCell's reset rule, clearGrid's new fills
        ├── element.test.ts    # does not exist, unchanged (precedent: specs 007/008)
        ├── step.test.ts       # unchanged — fog/cloud coverage lives in weather.test.ts instead (research.md §18)
        ├── grass.test.ts      # unchanged — rain-drinking is grass drinking ordinary water; no grass-only assertion becomes obsolete
        ├── starPower.test.ts  # (modified) one existing assertion narrowed: unfuelled quench now also charms the water; fuelled quench still leaves it untouched (research.md §18)
        ├── weather.test.ts    # (new) the bulk of FR-042's fog/cloud-specific coverage
        ├── brush.test.ts      # (modified) small additions — the star-on-water branch; every brush treating fog/cloud as empty
        ├── objects.test.ts    # (modified) small additions — rainbow conversion of fog/cloud; isUnicornTouched with a FOG cell present
        ├── scenes.test.ts     # (modified) small addition — zero fog/cloud cells in any loaded scene
        ├── wand.test.ts       # (modified) one addition — the wand leaves fog/cloud untouched
        └── resize.test.ts     # (modified) small addition — fog and cloud survive a re-derivation
```

**Structure Decision**: Same single client-only project 001–008
established — no `backend/`/`frontend/` split, `src/sim/*` stays isolated
from Svelte for zero-DOM `vitest` coverage (constitution Principle V).
This feature adds exactly one new file anywhere in the repo
(`tests/unit/sim/weather.test.ts`) and otherwise extends existing modules
in place — no existing exported function's signature is removed or
incompatibly changed (`colorFor` gains one new parameter but every
existing call site already passes all of `colorFor`'s arguments
positionally from `render()`'s own single call site, so this is not a
breaking change to any external consumer), no existing test file's
assertions need to change beyond the one explicitly called out above
(`starPower.test.ts`'s narrowed quench assertion), which is what keeps
every other 001–008 test passing unchanged (FR-040, SC-023). Fog/cloud's
simulation logic is deliberately kept inside `step.ts` alongside
`stepPowder`/`stepLiquid`/`stepGrass`/`stepStarPower` rather than factored
into a new `src/sim/weather.ts` module, matching the existing architecture
where every per-cell movement/interaction rule for every element lives in
one file dispatched by element type (research.md §5, §6, §18) — its test
coverage nonetheless gets its own file (`weather.test.ts`) purely for
organization, mirroring `starPower.test.ts`'s own precedent, since
FR-042's fog/cloud rule list is large enough to warrant a dedicated home
without cluttering `step.test.ts`'s existing powder/water tests. Unlike
spec 008, this feature touches `Toolbar.svelte`/`layout.ts`/
`layout.test.ts` **not at all** — the one place its scope is structurally
smaller than star power's own, a direct consequence of FR-027's explicit
"no new toolbar control."

## Complexity Tracking

*No entries — Constitution Check reported no violations.*
