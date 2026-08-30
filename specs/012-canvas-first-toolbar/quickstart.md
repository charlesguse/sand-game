# Quickstart: Canvas-First Toolbar Budget

How to build and validate this feature end-to-end once implemented. See
[data-model.md](./data-model.md) for entity details and
[contracts/toolbar-budget.md](./contracts/toolbar-budget.md) for the
`src/lib/layout.ts`/`src/lib/toolbarControls.ts` APIs. This extends
`specs/006-phone-support/quickstart.md` — its build steps and single-file/
offline validation still apply unchanged and are not repeated in full
here.

## Prerequisites

- Node 22 (matches `.github/workflows/deploy-pages.yml`)
- `npm install` from a checkout that already has features 001–011's
  scaffold (`package.json`, `src/sim/*`, `src/lib/layout.ts` with 006's
  `computePlayField`/`isPhoneSized`, existing tests)
- An iPhone SE 3 or similarly small phone (or a browser devtools device
  emulator sized to 375×667) for the on-device checks this feature exists
  to fix — the measured-evidence device from the spec's Wish section

## Build and run the tests

```bash
npm install
npm run build     # emits dist/index.html — must be the ONLY file in dist/
test -f dist/index.html
npm test           # vitest — layout/sim rules, no browser required
```

Both commands must succeed from a clean checkout, and every existing test
(001–011) must still pass unchanged except where an amended requirement
makes an assertion obsolete (FR-021).

## Validate User Story 1 — she gets most of the screen to draw on (P1)

Reference: spec Acceptance Scenarios 1–7 under User Story 1.

**Automated coverage** (`tests/unit/lib/layout.test.ts`): for every
viewport in the SC-001 representative table (research.md §10 —
`320×568`, `375×667`, `667×375`, `390×844`, `844×390`, `412×915`,
`600×1024`, `1024×600`, `768×1024`, `1024×768`, `1280×800`, `400×1400`),
with the real shipped control count from
`shippedToolbarControls(false, false).length` (and again with `(true,
true)`, per Scenario "with and without the feature-detected controls"):
call `computeToolbarLayout(viewportWidth, viewportHeight, controlCount)`,
derive the drawing region (`constrainedAxisLength - result.thickness` on
the constrained axis, full length on the other), and assert
`(constrainedAxisLength - result.thickness) / constrainedAxisLength >=
0.6` at **every** row (FR-002, FR-006 — universal, not phone-gated); on
the phone-sized subset, feed the derived drawing region into
`computePlayField` and assert `>= 0.65` (portrait) / `>= 0.60`
(landscape) of the whole viewport area, matching 006's FR-004 (restated,
not weakened); confirm the page never needs to scroll by construction
(the toolbar's own box is capped at `TOOLBAR_BAND_MAX_SHARE`, never
larger, so `flex: 1` can never go negative). Confirm the `1280×800`
desktop row's play-area size is `>=` today's pre-feature value (FR-016,
SC-007) and that `result.thickness` at that row is unchanged from what
`Toolbar.svelte`'s current fixed-size CSS would already produce (no
active shrinking there).

**On-device / manual** (maintainer, real iPhone SE 3 or emulated
375×667): open the toy in portrait → the picture is obviously the big
thing on screen, not a sliver; rotate to landscape → the toolbar band
swaps to the opposite edge and the picture stays dominant; confirm no
jitter as the address bar collapses/reappears while playing.

## Validate User Story 2 — every button is still there and still finger-sized (P1)

Reference: spec Acceptance Scenarios 1–6 under User Story 2.

**Automated coverage**: for every representative-table viewport, with
both the base control set and the full (fullscreen+photo) set,
`computeToolbarLayout(...).fits === true`, `.controlSize >=
MIN_TOUCH_TARGET` (44), and `.pitch >= MIN_PITCH` (4) — a pitch floor at
or above `MIN_PITCH` is what stands in for "neighbouring targets don't
overlap and a fingertip can't co-activate two" (FR-009), since the model
never places two controls closer than `pitch` apart. Confirm both floors
(this story's touch-target floor and User Story 1's axis/area floors)
hold **simultaneously** at every row (FR-015) by running both sets of
assertions against the same `computeToolbarLayout` call's result. Assert
`shippedToolbarControls(false, false)` omits both the `'fullscreen'`- and
`'photo'`-tagged entries and `shippedToolbarControls(true, true)`
includes them, so "device where fullscreen/photo is unavailable" is
covered by the same manifest, not a second hand-maintained set (Scenario
4).

