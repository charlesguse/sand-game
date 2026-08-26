# Feature Specification: Water and Magic Purple Dirt

**Feature Branch**: `spec-draft/002-water-and-purple-dirt`

**Created**: 2026-08-26

**Status**: Draft

**Input**: GitHub issue #2 — "Water and magic purple dirt"

> Two more elements alongside pink sand, picked from the same big emoji toolbar:
> 💧 **Water** — pours and flows like liquid: falls, spreads sideways to find its level, fills containers and valleys. Pink sand poured into water should sink through it to the bottom (sand is heavier). Water should look lively (slight blue shade variation or shimmer).
> 💜 **Magic purple dirt** — a second sand-like powder, purple with per-grain shade variation, so she can build with two colors. Behaves like sand (falls, piles), sinks in water. If it's simple to do, make dirt pile a little steeper/stickier than sand so hills hold their shape — but plain sand behavior in purple is acceptable.
> The eraser and clear-all work on all elements. Existing pink-sand behavior must not regress; keep everything smooth (~60fps). Vitest unit tests for the new rules: water spreading/leveling, sand sinking through water. Keep the toolbar layout kid-friendly: the three element buttons (🩷 💧 💜) grouped together, selected state obvious at a glance.

## Clarifications

### Session 2026-08-26 (answers on issue #2)

- **Q: How completely must water "find its level"?** → **Simple flow only.** Water falls, slides diagonally, and spreads sideways, and never rises. Open containers level within themselves; U-tubes and narrow necks are not expected to equalize. A crisp, cheap, testable rule beats physical perfection for this audience. (FR-010)
- **Q: Does magic purple dirt pile more steeply than pink sand?** → **No — it is purple sand.** Identical movement rules, purple palette with per-grain shade variation. Zero risk to existing sand behavior is worth more than a distinct pile shape right now. (FR-016)
- **Q: Fixed per-cell blue shade, or animated shimmer?** → **Fixed per-cell shade**, assigned at creation exactly like sand grains. Shimmer is a possible later follow-up only if frame rate shows obvious headroom; the SC-006 frame-rate target takes precedence. (FR-026)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pour water and watch it flow (Priority: P1)

The child taps the 💧 button and drags across the play area. Water pours out from under her finger, falls to the floor, and then spreads out sideways instead of standing up in a heap the way sand does. Poured into a bowl-shaped pile of sand, it puddles in the bottom and fills the hollow. Poured onto a flat floor, it runs away to the left and right until it is a thin, wide sheet. The water is not one flat blue — it is a lively, slightly varying blue that looks wet.

**Why this priority**: Water is the headline of this request and the biggest change to how the toy feels. Shipping only water still gives the child a brand-new way to play on top of the existing sand.

**Independent Test**: Select 💧, pour a blob onto the floor, and confirm it flattens and spreads rather than piling; pour into a sand valley and confirm it settles into the hollow. The falling/spreading rules are additionally verifiable in automated tests against the grid state alone, with no browser.

**Acceptance Scenarios**:

1. **Given** the 💧 tool is selected, **When** the child presses and drags on the play area, **Then** water is deposited continuously along the drag path, exactly like sand deposition.
2. **Given** a water cell with an empty cell directly below it, **When** the simulation advances one step, **Then** the water moves down one cell.
3. **Given** a water cell that cannot move down but has an empty cell diagonally below (left or right), **When** the simulation advances one step, **Then** the water moves into an available diagonal cell.
4. **Given** a water cell that cannot move down or diagonally down but has an empty cell directly to its left or right, **When** the simulation advances one step, **Then** the water moves sideways into an available neighbour, chosen at random when both sides are open.
5. **Given** a tall single-cell column of water resting on the floor, **When** the simulation runs until nothing moves, **Then** the water has flattened into a wide sheet no more than one or two cells taller at its middle than at its edges.
6. **Given** a bowl-shaped hollow in a sand pile, **When** the child pours water into it, **Then** the water collects in the hollow and stays there rather than draining through the sand.
7. **Given** water resting against the left or right wall of the play area, **When** the simulation advances, **Then** the water stays inside the play area — none leaks out or disappears.
8. **Given** a settled body of water on screen, **When** the child looks at it, **Then** individual cells show visibly different blue shades within a narrow blue range — each cell's shade fixed from the moment it was drawn and carried with it as it flows — so the water reads as lively rather than as a flat blue rectangle.
9. **Given** any arrangement of water on screen, **When** the simulation advances, **Then** no water cell ever moves to a higher row than it already occupies; water only falls, slides down, or spreads sideways.

