# Feature Specification: Phone Support

**Feature Branch**: `spec-draft/006-phone-support`

**Created**: 2026-08-26

**Status**: Draft

**Input**: GitHub issue #15 — "Phone support: drawing area must fill the screen and touch-drawing must work on mobile"

> **Problem (observed on a real phone — Android Chrome)**
>
> The game works well on a computer but is unusable on a phone:
>
> 1. **The drawing area is a postage stamp.** The sizing rule picks the largest *integer* cell size that fits. On a desktop (1920px wide) that gives cellSize 7 → a big canvas. On a ~390px-wide phone it gives cellSize 1, so the canvas renders at literally 270×160 CSS pixels centered in a sea of white.
> 2. **Drawing appears not to work.** At 1 CSS pixel per cell a fingertip covers ~10 cells and a brush stroke is nearly invisible; taps also easily miss the tiny canvas entirely (touches on the surrounding white container do nothing).
> 3. **General mobile layout problems.** The app uses `height: 100vh`; on mobile browsers with collapsing URL bars, `100vh` overflows the visible viewport, which can push the bottom toolbar partially off-screen.
>
> **What the maintainer wants**
>
> - On a phone, the drawing area should fill **the whole or most of the screen** — in both portrait and landscape.
> - Touch drawing must actually work on Android Chrome (and iOS Safari): drawing, erasing, and placing rainbows/unicorns with a finger.
> - The toolbar must remain fully visible and tappable on a phone screen.
> - Desktop behavior must not regress (currently good).
> - Existing constraints hold: single self-contained page, no failure states, existing drawings preserved on resize/rotate per spec 001.
>
> **Notes for spec (decisions open — ask if unclear)**
>
> - The fixed 270×160 landscape grid is the tension: a portrait phone is ~1:2, the grid is ~1.7:1. Options include fractional/CSS scaling of the canvas (drop the integer-cell-size constraint), choosing grid orientation/dimensions from the viewport, or something else — spec should weigh kid-usability first (big drawing surface, big touch targets).
> - Dynamic-viewport units or equivalent are the usual fix for the mobile URL-bar problem.
> - The touch event path looks correct in code; verify on-device behavior is actually fixed by the size change or identify any remaining event issue.

## Clarifications

### Session 2026-08-26 (answers on issue #15)

- **Q: Which adaptation strategy should the play field use?** → **Derive both shape and resolution from the drawing region**, so the play area always fills the screen with chunky, finger-friendly grains. Keeping the fixed 270×160 field with fractional scaling fails the maintainer's "whole or most of the screen" requirement in portrait, and two fixed fields chosen at load fail it after a rotation. Superseding spec 001's fixed play field is accepted and recorded in **Superseded requirements**; the total cell budget stays capped at roughly today's (270×160 ≈ 43,200 cells), so phones get chunkier sand rather than more simulation work. (FR-004, FR-007)
- **Q: How should the toolbar's controls fit a phone screen without eating the play area?** → **A compact, always-visible bar** that wraps to more than one row in portrait and becomes a narrow rail down one side in landscape, with 44-pixel minimum touch targets. A translucent bar overlaying the play area risks paint landing next to a control (FR-017), which is worse for a non-reading child than a slightly smaller canvas; the current wrapping row at whatever height it needs fails the portrait fill target. (FR-020, FR-020a, FR-020b)
- **Q: Is best-effort preservation across a re-derived play field acceptable?** → **Yes — best-effort carry anchored to the bottom-centre**, so the ground stays the ground, cropping what no longer fits. Losing a few edge grains to a rotation is acceptable; clearing the drawing is a failure state in all but name, and fixing the field's cell dimensions for the life of the page recreates the original complaint by letterboxing a rotated phone. Exact preservation still holds for viewport changes that do not re-derive the field, such as an address-bar collapse or a desktop window resize. (FR-025, FR-026)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The drawing area fills the phone screen (Priority: P1)

The child is handed a phone with the toy open. Instead of a stamp-sized picture floating in a big white nothing, almost the entire screen is her play area — edge to edge across the width, and from just under (or beside) the row of big round buttons all the way to the bottom of the screen. Held upright, the play area is tall. Turned sideways, it is wide. Either way it is the thing that fills the phone. The grains she pours are big enough to see as individual specks, and a single swipe of her finger leaves an obvious, chunky trail — not a hairline.

