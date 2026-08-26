# Feature Specification: Falling Pink Sand

**Feature Branch**: `spec-draft/001-falling-pink-sand`

**Created**: 2026-08-26

**Status**: Draft

**Input**: GitHub issue #1 — "Falling pink sand: project scaffold, canvas sim, and drawing"

> The foundation of Rainbow Sand: a project that builds to a single self-contained page and shows a falling-sand toy a 4–5 year old can play immediately. A big canvas fills most of the page with a cheerful pink/rainbow-themed header ("🌈 Rainbow Sand 🦄"). Press (or touch) and drag anywhere on the canvas to pour pink sand from your finger/cursor; sand falls, slides down slopes, and piles up naturally. Grains have slight per-grain pink shade variation so piles look pretty, not flat. A simple toolbar of big, round, emoji-labeled buttons (no reading required): 🩷 sand (selected by default), 🧽 eraser, 🗑️ clear everything (instant, no confirmation), and small/medium/large brush size buttons. Works with mouse and touch (tablet); continuous painting while dragging; no scrolling/zooming glitches while drawing. Simulation stays smooth (~60fps). The build emits exactly one page that works from `file://`; unit tests cover the sand falling/piling rules with no browser needed. Nothing she does should ever be "wrong": no dialogs, no text prompts, no failure states. Out of scope (later issues): water, other elements, rainbow/unicorn emoji objects, preloaded landscape scenes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pour pink sand and watch it pile up (Priority: P1)

The child opens the toy and sees a big empty play area under a cheerful rainbow header. She puts her finger (or the mouse) on the play area and drags. Pink sand pours out from under her finger, falls downward, tumbles down the sides of the heaps it lands on, and settles into natural-looking piles. Every grain is a slightly different shade of pink, so the heaps look soft and textured rather than like a flat block of color. She can keep drawing for as long as she likes; nothing interrupts her, and nothing she does produces an error, dialog, or message.

**Why this priority**: This is the entire toy. If only this ships, the child has something delightful to play with today. Every other story adds convenience on top of it.

**Independent Test**: Open the built page, press and drag across the play area, and confirm sand appears continuously under the pointer, falls, slides down slopes, and forms stable piles. The falling/piling rules are additionally verifiable in automated tests against the grid state alone, with no browser.

**Acceptance Scenarios**:

1. **Given** an empty play area, **When** the child presses and holds at one spot, **Then** sand pours continuously from that spot and accumulates below it.
2. **Given** the child is pressing, **When** she drags across the play area, **Then** sand is deposited continuously along the whole path with no gaps between sampled positions, even during a fast drag.
3. **Given** a grain of sand with empty space directly below it, **When** the simulation advances one step, **Then** the grain moves down one cell.
4. **Given** a grain of sand resting on another grain with empty space diagonally below-left and below-right, **When** the simulation advances one step, **Then** the grain moves into one of those diagonal cells (chosen at random), producing sloped piles rather than towers.
5. **Given** a grain of sand resting on another grain with both diagonal cells below blocked, **When** the simulation advances, **Then** the grain does not move.
6. **Given** sand falling toward the floor of the play area, **When** it reaches the bottom, **Then** it stops there and subsequent grains stack on top of it.
7. **Given** a pile of sand on screen, **When** the child looks at it, **Then** individual grains show visibly different pink shades within a narrow pink range.
8. **Given** the child releases the pointer, **When** she lifts her finger, **Then** no new sand is deposited but existing sand keeps settling until it comes to rest.

---

### User Story 2 - Erase and clear (Priority: P2)

The child wants to undo part of her picture or start over. She taps the 🧽 eraser button and drags over the play area; everything she drags across disappears. When she wants a completely fresh page, she taps the 🗑️ button and the play area empties instantly — no confirmation, no question, no dialog.

**Why this priority**: Without a way to remove sand, the play area fills up and the toy becomes unusable after a few minutes. It is the first thing needed after drawing itself, but drawing alone is still a viable toy for one session.

