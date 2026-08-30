# Phase 0 Research: Rendered Geometry Matches The Layout Model

No `[NEEDS CLARIFICATION]` markers were left in `spec.md` — the three
open questions were resolved by @charlesguse on issue #41 and recorded in
the spec's own Clarifications section (hybrid guarded-set closure; unify
the arrangement decision on the layout viewport; permanent,
source-derived negative cases). This document resolves the remaining
*how* for the technical choices the spec leaves open, building on spec
012's `src/lib/layout.ts` foundation (`computeToolbarLayout`,
`computePlayField`) rather than replacing it.

## §1 Where the invariant list and gate live

**Decision**: Two new plain-TypeScript modules under `tests/unit/shell/`
— `geometryInvariants.ts` (data: the documented list) and
`geometryGate.ts` (pure functions: check + mutate) — imported by
`toolbarGeometry.test.ts` and the new `playAreaGeometry.test.ts`. Neither
is imported by any `src/` file.

**Rationale**: FR-008 requires "a single, named, documented invariant
list"; SC-008 requires a maintainer can read the full set of protected
facts "in one place... without opening the test suite." A richly
commented, single-purpose data file with one entry per fact (component,
category, assumption, mechanism, historical cause) satisfies both: it's
one file, not scattered `expect()` calls, and "without opening the test
suite" is read as "without inferring coverage from test assertions,"
which a self-describing data file (as opposed to a fixture only a test
runner exercises) achieves regardless of which directory it lives in.
Putting it under `tests/` rather than `src/lib/` keeps a hard,
inspectable line between "what ships" and "what verifies what ships" —
spec 012's `toolbarControls.ts` earned its place in `src/lib/` because
`Toolbar.svelte` renders *from* it at runtime; `geometryInvariants.ts` has
no runtime consumer, so putting it in `src/` would be dead weight in
`dist/index.html` for no reason the constitution asks for.

**Alternatives considered**: A markdown-only list under `specs/013-.../`
— rejected because nothing would enforce FR-010 ("every entry requiring
an assertion MUST have one... ad-hoc, scattered geometry assertions MUST
NOT be how this guarantee is held"); a markdown doc and the actual checks
would be two artifacts that can drift from each other, which is the same
failure shape this feature exists to close, one level up. Putting the
list in `src/lib/` — rejected per Rationale above; also would nudge a
future contributor into thinking the app imports it at runtime.

## §2 The gate as a pure function over source text (FR-013c)

**Decision**: Every check function in `geometryGate.ts` has the shape
`(source: string) => GeometryCheckResult` (data-model.md) — it never
opens a file itself. The one call to `node:fs`'s `readFileSync` per
component lives in the `*.test.ts` files, exactly where
`toolbarGeometry.test.ts` already does it today. Each of the three
historical-cause negative cases is a `mutate*(source: string): string`
function with the same shape, composed as `check(mutate(readFileSync(...)))`
inside a test.

**Rationale**: FR-013c states this as a binding design constraint: "the
check MUST be expressible as a pure function over component source text,
rather than something that can only read one fixed path." Keeping all
I/O at the test-file boundary means every check/mutate function is
trivially unit-testable against an inline string in the future, is
manifestly free of DOM/browser access (Principle V), and — the concrete
payoff — the exact same `check` function runs against both the real
source (must pass) and the mutated copy (must fail), so there is no
second, parallel "negative-case" implementation to keep in sync with the
positive one.

**Alternatives considered**: A single "god function"
`checkComponent(path: string)` that reads the file itself — rejected;
it's what FR-013c explicitly forbids ("something that can only read one
fixed path"), and it would make the mutation tests reach for a temp file
or a monkey-patched `fs` instead of a plain string transform.

## §3 The closed allowlist for the guarded set (FR-018, FR-018a)

**Decision**: `geometryGate.ts` exports a small declaration parser —
given a CSS rule block's text (e.g. everything between `.control {` and
its matching `}`, already how `toolbarGeometry.test.ts` slices things
today), split on `;`, then on the first `:`, trim, to get
`{ property, value }` pairs. A `GUARDED_PROPERTY_PATTERN` regex
(`/^(box-sizing|border(-\w+)?|padding(-\w+)?|margin(-\w+)?|width|height|min-width|min-height|max-width|max-height|transform)$/`)
classifies each declaration as guarded or not. For a guarded property, the
gate looks it up in that component's `ALLOWED_DECLARATIONS` map (data,
alongside the invariant list); a hit whose value doesn't match fails
naming the mismatch, a miss fails as "unrecognized declaration in the
guarded set" (FR-018a), and any declaration whose property does not match
`GUARDED_PROPERTY_PATTERN` — `box-shadow`, `background`, `animation`,
`transition`, a conic gradient — is skipped outright, satisfied by
construction because the pattern never matches it (FR-018b, FR-015,
SC-012).