**Why this priority**: This is the whole issue. Everything else in the report — "drawing appears not to work", missed taps, invisible strokes — is downstream of the play area being 270×160 CSS pixels on a 390-pixel-wide phone. Fix the size and the toy becomes usable; leave it and nothing else matters.

**Independent Test**: Compute the play-area layout for a set of representative viewport sizes (phone portrait, phone landscape, tablet, laptop) and assert, without a browser, that the play area covers the required fraction of the drawing region and of the whole screen, that cells stay square, that a single cell is large enough to see, and that the total cell count stays inside the performance budget. The "does it look big" judgment is a maintainer eyeball check on a real phone.

**Acceptance Scenarios**:

1. **Given** a phone-sized viewport held in portrait, **When** the toy opens, **Then** the play area covers at least 90% of the width and at least 90% of the height of the region left over after the toolbar, and at least 65% of the whole visible screen.
2. **Given** a phone-sized viewport held in landscape, **When** the toy opens, **Then** the play area covers at least 90% of the width and at least 90% of the height of the region left over after the toolbar, and at least 60% of the whole visible screen.
3. **Given** a phone-sized viewport in either orientation, **When** the toy opens, **Then** a single grain is drawn at no smaller than 2 screen pixels on a side, and a stroke drawn with the default (medium) brush is at least 24 screen pixels wide.
4. **Given** a phone-sized viewport in either orientation, **When** the toy opens, **Then** cells are square — the play area is never stretched or squashed to fill the screen, and grains never look like rectangles.
5. **Given** a laptop or desktop viewport, **When** the toy opens, **Then** the play area is at least as large on screen as it is today and no smaller in either dimension.
6. **Given** any supported viewport, **When** the toy opens, **Then** the number of cells being simulated is no greater than the current default play field's cell count, so the simulation cannot become slower than it is today.
7. **Given** a phone-sized viewport, **When** the child pours sand, **Then** the sand falls, piles, and behaves exactly as it does on a laptop — only the size on screen and the number of cells differ, never the rules.

---

### User Story 2 - Drawing with a finger actually works (Priority: P2)

The child presses a finger anywhere on the big play area and drags. Sand pours out continuously under her finger and follows the whole path of the swipe, however fast she moves. She lifts, taps the sponge, and scrubs part of it away. She taps the rainbow button and then taps the screen, and a rainbow lands where she touched. Nothing else happens while she draws — the page does not scroll, the browser does not zoom in when she taps twice, nothing gets selected or highlighted, and dragging down from the top does not reload the page. Her finger is a paintbrush and only a paintbrush.

**Why this priority**: This is the second complaint in the report. Most of it is fixed by User Story 1 — a finger-sized target and a visible stroke — but the remaining touch behaviors (browser gestures, taps in the margin, a second finger, a drag that leaves the screen) are what decide whether it *feels* broken. It is separable: the bigger play area ships value on its own, and this story hardens it.

**Independent Test**: Verify on-device on Android Chrome and iOS Safari that press-and-drag paints continuously, that the eraser and the rainbow/unicorn placement work by touch, and that no browser gesture interferes; and verify without a browser that the touch-position-to-cell mapping is exact at the new on-screen scale for a set of representative viewports and touch points.

**Acceptance Scenarios**:

1. **Given** a phone, **When** the child presses a finger on the play area and drags, **Then** the selected element paints continuously along the entire path of the drag, with no gaps between touch samples on a fast swipe.
2. **Given** a phone, **When** the child taps once on the play area without dragging, **Then** a single dab of the selected element is placed under her finger.
3. **Given** the eraser is selected on a phone, **When** the child drags across her drawing, **Then** grains and any objects under the eraser are removed exactly as they are with a mouse.
4. **Given** the rainbow or unicorn tool is selected on a phone, **When** the child taps the play area, **Then** the object is placed centred on the touched point, exactly as it is with a mouse.
5. **Given** a phone, **When** the child touches or drags anywhere on the play area, **Then** the page does not scroll, does not rubber-band or bounce, does not pull-to-refresh, does not zoom, does not show a text-selection highlight, and does not show a long-press menu.
6. **Given** a phone, **When** the child double-taps the play area, **Then** the browser does not zoom in; two dabs of the selected element are placed.
7. **Given** a phone, **When** the child touches any point inside the play area — including the very edge — **Then** the touch paints at the cell under her finger, with the painted cell matching the touched point at the current on-screen scale.
8. **Given** a phone, **When** the child touches the empty margin outside the play area, **Then** nothing at all happens: no paint, no message, no error, no state change.
9. **Given** a drag in progress on a phone, **When** the child's finger slides off the play area onto the toolbar or off the edge of the screen, **Then** the stroke continues to be tracked without painting outside the play area, and it ends cleanly when she lifts — never leaving the brush stuck on.
10. **Given** a drag in progress on a phone, **When** a second finger touches the screen, **Then** the first stroke is not corrupted — it does not jump to the second finger's position and it does not get stuck on — and no failure state occurs.
11. **Given** a phone, **When** the child taps a toolbar button, **Then** it responds immediately to the tap with no perceptible delay and no accidental paint on the play area.
12. **Given** a laptop with a mouse, **When** the child draws, erases, and places objects, **Then** every behavior is exactly as it is today.

