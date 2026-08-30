# Phase 1 Data Model: Rendered Geometry Matches The Layout Model

Extends `specs/012-canvas-first-toolbar/data-model.md`'s **Toolbar
control** and **Toolbar band** entities, which are unchanged in shape.
This feature adds four new entities — **Geometry invariant**, **Geometry
check result**, **Guarded declaration map**, and **Arrangement decision**
— and touches one existing entity's contract (**Toolbar band**'s
`arrangement` field, now an input rather than an output of
`computeToolbarLayout`). No `src/sim/*` entity changes.

## Geometry invariant (new)

One documented, geometry-critical fact the layout model depends on — the
invariant list's unit of record (FR-008). Declared once, statically, in
`tests/unit/shell/geometryInvariants.ts`.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Stable identifier, e.g. `'toolbar-control-box-sizing'`, `'toolbar-band-flow-direction-rail'`, `'play-area-canvas-sizing'`. |
| `component` | `'toolbar-band' \| 'toolbar-control' \| 'play-area-container' \| 'play-area-canvas'` | The derived-geometry component this fact governs (spec's Key Entities). |
| `category` | `'box-sizing' \| 'borders' \| 'padding' \| 'margins' \| 'flow-direction' \| 'wrapping' \| 'gaps' \| 'transforms' \| 'sizing'` | One of FR-009's enumerated categories. `'sizing'` covers explicit width/height including min/max. |
| `assumption` | `string` | Human-readable: what the layout model assumes true, e.g. "the control's rendered box is exactly `--control-size` on both axes, border included." |
| `mechanism` | `'derived' \| 'pinned' \| 'inert'` | `'derived'`: the value flows from the model's output through one channel (a CSS custom property or inline style) — nothing to assert. `'pinned'`: fixed at a value the model assumes; a gate assertion holds it. `'inert'`: the category genuinely does not apply to this component (FR-009's "considered and inert" case) — still an entry, never an omission. |
| `historicalCause` | `1 \| 2 \| 3 \| undefined` | Which of the three shipped bugs (border/padding outside budget; wrong flow axis; scale-up past budget) this entry prevents, if any (FR-008). |
| `checkId` | `string \| undefined` | The `geometryGate.ts` export that enforces a `'pinned'` entry, by name — lets a test assert every `'pinned'` entry has exactly one corresponding check (FR-010) and every check corresponds to exactly one entry. `undefined` for `'derived'`/`'inert'` entries, which have nothing to assert. |

**Validation rules**:
- `GEOMETRY_INVARIANTS` (the full static list) has at least one entry for
  every `(component, category)` pair across all four components and all
  nine categories — FR-009's coverage requirement, checked by a small
  `vitest` case that enumerates the Cartesian product and confirms each
  is present (an `'inert'` entry satisfies a pair with nothing to hold).
- Every entry with `mechanism === 'pinned'` has a non-`undefined`
  `checkId` naming a real export of `geometryGate.ts`; every export of
  `geometryGate.ts` that performs an assertion (as opposed to a mutator)
  is named by at least one entry's `checkId` — FR-010's two-way
  correspondence, both directions checked.
- Every entry whose `category` is one of the guarded-set categories
  (`box-sizing`, `borders`, `padding`, `margins`, `sizing`, `transforms`)
  for `component ∈ {toolbar-band, toolbar-control}` is covered by that
  component's `ALLOWED_DECLARATIONS` map (below) rather than only by a
  named regex check — the closed-allowlist mechanism, not a second
  parallel one (FR-018).

## Guarded declaration map (new)

The closed-allowlist data behind FR-018a, one per guarded component
(`toolbar-control`'s resting state, `toolbar-control`'s `.selected`
state, `play-area-container`, `play-area-canvas`). Declared alongside
`GEOMETRY_INVARIANTS` in `geometryInvariants.ts`.

