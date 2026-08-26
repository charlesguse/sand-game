# Implementation Plan: Phone Support

**Branch**: `spec/006-phone-support` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-phone-support/spec.md`

## Summary

Make the drawing area fill a phone screen and make touch drawing work by
replacing the fixed 270×160 play field with one whose shape *and*
resolution are derived from the drawing region every time it's measured
(FR-004), while keeping the total cell count capped at today's 43,200 so a
phone gets chunkier grains, not a slower simulation (FR-007). The core
change is a new pure function, `computePlayField(drawingRegionWidth,
drawingRegionHeight, isPhone)` in `src/lib/layout.ts`, replacing
`computeCanvasSize`'s "largest integer cell size for a fixed grid" with
"cell size floored by whichever of three constraints binds hardest —
FR-007's cell-count budget, FR-005's 2px visibility minimum, and (on phone)
FR-006's 24px medium-stroke minimum — then grid dimensions floored to fit
inside that cell size" (research.md §1). `PlayArea.svelte`'s existing
`ResizeObserver`-driven `resize()` (already the mechanism `001` used to
rescale the canvas) is extended to also measure the true visible viewport
via `window.visualViewport` (FR-022), debounce across
`ResizeObserver`/`visualViewport`/`orientationchange` events by 150ms
(FR-027), and — only when the newly computed grid dimensions actually
differ from the live grid's — swap to a freshly `resizeGrid`'d `Grid`
whose contents are carried at a fixed bottom-centre-anchored offset
(research.md §5, FR-026), dropping what falls outside the new bounds and
never regenerating a loaded scene (FR-029); every other resize leaves the
`Grid` untouched and only rescales the canvas's CSS size, so the very
common address-bar-collapse/desktop-nudge case preserves the drawing
exactly (FR-025). The toolbar's portrait wrap and new landscape-phone rail
are both plain CSS flexbox (`flex-wrap` rotated between row and column via
one new media query), matching how `Toolbar.svelte` already wraps today —
no new client-side layout logic — with a parallel pure function,
`computeToolbarLayout`, added purely so the no-DOM `vitest` suite can prove
FR-035's toolbar-fit requirement the way `computeCanvasSize` already proved
canvas sizing for `001` (research.md §6). Touch-gesture prevention needs
only two small additive CSS rules (`user-select`/`-webkit-touch-callout`
for FR-013's remaining gap; `env(safe-area-inset-*)` plus `viewport-fit=
cover` for FR-023's notch/home-indicator requirement) — reading the
current `index.html` confirms scroll/bounce/pull-to-refresh/zoom
prevention already shipped with a prior feature, matching the spec's own
Assumptions section ("the touch event path is already largely correct").
`OBJECT_FOOTPRINT_SIZE` and the `GRID_WIDTH`/`GRID_HEIGHT` constants stay
fixed (research.md §3, §11), so `objects.ts`, `scenes.ts`, and their
existing tests need no change at all — the only new/changed `src/sim/*`
file is a new `resize.ts`.

## Technical Context

**Language/Version**: TypeScript 5.x, Node 22 (matches
`.github/workflows/deploy-pages.yml`) — unchanged from 001–005.

**Primary Dependencies**: `svelte` 5, `vite`, `@sveltejs/vite-plugin-svelte`,
`vite-plugin-singlefile`, `vitest`, `typescript` — unchanged; no new
runtime dependency. Every new capability this feature needs
(`window.visualViewport`, `ResizeObserver` — already used by `001` —,
`window.orientationchange`, CSS `dvh`, CSS `env(safe-area-inset-*)`, CSS
`flex-wrap`) is a native browser API on the two named target browsers
(research.md §12).

**Storage**: N/A — unchanged; nothing new is persisted (spec's own
Assumptions section, FR-032's "no failure state" carries the existing
"nothing persisted" assumption forward unchanged).

**Testing**: `vitest`, adding `tests/unit/lib/layout.test.ts` (new
directory — the first `tests/unit/lib/*` file; `layout.ts`'s functions are
plain, DOM-free TypeScript, so this fits the existing no-DOM `vitest`
convention `tests/unit/sim/*` already established) and
`tests/unit/sim/resize.test.ts`. Both import only plain functions/`Grid`
values, no Svelte, no DOM (constitution Principle V, FR-035). No existing
test file's assertions need to change; `objects.test.ts`/`scenes.test.ts`
keep importing `OBJECT_FOOTPRINT_SIZE`/`GRID_WIDTH`/`GRID_HEIGHT` from
`layout.ts` unchanged (research.md §11). The DOM-dependent parts of this
feature — actual CSS flexbox wrapping, `visualViewport`-driven resize
debouncing, real touch-gesture prevention, on-screen glyph legibility — are
not unit-testable without a browser and are the maintainer's on-device job
per quickstart.md, matching constitution Principle V's existing precedent
for visual/feel checks.

**Target Platform**: Static single-file page opened via `file://` or served
from GitHub Pages; evergreen browsers on a mid-range laptop (mouse/
trackpad), a tablet (touch), **and now explicitly a mid-range phone —
Android Chrome and iOS Safari, named in the originating issue** (FR-010,
FR-031). This is the one Technical Context field that materially changes
from `005`: phone is newly a first-class target, superseding `005`'s own
assumption that "phone-sized screens are not a target" (spec's Superseded
requirements section).

**Project Type**: Single-page client-only web app — no backend/API.
Unchanged.

**Performance Goals**: Steady 60fps target, 30fps floor (constitution
Principle IV, FR-031), now explicitly required on a mid-range phone with
the (cell-budget-capped) play field full of moving elements — the worst
case named by FR-031/SC-016. Because `CELL_BUDGET` caps every derived grid
at or below today's 43,200 cells (FR-007), and no per-cell hot-loop
function (`step`, `applyRainbowConversions`, `updateUnicorns`,
`tickParticles`, `updateFlashMask`, `render`) changes its per-cell cost,
this is a bound on the *existing* worst case, not a new one — the only new
per-frame-adjacent cost is `resizeGrid`'s one-time O(old grid size) copy,
which runs off the animation-frame loop, at most once per 150ms-debounced
settled resize (FR-027).

**Constraints**: The per-frame simulation/effect/render path must stay
allocation-free (constitution Principle IV) — unchanged by this feature,
since no hot-loop function's shape changes; the new `resize.ts`/
`layout.ts` code is resize-driven, not frame-driven, so it is exempt from
the same allocation-free discipline the hot loop needs, exactly as
`placeObject`/`eraseObjectsInBrushLine` already are. Production build
still emits exactly one output file with zero runtime network requests
(FR-034, unchanged from every prior feature). The play area must never be
distorted to hit its fill targets — cells stay square on every viewport
(FR-003), enforced by construction in `computePlayField` (research.md §1)
rather than by a separate check.

**Scale/Scope**: One feature, four prioritized user stories (fill the
screen; touch drawing; toolbar fit; rotation). Adds two new files
(`src/sim/resize.ts`, `tests/unit/lib/layout.test.ts` plus
`tests/unit/sim/resize.test.ts`); rewrites `src/lib/layout.ts`'s exported
surface (`computeCanvasSize` → `computePlayField` plus three new small
functions/constants — `isPhoneSized`, `computeToolbarLayout`,
`RESIZE_SETTLE_MS`/`MIN_TOUCH_TARGET`/`PHONE_MAX_SHORT_SIDE`/
`MEDIUM_STROKE_MIN_PX`); makes moderate changes to `PlayArea.svelte`
(reassignable `grid`/`imageData`/`flashMask`, debounced multi-source
resize, re-derivation branch) and small additive CSS-only changes to
`App.svelte`, `Toolbar.svelte`, `index.html`. No change to `src/sim/
{types,grid,step,element,brush,objects,scenes,wand,shade}.ts` beyond the
new `resize.ts` sitting alongside them — every existing exported
function's signature in `src/sim/*` is unchanged (research.md §3, §11). No
new top-level architecture, no new build tooling.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. One Self-Contained Page | No new build step, asset, font, or runtime dependency; every new/changed file lives in `src/sim/*`/`src/lib/*`, already bundled into `dist/index.html` by `vite-plugin-singlefile` (FR-034). `viewport-fit=cover` and `env(safe-area-inset-*)` are plain CSS/HTML, not assets. | PASS |
| II. Built For An Almost-5-Year-Old | No new control, no reading required anywhere in this feature — it is entirely sizing/layout/touch, not new gameplay; controls get *more* finger-friendly (44px minimum, FR-020), not less; nothing about this feature can fail, warn, or be "wrong" (FR-032). Mouse and touch both remain fully supported (FR-030, FR-010–FR-017). | PASS |
| III. Simple, Dependency-Light Svelte | No new dependency added or needed (research.md §12) — every new capability is a native browser API already available on the target browsers. `src/sim/resize.ts` stays plain TypeScript operating on `Grid`, isolated from Svelte exactly like `brush.ts`/`objects.ts`/`wand.ts`. The toolbar's responsive wrap/rail is plain CSS flexbox, not new JS layout logic (research.md §6) — the simplest mechanism that satisfies FR-020a, matching the project's existing wrap behavior rather than inventing a parallel one. | PASS |
| IV. Performance Is A Feature | Grid size stays capped at today's cell count (FR-007); no hot-loop function's per-cell cost changes; the one new per-resize cost (`resizeGrid`'s copy) is debounced to at most once per settled change and runs outside the animation-frame loop (FR-027). The explicit new worst case — a full phone-sized play field in motion — is exactly what FR-031/SC-016 require staying at `>=30fps`, targeting `60fps`, and the budget cap is what keeps it no worse than today's already-accepted worst case. | PASS |
| V. Verifiable Without A Browser Harness | `npm run build` still emits a single `dist/index.html`; new `tests/unit/lib/layout.test.ts` and `tests/unit/sim/resize.test.ts` cover every case FR-035 lists — fill percentages, square cells, minimum cell size, minimum medium-stroke width, cell-count budget, laptop non-regression, coordinate mapping, exact preservation without re-derivation, anchored preservation across a re-derivation, and phone toolbar fit/touch targets — directly against pure functions and `Grid` state, no DOM. The genuinely DOM-only behaviors this feature touches (actual CSS flexbox wrap/rail rendering, `visualViewport`-driven debounce timing in a real browser, on-device touch-gesture prevention, glyph legibility) are left to the maintainer's on-device review, per this principle's existing precedent (`004`'s visual checks, `005`'s sparkle/burst feel) and quickstart.md's explicit manual-check list. No browser-automation infra is added. | PASS |

No violations — Complexity Tracking is not needed. The most consequential
design decision — deriving both play-field shape and resolution from the
drawing region rather than keeping a fixed grid — is not a constitution
trade-off; it is the spec's own explicitly accepted supersession of `001`'s
FR-005/FR-033/FR-034 (recorded in spec.md's Superseded requirements
section and in this plan's Summary), decided at the spec/clarification
stage, not here.

## Project Structure

### Documentation (this feature)

```text
specs/006-phone-support/
├── plan.md                          # This file (/speckit-plan command output)
├── research.md                      # Phase 0 output
├── data-model.md                    # Phase 1 output
├── quickstart.md                    # Phase 1 output
├── contracts/
│   └── layout-and-touch.md          # Phase 1 output
└── tasks.md                         # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

This feature extends the scaffold established by `001-falling-pink-sand`
through `005-sparkle-magic-wand` (not greenfield — `package.json`,
`src/sim/*`, `src/lib/*`, `tests/unit/sim/*` already exist, including
`005`'s landed `wand.ts`/`sparkle.ts`). Files marked **(new)** are added by
this feature; files marked **(modified)** have their contents changed but
keep their existing responsibility; everything else is unchanged.

```text
index.html                  # (modified) viewport-fit=cover; user-select/touch-callout CSS additions
package.json                 # unchanged — no new dependency
tsconfig.json / vite.config.ts / vitest.config.ts   # unchanged

src/
├── main.ts                 # unchanged
├── App.svelte              # (modified) 100dvh fallback height; new landscape-phone rail media query
├── lib/
│   ├── PlayArea.svelte     # (modified) reassignable grid/imageData/flashMask; debounced multi-source resize(); re-derivation branch via resize.ts; clientToGrid reads live grid dims
│   ├── Toolbar.svelte      # (modified) CSS custom properties from layout.ts's sizing constants; landscape-rail flex-direction; safe-area padding; user-select/touch-callout CSS
│   ├── layout.ts           # (rewritten) computeCanvasSize removed; computePlayField/isPhoneSized/computeToolbarLayout added; GRID_WIDTH/GRID_HEIGHT/BRUSH_RADII/OBJECT_FOOTPRINT_SIZE unchanged
│   ├── particles.ts        # unchanged
│   └── sparkle.ts          # unchanged
└── sim/                    # framework-free, hot-path core (constitution III)
    ├── types.ts             # unchanged
    ├── element.ts           # unchanged
    ├── grid.ts              # unchanged — createGrid/setCell/clearGrid/etc. already take width/height as params, no change needed for a dynamically-sized grid
    ├── step.ts              # unchanged
    ├── brush.ts             # unchanged
    ├── objects.ts           # unchanged — OBJECT_FOOTPRINT_SIZE stays fixed (research.md §3)
    ├── shade.ts             # unchanged
    ├── scenes.ts            # unchanged
    ├── wand.ts               # unchanged
    └── resize.ts             # (new) resizeGrid — bottom-centre-anchored content carry-over (contracts/layout-and-touch.md)

tests/
└── unit/
    ├── lib/                  # (new directory)
    │   └── layout.test.ts    # (new) computePlayField/isPhoneSized/computeToolbarLayout across the representative viewport table (FR-035)
    └── sim/
        ├── grid.test.ts      # unchanged
        ├── step.test.ts      # unchanged
        ├── brush.test.ts     # unchanged
        ├── objects.test.ts   # unchanged
        ├── scenes.test.ts    # unchanged
        ├── wand.test.ts      # unchanged
        └── resize.test.ts    # (new) resizeGrid's bottom-centre offset, clean-drop, and identity-case behavior (FR-026)
```

**Structure Decision**: Same single client-only project 001–005
established — no `backend/`/`frontend/` split, `src/sim/*` stays isolated
from Svelte for zero-DOM `vitest` coverage (constitution Principle V). This
feature adds exactly one new `src/sim/*` file (`resize.ts`) and one new
test directory (`tests/unit/lib/`), rewrites `layout.ts`'s exported surface
(the one intentional breaking change — `computeCanvasSize` is removed, with
no other caller to update since `PlayArea.svelte` was its only consumer),
and touches three Svelte components by CSS/measurement changes only — no
existing `src/sim/*` exported function's signature changes anywhere,
which is what keeps every 001–005 sim-layer test passing unchanged
(FR-033).

## Complexity Tracking

*No entries — Constitution Check reported no violations.*
