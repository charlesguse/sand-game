# Feature Specification: Canvas-First Toolbar Budget

**Feature Branch**: `012-canvas-first-toolbar`

**Created**: 2026-08-30

**Status**: Draft

**Input**: Lifecycle issue #38 — "The toolbar eats the phone screen — she gets a sliver to draw on"

> ## The wish
>
> On a small phone the toy is nearly unplayable: the buttons take almost the whole
> screen and the picture she draws on is a sliver at the top. A maintainer's
> brother opened it on an **iPhone SE 3** and saw only a thin strip of canvas.
> She should always get most of the screen to draw on, on every phone, in both
> orientations — with the controls still big enough for a small finger.
>
> ## Measured evidence (Playwright, live site, 2026-08-30)
>
> The toolbar never shrinks: every control is a fixed 3.5rem (56px) circle, groups
> never share a row, and 24 controls simply wrap. Canvas share of the viewport:
>
> | Viewport | Toolbar | Canvas | Canvas share |
> | --- | --- | --- | --- |
> | 375x667 (iPhone SE 3 portrait) | 517px tall, **8 rows** | 373x149 | **22%** |
> | 667x375 (iPhone SE 3 landscape) | full-height rail, 9 columns | **160**x373 wide | **24%** of width |
> | 412x915 (Android portrait) | 517px tall, 8 rows | 411x397 | 43% |
> | 1280x800 (desktop) | 178px tall, 4 rows | 1279x618 | 77% |
>
> Nothing overflows or scrolls — the canvas is simply squeezed into what is left.
> The control count has grown feature by feature (24 today) with no responsive
> strategy beyond wrapping, so every new control makes every phone worse.
>
> ## Shape of the feature
>
> - The drawing area MUST keep a guaranteed majority of the viewport on a
>   phone-sized screen, in both orientations.
> - Every control stays reachable and stays at least the 44px touch minimum
>   (`MIN_TOUCH_TARGET`, spec 006 FR-020) — kid-first: no reading, no hidden
>   modes she can get stuck in, no failure states.
> - Whatever the answer is, it must hold as the control count keeps growing.
>
> ## Constraints
>
> - Constitution: single-file `file://` build, no reading, no error surfaces.
> - Two maintainers, two platforms: iPad Safari standalone (Max) and Fire 7 Silk +
>   desktop Chrome (Charlie). Anything relying on a platform capability must be
>   feature-detected and hidden, never broken.
> - Spec 006 (phone support) owns `isPhoneSized`, `computePlayField`,
>   `PHONE_MAX_SHORT_SIDE`, and the 480px landscape-rail media query; this
>   feature almost certainly amends its toolbar-fit requirements rather than
>   adding a parallel mechanism.

## User Scenarios & Testing *(mandatory)*

Throughout this spec:

- A **phone-sized viewport** keeps spec 006's meaning: a visible viewport whose
  shorter side is at most 480 screen pixels.
- The **toolbar band** is the strip of screen the toolbar occupies. Its
  **thickness** is how much of one axis it consumes — height when it lies across
  the screen as rows, width when it stands as a side rail.
- The **constrained axis** is the axis the toolbar band consumes: height in the
  rows arrangement, width in the rail arrangement.
- The **drawing region** keeps spec 006's meaning: the part of the visible
  viewport left for the play area once the toolbar has taken its space.
- All pixel measurements are CSS/screen pixels, not device pixels.

### User Story 1 - She gets most of the screen to draw on (Priority: P1)

The child opens the toy on a small phone. Whatever the phone, whichever way she
holds it, the picture fills most of what she can see, and the buttons live in a
compact band along one edge instead of swallowing the screen. Turning the phone
sideways swaps which edge the band sits on; the picture stays the big thing on
screen either way.

**Why this priority**: This is the whole complaint. At 22% of a 375×667 screen
the toy is not playable — there is no room to make a pile, no room for a
poodle to trot, and a fingertip covers a meaningful fraction of the drawing.
Everything else in this spec exists to make this floor safe to promise.

**Independent Test**: Compute the layout, without a browser, for a table of
representative viewports (small phone, iPhone SE 3 portrait and landscape,
390×844 and 844×390, 412×915, Fire 7 both orientations, iPad both orientations,
desktop, and an extreme aspect ratio) and assert at every one that the drawing
region keeps at least the required share of the constrained axis and that the
play area keeps at least the required share of the whole visible viewport. The
"does it feel big" judgment is a maintainer eyeball check on a real device.

**Acceptance Scenarios**:

