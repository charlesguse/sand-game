# Quickstart: Rendered Geometry Matches The Layout Model

How to build and validate this feature end-to-end once implemented. See
[data-model.md](./data-model.md) for entity details and
[contracts/geometry-gate.md](./contracts/geometry-gate.md) for the exact
module APIs. This extends
`specs/012-canvas-first-toolbar/quickstart.md` — its build steps and
representative-viewport table are reused, not repeated in full here.

## Prerequisites

- Node 22 (matches `.github/workflows/deploy-pages.yml`)
- `npm install` from a checkout that already has specs 001–012's scaffold
  (`src/lib/layout.ts` with `computeToolbarLayout`/`computePlayField`,
  `src/lib/Toolbar.svelte`, `src/lib/PlayArea.svelte`, `src/App.svelte`,
  `tests/unit/shell/toolbarGeometry.test.ts`)
- A 667×375 phone (or a devtools device emulator at that size) — the
  exact viewport where six controls shipped off-screen, referenced by
  this spec's Wish section

## Build and run the tests

```bash
npm install
npm run build     # emits dist/index.html — must be the ONLY file in dist/
test -f dist/index.html
npm test           # vitest — no browser, no DOM required
```

Both commands must succeed from a clean checkout, and every existing test
from specs 001–012 must still pass unchanged except where FR-024 folds
`toolbarGeometry.test.ts`'s existing assertions into the new
list-and-gate mechanism (same facts, same coverage, different
implementation).

## Validate User Story 1 — every button stays on the screen she can touch (P1)

Reference: spec Acceptance Scenarios 1–5 under User Story 1.

**Automated coverage** (`tests/unit/shell/toolbarGeometry.test.ts`): for
`Toolbar.svelte`'s live source text, every `GEOMETRY_INVARIANTS` entry
with `component: 'toolbar-control'` or `'toolbar-band'` and
`mechanism: 'pinned'` passes its named `geometryGate.ts` check —
including the guarded-set declaration scan over `.control`'s and
`.control.selected`'s rule blocks (contracts/geometry-gate.md), which is
what makes "a control's rendered box never exceeds the size the model
budgeted... in any state" (FR-004) a build-time fact rather than a claim.
Confirm `readArrangement()`, stubbed at each of spec 012's
representative-table viewports, produces the arrangement
`computeToolbarLayout` needs to keep every row's `fits === true` /
`thickness <= cap` result identical to spec 012's own numbers (SC-014).

**On-device / manual** (maintainer, real device per CLAUDE.md's platform
split — see "What the maintainers eyeball" below): open the toy at a
667×375-equivalent landscape phone view → every scene button and every
brush-size button is visible and tappable, none clipped by an edge;
rotate to 375×667 portrait → the same holds; select the outermost control
on the last line and confirm its rainbow ring emphasis stays fully inside
the visible area.

## Validate User Story 2 — a drifting stylesheet fails the suite, not the review (P1)

Reference: spec Acceptance Scenarios 1–10 under User Story 2.