---

### User Story 3 - The buttons are always there and always tappable (Priority: P3)

However the child holds the phone, the row of big round buttons is fully on screen — no button half off the bottom edge, none hidden behind the phone's home bar or a notch, and none so small that her fingertip covers three of them. The page never scrolls: there is no "rest of the page" to scroll to. When the browser's address bar slides away as she plays, the toy quietly takes up the extra room; when it slides back, the buttons are still all there.

**Why this priority**: The report's third problem. A toy whose buttons drift off the bottom of the screen is unusable in a different way, and the fix is largely independent of the play-area sizing work. It is lower priority only because the play area is what the maintainer led with.

**Independent Test**: Compute the layout for phone portrait and landscape at both the browser-chrome-expanded and chrome-collapsed viewport heights, and assert that every control fits inside the smaller of the two, at or above the minimum touch-target size, with no overflow. Confirm on a real phone that the toolbar is fully visible with the address bar shown and stays visible as it collapses.

**Acceptance Scenarios**:

1. **Given** a phone with the browser's address bar showing, **When** the toy opens, **Then** every toolbar control is fully inside the visible screen — none is clipped by, or hidden below, the bottom edge.
2. **Given** a phone, **When** the address bar collapses or reappears as the child plays, **Then** every toolbar control stays fully visible, the drawing is not lost, and the layout does not visibly jitter or flicker.
3. **Given** a phone, **When** the child tries to scroll the page anywhere, **Then** nothing scrolls and nothing bounces — the toy is exactly one screen.
4. **Given** a phone in portrait, **When** the child looks at the toolbar, **Then** every control the toy has is visible at once — nothing is hidden behind a menu, a scroll, or a "more" button she would have to discover.
5. **Given** a phone, **When** the child taps any control, **Then** the control's touchable area is at least 44 screen pixels on each side, with clear separation from its neighbours, so a fingertip cannot hit two at once.
6. **Given** a phone with a notch, rounded corners, or a home-indicator bar, **When** the toy opens, **Then** no control is obscured by or overlapped with those areas.
7. **Given** a phone in landscape, **When** the toy opens, **Then** the controls form a narrow rail down one side rather than a row across the short screen height, every control is still visible and finger-sized, and the toolbar does not consume so much height that the play area falls below the fill requirement in Acceptance Scenario 2 of User Story 1.
8. **Given** a phone in portrait, **When** the row of controls is wider than the screen, **Then** it wraps onto further rows above the play area — all controls visible, none shrunk below a finger-sized target.
9. **Given** a phone in either orientation, **When** the child draws near the toolbar, **Then** no control floats over the play area: the buttons occupy their own space, never covering the drawing, and a tap aimed at a button never paints.
10. **Given** a laptop or desktop, **When** the toy opens, **Then** the toolbar looks and behaves as it does today.

---

### User Story 4 - Turning the phone sideways keeps the fun going (Priority: P4)

The child has been drawing in portrait and turns the phone sideways. The toy immediately makes the play area wide instead of tall, filling the screen again, and her drawing is still there — the ground is still the ground and her pile is still her pile. Nothing pops up, nothing asks her anything, and she carries straight on drawing with her finger in the new shape.

**Why this priority**: Rotation is common with a child holding a phone, but the toy is already valuable and shippable without perfecting it — the first three stories deliver the fix the maintainer asked for. This story is the polish that keeps a rotation from feeling like a punishment.

