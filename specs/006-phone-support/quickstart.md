# Quickstart: Phone Support

How to build and validate this feature end-to-end once implemented. See
[data-model.md](./data-model.md) for entity details and
[contracts/layout-and-touch.md](./contracts/layout-and-touch.md) for the
sim/lib modules' APIs. This extends `specs/005-sparkle-magic-wand/
quickstart.md` — its build steps and single-file/offline validation still
apply unchanged and are not repeated in full here.

## Prerequisites

- Node 22 (matches `.github/workflows/deploy-pages.yml`)
- `npm install` from a checkout that already has features 001–005's
  scaffold (`package.json`, `src/sim/*` including `wand.ts`, `src/lib/*`
  including `sparkle.ts`, existing tests)
- A real Android Chrome phone and a real iOS Safari phone for the on-device
  checks — required for this feature specifically, unlike 001–005 which
  were laptop/tablet-only

## Build and run the tests

```bash
npm install
npm run build     # emits dist/index.html — must be the ONLY file in dist/
test -f dist/index.html
npm test           # vitest — layout/sim rules, no browser required
```

Both commands must succeed from a clean checkout, and every 001–005 test
must still pass unchanged (FR-033).

## Validate User Story 1 — the drawing area fills the phone screen (P1)

Reference: spec Acceptance Scenarios 1–7 under User Story 1.

**Automated coverage** (`tests/unit/lib/layout.test.ts`): build a
representative viewport table — phone portrait (e.g. 390×844), phone
landscape (844×390), small phone (e.g. 320×568), tablet portrait (e.g.
768×1024), tablet landscape (1024×768), laptop (e.g. 1440×900), and one
extreme aspect ratio (e.g. a very tall 400×1400 or very wide 2000×300
window) — and for each, compute a toolbar `thickness` via
`computeToolbarLayout`, derive the drawing region (`viewport minus
thickness` on the appropriate axis), call `computePlayField`, and assert:
`displayWidth/drawingRegionWidth >= 0.90` and `displayHeight/
drawingRegionHeight >= 0.90` (FR-001); on phone-sized entries,
`displayWidth * displayHeight` covers `>= 0.65` (portrait) or `>= 0.60`
(landscape) of the whole viewport area (FR-002); `cellSize` is identical on
both axes for every entry (FR-003, cells are always square by
construction); `cellSize >= 2` always and `>= 24 / (2*BRUSH_RADII.medium +
1)` on phone-sized entries (FR-005, FR-006); `gridWidth * gridHeight <=
CELL_BUDGET` for every entry (FR-007); and that the laptop entry's
`displayWidth`/`displayHeight` are each `>=` the value today's fixed-grid
formula (`GRID_WIDTH`/`GRID_HEIGHT` at the largest integer cell size that
fits) would have produced for the same viewport (FR-030, SC-006).

**On-device / manual** (maintainer, real Android Chrome phone, both
orientations): open the toy → the play area reads as "the whole screen,"
not a picture on a page; pour sand and confirm individual grains are
visible as chunky specks and a swipe leaves an obvious trail, not a
hairline (Scenario 3); confirm sand still falls, piles, and behaves
exactly as on a laptop (Scenario 7).

## Validate User Story 2 — drawing with a finger actually works (P2)

Reference: spec Acceptance Scenarios 1–12 under User Story 2.

**Automated coverage**: `tests/unit/lib/layout.test.ts` asserts
`clientToGrid`'s formula (reimplemented in the test as a pure helper
mirroring `PlayArea.svelte`'s — see contracts, §`clientToGrid`) maps a
representative set of touch points, including all four edges of the play
area, to the expected cell at several of the table's on-screen scales, with
no drift after a simulated resize (FR-012).

**On-device / manual** (Android Chrome and iOS Safari, per FR-010–FR-017):
press-and-drag paints continuously with no gaps on a fast swipe (Scenario
1); a single tap places one dab (Scenario 2); the eraser and rainbow/
unicorn placement work by touch exactly as by mouse (Scenarios 3–4);
touching or dragging on the play area never scrolls, bounces, pull-to-
refreshes, zooms, text-selects, or shows a long-press menu (Scenario 5);
double-tapping the play area does not zoom and places two dabs (Scenario
6); a touch at the very edge of the play area paints the correct cell
(Scenario 7); touching the margin outside the play area does nothing
(Scenario 8); a drag that slides onto the toolbar or off-screen keeps
tracking without painting outside the play area and ends cleanly on lift
(Scenario 9); a second simultaneous touch during a drag does not corrupt
the first stroke (Scenario 10); toolbar taps respond immediately with no
accidental paint (Scenario 11); on a laptop with a mouse, every behavior is
unchanged from before this feature (Scenario 12).

## Validate User Story 3 — the buttons are always there and always tappable (P3)

Reference: spec Acceptance Scenarios 1–10 under User Story 3.

**Automated coverage**: `tests/unit/lib/layout.test.ts` asserts, for every
phone-sized entry in the representative viewport table,
`computeToolbarLayout(...).fits === true` with `controlSize >=
MIN_TOUCH_TARGET` (44) (FR-020, FR-035), and that the resulting drawing
region (viewport minus the toolbar's `thickness`) still satisfies User
Story 1's fill floors when passed through `computePlayField` — i.e. the
toolbar's own space never pushes the play area below FR-001/FR-002
(FR-020a).

**On-device / manual**: with the address bar showing, every control is
fully visible with none clipped or hidden below the bottom edge (Scenario
1); as the address bar collapses and reappears while playing, every
control stays visible, the drawing is not lost, and there's no visible
jitter (Scenario 2); the page never scrolls or bounces at all (Scenario
3); every control is visible at once with nothing behind a menu or "more"
button (Scenario 4); every control's touchable area is at least 44 screen
pixels with clear separation from its neighbours (Scenario 5); on a
notched phone, no control is obscured by the notch, rounded corners, or
the home-indicator bar (Scenario 6); in landscape, controls form a narrow
rail down one side, all still visible and finger-sized, without the play
area falling below its fill requirement (Scenario 7); in portrait, a
too-wide row of controls wraps onto further rows, all visible, none
shrunk below finger-sized (Scenario 8); no control ever floats over the
play area, and a tap aimed at a button never paints (Scenario 9); on a
laptop or desktop, the toolbar looks and behaves as it does today
(Scenario 10).

## Validate User Story 4 — turning the phone sideways keeps the fun going (P4)

Reference: spec Acceptance Scenarios 1–7 under User Story 4.

**Automated coverage** (`tests/unit/sim/resize.test.ts`): seed a `Grid`
with a recognizable pattern (e.g. a "ground" row near the bottom plus a
distinct pile off-centre) via `setCell`, call `resizeGrid(grid, newWidth,
newHeight)` for a narrower/taller (portrait→landscape-like) and a
wider/shorter (landscape→portrait-like) target, and assert: every carried
cell lands at exactly `(x + offsetX, y + offsetY)` (FR-026); cells whose
offset destination falls outside the new bounds are absent, not clamped or
wrapped (Edge Cases); a cell adjacent to the bottom row before the resize
is still adjacent to the bottom row after (the "ground stays at the
ground" property); an object (via `placeObject` before resizing, then
manually offsetting to check against the caller-level repositioning logic
described in contracts/layout-and-touch.md) whose footprint no longer
fully fits after the offset is absent entirely — no partial/half-object
state — while one that fully fits keeps its exact new position and size;
calling `resizeGrid` with `newWidth === oldGrid.width && newHeight ===
oldGrid.height` is a no-op copy (every cell lands at its original
position, `offsetX === 0 && offsetY === 0`), covering the "same dimensions"
identity case that `PlayArea.svelte`'s compare-and-branch (FR-025) is
built to avoid calling in practice, but which `resizeGrid` itself must
still handle correctly as a pure function. `tests/unit/lib/layout.test.ts`
separately asserts that a viewport change which does *not* change
`computePlayField`'s output `gridWidth`/`gridHeight` (e.g. a small change
representing an address-bar collapse) is distinguishable, by pure
comparison of the before/after `PlayField`, from one that does — the
`PlayArea.svelte`-level "which branch to take" decision itself, being
DOM-driven, is exercised only by the on-device checks below.

**On-device / manual**: mid-drawing, rotate the phone → the play area
fills the new orientation to the same standard as a fresh load in that
orientation (Scenario 1); the drawing is still recognizably there, ground
at the bottom, pile roughly where it was (Scenario 2); drawing with a
finger immediately after rotation paints exactly under the finger at the
new scale (Scenario 3); no dialog, message, or error appears and the
simulation keeps running smoothly (Scenario 4); the selected tool and
brush size are unchanged after rotation (Scenario 5); rotating back and
forth ten times in a row leaves the toy in a normal playable state with no
error state, no stuck brush, and no change to tool/brush size (Scenario
6); a non-orientation viewport change (address bar collapsing, a desktop
window nudge) preserves the drawing exactly, with nothing cropped or
shifted (Scenario 7, FR-025 — the "no re-derivation" branch).

## Validate existing behavior is unchanged (FR-033, SC-018)

1. Run `npm test` and confirm every test carried over from
   `specs/001-falling-pink-sand` through `specs/005-sparkle-magic-wand`
   still passes, changed only where the Superseded requirements section
   makes an assertion obsolete (there are no such changes expected in this
   feature's own test additions — `computeCanvasSize`'s removal has no
   existing test coverage to update, since no `tests/unit/lib/*.test.ts`
   file existed before this feature; `layout.ts`'s constants that existing
   tests import — `GRID_WIDTH`, `GRID_HEIGHT`, `OBJECT_FOOTPRINT_SIZE`,
   `BRUSH_RADII` — keep their names and values, research.md §11).
2. In the running app on a laptop with a mouse, repeat 001–005's
   quickstart validation steps — piling, water flow, purple dirt, rainbow
   conversion, unicorn celebration, eraser, clear-all, brush sizes, scene
   loading, the sparkle wand — and confirm identical behavior and identical
   or larger play-area size to before this feature (FR-030).

## Manual-only checks (no automated coverage — spec's "On-device checks for the maintainer" section)

- On a real Android Chrome phone, the play area genuinely reads as "the
  whole screen," in both orientations.
- A fingertip swipe leaves a chunky, obviously visible trail; individual
  grains read as specks, not a smooth wash of color.
- All three brush sizes feel meaningfully different at phone scale.
- Drawing feels immediate and smooth, with no lag or stutter on a busy
  screen.
- The toolbar reads as a friendly row (or rail) of big round buttons, not a
  cramped strip; a small hand can hit any button without hitting its
  neighbour.
- Scrolling the page is impossible however the child swipes, including
  from the very top/bottom edges.
- Turning the phone feels like the toy adapting, not breaking.
- On iOS Safari specifically: no rubber-band bounce, no double-tap zoom, no
  text-selection callout, and the bottom controls clear the home
  indicator.
- On the laptop, the toy looks and feels exactly as it did before this
  change.

## Performance check (FR-031, SC-016)

On a mid-range phone: fill the (now larger, but cell-budget-capped) play
area with moving elements (pour continuously for a while, or load a
landscape scene and keep drawing) → confirm the devtools performance/FPS
overlay (remote-debugged from a desktop, or a visual smoothness judgment
if remote debugging isn't available) shows `>= 30fps` sustained, targeting
`60fps`. This is the same allocation-free hot loop `001`/`004`/`005`
already established (`step`, `applyRainbowConversions`,
`updateUnicorns`, `tickParticles`, `updateFlashMask`, `render`) running
against a grid whose cell count is capped at or below today's default
(FR-007) — this feature changes the grid's *shape* and the canvas's
*display* size, not the per-cell cost of any hot-loop function, so no
asymptotic or constant-factor regression is expected. A resize/re-
derivation itself (`resizeGrid`, `computePlayField`) runs once per settled
change (FR-027), off the animation-frame loop, so its cost — O(old grid
size) for the copy — never contends with the 60fps budget.
