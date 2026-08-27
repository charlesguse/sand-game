# Implementation Plan: Water-Drinking Grass

**Branch**: `spec/007-water-drinking-grass` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-water-drinking-grass/spec.md`

## Summary

Add grass as a new, static element (`GRASS = 6`, `src/sim/types.ts`) that
drinks adjacent water and grows a bounded lawn, while staying entirely
inside the existing single-pass simulation architecture. `stepPowder`/
`stepLiquid` need **zero** code change to treat grass as solid ground —
grass is simply neither `EMPTY`, a powder, nor a liquid, so the two
existing functions already fall through to "rest against it"/"flow around
it" by construction (research.md §1). The only new per-cell simulation
logic is one more dispatch branch in `step()`, `stepGrass`, which combines
absorption and growth into one atomic, allocation-free, same-step
operation: a grass cell whose 10-step cooldown has elapsed and that has an
adjacent water cell only ever absorbs it if `pickGrowthTargetIndex`
(implementing FR-010's above/diagonal/sideways preference order) already
finds a valid, under-ceiling target — this single check is simultaneously
FR-008's "cannot grow ⇒ must not absorb" rule, so there is never a moment
where "absorbed capacity" sits unspent (research.md §2, §5). Two new
per-cell `Uint8Array`s (`grassHeight`, `grassCooldown`) plus one running
`grassCount` number are added to `Grid`, all maintained centrally inside
`grid.ts`'s existing `setCell`/`clearGrid` chokepoints — the single place
every grass-creating call site (brush, scene generation, growth itself)
already funnels through — so height/count bookkeeping cannot drift between
call sites (research.md §3). The grass brush is one new branch in
`brush.ts`'s `paintCell` (deposit into `EMPTY`/`WATER`, matching `sand`/
`dirt`'s existing pattern); the eraser and the sparkle wand need **zero**
change, since both already operate generically on "any non-`EMPTY`[,
non-`OBJECT`]" cell (research.md §6). Rendering adds one `GREEN_RAMP` and
one `colorFor` branch in `PlayArea.svelte`, mirroring the existing pink/
blue/purple ramps exactly (research.md §8). The toolbar gains one 🌱
button in the existing elements group (research.md §7). `scenes.ts`'s
`generateLandscape1` gains two additive, deterministic, `Math.random()`-
free grass-placement passes — a decorative hill-cap layer that never
touches water, and a small, explicitly water-adjacent shoreline seed sized
to keep landscape-1's on-load growth well under half the scene's lake
(research.md §9); `generateLandscape2` is untouched. No new runtime
dependency, no new top-level file beyond `tests/unit/sim/grass.test.ts`
(research.md §10, §11).

## Technical Context

**Language/Version**: TypeScript 5.x, Node 22 (matches
`.github/workflows/deploy-pages.yml`) — unchanged from 001–006.

**Primary Dependencies**: `svelte` 5, `vite`, `@sveltejs/vite-plugin-svelte`,
`vite-plugin-singlefile`, `vitest`, `typescript` — unchanged; no new
runtime dependency (research.md §11). No new browser API is needed either
— grass is built entirely from existing `Grid`/`Uint8Array`/`canvas`
mechanisms already established by 001–006.

**Storage**: N/A — unchanged; nothing new is persisted (spec's own
Assumptions section: "no sound, no persistence, no new settings").

**Testing**: `vitest`, adding `tests/unit/sim/grass.test.ts` (new — the
bulk of FR-035's grass-specific coverage: no movement including mid-air;
absorption + FR-009 pacing; no-absorption-when-blocked; FR-010's growth
target order; FR-011's height ceiling; FR-012's field-share ceiling;
FR-014's one-blade-per-water-cell bound; no growth/no change without
water — research.md §10) and small, targeted additions to
`tests/unit/sim/grid.test.ts` (setCell's grass bookkeeping),
`tests/unit/sim/brush.test.ts` (the new `grass` tool), `tests/unit/sim/
wand.test.ts` (grass glitters), `tests/unit/sim/resize.test.ts` (grass
survives a re-derivation), `tests/unit/sim/scenes.test.ts` (landscape-1's
grass presence/determinism/"half the lake survives," landscape-2's
continued zero grass — per spec.md's own Superseded requirements section),
and `tests/unit/lib/layout.test.ts` (`TOOLBAR_CONTROL_COUNT` 14 → 15). All
plain, DOM-free TypeScript against `Grid`/pure-function state (constitution
Principle V, FR-035) — no browser-automation infra is added. The genuinely
DOM-only parts of this feature (on-screen green legibility, growth reading
as "sprouting," the toolbar button's placement/feel, Fire-7-tablet
smoothness) are the maintainer's on-device job per quickstart.md, matching
constitution Principle V's existing precedent.

**Target Platform**: Static single-file page opened via `file://` or served
from GitHub Pages; evergreen browsers on a mid-range laptop (mouse/
trackpad), a tablet, a mid-range phone (spec 006), **and now explicitly a
low-end tablet of the Amazon Fire 7 Kids class**, named as this feature's
own binding performance constraint (FR-030, SC-014) — a stricter target
than any prior feature's, though built from the same allocation-free hot
loop 001–006 already established.