---

### User Story 2 - Sink pink sand through the water (Priority: P2)

The child has a puddle or a pool on screen. She switches back to 🩷 and pours sand over it. The sand does not float and does not sit on the surface — it falls straight into the water and keeps going down through it until it reaches the bottom, where it piles up as usual, with the water pushed up out of the way above it. She can bury the bottom of a pool in pink sand and watch the water end up sitting on top.

**Why this priority**: This is the interaction that makes water feel real to a small child, and it is the second thing the requester asked for by name. It only makes sense once water exists, so it follows User Story 1.

**Independent Test**: Fill part of the play area with water, then pour sand into it and confirm every grain travels to the bottom of the pool and the water level rises above the deposited sand. Fully verifiable in automated tests against grid state, with no browser.

**Acceptance Scenarios**:

1. **Given** a grain of sand with a water cell directly below it, **When** the simulation advances one step, **Then** the sand and the water exchange places — the sand moves down, the water moves up into the cell the sand left.
2. **Given** a column of water with sand poured on top, **When** the simulation runs until nothing moves, **Then** all of the sand rests at the bottom of the column and all of the water sits above it.
3. **Given** sand sinking through water, **When** the simulation runs, **Then** no water cell and no sand cell is created or destroyed — the count of each is the same before and after.
4. **Given** a grain of magic purple dirt with water directly below it, **When** the simulation advances, **Then** it sinks through the water exactly as pink sand does.
5. **Given** water with sand resting below it, **When** the simulation advances, **Then** the water does not sink into or swap down through the sand.

---

### User Story 3 - Build with a second color: magic purple dirt (Priority: P3)

The child taps the 💜 button and draws. Purple powder pours out and behaves just like her pink sand — it falls, tumbles down slopes, and piles up — but it is purple, with each grain a slightly different shade, so she can build a pink hill next to a purple hill, or stripe the two together, and tell them apart at a glance.

**Why this priority**: Purple dirt is the smallest of the three slices — it reuses the behavior the toy already has and adds expressive range rather than new mechanics. Delightful, but the toy is complete without it.

**Independent Test**: Select 💜, draw a pile, and confirm it falls and slopes exactly like pink sand while being clearly purple with visible per-grain shade variation; draw pink and purple side by side and confirm the two piles stay visually distinct and interleave without either turning into the other.

**Acceptance Scenarios**:

1. **Given** the 💜 tool is selected, **When** the child presses and drags, **Then** purple grains are deposited continuously along the drag path.
2. **Given** a grain of purple dirt with an empty cell below it, **When** the simulation advances, **Then** it falls, and when blocked below it slides diagonally, forming sloped piles rather than single-cell towers.
3. **Given** the same drawing made once in pink sand and once in purple dirt, **When** both simulations settle, **Then** the two piles have the same shape — purple dirt is pink sand's rules in a purple palette, with no steeper or stickier piling.
4. **Given** pink sand and purple dirt piled together, **When** the simulation runs, **Then** each grain keeps its own element and color — grains never change type or swap colors with each other.
5. **Given** a pile of purple dirt on screen, **When** the child looks at it, **Then** individual grains show visibly different purple shades within a narrow purple range, distinct from the pink range at a glance.
6. **Given** a grain of pink sand resting directly on a grain of purple dirt (or the reverse), **When** the simulation advances, **Then** neither sinks through the other; powders rest on powders.

---

### User Story 4 - Pick any element, erase anything, clear everything (Priority: P3)

