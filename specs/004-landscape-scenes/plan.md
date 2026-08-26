# Implementation Plan: Landscape Scenes

**Branch**: `spec/004-landscape-scenes` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-landscape-scenes/spec.md`

## Summary

Add three scene controls to the toolbar — ⬜ empty, 🏔️ landscape 1 (rolling
purple-dirt hills, a valley lake, a rainbow, and a unicorn on a crest), and
🏝️ landscape 2 (a pink-sand beach sloping into a large pool, two rainbows,
and a unicorn near the shore) — each replacing the play area's entire
contents in one deterministic, atomic call. A new framework-free module,
`src/sim/scenes.ts`, owns scene generation: it clears the grid and object
lists (reusing the existing, unmodified `clearGrid`/`clearObjects`), then
writes terrain directly into the grid's `elements`/`shades` arrays and
places rainbows/unicorns through the existing, unmodified `placeObject` so
they inherit the per-type cap and behave as ordinary placed objects
(FR-014). Determinism (FR-023) comes from replacing every source of
randomness in generation with pure, position-keyed math — smooth height
functions for terrain, post-processed with a one-pass slope clamp so hills
and the beach are structurally at rest with no settle-simulation needed
(FR-020) — and a small deterministic hash for shade variation in place of
`randomShade()`'s `Math.random()`. Both the generators and the automated
tests (FR-028) share one small `sceneRegions(width, height)` helper that
expresses "the lower third," "the sky," and similar areas as fractions of
the actual grid size, which is what lets composition and test assertions
both hold at every supported play-area size (FR-022) without duplicating
proportional math. No existing sim file (`step.ts`, `objects.ts`,
`grid.ts`, `brush.ts`) is modified, which protects every 001/002/003 test
from regression by construction (FR-027); `PlayArea.svelte` gains one new
exported method (`loadScene`, mirroring the existing `clearAll`) and
`Toolbar.svelte` gains one new, visually separated button group, with scene
buttons carrying no selected-state binding at all (FR-006) — only CSS
`:active` press feedback, no new Svelte state.

## Technical Context

**Language/Version**: TypeScript 5.x, Node 22 (matches
`.github/workflows/deploy-pages.yml`) — unchanged from 001/002/003.

**Primary Dependencies**: `svelte` 5, `vite`, `@sveltejs/vite-plugin-svelte`,
`vite-plugin-singlefile`, `vitest`, `typescript` — unchanged; no new runtime
dependency is needed or justified (constitution Principle III). In
particular, no seeded-PRNG library is added — determinism is achieved with
plain, position-keyed arithmetic instead (research.md §1).

**Storage**: N/A — no persistence; a scene is only ever produced by an
explicit tap and is gone on reload (FR-015, inherited from 001/002/003's
no-persistence assumption).

**Testing**: `vitest`, extending `tests/unit/sim/*` with a new
`tests/unit/sim/scenes.test.ts` that imports `src/sim/scenes.ts` directly
and asserts on `Grid`/`ObjectsState` contents — no DOM, no browser
(constitution Principle V, FR-028). No existing test file needs to change,
because no existing sim file's exported contract changes.

**Target Platform**: Static single-file page opened via `file://` or served
from GitHub Pages; evergreen browsers on a mid-range laptop (mouse/
trackpad) and a tablet (touch) — unchanged.

**Project Type**: Single-page client-only web app — no backend/API.
Unchanged.

**Performance Goals**: Loading any scene completes within a single frame
with no visible partial draw (FR-024) — scene generation is a one-time
`O(width × height)` pass (43,200 cells at the current default 270×160 grid),
several orders of magnitude cheaper than a 16ms frame budget, so it needs
none of the hot-loop allocation discipline `step()` requires (constitution
Principle IV's allocation-free rule targets the *per-tick* loop, not a
one-shot event — research.md §7). Once loaded, a scene's contents are
ordinary grid cells and ordinary placed objects, so steady-state simulation
performance is governed entirely by 001/002/003's already-validated budget
(target 60fps, floor 30fps, SC-010) — this feature adds no new per-tick
cost.

**Constraints**: Production build still emits exactly one output file with
zero runtime network requests (FR-029); `loadScene` must be synchronous and
atomic — no intermediate mixed-content state is ever observable (FR-010);
scenes are never persisted or restored (FR-015); loading a scene must not
be triggered by, or interact with, the existing resize/rotation path —
`PlayArea.svelte`'s `ResizeObserver`-driven `resize()` only ever changes
display pixel dimensions and never calls into `scenes.ts`, so the existing
preserve-contents-on-resize behavior is untouched by construction (FR-016);
scene generation must not modify `step.ts`, `objects.ts`, `grid.ts`, or
`brush.ts`'s exported contracts (FR-027, protects every 001/002/003 test).

**Scale/Scope**: One feature, three prioritized user stories (load a
landscape, switch between worlds, keep playing on top of a world); adds one
new sim file (`src/sim/scenes.ts`), one new test file
(`tests/unit/sim/scenes.test.ts`), and small additive changes to three
existing UI files (`PlayArea.svelte`, `Toolbar.svelte`, `App.svelte`) plus
one new type alias in `src/sim/types.ts` — no new top-level architecture,
no new build tooling.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. One Self-Contained Page | No new build step or runtime dependency; scene generation runs entirely in `src/sim/*`/`src/lib/*` already bundled into `dist/index.html` by `vite-plugin-singlefile`; no new asset, font, or fetch is introduced (FR-029). | PASS |
| II. Built For An Almost-5-Year-Old | Three new large, round, emoji-labeled buttons (⬜🏔️🏝️) join the existing family; a tap always takes effect instantly with no dialog, message, or way to be "wrong" (FR-003, FR-026); mouse+touch parity is inherited unchanged from the existing pointer handlers. | PASS |
| III. Simple, Dependency-Light Svelte | No new dependency added or needed — determinism is plain arithmetic, not a PRNG library (research.md §1). `src/sim/scenes.ts` stays plain TypeScript operating on `Grid`/`ObjectsState`, isolated from Svelte exactly like `step.ts`/`objects.ts`; `Toolbar.svelte`'s new group is markup/CSS only, no new client state beyond the existing `tool`/`brushSize`. | PASS |
| IV. Performance Is A Feature | Grid size, `putImageData` render path, and `step()`'s per-tick shape are all unchanged. Scene generation is a single, one-time `O(width × height)` call triggered by a human tap (not a per-tick cost), well inside the single-frame budget (FR-024, research.md §7); the resulting contents run through the exact same, already-validated steady-state simulation path as hand-drawn contents. | PASS |
| V. Verifiable Without A Browser Harness | `npm run build` still emits a single `dist/index.html`; a new `tests/unit/sim/scenes.test.ts` covers every case FR-028 lists — expected elements in expected regions for each landscape, the empty scene's emptiness, full replacement on load, determinism, size robustness, and at-rest stability — directly against `Grid`/`ObjectsState`, no DOM. Visual quality (does a hill "look rolling," does a shoreline "read as a beach") is left to the maintainer's manual review, per the spec's own "Visual checks for the maintainer" section and this principle's existing precedent. No browser-automation infra added. | PASS |

No violations — Complexity Tracking is not needed. The two notable design
decisions — generating terrain from clamped smooth functions instead of a
seeded PRNG, and sharing one `sceneRegions` helper between generation and
tests — are both minimal, required consequences of FR-020 (at-rest on
load) and FR-023/FR-028 (determinism and region-based testability), not
constitution trade-offs, so they are recorded in research.md rather than
here.

## Project Structure

### Documentation (this feature)

```text
specs/004-landscape-scenes/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── scene-generation.md   # Phase 1 output
└── tasks.md              # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

This feature extends the scaffold established by `001-falling-pink-sand`,
`002-water-and-purple-dirt`, and `003-rainbow-unicorn-magic` (not
greenfield — `package.json`, `src/sim/*`, `src/lib/*`,
`tests/unit/sim/*` already exist, including `objects.ts`'s `placeObject`/
`removeObject`/`clearObjects` and `RAINBOW_SAND`/`OBJECT` elements, per this
spec's Assumptions — implementation of this feature waits for `003` to have
landed). Files marked **(new)** are added by this feature; files marked
**(modified)** have their contents changed but keep their existing
responsibility; everything else is unchanged.

```text
index.html                 # unchanged
package.json                # unchanged — no new dependency
tsconfig.json / vite.config.ts / vitest.config.ts   # unchanged

src/
├── main.ts                # unchanged
├── App.svelte             # (modified) wires a new onSelectScene handler that calls playArea.loadScene(id); tool/brushSize state untouched by scene selection (FR-004)
├── lib/
│   ├── PlayArea.svelte    # (modified) exports loadScene(sceneId), mirroring the existing clearAll(): calls sim/scenes.ts's loadScene against its own grid/objectsState, then resets particles and unicorn-burst timers exactly as clearAll already does
│   ├── Toolbar.svelte     # (modified) adds a new, visually separated "scenes" button group (⬜🏔️🏝️); none of the three ever receives a `selected` class — only CSS `:active` press feedback (FR-006)
│   ├── layout.ts          # unchanged — GRID_WIDTH/GRID_HEIGHT/OBJECT_FOOTPRINT_SIZE reused as-is by scenes.ts
│   └── particles.ts       # unchanged
└── sim/                   # framework-free, hot-path core (constitution III)
    ├── types.ts            # (modified) adds `SceneId = 'empty' | 'landscape1' | 'landscape2'`; no other type changes
    ├── element.ts          # unchanged
    ├── grid.ts             # unchanged — scenes.ts calls the existing clearGrid/setCell, no new grid.ts export needed
    ├── step.ts             # unchanged
    ├── objects.ts          # unchanged — scenes.ts calls the existing placeObject/clearObjects, no new objects.ts export needed
    ├── brush.ts             # unchanged
    ├── shade.ts             # unchanged — not called by scenes.ts (research.md §1)
    └── scenes.ts            # (new) sceneRegions/generateLandscape1/generateLandscape2/loadScene (contracts/scene-generation.md)

tests/
└── unit/
    └── sim/
        ├── grid.test.ts    # unchanged
        ├── step.test.ts    # unchanged
        ├── brush.test.ts   # unchanged
        ├── objects.test.ts # unchanged
        └── scenes.test.ts  # (new) region assertions for each landscape (FR-017, FR-018), empty-scene emptiness (FR-011), full-replacement-before-placement (FR-009), determinism (FR-023), size robustness (FR-022), at-rest stability (FR-020)
```

**Structure Decision**: Same single client-only project 001/002/003
established — no `backend/`/`frontend/` split, `src/sim/*` stays isolated
from Svelte for zero-DOM `vitest` coverage (constitution Principle V) and
because generation, like the rest of the sim core, has no business knowing
about the DOM. This feature adds exactly one new sim file (`scenes.ts`) and
one new test file, and touches three UI files only additively (new prop, new
exported method, new markup group) — no existing exported function's
signature changes anywhere in `src/sim/*`, which is what keeps every
001/002/003 test passing unmodified (FR-027, SC-012).

## Complexity Tracking

*No entries — Constitution Check reported no violations.*
