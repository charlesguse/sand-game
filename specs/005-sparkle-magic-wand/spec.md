# Feature Specification: Sparkle Magic Wand

**Feature Branch**: `spec-draft/005-sparkle-magic-wand`

**Created**: 2026-08-26

**Status**: Draft

**Input**: GitHub issue #5 — "Sparkle party: magic wand extra"

> A fun bonus if the essentials are done — a little extra magic:
>
> - ✨ **Magic wand** toolbar button: dragging over existing sand/dirt/water turns those grains into twinkling glitter versions of themselves — they keep their physics but sparkle (brief bright flashes on random grains, gentle color shimmer).
> - Dragging the wand over empty space sprinkles a light dusting of multicolored glitter that falls and settles like very fine sand.
> - A tiny celebration: when a unicorn gets glittered, it does an extra-big sparkle burst 🎉✨💖.
> - Must stay lightweight: sparkle effects capped and allocation-free in the hot loop, 60fps preserved.
> - Unit tests for the wand conversion rule.
>
> This is a stretch feature: keep it small and simple; if any part threatens performance or the schedule, cut that part rather than gold-plating.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Turn what she already drew into glitter (Priority: P1)

The child has a pile of pink sand, a puddle of water, and a hill of magic purple dirt on the screen. She taps the ✨ wand button and drags across her pile. Everywhere the wand passes, the grains keep being exactly what they were — pink sand is still pink sand, water is still water — but now they twinkle: individual grains flash bright for an instant and the colors shimmer gently, so the pile looks like it has been dusted with glitter. Nothing moves that would not have moved anyway. She can pour more sand on top, tip the pile over, or erase it, and the glittered grains behave exactly like the plain ones — they just sparkle while they do it.

**Why this priority**: This is the feature the issue leads with and the one it asks for unit tests on. It is the whole "magic wand" idea: a tool that changes how her world *looks* without taking anything away from her. Shipping only this already delivers the sparkle party.

**Independent Test**: Select the wand, drag it across a region containing each element, and confirm every covered element cell is marked glittered while its element type and its movement behavior are unchanged. Fully verifiable in automated tests against play-area state alone, with no browser; the twinkling itself is a maintainer eyeball check.

**Acceptance Scenarios**:

1. **Given** a play area with pink sand, water, magic purple dirt, and rainbow sand, **When** the child drags the wand across all of them, **Then** every covered grain is glittered and every covered grain is still the same element it was.
2. **Given** a glittered pile of pink sand, **When** the simulation advances, **Then** the grains fall, slide, and pile exactly as un-glittered pink sand does — same rules, same speed, same resulting shape.
3. **Given** a glittered grain that falls or slides to a new position, **When** it settles, **Then** the glitter has travelled with the grain: the grain it moved *from* is not glittered and the grain itself still is.
4. **Given** a glittered grain and a plain grain that swap places under the simulation's rules, **When** the swap completes, **Then** each keeps its own glittered or plain state — glitter belongs to the grain, never to the location.
5. **Given** an already-glittered region, **When** the child drags the wand over it again, **Then** nothing changes: the grains stay glittered exactly once, nothing is removed, and nothing is added.
6. **Given** any region, **When** the child drags the wand over it, **Then** no occupied cell is emptied, no occupied cell changes element type, and nothing is pushed out of the way.
7. **Given** the wand is selected, **When** the child drags quickly across the screen, **Then** the glitter follows the whole path of the drag with no gaps between pointer samples, exactly as the other brushes do.
8. **Given** the wand is selected, **When** the child changes the brush size, **Then** the wand covers the corresponding area, exactly as the element brushes do.
9. **Given** glittered grains on screen, **When** the child drags the 🧽 eraser over them, **Then** they are removed exactly as plain grains would be.
10. **Given** glittered grains on screen, **When** the child taps 🗑️ clear-all, **Then** the play area is completely empty, with no glitter state left behind anywhere.
11. **Given** a glittered pink-sand grain, **When** a 🌈 rainbow converts it to rainbow sand, **Then** it becomes rainbow sand *and stays glittered*.
12. **Given** the wand is selected, **When** the child taps a different tool, **Then** that tool becomes the active one and exactly one tool is shown as selected, exactly as the toolbar already behaves.

---

### User Story 2 - Sprinkle glitter into thin air (Priority: P2)