1. **Given** a 375×667 phone in portrait, **When** the toy opens, **Then** the
   drawing region keeps at least the required share of the screen height and the
   play area covers at least 65% of the whole visible viewport — up from today's
   22%.
2. **Given** a 667×375 phone in landscape, **When** the toy opens, **Then** the
   drawing region keeps at least the required share of the screen width and the
   play area covers at least 60% of the whole visible viewport — up from today's
   24%.
3. **Given** any viewport in the representative table, **When** the toy opens,
   **Then** the toolbar band's thickness is at most the budget left over by the
   drawing region's floor, and the page still does not scroll in any direction.
4. **Given** the child is playing, **When** the browser's address bar collapses
   or reappears, **Then** the floors still hold against the new visible viewport
   and the layout does not visibly jitter.
5. **Given** a phone in portrait, **When** she rotates it to landscape, **Then**
   the floors hold in the new orientation and her drawing is carried across by
   the existing re-derivation rules — nothing is cleared.
6. **Given** a laptop or desktop viewport, **When** the toy opens, **Then** the
   play area is at least as large as it is today and the toolbar looks and
   behaves as it does today.

---

### User Story 2 - Every button is still there and still finger-sized (Priority: P1)

The compact band still shows her every button she has ever had: all the
elements, the animals, the eraser, the bin, the wand, the sound toggle, undo and
redo, the scenes, the brush sizes, and — where the device offers them —
fullscreen and the camera. Each one is still big enough for a small finger to
hit without hitting its neighbour, and none of them has moved behind anything
she would have to discover.

**Why this priority**: Equal-first with Story 1 — a bigger canvas bought by
hiding controls is not a fix, it is a different bug. The constitution's
no-reading rule means a "more" button, a drawer, or a mode she can get stuck in
are all off the table.

**Independent Test**: For every viewport in the table, assert without a browser
that all of the toy's controls are laid out, that each control's touch target is
at least 44 pixels on a side, that neighbouring targets do not overlap, and that
the resulting band still fits inside the budget from Story 1 — the two floors
holding simultaneously is the assertion.

**Acceptance Scenarios**:

1. **Given** a 375×667 phone in portrait, **When** the toy opens, **Then** every
   control is visible at once and every control's touch target is at least 44
   pixels on each side.
2. **Given** a 667×375 phone in landscape, **When** the toy opens, **Then** the
   same holds in the rail arrangement.
3. **Given** any phone-sized viewport, **When** the controls are laid out,
   **Then** the grouping of controls into their coloured clusters MUST NOT force
   a line break: two or more groups may share a row (or a rail column) when they
   fit.
4. **Given** a device where fullscreen or photo sharing is unavailable,
   **When** the toy opens, **Then** those controls are simply absent and both
   floors still hold with the smaller control set.
5. **Given** a phone, **When** she taps any control, **Then** it responds
   immediately, nothing paints on the drawing, and no error, message, or
   confirmation appears.
6. **Given** a phone, **When** she looks at the toolbar, **Then** no control is
   hidden behind a menu, an expander, a "more" button, or any affordance she
   would have to learn about.

---

### User Story 3 - The guarantee survives the next feature (Priority: P2)

Someone adds a twenty-sixth control next month. The check that protects the
child's drawing space notices, because it looks at the toolbar the toy actually
ships rather than at a number somebody typed once.

**Why this priority**: This is why the bug exists. Spec 006 already promised the
play area 65% of a portrait phone (its FR-002/SC-001) and shipped an automated
check for it — but the check models 18 controls at 44 pixels while the real
toolbar renders 24 controls at 56 pixels in non-sharing groups. The check has
passed on every commit while the live site sat at 22%. Without this story, the
same drift re-opens the same bug.

**Independent Test**: Add a control to the toy's real control set and confirm the
automated layout check reacts — either by continuing to pass with the floors
still met, or by failing. Confirm that no hand-maintained duplicate of the
control count or the control size exists that could disagree with what renders.

**Acceptance Scenarios**:

1. **Given** the automated layout check, **When** a control is added to or
   removed from the toolbar the toy ships, **Then** the check's control set
   changes with it without anyone editing a separate constant.
2. **Given** the automated layout check, **When** it asserts a control size or a
   band thickness, **Then** the value it asserts is produced by the same sizing
   rule that governs what actually renders — the check cannot pass while the
   shipped layout differs.
3. **Given** a change that would push the drawing region below its floor at any
   viewport in the table, **When** the test suite runs, **Then** it fails.

---

### Edge Cases