**Independent Test**: Recompute the layout across an orientation change for representative phone viewports and assert that the play area meets its fill requirement in the new orientation, that the touch-to-cell mapping is correct at the new scale, and that the contents-preservation rule leaves the drawing where it should be. Confirm on a real phone that rotating mid-drawing keeps the picture and keeps drawing working.

**Acceptance Scenarios**:

1. **Given** a drawing in progress on a phone in portrait, **When** the child rotates to landscape, **Then** the play area fills the new screen shape to the same standard as a fresh landscape load.
2. **Given** a drawing in progress, **When** the child rotates the phone, **Then** her drawing is still on screen, with the ground still at the bottom and her pile still recognisably where she put it.
3. **Given** a rotation has just happened, **When** the child draws with her finger, **Then** paint appears exactly under her finger at the new on-screen scale.
4. **Given** a rotation has just happened, **When** the child looks at the screen, **Then** no message, dialog, confirmation, or error has appeared, and the simulation is still running smoothly.
5. **Given** a rotation has just happened, **When** the child taps a toolbar button, **Then** her selected tool and brush size are unchanged from before the rotation.
6. **Given** the child rotates back and forth several times, **When** she stops, **Then** the toy is in a normal playable state with no accumulated damage to the drawing beyond what each rotation's preservation rule allows.
7. **Given** a change in viewport size that is *not* an orientation change — the address bar collapsing, the window being nudged on a desktop — **When** it happens, **Then** the drawing is preserved exactly: every grain keeps its cell, and nothing is cropped, shifted, or lost.

---

### Edge Cases

- **A very narrow or very short viewport** (a small phone, a split-screen window, a browser sized down to a sliver): the toy still lays out with every control visible and finger-sized and the play area taking the remaining space. There is no size at which the toy shows an error, a scrollbar, or an empty screen.
- **A very large viewport** (a desktop monitor, a TV): the play area does not become absurdly coarse or absurdly fine — the cell-size and cell-count rules bound it at both ends, and desktop stays at least as good as today.
- **Extreme aspect ratios** (a foldable unfolded, a very tall window): the play field's shape follows the drawing region within its allowed bounds; where it cannot match exactly, the leftover margin is small and centred, and touches in that margin do nothing.
- **Address bar collapsing mid-stroke**: the stroke continues, the drawing is preserved exactly, and the paint stays under the finger — a viewport height change during a drag never teleports the brush.
- **Rotation mid-stroke**: the stroke ends cleanly rather than continuing across the rotation; no brush is left stuck on and no failure state occurs.
- **Rotating repeatedly and quickly**: the toy does not thrash — it re-derives the play field once per settled orientation, not once per intermediate frame, and stays smooth throughout.
- **Screen-size change that does not change orientation** (address bar, on-screen keyboard, desktop window nudge): the play field is *not* re-derived, so the drawing is preserved exactly; only the on-screen scale changes.
- **Objects near the edge after a re-derivation**: placed rainbows and unicorns follow the same preservation rule as grains; any that no longer fit are removed cleanly rather than drawn half off the play area.
- **A phone in a hand, not a testbed**: a fingertip covers a range of cells; brush sizes and the play field's resolution are chosen so that all three brush sizes stay usefully distinct at phone scale rather than collapsing into "one dot" and "the whole screen".
- **Page reload on a phone**: nothing is persisted; the toy opens plain and empty exactly as it does on a laptop.
- **All the edge cases from the pink-sand, water/dirt, rainbow/unicorn, landscape-scenes, and sparkle-wand features** continue to apply unchanged at phone scale.

## Requirements *(mandatory)*

This feature extends the existing toy specified in `001-falling-pink-sand`, `002-water-and-purple-dirt`, `003-rainbow-unicorn-magic`, `004-landscape-scenes`, and `005-sparkle-magic-wand`. All requirements of those specs remain in force except where explicitly superseded in the **Superseded requirements** section below.

Throughout: a **phone-sized viewport** means a visible viewport whose shorter side is at most 480 screen pixels. The **drawing region** means the part of the screen left for the play area after the toolbar has taken its space. The **play field** means the grid of cells being simulated. All pixel measurements are CSS/screen pixels, not device pixels.

### Functional Requirements

**Filling the screen**

