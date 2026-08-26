# Feature Specification: Landscape Scenes

**Feature Branch**: `spec-draft/004-landscape-scenes`

**Created**: 2026-08-26

**Status**: Draft

**Input**: GitHub issue #4 — "Landscape scenes: two preloaded worlds plus empty canvas"

> Like the "landscape" choices she loves in Sand Saga: preloaded starting scenes, selectable any time from the toolbar.
>
> - Three scene buttons, visually distinct and emoji-labeled:
>   - ⬜ **Empty** — blank canvas (current behavior)
>   - 🏔️ **Landscape 1** — e.g. rolling purple-dirt hills with a valley lake of water, a rainbow arcing in the sky, and a unicorn standing on a hill
>   - 🏝️ **Landscape 2** — a different vibe, e.g. a pink-sand beach with a big pool of water on one side, a couple of rainbows, and a unicorn by the shore
> - Tapping a scene button instantly replaces the canvas contents with that scene (no confirmation dialog — switching back is just another tap).
> - Scenes are generated from the existing elements (sand, water, dirt, rainbow, unicorn) so everything in them is fully interactive and erasable — not background images.
> - Scene generation should be deterministic enough to look good every time.
> - After loading a scene she can keep drawing on top of it with any element.
> - Unit-test the scene generators (grid contains expected elements in expected regions).
>
> Existing behavior must not regress.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Load a purple hills and lake world (Priority: P1)

The child taps 🏔️ in the toolbar. The play area, whatever was in it, is instantly replaced by a whole little world: rolling hills of magic purple dirt across the bottom, a lake of water sitting in the valley between them, a rainbow arcing across the sky above, and a unicorn standing on top of one of the hills. Nothing asks her if she is sure and nothing has to load — the world is just there. She can immediately start pouring pink sand onto the hills, dragging the eraser through the lake, or stamping more rainbows, and everything in the scene behaves exactly like the things she draws herself.

**Why this priority**: A single ready-made world is the whole point of the request — it turns a blank page into somewhere to play. Shipping just this one scene already delivers the feature's value.

**Independent Test**: Tap 🏔️ on an empty play area and confirm hills, a lake, a rainbow, and a unicorn appear in the expected regions; then draw and erase on top of them and confirm they behave like ordinary drawn contents. The contents-by-region check is fully verifiable in automated tests against play-area state alone, with no browser.

**Acceptance Scenarios**:

1. **Given** an empty play area, **When** the child taps 🏔️, **Then** the purple-hills scene appears immediately, with no confirmation and no message.
2. **Given** the child has drawn a large pile of pink sand, **When** she taps 🏔️, **Then** everything she drew is gone and only the scene's contents remain.
3. **Given** the purple-hills scene has loaded, **When** the child looks at it, **Then** she sees magic purple dirt forming hills across the lower part of the play area, water filling a valley between hills, a rainbow in the upper part, and a unicorn standing on a hilltop.
4. **Given** the purple-hills scene has loaded, **When** the simulation advances with no drawing, **Then** the scene stays visually stable — the hills do not slump into a flat layer and the lake does not drain away.
5. **Given** the purple-hills scene has loaded, **When** the child pours pink sand onto a hill, **Then** the sand piles and slides on the scene's dirt exactly as it does on dirt she drew herself.
6. **Given** the purple-hills scene has loaded, **When** the child drags the 🧽 eraser through the lake, **Then** the water is removed exactly as drawn water would be.
7. **Given** the purple-hills scene has loaded, **When** the child taps 🗑️, **Then** the play area is emptied completely, scene contents included.
8. **Given** the child taps 🏔️ twice in a row, **When** the second tap lands, **Then** the play area again holds exactly the same scene it held after the first tap.

---

### User Story 2 - Switch between worlds and back to a blank canvas (Priority: P1)

