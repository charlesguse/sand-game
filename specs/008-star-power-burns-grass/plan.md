# Implementation Plan: Shining Star Power

**Branch**: `spec/008-star-power-burns-grass` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-star-power-burns-grass/spec.md`

## Summary

Add star power as a new, transient, static element (`STAR_POWER = 7`,
`src/sim/types.ts`) that never moves, is themed as magic rather than fire,
and burns exactly one fuel: grass. `stepPowder`/`stepLiquid` need **zero**
code change — star power is simply neither `EMPTY`, a powder, nor a
liquid, so both functions already fall through to "rest against it"/"flow
around it" by construction, exactly as spec 007 established for grass
(research.md §1). The only new per-cell simulation logic is one more
dispatch branch in `step()`, `stepStarPower`, which every step: (1) checks
its four orthogonal neighbors for `WATER` and, if found, extinguishes
immediately regardless of age (FR-016/017 — water always wins and is
never spent); (2) otherwise ages by one step and, once age reaches its
own randomly-chosen `starPowerLife` (30–60 steps, FR-007), extinguishes on
its own; (3) otherwise, once age reaches the spec's literal 10-step
ignition delay (FR-011), scans all eight neighbors and ignites every
`GRASS` cell found into a fresh, fuelled star power cell. Extinguishing a
fuelled cell turns it into exactly the toy's existing glitter grain —
`RAINBOW_SAND` with a fresh hue and `glitter = 1` — reusing spec 005's
glitter physics with zero new code; an unfuelled cell (drawn into empty
space by the ⭐ brush) simply becomes `EMPTY` (research.md §5, §6). Three
new per-cell `Uint8Array`s (`starPowerAge`, `starPowerLife`,
`starPowerFuelled`) are added to `Grid`, created exclusively through one
new chokepoint, `igniteStarPower(grid, x, y, fuelled)` (`grid.ts`), which
also sets `glitter[i] = 1` at creation — star power's "twinkle" is
therefore produced entirely by reusing the existing glitter-shimmer/
flash-cap rendering pipeline the wand's own sprinkle already relies on,
needing zero new render mechanism and, by construction, never raising the
sparkle-flash cap (FR-034, research.md §7). The ⭐ brush is one new
`paintCell` branch in `brush.ts` (deposit into `EMPTY`, convert `GRASS`,
skip everything else including `WATER` — FR-018, FR-022); the eraser,
object placement, rainbow conversion, and scene loading need **zero**
change, since each already treats star power generically as "just another
occupied element" (research.md §10). The one place this feature is *not*
zero-diff for an existing consumer is the sparkle wand: `applyWandCell`'s
existing "glitter any non-`EMPTY`, non-`OBJECT` cell" rule would otherwise
also glitter star power, so it gains one explicit skip (FR-027, research.
md §9). The toolbar gains one ⭐ button in the existing elements group
(research.md §13). No new runtime dependency, no new top-level file beyond
`tests/unit/sim/starPower.test.ts` (research.md §14, §15).

## Technical Context

**Language/Version**: TypeScript 5.x, Node 22 (matches
`.github/workflows/deploy-pages.yml`) — unchanged from 001–007.

**Primary Dependencies**: `svelte` 5, `vite`, `@sveltejs/vite-plugin-svelte`,
`vite-plugin-singlefile`, `vitest`, `typescript` — unchanged; no new
runtime dependency (research.md §15). No new browser API is needed either
— star power is built entirely from existing `Grid`/`Uint8Array`/`canvas`
mechanisms 001–007 already established, including reusing the existing
glitter/shimmer/flash-cap rendering pipeline verbatim for its twinkle
(research.md §7).

**Storage**: N/A — unchanged; nothing new is persisted (spec's own
Assumptions section: "no sound, no persistence, no new settings").

**Testing**: `vitest`, adding `tests/unit/sim/starPower.test.ts` (new —
the bulk of FR-038's star-power-specific coverage: no movement; powders
resting on it/water flowing around it; burn-life bounds and ragged
variation; unfuelled-leaves-nothing/fuelled-leaves-one-glitter-grain in
place; the produced glitter being byte-identical in behavior to the
wand's own; eight-neighbor ignition after the 10-step delay; the burn
front's cells-per-second bounds; zero grass changes with zero star power
on the field; the burn refusing to cross empty/powder/glitter/water/
object cells; every burn terminating with the field at rest; quenching by
orthogonally-adjacent water within one step with the water itself
unchanged; grass beside a water firebreak still drinking and growing
under spec 007's unchanged rule, including while a burn proceeds
elsewhere on the same field — research.md §14) and small, targeted
additions to `tests/unit/sim/grid.test.ts` (`igniteStarPower`'s
bookkeeping, `setCell`'s star-power reset rule, `clearGrid`'s new fills),
`tests/unit/sim/brush.test.ts` (the new `star` tool's deposit/ignite/skip
rules), `tests/unit/sim/wand.test.ts` (the new skip branch — FR-027),
`tests/unit/sim/resize.test.ts` (star power and its fuel state surviving
a re-derivation), `tests/unit/sim/scenes.test.ts` (zero star power in any
loaded scene), and `tests/unit/lib/layout.test.ts`
(`TOOLBAR_CONTROL_COUNT` 15 → 16). All plain, DOM-free TypeScript against
`Grid`/pure-function state (constitution Principle V, FR-038) — no
browser-automation infra is added. The genuinely DOM-only parts of this
feature (on-screen gold/white/twinkle legibility as *magic* rather than
fire, the burn front reading as a watchable "ooh" moment, grass
"bursting" into glitter, the toolbar button's placement/feel, Fire-7-
tablet smoothness during a full-lawn burn) are the maintainer's on-device
job per quickstart.md, matching constitution Principle V's existing
precedent.

**Target Platform**: Static single-file page opened via `file://` or
served from GitHub Pages; evergreen browsers on a mid-range laptop
(mouse/trackpad), a tablet, a mid-range phone (spec 006), and a low-end
tablet of the Amazon Fire 7 Kids class (spec 007's own binding
performance constraint, carried forward unchanged and now exercised
against this feature's own worst case — a full lawn igniting at once,
FR-033, SC-014).

