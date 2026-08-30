# Implementation Plan: Canvas-First Toolbar Budget

**Branch**: `012-canvas-first-toolbar` | **Date**: 2026-08-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-canvas-first-toolbar/spec.md`

## Summary

Flip the toolbar/canvas sizing order: instead of `Toolbar.svelte` sizing
itself to its fixed-56px content and `PlayArea`'s `flex: 1` container
absorbing whatever's left (today's bug — 22% of an iPhone SE 3 in
portrait), the toolbar now caps its own box at
`min(naturalSizeAtPreferred, 40% of the constrained axis)` and the
drawing region gets everything past that cap, guaranteeing it at least
60% by construction (FR-001, FR-002). Within that cap, controls shrink
continuously — pitch (gaps/padding) first, down to a 4px floor, then
control size, down to the existing 44px `MIN_TOUCH_TARGET` — via a
monotonic binary search rather than a hard jump between two sizes
(FR-007, research.md §2), and the wrap model treats controls as one flat
sequence so multiple coloured groups can share a row or rail column
whenever they fit (FR-008). The whole computation lives in one rewritten
pure function, `computeToolbarLayout` in `src/lib/layout.ts` (extending
006's foundation, not replacing it), which `Toolbar.svelte` now actually
*runs* at render time (applying its `controlSize`/`pitch`/`thickness` as
CSS custom properties and an inline box size) instead of merely being
modeled by a parallel test — closing the exact drift 006's own check
missed (FR-014). A new plain module, `src/lib/toolbarControls.ts`, is the
single static list of every control the toolbar can show; `Toolbar.svelte`
renders by iterating it and the `vitest` suite imports it directly, so a
control's count can never again disagree between what's checked and what
ships (FR-013). When even the tightest legal arrangement (44px controls,
4px pitch) can't fit inside the 40% cap, `computeToolbarLayout` reports
`fits: false` with the exact thickness shortfall — a `vitest` failure that
blocks the build, never a runtime fallback (FR-012, FR-012a–c). No
`src/sim/*` file changes; a larger drawing region simply derives a larger
`computePlayField` result under 006's existing rules and cell-count
budget (FR-017).

## Technical Context

**Language/Version**: TypeScript 5.x, Node 22 (matches
`.github/workflows/deploy-pages.yml`) — unchanged from 001–011.

**Primary Dependencies**: `svelte` 5, `vite`, `@sveltejs/vite-plugin-svelte`,
`vite-plugin-singlefile`, `vitest`, `typescript` — unchanged; no new
runtime dependency. Every capability this feature needs
(`window.visualViewport`, `ResizeObserver`, `window.orientationchange`,
CSS custom properties, `env(safe-area-inset-*)`) is already in use by 006
on both target-browser families (research.md §6, §8).

**Storage**: N/A — unchanged; this feature persists nothing new (the
existing `localStorage` world/history save from 006/010/011 is untouched,
FR-017).

**Testing**: `vitest`. `tests/unit/lib/layout.test.ts` (existing file from
006) is substantially rewritten: its hand-maintained `TOOLBAR_CONTROL_
COUNT`/`TOOLBAR_GROUP_COUNT` constants and local `isToolbarRail`/
`drawingRegionFor` helpers are replaced by the new
`shippedToolbarControls` import and `computeToolbarLayout`'s own
`arrangement` field (contracts/toolbar-budget.md); its `VIEWPORT_TABLE` is
extended to SC-001's full 12-row table (research.md §10). No new test
file is needed — `toolbarControls.ts` is exercised through the same file,
since its only consumer besides `Toolbar.svelte` is the toolbar-layout
assertions. No DOM, no browser, matching constitution Principle V and
006's own precedent.

**Target Platform**: Static single-file page opened via `file://` or
served from GitHub Pages; evergreen browsers on a mid-range laptop,
tablet, and phone (Android Chrome, iOS Safari) — unchanged scope from 006,
this feature changes sizing, not supported platforms.

**Project Type**: Single-page client-only web app — no backend/API.
Unchanged.

**Performance Goals**: Steady 60fps target, 30fps floor (constitution
Principle IV) — unchanged; this feature touches only resize-time layout
arithmetic and CSS, never the per-frame `step`/`render` hot loop
(research.md §11). The two-phase binary search in `computeToolbarLayout`
runs only on a debounced, settled resize (`RESIZE_SETTLE_MS`), at most a
few dozen iterations of pure arithmetic — negligible next to a single
frame budget and off the animation-frame loop entirely.

**Constraints**: The per-frame simulation/render path stays allocation-
free and unchanged (constitution Principle IV) — this feature's new code
is entirely resize-driven `src/lib/*`, exempt from that discipline exactly
as 006's `resize.ts`/`layout.ts` already are. Production build still
emits exactly one output file with zero runtime network requests
(FR-019). The toolbar band's thickness must never exceed
`TOOLBAR_BAND_MAX_SHARE` (0.4) of the constrained axis, enforced by
`computeToolbarLayout`'s own postcondition (data-model.md), not by a
separate runtime clamp — there is no runtime fallback for a control set
that doesn't fit (FR-012); that state is unreachable in a build that
passed `npm test`.

**Scale/Scope**: One feature, three prioritized user stories (drawing
region floor; every control still finger-sized; the guarantee survives
future controls). Adds one new file (`src/lib/toolbarControls.ts`);
substantially rewrites `computeToolbarLayout` in `src/lib/layout.ts`
(signature and behavior both change — new constants
`TOOLBAR_BAND_MAX_SHARE`/`PREFERRED_CONTROL_SIZE`/`PREFERRED_PITCH`/
`MIN_PITCH`, `groupCount` parameter dropped, `ToolbarLayoutResult` shape
changed); rewrites `Toolbar.svelte`'s template (manifest-driven `{#each}`
instead of 24 hand-written `<button>` elements) and its `<style>` block
(CSS custom properties for control size/pitch instead of fixed `rem`
literals, removing the hard-coded landscape-phone media-query override);
substantially rewrites `tests/unit/lib/layout.test.ts`'s toolbar-layout
section. No change to `App.svelte`'s script, `PlayArea.svelte`, or any
`src/sim/*` file (research.md §1, §6, §11).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. One Self-Contained Page | No new build step, asset, font, or runtime dependency; the one new file (`toolbarControls.ts`) is plain TypeScript already bundled into `dist/index.html` by `vite-plugin-singlefile`, exactly like every existing `src/lib/*` module (FR-019). | PASS |
| II. Built For An Almost-5-Year-Old | No new control, no reading required — every existing button keeps its exact tap behavior (FR-011); controls only ever get closer to finger-friendly, never further (FR-007); nothing about this feature can fail, warn, or be "wrong" visibly to the child — a control set that doesn't fit blocks the *build*, not something she can ever see (FR-012, FR-018). | PASS |
| III. Simple, Dependency-Light Svelte | No new dependency. The sizing rule is one pure function in `src/lib/layout.ts`, isolated from Svelte exactly like `computePlayField`; `Toolbar.svelte` stays a thin consumer (reads the function's output, renders from the manifest) rather than growing its own parallel layout logic (research.md §5). | PASS |
| IV. Performance Is A Feature | No hot-loop (`step`/`render`) function changes; the new binary-search arithmetic runs only on a debounced resize, off the animation-frame loop, at negligible cost (Technical Context above). A larger phone-sized drawing region stays capped by 006's `CELL_BUDGET`, so the simulation is never more expensive than it is today (FR-017). | PASS |
| V. Verifiable Without A Browser Harness | `npm run build` still emits a single `dist/index.html`; `tests/unit/lib/layout.test.ts` covers every floor in FR-002/FR-004/FR-007/FR-009/FR-012–FR-015 directly against `computeToolbarLayout`/`shippedToolbarControls`/`computePlayField`, no DOM. The genuinely device-only behaviors (actual CSS custom-property application, safe-area insets on a notched device, emoji legibility at a shrunk size, the "does it feel big" judgment) are left to the maintainer's on-device review per quickstart.md's manual-check lists, matching this principle's existing precedent from every prior spec. No browser-automation infrastructure is added. | PASS |

No violations — Complexity Tracking is not needed. The one design decision
worth flagging as non-obvious (not a constitution trade-off, a technical
interpretation): FR-013's "derived from the toolbar the toy actually
ships" is satisfied by a shared plain-TypeScript manifest that
`Toolbar.svelte`'s template is *generated from*, rather than by
introspecting rendered DOM — the latter would require exactly the
browser-automation infrastructure Principle V forbids adding (research.md
§4).

## Project Structure

### Documentation (this feature)

```text
specs/012-canvas-first-toolbar/
├── plan.md                          # This file (/speckit-plan command output)
├── research.md                      # Phase 0 output
├── data-model.md                    # Phase 1 output
├── quickstart.md                    # Phase 1 output
├── contracts/
│   └── toolbar-budget.md            # Phase 1 output
└── tasks.md                         # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

This feature extends the scaffold established by `001-falling-pink-sand`
through `011-undo-that-survives-closing-the-app` (not greenfield —
`package.json`, `src/sim/*`, `src/lib/*` including 006's `layout.ts`,
`tests/unit/*` already exist). Files marked **(new)** are added by this
feature; files marked **(modified)** have their contents changed but keep
their existing responsibility; everything else is unchanged.

```text
index.html                  # unchanged
package.json                 # unchanged — no new dependency
tsconfig.json / vite.config.ts / vitest.config.ts   # unchanged

src/
├── main.ts                 # unchanged
├── App.svelte              # unchanged (research.md §1, §6) — flex layout and 480px rail media query already do what this feature needs once Toolbar bounds its own box; contracts/toolbar-budget.md notes a small additive flex-basis change as a fallback if needed
├── lib/
│   ├── PlayArea.svelte     # unchanged — its existing ResizeObserver-on-container already reacts correctly to any toolbar-driven change in the flex remainder (research.md §1)
│   ├── Toolbar.svelte      # (modified) manifest-driven {#each} render; self-measures viewport (visualViewport/ResizeObserver, RESIZE_SETTLE_MS-debounced); applies computeToolbarLayout's controlSize/pitch/thickness as CSS custom properties + inline box size; drops the fixed rem literals and the landscape-phone media-query override
│   ├── toolbarControls.ts  # (new) TOOLBAR_CONTROLS manifest + shippedToolbarControls — single source of truth for the control set (FR-013)
│   ├── layout.ts           # (modified) computeToolbarLayout rewritten (new constants, dropped groupCount, new ToolbarLayoutResult shape, two-phase continuous shrink); computePlayField/isPhoneSized/GRID_WIDTH/GRID_HEIGHT/CELL_BUDGET/MIN_CELL_SIZE/MEDIUM_STROKE_MIN_PX/PHONE_MAX_SHORT_SIDE/MIN_TOUCH_TARGET/RESIZE_SETTLE_MS/BRUSH_RADII/OBJECT_FOOTPRINT_SIZE all unchanged
│   ├── glyphSupport.ts     # unchanged — glyph choice is orthogonal to control size
│   ├── particles.ts        # unchanged
│   └── sparkle.ts          # unchanged
└── sim/                    # framework-free, hot-path core (constitution III) — entirely unchanged (research.md §11)
    └── ...                  # every file (types, grid, step, element, brush, objects, scenes, wand, shade, resize, history, save, historySave) unchanged

tests/
└── unit/
    ├── lib/
    │   ├── layout.test.ts       # (modified) rewritten toolbar-layout section: SC-001's full 12-row viewport table, shippedToolbarControls-derived control counts, computeToolbarLayout's new signature/shape, FR-012b shortfall-reporting assertion
    │   ├── fullscreen.test.ts   # unchanged
    │   ├── sound.test.ts        # unchanged
    │   ├── palette.test.ts      # unchanged
    │   └── glyphSupport.test.ts # unchanged
    ├── shell/                   # unchanged (indexHtml.test.ts, toolbarGlyphs.test.ts)
    └── sim/                     # unchanged — every file (grid, step, brush, objects, scenes, wand, resize, history, historySave, save, ...) untouched
```

**Structure Decision**: Same single client-only project 001–011
established — no `backend/`/`frontend/` split. This feature adds exactly
one new file (`src/lib/toolbarControls.ts`), substantially rewrites one
existing pure-logic function (`computeToolbarLayout` in `layout.ts`) and
its consumer (`Toolbar.svelte`), and rewrites the one test file that
already covered the toolbar's fit (`tests/unit/lib/layout.test.ts`) — no
new test directory, no new top-level architecture, no new build tooling.
Every `src/sim/*` file, `App.svelte`, and `PlayArea.svelte` are untouched,
which is what keeps every existing test outside `layout.test.ts` passing
unchanged (FR-021).

## Complexity Tracking

*No entries — Constitution Check reported no violations.*