**Rationale**: This is the direct implementation of the spec's hybrid
answer to "how completely is the class closed" — closed allowlist inside
the guarded categories (so an unrecognized declaration in
`box-sizing`/`border`/`padding`/`margin`/`width`/`height`/`transform`
fails even though nobody wrote a check for it, FR-018a/SC-013), assertion
of only the enumerated facts outside it (so a cosmetic box-shadow tweak —
this toolbar's actual grouping cue — never trips the gate, FR-018b/
SC-012). Parsing declarations generically (rather than one `expect().toMatch()`
regex per known-good value, as today's file does) is what makes "a
declaration the invariant list does not name" detectable at all: a
regex that only looks for `box-sizing:\s*border-box` can never notice a
sibling `border-radius: 40%` sneaking size into the box, because it never
looks at anything but the one substring it's hunting for.

**Alternatives considered**: A blanket allowlist covering every
declaration in `.control`'s rule (whatever ships today is "the" allowed
set) — rejected outright by FR-018b/the spec's own answer: it would
permit the *next* accidental size-increasing declaration exactly the way
the pre-existing regex-per-fact tests did, and defeats FR-018a's purpose.
A full CSS-in-JS parser (e.g. `postcss`) — rejected as a new dependency
(constitution Principle III, "no other runtime dependencies without a
spec explicitly justifying them" — this is a dev dependency, but the spec
names no such need) for a job a ~15-line splitter handles completely,
given the component's `<style>` blocks are hand-written, not generated,
and never contain nested rules or `;` inside a value that would break
naive splitting (verified against the current `Toolbar.svelte`/
`PlayArea.svelte` source below).

## §4 Distinguishing growth from shrink in `transform` (FR-016)

**Decision**: When the declaration parser (§3) finds `property ===
'transform'`, it does not look it up in a static allowed-value map like
other guarded properties. Instead it extracts every `scale(...)`
/`scaleX(...)`/`scaleY(...)`/`scale3d(...)`/`matrix(...)` function call in
the value, parses out each numeric factor, and fails only if any factor's
absolute value exceeds `1`. `translate*()`/`rotate*()` functions (size-
neutral) are ignored. A control with no `transform` declaration at all
passes trivially (nothing to shrink or grow).

**Rationale**: FR-016 requires the gate to "distinguish a size-increasing
transform... from a size-decreasing one... and forbid only the former" —
a fixed allowlist of "known good" transform values (e.g. hard-coding
`scale(0.92)` as the one allowed value) would satisfy today's shipped CSS
but reject any future shrink value the maintainers pick for a new
pressed-state flourish, which is exactly the "gate people route around"
failure FR-018b warns about generalized to a different property. A
numeric parse is the only mechanism that is simultaneously permissive of
harmless shrink and strict about growth without being re-tuned by hand
every time `.control:active`'s press-down feedback changes by a tenth.

**Alternatives considered**: Forbidding `transform` inside the guarded
set outright — rejected; it's exactly the loophole edge case the spec
calls out ("must distinguish growth from shrink... or it will either
forbid harmless delight or permit the exact bug that shipped"). Comparing
against `getComputedStyle`'s resolved matrix — rejected, that requires a
DOM (Principle V).

## §5 Play area coverage (Story 4)

**Decision**: The play area's canvas gets its on-screen box entirely from
an inline style, `style="width: {displayWidth}px; height: {displayHeight}px;"`
in `PlayArea.svelte`, where `displayWidth`/`displayHeight` are
`computePlayField`'s own output fields — already a single derivation
channel with nothing to assert (FR-001a). `playAreaGeometry.test.ts`
confirms this structurally (the inline `style` attribute's `width`/
`height` bind to `displayWidth`/`displayHeight`, by source inspection),
then runs the same closed-allowlist declaration scan (§3) over
`.play-area-container` and `.play-area`'s rule blocks, with both
components' `ALLOWED_DECLARATIONS` maps empty — meaning any guarded
declaration appearing there in the future (a stray `padding`, a
`transform`) fails immediately, which is exactly "recorded on the list as
geometrically inert" made enforceable (FR-001b, Story 4 Acceptance
Scenario 1) rather than merely asserted once in this document.

