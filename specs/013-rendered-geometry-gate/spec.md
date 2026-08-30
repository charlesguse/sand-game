# Feature Specification: Rendered Geometry Matches The Layout Model

**Feature Branch**: `013-rendered-geometry-gate`

**Created**: 2026-08-30

**Status**: Draft

**Input**: Lifecycle issue #41 — "The layout gate checks the model, not what the child actually sees"

> ## The wish
>
> Spec 012 gave the drawing area a guaranteed share of the screen and a hard
> build-time gate to defend it. The gate passed. The toy still shipped broken to
> review: on a 667x375 phone in landscape **six controls rendered outside the
> viewport** — all three scene buttons and all three brush sizes — where the
> body's `overflow: hidden` made them unreachable. A child would simply have lost
> the scene buttons.
>
> The whole test suite was green the entire time.
>
> ## Why the gate could not see it
>
> `computeToolbarLayout` is a model: it decides a control is 56px and that a line
> of them fits. The browser then renders whatever the CSS actually says. Nothing
> made those two agree, and three separate declarations disagreed at once:
>
> 1. `.control` set `width: var(--control-size)` with a `3px` border and no
>    `box-sizing: border-box`, so every "56px" control rendered 62-64px.
> 2. The rail arrangement took its **width** from the model but kept row flow, so
>    controls wrapped inside a 224px-wide band and ran 452px down a 375px screen.
> 3. `.control.selected` scaled `1.15`, pushing the selected control's ring past
>    the screen edge once the band hugged that edge.
>
> Each was invisible to a test that only exercises the model's arithmetic. This is
> a *class* of bug, not three bugs: any CSS declaration that changes an element's
> rendered size or flow can silently contradict the number the model budgeted
> against, and nothing today notices.
>
> ## Shape of the feature
>
> Make the toolbar's rendered geometry a **function of the layout model alone**,
> and make a contradiction fail the suite:
>
> - Enumerate the CSS properties that can change rendered size or flow (box
>   sizing, borders, padding, margins, flow direction, wrapping, gaps, transforms
>   that scale). For the controls and the band, each is either derived from the
>   model's output or pinned to a value the model assumes — never left to drift.
> - The automated check asserts those facts, so re-introducing any of the three
>   causes above fails `npm test`.
> - Specs that change layout say what a maintainer must eyeball, and on which
>   device, per the two-column split in `CLAUDE.md`.
>
> ## Constraints
>
> - **Constitution Principle V is binding: "Do not add browser-automation test
>   infrastructure."** CI has no browser. Whatever this feature adds must run in
>   plain `vitest` with no DOM and no headless browser. The answer is structural
>   invariants, not a rendering harness.
> - Kid-first rules unchanged: no reading, no failure states, no new controls.
> - Spec 012 owns `computeToolbarLayout`, `toolbarControls.ts`, and the band's
>   floors; this feature strengthens that gate rather than replacing it.
> - Do not weaken any spec-012 floor to make a check easier to write.

## User Scenarios & Testing *(mandatory)*

Throughout this spec:

- The **layout model** is the shared sizing rule that decides control size,
  pitch, band thickness, arrangement (rows or rail), and play-field size — spec
  012's `computeToolbarLayout` and spec 006's `computePlayField`, together with
  the constants they are built from.
- **Rendered geometry** is the size and position an element actually takes on
  screen once the stylesheet is applied — as distinct from the number the layout
  model budgeted for it.
- A **geometry-critical declaration** is any style declaration that can change an
  element's rendered size on either axis, or the direction, wrapping, or spacing
  of the flow that positions it. The categories are: box sizing, borders,
  padding, margins, flow direction, wrapping, gaps and inter-item spacing,
  size-changing transforms, and any explicit width/height/min/max sizing.
- A **derived-geometry component** is a component whose on-screen size or flow is
  decided by the layout model rather than by its own contents — today the toolbar
  band and its controls, and the play area and its canvas.
- The **invariant list** is the single named, documented enumeration this feature
  produces: one entry per geometry-critical fact that the layout model depends on,
  each recording which component it governs, what the model assumes, and how that
  assumption is held true.
- **Drift** is any state in which a geometry-critical declaration contradicts what
  the layout model assumed — the condition that shipped six unreachable controls
  while the suite was green.

### User Story 1 - Every button stays on the screen she can touch (Priority: P1)