The child drags the wand across the empty sky above her pile. A light dusting of tiny multicoloured glitter grains appears under the wand — not a solid stripe of colour, just a scattering, like shaking a glitter pot. The specks fall gently, tumble down the sides of whatever they land on, and settle into a fine sparkly layer on top of her world. She can bury them, erase them, or let a rainbow catch them, and they behave like any other grain in the toy.

**Why this priority**: It makes the wand feel like a wand rather than a paint-over tool — she can *make* magic, not only decorate what is already there. It is a clearly separable slice: the wand is useful and shippable without it, which is what makes it the first thing to cut under the issue's "cut rather than gold-plate" instruction.

**Independent Test**: Drag the wand across an entirely empty region and confirm that some but not all covered cells become glitter grains, that the resulting grains fall and pile under the normal powder rules, and that they respond to the eraser, clear-all, rainbow conversion, and unicorn touch like every other element. Fully verifiable without a browser.

**Acceptance Scenarios**:

1. **Given** an empty region, **When** the child drags the wand across it, **Then** a scattering of glitter grains appears — strictly more than none and clearly fewer than a solid fill of the covered area.
2. **Given** a fresh dusting of glitter, **When** the child looks at it, **Then** the specks are multicoloured rather than all one colour.
3. **Given** glitter grains in mid-air, **When** the simulation advances, **Then** they fall, tumble off slopes, and settle into a resting layer under the same powder rules the other grains obey.
4. **Given** glitter grains resting on a pile, **When** the child pours pink sand on top of them, **Then** they are buried and behave normally underneath — nothing special happens and nothing is refused.
5. **Given** glitter grains on screen, **When** the child drags the eraser over them or taps 🗑️, **Then** they are removed exactly as any other grain is.
6. **Given** glitter grains next to a 🦄 unicorn, **When** they touch it, **Then** the unicorn celebrates exactly as it does for any other element touching it.
7. **Given** the wand is dragged over a region that is partly empty and partly full, **When** the drag lands, **Then** the occupied cells are glittered in place (User Story 1) and only the empty cells receive sprinkled grains — the two rules never fight over the same cell.
8. **Given** the child holds the wand still over one empty spot for several seconds, **When** she watches, **Then** glitter keeps trickling out and falling away rather than the toy freezing, stuttering, or filling the column solid in an instant.

---

### User Story 3 - Glitter the unicorn and get a party (Priority: P3)

The child drags the wand over her 🦄 unicorn. Instead of the small sparkle it makes when sand brushes against it, the unicorn throws an extra-big burst of 🎉 ✨ 💖 — clearly bigger and more exciting than anything else in the toy. It is a moment of pure celebration, and she can do it again whenever she likes.

**Why this priority**: It is the smallest piece of the request and the pure delight payoff, but the wand is complete and fun without it. It rides on the sparkle machinery the toy already has, so it is cheap — but it is still the last thing in and, after User Story 2, the next thing out if anything has to go.

**Independent Test**: Point the wand at a placed unicorn and confirm a celebration burst is emitted that is larger than the unicorn's ordinary touch celebration, that holding the wand there does not emit an unbounded stream, and that the total number of live sparkle glyphs never exceeds the existing cap. Verifiable without a browser by inspecting the sparkle-effect state.

**Acceptance Scenarios**:

1. **Given** a placed unicorn, **When** the child drags the wand over it, **Then** it emits a celebration burst noticeably bigger than its ordinary "something touched me" sparkle.
2. **Given** the wand is held over a unicorn without moving, **When** several seconds pass, **Then** the unicorn does not emit a continuous unbroken stream of bursts — repeat bursts are spaced out.
3. **Given** several unicorns on screen and a wand drag that crosses all of them, **When** the drag lands, **Then** each one that was crossed celebrates.
4. **Given** the maximum number of sparkle glyphs is already alive, **When** another burst is triggered, **Then** the oldest glyphs give way to the new ones and the total never grows past the cap.
5. **Given** a unicorn that has just celebrated from the wand, **When** the child erases it or taps 🗑️, **Then** it disappears exactly as it does today and its sparkles fade out normally.
6. **Given** a placed 🌈 rainbow, **When** the child drags the wand over it, **Then** the rainbow behaves exactly as this spec's FR-013 requires and, in particular, is never damaged, moved, or removed by the wand.

---

### Edge Cases

