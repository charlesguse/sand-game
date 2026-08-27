# Feature Specification: Undo and Redo

**Feature Branch**: `spec-draft/010-undo-redo`

**Created**: 2026-08-27

**Status**: Draft

**Input**: GitHub issue #28 — "Undo and redo for drawing actions"

> Add **undo and redo** to Rainbow Sand, so a kid can take back the last thing she drew (and bring it back if she changes her mind).
>
> The player is almost 5. When a drawing goes wrong — an accidental eraser swipe, a firework that wrecked a picture, a smear across something she liked — the only recovery today is the Clear button, which throws away everything. One tap to rewind the last action is the single most-requested missing affordance.
>
> - Two new toolbar buttons, **Undo** and **Redo**, matching the existing big, touch-friendly button style. Suggested glyphs ↩️ and ↪️, but consistency with the existing toolbar wins.
> - **Undo** restores the world to how it looked **just before the most recent user action**. A "user action" is one complete stroke (pointer-down → pointer-up) with any tool, or one tap of a world-changing button (e.g. Clear). Sand that has settled or kept falling since that action is included in the rewind — the whole grid goes back.
> - **Redo** re-restores what the last Undo took away. Any new stroke after an Undo clears the redo stack.
> - Buttons appear visually disabled (dimmed, still large) when there is nothing to undo / redo. No error states, no dialogs.
> - Undo history is bounded — the last 10 actions. Older states silently drop off.
> - Undoing a Clear must work (this is the #1 rescue case).
> - Snapshot-based implementation is fine; keep total app size reasonable (~60 KB today) and do not measurably hurt the frame rate on mid-range phones.
> - Must work with every existing tool and material, including eraser, fireworks/star power, and weather — no per-tool special cases in the user model.
> - Touch-first; must also work with mouse. No persistence needed: history can reset on page reload.
> - Undo does not pause the simulation; only grid contents need to be part of a snapshot; keyboard shortcuts are a nice-to-have.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Taking back the last thing she drew (Priority: P1)

The child draws a long purple smear right across the unicorn's garden and immediately goes "no!". She taps the ↩️ button once. The smear is gone and the garden is back exactly as it was a moment before her finger went down — the sand that had been falling is falling again, the water is still sloshing, everything simply carries on from before the mistake. She can tap again to take back the stroke before that, and again, and again. Nothing pops up, nothing asks her anything, and nothing else in her picture is disturbed.

**Why this priority**: This is the whole feature in one gesture. One tap that takes back the last stroke is the recovery the toy is missing today, and it delivers value entirely on its own even if Redo never existed.

**Independent Test**: In a headless world, capture the state, run a stroke with each tool, advance the simulation for a while, undo, and assert the world is cell-for-cell identical to the captured state including every placed object; then assert the simulation continues to advance normally from it.

**Acceptance Scenarios**:

1. **Given** a drawing on the field, **When** the child completes a stroke with any element brush and taps ↩️, **Then** the whole play field returns to exactly how it was the instant before that stroke began, and nothing on screen suggests anything went wrong.
2. **Given** a stroke made with the 🧽 eraser that rubbed out something she liked, **When** she taps ↩️, **Then** everything the eraser removed is back, in its cells, looking as it did.
3. **Given** a ⭐ star power stroke that set her lawn burning, **When** she taps ↩️, **Then** the lawn is whole again and the burn is gone — the rewind covers what the star did *and* what the fire had already spread to, because the whole field goes back.
4. **Given** sand that has kept falling and settling for several seconds since her last stroke, **When** she taps ↩️, **Then** the field goes back to the moment before the stroke — the settling since then is rewound too, which is what "make it like it was" means to her.
5. **Given** several strokes in a row, **When** she taps ↩️ several times, **Then** each tap takes back one more stroke, most recent first.
6. **Given** a ↩️ tap, **When** the world is restored, **Then** the simulation keeps running without a pause, freeze, or stutter, and the selected tool and brush size do not change.
7. **Given** a tap of ↩️, **When** the child watches the toolbar, **Then** no button becomes "selected" — ↩️ acts and stays a plain button, exactly as 🗑️ does.
8. **Given** a fresh page with nothing drawn yet, **When** the child looks at ↩️, **Then** it is dimmed, and tapping it does nothing at all.

---

### User Story 2 - Rescuing everything after the bin (Priority: P2)

She taps the 🗑️ bin by accident and her whole picture vanishes. Her face falls — and then she taps ↩️ and the entire world comes back: the sand, the water, the grass, the rainbows and unicorns she had placed, all of it, exactly where it was. The same thing works if she taps a scene button and wipes out what she was making.

**Why this priority**: The issue calls this the #1 rescue case, and today it is unrecoverable. It rides on the same machinery as User Story 1 but is separately visible, separately testable, and is the moment the feature earns its keep.

**Independent Test**: In a headless world, build a field containing every element plus placed rainbows and unicorns, clear it, undo, and assert every cell and every object is back; repeat with each scene button in place of Clear.

**Acceptance Scenarios**:

1. **Given** a full picture, **When** the child taps 🗑️ and then ↩️, **Then** the whole picture is back — every element cell and every placed 🌈 and 🦄 in its old position.
2. **Given** a full picture, **When** the child taps a scene button (⬜, 🏔️, 🏝️) and then ↩️, **Then** her picture is back and the scene is gone.
3. **Given** the world she has just rescued with ↩️, **When** she goes on playing, **Then** everything works normally — brushes, eraser, the wand, objects, weather — with no trace that a rewind happened.
4. **Given** an empty field, **When** she taps 🗑️ on it (which changes nothing) and then taps ↩️, **Then** ↩️ takes back the last thing that actually changed the world, not the bin tap that did nothing.

---

### User Story 3 - Bringing it back (Priority: P3)

She undoes the firework she just drew, looks at the picture without it, and decides she liked it better with. She taps ↪️ and the firework is back, exactly as the undo had found it. If instead she draws something new after undoing, the ↪️ button quietly dims — there is nothing to bring back any more, and nothing tells her off about it.

**Why this priority**: Redo turns undo from a one-way door into something safe to explore with, which matters for a child who taps to find out what things do. It depends on undo existing, so it ranks third.

**Acceptance Scenarios**:

1. **Given** a ↩️ she has just tapped, **When** she taps ↪️, **Then** the field returns to exactly what it looked like at the moment she tapped ↩️.
2. **Given** several ↩️ taps in a row, **When** she taps ↪️ the same number of times, **Then** she arrives back where she started, one step per tap.
3. **Given** a ↩️ followed by any new stroke or world-changing tap, **When** she looks at ↪️, **Then** it is dimmed and the thing she undid cannot be brought back — the new drawing is what counts now.
4. **Given** a ↩️ and then several seconds of watching sand settle, **When** she taps ↪️, **Then** she still gets back exactly the world the ↩️ took away, unchanged by the waiting.
5. **Given** a page that has just loaded, **When** she looks at ↪️, **Then** it is dimmed, and tapping it does nothing.

**Independent Test**: In a headless world, run action → undo → redo and assert the field matches the pre-undo state cell for cell; then run action → undo → new action and assert redo is unavailable and does nothing.

---

### User Story 4 - The buttons always behave, everywhere (Priority: P4)

The two new buttons look and feel like the ones she already knows: big, round, emoji, in their own little group. They are dim when there is nothing to do and bright when there is. On the phone every button still fits on the screen at once, in both directions. However hard she hammers ↩️ and ↪️, the toy never slows down, never shows a message, and never gets into a state she cannot draw her way out of.

**Why this priority**: These are the fit, feel, and safety promises that make the feature shippable for an almost-5-year-old. Most follow from existing rules, so they rank last, but the phone-fit constraint from spec 006 genuinely binds — this is the first feature since 006 to add controls.

**Independent Test**: Compute the toolbar layout with the two extra controls at phone portrait and landscape viewport sizes and assert every control still fits at or above the minimum touch target with no page scroll and the play area still meets its fill minimums; in headless tests, hammer undo and redo from adversarial states and assert the world stays valid and the history bounds hold.

**Acceptance Scenarios**:

1. **Given** the toy has just loaded, **When** the child looks at the toolbar, **Then** ↩️ and ↪️ sit together as their own little group, in the same big round emoji-button family, needing no reading to understand.
2. **Given** a phone in either orientation, **When** the toy opens, **Then** every control including the two new ones is fully visible at once, big enough for her finger, with no scrolling and no control on top of her drawing.
3. **Given** nothing to undo or redo, **When** she looks at those buttons, **Then** they are dimmed but still full size in their usual place — they never disappear, shrink, or move.
4. **Given** a dimmed ↩️ or ↪️, **When** she taps it repeatedly, **Then** nothing happens: no message, no dialog, no sound, no flicker, no change to the world.
5. **Given** more than ten strokes in a row, **When** she taps ↩️ over and over, **Then** she can step back through the last ten actions and no further, with the button dimming when she runs out and nothing telling her she has hit a limit.
6. **Given** a busy field with weather, burning grass, and a lot of falling sand on a cheap tablet, **When** she draws stroke after stroke, **Then** the toy stays as smooth as it is today — recording history is never something she can feel.
7. **Given** the page is reloaded, **When** the toy opens, **Then** the field is empty and both buttons are dimmed — nothing is remembered from last time.

---

### Edge Cases

- **Undo on a completely fresh page**: nothing to undo, the button is dim, the tap does nothing.
- **A stroke that changed nothing** — a brush drag entirely over cells it cannot alter, a ⭐ drag over water while the sky is already full, an eraser drag over empty space, a 🗑️ tap on an already-empty field: no history step is recorded, so the next ↩️ takes back the last thing that really happened rather than appearing broken.
- **Undo while a finger is still drawing** (a second finger on the toolbar): the stroke in progress is finished and counted as one action first, then the undo takes it back. The brush never gets stuck on.
- **A stroke that is one single tap** (a dot of sand): still one whole action, undone by one tap.
- **A 🌈 or 🦄 placed by a tap**: one tap is one action; ↩️ removes that object and leaves everything else alone. Placing five unicorns takes five ↩️ taps.
- **Objects erased by an eraser stroke**: they come back with the ↩️ that takes back that stroke, because objects are part of the world that is captured.
- **Undoing a ⭐ stroke after the fire has spread**: the whole field goes back, so the spread goes back with it. There is no attempt to undo "just the stroke" and leave the consequences.
- **Undoing while weather is running**: mist, cloud, and rain go back to where they were, and they carry on rising, gathering, and raining from there. Nothing about the weather is left half-finished.
- **Undoing a stroke that made glitter with the ✨ wand**: the glitter goes back to plain grains exactly as they were.
- **Hammering ↩️ and ↪️ alternately as fast as a child can tap**: each tap is one step, the world stays valid, and the toy stays smooth.
- **More than ten actions**: the eleventh action silently pushes out the oldest remembered one. There is no warning and no visible change.
- **Undo, then draw, then undo again**: the new stroke is the top of the history, so the second ↩️ takes that back, and everything that was waiting to be redone is gone.
- **Rotating the tablet or phone**: the play field is re-derived under spec 006 and the history question is resolved in FR-022.
- **An in-progress action interrupted by a rotation**: the stroke ends cleanly under spec 006's FR-028 and counts as one completed action.
- **Reload**: nothing is persisted; the field opens empty and both buttons are dim.
- **All the edge cases from the pink-sand, water/dirt, rainbow/unicorn, landscape-scenes, sparkle-wand, phone-support, grass, star-power, and weather features** continue to apply unchanged, and now apply with undo and redo present as well.

## Requirements *(mandatory)*

This feature extends the existing toy specified in `001-falling-pink-sand`, `002-water-and-purple-dirt`, `003-rainbow-unicorn-magic`, `004-landscape-scenes`, `005-sparkle-magic-wand`, `006-phone-support`, `007-water-drinking-grass`, `008-star-power-burns-grass`, and `009-star-powered-weather`. All requirements of those specs remain in force except where explicitly superseded in the **Superseded requirements** section below.

Throughout: a **user action** is one of the four things listed in FR-005 — the unit that one tap of ↩️ takes back. A **world state** is everything the play field holds that outlives a frame: every cell's element and appearance and how far along it is in whatever it is doing, plus every placed 🌈 and 🦄. The **undo history** is the ordered list of world states captured before each recorded action; the **redo history** is the list of world states captured at each undo. **Restoring** a world state means putting the play field back to it.

### Functional Requirements

**Toolbar controls**

- **FR-001**: The toolbar MUST offer exactly two new controls — an **Undo** control (suggested ↩️) and a **Redo** control (suggested ↪️) — as large, round, emoji-labeled buttons in the same finger-size class and visual family as the existing controls, understandable without reading, reachable in one tap from the play state, with Undo before Redo. They MUST form their own visually grouped pair, distinct from the element brushes, the object tools, the eraser/clear/wand actions, the scene controls, and the brush sizes. [NEEDS CLARIFICATION: where in the toolbar should the undo/redo pair sit — immediately after the 🧽/🗑️/✨ actions group (rescue controls next to the accident), at the start of the toolbar before the element brushes, or at the end after the brush sizes?]
- **FR-002**: Undo and Redo MUST be action buttons like 🗑️ and the scene controls: tapping one MUST NOT change the selected drawing tool or brush size, and neither button may ever wear the "selected" look, so exactly one button — the active drawing tool — remains selected at any moment.
- **FR-003**: Each button MUST show, without words, whether there is anything to do: when its history is empty it MUST appear dimmed while keeping its full size, shape, and position, and tapping it MUST do nothing whatsoever — no message, dialog, sound, animation, or change to the world or the toolbar. Buttons MUST NOT be hidden, removed, shrunk, or moved when unavailable.
- **FR-004**: Adding the two controls MUST NOT push the toolbar out of the constraints of spec 006: with both new buttons present, every control MUST still be fully visible at once on a phone-sized viewport in both orientations, at or above the minimum touch target, with enough separation that a fingertip cannot activate two at once, without the page scrolling, without the toolbar overlaying the play area, and without shrinking the play area below its fill requirements.

**What counts as one action**

- **FR-005**: Exactly these four things MUST be recorded as one undoable user action each:
  1. one complete stroke with any painting tool (💗 sand, 💧 water, 💜 dirt, 🌱 grass, ⭐ star power, 🧽 eraser, ✨ wand), from pointer-down to pointer-up or pointer-cancel, however long or short the drag;
  2. one tap that places a 🌈 or 🦄 object;
  3. one tap of 🗑️ clear-all;
  4. one tap of a scene control (⬜, 🏔️, 🏝️).
- **FR-006**: Nothing else may create a history step. The simulation's own changes — falling, piling, water levelling, grass growing and drinking, star power burning and going out, fog rising, clouds gathering and raining, rainbow conversion, unicorn sparkles — MUST NOT be recorded as actions, and MUST NOT be undoable on their own.
- **FR-007**: An action that changes nothing in the world MUST NOT consume a history slot, so that every available ↩️ tap visibly changes something.
- **FR-008**: The world state recorded for an action MUST be the state as it stood immediately before that action's first change to the world, so that undoing it removes the action's effect and everything that followed from it.
- **FR-009**: If a stroke is still in progress when Undo or Redo is tapped, that stroke MUST be completed and recorded as one action before the tap takes effect, and MUST end cleanly with no brush left stuck on.

**Undo**

- **FR-010**: Tapping Undo MUST restore the play field to the world state recorded for the most recent recorded action, and MUST remove that action from the undo history. The restored field MUST be indistinguishable from the original in everything the child can see and in everything that determines what happens next: every cell's element, colour shade, glitter, and its progress through whatever it was doing, and every placed object's kind, size, and position.
- **FR-011**: Undo MUST NOT pause, slow, freeze, or restart the simulation: the world goes on running from the restored state in the very next frame.
- **FR-012**: Undo MUST behave identically for every tool, element, and recorded action kind, with no per-tool special cases in what the child experiences — including undoing a clear-all or a scene tap, which MUST bring back every element cell and every placed object that was there before.
- **FR-013**: Repeated Undo taps MUST step back one recorded action per tap, most recent first, until the undo history is empty, at which point the button is unavailable under FR-003.
- **FR-014**: Undo MUST NOT change the selected tool, the brush size, the sparkle caps, or anything else outside the play field's contents.

**Redo**

- **FR-015**: Each Undo MUST capture the world state as it stands at that moment onto the redo history before restoring, so that Redo puts back exactly what that Undo took away, including any settling that had happened since the action.
- **FR-016**: Tapping Redo MUST restore the most recently captured redo state, remove it from the redo history, and put the corresponding action back on the undo history, so undo and redo can be alternated any number of times. Repeated Redo taps MUST step forward one state per tap until the redo history is empty.
- **FR-017**: Recording any new user action (FR-005) MUST discard the entire redo history, after which the Redo button is unavailable under FR-003.
- **FR-018**: What Redo restores MUST NOT depend on how much time passed, how far the world settled, or how many frames ran between the Undo and the Redo.

**How much is remembered**

- **FR-019**: The undo history MUST hold at most the **10** most recent recorded actions. Recording an eleventh MUST silently drop the oldest, with no message and no visible change.
- **FR-020**: The redo history MUST hold at most as many states as there have been consecutive Undos since the last recorded action, and therefore never more than 10.
- **FR-021**: History MUST NOT be persisted. On page load both histories are empty and both buttons are dimmed.
- **FR-022**: When the play field is re-derived under spec 006 (a rotation or other viewport change that changes the field's dimensions in cells), the undo and redo histories MUST be discarded, leaving both buttons dimmed, rather than restoring a state of the wrong shape. [NEEDS CLARIFICATION: is silently dropping history on rotation acceptable, or should the remembered states be carried across the same best-effort, bottom-centre-anchored re-derivation the live field gets, so a rotation does not cost the child her rescue?]

**Interaction with existing features**

- **FR-023**: This feature MUST NOT add, remove, or change any element, simulation rule, scene, object behaviour, brush behaviour, or timing. A session in which Undo and Redo are never tapped MUST behave exactly as the previous release.
- **FR-024**: Undo and Redo MUST work on every world the toy can produce, with no per-element special case: pink sand, water, purple dirt, rainbow sand, grass at any height, star power fuelled or not, fog, cloud, glitter, and placed objects are all part of the captured state and all come back correctly.
- **FR-025**: This feature MUST NOT introduce any failure state, message, confirmation, score, way for the child to be wrong, sound, persistence, or any control beyond the two buttons of FR-001.
- **FR-026**: Transient decoration that does not outlive a frame — the sparkle particles and hearts that unicorns emit, the glitter flash pattern — need not be captured or restored, and MUST simply continue from the restored world without any visible glitch.

**Performance, memory, non-regression, and verification**

- **FR-027**: Recording a world state MUST NOT cause a hitch the child can see: the toy MUST stay smooth — target 60 frames per second, acceptable at or above 30 — on a mid-range laptop, a tablet, and a low-end tablet of the Amazon Fire 7 Kids class, at any play field size derived under spec 006, while drawing stroke after stroke on a full field with weather running, grass drinking, and a lawn burning.
- **FR-028**: The memory held by undo and redo history MUST stay within a budget that is safe on a low-end tablet at the largest play field spec 006 allows, and MUST NOT grow without bound. A full-fidelity capture of every cell's complete state at the 43,200-cell budget costs roughly 0.75 MB per state, so 10 undo plus 10 redo states cost roughly 15 MB. [NEEDS CLARIFICATION: is ~15 MB of history acceptable on a Fire 7 Kids-class tablet, or should the design trade fidelity or depth for memory — e.g. capture only what is visible and let in-flight timers (fog rise, cloud rain, burn life, grass cooldown) restart on restore, at roughly a quarter of the cost?]
- **FR-029**: Undo and redo MUST do no work per frame: nothing may be captured, compared, or copied except when a user action is recorded, undone, or redone, and the simulation's hot loop MUST remain allocation-free.
- **FR-030**: The production build MUST still emit exactly one self-contained page, fully playable when opened directly from disk with no network requests, and the page MUST NOT grow by more than 5 KB over the current release.
- **FR-031**: Existing behaviour MUST NOT regress: every element, object, tool, scene, and control MUST behave exactly as specified by the earlier specs, and all existing automated tests MUST pass — updated only where the superseded requirements below make an assertion obsolete, never weakened to hide a regression.
- **FR-032**: Keyboard shortcuts are optional. The implementation MAY bind Ctrl+Z to Undo and Ctrl+Y and Ctrl+Shift+Z to Redo. If bound, they MUST do exactly what the buttons do and MUST NOT be needed for any capability, MUST NOT interfere with touch or mouse drawing, and MUST NOT be required for any acceptance scenario.
- **FR-033**: The project MUST provide automated tests, runnable without a browser, covering at minimum: one stroke with each painting tool recorded and undone to a cell-for-cell identical world (FR-005, FR-010); object placement, clear-all, and each scene control recorded and undone including placed objects (FR-005, FR-012); simulation changes never recording an action (FR-006); a no-op action recording nothing (FR-007); the pre-action capture point, so that consequences that followed the action are rewound with it (FR-008); undo/redo round trips in both directions and repeated alternation (FR-015, FR-016, FR-018); a new action clearing the redo history (FR-017); the 10-action bound dropping the oldest silently (FR-019, FR-020); undo and redo doing nothing on empty histories (FR-003); history discarded or carried on re-derivation as FR-022 resolves; every element type and grass/star/fog/cloud in-flight state surviving a round trip (FR-024); the simulation continuing to advance identically from a restored state as from the original (FR-011); toolbar layout still fitting with the two extra controls at phone portrait and landscape sizes (FR-004); and that a session with no undo or redo produces byte-identical simulation behaviour to the previous release (FR-023, FR-031).

### Key Entities

- **User action**: One complete stroke, one object-placing tap, one clear-all tap, or one scene tap — the unit one ↩️ tap takes back.
- **World state**: Everything the play field holds that outlives a frame — every cell's element, shade, glitter, and in-flight progress, plus every placed 🌈 and 🦄 with its kind, size, and position. Not included: the selected tool, the brush size, and transient sparkle decoration.
- **Undo history**: Up to 10 world states, each captured immediately before a recorded action, most recent last.
- **Redo history**: Up to 10 world states, each captured at the moment of an Undo, discarded whenever a new action is recorded.
- **Undo control / Redo control**: The two new toolbar buttons, dimmed when their history is empty, never selected, never hidden.

### Superseded requirements

- Spec 009's **FR-027** ("this feature MUST NOT add any toolbar control … the toolbar MUST be exactly what spec 008 leaves it") and **SC-019** ("0 controls added") described spec 009's own scope, not a permanent freeze; they are superseded here by FR-001, which adds exactly two controls. Spec 009's requirement that all controls stay visible on a phone is retained and extended by FR-004.
- Spec 001's **FR-021** (the toolbar offers exactly sand, eraser, clear, and three brush sizes), spec 002's **FR-017**, and spec 003's **FR-001** — each already extended by specs 004, 005, 007, and 008 — are extended again, not replaced, by FR-001: the toolbar now also carries the Undo and Redo controls.
- The successive **caps on the number of on-screen controls** (spec 001's SC-006 cap of 6, spec 002's cap of 8, spec 003's cap of 10, retired in favour of a fit constraint by spec 004's FR-007) remain retired: the binding constraint is FR-004 — every control fully visible, finger-sized, and one tap away on a phone in both orientations.
- The toolbar-fit requirements of specs 002 (**FR-025**), 003 (**FR-034**), 004 (**FR-007**), 005 (**FR-005**), 006 (**FR-018**, **FR-020**, **FR-020a**, **FR-020b**, **FR-021**), 007 (**FR-024**), 008 (**FR-026**), and 009 (**FR-027**) are extended, not replaced: they must now hold with the Undo and Redo buttons present as well (FR-004).
- Spec 004's **FR-008**/**SC-017** (exactly one button wears the selected look, and it is always the active drawing tool) is unchanged and is explicitly preserved by FR-002: Undo and Redo are action buttons and never appear selected.
- Spec 002's **FR-003** and **SC-005**, and spec 003's **SC-005** (element counts and occupied-cell totals stay constant under the simulation with no drawing), are unaffected: undo and redo are child-initiated actions, not simulation rules, and the conservation statements of specs 007, 008, and 009 continue to describe the simulation only. Restoring a world state may change any count to a value it previously held.
- The constitution's product constraint that "new element types require a spec" is not engaged: this feature adds no element.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A 4–5 year old who has just drawn something she does not want can remove it with 1 tap, with no adult instruction and without reading anything.
- **SC-002**: After a stroke with any of the 7 painting tools, one Undo returns 100% of the play field's cells and 100% of placed objects to their pre-stroke state — 0 cells differ.
- **SC-003**: After a 🗑️ clear-all on a field containing every element type and at least one 🌈 and one 🦄, one Undo restores 100% of those cells and 100% of those objects; the same holds for each of the 3 scene controls.
- **SC-004**: Advancing the simulation N steps from a restored world state and from the original world state produces 0 differing cells, for N up to at least 600 steps — a restored world is not merely a picture, it behaves identically.
- **SC-005**: Undo and Redo change 0 aspects of the toolbar: the selected tool and brush size are unchanged in 100% of taps, and exactly 1 button wears the selected look at any moment.
- **SC-006**: Across any sequence of actions, undos, and redos, the undo history never holds more than 10 states and the redo history never holds more than 10.
- **SC-007**: Recording an 11th action drops exactly 1 state — the oldest — and produces 0 messages, 0 dialogs, and 0 visible changes.
- **SC-008**: An action that changes 0 cells and 0 objects records 0 history steps.
- **SC-009**: An action → undo → redo round trip returns the field to the pre-undo state with 0 differing cells and 0 differing objects, and this holds for at least 20 consecutive alternations.
- **SC-010**: Any new recorded action after an undo leaves the redo history holding 0 states, and tapping Redo then changes 0 cells.
- **SC-011**: Tapping a dimmed Undo or Redo 20 times in a row changes 0 cells, 0 objects, and 0 toolbar state, and produces 0 messages.
- **SC-012**: On a low-end tablet of the Amazon Fire 7 Kids class, drawing 10 strokes in a row on a full field with weather running and grass burning, the toy renders at least 30 frames per second throughout, targeting 60, and no single frame during a capture, undo, or redo takes longer than 2 frames' budget.
- **SC-013**: The measured per-frame simulation cost with a full undo and redo history is within 2% of the cost with empty histories — history costs nothing per frame.
- **SC-014**: Peak memory held by undo and redo history stays within the budget FR-028 settles on, at the largest play field spec 006 allows, and 0 unbounded growth is observed across a long play session of hundreds of actions.
- **SC-015**: On a phone-sized viewport, 100% of toolbar controls including the 2 new buttons remain fully visible at once in both orientations at or above the minimum touch target, with 0 pixels of page scroll, 0 controls overlapping the play area, and the play area still meeting spec 006's fill minimums.
- **SC-016**: The production build still produces exactly 1 output file, opening it directly from disk yields a fully playable toy with 0 network requests, and the page has grown by at most 5 KB.
- **SC-017**: A session in which Undo and Redo are never tapped produces 100% passing existing acceptance scenarios and automated tests, with changes limited to the assertions made obsolete by the superseded requirements above.
- **SC-018**: A child cannot reach any state through Undo or Redo that shows a message, a confirmation, an error, or a score — 0 such states exist — and 0 states exist from which she cannot go on drawing normally.
- **SC-019**: The automated test suite runs to completion without a browser and covers every rule listed in FR-033.

### Visual checks for the maintainer *(no automated coverage)*

- The ↩️ and ↪️ buttons read instantly as "take it back" and "put it back" to an adult, and are discoverable by a child who cannot read.
- The dimmed state reads as "not now" rather than as broken or missing.
- An undo looks like the mistake being lifted away, not like the picture flickering or jumping.
- Undoing the bin feels like a rescue — the picture reappearing is a happy moment, not a jarring one.
- The toolbar with 18 buttons still looks like a friendly set of big round buttons rather than a cramped strip, on a laptop, a tablet, and a phone in both orientations.
- Nothing about the pair invites the accidental taps that 🗑️ already risks — the grouping keeps them readable at a glance.
- On a Fire 7 tablet specifically: rapid drawing with a full history stays smooth in a small hand.

## Assumptions

- **Builds on the existing toy**: this feature assumes specs 001–009 are the base being extended, and adds no element, rule, or scene of its own.
- **Whole-world rewind, not per-tool surgery.** As the issue states, Undo puts the entire play field back rather than trying to remove one stroke's grains from a world that has moved on. This is the semantics an almost-5-year-old expects, and it is the only one that behaves sensibly with falling sand, spreading fire, and running weather.
- **Placed objects are part of the world.** The issue says "only grid contents", but the 🌈 and 🦄 she has placed are things she drew and things the bin takes away, so an undo that left them out would fail the headline rescue case. They are captured and restored with the field; the selected tool, the brush size, and transient sparkle decoration are not.
- **Scene taps are world-changing button taps** and are undoable for exactly the reason Clear is: a scene tap wipes the picture, and that is the same accident.
- **Capture happens at the start of an action**, not at its end, so a single ↩️ removes both the stroke and everything that followed from it — the spread of a fire, the settling of a pile, the mist a ⭐ raised.
- **No-op actions are not recorded** (FR-007), so a tap that did nothing never spends one of her ten steps and Undo never appears to do nothing when it is bright.
- **Redo is standard**: it restores what the last Undo took away, and any new action discards it. The issue asked for exactly this.
- **Depth is 10**, from the issue. It is enough to rescue a run of mistakes and small enough to bound memory on a cheap tablet.
- **The simulation never pauses** (FR-011), from the issue: the restored world simply carries on.
- **Keyboard shortcuts are optional** (FR-032), from the issue: the buttons are the interface, and the toy must stay fully playable by touch alone.
- **No persistence** (FR-021), from the issue: history resets on reload, consistent with the rest of the toy.
- **The toolbar has room.** This is the first feature since spec 006 to add controls, taking the toolbar from 16 to 18. Spec 006's layout wraps controls to more rows in portrait and to a longer rail in landscape, so the fit is expected to hold, but it is a real constraint and FR-004 makes it a gate: if the two buttons cannot fit at 44 px in both phone orientations without eating the play area, the layout must change rather than the buttons shrinking.
- **No sound, no persistence, no new settings**, consistent with the rest of the toy.
- **Target devices** are a mid-range laptop, a tablet, a mid-range phone, and a low-end tablet of the Amazon Fire 7 Kids class, which remains the binding performance and memory constraint. The 43,200-cell budget from spec 006 is unchanged.
- **Verification without a browser**: capture, restore, action recording, history bounds, and redo invalidation are all pure functions of world state and taps, so they are fully unit-testable; the visual and feel checks are the maintainer's job on a real device, consistent with the project's no-browser-harness principle.