**Project Type**: Single-page client-only web app — no backend/API.
Unchanged.

**Performance Goals**: Steady 60fps target, 30fps floor (constitution
Principle IV, FR-030), now required specifically in the worst case of a
play field full of grass with actively flowing water, on the Fire-7-class
device (SC-014). `stepGrass` is `O(1)` per grass cell per step and
allocates nothing (research.md §5) — no object/array literals, only
primitive index arithmetic and an `if`/`else if` neighbor scan — so the
grass rules add no asymptotic cost to the existing `O(cell count)` hot
loop; `CELL_BUDGET = 43,200` (spec 006, unchanged) continues to bound the
worst case regardless of how much of the field is grass (FR-031). SC-015
requires the measured per-step cost of a full-grass field to stay within
20% of an equally-full sand field — a direct consequence of `stepGrass`
being no more expensive per cell than `stepPowder`, not a separate
optimization.

**Constraints**: The per-frame simulation/effect/render path must stay
allocation-free (constitution Principle IV) — `stepGrass`/
`pickGrowthTargetIndex`/`isEligibleTarget`/`isSupported`/
`computeWouldBeHeight` are all written with plain index arithmetic and no
`{x, y}` object literals or neighbor arrays specifically to preserve this
(research.md §4, §5) — the one place this feature could easily have
violated the constitution's own explicit "hot loop allocation-free" rule
if implemented naively. Production build still emits exactly one output
file with zero runtime network requests (FR-034, unchanged from every
prior feature). Grass growth must never leave the play field or move
downward (FR-013) — enforced by construction: `pickGrowthTargetIndex` only
ever considers `y - 1` or the same `y`, never `y + 1`, and every target is
bounds-checked before being returned.