The child taps 🏝️ and the world changes completely: a pink-sand beach sloping down to a big pool of water on one side, a couple of rainbows in the sky, and a unicorn standing on the sand near the water. She taps 🏔️ and she is back in the purple hills; she taps ⬜ and she has a blank canvas to draw on from scratch. Every switch is one tap, instant, and reversible by another tap — there is never anything to confirm and nothing she can get wrong.

**Why this priority**: Choosing *between* worlds is the interaction she recognizes from the toy she already loves; a single scene with no way back to blank would be worse than what she has today.

**Independent Test**: Tap through ⬜, 🏔️, and 🏝️ in any order and confirm each tap fully replaces the play area with that choice's contents, with the blank choice leaving it empty. Fully verifiable in automated tests against play-area state alone.

**Acceptance Scenarios**:

1. **Given** any play area contents, **When** the child taps 🏝️, **Then** the beach scene appears: pink sand covering the lower part and sloping toward one side, a large body of water on that side, two rainbows in the upper part, and a unicorn standing on the sand near the water's edge.
2. **Given** the beach scene is loaded, **When** the child taps 🏔️, **Then** the beach is completely gone and the purple-hills scene is present, with no trace of the beach's sand, water, rainbows, or unicorn.
3. **Given** any scene is loaded, **When** the child taps ⬜, **Then** the play area becomes completely empty — no elements, no rainbows, no unicorns, no floating sparkles.
4. **Given** an already-empty play area, **When** the child taps ⬜, **Then** nothing changes and nothing is refused or reported.
5. **Given** the child taps scene buttons rapidly several times in a row, **When** the taps land, **Then** the play area shows the scene from the last tap and the toy stays smooth.
6. **Given** the child is in the middle of a press-and-drag with an element brush, **When** she lifts and taps a scene button, **Then** the scene replaces everything including the strokes she just drew, and the next drag draws normally on top of the new scene.
7. **Given** any scene button is tapped, **When** the play area is replaced, **Then** the currently selected drawing tool and brush size are unchanged, so she can keep drawing with whatever she had chosen.

---

### User Story 3 - Keep playing on top of a world (Priority: P2)

The world she loaded is not a picture — it is made of the same sand, water, dirt, rainbows, and unicorns she draws herself. She pours pink sand off a purple hilltop and watches it slide down into the lake and sink. She drags the eraser to dig a channel between the hill and the valley and the lake drains through it. She stamps another rainbow over the beach and pours sand through it to make rainbow sand. The unicorn that came with the scene sparkles when her sand touches it, just like one she placed herself.

**Why this priority**: Interactivity is what separates this from a background image, and it is what makes the scenes worth loading twice. It rides along with the scenes but is called out separately because it is the property most at risk of being lost.

**Independent Test**: Load a scene, then apply every existing interaction to its contents — draw on them, erase them, let gravity act on them, run a rainbow's conversion against them — and confirm each behaves identically to contents the child drew by hand.

**Acceptance Scenarios**:

1. **Given** a loaded scene, **When** the simulation advances, **Then** every element in it obeys the same falling, sliding, flowing, and piling rules as drawn elements.
2. **Given** a loaded scene, **When** the child digs a channel through a hill wall with the eraser, **Then** the water behind it flows through the gap under the normal water rules.
3. **Given** a loaded scene, **When** the child drags the eraser over the scene's rainbow or unicorn, **Then** the whole object disappears exactly as a hand-placed one would.
4. **Given** a loaded scene, **When** the child pours an element so it touches the scene's unicorn, **Then** the unicorn celebrates exactly as a hand-placed unicorn does.
5. **Given** a loaded scene, **When** the child pours an element so it touches one of the scene's rainbows, **Then** the element is converted to rainbow sand exactly as it would be by a hand-placed rainbow.
6. **Given** a scene that already contains rainbows and unicorns, **When** the child places more of the same type, **Then** the existing per-type cap applies and the scene's objects are treated as ordinary placed objects for that purpose — the oldest of that type rolls off, nothing is refused, and nothing is reported.

---

### Edge Cases