The child sees the three element buttons 🩷 💧 💜 sitting together as an obvious little family at one end of the toolbar, with the eraser, the clear button, and the brush sizes elsewhere. Whichever one she has picked is unmistakably lit up. She can drag the 🧽 eraser over sand, water, or purple dirt and all of it disappears; 🗑️ empties the whole play area no matter what is in it.

**Why this priority**: The controls and cleanup have to work for the new elements or the toy becomes unusable, but this is polish on top of the behavior the other stories deliver.

**Independent Test**: Tap each of 🩷, 💧, 💜 in turn and confirm the highlight moves and the deposited element changes; drag the eraser through a mixed pile of all three and confirm everything under the brush is removed; tap 🗑️ with all three on screen and confirm the play area empties instantly.

**Acceptance Scenarios**:

1. **Given** the page has just loaded, **When** the child looks at the toolbar, **Then** 🩷 pink sand is the selected element and its button is visibly distinct from every other button.
2. **Given** any element is selected, **When** the child taps a different element button, **Then** that button becomes the visibly selected one and the previous one returns to its unselected appearance.
3. **Given** the child looks at the toolbar, **When** she scans it, **Then** the three element buttons appear next to each other as a visually grouped set, separate from the eraser, clear, and brush-size controls.
4. **Given** a mixed pile of pink sand, water, and purple dirt, **When** the child drags the 🧽 eraser across it, **Then** every cell inside the brush footprint is emptied regardless of which element occupied it.
5. **Given** all three elements are on screen, **When** the child taps 🗑️, **Then** the play area empties completely and immediately, with no confirmation.
6. **Given** a brush size is selected, **When** the child switches between 🩷, 💧, 💜, and 🧽, **Then** the same brush size still applies.

---

### Edge Cases

- **Painting an element onto a cell that already holds something**: the brush deposits into empty cells; in addition, pink sand and purple dirt may be painted directly into water cells (the heavier powder takes the cell), so a child can always add sand even when the screen is full of water. Water is never painted into a cell holding a powder — pouring water onto a sand pile leaves the sand intact.
- **Water trapped with nowhere to go**: water sealed inside a closed pocket of sand simply stops moving; it does not vanish, leak through the powder, or compress.
- **U-shaped container or a tall narrow neck**: because water only ever falls, slides down, or spreads sideways and never rises (FR-010), the two arms of a U-shape can settle at different heights and water does not climb back up a neck. This is accepted for this feature; each open container levels within itself, which is what a child pouring into a bowl or a valley actually sees.
- **Water poured against a wall**: it stacks up against the left/right wall and the floor like any closed container; nothing drains off the edges of the play area.
- **Sand dropped into a single-cell-wide water column**: the sand still reaches the bottom; the displaced water is pushed upward one cell at a time rather than being destroyed.
- **A powder grain fully surrounded by water**: it continues sinking until it reaches the floor or another powder grain.
- **Water above and powder below, both blocked**: neither moves; the pile is stable and the simulation stays quiet (no endless jittering that burns frames).
- **Play area completely full of water**: pouring more water simply has no visible effect; the toy stays responsive and reports nothing.
- **Eraser used inside a body of water**: the erased hole immediately refills as surrounding water flows in — the child sees water rush into the gap rather than a permanent square hole.
- **Very large amounts of water on screen**: the toy keeps its frame rate; if the whole play area is water, the simulation is still smooth.
- **All the edge cases from the pink-sand feature** (drawing at the play-area edge, fast drags, pointer leaving the window, multi-touch, resize/rotation, page reload) continue to apply unchanged and now apply to every element.

## Requirements *(mandatory)*

This feature extends the existing falling-pink-sand toy (spec `001-falling-pink-sand`). All requirements of that spec remain in force except where explicitly superseded below.

### Functional Requirements

**Elements and the grid**

