# Phase 0 Research: Canvas-First Toolbar Budget

No `[NEEDS CLARIFICATION]` markers were left in `spec.md`. This document
resolves the *how* for the technical choices the spec leaves open,
building directly on `specs/006-phone-support/research.md`'s `src/lib/
layout.ts` foundation (`isPhoneSized`, `computePlayField`,
`computeToolbarLayout`, `PHONE_MAX_SHORT_SIDE`, `MIN_TOUCH_TARGET`,
`RESIZE_SETTLE_MS`) rather than replacing it.

## §1 Budgeting order: toolbar allowance derived from the drawing floor

**Decision**: The toolbar's allowed thickness on the constrained axis is
`min(naturalThicknessAtPreferredSize, TOOLBAR_BAND_MAX_SHARE * constrainedAxisLength)`,
where `TOOLBAR_BAND_MAX_SHARE = 0.4` (FR-002's inverse). This is computed
*before* the drawing region is measured, and the drawing region's
`container` (already `flex: 1` in `App.svelte`, per 006) simply receives
whatever is left — the flex box mechanics don't need to change, only what
decides the toolbar's own box size does (FR-001).

**Rationale**: Today `Toolbar.svelte`'s `.toolbar` has no explicit size —
it is a flex item that sizes to its content (fixed 3.5rem controls,
`flex-wrap`), and `PlayArea`'s `flex: 1` container absorbs whatever is
left. That is exactly the "toolbar takes whatever size its contents want"
order FR-001 forbids. Capping the toolbar's own box at a value derived
from the axis (never more than 40%) and letting `flex: 1` absorb the rest
satisfies FR-001 without inverting the flex layout itself — the *literal*
mechanism (flex remainder) is unchanged; the *governing* input (a budget,
not intrinsic content size) is what flips.

**Alternatives considered**: Explicitly computing the drawing region's
pixel box in JS and sizing `PlayArea`'s container directly — rejected
because it would duplicate `PlayArea`'s own `ResizeObserver`-driven
measurement (006) for no benefit; letting `flex: 1` do that arithmetic, as
it already does, is simpler and keeps `PlayArea.svelte` almost untouched.

## §2 Continuous control-size + pitch shrink algorithm

**Decision**: A two-phase, order-preserving continuous shrink, run inside
`computeToolbarLayout`:

1. At `controlSize = PREFERRED_CONTROL_SIZE` (56, today's fixed size) and
   `pitch = PREFERRED_PITCH` (16, today's inter-group gap), compute the
   thickness needed to wrap `controlCount` controls across the main axis
   (§10's flat-sequence model). If it's `<=` the band's cap, ship that —
   this is the common case (desktop, tablet, most phones) and is why
   FR-016's non-regression holds "without special-casing" (spec's own
   Assumption).
2. Otherwise, holding `controlSize` at its preferred value, shrink `pitch`
   continuously toward `MIN_PITCH` (4px — FR-009's fingertip-separation
   floor) — a **binary search** over the real-valued pitch, since required
   thickness is monotonic non-increasing as pitch shrinks (a smaller pitch
   can only let more controls share a line, never fewer). Stop as soon as
   thickness clears the cap.
3. If pitch at its floor still doesn't clear the cap, hold `pitch =
   MIN_PITCH` and binary-search `controlSize` continuously down from
   `PREFERRED_CONTROL_SIZE` toward `MIN_TOUCH_TARGET` (44) the same way —
   again monotonic, for the same reason.
4. If `controlSize = MIN_TOUCH_TARGET` with `pitch = MIN_PITCH` still
   exceeds the cap, `fits: false`; the result carries the thickness that
   tightest legal arrangement actually needs, so the caller (the test) can
   report it against the cap available (FR-012b).

**Rationale**: FR-012a is explicit about the order — flexible pitch is
"spent first," control size only shrinks once pitch is already at its
floor — and FR-007 requires control size to be "a continuous function of
the available space, not a jump between two hard-coded sizes." Binary
search over a monotonic function is the simplest way to get a continuous,
deterministic answer without enumerating every pixel value, and it's pure
arithmetic — no DOM, satisfying constitution Principle V.

**Alternatives considered**: Enumerating every integer pixel size and
picking the largest that fits — correct but does unnecessary work and
reads less clearly as "continuous"; a closed-form solve for the wrap
`floor()` — not possible in general because line count is a step function
of size/pitch, which is exactly why a monotonic binary search (robust to
the steps) is used instead of algebra.

## §3 Flat-sequence wrap model, groups as a visual cue only

**Decision**: `computeToolbarLayout`'s wrapping model treats the control
count as one flat sequence — it does not track group boundaries or insert
a forced break between groups. Group chrome (a group's own padding, the
margin between groups) is folded into the single `pitch` value the
shrink algorithm already varies, rather than modeled as a separate cost.

**Rationale**: This is what FR-008 ("groups may share a row... whenever
they fit... grouping remains a purely visual cue") asks for by
construction — a model with no forced group break can never disagree with
FR-008. It also continues 006's own simplification (`computeToolbarLayout`
already conflated `TOOLBAR_GAP`/`TOOLBAR_PADDING` into one pair of
constants rather than separately pricing every group's padding); this
feature keeps that precedent rather than introducing new per-group
accounting the spec doesn't ask for.

**Alternatives considered**: Modeling each group's padding and the
inter-group margin as distinct terms — more "realistic" but adds
parameters (`groupCount`, per-group control counts) the shrink algorithm
would have to reconcile against a single pitch anyway, for a precision
gain the 44px/non-overlap floors (FR-009) don't need.

## §4 Single source of truth for the control set (FR-013)

**Decision**: A new plain-TypeScript module, `src/lib/toolbarControls.ts`,
exports a static list of every control the toolbar can ever show —
`TOOLBAR_CONTROLS: ToolbarControlSpec[]`, each entry `{ id, group,
ariaLabel, conditional? }` where `conditional` is `'fullscreen' |
'photo' | undefined` — plus `shippedToolbarControls(showFullscreen,
showPhoto)`, which filters out the two feature-detected entries when their
flag is false. `Toolbar.svelte`'s template is generated by iterating this
exact list (grouped by `.group` for the coloured-pill rendering); per-
control behavior (which `onclick`, which `selected`/`disabled` check,
which glyph) is looked up by `id` from a small map built inside the
component from its existing props, but the *set and count* of buttons
rendered can never diverge from the manifest, because the manifest is
what the `{#each}` iterates. `tests/unit/lib/layout.test.ts` imports
`shippedToolbarControls` (not a literal `18`) directly.

**Rationale**: FR-013 requires the check's control set to be "derived from
the toolbar the toy actually ships... so that adding or removing a control
changes what is checked without anyone editing a separate constant" — and
names today's exact failure mode (a hand-maintained `18` against a
rendered `24`). Constitution Principle V forbids adding browser-automation
test infrastructure, so the no-DOM `vitest` suite cannot import
`Toolbar.svelte` and introspect its rendered DOM directly (as a browser
test could) — the only way to get a *single* source of truth reachable
from both a `.svelte` component and a DOM-free test is a shared plain `.ts`
module that both import, with the component's template *driven by* that
module rather than merely resembling it. This is the same pattern 006
already used for `MIN_TOUCH_TARGET` (a `layout.ts` constant feeding
`Toolbar.svelte`'s `--control-min` custom property) extended from a single
constant to a full control list.

**Alternatives considered**: Snapshot-testing `Toolbar.svelte`'s rendered
HTML — rejected, it's exactly the browser-automation infrastructure the
constitution asks specs not to add, and would only catch drift after the
fact rather than making drift structurally impossible. Keeping a hand
counted constant but adding a *second* test that fails if it doesn't match
some other hand-count — rejected, it doesn't remove the duplicate source
of truth, it adds a third one.

## §5 Sizing rule shared between the check and the render (FR-014)

**Decision**: `computeToolbarLayout` (rewritten; see contracts/) is the
*only* place the control-size/pitch/thickness arithmetic lives.
`Toolbar.svelte` calls it at runtime (viewport dimensions in, control
count from §4's manifest in) and applies the result as CSS custom
properties (`--control-size`, `--pitch`) plus an explicit inline
height/width on the toolbar's own box equal to the returned `thickness` —
replacing today's fixed `3.5rem` control size, the `0.4rem`/`1rem`/
`0.75rem` literal gaps, and the `@media (max-height: 480px) and
(orientation: landscape)` block's hard-coded 44px override. The
`tests/unit/lib/layout.test.ts` suite calls the exact same function.

**Rationale**: This is the direct fix for the bug this feature exists to
close — 006's `computeToolbarLayout` was already a *model* of the
toolbar's CSS, not the rule that produces it, so the two could (and did)
disagree silently. Making `Toolbar.svelte` consume the function's output
rather than approximate it in parallel CSS is the only way FR-014's "the
check MUST NOT be able to pass while the shipped layout violates the
floors" can be true by construction rather than by discipline.

**Alternatives considered**: Keeping CSS-only wrapping (as 006 did) and
tightening the model to match it more closely — rejected; no amount of
better modeling closes the gap FR-014 forbids, because CSS `flex-wrap`
alone cannot express "shrink control size continuously toward a floor
before falling back to more rows," which is exactly what FR-007 asks for.
A JS-computed size is the only mechanism that can do that at all.

## §6 Where the runtime measurement lives

**Decision**: `Toolbar.svelte` measures the visible viewport itself
(`window.visualViewport?.width/.height` falling back to
`window.innerWidth/innerHeight`, exactly `PlayArea.svelte`'s existing
006 pattern), debounced the same way via `RESIZE_SETTLE_MS`, listening to
`window.visualViewport`'s `resize`, `window.orientationchange`, and its
own `ResizeObserver` on `document.documentElement` (there is no smaller
"container" to observe — the toolbar's constrained axis is the *whole*
viewport axis, not a leftover region). It does not need `PlayArea`'s
size as an input, because the constrained axis it budgets against is the
full viewport axis before any subtraction — the "which axis is
constrained" question is answered by the same `isPhoneSized`/width-vs-
height check 006 already uses for the rows/rail switch, not by anything
`PlayArea` measures.

**Rationale**: Avoids a circular dependency (toolbar needing to know the
drawing region's size, which itself depends on the toolbar's size).
Keeps the change scoped almost entirely to `Toolbar.svelte` + `layout.ts`
— `PlayArea.svelte`'s own `ResizeObserver` on its `container` already
reacts correctly to *any* change in the space the flex box leaves it,
including a toolbar that just resized itself, with no new wiring needed
there at all (research.md §1's flex-remainder point).

**Alternatives considered**: Hoisting the measurement to `App.svelte` and
passing computed sizes down as props to both children — more "textbook"
data flow, but adds a coordination point and a prop-drilling surface for
no behavioral gain, since both components already independently listen to
the same global viewport signals today (006 precedent: `PlayArea` doesn't
ask `App` for the viewport size either).

## §7 Universal axis floor vs. phone-scoped area floor (FR-006)

**Decision**: `computeToolbarLayout`'s cap (`TOOLBAR_BAND_MAX_SHARE`)
applies at every viewport, unconditionally. `computePlayField`'s
phone-scoped area-fill floors (FR-004, unchanged from 006) stay gated on
`isPhoneSized`, exactly as they are today. The rows-vs-rail arrangement
switch also stays gated on `isPhoneSized`/`PHONE_MAX_SHORT_SIDE` (the
existing 480px landscape media query in `App.svelte` is untouched).

**Rationale**: This is FR-006 verbatim — "only the size cap becomes
universal," arrangement and the area floors keep their existing scope.
Splitting these concerns (arrangement, axis cap, area floor) into three
independently-gated checks, sharing the one `isPhoneSized` predicate
where they do overlap, is what lets FR-016's desktop non-regression hold
"without special-casing": desktop already clears 40% by a wide margin
today (22% at 1280×800), so the universal cap is inert there, not a new
branch.

## §8 Safe-area insets and the visible-viewport measurement (FR-005)

**Decision**: Unchanged from 006 — `env(safe-area-inset-*)` stays inside
the toolbar's own CSS padding (never subtracted from the drawing region
directly), and `window.visualViewport` (falling back to `innerWidth`/
`innerHeight`) remains the measurement source, so an address-bar
collapse/expand is absorbed the same way 006 already handles it
(`RESIZE_SETTLE_MS`-debounced re-measurement, no re-derivation unless the
computed grid dimensions actually change).

**Rationale**: The spec explicitly keeps this mechanism ("Safe-area
insets... come out of the toolbar band's budget, not the drawing
region's floor" — Edge Cases) and reuses 006's FR-023/FR-027. No new
research needed; restated here only so the plan's Constitution Check has
an explicit line to point at.

## §9 Build-time failure has no runtime counterpart (FR-012)

**Decision**: `computeToolbarLayout`'s `fits: false` case is exercised
only by `tests/unit/lib/layout.test.ts`. No runtime code path branches on
`fits` — the component always applies whatever `controlSize`/`pitch`/
`thickness` the function returns, even in a hypothetical `fits: false`
state, because such a state can never reach a shipped build (the test
suite fails first, blocking the PR per constitution Principle V / this
project's Development Workflow gate). This mirrors 006's own precedent of
having no runtime fallback for an unreachable-by-CI-gate condition.

**Rationale**: FR-012 is explicit — "There is no runtime fallback... the
failure is verifiable without a browser." Adding a runtime branch for
`fits: false` (an error message, a scroll, a hidden control) would itself
violate FR-010/FR-012/the constitution's no-failure-states rule; the
correct "handling" is that the state is unreachable by construction once
CI is green.

## §10 Representative viewport table (extends 006's, now unconditional)

**Decision**: `tests/unit/lib/layout.test.ts`'s `VIEWPORT_TABLE` is
extended to match SC-001's table exactly: `320×568`, `375×667`, `667×375`,
`390×844`, `844×390`, `412×915`, `600×1024`, `1024×600`, `768×1024`,
`1024×768`, `1280×800`, `400×1400` — replacing 006's smaller table (which
omitted the iPhone SE 3 and Fire 7 rows this feature's evidence is built
on). The axis-floor assertion (FR-002) runs over every row; the area-fill
assertions (FR-004) keep running only over the phone-sized subset, per §7.

**Rationale**: Directly satisfies SC-001's explicit table and the User
Story 1 Independent Test's viewport list; reusing the same table for both
`computePlayField` and `computeToolbarLayout` assertions is what FR-015
("MUST assert both floors simultaneously... at every viewport in the
representative table") requires.

## §11 No simulation-layer change (FR-017)

**Decision**: `src/sim/*` is untouched. A larger drawing region simply
produces a larger `computePlayField` result under 006's existing
derivation rules and `CELL_BUDGET` cap; `resizeGrid`, `HistoryManager`,
and the save/restore path (specs 006, 010, 011) need no change, since none
of them are sensitive to *why* the drawing region changed size, only to
the fact that it did (already exercised by every rotation/fullscreen-
toggle re-derivation today).

**Rationale**: Restates FR-017 and confirms no research is needed here —
the re-derivation path this feature will exercise more often (because
toolbar shrinkage changes the drawing region's pixel size) is the exact
same path 006 built and 010/011 already integrate with.
