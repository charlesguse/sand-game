---

description: "Task list for Shining Star Power (008)"
---

# Tasks: Shining Star Power

**Input**: Design documents from `/specs/008-star-power-burns-grass/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/star-power-mechanics.md, quickstart.md

**Tests**: Automated tests ARE explicitly required by this feature (FR-038, constitution Principle V — no browser harness). Test tasks below are not optional.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

Single client-only project (established by 001–007): `src/sim/*` (framework-free core), `src/lib/*` (Svelte components + layout helpers), `tests/unit/sim/*`, `tests/unit/lib/*`. Paths below match plan.md's Project Structure exactly. **This feature depends on `007-water-drinking-grass` already being on `main`** — grass is star power's only fuel.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Nothing new to scaffold — this feature extends the existing 001–007 project (`package.json`, build tooling, `vitest` config all already in place, per plan.md/quickstart.md). No new dependency is added (research.md §15).

- [X] T001 Confirm `npm install` and `npm test` succeed from a clean checkout with all pre-existing `tests/unit/**/*.test.ts` passing, establishing the pre-change baseline before any edits in this feature

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the `STAR_POWER` element, `Grid`'s new per-cell state, the `Tool` union's `'star'` value, `isSolid`'s extension, and the `igniteStarPower` creation chokepoint that every user story's code and tests depend on. This is the "star power exists as a concept" layer — no burn/ignite/quench/brush/rendering behavior yet.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete — every story's tests import `STAR_POWER`/`starPowerAge`/`starPowerLife`/`starPowerFuelled`/`igniteStarPower` from `types.ts`/`grid.ts`.

- [X] T002 In `src/sim/types.ts`: add `export const STAR_POWER = 7;`, add `typeof STAR_POWER` to the `Element` union, add `starPowerAge: Uint8Array`, `starPowerLife: Uint8Array`, `starPowerFuelled: Uint8Array` (all `readonly`, per the array-reference convention — no `starPowerCount`, research.md §2) to the `Grid` interface, and add `'star'` to the `Tool` union, per contracts/star-power-mechanics.md
- [X] T003 [P] In `src/sim/element.ts`, extend `isSolid(e: number): boolean` to `isPowder(e) || e === GRASS || e === STAR_POWER` — `isPowder`/`isLiquid` themselves unchanged (research.md §12)
- [X] T004 [P] In `src/sim/shade.ts`, add `export function randomBurnLife(): number` returning a uniformly random integer in `[30, 60]` inclusive (`30 + Math.floor(Math.random() * 31)`, FR-007) and `export function randomHue(): number` returning `Math.floor(Math.random() * 256)` (moved here from `objects.ts`'s private helper of the same name, research.md §4, §6) — `randomShade` unchanged
- [X] T005 In `src/sim/objects.ts`, remove the private `randomHue` function and import `randomHue` from `./shade` instead; `applyRainbowConversions`'s own logic and every other export is unchanged (depends on T004, research.md §6)
- [X] T006 In `src/sim/grid.ts`: extend `createGrid(width, height)` to also allocate `starPowerAge`/`starPowerLife`/`starPowerFuelled` as zero-filled `Uint8Array(width * height)`; extend `clearGrid(grid)` to also fill `starPowerAge`/`starPowerLife`/`starPowerFuelled` to `0`, alongside its existing fills (depends on T002)
- [X] T007 In `src/sim/grid.ts`, extend `setCell(grid, x, y, element, shade)` per contracts/star-power-mechanics.md's exact contract (depends on T006): after the existing writes, always set `starPowerAge[i] = 0`; if `element !== STAR_POWER`, also set `starPowerLife[i] = 0` and `starPowerFuelled[i] = 0` (leave them untouched when `element === STAR_POWER`, since the caller sets both immediately afterward)
- [X] T008 In `src/sim/grid.ts`, add `export function igniteStarPower(grid: Grid, x: number, y: number, fuelled: boolean): void` — the only way a star power cell is ever created: no-op if out of bounds; otherwise `setCell(grid, x, y, STAR_POWER, randomShade())`, then set `starPowerFuelled[i] = fuelled ? 1 : 0` and `starPowerLife[i] = randomBurnLife()`, then `setGlitter(grid, x, y, 1)` (depends on T004, T007)

**Checkpoint**: `STAR_POWER` exists as an element, `Grid` carries its new per-cell state correctly through `igniteStarPower`/`setCell`/`clearGrid`/`createGrid` — user story implementation and their tests can now proceed.

---

## Phase 3: User Story 1 - Drawing shining star power (Priority: P1) 🎯 MVP

**Goal**: The child can select a ⭐ star tool and paint star power onto the play area with any brush size, into empty space or onto grass (converting it), without disturbing sand/dirt/rainbow sand/glitter/water/objects; star power never moves once placed and fades on its own within its burn life.

**Independent Test**: Draw star power with each brush size on an empty play field, over a powder pile, into water, and over placed objects in a headless grid; run the simulation and assert that star power appears only in the cells it is allowed to occupy, never moves, disappears within its burn life, leaves those cells empty, damages nothing else, and that the toolbar exposes exactly one new control.

### Tests for User Story 1 ⚠️

- [X] T009 [P] [US1] Create `tests/unit/sim/starPower.test.ts` and add its first cases: a star power cell's position is unchanged across any number of `step()` calls with nothing else on the field (Scenario 3, FR-004, SC-002); on an empty field it burns out within `starPowerLife` steps (≤60) and leaves the cell `EMPTY` with `0` glitter and no other changed cells (Scenario 4, FR-002, FR-008, SC-003); `randomBurnLife()` always returns an integer in `[30, 60]` inclusive across many calls, with observed variation (not a constant) (FR-007)
- [X] T010 [P] [US1] Add cases to `tests/unit/sim/brush.test.ts`: the `star` tool deposits an unfuelled star power cell (`starPowerFuelled === 0`) into a footprint cell holding `EMPTY`, and never overwrites `WATER` (FR-018), `SAND`/`DIRT`/`RAINBOW_SAND`/`OBJECT`, or an already-`STAR_POWER` cell in its footprint, across all three brush sizes — mirroring the existing `sand`/`dirt`/`grass` brush test shape (Scenarios 5, 6, Edge Cases)
- [X] T011 [P] [US1] Add cases to `tests/unit/sim/grid.test.ts`: `igniteStarPower` sets `elements[i] = STAR_POWER`, `starPowerFuelled[i]` to the passed flag, `starPowerLife[i]` to a value in `[30, 60]`, `starPowerAge[i] = 0`, and `glitter[i] = 1`; is a no-op when `(x, y)` is out of bounds; `setCell`'s star-power reset rule — writing any non-`STAR_POWER` element to a previously-star-power cell zeroes `starPowerAge`/`starPowerLife`/`starPowerFuelled`, and `starPowerAge` is reset to `0` on every `setCell` call regardless of element; `clearGrid` on a grid containing star power fills `starPowerAge`/`starPowerLife`/`starPowerFuelled` to `0` for every cell (contracts/star-power-mechanics.md)
- [X] T012 [P] [US1] In `tests/unit/lib/layout.test.ts`, move `TOOLBAR_CONTROL_COUNT` from `15` to `16` (research.md §13) and confirm the existing toolbar-fit assertions (from spec 006) still pass at every phone-sized table entry with the new count — required shrinking `layout.ts`'s internal `TOOLBAR_GAP` model constant from `8` to `6` (closer to `Toolbar.svelte`'s real `0.4rem` inter-control gap) so the small-phone (320×568) case still clears its fill floor with 16 controls; every other phone-sized case only gained margin

### Implementation for User Story 1

- [X] T013 [US1] In `src/sim/brush.ts`'s `paintCell`, add two branches: `tool === 'star' && current === EMPTY` → `igniteStarPower(grid, x, y, false)`; `tool === 'star' && current === GRASS` → `igniteStarPower(grid, x, y, true)` — no branch for `WATER`/`SAND`/`DIRT`/`RAINBOW_SAND`/`OBJECT`/already-`STAR_POWER`, matching the existing `if`/`else if` chain's "no match, no effect" pattern (FR-018, FR-022); the `eraser` branch is unchanged (depends on T008)
- [X] T014 [US1] In `src/lib/Toolbar.svelte`, add a fifth button to `.group.elements` after the existing grass button: `class:selected={tool === 'star'}`, `aria-label="Star power"`, `onclick={() => onSelectTool('star')}`, glyph `⭐` — same markup pattern as the four existing element buttons (FR-020, FR-021); pink sand (`'sand'`) remains the tool selected on page load (FR-025, unchanged)
- [X] T015 [US1] In `src/lib/PlayArea.svelte`: import `STAR_POWER` from `../sim/types`; add a `GOLD_RAMP: [number, number, number][]` constant (8 entries, pale-yellow to warm gold, mirroring `PINK_RAMP`/`GREEN_RAMP`'s shape); add one branch to `colorFor(element, shade, hue)`: `if (element === STAR_POWER) return GOLD_RAMP[shade % GOLD_RAMP.length];` — `render()`'s per-cell loop itself is unchanged since the twinkle comes free from the existing glitter-shimmer path (FR-003, research.md §7)

**Checkpoint**: At this point, User Story 1 is fully functional and testable independently — star power can be drawn with any brush size, stays put, fades on its own, and reads as gold.

---

## Phase 4: User Story 2 - Burning grass into multicoloured glitter (Priority: P2)

**Goal**: A star power cell that has been shining for at least 10 steps ignites every grass cell among its eight neighbours into a fresh, fuelled star power cell; a fuelled cell that burns out becomes exactly one glitter grain in its own cell; a burn can only travel along connected grass and always terminates on its own.

**Independent Test**: Place a grass patch in a headless grid, ignite one edge, run the simulation, and assert that the burn front advances only through grass, that every consumed grass cell yields exactly one glitter grain in the cell it occupied, that the burn halts by itself once the connected grass is gone, and that no other element is consumed or moved.

### Tests for User Story 2 ⚠️

- [X] T016 [P] [US2] Add cases to `tests/unit/sim/starPower.test.ts`: a grass cell painted directly with `igniteStarPower(grid, x, y, true)` becomes fuelled star power immediately (Scenario 1, FR-022); a star power cell beside (not on) a `GRASS` neighbour ignites that neighbour into a fresh, fuelled star power cell (`starPowerFuelled === 1`, fresh `starPowerLife` in `[30, 60]`, `starPowerAge === 0`, `glitter === 1`) once its own age reaches `STAR_POWER_IGNITE_DELAY` (10) steps, and does so on every qualifying step (not just the exact step age first reaches 10), so grass that becomes adjacent later still catches (Scenario 2, FR-011, FR-012, FR-013, FR-036, SC-004)
- [X] T017 [P] [US2] Add a case to `tests/unit/sim/starPower.test.ts`: a solid 60-cell run of grass, lit at one end, is fully converted (ignited-then-glittered) in between 6 and 20 seconds of simulated steps (360–1200 steps at 60 steps/second) — the burn-front pace bound (Scenario 3, FR-012, SC-004)
- [X] T018 [P] [US2] Add cases to `tests/unit/sim/starPower.test.ts`: every consumed grass cell yields exactly one `RAINBOW_SAND` cell with `glitter === 1` in the same cell once its own burn life elapses, with no other cell changed by that transition (Scenario 4, FR-008, FR-010); for a patch of `N` grass cells, running the simulation to a standstill after ignition produces exactly `N` new glitter grains — 0 blades lost without a trace and 0 glitter created for free (Scenario 4, SC-005)
- [X] T019 [P] [US2] Add a case to `tests/unit/sim/starPower.test.ts`: advancing an identical field seeded one way by burning grass into glitter and the other way by the sparkle wand's sprinkle produces 0 differing cells after any number of further `step()` calls (Scenario 5, SC-011) — verified as each origin's own state staying byte-identical across further steps once at rest, since the two origins' shade/hue values are randomly drawn and not expected to match each other
- [X] T020 [P] [US2] Add cases to `tests/unit/sim/starPower.test.ts`: a one-cell gap of `EMPTY` across a lawn stops the burn at the gap, and the same holds for a one-cell `SAND` stripe, a one-cell `WATER` stripe, a one-cell `RAINBOW_SAND`/glitter stripe, and an `OBJECT` in the path — in every case, 0 cells of the far lawn ever catch after running to a standstill (Scenario 6, FR-014, SC-007)
- [X] T021 [P] [US2] Add a case to `tests/unit/sim/starPower.test.ts`: running `step()` well past every star power cell's maximum possible life after a full burn leaves `0` star power cells anywhere on the field — every burn terminates (Scenario 7, FR-015, SC-006)
- [X] T022 [P] [US2] Add a case to `tests/unit/sim/starPower.test.ts`: a glitter grain produced by burning (not `GRASS`) is never re-ignited or converted by further contact with star power, across many further steps (Scenario 8, FR-013)
- [X] T023 [P] [US2] Add a case to `tests/unit/sim/starPower.test.ts`: with grass on the field and `0` star power anywhere, running `step()` for 10,000 steps changes `0` grass cells beyond spec 007's own watering-and-growth rule (Scenario 9, FR-013, SC-010)
- [X] T024 [P] [US2] Add a case to `tests/unit/sim/starPower.test.ts`: a grass cell far from any burn, adjacent to its own water, keeps drinking and growing exactly as spec 007 specifies while a burn proceeds elsewhere on the same field (Scenario 10, FR-019, FR-036)

### Implementation for User Story 2

- [X] T025 [US2] In `src/sim/step.ts`, add private constant `STAR_POWER_IGNITE_DELAY = 10` (FR-011) and import `STAR_POWER`, `igniteStarPower`, `randomHue` alongside the existing imports
- [X] T026 [US2] In `src/sim/step.ts`, add private `extinguishStarPower(grid, x, y, i): void`: if `starPowerFuelled[i]` is truthy, call `setCell(grid, x, y, RAINBOW_SAND, randomShade())`, then `grid.hues[i] = randomHue()`, then `setGlitter(grid, x, y, 1)`; otherwise call `setCell(grid, x, y, EMPTY, 0)` (FR-008, FR-009, FR-010, research.md §6; depends on T025)
- [X] T027 [US2] In `src/sim/step.ts`, add private `stepStarPower(grid, x, y, i): void`: (1) quench check — scan the four orthogonal neighbors via a plain `if`/`else if` chain for `WATER`; if found, call `extinguishStarPower(grid, x, y, i)` and return; (2) age/burnout — otherwise let `age = starPowerAge[i] + 1`; if `age >= starPowerLife[i]`, call `extinguishStarPower(grid, x, y, i)` and return; otherwise store `starPowerAge[i] = age`; (3) ignite — if `age < STAR_POWER_IGNITE_DELAY`, return; otherwise scan all eight neighbors via a small nested `for` loop over `dy`/`dx` in `-1..1` skipping the center (allocation-free, no array/object literal) and, for every neighbor currently holding `GRASS`, call `igniteStarPower(grid, nx, ny, true)` and set `grid.moved[ni] = 1` (FR-002, FR-007, FR-008, FR-011, FR-016; depends on T026)
- [X] T028 [US2] In `src/sim/step.ts`'s `step()` dispatcher, add `else if (element === STAR_POWER) stepStarPower(grid, x, y, i);` alongside the existing `isPowder`/`isLiquid`/`GRASS` branches — `stepPowder`/`stepLiquid`/`stepGrass` themselves remain unmodified (depends on T027)

**Checkpoint**: At this point, User Stories 1 AND 2 both work independently — star power can be drawn and, when it touches grass, burns it into glitter at a watchable pace, terminating on its own.

---

## Phase 5: User Story 3 - Water puts it out (Priority: P3)

**Goal**: A star power cell orthogonally adjacent to water is extinguished within one step regardless of age, leaving a glitter grain if fuelled and nothing if not, without the water itself being consumed or moved.

**Independent Test**: Ignite a grass patch with a water barrier across it in a headless grid, run the simulation, and assert that star power cells touching water are extinguished within one step, that grass on the far side of the water never catches, and that the water is neither consumed nor moved by extinguishing.

**Note**: This story adds no new production code — `stepStarPower`'s quench check (T027) already implements FR-016/FR-017 as the first branch checked every step, ordered before age/burnout and ignition (research.md §5). This phase is verification of that existing behavior under the water-specific scenarios the spec calls out.

### Tests for User Story 3

- [X] T029 [P] [US3] Add a case to `tests/unit/sim/starPower.test.ts`: a star power cell orthogonally adjacent to `WATER` is extinguished within one `step()` call in 100% of cases regardless of its current age — including on the very step it would otherwise have ignited a neighbor — and the water cell's element/shade are byte-identical before and after (Scenario 1, FR-016, FR-017, SC-009)
- [X] T030 [P] [US3] Add a case to `tests/unit/sim/starPower.test.ts`: pouring water directly onto a burning grass cell (making it orthogonally adjacent to water) stops it immediately, leaving a glitter grain since it is fuelled (Scenario 2, FR-016)
- [X] T031 [P] [US3] Add a case to `tests/unit/sim/starPower.test.ts`: a one-cell-wide stripe of water fully separating two halves of a lawn stops a burn lit on one side — `0` cells of the far half ever catch, even after running to a standstill (Scenario 3, FR-014, SC-007)
- [X] T032 [P] [US3] Add a case to `tests/unit/sim/starPower.test.ts`: grass beside a water firebreak continues to drink and grow into it exactly per spec 007's `stepGrass` rule, unaffected by the quench events happening elsewhere on the same grid (Scenario 6, FR-017a, FR-036)

**Checkpoint**: All three of User Stories 1–3 work independently — star power can be drawn, burns grass into glitter, and is reliably quenched by water without spending it.

---

## Phase 6: User Story 4 - Star power belongs with everything else (Priority: P4)

**Goal**: Star power integrates with every existing tool and system exactly like the other elements — eraser, clear-all, sparkle wand (the one genuine behavior change), objects, play-field re-derivation, and scene loading.

**Independent Test**: Exercise the eraser, clear-all, sparkle wand, object placement, powder piling, play-field re-derivation, and all three scene generators against a field containing burning star power in a headless test, and assert each existing rule applies to star power exactly as it applies to the other elements.

### Tests for User Story 4

- [X] T033 [P] [US4] Add a case to `tests/unit/sim/brush.test.ts`: the eraser removes star power from every cell in its footprint, leaving those cells `EMPTY` with `0` glitter produced, across all three brush sizes (FR-024, Scenario 1)
- [X] T034 [P] [US4] Add a case to `tests/unit/sim/wand.test.ts` confirming `applyWand`/`applyWandCell` leaves a `STAR_POWER` cell's element, `shades`, `starPowerAge`/`starPowerLife`/`starPowerFuelled`, and `glitter` completely unchanged, and does not sprinkle into it — plus confirming the wand's pre-existing behavior on every other element (sand, water, dirt, grass, rainbow sand) remains unaffected (FR-027, Scenario 5)
- [X] T035 [P] [US4] Add a case to `tests/unit/sim/objects.test.ts`: `isUnicornTouched` returns `true` when a `STAR_POWER` cell occupies a unicorn's touch zone, exactly as it does for any other non-`EMPTY`, non-`OBJECT` element, and `applyRainbowConversions` never converts a `STAR_POWER` cell inside a rainbow's zone (FR-028, Scenario 7 of User Story 1, Scenario 5 of User Story 4)
- [X] T036 [P] [US4] Add a case to `tests/unit/sim/resize.test.ts`: a grid containing star power at various ages/lives/fuel states, re-derived via `resizeGrid`, carries every surviving star power cell's element/shade/`starPowerAge`/`starPowerLife`/`starPowerFuelled` at the same bottom-centre offset every other element uses, and each carried cell still burns out (and, if fuelled, still leaves a glitter grain) within a further bounded number of `step()` calls afterward (FR-029, Scenario 6)
- [X] T037 [P] [US4] Add a case to `tests/unit/sim/scenes.test.ts`: `loadScene` clears every existing star power cell (along with every other element/object) before generating the chosen scene's contents, with no error and nothing left burning; none of the three scenes (`empty`, `landscape1`, `landscape2`) ever contains a `STAR_POWER` cell immediately after loading, at every supported grid size, and landscape-1's grass/waterline growth behavior is unchanged from spec 007 (FR-030, Scenario 3 and 4)

### Implementation for User Story 4

- [X] T038 [US4] In `src/sim/wand.ts`'s `applyWandCell`, add one early return before the existing `if (element !== EMPTY) setGlitter(...)` line: `if (element === OBJECT || element === STAR_POWER) return;` — the existing `else if (isSprinkleSite(...))` sprinkle branch is unchanged and was never reachable for a star-power-occupied cell regardless (FR-027, research.md §9)
- [X] T039 [US4] In `src/sim/resize.ts`, extend `resizeGrid`'s existing copy loop: for every source index already carried per the offset/in-bounds/`OBJECT`-skip rule, also copy `starPowerAge[srcIndex]` → `starPowerAge[destIndex]`, `starPowerLife[srcIndex]` → `starPowerLife[destIndex]`, and `starPowerFuelled[srcIndex]` → `starPowerFuelled[destIndex]` unchanged — no accumulation needed, since there is no `starPowerCount` (FR-029, research.md §11)

**Checkpoint**: All four user stories are independently functional — star power is a first-class element across every tool, scene, and system in the toy.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation that the whole feature holds together — non-regression, build, and the manual/on-device checks quickstart.md calls out as the maintainer's job.

- [X] T040 Run `npm test` and confirm every pre-existing test in `tests/unit/**/*.test.ts` still passes, changed only where this feature's own change makes an assertion obsolete (`TOOLBAR_CONTROL_COUNT` in `layout.test.ts`) — every other file's assertions unchanged (FR-036, SC-018) — 253/253 passing; the only other production (non-test) change was `layout.ts`'s `TOOLBAR_GAP` model constant, needed for T012's toolbar-fit assertions to hold with 16 controls
- [X] T041 Run `npm run build` and confirm `dist/index.html` is the only emitted file and is fully playable when opened directly from disk with no network requests (FR-037, SC-020) — `dist/` contains exactly one file (57.19 kB, gzip 21.49 kB); the only `http(s)://` strings inside it are Svelte's own error-message documentation links and the SVG XML namespace URI, neither of which is fetched at runtime — same pattern as every prior spec's build
- [ ] T042 Perform the on-device checks from quickstart.md's "Manual-only checks" and "Performance check" sections on a mid-range laptop, a tablet, and a low-end tablet of the Amazon Fire 7 Kids class: star power reads instantly as magic (gold/white/twinkling), never as fire; a ⭐ trail across an empty screen is satisfying on its own; the burn front's advance is a watchable "ooh" pace; a burning blade bursts into glitter rather than swapping color; the resulting heap reads as treasure, not ash; pouring water in front of the front is legible without explanation; the ⭐ button belongs with the others; nothing about the sequence is scary or sad; a whole hillside going up in glitter at spec 007's grass ceiling sustains >= 30fps (targeting 60fps) and stays within 20% of an equally-full field of falling sand's per-step cost (FR-033, SC-014, SC-016) — **requires real devices including a Fire-7-class tablet; cannot be performed in this headless environment, left for the maintainer**

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories (every story's code and tests import `STAR_POWER`/`Grid`'s new fields/`igniteStarPower` from `types.ts`/`grid.ts`).
- **User Stories (Phase 3–6)**: All depend on Foundational phase completion.
  - US1 (Phase 3) has no dependency on US2–US4.
  - US2 (Phase 4) depends on Foundational only; independently testable via `starPower.test.ts` without US1's brush/toolbar/rendering changes, though a real play-through needs US1's brush to ignite the initial patch by hand.
  - US3 (Phase 5) depends on US2's `stepStarPower` implementation (T025–T028) existing, since it verifies the quench-priority behavior already built into that same function — it adds no new implementation of its own.
  - US4 (Phase 6) depends on Foundational's `starPowerAge`/`starPowerLife`/`starPowerFuelled`/`igniteStarPower` (T002–T008) for its `wand.ts`/`resize.ts` work and their tests; its brush/objects/scenes tests (T033, T035, T037) only need Foundational + US1's brush change (T013) and/or US2's `stepStarPower` (T027) to be meaningful end-to-end.
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — no dependency on other stories.
- **User Story 2 (P2)**: Can start after Foundational — no dependency on other stories' code, though it delivers its full "burn the lawn" moment only once US1's brush exists to ignite grass by hand.
- **User Story 3 (P3)**: Can start after Foundational, but its assertions exercise US2's `stepStarPower` — apply US2 first.
- **User Story 4 (P4)**: Can start after Foundational; independently testable, though its wand/resize/scenes assertions are most meaningful once US1 (brush) and US2 (burning) exist to populate a field with real star power.

