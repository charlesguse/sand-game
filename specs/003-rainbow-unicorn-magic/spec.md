# Feature Specification: Rainbow and Unicorn Magic

**Feature Branch**: `spec-draft/003-rainbow-unicorn-magic`

**Created**: 2026-08-26

**Status**: Draft

**Input**: GitHub issue #3 — "Rainbow and unicorn magic"

> The star attractions for a girl who loves rainbows and unicorns — two placeable emoji objects with simple but magical interactions:
>
> - 🌈 **Rainbow**: a toolbar button; tapping the canvas stamps a rainbow emoji there (a few can exist at once). When falling sand or water lands on a rainbow, the rainbow turns it into **rainbow sand** — grains that keep sand physics but cycle/shimmer through rainbow colors as they fall and settle into rainbow-striped piles.
> - 🦄 **Unicorn**: a toolbar button; tapping the canvas places a unicorn emoji that stands on the ground/piles. When sand or water touches the unicorn, it responds with delight: a burst of sparkles ✨ and little hearts 💖 that float up and fade. Every so often the unicorn can emit a few sparkles on its own so it always feels alive.
> - Objects are solid-ish: falling grains land on top of them rather than passing through.
> - The eraser removes rainbows/unicorns it touches; 🗑️ clear-all removes everything.
> - Emoji are rendered as real glyphs (🌈 🦄 ✨ 💖) — no custom artwork.
> - Interactions must be forgiving and delightful, never punishing; no sound required.
> - Keep 60fps; sparkle/heart particles must be lightweight and capped.
> - Vitest coverage for the rainbow-conversion rule (grain touching rainbow zone becomes rainbow sand) and for grains landing on solid objects.
>
> Existing sand/water/dirt behavior must not regress.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Stamp a rainbow and make rainbow sand (Priority: P1)

The child taps the 🌈 button, then taps somewhere in the play area. A rainbow appears right there and stays put. She switches back to 🩷 pink sand and pours a stream down onto the rainbow. The grains that touch the rainbow come out the other side changed: they are rainbow-colored now, and they keep falling and piling exactly the way sand always does, shimmering through rainbow colors on the way down and then settling into a bright multi-colored heap on and around the rainbow. Water poured onto the rainbow gets turned into rainbow sand too — it stops flowing and starts piling. She can put down up to three rainbows and run sand through all of them.

**Why this priority**: The rainbow is the headline of this request and the one interaction that changes what is on screen. Shipping only the rainbow already gives the child a brand-new magical toy on top of the sand she has.

**Independent Test**: Place a rainbow, pour pink sand onto it, and confirm the grains that touch it come away rainbow-colored and then fall and pile like ordinary sand. The conversion rule and the resulting grains' movement are fully verifiable in automated tests against grid state alone, with no browser.

**Acceptance Scenarios**:

1. **Given** the 🌈 tool is selected, **When** the child taps a spot in the play area, **Then** one rainbow object appears centered on that spot and remains there until it is erased, cleared, or displaced as the oldest rainbow at the cap (FR-005).
2. **Given** three rainbows are already on screen, **When** the child taps to place a fourth, **Then** the new rainbow appears where she tapped and the rainbow she placed first silently disappears, with no message and no refused tap; the unicorns on screen are unaffected.
3. **Given** a rainbow is on screen, **When** a pink-sand grain moves into a cell touching the rainbow, **Then** that grain becomes rainbow sand.
4. **Given** a rainbow is on screen, **When** a water cell moves into a cell touching the rainbow, **Then** it becomes rainbow sand — it stops behaving like a liquid and starts falling and piling like a powder.
5. **Given** a magic-purple-dirt grain touches a rainbow, **When** the simulation advances, **Then** it becomes rainbow sand, exactly as pink sand does.
6. **Given** a grain that has already become rainbow sand, **When** it touches the same or another rainbow again, **Then** it stays rainbow sand and nothing else happens.
7. **Given** rainbow sand on screen, **When** the simulation advances, **Then** it falls, slides diagonally, piles with sloped sides, and sinks through water exactly as pink sand does.
8. **Given** a rainbow-sand grain that is still falling, **When** the simulation advances, **Then** its color cycles through the rainbow so the grain shimmers on the way down.
9. **Given** a rainbow-sand grain that has come to rest, **When** the simulation advances and nothing disturbs it, **Then** its color stays fixed at the hue it had when it settled — a settled heap does not flicker.
10. **Given** sand pouring steadily onto a rainbow, **When** the simulation runs, **Then** the resulting pile is visibly multi-colored — the rainbow colors read as stripes or bands through the heap rather than one flat color.
11. **Given** two or more rainbows on screen, **When** sand falls through all of them, **Then** each one converts the grains that touch it, independently of the others.
12. **Given** a rainbow with no sand or water near it, **When** the simulation advances, **Then** nothing changes — a rainbow never creates grains on its own.