**Independent Test**: With sand on screen, select the eraser and drag over a pile — the dragged region becomes empty while surrounding sand remains and keeps settling. Tap clear and confirm the whole play area is empty immediately.

**Acceptance Scenarios**:

1. **Given** the eraser is selected and there is sand on screen, **When** the child presses and drags over sand, **Then** the sand under the brush is removed continuously along the drag path.
2. **Given** the eraser is selected, **When** the child drags over empty space, **Then** nothing happens and no error or message appears.
3. **Given** sand on screen, **When** the child taps 🗑️, **Then** the play area is empty immediately with no confirmation step.
4. **Given** the child has just cleared the play area, **When** she presses and drags again, **Then** the previously selected tool is still selected and drawing resumes normally.

---

### User Story 3 - Choose a tool and a brush size without reading (Priority: P3)

The child sees a row of big, round, emoji-labeled buttons. 🩷 sand is already selected when the page opens, and the selected button is obviously different from the others (clearly highlighted). She taps the brush-size buttons to pour a thin trickle, a normal stream, or a wide gush of sand, and she can see from the buttons' own sizes which is which. She never has to read a word.

**Why this priority**: The defaults (sand selected, medium brush) already make the toy playable, so this is the last slice. It makes the toy more expressive and is required for the eraser to be reachable.

**Independent Test**: Open the page and confirm 🩷 is visibly selected; tap each button and confirm the selection state moves; draw with each brush size and confirm the deposited stroke width changes noticeably between small, medium, and large.

**Acceptance Scenarios**:

1. **Given** the page has just loaded, **When** the child looks at the toolbar, **Then** the 🩷 sand tool is selected and its button is visually distinct from the unselected buttons.
2. **Given** any tool is selected, **When** the child taps a different tool button, **Then** that button becomes the visibly selected one and the previous one returns to its unselected appearance.
3. **Given** the small brush is selected, **When** the child draws, **Then** a narrow stroke of sand is deposited; **and** with the large brush selected the stroke is visibly much wider.
4. **Given** a brush size is selected, **When** the child switches between the sand and eraser tools, **Then** the same brush size applies to the tool she switches to.
5. **Given** the child looks at the brush-size buttons, **When** she compares them, **Then** their visual size ordering communicates small/medium/large without any text.

---

### Edge Cases

- **Drawing at the very edge of the play area**: a brush centered near an edge deposits only the part of the brush that falls inside the play area; nothing is written outside the grid and no error occurs.
- **Sand reaching the floor and side walls**: the play area is a closed box — grains pile against the floor and the left/right walls rather than draining away, so a child can fill the whole area if she wants (🗑️ is the reset).
- **Play area completely full**: continuing to draw simply has no visible effect; the toy stays responsive and never reports a failure.
- **Fast drag / dropped pointer samples**: the deposited stroke is continuous — the toy fills in between consecutive pointer positions rather than leaving a dotted line.
- **Pointer leaves the play area while pressed**: deposition stops at the boundary; when the pointer returns while still pressed, deposition resumes without a stray line connecting the exit and re-entry points.
- **Touch gestures on a tablet**: pressing and dragging inside the play area paints and never scrolls, pans, bounces, or triggers pinch-zoom or double-tap-zoom on the page.
- **Multiple simultaneous touches**: a second finger touching the play area must not corrupt the drawing or crash the toy; the toy either paints from the additional touch or ignores it, but never gets stuck in a pressed state.
- **Pointer released outside the window**: the toy does not stay stuck in "pouring" mode after the child lifts her finger off the edge of the screen.
- **Window resized or tablet rotated mid-play**: [NEEDS CLARIFICATION: should the existing drawing be preserved (scaled or cropped) across a resize/rotation, or is it acceptable for the play area to reset to empty?]
- **Page reloaded**: the play area starts empty; no drawing is saved between sessions.

