# Feature Specification: Water-Drinking Grass

**Feature Branch**: `spec-draft/007-water-drinking-grass`

**Created**: 2026-08-26

**Status**: Draft

**Input**: GitHub issue #19 — "Grass that drinks water and grows"

> New element for Rainbow Sand: **grass** 🌱, in the spirit of classic falling-sand games.
>
> - Grass is a plantable element the child can draw like the other elements.
> - It **absorbs water**: water that touches grass soaks into it instead of pooling forever.
> - Absorbing water makes it **grow** — upward/outward, so watering a patch visibly makes it flourish. Growth should feel alive but stay gentle and bounded (no runaway takeover of the play area).
> - Kid-first as always: no failure states, no reading required, one obvious toolbar button that fits the existing emoji-button family.
> - Must respect the phone-support constraints from spec 006 (viewport-derived grid, 43,200-cell budget) and keep the simulation smooth on modest hardware (an Amazon Fire 7 Kids tablet is a real target device).
> - Interaction expectations with existing elements (pink sand, purple dirt, eraser, scenes) are up to the spec to pin down sensibly.
>
> Context: a later feature will add a fire-like 'star power' that burns grass, so grass should be specced as a burnable living element, but nothing about burning needs to ship in this feature.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Planting grass (Priority: P1)

The child taps a new green sprout button that sits with the other element buttons, then draws on the play area. Green grass appears under her finger, in a lively range of greens, exactly where she drew it — a lawn along the bottom, a tuft on top of a sand hill, a stripe up the side of the screen. It stays put where she planted it; it does not slide away or trickle down like sand. She can plant with any of the three brush sizes, and she can plant over water, but she never accidentally wipes out the pink-sand hill she just built.

**Why this priority**: A grass element the child can draw is the foundation everything else in this feature stands on — there is nothing to water and nothing to grow until grass can be planted. It is also a complete, delightful slice on its own: a new colour in the box.

**Independent Test**: Plant grass with each brush size on an otherwise empty play field, over a powder pile, and into water, then run the simulation for many steps and assert without a browser that every planted cell still holds grass in its original cell, that no powder cell was overwritten, and that the toolbar exposes exactly one new element control.

**Acceptance Scenarios**:

1. **Given** the toy has just loaded, **When** the child looks at the toolbar, **Then** a single green sprout button sits alongside the existing element buttons, in the same big round emoji-button family, needing no reading to understand.
2. **Given** the child taps the grass button, **When** she presses and drags on the play area, **Then** grass is painted continuously along the whole path of the drag, exactly like every other element brush, with mouse or finger.
3. **Given** grass has been planted, **When** the simulation runs for any length of time with nothing else on the field, **Then** every grass cell is still in the cell it was planted in — grass does not fall, slide, or drift.
4. **Given** a pile of pink sand or purple dirt, **When** the child drags the grass brush across the pile, **Then** grass fills the empty cells of the brush footprint and no sand or dirt grain is replaced.
5. **Given** a pool of water, **When** the child drags the grass brush through it, **Then** grass is planted in those cells and the displaced water is gone from them.
6. **Given** grass is selected, **When** the child switches brush sizes, **Then** the grass brush uses the same three sizes as every other element, with the same footprints.
7. **Given** grass is on the field, **When** the child looks at it next to pink sand, purple dirt, and water, **Then** it reads unmistakably as green grass, with visible variation between blades rather than one flat green slab.

---

### User Story 2 - Watering makes it grow (Priority: P2)

The child pours water onto her patch of grass, or lets a puddle run up against it. The water soaks in — the puddle visibly shrinks — and the grass answers by growing: new blades push upward out of the top of the patch and creep outward along the ground, so a short stubby lawn turns into a tall waving one while she watches. Stop watering and the growing stops, leaving the taller lawn behind. Water it again and it grows again.

**Why this priority**: This is the heart of the issue — the reason grass is worth adding at all. It depends on User Story 1 but delivers the "watering makes it flourish" moment that the child is meant to discover.

**Independent Test**: Place a grass patch and a body of water beside and above it in a headless grid, run the simulation, and assert that water cells adjacent to the grass are consumed, that the grass cell count rises by no more than one cell per water cell consumed, that new grass cells appear above and outward from existing ones and never below, and that growth halts once the water is gone.

