# Feature Specification: Shining Star Power

**Feature Branch**: `spec-draft/008-star-power-burns-grass`

**Created**: 2026-08-27

**Status**: Draft

**Input**: GitHub issue #20 — "Shining star power that burns grass into glitter"

> A fire-like element, but not fire (at least not first): **shining star power** ⭐.
>
> - Acts the way fire does in classic sand games, but themed as magical star energy — the maintainer's direction is to explore non-fire ideas first and iterate on the feel; plain fire remains a fallback if star power doesn't land.
> - Star power **burns grass**: grass it touches is consumed and turns into **multicolored glitter** — the game's sparkly answer to ash. Glitter behaves like a light powder (falls, piles, maybe shimmers).
> - Spread should be satisfying to watch but kid-safe in feel: no failure states, nothing scary, everything reversible with the eraser/clear-all.
> - One new toolbar button in the existing emoji-button family; no reading required.
> - Water should stop/quench star power in some simple way in THIS feature; the fuller star-power-plus-water weather cycle (fog → cloud → rain) is deliberately split into its own follow-up feature — spec only a minimal, sensible water interaction here and leave the rest out of scope.
> - Must respect the phone-support constraints from spec 006 (viewport-derived grid, 43,200-cell budget) and stay smooth on an Amazon Fire 7 Kids tablet.
>
> Depends on the grass feature (#19) being on main first — grass is the fuel.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Drawing shining star power (Priority: P1)

The child taps a new ⭐ star button sitting with the other element buttons and drags on the play area. Bright shining star energy appears under her finger — gold and white and twinkling, obviously magic and not at all scary. It stays exactly where she drew it, shines for about a second, and winks out. She can draw it with any brush size, anywhere she likes, as many times as she likes, and it never disturbs the pink-sand hill or the lake she already made.

**Why this priority**: The star power element and its button are the foundation the rest of the feature stands on — nothing can burn until star power exists and can be drawn. It is also a complete, delightful slice on its own: a magic sparkler the child can wave across the screen.

**Independent Test**: Draw star power with each brush size on an empty play field, over a powder pile, into water, and over placed objects in a headless grid; run the simulation and assert that star power appears only in the cells it is allowed to occupy, never moves, disappears within its burn life, leaves those cells empty, damages nothing else, and that the toolbar exposes exactly one new control.

**Acceptance Scenarios**:

1. **Given** the toy has just loaded, **When** the child looks at the toolbar, **Then** a single ⭐ star button sits alongside the existing element buttons, in the same big round emoji-button family, needing no reading to understand.
2. **Given** the child taps the ⭐ button, **When** she presses and drags on the play area, **Then** star power is painted continuously along the whole path of the drag, exactly like every other element brush, with mouse or finger.
3. **Given** star power on an otherwise empty field, **When** the simulation runs, **Then** every star power cell stays in the cell it was drawn in — star power never falls, rises, drifts, or spreads through empty space.
4. **Given** star power on an otherwise empty field, **When** about a second passes, **Then** it winks out and leaves the cells empty — no glitter, no scorch, no leftovers.
5. **Given** a pile of pink sand, purple dirt, or glitter, **When** the child drags the ⭐ brush across the pile, **Then** star power fills only the empty cells of the brush footprint and not one grain is burned, replaced, or moved.
6. **Given** a pool of water, **When** the child drags the ⭐ brush through it, **Then** no star power appears in the water cells and the water is untouched.
7. **Given** a placed 🌈 or 🦄, **When** the child drags the ⭐ brush over it, **Then** the object is unharmed and unmoved, and it celebrates exactly as it already does when an element touches it.
8. **Given** star power on the field, **When** the child looks at it, **Then** it reads as shining magical star energy — gold, white, twinkling — and never as flames, embers, or smoke.

---

### User Story 2 - Burning grass into multicoloured glitter (Priority: P2)

The child grows a lawn, then touches it with star power. The grass catches: a shining front travels across the patch at a pace she can watch, each blade blazing for a moment and then bursting into multicoloured glitter that tumbles down and piles up at the bottom like sparkling ash. When the last blade has gone the shining stops on its own, and what is left is a heap of glitter she can pour sand on, sweep up with the sponge, or leave twinkling.

**Why this priority**: This is the heart of the issue — star power exists to burn grass into glitter. It depends on User Story 1 but delivers the moment the feature is for.

**Independent Test**: Place a grass patch in a headless grid, ignite one edge, run the simulation, and assert that the burn front advances only through grass, that every consumed grass cell yields exactly one glitter grain in the cell it occupied, that the burn halts by itself once the connected grass is gone, and that no other element is consumed or moved.

**Acceptance Scenarios**:

1. **Given** a patch of grass, **When** the child drags the ⭐ brush across part of it, **Then** the grass cells she touched start shining immediately.
2. **Given** star power next to grass but not on it, **When** the simulation runs, **Then** the neighbouring grass catches within half a second — the child does not have to hit the grass exactly.
3. **Given** a lit patch of grass, **When** the child watches, **Then** the shining front travels through the patch at a pace she can follow with her eyes — a few cells each second, not the whole lawn at once and not so slowly she loses interest.
4. **Given** a blade of grass that has caught, **When** it finishes shining, **Then** it becomes multicoloured glitter in the very cell it stood in — one blade in, one speck of glitter out, nothing disappearing without a trace.
5. **Given** glitter made by a burn, **When** the simulation runs, **Then** it falls, tumbles, and piles exactly as the sparkle wand's glitter does, twinkling in the same way.
6. **Given** a lawn with a gap of empty cells across it, **When** one side is lit, **Then** the burn stops at the gap — star power never travels through empty space, sand, dirt, glitter, water, or an object to reach the grass on the other side.
7. **Given** a lawn that has burned completely, **When** the simulation keeps running, **Then** all shining has stopped by itself and nothing is left burning anywhere.
8. **Given** glitter left by a burn, **When** the child touches it with star power again, **Then** nothing happens to it — glitter is not fuel, so a burn can never feed on its own leftovers.
9. **Given** a field with grass but no star power anywhere, **When** the simulation runs for a long time, **Then** not a single blade ever catches by itself.
10. **Given** grass burning on one side of the field, **When** the child waters grass on the other side, **Then** that grass drinks and grows exactly as it always did — burning changes nothing about grass that is not alight.

---

### User Story 3 - Water puts it out (Priority: P3)

The child sees the shining front heading for the rest of her lawn and pours water in front of it — or simply drops water straight onto the burning grass. The star power touching water goes out at once, leaving glitter where it had already caught, and the grass beyond the water is safe. A puddle is a wall the shine cannot cross, and the child works out that water beats star power without anyone telling her.

**Why this priority**: Water quenching is the child's control over the burn and the thing that keeps star power from feeling like something that just takes her lawn away. It is separable from the burn itself, which is why it ranks below User Story 2 — but the feature is much less kid-safe in feel without it.

**Independent Test**: Ignite a grass patch with a water barrier across it in a headless grid, run the simulation, and assert that star power cells touching water are extinguished within one step, that grass on the far side of the water never catches, and that the water is neither consumed nor moved by extinguishing.

**Acceptance Scenarios**:

1. **Given** star power burning, **When** water comes to rest against it, **Then** the star power goes out immediately rather than shining out its full time.
2. **Given** burning grass, **When** the child pours water directly onto it, **Then** the burning stops there and then, and the cells that had already caught become glitter.
3. **Given** a lawn with a stripe of water across it, **When** one end is lit, **Then** the burn reaches the water and stops — the grass on the far side is never touched.
4. **Given** star power put out by water, **When** the child looks at the water, **Then** the water is still all there — putting a fire out does not use the water up or move it.
5. **Given** a lit lawn and water arriving, **When** the child watches, **Then** there is no steam, no hiss, no message and no bang — the shine simply stops.
6. **Given** the child pours water on grass that is not burning, **When** the simulation runs, **Then** the grass drinks and grows exactly as spec 007 says — this feature adds no fog, no cloud, and no rain.

---

### User Story 4 - Star power belongs with everything else (Priority: P4)

Star power behaves like a first-class member of the toy. The sponge rubs it out mid-shine. The bin clears it with everything else. Scenes wipe it away. Turning the phone sideways keeps whatever was on the field. It never takes anything away except the grass the child aimed it at, and everything it does can be undone by drawing again. On a small cheap tablet, a whole hillside going up in glitter stays as smooth as pouring sand.

**Why this priority**: These are the integration behaviours that keep the toy coherent. Each is small and most follow from existing rules, so they rank last — but the feature is not finished until star power stops being a special case.

**Independent Test**: Exercise the eraser, clear-all, sparkle wand, object placement, powder piling, play-field re-derivation, and all three scene generators against a field containing burning star power in a headless test, and assert each existing rule applies to star power exactly as it applies to the other elements.

**Acceptance Scenarios**:

1. **Given** star power on the field, **When** the child drags the sponge over it, **Then** every star power cell under the footprint is removed on the spot and leaves nothing behind — not even glitter.
2. **Given** star power and glitter on the field, **When** the child taps the bin, **Then** everything is cleared immediately, with no confirmation.
3. **Given** a lawn burning, **When** the child taps a scene button, **Then** the field is replaced by that scene with no error and nothing left burning.
4. **Given** the child taps any of the three scenes, **When** it loads, **Then** it is exactly the scene spec 004 and spec 007 describe — no scene arrives with star power already on it, and the 🏔️ hills-and-lake scene still greens and grows at the waterline exactly as before.
5. **Given** star power on the field, **When** the child drags the sparkle wand across it, **Then** the star power is left exactly as it is and the wand's behaviour on everything else is unchanged.
6. **Given** star power on a phone, **When** the child turns the phone, **Then** the field is carried across under the existing preservation rule, whatever was burning still burns out normally, and no message appears.
7. **Given** a hillside of grass going up in glitter on a small cheap tablet, **When** the child watches, **Then** the toy stays smooth — no stutter as the front travels and the glitter falls.
8. **Given** any amount of star power, grass, glitter, powder, and water on the field, **When** the child does anything at all, **Then** no message, confirmation, score, or failure state can appear, and nothing on screen is frightening.
9. **Given** the child has burned her whole lawn, **When** she wants it back, **Then** she simply plants grass again and waters it — nothing is permanently lost and no state can be reached that she cannot draw her way out of.

---

### Edge Cases

- **Star power drawn where there is no grass at all**: it shines in place for its burn life and winks out, leaving the cells empty. The child always gets a visible sparkle from a ⭐ drag anywhere, and never a heap of unexplained glitter.
- **Star power drawn straight onto grass**: those grass cells catch at once, exactly as if star power beside them had ignited them.
- **Star power drawn into water**: nothing is placed and the water is untouched, so a ⭐ drag through the lake simply does nothing.
- **Star power drawn onto sand, dirt, glitter, or an object**: the occupied cells are skipped; only the empty and grass cells in the footprint take star power.
- **Grass entirely surrounded by water**: it can never catch, because any star power reaching it is put out first.
- **A single blade of grass alight**: it burns out into a single glitter grain and the burn ends there — one blade cannot start a field-wide burn without grass to carry it.
- **Grass diagonally connected only** (as grass grown under spec 007 often is): the burn carries across the diagonal, so a lawn does not burn in stripes with unreachable blades left standing.
- **Grass buried under sand while burning**: the burning cell is already occupied, so no sand can enter it; when it finishes shining it becomes glitter and the sand above settles onto it as it would onto any powder.
- **Powder falling onto a burning cell**: the powder rests on top of the star power as it would on any occupied cell, and resumes falling within about a second when the cell becomes glitter or empties.
- **Erasing a burning cell**: it is simply gone — the eraser leaves no glitter, because erasing is erasing.
- **Erasing the grass ahead of the front**: the burn reaches the gap and stops; the child can make a firebreak with the sponge as well as with water.
- **The whole field at the grass ceiling alight at once**: this is the feature's worst case; the toy holds its frame rate, the burn still finishes by itself, and the resulting glitter piles up under the existing sparkle-flash cap from spec 005 rather than twinkling faster and faster.
- **Star power at the play field's edge**: it behaves like every other brush — coverage is clipped at the boundary, nothing wraps, and no star power exists outside the play field.
- **Play-field re-derivation on rotation**: star power is carried across on exactly the same best-effort, bottom-centre-anchored basis as every other element, and whatever survives finishes burning normally. Glitter already made is carried across as the ordinary glitter grain it is.
- **Tapping a scene while a lawn burns**: the field is wiped and the scene is generated fresh, exactly as tapping a scene has always worked.
- **Reload**: nothing is persisted; the field opens empty exactly as it does today.
- **All the edge cases from the pink-sand, water/dirt, rainbow/unicorn, landscape-scenes, sparkle-wand, phone-support, and grass features** continue to apply unchanged and now apply with star power on the field as well.

## Requirements *(mandatory)*

This feature extends the existing toy specified in `001-falling-pink-sand`, `002-water-and-purple-dirt`, `003-rainbow-unicorn-magic`, `004-landscape-scenes`, `005-sparkle-magic-wand`, `006-phone-support`, and `007-water-drinking-grass`. All requirements of those specs remain in force except where explicitly superseded in the **Superseded requirements** section below. **This feature depends on `007-water-drinking-grass` being implemented on `main` first**: grass is star power's only fuel.

Throughout: a **star power cell** is a cell holding the star power element. A star power cell is **fuelled** when it came from a grass cell that caught, and **unfuelled** when it was drawn into an empty cell by the ⭐ brush. A cell's **burn life** is the number of simulation steps it shines for before it burns out. A **glitter grain** is the toy's existing multicoloured glitter speck from spec 005 — rainbow sand in an already-glittered state. A star power cell's **neighbours** are the eight cells surrounding it; **orthogonal neighbours** are the four sharing an edge. All timings are stated in simulation steps as well as seconds (at the toy's 60 steps per second) so they hold identically at every play-field size derived under spec 006.

