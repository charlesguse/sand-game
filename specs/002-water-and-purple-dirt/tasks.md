---

description: "Task list for Water and Magic Purple Dirt"
---

# Tasks: Water and Magic Purple Dirt

**Input**: Design documents from `/specs/002-water-and-purple-dirt/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/sim-core.md, quickstart.md (all present)

**Tests**: Requested explicitly — spec Assumptions and FR-029 require `vitest` unit tests, runnable without a browser, for every new rule.

**Organization**: Tasks are grouped by user story (spec.md priorities P1–P3) to enable independent implementation and testing of each story.

> **Note on scope**: This feature's plan assumes the `001-falling-pink-sand` scaffold (`package.json`, `src/sim/*`, `src/lib/*`) already exists in the repository. In this checkout it does not — `001` was only specified, never planned or implemented. Phase 1 (Setup) and Phase 2 (Foundational) below therefore stand up that baseline scaffold and pink-sand-only behavior directly, so every subsequent task is immediately executable. No task below re-derives 001's own tasks.md (it doesn't exist); Foundational instead implements exactly the subset of `contracts/sim-core.md` / `data-model.md` that pink sand alone needs, and the user-story phases layer water, sinking, and purple dirt on top per this feature's spec.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

Single client-only project at the repository root (per plan.md's Project Structure): `src/sim/*` (framework-free simulation core), `src/lib/*` and `src/App.svelte`/`src/main.ts` (Svelte UI), `tests/unit/sim/*` (vitest, no DOM).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Stand up the project scaffold — nothing below can run without it.

- [X] T001 Create `package.json` at repo root declaring `svelte` 5, `vite`, `@sveltejs/vite-plugin-svelte`, `vite-plugin-singlefile`, `vitest`, `typescript` as dependencies and `dev`/`build`/`test` npm scripts (per README.md's documented commands)
- [X] T002 [P] Create `tsconfig.json` at repo root for the Svelte 5 + TypeScript toolchain
- [X] T003 [P] Create `vite.config.ts` at repo root wiring `@sveltejs/vite-plugin-svelte` and `vite-plugin-singlefile` so `npm run build` emits exactly one `dist/index.html` (constitution Principle I, FR-031)
- [X] T004 [P] Create `vitest.config.ts` at repo root configured for a plain Node environment (no DOM/jsdom — constitution Principle V)
- [X] T005 [P] Create `index.html` at repo root as the Vite entry point that mounts `src/main.ts`
- [X] T006 Create `src/main.ts` mounting `App.svelte` into the page (depends on T005)
- [X] T007 [P] Create `src/lib/layout.ts` with canvas/grid sizing helpers for the play area (default grid 270×160 per research.md §7)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core sim primitives and pink-sand-only behavior that every user story below extends. This is 001's inherited baseline, implemented directly against this feature's final `Grid` shape (`elements`/`shades`/`moved`) rather than an intermediate single-array form, since there is no separate 001 codebase to extend.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T008 Create `src/sim/types.ts` with `EMPTY=0`/`SAND=1`/`WATER=2`/`DIRT=3` constants, the `Element` union type, the `Grid` interface (`width`, `height`, `elements: Uint8Array`, `shades: Uint8Array`, `moved: Uint8Array`), `Tool` (`'sand'|'water'|'dirt'|'eraser'`), and `BrushSize` (`'small'|'medium'|'large'`) — per contracts/sim-core.md
- [X] T009 [P] Create `src/sim/element.ts` with `isPowder(e)` (true for `SAND`/`DIRT`) and `isLiquid(e)` (true for `WATER`) pure predicates (depends on T008)
- [X] T010 [P] Create `src/sim/shade.ts` with `randomShade(): number` returning an integer in `1–255`, never `0`
- [X] T011 [P] Create `src/sim/grid.ts` with `createGrid(width, height)`, `inBounds(grid, x, y)`, `getElement(grid, x, y)`, `getShade(grid, x, y)`, `setCell(grid, x, y, element, shade)`, `clearGrid(grid)`; out-of-bounds reads return `EMPTY`/`0`, out-of-bounds writes are no-ops (depends on T008)
- [X] T012 [P] Implement pink-sand-only movement in `src/sim/step.ts`: `step(grid)` scans bottom row to top, left to right within a row; a `SAND` cell falls into an empty cell directly below, else slides diagonally into an empty below-left/below-right cell (random tie-break when both qualify), else rests; off-grid neighbors are always treated as blocked (depends on T008, T009, T011)
- [X] T013 [P] Implement pink-sand-only painting in `src/sim/brush.ts`: `applyBrush`/`applyBrushLine` write `SAND` into `EMPTY` footprint cells only; the `'eraser'` tool writes `EMPTY` into every footprint cell regardless of current contents (depends on T008, T011)
- [X] T014 [P] `tests/unit/sim/grid.test.ts`: `createGrid` zeroes `elements`/`shades`/`moved`; `getElement`/`getShade`/`setCell` round-trip correctly; out-of-bounds reads/writes are safe no-ops; `clearGrid` zeroes `elements` without touching `width`/`height` (depends on T011)
- [X] T015 [P] `tests/unit/sim/step.test.ts`: pink sand falls one cell per step, slides diagonally when blocked straight down, rests when fully blocked, and stays inside the floor and side walls (depends on T012)
- [X] T016 [P] `tests/unit/sim/brush.test.ts`: the sand brush paints only into empty footprint cells, the eraser clears any occupied cell, and `clearGrid` empties a populated grid (depends on T013)
- [X] T017 [P] Create `src/lib/PlayArea.svelte`: a canvas sized via `layout.ts`, a `requestAnimationFrame` loop calling `step(grid)` once per frame and rendering via `putImageData` with a pink color ramp keyed by `shades[i]`, and pointer/touch handlers translating drag input into `applyBrush`/`applyBrushLine` calls (depends on T007, T010, T011, T012, T013)
- [X] T018 [P] Create `src/lib/Toolbar.svelte` with a 🩷 sand button, a 🧽 eraser button, a 🗑️ clear-all button, and small/medium/large brush-size buttons, each a large round emoji-labeled control (depends on T008)
- [X] T019 Create `src/App.svelte` wiring a `tool` `$state` (default `'sand'`) and a `brushSize` `$state` (default `'medium'`), rendering `Toolbar` and `PlayArea`, and calling `clearGrid` on 🗑️ without resetting `tool`/`brushSize` (depends on T017, T018)

**Checkpoint**: Baseline pink-sand toy works end-to-end (parity with the 001 feature this spec extends) — foundation ready for the four user stories.

---

## Phase 3: User Story 1 - Pour water and watch it flow (Priority: P1) 🎯 MVP

**Goal**: Water pours from the 💧 tool, falls, slides diagonally, spreads sideways to level itself, and never rises, rendered as a lively varying blue.

**Independent Test**: Select 💧, pour a blob onto the floor and confirm it flattens and spreads rather than piling; pour into a sand valley and confirm it settles into the hollow. Fully verifiable in `vitest` against grid state alone.

- [X] T020 [P] [US1] Add `WATER` movement to `src/sim/step.ts`: fall into an empty cell below, else diagonal slide into an empty below-left/below-right cell (random tie-break), else sideways spread into an empty left/right cell on the same row (random tie-break), else rest; never move into a powder-occupied cell, never move to a row above its own; clear `grid.moved` (`.fill(0)`) at the start of each `step()` call and skip any cell already marked `moved`, so a sideways move cannot double-hop within one tick (research.md §4–§5) (depends on T012)
- [X] T021 [P] [US1] Add water painting to `src/sim/brush.ts`: the `'water'` tool writes `WATER` into `EMPTY` footprint cells only, never overwriting sand (depends on T013)
- [X] T022 [P] [US1] Add a 💧 button to `src/lib/Toolbar.svelte`, positioned adjacent to 🩷 (depends on T018)
- [X] T023 [US1] Widen the `tool` `$state` in `src/App.svelte` to accept `'water'` (depends on T019, T022)
- [X] T024 [P] [US1] Add a blue color ramp keyed by `(WATER, shades[i])` to `PlayArea.svelte`'s `putImageData` fill, with at least 6 distinguishable shades (SC-010) (depends on T017)
- [X] T025 [P] [US1] `tests/unit/sim/step.test.ts`: water falls, slides diagonally, spreads sideways to level a tall column into a flat sheet (≤2 cell height variance between middle and edges — SC-002), rests when fully blocked, stays inside the floor/walls, and never occupies a higher row than it started (never-rises invariant, SC-015) (depends on T020)
- [X] T026 [P] [US1] `tests/unit/sim/step.test.ts`: a single `step()` call never moves one water cell more than one cell, verifying the `moved` scratch buffer prevents a sideways double-hop within one tick (depends on T020)
- [X] T027 [P] [US1] `tests/unit/sim/brush.test.ts`: the water brush paints only into empty footprint cells and never overwrites a sand-occupied cell (depends on T021)

**Checkpoint**: User Story 1 is independently functional and testable — water pours, falls, and levels itself.

---

## Phase 4: User Story 2 - Sink pink sand through the water (Priority: P2)

**Goal**: Pink sand (and, once it exists, purple dirt) poured onto water sinks straight through to the bottom, swapping with the water it passes, which is pushed upward.

**Independent Test**: Fill part of the play area with water, pour sand into it, and confirm every grain reaches the bottom of the pool while the water level rises above it. Fully verifiable in `vitest` against grid state.

- [X] T028 [P] [US2] Add the powder-sinks-through-water swap to `src/sim/step.ts`: a powder cell (`SAND` or `DIRT`) with water directly below, or diagonally below when blocked straight down, exchanges its `(element, shade)` pair with the water cell's; confirm the existing water branch's "never move into a powder-occupied cell" check already blocks the reverse case (FR-013, FR-014) (depends on T020)
- [X] T029 [P] [US2] Extend `src/sim/brush.ts` so the `'sand'` tool also overwrites `WATER`-occupied footprint cells (direct replacement, discarding the prior water shade — not a swap), while the `'water'` tool still only writes into `EMPTY` cells (FR-021, FR-022) (depends on T021)
- [X] T030 [P] [US2] `tests/unit/sim/step.test.ts`: a powder cell with water directly below swaps in one step; a water column with sand poured on top settles with all sand at the bottom and all water above it; water never swaps down through or displaces a powder; the count of sand cells and water cells stays constant across many steps (element conservation, SC-005) (depends on T028)
- [X] T031 [P] [US2] `tests/unit/sim/brush.test.ts`: the sand brush overwrites water-occupied cells; the water brush never overwrites a sand-occupied cell (depends on T029)

**Checkpoint**: User Stories 1 and 2 both work independently — sand sinks through water and displaces it upward.

---

## Phase 5: User Story 3 - Build with a second color: magic purple dirt (Priority: P3)

**Goal**: 💜 magic purple dirt behaves exactly like pink sand (falls, slides, piles, sinks in water) but renders in a distinct purple palette.

**Independent Test**: Select 💜, draw a pile, and confirm it falls/slopes exactly like pink sand while being clearly purple; draw pink and purple side by side and confirm the piles stay visually distinct and interleave without either turning into the other.

- [X] T032 [P] [US3] Add a 💜 button to `src/lib/Toolbar.svelte`, grouped with 🩷 and 💧 (depends on T022)
- [X] T033 [US3] Widen the `tool` `$state` in `src/App.svelte` to accept `'dirt'`, and route `'dirt'` brush writes through the same painting-priority rule as `'sand'` in `src/sim/brush.ts` (empty-or-water) (FR-011, FR-021) (depends on T023, T029)
- [X] T034 [P] [US3] Add a purple color ramp keyed by `(DIRT, shades[i])` to `PlayArea.svelte`'s `putImageData` fill, with at least 8 distinguishable shades, visually distinct from the pink ramp (SC-010, FR-027) (depends on T024)
- [X] T035 [P] [US3] `tests/unit/sim/step.test.ts`: dirt falls, slides, and rests under the identical rules as sand; the same initial layout drawn once as `SAND` and once as `DIRT` settles into the identical set of occupied cells (SC-014); a pink grain and a purple grain resting on each other never sink through one another or change element (FR-012) (depends on T028)
- [X] T036 [P] [US3] `tests/unit/sim/brush.test.ts`: the dirt brush paints into empty and water-occupied cells exactly like the sand brush, and is never overwritten by the water brush (depends on T029, T033)

**Checkpoint**: All three elements are independently functional.

---

## Phase 6: User Story 4 - Pick any element, erase anything, clear everything (Priority: P3)

**Goal**: The three element buttons read as an obvious grouped family with an unmistakable selected state; the eraser and clear-all work identically across all three elements.

**Independent Test**: Tap each of 🩷, 💧, 💜 in turn and confirm the highlight moves; drag the eraser through a mixed pile of all three and confirm everything under the brush disappears; tap 🗑️ and confirm the play area empties instantly.

- [X] T037 [P] [US4] Group the 🩷 💧 💜 buttons in `src/lib/Toolbar.svelte` with tighter internal spacing and a shared background/border, visually separated from 🧽/🗑️/brush-size controls, with CSS `flex-wrap` so all 8 controls fit without shrinking below a child-finger-sized tap target (FR-018, FR-025, research.md §9) (depends on T032)
- [X] T038 [US4] Apply a distinct selected-state style (border/scale/glow) to whichever of 🩷/💧/💜/🧽 is currently active in `src/lib/Toolbar.svelte`, obvious at a glance (FR-019) (depends on T037)
- [X] T039 [P] [US4] `tests/unit/sim/brush.test.ts`: the eraser empties sand, water, and dirt cells alike inside its footprint; `clearGrid` empties a grid populated with all three elements (FR-023, FR-024) (depends on T033)
- [ ] T040 [US4] Manual validation pass against quickstart.md's User Story 4 steps: 🩷 is the default tool on load, tapping each element/eraser moves the highlight, the three element buttons read as a visual group, dragging the eraser through a mixed pile clears everything under it, 🗑️ empties the play area instantly with no confirmation, and brush size persists across tool switches (depends on T038, T039) — **requires a browser; not runnable in this headless implement session (constitution Principle V leaves visual/feel checks to the maintainer at review time). Code review confirms: `App.svelte` defaults `tool` to `'sand'` and `brushSize` to `'medium'`, both persist unchanged across `clearAll()`; `Toolbar.svelte` groups 🩷/💧/💜 with tighter spacing than the gap to 🧽/🗑️/sizes, and the `.selected` style is wired to every relevant button (T037-T039).**

**Checkpoint**: All four user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Confirm nothing regressed and the toy meets its performance/packaging bar.

- [X] T041 [P] Regression pass: confirm every inherited pink-sand-only behavior (falling, sliding, resting, painting, erasing, clearing) still holds with no water or dirt on screen, per quickstart.md's "Validate existing pink-sand behavior is unchanged" section (SC-007) — the `step — pink sand` and `brush — pink sand and eraser` suites (unchanged since Phase 2) still pass unmodified in the full 32-test run.
- [ ] T042 [P] Performance check: confirm ≥30fps (target 60fps) at the default grid resolution with the play area at least half full of a mixture of all three elements, and separately with the play area entirely filled with actively flowing water, on a mid-range laptop and a tablet (SC-006, FR-028) — **requires real hardware/devtools profiling; not runnable in this headless implement session. Deferred to maintainer review (constitution Principle V).** The `step()`/render design keeps this feature's added per-cell cost at one extra array read plus a `moved` check (research.md §7), no new allocation or asymptotic cost over 001's baseline.
- [X] T043 Verify `npm run build` emits exactly one file, `dist/index.html`, and that opening it directly from disk (`file://`) is fully playable with zero network requests (FR-031, SC-013) — `dist/` contains only `index.html`; the only `http(s)://` strings in the built output are Svelte's internal error-documentation URLs embedded in string literals (never fetched), and no `<script src=...>`/`<link href=...>` tags reference external files.
- [ ] T044 [P] Manual visual-checks pass: water reads as wet and lively rather than a flat blue block, water flowing into an erased hole or down a slope looks fun to watch, pink and purple piles read as two clearly different cheerful colors, the element-button family and its selected state are obvious from across a room, and pouring sand into water feels satisfying rather than an instant snap to the bottom (spec's "Visual checks for the maintainer" section) — **requires a browser and human judgment; not runnable in this headless implement session. Deferred to maintainer review (constitution Principle V).**

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational only.
- **User Story 2 (Phase 4)**: Depends on Foundational and on Phase 3's `step.ts`/`brush.ts` water rules (T020, T021) — sinking is defined in terms of water that already exists.
- **User Story 3 (Phase 5)**: Depends on Foundational and on Phase 4's powder/water brush rule (T029) — dirt reuses the sand-over-water painting priority.
- **User Story 4 (Phase 6)**: Depends on Foundational, and on Phases 3–5 having added the water/dirt buttons and brush routing it groups and verifies (T032, T033).
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### Within Each User Story

- Sim-core rule changes (`step.ts`/`brush.ts`) before their tests.
- UI wiring (Toolbar/App/PlayArea) can proceed in parallel with sim-core work on different files.
- Story complete before moving to the next priority.

### Parallel Opportunities

- All Setup tasks marked `[P]` (T002–T005, T007) can run in parallel once T001 exists.
- Within Foundational, T009–T018 are all independent files and can run in parallel once T008 lands; T019 needs T017 and T018 first.
- Within each user story phase, the `step.ts` task and the `brush.ts` task touch different files and can run in parallel; their respective test tasks can run in parallel with each other once their implementation task lands.
- Toolbar/App/PlayArea UI tasks in each story phase are independent files and can run in parallel with the sim-core tasks in that same phase.

---

## Parallel Example: User Story 1

```bash
# Once Foundational (Phase 2) is complete, launch these together:
Task: "Add WATER movement to src/sim/step.ts"
Task: "Add water painting to src/sim/brush.ts"
Task: "Add a 💧 button to src/lib/Toolbar.svelte"
Task: "Add a blue color ramp to PlayArea.svelte's putImageData fill"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — stands up the pink-sand baseline this whole feature extends).
3. Complete Phase 3: User Story 1 (water pours and flows).
4. **STOP and VALIDATE**: run `npm test` and the quickstart.md User Story 1 manual checks independently.
5. Demo if ready — this alone is a materially new toy experience (headline of the request).

### Incremental Delivery

1. Setup + Foundational → pink-sand parity with the 001 feature this spec extends.
2. Add User Story 1 (water flows) → test independently → demo (MVP).
3. Add User Story 2 (sand sinks through water) → test independently → demo.
4. Add User Story 3 (magic purple dirt) → test independently → demo.
5. Add User Story 4 (toolbar/eraser/clear polish) → test independently → demo.
6. Polish (Phase 7) → full regression, performance, and packaging checks.

Each story adds value without breaking the previous ones, per the spec's own priority ordering.

---

## Notes

- `[P]` tasks = different files, no unmet dependency within the same phase.
- `[Story]` label maps a task to its user story for traceability; Setup, Foundational, and Polish carry no story label by design.
- Every new-behavior test task is explicit about which FR/SC it covers, per FR-029.
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
- Avoid: vague tasks, same-file conflicts marked `[P]`, and cross-story dependencies that would break a story's independent testability beyond what's declared above.