- **FR-001**: Each grid cell MUST be either empty or hold exactly one element: pink sand, water, or magic purple dirt.
- **FR-002**: Every cell MUST carry a per-cell shade variation assigned when it is created and preserved as its contents move: pink shades for pink sand (unchanged from the existing feature), purple shades for magic purple dirt, and blue shades for water.
- **FR-003**: An element MUST NOT change into another element as a result of any simulation rule; the number of cells of each element MUST only change through the drawing tools (element brushes, eraser, clear-all).

**Water behavior**

- **FR-004**: On each simulation step, water with an empty cell directly below it MUST move into that cell.
- **FR-005**: On each simulation step, water that cannot move down but has at least one empty cell diagonally below (left or right) MUST move into one of the available diagonal cells; when both are available the choice MUST be random.
- **FR-006**: On each simulation step, water that cannot move down or diagonally down but has at least one empty cell directly to its left or right MUST move into one of them; when both are available the choice MUST be random. This sideways flow is what makes water spread out and level instead of piling.
- **FR-007**: Water with no empty cell below, diagonally below, or to either side MUST remain in place.
- **FR-008**: Water MUST come to rest against the floor and the left and right walls of the play area and MUST NOT leave the grid.
- **FR-009**: Water MUST NOT displace pink sand or magic purple dirt — it never moves into a cell occupied by a powder.
- **FR-010**: Water MUST level itself by simple flow only: FR-004 through FR-007 (fall, diagonal slide, sideways spread) are the complete set of water movement rules, and water MUST NOT move upward under any circumstance. Consequently, water left undisturbed in a single open container MUST settle to a flat surface, while the separate arms of a U-shaped container or a tall narrow neck MAY come to rest at different heights — that is accepted behavior for this feature, not a defect. No pressure-style or water-rises rule is in scope.

**Powder behavior**

- **FR-011**: Magic purple dirt MUST fall, slide diagonally, and come to rest under the same rules that already govern pink sand (existing spec FR-006 through FR-010), so it forms sloped piles rather than single-cell towers.
- **FR-012**: Pink sand and magic purple dirt MUST each rest on top of the other; neither sinks through the other, and mixed piles keep every grain's element and shade.
- **FR-013**: A powder (pink sand or magic purple dirt) with water directly below it MUST sink: the powder and the water exchange cells, so the powder moves down and the water moves up into the cell the powder vacated. Both cells keep their own shade variation.
- **FR-014**: A powder that cannot move down (into empty space or by displacing water) but has water or empty space diagonally below MUST move there under the same slide rule that already applies to sand, so sand still slopes when it lands on the floor of a pool.
- **FR-015**: Existing pink-sand behavior MUST NOT regress: every acceptance scenario and functional requirement of the falling-pink-sand feature MUST still hold, including in a play area containing no water and no purple dirt.
- **FR-016**: Magic purple dirt MUST pile identically to pink sand — same fall, slide, and rest rules, same slope, same sinking behavior in water. It is "purple sand": the only differences between the two powders are the toolbar button that deposits them and their color range. No steeper or stickier piling rule is in scope for this feature.

**Tools and toolbar**

- **FR-017**: The toolbar MUST offer three element tools — 🩷 pink sand, 💧 water, 💜 magic purple dirt — plus the existing 🧽 eraser, 🗑️ clear-all, and three brush sizes.
- **FR-018**: The three element buttons MUST be presented adjacent to one another as a visually grouped set, distinct from the eraser, clear-all, and brush-size controls.
- **FR-019**: Exactly one element or the eraser MUST be active at a time, and the active one MUST be shown in a clearly distinct visual state that is obvious at a glance from across a room.
- **FR-020**: 🩷 pink sand MUST remain the tool selected when the page loads.
- **FR-021**: The element brushes MUST deposit into empty cells inside the brush footprint. In addition, the pink-sand and purple-dirt brushes MUST be able to deposit into cells holding water (the powder takes the cell), so the child can always add powder to a water-filled play area.
- **FR-022**: The water brush MUST NOT overwrite pink sand or magic purple dirt; it deposits only into empty cells.
- **FR-023**: The 🧽 eraser MUST empty every cell inside the brush footprint regardless of which element occupies it.
- **FR-024**: The 🗑️ control MUST empty the entire play area of all elements immediately, with no confirmation, and MUST NOT change the selected tool or brush size.
- **FR-025**: Every control MUST remain a large, round, emoji-labeled button operable by a small child's finger on a tablet and understandable without reading, and the toolbar MUST still fit on screen without the page scrolling on both a laptop and a tablet.

