# Contract: Geometry invariant list, gate, and the unified arrangement decision

This project has no network API; as in every prior spec's contract, what
matters is the boundary between framework-free pure functions/data and
the Svelte shell and `vitest` suite that consume them (constitution
Principle V, FR-012, FR-013c). This extends
`specs/012-canvas-first-toolbar/contracts/toolbar-budget.md`, whose
`src/lib/layout.ts` and `src/lib/toolbarControls.ts` contracts carry over
except where noted below.

## `src/lib/layout.ts` (extended)

```ts
// Unchanged from 006/012:
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
export const TOOLBAR_BAND_MAX_SHARE = 0.4;
export const PREFERRED_CONTROL_SIZE = 56;
export const PREFERRED_PITCH = 16;
export const MIN_PITCH = 4;
export interface PlayField { gridWidth: number; gridHeight: number; cellSize: number; displayWidth: number; displayHeight: number; }
export function isPhoneSized(viewportWidth: number, viewportHeight: number): boolean;
export function computePlayField(drawingRegionWidth: number, drawingRegionHeight: number, isPhone: boolean): PlayField;

// New (FR-007, FR-007a):
export const RAIL_MEDIA_QUERY: string; // '(max-height: 480px) and (orientation: landscape)'
export function readArrangement(
  matchMedia?: (query: string) => { matches: boolean },
): 'rows' | 'rail';

// Changed (was (viewportWidth, viewportHeight, controlCount) in 012 —
// arrangement moves from an internal derivation to an explicit input):
export interface ToolbarLayoutResult {
  fits: boolean;
  controlSize: number;      // px, always >= MIN_TOUCH_TARGET
  pitch: number;             // px, always >= MIN_PITCH
  thickness: number;         // px consumed on the constrained axis; <= TOOLBAR_BAND_MAX_SHARE * constrainedAxisLength whenever fits is true
  requiredThickness: number; // px needed at the tightest legal arrangement
  arrangement: 'rows' | 'rail'; // echoes the input, unchanged — kept for callers that only hold the result
}

export function computeToolbarLayout(
  viewportWidth: number,
  viewportHeight: number,
  controlCount: number,
  arrangement: 'rows' | 'rail',
): ToolbarLayoutResult;
```

**Contract**:
- `readArrangement()` with no argument reads `window.matchMedia` — safe
  only where `window` exists (production code, `Toolbar.svelte`,
  `App.svelte`). Tests pass a stub matching `(q) => ({ matches: boolean })`
  so the function is exercised under `vitest`'s DOM-free environment
  without adding jsdom (Principle V).
- `computeToolbarLayout`'s arithmetic (the two-phase shrink, the
  `TOOLBAR_BAND_MAX_SHARE` cap, `clearsAreaFillFloor`) is otherwise
  byte-for-byte what spec 012 shipped — only how `arrangement` reaches
  the function changes. Calling it with the `arrangement` value
  `readArrangement()` would have produced for a given viewport, at every
  row in spec 012's representative table, reproduces exactly today's
  `fits`/`controlSize`/`pitch`/`thickness` (FR-007b, SC-014).
- Calling it twice with identical arguments (including `arrangement`)
  returns identical results — still pure, no hidden state.

## `tests/unit/shell/geometryInvariants.ts` (new, not a runtime dependency of `src/`)

```ts
export type GeometryComponent =
  | 'toolbar-band' | 'toolbar-control' | 'play-area-container' | 'play-area-canvas';

export type GeometryCategory =
  | 'box-sizing' | 'borders' | 'padding' | 'margins' | 'flow-direction'
  | 'wrapping' | 'gaps' | 'transforms' | 'sizing';

export type GeometryMechanism = 'derived' | 'pinned' | 'inert';

export interface GeometryInvariant {
  id: string;
  component: GeometryComponent;
  category: GeometryCategory;
  assumption: string;
  mechanism: GeometryMechanism;
  historicalCause?: 1 | 2 | 3;
  checkId?: string; // required iff mechanism === 'pinned'
}

export const GEOMETRY_INVARIANTS: readonly GeometryInvariant[];

export const GUARDED_PROPERTY_PATTERN: RegExp;

// One allowed-declarations map per guarded rule block this feature scans.
export const CONTROL_ALLOWED_DECLARATIONS: Record<string, string | RegExp>;
export const CONTROL_SELECTED_ALLOWED_DECLARATIONS: Record<string, string | RegExp>;
export const PLAY_AREA_CONTAINER_ALLOWED_DECLARATIONS: Record<string, string | RegExp>; // {} today
export const PLAY_AREA_CANVAS_ALLOWED_DECLARATIONS: Record<string, string | RegExp>; // {} today
```