## Requirements *(mandatory)*

### Functional Requirements

**Layout and presentation**

- **FR-001**: The toy MUST present a single screen consisting of a decorative header reading "🌈 Rainbow Sand 🦄", a toolbar of controls, and a play area that occupies the majority of the visible page.
- **FR-002**: The header and overall styling MUST use a cheerful pink/rainbow palette consistent with the project's joyful-palette principle.
- **FR-003**: The play area MUST fit within the visible page on both a laptop screen and a tablet screen without the page scrolling.
- **FR-004**: The toy MUST contain no text prompts, dialogs, confirmations, scores, timers, or error messages, and no links leading away from the page.

**Sand simulation**

- **FR-005**: The play area MUST be modeled as a fixed grid of cells, each cell either empty or holding one grain of sand.
- **FR-006**: On each simulation step, a grain with an empty cell directly below it MUST move into that cell.
- **FR-007**: On each simulation step, a grain that cannot move down but has at least one empty cell diagonally below (left or right) MUST move into one of the available diagonal cells; when both are available the choice MUST be random, so piles slope instead of forming single-cell towers.
- **FR-008**: A grain with no empty cell below or diagonally below MUST remain in place.
- **FR-009**: Grains MUST NOT move outside the grid, overwrite another grain, duplicate themselves, or disappear as a result of the simulation rules.
- **FR-010**: The grid boundary MUST behave as a closed container: grains come to rest against the floor and the left and right walls.
- **FR-011**: The simulation MUST continue advancing on its own while the page is open, so sand keeps settling after the child stops drawing.
- **FR-012**: Each grain MUST carry a slight individual pink shade variation, assigned when the grain is created and preserved as the grain moves, so piles show visible texture within a recognizably pink range.

**Drawing**

- **FR-013**: Pressing on the play area MUST begin applying the selected tool at that position, and the toy MUST keep applying it continuously while the press is held, including while the pointer is stationary (pouring).
- **FR-014**: While the press is held and the pointer moves, the tool MUST be applied continuously along the path travelled, with no gaps between sampled pointer positions.
- **FR-015**: Releasing the press, or the press ending for any reason (including leaving the window), MUST stop applying the tool.
- **FR-016**: The toy MUST respond identically to mouse input and to touch input.
- **FR-017**: Touch interaction inside the play area MUST NOT cause page scrolling, panning, rubber-banding, pinch-zoom, or double-tap-zoom.
- **FR-018**: The sand tool MUST add grains inside the brush footprint, only into cells that are currently empty.
- **FR-019**: The eraser tool MUST remove the contents of every cell inside the brush footprint.
- **FR-020**: Brush footprints extending past the grid boundary MUST be clipped silently.

**Controls**

- **FR-021**: The toolbar MUST offer exactly these controls: 🩷 sand, 🧽 eraser, 🗑️ clear everything, and three brush sizes (small, medium, large).
- **FR-022**: Every control MUST be a large, round, emoji-labeled button that is operable by a small child's finger on a tablet and understandable without reading.
- **FR-023**: The sand tool MUST be selected when the page loads, and the medium brush size MUST be the default.
- **FR-024**: The currently selected tool and the currently selected brush size MUST each be shown in a clearly distinct visual state from the unselected options.
- **FR-025**: The brush-size buttons MUST convey their relative sizes visually (their rendered symbols increase in size in the same order as the brush they select).
- **FR-026**: Selecting a brush size MUST apply to whichever tool is active, and MUST persist when the child switches tools.
- **FR-027**: The 🗑️ control MUST empty the entire play area immediately, with no confirmation.
- **FR-028**: Using 🗑️ MUST NOT change the selected tool or brush size.

**Delivery and verification**

- **FR-029**: The production build MUST emit exactly one output file — a single self-contained page — with no external runtime requests.
- **FR-030**: The built page MUST be fully playable when opened directly from disk (no web server).
- **FR-031**: The project MUST provide an automated test suite, runnable without a browser, that covers the falling, sliding, and resting rules (FR-006 through FR-010) directly against grid state.
- **FR-032**: The project MUST provide a documented command to build and a documented command to run the tests, both succeeding from a clean checkout.