**Appearance**

- **FR-026**: Water MUST be rendered in a lively blue that shows visible variation across a body of water rather than reading as a single flat blue block. That variation MUST come from a fixed per-cell blue shade assigned when the cell is created and carried with the cell as it moves or swaps — the same mechanism that already varies pink-sand grains (FR-002). An animated shimmer that changes over time is explicitly out of scope for this feature; the frame-rate targets in SC-006 take precedence over extra prettiness.
- **FR-027**: Magic purple dirt MUST be recognizably purple with per-grain shade variation, and MUST be distinguishable from pink sand at a glance when the two are piled next to each other.

**Performance and verification**

- **FR-028**: The simulation MUST stay smooth (target 60fps, acceptable ≥30fps) at the default grid resolution on a mid-range laptop and a tablet, including when the play area is at least half full of a mixture of all three elements and when it is entirely water.
- **FR-029**: The project MUST provide automated tests, runnable without a browser, covering water falling, water spreading sideways and leveling (FR-004 through FR-008, FR-010), powders sinking through water (FR-013, FR-014), water not displacing powders (FR-009), purple dirt piling identically to pink sand (FR-011, FR-016), and element conservation (FR-003).
- **FR-030**: The existing automated tests for the pink-sand rules MUST continue to pass unchanged.
- **FR-031**: The production build MUST still emit exactly one self-contained page, fully playable when opened directly from disk with no network requests.

### Key Entities

- **Element**: What a cell holds — one of empty, pink sand, water, or magic purple dirt. Determines how the cell moves and what color range it is drawn in.
- **Powder**: The family of elements that fall and pile — pink sand and magic purple dirt. Powders sink through water and rest on each other.
- **Liquid**: The family of elements that fall and spread sideways — water. Lighter than every powder.
- **Cell shade**: The per-cell color variation within its element's color range, assigned at creation and carried with the cell as it moves or swaps.
- **Tool selection**: Which of the three elements or the eraser is active, plus the active brush size. Persists across clear-all and across tool switches.

### Superseded requirements

- The falling-pink-sand spec's **SC-006** capped the toy at 6 on-screen controls. This feature adds two element buttons, so that cap is superseded: the toolbar MUST have at most 8 controls, and every one MUST still be reachable in a single tap from the play state.
- The falling-pink-sand spec's **FR-005** (cells are empty or hold one grain of sand) and **FR-021** (the exact control set) are superseded by FR-001 and FR-017 of this spec respectively. All of its other requirements stand.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A 4–5 year old can switch from pink sand to water and make water appear within 5 seconds, with no adult instruction and without reading anything.
- **SC-002**: A single-cell-wide column of water at least 20 cells tall, released onto a flat floor, settles into a sheet whose height varies by no more than 2 cells between its middle and its edges.
- **SC-003**: Water poured into a hollow in a sand pile stays in the hollow: after the simulation settles, 100% of the water cells are still inside the container, none having passed through the sand.
- **SC-004**: Sand poured onto the surface of a pool of at least 20 cells' depth reaches the bottom of the pool — after settling, every grain rests below every water cell in that column.
- **SC-005**: Across any run of the simulation with no drawing, the count of pink-sand cells, water cells, and purple-dirt cells each stay exactly constant — nothing is created, destroyed, or converted.
- **SC-006**: The toy renders at least 30 frames per second, targeting 60, on a mid-range laptop and on a tablet, in the worst observed case of a play area entirely filled with actively flowing water at the default grid resolution.
- **SC-007**: A play area containing only pink sand behaves identically to the previous release — all existing pink-sand acceptance scenarios and automated tests pass unchanged.
- **SC-008**: A single drag of the 🧽 eraser through a region containing all three elements leaves 0 occupied cells inside the brush footprint.
- **SC-009**: Tapping 🗑️ empties a play area holding all three elements within one frame, with no confirmation step.
- **SC-010**: A settled body of water shows at least 6 distinguishable blue shades, and a purple-dirt pile shows at least 8 distinguishable purple shades, all recognizable as blue and purple respectively.
- **SC-011**: An adult shown the toolbar can identify the three element buttons as a group, and can name the selected one, in under 2 seconds without hovering or tapping.
- **SC-012**: The automated test suite runs to completion without a browser and covers every new rule listed in FR-029, including the blocked-on-all-sides cases for both water and powders.
- **SC-013**: A production build still produces exactly one output file, and opening that file directly from disk yields a fully playable toy with zero network requests.
- **SC-014**: The same drawing made in pink sand and in magic purple dirt settles into the identical arrangement of occupied cells — the two powders differ only in button and color.
- **SC-015**: Across any run of the simulation, no water cell ever ends a step in a higher row than it started it — water never rises.

