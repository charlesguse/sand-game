---

description: "Task list template for feature implementation"
---

# Tasks: Butterflies Over Her Flowers, Birds On Her Palms

**Input**: Design documents from `/specs/017-butterflies-and-birds/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ambient-life-mechanics.md, quickstart.md

**Tests**: Test tasks are included — spec.md FR-036 explicitly requires vitest coverage with no DOM/browser harness, and quickstart.md enumerates the exact scenarios to cover.

**Organization**: Tasks are grouped by user story (P1 butterflies, P2 birds, P3 clean lifecycle) so each can be implemented and validated independently, per plan.md's two-sibling-file design (`src/sim/butterflies.ts`, `src/sim/birds.ts`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single client-only project (established 001–016): `src/sim/*` (framework-free core), `src/lib/PlayArea.svelte` (Svelte wiring), `tests/unit/sim/*` (vitest, no DOM).

---

## Phase 1: Setup

No new dependency, build step, or project scaffolding is needed (plan.md Technical Context) — `package.json`, `tsconfig.json`, `vite.config.ts`, and `vitest.config.ts` are all unchanged. This phase is empty by design; proceed to Phase 2.

---

## Phase 2: Foundational

No shared infrastructure blocks either user story: `butterflies.ts` and `birds.ts` are two independent sibling files (research.md §5) with no common module, and neither touches `grid.ts`, `objects.ts`, `pets.ts`, `history.ts`, `save.ts`, or `resize.ts` (contracts/ambient-life-mechanics.md's file-by-file diff surface). This phase is empty by design; User Story 1 and User Story 2 can each start immediately and be built in either order.

**Checkpoint**: No foundational work required — proceed directly to Phase 3.

---

## Phase 3: User Story 1 - Butterflies come to her garden (Priority: P1) 🎯 MVP

**Goal**: Butterflies appear automatically near flowers, wander in a wobbling non-physical float between flowers, respect the population/cap rule, and never touch the grid.

**Independent Test**: In a headless grid, grow/place flower cells, run `stepButterflies` for many frames, and assert butterflies appear only once a flower exists, follow the flower-count rule and cap, stay in-bounds and near/travelling-between flowers, wobble rather than travel straight, cross terrain without deflection, and never write a `Grid` cell.

### Tests for User Story 1

- [ ] T001 [P] [US1] Write `tests/unit/sim/butterflies.test.ts` covering the FR-002/SC-001/Scenario-1-2 cases: zero-flower grid keeps `butterflies` empty across many frames; a single `FLOWER` cell produces at least one butterfly within `~FLOWER_SCAN_PASS_FRAMES` frames of appearing
- [ ] T002 [P] [US1] Add to `tests/unit/sim/butterflies.test.ts` the FR-003/Scenario-3 population-rule sweep: for flower counts `0, 1, 4, 5, 8, 9, 12, 13, 16, 17, 40`, assert the settled `butterflies.length` equals `Math.min(4, Math.ceil(n / 4))` for `n > 0` and `0` for `n === 0`
- [ ] T003 [P] [US1] Add to `tests/unit/sim/butterflies.test.ts` the FR-007/FR-008/Scenario-4 motion coverage: with several flowers present, track one butterfly's `state`/`targetX`/`targetY` across many frames and assert it alternates `visiting`→`travelling`→`visiting`, dwells a few seconds' worth of frames while `visiting`, changes target flower on at least some transitions, and that its recorded heading while `travelling` is never exactly the straight bearing to target for more than one consecutive frame
- [ ] T004 [P] [US1] Add to `tests/unit/sim/butterflies.test.ts` the FR-006/FR-009/Scenario-5/Scenario-8 terrain-independence coverage: place `WATER`/`SAND`/`FOG`(`cloud=1`)/`STAR_POWER` cells (including directly under a butterfly's flight path) and assert no butterfly's position or velocity is ever deflected, paused, or pulled toward that terrain, and it still arrives at its target
- [ ] T005 [P] [US1] Add to `tests/unit/sim/butterflies.test.ts` the FR-017/Scenario-6 no-grid-write coverage: snapshot every `Grid` array before and after a long run with butterflies actively visiting/travelling and assert byte-for-byte equality, and separately confirm a control `step(grid)` run with butterflies present matches one with none present
- [ ] T006 [P] [US1] Add to `tests/unit/sim/butterflies.test.ts` the FR-010 stale-target coverage: remove a `travelling` butterfly's destination flower mid-flight (both immediately and only after the next scan pass) and assert it retargets or leaves within one scan pass or its own arrival check, never continuing to head for the now-empty coordinate

### Implementation for User Story 1

- [ ] T007 [US1] Create `src/sim/butterflies.ts` with the `Butterfly`/`ButterfliesState`/`FlowerScanState` types, `BUTTERFLY_CAP`/`FLOWERS_PER_BUTTERFLY`/`ERASE_HOLDOFF_MS` constants, and `createButterfliesState()` exactly per data-model.md and contracts/ambient-life-mechanics.md's `src/sim/butterflies.ts` section
- [ ] T008 [US1] In `src/sim/butterflies.ts`, implement the row-bounded amortized flower scan (research.md §1): each `stepButterflies` call scans `Math.max(1, Math.ceil(grid.height / FLOWER_SCAN_PASS_FRAMES))` rows from `flowerScan.nextRow` into `flowerScan.buffer`, wrapping `nextRow` to `0` and atomically swapping `buffer` into `known` on completing a pass (`FLOWER_SCAN_PASS_FRAMES = 60`)
- [ ] T009 [US1] In `src/sim/butterflies.ts`, implement population maintenance driven by `flowerScan.known.length`: compute `desiredButterflyCount` per FR-003's rule, subtract unexpired `recentErasesAt` entries (pruned of anything older than `ERASE_HOLDOFF_MS`) before deciding whether to spawn, and spawn/remove butterflies via `nextId` up to `BUTTERFLY_CAP`
- [ ] T010 [US1] In `src/sim/butterflies.ts`, implement the per-butterfly `visiting`/`travelling` steering state machine (research.md §3): `travelling` steers by wobbled bearing (`atan2` plus per-frame random wobble seeded from `wobblePhase`) at a fixed `FLIGHT_SPEED`, arrival switches to `visiting` after an `O(1)` live recheck of the target cell (retargeting immediately if it is no longer `FLOWER`), `visiting` dwells for a `timer`-counted duration before choosing a new target and returning to `travelling`; every scan-pass completion also revalidates every `travelling` butterfly's target against the fresh `known` list
- [ ] T011 [US1] Implement `eraseButterfliesInBrush`/`eraseButterfliesInBrushLine` in `src/sim/butterflies.ts`, mirroring `objects.ts`'s `eraseObjectsInBrush`/`eraseObjectsInBrushLine` (Bresenham line interpolation so a fast drag cannot skip a butterfly), recording `now` into `recentErasesAt` on each removal and never touching `grid`
- [ ] T012 [US1] Implement `clearButterflies` in `src/sim/butterflies.ts`: empties `butterflies` and resets the flower scan cursor (`nextRow`, `buffer`, `known`) without touching `grid`
- [ ] T013 [US1] In `src/lib/PlayArea.svelte`, import `createButterfliesState`, `stepButterflies`, `eraseButterfliesInBrush`, `eraseButterfliesInBrushLine`, `clearButterflies` from `../sim/butterflies`, and create `const butterfliesState = createButterfliesState();` beside `objectsState`/`petsState` (near line 86)
- [ ] T014 [US1] In `src/lib/PlayArea.svelte`'s `frame(now)` (near line 484), add `stepButterflies(grid, butterfliesState, now);` after the existing `stepPets` call
- [ ] T015 [US1] In `src/lib/PlayArea.svelte`'s `render()` (near line 396-430), add a draw loop for butterflies styled like the existing poodle glyph loop: set `ctx.font` once to a butterfly-sized value, then per butterfly `ctx.save()`/`translate(x, y)`/`scale(-1, 1)` when `facing === -1`/`fillText('🦋', 0, 0)`/`ctx.restore()`
- [ ] T016 [US1] In `src/lib/PlayArea.svelte`'s `paintAt()` eraser branch (near line 525-531), call `eraseButterfliesInBrushLine(butterfliesState, from, pos, radius, performance.now())` or `eraseButterfliesInBrush(butterfliesState, pos.x, pos.y, radius, performance.now())` alongside the existing `eraseObjectsInBrush(Line)` calls
- [ ] T017 [US1] In `src/lib/PlayArea.svelte`, call `clearButterflies(butterfliesState)` in `clearAll()` (near line 662-673) and in `loadScene()` (near line 675-684), beside the existing `clearPets(petsState)` calls
- [ ] T018 [US1] In `src/lib/PlayArea.svelte`'s `resize()` re-derivation branch (near line 283-291), call `clearButterflies(butterfliesState)` after the existing `repositionPoodles` call, per research.md §4 (clear-and-re-establish, no repositioning helper)

**Checkpoint**: User Story 1 is fully functional and testable independently — a garden with butterflies is a complete toy moment with no bird code present.

---

## Phase 4: User Story 2 - A bird lives in her palm tree (Priority: P2)

**Goal**: One bird per placed palm (capped at 3) appears automatically, perches, hops, and takes short in-view flights between palms (or a loop back to the same one), never landing anywhere but a live palm.

**Independent Test**: In a headless grid, place palm objects, run `stepBirds`, and assert a bird appears per palm up to the cap, a perched bird sits on its palm's anchor, it periodically hops or flies, every flight ends perched on some live palm and stays entirely in-bounds, and no palm ever holds two birds or gets left stranded.

### Tests for User Story 2

- [ ] T019 [P] [US2] Write `tests/unit/sim/birds.test.ts` covering FR-012/Scenario-1-2-3: an empty `palms` array keeps `byPalmId` empty across many frames; placing one palm produces a bird keyed to its id within about a second, positioned at its top-center anchor (`obj.x + obj.size / 2`, `obj.y`); placing two and then three palms gives each exactly one bird up to `BIRD_CAP`, with no palm ever holding two
- [ ] T020 [P] [US2] Add to `tests/unit/sim/birds.test.ts` the FR-014/Scenario-4 coverage: hold a bird `perched` for many frames and assert its position changes at least once during a `hopping` interlude rather than staying bit-for-bit identical for the whole run, and that a `perched`/`hopping` bird's position always tracks the live palm's current anchor (including after the palm object's coordinates change)
- [ ] T021 [P] [US2] Add to `tests/unit/sim/birds.test.ts` the FR-015/FR-016/Scenario-5-6 flight coverage: with two-or-three palms present, run until a bird flies and assert every completed flight (`flightProgress` reaching `1`) ends `perched` with `palmId` set to a live palm id; with exactly one palm present, run until its bird flies and assert every sampled `(x, y)` across the whole loop stays within `[0, grid.width) × [0, grid.height)` and it lands back on the same `palmId`, including a palm placed at `y = 0` or against the grid's left/right edge
- [ ] T022 [P] [US2] Add to `tests/unit/sim/birds.test.ts` the FR-017/Scenario-7 non-interference coverage: assert `stepBirds` never mutates the `palms` array or any `PlacedObject` element of it, across a long run with birds actively perching/hopping/flying

### Implementation for User Story 2

- [ ] T023 [US2] Create `src/sim/birds.ts` with the `Bird`/`BirdsState` types and `BIRD_CAP` constant, and `createBirdsState()` exactly per data-model.md and contracts/ambient-life-mechanics.md's `src/sim/birds.ts` section
- [ ] T024 [US2] In `src/sim/birds.ts`, implement `stepBirds`'s population maintenance: for every live, non-held-off palm id in `palms` (up to `BIRD_CAP` total birds across `byPalmId`), ensure a bird exists via `nextId`; for every bird whose `palmId` (while perched/hopping) or `destPalmId` (while flying) is no longer present in `palms`, retarget to a different live palm if one remains or remove it, unconditionally every step regardless of `state` (data-model.md's BirdsState validation rules)
- [ ] T025 [US2] In `src/sim/birds.ts`, implement the `perched`/`hopping` states: position derived every frame from the live palm's top-center anchor, `timer`-counted dwell before either hopping a short step or beginning a flight
- [ ] T026 [US2] In `src/sim/birds.ts`, implement the `flying` state per research.md §7: `flightProgress` advances `1 / FLIGHT_DURATION_FRAMES` per frame; two-palm flights follow a quadratic Bézier between `takeoffX`/`takeoffY` and the destination perch with `arcHeight = min(ARC_HEIGHT_CELLS, min(startY, endY))`; single-palm loops use the closed sinusoidal loop formula with `loopHeight`/`loopRadiusX` each clamped to that palm's own distance to the nearest edge; on `flightProgress` reaching `1`, land `perched` on `destPalmId` if still live, otherwise retarget before completing
- [ ] T027 [US2] Implement `eraseBirdsInBrush`/`eraseBirdsInBrushLine` in `src/sim/birds.ts`, mirroring `objects.ts`'s eraser pair (Bresenham line interpolation), setting `holdoffUntilByPalmId` for the removed bird's `palmId` to `now + ERASE_HOLDOFF_MS`
- [ ] T028 [US2] Implement `clearBirds` in `src/sim/birds.ts`: empties `byPalmId` and `holdoffUntilByPalmId` without touching `palms`
- [ ] T029 [US2] In `src/lib/PlayArea.svelte`, import `createBirdsState`, `stepBirds`, `eraseBirdsInBrush`, `eraseBirdsInBrushLine`, `clearBirds` from `../sim/birds`, and create `const birdsState = createBirdsState();` beside `objectsState`/`petsState`/`butterfliesState` (near line 86)
- [ ] T030 [US2] In `src/lib/PlayArea.svelte`'s `frame(now)` (near line 484), add `stepBirds(objectsState.byKind.palm, birdsState, now);` alongside the `stepButterflies` call added in T014
- [ ] T031 [US2] In `src/lib/PlayArea.svelte`'s `render()`, add a draw loop for birds styled like the poodle/butterfly glyph loops: `ctx.font` set once to a bird-sized value, per bird `ctx.save()`/`translate`/`scale(-1, 1)` when `facing === -1`/`fillText('🐦', 0, 0)`/`ctx.restore()`
- [ ] T032 [US2] In `src/lib/PlayArea.svelte`'s `paintAt()` eraser branch, call `eraseBirdsInBrushLine(birdsState, from, pos, radius, performance.now())` or `eraseBirdsInBrush(birdsState, pos.x, pos.y, radius, performance.now())` alongside the butterfly and object eraser calls added in T016
- [ ] T033 [US2] In `src/lib/PlayArea.svelte`, call `clearBirds(birdsState)` in `clearAll()` and `loadScene()`, beside `clearButterflies(butterfliesState)` added in T017
- [ ] T034 [US2] In `src/lib/PlayArea.svelte`'s `resize()` re-derivation branch, call `clearBirds(birdsState)` alongside `clearButterflies(butterfliesState)` added in T018

**Checkpoint**: User Stories 1 AND 2 both work independently and together — a garden with butterflies and palms with birds.

---

## Phase 5: User Story 3 - They come and go without anything looking broken (Priority: P3)

**Goal**: Every lifecycle event (last flower gone, palm erased, eraser stroke, clear-all, reload, undo/redo, resize/rotation, scene switch) leaves populations correctly re-derived, with nothing stranded, out of bounds, or crashing.

**Independent Test**: In a headless grid, drive each lifecycle event and assert after each that every remaining butterfly is in-bounds with a flower still present, every remaining bird is in-bounds and perched on or flying toward a live palm, removed ones are gone, and nothing throws.

### Tests for User Story 3

- [ ] T035 [P] [US3] Add to `tests/unit/sim/butterflies.test.ts` the FR-023/Scenario-1 coverage: remove the last `FLOWER` cell from a grid with butterflies present and assert `butterflies.length === 0` within about one scan pass' worth of frames
- [ ] T036 [P] [US3] Add to `tests/unit/sim/birds.test.ts` the FR-023/Scenario-2/edge-case coverage: erase a palm with a bird on it when another palm remains (bird retargets/flies to the remaining palm rather than disappearing) and when none remains (bird removed within about a second); separately erase every palm mid-flight and assert the flying bird is removed within about a second rather than left `flying` forever
- [ ] T037 [P] [US3] Add to `tests/unit/sim/butterflies.test.ts` and `tests/unit/sim/birds.test.ts` the FR-025/Scenario-4 eraser coverage: call `eraseButterfliesInBrush(Line)`/`eraseBirdsInBrush(Line)` centered exactly on a creature, and again along a line whose endpoints straddle one without landing on it directly (mirroring `eraseObjectsInBrushLine`'s own straddle test), asserting removal either way
- [ ] T038 [P] [US3] Add to `tests/unit/sim/butterflies.test.ts` and `tests/unit/sim/birds.test.ts` the FR-026/Scenario-4 hold-off coverage: after an eraser removal, assert no replacement appears for `ERASE_HOLDOFF_MS` even though the ordinary rule would otherwise call for one, and that a replacement does appear once that window elapses
- [ ] T039 [P] [US3] Add to `tests/unit/sim/butterflies.test.ts` and `tests/unit/sim/birds.test.ts` the FR-027/Scenario-5 coverage: call `clearButterflies`/`clearBirds` with populations present, assert both are empty immediately, and — on an otherwise-unchanged grid/palms — assert stepping further frames does not repopulate them
- [ ] T040 [P] [US3] Add to `tests/unit/sim/butterflies.test.ts` and `tests/unit/sim/birds.test.ts` the FR-029/Scenario-6-7 reload coverage: build a fresh `createButterfliesState()`/`createBirdsState()` against a grid/palms already containing flowers/palms (as `tryRestore` would leave them) and assert populations establish within about a second exactly as a fresh mount does
- [ ] T041 [P] [US3] Add to `tests/unit/sim/butterflies.test.ts` and `tests/unit/sim/birds.test.ts` the FR-030/Scenario-8 undo/redo coverage: mutate `grid`/`palms` directly between a "before" and "after" flower/palm layout (standing in for `HistoryManager.undo`/`redo`) and assert `stepButterflies`/`stepBirds` re-settle to match whichever layout is live, with no special call needed
- [ ] T042 [P] [US3] Add to `tests/unit/sim/butterflies.test.ts` and `tests/unit/sim/birds.test.ts` the FR-031/Scenario-9 re-derivation coverage: call `clearButterflies`/`clearBirds`, then build a differently-shaped `Grid`/`palms` list (mirroring `resize()`'s re-derivation branch) and assert re-establishment within about a second with no out-of-bounds creature at any intermediate frame
- [ ] T043 [P] [US3] Add to `tests/unit/sim/butterflies.test.ts` and `tests/unit/sim/birds.test.ts` the FR-032/Scenario-10 scene-switch coverage: call `clearButterflies`/`clearBirds` then step against a new scene's flowers/palms, asserting the old scene's creatures are gone immediately and the new scene's appear within about a second
- [ ] T044 [P] [US3] Add to `tests/unit/sim/butterflies.test.ts` an edge-case regression test for the "single flower flickering in and out" case (Edge Cases section): a flower appearing and disappearing faster than one scan pass never produces a visible spawn/despawn flicker (FR-005)

### Verification for User Story 3

- [ ] T045 [US3] Run `npm test` and confirm every test carried over from specs 001–016 still passes completely unchanged (FR-037) — no existing assertion in `pets.test.ts`, `objects.test.ts`, `flower.test.ts`, `palm.test.ts`, `history.test.ts`, `save.test.ts`, `resize.test.ts`, `scenes.test.ts`, or any other existing `tests/unit/sim/*`/`tests/unit/lib/*` file is modified
- [ ] T046 [US3] Confirm via `git diff` that `src/sim/save.ts`, `src/sim/history.ts`, and `src/sim/resize.ts` have zero diff from their pre-feature state (the literal check for FR-028/FR-030/FR-033/FR-037 per quickstart.md)

**Checkpoint**: All three user stories are independently functional; butterflies and birds behave correctly through every lifecycle event with nothing left stranded or broken.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T047 Run `npm run build` and confirm `dist/index.html` is emitted and is the only file in `dist/` (constitution Principle I, quickstart.md)
- [ ] T048 Manual verification per spec.md's Manual Verification section and `CLAUDE.md`'s two-platform table: on the Fire 7 Kids tablet (Silk) and desktop Chrome, and separately on an iPad (Safari, home-screen app), confirm 🦋 and 🐦 render as real emoji (not empty boxes), the flutter/perch read clearly, and frame rate holds with every cap filled; rotate the device with a full garden and three palms on screen and confirm nothing is stranded, nothing flickers, and the undo history survives
- [ ] T049 Performance check per FR-034/FR-035/SC-006 (on-device, not vitest): fill a garden past the butterfly cap (≥16 flowers), place three palms, and — if spec 014's sea life has shipped — fill its caps too; confirm ≥30fps sustained (targeting 60fps) on the Fire 7, iPad, and desktop Chrome

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** and **Foundational (Phase 2)**: both empty — no blocking prerequisites exist for this feature (plan.md's zero-diff design to `grid.ts`/`history.ts`/`save.ts`/`resize.ts`)
- **User Story 1 (Phase 3)**: no dependency — can start immediately
- **User Story 2 (Phase 4)**: no dependency on User Story 1's code (separate file, separate state) — can start immediately or in parallel with Phase 3; independently testable and independently valuable per spec.md
- **User Story 3 (Phase 5)**: depends on both Phase 3 and Phase 4 being complete, since its lifecycle tests exercise both `butterflies.ts` and `birds.ts` together (spec.md: "It depends on both stories above")
- **Polish (Phase 6)**: depends on Phases 3, 4, and 5 all being complete

### Within Each User Story

- Tests (T001-T006, T019-T022, T035-T044) should be written first and FAIL before their corresponding implementation lands
- Within US1: state/types (T007) before scan (T008) before population (T009) before steering (T010) before erase/clear (T011-T012) before `PlayArea.svelte` wiring (T013-T018)
- Within US2: state/types (T023) before population maintenance (T024) before perch/hop (T025) before flight (T026) before erase/clear (T027-T028) before `PlayArea.svelte` wiring (T029-T034)
- `PlayArea.svelte` wiring tasks (T013-T018, T029-T034) touch the same file — do not parallelize these against each other even though most are marked story-scoped; run sequentially within and across the two stories

### Parallel Opportunities

- All of T001-T006 (US1 tests, same file but independent `describe` blocks) can be drafted in parallel by content, though they land in one file
- All of T019-T022 (US2 tests) likewise
- T007-T012 (`butterflies.ts`) and T023-T028 (`birds.ts`) can be implemented fully in parallel — two different files, zero shared state, per research.md §5
- T035-T044 (US3 tests) can be drafted in parallel across `butterflies.test.ts` and `birds.test.ts`
- `PlayArea.svelte` edits (T013-T018, T029-T034) are the one place this feature is not parallelizable — same file, sequential edits

---

## Parallel Example: User Stories 1 & 2 together

```bash
# Two developers, no shared file until PlayArea.svelte wiring:
Developer A: T001-T018 (src/sim/butterflies.ts + its tests)
Developer B: T019-T034 (src/sim/birds.ts + its tests)
# Then serialize the PlayArea.svelte edits (T013-T018 and T029-T034) against each other.
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 and Phase 2 are empty — skip straight to Phase 3
2. Complete Phase 3 (T001-T018): butterflies appear, wander, erase, and clear correctly
3. **STOP and VALIDATE**: `npm test` passes; manually water grass to a bloom and watch a butterfly arrive
4. This alone is a complete, shippable toy moment per spec.md's own P1 rationale

### Incremental Delivery

1. User Story 1 (butterflies) → validate independently → demo-able MVP
2. User Story 2 (birds) → validate independently → demo-able alongside or instead of butterflies
3. User Story 3 (clean lifecycle) → validate both stories survive every lifecycle event → full feature complete
4. Phase 6 polish (build check, manual device verification, performance check) → ready to ship

### Notes

- [P] tasks operate on different files or independent test sections with no dependency
- Every implementation task's exact API surface (types, function signatures, constants) is pinned by `contracts/ambient-life-mechanics.md` and `data-model.md` — no task here should need to invent a signature not already specified there
- Per FR-037/SC-010, no task in this file may modify any existing test file's existing assertions — only new files (`butterflies.test.ts`, `birds.test.ts`) and additive `PlayArea.svelte` wiring
- Commit after each task or logical group; stop at either checkpoint to validate a story independently