**Acceptance Scenarios**:

1. **Given** a patch of grass with a pool of water resting against its side, **When** the simulation runs, **Then** water cells touching the grass are absorbed one by one and the pool visibly shrinks rather than sitting there forever.
2. **Given** a patch of grass, **When** the child pours water directly onto it from above, **Then** the water lands on the grass, soaks in, and grass rises into the space the water occupied.
3. **Given** grass that has absorbed water, **When** the simulation runs, **Then** new grass appears in empty cells above and diagonally above existing grass, and creeps sideways only onto cells that have something solid beneath them — never into thin air and never downward.
4. **Given** grass that has absorbed water, **When** the child watches, **Then** new blades appear within about two seconds of the water touching the grass — the growth is obviously happening, not a change she only notices later.
5. **Given** a patch of grass that has been watered and has finished growing, **When** no more water touches it, **Then** it stops growing and simply stays as it is — it never shrinks, wilts, browns, or disappears.
6. **Given** grass with no water anywhere on the field, **When** the simulation runs for a long time, **Then** not a single new grass cell appears.
7. **Given** grass growing upward, **When** a new blade would enter a cell occupied by sand, dirt, water, or a placed object, **Then** it does not — grass only grows into empty space and never destroys anything the child made.
8. **Given** grass buried under a pile of sand, **When** the simulation runs, **Then** the grass is still there and unharmed; it simply has nowhere to grow until the sand is moved or erased.

---

### User Story 3 - Gentle and bounded, never a takeover (Priority: P3)

However much water the child pours, the grass stays a garden rather than eating the whole screen. Blades reach a believable height and then stop reaching. A big lake next to a lawn does not silently drain away to nothing — once the grass has drunk its fill, the rest of the lake stays a lake she can still play with. And with a screen full of grass and water, the toy stays as smooth on a small cheap tablet as it is with sand alone.

**Why this priority**: The issue asks explicitly for growth that "feels alive but stays gentle and bounded". Without this the feature is still demonstrable, which is why it ranks below User Story 2 — but shipping without it would give the child a screen that fills itself in and a lake that evaporates.

**Independent Test**: Flood a headless play field with water against a large grass patch, run the simulation to a standstill, and assert that no blade exceeds the maximum height above its root, that total grass never exceeds the share-of-field ceiling, that water remains on the field once the grass can no longer grow, and that the whole run stays inside the per-step work budget.

**Acceptance Scenarios**:

1. **Given** an unlimited supply of water against a grass patch, **When** the simulation runs until nothing changes, **Then** no blade of grass has grown more than its maximum height above the cell it is rooted on.
2. **Given** an unlimited supply of water, **When** the simulation runs until nothing changes, **Then** grass occupies no more than a quarter of the play field, and the rest of the field is still the child's to draw in.
3. **Given** a large body of water beside grass that has finished growing, **When** the simulation runs, **Then** the remaining water stops being absorbed and behaves like ordinary water — it pools, levels, and flows around the grass as if it were solid ground.
4. **Given** a play field filled with grass and flowing water, **When** the child plays, **Then** the toy stays smooth on a small, cheap tablet — no stutter, no slowdown as the grass grows.
5. **Given** a play field derived for a phone-sized screen, **When** grass grows, **Then** it obeys exactly the same rules and bounds as on a laptop — only the number of cells differs.
6. **Given** water soaking into grass, **When** the child watches the pool, **Then** the water level goes down at a pace she can see happening — the pool is never gone in a single blink.

---

### User Story 4 - Grass belongs with everything else (Priority: P4)

Grass behaves like a first-class member of the toy. The sponge rubs it out. The bin clears it with everything else. Sand and dirt pour over it and pile on top of it like it is a hillside. The sparkle wand makes it glitter like everything else does. Rainbows and unicorns can be placed over it. Turning the phone sideways keeps the garden. Nothing about grass ever produces a message, a mistake, or a way to be wrong.

**Why this priority**: These are the integration behaviours that keep the toy coherent. Each is small and most follow from existing rules, so they rank last — but the feature is not finished until grass stops being a special case.