### Visual checks for the maintainer *(no automated coverage)*

- Water looks wet and lively — it reads as water at a glance, not as a blue rectangle.
- Water flowing into an erased hole or down a slope looks fun to watch, not sluggish or twitchy.
- Pink and purple piles read as two clearly different colors side by side, both cheerful.
- The three element buttons look like a family; the selected one is obvious from across a room.
- Pouring sand into water feels satisfying — the sand visibly sinks rather than snapping instantly to the bottom.

## Assumptions

- **Builds on the pink-sand feature**: this feature assumes the falling-pink-sand toy (grid, canvas, drawing, brushes, eraser, clear-all, resize handling, build, and test setup) exists and is the base being extended. All of its constraints — single self-contained page, no reading required, no failure states, mouse and touch — continue to apply.
- **Element set is closed for this feature**: exactly three elements (pink sand, water, magic purple dirt) plus the eraser. Rainbow 🌈 / unicorn 🦄 emoji objects and preloaded landscape scenes remain out of scope, per the constitution's target set and later issues.
- **Water is a simple cellular liquid, not a physics fluid**: no waves, no pressure visualization, no splashing droplets, no viscosity — the simplest rule that looks fun wins, per the project's simplicity principle. Confirmed in clarification: fall + diagonal slide + sideways spread is the whole model, and water never rises (FR-010).
- **Shimmer is a possible later follow-up**: animated water shading was considered and deliberately deferred (FR-026). If a later measurement shows obvious frame-rate headroom, it can be revisited as its own change; it is not part of this feature.
- **No new interactions between elements beyond density**: water does not make sand wet, does not stain purple dirt, does not evaporate, and does not freeze. Powders sink through water; that is the whole interaction.
- **Painting priority follows density**: the powder brushes may take a water cell (FR-021), the water brush may not take a powder cell (FR-022). This keeps every element reachable for the child without letting water accidentally destroy the hill she just built. Water displaced by a powder brush is simply removed rather than pushed elsewhere.
- **Sinking speed**: a powder sinks through water by one cell per simulation step, the same rate at which it falls through air, unless tuning shows a slower sink looks better; either is acceptable so long as SC-004 holds.
- **Brush sizes are shared**: the existing three brush sizes apply to all three elements and the eraser, with no per-element sizing.
- **Water pour rate**: holding still pours a continuous stream, tuned like the sand pour rate so a large brush does not instantly flood the play area.
- **No persistence**: drawings are still not saved; reloading starts from an empty play area.
- **Target devices unchanged**: a mid-range laptop with mouse/trackpad and a tablet with touch; phone-sized screens are not a target.
- **Toolbar growth**: going from 6 to 8 controls is accepted as the cost of two new elements; if 8 buttons cannot be laid out large enough for a small child's finger on a tablet without scrolling, the layout wraps to a second row rather than shrinking the buttons.