**Project Type**: Single-page client-only web app — no backend/API.
Unchanged.

**Performance Goals**: Steady 60fps target, 30fps floor (constitution
Principle IV, FR-033), now required specifically in the worst case of a
play field at spec 007's own grass ceiling fully alight at once, with the
resulting glitter falling and piling, on the Fire-7-class device
(SC-014). `stepStarPower` is `O(1)` per star-power cell per step (a fixed
four-neighbor quench scan, plus — only once past the ignition delay — a
fixed eight-neighbor ignition scan) and allocates nothing (research.md
§5) — no object/array literals, only primitive index arithmetic — so the
star-power rules add no asymptotic cost to the existing `O(cell count)`
hot loop; `CELL_BUDGET = 43,200` (spec 006, unchanged) continues to bound
the worst case regardless of how much of the field is burning (FR-034).
SC-016 requires the measured per-step cost of a field-wide burn to stay
within 20% of an equally-full field of falling sand — a direct
consequence of `stepStarPower` being no more expensive per cell than
`stepPowder`/spec 007's `stepGrass`, not a separate optimization.

**Constraints**: The per-frame simulation/effect/render path must stay
allocation-free (constitution Principle IV) — `stepStarPower`/
`extinguishStarPower`/`igniteStarPower` are all written with plain index
arithmetic and no `{x, y}` object literals or neighbor arrays, exactly
matching spec 007's own `stepGrass` discipline (research.md §5).
Star power's twinkle is required to add zero new allocation and zero new
sparkle-flash-cap headroom (FR-034) — satisfied by construction, since it
reuses the exact existing `glitter`/`FLASH_CAP = 24` mechanism rather than
adding a second one (research.md §7). Production build still emits
exactly one output file with zero runtime network requests (FR-037,
unchanged from every prior feature). Star power must never move under any
rule (FR-004) — enforced by construction: no code path anywhere ever
calls `moveCell`/`swapCells` on a `STAR_POWER` cell, and `stepStarPower`
itself only ever writes to *other* cells (the water/neighbor it reads, or
the grass cell it ignites), never repositioning its own `(x, y)`.