- **FR-001**: On a phone-sized viewport in either orientation, the play area MUST cover at least 90% of the drawing region's width and at least 90% of its height.
- **FR-002**: On a phone-sized viewport, the play area MUST cover at least 65% of the whole visible screen area in portrait and at least 60% in landscape.
- **FR-003**: The play area MUST NOT be distorted to achieve FR-001 or FR-002: cells MUST remain square, so grains never render as rectangles. Any leftover space MUST be a small, evenly split margin.
- **FR-004**: The play field's shape MUST be allowed to differ from today's fixed landscape shape so that FR-001 can be satisfied in portrait. The toy MUST derive **both** the play field's shape *and* its resolution — its dimensions in cells — from the drawing region's shape and size, so the play area always fills the screen with chunky, finger-friendly grains, subject to FR-005, FR-006, and FR-007. This supersedes spec 001's fixed 270×160 play field ("250–300 cells across, never changing while the page is open"); see **Superseded requirements**.
- **FR-005**: A single cell MUST render at no smaller than 2 screen pixels on a side on any supported viewport, so individual grains are visible to a child.
- **FR-006**: A stroke drawn with the default (medium) brush MUST be at least 24 screen pixels wide on a phone-sized viewport, so a swipe leaves an obviously visible trail under a fingertip.
- **FR-007**: The play field's total number of cells MUST NOT exceed the current default play field's cell count — 270×160, i.e. 43,200 cells — on any supported viewport, so the simulation can never become more expensive than it is today. A phone therefore gets chunkier grains, not more simulation work.
- **FR-008**: The three brush sizes MUST remain visibly distinct from one another at phone scale, and the largest brush MUST NOT cover more than half of the play field's shorter dimension.
- **FR-009**: The simulation's rules MUST be identical at every play-field size and shape — only the number of cells and the on-screen scale change. Elements MUST fall, flow, pile, and interact exactly as they do today.

**Touch drawing**

- **FR-010**: Press-and-drag with a finger MUST paint the selected element continuously along the entire path of the drag, with no gaps between touch samples on a fast swipe, on Android Chrome and iOS Safari.
- **FR-011**: A single tap on the play area MUST place one dab of the selected element under the finger; the eraser and the rainbow/unicorn placement tools MUST be fully usable by touch, matching their mouse behavior.
- **FR-012**: A touch anywhere in the play area MUST map to the cell under the finger at the current on-screen scale, exactly, including at the play area's edges, and MUST continue to do so after any resize or rotation.
- **FR-013**: Touching or dragging on the play area MUST NOT cause the page to scroll, rubber-band, pull-to-refresh, zoom (including double-tap zoom and pinch), select text, or raise a long-press context menu.
- **FR-014**: A drag that leaves the play area — onto the toolbar, or off the edge of the screen — MUST NOT paint outside the play area and MUST end cleanly when the finger is lifted, never leaving the brush stuck on.
- **FR-015**: A second simultaneous touch MUST NOT corrupt an in-progress stroke: the stroke MUST NOT jump to the second touch's position and MUST NOT become stuck on. No failure state may result.
- **FR-016**: Touches landing in the margin outside the play area MUST do nothing at all — no paint, no message, no state change.
- **FR-017**: Toolbar controls MUST respond to a tap without perceptible delay and MUST NOT cause paint on the play area.

**Toolbar and viewport fit**

- **FR-018**: On a phone-sized viewport in both orientations, every toolbar control MUST be fully visible on screen at page load with the browser's chrome at its largest — no control clipped, hidden behind chrome, or pushed off the bottom edge.
- **FR-019**: The page MUST NOT scroll or rubber-band in any direction on any supported viewport; the toy MUST occupy exactly one screen.
- **FR-020**: Every toolbar control MUST present a touch target of at least 44 screen pixels on each side, with enough separation that a fingertip cannot activate two at once.
- **FR-020a**: On a phone-sized viewport the toolbar MUST be a **compact, always-visible bar** that takes its own space rather than overlaying the play area: controls shrink toward the 44-pixel minimum of FR-020 and wrap to more than one row in portrait, and become a narrow rail down one side in landscape, where screen height is scarce. Every control stays visible in both arrangements (FR-021), and the toolbar MUST NOT consume so much space that the play area falls below FR-001 or FR-002.
- **FR-020b**: The toolbar MUST NOT overlay or float above the play area, so that a tap aimed at a control can never paint on the drawing surface (FR-017) and no control covers the child's drawing.
- **FR-021**: Every control the toy has MUST be visible at once on a phone. The toy MUST NOT hide controls behind a menu, a scroll, an expander, or any other affordance a non-reading child would have to discover.
- **FR-022**: The layout MUST use the *visible* viewport rather than a nominal one, so that a browser's collapsing address bar can never push the toolbar off-screen; when the chrome collapses or reappears mid-play, all controls MUST stay fully visible and the layout MUST NOT visibly jitter.
- **FR-023**: No control may be obscured by or overlap a device notch, rounded corner, or home-indicator area.
- **FR-024**: On laptop and desktop viewports the toolbar MUST look and behave as it does today.

