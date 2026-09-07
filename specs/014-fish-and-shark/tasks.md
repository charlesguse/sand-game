---

description: "Task list template for feature implementation"
---

# Tasks: Fish And A Shark Living In Her Water

**Input**: Design documents from `/specs/014-fish-and-shark/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/sea-life.md, quickstart.md (all present)

**Tests**: The spec's cross-cutting checklist and FR-034 explicitly require vitest coverage (spawn-threshold rule, caps, hysteresis, eraser hold-off, the shark-never-catches-a-fish invariant, no grid mutation, and re-derivation), so test tasks are included per user story.

**Organization**: Tasks are grouped by user story (spec.md priorities P1/P2/P3) so each can be implemented, tested, and demoed independently, in priority order.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are exact; there is exactly one new production file (`src/sim/seaLife.ts`), one new test file (`tests/unit/sim/seaLife.test.ts`), and one modified file (`src/lib/PlayArea.svelte`) for this entire feature.

## Path Conventions

Single client-only project (established 001–013): `src/`, `tests/unit/` at the repository root. No new top-level directory.

---

## Phase 1: Setup

**Purpose**: Lay down the module's type/constant surface every later task builds on.

- [X] T001 Create `src/sim/seaLife.ts` with the module's imports (`Grid`, `WATER` and whatever else `contracts/sea-life.md` needs from `./types`), the exported constants table from `contracts/sea-life.md` (`FISH_SPAWN_THRESHOLD` = 120, `FISH_DESPAWN_THRESHOLD` = 110, `SHARK_SPAWN_THRESHOLD` = 700, `SHARK_DESPAWN_THRESHOLD` = 690, `FISH_PER_POOL_CAP` = 3, `SHARK_PER_POOL_CAP` = 1, `GLOBAL_FISH_CAP` = 6, `GLOBAL_SHARK_CAP` = 2, `SHARK_MIN_SEPARATION` = 2, `ERASER_HOLD_OFF_FRAMES` = 180, `SWEEP_TARGET_FRAMES` = 45), and the `Fish`, `Shark`, and `SeaLifeState` interfaces exactly as specified in `contracts/sea-life.md`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pool-measurement engine and state lifecycle both User Story 1 (fish) and User Story 2 (shark) spawn/despawn rules depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Implement `createSeaLifeState(grid: Grid): SeaLifeState` in `src/sim/seaLife.ts` — allocates `poolId`/`sweepQueue` sized to `grid.width * grid.height` (all `poolId` entries `-1`), empty `fish`/`sharks`/`eraserCooldowns`, `sweepCursor`/`sweepQueueHead`/`sweepQueueTail`/`sweepNextLabel` at 0, and `sweepBudget = Math.ceil(width * height / SWEEP_TARGET_FRAMES)`, per data-model.md.
- [X] T003 Implement `resetSeaLifeState(state: SeaLifeState, grid: Grid): void` in `src/sim/seaLife.ts` — reallocates `poolId`/`sweepQueue` to `grid`'s current dimensions, clears `fish`/`sharks`/`eraserCooldowns`, restarts the sweep from cell 0, mutating `state` in place (identity preserved), per contracts/sea-life.md.
- [X] T004 Implement the incremental, resumable pool-measurement sweep in `src/sim/seaLife.ts` (an internal `advanceSweep(grid, state)` helper): a 4-connectivity BFS over `grid.elements === WATER` using the reusable `sweepQueue`, processing at most `state.sweepBudget` cells per call, labeling `poolId`, accumulating `poolSize` per label, and reservoir-sampling up to 8 candidate cells per pool into `spawnSample` (research.md §1, §3). Track sweep completion (cursor reaches grid end with an empty queue) so a caller can detect "a full sweep just finished."
- [X] T005 Implement `stepSeaLife(grid: Grid, state: SeaLifeState): void`'s outer shell in `src/sim/seaLife.ts`: decrement every `eraserCooldowns` entry's `framesRemaining` and drop expired ones, call `advanceSweep`, and call a `reconcilePopulations(grid, state)` helper (stubbed as a no-op for now, filled in by later stories) whenever a sweep completes, then reset the sweep to begin again immediately.
- [X] T006 [P] In `src/lib/PlayArea.svelte`, import `createSeaLifeState` (and, as later tasks need them, the rest of the `seaLife` module) from `../sim/seaLife`, and declare `const seaLifeState = createSeaLifeState(grid);` beside `const petsState = createPetsState();` (~line 86).
- [X] T007 [P] Create `tests/unit/sim/seaLife.test.ts` with a grid-building test helper that hand-places a rectangular WATER region (and, where needed, sand/other elements) into a freshly created `Grid`, mirroring `tests/unit/sim/pets.test.ts`'s setup pattern, plus one test asserting `createSeaLifeState`/`resetSeaLifeState`'s postconditions from `contracts/sea-life.md` (`fish.length === 0`, `sharks.length === 0`, `poolId.length === width * height`, all `-1`, `sweepCursor === 0`).

**Checkpoint**: Pools can be measured and sampled; `SeaLifeState` can be created/reset/stepped end-to-end with zero creatures. No user-visible behavior yet.

---

## Phase 3: User Story 1 - Fish come to live in her pond (Priority: P1) 🎯 MVP

**Goal**: Fish appear on their own once a pool of water crosses the fish threshold, drift/bob/turn inside their own pool, and never touch or leave the water.

**Independent Test**: In a headless grid, fill a region with water above/below the fish threshold, run `stepSeaLife` for several sweeps, and assert fish appear only above threshold, their count matches the per-pool rule, every fish's cell is always water in its own pool, they reverse at pool edges, they occasionally turn on their own, and no `Grid` array is ever modified.

### Tests for User Story 1 ⚠️

- [X] T008 [P] [US1] In `tests/unit/sim/seaLife.test.ts`, write tests for the spawn-threshold rule: a pool below `FISH_SPAWN_THRESHOLD` never gets a fish over many `stepSeaLife` calls (Scenario 1); a pool crossing the threshold gets a fish within roughly `SWEEP_TARGET_FRAMES` frames (Scenario 2); fish count grows with pool size up to `FISH_PER_POOL_CAP` (Scenario 3); and, with multiple pools exceeding the combined `GLOBAL_FISH_CAP`, the largest pools are populated first (FR-006).
- [X] T009 [P] [US1] In `tests/unit/sim/seaLife.test.ts`, write tests for fish movement: over a long run, every fish's `(round(x), round(y))` cell is `WATER` and inside its own pool at every single frame, including a case where a stroke of sand is drawn straight through the pool mid-run (Scenario 5, Edge Cases); a fish reverses direction at a pool edge/wall/object rather than passing through (Scenario 5); and a fish's direction changes at least once over a long run with no external input (Scenario 6).
- [X] T010 [P] [US1] In `tests/unit/sim/seaLife.test.ts`, write a test that snapshots every `Grid` array (`elements`, `shades`, `hues`, `moved`, `glitter`, `grassHeight`, `grassCooldown`, `starPowerAge`, `starPowerLife`, `starPowerFuelled`, `cloud`, `fogRiseCooldown`, `fogStuckSteps`, `fogAge`, `cloudRainDelay`, `grassCount`, `fogCloudCount`) before and after a run that spawns and moves several fish, and asserts byte-for-byte equality (FR-012, Scenario 7).

### Implementation for User Story 1

- [X] T011 [US1] In `src/sim/seaLife.ts`, implement the fish half of `reconcilePopulations`: sort pools with `poolSize >= FISH_DESPAWN_THRESHOLD` descending by size; compute each pool's fish target (`>= FISH_SPAWN_THRESHOLD`: `min(floor(size / FISH_SPAWN_THRESHOLD), FISH_PER_POOL_CAP)` clamped by remaining `GLOBAL_FISH_CAP` budget; in the hysteresis band `[FISH_DESPAWN_THRESHOLD, FISH_SPAWN_THRESHOLD)`: hold the pool's current count; below `FISH_DESPAWN_THRESHOLD`: target 0); start `fadeTimer` on excess live fish above target; spawn new fish (from `spawnSample`) to reach a target above current count (research.md §4).
- [X] T012 [US1] In `src/sim/seaLife.ts`, implement fish movement: simple drift (`dirX`/`dirY`, one axis non-zero in the common case), a cosmetic `bobPhase` advance feeding a render-only offset (never mutating `x`/`y`, research.md §7), a `turnCooldown`-gated random direction change (FR-010), and a hard rule that a candidate next cell must be `WATER` in `grid.elements` or the fish turns instead (research.md §2) — movement never reads `poolId`.
- [X] T013 [US1] In `src/sim/seaLife.ts`, implement fish fade-out: if a live fish's own `(round(x), round(y))` cell is no longer `WATER`, start its `fadeTimer` immediately (research.md §2); once any fish's `fadeTimer` counts down to 0, remove it from `state.fish` (FR-022, FR-023).
- [X] T014 [US1] In `src/sim/seaLife.ts`, wire fish stepping into `stepSeaLife`: for every entry in `state.fish`, run the fade countdown/removal (T013) if `fadeTimer > 0`, otherwise the water-check-then-movement step (T012).
- [X] T015 [US1] In `src/lib/PlayArea.svelte`'s `frame()`, call `stepSeaLife(grid, seaLifeState);` immediately after `stepPets(grid, petsState, poodleTarget);` (~line 484) and before `render()`.
- [X] T016 [US1] In `src/lib/PlayArea.svelte`'s `render()`, after the poodle glyph loop (~line 430), draw `'🐠'` via `ctx.fillText` for each `seaLifeState.fish` entry at `(fish.x, fish.y + bob-offset-from-bobPhase)`, horizontally flipped by `dirX` the way the poodle glyph is flipped by `facing`, at reduced `globalAlpha` proportional to `fadeTimer` when `fadeTimer > 0` (FR-013, FR-023).
- [X] T017 [US1] In `src/lib/PlayArea.svelte`'s `tryRestore()`, call `resetSeaLifeState(seaLifeState, grid);` right after `repositionPoodles(petsState.poodles, grid, offsetX, offsetY);` (~line 223), so a restored world re-derives its fish from the restored water instead of starting from whatever the fresh mount's `createSeaLifeState` produced (FR-027, FR-028).

**Checkpoint**: User Story 1 is fully functional and independently demoable — pour water, watch fish arrive, drift, and leave cleanly when the water goes away.

---

## Phase 4: User Story 2 - A shark comes to play in the big lake (Priority: P2)

**Goal**: A single shark appears in big-enough pools, plays a game of tag with the fish that it can never win — no fish is ever removed, hidden, or cornered without relief.

**Independent Test**: In a headless grid, fill a region above the shark threshold, run a long simulated chase, and assert exactly one shark appears, the fish count never decreases for a reason attributable to the shark, the shark-to-fish distance never drops below the minimum separation, a chase ends on its own, and a shark with no fish in its pool simply drifts.

### Tests for User Story 2 ⚠️

- [X] T018 [P] [US2] In `tests/unit/sim/seaLife.test.ts`, write tests for the shark spawn-threshold rule: a pool between the fish and shark thresholds never spawns a shark over a long run (Scenario 1); a pool at or above `SHARK_SPAWN_THRESHOLD` gets exactly one shark, never two, across many completed sweeps (Scenario 2).
- [X] T019 [P] [US2] In `tests/unit/sim/seaLife.test.ts`, write a long-run chase test asserting: `state.fish.length` never decreases at any frame for a reason attributable to the shark (Scenario 4, SC-002); the minimum shark-to-any-live-fish distance observed across the entire run is always `>= SHARK_MIN_SEPARATION` (Scenario 5, FR-017); a chase's `chaseTimer` reaches 0 and `targetFishId` changes or clears within a bounded number of frames (Scenario 6, FR-019); and with `state.fish` emptied mid-run, the shark's movement matches a plain fish's drift rule (Scenario 8, FR-020).
- [X] T020 [US2] In `src/sim/seaLife.ts`, implement the shark half of `reconcilePopulations`: same size-sorted, hysteresis-banded, global-cap-clamped target computation as fish (using `SHARK_SPAWN_THRESHOLD`/`SHARK_DESPAWN_THRESHOLD`/`SHARK_PER_POOL_CAP`/`GLOBAL_SHARK_CAP`), independent of the fish budget (research.md §4).
- [X] T021 [US2] In `src/sim/seaLife.ts`, implement shark movement/chase AI: with no `targetFishId`, pick the globally nearest live fish and start a `chaseTimer` (~5s); move toward the target faster than fish drift, but reject any candidate move that would bring the shark within `SHARK_MIN_SEPARATION` of *any* live fish (not just the target) — a hard pre-move check, not a tendency (research.md §6, FR-017); when `chaseTimer` reaches 0, clear `targetFishId`, set `cruiseCooldown`, and drift like a fish until it expires (FR-019); with no live fish at all, always just drift (FR-020).
- [X] T022 [US2] In `src/sim/seaLife.ts`, implement the fish scatter reaction: when a shark closes within a "nearby" range of a fish, set that fish's (and nearby fish's) `scatterTimer` and turn it away in a short burst (FR-018); while `scatterTimer > 0`, movement uses the faster shark-avoiding rule instead of ordinary drift, decaying back to ordinary drift once it reaches 0 (FR-018, Scenario 7).
- [X] T023 [US2] In `src/sim/seaLife.ts`, wire shark stepping into `stepSeaLife` (same fade-countdown/water-check/movement shape as T014, using T021's chase AI in place of plain drift when it has a target) and reuse the fish fade-out mechanism (T013) for sharks whose own cell stops being water or whose pool falls below `SHARK_DESPAWN_THRESHOLD`.
- [X] T024 [US2] In `src/lib/PlayArea.svelte`'s `render()`, draw `'🦈'` via `ctx.fillText` for each `seaLifeState.sharks` entry at a visibly larger font size than the fish glyph, flipped by `facing`, at reduced `globalAlpha` proportional to `fadeTimer` when fading (FR-013, FR-021).

**Checkpoint**: User Stories 1 and 2 both work independently and together — fish drift, a shark plays a harmless game of tag, and the fish count never drops because of it.

---

## Phase 5: User Story 3 - Fish come and go without anything looking broken (Priority: P3)

**Goal**: Every lifecycle event — draining, splitting, merging, erasing, clearing, saving/restoring, undo/redo, and re-derivation — leaves every remaining fish/shark inside water and inside the grid, with nothing stranded, flickering, or crashing.

**Independent Test**: In a headless grid, drive each lifecycle event and assert after each that every remaining creature sits inside water and inside the grid, that removed ones are gone, and that nothing throws.

### Tests for User Story 3 ⚠️

- [X] T025 [P] [US3] In `tests/unit/sim/seaLife.test.ts`, write tests for pool split/merge: paint a sand line through a qualifying pool to split it into two smaller ones and assert each fragment's population matches its own size under the ordinary rule after the next sweep completes; merge two pools into one and assert the combined lake's population matches its combined size (Scenario 3).
- [X] T026 [P] [US3] In `tests/unit/sim/seaLife.test.ts`, write tests for the eraser hold-off: erasing a fish/shark removes it that same call and its pool's spawn target does not grow again until `ERASER_HOLD_OFF_FRAMES` have elapsed, then the pool repopulates under the ordinary rule with no further action (Scenario 5, FR-025, SC-008).
- [X] T027 [P] [US3] In `tests/unit/sim/seaLife.test.ts`, write a test that `clearSeaLife` empties `fish`/`sharks`/`eraserCooldowns`, and that a subsequent sweep over an emptied grid spawns nothing (Scenario 6).
- [X] T028 [P] [US3] In `tests/unit/sim/seaLife.test.ts`, write a test that calls `resetSeaLifeState` against a differently-shaped (resized) `Grid` with existing water, and asserts populations re-settle from the new water within about a second (roughly `SWEEP_TARGET_FRAMES` frames), with nothing ever out of bounds or outside water in between (Scenarios 9, 10, FR-028, FR-029, FR-030).
- [X] T029 [P] [US3] In `tests/unit/sim/seaLife.test.ts`, write a combined-invariant test that steps `stepSeaLife` alongside the existing `step()` on a grid exercising fog formation, rain, grass drinking, and a poodle walking/shaking through a populated pool (via `stepPets`), and asserts neither disturbs the other — every existing element invariant holds and no fish/shark is displaced by it (Edge Cases).

### Implementation for User Story 3

- [X] T030 [US3] In `src/sim/seaLife.ts`, implement `eraseSeaLifeInBrush(state, cx, cy, radius): void` — removes every fish/shark whose position falls inside the circular footprint immediately (not via `fadeTimer`), pushing one `eraserCooldowns` entry per removal at that creature's last `(x, y)` (FR-024, FR-025).
- [X] T031 [US3] In `src/sim/seaLife.ts`, implement `eraseSeaLifeInBrushLine(state, from, to, radius): void` as a Bresenham-interpolated repetition of `eraseSeaLifeInBrush` along the segment, mirroring `eraseObjectsInBrushLine`'s shape, so a fast drag can't skip over a creature (FR-024).
- [X] T032 [US3] In `src/sim/seaLife.ts`, implement `clearSeaLife(state): void` — empties `fish`, `sharks`, and `eraserCooldowns` in place, leaving sweep buffers untouched (FR-026).
- [X] T033 [US3] In `src/sim/seaLife.ts`'s `reconcilePopulations` (T011/T020), clamp a pool's spawn target to at most its current live count for the cycle whenever any live `eraserCooldowns` entry's current `poolId` lookup lands in that pool — never growing it until the cooldown expires (research.md §4, §5, FR-025).
- [X] T034 [US3] In `src/lib/PlayArea.svelte`'s `paintAt()` eraser branch (~lines 526-530), call `eraseSeaLifeInBrushLine(seaLifeState, from, pos, radius)` / `eraseSeaLifeInBrush(seaLifeState, pos.x, pos.y, radius)` alongside the existing `eraseObjectsInBrush*` calls.
- [X] T035 [US3] In `src/lib/PlayArea.svelte`'s `clearAll()` (~line 667), call `clearSeaLife(seaLifeState);` alongside `clearPets(petsState);` (FR-026).
- [X] T036 [US3] In `src/lib/PlayArea.svelte`, call `resetSeaLifeState(seaLifeState, grid);` in `resize()` right after `grid = newGrid;` (~line 293, alongside `repositionPoodles`) and in `loadScene()` alongside `clearPets(petsState);` (~line 679), so re-derivation and scene switches re-derive sea life from the new water (FR-030, Edge Cases: preloaded scenes).
- [X] T037 [US3] In `src/lib/PlayArea.svelte`, call `resetSeaLifeState(seaLifeState, grid);` in both `undo()` and `redo()` (~lines 686-702), right after `history.undo(grid, objectsState);` / `history.redo(grid, objectsState);`, so populations re-settle to match the restored grid (FR-029).

**Checkpoint**: All three user stories are independently functional; the full feature matches every acceptance scenario in spec.md.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Confirm nothing outside this feature regressed, and hand off what only a human can verify.

- [X] T038 [P] Run `npm test` and confirm every existing test from specs 001–013 still passes unmodified (SC-010) alongside the new `tests/unit/sim/seaLife.test.ts` suite.
- [X] T039 [P] Run `npm run build`, confirm `dist/index.html` is the only emitted file, open it via `file://`, and confirm the toolbar is pixel-for-pixel unchanged from spec 013 — no new button, no layout shift (FR-008, SC-004).
- [ ] T040 Perform the Manual Verification pass from `quickstart.md`/spec.md on both reference platforms (Fire 7 Kids tablet/Silk and desktop Chrome for Charlie; iPad Safari standalone for Max): 🐠/🦈 render as real emoji (not empty boxes); a chase reads as playful, not frightening (SC-009); frame rate holds with every cap filled (SC-005); rotating the device with a populated lake leaves nothing stranded or flickering and the undo history survives.
  - **Left unchecked — needs a human on real hardware.** This run has no browser/device to eyeball emoji rendering, chase "feel," live frame rate, or rotation behavior on Fire 7 Kids tablet/Silk, desktop Chrome, or iPad Safari standalone. Everything automatable is done: `npm test` (708/708, all 001–013 suites unmodified-passing) and `npm run build` (single `dist/index.html`, no separate JS/CSS chunk, `🐠`/`🦈` present in the bundle, toolbar geometry/glyph tests untouched and green). 🐠 (Unicode 6.0) and 🦈 (Unicode 9.0) predate the Emoji-13.0/Segoe-UI-Emoji caution in `CLAUDE.md`'s glyph table, so no inline SVG fallback was built, per plan.md's call — but that call still wants eyeballing on both reference devices before shipping, not just trusting the Unicode version.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup (needs the types/constants from T001). Blocks every user story.