**Scale/Scope**: One feature, four prioritized user stories (plant grass;
watering grows it; gentle and bounded; belongs with everything else). Adds
one new file (`tests/unit/sim/grass.test.ts`); extends `Grid`'s shape
(two new `Uint8Array`s, one new number field) and `Tool`'s value set (one
new string) without breaking any existing consumer's signature; extends
`setCell`/`clearGrid`/`createGrid` (`grid.ts`), `step`'s dispatcher plus
new private helpers (`step.ts`), `paintCell` (`brush.ts`),
`generateLandscape1` (`scenes.ts`), `resizeGrid`'s copy loop (`resize.ts`),
`colorFor` (`PlayArea.svelte`), and the elements button group
(`Toolbar.svelte`); adds one new `isSolid` helper (`element.ts`). No change
to `objects.ts`, `wand.ts`, `sparkle.ts`, `particles.ts`, `layout.ts`
(beyond the test-only `TOOLBAR_CONTROL_COUNT` constant, which lives in the
test file, not `layout.ts` itself), `App.svelte`, `main.ts`, or `index.html`.
No new top-level architecture, no new build tooling.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. One Self-Contained Page | No new build step, asset, font, or runtime dependency; every new/changed file lives in `src/sim/*`/`src/lib/*`, already bundled into `dist/index.html` by `vite-plugin-singlefile` (FR-034). | PASS |
| II. Built For An Almost-5-Year-Old | One new big, round, emoji-labeled (🌱) button, understandable without reading, grouped with the other element brushes (FR-018, FR-019); nothing about grass can fail, warn, show a message, or be "wrong" (FR-029, SC-018) — absorbing, growing, and every ceiling being reached all happen silently. Mouse and touch both remain fully supported via the existing generic brush machinery (FR-021). | PASS |
| III. Simple, Dependency-Light Svelte | No new dependency (research.md §11). Grass's simulation rules stay in the framework-free `src/sim/*` core, isolated from Svelte exactly like every existing element rule — `stepGrass` lives beside `stepPowder`/`stepLiquid` in `step.ts` rather than inventing a parallel per-element architecture (research.md §5, §10). The simplest possible rule that reuses existing generic machinery wherever the codebase already has it (eraser, wand, `render`'s per-cell loop) rather than adding grass-specific special cases to any of them (research.md §1, §6, §8). | PASS |
| IV. Performance Is A Feature | The explicit new worst case — a full garden with actively flowing water on a Fire-7-class tablet — is exactly SC-014/FR-030's own named target. `stepGrass` and its helpers are deliberately allocation-free (research.md §4, §5), keeping the hot loop's existing no-allocation discipline intact; the grass rules add `O(1)` work per grass cell to a loop that was already `O(cell count)`, and `CELL_BUDGET` (unchanged) continues to bound the worst case (SC-015). | PASS |
| V. Verifiable Without A Browser Harness | `npm run build` still emits a single `dist/index.html`; `tests/unit/sim/grass.test.ts` plus the small additions to five other existing test files cover every rule FR-035 lists — no movement (including mid-air), solidity, absorption pacing, the blocked-absorption rule, growth target order, both ceilings, the one-blade-per-water-cell bound, no-water/no-change, brush deposit rules, eraser/clear-all, wand glitter, re-derivation carry-over, scene-load clearing, and landscape-1's deterministic hill/lake/grass composition across sizes — directly against pure `Grid` state, no DOM. The genuinely DOM-only behaviors (on-screen green legibility, growth reading as "sprouting" rather than a block inflating, Fire-7 smoothness in a small hand) are the maintainer's on-device job, per quickstart.md's explicit manual-check list — matching this principle's existing precedent from every prior feature's own visual-checks section. No browser-automation infra is added. | PASS |

No violations — Complexity Tracking is not needed. The most consequential
design decision — collapsing "absorb water" and "grow one cell" into a
single atomic same-step operation rather than a persisted pending-capacity
flag — is not a constitution trade-off; it is the more literal, simpler
reading of the spec's own FR-007/FR-008/FR-010/FR-014 taken together
(research.md §2), and it is what keeps the hot loop allocation-free and
`O(1)` per cell, in direct service of Principle IV.

## Project Structure

### Documentation (this feature)

