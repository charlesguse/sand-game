---

description: "Task list template for feature implementation"
---

# Tasks: Landscape Scenes

**Input**: Design documents from `/specs/004-landscape-scenes/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/scene-generation.md, quickstart.md

**Tests**: The spec explicitly requires automated tests (FR-028, "The project MUST provide automated tests..."), so test tasks are included per user story.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. This feature builds directly on `001-falling-pink-sand`, `002-water-and-purple-dirt`, and `003-rainbow-unicorn-magic` — no scaffolding tasks are needed; every file touched already exists.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single client-only project (unchanged from 001/002/003): `src/sim/*` (framework-free core), `src/lib/*` (Svelte UI), `tests/unit/sim/*` (vitest, no DOM).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No project initialization is needed — `package.json`, `vite.config.ts`, `vitest.config.ts`, and the 001/002/003 scaffold already exist and are unchanged by this feature (plan.md's Technical Context). This phase only adds the one new type this feature introduces, shared by every later task.

- [X] T001 Add `export type SceneId = 'empty' | 'landscape1' | 'landscape2';` to `src/sim/types.ts`, alongside the existing `Tool`/`BrushSize`/`ObjectKind` type aliases — addition only, no existing export in the file changes (contracts/scene-generation.md `src/sim/types.ts` section)

**Checkpoint**: `SceneId` exists and compiles; nothing else in the codebase references it yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The one shared piece every user story's generator and every test depends on — `sceneRegions` — plus the `loadScene` entry point that later UI wiring and every user story's validation calls through. This phase has no user-story label because both landscapes and the empty scene need it.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Create `src/sim/scenes.ts` and implement `sceneRegions(width: number, height: number): SceneRegions` per contracts/scene-generation.md and data-model.md's SceneRegion/SceneRegions section: export `SceneRegion { x0, y0, x1, y1 }` and `SceneRegions { sky, lowerPortion, leftHalf, rightHalf }` interfaces; `sceneRegions` is pure, allocates one small object per call, and every returned rectangle satisfies `0 <= x0 < x1 <= width` and `0 <= y0 < y1 <= height`; `sky` and `lowerPortion` must never overlap and must be separated by at least `OBJECT_FOOTPRINT_SIZE + 2` rows (research.md §6) — import `OBJECT_FOOTPRINT_SIZE` from `src/lib/layout.ts`
- [X] T003 In `src/sim/scenes.ts`, implement `loadScene(sceneId: SceneId, grid: Grid, objects: ObjectsState): void` per contracts/scene-generation.md: unconditionally call the existing `clearGrid(grid)` (from `src/sim/grid.ts`) and `clearObjects(objects)` (from `src/sim/objects.ts`) first for every `sceneId` including `'empty'`; for `'landscape1'`/`'landscape2'`, delegate to `generateLandscape1`/`generateLandscape2` (stubbed as no-ops until T007/T012 land — this task only needs `loadScene('empty', ...)` to be fully correct and callable); for `'empty'`, do nothing further
- [X] T004 [P] Wire scene loading into `src/lib/PlayArea.svelte`: add `export function loadScene(sceneId: SceneId): void` mirroring the existing `clearAll()` at line 244 exactly — call `scenes.ts`'s `loadScene(sceneId, grid, objectsState)` then reset `particles.length = 0`; import `loadScene` from `../sim/scenes` and `SceneId` from `../sim/types`; do not read or write `tool`/`brushSize` (FR-004)

**Checkpoint**: `loadScene('empty', grid, objects)` fully clears grid/objects; `PlayArea.loadScene('empty')` is callable end-to-end. Landscape generation is not yet implemented — that is each user story's job below.

---

## Phase 3: User Story 1 - Load a purple hills and lake world (Priority: P1) 🎯 MVP

**Goal**: Tapping 🏔️ instantly replaces the play area with rolling purple-dirt hills (≥2 crests, a valley), a lake filling the valley, one rainbow in the sky, and one unicorn on a crest — deterministic and at rest on load (FR-017, FR-020, FR-023).

**Independent Test**: Call `generateLandscape1` directly against a freshly created grid and assert, via `sceneRegions`, that DIRT hills with ≥2 local height maxima lie only within `lowerPortion`, WATER fills the valley between them, exactly one rainbow's footprint lies within `sky`, and exactly one unicorn rests on a crest; run `step()` repeatedly afterward and assert the height profile and lake cell count are unchanged.

### Tests for User Story 1 ⚠️

> Write these tests FIRST, ensure they FAIL before implementation (T007 makes them pass)

- [X] T005 [P] [US1] Create `tests/unit/sim/scenes.test.ts` (imports `sceneRegions`, `generateLandscape1`, `loadScene` from `../../../src/sim/scenes`, `createGrid`, `getElement` from `../../../src/sim/grid`, `createObjectsState` from `../../../src/sim/objects`, `DIRT`, `WATER`, `EMPTY` from `../../../src/sim/types`) with a `describe('scenes — generateLandscape1', ...)` block asserting: (a) DIRT cells appear only within `sceneRegions(...).lowerPortion` and their height profile (topmost non-EMPTY row per column, scanned across the terrain span) has at least two local maxima with a valley between them (FR-017); (b) WATER cells fill that valley, strictly below the surrounding crest heights on both sides, and touch no column outside the valley's span; (c) exactly one rainbow is present in `objects.rainbows` with its footprint fully inside `sceneRegions(...).sky` (FR-017, FR-021 — assert via `applyRainbowConversions` producing zero terrain/water changes right after generation); (d) exactly one unicorn is present in `objects.unicorns` with its footprint's bottom edge resting on the taller crest's surface row
- [X] T006 [P] [US1] In the same `scenes.test.ts`, add a determinism test (FR-023): call `generateLandscape1` on two freshly created, equally-sized grids/objects-states and assert `elements`, `shades`, and `hues` arrays are byte-for-byte identical and `objects.rainbows`/`objects.unicorns` are structurally identical (same length, same `kind`/`x`/`y`/`size` per entry); and an at-rest test (FR-020, SC-006): generate landscape 1, capture the height profile and WATER cell count, run `step()` a fixed number of times (e.g. 50) with no drawing input, and assert both are unchanged

### Implementation for User Story 1

- [X] T007 [US1] Implement `generateLandscape1(grid: Grid, objects: ObjectsState): void` in `src/sim/scenes.ts` per research.md §1–§3, §5, §6, §9: compute `hillHeight(x)` from a fixed sum of one or two sine terms over `x / width` within `sceneRegions(width, height).lowerPortion`, producing ≥2 crests and a valley; clamp the profile left-to-right so adjacent columns differ by ≤1 row (research.md §2); write DIRT cells from each column's clamped height down to the bottom of `lowerPortion` via the existing `setCell` (from `src/sim/grid.ts`), using a fixed positional hash (e.g. `1 + ((x * 928371 + y * 128371) % 255)`, research.md §1) for shade instead of `randomShade()`; fill the valley with a single flat WATER level strictly below both surrounding crests' clamped heights (research.md §3), touching only columns inside the valley's span; place one rainbow via the existing `placeObject(grid, objects, 'rainbow', cx, cy)` (from `src/sim/objects.ts`) centered horizontally within `sceneRegions(width, height).sky`, positioned so its footprint plus one-cell zone never overlaps written terrain/water (research.md §6); place one unicorn via `placeObject(grid, objects, 'unicorn', cx, cy)` with its footprint's bottom edge on the taller crest's surface row; never call `Math.random()`, `randomShade()`, or `performance.now()`; never touch a cell outside the regions used above (depends on T002)
- [X] T008 [US1] In `src/sim/scenes.ts`'s `loadScene` (T003), replace the `'landscape1'` no-op stub with a call to `generateLandscape1(grid, objects)` after the unconditional clear (depends on T007; makes T005/T006 pass)

**Checkpoint**: Tapping 🏔️ end-to-end (once T014/T015's toolbar wiring lands in Phase 4, or directly via `PlayArea.loadScene('landscape1')` today) produces a fully-formed, at-rest, deterministic hills-and-lake scene with a rainbow and unicorn. User Story 1 is independently testable via `scenes.test.ts` and via the app.

---

## Phase 4: User Story 2 - Switch between worlds and back to a blank canvas (Priority: P1)

**Goal**: 🏝️ produces a pink-sand beach sloping into a large pool with two rainbows and a unicorn near the water (FR-018); every scene control (⬜🏔️🏝️) is one instant, atomic tap that fully replaces prior contents, leaves `tool`/`brushSize` untouched, shows no selected/active state, and sits in a toolbar group visually separate from 🗑️ (FR-001–FR-011, FR-019).

**Independent Test**: Tap through ⬜, 🏔️, and 🏝️ in any order and confirm each tap fully replaces the play area with that choice's contents, with ⬜ leaving it empty; fully verifiable in `scenes.test.ts` against grid/objects state alone, plus a visual toolbar check for the button grouping and absence of a selected look.

### Tests for User Story 2 ⚠️

> Write these tests FIRST, ensure they FAIL before implementation (T012/T013 make them pass)

- [X] T009 [P] [US2] In `scenes.test.ts`, add a `describe('scenes — generateLandscape2', ...)` block asserting: (a) SAND is the dominant terrain element, occupying only `sceneRegions(...).lowerPortion`, with a height profile that slopes monotonically from one side to the other (clamped exactly as landscape 1's, so no column pair differs by >1 row); (b) a large WATER body fills the lower-elevation side within `leftHalf` or `rightHalf` as appropriate, touching no column outside that span; (c) exactly two rainbows are present, both with footprints fully inside `sky`, spaced apart horizontally, and neither's zone overlapping written terrain/water (FR-021); (d) exactly one unicorn is present near the sand/water boundary, its footprint's bottom edge resting on the sloped surface at that column (FR-018, FR-019)
- [X] T010 [P] [US2] In `scenes.test.ts`, add: a determinism test for `generateLandscape2` mirroring T006's landscape-1 version (FR-023); a `describe('loadScene', ...)` block asserting `loadScene` clears every previous element/object/hue before writing new contents regardless of prior state — start from a grid with elements, objects, and hues set, run several `step()` ticks, then call `loadScene('landscape1', ...)` and `loadScene('landscape2', ...)` and assert no residue from the prior state remains (FR-009); and a test that `loadScene('empty', grid, objects)` leaves zero non-EMPTY cells, `objects.rainbows.length === 0`, and `objects.unicorns.length === 0`, starting from that same populated-and-stepped grid (FR-011, SC-008)
- [X] T011 [P] [US2] In `scenes.test.ts`, add a size-robustness `describe` block (FR-022, research.md §10): call `generateLandscape1` and `generateLandscape2` against at least 3 different `createGrid(width, height)` sizes comfortably larger than `OBJECT_FOOTPRINT_SIZE` (e.g. a small, the default 270×160, and a large/wide size), and for each size assert every region-derived invariant from T005/T009 still holds (crests within bounds, water contained, rainbow(s) within `sky` and clear of terrain, unicorn on the surface) — nothing clipped, nothing degenerate

### Implementation for User Story 2

- [X] T012 [P] [US2] Implement `generateLandscape2(grid: Grid, objects: ObjectsState): void` in `src/sim/scenes.ts` per research.md §1–§3, §5, §6, §9: compute `beachHeight(x)` sloping monotonically from a higher elevation on one side to a lower one on the other across `lowerPortion`, clamped exactly as `hillHeight` (research.md §2); write SAND cells via `setCell` with the same fixed positional shade hash used in T007; fill a large flat WATER body (research.md §3) on the lower-elevation side within the matching `leftHalf`/`rightHalf` region, strictly below the shortest bounding wall column; place two rainbows via `placeObject(grid, objects, 'rainbow', cx, cy)`, spaced apart horizontally within `sky`, each clear of terrain/water by the same zone-clearance rule as T007 (research.md §6); place one unicorn via `placeObject(grid, objects, 'unicorn', cx, cy)` near the sand/water boundary, its footprint's bottom edge on the sloped surface; never call `Math.random()`/`randomShade()`/`performance.now()` (depends on T002; can run in parallel with T007 — different generator function, same file, no shared mutable state)
- [X] T013 [US2] In `src/sim/scenes.ts`'s `loadScene`, replace the `'landscape2'` no-op stub with a call to `generateLandscape2(grid, objects)` after the unconditional clear (depends on T012; makes T009/T010/T011 pass)
- [X] T014 [P] [US2] Add a new, visually separated scene button group to `src/lib/Toolbar.svelte`: three buttons (⬜ empty, 🏔️ landscape1, 🏝️ landscape2) in a new `.group.scenes` div placed distinctly from `.group.actions` (which holds 🧽/🗑️); each button's `onclick` calls a new `onSelectScene: (sceneId: SceneId) => void` prop (added to the `Props` interface, imported `SceneId` from `../sim/types`); none of the three buttons ever binds `class:selected` to any state (FR-006) — same size/style class (`control`) as existing buttons for finger-size parity (FR-002, FR-007)
- [X] T015 [US2] Wire `onSelectScene` through `src/App.svelte`: add `function selectScene(id: SceneId) { playArea.loadScene(id); }` (importing `SceneId` from `./sim/types`) and pass it to `<Toolbar onSelectScene={selectScene} ...>`; do not call `selectTool`/`selectBrushSize` from this handler (FR-004) (depends on T004, T014)

**Checkpoint**: All three scene buttons are live in the toolbar; tapping any one instantly and atomically replaces the play area; `tool`/`brushSize` and the toolbar's selected-tool highlight are unaffected by any scene tap. User Stories 1 and 2 both work independently end-to-end.

---

## Phase 5: User Story 3 - Keep playing on top of a world (Priority: P2)

**Goal**: Confirm scene-placed cells and objects are indistinguishable from hand-drawn/hand-placed ones under every existing interaction — gravity, erasing, rainbow conversion, unicorn celebration, and the per-type object cap (FR-013, FR-014).

**Independent Test**: Load a scene, then apply every existing interaction to its contents and confirm each behaves identically to hand-drawn contents. Per quickstart.md, this story's behavior is entirely inherited from 003's already-tested `step`/`applyRainbowConversions`/`isUnicornTouched`/`eraseObjectsInBrush`/`placeObject` — because `scenes.ts` writes plain DIRT/SAND/WATER cells and calls the same `placeObject` hand-placed objects use, this phase adds one integration-style test rather than duplicating 003's interaction-rule tests.

### Tests for User Story 3 ⚠️

- [X] T016 [US3] In `scenes.test.ts`, add a `describe('scenes — interaction after load', ...)` block that: loads landscape 1 via `loadScene`, then (a) calls `eraseObjectsInBrush` centered on the placed unicorn/rainbow and asserts the object is removed from `objects.unicorns`/`objects.rainbows` and its footprint cells return to EMPTY, exactly as `objects.test.ts` already proves for hand-placed objects; (b) places two more rainbows and two more unicorns via `placeObject` (reaching the cap of 3) and asserts the scene's own rainbow/unicorn is evicted first if it was the oldest, per the existing oldest-evicted rule (FR-014) — this test calls only existing, unmodified `objects.ts`/`step.ts` functions against scene-generated state, proving no new interaction logic was introduced (depends on T008)

**Checkpoint**: All three user stories are independently functional and verified. No new interaction logic exists outside `scenes.ts`'s generation itself — 003's existing suite continues to prove the interaction rules.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification that this feature adds no regression and meets its build/performance/manual-check bar.

- [ ] T017 Run `npm run build` and confirm `dist/` contains exactly one file, `dist/index.html`, with zero new runtime dependencies added to `package.json` (FR-029, SC-016)
- [ ] T018 Run `npm test` and confirm every test from `specs/001-falling-pink-sand`, `specs/002-water-and-purple-dirt`, and `specs/003-rainbow-unicorn-magic` still passes unchanged, alongside the new `scenes.test.ts` suite (FR-027, SC-012)
- [ ] T019 [P] Manually validate quickstart.md's "Manual-only checks" section in a running `npm run dev` session: each landscape reads as a place (not a scatter), hills look rolling, the beach slopes into a shoreline, rainbows sit in the sky uncut, the unicorn looks grounded, scene loads are flicker-free, the scene button group reads as "pick a world" distinct from 🗑️, and switching between scenes feels instant with no lag (spec's "Visual checks for the maintainer" section — no automated coverage)
- [ ] T020 [P] Manually validate quickstart.md's Performance check (SC-010, FR-024, FR-025): on a mid-range laptop and, if available, a tablet, confirm a scene tap shows the new world on the very next frame with no progress indicator, and that with either landscape loaded and elements in motion the devtools FPS overlay shows ≥30fps sustained, targeting 60fps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (T001's `SceneId`) — BLOCKS all user stories (T003's `loadScene` and T002's `sceneRegions` are called by every generator and every test).
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) completion only.
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) completion only; independent of User Story 1's generator (T007), though it reuses the same `loadScene`/toolbar plumbing (T003/T004) Phase 2 set up. T014–T015 (Toolbar, App) are shared UI-wiring tasks placed here because FR-008's toolbar layout (all three buttons together) is most naturally validated once both landscapes exist, but T014/T015 do not functionally depend on T012's landscape-2 generator being correct — only on `SceneId` (T001) and `PlayArea.loadScene` (T004).
- **User Story 3 (Phase 5)**: Depends on User Story 1 (T008, a working `loadScene('landscape1', ...)`) to have generated content to test interactions against.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### Within Each User Story

- Tests (T005/T006, T009–T011, T016) MUST be written and FAIL before their corresponding implementation task (T007, T012, or prior work) makes them pass — see each phase's ⚠️ note.
- Generator implementation (T007, T012) before `loadScene` wiring to that generator (T008, T013).
- `PlayArea.loadScene` (T004) before `Toolbar`/`App` wiring (T014, T015).

### Parallel Opportunities

- T004 (PlayArea wiring) can run in parallel with T002/T003 once T001 lands, since it only calls `scenes.ts`'s `loadScene` signature, not its internals.
- T005 and T006 (US1 tests, same new file but independent `describe` blocks) can be drafted in parallel, then merged — mark [P] for independent authorship, coordinate on the single `scenes.test.ts` file before commit.
- T012 (landscape 2 generator) can be implemented in parallel with T007 (landscape 1 generator) — different generator functions in the same file, no shared mutable state, both depend only on T002.
- T009, T010, T011 (US2 tests) can be drafted in parallel with each other and with T012's implementation, then merged into `scenes.test.ts` before verifying they pass.
- T019 and T020 (manual checks) can run in parallel with each other.

---

## Parallel Example: User Story 1 and User Story 2 generators

```bash
# Once Foundational (T001-T004) is done, these can proceed in parallel:
Task: "Implement generateLandscape1 in src/sim/scenes.ts" (T007)
Task: "Implement generateLandscape2 in src/sim/scenes.ts" (T012)

# Their respective test-authoring can also proceed in parallel:
Task: "Add generateLandscape1 region/shape assertions to scenes.test.ts" (T005)
Task: "Add generateLandscape2 region/shape assertions to scenes.test.ts" (T009)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001).
2. Complete Phase 2: Foundational (T002–T004) — CRITICAL, blocks all stories.
3. Complete Phase 3: User Story 1 (T005–T008).
4. **STOP and VALIDATE**: Run `scenes.test.ts`'s landscape-1 tests; manually exercise `PlayArea.loadScene('landscape1')` (toolbar wiring isn't required yet — this can be exercised directly, or Phase 4's T014/T015 can be pulled forward if a visible button is wanted sooner).
5. This alone already delivers the feature's core value per plan.md's Summary.

### Incremental Delivery

1. Setup + Foundational → foundation ready (`loadScene('empty', ...)` works end-to-end).
2. Add User Story 1 → purple-hills scene generates correctly, testable directly against `scenes.ts`.
3. Add User Story 2 → beach scene generates correctly; toolbar gains all three visible scene buttons; full ⬜/🏔️/🏝️ switching works in the running app.
4. Add User Story 3 → confirms no interaction regression on top of loaded scenes.
5. Polish → build/test/manual/performance sign-off.

### Parallel Team Strategy

With multiple developers, after Foundational (Phase 2) is done:

- Developer A: User Story 1 (T005–T008)
- Developer B: User Story 2's generator (T012) and its tests (T009–T011), while coordinating with Developer A on the shared `scenes.test.ts` file
- Developer B or C: Toolbar/App wiring (T014–T015) once `PlayArea.loadScene` (T004) is available — does not need to wait for either generator to be functionally complete, only for `loadScene`'s stub shape (T003)
- Converge on User Story 3 (T016) once T008 lands
- Converge on Polish (Phase 6) once all stories are done

---

## Notes

- [P] tasks touch different files, or independent regions of the same new file (`scenes.test.ts`), with no dependency ordering between them.
- [Story] label maps task to specific user story for traceability.
- This feature touches zero existing `src/sim/*` exported signatures (`grid.ts`, `objects.ts`, `step.ts`, `brush.ts`, `element.ts`, `shade.ts` are all unchanged) — every 001/002/003 test keeps passing by construction (FR-027).
- No new dependency is added anywhere in this task list — determinism uses plain arithmetic (research.md §1), not a PRNG library.
- Commit after each task or logical group; stop at either checkpoint to validate a story independently.
- T007/T012 (the two generators) are the only tasks with real algorithmic risk in this feature; everything else is direct reuse of existing, unmodified primitives (`setCell`, `placeObject`, `clearGrid`, `clearObjects`).