### Within Each User Story

- Tests are written before implementation and should fail first (constitution Principle V / FR-038 require the coverage; standard TDD discipline applies since tests are explicitly requested by this feature).
- `types.ts`/`grid.ts` (Foundational) before any test or implementation task that reads `STAR_POWER`/`starPowerAge`/`starPowerLife`/`starPowerFuelled`/`igniteStarPower`.
- Within US2: T025 → T026 → T027 → T028 (each helper builds on the previous one in the same file).
- Story complete and checkpoint validated before moving to the next priority.

### Parallel Opportunities

- T003 and T004 (different files: `element.ts`, `shade.ts`) can run in parallel once T002 lands; T005 depends on T004; T006/T007/T008 (all in `grid.ts`) are sequential within that file.
- T009–T012 (four different test files) can all be written in parallel once Foundational completes.
- T013, T014, T015 (three different files: `brush.ts`, `Toolbar.svelte`, `PlayArea.svelte`) can run in parallel.
- T016–T024 (all additions to the same `starPower.test.ts`) are logically parallel test cases but land in one file — coordinate merges.
- T029–T032 (same file again) are independent test cases — coordinate merges.
- T033–T037 (five different test files) can all be written in parallel.
- T038, T039 (different files: `wand.ts`, `resize.ts`) can run in parallel.

