---

description: "Task list for Water-Drinking Grass (007)"
---

# Tasks: Water-Drinking Grass

**Input**: Design documents from `/specs/007-water-drinking-grass/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/grass-mechanics.md, quickstart.md

**Tests**: Automated tests ARE explicitly required by this feature (FR-035, constitution Principle V — no browser harness). Test tasks below are not optional.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

Single client-only project (established by 001–006): `src/sim/*` (framework-free core), `src/lib/*` (Svelte components + layout helpers), `tests/unit/sim/*`, `tests/unit/lib/*`. Paths below match plan.md's Project Structure exactly.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Nothing new to scaffold — this feature extends the existing 001–006 project (`package.json`, build tooling, `vitest` config all already in place, per plan.md/quickstart.md). No new dependency is added (research.md §11).

- [X] T001 Confirm `npm install` and `npm test` succeed from a clean checkout with all pre-existing `tests/unit/**/*.test.ts` passing, establishing the pre-change baseline before any edits in this feature

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the `GRASS` element, `Grid`'s new per-cell state, and the `isSolid` helper that every user story's code and tests depend on. This is the "grass exists as a concept" layer — no absorption/growth/brush/rendering behavior yet.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete — every story's tests import `GRASS`/`grassHeight`/`grassCooldown`/`grassCount` from `types.ts`/`grid.ts`.

- [X] T002 In `src/sim/types.ts`: add `export const GRASS = 6;`, add `typeof GRASS` to the `Element` union, add `grassHeight: Uint8Array`, `grassCooldown: Uint8Array` (both `readonly`, per the array-reference convention) and `grassCount: number` (not `readonly` — a running total) to the `Grid` interface, and add `'grass'` to the `Tool` union, per contracts/grass-mechanics.md
- [X] T003 [P] In `src/sim/element.ts`, add `export function isSolid(e: number): boolean` returning `isPowder(e) || e === GRASS` — `isPowder`/`isLiquid` themselves unchanged (research.md §1)
- [X] T004 In `src/sim/grid.ts`: extend `createGrid(width, height)` to also allocate `grassHeight`/`grassCooldown` as zero-filled `Uint8Array(width * height)` and initialize `grassCount = 0`; extend `clearGrid(grid)` to also fill `grassHeight`/`grassCooldown` to `0` and set `grassCount = 0`, alongside its existing `elements.fill(EMPTY)`/`glitter.fill(0)`
- [X] T005 In `src/sim/grid.ts`, extend `setCell(grid, x, y, element, shade)` per contracts/grass-mechanics.md's exact contract (depends on T002, T004): compute `wasGrass`/`becomesGrass` before the existing writes; after the existing `elements[i]`/`shades[i]`/`glitter[i]` writes, if `becomesGrass`, set `grassHeight[i] = elements[belowIndex] === GRASS ? min(255, grassHeight[belowIndex] + 1) : 0` (where `belowIndex` is `(y+1)*width+x` when `y+1 < height`, else "no grass below"), else set `grassHeight[i] = 0`; always reset `grassCooldown[i] = 0` when grass-ness changes; increment `grassCount` when the cell becomes grass and wasn't, decrement when it stops being grass and was

**Checkpoint**: `GRASS` exists as an element, `Grid` carries its new per-cell state correctly through `setCell`/`clearGrid`/`createGrid` — user story implementation and their tests can now proceed.

---

## Phase 3: User Story 1 - Planting grass (Priority: P1) 🎯 MVP

**Goal**: The child can select a grass tool and paint grass onto the play area with any brush size, into empty space or water, without disturbing sand/dirt; grass never moves once placed.

**Independent Test**: Plant grass with each brush size on an otherwise empty play field, over a powder pile, and into water, then run the simulation for many steps and assert without a browser that every planted cell still holds grass in its original cell, that no powder cell was overwritten, and that the toolbar exposes exactly one new element control.

### Tests for User Story 1 ⚠️

- [X] T006 [P] [US1] Create `tests/unit/sim/grass.test.ts` and add its first cases: a grass cell planted via `setCell` stays at its `(x, y)` across any number of `step()` calls with nothing else on the field (FR-004, SC-002), including a cell planted with `EMPTY` directly beneath it (mid-air — Edge Cases) which must be its own root (`grassHeight === 0`) and must not fall
- [X] T007 [P] [US1] Add cases to `tests/unit/sim/brush.test.ts`: the `grass` tool deposits `GRASS` into footprint cells holding `EMPTY` or `WATER` (removing the water in the latter case), and never overwrites `SAND`/`DIRT`/`RAINBOW_SAND`/`OBJECT` cells in its footprint, across all three brush sizes — mirroring the existing `sand`/`dirt` brush test shape (FR-020, FR-021)
- [X] T008 [P] [US1] Add cases to `tests/unit/sim/grid.test.ts`: `setCell`'s grass bookkeeping — planting grass on top of existing grass yields `grassHeight = belowHeight + 1`; planting grass with no grass below yields `grassHeight = 0`; planting then overwriting a grass cell with a non-grass element resets `grassHeight`/`grassCooldown` to `0` and decrements `grassCount`; `grassCount` tracks net grass cells created/removed exactly (contracts/grass-mechanics.md)
- [X] T009 [P] [US1] Add a case to `tests/unit/sim/wand.test.ts` confirming `applyWand`/`applyWandCell` glitters a `GRASS` cell without changing its element (FR-025)
- [X] T010 [P] [US1] In `tests/unit/lib/layout.test.ts`, move `TOOLBAR_CONTROL_COUNT` from `14` to `15` (research.md §7) and confirm the existing toolbar-fit assertions (from spec 006) still pass at every phone-sized table entry with the new count

### Implementation for User Story 1

- [X] T011 [US1] In `src/sim/brush.ts`'s `paintCell`, add one branch: `tool === 'grass' && (current === EMPTY || current === WATER)` → `setCell(grid, x, y, GRASS, shade)` — matching the existing `sand`/`dirt` deposit pattern (FR-020); the `eraser` branch is unchanged
- [X] T012 [US1] In `src/lib/Toolbar.svelte`, add a fourth button to `.group.elements` after the existing dirt button: `class:selected={tool === 'grass'}`, `aria-label="Grass"`, `onclick={() => onSelectTool('grass')}`, glyph `🌱` — same markup pattern as the three existing element buttons (FR-018, FR-019); pink sand (`'sand'`) remains the tool selected on page load (FR-023, unchanged)
- [X] T013 [US1] In `src/lib/PlayArea.svelte`: import `GRASS` from `../sim/types`; add a `GREEN_RAMP: [number, number, number][]` constant (8 entries, pale-to-deep green, mirroring `PINK_RAMP`/`BLUE_RAMP`/`PURPLE_RAMP`'s shape); add one branch to `colorFor(element, shade, hue)`: `if (element === GRASS) return GREEN_RAMP[shade % GREEN_RAMP.length];` — `render()`'s per-cell loop itself is unchanged (FR-002, FR-003, SC-011)

**Checkpoint**: At this point, User Story 1 is fully functional and testable independently — grass can be planted with any brush size, stays put, and reads as green.

---

## Phase 4: User Story 2 - Watering makes it grow (Priority: P2)

**Goal**: A grass cell adjacent to water absorbs it (paced, not instant) and sprouts a new grass cell above/diagonally-above/sideways-with-support, spending exactly the water it drank; grass with no eligible target does not absorb; grass never grows without water.

**Independent Test**: Place a grass patch and a body of water beside and above it in a headless grid, run the simulation, and assert that water cells adjacent to the grass are consumed, that the grass cell count rises by no more than one cell per water cell consumed, that new grass cells appear above and outward from existing ones and never below, and that growth halts once the water is gone.

### Tests for User Story 2 ⚠️

- [X] T014 [P] [US2] Add cases to `tests/unit/sim/grass.test.ts`: a water cell orthogonally adjacent to a grass cell that can still grow is consumed (`EMPTY`) within one `step()` and exactly one new grass cell appears (FR-007); a single grass cell absorbs at most one water cell per `GRASS_ABSORB_COOLDOWN` (10) simulation steps even with unlimited adjacent water (FR-009)
- [X] T015 [P] [US2] Add a case to `tests/unit/sim/grass.test.ts`: a grass cell fully boxed in by non-empty cells (so `pickGrowthTargetIndex` finds no eligible target) does not absorb an adjacent water cell — the water cell is unchanged and continues to behave as ordinary water (pools/levels) across further steps (FR-008)
- [X] T016 [P] [US2] Add cases to `tests/unit/sim/grass.test.ts`: new grass appears only directly above, diagonally above, or (when the cell beneath the target is solid) directly sideways of an existing grass cell — never below and never sideways over empty air — across many steps of a watered patch (FR-010); a target cell already holding `SAND`/`DIRT`/`WATER`/`OBJECT` is never chosen as a growth target (FR-010, FR-026)
- [X] T017 [P] [US2] Add a case to `tests/unit/sim/grass.test.ts`: grass buried under a pile of sand produces 0 new cells while buried even with adjacent water, and resumes growing normally once the covering sand is removed (Edge Cases, User Story 2 Scenario 8)
- [X] T018 [P] [US2] Add a case to `tests/unit/sim/grass.test.ts`: with zero `WATER` cells anywhere on the field, running `step()` 10,000 times produces 0 new grass cells and 0 changes to any existing grass cell's element/shade/height (FR-016, SC-010)

### Implementation for User Story 2

- [X] T019 [US2] In `src/sim/step.ts`, add private constants `GRASS_HEIGHT_CEILING = 12`, `GRASS_FIELD_SHARE_CEILING = 0.25`, `GRASS_ABSORB_COOLDOWN = 10`, and private allocation-free helpers `isSupported(grid, tx, ty): boolean` (true iff the cell directly beneath `(tx, ty)` is `isSolid` or off the bottom edge) and `computeWouldBeHeight(grid, tx, ty): number` (the "look at the cell below" rule from data-model.md's Root/height section)
- [X] T020 [US2] In `src/sim/step.ts`, add private `isEligibleTarget(grid, tx, ty): boolean` (in bounds, `elements[ty*width+tx] === EMPTY`, `grassCount < floor(width*height*GRASS_FIELD_SHARE_CEILING)`, `computeWouldBeHeight(grid, tx, ty) <= GRASS_HEIGHT_CEILING`) and private `pickGrowthTargetIndex(grid, x, y): number` implementing FR-010's preference order using only index arithmetic (research.md §4): above; then diagonals (random tie-break via `Math.random() < 0.5` when both eligible); then sideways only when `isSupported` at the target; else `-1` (depends on T019)
- [X] T021 [US2] In `src/sim/step.ts`, add private `stepGrass(grid, x, y, i): void`: if `grassCooldown[i] > 0`, decrement and return; else scan the four orthogonal neighbors via a plain `if`/`else if` chain for the first `WATER` cell — if none, return; else call `pickGrowthTargetIndex` — if `-1`, return without touching the water cell (FR-008); else `setCell` the water cell's index to `EMPTY`, `setCell` the target index to `GRASS` with a fresh random shade, set `grid.moved[targetIndex] = 1`, set `grid.grassCooldown[i] = GRASS_ABSORB_COOLDOWN` (depends on T020)
- [X] T022 [US2] In `src/sim/step.ts`'s `step()` dispatcher, add `else if (element === GRASS) stepGrass(grid, x, y, i);` alongside the existing `isPowder`/`isLiquid` branches — `stepPowder`/`stepLiquid` themselves remain unmodified (depends on T021)

**Checkpoint**: At this point, User Stories 1 AND 2 both work independently — grass can be planted and, when watered, grows in the correct directions at the correct pace.

---

## Phase 5: User Story 3 - Gentle and bounded, never a takeover (Priority: P3)

**Goal**: Confirm the ceilings and pacing already built into US2's `pickGrowthTargetIndex`/`stepGrass` (height ceiling, field-share ceiling, one-blade-per-water-cell bound) hold under sustained/unlimited watering, so grass never overruns the field or silently drains a lake dry.

**Independent Test**: Flood a headless play field with water against a large grass patch, run the simulation to a standstill, and assert that no blade exceeds the maximum height above its root, that total grass never exceeds the share-of-field ceiling, that water remains on the field once the grass can no longer grow, and that the whole run stays inside the per-step work budget.

**Note**: This story adds no new production code — research.md §2/§4 deliberately fold FR-008/FR-011/FR-012/FR-014's bounds into the single atomic `pickGrowthTargetIndex`/`stepGrass` implementation from US2, so that growth can never occur unbounded even transiently. This phase is pure verification of that existing behavior under the stress cases the spec calls out.

### Tests for User Story 3

- [X] T023 [P] [US3] Add a case to `tests/unit/sim/grass.test.ts`: flood a grid with an effectively unlimited water supply against a grass patch, run `step()` until the grid stops changing between consecutive steps, then assert 0 grass cells have `grassHeight > 12` (FR-011, SC-006)
- [X] T024 [P] [US3] Add a case to `tests/unit/sim/grass.test.ts` (same flood-to-standstill setup as T023): assert the final `grassCount / (width * height) <= 0.25` (FR-012, SC-006)
- [X] T025 [P] [US3] Add a case to `tests/unit/sim/grass.test.ts`: seed a pool of `>= 200` water cells beside a grass patch, run to standstill, then assert further `step()` calls neither absorb nor grow anything further and 100% of the remaining water cells stay in place across additional steps (FR-008, SC-007)
- [X] T026 [P] [US3] Add a case to `tests/unit/sim/grass.test.ts`: a single grass cell beside a very large body of water absorbs at most `floor(stepsRun / 10)` water cells over a bounded run (FR-009/SC-008), and the total new grass cells created never exceeds the total water cells absorbed (FR-014, SC-005)
- [X] T027 [P] [US3] Add a case to `tests/unit/sim/grass.test.ts`: re-run the flood-to-standstill scenario at a phone-sized grid derived via `computePlayField` (from `src/lib/layout.ts`) and confirm the same height-ceiling and field-share-ceiling outcomes hold (FR-032)

**Checkpoint**: All three of User Stories 1–3 work independently — grass can be planted, grows correctly when watered, and stays bounded under unlimited watering.

---

## Phase 6: User Story 4 - Grass belongs with everything else (Priority: P4)

**Goal**: Grass integrates with every existing tool and system exactly like the other elements — eraser, clear-all, wand (already covered by US1), objects, play-field re-derivation, and both scene generators (landscape-1 seeded, landscape-2 untouched).

**Independent Test**: Exercise the eraser, clear-all, wand, powder piling, object placement, play-field re-derivation, and both scene generators against a field containing grass in a headless test and assert each existing rule applies to grass exactly as it applies to the other elements — including that landscape-1 generates grass on its hills deterministically at every size while landscape-2 generates none.

### Tests for User Story 4

- [X] T028 [P] [US4] Add a case to `tests/unit/sim/brush.test.ts`: the eraser removes grass from every cell in its footprint exactly as it does sand/water/dirt, across all three brush sizes (FR-022, Scenario 1)
- [X] T029 [P] [US4] Add a case to `tests/unit/sim/grid.test.ts`: `clearGrid` on a grass-populated grid empties every cell and resets `grassCount` to `0` (FR-022, Scenario 2)
- [X] T030 [P] [US4] Add a case to `tests/unit/sim/resize.test.ts`: a grid containing grass at various heights/cooldowns, re-derived via `resizeGrid`, carries every surviving grass cell's element/shade/`grassHeight`/`grassCooldown` at the same bottom-centre offset every other element uses, and the new grid's `grassCount` matches the number of carried grass cells exactly (FR-027, Scenario 6)
- [X] T031 [P] [US4] Add cases to `tests/unit/sim/scenes.test.ts`: `generateLandscape1` places grass on its hills at every supported grid size (per `computePlayField`'s range), deterministically — loading it twice at the same size produces byte-identical grass placement — while its hills/lake/rainbow/unicorn remain exactly as spec 004 requires (FR-028a, Scenario 9); `generateLandscape2` places exactly 0 grass cells at every supported grid size (Scenario 11, SC-021)
- [X] T032 [P] [US4] Add a case to `tests/unit/sim/scenes.test.ts`: running `step()` on a freshly-generated landscape-1 to a standstill (no drawing) leaves the hill height profile unchanged, halts grass growth, and leaves at least half of the scene's original water-cell count still present (FR-028a, SC-022)
- [X] T033 [P] [US4] Add a case to `tests/unit/sim/scenes.test.ts` (or confirm via existing `loadScene` cases): loading any scene clears every existing grass cell along with every other element/object, with `grassCount` reset accordingly, before the new scene's contents are placed (FR-028, Scenario 7)
- [X] T034 [P] [US4] Add a case to `tests/unit/sim/objects.test.ts` confirming placing a rainbow/unicorn over grass, and rainbow-conversion near a grass-adjacent cell, behave exactly as they do over any other element — grass is outside the conversion set and never grown into by an object's footprint (FR-026, Scenario 5)

### Implementation for User Story 4

- [X] T035 [US4] In `src/sim/resize.ts`, extend `resizeGrid`'s existing copy loop: for every source index already carried per the offset/in-bounds/`OBJECT`-skip rule, also copy `grassHeight[srcIndex]` → `grassHeight[destIndex]` and `grassCooldown[srcIndex]` → `grassCooldown[destIndex]` unchanged, and increment the new grid's `grassCount` once per copied `GRASS` cell in the same pass (no full-grid re-scan afterward)
- [X] T036 [US4] In `src/sim/scenes.ts`'s `generateLandscape1`, add the hill-cap pass after existing hill/lake/rainbow/unicorn generation: for every dry column (`heights[i] <= waterSurfaceRow`), `setCell(grid, x0+i, heights[i]-1, GRASS, positionalShade(...))` — using only the already-computed `heights[]`/`positionalShade`, no `Math.random()` (research.md §9, FR-028a)
- [X] T037 [US4] In `src/sim/scenes.ts`'s `generateLandscape1`, add the shoreline-seed pass after the hill-cap pass: for a small fixed number of flooded columns nearest each crest (start with 2 columns walking inward from each crest, tuning against SC-022 during validation), `setCell(grid, x, waterSurfaceRow-1, GRASS, positionalShade(...))` — guaranteeing these cells are orthogonally adjacent to a `WATER` cell at load time (research.md §9, FR-028a); `generateLandscape2` remains untouched (0 grass cells)

**Checkpoint**: All four user stories are independently functional — grass is a first-class element across every tool, scene, and system in the toy.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation that the whole feature holds together — non-regression, build, and the manual/on-device checks quickstart.md calls out as the maintainer's job.

- [X] T038 Run `npm test` and confirm every pre-existing test in `tests/unit/**/*.test.ts` still passes, changed only where the spec's Superseded requirements section makes an assertion obsolete (landscape-1's composition assertions in `scenes.test.ts`, `TOOLBAR_CONTROL_COUNT` in `layout.test.ts`) — every other file's assertions unchanged (FR-033, SC-017)
- [X] T039 Run `npm run build` and confirm `dist/index.html` is the only emitted file and is fully playable when opened directly from disk with no network requests (FR-034, SC-019)
- [ ] T040 Perform the on-device checks from quickstart.md's "Manual-only checks" and performance-check sections on a mid-range laptop, a tablet, and a low-end tablet of the Amazon Fire 7 Kids class: grass reads instantly as green and alive; watering looks like sprouting; the shrinking pool is legible; a grown lawn shows varied heights; the grass button belongs with the others; sand piles convincingly on grass; the wand glitters it magically; the hills-and-lake scene's shoreline grass drinks and settles without draining the lake; a full garden with flowing water sustains >= 30fps (targeting 60fps) and stays within 20% of an equally-full sand field's per-step cost (SC-014, SC-015) — **requires real devices including a Fire-7-class tablet; cannot be performed in this headless environment, left for the maintainer**

---

## Phase 8: Convergence

- [X] T041 Add a dedicated automated test (in `tests/unit/sim/grass.test.ts` or `tests/unit/sim/step.test.ts`) confirming a powder resting directly above a `GRASS` cell stays resting on top of it (never sinks through or displaces it), and a `WATER` cell beside/above a `GRASS` cell flows around it rather than through it, exercised via `step()` directly against a `GRASS` obstacle per FR-005 (missing)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories (every story's code and tests import `GRASS`/`Grid`'s new fields from `types.ts`/`grid.ts`).
- **User Stories (Phase 3–6)**: All depend on Foundational phase completion.
  - US1 (Phase 3) has no dependency on US2–US4.
  - US2 (Phase 4) depends on Foundational only; independently testable via `grass.test.ts` without US1's brush/toolbar/rendering changes, though a real play-through needs US1's brush to plant the initial patch.
  - US3 (Phase 5) depends on US2's `step.ts` implementation (T019–T022) existing, since it verifies bounds already built into that atomic design — it adds no new implementation of its own.
  - US4 (Phase 6) depends on Foundational's `grassHeight`/`grassCooldown`/`grassCount` (T002–T005) for its `resize.ts`/`scenes.ts` work; its brush/grid/wand-adjacent tests (T028–T029) only need Foundational + US1's brush change (T011) to be meaningful end-to-end, though they can be written against Foundational alone.
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — no dependency on other stories.
- **User Story 2 (P2)**: Can start after Foundational — no dependency on other stories' code, though it delivers its full "watering makes it flourish" moment only once US1's brush exists to plant grass by hand.
- **User Story 3 (P3)**: Can start after Foundational, but its assertions exercise US2's `pickGrowthTargetIndex`/`stepGrass` — apply US2 first.
- **User Story 4 (P4)**: Can start after Foundational; independently testable, though its scene/resize assertions are most meaningful once US1 (brush) and US2 (growth) exist to populate a field with real grass.

### Within Each User Story

- Tests are written before implementation and should fail first (constitution Principle V / FR-035 require the coverage; standard TDD discipline applies since tests are explicitly requested by this feature).
- `types.ts`/`grid.ts` (Foundational) before any test or implementation task that reads `GRASS`/`grassHeight`/`grassCooldown`/`grassCount`.
- Within US2: T019 → T020 → T021 → T022 (each helper builds on the previous one in the same file).
- Story complete and checkpoint validated before moving to the next priority.

### Parallel Opportunities

- T002 and T003 (different files: `types.ts`, `element.ts`) can run in parallel; T004/T005 (both in `grid.ts`) are sequential within that file.
- T006–T010 (five different test files) can all be written in parallel once Foundational completes.
- T011, T012, T013 (three different files: `brush.ts`, `Toolbar.svelte`, `PlayArea.svelte`) can run in parallel.
- T014–T018 (all additions to the same `grass.test.ts`) are logically parallel test cases but land in one file — coordinate merges.
- T023–T027 (same file again) are independent test cases — coordinate merges.
- T028–T034 (five different test files) can all be written in parallel.
- T035, T036/T037 (different files: `resize.ts` vs `scenes.ts`) can run in parallel; T036 before T037 within `scenes.ts` (both edit `generateLandscape1`).

---

## Parallel Example: Foundational Phase

```bash
# T002 and T003 touch different files and can proceed together:
Task: "Add GRASS constant, Element/Grid/Tool extensions in src/sim/types.ts"
Task: "Add isSolid helper in src/sim/element.ts"
```

## Parallel Example: User Story 1 tests

```bash
# Five different test files, all depend only on Foundational:
Task: "No-movement grass.test.ts cases in tests/unit/sim/grass.test.ts"
Task: "Grass brush deposit/non-overwrite cases in tests/unit/sim/brush.test.ts"
Task: "setCell grass bookkeeping cases in tests/unit/sim/grid.test.ts"
Task: "Wand glitter case in tests/unit/sim/wand.test.ts"
Task: "TOOLBAR_CONTROL_COUNT update in tests/unit/lib/layout.test.ts"
```

## Parallel Example: User Story 4 tests

```bash
# Five different test files, all depend only on Foundational:
Task: "Eraser removes grass in tests/unit/sim/brush.test.ts"
Task: "clearGrid resets grassCount in tests/unit/sim/grid.test.ts"
Task: "Grass survives resizeGrid in tests/unit/sim/resize.test.ts"
Task: "Landscape-1/landscape-2 grass composition in tests/unit/sim/scenes.test.ts"
Task: "Objects unaffected by grass in tests/unit/sim/objects.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (baseline confirmation).
2. Complete Phase 2: Foundational — `GRASS` element, `Grid`'s new fields, `isSolid` (CRITICAL, blocks all stories).
3. Complete Phase 3: User Story 1 — plant grass with the toolbar, brush, and rendering.
4. **STOP and VALIDATE**: Run `tests/unit/sim/grass.test.ts`/`brush.test.ts`/`grid.test.ts`/`wand.test.ts`/`layout.test.ts`; confirm grass plants, stays put, and the toolbar still fits.
5. This alone gives the child a new colour in the box, even before watering does anything.

### Incremental Delivery

1. Setup + Foundational → foundation ready (`GRASS` exists, `Grid` carries its state correctly).
2. Add User Story 1 → validate independently → grass can be planted and stays put (MVP!).
3. Add User Story 2 → validate independently → watering makes grass grow, correctly paced and directed.
4. Add User Story 3 → validate independently → growth stays bounded even under unlimited watering.
5. Add User Story 4 → validate independently → grass behaves like every other element everywhere else in the toy.
6. Polish (Phase 7) → full non-regression, build, and on-device sign-off.

### Solo/Sequential Strategy

Given `step.ts`'s atomic absorb-and-grow design (research.md §2), US3's verification is only meaningful once US2's implementation lands, so a single implementer should work phases in order (1 → 2 → 3 → 4 → 5 → 6 → 7) even though US1/US2/US4 remain independently testable at their own checkpoints.