**Independent Test**: Exercise the eraser, clear-all, wand, powder piling, object placement, and play-field re-derivation against a field containing grass in a headless test and assert each existing rule applies to grass exactly as it applies to the other elements.

**Acceptance Scenarios**:

1. **Given** grass on the field, **When** the child drags the sponge over it, **Then** every grass cell under the brush footprint is removed, exactly as sand and water are.
2. **Given** grass on the field, **When** the child taps the bin, **Then** the grass is cleared along with everything else, immediately and with no confirmation.
3. **Given** grass on the ground, **When** the child pours pink sand, purple dirt, or wand rainbow sand on top of it, **Then** the powder lands on the grass and piles up on it — grass holds it up like solid ground and no powder sinks through.
4. **Given** grass on the field, **When** the child drags the sparkle wand across it, **Then** the grass glitters exactly as the other elements do.
5. **Given** grass on the field, **When** the child places a rainbow or a unicorn over it, **Then** placement works exactly as it does over any other element.
6. **Given** a garden the child has grown on a phone, **When** she turns the phone, **Then** her grass is carried across with the rest of her drawing under the existing preservation rule, and it keeps growing when watered afterwards.
7. **Given** the child taps a preloaded scene button while grass is on the field, **When** the scene loads, **Then** the field is replaced by that scene exactly as it is today, with no error and no leftover grass.
8. **Given** any amount of grass, water, and powder on the field, **When** the child does anything at all, **Then** no message, confirmation, score, or failure state can appear.

---

### Edge Cases

- **Grass drawn in mid-air with nothing under it**: it stays exactly where it is drawn (see FR-004) and is treated as its own root, so it can still grow upward when watered; it cannot creep sideways into empty space because sideways growth needs support underneath.
- **Grass planted directly into water**: the brush takes the cell and the water in it is gone, so a child can always plant in a flooded field.
- **Water fully enclosing a grass patch**: the grass drinks what it can reach until it can no longer grow, then the remaining water simply rests against it like it would against a sand wall.
- **A single grass cell against a huge lake**: it absorbs at most enough water to grow its own blade to full height; the lake is not drained by one blade of grass.
- **Grass at the very top of the play field**: a blade that reaches the top edge simply stops growing upward; nothing is lost off the top and no grass leaves the field.
- **Grass at the left or right wall**: it grows upward against the wall and creeps only inward; grass never leaves the play field.
- **A grass cell completely surrounded by sand, dirt, other grass, or objects**: it absorbs nothing and grows nothing, and it stays healthy and green indefinitely.
- **Grass buried by a landslide of sand**: it survives, stops growing, and resumes when the covering sand is erased or moved away.
- **Sand dropped onto a tall blade**: the powder rests on top of the grass rather than passing through it, so the child can build on her lawn.
- **Water dropped onto grass that has already finished growing**: it lands on top and rests there like it would on any solid element; it is not absorbed.
- **Erasing the base of a tall blade**: the blade above does not fall or collapse — grass is static — and it continues to behave normally.
- **The grass ceiling reached across the field**: further watering absorbs nothing and grows nothing anywhere, and the toy carries on as normal with no message.
- **Play-field re-derivation on rotation**: grass is carried across on exactly the same best-effort, bottom-centre-anchored basis as every other element; grass cropped out is gone and the survivors carry on growing.
- **Reload**: nothing is persisted, so the field opens empty exactly as it does today.
- **All the edge cases from the pink-sand, water/dirt, rainbow/unicorn, landscape-scenes, sparkle-wand, and phone-support features** continue to apply unchanged and now apply with grass on the field as well.

## Requirements *(mandatory)*

This feature extends the existing toy specified in `001-falling-pink-sand`, `002-water-and-purple-dirt`, `003-rainbow-unicorn-magic`, `004-landscape-scenes`, `005-sparkle-magic-wand`, and `006-phone-support`. All requirements of those specs remain in force except where explicitly superseded in the **Superseded requirements** section below.

Throughout: a **grass cell** is a cell holding the grass element. A blade's **root** is the lowest grass cell in the unbroken vertical run of grass beneath and including it. A grass cell's **height above its root** is the number of cells between it and its root. **Solid** means a cell holding any powder or grass. All growth and absorption limits are stated in cells and in simulation steps so they hold identically at every play-field size derived under spec 006.