**Automated coverage**: for each of `HISTORICAL_CAUSE_MUTATORS`'s three
entries, read `Toolbar.svelte`'s live source, confirm
`mutate(source) !== source` (the mutation actually found something to
change in the current file — guards against a silently-defeated mutator,
Edge Case "the shipped component gets refactored"), then confirm
`check_targetCheckId(source).ok === true` (today's real component passes)
and `check_targetCheckId(mutate(source)).ok === false` with a message
naming the component, the invariant, the assumption, and what was found
(FR-013, FR-013a, FR-013b, FR-014, SC-001, SC-011). Separately, construct
one guarded-set declaration this feature's list does not name (e.g. add a
`border-radius: 10%` line inside a copied `.control {...}` block's text)
and confirm the closed-allowlist scan rejects it even though no invariant
entry mentions `border-radius` by name (FR-018a, SC-013). Separately,
construct a purely cosmetic mutation (change a `box-shadow` color, tweak
a `conic-gradient` stop) and confirm every check stays green (FR-015,
SC-012). Confirm the whole suite, including these cases, runs to
completion under plain `npm test` with 0 browsers and 0 DOM environments
(FR-012, SC-006).

**On-device / manual**: none — this story's guarantee is entirely an
automated-suite property (spec's Independent Test: "confirm the suite
itself re-derives each of the three historical causes on every run").

## Validate User Story 3 — layout changes name what to eyeball, and on whose device (P2)

Reference: spec Acceptance Scenarios 1–3 under User Story 3.

**Automated coverage**: none by design (spec's Independent Test is a
reading exercise — "confirm each item names a maintainer, a device, a
viewport or orientation, and a single observable statement").

**Manual verification** (either maintainer, at review time): read this
document's "What the maintainers eyeball" section below and confirm every
item names a maintainer, a device, an orientation/viewport, and one
true-or-false observable — no item asking "does it look right." Confirm
each item is attributed to exactly the maintainer whose device can verify
it (CLAUDE.md's two-column platform table), and that any item only one of
them can check says so explicitly (e.g. the pinch-zoom item below).

## Validate User Story 4 — the play area gets the same protection (P3)

Reference: spec Acceptance Scenarios 1–4 under User Story 4.

**Automated coverage** (`tests/unit/shell/playAreaGeometry.test.ts`): for
`PlayArea.svelte`'s live source, confirm the canvas's inline `style`
attribute binds `width`/`height` to `displayWidth`/`displayHeight` (the
derivation channel, FR-001a) by source inspection; run the guarded-set
declaration scan over `.play-area-container` and `.play-area`'s rule
blocks against their (currently empty) `ALLOWED_DECLARATIONS` maps, so
any future guarded declaration there fails immediately (FR-001b,
Acceptance Scenario 1). Confirm every `(component, category)` pair for
`'play-area-container'`/`'play-area-canvas'` is present in
`GEOMETRY_INVARIANTS`, `'inert'` where nothing needs holding (FR-009).
Confirm `checkArrangementSingleSource` passes (`App.svelte` and
`Toolbar.svelte` both import `readArrangement`/`RAIL_MEDIA_QUERY`; neither
`<style>` block still has its own `@media` rule) — Acceptance Scenario 3.
Confirm `readArrangement()`'s behavior against a stubbed `matchMedia`
never depends on any `window.visualViewport` reading — the pinch-zoom
hazard has no code path left to trigger (Acceptance Scenario 4, SC-014).

**On-device / manual**: none beyond what User Story 1's device checks
already cover for the play area's rendered size (this story finds no new
bug — it closes a gap in verification, per the spec's Why priority note).

## Validate existing behavior is unchanged (FR-021, FR-023, FR-024)

1. Run `npm test` and confirm every test from specs 001–012 still passes.
   `tests/unit/shell/toolbarGeometry.test.ts`'s four existing assertions
   (box-sizing, rail flow direction, rail class binding, selected-state
   scale, gap axes) are still covered — now as named `GEOMETRY_INVARIANTS`
   entries with `geometryGate.ts` checks, not dropped (FR-024).
   `tests/unit/lib/layout.test.ts`'s spec-012 floor assertions
   (`TOOLBAR_BAND_MAX_SHARE`, `MIN_TOUCH_TARGET`, `MIN_PITCH`, area-fill
   floors, the full representative-table `fits === true`) are unchanged
   in what they assert, updated only to pass `computeToolbarLayout`'s new
   explicit `arrangement` parameter (FR-021).
2. `npm run build` still emits exactly one `dist/index.html` (FR-023,
   SC-010); open it via `file://` and confirm the toy plays exactly as
   before — no visible change of any kind (FR-022, SC-009): same
   controls, same positions, same sizes, same interactions, same
   undo/redo/persistence behavior.

## What the maintainers eyeball

Per CLAUDE.md's platform split (FR-019, FR-020) — the human gates this
spec's automated checks cannot cover:

- **Charlie — Fire 7 Kids tablet (Silk), portrait and landscape**: no
  control touches or crosses a screen edge in either orientation; all 3
  scene buttons and all 3 brush-size buttons are present and tappable in
  both.
- **Charlie — desktop Chrome at 1280×800**: the toolbar looks exactly as
  it does today; no control touches or crosses a window edge; resizing
  the window narrow and back leaves no control outside the window.
- **Max — iPad Safari, standalone home-screen app, portrait and
  landscape**: no control touches or crosses a screen edge in either
  orientation, and no control sits under the notch or the home indicator;
  the selected control's rainbow ring is fully visible when the selected
  control is the outermost one on its line.
- **Max — iPad Safari, standalone, rotate while a control is selected**:
  the selected control's emphasis stays inside the band through the
  rotation and no control lands off-screen afterwards.
- **Max — iPad Safari, standalone, pinch-zoom in landscape**: pinching
  with two fingers does not flip the toolbar between the row arrangement
  and the side rail — verifiable only on a touch device with pinch-zoom;
  Charlie's desktop Chrome does not exercise this.
- **Charlie — Fire 7 Kids tablet (Silk) and desktop Chrome, rotate and
  resize**: the arrangement switches between rows and rail at the same
  point it does today, and the band and the play area switch together —
  never one without the other.
- **Either maintainer**: a purely visual change (a colour tweak, or a
  box-shadow or gradient on the control-group cue) still merges without
  touching the invariant list.

## Performance check

No hot-loop (`step`/`render`) change means no new performance risk
(research.md's Constitution Check) — the existing performance check from
006/012's quickstart (sustained `>=30fps`, targeting `60fps`, on a
mid-range phone with a full moving play area) still applies unchanged and
does not need to be re-run specifically for this feature.
