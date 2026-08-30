# Implementation Plan: Rendered Geometry Matches The Layout Model

**Branch**: `013-rendered-geometry-gate` | **Date**: 2026-08-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-rendered-geometry-gate/spec.md`

## Summary

Close the class of bug that shipped six controls off a 667×375 screen while
`npm test` stayed green: `computeToolbarLayout` budgeted a number, but
nothing made the actual CSS agree with it. This feature makes agreement
structural rather than a matter of discipline, in two parts.

**Production code** (small, targeted): unify the rows-versus-rail decision
onto one owner. `src/lib/layout.ts` gets a new `RAIL_MEDIA_QUERY` constant
and `readArrangement()` helper that reads the *layout* viewport via
`window.matchMedia`, with the exact semantics `App.svelte`'s CSS media
query uses today (FR-007a). `computeToolbarLayout` stops deriving
`arrangement` from the measured *visual* viewport it's passed (today's
pinch-zoom hazard) and instead takes it as an explicit parameter.
`Toolbar.svelte` reads `readArrangement()` alongside its existing
viewport measurement and passes it in. `App.svelte` reads the same
`readArrangement()`/`RAIL_MEDIA_QUERY` for its own `flex-direction: row`
switch, via a JS-driven `class:rail` replacing today's independently
-declared `@media (max-height: 480px) and (orientation: landscape)` block
— removing the second, textually-duplicated threshold rather than merely
asserting the two agree (FR-007, FR-007b). No sizing value changes at any
representative-table viewport (SC-014).

**Verification infrastructure** (the bulk of the feature): a single
documented **invariant list** (`tests/unit/shell/geometryInvariants.ts`) —
one entry per geometry-critical fact, covering every enumerated category
for every derived-geometry component (the toolbar band, its controls, and
the play area's container and canvas) — paired with a pure,
DOM-free **geometry gate** (`tests/unit/shell/geometryGate.ts`) that reads
each component's *live* `.svelte` source text and checks it against the
list. Two mechanisms hold each fact: **derivation** (the value flows from
`computeToolbarLayout`/`computePlayField` through one channel — a CSS
custom property or an inline style — so there's nothing to assert) and
**pinned assertion**, which the gate checks two ways: named regex
assertions for facts that aren't a single property (flow direction,
wrapping, gap axis), and a **closed-allowlist declaration scan** for the
guarded set (FR-018) — every declaration inside `.control`'s and
`.control.selected`'s rule blocks that touches box sizing, borders,
padding, margins, width/height (incl. min/max), or a scaling transform
must match a value the list names, or the gate fails even on a property
nobody anticipated (FR-018a). A transform's `scale()` factor is parsed
numerically so the gate forbids growth but not shrink (FR-016) without a
second hard-coded allowlist entry per control state.

The three historical causes become **permanent regression tests**
(FR-013a) by deriving their negative cases from the shipped component's
*current* source at test time: each cause has a small pure `mutate*`
function that transforms the live source text (e.g. replacing
`box-sizing: border-box` with `box-sizing: content-box` inside the
`.control` block) and re-runs the identical gate check, which must now
fail (FR-013b, FR-013c). Because the mutator operates on the live text by
substring/regex match rather than a fixture, a future refactor that
removes the matched substring makes the mutator itself detectably inert
(asserted separately) rather than silently letting the negative case rot
(Edge Case, Story 2 Scenario 8).

This feature adds no control, no interaction, and no visible change
(FR-022); it strengthens spec 012's verification without touching any of
its floors (FR-021), and stays inside constitution Principle V — plain
`vitest`, string/regex analysis of source text, no DOM and no browser.

## Technical Context

**Language/Version**: TypeScript 5.x, Node 22 (matches
`.github/workflows/deploy-pages.yml`) — unchanged from 001–012.

**Primary Dependencies**: `svelte` 5, `vite`, `@sveltejs/vite-plugin-svelte`,
`vite-plugin-singlefile`, `vitest`, `typescript` — unchanged; no new
runtime or dev dependency. The one new runtime capability this feature
uses, `window.matchMedia`, is already relied on implicitly by
`App.svelte`'s existing `@media` CSS rule and is supported on every
target browser family in CLAUDE.md's platform table (Silk, desktop
Chrome, iOS Safari standalone) with no fallback needed (research.md §4).

**Storage**: N/A — unchanged; this feature persists nothing and touches
no `localStorage` code path (FR-023).

**Testing**: `vitest`, no DOM, no headless browser (constitution Principle
V, FR-012). `tests/unit/shell/toolbarGeometry.test.ts` is substantially
rewritten to run off the new data-driven invariant list and gate instead
of its current ad-hoc regexes (FR-024). A new
`tests/unit/shell/playAreaGeometry.test.ts` covers Story 4. Both import
two new non-test support modules, `tests/unit/shell/geometryInvariants.ts`
(the documented list — data only) and `tests/unit/shell/geometryGate.ts`
(pure check/mutate functions over source text) — kept out of `src/` since
neither is a runtime dependency of the shipped app (research.md §1).
`tests/unit/lib/layout.test.ts` gains cases for `computeToolbarLayout`'s
new explicit-arrangement parameter and `readArrangement()`.

**Target Platform**: Static single-file page opened via `file://` or
served from GitHub Pages; evergreen browsers on a mid-range laptop,
tablet, and phone (Android Chrome/Silk, iOS Safari) — unchanged scope.

