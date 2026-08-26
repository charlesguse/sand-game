# Phase 0 Research: Phone Support

This feature's own Clarifications session (2026-08-26, recorded in
`spec.md`) already resolved the three product-intent questions raised while
drafting — derive both play-field shape and resolution from the drawing
region (FR-004), a compact always-visible toolbar that wraps/rails rather
than overlays (FR-020a/FR-020b), and best-effort bottom-centre-anchored
preservation across a re-derivation (FR-026). No `[NEEDS CLARIFICATION]`
marker remains in `spec.md`. This document resolves the remaining
*implementation-technology* unknowns needed to fill Technical Context and
unblock Phase 1 design — how to compute the play field, how to detect and
debounce a re-derivation, how to carry content across one, and how the
toolbar's fit is verified without a browser.

This feature is a direct extension of `001-falling-pink-sand` through
`005-sparkle-magic-wand`. The current `src/lib/layout.ts` (read from the
checked-out code) is: `GRID_WIDTH = 270`, `GRID_HEIGHT = 160`,
`BRUSH_RADII = { small: 2, medium: 4, large: 7 }`,
`OBJECT_FOOTPRINT_SIZE = 24`, and `computeCanvasSize(viewportWidth,
viewportHeight, gridWidth = GRID_WIDTH, gridHeight = GRID_HEIGHT)`, which
picks the largest *integer* cell size that fits the fixed grid inside the
viewport. `PlayArea.svelte` creates one `Grid` at `GRID_WIDTH ×
GRID_HEIGHT` for the life of the component, resizes only the canvas's CSS
`width`/`height` on a `ResizeObserver`, and maps pointer events to cells via
`GRID_WIDTH`/`GRID_HEIGHT` divided by `canvas.getBoundingClientRect()`.
`App.svelte`'s `main` is `height: 100vh`, column flex (play area, then
toolbar). `index.html` already sets `overscroll-behavior: none`,
`touch-action: none`, and `user-scalable=no` at the `html`/`body` level —
prior-feature groundwork the issue itself noted ("the touch event path
looks correct in code").

## 1. Play field shape and resolution: one formula, replacing the fixed grid

- **Decision**: A single new function, `computePlayField(drawingRegionWidth,
  drawingRegionHeight, isPhone)`, replaces `computeCanvasSize`. It picks an
  on-screen cell size (may be fractional) as
  `cellSize = max(MIN_CELL_SIZE, budgetFloor, phoneStrokeFloor)`, where
  `budgetFloor = sqrt((regionW * regionH) / CELL_BUDGET)` (the smallest
  cell size that keeps the region's cell count at or under
  `CELL_BUDGET = GRID_WIDTH * GRID_HEIGHT = 43,200`, FR-007) and
  `phoneStrokeFloor = isPhone ? MEDIUM_STROKE_MIN_PX / (2 * BRUSH_RADII.medium + 1) : 0`
  (the smallest cell size whose medium-brush stroke — a 9-cell diameter at
  today's radius — reaches the 24px minimum, FR-006). Grid dimensions are
  then `gridWidth = floor(regionW / cellSize)`, `gridHeight = floor(regionH
  / cellSize)` (both cells are the same size, so shape follows the region's
  aspect ratio directly — FR-003). `MIN_CELL_SIZE = 2` (FR-005) is a floor
  under both of the other two, so it only binds when neither applies.
- **Rationale**: This is the direct arithmetic reading of FR-004
  ("derive both shape and resolution from the drawing region") combined
  with the three simultaneous floors the spec places on cell size (FR-005
  general minimum, FR-006 phone-only stroke-visibility minimum) and ceiling
  (FR-007's budget, expressed as a floor on cell size rather than a cap on
  grid dimensions, which is what keeps cell count under budget *before*
  rounding rather than requiring a fix-up after). Using `floor` rather than
  `round` for the grid dimensions guarantees `gridWidth * cellSize ≤
  regionW` and `gridHeight * cellSize ≤ regionH`, so `gridWidth ×
  gridHeight ≤ regionW × regionH / cellSize² ≤ CELL_BUDGET` always holds by
  construction — no post-hoc clamping needed. Because `cellSize` is the
  same on both axes, the resulting `gridWidth × cellSize` and `gridHeight ×
  cellSize` differ from `regionW`/`regionH` by less than one cell width —
  negligible against a grid of dozens-to-hundreds of cells across, which is
  what keeps the fill comfortably above the 90% floor (FR-001) without a
  separate fill-percentage check in the formula itself.
- **Alternatives considered**: Keep the fixed 270×160 grid and only change
  `computeCanvasSize` to allow fractional/non-uniform scaling — rejected in
  the spec's own Clarifications session (superseded requirements section)
  because it fails the portrait fill requirement outright (a 1.7:1 grid
  cannot fill a ~1:2 screen without either huge margins or non-square
  cells). Choosing cell size from a lookup table of breakpoints (phone/
  tablet/desktop) instead of a continuous formula — rejected: it would
  produce visible jumps at breakpoint boundaries (violating the "no visible
  jitter" spirit of FR-022) and doesn't naturally generalize to the
  arbitrary/extreme aspect ratios the Edge Cases section calls out
  (foldables, split-screen).

## 2. "Phone-sized" is a viewport classification, independent of the drawing region

- **Decision**: `isPhoneSized(viewportWidth, viewportHeight)` — `true` when
  `min(viewportWidth, viewportHeight) <= PHONE_MAX_SHORT_SIDE` (480,
  per spec's Requirements preamble) — is computed from the **whole visible
  viewport**, not from the drawing region `computePlayField` receives. The
  caller (`PlayArea.svelte`) measures the viewport once per resize (via
  `window.visualViewport` with an `innerWidth`/`innerHeight` fallback — see
  §8) and passes the resulting boolean into `computePlayField` as `isPhone`.
- **Rationale**: The spec's own definition ("a visible viewport whose
  shorter side is at most 480 screen pixels") is explicit that this is a
  device/window property, not a drawing-region property — the drawing
  region is already narrower than the viewport once the toolbar's rail
  width is subtracted in landscape, so reusing the region's own dimensions
  for this test would misclassify a tablet with a wide toolbar rail as
  "phone-sized." Keeping the two measurements (full viewport vs. drawing
  region) as separate parameters to `computePlayField` keeps the function
  pure and keeps this distinction explicit and testable.
- **Alternatives considered**: Infer phone-ness from the drawing region's
  own shorter side — rejected for the misclassification risk above. User-
  agent sniffing — explicitly rejected by the spec's own Assumptions
  section ("'Phone-sized' is defined by the viewport, not by user-agent
  sniffing").

## 3. Object footprint stays a fixed 24-cell constant

- **Decision**: `OBJECT_FOOTPRINT_SIZE` remains the existing fixed constant
  (24 cells), unchanged in `placeObject`/`scenes.ts`/their tests. It is
  **not** made a function of the derived play field's resolution.
- **Rationale**: The spec's Assumptions section says objects should "stay
  recognisable emoji at phone scale," which is a soft, non-FR/SC framing
  (no acceptance scenario or functional requirement gives a pixel or
  proportion target for objects). Working the actual numbers under §1's
  formula shows the existing constant already behaves the right way without
  any change: a representative desktop drawing region (~1900×950) yields a
  grid around 294×147 cells, so the 24-cell footprint is ~8% of the grid's
  width; a representative phone-portrait drawing region (~390×700) yields a
  grid around 146×262 cells (fewer *columns* than desktop, because the
  phone-stroke floor from §1 keeps cell size larger than the budget alone
  would pick), so the same 24-cell footprint is ~16% of the grid's width —
  proportionally *larger*, not smaller, on phone. The absolute on-screen
  size does shrink (roughly 155px desktop → 64px phone in this example),
  but 64px against a 390px-wide screen is still a large, unambiguous glyph.
  Making the footprint a function of `cellSize`/grid resolution instead
  would require `placeObject` to take a size parameter and would ripple
  into both `scenes.ts` generators (which reference the constant directly
  for unicorn vertical placement) and three existing test files
  (`objects.test.ts`, `scenes.test.ts`) — real cost for a requirement the
  spec doesn't actually impose as measurable.
- **Alternatives considered**: A `computeObjectFootprintCells(cellSize,
  gridShorterDim)` function targeting a fixed on-screen pixel size —
  considered and rejected per the above: the fixed constant already
  produces reasonable, appropriately-larger-on-phone results by the
  interplay of §1's own floors, so the added surface area and test churn
  buys nothing the spec requires.

## 4. Re-derivation: debounce, recompute, and compare — one mechanism for FR-025/026/027

- **Decision**: `PlayArea.svelte` keeps one `resize()` function, now
  triggered by a ~150ms debounce (`RESIZE_SETTLE_MS`) fed by three event
  sources: the existing `ResizeObserver` on `container` (catches the
  drawing region's own shape changes, including CSS media-query flips), a
  `window.visualViewport` `resize` listener (catches browser-chrome
  collapse/expand), and a `window.orientationchange` listener (belt and
  suspenders for browsers where `visualViewport` lags on rotation). All
  three call the same `scheduleResize()`, which clears and restarts the
  debounce timer; only the timer's expiry calls `resize()`. `resize()`
  computes the new `PlayField` (§1/§2) and compares its `gridWidth`/
  `gridHeight` to the *current* grid's `width`/`height`: unchanged →
  update only the canvas's CSS display size (FR-025, nothing in `Grid` or
  `ObjectsState` is touched); changed → re-derive (§5), ending any
  in-progress stroke by resetting `drawing`/`lastGridPos` exactly as
  `handlePointerUp` does (FR-028).
- **Rationale**: This single compare-then-branch is what makes FR-025 and
  FR-026 the same code path rather than two separately-triggered ones —
  there is no need to distinguish "was this an orientation change or an
  address-bar collapse" by event type, only "did the *result* change,"
  which is simpler, more robust across browsers with inconsistent
  `orientationchange`/`visualViewport` firing behavior, and matches the
  spec's own Key Entities definition of Re-derivation ("the event of the
  play field taking new dimensions in cells because the drawing region
  changed shape *substantially*" — substantiality is exactly "did the
  computed grid dimensions change"). The debounce is what satisfies
  FR-027's "once per settled change, not once per intermediate frame" —
  without it, a `ResizeObserver` firing on every frame of an animated
  browser-chrome collapse, or a `visualViewport`/`orientationchange` pair
  firing moments apart during a physical rotation, would each independently
  trigger a re-derivation.
- **Alternatives considered**: Re-derive unconditionally on every resize
  event (no compare step) — rejected: this would silently violate FR-025 on
  the very common case of an address-bar collapse that happens not to
  change the floored grid dimensions, needlessly cropping/reflowing content
  that should have been left untouched. Distinguish orientation-change
  events from resize events and only re-derive on the former — rejected:
  `orientationchange` is not reliably fired by every target browser in
  every scenario (e.g., a desktop window resized to phone proportions,
  which the spec's own Assumptions section says must still get the phone
  layout, never fires it at all), so gating on event *type* rather than
  event *result* would miss real re-derivation cases the spec requires.

## 5. Bottom-centre anchored carry-over: a new pure `resizeGrid`, objects handled separately

- **Decision**: A new file, `src/sim/resize.ts`, exports `resizeGrid(oldGrid:
  Grid, newWidth: number, newHeight: number): { grid: Grid; offsetX: number;
  offsetY: number }`. It allocates a fresh grid via the existing
  `createGrid(newWidth, newHeight)`, computes `offsetX = round((newWidth -
  oldGrid.width) / 2)` (centred horizontally) and `offsetY = newHeight -
  oldGrid.height` (bottom-aligned: the old grid's last row maps to the new
  grid's last row), and for every old cell whose element is **not**
  `OBJECT`, copies `elements`/`shades`/`hues`/`glitter` to `(x + offsetX, y
  + offsetY)` in the new grid if that lands in bounds, dropping it
  otherwise. `moved` is never carried (it is per-tick scratch state,
  refilled every `step()` call). The caller (`PlayArea.svelte`) then
  separately repositions `ObjectsState.rainbows`/`.unicorns` by the same
  `offsetX`/`offsetY`: an object whose *entire* new footprint
  (`x+offsetX`, `y+offsetY`, unchanged `size`) fits in
  `[0, newWidth) × [0, newHeight)` is kept at its new position and its
  footprint is re-stamped into the new grid's `elements` as `OBJECT`; one
  that doesn't fully fit is dropped from its list entirely (never clipped).
- **Rationale**: FR-026 requires grains and objects to "keep their
  positions relative to the bottom-centre of the play field, so the ground
  stays at the bottom and a pile stays where the child put it," with
  anything falling outside the new bounds "dropped... cleanly." A single
  linear offset applied uniformly is the simplest transform satisfying
  "keep positions relative to the bottom-centre" — it needs no per-cell
  judgment call. Skipping `OBJECT` cells in the generic grain copy (instead
  of naively copying the placeholder byte) and handling `ObjectsState`
  separately is necessary because an object's authoritative data is its
  `PlacedObject` entry (`x`, `y`, `size`), not the `OBJECT` bytes stamped
  into `elements` — copying the bytes alone would desynchronize the grid
  from `ObjectsState` the moment any part of an object's footprint got
  cropped by the new bounds, and the Edge Cases section is explicit that a
  cropped object must be "removed cleanly rather than drawn half off the
  play area," which requires an all-or-nothing per-object decision, not a
  per-cell one.
- **Alternatives considered**: Scale grain positions proportionally
  (`newX = x * newWidth / oldWidth`) instead of a fixed offset — rejected:
  proportional scaling would move every grain relative to every other one
  (destroying the shape of a pile, not just cropping its edges), which
  contradicts "a pile stays where the child put it." Re-run scene
  generation instead of carrying hand-drawn content — rejected outright by
  FR-029 ("a re-derivation MUST NOT regenerate a loaded scene").

## 6. Toolbar layout: CSS flexbox drives the real page; a parallel pure function proves the fit

- **Decision**: The toolbar's actual on-screen wrapping is left entirely to
  CSS flexbox — `flex-direction: row; flex-wrap: wrap` (today's rule,
  unchanged) handles the portrait case, and a new landscape-phone media
  query (`(max-height: 480px) and (orientation: landscape)`) switches
  `App.svelte`'s `main` to `flex-direction: row` and the toolbar to
  `flex-direction: column; flex-wrap: wrap`, which wraps sideways into
  additional columns exactly as the portrait bar wraps downward into
  additional rows — no JavaScript layout logic is introduced for this. A
  new, separate, pure function in `layout.ts`, `computeToolbarLayout
  (viewportWidth, viewportHeight, controlCount, groupCount)`, models the
  same wrapping arithmetic (control size, gaps, group padding) using the
  same sizing constants the CSS uses, and is used **only** by the
  automated test suite to prove, for the representative viewport table,
  that every control fits at or above `MIN_TOUCH_TARGET` without the
  toolbar's computed thickness pushing the play area below FR-001/FR-002's
  fill floors. The sizing constants (`MIN_TOUCH_TARGET = 44`, a max control
  size, gap sizes) are exported from `layout.ts` and consumed by
  `Toolbar.svelte`/`App.svelte` as CSS custom properties (e.g. `style="--
  control-min: {MIN_TOUCH_TARGET}px"` on the toolbar's root element) so the
  test's model and the real CSS share one source of truth rather than two
  hand-synchronized copies of the same numbers.
- **Rationale**: Constitution Principle V requires the feature to stay
  verifiable without a browser harness, and FR-035 explicitly requires
  automated coverage of "every toolbar control fits on screen at or above
  the minimum touch target without overlapping the play area, wrapping in
  portrait and railing in landscape" — but `vitest` has no layout engine to
  ask a real flexbox how it wrapped. A parallel pure model is the same
  approach `001`'s `computeCanvasSize` already established (a pure function
  standing in for what the browser will render) applied to a second,
  more content-dependent layout question. Driving the *real* page with
  plain CSS flexbox (rather than a JS-computed row/column count) is what
  keeps this feature free of new client-side layout logic and new runtime
  dependencies (constitution Principle III) — flexbox's native wrapping is
  more robust to real font-metric variance across Android Chrome/iOS Safari
  than a JS reimplementation would be, and it is exactly the mechanism
  `Toolbar.svelte` already uses today for its portrait wrap.
- **Alternatives considered**: Compute toolbar rows/columns in JavaScript
  and apply exact pixel sizes/positions per control — rejected: this is
  strictly more code and a new source of layout bugs (drift between the
  computed layout and actual rendered text/emoji metrics) for a result CSS
  flexbox already produces natively and reactively. Skip the pure-function
  model and rely solely on the maintainer's on-device check — rejected:
  FR-035 explicitly lists toolbar fit among the required automated
  coverage, not just the manual "on-device checks" section.

## 7. Drawing region measurement reuses the existing container-based mechanism

- **Decision**: The "drawing region" `computePlayField` receives continues
  to come from `container.clientWidth`/`clientHeight` inside
  `PlayArea.svelte` — the same mechanism `001` already established (the
  container `div`'s flexbox `flex: 1; min-height: 0` — extended this
  feature with `min-width: 0` for the new landscape-rail row layout —
  already resolves to exactly "whatever space is left after the toolbar,"
  by definition of flexbox). No new measurement of the toolbar's own
  rendered size is added in `App.svelte`.
- **Rationale**: Since §6 keeps the toolbar's wrapping/railing entirely
  CSS-driven, the flexbox layout that produces the toolbar's final size is
  the same layout that produces the container's final size — measuring the
  container is already measuring "viewport minus toolbar," with zero
  additional plumbing between components. This is the minimal-diff option
  and avoids introducing a second source of truth for the toolbar's size
  (one from CSS layout, one from a JS reimplementation) that could drift
  apart.
- **Alternatives considered**: Have `Toolbar.svelte` report its rendered
  `clientWidth`/`clientHeight` up to `App.svelte`, which then computes and
  passes a `drawingRegion` prop down to `PlayArea` — rejected as strictly
  more plumbing for a value `PlayArea`'s own container already has for
  free via the existing flexbox layout.

## 8. Visible-viewport measurement and CSS sizing both target the true visible area

- **Decision**: Runtime viewport measurement (for `isPhoneSized` in §2 and
  the debounced resize trigger in §4) uses `window.visualViewport?.width`/
  `.height`, falling back to `window.innerWidth`/`innerHeight` when
  `visualViewport` is unavailable. `App.svelte`'s `main` changes from
  `height: 100vh` to `height: 100dvh` (dynamic viewport height unit, with
  the existing `100vh` rule kept immediately before it as a fallback for
  browsers predating `dvh` support — CSS silently ignores the unsupported
  declaration and keeps the earlier one).
- **Rationale**: FR-022 requires layout decisions to use "the *visible*
  viewport rather than a nominal one, so that a browser's collapsing
  address bar can never push the toolbar off-screen." `visualViewport` is
  the browser-native API for exactly this (it reports the actually-visible
  area, excluding collapsed/expanded chrome, and fires its own `resize`
  event when chrome collapses even if `window.innerHeight` does not change
  in lockstep on some browsers), and `dvh` is the CSS-native equivalent for
  the page's own height so the toolbar is never laid out against a
  larger-than-visible nominal viewport even before JavaScript runs. Using
  both is belt-and-suspenders: `dvh` keeps the *initial* paint correct
  without waiting for a JS resize handler, and the `visualViewport`
  listener keeps the *play field* correctly re-measured as chrome
  animates, which `dvh` alone cannot do (CSS layout changing doesn't by
  itself tell `PlayArea.svelte` to recompute its grid).
- **Alternatives considered**: `window.innerHeight`/`100vh` only (today's
  approach) — this is exactly the mechanism the issue's problem report
  names as the mobile URL-bar bug. A `resize`-only listener on `window`
  without `visualViewport` — rejected: `window`'s `resize` event does not
  reliably fire on every target browser purely from chrome collapse
  (behavior differs between Android Chrome and iOS Safari), which is why
  `visualViewport`'s own `resize` event exists.

## 9. Touch-gesture prevention: two small additive CSS rules close the remaining gaps

- **Decision**: `index.html`'s existing `overscroll-behavior: none`,
  `touch-action: none`, and `user-scalable=no` (already in place before
  this feature) are kept unchanged. This feature adds `user-select: none;
  -webkit-user-select: none; -webkit-touch-callout: none;` to the same
  `html, body` rule, and adds `viewport-fit=cover` to the `<meta
  name="viewport">` tag together with `padding: env(safe-area-inset-*)` on
  the toolbar's root element.
- **Rationale**: The spec's own Assumptions section expects "the touch
  event path is already largely correct" and frames the remaining FR-013–
  FR-017 behaviors as "requirements to verify on-device, expecting most to
  already hold." Reading the current `index.html` confirms scroll/bounce/
  pull-to-refresh/pinch-zoom/double-tap-zoom are already prevented by the
  existing rules — the one gap is text-selection highlighting and iOS
  Safari's long-press callout menu (FR-013's "does not show a text-
  selection highlight... does not show a long-press menu"), which needs
  the `user-select`/`touch-callout` rules this feature adds. `viewport-
  fit=cover` plus `env(safe-area-inset-*)` is the standard, dependency-free
  way to satisfy FR-023 ("no control may be obscured by... a notch,
  rounded corner, or home-indicator area") on notched iOS devices — without
  `viewport-fit=cover` the `env()` values are always zero.
- **Alternatives considered**: None of substance — this is confirmed,
  minimal-diff closure of a gap identified by reading the current code
  against the FRs, not a design choice with real alternatives.

## 10. Coordinate mapping switches from fixed constants to the live grid's dimensions

- **Decision**: `PlayArea.svelte`'s `clientToGrid` keeps its existing
  formula (`scaleX = gridWidth / rect.width`, `scaleY = gridHeight /
  rect.height`, floored cell coordinates) but reads `gridWidth`/
  `gridHeight` from the current `grid.width`/`grid.height` instead of the
  formerly-fixed `GRID_WIDTH`/`GRID_HEIGHT` import.
- **Rationale**: FR-012 requires touch-to-cell mapping to "continue to
  [map exactly] after any resize or rotation." Since the grid's own
  dimensions now change on a re-derivation (§5) and the on-screen scale
  changes on every resize (§1/§4), the mapping must always read the
  *current* grid size rather than a compile-time constant — this is a
  one-line change to an already-correct formula, not a new algorithm.
- **Alternatives considered**: None — this is a direct, minimal consequence
  of §1's grid no longer being fixed-size.

## 11. `GRID_WIDTH`/`GRID_HEIGHT`/`CELL_BUDGET` stay as named baseline constants

- **Decision**: `GRID_WIDTH = 270`/`GRID_HEIGHT = 160` remain exported from
  `layout.ts` unchanged in name and value, now documented as the baseline/
  default dimensions rather than "the" runtime grid size: they define
  `CELL_BUDGET = GRID_WIDTH * GRID_HEIGHT` (FR-007's "43,200" is this
  product, not a separately-chosen number) and remain the desktop-
  regression baseline `tests/unit/lib/layout.test.ts`'s new laptop-viewport
  case compares against (FR-030/SC-006).
- **Rationale**: `tests/unit/sim/objects.test.ts` and
  `tests/unit/sim/scenes.test.ts` already import `OBJECT_FOOTPRINT_SIZE`
  and `GRID_WIDTH`/`GRID_HEIGHT` directly from `layout.ts` (confirmed by
  reading both files); keeping the same exported names and values means
  neither file needs to change for this feature, consistent with FR-033
  ("existing automated tests MUST pass, updated only where a superseded
  requirement makes an assertion obsolete").
- **Alternatives considered**: Rename to something like
  `DEFAULT_GRID_WIDTH` to better reflect the new meaning — rejected as
  gratuitous churn across two working test files for a naming preference,
  not a behavior change; a code comment at the declaration site is
  sufficient to carry the updated meaning forward.

## 12. No new runtime dependency

- **Decision**: Every API this feature needs —
  `window.visualViewport`, `ResizeObserver` (already used by `001`),
  `window.orientationchange`, CSS `dvh`, CSS `env(safe-area-inset-*)`, CSS
  `flex-wrap` — is a native browser API already supported by the two named
  target browsers (Android Chrome, iOS Safari) and by evergreen desktop
  browsers. No package is added to `package.json`.
- **Rationale**: Constitution Principle III ("no other runtime dependencies
  without a spec explicitly justifying them") and the project's established
  precedent (every prior feature, including `005`'s wand, shipped with zero
  new dependencies).
- **Alternatives considered**: A viewport-units polyfill or a resize-
  observer polyfill for older browsers — rejected per the spec's own
  Assumptions section ("Very old browsers without modern viewport or
  pointer support are out of scope").

All Technical Context unknowns are resolved; nothing carries forward to
Phase 1 as unresolved.

## Decisions made without clarification

No spec-level `[NEEDS CLARIFICATION]` marker existed to resolve (all three
raised while drafting were already answered in the 2026-08-26
Clarifications session). The implementation-technology choices below were
made without further clarification because the spec leaves them as
implementation detail, not product intent:

- The exact debounce duration for "settled" re-derivation (§4): 150ms.
- The exact formula combining the three cell-size floors (§1) and the
  choice of `floor` over `round` for grid dimensions.
- Keeping `OBJECT_FOOTPRINT_SIZE` fixed rather than scaling it with the
  derived resolution (§3) — the spec's Assumptions text ("footprint in
  cells follows the play field's resolution") is satisfied qualitatively by
  the existing constant's behavior under the new formula, worked out
  numerically in §3, rather than by adding a new scaling function.
- The landscape-rail media query's exact breakpoint (`max-height: 480px`,
  matching the spec's own phone-size threshold) and which side of the
  screen the rail sits on (kept on the toolbar's existing DOM position,
  i.e. after the play area).