The child picks up the tablet in landscape. Every button she has ever had is on
the screen and reachable: the scene buttons, the brush sizes, all of them. No
button has been pushed past the edge of the glass where the page's
no-scrolling rule makes it permanently unreachable, and none is clipped by the
screen edge.

**Why this priority**: This is the shipped bug. Six controls — every scene and
every brush size — rendered off a 667×375 screen behind `overflow: hidden`.
For a child who cannot read and has no idea a control ever existed there, a
control off the edge is a control deleted from the toy, with no way to discover
it is missing and no way to get it back.

**Independent Test**: For each derived-geometry component, confirm every
geometry-critical declaration is either derived from the layout model's output or
pinned to the exact value the model assumes, so the rendered band cannot exceed
the thickness the model budgeted. Confirm on a real device that no control
touches or crosses a screen edge in either orientation (the maintainer eyeball
half, per Story 3).

**Acceptance Scenarios**:

1. **Given** a 667×375 phone in landscape, **When** the toy opens, **Then** every
   control is fully inside the visible viewport, no control is clipped by an
   edge, and nothing scrolls.
2. **Given** a 375×667 phone in portrait, **When** the toy opens, **Then** the
   same holds.
3. **Given** the selected control is the last one on the outermost line,
   **When** it shows its selected emphasis, **Then** the emphasis stays inside
   the space the layout model budgeted for that control and does not cross the
   screen edge.
4. **Given** a device with a notch or rounded corners, **When** the toy opens,
   **Then** the safe-area insets are taken out of the toolbar band's budget and
   no control ends up under a notch, a home indicator, or off the edge.
5. **Given** any viewport in spec 012's representative table, **When** the toy
   opens, **Then** the rendered toolbar band's thickness does not exceed the
   thickness the model computed for that viewport.

---

### User Story 2 - A drifting stylesheet fails the suite, not the review (Priority: P1)

A maintainer changes something in the toolbar's styling — adds a border, a bit of
padding, a hover flourish that scales a button. If that change contradicts what
the layout model budgeted, `npm test` goes red and says which fact broke. The
maintainer finds out in seconds on a machine with no browser, instead of at
review on the one device that happens to show it — or, worse, after a merge.

**Why this priority**: Equal-first with Story 1. The three causes were fixed
once; nothing stops the fourth. The whole point of spec 012's gate was that the
guarantee could not rot, and it rotted anyway in the one place the gate did not
look. A guarantee that only holds until the next stylesheet edit is not a
guarantee.

**Independent Test**: Re-introduce each of the three historical causes, one at a
time, into the shipped component and confirm the test suite fails each time with
a message naming the broken fact — then restore. Confirm the suite still runs
with no DOM and no browser.

**Acceptance Scenarios**:

1. **Given** the shipped toolbar, **When** a control's border or padding is
   allowed to render outside the size the model budgeted (historical cause 1),
   **Then** the suite fails.
2. **Given** the shipped toolbar, **When** the band's flow runs along an axis
   other than the one the model budgeted against (historical cause 2), **Then**
   the suite fails.
3. **Given** the shipped toolbar, **When** a control state scales a control
   beyond its budgeted box (historical cause 3), **Then** the suite fails.
4. **Given** any of those failures, **When** the maintainer reads the output,
   **Then** it names the component, the invariant that broke, what the model
   assumes, and what was found instead — enough to fix without re-deriving the
   model.
5. **Given** the check, **When** the suite runs in CI, **Then** it completes with
   no browser, no headless browser, and no DOM, alongside the existing tests.
6. **Given** a maintainer who wants to know what is protected, **When** they open
   the invariant list, **Then** every fact the layout model depends on is there in
   one place, each with the component it governs and why it matters — and there is
   no geometry assertion elsewhere in the suite that is absent from the list.
7. **Given** a change that would breach a spec-012 floor, **When** the suite runs,
   **Then** it still fails exactly as spec 012 requires — this feature adds a gate
   and weakens none.

---

### User Story 3 - Layout changes name what to eyeball, and on whose device (Priority: P2)

The automated gate covers what arithmetic and structure can cover. What is left
— does the toolbar still look like a friendly row of round buttons, does anything
crowd the notch — is a human's job, and the spec says exactly whose: which
maintainer, which device, which viewport, and the specific observable thing to
look for.