### Functional Requirements

**The grass element**

- **FR-001**: The play field MUST support a new element, grass, alongside empty, pink sand, water, and magic purple dirt. Each cell MUST still hold at most one element.
- **FR-002**: Grass MUST carry a per-cell shade variation in a green range, assigned when the cell is created and preserved for the life of the cell, using the same per-cell shade mechanism as the existing elements.
- **FR-003**: Grass MUST be recognisable as green grass at a glance and MUST be visually distinguishable from pink sand, purple dirt, water, and wand rainbow sand when they sit side by side.
- **FR-004**: Grass MUST NOT move under any simulation rule: it does not fall, slide, spread, swap, or sink. A grass cell created at a position stays at that position until a drawing tool removes it or a play-field re-derivation moves it. *(Interim decision — see [NEEDS CLARIFICATION: Should grass painted with nothing beneath it stay floating where the child drew it (chosen default: yes, grass is static everywhere), or fall like a powder until it lands and only then take root?])*
- **FR-005**: Grass MUST behave as solid ground for every other element: powders rest on top of it and MUST NOT sink through it or displace it, and water MUST NOT pass through it, flowing around it exactly as it flows around a powder.
- **FR-006**: Grass MUST NOT be created, destroyed, or converted by any rule other than the ones in this spec (the grass brush, the eraser, clear-all, scene loading, play-field re-derivation, and the growth rule of FR-010).

**Drinking water**

- **FR-007**: A grass cell that is orthogonally adjacent to a water cell and that is still able to grow (FR-011, FR-012) MUST absorb that water: the water cell becomes empty and the grass cell gains the capacity to sprout exactly one new grass cell.
- **FR-008**: A grass cell that cannot grow — because every eligible target cell is occupied, or because the height ceiling of FR-011 or the field ceiling of FR-012 has been reached — MUST NOT absorb water. Water resting against fully grown grass MUST pool, level, and flow as ordinary water does against solid ground. *(Interim decision — see [NEEDS CLARIFICATION: Once grass has grown as much as it can, should it stop drinking so leftover water stays a pool the child can play with (chosen default), or keep slowly drinking forever so that grass doubles as a drain that makes standing water disappear?])*
- **FR-009**: Absorption MUST be paced so the child sees the water level go down rather than a pool vanishing between frames: a single grass cell MUST NOT absorb more than one water cell per 10 simulation steps.

**Growing**

- **FR-010**: A grass cell holding absorbed water MUST sprout one new grass cell into an eligible empty neighbouring cell, and MUST then have spent that absorbed water. Eligible target cells are, in order of preference: the cell directly above; the cells diagonally above left and above right (chosen at random when both are eligible); and the cells directly left and right, which are eligible only when the cell directly beneath the target is solid. A target cell MUST be empty — grass MUST NOT grow into a cell holding water, a powder, another grass cell, or a placed object.
- **FR-011**: Grass MUST NOT grow more than 12 cells above its root, so blades reach a believable height and then stop.
- **FR-012**: Grass MUST NOT grow once grass occupies 25% of the play field's cells; this ceiling applies to growth only and never removes or blocks grass the child planted herself.
- **FR-013**: Grass MUST NOT grow downward or into the play field's walls, floor, or ceiling, and MUST NOT leave the play field.
- **FR-014**: Each absorbed water cell MUST yield at most one new grass cell, so the total growth a body of water can cause is bounded by the amount of water the child pours.
- **FR-015**: Growth MUST be visible promptly: with water in contact, the first new blade MUST appear within 2 seconds, and a fully watered patch MUST reach the height ceiling of FR-011 within 15 seconds of continuous contact.
- **FR-016**: Grass MUST NOT change over time in the absence of water: it never wilts, browns, dries out, dies, spreads on its own, or disappears. Nothing in this feature may take the child's grass away.
- **FR-017**: Newly grown grass MUST be visually consistent with planted grass — the same green family with per-cell variation — so a grown patch reads as one lawn rather than two different materials.

**Tools and toolbar**