**Preserving the drawing**

- **FR-025**: A change in the visible viewport that does not change the play field's dimensions in cells — an address bar collapsing, an on-screen keyboard, a desktop window nudge — MUST preserve the drawing exactly: every grain keeps its cell, its element, and its appearance, and every placed object keeps its position.
- **FR-026**: When the play field's dimensions in cells are re-derived — on an orientation change, or a viewport change large enough to warrant it — the drawing MUST be carried across as faithfully as the new shape allows: grains and objects keep their positions relative to the bottom-centre of the play field, so the ground stays at the bottom and a pile stays where the child put it; anything falling outside the new bounds is dropped; newly exposed area starts empty. Best-effort preservation is explicitly accepted here: losing a few edge grains to a rotation is the agreed cost of a full-screen play area, and spec 001's promise that a rotation preserves the drawing *exactly* is superseded for re-derivations only. The drawing MUST NOT simply be cleared on a re-derivation.
- **FR-027**: The play field MUST NOT be re-derived on transient or minor viewport changes; re-derivation MUST happen only once per settled change, so that rapid rotation or chrome animation cannot cause repeated cropping or visible thrash.
- **FR-028**: A rotation MUST end any in-progress stroke cleanly rather than continuing it across the change, and MUST preserve the selected tool and brush size.
- **FR-029**: A re-derivation MUST NOT regenerate a loaded scene; the existing rule that scenes are never regenerated on resize continues to apply.

**Non-regression, performance, and verification**

- **FR-030**: On a laptop or desktop viewport, the play area MUST be at least as large on screen as it is today in both dimensions, and mouse drawing, erasing, object placement, scenes, brush sizes, and clear-all MUST behave exactly as they do today.
- **FR-031**: The toy MUST stay smooth on a mid-range phone — target 60 frames per second, acceptable at or above 30 — with the play field full of moving elements at whatever size the phone's viewport produces.
- **FR-032**: No interaction introduced or changed by this feature may produce a failure state, a message, a confirmation, a score, or any way for the child to be "wrong". At no viewport size may the toy show an error, a scrollbar, or a blank screen.
- **FR-033**: Existing behavior MUST NOT regress: every element, object, tool, scene, and control MUST behave as specified by the earlier specs, and all existing automated tests MUST pass — updated only where a superseded requirement makes an assertion obsolete, never weakened to hide a regression.
- **FR-034**: The production build MUST still emit exactly one self-contained page, fully playable when opened directly from disk with no network requests.
- **FR-035**: The project MUST provide automated tests, runnable without a browser, covering at minimum: for a table of representative viewports (phone portrait, phone landscape, small phone, tablet portrait, tablet landscape, laptop, and an extreme aspect ratio) the resulting layout satisfies the fill percentages (FR-001, FR-002), square cells (FR-003), the minimum cell size (FR-005), the minimum medium-stroke width (FR-006), and the cell-count budget (FR-007); that a laptop viewport yields a play area no smaller than today's (FR-030); that touch/pointer coordinates map to the correct cell at several on-screen scales and at the play area's edges (FR-012); that a viewport change with unchanged cell dimensions preserves contents exactly (FR-025); that a re-derivation carries contents across under the stated anchoring rule, dropping only what falls outside the new bounds (FR-026); and that on the phone-sized entries every toolbar control fits on screen at or above the minimum touch target without overlapping the play area, wrapping in portrait and railing in landscape (FR-018, FR-020, FR-020a, FR-020b).

### Key Entities

- **Play field**: The grid of cells being simulated. Today it is fixed at 270×160; this feature makes its dimensions in cells a function of the drawing region so the play area can fill a phone screen (FR-004).
- **Drawing region**: The part of the visible screen available to the play area once the toolbar has taken its space. Its width, height, and shape drive the play field's dimensions and the on-screen scale.
- **Visible viewport**: The part of the browser window actually visible to the child, excluding collapsible browser chrome. All layout decisions are made against this rather than a nominal window size (FR-022).
- **On-screen scale**: How many screen pixels one cell occupies. It is no longer restricted to whole numbers, and it is what maps a touch point to a cell (FR-012).
- **Re-derivation**: The event of the play field taking new dimensions in cells because the drawing region changed shape substantially. It is the only thing that can move the drawing between cells, and it is governed by FR-026 and FR-027.