- **Wand over an object footprint**: rainbows and unicorns are objects, not grains. The wand never erases, moves, or resizes one. Beyond the unicorn's celebration burst, whether an object itself takes on a glittered look is FR-013's open question.
- **Wand over a region that is entirely empty**: nothing is converted; only the sprinkle rule applies, so the child always gets *some* visible result from a wand drag anywhere on the play area.
- **Wand over a region that is entirely full**: nothing is sprinkled; every covered grain is glittered in place, and the pile does not grow by a single cell.
- **Wanding the same spot over and over**: glittering is idempotent, so a full screen of glitter is the ceiling — repeated passes cannot pile up extra state, extra cost, or extra sparkle beyond the cap.
- **The entire play area glittered**: this is the worst case for the sparkle effect and the toy must still hold its frame-rate target, with the number of simultaneous flashes capped rather than growing with the number of glittered grains.
- **Glitter at the play-area edge**: the wand behaves like every other brush — coverage is clipped at the boundary, nothing wraps, and nothing is written outside the play area.
- **Pointer leaving the window mid-drag**: identical to existing brush behavior; the stroke ends and no glitter is applied outside the play area.
- **Resize or rotation**: the existing preserve-contents-on-resize behavior applies unchanged — glittered grains stay glittered and glitter grains keep their positions in the preserved contents.
- **Loading a scene, or 🗑️ clear-all**: clears glitter along with everything else. No glittered grain, glitter grain, or sparkle effect survives into the new contents.
- **Page reload**: nothing is persisted; the toy opens plain and empty exactly as it does today.
- **Glitter meeting a rainbow**: a glittered grain converted to rainbow sand stays glittered (FR-009). A sprinkled glitter grain is converted like any other element the rainbow catches.
- **All the edge cases from the pink-sand, water/dirt, rainbow/unicorn, and landscape-scenes features** continue to apply unchanged to glittered contents.

## Requirements *(mandatory)*

This feature extends the existing toy specified in `001-falling-pink-sand`, `002-water-and-purple-dirt`, `003-rainbow-unicorn-magic`, and `004-landscape-scenes`. All requirements of those specs remain in force except where explicitly superseded in the **Superseded requirements** section below.

### Functional Requirements

**The wand tool**

- **FR-001**: The toolbar MUST offer a ✨ magic wand control that becomes the active drawing tool when tapped, participating in the existing "exactly one drawing tool is selected at a time" rule alongside the element brushes, the object tools, and the eraser.
- **FR-002**: The wand control MUST be a large, round, emoji-labeled button of the same finger-size class as the existing controls, understandable without reading, and reachable in a single tap from the play state on both a laptop and a tablet.
- **FR-003**: The wand MUST be used by press-and-drag with mouse and with touch, painting continuously along the whole path of the drag, with no gaps between pointer samples on a fast drag — identical in feel to the existing brushes.
- **FR-004**: The wand MUST honor the currently selected brush size, covering the same area an element brush of that size covers.
- **FR-005**: The toolbar with the wand added MUST still fit on screen without the page scrolling on both a laptop and a tablet, and every control MUST remain finger-sized and one tap away.

**The conversion rule** *(the behavior the issue asks to unit-test)*