- **A scene loaded onto a full play area**: the replacement is total. Every element, every object, and every floating particle from before is gone; there is no merging and no partial overwrite.
- **Tapping a scene button mid-pour**: the current stroke's contents are replaced along with everything else; releasing and pressing again simply draws on the new scene.
- **Rapid repeated taps on scene buttons**: each tap fully replaces the play area; the last tap wins. No queue builds up and no half-drawn scene is ever visible.
- **A very small or very large play area**: scenes are laid out in proportion to the play area, so hills, lake, beach, pool, rainbows, and unicorn all remain present and recognizable at any supported size rather than being clipped off the edge or shrunk to a few cells.
- **Resize or rotation after loading a scene**: the existing preserve-contents-on-resize behavior applies unchanged — the scene is *not* regenerated and the child does not lose what she has drawn on top of it.
- **A scene's rainbow touching the scene's own ground**: scenes place rainbows clear of the elements they contain, so a freshly loaded scene does not instantly convert its own hills or lake into rainbow sand. If the child later piles elements up into a rainbow, the normal conversion applies.
- **A scene's unicorn standing directly on the scene's ground**: the unicorn may celebrate immediately on load because the ground touches it. This is welcome, not a defect — the world greets her with sparkles.
- **Loading a scene while sparkles from a previous unicorn are still in the air**: those particles are cleared with everything else; no particle from the previous contents survives into the new scene.
- **Page reload**: nothing is persisted. The toy still opens on an empty play area, exactly as it does today; a scene is only ever loaded by tapping its button.
- **All the edge cases from the pink-sand, water/dirt, and rainbow/unicorn features** (drawing at the play-area edge, fast drags, pointer leaving the window, resize/rotation, object caps) continue to apply unchanged to scene contents.

## Requirements *(mandatory)*

This feature extends the existing toy specified in `001-falling-pink-sand`, `002-water-and-purple-dirt`, and `003-rainbow-unicorn-magic`. All requirements of those specs remain in force except where explicitly superseded in the **Superseded requirements** section below.

### Functional Requirements

**Scene controls**

- **FR-001**: The toolbar MUST offer three scene controls — ⬜ empty, 🏔️ landscape 1, and 🏝️ landscape 2 — grouped together and visually distinguishable from the element brushes, the object tools, the eraser, the clear-all control, and the brush sizes.
- **FR-002**: Each scene control MUST be a large, round, emoji-labeled button of the same finger-size class as the existing controls, understandable without reading, and reachable in a single tap from the play state on both a laptop and a tablet.
- **FR-003**: A single tap on a scene control MUST take effect immediately, with no confirmation, no dialog, no message, and no way for the tap to be refused or ignored.
- **FR-004**: Scene controls MUST NOT change the currently selected drawing tool or the selected brush size.
- **FR-005**: Scene controls MUST be usable at any time and any number of times, including immediately after another scene control, with the most recent tap always determining the resulting contents.
- **FR-006**: The scene controls MUST NOT be shown as the active drawing tool; exactly one drawing tool (element brush, object tool, or eraser) remains active at all times, unaffected by scene selection. [NEEDS CLARIFICATION: should the scene buttons additionally show a persistent "this is the world you are in" highlight on the last scene loaded — and if so, does that highlight stay on after she has drawn all over the scene, or clear on the first stroke?]
- **FR-007**: The toolbar MUST still fit on screen without the page scrolling on both a laptop and a tablet with all controls present, and every control MUST remain finger-sized for a small child.
- **FR-008**: The relationship between ⬜ empty and the existing 🗑️ clear-all control MUST be resolved so the toolbar does not carry two controls with identical effects and unclear meanings. [NEEDS CLARIFICATION: does ⬜ empty replace 🗑️ clear-all (one control, in the scene group), or do both remain (🗑️ as the familiar wipe, ⬜ as the third scene choice)?]

**Loading a scene**

