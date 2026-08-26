# Implementation Plan: Water and Magic Purple Dirt

**Branch**: `002-water-and-purple-dirt` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-water-and-purple-dirt/spec.md`

## Summary

Extend the Rainbow Sand toy (built by `001-falling-pink-sand`) with two new
elements — 💧 water and 💜 magic purple dirt — while leaving every existing
pink-sand behavior intact. Water falls, slides diagonally, and spreads
sideways to level itself, but never rises; pink sand and magic purple dirt
sink through it via a same-tick swap and otherwise pile identically to each
other. This requires re-expressing the sim core's grid representation from
001's single "occupied = shade" byte array into a per-cell `(element,
shade)` pair (two parallel typed arrays) so density (powder vs. liquid vs.
empty) can be checked independently of shade, plus a small per-tick `moved`
scratch buffer so water's new sideways movement can't double-hop within one
simulation step. The toolbar grows from 3 to up to 8 controls, with the
three element buttons (🩷 💧 💜) grouped as an obvious visual family. All new
rules are covered by `vitest` unit tests against grid state, no browser
required, and the production build continues to emit exactly one
self-contained `dist/index.html`.

## Technical Context

**Language/Version**: TypeScript 5.x, Node 22 (matches `.github/workflows/deploy-pages.yml`) — unchanged from 001.

**Primary Dependencies**: `svelte` 5, `vite`, `@sveltejs/vite-plugin-svelte`, `vite-plugin-singlefile`, `vitest`, `typescript` — unchanged from 001; no new runtime dependency is needed or justified (constitution Principle III).

**Storage**: N/A — no persistence; each page load starts from an empty grid (spec Assumptions, inherited from 001).

**Testing**: `vitest`, running `src/sim/*` modules directly against plain typed-array grid state — no DOM/jsdom, no browser (constitution Principle V, FR-029). Extends 001's `tests/unit/sim/{grid,step,brush}.test.ts`.

**Target Platform**: Static single-file page opened via `file://` or served from GitHub Pages; evergreen browsers on a mid-range laptop (mouse/trackpad) and a tablet (touch) — unchanged from 001.

**Project Type**: Single-page client-only web app — no backend/API. Unchanged from 001.

**Performance Goals**: 60fps target, ≥30fps acceptable floor (SC-006), at the default grid resolution with the play area at least half full of a mixture of all three elements, and separately with the play area entirely filled with actively flowing water (the new worst case this feature introduces).

**Constraints**: Production build still emits exactly one output file with zero runtime network requests (FR-031); element count is conserved every tick — nothing created, destroyed, or converted except by the drawing tools (FR-003, SC-005); water must never occupy a row above one it already occupied (FR-010, SC-015); hot loop stays allocation-free including the new `moved` scratch buffer, which is preallocated once per grid rather than per tick (constitution Principle IV, research.md §4).

**Scale/Scope**: One feature, four prioritized user stories (pour water, sink sand through water, purple dirt, tool/eraser/clear polish); extends the existing ~10–15 source files with roughly 3 changed sim files (`types.ts`, `grid.ts`, `step.ts`, `brush.ts` bodies), 1 new sim file (`element.ts`), and UI/toolbar changes — no new top-level architecture.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. One Self-Contained Page | No new build step or runtime dependency; still `vite-plugin-singlefile` → single `dist/index.html`; water/dirt render as canvas pixels and emoji glyphs only, no new external assets. | PASS |
| II. Built For An Almost-5-Year-Old | Three element buttons stay large, round, emoji-labeled, grouped and obviously highlighted (FR-017–FR-020, FR-025); no new text, dialogs, scores, or failure states; mouse+touch parity inherited unchanged from 001. | PASS |
| III. Simple, Dependency-Light Svelte | No new dependency added or needed. `src/sim/*` stays plain TypeScript/typed-arrays, isolated from Svelte; the only structural change (two arrays instead of one) is required by the spec's three-element requirement (FR-001), not by any framework preference. | PASS |
| IV. Performance Is A Feature | Grid size, `putImageData` render path, and one-pass-per-tick shape are all unchanged from 001; new work per cell (an extra array read, a `moved` check, occasional extra neighbor reads for water) adds no allocation and no new asymptotic cost (research.md §7). Worst case (all-water, actively flowing) is the explicit SC-006 target. | PASS |
| V. Verifiable Without A Browser Harness | `npm run build` still emits a single `dist/index.html`; new `vitest` unit tests cover every new rule in FR-029 directly against grid state, no DOM; no browser-automation infra added; visual/feel checks left to the maintainer per spec's "Visual checks" section. | PASS |

No violations — Complexity Tracking is not needed. The one notable design
decision — replacing 001's single-array `Grid.cells` with `elements` +
`shades` + a `moved` scratch array — is a required consequence of FR-001
(three distinguishable elements) and FR-006 (sideways spread needing
double-hop prevention), not a constitution trade-off, so it is recorded in
research.md rather than here.

## Project Structure

### Documentation (this feature)

```text
specs/002-water-and-purple-dirt/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/            # Phase 1 output
│   └── sim-core.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

This feature extends the scaffold established by `001-falling-pink-sand`
(not greenfield — `package.json`, `src/sim/*`, `src/lib/*` already exist by
the time this feature is implemented, per spec Assumptions). Files marked
**(new)** are added by this feature; files marked **(modified)** have their
contents changed but keep their existing responsibility.

```text
index.html                 # unchanged
package.json                # unchanged — no new dependency
tsconfig.json / vite.config.ts / vitest.config.ts   # unchanged

src/
├── main.ts                # unchanged
├── App.svelte             # (modified) tool $state widens to include 'water' | 'dirt'
├── lib/
│   ├── PlayArea.svelte    # (modified) render loop branches on element for color (research.md §6)
│   ├── Toolbar.svelte     # (modified) adds 💧/💜 buttons, groups the three element buttons (research.md §9)
│   └── layout.ts          # unchanged
└── sim/                   # framework-free, hot-path core (constitution III)
    ├── types.ts            # (modified) EMPTY/SAND/WATER/DIRT constants, Grid gains elements/shades/moved, Tool widens
    ├── element.ts          # (new) isPowder / isLiquid predicates
    ├── grid.ts             # (modified) createGrid/getElement/getShade/setCell/clearGrid over the new fields
    ├── step.ts             # (modified) adds water fall/diagonal/sideways and powder sink-swap rules, moved-flag scan
    ├── brush.ts            # (modified) element-aware painting-priority rule (research.md §8)
    └── shade.ts            # unchanged — randomShade() signature/behavior untouched (research.md §6)

tests/
└── unit/
    └── sim/
        ├── grid.test.ts    # (modified) updated for elements/shades/moved fields
        ├── step.test.ts    # (modified) extended with water and sink-swap cases
        └── brush.test.ts   # (modified) extended with the painting-priority matrix
```

**Structure Decision**: Same single client-only project 001 established —
no `backend/`/`frontend/` split, `src/sim/*` stays isolated from Svelte for
zero-DOM `vitest` coverage (constitution Principle V) and allocation-free
hot-path execution (Principle IV). This feature adds one new sim file
(`element.ts`) and modifies the sim/UI files listed above; it introduces no
new top-level directory and no new build tooling.

## Complexity Tracking

*No entries — Constitution Check reported no violations.*