**Why this priority**: Neither maintainer routinely tests the other's platform
(CLAUDE.md). "Check it looks right" produces a review that misses six controls
off the edge, because nobody was asked to check that specific thing on that
specific screen. A named observable on a named device is checkable; a vibe is not.

**Independent Test**: Read this spec's eyeball checklist and confirm each item
names a maintainer, a device, a viewport or orientation, and a single observable
statement that is true or false — no item requiring judgement about whether
something "looks right".

**Acceptance Scenarios**:

1. **Given** this spec, **When** a maintainer reads its eyeball checklist,
   **Then** each item names the maintainer, the device, the orientation, and one
   observable fact — including "no control touches or crosses a screen edge in
   either orientation".
2. **Given** a future spec that changes layout, **When** it is written, **Then**
   it carries the same kind of checklist, split by the two-column platform table
   in CLAUDE.md.
3. **Given** an item that only one maintainer's device can verify, **When** the
   other maintainer reviews, **Then** the checklist says so rather than letting
   them assume it was covered.

---

### User Story 4 - The play area gets the same protection (Priority: P3)

The play area's size is decided by a model too. It gets the same treatment as the
toolbar: its geometry-critical declarations are derived or pinned, and the same
invariant list covers it, so the canvas cannot quietly render larger than the
region the model measured.

**Why this priority**: Lower than the toolbar because no bug has been observed
here — but the play area is the *only other* place a model decides geometry, and
it carries the same shape of exposure. Covering it while the pattern is fresh
costs little; discovering the same class of bug there later costs another
shipped-broken review.

**Independent Test**: Enumerate the play area's geometry-critical declarations
against the same categories used for the toolbar and confirm each is derived,
pinned, or explicitly recorded as not affecting rendered size or flow.

**Acceptance Scenarios**:

1. **Given** the play area, **When** its geometry-critical declarations are
   enumerated, **Then** each is derived from the model, pinned to a value the
   model assumes, or recorded on the list as geometrically inert.
2. **Given** a change that would make the canvas render larger than the region the
   model measured, **When** the suite runs, **Then** it fails.
3. **Given** the rows-versus-rail arrangement, **When** the toolbar band and the
   app shell each decide which way the screen is split, **Then** they cannot
   disagree — there is one source of truth for that decision.

---

### Edge Cases