| Field | Type | Notes |
|---|---|---|
| `GUARDED_PROPERTY_PATTERN` | `RegExp` | Classifies a CSS property name as guarded: box sizing, any `border*`/`padding*`/`margin*` longhand, `width`/`height`/`min-*`/`max-*`, `transform`. Shared across all components (research.md §3). |
| `ALLOWED_DECLARATIONS` | `Record<string, string \| RegExp>` per component/state | Property name → the one value (or value pattern) the invariant list says is pinned there. A guarded property present in a rule block but absent from this map fails as unrecognized (FR-018a); present with a non-matching value fails as drifted (FR-004, FR-013 cause 1). |
| `transform` (special-cased) | n/a | Never looked up in `ALLOWED_DECLARATIONS`; parsed for `scale`/`scaleX`/`scaleY`/`scale3d`/`matrix` factors and failed only if any factor's magnitude exceeds `1` (research.md §4, FR-016). |

**Validation rules**:
- A property matching `GUARDED_PROPERTY_PATTERN` that is not `transform`
  and not present in the relevant `ALLOWED_DECLARATIONS` map fails with
  `found: "<property>: <value> (unrecognized in guarded set)"`.
- A property not matching `GUARDED_PROPERTY_PATTERN` (`box-shadow`,
  `background`, `animation`, `transition`, `cursor`, …) is never
  evaluated — this is what keeps SC-012 (cosmetic changes stay green)
  true by construction rather than by an exclusion list that could go
  stale.

## Geometry check result (new)

The gate's uniform return shape — every exported check in
`geometryGate.ts` returns one of these, whether it passed or failed
(FR-014).

| Field | Type | Notes |
|---|---|---|
| `ok` | `boolean` | Whether the source text satisfied the invariant. |
| `component` | same union as `GeometryInvariant.component` | Which component this result is about. |
| `invariant` | `string` | The `GeometryInvariant.id` this result checks. |
| `assumption` | `string` | Copied from the matching `GeometryInvariant.assumption` — always present, even on success, so a failing `expect` can render it without a second lookup. |
| `found` | `string` | What the source text actually contained — the specific declaration, flow direction, or gap rule found (or `"absent"` if the guarded declaration was missing entirely where one was expected). |

**Validation rules**:
- `ok === false` implies `found` describes the actual contradiction in
  enough detail to identify the offending line without re-opening the
  component's `<style>` block (FR-014, SC-011) — e.g. `"box-sizing:
  content-box"` rather than just `"mismatch"`.
- A `formatFailure(result): string` helper renders `component`,
  `invariant`, `assumption`, and `found` as one line; every `*.test.ts`
  assertion in this feature routes its failure message through it
  (research.md §8), so the four required pieces of FR-014 can never be
  dropped by an individual `expect` call.

## Mutator (new)

A named, pure `(source: string) => string` transform that reintroduces
one of the three historical causes into a copy of the live component
source (FR-013b). Declared in `geometryGate.ts` alongside the checks they
target.

| Field | Type | Notes |
|---|---|---|
| `id` | `'content-box-control' \| 'rail-row-flow' \| 'selected-scale-up'` | One per historical cause (FR-013). |
| `mutate` | `(source: string) => string` | Regex/substring replace against the live source, e.g. replacing the literal substring `box-sizing: border-box;` inside `.control {...}` with `box-sizing: content-box;`. |
| `targetCheckId` | `string` | The `geometryGate.ts` check this mutation is expected to break — the same `checkId` a `GeometryInvariant` entry names. |

**Validation rules**:
- `mutate(source) !== source` for the real, current component source —
  asserted before the negative-case test even runs the check, so a
  future refactor that silently defeats the mutator (removes the exact
  substring it matches) fails loudly here rather than letting the
  negative-case test pass for the wrong reason (Edge Case: "the shipped
  component gets refactored"; Story 2 Scenario 8).
- `check_targetCheckId(mutate(source)).ok === false` — the actual
  acceptance test (FR-013, SC-001): the mutated variant, produced from
  today's real source, must fail the exact check it targets.
- `check_targetCheckId(source).ok === true` — the companion positive
  case: the real, unmutated source must pass, run in the same test so a
  check that always fails (which would trivially "catch" every mutation)
  cannot hide behind the negative case alone.

## Arrangement decision (extended — was internal to Toolbar band in spec 012)

The binary rows-versus-rail fact, now explicitly modeled as its own value
with one producer and (at least) two consumers, superseding spec 012's
"`arrangement` matches `Toolbar.svelte`'s CSS media-query condition
exactly" validation rule (which described an *agreement*, not a shared
*source*).

