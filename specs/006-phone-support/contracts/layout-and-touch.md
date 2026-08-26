# Contract: Layout, resize, and touch (extends prior specs' `src/sim/*`/`src/lib/*` contracts)

This project has no network API. As in `specs/005-sparkle-magic-wand/
contracts/wand-mechanics.md` (which itself extends 001–004's), the
interface contract that matters is the boundary between the framework-free
simulation core (`src/sim/*`), the UI-layer layout/effect helpers
(`src/lib/*`), the Svelte shell that calls both, and the `vitest` unit
tests that exercise `src/sim/*`/pure `src/lib/*` functions directly with no
DOM (constitution Principle V, FR-035). This document is purely additive or
signature-widening except where explicitly noted — every function listed in
prior contracts not mentioned here is unchanged.

## `src/lib/layout.ts` (rewritten)

```ts
export const GRID_WIDTH = 270;               // unchanged value — now a baseline/default, not "the" grid size
export const GRID_HEIGHT = 160;              // unchanged value — see research.md §11
export const CELL_BUDGET = GRID_WIDTH * GRID_HEIGHT; // 43,200 — FR-007's ceiling
export const MIN_CELL_SIZE = 2;              // px, FR-005
export const MEDIUM_STROKE_MIN_PX = 24;      // px, FR-006, phone-sized viewports only
export const PHONE_MAX_SHORT_SIDE = 480;     // px, spec's "phone-sized viewport" definition
export const MIN_TOUCH_TARGET = 44;          // px, FR-020
export const RESIZE_SETTLE_MS = 150;         // debounce before a resize/re-derivation, FR-027
export const BRUSH_RADII: Record<BrushSize, number>; // unchanged: { small: 2, medium: 4, large: 7 }
export const OBJECT_FOOTPRINT_SIZE = 24;     // unchanged — research.md §3

export interface PlayField {
  gridWidth: number;
  gridHeight: number;
  cellSize: number;      // may be fractional
  displayWidth: number;  // gridWidth * cellSize
  displayHeight: number; // gridHeight * cellSize
}

export function isPhoneSized(viewportWidth: number, viewportHeight: number): boolean;

export function computePlayField(
  drawingRegionWidth: number,
  drawingRegionHeight: number,
  isPhone: boolean,
): PlayField;

export interface ToolbarLayoutCheck {
  fits: boolean;
  controlSize: number; // px, >= MIN_TOUCH_TARGET whenever fits is true
  thickness: number;   // px consumed on the cross axis (height in portrait, width in landscape rail)
}

export function computeToolbarLayout(
  viewportWidth: number,
  viewportHeight: number,
  controlCount: number,
  groupCount: number,
): ToolbarLayoutCheck;
```

**Removed**: `computeCanvasSize` (superseded by `computePlayField` —
FR-004). No other caller of `computeCanvasSize` exists outside
`PlayArea.svelte`, so removing it has no other blast radius.

**Contract**:
- `isPhoneSized(w, h)`: `true` iff `Math.min(w, h) <= PHONE_MAX_SHORT_SIDE`.
  Pure, no DOM access.
- `computePlayField(regionW, regionH, isPhone)`: see research.md §1 for the
  formula. Pure. `gridWidth`/`gridHeight` are always `>= 1` for positive
  inputs; `gridWidth * gridHeight <= CELL_BUDGET` always; `cellSize >=
  MIN_CELL_SIZE` always and `cellSize >= MEDIUM_STROKE_MIN_PX / (2 *
  BRUSH_RADII.medium + 1)` whenever `isPhone` is `true`.
- `computeToolbarLayout(viewportW, viewportH, controlCount, groupCount)`:
  see research.md §6 and data-model.md's Toolbar layout section. Pure,
  models — but does not drive — the real CSS flexbox wrap/rail behavior;
  used only by `tests/unit/lib/layout.test.ts`.

## `src/sim/resize.ts` (new)

```ts
export function resizeGrid(
  oldGrid: Grid,
  newWidth: number,
  newHeight: number,
): { grid: Grid; offsetX: number; offsetY: number };
```

**Contract**: Allocates `createGrid(newWidth, newHeight)` (unchanged
primitive). `offsetX = Math.round((newWidth - oldGrid.width) / 2)`,
`offsetY = newHeight - oldGrid.height`. For every source index `i` with
`oldGrid.elements[i] !== OBJECT`, if `(x + offsetX, y + offsetY)` is in
`[0, newWidth) × [0, newHeight)`, copies `elements[i]`/`shades[i]`/
`hues[i]`/`glitter[i]` to the destination index unchanged; otherwise the
source cell is dropped. `OBJECT` cells are always skipped (never copied —
objects are the caller's responsibility, next section). `moved` is never
read or copied. Never mutates `oldGrid`. Calling `resizeGrid` twice with
identical arguments against the same `oldGrid` produces two `Grid`
instances with identical contents (pure function, no hidden state).

## `src/lib/PlayArea.svelte` (extended)

**Contract**:
- Module-scope `grid` becomes reassignable (`let grid = createGrid(...)`,
  no longer `const`); likewise `imageData`, `flashMask`, and the canvas's
  `width`/`height` attributes are recreated whenever `grid` is replaced.
- `resize()` is replaced by: `scheduleResize()` (debounces via
  `RESIZE_SETTLE_MS`, called from the existing `ResizeObserver` on
  `container`, a new `window.visualViewport` `resize` listener, and a new
  `window.orientationchange` listener) which, after the debounce fires,
  measures the visible viewport (`window.visualViewport?.width/.height`
  falling back to `window.innerWidth/innerHeight`), computes `isPhone =
  isPhoneSized(viewportW, viewportH)`, then `field = computePlayField
  (container.clientWidth, container.clientHeight, isPhone)`. If
  `field.gridWidth === grid.width && field.gridHeight === grid.height`,
  only `displayWidth`/`displayHeight` (the `$state` values driving the
  canvas's CSS `width`/`height` style) are updated — `grid`, `imageData`,
  `flashMask`, `objectsState`, and the canvas's `width`/`height`
  attributes are untouched (FR-025). Otherwise: calls `resizeGrid(grid,
  field.gridWidth, field.gridHeight)`; repositions `objectsState.rainbows`/
  `.unicorns` by the same `offsetX`/`offsetY`, dropping any whose full
  offset footprint doesn't fit the new bounds and re-stamping the survivors'
  `OBJECT` cells into the new grid (research.md §5); reassigns `grid` to
  the new instance; reallocates `imageData`/`flashMask` at the new
  dimensions; updates the canvas's `width`/`height` attributes; updates
  `displayWidth`/`displayHeight`; if `drawing` is `true`, sets `drawing =
  false` and `lastGridPos = null` (FR-028) — `tool`/`brushSize`, owned by
  `App.svelte`, are untouched by any of this.
- `clientToGrid` reads `grid.width`/`grid.height` (the live grid's current
  dimensions) instead of the formerly-imported `GRID_WIDTH`/`GRID_HEIGHT`
  constants — its formula (`scaleX = grid.width / rect.width`, etc.) is
  otherwise unchanged (research.md §10).
- The `.play-area-container` CSS gains `min-width: 0` alongside its
  existing `min-height: 0`, so `flex: 1` can shrink the container correctly
  in both the existing column (portrait) layout and the new row (landscape-
  rail) layout (research.md §6/§7).
- The `<canvas>`'s `touch-action: none` is unchanged; no new pointer-event
  handling logic is introduced — FR-010 through FR-017's behaviors are
  expected to already hold given the existing `pointerdown`/`pointermove`/
  `pointerup`/`pointercancel` handlers and `setPointerCapture` call
  (spec's own Assumptions section, research.md §9), verified on-device
  rather than by new code.

## `src/App.svelte` (extended)

**Contract**:
- `main`'s CSS gains `height: 100dvh` after the existing `height: 100vh`
  (fallback ordering — research.md §8); a new media query,
  `@media (max-height: 480px) and (orientation: landscape)`, sets
  `flex-direction: row` (replacing the default `column`) so the toolbar
  becomes a side rail instead of a bottom bar (FR-020a).
- No new props, no new component-level state — `selectTool`/
  `selectBrushSize`/`clearAll`/`selectScene` are unchanged (mirroring how
  `005` needed no change here for its new tool).

## `src/lib/Toolbar.svelte` (extended)

**Contract**:
- The root `.toolbar` element gains inline custom properties sourced from
  `layout.ts`'s exported constants (e.g. `style="--control-min: {
  MIN_TOUCH_TARGET}px"`), and its `<style>` block's `.control` size rules
  reference `var(--control-min)` — the single source of truth
  `computeToolbarLayout`'s test-time model also reads (research.md §6).
- `.toolbar` gains `padding: env(safe-area-inset-bottom) env(safe-area-
  inset-right) env(safe-area-inset-left)` (or the appropriate subset per
  the rail vs. row layout) so no control sits under a notch or home-
  indicator (FR-023).
- Inside the new landscape-phone media query, `.toolbar` switches to
  `flex-direction: column; flex-wrap: wrap` (from the default `row;
  wrap`), and `.control` sizing shrinks toward `var(--control-min)`
  (FR-020a).
- `user-select: none; -webkit-user-select: none; -webkit-touch-callout:
  none;` are added to `.control` (or inherited from a shared ancestor rule
  — see `index.html` below) so a long or fast tap never triggers a text-
  selection callout (FR-013).
- No change to `Props`, `onclick` handlers, or the `tool`/`brushSize`
  selection markup — every existing button and its `aria-label` is
  unchanged (FR-021, "every control the toy has MUST be visible at once").

## `index.html` (extended)

**Contract**:
- `<meta name="viewport">` gains `viewport-fit=cover` (alongside the
  existing `width=device-width, initial-scale=1.0, maximum-scale=1.0,
  user-scalable=no`), which is required for `env(safe-area-inset-*)` to
  resolve to non-zero values on notched devices (FR-023).
- The existing inline `<style>` block's `html, body` rule gains
  `user-select: none; -webkit-user-select: none; -webkit-touch-callout:
  none;` alongside its existing `overscroll-behavior: none; touch-action:
  none;` (research.md §9, FR-013). `overflow: hidden` and `margin: 0` are
  unchanged.

## Consumers

- `PlayArea.svelte` is the only runtime caller of `computePlayField`/
  `isPhoneSized`/`resizeGrid`. A resize flows: `ResizeObserver` on
  `container`, or `visualViewport`'s `resize` event, or
  `window.orientationchange` → `scheduleResize()` debounce →
  `resize()` → `computePlayField` (using `container.clientWidth/
  clientHeight` and the freshly-measured visible viewport) → compare to
  the live `grid`'s dimensions → either a CSS-only rescale or a
  `resizeGrid` + object-reposition + stroke-end re-derivation. The
  existing per-frame loop (`step` → `applyRainbowConversions` →
  `updateUnicorns` → `tickParticles` → `updateFlashMask` → `render`,
  established by `001`/`005`) is unaware a resize just happened — it
  simply operates on whatever `grid`/`objectsState`/`flashMask` currently
  reference on its next tick, exactly as it's already unaware of a
  hand-drawn stroke or a wand pass.
- `tests/unit/lib/layout.test.ts` (new) imports `computePlayField`/
  `isPhoneSized`/`computeToolbarLayout`/the sizing constants from
  `layout.ts` — no DOM, no Svelte — and asserts the representative-
  viewport-table requirements (FR-035).
- `tests/unit/sim/resize.test.ts` (new) imports `resizeGrid` from
  `src/sim/resize.ts` plus `createGrid`/`setCell`/`getElement`/
  `getGlitter` from `grid.ts` — no DOM — and asserts the bottom-centre
  anchoring and clean-drop behavior from research.md §5/data-model.md's
  Re-derivation validation rules.
- `tests/unit/sim/grid.test.ts`, `objects.test.ts`, `scenes.test.ts`,
  `step.test.ts`, `brush.test.ts`, `wand.test.ts` are all unchanged — none
  of them import `computeCanvasSize` (the one removed export), and all
  already construct `Grid`s via `createGrid(width, height)` with explicit
  dimensions rather than the `GRID_WIDTH`/`GRID_HEIGHT` constants, except
  `objects.test.ts` (`OBJECT_FOOTPRINT_SIZE`, unchanged) and
  `scenes.test.ts` (`GRID_WIDTH`/`GRID_HEIGHT` as one viewport-size table
  entry, unchanged values) — both continue to import values that still
  exist with the same names and numbers (research.md §11).
