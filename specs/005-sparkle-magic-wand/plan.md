# Implementation Plan: Sparkle Magic Wand

**Branch**: `spec/005-sparkle-magic-wand` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-sparkle-magic-wand/spec.md`

## Summary

Add a ✨ wand tool that, like the element brushes, is selected then dragged.
Everywhere it passes over an existing grain (pink sand, water, magic purple
dirt, or rainbow sand) it sets a new per-cell "glittered" flag and touches
nothing else about that cell (FR-006, FR-011); everywhere it passes over
empty space it sprinkles a sparse dusting of the toy's existing rainbow sand,
placed already-glittered (FR-015–FR-017); and when its coverage reaches a
placed 🦄 unicorn it fires a bigger celebration burst than the unicorn's
ordinary touch sparkle (FR-018–FR-021). The wand is implemented as one new,
framework-free module, `src/sim/wand.ts`, that reuses `brush.ts`'s existing
circular-footprint iteration (exported, not duplicated) and `objects.ts`'s
existing per-kind object list — mirroring how `004-landscape-scenes`'s
`scenes.ts` reused `setCell`/`placeObject` rather than inventing parallel
primitives. Glitter itself is carried as one new parallel `Uint8Array` on
`Grid` (`glitter`, alongside `elements`/`shades`/`hues`), so it survives
exactly the operations FR-007–FR-009 require "for free": `step.ts`'s
`moveCell`/`swapCells` are extended to carry/swap the new array (satisfying
FR-008, the only sim-core file this feature must modify), while `setCell`
(brush painting, eraser) and `clearGrid` (clear-all, every scene load) reset
it, and `applyRainbowConversions` is left untouched — it never reads or
writes `glitter`, so a converted grain keeps whatever glitter it already had
(FR-009) with zero new code. Sprinkle placement into empty space uses a
fixed, position-only lattice test (research.md §4) instead of `Math.random()`
— the same "determinism over a seeded PRNG" preference `004`'s research
established — which is what makes repeating the same wand pass over the same
region produce a byte-identical result (SC-005) while still guaranteeing
FR-015's "more than zero, at most one third" bounds by construction rather
than by chance. The brief per-grain sparkle flash (FR-022) and the wand's
bigger unicorn burst (FR-018) are both UI-layer rendering/particle concerns,
not simulation state (per the spec's own Key Entities section) — they live
in `src/lib/*` alongside the existing `particles.ts`, are exercised by the
existing 60fps/allocation-free hot loop the constitution already governs,
and are validated by the maintainer's eye rather than a new test file,
exactly as `004`'s visual checks and the existing (untested) particle cap
already are. No existing exported signature in `src/sim/*` changes except
the two additive fields/parameters this feature needs; `PlayArea.svelte`,
`Toolbar.svelte`, and `types.ts` gain small additive changes mirroring the
`004` scene-button pattern.

## Technical Context

**Language/Version**: TypeScript 5.x, Node 22 (matches
`.github/workflows/deploy-pages.yml`) — unchanged from 001/002/003/004.

**Primary Dependencies**: `svelte` 5, `vite`, `@sveltejs/vite-plugin-svelte`,
`vite-plugin-singlefile`, `vitest`, `typescript` — unchanged; no new runtime
dependency is needed or justified (constitution Principle III). The
sprinkle-placement mechanic needs no seeded-PRNG library — like `004`, it
uses plain position-keyed arithmetic (research.md §4).

**Storage**: N/A — glitter is grid/particle-adjacent in-memory state only,
never persisted, gone on reload exactly like every other element (FR-012,
inherited from 001–004's no-persistence assumption).

**Testing**: `vitest`, adding one new file, `tests/unit/sim/wand.test.ts`,
that imports `src/sim/wand.ts`/`grid.ts`/`objects.ts` directly and asserts on
`Grid`/`ObjectsState` contents — no DOM, no browser (constitution Principle
V, FR-027). No existing test file's assertions need to change; `step.test.ts`
gains coverage for the new glitter-carrying behavior of `moveCell`/
`swapCells` (FR-008) since that is the one existing sim file this feature
modifies. The sparkle-flash and wand-burst *rendering* mechanics are not
separately unit-tested — FR-027's own required-coverage list (and its
mirror, SC-016) enumerates only grid/glitter-state assertions, none about
flash timing or burst counts, matching the existing precedent that
`particles.ts`'s particle cap is likewise unverified by any test file today.

**Target Platform**: Static single-file page opened via `file://` or served
from GitHub Pages; evergreen browsers on a mid-range laptop (mouse/
trackpad) and a tablet (touch) — unchanged.

**Project Type**: Single-page client-only web app — no backend/API.
Unchanged.

**Performance Goals**: Steady 60fps target, 30fps floor, at the default
270×160 grid, with 100% of the play area glittered and elements in motion
(FR-024, SC-011) — the worst case for this feature, since that is exactly
when every one of the frame's three new per-cell costs (an extra
`Uint8Array` read for the render-time shimmer check, the flash-mask
reservoir sample, and the shimmer color nudge itself) applies to every cell
simultaneously. All three are O(width × height) arithmetic with no
allocation (research.md §6), the same asymptotic shape `render()` and
`step()` already have every frame, so this is an increase in per-cell
constant factor, not a new order of growth — research.md §6 works the
budget math.

**Constraints**: The per-frame simulation/effect/render path must allocate
nothing (FR-023, constitution Principle IV) — the new `glitter` array is
allocated once in `createGrid` (like `elements`/`shades`/`hues`), the flash
mask is allocated once alongside `imageData` in `PlayArea.svelte`'s
`onMount`, and both are only ever read/mutated in place thereafter. Wand
painting itself (`applyWand`/`applyWandLine`, called from `pointermove`, not
from the animation-frame loop) is also written allocation-free by using a
closed-form eligibility test per cell instead of collecting candidates into
an array (research.md §4) — matching the zero-allocation style
`applyBrush`/`applyBrushLine`/`eraseObjectsInBrush` already have, even
though the constitution's hot-loop rule does not strictly require it there.
Production build still emits exactly one output file with zero runtime
network requests (FR-028, unchanged from every prior feature).

**Scale/Scope**: One feature, three prioritized user stories (glitter
existing grains, sprinkle glitter into empty space, a bigger unicorn
celebration) plus the issue's own explicit stretch-cut order (US3 first,
then US2, per Assumptions). Adds one new sim file (`src/sim/wand.ts`), one
new lib file (`src/lib/sparkle.ts`), one new test file
(`tests/unit/sim/wand.test.ts`); makes small additive changes to
`types.ts`, `grid.ts`, `step.ts`, `brush.ts` (one function gains `export`,
no behavior change), `objects.ts` (one function gains `export`, no behavior
change), `particles.ts` (one function gains an optional parameter, default
preserves every existing call site), `PlayArea.svelte`, and `Toolbar.svelte`.
No new top-level architecture, no new build tooling.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. One Self-Contained Page | No new build step, asset, font, or runtime dependency; every new file lives in `src/sim/*`/`src/lib/*`, already bundled into `dist/index.html` by `vite-plugin-singlefile` (FR-028). | PASS |
| II. Built For An Almost-5-Year-Old | One new large, round, emoji-labeled ✨ button joins the existing family, understandable without reading (FR-002); wand use is press-and-drag, identical in feel to the element brushes (FR-003); nothing about the wand can fail, warn, or be "wrong" (FR-025). | PASS |
| III. Simple, Dependency-Light Svelte | No new dependency added or needed — sprinkle-eligibility determinism is plain arithmetic, not a PRNG library (research.md §4), matching `004`'s precedent. `src/sim/wand.ts` stays plain TypeScript operating on `Grid`/`ObjectsState`, isolated from Svelte exactly like `brush.ts`/`objects.ts`/`scenes.ts`; `src/lib/sparkle.ts` is likewise plain TypeScript, mirroring `particles.ts`'s existing placement. `Toolbar.svelte`'s new button is markup/CSS only, reusing the existing `tool` selection state — no new client state. | PASS |
| IV. Performance Is A Feature | Grid size, `putImageData` render path, and `step()`'s per-tick shape are unchanged in kind; the new per-frame work (glitter shimmer, flash-mask resample) is O(width × height) with no allocation, matching the existing hot path's constraint (FR-023, research.md §6). The worst case — a fully glittered play area — is the scenario FR-024/SC-011 explicitly require to stay at ≥30fps, targeting 60fps. | PASS |
| V. Verifiable Without A Browser Harness | `npm run build` still emits a single `dist/index.html`; a new `tests/unit/sim/wand.test.ts` covers every case FR-027 lists — conversion marking every element type, glitter travelling with a moving/swapping grain, survival through rainbow conversion, idempotency, non-destructiveness, the empty-region density bounds, the mixed-region split, sprinkled grains being rainbow sand, glitter not fading over simulated time, objects left untouched, and clean removal via erase/clear-all — directly against `Grid`/`ObjectsState`, no DOM. Sparkle-flash appearance and the unicorn's wand-burst feel are left to the maintainer's manual review, per the spec's own "Visual checks for the maintainer" section, this principle's existing precedent (004), and the existing untested particle-cap mechanism it already accepts. No browser-automation infra added. | PASS |

No violations — Complexity Tracking is not needed. The one notable design
decision — a fixed position-only lattice instead of `Math.random()` for
sprinkle placement — is a minimal, required consequence of FR-015 (testable
density bounds) and SC-005 (idempotent repeat passes), not a constitution
trade-off, so it is recorded in research.md rather than here.

## Project Structure

### Documentation (this feature)

```text
specs/005-sparkle-magic-wand/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── wand-mechanics.md   # Phase 1 output
└── tasks.md              # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

This feature extends the scaffold established by `001-falling-pink-sand`,
`002-water-and-purple-dirt`, `003-rainbow-unicorn-magic`, and
`004-landscape-scenes` (not greenfield — `package.json`, `src/sim/*`,
`src/lib/*`, `tests/unit/sim/*` already exist, including `004`'s
`scenes.ts`/`scenes.test.ts`). Files marked **(new)** are added by this
feature; files marked **(modified)** have their contents changed but keep
their existing responsibility; everything else is unchanged.

```text
index.html                 # unchanged
package.json                # unchanged — no new dependency
tsconfig.json / vite.config.ts / vitest.config.ts   # unchanged

src/
├── main.ts                # unchanged
├── App.svelte             # (modified) wires the wand into the same onSelectTool handler scenes/elements already use — no new handler needed, since 'wand' is just another Tool value
├── lib/
│   ├── PlayArea.svelte    # (modified) paintAt() gains a tool === 'wand' branch calling wand.ts; frame() calls sparkle.ts's updateFlashMask before render(); render() reads the flash mask and grid.glitter for the shimmer/flash visuals; unicornTimers gains a wand-burst cooldown per unicorn
│   ├── Toolbar.svelte     # (modified) adds one ✨ button to the existing "actions" group (or an equally small new group), participating in the existing class:selected={tool === 'wand'} pattern exactly like the element/eraser buttons (FR-001)
│   ├── layout.ts          # unchanged — BRUSH_RADII reused as-is by the wand's coverage
│   ├── particles.ts       # (modified) spawnBurst gains an optional count parameter (default preserves every existing call site — FR-026); no new function
│   └── sparkle.ts          # (new) createFlashMask/updateFlashMask — the capped, allocation-free per-frame sparkle-flash selection (contracts/wand-mechanics.md)
└── sim/                   # framework-free, hot-path core (constitution III)
    ├── types.ts            # (modified) Tool gains 'wand'; Grid gains `glitter: Uint8Array`
    ├── element.ts          # unchanged
    ├── grid.ts             # (modified) createGrid allocates `glitter`; clearGrid also fills it to 0; setCell also resets it to 0; two new small accessors, setGlitter/getGlitter, mirroring setCell/getElement
    ├── step.ts             # (modified) moveCell/swapCells carry/swap the new `glitter` array alongside elements/shades/hues — the one behavior change to an existing sim file this feature needs (FR-008)
    ├── objects.ts           # (modified) the existing private footprint/circle-intersection check gains `export` so wand.ts can reuse it for unicorn-touch detection — no behavior change to any existing export
    ├── brush.ts             # (modified) the existing private forEachFootprintCell gains `export` so wand.ts can reuse it — no behavior change to any existing export
    ├── shade.ts             # unchanged
    ├── scenes.ts            # unchanged — a scene load's clearGrid already clears glitter for free once grid.ts is updated
    └── wand.ts              # (new) applyWand/applyWandLine (conversion + sprinkle) and unicornsTouchedByWandLine (contracts/wand-mechanics.md)

tests/
└── unit/
    └── sim/
        ├── grid.test.ts    # unchanged
        ├── step.test.ts    # (modified) adds assertions that a falling/swapping glittered grain carries its glitter and leaves none behind (FR-008)
        ├── brush.test.ts   # unchanged
        ├── objects.test.ts # unchanged
        ├── scenes.test.ts  # unchanged
        └── wand.test.ts    # (new) conversion rule, per-element coverage, idempotency, non-destructiveness, sprinkle density bounds, mixed-region split, sprinkled-grain identity, glitter permanence, objects left untouched (FR-027)
```

**Structure Decision**: Same single client-only project 001–004
established — no `backend/`/`frontend/` split, `src/sim/*` stays isolated
from Svelte for zero-DOM `vitest` coverage (constitution Principle V). This
feature adds exactly two new files (`wand.ts`, `sparkle.ts`) and one new
test file, extends `Grid`/`Tool` with the two additive fields FR-006/FR-008
require, and touches `step.ts`/`brush.ts`/`objects.ts` only by (a) carrying
one more parallel array through two existing internal functions and (b)
exporting two already-existing internal helpers — no existing exported
function's *signature* changes anywhere in `src/sim/*`, and no existing
test's expected values change, which is what keeps every 001–004 test
passing unmodified (FR-026).

## Complexity Tracking

*No entries — Constitution Check reported no violations.*
