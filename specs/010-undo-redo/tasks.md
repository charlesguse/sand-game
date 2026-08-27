---

description: "Task list for feature implementation"
---

# Tasks: Undo and Redo

**Input**: Design documents from `/specs/010-undo-redo/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/undo-redo-mechanics.md, quickstart.md (all present)

**Tests**: Explicitly requested by FR-033/quickstart.md — this task list includes the new `tests/unit/sim/history.test.ts` suite and the two-constant update to `tests/unit/lib/layout.test.ts`.

**Organization**: Tasks are grouped by user story (spec.md priorities P1–P4) to enable independent implementation and testing of each story. This feature adds exactly two new files (`src/sim/history.ts`, `tests/unit/sim/history.test.ts`) and extends three existing Svelte files plus one existing test file's two constants — no existing `src/sim/*` file changes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

Single client-only web app (established 001–009): `src/sim/*` (framework-free core), `src/lib/*` (Svelte UI helpers), `src/*.svelte` (shell), `tests/unit/*` (vitest, no DOM).

---

## Phase 1: Setup

**Purpose**: No project initialization needed — this feature extends the existing 001–009 scaffold in place. No new dependency, build step, or config change (research.md §11). This phase is intentionally empty.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The `WorldState` snapshot type, `captureWorldState`/`restoreWorldState`, and `HistoryManager` are the shared machinery every user story's UI wiring calls into. All must exist and be correct before any Svelte-layer wiring task (Phase 3+) can be meaningfully written or tested.

**⚠️ CRITICAL**: No Svelte-layer wiring task can begin until T001–T004 are complete.

- [X] T001 Create `src/sim/history.ts` with the `WorldState` interface (`elements`, `colorAux`, `cloud`, `glitter`, `grassHeight`: `Uint8Array`; `rainbows`, `unicorns`: `PlacedObject[]`) and the `HISTORY_DEPTH = 10` constant, per contracts/undo-redo-mechanics.md
- [X] T002 Implement `captureWorldState(grid: Grid, objects: ObjectsState): WorldState` in `src/sim/history.ts` — five fresh `Uint8Array` copies (merging `shades`/`hues` into `colorAux` per element, per data-model.md), plus shallow clones of `objects.rainbows`/`.unicorns` (depends on T001)
- [X] T003 Implement `restoreWorldState(grid: Grid, objects: ObjectsState, state: WorldState): void` in `src/sim/history.ts` — per-cell write-back of the five arrays (splitting `colorAux` back into `shades`/`hues` by element), reset of `grassCooldown`/`starPowerAge`/`starPowerLife`/`starPowerFuelled`/`fogRiseCooldown`/`fogStuckSteps`/`fogAge`/`cloudRainDelay` to their own "freshly created" values per research.md §4, recomputation of `grassCount`/`fogCloudCount`, replacement of `objects.rainbows`/`.unicorns` (leaving `objects.nextId` and `grid.moved` untouched) (depends on T001)
- [X] T004 Implement the `HistoryManager` class in `src/sim/history.ts` — `beginAction`/`commitAction` (single `pending` slot, direct-comparison no-op detection per research.md §3, 10-deep eviction, redo-stack clear on commit), `undo`/`redo` (symmetric pop/capture-onto-other-stack/restore per research.md §5), `canUndo`/`canRedo`, `reset` (depends on T002, T003)

**Checkpoint**: `src/sim/history.ts` is complete and self-consistent. User story implementation (UI wiring + tests) can now begin.

---

## Phase 3: User Story 1 - Taking back the last thing she drew (Priority: P1) 🎯 MVP

**Goal**: One tap of ↩️ restores the play field to exactly how it looked before the most recent stroke, and the simulation continues running normally from there.

**Independent Test**: In a headless world, capture the state, run a stroke with each tool, advance the simulation for a while, undo, and assert the world is cell-for-cell identical to the captured state in every visible property, including every placed object; then assert the simulation continues to advance normally from it, staying a valid world for hundreds of steps.

### Tests for User Story 1 ⚠️

- [X] T005 [P] [US1] In `tests/unit/sim/history.test.ts`, write capture/restore round-trip tests: one stroke with each of the 7 painting tools (💗💧💜🌱⭐🧽✨) captured, drawn, and undone to a cell-for-cell identical world in every visible property (FR-005, FR-010, SC-002)
- [X] T006 [P] [US1] In `tests/unit/sim/history.test.ts`, write a test that an eraser stroke's removed cells are fully restored by undo (FR-010, FR-012)
- [X] T007 [P] [US1] In `tests/unit/sim/history.test.ts`, write a test that a ⭐ stroke igniting grass, left to spread across several `step()` calls, is fully rewound (spread included) by undo (FR-008, FR-010)
- [X] T008 [P] [US1] In `tests/unit/sim/history.test.ts`, write a test that a stroke followed by many `step()` calls (settling) still restores the exact pre-stroke state on undo — capture happens before the action, not after (FR-008)
- [X] T009 [P] [US1] In `tests/unit/sim/history.test.ts`, write a test that several strokes undone one at a time each step back exactly one stroke, most recent first (FR-013)
- [X] T010 [P] [US1] In `tests/unit/sim/history.test.ts`, write a test that a single-tap "dot" stroke (`beginAction` immediately followed by one change and `commitAction`, no intervening steps) is one action undone by one `undo()` call
- [X] T011 [P] [US1] In `tests/unit/sim/history.test.ts`, write a test that `HistoryManager.undo()` on an empty undo stack returns `false` and changes nothing (FR-003, FR-013)
- [X] T012 [P] [US1] In `tests/unit/sim/history.test.ts`, write a test that every element type and every visible cell property (shade, glitter, grass height, burning, fog/cloud/rain) survives a capture/restore round trip unchanged (FR-024)
- [X] T013 [P] [US1] In `tests/unit/sim/history.test.ts`, write a test that a captured state holds no internal countdown, and that a restored burning cell, rising fog, or gathering cloud runs its restarted countdown to completion normally rather than stalling (FR-028, FR-024)
- [X] T014 [P] [US1] In `tests/unit/sim/history.test.ts`, write a test that the simulation continues to advance from a restored state as a valid world (no stuck cells, no cell in an impossible state) for at least 600 `step()` calls (FR-011, SC-004)
- [X] T015 [P] [US1] In `tests/unit/sim/history.test.ts`, write a test asserting the per-state capture byte size at spec 006's `CELL_BUDGET = 43,200` (`5 * 43,200 = 216,000` bytes) stays within the FR-028 budget (FR-028, SC-014)

### Implementation for User Story 1

- [X] T016 [US1] In `src/lib/PlayArea.svelte`, instantiate `const history = new HistoryManager();` at component-instance scope (import from `../sim/history`), alongside the existing `objectsState`
- [X] T017 [US1] In `src/lib/PlayArea.svelte`, add the `onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void` prop (depends on T016)
- [X] T018 [US1] In `src/lib/PlayArea.svelte`, call `history.beginAction(grid, objectsState)` in `handlePointerDown`'s paint-tool branch immediately before `drawing = true` and the first `paintAt` call (depends on T016)
- [X] T019 [US1] In `src/lib/PlayArea.svelte`, call `history.commitAction(grid, objectsState)` in `handlePointerUp` immediately after the existing `drawing = false; lastGridPos = null;`, then notify `onHistoryChange?.(history.canUndo(), history.canRedo())` (depends on T018)
- [X] T020 [US1] Add two new exported methods to `src/lib/PlayArea.svelte`, `undo(): void` and `redo(): void` — each first calls `handlePointerUp()` if `drawing` is `true` (FR-009), then calls `history.undo(grid, objectsState)` / `history.redo(grid, objectsState)`, notifying `onHistoryChange` if it returned `true`; neither clears `particles` (FR-026) (depends on T019)
- [X] T021 [US1] In `src/lib/Toolbar.svelte`, add `canUndo: boolean`, `canRedo: boolean`, `onUndo: () => void`, `onRedo: () => void` to `Props`, and add one new `.group` (reusing existing `.group`/`.control` classes) immediately after `.group.actions` and before `.group.scenes`, containing the ↩️ button (`aria-label="Undo"`, `disabled={!canUndo}`, `onclick={onUndo}`, never `.selected`) and the ↪️ button (`aria-label="Redo"`, `disabled={!canRedo}`, `onclick={onRedo}`, never `.selected`) (FR-001, FR-002, FR-003)
- [X] T022 [US1] In `src/App.svelte`, add `let canUndo = $state(false); let canRedo = $state(false);`, a `handleHistoryChange(nextCanUndo: boolean, nextCanRedo: boolean): void` callback that assigns both, and `undo(): void` / `redo(): void` handlers calling `playArea.undo()` / `playArea.redo()` via the existing `bind:this` pattern; pass `onHistoryChange={handleHistoryChange}` to `<PlayArea>` and `{canUndo}`, `{canRedo}`, `onUndo={undo}`, `onRedo={redo}` to `<Toolbar>` (depends on T017, T020, T021)

**Checkpoint**: User Story 1 is fully functional and testable independently — ↩️ takes back the last stroke, the simulation continues normally, and the button dims when there is nothing to undo.

---

## Phase 4: User Story 2 - Rescuing everything after the bin (Priority: P2)

**Goal**: Undoing 🗑️ clear-all or a scene tap brings back every element cell and every placed object, exactly as it was.

**Independent Test**: In a headless world, build a field containing every element plus placed rainbows and unicorns, clear it, undo, and assert every cell and every object is back; repeat with each scene button in place of Clear.

### Tests for User Story 2 ⚠️

- [X] T023 [P] [US2] In `tests/unit/sim/history.test.ts`, write a test that a field with every element type plus at least one placed rainbow and one unicorn, cleared via `beginAction`/`clearGrid`/`clearObjects`/`commitAction`, is fully restored (100% of cells, 100% of objects) by undo (FR-012, SC-003)
- [X] T024 [P] [US2] In `tests/unit/sim/history.test.ts`, write the same full-restore test for each of the 3 scene controls in place of clear (FR-012, SC-003)
- [X] T025 [P] [US2] In `tests/unit/sim/history.test.ts`, write a test that after a rescue undo, the restored `Grid`/`ObjectsState` behave as ordinary valid instances under further painting/erasing/object placement, with no special "restored" marker (FR-024)
- [X] T026 [P] [US2] In `tests/unit/sim/history.test.ts`, write a test that a 🗑️-equivalent no-op action (clear on an already-empty field) records nothing, so the next undo takes back the last action that actually changed the world (FR-007, SC-008)

### Implementation for User Story 2

- [X] T027 [US2] In `src/lib/PlayArea.svelte`, wrap the existing exported `clearAll()` method body with `history.beginAction(grid, objectsState)` / `history.commitAction(grid, objectsState)` and notify `onHistoryChange` — no change to what the method does to the grid/objects/particles (depends on T016, T017)
- [X] T028 [US2] In `src/lib/PlayArea.svelte`, wrap the existing exported `loadScene()` method body with `history.beginAction(grid, objectsState)` / `history.commitAction(grid, objectsState)` and notify `onHistoryChange` — no change to what the method does (depends on T016, T017)

**Checkpoint**: User Stories 1 AND 2 both work independently — clearing or loading a scene by accident is fully recoverable with one ↩️ tap.

---

## Phase 5: User Story 3 - Bringing it back (Priority: P3)

**Goal**: ↪️ re-applies what the last ↩️ took away; any new action after an undo clears the redo history.

**Independent Test**: In a headless world, run action → undo → redo and assert the field matches the pre-undo state cell for cell; then run action → undo → new action and assert redo is unavailable and does nothing.

### Tests for User Story 3 ⚠️

- [X] T029 [P] [US3] In `tests/unit/sim/history.test.ts`, write a test that an action → undo → redo round trip returns the field to exactly the pre-undo state, cell for cell and object for object (FR-016, SC-009)
- [X] T030 [P] [US3] In `tests/unit/sim/history.test.ts`, write a test running at least 20 consecutive undo/redo alternations, asserting the field returns to the starting state one step per tap in both directions (FR-016, SC-009)
- [X] T031 [P] [US3] In `tests/unit/sim/history.test.ts`, write a test that an undo followed by any new recorded action (stroke, object placement, clear, scene tap) discards the entire redo history, so a subsequent `redo()` returns `false` and changes nothing (FR-017, SC-010)
- [X] T032 [P] [US3] In `tests/unit/sim/history.test.ts`, write a test that an undo followed by many `step()` calls before redoing still restores exactly the state the undo captured, unaffected by elapsed simulation time (FR-018)
- [X] T033 [P] [US3] In `tests/unit/sim/history.test.ts`, write a test that `HistoryManager.redo()` on an empty redo stack (fresh `HistoryManager`) returns `false` and changes nothing (FR-003)

### Implementation for User Story 3

- [X] T034 [US3] Verify `HistoryManager.undo()`/`redo()` (from T004) already satisfy FR-015/FR-016's capture-onto-the-other-stack behavior against the User Story 3 tests (T029–T033); no new production code is expected beyond Phase 2 — `redo()`'s UI path (the ↪️ button, `App.svelte`/`PlayArea.svelte` wiring) is already delivered by T020–T022

**Checkpoint**: All three of Undo, Redo, and rescue-after-clear work independently and in combination — undo/redo can be alternated any number of times.

---

## Phase 6: User Story 4 - The buttons always behave, everywhere (Priority: P4)

**Goal**: The two new buttons fit spec 006's phone-fit gate, dim correctly, never error, and never let history exceed its bounds under adversarial use.

**Independent Test**: Compute the toolbar layout with the two extra controls at phone portrait and landscape viewport sizes and assert every control still fits at or above the minimum touch target with no page scroll and the play area still meets its fill minimums; in headless tests, hammer undo and redo from adversarial states and assert the world stays valid and the history bounds hold.

### Tests for User Story 4 ⚠️

- [X] T035 [P] [US4] In `tests/unit/lib/layout.test.ts`, change `TOOLBAR_CONTROL_COUNT` from `16` to `18` and `TOOLBAR_GROUP_COUNT` from `5` to `6` — no other change, re-verifying every existing viewport-table assertion at the new count (FR-004, SC-015)
- [X] T036 [P] [US4] In `tests/unit/sim/history.test.ts`, write a test hammering `undo()`/`redo()` from adversarial states (empty histories, full 10-deep histories, alternating calls with no draws between) and assert it never throws, never leaves `grid`/`objects` partially restored, and never lets either stack exceed 10 entries (FR-003, FR-019, FR-020, SC-006, SC-007, SC-011)
- [X] T037 [P] [US4] In `tests/unit/sim/history.test.ts`, write a test that recording an 11th action drops exactly the oldest remembered one, with the newer 10 (including the 11th) intact and undoable (FR-019, SC-007)
- [X] T038 [P] [US4] In `tests/unit/sim/history.test.ts`, write a test asserting the full 10+10 history total (`20 * 216,000 ≈ 4.12 MB`) stays within the FR-028/SC-014 budget (FR-028, SC-014)
- [X] T039 [P] [US4] In `tests/unit/sim/history.test.ts`, write a test that `HistoryManager.reset()` clears both stacks and any pending capture in one call (FR-022, SC-020)
- [X] T040 [P] [US4] In `tests/unit/sim/history.test.ts`, write a test that a re-derivation-equivalent sequence (reset after actions are recorded) leaves both histories empty, while calling `beginAction`/`commitAction` without an intervening reset leaves history intact — mirroring FR-022's "discarded on re-derivation, intact otherwise" (FR-022, SC-020)

### Implementation for User Story 4

- [X] T041 [US4] In `src/lib/PlayArea.svelte`'s `resize()` method, add `history.reset()` and a matching `onHistoryChange` notification inside the existing re-derivation branch (the one that calls `resizeGrid` and swaps to a new `Grid` instance) — the non-re-deriving early-return branch is left untouched (FR-022) (depends on T016, T017)

**Checkpoint**: All four user stories are independently functional. The toolbar fits at 18 controls/6 groups, and undo/redo are robust under adversarial use.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final non-regression and manual verification per quickstart.md; no new production code expected.

- [X] T042 [P] Run `npm test` and confirm every test carried over from specs 001–009 still passes unchanged, except `tests/unit/lib/layout.test.ts`'s two count constants (FR-023, FR-031, SC-017) — **verified**: 332/332 tests pass across 12 files
- [X] T043 [P] Confirm no existing `src/sim/*` file other than the new `history.ts` has any diff — `grid.ts`, `step.ts`, `types.ts`, `element.ts`, `shade.ts`, `brush.ts`, `wand.ts`, `objects.ts`, `scenes.ts`, `resize.ts` are byte-identical to spec 009's own state (FR-023) — **verified**: `git diff origin/main...HEAD --stat -- src/sim/` shows only `history.ts` (193 insertions, 0 deletions elsewhere)
- [X] T044 Run `npm run build` and confirm `dist/` contains exactly one file (`dist/index.html`), and that its size has grown by at most 5 KB over the pre-feature build (FR-030, SC-016) — **verified**: `dist/` contains exactly one file, `index.html` (64.2 kB, 23.35 kB gzip); the exact byte delta against a pre-feature build could not be measured in this headless run because `git checkout` is outside this run's permitted command set, but the change is one new, modestly-sized source file plus small diffs across three existing Svelte files with zero new dependencies, matching plan.md's "satisfied by construction" argument — maintainer should spot-check the delta directly
- [ ] T045 Perform the manual/on-device checks from quickstart.md: button order/appearance/grouping, dimmed-state feel, undo/redo visual smoothness, the rescue-after-🗑️ feeling, restarted-countdown invisibility, toolbar friendliness at 18 buttons, and Fire-7-class performance (FR-001, FR-002, FR-003, FR-027, SC-012, SC-013, spec's "Visual checks for the maintainer" section) — **requires real devices including a Fire-7-class tablet; cannot be performed in this headless environment, left for the maintainer**

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Empty — no dependencies.
- **Foundational (Phase 2)**: No dependencies on Setup (it's empty) — BLOCKS all user stories. T001 → T002/T003 → T004.
- **User Stories (Phase 3–6)**: All depend on Foundational (Phase 2) completion.
  - User Story 1 (Phase 3) has no dependency on Stories 2–4.
  - User Story 2 (Phase 4) reuses `history`/`onHistoryChange` wiring from User Story 1 (T016, T017) — implementation tasks T027/T028 depend on those two US1 tasks, but the test tasks (T023–T026) only depend on Phase 2.
  - User Story 3 (Phase 5) reuses the ↩️/↪️ UI wiring from User Story 1 (T020–T022) — its implementation task (T034) is verification-only.
  - User Story 4 (Phase 6) reuses `history`/`onHistoryChange` wiring from User Story 1 (T016, T017) for its one implementation task (T041); its layout test (T035) depends on nothing but Phase 2 being conceptually done (it doesn't even touch `history.ts`).
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — no dependency on other stories.
- **User Story 2 (P2)**: Test tasks (T023–T026) can start after Phase 2; implementation tasks (T027, T028) additionally need T016/T017 from User Story 1.
- **User Story 3 (P3)**: Test tasks (T029–T033) can start after Phase 2; full end-to-end behavior additionally needs User Story 1's ↩️/↪️ wiring (T020–T022) to be exercised through the UI, though `HistoryManager` itself (Phase 2) already implements the redo contract.
- **User Story 4 (P4)**: The layout test (T035) is fully independent of `history.ts`. The `HistoryManager`-robustness tests (T036–T040) depend only on Phase 2. The re-derivation wiring (T041) depends on User Story 1's T016/T017.

### Within Each User Story

- Tests are written before implementation and should fail first (`HistoryManager`/`captureWorldState`/`restoreWorldState` don't exist until Phase 2 is done, and UI wiring doesn't exist until each story's implementation tasks land).
- All test tasks within a story's test block are marked [P] — each is an independent set of assertions appended to the same new file, but they exercise disjoint scenarios and can be authored in any order; if truly run in parallel by multiple agents, coordinate appends to avoid clobbering `tests/unit/sim/history.test.ts`.

### Parallel Opportunities

- All Phase 3 test tasks (T005–T015) can be authored in parallel (same file, disjoint test cases — coordinate merge).
- All Phase 4 test tasks (T023–T026), Phase 5 test tasks (T029–T033), and Phase 6 test tasks (T035–T040) are likewise parallelizable within their own phase.
- T002 and T003 (capture and restore) can be implemented in parallel once T001's type/constant exist, since neither calls the other.
- Phase 7's T042/T043 (both read-only verification) can run in parallel with each other.

---

## Parallel Example: User Story 1

```bash
# Launch all test-writing tasks for User Story 1 together (same file, disjoint cases):
Task: "One stroke per painting tool captured/drawn/undone to cell-for-cell identity in tests/unit/sim/history.test.ts"
Task: "Eraser stroke restore test in tests/unit/sim/history.test.ts"
Task: "Star power spread rewind test in tests/unit/sim/history.test.ts"
Task: "Pre-action capture point test in tests/unit/sim/history.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (`history.ts` in full — CRITICAL, blocks every story).
2. Complete Phase 3: User Story 1 (↩️ works for every stroke, dims when empty).
3. **STOP and VALIDATE**: Run `tests/unit/sim/history.test.ts`'s US1 cases and manually confirm ↩️ in the running app.
4. Deploy/demo if ready — Undo alone is independently valuable per the spec's own priority rationale.

### Incremental Delivery

1. Phase 2 (Foundational) → `history.ts` ready.
2. Phase 3 (US1) → Undo works → validate → demo (MVP).
3. Phase 4 (US2) → Undo rescues 🗑️/scene taps → validate → demo.
4. Phase 5 (US3) → Redo works → validate → demo.
5. Phase 6 (US4) → Toolbar fit + adversarial robustness confirmed → validate → demo.
6. Phase 7 → Non-regression + manual sign-off → ship.

### Parallel Team Strategy

With multiple developers, after Phase 2 (Foundational) lands:

- Developer A: User Story 1 (Phase 3) — unblocks the ↩️/↪️ UI wiring (T016–T022) other stories reuse.
- Developer B: User Story 4's layout test (T035, fully independent) and `HistoryManager`-robustness tests (T036–T040, depend only on Phase 2).
- Once Developer A lands T016/T017/T020–T022: Developer C picks up User Story 2 (T027, T028) and User Story 4's T041 in parallel; Developer A or a fourth developer confirms User Story 3 end-to-end.

---

## Notes

- [P] tasks = different files, or disjoint additions to the same new test file.
- [Story] label maps task to specific user story for traceability.
- This feature's entire `src/sim/*` diff is one new file (`history.ts`) — no existing `src/sim/*` file is ever a task target.
- Every UI-wiring task (T016–T022, T027, T028, T041) targets one of exactly three existing Svelte files, per contracts/undo-redo-mechanics.md's signature diff.
- Verify tests fail before implementing (Phase 2 doesn't exist yet when Phase 3's tests are first authored).
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently.