- **FR-018**: The toolbar MUST offer a single new grass tool as a large, round, emoji-labeled button in the same finger-size class as the existing controls, understandable without reading, grouped with the other element brushes and reachable in one tap from the play state.
- **FR-019**: The grass tool MUST participate in the existing single-active-tool selection: selecting it deselects whatever was active, and its selected state MUST be as obvious at a glance as every other control's.
- **FR-020**: The grass brush MUST deposit grass into empty cells inside the brush footprint and into cells holding water (the grass takes the cell and the water in it is gone), and MUST NOT overwrite pink sand, magic purple dirt, wand rainbow sand, or placed objects.
- **FR-021**: The grass brush MUST work with all three brush sizes, with mouse and with touch, including press-and-drag painting along the whole path of a fast drag, exactly as the other element brushes do.
- **FR-022**: The eraser MUST remove grass from every cell in its footprint, and clear-all MUST remove all grass, exactly as they do for the other elements.
- **FR-023**: Pink sand MUST remain the tool selected when the page loads.
- **FR-024**: Adding the grass control MUST NOT push the toolbar out of the constraints of spec 006: with grass present, every control MUST still be fully visible at once on a phone-sized viewport in both orientations, at or above the minimum touch target, without the page scrolling and without the toolbar overlaying the play area or shrinking the play area below its fill requirements.

**Interaction with existing features**

- **FR-025**: The sparkle wand MUST treat grass exactly as it treats the other non-object elements: a wand pass over grass glitters it, and the wand's rainbow-sand sprinkling behaviour in empty cells is unchanged.
- **FR-026**: Rainbow and unicorn placement, and every other existing object behaviour, MUST be unaffected by the presence of grass; grass never grows into an object's cells.
- **FR-027**: Play-field re-derivation (spec 006) MUST carry grass across on exactly the same best-effort, bottom-centre-anchored basis as every other element; a grass cell's absorbed-water state need not survive a re-derivation, but the grass itself MUST.
- **FR-028**: Scene loading MUST continue to work exactly as it does today with grass on the field. The two preloaded landscape scenes MUST remain exactly as they are today, with no grass added to them. *(Interim decision — see [NEEDS CLARIFICATION: Should the two preloaded landscape scenes be left exactly as they are (chosen default), or should they be reseeded with grass on their hillsides so the child finds a garden to water the moment she picks a scene?])*
- **FR-029**: Grass MUST NOT introduce any failure state, message, confirmation, score, or way for the child to be wrong, and MUST NOT introduce sound, persistence, or any control beyond the single grass button.

**Performance, non-regression, and verification**

- **FR-030**: The simulation MUST stay smooth — target 60 frames per second, acceptable at or above 30 — on a mid-range laptop, a tablet, and a low-end tablet of the Amazon Fire 7 Kids class, at any play-field size derived under spec 006, in the worst case of a field filled with grass and actively flowing water.
- **FR-031**: The per-step cost of the grass rules MUST NOT depend on anything beyond the play field's cell count, and the simulation's hot loop MUST remain allocation-free, so growth cannot make the toy progressively slower as a garden fills in.
- **FR-032**: The grass rules MUST be identical at every play-field size and shape; only the number of cells and the on-screen scale differ.
- **FR-033**: Existing behaviour MUST NOT regress: with no grass on the field, every element, object, tool, scene, and control MUST behave exactly as specified by the earlier specs, and all existing automated tests MUST pass — updated only where the superseded requirements below make an assertion obsolete, never weakened to hide a regression.
- **FR-034**: The production build MUST still emit exactly one self-contained page, fully playable when opened directly from disk with no network requests.
- **FR-035**: The project MUST provide automated tests, runnable without a browser, covering at minimum: grass never moving under simulation (FR-004); powders resting on grass and water flowing around it (FR-005); absorption of adjacent water and its pacing (FR-007, FR-009); no absorption by grass that cannot grow, with the remaining water behaving normally (FR-008); the growth target preference order and the empty-target rule (FR-010); the height ceiling (FR-011); the field-share ceiling (FR-012); the one-blade-per-water-cell bound (FR-014); no growth without water and no change over time (FR-016); brush deposit and non-overwrite rules (FR-020); eraser and clear-all removing grass (FR-022); wand glitter on grass (FR-025); re-derivation carrying grass across (FR-027); and that a field with no grass produces byte-identical simulation behaviour to today (FR-033).

