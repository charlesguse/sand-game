# Contract: Toolbar budget, control manifest, and self-sizing (extends `specs/006-phone-support/contracts/layout-and-touch.md`)

This project has no network API; as in every prior spec's contract, what
matters is the boundary between the framework-free pure functions
(`src/lib/layout.ts`, new `src/lib/toolbarControls.ts`), the Svelte shell
that consumes them (`Toolbar.svelte`), and the no-DOM `vitest` suite that
exercises the pure functions directly (constitution Principle V, FR-013,
FR-014, FR-015). Everything in 006's contract not mentioned here is
unchanged — `computePlayField`, `isPhoneSized`, `resizeGrid`,
`PlayArea.svelte`'s resize/re-derivation path, and every `src/sim/*`
signature all stay exactly as 006 left them (research.md §11).

## `src/lib/layout.ts` (extended)

```ts
// Unchanged from 006:
export const GRID_WIDTH = 270;
export const GRID_HEIGHT = 160;
export const CELL_BUDGET = GRID_WIDTH * GRID_HEIGHT;
export const MIN_CELL_SIZE = 2;
export const MEDIUM_STROKE_MIN_PX = 24;
export const PHONE_MAX_SHORT_SIDE = 480;
export const MIN_TOUCH_TARGET = 44;
export const RESIZE_SETTLE_MS = 150;
export const BRUSH_RADII: Record<BrushSize, number>;
export const OBJECT_FOOTPRINT_SIZE = 24;
export interface PlayField { gridWidth: number; gridHeight: number; cellSize: number; displayWidth: number; displayHeight: number; }
export function isPhoneSized(viewportWidth: number, viewportHeight: number): boolean;
export function computePlayField(drawingRegionWidth: number, drawingRegionHeight: number, isPhone: boolean): PlayField;

// New (FR-002):
export const TOOLBAR_BAND_MAX_SHARE = 0.4;
// New (research.md §2):
export const PREFERRED_CONTROL_SIZE = 56;
export const PREFERRED_PITCH = 16;
export const MIN_PITCH = 4;

// Changed (was ToolbarLayoutCheck / computeToolbarLayout(w, h, controlCount, groupCount) in 006):
export interface ToolbarLayoutResult {
  fits: boolean;
  controlSize: number;      // px, always >= MIN_TOUCH_TARGET
  pitch: number;             // px, always >= MIN_PITCH
  thickness: number;         // px consumed on the constrained axis; <= TOOLBAR_BAND_MAX_SHARE * constrainedAxisLength whenever fits is true
  requiredThickness: number; // px needed at the tightest legal arrangement (controlSize=44, pitch=4) — always populated, for FR-012b
  arrangement: 'rows' | 'rail';
}

export function computeToolbarLayout(
  viewportWidth: number,
  viewportHeight: number,
  controlCount: number,
): ToolbarLayoutResult;
```

**Removed**: the 006 shape `{ fits: boolean; controlSize: number;
thickness: number }` and the `groupCount` parameter (research.md §3) —
`Toolbar.svelte` is `computeToolbarLayout`'s only production caller (via
`toolbarControls.ts`'s control count), so this is a same-feature internal
change with no other blast radius, exactly as 006 removed
`computeCanvasSize` outright.

**Contract**:
- `computeToolbarLayout(viewportW, viewportH, controlCount)`: determines
  `arrangement = (viewportH <= PHONE_MAX_SHORT_SIDE && viewportW >
  viewportH) ? 'rail' : 'rows'` (matching `Toolbar.svelte`'s CSS media
  query exactly, research.md §7); `constrainedAxisLength = arrangement ===
  'rail' ? viewportW : viewportH`; `mainAxisLength` is the other axis.
  Runs the two-phase shrink (research.md §2) against
  `TOOLBAR_BAND_MAX_SHARE * constrainedAxisLength`, honoring the pitch-
  before-size order (FR-012a). Pure, no DOM access — safe to call from
  `tests/unit/lib/layout.test.ts` with no browser.
- Calling it twice with identical arguments returns identical results (no
  hidden state, no `Date.now()`/`Math.random()` dependency).
- `fits: false` never occurs for the real shipped control set at any
  representative-table viewport as of this feature landing (asserted by
  the test suite, not by the function itself) — if a future control
  addition makes it occur, `npm test` fails (FR-012, SC-008).