**On-device / manual**: on the small phone, every button from the full
list (elements, animals, eraser, bin, wand, sound, undo, redo, scenes,
brush sizes, and 📺/📷 where available) is visible at once with nothing
behind a menu or "more" affordance (Scenario 6); tapping any control
responds immediately with no paint landing on the canvas and no message
or confirmation appearing (Scenario 5); at the smallest representative
phone, controls read visibly smaller than on a laptop but each is still
comfortably hittable by a small finger and its emoji is still recognizable
(the "does it feel big enough" eyeball judgment the spec reserves for a
human).

## Validate User Story 3 — the guarantee survives the next feature (P2)

Reference: spec Acceptance Scenarios 1–4 under User Story 3.

**Automated coverage**: add a throwaway `ToolbarControlSpec` entry to
`TOOLBAR_CONTROLS` (or, for a repeatable regression test, parametrize a
test case that calls `computeToolbarLayout` with `controlCount + 1`) and
confirm the representative-table assertions above react — either staying
green because the extra control still fits, or turning red because it
doesn't; either outcome demonstrates the check is reacting rather than
static (Scenario 1, SC-008). Confirm there is no second constant anywhere
in `tests/unit/lib/layout.test.ts` duplicating a control count or a
control size literal — every size comes from `layout.ts`'s exported
constants and `computeToolbarLayout`'s own return value, every count from
`shippedToolbarControls(...).length` (Scenario 2, SC-009). Force a
failure directly — call `computeToolbarLayout` with an artificially huge
`controlCount` (e.g. 500) at the smallest table viewport and confirm
`fits === false` with `requiredThickness` clearly reported, larger than
the cap (`TOOLBAR_BAND_MAX_SHARE * constrainedAxisLength`) — read the
values back out and confirm they'd let a maintainer compose a message
like "375×667 rows: needs `requiredThickness`px, has `cap`px" without
re-deriving anything by hand (Scenario 4, FR-012b, SC-012).

**On-device / manual**: none — this story's guarantee is entirely an
automated-suite property (spec's Independent Test: "confirm the automated
layout check reacts").

## Validate existing behavior is unchanged (FR-021)

1. Run `npm test` and confirm every test from specs 001–011 still passes,
   changed only where the Amendments to earlier specs section makes an
   assertion obsolete — specifically `tests/unit/lib/layout.test.ts`'s
   hand-maintained `TOOLBAR_CONTROL_COUNT = 18`/`TOOLBAR_GROUP_COUNT = 6`
   constants and its own `isToolbarRail`/`drawingRegionFor` helpers are
   replaced by the manifest-driven equivalents above, and its
   `computeToolbarLayout` call sites drop the removed `groupCount`
   argument (contracts/toolbar-budget.md) — no other existing test file
   changes.
2. In the running app on a laptop with a mouse, repeat prior specs'
   quickstart validation steps (piling, water flow, purple dirt, rainbow
   conversion, unicorn celebration, eraser, clear-all, brush sizes, scene
   loading, sparkle wand, undo/redo, auto-save/restore) and confirm
   identical behavior and an unchanged-or-larger play area (FR-016).

## Manual-only checks (no automated coverage — spec's "What the maintainers eyeball" section)

- **Charlie (Fire 7 Silk, desktop Chrome)**: the toy on the Fire 7 in both
  orientations — the drawing surface obviously dominates, every button is
  comfortably hittable by a small finger, and desktop Chrome looks
  unchanged from before this feature.
- **Max (iPad Safari, standalone home-screen app)**: the toy installed to
  the home screen in both orientations — safe-area insets keep every
  control clear of the notch and home indicator, and the toolbar band
  does not creep back over the drawing as controls are added over time.
- **Either**: the toolbar still reads as a friendly cluster of round
  buttons, not a cramped strip; the shrunken controls' emoji stay
  recognisable at a glance (`pickGlyph`'s fallback selection is unaffected
  by this feature — glyph *choice* is orthogonal to control *size*).

## Performance check

No sim-layer change means no new performance risk (research.md §11) — the
existing performance check from 006's quickstart (sustained `>=30fps`,
targeting `60fps`, on a mid-range phone with a full moving play area)
still applies unchanged and does not need to be re-run specifically for
this feature, though it's worth re-confirming during the on-device checks
above since the play area is now larger on small phones than it was under
006 alone.