### Key Entities

- **Grid**: The fixed-size rectangular field of cells backing the play area. Knows its width and height in cells and the contents of every cell.
- **Cell**: One position in the grid; either empty or occupied by a single grain.
- **Grain**: One unit of pink sand. Carries its own shade variation, which travels with it as it falls.
- **Tool selection**: Which of sand or eraser is active, plus the active brush size. Persists across clear-all and across tool switches.
- **Brush**: The footprint applied around the pointer position by the active tool, sized by the active brush size.
- **Stroke**: A press-drag-release interaction; a continuous sequence of pointer positions along which the active tool is applied.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A 4–5 year old can make pink sand appear within 5 seconds of seeing the page, with no adult instruction and without reading anything.
- **SC-002**: Sand poured onto the floor forms a heap with sloped sides; no single-cell towers taller than 2 cells persist once the sand has settled.
- **SC-003**: The toy renders at least 30 frames per second, targeting 60, on a mid-range laptop and on a tablet, with the play area at least half full of sand.
- **SC-004**: While pressing and dragging anywhere on the play area on a tablet, the page never scrolls, zooms, or bounces — 0 unintended view changes across a 60-second continuous drawing session.
- **SC-005**: A stroke drawn as a fast continuous drag leaves an unbroken trail of sand — no gaps between successive pointer samples.
- **SC-006**: A child can reach any control (tool, brush size, clear) in a single tap from the play state; there are never more than 6 controls on screen.
- **SC-007**: Tapping 🗑️ empties the play area within one frame and presents no confirmation step.
- **SC-008**: A production build produces exactly one output file, and opening that file directly from disk yields a fully playable toy with zero network requests.
- **SC-009**: The automated test suite runs to completion without a browser and covers every falling/sliding/resting rule, including the blocked-on-all-sides case.
- **SC-010**: Sand piles show at least 8 distinguishable pink shades across a full play area, all recognizable as pink.

### Visual checks for the maintainer *(no automated coverage)*

- Piles look soft and textured, not like a flat pink block.
- The header and toolbar read as cheerful and rainbow-themed at a glance.
- The selected-tool highlight is obvious from across a room.
- Drawing feels immediate — sand appears under the finger with no perceptible lag.

## Assumptions

- **Grid resolution**: [NEEDS CLARIFICATION: what grid resolution (grains across the play area) is the default? A coarser grid means chunky, very visible grains and headroom for performance; a finer grid means smoother, more sand-like piles but a heavier simulation.] Pending an answer, the assumption is a resolution chosen so that grains are individually visible to a small child while meeting SC-003.
- **Brush sizes**: small / medium / large are three clearly distinguishable footprint radii, with large roughly 4–5× the small footprint's width; exact values are an implementation choice as long as SC-005 and FR-025 hold.
- **Pour rate**: holding still pours a continuous stream rather than depositing a single stamp; the rate is tuned so a large brush does not instantly fill the screen.
- **Sand density**: the sand tool fills the brush footprint fully rather than sprinkling sparsely; this keeps behavior predictable for a small child.
- **No persistence**: drawings are not saved; reloading starts from an empty play area. Persistence is out of scope.
- **Single-child, offline use**: no accounts, no networking, no analytics, no sharing.
- **Out of scope for this feature** (deferred to later issues per the source request): water, additional element types, rainbow/unicorn emoji objects, and preloaded landscape scenes. Undo is also out of scope — 🧽 and 🗑️ cover correction.
- **Deployment**: the same single built page is what gets published; no deployment changes are introduced by this feature beyond producing that file.
- **Target devices**: a mid-range laptop with mouse/trackpad and a tablet with touch. Phone-sized screens are not a target for this feature.