```text
specs/007-water-drinking-grass/
├── plan.md                          # This file (/speckit-plan command output)
├── research.md                      # Phase 0 output
├── data-model.md                    # Phase 1 output
├── quickstart.md                    # Phase 1 output
├── contracts/
│   └── grass-mechanics.md           # Phase 1 output
└── tasks.md                         # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

This feature extends the scaffold established by `001-falling-pink-sand`
through `006-phone-support` (not greenfield — `package.json`, `src/sim/*`,
`src/lib/*`, `tests/unit/*` already exist, including `006`'s landed
`resize.ts`/`layout.ts`'s `computePlayField`). Files marked **(new)** are
added by this feature; files marked **(modified)** have their contents
changed but keep their existing responsibility; everything else is
unchanged.

```text
index.html                  # unchanged
package.json                 # unchanged — no new dependency
tsconfig.json / vite.config.ts / vitest.config.ts   # unchanged

src/
├── main.ts                 # unchanged
├── App.svelte              # unchanged
├── lib/
│   ├── PlayArea.svelte     # (modified) GRASS import; GREEN_RAMP constant; colorFor gains a GRASS branch — render()'s loop itself unchanged
│   ├── Toolbar.svelte      # (modified) one new 🌱 button in .group.elements
│   ├── layout.ts           # unchanged — GRID_WIDTH/GRID_HEIGHT/CELL_BUDGET/BRUSH_RADII/OBJECT_FOOTPRINT_SIZE/MIN_TOUCH_TARGET/computePlayField/computeToolbarLayout all unchanged
│   ├── particles.ts        # unchanged
│   └── sparkle.ts          # unchanged
└── sim/                    # framework-free, hot-path core (constitution III)
    ├── types.ts             # (modified) GRASS = 6 added to Element; Grid gains grassHeight/grassCooldown/grassCount; Tool gains 'grass'
    ├── element.ts            # (modified) new isSolid(e) helper — isPowder/isLiquid unchanged
    ├── grid.ts               # (modified) createGrid allocates the two new arrays + grassCount; setCell maintains grassHeight/grassCooldown/grassCount; clearGrid resets them
    ├── step.ts               # (modified) step's dispatcher gains a GRASS branch calling new private stepGrass/pickGrowthTargetIndex/isEligibleTarget/isSupported/computeWouldBeHeight — stepPowder/stepLiquid unchanged
    ├── brush.ts               # (modified) paintCell gains a 'grass' tool branch — eraser branch unchanged
    ├── objects.ts             # unchanged
    ├── shade.ts               # unchanged
    ├── scenes.ts              # (modified) generateLandscape1 gains two additive grass-placement passes — generateLandscape2/loadScene/sceneRegions unchanged
    ├── wand.ts                # unchanged — already covers grass generically
    └── resize.ts              # (modified) resizeGrid's copy loop also carries grassHeight/grassCooldown and accumulates the new grid's grassCount

tests/
└── unit/
    ├── lib/
    │   └── layout.test.ts    # (modified) TOOLBAR_CONTROL_COUNT: 14 → 15
    └── sim/
        ├── grid.test.ts       # (modified) small additions — setCell's grass bookkeeping
        ├── element.test.ts    # none exists today; isSolid is covered via grass.test.ts's use of the growth rules that depend on it, not a standalone file
        ├── step.test.ts       # unchanged — grass coverage lives in grass.test.ts instead (research.md §10)
        ├── grass.test.ts      # (new) the bulk of FR-035's grass-specific coverage
        ├── brush.test.ts      # (modified) small additions — the grass tool
        ├── objects.test.ts    # unchanged
        ├── scenes.test.ts     # (modified) landscape-1 grass assertions; landscape-2 zero-grass assertion
        ├── wand.test.ts       # (modified) one addition — grass glitters
        └── resize.test.ts     # (modified) small addition — grass survives a re-derivation
```

**Structure Decision**: Same single client-only project 001–006
established — no `backend/`/`frontend/` split, `src/sim/*` stays isolated
from Svelte for zero-DOM `vitest` coverage (constitution Principle V).
This feature adds exactly one new file anywhere in the repo
(`tests/unit/sim/grass.test.ts`) and otherwise extends existing modules in
place — no existing exported function's signature is removed or
incompatibly changed, no existing test file's assertions need to change
beyond the two explicitly called out above (`layout.test.ts`'s control
count, `scenes.test.ts`'s landscape-1 composition), which is what keeps
every other 001–006 test passing unchanged (FR-033, SC-017). Grass's
simulation logic is deliberately kept inside `step.ts` alongside
`stepPowder`/`stepLiquid` rather than factored into a new `src/sim/
grass.ts` module, matching the existing architecture where every per-cell
movement/interaction rule for every element lives in one file dispatched
by element type (research.md §5, §10) — its test coverage nonetheless gets
its own file (`grass.test.ts`) purely for organization, since FR-035's
grass-specific rule list is large enough to warrant a dedicated home
without cluttering `step.test.ts`'s existing powder/water tests.

## Complexity Tracking

*No entries — Constitution Check reported no violations.*