- **A geometry-critical declaration arriving from outside the component.** The
  page-level stylesheet, a global rule, or a browser's own default for an element
  (a button's built-in padding) can change rendered size without any declaration
  in the component itself. Such influences must be neutralised inside the
  component or recorded on the invariant list; "we didn't write it" is not the
  same as "it isn't there".
- **Safe-area insets as padding on the band.** The insets are padding on the
  toolbar band, and spec 012 FR-005 says they come out of the band's budget, not
  the drawing region's floor. The list must record how the band's own thickness
  accounts for them, because padding inside a fixed-thickness band eats the space
  the controls were budgeted.
- **A transform that shrinks rather than grows.** The press-down feedback scales a
  control *down*, which cannot push anything off-screen. The invariant must
  distinguish growth from shrink rather than banning transforms outright, or it
  will either forbid harmless delight or permit the exact bug that shipped.
- **A child element that is not itself a control.** The sand tool's icon is drawn
  inside a control rather than being a glyph. Anything nested inside a
  model-sized box must size from that box, not independently.
- **A control set that changes at runtime.** Fullscreen and photo controls are
  present on some devices and absent on others; the invariants must hold for both
  control sets, as spec 012 FR-003 already requires of the floors.
- **A new derived-geometry component.** If a future feature lets a model decide
  some other element's geometry, that element is not covered until it is added to
  the list. The list must make its own scope explicit so the gap is visible rather
  than silent.
- **A geometry-critical property nobody thought of.** The enumeration is a
  judgement about which properties matter. A property outside the enumerated
  categories can still cause drift, which is why FR-018 fixes how the enumeration
  is revised when that happens.
- **A styling change that is genuinely cosmetic.** Colour, shadow, gradient, and
  animation of non-geometric properties must stay free to change without touching
  the list — a gate that fires on every visual tweak will be routed around.

## Requirements *(mandatory)*

This feature strengthens the verification requirements of spec
`012-canvas-first-toolbar` (which itself amends spec `006-phone-support`). It
adds no new control, no new interaction, and no change the child can see. All
requirements of specs 001–012 remain in force; **no spec-012 floor may be
weakened, relaxed, or made conditional by anything in this feature.**

### Functional Requirements

**Making drift impossible**

- **FR-001**: Every geometry-critical declaration of every derived-geometry
  component MUST be either (a) **derived** — its value comes from the layout
  model's output through a single channel, so there is one source of truth — or
  (b) **pinned** — it is fixed at exactly the value the layout model assumes, and
  that pinning is recorded on the invariant list. No geometry-critical declaration
  may be left to drift.
- **FR-002**: Derivation MUST be preferred to assertion. Where a geometry-critical
  fact can be expressed as a value the model produces, it MUST be expressed that
  way rather than duplicated in the stylesheet and merely checked afterwards.
- **FR-003**: Where a fact cannot be expressed as a value — a flow direction, a
  box-sizing mode, a wrapping mode, the absence of a size-increasing transform —
  it MUST be asserted, and each such assertion MUST correspond to exactly one
  named entry on the invariant list.
- **FR-004**: A control's rendered box MUST NOT exceed the size the layout model
  budgeted for it on either axis, in any state it can be in — resting, selected,
  pressed, disabled, or focused. Borders, outlines, padding, and any other
  decoration MUST be accounted for within that budgeted size or be provably
  incapable of increasing it.
- **FR-005**: The toolbar band's controls MUST flow along the axis the layout
  model budgets against, and wrap across the axis the model measures thickness on,
  in **both** arrangements (rows and rail).
- **FR-006**: Spacing between controls, both within a line and between lines, MUST
  match what the model's thickness computation assumes. A gap the model does not
  account for MUST NOT exist.
- **FR-007**: The rows-versus-rail arrangement MUST have exactly one source of
  truth. Every part of the layout that depends on which arrangement is active MUST
  read that same decision, so the band's flow axis and the surrounding layout's
  split direction can never disagree at a viewport where two independent rules
  would resolve differently.

**The invariant list**

- **FR-008**: This feature MUST produce a single, named, documented **invariant
  list**: one entry per geometry-critical fact the layout model depends on. Each
  entry MUST record the component it governs, the categories it covers, what the
  model assumes, whether it is held by derivation or by assertion, and — for the
  three historical causes — which shipped bug it prevents.
- **FR-009**: The invariant list MUST cover, for each derived-geometry component,
  every one of the enumerated categories: box sizing, borders, padding, margins,
  flow direction, wrapping, gaps and inter-item spacing, size-changing transforms,
  and explicit width/height/min/max sizing. A category with nothing to hold in a
  given component MUST be recorded as such rather than omitted, so a reader can
  tell "considered and inert" from "forgotten".
- **FR-010**: Every geometry assertion in the test suite that exists to protect the
  layout model MUST correspond to a named entry on the list, and every entry
  requiring an assertion MUST have one. Ad-hoc, scattered, or undocumented
  geometry assertions MUST NOT be how this guarantee is held.
- **FR-011**: The invariant list MUST state its own scope — which components it
  covers — so that a component whose geometry is not protected is visibly outside
  the list rather than silently missing from it.

**The automated check**

- **FR-012**: The check MUST run inside the existing test suite (`npm test`) in
  plain vitest, with **no DOM, no headless browser, and no browser-automation
  infrastructure of any kind** (constitution Principle V, binding).
- **FR-013**: Re-introducing any of the three historical causes MUST fail the
  suite: (1) a control whose border or padding renders outside the size the model
  budgeted; (2) a band whose flow runs along an axis other than the one the model
  budgets against; (3) a control state that scales a control beyond its budgeted
  box. This is the feature's acceptance test — the check earns its place only by
  catching the exact bug that got through.
- **FR-014**: When the check fails it MUST name the component, the invariant that
  broke, what the layout model assumes, and what was found instead — enough for a
  maintainer to fix it without re-deriving the model (matching spec 012 FR-012b's
  standard for its own failures).
- **FR-015**: The check MUST NOT fire on changes that cannot alter rendered size
  or flow — colour, shadow, gradient, and animation of non-geometric properties
  MUST remain free to change.
- **FR-016**: The check MUST distinguish a size-**increasing** transform (which can
  push a control past a screen edge) from a size-**decreasing** one (which cannot),
  and MUST forbid only the former.
- **FR-017**: The check MUST hold for every control set the toy can ship,
  including with the feature-detected fullscreen and photo controls present and
  absent.
- **FR-018**: When drift is found in a property outside the enumerated categories,
  the resolution MUST be to add the category to the invariant list and to the
  check — not to fix the one declaration and move on. The list is the artifact
  that grows; a one-off fix leaves the class of bug open.

**The maintainer eyeball half**

- **FR-019**: This spec MUST carry a per-platform eyeball checklist, split by the
  two-column platform table in CLAUDE.md, naming for each item: the maintainer,
  the device, the orientation or viewport, and a single observable statement that
  is true or false. "No control touches or crosses a screen edge in either
  orientation" MUST be one of those observables.
- **FR-020**: Every future spec that changes layout MUST carry the same kind of
  checklist. An item verifiable on only one maintainer's device MUST say so, so
  the other maintainer does not assume it was covered.

**Non-regression**

- **FR-021**: No spec-012 floor may be weakened, relaxed, or made conditional to
  make a check easier to write — not the 40% band cap, not the 44-pixel touch
  target, not the area-fill floors, not the fail-rather-than-degrade rule.
- **FR-022**: Nothing the child sees may change. No control is added, removed,
  moved, resized, or relabelled; no new interaction is introduced; no failure
  state, message, or error surface appears (constitution Principle II).
- **FR-023**: The production build MUST still emit exactly one self-contained page
  that plays from `file://` with no network requests (constitution Principle I),
  and the simulation, persistence, and history behaviours MUST be untouched.
- **FR-024**: All existing automated tests MUST continue to pass. Existing
  geometry assertions MUST be folded into the invariant list rather than left
  beside it as a second, unlisted mechanism.

### Key Entities

- **Invariant list**: The named enumeration of geometry-critical facts the layout
  model depends on — the artifact this feature exists to produce. One entry per
  fact; the check is its enforcement arm and the documentation is its readable
  face.
- **Geometry-critical declaration**: Any style declaration that can change an
  element's rendered size on either axis, or the direction, wrapping, or spacing
  of the flow that positions it.
- **Derived-geometry component**: A component whose on-screen size or flow is
  decided by the layout model rather than by its own contents — the toolbar band
  and its controls, and the play area and its canvas.
- **Historical cause**: One of the three declarations that put six controls off a
  667×375 screen. Each is a fixed acceptance case for the check (FR-013).

### Amendments to earlier specs

- Spec 012's **FR-014** ("the sizing rule the automated check asserts against MUST
  be the same rule that determines what renders") is **extended, not replaced**.
  Spec 012 made the check and the renderer share a sizing *function*; this feature
  extends the same guarantee to the rendered *geometry* that function's output
  flows into. Spec 012's floors are unchanged.
- Spec 012's **SC-009** ("0 hand-maintained duplicates of the control count or
  control size") is extended by FR-001: no hand-maintained duplicate of any
  geometry-critical value may exist that could disagree with what renders.
- Spec 006's and spec 012's floors, arrangements, and thresholds are otherwise
  untouched. This feature adds verification; it changes no layout promise.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Re-introducing each of the three historical causes, one at a time,
  fails `npm test` — 3 of 3 — verified by doing it and restoring afterwards.
- **SC-002**: 0 controls render outside the visible viewport at any viewport in
  spec 012's representative table, in either orientation, with and without the
  feature-detected controls — down from 6 off-screen at 667×375.
- **SC-003**: 0 geometry-critical declarations in a derived-geometry component are
  neither derived from the layout model nor pinned-and-listed.
- **SC-004**: 0 of the enumerated geometry-critical categories are unaddressed for
  any derived-geometry component: every category is either held or explicitly
  recorded as inert.
- **SC-005**: 0 geometry assertions exist in the suite that do not correspond to a
  named entry on the invariant list, and 0 list entries requiring an assertion
  lack one.
- **SC-006**: The suite runs to completion with 0 browsers, 0 headless browsers,
  and 0 DOM environments — the same `npm test` on the same CI as today.
- **SC-007**: 0 spec-012 floors are weakened, relaxed, or made conditional; every
  spec-012 assertion still present and still passing.
- **SC-008**: A maintainer can read the full set of protected facts in one place
  in under 2 minutes, without opening the test suite.
- **SC-009**: 0 changes to what the child sees: 0 controls added, removed, moved,
  resized, or relabelled, and 0 new interactions introduced.
- **SC-010**: The build still emits exactly 1 self-contained page that plays from
  `file://` with 0 network requests.
- **SC-011**: When the check fails, its message names the component, the
  invariant, the model's assumption, and what was found — verified by forcing each
  of the 3 failures and reading the output.
- **SC-012**: A purely cosmetic change (a colour or a shadow) leaves the suite
  green — 0 false failures on non-geometric styling.

### What the maintainers eyeball

Automated checks cover structure and arithmetic; these are the human gates at
review time. Each item names one observable fact, and each is verifiable on only
the named maintainer's device (CLAUDE.md platform split):

- **Charlie — Fire 7 Kids tablet (Silk), portrait and landscape**: no control
  touches or crosses a screen edge in either orientation; all 3 scene buttons and
  all 3 brush-size buttons are present and tappable in both.
- **Charlie — desktop Chrome at 1280×800**: the toolbar looks exactly as it does
  today; no control touches or crosses a window edge; resizing the window narrow
  and back leaves no control outside the window.
- **Max — iPad Safari, standalone home-screen app, portrait and landscape**: no
  control touches or crosses a screen edge in either orientation, and no control
  sits under the notch or the home indicator; the selected control's rainbow ring
  is fully visible when the selected control is the outermost one on its line.
- **Max — iPad Safari, standalone, rotate while a control is selected**: the
  selected control's emphasis stays inside the band through the rotation and no
  control lands off-screen afterwards.
- **Either maintainer**: a purely visual change (a colour tweak) still merges
  without touching the invariant list — the gate is not so broad that it fires on
  cosmetics.

## Assumptions

- The three historical causes are already fixed on `main` (PR #40): controls use
  border-box sizing, the rail arrangement flows down the viewport height, and the
  selected control's emphasis is a thicker border rather than a scale. This
  feature makes those fixes *permanent and complete*; it does not re-fix them.
- Some geometry assertions already exist in the suite
  (`tests/unit/shell/toolbarGeometry.test.ts`). They are the starting point, not
  the deliverable: FR-010 requires them folded into the named list rather than
  left as a parallel set of ad-hoc checks.
- Structural inspection of the shipped component sources — rather than rendering
  them — is an acceptable way to hold an invariant under Principle V, and is what
  "structural invariants, not a rendering harness" means in the issue.
- The toolbar band and the play area are the only two places a model decides
  geometry today. No new model is invented for any other element (issue
  constraint); if the play area turns out to carry no real exposure, recording
  that finding on the invariant list satisfies Story 4.
- The layout model itself (`computeToolbarLayout`, `computePlayField`, and their
  constants) is correct and stays spec 012's and spec 006's property. This feature
  changes what flows *out* of the model into the rendering, not the model.
- "Derived from the model" means the value reaches the stylesheet through the
  channel the component already uses to pass the model's output down, so a single
  source of truth exists — not that a new mechanism is introduced.
- Emoji and icon rendering inside a control scales with the control and does not
  change the control's own box; glyph metrics are out of scope for this feature.
- The eyeball checklist is a review-time human gate, unenforced by the suite, per
  constitution Principle V. Nothing in this feature blocks a merge on a checklist
  item.
- Spec 012's representative viewport table remains the verification surface for
  the floors; this feature adds no viewports and removes none.

## Open Questions

- **FR-018 / FR-010 — how completely is the class closed?** [NEEDS
  CLARIFICATION: should the check reject any *unrecognised* geometry-critical
  declaration in a derived-geometry component (an allowlist that fails on
  anything not on the invariant list), or assert only the enumerated facts,
  leaving a genuinely novel property to be caught at review and then added to the
  list? The first closes the whole class but fails on unrelated styling work; the
  second is quieter but only ever as complete as the last person's imagination.]
- **FR-007 / Story 4 — how far does the play area's coverage go?** [NEEDS
  CLARIFICATION: the app shell decides the rows-versus-rail split with a
  viewport-width rule of its own, while the toolbar band takes the same decision
  from the layout model. Must this feature unify them onto the model's single
  decision (a change to the shipped layout, however invisible today), or is
  asserting that the two rules agree at every viewport in the representative
  table sufficient?]
- **FR-013 / SC-001 — how is "re-introducing each cause fails the suite"
  verified?** [NEEDS CLARIFICATION: as a one-time manual verification recorded in
  this feature's artifacts, or as a permanent mechanism in the repository that
  re-checks on every run that each historical cause would still be caught? The
  second keeps the acceptance test alive as the code moves on; the first is
  smaller and adds no machinery of its own.]
