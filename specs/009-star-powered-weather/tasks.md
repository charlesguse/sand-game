---

description: "Task list for Star-Powered Weather (009)"
---

# Tasks: Star-Powered Weather

**Input**: Design documents from `/specs/009-star-powered-weather/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/weather-mechanics.md, quickstart.md

**Tests**: Automated tests ARE explicitly required by this feature (FR-042, constitution Principle V — no browser harness). Test tasks below are not optional.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

Single client-only project (established by 001–008): `src/sim/*` (framework-free core), `src/lib/*` (Svelte components + layout helpers), `tests/unit/sim/*`, `tests/unit/lib/*`. Paths below match plan.md's Project Structure exactly. **This feature depends on `008-star-power-burns-grass` already being on `main`** — star power is the only thing that starts the weather.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Nothing new to scaffold — this feature extends the existing 001–008 project (`package.json`, build tooling, `vitest` config all already in place, per plan.md/quickstart.md). No new dependency is added (research.md §19).

- [X] T001 Confirm `npm install` and `npm test` succeed from a clean checkout with all pre-existing `tests/unit/**/*.test.ts` passing, establishing the pre-change baseline before any edits in this feature

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the `FOG` element, `Grid`'s new per-cell state (`cloud`/`fogRiseCooldown`/`fogStuckSteps`/`fogAge`/`cloudRainDelay`/`fogCloudCount`), the two new `shade.ts` timer helpers, and the `createFog` creation chokepoint that every user story's code and tests depend on. This is the "fog/cloud exists as a concept" layer — no rise/gather/rain/charm/render behavior yet.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete — every story's tests import `FOG`/`cloud`/`fogRiseCooldown`/`fogStuckSteps`/`fogAge`/`cloudRainDelay`/`fogCloudCount`/`createFog` from `types.ts`/`grid.ts`.

- [X] T002 In `src/sim/types.ts`: add `export const FOG = 8;`, add `typeof FOG` to the `Element` union, and add `cloud: Uint8Array`, `fogRiseCooldown: Uint8Array`, `fogStuckSteps: Uint16Array`, `fogAge: Uint16Array`, `cloudRainDelay: Uint16Array` (all `readonly`, per the array-reference convention) plus `fogCloudCount: number` (plain, mutable, like `grassCount`) to the `Grid` interface, per contracts/weather-mechanics.md — `Tool` is **unchanged** (FR-027)
- [X] T003 [P] In `src/sim/shade.ts`, add `export function randomFogRiseCooldown(): number` returning a uniformly random integer in `[3, 5]` inclusive (FR-012) and `export function randomCloudRainDelay(): number` returning a uniformly random integer in `[180, 480]` inclusive (FR-020) — `randomShade`/`randomBurnLife`/`randomHue` unchanged (research.md §4)
- [X] T004 In `src/sim/grid.ts`, extend `createGrid(width, height)` to also allocate `cloud`/`fogRiseCooldown`/`fogStuckSteps`/`fogAge`/`cloudRainDelay` as zero-filled typed arrays (`Uint8Array`/`Uint16Array` per T002's types) and initialize `fogCloudCount = 0` (depends on T002)
- [X] T005 In `src/sim/grid.ts`, extend `setCell(grid, x, y, element, shade)` per contracts/weather-mechanics.md's exact contract (depends on T004): track `wasFog = elements[i] === FOG` before the write and `becomesFog = element === FOG` after; increment `fogCloudCount` if `becomesFog && !wasFog`, decrement if `!becomesFog && wasFog` (mirroring `grassCount`'s bookkeeping); if `element !== FOG`, also set `cloud[i] = 0`, `fogRiseCooldown[i] = 0`, `fogStuckSteps[i] = 0`, `fogAge[i] = 0`, `cloudRainDelay[i] = 0`
- [X] T006 In `src/sim/grid.ts`, extend `clearGrid(grid)` to also fill `cloud`/`fogRiseCooldown`/`fogStuckSteps`/`fogAge`/`cloudRainDelay` to `0` and reset `fogCloudCount = 0`, alongside its existing fills (depends on T004)
- [X] T007 In `src/sim/grid.ts`, add `export const FOG_FIELD_SHARE_CEILING = 0.20;` (FR-011) and `export function createFog(grid: Grid, x: number, y: number): boolean` — the only way a fog cell is ever created: return `false` (no-op) if `!inBounds(grid, x, y)`; return `false` (no-op) if `grid.fogCloudCount >= Math.floor(grid.width * grid.height * FOG_FIELD_SHARE_CEILING)`; otherwise call `setCell(grid, x, y, FOG, randomShade())`, set `cloud[i] = 0`, `fogRiseCooldown[i] = randomFogRiseCooldown()`, `fogStuckSteps[i] = 0`, `fogAge[i] = 0`, call `setGlitter(grid, x, y, 1)`, and return `true` (depends on T003, T005)

**Checkpoint**: `FOG` exists as an element, `Grid` carries its new per-cell state correctly through `createFog`/`setCell`/`clearGrid`/`createGrid`, and the FR-011 sky limit is enforced at its one creation chokepoint — user story implementation and their tests can now proceed.

---

## Phase 3: User Story 1 - Making sparkle-mist off the lake (Priority: P1) 🎯 MVP

**Goal**: The child drags the ⭐ brush across water to turn it into pale, twinkling fog that rises with a gentle wobble, bubbles up through a lake, is blocked by anything solid, and condenses back into a drop if it never reaches the sky.

**Independent Test**: In a headless grid, place a body of water, apply the ⭐ brush over it and place drawn star power beside it, run the simulation, and assert that exactly one fog cell appears for each water cell charmed, that fog appears nowhere else, that fog rises at the specified pace with a wobble, that fog under the surface bubbles up through the water, and that no other cell is changed.

### Tests for User Story 1 ⚠️

- [X] T008 [P] [US1] Create `tests/unit/sim/weather.test.ts` and add its first cases: the ⭐ brush turns every water cell inside its footprint into fog, one for one, in place, changing `0` other cells in that footprint (Scenario 1, FR-008, FR-010, SC-002); fog rises between 12 and 20 cells per second through clear space (Scenario 3, FR-012, SC-005); a rising plume's sideways wander stays within 1 cell per upward move with a net horizontal drift of `0` measured over a long run (Scenario 4, FR-013, SC-005); fog created below the surface of a body of water reaches the surface in 100% of cases with `0` water cells lost or gained (Scenario 5, FR-014, SC-006); fog is blocked by grass, powders, objects, and walls without moving or damaging them, and `0` fog/cloud cells ever exist outside the play field (Scenario 7, FR-005, FR-015, SC-007); a fog cell unable to rise for 300 consecutive steps condenses into exactly 1 water cell, and no fog cell anywhere survives 1800 steps without becoming cloud (Scenario 8, FR-016, SC-008)
- [X] T009 [P] [US1] Add cases to `tests/unit/sim/brush.test.ts`: the `star` tool over a `WATER` cell calls `createFog`, turning every water cell in the brush's footprint into fog one for one across all three brush sizes, and still places no star power into a water cell (FR-008, mirroring the existing `star`-tool test shape)
- [X] T010 [P] [US1] Add cases to `tests/unit/sim/grid.test.ts`: `createFog` sets `elements[i] = FOG`, `cloud[i] = 0`, `fogRiseCooldown[i]` to a value in `[3, 5]`, `fogStuckSteps[i] = 0`, `fogAge[i] = 0`, `glitter[i] = 1`, and increments `fogCloudCount`; `setCell`'s reset rule — writing any non-`FOG` element to a previously-fog cell zeroes `cloud`/`fogRiseCooldown`/`fogStuckSteps`/`fogAge`/`cloudRainDelay` and decrements `fogCloudCount`; `clearGrid` on a grid containing fog/cloud fills all five new arrays to `0` and resets `fogCloudCount` to `0` (contracts/weather-mechanics.md)
- [X] T011 [P] [US1] In `tests/unit/sim/starPower.test.ts`, replace the prior "quenching never spends the water" assertion (spec 008's now-superseded FR-017/SC-009, unfuelled case only) with: an **unfuelled** star power cell quenched by adjacent water charms exactly one adjacent water cell into fog — never `0`, never more than `1` (Scenario 2, FR-007, SC-003); a **fuelled** star power cell (the burn front) quenched by water leaves that water byte-identical and untouched, and a one-cell water stripe still stops a burn with `0` far-side cells catching, exactly as spec 008's SC-007 requires (FR-007, SC-004) — research.md §18's explicitly-called-for narrowing

### Implementation for User Story 1

- [X] T012 [US1] In `src/sim/step.ts`, extend the private `moveCell(grid, fromIndex, toIndex)` and `swapCells(grid, aIndex, bIndex)` helpers to also move/swap `cloud`, `fogRiseCooldown`, `fogStuckSteps`, `fogAge`, `cloudRainDelay` between the two indices, using the same copy-then-zero-the-source pattern already used for `elements`/`shades`/`hues`/`glitter` (research.md §9)
- [X] T013 [US1] In `src/sim/step.ts`, extend `stepPowder`'s "directly below" swap condition with `|| elements[belowIndex] === FOG`, and add a new `else if (belowInBounds && elements[belowIndex] === FOG) swapCells(...)` branch to `stepLiquid` alongside its existing `EMPTY`-only case — diagonal-below checks in both functions are unchanged (FR-004, research.md §10; depends on T012)
- [X] T014 [US1] In `src/sim/step.ts`, add private constants `FOG_MAX_LIFE = 1800` and `FOG_STUCK_LIMIT = 300` (FR-016), and four private helpers: `becomeCloud(grid, x, y, i)` (sets `cloud[i] = 1`, `fogAge[i] = 0`, `cloudRainDelay[i] = randomCloudRainDelay()`, `fogRiseCooldown[i] = 0`, `fogStuckSteps[i] = 0` — does not call `setCell`, so `fogCloudCount` is unaffected); `stepCloud(grid, x, y, i)` (increments `fogAge[i]`, calling `rain(...)` once it reaches `cloudRainDelay[i]`; never calls `moveCell`/`swapCells`, FR-018); `condenseFog(grid, x, y, i)` (`setCell(grid, x, y, WATER, randomShade())`, FR-016); `rain(grid, x, y, i)` (`setCell(grid, x, y, WATER, randomShade())`, FR-020/FR-021) — per contracts/weather-mechanics.md and research.md §6
- [X] T015 [US1] In `src/sim/step.ts`, add private `stepFog(grid, x, y, i)`: (1) total-lifetime check — if `fogAge[i] + 1 >= FOG_MAX_LIFE`, call `condenseFog` and return, else store the incremented age; (2) cooldown — if `fogRiseCooldown[i] > 0`, decrement it, increment `fogStuckSteps[i]`, condense-and-return if that reaches `FOG_STUCK_LIMIT`, otherwise return; (3) sky-ceiling/cloud-above precedence (checked **before** any wander logic, FR-017) — if the direct-above cell is out of bounds or holds `FOG` with `cloud = 1`, call `becomeCloud` and return; (4) wander-rise — draw a preferred horizontal offset uniformly from `{-1, 0, +1}`, try it then straight-up then the remaining diagonal (randomizing the straight/diagonal fallback order when the preferred offset was `0`), where a `dx = 0` candidate is legal if `EMPTY` or `WATER` (swap) and a `dx = ±1` candidate is legal only if `EMPTY` (move); on success call `moveCell`/`swapCells` and redraw `fogRiseCooldown`/reset `fogStuckSteps` at the new index; on failure increment `fogStuckSteps[i]` and condense if it reaches `FOG_STUCK_LIMIT`. Wire `stepFog` into `step()`'s dispatcher: `else if (element === FOG) stepFog(grid, x, y, i);` dispatching internally to `stepCloud` when `cloud[i] === 1` (research.md §5; depends on T012, T013, T014) — **note**: the cooldown check falls through to attempt the rise on the same step the decrement reaches `0` (rather than waiting one further step), since only that ordering makes a freshly-drawn `[3, 5]` cooldown produce a rise exactly that many steps later, matching FR-012/SC-005's literal 12–20 cells/sec bound
- [X] T016 [US1] In `src/sim/step.ts`'s `stepStarPower`, change the existing four-neighbor quench scan from a boolean `quenched` flag to remembering *which* orthogonal neighbor index first matched `WATER` (`quenchWaterIndex`, mirroring `stepGrass`'s `waterIndex` pattern); when a match is found, read `fuelled = starPowerFuelled[i] === 1` **before** calling the existing (unchanged) `extinguishStarPower(grid, x, y, i)`, then — only if `!fuelled` — call `createFog(grid, quenchWaterIndex % grid.width, Math.floor(quenchWaterIndex / grid.width))` and, if it returned `true`, set `grid.moved[quenchWaterIndex] = 1` (FR-007, research.md §7; depends on T007)
- [X] T017 [P] [US1] In `src/sim/brush.ts`'s `paintCell`, add one new branch: `tool === 'star' && current === WATER` → `createFog(grid, x, y)` (ignoring its boolean result) — the existing `star` + `GRASS` branch is unchanged, and no branch places star power into water (FR-008, research.md §7; depends on T007)
- [X] T018 [P] [US1] In `src/lib/PlayArea.svelte`: import `FOG` from `../sim/types`; add `FOG_RAMP` and `CLOUD_RAMP` (8-entry `[number, number, number][]` constants each, pale pearly/lavender for fog and brighter off-white for cloud, mirroring `PINK_RAMP`/`GOLD_RAMP`'s shape); extend `colorFor(element, shade, hue)` with a fourth parameter `isCloud: boolean` and one new branch: `if (element === FOG) return isCloud ? CLOUD_RAMP[shade % CLOUD_RAMP.length] : FOG_RAMP[shade % FOG_RAMP.length];`; in `render()`'s per-cell loop, destructure `cloud` from `grid` and pass `cloud[i] === 1` as `colorFor`'s new argument — no other change; twinkle comes free from the existing glitter-shimmer path (FR-002, FR-003, research.md §8, §17; depends on T002)

**Checkpoint**: At this point, User Story 1 is fully functional and testable independently — the ⭐ brush and an unfuelled quench both charm water into fog, fog rises with a bounded wobble, bubbles through water, is blocked by solid matter, condenses if stuck or over-age, and reads as pearly twinkling mist.

---

## Phase 4: User Story 2 - Clouds gathering at the top (Priority: P2)

**Goal**: Fog that cannot rise any further because it has reached the sky ceiling or the underside of an existing cloud gathers into a soft, fluffy, immobile cloud that grows downward as more fog arrives.

**Independent Test**: In a headless grid, release fog with a clear path to the top, run the simulation, and assert that fog which cannot rise any further because of the play field's ceiling or an existing cloud becomes cloud, that cloud cells never move, that clouds grow downward as more fog arrives, and that nothing else changes.

**Note**: This story adds no new production code — `stepFog`'s sky-ceiling/cloud-above precedence check and `becomeCloud`/`stepCloud` (T014, T015) already implement FR-017/FR-018 as part of User Story 1's single cohesive `step.ts` change (research.md §5, §6), and `colorFor`'s `CLOUD_RAMP` branch (T018) already renders it distinctly. This phase verifies that existing behavior under the cloud-specific scenarios the spec calls out.

### Tests for User Story 2

- [X] T019 [P] [US2] Add cases to `tests/unit/sim/weather.test.ts`: fog rising with nothing above it becomes cloud on reaching the sky ceiling and stops rising there (Scenario 1, FR-017, SC-009); fog arriving underneath an existing cloud also becomes cloud, thickening the cloud downward (Scenario 2, FR-018, SC-009); cloud cells never move — across any run, `0` cloud cells are ever found at a different index than where they formed (Scenario 3, FR-018, SC-010); fog blocked only by ordinary matter (powder/grass/objects), never the sky or a cloud, never becomes cloud — it only ever condenses (FR-017, SC-009); pouring sand or water through a cloud cell exchanges places with it within exactly 1 simulation step (Scenario 5, FR-004, SC-016)

**Checkpoint**: At this point, User Stories 1 AND 2 both work independently — mist gathers into a cloud exactly at the sky or an existing cloud's underside, never anywhere else, and a formed cloud never moves.

---

## Phase 5: User Story 3 - Rain falling back down (Priority: P3)

**Goal**: Every cloud cell rains within a bounded, staggered time into exactly one ordinary water cell that falls, pools, and behaves identically to water poured by the child, closing the loop.

**Independent Test**: In a headless grid, form cloud cells, run the simulation, and assert that every cloud cell becomes exactly one water cell within the specified time, that the drops fall under the existing water rules, that the totals conserve, and that the field ends with zero fog and zero cloud.

**Note**: This story adds no new production code — `stepCloud`/`rain` (T014) already implement FR-020/FR-021/FR-022 as part of User Story 1's single cohesive `step.ts` change (research.md §6). This phase verifies that existing behavior under the rain-specific scenarios the spec calls out.

### Tests for User Story 3

- [X] T020 [P] [US3] Add cases to `tests/unit/sim/weather.test.ts`: every cloud cell rains within 180–480 simulation steps of forming, no cloud cell survives past 600 steps, and the moments at which one cloud's cells rain are staggered rather than identical (Scenario 1, FR-020, SC-011); across a full cycle with no drawing, the total of water plus fog plus cloud cells never increases at any step and returns to its starting value apart from cells drunk by grass or converted by a rainbow (Scenario 3 and 7, FR-023, SC-013)
- [X] T021 [P] [US3] Add cases to `tests/unit/sim/weather.test.ts`: advancing an identical field seeded one way by rain and the other by the 💧 tool produces `0` differing cells after any number of `step()` calls (Scenario 2, FR-021, FR-022, SC-012); rain landing on grass that can still grow is drunk exactly under spec 007's unchanged pacing and ceilings (Scenario 4, FR-022); rain reaching burning (fuelled) star power quenches it exactly as ordinary water does (Scenario 5, FR-022, spec 008 unchanged)

**Checkpoint**: All three of User Stories 1–3 work independently — the full lake-to-mist-to-cloud-to-rain-to-lake loop runs to completion with no cloud lingering forever.

---

## Phase 6: User Story 4 - It always settles, and it belongs with everything else (Priority: P4)

**Goal**: Fog and cloud are bounded in space (the FR-011 sky limit) and in time (FR-024's 45-second settling guarantee), and integrate with every existing brush, the eraser, the wand, rainbow conversion, unicorn touch, play-field re-derivation, and scene loading exactly as every other element does.

**Independent Test**: In headless tests, drive the cycle to its ceiling from extreme starting states, run to a standstill, and assert fog and cloud return to zero within the settling bound and never exceed the ceiling; then exercise the eraser, clear-all, wand, object rules, scene generators, and play-field re-derivation against a field containing fog and cloud.

### Tests for User Story 4

- [ ] T022 [P] [US4] Add cases to `tests/unit/sim/weather.test.ts`: charming as hard as possible across a field mostly full of water fills the sky only up to the FR-011 ceiling and no further, with no message/refusal/failure state to detect (Scenario 1, FR-011, SC-014); from several adversarial starting states (a field entirely full of freshly-charmed fog; a sky entirely full of cloud at varying ages; a mix of both) running with no further drawing and no star power left brings the field to `0` fog and `0` cloud within 45 seconds and then at rest (Scenario 2, FR-024, SC-015); a field with `0` fog and `0` cloud produces byte-identical `step()` behavior to spec 008's own toy across scenarios this feature does not touch (FR-040, SC-023)
- [ ] T023 [P] [US4] Add cases to `tests/unit/sim/grid.test.ts`: `createFog` returns `false` and touches nothing when `fogCloudCount` is already at or above `FOG_FIELD_SHARE_CEILING`'s threshold (FR-011 ceiling-refusal); `clearGrid` (backing clear-all) removes all fog and cloud immediately, leaving `0` occupied cells and resetting `fogCloudCount` to `0` (Scenario 4, FR-028)
- [ ] T024 [P] [US4] Add cases to `tests/unit/sim/brush.test.ts`: dragging the eraser through fog and cloud removes them on the spot across all three brush sizes, leaving the cells empty with `0` water cells left behind (Scenario 3, FR-026); a single drag of any element brush through a region of fog and cloud places that element in 100% of the covered cells — a wisp of mist never blocks drawing (Scenario 6, FR-026, SC-017)
- [ ] T025 [P] [US4] Add a case to `tests/unit/sim/wand.test.ts` confirming `applyWand`/`applyWandCell` leaves a `FOG` cell's element, `cloud`, `fogRiseCooldown`, `fogStuckSteps`, `fogAge`, `cloudRainDelay`, and `glitter` completely unchanged for both fog and cloud sub-states, and does not sprinkle into either (FR-030, SC-018, Scenario 6 overlap)
- [ ] T026 [P] [US4] Add cases to `tests/unit/sim/objects.test.ts`: `applyRainbowConversions` converts fog and cloud cells into rainbow sand exactly as it already converts water, decrementing `fogCloudCount` for each converted `FOG` cell; `isUnicornTouched` returns `true` when fog or cloud occupies a unicorn's touch zone, firing the existing celebration with no new burst type (FR-031)
- [ ] T027 [P] [US4] Add a case to `tests/unit/sim/resize.test.ts`: a grid containing fog and cloud cells at various ages/cooldowns, re-derived via `resizeGrid`, carries every surviving cell at the same bottom-centre offset every other element uses, each carried cell remaining `FOG` (fog or cloud) and continuing to rise/gather/rain normally afterward, with `fogCloudCount` recomputed correctly on the new grid (Scenario 7, FR-034)
- [ ] T028 [P] [US4] Add a case to `tests/unit/sim/scenes.test.ts`: `loadScene` clears every existing fog/cloud cell (along with everything else) before generating the chosen scene's contents, with no error; none of the three scenes (`empty`, `landscape1`, `landscape2`) ever contains a `FOG` cell immediately after loading, at every supported grid size (Scenario 5, FR-035)

### Implementation for User Story 4

- [ ] T029 [US4] In `src/sim/brush.ts`'s `paintCell`, compute `paintable = current === EMPTY || current === FOG` once per call and substitute it for every existing branch's `current === EMPTY` check (sand/dirt/grass keep their additional `|| current === WATER` allowance unchanged; water/star's checks become `paintable`) — the eraser branch and the `star`-on-`WATER` branch (T017) are unchanged (FR-026, research.md §11; depends on T017)
- [ ] T030 [P] [US4] In `src/sim/wand.ts`'s `applyWandCell`, extend the early-return condition to `if (element === OBJECT || element === STAR_POWER || element === FOG) return;` (FR-030, research.md §12)
- [ ] T031 [P] [US4] In `src/sim/objects.ts`'s `applyRainbowConversions`, extend the per-cell condition with `|| element === FOG`, and immediately before the direct `grid.elements[i] = RAINBOW_SAND` write add `if (element === FOG) grid.fogCloudCount--;` (FR-031, research.md §13)
- [ ] T032 [P] [US4] In `src/sim/resize.ts`, extend `resizeGrid`'s existing copy loop: for every source index already carried per the offset/in-bounds/`OBJECT`-skip rule, also copy `cloud`, `fogRiseCooldown`, `fogStuckSteps`, `fogAge`, `cloudRainDelay` unchanged, and add `if (oldGrid.elements[srcIndex] === FOG) grid.fogCloudCount++;` alongside the existing `grassCount` accumulation line (FR-034, research.md §14)

**Checkpoint**: All four user stories are independently functional — fog and cloud are bounded, always settle, and behave like every other element across every tool, scene, and system in the toy.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation that the whole feature holds together — non-regression, build, and the manual/on-device checks quickstart.md calls out as the maintainer's job.

- [ ] T033 Run `npm test` and confirm every pre-existing test in `tests/unit/**/*.test.ts` still passes, changed only where this feature's own change makes an assertion obsolete (`starPower.test.ts`'s narrowed quench assertion, T011) — every other file's assertions unchanged (FR-040, SC-023)
- [ ] T034 Run `npm run build` and confirm `dist/index.html` is the only emitted file and is fully playable when opened directly from disk with no network requests (FR-041, SC-025)
- [ ] T035 Perform the on-device checks from quickstart.md's "Manual-only checks" and "Performance check" sections on a mid-range laptop, a tablet, and a low-end tablet of the Amazon Fire 7 Kids class: waving the star over the lake and watching it steam is satisfying with no explanation; the mist reads as pretty sparkle-mist, never smoke; a rising plume looks alive (wobbles, spreads, thins); fog bubbling up through the lake looks like bubbles, not a glitch; the cloud building itself over several seconds is worth watching; rain patters raggedly rather than dumping as a block; the full lake-to-mist-to-cloud-to-rain-to-lake loop stays watchable end to end; rain landing on the garden reads as a reward; nothing in the cycle is scary or looks like something breaking; and, with fog/cloud at the FR-011 ceiling, rain falling, a full lake below, grass drinking, and a lawn burning all at once, the toy sustains ≥30fps (targeting 60fps) and stays within 20% of an equally-full field of falling sand's per-step cost (FR-037, SC-020, SC-021) — **requires real devices including a Fire-7-class tablet; cannot be performed in this headless environment, left for the maintainer**

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories (every story's code and tests import `FOG`/`Grid`'s new fields/`createFog` from `types.ts`/`grid.ts`).
- **User Stories (Phase 3–6)**: All depend on Foundational phase completion.
  - US1 (Phase 3) has no dependency on US2–US4, and delivers the full `stepFog`/`stepCloud`/`becomeCloud`/`condenseFog`/`rain` implementation in one cohesive `step.ts` change (research.md §5, §6), since fog's rise logic cannot be separated from its sky-ceiling/cloud-above precedence check without splitting one function.
  - US2 (Phase 4) depends on US1's `step.ts`/`PlayArea.svelte` implementation (T014, T015, T018) already existing — it adds tests only, no new production code.
  - US3 (Phase 5) depends on US1's `stepCloud`/`rain` (T014) already existing — it adds tests only, no new production code.
  - US4 (Phase 6) depends on Foundational's `createFog`/`FOG_FIELD_SHARE_CEILING` (T007) for its `wand.ts`/`objects.ts`/`resize.ts` work, and on US1's `paintCell` `star`-on-`WATER` branch (T017) for its `paintable` substitution (T029).
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — no dependency on other stories.
- **User Story 2 (P2)**: Can start only after US1's `step.ts`/`PlayArea.svelte` changes land, since it verifies behavior already built there — no new implementation of its own.
- **User Story 3 (P3)**: Can start only after US1's `step.ts` changes land, for the same reason — no new implementation of its own.
- **User Story 4 (P4)**: Can start after Foundational; its `wand.ts`/`objects.ts`/`resize.ts` implementation tasks (T030–T032) are independent of US1–US3, but `paintCell`'s `paintable` substitution (T029) depends on US1's `star`-on-`WATER` branch (T017) existing in the same function first.

### Within Each User Story

- Tests are written before implementation and should fail first (constitution Principle V / FR-042 require the coverage; standard TDD discipline applies since tests are explicitly requested by this feature).
- `types.ts`/`grid.ts` (Foundational) before any test or implementation task that reads `FOG`/`cloud`/`fogRiseCooldown`/`fogStuckSteps`/`fogAge`/`cloudRainDelay`/`fogCloudCount`/`createFog`.
- Within US1: T012 → T013 → T014 → T015 (each step.ts helper builds on the previous one in the same file); T016 depends only on T007; T017/T018 are independent of the step.ts sequence and each other.
- Within US4: T029 depends on T017 (same `paintCell` function); T030/T031/T032 are independent of each other and of T029.
- Story complete and checkpoint validated before moving to the next priority.

### Parallel Opportunities

- T003 (shade.ts) can proceed independently once T002 lands; T004/T005/T006/T007 (all in `grid.ts`) are sequential within that file.
- T008–T011 (four different test files) can all be written in parallel once Foundational completes.
- T017 (`brush.ts`) and T018 (`PlayArea.svelte`) can run in parallel with each other and with the T012–T016 `step.ts` sequence.
- T019 (US2) and T020–T021 (US3) are all additions to the same `weather.test.ts` file as T008 — logically independent cases, coordinate merges.
- T030, T031, T032 (three different files: `wand.ts`, `objects.ts`, `resize.ts`) can run in parallel once Foundational completes.
- T022–T028 (seven different test files) can all be written in parallel once their respective implementation tasks land.

---

## Parallel Example: Foundational Phase

```bash
# T003 (shade.ts) can proceed alongside T004 starting once T002 lands:
Task: "Add randomFogRiseCooldown/randomCloudRainDelay in src/sim/shade.ts"
Task: "Extend createGrid in src/sim/grid.ts"
```

## Parallel Example: User Story 1 tests

```bash
# Four different test files, all depend only on Foundational:
Task: "Charming/rise/wander/bubble/block/condense cases in tests/unit/sim/weather.test.ts"
Task: "Star brush charms water into fog in tests/unit/sim/brush.test.ts"
Task: "createFog/setCell/clearGrid bookkeeping cases in tests/unit/sim/grid.test.ts"
Task: "Narrowed unfuelled/fuelled quench cases in tests/unit/sim/starPower.test.ts"
```

## Parallel Example: User Story 4 implementation

```bash
# Three different files, all depend only on Foundational:
Task: "Wand skip for FOG in src/sim/wand.ts"
Task: "Rainbow conversion of FOG in src/sim/objects.ts"
Task: "Resize carries fog/cloud fields in src/sim/resize.ts"
```

## Parallel Example: User Story 4 tests

```bash
# Seven different test files, each depending on its own implementation task:
Task: "Sky-limit/settling/regression cases in tests/unit/sim/weather.test.ts"
Task: "Ceiling-refusal/clear-all cases in tests/unit/sim/grid.test.ts"
Task: "Eraser/paint-through cases in tests/unit/sim/brush.test.ts"
Task: "Wand leaves fog/cloud untouched in tests/unit/sim/wand.test.ts"
Task: "Rainbow/unicorn cases in tests/unit/sim/objects.test.ts"
Task: "Fog/cloud survive resizeGrid in tests/unit/sim/resize.test.ts"
Task: "Scenes arrive with clear skies in tests/unit/sim/scenes.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (baseline confirmation).
2. Complete Phase 2: Foundational — `FOG` element, `Grid`'s new fields, `createFog` (CRITICAL, blocks all stories).
3. Complete Phase 3: User Story 1 — charming, rising, wandering, bubbling, blocking, condensing, and rendering, all in one pass since `stepFog` is one cohesive function.
4. **STOP and VALIDATE**: Run `tests/unit/sim/weather.test.ts`/`brush.test.ts`/`grid.test.ts`/`starPower.test.ts`; confirm the ⭐ brush and an unfuelled quench both make mist, and it rises, bubbles, and settles on its own.
5. This alone gives the child a lake that steams magically when she waves the star, even before a single cloud has formed.

### Incremental Delivery

1. Setup + Foundational → foundation ready (`FOG` exists, `Grid` carries its state correctly, the sky limit is enforced at its one chokepoint).
2. Add User Story 1 → validate independently → water turns to rising, wobbling, bubbling, self-condensing mist (MVP!).
3. Add User Story 2 → validate independently → mist gathers into an immobile, downward-growing cloud at the sky.
4. Add User Story 3 → validate independently → every cloud cell rains raggedly into ordinary water, conserving the total.
5. Add User Story 4 → validate independently → the sky limit holds, the cycle always settles, and fog/cloud behave like every other element everywhere else in the toy.
6. Polish (Phase 7) → full non-regression, build, and on-device sign-off.

### Solo/Sequential Strategy

Given `stepFog`'s single-function design bundling rise, wander, bubble, block, gather, and condense (research.md §5), US2's and US3's verification is only meaningful once US1's implementation lands, so a single implementer should work phases in order (1 → 2 → 3 → 4 → 5 → 6 → 7) even though US1 and US4's implementation tasks remain independently testable at their own checkpoints.
