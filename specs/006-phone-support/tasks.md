---

description: "Task list for Phone Support (006)"
---

# Tasks: Phone Support

**Input**: Design documents from `/specs/006-phone-support/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/layout-and-touch.md, quickstart.md

**Tests**: Automated tests ARE explicitly required by this feature (FR-035, constitution Principle V — no browser harness). Test tasks below are not optional.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

Single client-only project (established by 001–005): `src/sim/*` (framework-free core), `src/lib/*` (Svelte components + layout helpers), `tests/unit/sim/*`, `tests/unit/lib/*` (new this feature). Paths below match plan.md's Project Structure exactly.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Nothing new to scaffold — this feature extends the existing 001–005 project (`package.json`, build tooling, `vitest` config all already in place, per plan.md/quickstart.md). No new dependency is added (research.md §12).

- [ ] T001 Confirm `npm install` and `npm test` succeed from a clean checkout with all pre-existing `tests/unit/sim/*.test.ts` passing, establishing the pre-change baseline before any edits in this feature

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Rewrite `src/lib/layout.ts`'s exported surface and add the new `tests/unit/lib/` directory's fixture table. Every user story's automated tests and `PlayArea.svelte` changes depend on `computePlayField`/`isPhoneSized`/`computeToolbarLayout`/the new constants existing first.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete — `computeCanvasSize`'s removal and `computePlayField`'s addition is a breaking rewrite of `layout.ts`'s exported surface that every other task in this feature builds on.

- [ ] T002 Rewrite `src/lib/layout.ts`: remove `computeCanvasSize`; keep `GRID_WIDTH = 270`, `GRID_HEIGHT = 160`, `BRUSH_RADII`, `OBJECT_FOOTPRINT_SIZE` unchanged; add `CELL_BUDGET = GRID_WIDTH * GRID_HEIGHT`, `MIN_CELL_SIZE = 2`, `MEDIUM_STROKE_MIN_PX = 24`, `PHONE_MAX_SHORT_SIDE = 480`, `MIN_TOUCH_TARGET = 44`, `RESIZE_SETTLE_MS = 150`, and the `PlayField`/`ToolbarLayoutCheck` interfaces, per contracts/layout-and-touch.md
- [ ] T003 [P] Implement `isPhoneSized(viewportWidth, viewportHeight): boolean` in `src/lib/layout.ts` — `true` iff `Math.min(viewportWidth, viewportHeight) <= PHONE_MAX_SHORT_SIDE` (research.md §2)
- [ ] T004 [P] Implement `computePlayField(drawingRegionWidth, drawingRegionHeight, isPhone): PlayField` in `src/lib/layout.ts` per the formula in research.md §1: `cellSize = max(MIN_CELL_SIZE, budgetFloor, phoneStrokeFloor)`, `gridWidth = floor(regionW / cellSize)`, `gridHeight = floor(regionH / cellSize)`, both floored to a minimum of 1 cell for degenerate (near-zero) inputs (data-model.md validation rules)
- [ ] T005 [P] Implement `computeToolbarLayout(viewportWidth, viewportHeight, controlCount, groupCount): ToolbarLayoutCheck` in `src/lib/layout.ts` per research.md §6/data-model.md's Toolbar layout section — models control size, gaps, and group padding using `MIN_TOUCH_TARGET`, returning `{ fits, controlSize, thickness }`
- [ ] T006 Create `src/sim/resize.ts` exporting `resizeGrid(oldGrid, newWidth, newHeight): { grid, offsetX, offsetY }` per contracts/layout-and-touch.md: allocates via `createGrid(newWidth, newHeight)`, computes `offsetX = round((newWidth - oldGrid.width) / 2)` and `offsetY = newHeight - oldGrid.height`, copies every non-`OBJECT` source cell's `elements`/`shades`/`hues`/`glitter` to its offset destination when in bounds, drops it otherwise, never copies `OBJECT` cells or `moved`, never mutates `oldGrid`

**Checkpoint**: `layout.ts` and `resize.ts` exports exist and compile — user story implementation and their tests can now proceed.

---

## Phase 3: User Story 1 - The drawing area fills the phone screen (Priority: P1) 🎯 MVP

**Goal**: Replace the fixed 270×160 play field with one whose shape and resolution derive from the drawing region, so a phone gets a play area that fills the screen with chunky, finger-friendly grains, while desktop stays at least as good as today.

**Independent Test**: Run `tests/unit/lib/layout.test.ts` against a representative viewport table (phone portrait/landscape, small phone, tablet portrait/landscape, laptop, extreme aspect ratio) and confirm fill percentages, square cells, minimum cell size, minimum medium-stroke width, cell-count budget, and laptop non-regression all pass without a browser.

### Tests for User Story 1 ⚠️

- [ ] T007 [P] [US1] Create `tests/unit/lib/layout.test.ts` with the representative viewport table (phone portrait 390×844, phone landscape 844×390, small phone 320×568, tablet portrait 768×1024, tablet landscape 1024×768, laptop 1440×900, extreme aspect ratio e.g. 400×1400) and assert for each entry via `computePlayField`: `displayWidth/drawingRegionWidth >= 0.90` and `displayHeight/drawingRegionHeight >= 0.90` (FR-001); on phone-sized entries, `displayWidth * displayHeight` covers `>= 0.65` (portrait) / `>= 0.60` (landscape) of the viewport area (FR-002); `cellSize` identical on both axes (FR-003); `cellSize >= MIN_CELL_SIZE` always, and `cellSize >= MEDIUM_STROKE_MIN_PX / (2 * BRUSH_RADII.medium + 1)` on phone-sized entries (FR-005, FR-006); `gridWidth * gridHeight <= CELL_BUDGET` (FR-007) — per quickstart.md's User Story 1 automated coverage section
- [ ] T008 [P] [US1] Add a laptop-viewport case to `tests/unit/lib/layout.test.ts` asserting `computePlayField`'s `displayWidth`/`displayHeight` for a 1440×900 drawing region are each `>=` what today's fixed-grid formula (`GRID_WIDTH`/`GRID_HEIGHT` at the largest integer cell size fitting the same region) would have produced (FR-030, SC-006)

### Implementation for User Story 1

- [ ] T009 [US1] In `src/lib/PlayArea.svelte`, make module-scope `grid`, `imageData`, and `flashMask` reassignable (`let` instead of `const`), and change the initial `createGrid(...)` call to use the first computed `PlayField`'s `gridWidth`/`gridHeight` instead of the removed `GRID_WIDTH`/`GRID_HEIGHT` constants
- [ ] T010 [US1] In `src/lib/PlayArea.svelte`, replace the `computeCanvasSize` call in the existing `resize()` with `isPhoneSized(viewportW, viewportH)` + `computePlayField(container.clientWidth, container.clientHeight, isPhone)`, measuring the viewport via `window.innerWidth`/`innerHeight` for now (visualViewport wiring lands in US3); update the canvas's CSS `width`/`height` display size from the result's `displayWidth`/`displayHeight`
- [ ] T011 [US1] Add `min-width: 0` alongside the existing `min-height: 0` on `.play-area-container`'s CSS in `src/lib/PlayArea.svelte` (research.md §6/§7)

**Checkpoint**: At this point, User Story 1 is fully functional and testable independently — the play area fills the drawing region on phone-sized viewports and desktop is unregressed.

---

## Phase 4: User Story 2 - Drawing with a finger actually works (Priority: P2)

**Goal**: Ensure touch drawing (press-and-drag, tap, eraser, object placement) works correctly at the new on-screen scale, and that touch-to-cell coordinate mapping stays exact after any resize.

**Independent Test**: `tests/unit/lib/layout.test.ts`'s coordinate-mapping assertions confirm touch points map to the correct cell at several on-screen scales and at the play area's edges, without a browser; on-device checks on Android Chrome/iOS Safari cover the rest (not automatable).

### Tests for User Story 2 ⚠️

- [ ] T012 [P] [US2] Add coordinate-mapping assertions to `tests/unit/lib/layout.test.ts`: reimplement `clientToGrid`'s formula (`scaleX = gridWidth / rect.width`, `scaleY = gridHeight / rect.height`, floored cell coords) as a pure test helper and assert a representative set of touch points — including all four edges of the play area — map to the expected cell at several of the table's on-screen scales, with no drift after a simulated resize (FR-012)

### Implementation for User Story 2

- [ ] T013 [US2] In `src/lib/PlayArea.svelte`, update `clientToGrid` to read `grid.width`/`grid.height` from the live (reassignable) `grid` instance instead of the formerly-imported `GRID_WIDTH`/`GRID_HEIGHT` constants (research.md §10)
- [ ] T014 [US2] In `index.html`, add `user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;` to the existing `html, body` CSS rule alongside `overscroll-behavior: none; touch-action: none;` (FR-013, research.md §9)
- [ ] T015 [US2] [P] In `src/lib/Toolbar.svelte`, add `user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;` to `.control`'s styles so a long or fast tap never triggers a text-selection callout (FR-013)

**Checkpoint**: At this point, User Stories 1 AND 2 both work independently — touch drawing maps correctly to cells at any on-screen scale, and remaining browser-gesture interference is closed by CSS.

---

## Phase 5: User Story 3 - The buttons are always there and always tappable (Priority: P3)

**Goal**: The toolbar stays fully visible and tappable on any phone viewport/orientation, wrapping in portrait and forming a rail in landscape, without ever pushing the play area below its fill floors, and without any control being obscured by device chrome (notch/home-indicator) or a collapsing address bar.

**Independent Test**: `tests/unit/lib/layout.test.ts`'s `computeToolbarLayout` assertions confirm every phone-sized table entry fits all controls at or above the 44px minimum touch target, and that the resulting drawing region still satisfies User Story 1's fill floors; on-device checks confirm real CSS flexbox wrap/rail behavior, address-bar collapse handling, and notch/home-indicator clearance.

### Tests for User Story 3 ⚠️

- [ ] T016 [P] [US3] Add toolbar-fit assertions to `tests/unit/lib/layout.test.ts`: for every phone-sized entry in the representative viewport table, assert `computeToolbarLayout(viewportWidth, viewportHeight, controlCount, groupCount).fits === true` with `controlSize >= MIN_TOUCH_TARGET`, using literal constants for `controlCount`/`groupCount` mirroring `Toolbar.svelte`'s actual control/group count (FR-020, FR-035), and that the drawing region computed as `viewport minus thickness` on the appropriate axis still satisfies FR-001/FR-002 when passed through `computePlayField` (FR-020a)

### Implementation for User Story 3

- [ ] T017 [US3] In `src/lib/PlayArea.svelte`, replace the direct `window.innerWidth`/`innerHeight` viewport read from T010 with `window.visualViewport?.width`/`.height` falling back to `window.innerWidth`/`innerHeight` (research.md §8)
- [ ] T018 [US3] In `src/lib/PlayArea.svelte`, implement `scheduleResize()`: a `RESIZE_SETTLE_MS`-debounced wrapper (clears/restarts a timer) around the existing resize logic, wired to fire from the existing `ResizeObserver` on `container`, a new `window.visualViewport` `resize` listener, and a new `window.orientationchange` listener, so only the debounce's expiry triggers the actual measurement/computation (FR-027, research.md §4)
- [ ] T019 [US3] In `src/lib/layout.ts` and `src/lib/Toolbar.svelte`, export `MIN_TOUCH_TARGET` as an inline CSS custom property on the toolbar's root element (e.g. `style="--control-min: {MIN_TOUCH_TARGET}px"`) and reference it from `.control`'s size rules, so the test model and real CSS share one source of truth (research.md §6)
- [ ] T020 [US3] In `src/lib/Toolbar.svelte`, add `padding: env(safe-area-inset-bottom) env(safe-area-inset-right) env(safe-area-inset-left)` (or the appropriate subset per row vs. rail layout) to `.toolbar` so no control sits under a notch or home-indicator (FR-023)
- [ ] T021 [US3] In `index.html`, add `viewport-fit=cover` to the `<meta name="viewport">` tag so `env(safe-area-inset-*)` resolves to non-zero values on notched devices (FR-023, research.md §9)
- [ ] T022 [US3] In `src/App.svelte`, add `height: 100dvh` after the existing `height: 100vh` on `main`'s CSS (fallback ordering, research.md §8), and add a new media query `@media (max-height: 480px) and (orientation: landscape)` setting `main`'s `flex-direction: row` (FR-020a)
- [ ] T023 [US3] In `src/lib/Toolbar.svelte`, inside the new landscape-phone media query (`@media (max-height: 480px) and (orientation: landscape)`), switch `.toolbar` to `flex-direction: column; flex-wrap: wrap` (from the default `row; wrap`) so it forms a side rail (FR-020a)

**Checkpoint**: All three of User Stories 1–3 work independently — the play area fills the screen, touch drawing maps correctly, and the toolbar stays fully visible/tappable in both orientations without eating into the play area.

---

## Phase 6: User Story 4 - Turning the phone sideways keeps the fun going (Priority: P4)

**Goal**: When a re-derivation occurs (orientation change or a large enough viewport shape change), carry the drawing across via the bottom-centre-anchored offset from `resizeGrid`, ending any in-progress stroke cleanly and preserving the selected tool/brush size, while leaving non-re-deriving viewport changes (address bar collapse, desktop nudge) exactly untouched.

**Independent Test**: `tests/unit/sim/resize.test.ts` seeds a `Grid` with a recognizable pattern and asserts `resizeGrid`'s offset/carry/drop/identity behavior without a browser; on-device checks confirm the real rotation flow in `PlayArea.svelte` preserves drawings and ends strokes cleanly.

### Tests for User Story 4 ⚠️

- [ ] T024 [P] [US4] Create `tests/unit/sim/resize.test.ts`: seed a `Grid` via `setCell` with a "ground" row near the bottom plus an off-centre pile, call `resizeGrid` for a narrower/taller and a wider/shorter target, and assert every carried cell lands at exactly `(x + offsetX, y + offsetY)` (FR-026), cells whose offset destination falls outside the new bounds are absent (not clamped/wrapped), and a cell adjacent to the bottom row before the resize is still adjacent to the bottom row after
- [ ] T025 [P] [US4] Add an identity-case assertion to `tests/unit/sim/resize.test.ts`: calling `resizeGrid(grid, oldGrid.width, oldGrid.height)` is a no-op copy — every cell lands at its original position, `offsetX === 0 && offsetY === 0`
- [ ] T026 [P] [US4] Add an object-footprint assertion to `tests/unit/sim/resize.test.ts` (using `placeObject`/`getElement` from `objects.ts`/`grid.ts`): an object whose entire offset footprint fits the new bounds keeps its exact new position and size; one that doesn't fully fit is absent entirely — no partial/half-object state (per the caller-level repositioning logic described in contracts/layout-and-touch.md, verified here at the data level)
- [ ] T027 [P] [US4] Add a distinguishability assertion to `tests/unit/lib/layout.test.ts`: a small viewport change representing an address-bar collapse (same `gridWidth`/`gridHeight` from `computePlayField`) is distinguishable by pure comparison from one that changes `gridWidth`/`gridHeight` (the re-derivation trigger condition, FR-025 vs FR-026)

### Implementation for User Story 4

- [ ] T028 [US4] In `src/lib/PlayArea.svelte`, in the debounced `resize()`/`scheduleResize()` handler from T018, add the compare step: if the newly computed `field.gridWidth === grid.width && field.gridHeight === grid.height`, update only `displayWidth`/`displayHeight` (leave `grid`/`imageData`/`flashMask`/`objectsState` untouched — FR-025); otherwise proceed to the re-derivation branch below
- [ ] T029 [US4] In `src/lib/PlayArea.svelte`'s re-derivation branch, call `resizeGrid(grid, field.gridWidth, field.gridHeight)`, reassign `grid` to the returned instance, reallocate `imageData`/`flashMask` at the new dimensions, and update the canvas's `width`/`height` attributes and `displayWidth`/`displayHeight` (FR-026)
- [ ] T030 [US4] In `src/lib/PlayArea.svelte`'s re-derivation branch, reposition `objectsState.rainbows`/`.unicorns` by the same `offsetX`/`offsetY` returned from `resizeGrid`: keep and re-stamp an object's `OBJECT` footprint into the new grid only if its entire offset footprint (`x+offsetX .. x+offsetX+size-1`, `y+offsetY .. y+offsetY+size-1`) fits `[0, newWidth) × [0, newHeight)`; otherwise drop it from its list entirely (FR-026, Edge Cases)
- [ ] T031 [US4] In `src/lib/PlayArea.svelte`'s re-derivation branch, if `drawing` is `true`, set `drawing = false` and `lastGridPos = null` so an in-progress stroke ends cleanly rather than continuing across the swap (FR-028); leave `tool`/`brushSize` (owned by `App.svelte`) untouched

**Checkpoint**: All four user stories are independently functional — rotation carries the drawing across with bottom-centre anchoring, address-bar collapses and desktop nudges preserve the drawing exactly, and in-progress strokes end cleanly on re-derivation.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation that the whole feature holds together — non-regression, build, and the manual/on-device checks quickstart.md calls out as the maintainer's job.

- [ ] T032 Run `npm test` and confirm every pre-existing test in `tests/unit/sim/{grid,step,brush,objects,scenes,wand}.test.ts` still passes unchanged (FR-033, SC-018) — none of them import the removed `computeCanvasSize`
- [ ] T033 Run `npm run build` and confirm `dist/index.html` is the only emitted file and is fully playable when opened directly from disk with no network requests (FR-034, SC-019)
- [ ] T034 Perform the on-device checks from quickstart.md's "Manual-only checks" and "On-device / manual" sections on a real Android Chrome phone and a real iOS Safari phone (both orientations): play area reads as "the whole screen," fingertip swipes leave a chunky visible trail, all three brush sizes feel distinct, no scroll/bounce/pull-to-refresh/zoom/text-selection/long-press-menu, toolbar fully visible and tappable including with a notch/home-indicator, rotation preserves the drawing and ends strokes cleanly, and the laptop experience is unchanged (SC-007, SC-009, SC-010, SC-011a, SC-016, SC-017)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories (rewrites `layout.ts`'s exported surface that every story's code and tests import).
- **User Stories (Phase 3–6)**: All depend on Foundational phase completion.
  - US1 (Phase 3) has no dependency on US2–US4.
  - US2 (Phase 4) depends only on Foundational + US1's `PlayArea.svelte` changes existing (T009/T010) so `clientToGrid`'s live-grid read has something to build on; otherwise independent.
  - US3 (Phase 5) depends only on Foundational; its viewport-measurement upgrade (T017) builds on US1's T010, and its debounce (T018) is a prerequisite consumed by US4's T028, but US3 itself is independently testable via `computeToolbarLayout` alone.
  - US4 (Phase 6) depends on Foundational's `resizeGrid` (T006) and on US3's `scheduleResize()` (T018) as the trigger point for the compare-and-branch; its own `tests/unit/sim/resize.test.ts` (T024–T026) has no such dependency and can run as soon as Phase 2 completes.
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — no dependency on other stories.
- **User Story 2 (P2)**: Can start after Foundational; its implementation (T013) touches the same `PlayArea.svelte` region as US1's T009/T010, so apply US1 first to avoid merge friction, though the two stories remain independently testable.
- **User Story 3 (P3)**: Can start after Foundational; T017 extends US1's T010 in the same file — apply US1 first for the same reason.
- **User Story 4 (P4)**: Can start after Foundational for its test file (T024–T026); its implementation (T028–T031) extends US3's `scheduleResize()` (T018), so apply US3's implementation first.

### Within Each User Story

- Tests are written before implementation and should fail first (constitution Principle V / FR-035 require the coverage; standard TDD discipline applies since tests are explicitly requested by this feature).
- `layout.ts` functions (Foundational) before any test or `PlayArea.svelte` change that calls them.
- Story complete and checkpoint validated before moving to the next priority.

### Parallel Opportunities

- T003, T004, T005 (independent functions added to the same new-surface `layout.ts`) can be implemented in parallel by different people, then merged into one file.
- T007 and T008 (both additions to the same new `layout.test.ts` file) are logically parallel but land in one file — coordinate merges.
- T012, T016, T027 all extend `layout.test.ts` further — same file, coordinate merges; each is otherwise independent in content.
- T024, T025, T026 (all in the new `resize.test.ts`) are independent test cases in one file — coordinate merges.
- T014 and T015 (different files: `index.html`, `Toolbar.svelte`) can run in parallel.
- Across stories: once Foundational is done, US1's tests (T007/T008) and US4's tests (T024–T026) can be written in parallel since they touch entirely different files (`layout.test.ts` vs `resize.test.ts`) and have no code dependency on each other.

---

## Parallel Example: Foundational Phase

```bash
# After T002 (the layout.ts skeleton/rewrite) lands, these three can proceed together:
Task: "Implement isPhoneSized in src/lib/layout.ts"
Task: "Implement computePlayField in src/lib/layout.ts"
Task: "Implement computeToolbarLayout in src/lib/layout.ts"
```

## Parallel Example: User Story 4 tests

```bash
# All three land in the same new tests/unit/sim/resize.test.ts, independent test cases:
Task: "Bottom-centre anchoring and clean-drop assertions in tests/unit/sim/resize.test.ts"
Task: "Identity-case (no-op) assertion in tests/unit/sim/resize.test.ts"
Task: "Object-footprint all-or-nothing assertion in tests/unit/sim/resize.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (baseline confirmation).
2. Complete Phase 2: Foundational — `layout.ts` rewrite and `resize.ts` (CRITICAL, blocks all stories).
3. Complete Phase 3: User Story 1 — the play area fills the phone screen.
4. **STOP and VALIDATE**: Run `tests/unit/lib/layout.test.ts`; confirm fill/square/budget assertions pass and the laptop baseline is unregressed.
5. This alone fixes the maintainer's headline complaint ("drawing area is a postage stamp") even before touch/toolbar/rotation polish lands.

### Incremental Delivery

1. Setup + Foundational → foundation ready (`layout.ts`, `resize.ts` exist and compile).
2. Add User Story 1 → validate independently → the play area fills the screen (MVP!).
3. Add User Story 2 → validate independently → touch drawing maps correctly and browser gestures stop interfering.
4. Add User Story 3 → validate independently → the toolbar is always visible and tappable, address-bar collapse doesn't jitter.
5. Add User Story 4 → validate independently → rotation carries the drawing across cleanly.
6. Polish (Phase 7) → full non-regression, build, and on-device sign-off.

### Solo/Sequential Strategy

Given this feature's tight coupling through `PlayArea.svelte` (US1 → US2/US3 → US4 all touch overlapping regions of the same file), a single implementer should work the phases strictly in order (1 → 2 → 3 → 4 → 5 → 6 → 7) rather than attempting true story-level parallelism, even though each story remains independently *testable* at its own checkpoint.