**Scale/Scope**: One feature, four prioritized user stories (draw star
power; burn grass into glitter; water quenches it; belongs with
everything else). Adds one new file (`tests/unit/sim/starPower.test.ts`);
extends `Grid`'s shape (three new `Uint8Array`s, no new running-total
field) and `Tool`'s value set (one new string) without breaking any
existing consumer's signature; extends `setCell`/`clearGrid`/`createGrid`
(`grid.ts`, plus one new exported function, `igniteStarPower`), `step`'s
dispatcher plus two new private helpers (`step.ts`), `paintCell`
(`brush.ts`), `applyWandCell` (`wand.ts` — the one existing consumer that
needs a real behavior change, research.md §9), `resizeGrid`'s copy loop
(`resize.ts`), `colorFor` (`PlayArea.svelte`), and the elements button
group (`Toolbar.svelte`); adds `isSolid`'s `STAR_POWER` case
(`element.ts`) and two small exported helpers to `shade.ts`
(`randomBurnLife`, and `randomHue` moved there from `objects.ts`). No
change to `objects.ts`'s own logic beyond that one import swap,
`scenes.ts`, `sparkle.ts`, `particles.ts`, `layout.ts` (beyond the
test-only `TOOLBAR_CONTROL_COUNT` constant, which lives in the test file,
not `layout.ts` itself), `App.svelte`, `main.ts`, or `index.html`. No new
top-level architecture, no new build tooling.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. One Self-Contained Page | No new build step, asset, font, or runtime dependency; every new/changed file lives in `src/sim/*`/`src/lib/*`, already bundled into `dist/index.html` by `vite-plugin-singlefile` (FR-037). | PASS |
| II. Built For An Almost-5-Year-Old | One new big, round, emoji-labeled (⭐) button, understandable without reading, grouped with the other element brushes (FR-020, FR-021); nothing about star power can fail, warn, show a message, or be "wrong" (FR-031, SC-019) — igniting, burning out, quenching, and every worst case all happen silently and are reversible by erasing, clearing, or replanting. Mouse and touch both remain fully supported via the existing generic brush machinery (FR-023). Themed explicitly as magic (gold/white/twinkle), never as fire/danger (FR-003, FR-032). | PASS |
| III. Simple, Dependency-Light Svelte | No new dependency (research.md §15). Star power's simulation rules stay in the framework-free `src/sim/*` core, isolated from Svelte exactly like every existing element rule — `stepStarPower` lives beside `stepPowder`/`stepLiquid`/`stepGrass` in `step.ts` rather than inventing a parallel per-element architecture (research.md §1, §5, §14). The simplest possible rule that reuses existing generic machinery wherever the codebase already has it (eraser, objects, scenes, the glitter/shimmer render pipeline) rather than adding star-power-specific special cases to any of them (research.md §7, §10) — the one place a real change was unavoidable (the wand, research.md §9) is a single one-line early return, not a new mechanism. This feature adds exactly one new element type, as the constitution's "new element types require a spec" product constraint requires and this document satisfies. | PASS |
| IV. Performance Is A Feature | The explicit new worst case — spec 007's own grass ceiling fully alight at once, with the resulting glitter falling and piling, on a Fire-7-class tablet — is exactly SC-014/FR-033's own named target. `stepStarPower`, `igniteStarPower`, and `extinguishStarPower` are deliberately allocation-free (research.md §5, §6), keeping the hot loop's existing no-allocation discipline intact; the star-power rules add `O(1)` work per star-power cell to a loop that was already `O(cell count)`, and `CELL_BUDGET` (unchanged) continues to bound the worst case (SC-016). Twinkle reuses the existing `FLASH_CAP = 24` reservoir rather than adding a second cap or a second per-frame shimmer computation (FR-034, research.md §7). | PASS |
| V. Verifiable Without A Browser Harness | `npm run build` still emits a single `dist/index.html`; `tests/unit/sim/starPower.test.ts` plus the small additions to five other existing test files cover every rule FR-038 lists — no movement, solidity, burn-life bounds and variation, fuelled/unfuelled outcomes, the produced glitter's byte-identical behavior to the wand's own, eight-neighbor ignition timing, burn-front pace, no-grass/no-star-power inertness, the burn refusing to cross non-grass cells, every burn terminating, quenching with the water unchanged, the firebreak-drinking interaction, brush deposit/skip rules, eraser/clear-all, the wand's new skip, object non-interaction, re-derivation carry-over, and scene-load clearing — directly against pure `Grid` state, no DOM. The genuinely DOM-only behaviors (on-screen gold/white/twinkle legibility as magic rather than fire, the burn front's watchable pace reading as an "ooh" moment, a blade "bursting" into glitter, the toolbar button's placement/feel, Fire-7 smoothness during a full-lawn burn) are the maintainer's on-device job, per quickstart.md's explicit manual-check list — matching this principle's existing precedent from every prior feature's own visual-checks section. No browser-automation infra is added. | PASS |