- **FR-009**: Loading a scene MUST first remove *all* existing play-area contents — every element cell, every rainbow, every unicorn, and every live particle — and then place the chosen scene's contents.
- **FR-010**: The replacement MUST be atomic from the child's point of view: no intermediate state showing a mix of old and new contents, and no partially drawn scene, is ever visible.
- **FR-011**: The ⬜ empty scene MUST leave the play area completely empty, identical to the state after 🗑️ clear-all and identical to the state the toy opens in.
- **FR-012**: Scene contents MUST be composed entirely of the toy's existing elements and objects — pink sand, water, magic purple dirt, rainbow sand, rainbows, and unicorns. Scenes MUST NOT introduce new element types, background layers, images, or any content that cannot be drawn or erased by the child.
- **FR-013**: Every cell and object placed by a scene MUST be indistinguishable in behavior from the same cell or object drawn by the child: it MUST obey the same simulation rules, be erasable by the 🧽 eraser, be removable by 🗑️, and participate in rainbow conversion and unicorn celebration exactly as hand-placed contents do.
- **FR-014**: Rainbows and unicorns placed by a scene MUST count as ordinary placed objects for the existing per-type on-screen cap, in placement order, so that subsequent placements by the child roll the oldest off exactly as they would otherwise.
- **FR-015**: A scene MUST NOT be persisted or restored: reloading the page MUST still open on an empty play area.
- **FR-016**: Loading a scene MUST NOT regenerate on resize or rotation; existing preserve-contents-on-resize behavior governs what happens to the loaded contents.

**Scene composition**

- **FR-017**: The 🏔️ landscape-1 scene MUST contain, at minimum: rolling hills of magic purple dirt occupying the lower portion of the play area with at least two crests and a valley between them, a body of water filling that valley as a lake, at least one rainbow in the upper (sky) portion, and exactly one unicorn standing on a hill crest.
- **FR-018**: The 🏝️ landscape-2 scene MUST contain, at minimum: a beach of pink sand occupying the lower portion of the play area and sloping down toward one side, a large body of water occupying that side, two rainbows in the upper (sky) portion, and exactly one unicorn standing on the sand near the water's edge.
- **FR-019**: The two landscape scenes MUST be clearly different from each other at a glance — different dominant element, different terrain shape, and a different number of rainbows.
- **FR-020**: Each scene MUST be composed so that it is already at rest when it loads: hills MUST hold their shape rather than slumping into a flat layer, water MUST stay in its basin rather than draining away, and no part of the scene may collapse or visibly rearrange itself when the simulation advances with no drawing.
- **FR-021**: A scene's rainbows MUST be placed clear of the scene's own elements, so that loading a scene does not immediately convert its own terrain or water into rainbow sand.
- **FR-022**: A scene's contents MUST be laid out in proportion to the play area's dimensions, so that at any supported play-area size every required part of the scene (terrain, water, rainbows, unicorn) is present, fully inside the play area, and recognizable — never clipped, never reduced to a handful of cells, and never overlapping in a way that hides a required part.
- **FR-023**: Scene generation MUST be deterministic: loading the same scene twice at the same play-area size MUST produce identical contents, cell for cell and object for object. Any variation used to make terrain look natural MUST come from a fixed, reproducible source rather than from a source that differs between loads or between sessions.

**Performance, safety, and verification**

