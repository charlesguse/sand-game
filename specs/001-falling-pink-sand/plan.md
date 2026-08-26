# Implementation Plan: Falling Pink Sand

**Branch**: `001-falling-pink-sand` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-falling-pink-sand/spec.md`

## Summary

Bootstrap the Rainbow Sand app (no scaffold exists yet) and ship the first
playable slice: a single self-contained page with a pink/rainbow header, a
canvas-backed falling-sand simulation, and a toolbar (sand / eraser / clear /
3 brush sizes) that a 4–5 year old can use with mouse or touch, at ~60fps,
with the fall/slide/rest rules covered by browser-free `vitest` unit tests.
The simulation core is plain TypeScript operating on typed-array grid state,
kept outside Svelte's reactivity so the per-frame hot path stays
allocation-free; Svelte 5 owns only the UI shell (header, toolbar, layout).
The production build emits exactly one `dist/index.html` via
`vite-plugin-singlefile`.

## Technical Context

**Language/Version**: TypeScript 5.x, Node 22 (matches `.github/workflows/deploy-pages.yml`)

**Primary Dependencies**: `svelte` 5, `vite`, `@sveltejs/vite-plugin-svelte`, `vite-plugin-singlefile`, `vitest`, `typescript`. No other runtime dependencies (constitution Principle III).

**Storage**: N/A — no persistence; each page load starts from an empty grid (spec Assumptions).

**Testing**: `vitest`, running the `src/sim/*` modules directly against plain typed-array grid state — no DOM/jsdom, no browser (constitution Principle V, FR-031).

**Target Platform**: Static single-file page opened via `file://` or served from GitHub Pages; evergreen browsers on a mid-range laptop (mouse/trackpad) and a tablet (touch). Phone-sized screens are not a target (spec Assumptions).

**Project Type**: Single-page client-only web app — no backend/API.

**Performance Goals**: 60fps target, ≥30fps acceptable floor (SC-003), at the default grid resolution with the play area at least half full of sand, on a mid-range laptop and a tablet.

**Constraints**: Production build emits exactly one output file with zero runtime network requests (FR-029, FR-030); no page scroll/zoom/bounce during touch drawing (FR-017, SC-004); grid's cell dimensions are fixed for the life of the page and independent of viewport (FR-005, FR-033); hot loop must be allocation-free (constitution Principle IV).

**Scale/Scope**: One feature, three prioritized user stories (draw & pile, erase & clear, tool/brush selection); a small app (~10–15 source files total).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. One Self-Contained Page | Vite + `vite-plugin-singlefile` produces `dist/index.html`; no runtime `fetch`/external assets; emoji rendered as text glyphs, not image URLs. | PASS |
| II. Built For An Almost-5-Year-Old | Emoji-labeled round buttons, no text/dialogs/scores/timers (FR-004, FR-021–028); mouse+touch parity (FR-016). | PASS |
| III. Simple, Dependency-Light Svelte | Stack is exactly Svelte 5 + Vite + `vite-plugin-singlefile`; sim core (`src/sim/`) is plain TS on a typed-array grid rendered to `<canvas>`; Svelte owns only the UI shell. No new dependency requires justification. | PASS |
| IV. Performance Is A Feature | `putImageData`-based render, allocation-free step function, typed-array grid; grid sized so 60fps is realistic (see research.md); degrade resolution before accepting jank per spec Assumptions. | PASS |
| V. Verifiable Without A Browser Harness | `npm run build` emits single `dist/index.html`; `vitest` unit tests cover FR-006–FR-010 directly on grid state, no DOM; no browser-automation infra added; visual checks left to maintainer per spec's "Visual checks" section. | PASS |

No violations — Complexity Tracking is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-falling-pink-sand/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output
│   └── sim-core.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

This is a greenfield checkout (no `package.json` yet); this plan establishes
the app scaffold alongside the feature.

```text
index.html                 # Vite entry HTML (single #app mount point)
package.json
tsconfig.json
vite.config.ts             # svelte() + singleFile() plugins
vitest.config.ts           # points at tests/unit, node environment (no DOM)

src/
├── main.ts                # bootstraps the Svelte app into #app
├── App.svelte             # layout: header, Toolbar, PlayArea
├── lib/
│   ├── PlayArea.svelte    # <canvas>, pointer/touch wiring, rAF render loop
│   ├── Toolbar.svelte     # emoji buttons: sand/eraser/clear + 3 brush sizes
│   └── layout.ts          # viewport→canvas scale + letterboxing math
└── sim/                   # framework-free, hot-path core (constitution III)
    ├── types.ts           # Grid, Tool, BrushSize types
    ├── grid.ts             # createGrid, get/set/clear, in-bounds helpers
    ├── step.ts             # step(grid): one tick of fall/slide/rest (FR-006–010)
    ├── brush.ts            # applyBrush(grid, tool, cx, cy, radius)
    └── shade.ts            # per-grain pink shade assignment (FR-012)

tests/
└── unit/
    └── sim/
        ├── grid.test.ts
        ├── step.test.ts
        └── brush.test.ts
```

**Structure Decision**: Single client-only project (no `backend/`/`frontend/`
split — there is no server). `src/sim/` is isolated from Svelte so it can be
unit-tested with `vitest` with zero DOM (constitution Principle V, FR-031)
and stays allocation-free for the render loop (Principle IV). `src/lib/*`
plus `App.svelte` form the UI shell (Principle III). This structure is the
foundation subsequent Rainbow Sand features (water, magic dirt, emoji
objects, scenes) will extend.

## Complexity Tracking

*No entries — Constitution Check reported no violations.*