---

## Parallel Example: Foundational Phase

```bash
# T003 and T004 touch different files and can proceed together (after T002):
Task: "Extend isSolid in src/sim/element.ts"
Task: "Add randomBurnLife/randomHue in src/sim/shade.ts"
```

## Parallel Example: User Story 1 tests

```bash
# Four different test files, all depend only on Foundational:
Task: "No-movement/burn-life starPower.test.ts cases in tests/unit/sim/starPower.test.ts"
Task: "Star brush deposit/ignite/skip cases in tests/unit/sim/brush.test.ts"
Task: "igniteStarPower/setCell/clearGrid bookkeeping cases in tests/unit/sim/grid.test.ts"
Task: "TOOLBAR_CONTROL_COUNT update in tests/unit/lib/layout.test.ts"
```

## Parallel Example: User Story 4 tests

```bash
# Five different test files, all depend only on Foundational:
Task: "Eraser removes star power in tests/unit/sim/brush.test.ts"
Task: "Wand leaves star power untouched in tests/unit/sim/wand.test.ts"
Task: "Objects unaffected by star power in tests/unit/sim/objects.test.ts"
Task: "Star power survives resizeGrid in tests/unit/sim/resize.test.ts"
Task: "Scene loading clears star power in tests/unit/sim/scenes.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (baseline confirmation).
2. Complete Phase 2: Foundational — `STAR_POWER` element, `Grid`'s new fields, `igniteStarPower` (CRITICAL, blocks all stories).
3. Complete Phase 3: User Story 1 — draw star power with the toolbar, brush, and rendering.
4. **STOP and VALIDATE**: Run `tests/unit/sim/starPower.test.ts`/`brush.test.ts`/`grid.test.ts`/`layout.test.ts`; confirm star power draws, stays put, fades on its own, and the toolbar still fits.
5. This alone gives the child a magic sparkler she can wave across the screen, even before any grass catches.

### Incremental Delivery

1. Setup + Foundational → foundation ready (`STAR_POWER` exists, `Grid` carries its state correctly).
2. Add User Story 1 → validate independently → star power can be drawn and fades on its own (MVP!).
3. Add User Story 2 → validate independently → star power burns grass into glitter at a watchable pace, terminating on its own.
4. Add User Story 3 → validate independently → water reliably quenches a burn without being spent.
5. Add User Story 4 → validate independently → star power behaves like every other element everywhere else in the toy.
6. Polish (Phase 7) → full non-regression, build, and on-device sign-off.

### Solo/Sequential Strategy

Given `stepStarPower`'s atomic quench-then-burnout-then-ignite design (research.md §5), US3's verification is only meaningful once US2's implementation lands, so a single implementer should work phases in order (1 → 2 → 3 → 4 → 5 → 6 → 7) even though US1/US2/US4 remain independently testable at their own checkpoints.