- **FR-006**: For every cell within the wand's coverage that holds an element — pink sand, water, magic purple dirt, or rainbow sand — the wand MUST mark that cell glittered and MUST leave its element type unchanged.
- **FR-007**: A glittered grain MUST behave identically to the same un-glittered element in every respect other than appearance: same falling, sliding, flowing, and piling rules; same interaction with every other element; same response to the eraser, to clear-all, and to scene loading; same effect when it touches a unicorn or is caught by a rainbow.
- **FR-008**: Glitter MUST be a property of the grain, not of the location. When a grain moves, falls, or swaps places under the simulation's rules, its glittered state MUST travel with it, and the cell it vacated MUST NOT retain glitter.
- **FR-009**: Glitter MUST survive element transformation: when a glittered grain is converted into another element by an existing rule (for example, a rainbow converting it to rainbow sand), the resulting grain MUST still be glittered.
- **FR-010**: Glittering MUST be idempotent — applying the wand to an already-glittered grain MUST leave it in exactly the same state, with no accumulation of any kind.
- **FR-011**: The wand MUST NOT empty an occupied cell, MUST NOT change an occupied cell's element type, and MUST NOT displace, push, or move any existing grain. It is purely additive to appearance.
- **FR-012**: Glitter MUST be removable exactly as its underlying grain is: erasing the grain, clearing all, or loading a scene MUST leave no glitter state behind. Glitter MUST NOT be persisted across a page reload.
- **FR-013**: The wand's effect on the play area's *objects* (placed 🌈 rainbows and 🦄 unicorns) MUST be [NEEDS CLARIFICATION: does the wand give an object a lasting glittered appearance, or does passing over an object do nothing to the object itself beyond the unicorn's celebration burst in FR-018? Objects are drawn as emoji glyphs rather than grains, so a lasting look for them is a separate visual treatment from the grain shimmer]. In every reading, the wand MUST NOT damage, move, resize, or remove an object.
- **FR-014**: How long a grain stays glittered MUST be [NEEDS CLARIFICATION: is glitter permanent for the life of the grain — removable only by erasing or clearing it — or does it fade back to plain after a few seconds, so the sparkle stays special and the whole screen cannot end up permanently glittered?]. Either way, the rule MUST be the same for every element and MUST NOT depend on where the grain is or what it is resting on.

**Sprinkling glitter into empty space**

- **FR-015**: For cells within the wand's coverage that are empty, the wand MUST sprinkle a light dusting of glitter grains: strictly more than zero grains per pass over an empty region, and no more than one third of the covered empty cells, so that the result reads as a scattering rather than a solid fill.
- **FR-016**: Sprinkled glitter grains MUST fall and settle like a fine powder — obeying the same falling, tumbling, and piling family of rules as the toy's other powders — and MUST be multicoloured, with individual grains differing in colour rather than all sharing one.
- **FR-017**: What a sprinkled glitter grain *is* MUST be [NEEDS CLARIFICATION: is it a new element type of its own — "glitter dust", a finer powder with its own identity — or is it the toy's existing rainbow sand placed in an already-glittered state, adding no new element type? The constitution's product constraints keep the element set deliberately small and require a spec for any new element type, which this spec would be]. Whichever it is, the grain MUST be fully interactive: erasable, clearable, subject to gravity, able to trigger a unicorn's celebration, and convertible by a rainbow, exactly like every other element.

**The unicorn celebration**

- **FR-018**: When the wand's coverage reaches a placed 🦄 unicorn, that unicorn MUST emit a celebration burst that is visibly larger than its existing "an element is touching me" celebration — more glyphs, drawn from 🎉 ✨ 💖.
- **FR-019**: Repeat wand bursts on one unicorn MUST be spaced out rather than continuous: holding or slowly dragging the wand over a unicorn MUST NOT emit a burst on every frame.
- **FR-020**: Every unicorn the wand's coverage reaches during a drag MUST celebrate, not only the first.
- **FR-021**: Wand bursts MUST obey the toy's existing cap on live sparkle glyphs; when the cap is reached, the oldest glyphs MUST give way rather than the total growing.

**Performance, safety, and verification**

- **FR-022**: The number of simultaneous sparkle flashes on glittered grains MUST be capped at a fixed maximum that does not grow with the number of glittered grains. With every cell in the play area glittered, the toy MUST show no more flashes at once than that cap.
- **FR-023**: The per-frame work of the simulation, the glitter effect, and rendering MUST allocate nothing in the hot loop, matching the existing hot path's constraint.
- **FR-024**: With the entire play area glittered and elements in motion, the toy MUST stay smooth (target 60fps, acceptable ≥30fps) at the default play-area size on a mid-range laptop and a tablet.
- **FR-025**: No interaction in this feature MUST produce a failure state, a message, a confirmation, a sound requirement, a score, or any way for the child to be "wrong". The wand can be used anywhere, any number of times, and is never refused.
- **FR-026**: Existing behavior MUST NOT regress: with the wand never selected, every existing element, object, tool, scene, and control MUST behave exactly as it does today, and all existing automated tests MUST pass unchanged.
- **FR-027**: The project MUST provide automated tests, runnable without a browser, covering at minimum: the conversion rule marking every covered element cell glittered while leaving its element type unchanged (FR-006); each element type being glittered rather than only pink sand; glitter travelling with a grain that moves and not staying at the vacated cell (FR-008); glitter surviving rainbow conversion (FR-009); idempotency of repeat wand passes (FR-010); the wand neither emptying, retyping, nor displacing any occupied cell (FR-011); a wand pass over an all-empty region producing more than zero and no more than one third of the covered cells as glitter grains (FR-015); a wand pass over a mixed region glittering the occupied cells and sprinkling only into the empty ones (US2 scenario 7); and erase/clear-all leaving no glitter state behind (FR-012).
- **FR-028**: The production build MUST still emit exactly one self-contained page, fully playable when opened directly from disk with no network requests.

### Key Entities

- **Glittered state**: A per-grain "this grain sparkles" property carried alongside a grain's element type. It changes appearance only and travels with the grain.
- **Glitter grain**: The multicoloured speck the wand sprinkles into empty space. It falls and settles like a very fine powder. Its identity — a new element or an already-glittered existing one — is FR-017's open question.
- **Wand coverage**: The set of play-area cells a wand press or drag touches, defined by the current brush size and interpolated along the drag path in the same way the existing brushes are.
- **Sparkle flash**: A brief bright highlight shown on a glittered grain. Flashes are chosen from the glittered grains and capped in number (FR-022); they are a rendering effect and hold no simulation state.
- **Celebration burst**: The group of 🎉 ✨ 💖 glyphs a unicorn emits. This feature adds a larger variant triggered by the wand, reusing the toy's existing burst mechanism and its cap.

### Superseded requirements

- The landscape-scenes spec's toolbar constraint (its FR-007, "the toolbar fits on screen without page scrolling with all controls present") is extended, not replaced: it now must hold with the wand button added as well (FR-005).
- The rainbow/unicorn spec's characterisation of the unicorn celebration as a single fixed burst size is superseded to the extent that a second, larger wand-triggered burst now exists (FR-018). The ordinary touch celebration is unchanged.
- The constitution's product constraint that new element types require a spec is satisfied by this spec *if and only if* FR-017 resolves to a new "glitter dust" element; if it resolves to reusing rainbow sand, the element set is unchanged.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A 4–5 year old can turn a pile she drew into sparkling glitter within 10 seconds of being shown the ✨ button, with no adult instruction and without reading anything.
- **SC-002**: A wand drag over a region containing every element type leaves 100% of the covered element cells glittered and 0% of them changed in element type.
- **SC-003**: Advancing the simulation on a glittered pile and on an identical plain pile produces identical arrangements — 0 differing cells — confirming glitter has no effect on physics.
- **SC-004**: After grains move, 100% of the glitter is on the grains that carried it and 0 vacated cells retain glitter.
- **SC-005**: Repeating a wand pass over the same region any number of times produces a state identical to a single pass — 0 differing cells and 0 growth in any count.
- **SC-006**: A wand pass never removes or retypes an occupied cell — 0 cells emptied, 0 element types changed, 0 grains displaced.
- **SC-007**: A wand pass over an all-empty region produces at least 1 glitter grain and at most one third of the covered cells as glitter grains, and the resulting grains carry more than one distinct colour.
- **SC-008**: 100% of sprinkled glitter grains respond to gravity, the eraser, clear-all, rainbow conversion, and unicorn celebration exactly as existing elements do — 0 behavioral differences.
- **SC-009**: A wand pass across N unicorns triggers exactly N celebrations, each visibly larger than the ordinary touch celebration, and holding the wand on one unicorn for 5 seconds produces a small, bounded number of bursts rather than one per frame.
- **SC-010**: The number of live sparkle glyphs never exceeds the existing cap, and the number of simultaneous sparkle flashes never exceeds its fixed cap, no matter how much of the play area is glittered.
- **SC-011**: With 100% of the play area glittered and elements in motion, the toy renders at least 30 frames per second, targeting 60, on a mid-range laptop and a tablet.
- **SC-012**: The per-frame hot path allocates nothing while the wand's effects are active — measured the same way the existing hot path's allocation-free requirement is.
- **SC-013**: Erasing or clearing glittered contents leaves exactly 0 glittered cells, 0 glitter grains, and 0 orphaned glitter state.
- **SC-014**: A play area in which the wand was never selected behaves identically to the previous release — all existing acceptance scenarios and automated tests pass unchanged.
- **SC-015**: A child cannot reach any state that shows a message, a confirmation, an error, or a score through the wand — 0 such states exist.
- **SC-016**: The automated test suite runs to completion without a browser and asserts the conversion rule, per-element coverage, glitter travelling with moving grains, survival through rainbow conversion, idempotency, non-destructiveness, sprinkle density bounds, mixed-region behavior, and clean removal.
- **SC-017**: The toolbar with the wand added still fits on screen with no page scrolling on both a laptop and a tablet, and every control remains a single tap away.
- **SC-018**: A production build still produces exactly one output file, and opening that file directly from disk yields a fully playable toy with zero network requests.

### Visual checks for the maintainer *(no automated coverage)*

- Glittered pink sand still reads as *pink sand* at a glance — the shimmer decorates the colour rather than washing it out or turning everything the same colour.
- The flashes look like glitter catching the light: brief, bright, scattered across random grains, never a uniform pulse where the whole pile blinks together.
- The gentle colour shimmer is pretty rather than strobing or nauseating; a large glittered area is comfortable to look at for a long time.
- The sprinkled dusting looks like glitter shaken from a pot — scattered specks of different colours, not a coloured stripe under the wand.
- The specks fall lightly and settle into a convincing fine layer rather than dropping like heavy sand.
- The unicorn's wand burst is unmistakably the biggest, most exciting thing in the toy, and does not become annoying when repeated.
- The wand button reads as "make magic" next to the element brushes, and the toolbar still looks like a friendly row of big round buttons.
- Dragging the wand over a big pile feels instant and smooth — no stutter as more and more of the screen becomes glittered.

## Assumptions

- **Builds on the existing toy**: this feature assumes `001-falling-pink-sand`, `002-water-and-purple-dirt`, `003-rainbow-unicorn-magic`, and `004-landscape-scenes` are the base being extended — grid, canvas, drawing, brush sizes, eraser, clear-all, rainbow and unicorn objects, sparkle particles and their cap, scenes, resize handling, build, and test setup. All of their constraints (single self-contained page, no reading required, no failure states, mouse and touch) continue to apply.
- **This is explicitly a stretch feature**: the issue says to ship it only once the essentials are done, and to cut parts rather than gold-plate. This spec's cut order is the reverse of its user-story priorities: if something must go, **User Story 3 (unicorn burst) goes first, then User Story 2 (sprinkling into empty space)**. User Story 1 — the wand converting existing grains, with its unit tests — is the feature; if that cannot be done within the performance budget, the whole feature is dropped rather than shipped degraded.
- **Glitter is appearance only**: "they keep their physics but sparkle" is read strictly — glittering changes nothing about how a grain moves or interacts (FR-007). This is what makes the conversion rule cheaply testable and what guarantees the feature cannot regress the sim.
- **Glitter applies to every element the toy has**, not only the three named in the issue: pink sand, water, magic purple dirt, *and* rainbow sand. The issue's "sand/dirt/water" is read as "the grains on screen"; excluding rainbow sand would be an arbitrary hole a child would find immediately.
- **The wand is an ordinary drawing tool**, not a momentary action like 🗑️ or the scene buttons: it is selected, then used by dragging, so it takes part in the existing one-selected-tool rule and honors brush size (FR-001, FR-004).
- **Glitter travels with the grain, not the cell** (FR-008). The alternative — glitter staying where it was painted — would make a glittered pile smear into a static glitter stencil the moment anything fell, which is not what "glitter versions of themselves" means.
- **Glitter survives rainbow conversion** (FR-009). Losing the sparkle when a rainbow catches a grain would read as the toy taking her magic away.
- **Sparkle flashes are a capped rendering effect, not simulation state** (FR-022): the toy picks a bounded number of glittered grains to flash each frame rather than tracking a timer per grain. This is what keeps the cost flat as more of the screen is glittered, which the issue requires.
- **Wand bursts reuse the existing sparkle-particle mechanism and its cap** (FR-021); the wand adds a bigger burst, not a second particle system.
- **"Light dusting" is given testable bounds** (FR-015: more than zero, at most one third of covered empty cells) so the sprinkle density can be asserted without a browser. Where the density lands inside those bounds is a tuning choice for the implementer.
- **No sound**, consistent with the rest of the toy.
- **No undo and nothing persisted**: glitter cannot be un-glittered by the wand (the eraser and clear-all are the ways to remove it), and nothing survives a page reload.
- **Target devices unchanged**: a mid-range laptop with mouse/trackpad and a tablet with touch; phone-sized screens are not a target.