### Superseded requirements

- Spec 001's **FR-005** (the play field is a fixed grid of roughly 250–300 cells across whose size in cells never changes while the page is open) is superseded: the play field's dimensions in cells are derived from the drawing region (FR-004) and may be re-derived on a substantial shape change (FR-026, FR-027). The cell count remains bounded by today's (FR-007).
- Spec 001's **FR-033** (a resize or rotation preserves the play field's dimensions and every grain's position exactly) is superseded *only* for re-derivations: exact preservation still holds for every viewport change that does not re-derive the play field (FR-025), and a re-derivation preserves as faithfully as the new shape allows (FR-026).
- Spec 001's **FR-034** (rescale to fit while preserving the play field's aspect ratio, letterboxing when the viewport's shape differs) is superseded: the play field's shape now follows the drawing region, so letterboxing is reduced to the small residual margin allowed by FR-001 and FR-003. The requirement that the page still does not scroll is retained and strengthened (FR-019).
- Spec 001's **FR-003** and spec 004's **FR-007** (the play area and toolbar fit without page scrolling on a laptop and a tablet) are extended, not replaced: they now must also hold on a phone-sized viewport, against the *visible* viewport (FR-018, FR-019, FR-022).
- Spec 005's assumption that "phone-sized screens are not a target" is superseded: phones are a target as of this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a phone-sized viewport in portrait, the play area covers at least 90% of the drawing region's width and height and at least 65% of the whole visible screen — up from roughly 13% of a 390×844 screen today.
- **SC-002**: On a phone-sized viewport in landscape, the play area covers at least 90% of the drawing region's width and height and at least 60% of the whole visible screen.
- **SC-003**: Across every viewport in the representative test table, cells are square — 0 viewports produce a non-square cell — and the leftover margin is at most 10% of the drawing region on each axis.
- **SC-004**: Across every viewport in the representative test table, a single cell is at least 2 screen pixels on a side and a medium-brush stroke is at least 24 screen pixels wide on the phone-sized entries.
- **SC-005**: Across every viewport in the representative test table, the play field's cell count is at or below today's default, so simulation cost never rises.
- **SC-006**: On a laptop viewport, the play area's on-screen width and height are each greater than or equal to today's — 0 desktop regressions in play-area size.
- **SC-007**: A child can pour, erase, and place a rainbow with a finger on Android Chrome and on iOS Safari, with 100% of press-and-drag strokes painting continuously along the whole drag path and 0 dropped or gapped strokes on fast swipes.
- **SC-008**: Touch positions map to the correct cell at every tested on-screen scale, including at all four edges of the play area — 0 mis-mapped points.
- **SC-009**: On a phone, 0 browser gestures interfere with drawing: no scroll, no bounce, no pull-to-refresh, no pinch or double-tap zoom, no text selection, and no long-press menu occurs while drawing on the play area.
- **SC-010**: On a phone in both orientations, 100% of toolbar controls are fully visible at page load with the browser's chrome at its largest, and 100% remain visible after the chrome collapses and reappears.
- **SC-011**: 100% of toolbar controls present a touch target of at least 44 screen pixels on each side, and 0 controls are hidden behind a menu, a scroll, or an expander.
- **SC-011a**: On a phone, 0 toolbar controls overlap the play area in either orientation — the toolbar wraps above the play area in portrait and forms a side rail in landscape, and in both cases the play area still meets SC-001 and SC-002.
- **SC-012**: The page scrolls 0 pixels in any direction on every viewport in the representative test table.
- **SC-013**: A viewport change that leaves the play field's cell dimensions unchanged preserves 100% of grains in their exact cells — 0 grains lost, added, or shifted.
- **SC-014**: After a rotation, 100% of the grains that still fit inside the new play field are present at their anchored positions, the ground is still at the bottom, and only grains outside the new bounds are absent.
- **SC-015**: Rotating back and forth 10 times produces a playable toy with 0 error states, 0 stuck brushes, and 0 changes to the selected tool or brush size.
- **SC-016**: On a mid-range phone with the play field full of moving elements, the toy renders at least 30 frames per second, targeting 60.
- **SC-017**: A child cannot reach any state that shows a message, a confirmation, an error, a scrollbar, or a blank screen at any viewport size — 0 such states exist.
- **SC-018**: All existing automated tests pass, with changes limited to assertions made obsolete by the superseded requirements above — 0 tests weakened to accommodate a regression.
- **SC-019**: A production build still produces exactly one output file, and opening that file directly from disk yields a fully playable toy with 0 network requests.
- **SC-020**: The automated test suite runs to completion without a browser and asserts, for every viewport in the representative test table, the fill percentages, square cells, minimum cell size, minimum medium-stroke width, cell-count budget, desktop non-regression, coordinate mapping, exact preservation without re-derivation, anchored preservation across a re-derivation, and the phone toolbar's fit and touch targets.