- **The controls genuinely do not fit.** At some control count, on some small
  enough viewport, controls at the 44-pixel floor with non-overlapping spacing
  cannot fit inside the toolbar's budget. FR-012 governs what happens; whatever
  it is, the child must never see an error, a clipped control she cannot reach,
  or a control permanently off-screen.
- **Address bar collapse and expansion.** The floors are measured against the
  visible viewport at the moment, so both the chrome-expanded and
  chrome-collapsed heights must satisfy them; the transition must not thrash the
  play field (spec 006 FR-027 continues to govern).
- **Rotation mid-stroke.** Unchanged from spec 006: the stroke ends cleanly, the
  tool and brush size survive, and the drawing is re-anchored, not cleared.
- **Feature-detected controls appearing or disappearing.** 📺 and 📷 are present
  on some devices and absent on others; both control sets must satisfy both
  floors.
- **Safe-area insets.** On a notched or rounded-corner device the insets reduce
  the usable screen. They come out of the toolbar's budget, not the drawing
  region's floor, and no control may end up under a notch or the home indicator
  (spec 006 FR-023).
- **Disabled controls.** Undo and redo are greyed out when unavailable but still
  occupy their place and still count toward the layout — nothing appears or
  disappears under her finger as she plays.
- **Extreme aspect ratios.** A very tall narrow window or an unfolded foldable:
  the floors still hold, and the leftover margin around the play area stays
  small and centred (spec 006 FR-003).
- **Very large play regions.** A bigger drawing region derives a bigger play
  field, still bounded by the existing cell-count budget — the simulation never
  gets more expensive than it is today.

## Requirements *(mandatory)*

This feature amends the toolbar-fit and verification requirements of spec
`006-phone-support`; it does not add a parallel layout mechanism. All
requirements of specs 001–011 remain in force except where explicitly amended in
the **Amendments to earlier specs** section below.

### Functional Requirements

**Budgeting the screen, drawing area first**

- **FR-001**: The drawing region MUST be budgeted **before** the toolbar: the
  toy MUST derive the toolbar band's allowed thickness from the drawing region's
  floor and fit the controls inside that allowance, rather than letting the
  toolbar take whatever size its contents want and giving the drawing region the
  remainder.
- **FR-002**: On a phone-sized viewport, in both orientations, the drawing
  region MUST retain at least **60%** of the constrained axis — equivalently,
  the toolbar band's thickness MUST NOT exceed 40% of that axis.
  [NEEDS CLARIFICATION: is 60% of the constrained axis the right floor, or
  should the guarantee instead (or additionally) be stated as a share of total
  viewport area?]
- **FR-003**: The floor in FR-002 MUST hold at every viewport in the
  representative table of SC-001, in both orientations, and MUST hold whether or
  not the feature-detected fullscreen (📺) and photo (📷) controls are present.
- **FR-004**: Spec 006's whole-screen fill floors MUST actually be met in the
  shipped layout: the play area MUST cover at least 65% of the visible viewport
  on a phone-sized viewport in portrait and at least 60% in landscape (spec 006
  FR-002), alongside its at-least-90%-of-the-drawing-region floors (spec 006
  FR-001).
- **FR-005**: The floors MUST be measured against the **visible** viewport, so a
  collapsing or reappearing address bar cannot invalidate them; safe-area insets
  MUST be absorbed by the toolbar band's budget, never by the drawing region's
  floor.