- **FR-024**: Loading any scene MUST complete within a single frame from the child's point of view — the world appears instantly on tap, with no progress indicator, no visible redraw, and no perceptible pause.
- **FR-025**: With any scene loaded and the simulation running, the toy MUST stay smooth (target 60fps, acceptable ≥30fps) at the default play-area size on a mid-range laptop and a tablet.
- **FR-026**: No interaction in this feature MUST produce a failure state, a message, a confirmation, a sound requirement, or any way for the child to be "wrong". Losing her drawing to a scene tap MUST be silent and instant; the remedy is another tap.
- **FR-027**: Existing behavior MUST NOT regress: with no scene loaded, every existing element, object, tool, and control MUST behave exactly as it does today, and all existing automated tests MUST pass unchanged.
- **FR-028**: The project MUST provide automated tests, runnable without a browser, covering at minimum: each landscape scene placing the expected elements in the expected regions of the play area (FR-017, FR-018); the empty scene leaving zero occupied cells and zero objects (FR-011); a scene load clearing all previous contents before placing its own (FR-009); determinism — the same scene generated twice at the same size producing identical contents (FR-023); scenes remaining well-formed across a range of play-area sizes (FR-022); and each scene being at rest, so that advancing the simulation on a freshly loaded scene leaves its terrain and water substantially unchanged (FR-020).
- **FR-029**: The production build MUST still emit exactly one self-contained page, fully playable when opened directly from disk with no network requests.

### Key Entities

- **Scene**: A named, preloaded arrangement of the toy's existing elements and objects that can replace the play area's contents on a single tap. Three exist: empty, landscape 1, landscape 2.
- **Scene generator**: The deterministic description that turns a play-area size into that scene's contents. It is the unit under test for the automated coverage in FR-028.
- **Scene region**: A proportional area of the play area (for example, "the lower third", "the sky", "the left quarter") used both to compose a scene and to assert its contents in tests.

### Superseded requirements

- The rainbow/unicorn spec's **cap on on-screen controls** is superseded by this spec: the toolbar gains the scene group, and the binding constraint becomes FR-007 — the toolbar fits on screen without page scrolling on a laptop and a tablet, with every control finger-sized and one tap away. The exact control count depends on the resolution of FR-008.
- The pink-sand spec's requirement that the play area **starts and stays empty until the child draws** is superseded only to the extent that a scene control may now fill it; the toy still *opens* on an empty play area (FR-015).
- The rainbow/unicorn spec's assumption that **"scenes are still out of scope"** is retired by this spec, which is that feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A 4–5 year old can load a landscape and start playing in it within 10 seconds of being shown the toy, with no adult instruction and without reading anything.
- **SC-002**: Tapping any scene control replaces the play area contents within one frame — 0 visible intermediate states and 0 progress indicators.
- **SC-003**: After loading a scene, 100% of the previous contents are gone: 0 element cells, 0 objects, and 0 particles from the previous state remain.
- **SC-004**: Generating the same landscape twice at the same play-area size produces identical contents — 0 differing cells and 0 differing objects.
- **SC-005**: Each landscape, generated across the full supported range of play-area sizes, contains every part required by FR-017 / FR-018 at every size — 0 sizes at which a required part is missing, clipped, or reduced below recognizability.
- **SC-006**: Advancing the simulation on a freshly loaded landscape with no drawing leaves the terrain height profile and the water body substantially unchanged — no hill flattens and no body of water drains away.
- **SC-007**: 100% of scene-placed cells and objects respond to the eraser, to clear-all, to gravity, to rainbow conversion, and to unicorn celebration exactly as hand-placed ones do — 0 behavioral differences.
- **SC-008**: The ⬜ empty scene leaves exactly 0 occupied cells, 0 objects, and 0 live particles.
- **SC-009**: An adult shown the two landscapes side by side identifies them as two clearly different worlds — different dominant element, different terrain, different rainbow count.
- **SC-010**: With either landscape loaded and elements in motion, the toy renders at least 30 frames per second, targeting 60, on a mid-range laptop and a tablet.
- **SC-011**: The selected tool and brush size are unchanged across any number of scene taps — 0 unintended tool or brush-size changes.
- **SC-012**: A play area in which no scene control has been tapped behaves identically to the previous release — all existing acceptance scenarios and automated tests pass unchanged.
- **SC-013**: A child cannot reach any state that shows a message, a confirmation, an error, or a score through the scene controls — 0 such states exist.
- **SC-014**: The automated test suite runs to completion without a browser and asserts each landscape's expected elements in expected regions, the empty scene's emptiness, full replacement on load, determinism, size robustness, and at-rest stability.
- **SC-015**: The toolbar with the scene controls added still fits on screen with no page scrolling on both a laptop and a tablet, and every control remains a single tap away.
- **SC-016**: A production build still produces exactly one output file, and opening that file directly from disk yields a fully playable toy with zero network requests.