### Key Entities

- **Grass**: A living, static element. It does not move, it holds up powders and blocks water like solid ground, it drinks adjacent water, and it grows upward and outward while it has water and room. It is specified as a *burnable* living element so a later fire-like feature can consume it; nothing about burning is in scope here.
- **Absorbed water**: The per-grass-cell capacity to sprout, gained by drinking one adjacent water cell and spent by growing one new grass cell. It is transient simulation state, not something the child sees directly except as growth.
- **Root**: The lowest grass cell in the unbroken vertical run of grass beneath a blade. It is what the 12-cell height ceiling is measured from.
- **Element**: Extended from spec 002 — a cell now holds empty, pink sand, water, magic purple dirt, wand rainbow sand, or grass.
- **Tool selection**: Extended — the grass brush joins the existing set of element brushes competing for the single active-tool slot.

### Superseded requirements

- Spec 002's **FR-003** (an element never changes into another element, and element counts change only through the drawing tools) is superseded in the presence of grass: grass absorbs water, so water cells are consumed by the simulation, and grass cells are created by the simulation. With no grass on the field, spec 002's conservation rule holds exactly as before (FR-033).
- Spec 002's **SC-005** (the counts of pink sand, water, and purple dirt each stay exactly constant across any run with no drawing) is superseded for water only, and only when grass is on the field. Pink sand and purple dirt counts remain exactly constant under all conditions, and every count remains constant on a field with no grass.
- Spec 002's **FR-001** (a cell is empty or holds pink sand, water, or purple dirt) is superseded by FR-001 of this spec, which adds grass to the element set. Spec 002's **FR-017** (the toolbar's element set) is extended, not replaced, by FR-018.
- Spec 002's assumption that "no new interactions between elements beyond density" exist is superseded: grass drinking water is a deliberate new element interaction, and it is the point of this feature.
- The toolbar-fit requirements of specs 002 (**FR-025**), 004 (**FR-007**), 005 (**FR-005**), and 006 (**FR-018**, **FR-020**, **FR-020a**, **FR-021**) are extended, not replaced: they must now hold with the grass button present as well (FR-024).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A 4–5 year old can find the grass button and make grass appear within 5 seconds, with no adult instruction and without reading anything.
- **SC-002**: Across any run of the simulation with no drawing, 100% of grass cells stay in the cells they occupied at the start except those created by the growth rule — 0 grass cells move.
- **SC-003**: A patch of grass with water in contact grows its first new blade within 2 seconds, and reaches the height ceiling within 15 seconds of continuous contact.
- **SC-004**: A pool of water placed against a grass patch that can still grow loses water cells continuously until either the pool is gone or the grass can no longer grow — a pool left against growable grass never sits unchanged.
- **SC-005**: The number of new grass cells produced by a body of water never exceeds the number of water cells that body contained — 0 blades grown for free.
- **SC-006**: After running any arrangement of grass and unlimited water to a standstill, 0 blades exceed 12 cells above their root and grass occupies at most 25% of the play field's cells.
- **SC-007**: A play field with grass that has finished growing and a body of at least 200 water cells beside it retains 100% of that remaining water indefinitely — the lake does not drain away.
- **SC-008**: A single grass cell absorbs at most one water cell per 10 simulation steps, so a 100-cell pool beside a single blade takes visibly many frames to be drunk, never one.
- **SC-009**: Across any run of the simulation, 0 grass cells appear below an existing grass cell, in a non-empty cell, or outside the play field.
- **SC-010**: With no water anywhere on the field, running the simulation for 10,000 steps produces 0 new grass cells and 0 changes to existing grass.
- **SC-011**: A settled patch of grass shows at least 6 distinguishable green shades and is identified as grass by an adult at a glance in under 2 seconds.
- **SC-012**: A single drag of the eraser through a region containing grass, sand, water, and dirt leaves 0 occupied cells inside the brush footprint; tapping clear-all leaves 0 occupied cells anywhere.
- **SC-013**: Powder poured onto grass settles entirely above it — 0 powder grains end below a grass cell in the same column — and 0 water cells pass through grass.
- **SC-014**: On a low-end tablet of the Amazon Fire 7 Kids class, with the play field full of grass and actively flowing water at the size derived for that device, the toy renders at least 30 frames per second, targeting 60.
- **SC-015**: The measured per-step simulation cost with a full garden is within 20% of the cost with the same field full of sand — grass growth does not make the toy progressively slower.
- **SC-016**: On a phone-sized viewport, 100% of toolbar controls including the new grass button remain fully visible at once in both orientations at or above the minimum touch target, with 0 pixels of page scroll and 0 controls overlapping the play area.
- **SC-017**: A play field containing no grass behaves identically to the previous release — 100% of existing acceptance scenarios and automated tests pass, with changes limited to the assertions made obsolete by the superseded requirements above.
- **SC-018**: A child cannot reach any state that shows a message, a confirmation, an error, or a score by any use of grass — 0 such states exist.
- **SC-019**: A production build still produces exactly one output file, and opening that file directly from disk yields a fully playable toy with 0 network requests.
- **SC-020**: The automated test suite runs to completion without a browser and covers every rule listed in FR-035, including the blocked, buried, ceiling-reached, and no-water cases.

### Visual checks for the maintainer *(no automated coverage)*

- Grass reads instantly as grass — green, alive, and clearly not "green sand".
- Watering a lawn and watching it rise is satisfying: the growth looks like sprouting, not like a green block inflating.
- The pool visibly shrinking as the grass drinks is legible to a child watching it.
- A fully grown lawn looks like a lawn — varied heights, not a flat rectangle of green.
- The grass button looks like it has always belonged with the other element buttons.
- Sand piling on top of grass looks like sand on a hillside.
- The sparkle wand over grass looks as magical as it does over sand.
- On a Fire 7 tablet specifically: a busy garden with water running through it stays smooth in a small hand.

## Assumptions

- **Builds on the existing toy**: this feature assumes specs 001–006 are the base being extended. All of their constraints — single self-contained page, no reading required, no failure states, mouse and touch, viewport-derived play field within the 43,200-cell budget — continue to apply.
- **Grass is static, not a powder.** The chosen default is that grass never moves, which makes it a new element family (a solid) alongside the existing powders and liquid. This is what lets a blade have a root and a height, and it is what makes the child's planted shape stay the shape she drew. Marked for confirmation in FR-004.
- **Bounds are stated as fixed cell counts, not fractions of the field**, so the same rules produce the same-looking garden on a phone and on a laptop despite spec 006's viewport-derived grid. The 12-cell height ceiling is roughly 7% of today's default field height; the 25% field-share ceiling is the backstop against a runaway garden.
- **Growth is paid for in water.** One absorbed water cell buys exactly one new grass cell. This makes the feature self-limiting in the most kid-legible way possible: pour more water, get more grass; stop, and it stops.
- **Fully grown grass stops drinking** (FR-008), so a lake beside a mature lawn stays a lake. The alternative — grass as a permanent drain — is marked for confirmation because it changes whether standing water is a thing the child can keep.
- **Nothing dies.** Grass never wilts, browns, or disappears on its own, and burying it does not kill it. A child's garden can only be removed by her own eraser, the bin, or a scene change.
- **Burning is out of scope but designed for.** Grass is specified as a living, burnable element so the later fire-like "star power" feature can consume it; no burning behaviour, no fire element, and no flammability control ships here.
- **The preloaded scenes are untouched by default** (FR-028), keeping this feature's blast radius to the new element. Seeding scenes with grass is marked for confirmation as a genuinely attractive alternative.
- **Water conservation is deliberately broken, and only by grass.** This is the first rule in the toy that consumes an element. It is confined to grass and recorded in Superseded requirements so a future reader does not read it as a regression.
- **No sound, no persistence, no new settings**, consistent with the rest of the toy.
- **Target devices** are a mid-range laptop, a tablet, a mid-range phone, and now explicitly a low-end tablet of the Amazon Fire 7 Kids class, which is the binding performance constraint for this feature.
- **Verification without a browser**: absorption and growth are pure functions of grid state and step count, so they are fully unit-testable; the visual and feel checks are the maintainer's job on a real device, consistent with the project's no-browser-harness principle.