---

### User Story 2 - Place a unicorn and delight it (Priority: P2)

The child taps the 🦄 button and taps the play area. A unicorn appears and stands there. When she pours sand or water so that it touches the unicorn, the unicorn is delighted: a little burst of ✨ sparkles and 💖 hearts pops out around it and floats gently upward, fading away. Nothing breaks, nothing is lost — the sand just piles up around the unicorn as usual. Even when she leaves it alone, the unicorn twinkles a few sparkles now and then, so it always looks alive.

**Why this priority**: The unicorn is the second star attraction and pure joy, but it changes nothing about the sand itself, so it can ship after the rainbow.

**Independent Test**: Place a unicorn, pour sand onto it, and confirm a sparkle-and-heart burst appears and floats up and fades; then leave the play area untouched and confirm the unicorn still emits occasional sparkles. Verified by watching the toy; the reaction trigger (grain touching the unicorn's zone) is verifiable in automated tests against grid state.

**Acceptance Scenarios**:

1. **Given** the 🦄 tool is selected, **When** the child taps a spot in the play area, **Then** one unicorn object appears at that spot and remains there until it is erased, cleared, or displaced as the oldest unicorn at the cap (FR-005).
2. **Given** three unicorns are already on screen, **When** the child taps to place a fourth, **Then** the new unicorn appears where she tapped and the unicorn she placed first silently disappears, with no message and no refused tap; any particles it had already emitted finish floating up and fade out normally, and the rainbows on screen are unaffected.
3. **Given** a unicorn is on screen, **When** a grain of any powder or a water cell moves into a cell touching the unicorn, **Then** a burst of ✨ sparkles and 💖 hearts appears around the unicorn.
4. **Given** a burst has appeared, **When** a moment passes, **Then** the particles drift upward and fade out completely, leaving no trace.
5. **Given** a unicorn that nothing is touching, **When** the child watches it without doing anything, **Then** it emits a few sparkles on its own every so often.
6. **Given** a heavy continuous stream of sand pouring onto a unicorn, **When** the simulation runs, **Then** the unicorn keeps celebrating but the number of particles on screen stays bounded and the toy stays smooth.
7. **Given** sparkles and hearts are floating over the play area, **When** they pass over sand, water, or another object, **Then** they change nothing — no grain is created, destroyed, moved, or recolored by a particle.
8. **Given** several unicorns are on screen, **When** sand touches each of them, **Then** each celebrates independently.
9. **Given** a unicorn buried under a heap of sand, **When** the simulation runs, **Then** nothing bad happens — the unicorn is still there, still reacts, and reappears when the sand is erased.

---

### User Story 3 - Objects are solid ground (Priority: P2)

The child discovers that the rainbow and the unicorn are things she can build on. Sand poured over a rainbow does not fall through it — it lands on top and stacks up. Water poured onto a unicorn puddles on its back and spills off the sides instead of leaking through. She can stamp a rainbow in mid-air and use it as a shelf, catching a pile of sand above empty space.

**Why this priority**: Solidity is what makes the objects feel like real things in the world rather than stickers, and it is required for the rainbow's conversion to look like sand "landing on" it. It rides along with both objects.

**Independent Test**: Place an object in mid-air, pour sand onto it, and confirm the grains rest on top and form a pile rather than passing through. Fully verifiable in automated tests against grid state, with no browser.

**Acceptance Scenarios**:

1. **Given** an object (rainbow or unicorn) is on screen, **When** a falling grain reaches the cell directly above the object, **Then** the grain stops there instead of entering the object.
2. **Given** a grain resting on top of an object with empty space diagonally below it, **When** the simulation advances, **Then** the grain slides off the shoulder of the object exactly as it would slide off a pile of sand.
3. **Given** an object placed in mid-air, **When** sand is poured onto it, **Then** a pile builds up on top of it, supported by the object, with empty space still underneath.
4. **Given** an object sitting on top of a pile of sand, **When** the pile beneath it is erased or falls away, **Then** the object stays exactly at the cells where it was placed and does not drop — objects never move on their own.
5. **Given** water poured onto an object, **When** the simulation advances, **Then** the water rests on top and spreads off the sides rather than passing through it.
6. **Given** an object, **When** any element moves anywhere in the play area, **Then** no cell inside the object's footprint is ever occupied by sand, dirt, or water.
7. **Given** the child places an object where sand or water already sits, **When** the object appears, **Then** the elements inside its footprint are simply cleared away to make room — the placement always succeeds and nothing is refused.

---

### User Story 4 - Erase and clear objects (Priority: P3)

The child changes her mind. She picks the 🧽 eraser and drags it across a rainbow, and the rainbow disappears — along with whatever sand she drags over. Tapping 🗑️ wipes the whole play area: sand, water, dirt, rainbow sand, rainbows, unicorns, and any sparkles still floating.

**Why this priority**: Cleanup has to cover the new objects or the play area fills up with rainbows she cannot get rid of, but it is the smallest slice and depends on the objects existing first.

**Independent Test**: Place a rainbow and a unicorn, drag the eraser over each, and confirm both disappear; then place several again and tap 🗑️ and confirm the play area is completely empty.

**Acceptance Scenarios**:

1. **Given** a rainbow or a unicorn is on screen, **When** the child drags the 🧽 eraser so the brush touches it, **Then** the whole object disappears — not a partial bite out of it.
2. **Given** an object with sand piled on it, **When** the object is erased, **Then** the sand that was resting on it is released and falls normally.
3. **Given** rainbows, unicorns, all element types, and floating particles are on screen, **When** the child taps 🗑️, **Then** every one of them is removed immediately and the play area is empty.
4. **Given** the child has erased everything, **When** she taps 🌈 or 🦄 and taps the play area again, **Then** new objects can be placed exactly as before.
5. **Given** any object tool is selected, **When** the child taps 🗑️, **Then** the selected tool and brush size are unchanged.

---

### Edge Cases

- **Tapping near the edge of the play area with an object tool**: the object is nudged fully inside the play area rather than being clipped in half or refused; it always appears whole.
- **The object cap is already reached**: the tap still works. The new object appears where she tapped and the oldest object of that same type silently vanishes (FR-005), so the button never feels dead. Sand that was resting on the vanished object is released and falls, exactly as if it had been erased.
- **An object left floating with nothing beneath it**: objects never fall, so a rainbow stamped in the sky, or one whose supporting pile is erased away, simply stays put as a solid shelf (FR-007). This is a deliberate toy, not a glitch.
- **Placing an object on top of an existing object**: allowed; the footprints simply overlap and both objects remain solid and active. Nothing is destroyed and nothing is refused.
- **A grain converted by a rainbow while it is inside another rainbow's zone**: it becomes rainbow sand once; a second conversion is a no-op.
- **Water sealed against a rainbow**: the water cells touching the rainbow turn to rainbow sand and stop flowing; the rest of the body of water continues to behave as water.
- **A whole pool poured onto a rainbow**: only the cells that actually touch the rainbow convert; the pool is not converted all at once from a distance.
- **Rainbow sand touching a unicorn**: the unicorn celebrates, exactly as it does for any other element.
- **A unicorn completely buried**: it keeps reacting to grains touching it and keeps emitting idle sparkles, but the sparkles may be hidden under the sand — that is fine, nothing is broken.
- **Many objects celebrating at once**: the total number of particles on screen is capped; the oldest or lowest-value particles are dropped rather than letting the frame rate fall.
- **An object erased while its particles are still in the air**: the particles finish floating up and fade out normally; they do not vanish jarringly or leave artifacts.
- **Rapid repeated taps with an object tool**: each tap places exactly one object and never more than 3 of that type survive; the oldest keeps rolling off, so the play area holds at most the three most recent of each kind. Nothing stutters or piles hundreds of emoji on one spot.
- **All the edge cases from the pink-sand and water/dirt features** (drawing at the play-area edge, fast drags, pointer leaving the window, resize/rotation, page reload) continue to apply unchanged and now apply to objects too: after a resize or rotation, objects stay on the same grid cells they occupied.

## Requirements *(mandatory)*

This feature extends the existing toy specified in `001-falling-pink-sand` and `002-water-and-purple-dirt`. All requirements of those specs remain in force except where explicitly superseded in the **Superseded requirements** section below.

### Functional Requirements

**Emoji objects: placement and lifecycle**

- **FR-001**: The toolbar MUST offer two object tools: 🌈 rainbow and 🦄 unicorn, alongside the existing element tools, eraser, clear-all, and brush sizes.
- **FR-002**: With an object tool selected, a single press in the play area MUST place exactly one object of that type, centered on the pressed position. Object tools MUST NOT pour continuously: holding the press still, or dragging, MUST NOT place a stream of objects.
- **FR-003**: Each object MUST occupy a fixed, contiguous footprint of grid cells, large enough for its emoji glyph to be clearly recognizable at the default play-area size, and MUST stay at the cells it occupies until it is erased or cleared.
- **FR-004**: An object placed near a boundary MUST be repositioned so its whole footprint lies inside the play area; object placement MUST never be refused, clipped, or produce any message.
- **FR-005**: The toy MUST allow up to **3 rainbows and 3 unicorns** on screen at the same time. When the child places an object of a type that is already at its cap, the **oldest object of that same type MUST silently disappear** to make room, so the new object always appears where she tapped. The tap MUST always visibly do something; it MUST NOT be ignored, refused, or accompanied by any message. Removing the oldest object MUST behave exactly like erasing it (FR-012): its cells become empty and anything resting on it resumes falling. Reaching the cap for one type MUST NOT affect the other type's count.
- **FR-006**: Placing an object MUST clear any sand, dirt, water, or rainbow sand occupying its footprint, so the object always appears whole. Placing an object overlapping an existing object MUST be permitted, with both objects remaining present and active.
- **FR-007**: Objects MUST NOT be affected by the simulation's gravity rules for elements. An object MUST stay exactly at the cells where it was placed — including in mid-air over empty space, where it acts as a floating solid shelf — and MUST NOT fall, settle, or re-settle when the elements beneath it change or are removed.
- **FR-008**: Objects MUST persist across resize and rotation, keeping the same grid cells, in line with the existing preserve-contents-on-resize requirement.

**Objects are solid**

- **FR-009**: No cell inside an object's footprint MUST ever be occupied by any element. Falling and flowing elements MUST treat object footprints as blocked, the same way they treat the floor and the walls.
- **FR-010**: A grain blocked from below by an object MUST apply the normal slide rule — sliding diagonally off the object's shoulders into available cells, so piles form on objects with sloped sides rather than single-cell towers.
- **FR-011**: Water blocked from below by an object MUST rest on it and spread sideways off it under the normal water rules; water MUST NOT pass through an object.
- **FR-012**: When an object is removed (by eraser, by clear-all, or by being the oldest of its type displaced at the cap under FR-005), the cells it occupied MUST become ordinary empty cells, and any elements resting on it MUST resume falling on the next simulation step.

**The rainbow's magic**

- **FR-013**: Each rainbow MUST define a conversion zone consisting of the cells immediately surrounding its footprint (the cells an element can reach while touching it).
- **FR-014**: On each simulation step, any cell holding pink sand, magic purple dirt, or water that lies within a rainbow's conversion zone MUST be converted to **rainbow sand**.
- **FR-015**: Conversion MUST preserve the cell — the element changes type in place; nothing is created, destroyed, or moved by the conversion itself.
- **FR-016**: Rainbow sand already inside a conversion zone MUST be left unchanged; conversion is one-way and idempotent.
- **FR-017**: A rainbow MUST NOT convert anything outside its conversion zone, MUST NOT create elements on its own, and MUST NOT change any object.
- **FR-018**: Multiple rainbows MUST each convert independently, with no combined or amplified effect.

**Rainbow sand**

- **FR-019**: Rainbow sand MUST be a powder that obeys exactly the same movement rules as pink sand: falling, diagonal sliding, resting, sloped piling, sinking through water, resting on other powders, and being blocked by objects.
- **FR-020**: Rainbow sand MUST be visually distinct at a glance from pink sand, magic purple dirt, and water, reading as multi-colored rainbow grains rather than one flat color, so that a heap made of it shows visible rainbow stripes or bands.
- **FR-021**: The rainbow colors of rainbow sand MUST be assigned so that piles read as rainbow-striped. Each grain's hue MUST cycle through the rainbow while the grain is **moving**, giving a shimmer as it falls, and MUST **freeze** at whatever hue it holds once the grain comes to rest, so settled heaps are stable rainbow stripes rather than a flashing mass. A grain that starts moving again MUST resume cycling; a grain that never moves MUST never change hue. Only moving grains may be recolored per frame, which bounds the cost. If implementation profiling shows even this strains the frame target of FR-030, the fallback MUST be to fix each grain's hue at the moment of conversion (a static striped pile) rather than to shrink the grid or lower the resolution; FR-030 takes precedence over the shimmer.
- **FR-022**: Rainbow sand MUST be deposited only by rainbow conversion; it MUST NOT have its own toolbar brush.

**The unicorn's delight**

- **FR-023**: When any element occupies a cell touching a unicorn's footprint, the unicorn MUST emit a celebration burst of ✨ sparkle and 💖 heart particles around itself.
- **FR-024**: Repeated or continuous contact MUST be rate-limited so a steady stream of sand produces a continuing happy twinkle rather than an unbounded flood of particles.
- **FR-025**: Each unicorn MUST also emit a few sparkles on its own at intervals while idle, so it looks alive when nothing is touching it.
- **FR-026**: Particles MUST drift upward and fade out completely within a short lifetime, leaving no residue.
- **FR-027**: Particles MUST be purely decorative: they MUST NOT occupy grid cells, block movement, or create, destroy, move, or recolor any element or object.
- **FR-028**: The total number of live particles on screen MUST be capped; when the cap is reached, new particles MUST be dropped or the oldest retired, never at the cost of frame rate.
- **FR-029**: Objects and particles MUST be rendered as real emoji glyphs (🌈 🦄 ✨ 💖) with no custom artwork assets and no external asset requests.

**Tools, performance, and verification**

- **FR-030**: The simulation MUST stay smooth (target 60fps, acceptable ≥30fps) at the default grid resolution on a mid-range laptop and a tablet, with the maximum number of objects on screen (3 rainbows and 3 unicorns), particles at their cap, and the play area at least half full of a mixture of all elements, including shimmering rainbow sand in motion.
- **FR-031**: The 🧽 eraser MUST remove any object whose footprint the brush touches, in whole — no partial objects — in addition to emptying element cells inside the brush footprint.
- **FR-032**: The 🗑️ clear-all control MUST remove every element, every object, and every live particle immediately, with no confirmation, and MUST NOT change the selected tool or brush size.
- **FR-033**: Exactly one tool MUST be active at a time across the element brushes, the object tools, and the eraser, and the active one MUST be shown in a clearly distinct visual state obvious at a glance from across a room.
- **FR-034**: Every control MUST remain a large, round, emoji-labeled button operable by a small child's finger on a tablet and understandable without reading, and the toolbar MUST still fit on screen without the page scrolling on both a laptop and a tablet.
- **FR-035**: No interaction in this feature MUST produce a failure state, a message, a confirmation, a sound requirement, or any way for the child to be "wrong".
- **FR-036**: Existing behavior MUST NOT regress: with no rainbow and no unicorn on screen, pink sand, water, and magic purple dirt MUST behave exactly as they do today, and all existing automated tests MUST pass unchanged.
- **FR-037**: The project MUST provide automated tests, runnable without a browser, covering at minimum: the rainbow conversion rule (an element in a rainbow's conversion zone becomes rainbow sand — FR-013 through FR-018), rainbow sand moving identically to pink sand (FR-019), elements landing on and sliding off solid objects without entering their footprints (FR-009 through FR-011), the per-type cap of 3 with the oldest object rolling off and never a refused placement (FR-005), and objects staying at their placed cells with no gravity of their own (FR-007).
- **FR-038**: The production build MUST still emit exactly one self-contained page, fully playable when opened directly from disk with no network requests.

### Key Entities

- **Emoji object**: A placed, solid, non-falling thing occupying a footprint of grid cells and drawn as an emoji glyph. Two kinds exist: rainbow and unicorn.
- **Rainbow**: An emoji object whose conversion zone turns touching elements into rainbow sand.
- **Unicorn**: An emoji object that emits celebration particles when touched by an element, and idle sparkles otherwise.
- **Conversion zone**: The band of cells immediately around a rainbow's footprint in which conversion happens.
- **Rainbow sand**: A fourth element — a powder with pink sand's movement rules and a multi-colored rainbow appearance. Created only by rainbow conversion.
- **Particle**: A short-lived decorative ✨ or 💖 drawn over the play area, drifting up and fading, with no effect on the grid. Capped in number.

### Superseded requirements

- The water/dirt spec's **FR-001** (a cell is empty or holds pink sand, water, or magic purple dirt) is superseded by this spec: a cell may also hold rainbow sand, or be part of an object footprint and therefore unavailable to elements.
- The water/dirt spec's **FR-003** and **SC-005** (an element never changes into another element; per-element cell counts stay constant) are superseded **only** for rainbow conversion (FR-014). Conversion is the single sanctioned type change; all other simulation rules still MUST NOT change an element's type, and the *total* number of occupied cells still MUST NOT change as a result of any simulation rule.
- The water/dirt spec's **FR-017** (the toolbar offers three element tools plus eraser, clear-all, and brush sizes) is superseded by FR-001 of this spec, which adds the two object tools.
- The water/dirt spec's **superseded cap of 8 on-screen controls** is superseded again: the toolbar MUST have at most 10 controls, and every one MUST still be reachable in a single tap from the play state and remain finger-sized on a tablet.
- The pink-sand spec's **FR-013/FR-014** (pressing applies the selected tool continuously, including along a drag) still governs the element brushes and the eraser, but is superseded for the object tools by FR-002: one press places one object.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A 4–5 year old can place a rainbow and turn her sand into rainbow sand within 15 seconds of being shown the play area, with no adult instruction and without reading anything.
- **SC-002**: 100% of pink-sand, purple-dirt, and water cells that enter a rainbow's conversion zone are rainbow sand on the following simulation step.
- **SC-003**: No element cell outside a rainbow's conversion zone ever changes type — measured across a full simulation run, 0 unexpected conversions.
- **SC-004**: The same drawing settled with rainbow sand and with pink sand produces the identical arrangement of occupied cells — the two differ only in color and in how they were created.
- **SC-005**: Across any run of the simulation with no drawing, the total number of occupied cells stays exactly constant; the only per-element count changes are rainbow conversions, and every cell lost by another element is matched one-for-one by a cell gained by rainbow sand.
- **SC-006**: A settled heap of rainbow sand shows at least 6 distinguishable hues spanning the rainbow, and is identified as "rainbow" rather than "pink" or "purple" by an adult at a glance.
- **SC-007**: 0 element cells ever appear inside an object's footprint, across a run in which at least 10,000 grains are poured over objects.
- **SC-008**: Sand poured onto an object placed in mid-air forms a pile resting on the object with empty cells beneath it, and the pile's sides slope (no single-cell towers taller than 2 cells persist once settled).
- **SC-009**: Every contact between an element and a unicorn produces a visible celebration within one frame, and every particle has disappeared completely within 2 seconds of being emitted.
- **SC-010**: An idle unicorn that nothing touches emits a visible sparkle at least once every 5 seconds.
- **SC-011**: The number of live particles never exceeds the documented cap, even with every unicorn buried under a continuous pour.
- **SC-012**: The toy renders at least 30 frames per second, targeting 60, on a mid-range laptop and a tablet in the worst observed case: 3 rainbows and 3 unicorns on screen, particles at their cap, and the play area at least half full of flowing elements with rainbow sand shimmering as it falls.
- **SC-013**: A play area containing no rainbow and no unicorn behaves identically to the previous release — all existing acceptance scenarios and automated tests pass unchanged.
- **SC-014**: A single drag of the 🧽 eraser across a rainbow and a unicorn removes both objects entirely, leaving 0 partial objects on screen.
- **SC-015**: Tapping 🗑️ with elements, both object types, and live particles on screen empties the play area completely within one frame, with no confirmation.
- **SC-016**: The automated test suite runs to completion without a browser and covers the rainbow-conversion rule and elements landing on solid objects, including the blocked-on-all-sides case against an object.
- **SC-017**: A production build still produces exactly one output file, and opening that file directly from disk yields a fully playable toy with zero network requests and zero external asset fetches for emoji.
- **SC-018**: A child cannot reach any state that shows a message, a confirmation, an error, or a score — 0 such states exist across every interaction in this feature.
- **SC-019**: After any number of taps with an object tool, the play area holds at most 3 rainbows and at most 3 unicorns, and the objects present are always the most recently placed of each type — 0 taps are ignored and 0 messages are shown.
- **SC-020**: An object placed over empty space stays on exactly the same grid cells for the rest of its life — 0 cells of drift across a full simulation run, including runs where the elements below it are erased.
- **SC-021**: A rainbow-sand grain in motion changes hue on successive frames, and a grain that has come to rest keeps the identical hue for as long as it stays at rest — 0 hue changes for settled grains.

### Visual checks for the maintainer *(no automated coverage)*

- The rainbow and the unicorn read instantly as a rainbow and a unicorn at the default play-area size — not as tiny illegible specks.
- Sand streaming through a rainbow and coming out rainbow-colored looks magical, not glitchy.
- A rainbow-sand heap looks like rainbow stripes, cheerful and clearly different from the pink and purple heaps beside it.
- The shimmer on falling rainbow sand reads as gentle magic, not as strobing or flicker, and the moment a grain settles and locks its color looks natural rather than abrupt.
- An object left floating over empty space looks like a deliberate magic shelf, not like a bug.
- The unicorn's sparkle-and-heart burst feels celebratory and gentle — it does not obscure the play area or flash harshly.
- The idle twinkle is noticeable but not distracting when the child is drawing elsewhere.
- Piles building up on top of an object look like they are resting on it, not floating oddly beside it.
- The toolbar with 10 buttons still looks like a friendly row of big round buttons, not a cramped strip.

## Assumptions

- **Builds on the existing toy**: this feature assumes `001-falling-pink-sand` and `002-water-and-purple-dirt` exist and are the base being extended — grid, canvas, drawing, brush sizes, eraser, clear-all, resize handling, build, and test setup. All of their constraints (single self-contained page, no reading required, no failure states, mouse and touch) continue to apply.
- **Object footprint size**: each object occupies a square block of cells roughly one tenth of the play area's width, so the emoji glyph is clearly recognizable while several objects still fit comfortably on screen. The exact number of cells is an implementation tuning choice.
- **Conversion is contact-based, one cell deep**: the conversion zone is the ring of cells immediately around the footprint, not a radius or an aura. A grain must actually touch the rainbow to be transformed.
- **Water converted by a rainbow becomes a powder**: it stops flowing and starts piling. This is the requester's stated intent ("turns it into rainbow sand") and is accepted as the more magical behavior, even though it means water can be permanently consumed by a rainbow.
- **Rainbow sand has no brush**: it exists only as the product of the rainbow, which keeps the rainbow feeling magical and keeps the toolbar at 10 controls.
- **Rainbow sand does not convert its neighbors**: the magic spreads only from rainbows, not grain to grain, so a single rainbow does not eventually recolor the whole play area.
- **Particles live outside the grid**: sparkles and hearts are drawn over the play area as an overlay of moving emoji glyphs; they are not cells and are not part of the simulation, which is what keeps them cheap.
- **Emoji rendering relies on system fonts**: emoji glyphs are drawn using the platform's own emoji font, consistent with the no-custom-artwork and no-external-assets constraints. Exact glyph appearance varies by platform and that is accepted.
- **Objects do not interact with each other**: a rainbow does not affect a unicorn and vice versa; a unicorn does not react to being overlapped by an object, only to elements touching it.
- **The cap is 3 per type and rolls rather than blocks** (FR-005, clarified on issue #3): for a 4-year-old a button that silently stops responding is the worst outcome, so the tap always places and the oldest of that type rolls off instead. Three of each also keeps the frame budget comfortable.
- **Objects float where tapped** (FR-007, clarified on issue #3): one predictable rule — the object goes exactly where she tapped and stays there. Dropping objects to the ground would need object gravity plus a re-settle rule whenever the pile beneath changes, and would still leave objects hanging in the air when a supporting pile is erased.
- **Rainbow sand shimmers while falling and freezes when it settles** (FR-021, clarified on issue #3): the per-frame recolor cost is bounded by the number of moving grains, and settled piles are stable rainbow stripes. Fixing the hue at conversion is the sanctioned fallback if profiling demands it; shrinking the grid is not.
- **Unicorns react to every element equally**: pink sand, purple dirt, water, and rainbow sand all trigger the same celebration; there is no special reaction per element in this feature.
- **No sound**: the requester stated sound is not required, and none is added. The celebration is entirely visual.
- **No persistence**: objects, like elements, are not saved; reloading starts from an empty play area.
- **Scenes are still out of scope**: the constitution's preloaded landscape scenes are a separate, later feature and are not part of this spec.
- **Brush sizes do not apply to object tools**: an object has a fixed size; the brush-size selection continues to apply to the element brushes and the eraser and is left untouched when an object tool is selected.
- **Target devices unchanged**: a mid-range laptop with mouse/trackpad and a tablet with touch; phone-sized screens are not a target.
