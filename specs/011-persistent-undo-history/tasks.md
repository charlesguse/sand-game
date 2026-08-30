---

description: "Task list for feature implementation"
---

# Tasks: Undo That Survives Closing The App

**Input**: Design documents from `/specs/011-persistent-undo-history/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/persistent-history-mechanics.md, quickstart.md (all present)

**Tests**: Explicitly requested by FR-025/quickstart.md — this task list includes the new `tests/unit/sim/historySave.test.ts` suite and additive `describe` blocks in the existing `tests/unit/sim/history.test.ts`.

**Organization**: Tasks are grouped by user story (spec.md priorities P1–P3) to enable independent implementation and testing of each story. This feature adds exactly two new files (`src/sim/historySave.ts`, `tests/unit/sim/historySave.test.ts`), extends one existing `src/sim/*` file (`history.ts`) and its test file additively, and touches only `PlayArea.svelte`'s save/restore glue — no other existing file changes (FR-020, FR-023).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, or disjoint additions to the same new file)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single client-only web app (established 001–010, plus PR #33's auto-save): `src/sim/*` (framework-free core), `src/lib/*` (Svelte UI helpers), `src/*.svelte` (shell), `tests/unit/*` (vitest, no DOM).

---

## Phase 1: Setup

**Purpose**: No project initialization needed — this feature extends the existing 001–010 scaffold in place, adding no dependency, build step, or config change (plan.md Technical Context, research.md §8). This phase is intentionally empty.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: `historySave.ts`'s constants/fingerprint and `HistoryManager`'s extended surface are the shared machinery every user story's codec and UI-wiring tasks build on. All must exist and be regression-verified before any story-specific implementation task can be meaningfully written.

**⚠️ CRITICAL**: No user-story implementation task can begin until T001–T004 are complete.

- [ ] T001 Create `src/sim/historySave.ts` with the `HISTORY_SAVE_VERSION = 1` and `HISTORY_BYTE_BUDGET = 2 * 1024 * 1024` constants and `computeFingerprint(raw: string): string` — a deterministic, synchronous 32-bit FNV-1a hash, hex-encoded, wrapped so it never throws, per contracts/persistent-history-mechanics.md
- [ ] T002 [P] In `src/sim/history.ts`, extract `HistoryManager.remap`'s existing per-state filter-then-map body (the `wouldRemapLosslessly` + `remapWorldState` calls) into a new exported free function `remapWorldStates(states: readonly WorldState[], oldWidth: number, oldHeight: number, newWidth: number, newHeight: number, offsetX: number, offsetY: number): WorldState[]`, then reduce `HistoryManager.remap`'s body to call it for `undoStack` and `redoStack` in turn — behavior-identical refactor, per research.md §6
- [ ] T003 In `src/sim/history.ts`, add `HistoryManager.getPersistableUndoStack(): readonly WorldState[]` returning the live `undoStack` array uncloned, in its existing oldest-first/newest-last order (depends on T002)
- [ ] T004 In `src/sim/history.ts`, add `HistoryManager.restoreFromPersisted(states: WorldState[]): void` — replaces `undoStack` with `states`, clears `redoStack` to `[]` and `pending` to `null` (depends on T002)
- [ ] T005 [P] In `tests/unit/sim/history.test.ts`, add a `describe` block asserting `remapWorldStates`'s output for a representative set of inputs (including at least one lossy-drop case) is byte-for-byte identical to what `HistoryManager.remap`'s pre-refactor body produced for the same inputs, and confirm every existing `describe` block in the file still passes unchanged (depends on T002)
- [ ] T006 [P] In `tests/unit/sim/history.test.ts`, add `describe` blocks for `getPersistableUndoStack` (returns the live undo stack in its existing order) and `restoreFromPersisted` (`undoStack` replaced, `redoStack` cleared to `[]`, `pending` cleared, `canUndo()`/`canRedo()` reflect the new state) (depends on T003, T004)

**Checkpoint**: `historySave.ts`'s scaffold and `HistoryManager`'s extended surface exist and are regression-verified. User story implementation can now begin.

---

## Phase 3: User Story 1 - Taking back the last thing she did before she closed the app (Priority: P1) 🎯 MVP

**Goal**: Closing and reopening the app at the same field size restores the undo history exactly as it was, so ↩️ is lit and each tap takes back one more of the previous session's actions.

**Independent Test**: In a headless world, record several actions, serialize the session as a close would, discard everything in memory, deserialize into a fresh session at the same field size, and assert that Undo is available and that each tap restores exactly the world state its counterpart restored in the first session — cell for cell in every visible property, plus every placed object.

### Tests for User Story 1 ⚠️

- [ ] T007 [P] [US1] In `tests/unit/sim/historySave.test.ts`, write `serializeHistory`/`deserializeHistory` round-trip tests: capture several actions into a live undo stack via `HistoryManager`, `serializeHistory` against the world's own fingerprint, discard everything in memory, `deserializeHistory` at the same field size, `restoreFromPersisted` into a fresh `HistoryManager`, and assert `canUndo()` is `true` and each `undo()` call restores exactly the world state its counterpart restored before the round trip — cell for cell in every visible property, plus every placed object (Scenario 1–3, FR-001, FR-002, SC-001, SC-002)
- [ ] T008 [P] [US1] In `tests/unit/sim/history.test.ts`, add a test that consecutive `undo()` calls after `restoreFromPersisted` walk the surviving steps most-recent-first until `canUndo()` becomes `false`, and a further `undo()` call is then a no-op — indistinguishable from an in-session history emptying (Scenario 3–4, FR-004)
- [ ] T009 [P] [US1] In `tests/unit/sim/history.test.ts`, add a test that a new `beginAction`/`commitAction` recorded after `restoreFromPersisted` pushes onto the restored stack under the existing `HISTORY_DEPTH = 10` cap, silently evicting the oldest restored step once the cap is reached, and is itself undoable with one `undo()` call (Scenario 5, FR-005)
- [ ] T010 [P] [US1] In `tests/unit/sim/history.test.ts`, add a test that `restoreFromPersisted` always leaves `canRedo()` `false` regardless of what is passed in, and that redo only lights up after an `undo()` call in the new session (Scenario 7, FR-007)
- [ ] T011 [P] [US1] In `tests/unit/sim/historySave.test.ts`, write `computeFingerprint` tests: deterministic (the same input always produces the same output) and practically collision-free across a batch of dozens of distinct synthetic world strings (FR-017)
- [ ] T012 [P] [US1] In `tests/unit/sim/historySave.test.ts`, write a `Map`-backed in-memory fake `KeyValueStore` (`getItem`/`setItem`/`removeItem`) and test `writeOrdinarySave`/`writeFlushSave`'s basic write path: `writeOrdinarySave` writes `worldJson` to `saveKey` and removes `historyKey`; `writeFlushSave` writes `worldJson` to `saveKey` and writes `historyJson` to `historyKey` when `historyJson` is non-empty

### Implementation for User Story 1

- [ ] T013 [US1] Implement `serializeHistory(steps: readonly WorldState[], width: number, height: number, worldFingerprint: string): string` in `src/sim/historySave.ts` — walks `steps` newest-first, builds each step's per-step wire shape (base64'd `elements`/`colorAux`/`cloud`/`glitter`/`grassHeight` via `save.ts`'s `encodeBase64`, `byKind` via `OBJECT_KINDS` from `objects.ts`), measures each step's own `JSON.stringify` length, stops before the running total would exceed `HISTORY_BYTE_BUDGET`, reverses the kept steps back to oldest-kept-first/newest-last order, wraps them in `{ version: HISTORY_SAVE_VERSION, width, height, worldFingerprint, steps }` and `JSON.stringify`'s once; returns `''` if even the single newest step does not fit; never throws (depends on T001)
- [ ] T014 [US1] Implement `deserializeHistory(raw: string, expectedFingerprint: string): PersistedHistory | null` in `src/sim/historySave.ts` — validates JSON shape, `wire.version === HISTORY_SAVE_VERSION`, every step's five arrays decode via `save.ts`'s `decodeBase64` to exactly `width * height` bytes each, and `wire.worldFingerprint === expectedFingerprint`; returns `null` on any failure; defensively caps the returned `steps` array at `HISTORY_DEPTH` (imported from `history.ts`) even if a hand-edited payload's array is longer; never throws (depends on T013)
- [ ] T015 [US1] Define the `KeyValueStore` interface (`{ getItem(key): string | null; setItem(key, value): void; removeItem(key): void }`) and the `PersistedHistory` interface (`{ width: number; height: number; steps: WorldState[] }`) in `src/sim/historySave.ts` (depends on T001)
- [ ] T016 [US1] Implement `writeOrdinarySave(store: KeyValueStore, saveKey: string, historyKey: string, worldJson: string): void` in `src/sim/historySave.ts` — no-op if `worldJson === ''`; otherwise writes `worldJson` to `saveKey` inside its own `try`/`catch` (returning early, touching nothing else, if that throws), then unconditionally removes `historyKey` inside its own `try`/`catch` (FR-013a) (depends on T015)
- [ ] T017 [US1] Implement `writeFlushSave(store: KeyValueStore, saveKey: string, historyKey: string, worldJson: string, historyJson: string): void` in `src/sim/historySave.ts` — same `worldJson === ''`/throws short-circuit as `writeOrdinarySave`; once the world write succeeds, writes `historyJson` to `historyKey` if non-empty, or removes `historyKey` if `historyJson === ''`, each inside its own `try`/`catch` (depends on T015)
- [ ] T018 [US1] In `src/lib/PlayArea.svelte`, add `const HISTORY_KEY = 'rainbow-sand-history-v1';` sibling to the existing `SAVE_KEY`, and import `computeFingerprint`, `serializeHistory`, `deserializeHistory`, `writeOrdinarySave`, `writeFlushSave` from `../sim/historySave` (depends on T013, T014, T016, T017)
- [ ] T019 [US1] In `src/lib/PlayArea.svelte`, replace `saveNow()`'s body with a call to `writeOrdinarySave(localStorage, SAVE_KEY, HISTORY_KEY, serializeWorld(grid, objectsState, petsState))` — same "keep whatever save exists on failure" behavior toward the world save as today, now additionally invalidating any stored history on every ordinary save (FR-013a) (depends on T018)
- [ ] T020 [US1] In `src/lib/PlayArea.svelte`, add a new `flushSave(): void` function — serializes the world once via `serializeWorld`, computes its fingerprint via `computeFingerprint` if serialization succeeded, serializes the history via `serializeHistory(history.getPersistableUndoStack(), grid.width, grid.height, fingerprint)`, and calls `writeFlushSave(localStorage, SAVE_KEY, HISTORY_KEY, worldJson, historyJson)` — passing `''` for `historyJson` when world serialization failed or nothing fit the budget (depends on T018)
- [ ] T021 [US1] In `src/lib/PlayArea.svelte`, retarget `handleVisibilityHidden`'s `saveNow()` call and the `pagehide` listener (`window.addEventListener('pagehide', saveNow)` and its matching `removeEventListener`) to call `flushSave` instead — `saveNow` is no longer called from either going-away moment; `scheduleSave`'s debounce timer continues to call `saveNow` unchanged (depends on T020)
- [ ] T022 [US1] In `src/lib/PlayArea.svelte`'s `tryRestore()`, replace the unconditional `history.reset()` call with the same-dimensions restore branch: read `HISTORY_KEY`, compute the fingerprint of the raw world-save string already in hand, call `deserializeHistory`, and when it succeeds and `persisted.width === saved.width && persisted.height === saved.height` and those equal the live grid's current dimensions, call `history.restoreFromPersisted(persisted.steps)` — falling back to `history.reset()` on any failure (missing key, invalid payload, fingerprint or dimension mismatch) or when the live grid's dimensions differ from `saved`'s (deferred to T032/US3); the existing `onHistoryChange?.(history.canUndo(), history.canRedo())` call stays in its current position, now reflecting whichever branch ran (depends on T014, T004, T021)

**Checkpoint**: User Story 1 is fully functional and independently testable — closing and reopening at the same field size restores the undo history exactly, and ↩️ dims once the surviving steps run out.

---

## Phase 4: User Story 2 - A big picture, a small budget (Priority: P2)

**Goal**: When not all ten remembered steps can survive a close, the most recent handful come back and the rest quietly do not — never a quota error, never a stale history restored against a newer world.

**Independent Test**: Serialize sessions at a range of play-field sizes with a full ten-step history, and assert that the persisted payload never exceeds the budget, that the steps kept are always the newest ones in order, and that the world save is byte-for-byte unaffected by how many history steps were kept.

### Tests for User Story 2 ⚠️

- [ ] T023 [P] [US2] In `tests/unit/sim/historySave.test.ts`, write a test with a full 10-step undo history whose steps together exceed `HISTORY_BYTE_BUDGET`: assert `serializeHistory`'s output never exceeds the budget, the kept steps are always the newest ones (compared back to the tail of the original stack), and their relative order is preserved (Scenario 1, FR-008, FR-009, SC-004, SC-005)
- [ ] T024 [P] [US2] In `tests/unit/sim/historySave.test.ts`, write a test with a play-field size large enough that not even one step fits the budget: assert `serializeHistory` returns `''`, and that `writeFlushSave` called with that empty `historyJson` removes any existing history key rather than writing an empty payload (Scenario 2, FR-010)
- [ ] T025 [P] [US2] In `tests/unit/sim/historySave.test.ts`, write a test with a `KeyValueStore` fake whose `setItem` always throws (modeling quota exhaustion / storage disabled / private mode): assert `writeFlushSave` and `writeOrdinarySave` both still leave the world's own `setItem` call attempted, 0 history bytes stored, and 0 exceptions escaping either function (Scenario 3, FR-012, SC-006)
- [ ] T026 [P] [US2] In `tests/unit/sim/historySave.test.ts`, write a test with a `KeyValueStore` fake pre-seeded with a stale history entry: assert a `writeOrdinarySave` call removes it, and a `writeFlushSave` call whose `historyJson` argument is `''` also removes it (Scenario 4, FR-013a, SC-016)
- [ ] T027 [P] [US2] In `tests/unit/sim/historySave.test.ts`, write a test measuring `serializeHistory`'s actual `JSON.stringify` length (not estimated) across at least 20 varied synthetic sessions spanning spec 006's supported field sizes, asserting it is always `<=` `HISTORY_BYTE_BUDGET` in 100% of cases (SC-004)
- [ ] T028 [P] [US2] In `tests/unit/sim/historySave.test.ts`, write a test that closing and reopening 5 times in a row without drawing (repeated `serializeHistory`/`deserializeHistory`/`writeFlushSave` round trips on an unchanged undo stack) leaves the same steps available every time, with 0 growth in stored size and 0 duplicated steps (SC-014)

**No new implementation tasks** — the newest-first budget-fill algorithm (T013), the empty-sentinel handling (T013/T017), and the storage-orchestration invalidation rules (T016/T017) were already built to spec in User Story 1; this phase adds only the additional test coverage of that existing machinery at the sizes and failure modes User Story 2 is about.

**Checkpoint**: User Stories 1 AND 2 both work independently — the size constraint degrades silently and newest-first, exactly as User Story 1's already-built machinery was designed to.

---

## Phase 5: User Story 3 - Reopening in a different shape (Priority: P3)

**Goal**: Reopening at a different field size (rotation, fullscreen toggle) re-anchors the surviving persisted history exactly as a live re-derivation would, dropping only the steps that cannot survive losslessly.

**Independent Test**: Serialize a session at one field size, deserialize into a fresh session at a different field size, and assert that every restored step is either exactly the re-anchored original (as a live re-derivation would produce) or absent — never a state with silently missing cells or objects, and never a state of the wrong shape.

### Tests for User Story 3 ⚠️

- [ ] T029 [P] [US3] In `tests/unit/sim/history.test.ts`, write a test that a set of persisted steps `remapWorldStates`-remapped into a fresh field size produces, for every surviving step, exactly what a live `HistoryManager.remap` call would have produced for the same inputs (byte-for-byte comparison), and that every dropped step genuinely fails the same losslessness check the live remap path uses (Scenario 1–2, FR-016, SC-008)
- [ ] T030 [P] [US3] In `tests/unit/sim/history.test.ts`, write a test that a reshape severe enough that zero persisted steps survive `remapWorldStates` results in `restoreFromPersisted([])` leaving `canUndo()` `false` (Scenario 3, FR-016)
- [ ] T031 [P] [US3] In `tests/unit/sim/historySave.test.ts`, write a test asserting the "same field size" branch condition (`persisted.width === saved.width && persisted.height === saved.height`, and both equal to the live grid's current dimensions) is false whenever any one of the three dimensions differs, and true only when all match — the condition `tryRestore` uses to decide whether to call `remapWorldStates` at all (Scenario 4, FR-016)

### Implementation for User Story 3

- [ ] T032 [US3] In `src/lib/PlayArea.svelte`'s `tryRestore()`, extend the history-restore branch added in T022: when the history payload is otherwise valid but `persisted.width`/`persisted.height` differ from the live grid's current dimensions, call `remapWorldStates(persisted.steps, saved.width, saved.height, grid.width, grid.height, offsetX, offsetY)` — reusing the same `offsetX`/`offsetY` already computed for the world's own remap — before passing the result to `history.restoreFromPersisted`; import `remapWorldStates` from `../sim/history` alongside the existing `remapWorldState` import (depends on T022, T002)

**Checkpoint**: All three user stories are independently functional — reopening at a different field size re-anchors the surviving history exactly as a live rotation would.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final non-regression and manual verification per quickstart.md; no new production code expected.

- [ ] T033 [P] Run `npm test` and confirm every test carried over from specs 001–010 (plus PR #33) still passes completely unchanged (FR-023, SC-011)
- [ ] T034 [P] Run `npm run build` and confirm `dist/` contains exactly one file, `dist/index.html`, and that its size has grown by at most 3 KB over the pre-feature build (FR-024, SC-012)
- [ ] T035 Confirm `src/sim/save.ts` has no diff at all from its pre-feature state, and no existing `src/sim/*` file other than the new `historySave.ts` and the additively-extended `history.ts` has any diff (quickstart.md "Validate existing behavior is unchanged", FR-023)
- [ ] T036 Work through quickstart.md's on-device/manual checklist on the Fire 7 Kids tablet and desktop Chrome (Charlie's column) and the iPad standalone home-screen app (Max's column) — close-and-reopen, budget/quota behavior on a busy field, rotation and fullscreen-toggle reopen, 5 consecutive reopens, several days of ordinary use — and record findings for the maintainers per `CLAUDE.md`'s two-platform split; no automated coverage exists for this step

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Empty — no dependencies.
- **Foundational (Phase 2)**: No dependencies on Setup (it's empty) — BLOCKS all user stories. T001 → T002 → T003/T004 → T005/T006.
- **User Stories (Phase 3–5)**: All depend on Foundational (Phase 2) completion.
  - User Story 1 (Phase 3) has no dependency on Stories 2–3, and delivers the entire close-and-reopen feature at the same field size (the MVP).
  - User Story 2 (Phase 4) is pure additional test coverage of machinery User Story 1 already built (T013, T016, T017) — its test tasks depend only on those, not on any new implementation.
  - User Story 3 (Phase 5) reuses `remapWorldStates` from Foundational (T002) and extends the `tryRestore` branch User Story 1 built (T022) — its one implementation task (T032) depends on both.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — no dependency on other stories.
- **User Story 2 (P2)**: Test tasks (T023–T028) depend on User Story 1's `serializeHistory`/`writeOrdinarySave`/`writeFlushSave` (T013, T016, T017) already existing to test against; no story-specific implementation.
- **User Story 3 (P3)**: Test tasks (T029–T031) depend only on Foundational's `remapWorldStates` (T002); the implementation task (T032) additionally needs User Story 1's `tryRestore` history-restore branch (T022) to extend.

### Within Each User Story

- Tests are written before implementation and should fail first (`historySave.ts`'s codec functions don't exist until each story's implementation tasks land).
- All test tasks within a story's test block are marked [P] — each is an independent set of assertions appended to the same file(s), but they exercise disjoint scenarios and can be authored in any order; if truly run in parallel by multiple agents, coordinate appends to avoid clobbering `tests/unit/sim/historySave.test.ts` or `tests/unit/sim/history.test.ts`.

### Parallel Opportunities

- All Phase 3 test tasks (T007–T012) can be authored in parallel (disjoint cases across the two test files — coordinate merge).
- All Phase 4 test tasks (T023–T028) and Phase 5 test tasks (T029–T031) are likewise parallelizable within their own phase.
- T005 and T006 (Foundational tests) can be authored in parallel once T002/T003/T004 exist.
- T013/T014 (serialize/deserialize) must be sequential (T014 imports the same wire shape T013 produces and is easiest to write against a working `serializeHistory`), but T015 (interfaces) can be written alongside T013 in parallel.
- Phase 6's T033/T034/T035 (all read-only verification) can run in parallel with each other.

---

## Parallel Example: User Story 1

```bash
# Launch all test-writing tasks for User Story 1 together (disjoint cases across two files):
Task: "serializeHistory/deserializeHistory round-trip test in tests/unit/sim/historySave.test.ts"
Task: "Consecutive undo-after-restore walks survivors test in tests/unit/sim/history.test.ts"
Task: "New action after restore respects HISTORY_DEPTH cap test in tests/unit/sim/history.test.ts"
Task: "restoreFromPersisted always clears redo test in tests/unit/sim/history.test.ts"
Task: "computeFingerprint determinism/collision test in tests/unit/sim/historySave.test.ts"
Task: "KeyValueStore fake basic write-path test in tests/unit/sim/historySave.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (`historySave.ts` scaffold + `history.ts`'s extended surface — CRITICAL, blocks every story).
2. Complete Phase 3: User Story 1 (close-and-reopen at the same field size restores the undo history; ↩️ lights up and dims correctly).
3. **STOP and VALIDATE**: Run `tests/unit/sim/historySave.test.ts` and `tests/unit/sim/history.test.ts`'s US1 cases, then manually confirm ↩️ across a real close-and-reopen on at least one device.
4. Deploy/demo if ready — this is the entire feature in one tap, per the spec's own priority rationale.

### Incremental Delivery

1. Phase 2 (Foundational) → `historySave.ts` scaffold + extended `HistoryManager` ready.
2. Phase 3 (US1) → close-and-reopen preserves undo at the same field size → validate → demo (MVP).
3. Phase 4 (US2) → the size budget degrades silently and newest-first under a busy field or storage failure → validate → demo.
4. Phase 5 (US3) → reopening at a different field size re-anchors the surviving history → validate → demo.
5. Phase 6 → non-regression + manual sign-off on both maintained platforms → ship.

### Parallel Team Strategy

With multiple developers, after Phase 2 (Foundational) lands:

- Developer A: User Story 1 (Phase 3) — unblocks the `flushSave`/`tryRestore` wiring other stories reuse.
- Developer B: User Story 3's `remapWorldStates` tests (T029–T031, depend only on Phase 2's T002).
- Once Developer A lands T013/T016/T017 (codec + storage orchestration) and T022 (`tryRestore` branch): Developer C picks up User Story 2's test coverage (T023–T028) and Developer B finishes User Story 3's T032 in parallel.

---

## Notes

- [P] tasks = different files, or disjoint additions to the same existing/new file.
- [Story] label maps task to specific user story for traceability.
- This feature's entire `src/sim/*` diff is one new file (`historySave.ts`) plus additive changes to `history.ts` — no other existing `src/sim/*` file is ever a task target (FR-023).
- Every UI-wiring task (T018–T022, T032) targets the same one existing file, `src/lib/PlayArea.svelte`, per contracts/persistent-history-mechanics.md's signature diff — `App.svelte`, `Toolbar.svelte`, and `src/lib/layout.ts` are never touched (FR-020).
- Verify tests fail before implementing (Phase 3's `historySave.test.ts` tests fail until T013–T017 land).
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently.