**Contract**:
- `GEOMETRY_INVARIANTS` has at least one entry for every
  `(component, category)` pair (data-model.md's coverage rule, FR-009) —
  a `vitest` case in `toolbarGeometry.test.ts` enumerates the Cartesian
  product and fails if any pair is unrepresented.
- Every `mechanism: 'pinned'` entry's `checkId` names a real export of
  `geometryGate.ts`, and every assertion export of `geometryGate.ts` is
  named by at least one entry (FR-010, two-way).
- This module has zero imports from `src/` and zero `readFileSync`/DOM
  access of its own — it is pure data plus the two small pattern/map
  constants the gate consumes (kept beside the list they describe, not
  duplicated into `geometryGate.ts`).

## `tests/unit/shell/geometryGate.ts` (new, not a runtime dependency of `src/`)

```ts
export interface GeometryCheckResult {
  ok: boolean;
  component: GeometryComponent;
  invariant: string; // GeometryInvariant.id
  assumption: string;
  found: string;
}

export function formatFailure(result: GeometryCheckResult): string;

// One exported check per 'pinned' GeometryInvariant.checkId, each a pure
// (source: string) => GeometryCheckResult. Representative signatures —
// the full set mirrors GEOMETRY_INVARIANTS's 'pinned' entries:
export function checkControlBoxSizing(toolbarSource: string): GeometryCheckResult;
export function checkControlGuardedDeclarations(toolbarSource: string): GeometryCheckResult[];
export function checkSelectedGuardedDeclarations(toolbarSource: string): GeometryCheckResult[];
export function checkRailFlowDirection(toolbarSource: string): GeometryCheckResult;
export function checkGapAxes(toolbarSource: string): GeometryCheckResult[];
export function checkArrangementSingleSource(appSource: string, toolbarSource: string): GeometryCheckResult;
export function checkCanvasSizeDerivation(playAreaSource: string): GeometryCheckResult;
export function checkPlayAreaGuardedDeclarations(playAreaSource: string): GeometryCheckResult[];

// One mutator per historical cause (FR-013):
export interface Mutator {
  id: 'content-box-control' | 'rail-row-flow' | 'selected-scale-up';
  mutate: (source: string) => string;
  targetCheckId: string;
}
export const HISTORICAL_CAUSE_MUTATORS: readonly Mutator[];

// Shared declaration-parsing primitive backing the *GuardedDeclarations checks:
export function parseDeclarations(ruleBlockSource: string): Array<{ property: string; value: string }>;
export function extractRuleBlock(source: string, selector: string): string; // e.g. extractRuleBlock(src, '.control {')
```

**Contract**:
- Every check function is pure: same `source` string in, same
  `GeometryCheckResult`(s) out, no I/O, no DOM, no `Date.now()`/
  `Math.random()` — safe to call from both the positive assertions and
  the mutation-derived negative-case tests (research.md §2).
- `parseDeclarations`/`extractRuleBlock` are exported (not just used
  internally) so the negative-case tests in `toolbarGeometry.test.ts` can
  assert `mutate(source) !== source` (data-model.md's Mutator validation
  rule) without duplicating the extraction logic.
- `checkArrangementSingleSource` takes both `App.svelte`'s and
  `Toolbar.svelte`'s source text and confirms (a) `App.svelte` imports
  `readArrangement`/`RAIL_MEDIA_QUERY` from `./lib/layout`, (b)
  `Toolbar.svelte` does the same, and (c) neither file's `<style>` block
  contains an `@media` rule mentioning `orientation` or `max-height`
  (research.md §7) — the one check in this feature that reads two
  components' source at once, because the fact it holds ("one source of
  truth") is inherently about the relationship between them.
- `HISTORICAL_CAUSE_MUTATORS` has exactly three entries (FR-013's three
  named causes), each `targetCheckId` naming a real export above.

## `src/App.svelte` (modified)

**Contract**:
- Imports `readArrangement`/`RAIL_MEDIA_QUERY` from `./lib/layout`. Holds
  `let arrangement = $state(readArrangement())`, updated via
  `window.matchMedia(RAIL_MEDIA_QUERY).addEventListener('change', () => arrangement = readArrangement())`
  registered in `onMount` (mirroring the existing teardown pattern in
  `Toolbar.svelte`/`PlayArea.svelte`).
- `<main class:rail={arrangement === 'rail'}>` replaces the unconditional
  `<main>`; the `<style>` block's `@media (max-height: 480px) and
  (orientation: landscape) { main { flex-direction: row; } }` becomes
  `main.rail { flex-direction: row; }` with no `@media` wrapper.
- No other markup, prop, or script change — `Toolbar`/`PlayArea` are
  wired exactly as before.

## `src/lib/Toolbar.svelte` (modified)

**Contract**:
- Imports `readArrangement` from `./layout` alongside its existing
  `computeToolbarLayout` import.
- The existing `measureViewport`/`scheduleMeasure` debounce path (spec
  012, unchanged) additionally re-reads `readArrangement()` into a
  `$state` on the same schedule, rather than adding a second listener
  path.
- `computeToolbarLayout(viewportWidth, viewportHeight, controls.length, arrangement)`
  — the fourth argument added, matching layout.ts's new signature. The
  `layout.arrangement === 'rail'` reads elsewhere in the template are
  unchanged (still `ToolbarLayoutResult.arrangement`, which now simply
  echoes the input).