| Field | Type / Signature | Notes |
|---|---|---|
| `RAIL_MEDIA_QUERY` | `string` (constant) | `'(max-height: 480px) and (orientation: landscape)'` — the exact media-query text, unchanged in value from `App.svelte`'s current CSS (FR-007b: no behavior change). |
| `readArrangement` | `(matchMedia?: (q: string) => { matches: boolean }) => 'rows' \| 'rail'` | Reads `RAIL_MEDIA_QUERY` against the layout viewport via `window.matchMedia` by default; the injectable parameter exists solely so `tests/unit/lib/layout.test.ts` can call it under `vitest`'s DOM-free environment with a stub, keeping the function itself trivially testable without adding jsdom (Principle V). |
| `computeToolbarLayout` | `(viewportWidth: number, viewportHeight: number, controlCount: number, arrangement: 'rows' \| 'rail') => ToolbarLayoutResult` | **Changed**: `arrangement` moves from an internally computed value to an explicit fourth parameter (research.md §6). Every other field of `ToolbarLayoutResult` (spec 012's data-model.md) is unchanged in shape and meaning. |

**Validation rules**:
- `Toolbar.svelte` and `App.svelte` both call `readArrangement()` (or, in
  `App.svelte`'s case, react to the same `matchMedia(RAIL_MEDIA_QUERY)`
  object's `change` event) — never re-deriving the threshold from
  `viewportWidth`/`viewportHeight` arithmetic of their own (FR-007).
- `App.svelte`'s `<style>` block contains no `@media` rule referencing
  `orientation` or `max-height` — the old, independently-thresholded rule
  is removed, not merely superseded (research.md §7, checked by source
  inspection in `playAreaGeometry.test.ts` or `toolbarGeometry.test.ts`).
- For every viewport in spec 012's representative table,
  `readArrangement()`'s result (stubbed to the table row's width/height
  via the injectable `matchMedia` parameter) equals what
  `computeToolbarLayout`'s pre-013 internal derivation would have
  produced at that row — SC-014's "0 viewports where the arrangement
  differs from today," now checked as a property of the new function
  against the old formula rather than assumed.
- A pinch-zoom scenario (visual viewport shrinks, layout viewport
  unchanged) never appears as an input to `readArrangement()` at all,
  because `matchMedia` is defined against the layout viewport by
  construction — there is no code path left that reads
  `window.visualViewport` to decide arrangement (SC-014's "0 arrangement
  changes caused by a pinch-zoom").

## Superseded / extended contracts

- Spec 012's **Toolbar band** entity's `computeToolbarLayout` signature
  (`(viewportWidth, viewportHeight, controlCount) => ToolbarLayoutResult`,
  internally deriving `arrangement`) is superseded by the **Arrangement
  decision** entity above — a same-feature, same-file signature change,
  not a new function; `ToolbarLayoutResult`'s shape and every other
  validation rule from spec 012's data-model.md carry over unchanged.
- Spec 012's `tests/unit/shell/toolbarGeometry.test.ts` (four ad-hoc
  regex assertions, no documented list, no negative cases) is superseded
  by this feature's **Geometry invariant** / **Geometry check result** /
  **Guarded declaration map** / **Mutator** entities — FR-024 requires
  the existing assertions folded into the named list rather than left
  beside it; none of the four checks it already performs are dropped,
  each becomes one `GeometryInvariant` entry with a corresponding
  `geometryGate.ts` export.
- No entity from 001–012 beyond **Toolbar band**'s `computeToolbarLayout`
  signature changes shape, meaning, or validation rules — `Grid`,
  `PlayField`, `computePlayField`, **Toolbar control**, **Drawing
  region**, **Constrained axis**, and every simulation-layer entity are
  unchanged (research.md §9).