- **FR-006**: The guarantee MUST apply beyond phone-sized viewports as follows.
  [NEEDS CLARIFICATION: does the floor apply only to phone-sized viewports
  (shorter side ≤ 480px, spec 006's existing definition), or to every viewport
  including small desktop windows, tablets, and foldables?]

**Fitting the controls inside the budget**

- **FR-007**: On viewports where the controls at their present size would not
  fit inside the toolbar's allowance, controls MUST scale down toward — and
  never below — a 44-pixel touch target on each side (spec 006 FR-020). Control
  size MUST be a continuous function of the available space, not a jump between
  two hard-coded sizes.
- **FR-008**: The visual grouping of controls into clusters MUST NOT force a
  line break: two or more groups MUST be able to share a row in the rows
  arrangement, or a column in the rail arrangement, whenever they fit. Grouping
  remains a purely visual cue.
- **FR-009**: Neighbouring controls MUST keep enough separation that a
  fingertip cannot activate two at once, and touch targets MUST NOT overlap.
- **FR-010**: Every control the toy has MUST remain visible at once. The toy
  MUST NOT hide, collapse, or defer any control behind a menu, an expander, a
  "more" button, a mode, or any other affordance a non-reading child would have
  to discover (spec 006 FR-021). Shrinking is always preferred to hiding.
- **FR-011**: This feature MUST NOT introduce any new interaction the child has
  to learn. The fix is a sizing and arrangement change; tapping a control and
  drawing on the canvas work exactly as they do today.
- **FR-012**: When the control set cannot fit inside the toolbar's allowance
  even with every control at the 44-pixel floor and the tightest acceptable
  spacing, the toy MUST resolve the conflict as follows.
  [NEEDS CLARIFICATION: what is the fallback — (a) let the toolbar band scroll
  within its budget, (b) let the band exceed its budget so the floor becomes a
  target rather than a guarantee, or (c) treat it as a build-time failure of the
  automated check so a maintainer must act before shipping, with the runtime
  behaviour unchanged from whatever (a) or (b) specifies?]

**Not letting the guarantee rot**

- **FR-013**: The automated check that protects these floors MUST derive its
  control set from the toolbar the toy actually ships, so that adding or
  removing a control changes what is checked without anyone editing a separate
  constant. Today's hand-maintained control count (18, against 24 rendered) is
  exactly the drift this forbids.
- **FR-014**: The sizing rule the automated check asserts against MUST be the
  same rule that determines what renders — a single source of truth for control
  size, spacing, and band thickness. The check MUST NOT be able to pass while
  the shipped layout violates the floors.
- **FR-015**: The automated check MUST assert both floors **simultaneously** at
  every viewport in the representative table: the drawing region's share
  (FR-002, FR-004) and the 44-pixel touch-target floor with non-overlapping
  targets (FR-007, FR-009).

**Non-regression**

- **FR-016**: On laptop and desktop viewports the toolbar MUST look and behave
  as it does today and the play area MUST be at least as large as it is today in
  both dimensions (spec 006 FR-024, FR-030).
- **FR-017**: The simulation MUST NOT change. A larger drawing region simply
  derives a larger play field under the existing derivation rules and the
  existing cell-count budget; auto-save, undo/redo, and the history remapping
  across a re-derivation continue to work unchanged (specs 006, 010, 011).
- **FR-018**: The page MUST NOT scroll or rubber-band in any direction, the
  toolbar MUST NOT overlay or float above the play area, and no interaction may
  produce an error, a message, a confirmation, or any state the child can be
  stuck in (spec 006 FR-019, FR-020b, FR-032).
- **FR-019**: The production build MUST still emit exactly one self-contained
  page, fully playable when opened directly from disk with no network requests
  (constitution Principle I).
- **FR-020**: Anything in this feature that depends on a platform capability
  MUST be feature-detected and hidden where unavailable, never broken — the
  layout MUST degrade to a working arrangement on both maintainers' platforms
  (iPad Safari standalone; Fire 7 Silk and desktop Chrome).
- **FR-021**: All existing automated tests MUST pass, updated only where an
  amended requirement makes an assertion obsolete — never weakened to hide a
  regression (spec 006 FR-033).

### Key Entities

- **Toolbar band**: The strip of screen the toolbar occupies. Its thickness on
  the constrained axis is now an output of the drawing region's budget rather
  than of the controls' natural size (FR-001).
- **Constrained axis**: The screen axis the toolbar consumes — height in the
  rows arrangement, width in the rail arrangement. The floor in FR-002 is stated
  against this axis.
- **Control set**: The controls the toy actually ships at a given moment,
  including the feature-detected fullscreen and photo controls when present.
  It is the input to the layout check, derived rather than declared (FR-013).
- **Drawing region**: Unchanged from spec 006 — the part of the visible viewport
  left for the play area. This feature changes only how its size is decided.

### Amendments to earlier specs

- Spec 006's **FR-020a** is amended. It said the toolbar's controls "shrink
  toward the 44-pixel minimum" and "MUST NOT consume so much space that the play
  area falls below FR-001 or FR-002", but stated no budget the toolbar had to fit
  inside and gave no rule for groups sharing a row. It is amended by FR-001,
  FR-002, FR-007, and FR-008: the toolbar's allowance is now derived from the
  drawing region's floor, control size is a continuous function of that
  allowance, and groups may share a row or a rail column.
- Spec 006's **FR-035** is amended by FR-013, FR-014, and FR-015. Its automated
  coverage was satisfied by a model of the toolbar that could — and did — drift
  from what renders. The coverage must now be driven by the shipped control set
  and the shipped sizing rule.
- Spec 006's **FR-002** and **SC-001**/**SC-002** are not weakened; FR-004
  restates them and this feature is what makes them true in the shipped build.
- No simulation, persistence, or history requirement of any earlier spec is
  amended (FR-017).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At every viewport in the representative table below, the drawing
  region keeps at least the FR-002 share of the constrained axis, and every
  control's touch target is at least 44 pixels on each side, both holding
  simultaneously — 0 viewports failing either floor.

  | Viewport | Today's canvas share | Required after |
  | --- | --- | --- |
  | 320×568 (small phone, portrait) | — | meets FR-002 and FR-004 |
  | 375×667 (iPhone SE 3, portrait) | 22% of area | ≥ 65% of area |
  | 667×375 (iPhone SE 3, landscape) | 24% of width | ≥ 60% of area |
  | 390×844 / 844×390 (modern phone) | — | ≥ 65% / ≥ 60% of area |
  | 412×915 (Android portrait) | 43% of area | ≥ 65% of area |
  | 600×1024 / 1024×600 (Fire 7) | — | meets FR-002 |
  | 768×1024 / 1024×768 (iPad) | — | meets FR-002 and FR-016 |
  | 1280×800 (desktop) | 77% of area | ≥ 77% — no regression |
  | 400×1400 (extreme aspect) | — | meets FR-002 |

- **SC-002**: On a 375×667 phone in portrait the play area covers at least 65%
  of the visible viewport, up from 22% today — at least a threefold increase in
  drawing space on the device that prompted this work.
- **SC-003**: On a 667×375 phone in landscape the play area covers at least 60%
  of the visible viewport, up from 24% of the width today.
- **SC-004**: 100% of the toy's controls remain visible at once at every
  viewport in the table, in both orientations, with and without the
  feature-detected fullscreen and photo controls — 0 controls hidden behind a
  menu, expander, mode, or "more" affordance.
- **SC-005**: 0 controls present a touch target smaller than 44 pixels on a
  side, and 0 pairs of neighbouring touch targets overlap, at any viewport in
  the table.
- **SC-006**: 0 new interactions are introduced: the number of distinct things
  the child must learn to use the toy is unchanged from today.
- **SC-007**: On a 1280×800 desktop viewport the play area is no smaller than
  today's in either dimension and the toolbar's appearance is unchanged.
- **SC-008**: The automated suite runs to completion without a browser and
  fails if a control is added that would breach either floor at any viewport in
  the table — verified by adding a control and observing the outcome.
- **SC-009**: The layout check's control set and control sizing agree with what
  the toy renders: 0 hand-maintained duplicates of the control count or control
  size exist that could disagree with the shipped toolbar.
- **SC-010**: The build still emits exactly one self-contained page that plays
  from `file://` with 0 network requests.

### What the maintainers eyeball

Automated checks cover the maths; these are the human gates at review time, and
each is only verifiable on one maintainer's device (CLAUDE.md platform split):

- **Charlie (Fire 7 Silk, desktop Chrome)**: the toy on the Fire 7 in both
  orientations — the drawing surface obviously dominates, every button is
  comfortably hittable by a small finger, and desktop Chrome looks unchanged.
- **Max (iPad Safari, standalone home-screen app)**: the toy installed to the
  home screen in both orientations — safe-area insets keep every control clear
  of the notch and home indicator, and the band does not creep back over the
  drawing.
- **Either**: the toolbar still reads as a friendly cluster of round buttons
  rather than a cramped strip, and the shrunken controls' emoji are still
  recognisable at a glance.

## Assumptions

- The fix is a sizing-and-arrangement change only; no control is removed, added,
  merged, or relabelled by this feature, and no new interaction is introduced.
- "Phone-sized" keeps spec 006's definition (visible viewport's shorter side at
  most 480 screen pixels) and the existing rows-in-portrait /
  rail-in-landscape arrangement is retained — this feature changes how big the
  band may be, not which edge it sits on.
- The 44-pixel touch-target floor from spec 006 FR-020 is a hard floor: no
  viewport is permitted to render a smaller control, and control spacing must
  keep targets from overlapping even at that floor.
- Emoji glyphs remain legible at the smaller control sizes; the glyph scales
  with the control rather than staying fixed.
- Safe-area insets, group padding, and inter-control spacing are all part of the
  toolbar band's budget, not the drawing region's.
- The existing cell-count budget (spec 006 FR-007) still caps simulation cost, so
  a larger drawing region yields chunkier cells rather than more work.
- Desktop and laptop viewports are already comfortably above any floor this
  feature sets, so FR-016's non-regression holds without special-casing.
- The representative viewport table is the verification surface; real-device
  confirmation on the Fire 7 and the iPad remains a maintainer eyeball check, per
  constitution Principle V — no browser-automation infrastructure is added.
