---

description: "Task list template for feature implementation"
---

# Tasks: Falling Pink Sand

**Input**: Design documents from `/specs/001-falling-pink-sand/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/sim-core.md, quickstart.md

**Tests**: Included — FR-031/SC-009 require an automated, browser-free test suite over the sim core, and plan.md's Project Structure explicitly lists `tests/unit/sim/{grid,step,brush}.test.ts`. No component/browser tests are added (constitution Principle V) — User Story 3's toolbar-selection behavior is manual/visual only.

**Organization**: Tasks are grouped by user story (US1/US2/US3, matching spec.md priorities P1/P2/P3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single client-only project, no `backend/`/`frontend/` split (per plan.md Project Structure):

```text
index.html, package.json, tsconfig.json, vite.config.ts, vitest.config.ts   # repo root
src/{main.ts, App.svelte, lib/*, sim/*}
tests/unit/sim/*.test.ts
```

This is a greenfield checkout — no `package.json` exists yet; Phase 1 creates the whole scaffold.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bootstrap the project scaffold (no scaffold exists yet)

- [X] T001 Create `package.json` at repo root with `dev`/`build`/`test` scripts and dependencies `svelte@5`, `vite`, `@sveltejs/vite-plugin-svelte`, `vite-plugin-singlefile`, `vitest`, `typescript` (constitution Principle III — no other runtime dependencies)
- [X] T002 [P] Create `tsconfig.json` at repo root (strict TypeScript config compatible with Svelte 5 + Vite)
- [X] T003 [P] Create `vite.config.ts` at repo root wiring the `svelte()` plugin and `viteSingleFile()` applied last (FR-029, FR-030)
- [X] T004 [P] Create `vitest.config.ts` at repo root targeting `tests/unit/**` with the default `node` test environment (no jsdom/DOM — constitution Principle V)
- [X] T005 [P] Create `index.html` at repo root as the Vite entry point with a single `#app` mount div

**Checkpoint**: `npm install` succeeds; `npm run dev` and `npm run build` are runnable (even before app code exists).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core types, grid primitives, and app shell that every user story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 Create `Grid`, `Tool`, `BrushSize` types in `src/sim/types.ts` per contracts/sim-core.md (`Grid.cells: Uint8ClampedArray`, row-major, `0` = empty)
- [X] T007 Implement `createGrid`, `inBounds`, `getCell`, `setCell`, `clearGrid` in `src/sim/grid.ts` (depends on T006) — `createGrid` returns a fully-zeroed grid; `getCell`/`setCell` are no-ops out of bounds (FR-009, FR-020); `clearGrid` zeroes `cells` in place without touching `width`/`height` (FR-027)
- [X] T008 Create `src/App.svelte` skeleton: header reading "🌈 Rainbow Sand 🦄", `tool`/`brushSize` `$state` (defaults `'sand'`/`'medium'`, FR-023), and placeholder mount points for `Toolbar` and `PlayArea`
- [X] T009 Create `src/main.ts` bootstrapping the Svelte app into `#app` (depends on T005, T008)
- [X] T010 [P] Create `src/lib/layout.ts` with the viewport→canvas scale + letterboxing math (`scale = min(viewportW/gridW, viewportH/gridH)`) per research.md §9 (FR-033–FR-035)

**Checkpoint**: Foundation ready — grid primitives exist and the app boots to an empty header/shell. User story implementation can now begin.

---

## Phase 3: User Story 1 - Pour pink sand and watch it pile up (Priority: P1) 🎯 MVP

**Goal**: A child can press/drag on the play area and see pink sand pour, fall, slide down slopes, and pile up with per-grain shade variation, continuously and without any failure state.

**Independent Test**: Open the built page, press and drag across the play area, and confirm sand appears continuously under the pointer, falls, slides down slopes, and forms stable sloped piles. The falling/piling rules are additionally verified in automated tests against grid state alone, with no browser.

### Tests for User Story 1

- [X] T011 [P] [US1] Unit tests for `createGrid`/`inBounds`/`getCell`/`setCell`/`clearGrid` in `tests/unit/sim/grid.test.ts` (fresh grid is all-empty; out-of-bounds reads return 0 and writes are no-ops; `clearGrid` zeroes cells but preserves `width`/`height`)
- [X] T012 [P] [US1] Unit tests for `step()` in `tests/unit/sim/step.test.ts` covering FR-006–FR-010: falls into an empty cell below; slides into an available diagonal when blocked below (structural check — lands in *some* available diagonal across many trials, per research.md §4); stays put when below/below-left/below-right are all blocked; stops at the floor and side walls; never creates/destroys/duplicates a grain's byte value

### Implementation for User Story 1

- [X] T013 [US1] Implement `step(grid)` in `src/sim/step.ts` per contracts/sim-core.md (depends on T007): bottom-up, in-place scan implementing fall → slide (random tie-break on `Math.random() < 0.5`) → rest; treats off-grid as blocked (FR-006–FR-010); allocation-free (constitution Principle IV); makes T012 pass
- [X] T014 [P] [US1] Implement `randomShade()` in `src/sim/shade.ts` returning 1–255 in a narrow pink range, never 0 (FR-012, SC-010)
- [X] T015 [US1] Implement `applyBrush` and `applyBrushLine` in `src/sim/brush.ts` per contracts/sim-core.md (depends on T007): circular footprint (`dx²+dy² <= r²`), clipped silently to bounds (FR-020); `tool==='sand'` writes `shade` only into empty cells (FR-018); `tool==='eraser'` zeroes every cell in the footprint (FR-019); `applyBrushLine` Bresenham-interpolates between two grid positions calling `applyBrush` along the path (FR-014, SC-005); makes T011 pass
- [X] T016 [US1] Implement `src/lib/PlayArea.svelte` canvas setup: backing store sized `width×height` px (one px per cell), `requestAnimationFrame` loop calling `step(grid)` once per frame and rendering via a single `putImageData` call per frame from `grid.cells` (depends on T013)
- [X] T017 [US1] Wire pointer/touch drawing in `PlayArea.svelte` using the Pointer Events API: `pointerdown` calls `setPointerCapture` and applies the brush once at the down position; `pointermove` while pressed calls `applyBrushLine` from the last grid position to the new one, assigning a fresh `randomShade()` per placed grain for the sand tool; `pointerup`/`pointercancel`/capture-lost stop deposition (FR-013–FR-015, FR-016) (depends on T015, T016, T014)
- [X] T018 [US1] Wire viewport scaling, letterboxing, and pointer→cell coordinate mapping in `PlayArea.svelte` via `src/lib/layout.ts`, recomputed on load and on `resize` (FR-033–FR-035) (depends on T010, T016)

**Checkpoint**: User Story 1 is fully functional and testable independently — the toy pours, falls, slopes, and piles.

---

## Phase 4: User Story 2 - Erase and clear (Priority: P2)

**Goal**: The child can erase sand by dragging with the eraser, and instantly empty the whole play area with no confirmation.

**Independent Test**: With sand on screen, select the eraser and drag over a pile — the dragged region becomes empty while surrounding sand remains and keeps settling. Tap clear and confirm the whole play area is empty immediately.

### Tests for User Story 2

- [X] T019 [P] [US2] Unit tests for the eraser branch of `applyBrush` in `tests/unit/sim/brush.test.ts`: zeroes every cell (occupied or empty) inside the footprint, leaves cells outside the footprint untouched, and clips silently at grid bounds (FR-019, FR-020)

### Implementation for User Story 2

- [X] T020 [US2] Create `src/lib/Toolbar.svelte` with 🩷 sand, 🧽 eraser, and 🗑️ clear buttons as large round emoji-labeled controls (FR-021, FR-022) (depends on T008)
- [X] T021 [US2] Wire `Toolbar.svelte` into `App.svelte` so tapping 🩷/🧽 updates the shared `tool` state, and thread the active tool into `PlayArea.svelte`'s `applyBrushLine` calls (already built for both tools per T015's contract) (depends on T020, T008, T017)
- [X] T022 [US2] Wire the 🗑️ button to call `clearGrid(grid)` immediately with no confirmation step, without altering the current `tool`/`brushSize` state (FR-027, FR-028) (depends on T007, T020, T021)

**Checkpoint**: User Stories 1 AND 2 both work independently — drawing, erasing, and clearing all function.

---

## Phase 5: User Story 3 - Choose a tool and a brush size without reading (Priority: P3)

**Goal**: A visibly-highlighted default sand tool and medium brush on load; tappable brush-size buttons whose own sizes communicate small/medium/large, applying to whichever tool is active.

**Independent Test**: Open the page and confirm 🩷 is visibly selected; tap each button and confirm the selection state moves; draw with each brush size and confirm the deposited stroke width changes noticeably between small, medium, and large.

*No automated tests for this story* — tool/brush selection is Svelte UI state with no sim-core surface; constitution Principle V steers away from adding browser/component test infrastructure. Verified manually via quickstart.md.

### Implementation for User Story 3

- [X] T023 [US3] Extend `Toolbar.svelte` with three brush-size buttons (small/medium/large) whose rendered glyph sizes visibly increase in that order (FR-025), and give the active tool button and the active brush-size button a clearly distinct visual selected state (FR-024) (depends on T020)
- [X] T024 [US3] Add `brushSize` handling in `App.svelte`: map `'small'|'medium'|'large'` to radii 2/5/9 cells (data-model.md Brush table), default `'medium'`, and persist the selection across tool switches (FR-023, FR-026) (depends on T008, T023)
- [X] T025 [US3] Thread the active brush radius from `App.svelte` into `PlayArea.svelte`'s `applyBrush`/`applyBrushLine` calls so stroke width visibly changes with the selected brush size, with `'sand'`/`'medium'` active by default on load (FR-023) (depends on T017, T024)

**Checkpoint**: All three user stories are independently functional — draw, erase/clear, and tool/brush selection all work together.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Visual polish and final delivery verification spanning all stories

- [X] T026 [P] Apply the cheerful pink/rainbow palette to the header and `Toolbar.svelte` styling (FR-002)
- [X] T027 Ensure `PlayArea.svelte`/global CSS sets `touch-action: none` on the play area and `image-rendering: pixelated` on the canvas, and that the page never scrolls (FR-003, FR-017, SC-004)
- [X] T028 Validate the single-file offline build per quickstart.md: run `npm run build`, confirm `dist/` contains exactly `dist/index.html`, open it via a `file://` URL, and confirm zero network requests in devtools (FR-029, FR-030, SC-008) — verified via build output (`dist/` contains exactly one file) and static analysis (no `fetch`/`XMLHttpRequest`/external `src`/`href` anywhere in source or built HTML); literally opening the file in a browser devtools session is left for the maintainer, no browser available in this environment
- [X] T029 [P] Confirm the README-documented `npm install`, `npm run build`, and `npm test` commands all succeed from a clean checkout (FR-032)
- [ ] T030 Run the performance check from quickstart.md: with the default 270×160 grid at least half full of sand, confirm ≥30fps (targeting 60fps) on a mid-range laptop and a tablet; shrink the grid toward ~200 cells across if profiling shows risk (SC-003, spec Assumptions) — NOT verified: no real browser/device available in this environment. A headless Node timing check of `step()` alone over a half-full 270×160 grid measured ~0.32ms/tick (implying ample headroom under the 16.6ms/frame budget at 60fps), but this does not include render/`putImageData` cost or real device conditions. Needs maintainer confirmation on an actual laptop and tablet per quickstart.md.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion. No dependency on US2/US3.
- **User Story 2 (Phase 4)**: Depends on Foundational completion; reuses `applyBrush`'s eraser branch built in T015 (US1) and the pointer wiring from T017 (US1) — implemented after US1 for that reason, though its own toolbar/clear-button code is otherwise independent.
- **User Story 3 (Phase 5)**: Depends on Foundational completion and on `Toolbar.svelte` existing (T020, from US2) and pointer wiring (T017, from US1).
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Independently testable once Foundational is done — the full draw/fall/slide/rest/erase-capable brush and render loop.
- **User Story 2 (P2)**: Builds its toolbar/clear UI on top of US1's brush and render loop; independently testable (erase + clear) once its own tasks land.
- **User Story 3 (P3)**: Builds brush-size UI on top of US2's `Toolbar.svelte`; independently testable (selection + brush width) once its own tasks land.

### Within Each User Story

- Tests (where included) precede or accompany the implementation task that satisfies them.
- Sim-core (`src/sim/*`) before UI wiring (`PlayArea.svelte`/`App.svelte`/`Toolbar.svelte`) that calls it.
- Story complete before moving to the next priority.

### Parallel Opportunities

- All Setup tasks marked `[P]` (T002–T005) can run in parallel once T001 exists.
- T010 (`layout.ts`) can run in parallel with T008/T009 in Foundational.
- T011 and T012 (US1 tests) can run in parallel; T014 (`shade.ts`) can run in parallel with T013 (`step.ts`).
- T019 (US2 test) can run in parallel with T020 (Toolbar creation).
- T026 and T029 in Polish can run in parallel with the rest of Phase 6.

---

## Parallel Example: User Story 1

```bash
# Launch both US1 test files together:
Task: "Unit tests for grid helpers in tests/unit/sim/grid.test.ts"
Task: "Unit tests for step() fall/slide/rest rules in tests/unit/sim/step.test.ts"

# Launch independent sim modules together:
Task: "Implement step(grid) in src/sim/step.ts"
Task: "Implement randomShade() in src/sim/shade.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run `npm test`, then open the dev build and confirm pouring/falling/piling per quickstart.md's US1 section
5. This alone is a deployable, delightful MVP (spec: "if only this ships, the child has something delightful to play with today")

### Incremental Delivery

1. Setup + Foundational → app shell boots, empty play area
2. Add User Story 1 → validate independently → MVP ready
3. Add User Story 2 → validate independently → erase/clear ready
4. Add User Story 3 → validate independently → full toolbar ready
5. Polish → final build/perf/offline validation per quickstart.md

---

## Notes

- `[P]` tasks = different files, no dependencies
- `[Story]` label maps task to specific user story for traceability
- `src/sim/*` stays framework-free per constitution Principle III/IV — `PlayArea.svelte` calls it via plain function calls, never Svelte reactivity, on the per-frame hot path
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