- **User Story 1 (Phase 3)**: Depends only on Foundational.
- **User Story 2 (Phase 4)**: Depends on Foundational *and* User Story 1 — shark reconciliation reuses the fish reconciliation shape (T011) and chase AI targets live fish (T014's `state.fish`), and the spec itself ranks fish as the dependency (spec.md "it depends on fish existing").
- **User Story 3 (Phase 5)**: Depends on Foundational, User Story 1, and User Story 2 — its lifecycle tests exercise eraser/clear/restore behavior against both fish and sharks together.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Within Each User Story

- Tests are written first (they will fail until the implementation tasks land) and target the same new test file, so they are listed before implementation but are not required to block it task-by-task.
- `seaLife.ts` reconciliation/movement/fade logic before the `stepSeaLife` wiring that calls it.
- `stepSeaLife`/module wiring before the `PlayArea.svelte` call sites that invoke it.

### Parallel Opportunities

- T006 and T007 (Foundational) touch different files (`PlayArea.svelte`, `seaLife.test.ts`) and can run in parallel once T001–T005 give them something to call.
- Within each story's test block (T008–T010, T018–T019, T025–T029), the test cases are logically independent of one another and can be drafted in parallel even though they land in the same file — merge the file once, or write sequentially if a single person/agent is doing it.
- T038 and T039 (Polish) are independent shell checks and can run in parallel.
- Because this feature touches only three files total (`src/sim/seaLife.ts`, `src/lib/PlayArea.svelte`, `tests/unit/sim/seaLife.test.ts`), most implementation tasks within a story are sequential edits to the same file rather than parallelizable across contributors.

---

## Parallel Example: User Story 1

```bash
# Once Foundational (Phase 2) is done, draft all three test tasks together:
Task: "Spawn-threshold rule + caps + largest-pools-first tests in tests/unit/sim/seaLife.test.ts"
Task: "Fish movement containment + turn-behavior tests in tests/unit/sim/seaLife.test.ts"
Task: "No-grid-mutation snapshot test in tests/unit/sim/seaLife.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001).
2. Complete Phase 2: Foundational (T002–T007) — the pool sweep and state lifecycle, no visible behavior yet.
3. Complete Phase 3: User Story 1 (T008–T017) — fish appear, drift, and leave cleanly.
4. **STOP and VALIDATE**: `npm test`, then `npm run build` and pour water in the running app — fish should appear on their own.
5. This alone is a complete, shippable toy moment even if the shark is never built (spec.md's own framing).

### Incremental Delivery

1. Setup + Foundational → pool measurement works, nothing visible yet.
2. + User Story 1 → fish delight, demoable on its own (MVP).
3. + User Story 2 → the shark's game of tag, demoable on top of fish.
4. + User Story 3 → every lifecycle edge (erase, clear, save, undo, resize) confirmed never-broken.
5. + Polish → regression check and the two maintainers' manual eyeball pass per `CLAUDE.md`.

### Notes

- [P] tasks = different files, no dependency on an incomplete task in this list.
- [Story] label maps a task to its user story for traceability.
- This feature's whole surface is one new module, one new test file, and additive call sites in one existing `.svelte` file — no new dependency, no toolbar change, no save/undo format change (FR-008, FR-027, FR-029, FR-031).
- Verify tests fail before their implementation task lands where practical; commit after each task or logical group.