One category needs its own note: `.play-area-container` measures itself
via `container.clientWidth`/`clientHeight` at resize time
(`PlayArea.svelte`'s `measureField()`), and `clientWidth`/`clientHeight`
already include any padding on the *measured* element — so unlike the
toolbar band (which budgets a fixed CSS custom property *ahead of*
render), a hypothetical future `padding` on `.play-area-container` would
be picked up by the next measurement rather than silently shrinking the
canvas's effective drawn region below what was measured. It is still
guarded (padding is in `GUARDED_PROPERTY_PATTERN`) because a maintainer
reading the invariant list should not have to independently re-derive
that self-correcting property before trusting the "inert" entry — the
list records *why* each entry is inert, not just *that* it is.

**Rationale**: Directly satisfies Story 4 ("the play area gets the same
protection... its geometry-critical declarations are derived or pinned")
and closes the spec's own concern that a class of bug found in one place
almost certainly exists in the only other place a model decides
geometry, even with "no bug has been observed here" (spec's Why priority
note) — the check exists so a *future* regression (e.g. someone adding
`padding` to give the canvas some breathing room) is caught before
review, which is the whole thesis of Story 2 applied a second time.

**Alternatives considered**: Skipping Story 4 as lower priority (P3) —
rejected; it's still a mandatory acceptance scenario in the accepted
spec, and the marginal cost is small once §1–§4's machinery exists for
the toolbar (same gate functions, a second, smaller data table).

## §6 Unifying the rows/rail decision (FR-007, FR-007a, FR-007b)

**Decision**: `src/lib/layout.ts` adds:

```ts
export const RAIL_MEDIA_QUERY = '(max-height: 480px) and (orientation: landscape)';
export function readArrangement(
  matchMedia: (query: string) => { matches: boolean } = (q) => window.matchMedia(q),
): 'rows' | 'rail' {
  return matchMedia(RAIL_MEDIA_QUERY).matches ? 'rail' : 'rows';
}
```

`computeToolbarLayout`'s signature gains an explicit `arrangement: 'rows'
| 'rail'` parameter and stops computing it from `viewportWidth`/
`viewportHeight` internally. `Toolbar.svelte` calls `readArrangement()`
on the same debounced measurement path it already runs (mount, resize,
orientation change) and passes the result in. `App.svelte` calls the same
`readArrangement()` (with its own tiny `$state` + a `matchMedia(...).
addEventListener('change', ...)` listener, since `<main>`'s flex
direction has no other reason to re-render on resize today) and applies
`class:rail={arrangement === 'rail'}` to `<main>`, and its `<style>`
block's `@media (max-height: 480px) and (orientation: landscape) { main {
flex-direction: row; } }` becomes a plain, non-conditional `main.rail {
flex-direction: row; }` rule.

**Rationale**: Today there are genuinely two independent rules for one
binary fact: `App.svelte`'s CSS `@media` block (which — like any CSS
media query or `matchMedia` call — evaluates against the browser's
*layout* viewport, already immune to pinch-zoom) and
`computeToolbarLayout`'s own `viewportHeight <= PHONE_MAX_SHORT_SIDE &&
viewportWidth > viewportHeight` arithmetic, fed by `Toolbar.svelte`'s
`window.visualViewport`-derived measurement — the *visual* viewport,
which pinch-zoom shrinks. The two happen to agree at every viewport in
spec 012's representative table today (SC-014's "0 viewports where the
arrangement differs") purely because nobody has pinch-zoomed while
reading a table row; they are not the same rule. Passing `arrangement` in
as a parameter driven by one shared `readArrangement()` call removes the
second, independently-thresholded implementation rather than merely
asserting post hoc that the two agree — which is the same "derive, don't
duplicate-then-check" preference FR-002 states for geometry-critical
values in general, applied to this one binary fact. Threading it through
`App.svelte` as a JS-computed class (rather than trying to get a JS
constant into a `<style>` block's `@media` at-rule, which Svelte's scoped
CSS has no mechanism for) is the only way for `App.svelte` to consume the
exact same decision rather than a textually-copied threshold that could
drift if one `480` is edited without the other.

**Alternatives considered**: Leaving `App.svelte`'s CSS media query as
the one true source and having `computeToolbarLayout` call
`window.matchMedia` itself inside the pure function — rejected; it would
make a function the test suite calls directly (`tests/unit/lib/
layout.test.ts`) reach for a global that doesn't exist under `vitest`'s
Node environment, breaking Principle V's "no DOM" for a function that
has stayed pure since spec 006. Keeping two independent rules and adding
only an assertion that they agree at every representative-table viewport
— rejected; it satisfies SC-014's letter today but not FR-007's "exactly
one source of truth," and does nothing about the pinch-zoom hazard
FR-007a exists to close, since the visual-viewport-driven rule would
still be live and still capable of disagreeing with the layout-viewport
one at a viewport the table doesn't cover.

## §7 Verifying "exactly one source of truth" structurally (Story 4 AC3)

**Decision**: `playAreaGeometry.test.ts` (or a small addition to
`toolbarGeometry.test.ts`) asserts, by source inspection, that
`App.svelte` imports `readArrangement`/`RAIL_MEDIA_QUERY` from
`./lib/layout` and that its `<style>` block contains no `@media` rule
mentioning `orientation` or `max-height` — i.e. the old, independently
-thresholded rule is provably gone, not just superseded. This is a
structural (source-text) check, in keeping with Principle V and this
feature's whole approach, and it is what makes "exactly one source of
truth" (FR-007, SC-014) a build-time fact rather than a claim in this
plan.

**Rationale**: A behavioral test could confirm the two never disagree at
the representative-table viewports (as spec 012's `layout.test.ts`
already does for other floors) but, per §6, could not by itself catch a
maintainer re-introducing a second, textually independent `@media` rule
that happens to use the same numbers today and only drifts later — the
same silent-agreement failure mode the whole feature exists to close, one
level up. Checking that the old CSS shape is *gone* closes that loophole
directly.

**Alternatives considered**: Only testing that `App.svelte` and
`Toolbar.svelte` agree at every representative-table viewport (numeric,
behavioral) — rejected as the sole check, for the reason above; kept as a
secondary belt-and-suspenders assertion since it's cheap and reuses
spec 012's existing viewport table.

## §8 Message format on failure (FR-014)

**Decision**: `GeometryCheckResult` (data-model.md) always carries
`{ ok, component, invariant, assumption, found }`. Every `*.test.ts`
assertion reports failures via `expect(result.ok, formatFailure(result)).
toBe(true)` (or `expect.fail(formatFailure(result))` inside a loop), where
`formatFailure` renders exactly those four fields as one line — matching
spec 012's own FR-012b precedent ("375×667 rows: needs `requiredThickness`
px, has `cap`px") of putting failure diagnostics in the return value
itself rather than only in a hand-written `expect` message string that
could drift from what the check actually found.

**Rationale**: FR-014 requires "the component, the invariant that broke,
what the layout model assumes, and what was found — enough to fix without
re-deriving the model," matching FR-012b's existing bar. Building this
into `GeometryCheckResult`'s own shape (rather than composing it ad hoc at
each call site) guarantees every one of the gate's ~20+ assertions
produces a uniformly complete message, including the negative-case tests
this feature adds are the least code but the check the spec cares most
about (Story 2 Scenario 4, SC-011).

**Alternatives considered**: Per-assertion hand-written `expect(...).toMatch(...)`
failure text, as `toolbarGeometry.test.ts` does today — rejected; it's
exactly the "ad-hoc, scattered... geometry assertions" FR-010 asks to
fold into the named list, and nothing stops a future assertion from
omitting one of FR-014's four required pieces of information.

## §9 No change to spec 012's model or floors

**Decision**: `computeToolbarLayout`'s and `computePlayField`'s actual
sizing arithmetic — `TOOLBAR_BAND_MAX_SHARE`, the two-phase shrink,
`MIN_TOUCH_TARGET`, `MIN_PITCH`, the area-fill floors — is untouched
except for the arrangement parameter becoming explicit (§6, a pure
signature change with identical behavior at every representative-table
viewport, since the caller now passes exactly what the function used to
compute internally). `tests/unit/lib/layout.test.ts`'s existing floor
assertions are updated only to pass the new parameter, never relaxed.

**Rationale**: FR-021 ("No spec-012 floor may be weakened, relaxed, or
made conditional") and the spec's own Constraints section ("Do not weaken
any spec-012 floor to make a check easier to write") are binding. Nothing
in this feature's design needs a floor to move — the six-off-screen bug
was a CSS/model disagreement, not a wrong floor value, so a check that
closes it needs zero changes to what the floors *are*.

**Alternatives considered**: None seriously considered — this is a
guardrail restated for this document's own review, not a real design
choice with competing options.