### Visual checks for the maintainer *(no automated coverage)*

- Each landscape reads instantly as a *place* — hills with a lake, a beach with a pool — not as a random scatter of colored cells.
- The purple hills look rolling rather than blocky or stair-stepped, and the lake sits convincingly in the valley.
- The beach slopes into the water in a way that reads as a shoreline.
- The rainbows sit in the sky where a rainbow belongs and are not clipped by the top or side edges.
- The unicorn looks like it is standing on the ground, not floating above it or half-buried in it.
- Loading a scene feels instantaneous and satisfying — no flicker, no visible sweep as the world is drawn.
- The scene buttons read as "pick a world" rather than as three more drawing tools, and the toolbar still looks like a friendly row of big round buttons.
- Switching back and forth between the two landscapes and the blank canvas feels like flipping between pages, with no lag and no surprise.

## Assumptions

- **Builds on the existing toy**: this feature assumes `001-falling-pink-sand`, `002-water-and-purple-dirt`, and `003-rainbow-unicorn-magic` are the base being extended — grid, canvas, drawing, brush sizes, eraser, clear-all, rainbow and unicorn objects, resize handling, build, and test setup. All of their constraints (single self-contained page, no reading required, no failure states, mouse and touch) continue to apply.
- **Rainbows and unicorns are available**: the landscapes described in the issue include a rainbow and a unicorn, so this feature depends on the rainbow/unicorn objects from `003-rainbow-unicorn-magic` already existing in the codebase when it is implemented. [NEEDS CLARIFICATION: if the rainbow/unicorn work has not landed when this feature is implemented, should the landscapes ship terrain-and-water only and gain their rainbows and unicorns later, or should this feature wait for that work to land first?]
- **The issue's scene descriptions are binding, not illustrative**: the issue writes "e.g." before each landscape's contents, but this spec treats the described contents (hills + lake + rainbow + unicorn; beach + pool + two rainbows + unicorn) as the requirement (FR-017, FR-018) so the scenes are testable. Artistic details beyond those — exact hill count above two, exact shoreline curve, exact rainbow positions — are tuning choices for the implementer.
- **"Deterministic enough to look good every time" means fully deterministic**: any pseudo-randomness used to shape terrain is seeded from a fixed value, so a given scene at a given size is always identical (FR-023). This is both the most testable reading and the one that guarantees the scenes never generate a bad-looking world.
- **Scenes are generated, not stored**: a scene is described in proportional terms and rendered to whatever play-area size is current, rather than stored as a fixed-size snapshot. This is what lets FR-022 hold across laptop and tablet.
- **Scene contents are placed already settled**: the generator produces terrain and water in a resting arrangement rather than dropping loose material and letting it fall into place, so there is no collapse animation on load (FR-020). A brief, small water level adjustment in the first frames is acceptable; a hill slumping flat is not.
- **No transition or animation**: the scene appears instantly. No fade, wipe, or reveal is specified; the requester asked for "instantly replaces".
- **No undo**: switching scenes destroys what the child drew, by design — the issue is explicit that switching back is just another tap. There is no undo, no history, and no "are you sure".
- **No sound**: consistent with the rest of the toy, loading a scene makes no sound.
- **Scene buttons are momentary actions**: tapping one performs a replacement rather than entering a mode, so a scene tap never leaves the toy in a state where drawing behaves differently. FR-006 tracks whether the buttons should nonetheless *show* which world was last loaded.
- **Two landscapes, no more**: exactly two preloaded landscapes plus empty, matching the issue and the constitution. Adding further scenes is a separate feature.
- **Target devices unchanged**: a mid-range laptop with mouse/trackpad and a tablet with touch; phone-sized screens are not a target.