### Functional Requirements

**The star power element**

- **FR-001**: The play field MUST support a new element, star power, alongside empty, pink sand, water, magic purple dirt, rainbow sand, and grass. Each cell MUST still hold at most one element.
- **FR-002**: Star power MUST be transient: every star power cell MUST burn out on its own within its burn life, so no star power can remain on the field indefinitely. [NEEDS CLARIFICATION: star power drawn where there is no grass is specified here as fading out after about a second, like a sparkler. Should it instead persist as a permanent decorative element the child can draw with and keep, the way every other element she draws stays put?]
- **FR-003**: Star power MUST read as shining magical star energy — a bright warm palette of golds, whites, and pale yellows with a twinkle, carrying per-cell shade variation from the same per-cell shade mechanism the other elements use. It MUST NOT be rendered as flames, embers, smoke, or anything in the red-orange fire family, and MUST be visually distinguishable at a glance from pink sand, purple dirt, water, rainbow sand, glitter, and grass.
- **FR-004**: Star power MUST NOT move under any simulation rule: it does not fall, rise, drift, slide, swap, or spread through empty space. A star power cell created at a position stays at that position until it burns out, is quenched, is erased, or a play-field re-derivation moves it.
- **FR-005**: A star power cell MUST occupy its cell for as long as it lasts: no other element may move into it, displace it, or pass through it. Powders MUST rest on it and water MUST flow around it exactly as they do for any other occupied cell.
- **FR-006**: Star power MUST NOT consume, convert, ignite, damage, move, or remove any element other than grass. Pink sand, magic purple dirt, rainbow sand, glitter, water, and placed 🌈 and 🦄 objects MUST be completely unaffected by star power's presence.