No violations — Complexity Tracking is not needed. The most consequential
design decision — reusing the existing `glitter` flag/shimmer/flash-cap
pipeline for star power's own twinkle rather than building a second
rendering mechanism (research.md §7) — is not a constitution trade-off;
it is the more literal, simpler reading of FR-034's own "must not raise
the sparkle flash caps... already sets" taken together with `wand.ts`'s
pre-existing precedent of treating `glitter` as a generic shimmer flag,
and it is what keeps the render path allocation-free and within Principle
IV's existing cap, in direct service of both Principle III (simplicity,
reuse over invention) and Principle IV (performance).

## Project Structure

### Documentation (this feature)

```text
specs/008-star-power-burns-grass/
├── plan.md                          # This file (/speckit-plan command output)
├── research.md                      # Phase 0 output
├── data-model.md                    # Phase 1 output
├── quickstart.md                    # Phase 1 output
├── contracts/
│   └── star-power-mechanics.md      # Phase 1 output
└── tasks.md                         # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

This feature extends the scaffold established by `001-falling-pink-sand`
through `007-water-drinking-grass` (not greenfield — `package.json`,
`src/sim/*`, `src/lib/*`, `tests/unit/*` already exist, including `007`'s
landed grass rules). Files marked **(new)** are added by this feature;
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
│   ├── PlayArea.svelte     # (modified) STAR_POWER import; GOLD_RAMP constant; colorFor gains a STAR_POWER branch — render()'s loop itself unchanged (twinkle comes free from the existing glitter-shimmer path, research.md §7)
│   ├── Toolbar.svelte      # (modified) one new ⭐ button in .group.elements
│   ├── layout.ts           # unchanged — GRID_WIDTH/GRID_HEIGHT/CELL_BUDGET/BRUSH_RADII/OBJECT_FOOTPRINT_SIZE/MIN_TOUCH_TARGET/computePlayField/computeToolbarLayout all unchanged
│   ├── particles.ts        # unchanged
│   └── sparkle.ts          # unchanged — FLASH_CAP/updateFlashMask reused verbatim, no change needed
└── sim/                    # framework-free, hot-path core (constitution III)
    ├── types.ts             # (modified) STAR_POWER = 7 added to Element; Grid gains starPowerAge/starPowerLife/starPowerFuelled; Tool gains 'star'
    ├── element.ts            # (modified) isSolid gains `|| e === STAR_POWER` — isPowder/isLiquid unchanged
    ├── shade.ts               # (modified) gains randomBurnLife() and randomHue() (the latter moved here from objects.ts) — randomShade unchanged
    ├── grid.ts               # (modified) createGrid allocates the three new arrays; setCell resets star-power bookkeeping on every call; clearGrid resets them; new exported igniteStarPower(grid, x, y, fuelled)
    ├── step.ts               # (modified) step's dispatcher gains a STAR_POWER branch calling new private stepStarPower/extinguishStarPower — stepPowder/stepLiquid/stepGrass unchanged
    ├── brush.ts               # (modified) paintCell gains two 'star' tool branches — eraser branch unchanged
    ├── objects.ts             # (modified) applyRainbowConversions imports randomHue from shade.ts instead of defining it locally — no behavior change; placement/removal/touch-detection logic unchanged
    ├── scenes.ts               # unchanged — no scene ever creates star power
    ├── wand.ts                 # (modified) applyWandCell gains one early return skipping STAR_POWER, alongside its existing OBJECT skip
    └── resize.ts               # (modified) resizeGrid's copy loop also carries starPowerAge/starPowerLife/starPowerFuelled — no new counter to accumulate

tests/
└── unit/
    ├── lib/
    │   └── layout.test.ts    # (modified) TOOLBAR_CONTROL_COUNT: 15 → 16
    └── sim/
        ├── grid.test.ts       # (modified) small additions — igniteStarPower's bookkeeping, setCell's reset rule, clearGrid's new fills
        ├── element.test.ts    # none exists today; isSolid's STAR_POWER case is exercised indirectly via starPower.test.ts/grass.test.ts, not a standalone file (precedent: spec 007)
        ├── step.test.ts       # unchanged — star-power coverage lives in starPower.test.ts instead (research.md §14)
        ├── grass.test.ts      # unchanged — no grass-only assertion becomes obsolete; the cross-feature "grass drinks while a burn happens elsewhere" scenario lives in starPower.test.ts instead
        ├── starPower.test.ts  # (new) the bulk of FR-038's star-power-specific coverage
        ├── brush.test.ts      # (modified) small additions — the star tool
        ├── objects.test.ts    # (modified) small addition — isUnicornTouched/applyRainbowConversions with a STAR_POWER cell present
        ├── scenes.test.ts     # (modified) small addition — zero star power cells in any loaded scene
        ├── wand.test.ts       # (modified) one addition — the wand leaves star power untouched
        └── resize.test.ts     # (modified) small addition — star power and its fuel state survive a re-derivation
```

**Structure Decision**: Same single client-only project 001–007
established — no `backend/`/`frontend/` split, `src/sim/*` stays isolated
from Svelte for zero-DOM `vitest` coverage (constitution Principle V).
This feature adds exactly one new file anywhere in the repo
(`tests/unit/sim/starPower.test.ts`) and otherwise extends existing
modules in place — no existing exported function's signature is removed
or incompatibly changed, no existing test file's assertions need to
change beyond the one explicitly called out above
(`layout.test.ts`'s control count), which is what keeps every other
001–007 test passing unchanged (FR-036, SC-018). Star power's simulation
logic is deliberately kept inside `step.ts` alongside `stepPowder`/
`stepLiquid`/`stepGrass` rather than factored into a new `src/sim/
starPower.ts` module, matching the existing architecture where every
per-cell movement/interaction rule for every element lives in one file
dispatched by element type (research.md §1, §5, §14) — its test coverage
nonetheless gets its own file (`starPower.test.ts`) purely for
organization, since FR-038's star-power rule list is large enough to
warrant a dedicated home without cluttering `step.test.ts`'s existing
powder/water tests or `grass.test.ts`'s existing grass-only ones.

## Complexity Tracking

*No entries — Constitution Check reported no violations.*