### On-device checks for the maintainer *(no automated coverage)*

- On a real Android Chrome phone, the play area genuinely reads as "the whole screen" rather than "a picture on a page", in both portrait and landscape.
- A fingertip swipe leaves a chunky, obviously visible trail; individual grains are visible as specks rather than as a smooth wash of colour.
- All three brush sizes feel meaningfully different at phone scale.
- Drawing feels immediate and smooth — no lag between finger and paint, no stutter with a busy screen.
- The toolbar reads as a friendly row (or rail) of big round buttons, not a cramped strip, and a small hand can hit any button without hitting its neighbour.
- Scrolling the page is impossible no matter how the child swipes, including from the very top and bottom edges.
- Turning the phone feels like the toy adapting rather than the toy breaking.
- On iOS Safari specifically: no rubber-band bounce, no double-tap zoom, no text-selection callout, and the bottom controls clear the home indicator.
- On the laptop, the toy looks and feels exactly as it did before this change.

## Assumptions

- **Builds on the existing toy**: this feature assumes `001-falling-pink-sand`, `002-water-and-purple-dirt`, `003-rainbow-unicorn-magic`, `004-landscape-scenes`, and `005-sparkle-magic-wand` are the base being extended. All of their constraints (single self-contained page, no reading required, no failure states, mouse and touch) continue to apply, and this feature changes only how the toy is sized, laid out, and touched — never a simulation rule.
- **Kid usability outranks fidelity to the fixed play field.** The issue asks the spec to weigh kid-usability first, and the maintainer confirmed this in the clarification round: a big finger-friendly drawing surface is preferred over preserving today's exact 270×160 play field and its exact-preservation-on-rotation promise. That is why FR-004 and FR-026 supersede parts of spec 001 rather than working around them.
- **"Phone-sized" is defined by the viewport, not by user-agent sniffing** (shorter side at most 480 screen pixels). A desktop window shrunk to phone proportions gets the phone layout; this is intentional and makes the behavior testable without a device.
- **The touch event path is already largely correct.** The issue notes as much. This spec therefore treats the size fix as the primary cause and states the remaining touch behaviors (FR-013 through FR-017) as requirements to verify on-device, expecting most to already hold; any that do not are in scope to fix.
- **The number of cells is capped at today's count** (FR-007) rather than raised, so this feature cannot make the simulation slower on the weakest target device. A phone therefore gets *chunkier* grains, not more of them — which is also what makes strokes visible under a fingertip.
- **Grains get chunkier on a phone, and that is a feature.** At the required minimum sizes a phone play field is coarser than a laptop's. For a falling-sand toy aimed at a four-year-old this reads as bigger, friendlier sand rather than as lost detail.
- **Objects (🌈 🦄) scale with the play area** so they stay recognisable emoji at phone scale rather than becoming specks or covering the screen; their footprint in cells follows the play field's resolution.
- **Nothing is persisted and nothing is added to the interface**: no orientation lock, no "rotate your phone" prompt, no settings, no install banner, no fullscreen request. The toy stays one screen with one row of buttons.
- **No sound**, consistent with the rest of the toy.
- **Target devices are now a mid-range laptop, a tablet, and a mid-range phone** (Android Chrome and iOS Safari as the browsers named in the issue). Very old browsers without modern viewport or pointer support are out of scope.
- **Verification without a browser** means the sizing, layout, coordinate-mapping, and preservation rules are pure functions of viewport dimensions and play-field state, testable in unit tests; the visual and feel checks are the maintainer's job on a real phone, consistent with the project's no-browser-harness principle.