**Burning out and glitter**

- **FR-007**: Every star power cell MUST have a burn life of between 30 and 60 simulation steps (about 0.5–1 second), varying from cell to cell so a burning patch flickers out raggedly rather than all at once.
- **FR-008**: When a star power cell's burn life ends, a **fuelled** cell MUST become exactly one glitter grain in that same cell, and an **unfuelled** cell MUST become empty. Nothing else in the cell's surroundings changes.
- **FR-009**: The glitter left by burned grass MUST be the toy's existing glitter grain from spec 005 — multicoloured rainbow sand in an already-glittered state — so it falls, tumbles, piles, twinkles, is erasable and clearable, and is caught by a rainbow exactly as spec 005's sprinkled glitter already is. This feature therefore adds exactly one new element type (star power) and no new physics for glitter. [NEEDS CLARIFICATION: is reusing the sparkle wand's glitter grain the right "sparkly answer to ash", or should burned grass leave a distinct new light-powder element with its own look and its own slower, drifting fall — at the cost of a second new element type and a second powder rule?]
- **FR-010**: Every grass cell consumed by star power MUST yield exactly one glitter grain, in the cell the grass occupied — one blade in, one speck out. Grass MUST NOT be consumed without producing glitter, and glitter MUST NOT be produced except by a fuelled star power cell burning out or being quenched (and by the sparkle wand, unchanged from spec 005).

**Burning grass**

- **FR-011**: A star power cell that has been shining for at least 10 simulation steps MUST ignite every grass cell among its eight neighbours: each such grass cell becomes a fuelled star power cell with its own fresh burn life. Diagonal neighbours are included so that grass grown diagonally under spec 007 burns as one lawn.
- **FR-012**: The burn front MUST advance at a pace the child can watch — at least 3 and at most 10 cells per second through a solid body of grass — and grass in contact with star power MUST catch within 0.5 seconds of that contact.
- **FR-013**: Grass MUST NOT catch by any means other than contact with star power: it never ignites spontaneously, by heat at a distance, by age, by drought, or by any other rule. With no star power on the field, no grass cell may ever change.
- **FR-014**: Star power MUST NOT spread into or through any cell that is not grass. Empty cells, powders, glitter, water, and objects all block it, so a burn can only ever travel along connected grass and can never cross the play field on its own.
- **FR-015**: A burn MUST always terminate by itself: once no star power cell has a grass neighbour, all remaining star power burns out within its burn life and the field returns to rest with no further change.

**Water quenches it**

- **FR-016**: A star power cell that is orthogonally adjacent to a water cell MUST be extinguished within one simulation step: a fuelled cell becomes a glitter grain (FR-008, FR-010) and an unfuelled cell becomes empty. Water therefore stops a burn front and shields the grass behind it.
- **FR-017**: Extinguishing MUST NOT consume, move, or otherwise change the water cell that did it. [NEEDS CLARIFICATION: keeping the water means one drop is a permanent firebreak and water always wins, which is the simplest thing to explain to a child. Should quenching instead spend the water cell — one drop puts out one star, then it is gone — so that fighting a big burn costs the child water?]
- **FR-018**: The ⭐ brush MUST NOT place star power into a cell holding water.
- **FR-019**: No other water behaviour changes in this feature. There MUST be no steam, no fog, no cloud, no rain, no evaporation, and no humidity: the star-power-and-water weather cycle is explicitly out of scope and belongs to its own follow-up feature.

**Tools and toolbar**

- **FR-020**: The toolbar MUST offer a single new star power tool as a large, round, ⭐ emoji-labeled button in the same finger-size class as the existing controls, understandable without reading, grouped with the other element brushes and reachable in one tap from the play state.
- **FR-021**: The star power tool MUST participate in the existing single-active-tool selection: selecting it deselects whatever was active, and its selected state MUST be as obvious at a glance as every other control's.
- **FR-022**: The ⭐ brush MUST deposit unfuelled star power into empty cells inside the brush footprint and MUST convert grass cells inside the footprint into fuelled star power cells (each with its own fresh burn life, with FR-011's 10-step ignition delay counted from that moment). It MUST NOT overwrite or affect pink sand, magic purple dirt, rainbow sand, glitter, water, or placed objects.
- **FR-023**: The ⭐ brush MUST work with all three brush sizes, with mouse and with touch, including press-and-drag painting along the whole path of a fast drag, exactly as the other element brushes do.
- **FR-024**: The eraser MUST remove star power from every cell in its footprint, leaving those cells empty and producing no glitter, and clear-all MUST remove all star power and all glitter, exactly as they do for the other elements.
- **FR-025**: Pink sand MUST remain the tool selected when the page loads.
- **FR-026**: Adding the ⭐ control MUST NOT push the toolbar out of the constraints of spec 006: with both the grass and star power buttons present, every control MUST still be fully visible at once on a phone-sized viewport in both orientations, at or above the minimum touch target, without the page scrolling and without the toolbar overlaying the play area or shrinking the play area below its fill requirements.

**Interaction with existing features**

- **FR-027**: The sparkle wand MUST leave star power cells exactly as they are — neither glittered nor emptied nor retyped — and MUST NOT sprinkle into them, since they are not empty. Every other wand behaviour, including its treatment of glitter grains and its unicorn celebration bursts, is unchanged.
- **FR-028**: Placed 🌈 and 🦄 objects MUST be entirely unaffected by star power: it never burns, moves, resizes, or removes an object, and star power touching a unicorn triggers the ordinary "an element is touching me" celebration under the existing rule, with no new burst type.
- **FR-029**: Play-field re-derivation (spec 006) MUST carry star power across on exactly the same best-effort, bottom-centre-anchored basis as every other element. A cell's remaining burn life need not survive a re-derivation, but the cell MUST remain star power, MUST keep whether it is fuelled, and MUST still burn out normally afterwards.
- **FR-030**: Scene loading MUST continue to work exactly as it does today with star power and glitter on the field: a scene tap MUST remove every existing element cell, object, and particle before placing the chosen scene's contents, immediately and with no confirmation. No scene may be seeded with star power; the ⬜ empty, 🏔️ hills-and-lake, and 🏝️ beach scenes are exactly as specs 004 and 007 leave them, including landscape-1's grass and its bounded growth at the waterline.
- **FR-031**: Star power MUST NOT introduce any failure state, message, confirmation, score, or way for the child to be wrong, and MUST NOT introduce sound, persistence, or any control beyond the single ⭐ button. Everything star power does MUST be undoable by ordinary play: erase it, clear it, or plant and water grass again.
- **FR-032**: Star power MUST stay kid-safe in feel: nothing on screen may read as destruction, danger, or alarm. There is no smoke, no scorch mark, no damage to anything the child built other than the grass she aimed at, and no way for a burn to reach across the field to a lawn she did not touch (FR-014).

**Performance, non-regression, and verification**

- **FR-033**: The simulation MUST stay smooth — target 60 frames per second, acceptable at or above 30 — on a mid-range laptop, a tablet, and a low-end tablet of the Amazon Fire 7 Kids class, at any play-field size derived under spec 006, in the worst case of a play field at spec 007's grass ceiling fully alight at once with the resulting glitter falling and piling.
- **FR-034**: The per-step cost of the star power rules MUST NOT depend on anything beyond the play field's cell count, and the simulation's hot loop MUST remain allocation-free. Star power's twinkle MUST be a rendering effect that allocates nothing per frame and MUST NOT raise the number of simultaneous sparkle flashes or live sparkle glyphs above the fixed caps spec 005 already sets.
- **FR-035**: The star power rules MUST be identical at every play-field size and shape; only the number of cells and the on-screen scale differ.
- **FR-036**: Existing behaviour MUST NOT regress: with no star power on the field, every element, object, tool, scene, and control MUST behave exactly as specified by the earlier specs, and all existing automated tests MUST pass — updated only where the superseded requirements below make an assertion obsolete, never weakened to hide a regression.
- **FR-037**: The production build MUST still emit exactly one self-contained page, fully playable when opened directly from disk with no network requests.
- **FR-038**: The project MUST provide automated tests, runnable without a browser, covering at minimum: star power never moving (FR-004); powders resting on it and water flowing around it (FR-005); its burn life bounds and the ragged variation within them (FR-007); unfuelled cells leaving nothing and fuelled cells leaving exactly one glitter grain in place (FR-008, FR-010); the glitter left behind being the existing glitter grain, with the element set gaining exactly one new type (FR-009); ignition of all eight grass neighbours after the ignition delay (FR-011); the burn front's cells-per-second bounds (FR-012); no grass ever changing on a field with no star power (FR-013); the burn refusing to cross empty cells, powders, glitter, water, and objects (FR-014); every burn terminating with the field at rest (FR-015); quenching by orthogonally adjacent water within one step, with the water unchanged (FR-016, FR-017); the brush's deposit, ignite, and skip rules including water and objects (FR-018, FR-022); the eraser removing star power without leaving glitter and clear-all removing everything (FR-024); the wand leaving star power untouched (FR-027); objects being unaffected (FR-028); re-derivation carrying star power and its fuel state across (FR-029); scene loading clearing star power and no scene containing any (FR-030); grass drinking and growing exactly as spec 007 requires while a burn is happening elsewhere on the field (FR-019, FR-036); and that a field with no star power produces byte-identical simulation behaviour to spec 007's toy (FR-036).

### Key Entities

- **Star power**: A transient, static, shining element. It occupies its cell, never moves, ignites adjacent grass, is put out by adjacent water, and burns out on its own within its burn life. It is the toy's fire analogue, themed as magic rather than fire.
- **Fuel state**: Whether a star power cell is *fuelled* (it was a grass cell that caught, and will leave a glitter grain) or *unfuelled* (it was drawn into empty space, and will leave nothing). It is transient simulation state the child never sees directly, only through what the cell leaves behind.
- **Burn life**: The number of simulation steps a star power cell shines for before burning out — 30 to 60 steps, varying per cell.
- **Glitter grain**: Unchanged from spec 005 — multicoloured rainbow sand in an already-glittered state. This feature adds a second source for it: burned grass.
- **Element**: Extended from spec 007 — a cell now holds empty, pink sand, water, magic purple dirt, rainbow sand, grass, or star power.
- **Tool selection**: Extended — the ⭐ brush joins the existing set of element brushes competing for the single active-tool slot.

### Superseded requirements

- Spec 007's **FR-006** (grass is created, destroyed, or converted only by the grass brush, the eraser, clear-all, scene loading, re-derivation, and grass's own growth rule) is superseded: star power converts grass into glitter. This is the only new way grass can be lost, it happens only where the child has put star power (FR-013, FR-014), and it is fully reversible by planting and watering again.
- Spec 007's **FR-016** and its assumption that "nothing dies" — grass never wilts, browns, dries out, dies, or disappears, and "nothing in this feature may take the child's grass away" — are superseded exactly to the extent of star power. Grass still never changes on its own; it changes only when the child's own ⭐ tool reaches it. Spec 007's **SC-010** (10,000 steps with no water produce 0 changes to existing grass) continues to hold on a field with no star power.
- Spec 002's **FR-003** (an element never changes into another element, and element counts change only through the drawing tools) is further superseded: grass becomes star power and star power becomes glitter under the simulation. On a field with no grass and no star power, spec 002's conservation rule holds exactly as before.
- Spec 002's **SC-005** (element counts stay constant across a run with no drawing) is further superseded for grass and rainbow sand while star power is on the field, in the same way spec 007 superseded it for water. Pink sand and purple dirt counts remain exactly constant under all conditions.
- Spec 002's **FR-001** (the element set) is superseded by FR-001 of this spec, which adds star power. Spec 002's **FR-017** (the toolbar's element set) is extended, not replaced, by FR-020.
- Spec 005's **FR-017** (that feature adds no new element type, and glitter grains are placed only by the wand) is extended, not weakened: the glitter grain itself is unchanged in every respect, and burned grass simply becomes a second source of it (FR-009, FR-010). Spec 005's **FR-014** (glitter is permanent for the life of the grain) and **FR-022** (the fixed cap on simultaneous sparkle flashes) apply unchanged to glitter made by burning.
- The toolbar-fit requirements of specs 002 (**FR-025**), 004 (**FR-007**), 005 (**FR-005**), 006 (**FR-018**, **FR-020**, **FR-020a**, **FR-021**), and 007 (**FR-024**) are extended, not replaced: they must now hold with the ⭐ button present as well (FR-026).
- Spec 004's **FR-012** (what scene contents are composed of) is unchanged: no scene contains star power, and the glitter that burning produces is the rainbow sand spec 004 already allows.
- The constitution's product constraint that "new element types require a spec" is engaged and satisfied by this document: star power is the one new element type this feature adds.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A 4–5 year old can find the ⭐ button and make star power appear within 5 seconds, with no adult instruction and without reading anything.
- **SC-002**: Across any run of the simulation, 0 star power cells move from the cell they were created in.
- **SC-003**: On a field with no grass, 100% of drawn star power is gone within 1 second and leaves 0 glitter grains and 0 other changed cells.
- **SC-004**: Star power in contact with grass ignites it within 0.5 seconds in 100% of cases, and a burn front crosses a solid 60-cell run of grass in between 6 and 20 seconds — a rate a child can follow.
- **SC-005**: Burning a patch of N grass cells produces exactly N glitter grains — 0 blades lost without a trace and 0 glitter created for free.
- **SC-006**: Every burn terminates: from any starting arrangement, running the simulation to a standstill leaves 0 star power cells on the field.
- **SC-007**: A burn never crosses a non-grass cell — with a 1-cell gap, a 1-cell water stripe, a 1-cell sand stripe, or an object between two lawns, 0 cells of the far lawn ever catch.
- **SC-008**: Star power changes 0 cells of pink sand, purple dirt, rainbow sand, glitter, and water, and damages, moves, or removes 0 placed objects, in any run.
- **SC-009**: A star power cell orthogonally adjacent to water is extinguished within 1 simulation step in 100% of cases, and 100% of the water cells involved are still present and in place afterwards.
- **SC-010**: With grass on the field and no star power anywhere, running the simulation for 10,000 steps changes 0 grass cells beyond spec 007's own watering-and-growth rules.
- **SC-011**: Glitter produced by burning behaves identically to the sparkle wand's glitter — advancing the simulation on a field of burn-made glitter and an identical field of wand-made glitter produces 0 differing cells.
- **SC-012**: A single drag of the eraser through a region containing burning star power leaves 0 occupied cells inside the footprint and produces 0 glitter grains; tapping clear-all leaves 0 occupied cells anywhere.
- **SC-013**: A single ⭐ drag across a mixed region places star power in 100% of the empty cells of its footprint, ignites 100% of the grass cells, and changes 0 of the sand, dirt, rainbow sand, glitter, water, and object cells.
- **SC-014**: On a low-end tablet of the Amazon Fire 7 Kids class, with the play field at spec 007's grass ceiling fully alight and the resulting glitter falling, the toy renders at least 30 frames per second, targeting 60.
- **SC-015**: The number of simultaneous sparkle flashes and live sparkle glyphs never exceeds spec 005's existing caps, however much of the field is burning or glittered.
- **SC-016**: The measured per-step simulation cost with a field-wide burn in progress is within 20% of the cost of the same field full of falling sand.
- **SC-017**: On a phone-sized viewport, 100% of toolbar controls including the new ⭐ button remain fully visible at once in both orientations at or above the minimum touch target, with 0 pixels of page scroll and 0 controls overlapping the play area.
- **SC-018**: A play field containing no star power behaves identically to the previous release — 100% of existing acceptance scenarios and automated tests pass, with changes limited to the assertions made obsolete by the superseded requirements above.
- **SC-019**: A child cannot reach any state that shows a message, a confirmation, an error, or a score by any use of star power — 0 such states exist, and 100% of what star power does can be undone by erasing, clearing, or replanting.
- **SC-020**: A production build still produces exactly one output file, and opening that file directly from disk yields a fully playable toy with 0 network requests.
- **SC-021**: The automated test suite runs to completion without a browser and covers every rule listed in FR-038, including the no-grass, blocked-front, quenched, buried, and erased cases.

### Visual checks for the maintainer *(no automated coverage)*

- Star power reads instantly as *magic*, not as fire — a child should think "sparkles" and never "something is burning down".
- Drawing a ⭐ trail across an empty screen is satisfying on its own, even with no grass to catch.
- The burn front travelling across a lawn is the watchable, "ooh" moment it is meant to be — not an instant flash and not a crawl.
- Grass turning into glitter looks like a blade *bursting* into sparkles, not like a green cell being swapped for a coloured one.
- The heap of glitter left behind looks like treasure, not like ash.
- Pouring water in front of the front and watching it stop is legible to a child without any explanation.
- The ⭐ button looks like it has always belonged with the other element buttons.
- Nothing about the whole sequence is scary or sad to watch — the maintainer's call on whether star power lands, with plain fire as the stated fallback if it does not.
- On a Fire 7 tablet specifically: a whole hillside going up in glitter stays smooth in a small hand.

## Assumptions

- **Builds on the existing toy**: this feature assumes specs 001–007 are the base being extended, and specifically that **grass (spec 007) is implemented on `main`** before this feature is planned or built — grass is star power's only fuel, and without it the burn rules have nothing to act on.
- **Star power is fire's role, not fire's look.** It behaves the way fire behaves in a classic falling-sand game — spreads through fuel, consumes it, leaves residue, burns out, is quenched by water — while looking and reading as magical star energy. The maintainer's stated fallback is plain fire if star power does not land; that fallback would be a re-skin of these same rules, not a different feature.
- **Grass is the only fuel.** This is what makes the feature bounded and kid-safe without any extra machinery: spec 007 already caps grass at a quarter of the play field, so a burn can never take more than the child's lawn, and it can never travel across empty space to reach something she did not aim at.
- **Star power is static.** It does not rise like fire, which keeps the burn predictable, keeps the cost proportional to the burning cells, and keeps the shine on the grass where the child put it rather than drifting off it.
- **Glitter is the existing glitter grain** (FR-009). Reusing spec 005's multicoloured, already-glittered rainbow sand gives falling, piling, twinkling, erasing, and rainbow interaction for free, keeps the element set small as the constitution asks, and makes burned grass look like the toy's established treasure rather than a new material. Flagged for confirmation.
- **One blade in, one speck out** (FR-010). Mass is conserved through the burn, so a lawn collapses into a heap of glitter roughly its own size. Nothing the child grew vanishes without leaving her something.
- **Water always wins, and is not used up** (FR-016, FR-017). This is the simplest rule a non-reading child can discover, and it makes the eraser and a puddle equally good firebreaks. Flagged for confirmation.
- **The weather cycle is out of scope.** Fog, clouds, rain, steam, and evaporation are deliberately excluded and belong to the follow-up feature the issue describes. This spec pins only the minimal quench rule.
- **No scene is seeded with star power** (FR-030). Unlike grass, star power needs no seeding to be discovered: the 🏔️ scene already arrives with a green hillside from spec 007, so tapping ⭐ and drawing on it is the whole demonstration. Seeding a scene that is already alight would also mean a scene that destroys itself on load, which spec 004's "a scene is at rest" rule exists to prevent.
- **Nothing is lost forever.** A burned lawn can be replanted and rewatered; every effect of star power is reachable and reversible by ordinary drawing, with no confirmation, no warning, and no way to be wrong.
- **No sound, no persistence, no new settings**, consistent with the rest of the toy.
- **Target devices** are a mid-range laptop, a tablet, a mid-range phone, and a low-end tablet of the Amazon Fire 7 Kids class, which remains the binding performance constraint.
- **Verification without a browser**: ignition, burn-out, quenching, and glitter production are pure functions of grid state and step count, so they are fully unit-testable; the visual and feel checks are the maintainer's job on a real device, consistent with the project's no-browser-harness principle.
