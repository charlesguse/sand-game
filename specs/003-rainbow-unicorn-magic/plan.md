# Implementation Plan: Rainbow and Unicorn Magic

**Branch**: `003-rainbow-unicorn-magic` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-rainbow-unicorn-magic/spec.md`

## Summary

Extend the Rainbow Sand toy (built by `001-falling-pink-sand`, extended by
`002-water-and-purple-dirt`) with two placeable, non-falling emoji objects
— 🌈 rainbow and 🦄 unicorn — plus a new powder, rainbow sand, that the
rainbow creates. Objects are represented as a shared `OBJECT` element-array
marker (so `step()`'s existing floor/wall-style blocking logic already
treats them as solid with zero changes to its movement code) plus a small,
capped list of `PlacedObject` records that own kind/position/size outside
the grid. Rainbow conversion and unicorn touch-detection both walk a small
per-object "zone" (the one-cell ring around a footprint) once per tick —
bounded by the object cap (3 of each), not by grid size — rather than
scanning the whole grid. Rainbow sand shimmers while moving and freezes at
rest by piggy-backing a new `hues` parallel array onto the grid's existing
move/swap primitives, so no separate per-tick scan is needed to find
"which cells moved." Sparkle/heart particles are a purely decorative,
DOM-free UI-layer module, driven by one pure grid query
(`isUnicornTouched`) and never touching the grid themselves. All new rules
are covered by `vitest` unit tests against grid/object state, no browser
required; `step.ts` and `brush.ts`'s existing exported contracts are
unchanged, protecting every 001/002 test from regression, and the
production build continues to emit exactly one self-contained
`dist/index.html`.

## Technical Context

**Language/Version**: TypeScript 5.x, Node 22 (matches
`.github/workflows/deploy-pages.yml`) — unchanged from 001/002.

**Primary Dependencies**: `svelte` 5, `vite`, `@sveltejs/vite-plugin-svelte`,
`vite-plugin-singlefile`, `vitest`, `typescript` — unchanged from 001/002;
no new runtime dependency is needed or justified (constitution
Principle III). Emoji glyphs are drawn via `CanvasRenderingContext2D
.fillText` using the platform's own emoji font — no new dependency, no
custom artwork, no external asset fetch (FR-029, FR-038).

**Storage**: N/A — no persistence; each page load starts from an empty
grid with no objects (spec Assumptions, inherited from 001/002).

**Testing**: `vitest`, running `src/sim/*` modules directly against plain
typed-array/plain-object state — no DOM/jsdom, no browser (constitution
Principle V, FR-037). Extends 001/002's `tests/unit/sim/{grid,step,brush}
.test.ts` and adds `tests/unit/sim/objects.test.ts`.

**Target Platform**: Static single-file page opened via `file://` or served
from GitHub Pages; evergreen browsers on a mid-range laptop (mouse/
trackpad) and a tablet (touch) — unchanged from 001/002.

**Project Type**: Single-page client-only web app — no backend/API.
Unchanged from 001/002.

**Performance Goals**: 60fps target, ≥30fps acceptable floor (SC-012,
FR-030), at the default grid resolution, with the worst-case scene:
3 rainbows + 3 unicorns on screen, particles at their documented cap, and
the play area at least half full of a mixture of all elements including
shimmering rainbow sand in motion — the new worst case this feature
introduces (research.md §11).

**Constraints**: Production build still emits exactly one output file with
zero runtime network requests (FR-038); `step()`'s existing per-tick
element-conservation and movement guarantees for `SAND`/`WATER`/`DIRT` are
unmodified (FR-036); the *total* occupied-cell count still never changes
except by rainbow conversion, which changes an element's type in place
without creating/destroying/moving a cell (FR-015, and this spec's
Superseded-requirements amendment to 002's FR-003/SC-005); an object never
falls, settles, or moves once placed (FR-007, SC-020); no element cell ever
occupies an object's footprint (FR-009, SC-007); rainbow-sand hue advances
are bounded to cells that actually moved this tick (FR-021); particle count
is capped and never allowed to cost frame rate (FR-028, SC-011); hot loop
stays allocation-free, including the new `hues` array (preallocated once in
`createGrid`, like `elements`/`shades`/`moved` — constitution Principle IV).

**Scale/Scope**: One feature, four prioritized user stories (rainbow +
rainbow sand, unicorn + particles, objects-are-solid, erase/clear objects);
extends the existing ~10–15 source files with roughly 4 changed sim files
(`types.ts`, `grid.ts`, `step.ts`'s internal move primitives, `brush.ts`'s
contract clarified but unchanged), 1 new sim file (`objects.ts`), 1 new
UI-layer file (`src/lib/particles.ts`), plus `PlayArea.svelte`/
`Toolbar.svelte`/`layout.ts` changes for the two new tools, object
rendering, and particle rendering — no new top-level architecture.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. One Self-Contained Page | No new build step or runtime dependency; still `vite-plugin-singlefile` → single `dist/index.html`; rainbow/unicorn/sparkle/heart render as canvas `fillText` emoji glyphs using system fonts, no new external assets or fetches (FR-029, FR-038). | PASS |
| II. Built For An Almost-5-Year-Old | Two new object buttons (🌈 🦄) stay large, round, emoji-labeled, joining the existing family within the 10-control cap (FR-001, FR-034); object placement, conversion, and celebration never produce a message, confirmation, failure state, or "wrong" outcome (FR-002, FR-004, FR-005, FR-035); mouse+touch parity inherited unchanged. | PASS |
| III. Simple, Dependency-Light Svelte | No new dependency added or needed. `src/sim/*` (including the new `objects.ts`) stays plain TypeScript/typed-arrays plus one small capped-array `ObjectsState`, isolated from Svelte; particle animation timing lives in a DOM-free `src/lib/particles.ts`, not inside the sim core, per constitution's "Svelte owns the UI shell, not the per-frame hot path" — particles are UI decoration, not simulation state (FR-027). | PASS |
| IV. Performance Is A Feature | Grid size, `putImageData` render path, and `step()`'s one-pass-per-tick shape are all unchanged from 002; every new per-tick cost (rainbow conversion, unicorn touch, hue advance, particle tick) is bounded by small constants (≤6 objects, a documented particle cap) rather than growing with grid size (research.md §11). The worst case (3+3 objects, particles at cap, half-full grid with shimmering rainbow sand) is the explicit SC-012 target, with FR-021's own documented fallback (freeze hue at conversion, no shimmer) if profiling ever demands it. | PASS |
| V. Verifiable Without A Browser Harness | `npm run build` still emits a single `dist/index.html`; new `vitest` unit tests in `tests/unit/sim/objects.test.ts` (plus extensions to `step.test.ts`) cover every rule FR-037 lists — rainbow conversion, rainbow sand moving like pink sand, elements landing on/sliding off objects including the blocked-on-all-sides case, the per-type cap of 3 with oldest-rolls-off, and objects staying put with no gravity — directly against grid/object state, no DOM. Particle visuals and idle-sparkle timing are left to the maintainer's manual review, matching the spec's own "Visual checks for the maintainer" section and this principle's existing precedent. No browser-automation infra added. | PASS |

No violations — Complexity Tracking is not needed. The two notable design
decisions — reusing a single shared `OBJECT` element value rather than
per-kind markers, and piggy-backing hue advancement onto `step()`'s
existing move primitives rather than a second full-grid scan — are both
required, minimal consequences of FR-007/FR-009 (objects are solid and
immobile) and FR-021 (bounded shimmer cost), not constitution trade-offs,
so they are recorded in research.md rather than here.

## Project Structure

### Documentation (this feature)

```text
specs/003-rainbow-unicorn-magic/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── sim-core.md       # Phase 1 output
└── tasks.md              # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

This feature extends the scaffold established by `001-falling-pink-sand`
and `002-water-and-purple-dirt` (not greenfield — `package.json`,
`src/sim/*`, `src/lib/*`, `tests/unit/sim/*` already exist by the time this
feature is implemented, per spec Assumptions). Files marked **(new)** are
added by this feature; files marked **(modified)** have their contents
changed but keep their existing responsibility.

```text
index.html                 # unchanged
package.json                # unchanged — no new dependency
tsconfig.json / vite.config.ts / vitest.config.ts   # unchanged

src/
├── main.ts                # unchanged
├── App.svelte             # (modified) tool $state widens to include 'rainbow' | 'unicorn'; owns/passes ObjectsState
├── lib/
│   ├── PlayArea.svelte    # (modified) frame loop calls applyRainbowConversions + unicorn touch/particle tick after step(); pointer handling branches object tools to placeObject on pointerdown only; eraser calls eraseObjectsInBrush; clearAll calls clearObjects; render draws OBJECT footprints as background, object glyphs, then particles, and colors RAINBOW_SAND from hues via HSL (research.md §7-§10)
│   ├── Toolbar.svelte     # (modified) adds 🌈/🦄 buttons as a third tool group, within the 10-control cap (FR-001, FR-034)
│   ├── layout.ts          # (modified) adds OBJECT_FOOTPRINT_SIZE constant (research.md §6)
│   └── particles.ts       # (new) DOM-free Particle array: spawnBurst/spawnIdleSparkle/tickParticles (research.md §10)
└── sim/                   # framework-free, hot-path core (constitution III)
    ├── types.ts            # (modified) adds RAINBOW_SAND/OBJECT constants, Grid gains hues, Tool widens, PlacedObject/ObjectsState/ObjectKind types
    ├── element.ts          # (modified) isPowder additionally covers RAINBOW_SAND
    ├── grid.ts             # (modified) createGrid also allocates/zeroes hues
    ├── step.ts             # (modified, exported signature unchanged) internal move/swap primitives carry hues and advance it only for a RAINBOW_SAND destination that actually moved this tick
    ├── objects.ts          # (new) createObjectsState/placeObject/removeObject/eraseObjectsInBrush/clearObjects/applyRainbowConversions/isUnicornTouched
    ├── brush.ts             # unchanged exported contract (clarified in contracts/sim-core.md, not modified)
    └── shade.ts             # unchanged — not called for RAINBOW_SAND or OBJECT cells

tests/
└── unit/
    └── sim/
        ├── grid.test.ts    # (modified) covers the new hues field on createGrid
        ├── step.test.ts    # (modified) extended with RAINBOW_SAND movement parity, hue-advance-on-move/freeze-at-rest, and blocked-by-OBJECT cases (incl. blocked-on-all-sides)
        ├── brush.test.ts   # unchanged — 002's painting-priority matrix is untouched by this feature
        └── objects.test.ts # (new) placeObject/removeObject/eraseObjectsInBrush/clearObjects/applyRainbowConversions/isUnicornTouched, including the per-type cap-of-3 oldest-rolls-off rule and footprint-overlap release rule
```

**Structure Decision**: Same single client-only project 001/002
established — no `backend/`/`frontend/` split, `src/sim/*` stays isolated
from Svelte for zero-DOM `vitest` coverage (constitution Principle V) and
allocation-free hot-path execution (Principle IV). This feature adds one
new sim file (`objects.ts`) and one new UI-layer file (`particles.ts`),
modifies the sim/UI files listed above, and introduces no new top-level
directory and no new build tooling. `step.ts`'s and `brush.ts`'s *exported*
contracts are deliberately left unchanged (only `step.ts`'s internal move
primitives gain new behavior) to keep every existing 001/002 test passing
unmodified (FR-036, SC-013).

## Complexity Tracking

*No entries — Constitution Check reported no violations.*