**Project Type**: Single-page client-only web app — no backend/API.
Unchanged.

**Performance Goals**: Steady 60fps target, 30fps floor (constitution
Principle IV) — unchanged; this feature touches no per-frame `step`/
`render` code. `readArrangement()` is a single synchronous
`matchMedia(...).matches` read on the same debounced resize path
`Toolbar.svelte` and `PlayArea.svelte` already use — negligible.

**Constraints**: Per-frame simulation/render path stays allocation-free
and unchanged (constitution Principle IV). Production build still emits
exactly one output file with zero runtime network requests (FR-023). No
spec-012 floor (40% band cap, 44px touch target, area-fill floors,
fail-rather-than-degrade) may be weakened, relaxed, or made conditional
(FR-021) — the new gate is additive on top of `computeToolbarLayout`'s
existing postconditions, never a replacement for them.

**Scale/Scope**: One feature, four prioritized user stories (every
control on-screen; drift fails the suite, not review; a per-platform
eyeball checklist; the play area gets the same protection). Two new
production-code exports in `src/lib/layout.ts` (`RAIL_MEDIA_QUERY`,
`readArrangement`) and a small signature change to `computeToolbarLayout`;
small, additive changes to `Toolbar.svelte` and `App.svelte`'s arrangement
wiring; two new non-test support modules and one new test file under
`tests/unit/shell/`; a substantially rewritten
`tests/unit/shell/toolbarGeometry.test.ts`. No `src/sim/*` change.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. One Self-Contained Page | No new build step, asset, or runtime dependency. The two new non-test modules live under `tests/unit/shell/` (not `src/`), so `dist/index.html`'s bundle is unaffected beyond the two small `layout.ts` additions, already plain TypeScript `vite-plugin-singlefile` bundles like every existing `src/lib/*` export (FR-023). | PASS |
| II. Built For An Almost-5-Year-Old | No new control, no reading required, no visible change of any kind (FR-022, SC-009) — this feature is entirely verification plus a de-duplication of an internal decision that was already supposed to agree everywhere. A gate failure blocks `npm test`/the build, never something she can see (FR-012, matching spec 012's precedent). | PASS |
| III. Simple, Dependency-Light Svelte | No new dependency. The gate is plain-TypeScript string/regex analysis, isolated from Svelte exactly like `computeToolbarLayout`; `Toolbar.svelte` and `App.svelte` each gain a few lines reading a shared helper, not a parallel layout system (research.md §4). | PASS |
| IV. Performance Is A Feature | No hot-loop (`step`/`render`) change. `readArrangement()` runs only on the same debounced resize/orientation path the toolbar and play area already listen on — one extra synchronous `matchMedia` read, off the animation-frame loop entirely. | PASS |
| V. Verifiable Without A Browser Harness | The entire gate is plain `vitest` over source text read with `node:fs`'s `readFileSync` — no DOM, no headless browser, no rendering step of any kind (FR-012, FR-013c) — this is the feature's central design constraint, not an afterthought. The one thing this feature explicitly does *not* attempt to automate is whether it visually "looks right" on a given device; that stays the maintainer's job, now with a named checklist (FR-019, FR-020) instead of an unstated expectation. No browser-automation infrastructure is added. | PASS |

No violations — Complexity Tracking is not needed. One design decision
worth flagging as a non-obvious technical interpretation (not a
constitution trade-off): FR-013c's "pure function over component source
text" is satisfied by reading each component's live `.svelte` file with
`readFileSync` inside the test process (same pattern
`toolbarGeometry.test.ts` already uses) and passing that *string* into
every gate/mutate function, never a component instance, a rendered DOM
node, or a fixed hard-coded path baked into the check functions
themselves (research.md §2).

## Project Structure

### Documentation (this feature)

```text
specs/013-rendered-geometry-gate/
├── plan.md                          # This file (/speckit-plan command output)
├── research.md                      # Phase 0 output
├── data-model.md                    # Phase 1 output
├── quickstart.md                    # Phase 1 output
├── contracts/
│   └── geometry-gate.md             # Phase 1 output
└── tasks.md                         # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

This feature extends the scaffold established by `001-falling-pink-sand`
through `012-canvas-first-toolbar` (not greenfield). Files marked **(new)**
are added by this feature; files marked **(modified)** have their contents
changed but keep their existing responsibility; everything else is
unchanged.

```text
index.html                  # unchanged
package.json                 # unchanged — no new dependency
tsconfig.json / vite.config.ts / vitest.config.ts   # unchanged

src/
├── main.ts                 # unchanged
├── App.svelte              # (modified) reads layout.ts's readArrangement()/RAIL_MEDIA_QUERY instead of its own hard-coded @media rule; applies class:rail to <main> (FR-007, FR-007b)
├── lib/
│   ├── PlayArea.svelte     # unchanged — its canvas's on-screen size is already fully derived via an inline style bound to computePlayField's output (research.md §5); no bug found, this feature only adds verification
│   ├── Toolbar.svelte      # (modified) reads readArrangement() and passes it into computeToolbarLayout instead of letting that function derive arrangement from the measured visual viewport (FR-007a)
│   ├── toolbarControls.ts  # unchanged (spec 012's manifest)
│   ├── layout.ts           # (modified) computeToolbarLayout's arrangement is now an explicit parameter, not derived internally; new RAIL_MEDIA_QUERY constant + readArrangement() helper; every other export unchanged
│   ├── glyphSupport.ts, particles.ts, sparkle.ts, BucketIcon.svelte, fullscreen.ts, sound.ts, palette.ts  # unchanged
└── sim/                    # framework-free, hot-path core (constitution III) — entirely unchanged

tests/
└── unit/
    ├── lib/
    │   └── layout.test.ts             # (modified) new cases for computeToolbarLayout's explicit-arrangement parameter and readArrangement()
    ├── shell/
    │   ├── geometryInvariants.ts      # (new) the documented invariant list — one entry per geometry-critical fact per derived-geometry component (FR-008, FR-009, FR-011)
    │   ├── geometryGate.ts            # (new) pure check/mutate functions over component source text — the invariant list's enforcement arm (FR-002, FR-003, FR-013b, FR-013c, FR-018a)
    │   ├── toolbarGeometry.test.ts    # (rewritten) drives the toolbar band + control checks off geometryInvariants/geometryGate; the three historical-cause negative cases (FR-013, FR-013a); the closed-allowlist and transform-growth cases (SC-012, SC-013)
    │   ├── playAreaGeometry.test.ts   # (new) Story 4 — the play area's container and canvas against the same list/gate
    │   ├── indexHtml.test.ts, toolbarGlyphs.test.ts  # unchanged
    └── sim/                           # unchanged
```

**Structure Decision**: Same single client-only project 001–012
established — no `backend/`/`frontend/` split, no new top-level directory.
The verification-only modules live under `tests/unit/shell/` rather than
`src/lib/` because, unlike spec 012's `toolbarControls.ts`, neither
`geometryInvariants.ts` nor `geometryGate.ts` is a runtime dependency of
the shipped app — they exist only to be imported by the `vitest` suite,
so keeping them out of `src/` keeps `dist/index.html`'s bundle exactly as
small as it would be without this feature (Principle I) and keeps the
verification/production boundary visible in the file tree. Production
changes are two small, additive edits (`layout.ts`, `Toolbar.svelte`,
`App.svelte`) confined to the one existing exposure this spec found
(FR-007's duplicated arrangement decision) — no `src/sim/*` file changes,
which is what keeps every existing simulation test passing unchanged.

## Complexity Tracking

*No entries — Constitution Check reported no violations.*