## `src/lib/toolbarControls.ts` (new)

```ts
export type ToolbarGroupId =
  | 'elements' | 'objects' | 'actions' | 'history'
  | 'screen' | 'photo' | 'scenes' | 'sizes';

export interface ToolbarControlSpec {
  id: string;
  group: ToolbarGroupId;
  ariaLabel: string;
  conditional?: 'fullscreen' | 'photo';
}

export const TOOLBAR_CONTROLS: readonly ToolbarControlSpec[]; // every control the toy can ever show, static, declared once

export function shippedToolbarControls(
  showFullscreen: boolean,
  showPhoto: boolean,
): ToolbarControlSpec[]; // TOOLBAR_CONTROLS filtered by each entry's conditional gate
```

**Contract**:
- `TOOLBAR_CONTROLS` has exactly one entry per button `Toolbar.svelte`
  renders, in render order — `Toolbar.svelte`'s `{#each}` is generated
  from this list (grouped by `.group`), not merely checked against it, so
  the two cannot diverge (FR-013).
- `shippedToolbarControls(false, false).length === 24`,
  `shippedToolbarControls(true, true).length === 26` at the time of
  writing — not asserted as a literal in the test (that would recreate the
  hand-maintained-constant drift FR-013 forbids); the test instead asserts
  properties that hold *for whatever the manifest currently contains*
  (every entry has a non-empty `ariaLabel`, at most two entries have a
  `conditional`, etc.) plus feeds `.length` straight into
  `computeToolbarLayout`.
- Adding a `ToolbarControlSpec` to `TOOLBAR_CONTROLS` and wiring its
  render/behavior in `Toolbar.svelte` is the only way to add a control;
  there is no second place a count needs updating (SC-009).

## `src/lib/Toolbar.svelte` (extended)

**Contract**:
- Imports `TOOLBAR_CONTROLS`/`shippedToolbarControls` and
  `computeToolbarLayout` from the two modules above (plus the existing
  `MIN_TOUCH_TARGET`, `pickGlyph`, etc.).
- Self-measures the visible viewport (research.md §6): `visualViewport`/
  `innerWidth`/`innerHeight`, debounced by `RESIZE_SETTLE_MS`, on mount and
  on `visualViewport` `resize` / `window.orientationchange` / its own
  `ResizeObserver` on `document.documentElement`.
- On every settled measurement, computes `controls =
  shippedToolbarControls(showFullscreen, showPhoto)` and `layout =
  computeToolbarLayout(viewportW, viewportH, controls.length)`, then
  applies `layout.controlSize`/`layout.pitch` as CSS custom properties
  (`--control-size`, `--pitch`) and sets the toolbar's own box to
  `layout.thickness` on the constrained axis (`height` when `layout.
  arrangement === 'rows'`, `width` when `'rail'`) via an inline style —
  replacing today's fixed `3.5rem`/`0.4rem`/`1rem`/`0.75rem` CSS literals
  and the `@media (max-height: 480px) and (orientation: landscape)`
  hard-coded-44px block.
- Renders one `<button class="control">` per entry of `controls`, grouped
  into `.group` wrappers by `.group` (preserving the existing coloured-
  pill visual clustering, FR-008), with per-`id` behavior (`onclick`,
  `class:selected`, `disabled`, glyph) resolved from a small map built
  from the component's existing props — no behavioral change to what
  tapping any given control does (FR-011).
- `Props` interface is unchanged — `App.svelte` needs no change beyond
  whatever the existing prop wiring already provides (`tool`, `brushSize`,
  `canUndo`, `canRedo`, `showFullscreen`, `showPhoto`, `muted`, and the
  existing callbacks).

## `src/App.svelte` (unchanged, or minimally additive)

**Contract**: No required change — `main`'s existing `flex-direction:
column`/`row` split (006's 480px landscape media query) and `PlayArea`'s
`flex: 1; min-width: 0; min-height: 0` container already produce the
"drawing region gets the flex remainder" behavior this feature needs, once
`Toolbar.svelte` bounds its own box (research.md §1, §6). If the
implementation finds it needs an explicit wrapper class around `<Toolbar
/>` to pin `flex: 0 0 auto` (preventing the toolbar from ever being
compressed below its computed box by flex's default shrink behavior),
that is a small additive CSS change, not a new architectural surface.
