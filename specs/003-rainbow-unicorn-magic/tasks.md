---

description: "Task list template for feature implementation"
---

# Tasks: Rainbow and Unicorn Magic

**Input**: Design documents from `/specs/003-rainbow-unicorn-magic/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/sim-core.md, quickstart.md

**Tests**: FR-037 explicitly requires automated `vitest` coverage for specific rules (rainbow conversion, rainbow sand movement parity, solid-object blocking, the per-type cap-of-3 roll-off, and objects staying put). Test tasks below are included for those rules; particle visuals and idle-sparkle timing are manual-only per the spec's own "Visual checks" section and are not covered by test tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story, per plan.md's file layout (`src/sim/objects.ts` new; `types.ts`, `element.ts`, `grid.ts`, `step.ts` modified; `src/lib/particles.ts` new; `layout.ts`, `PlayArea.svelte`, `Toolbar.svelte` modified).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

Single client-only project (unchanged from 001/002): `src/sim/*` (framework-free core), `src/lib/*` (Svelte UI shell), `tests/unit/sim/*` (vitest, no DOM).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new dependencies or scaffolding are needed — this feature extends the existing 001/002 project structure in place (plan.md: "no new top-level architecture"). This phase only confirms the starting state.

- [X] T001 Confirm `npm install && npm run build && npm test` all succeed on the current checkout before making any changes, so any later failure is attributable to this feature (baseline for FR-036/SC-013)

**Checkpoint**: Baseline confirmed green; proceed to Foundational phase.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core type/grid/element changes that every user story's tests and implementation depend on. Per data-model.md and contracts/sim-core.md, `RAINBOW_SAND`, `OBJECT`, the `hues` array, and `ObjectsState`/`PlacedObject` types must exist before rainbow conversion, unicorn touch, or solidity can be built or tested.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T002 Add `RAINBOW_SAND = 4` and `OBJECT = 5` to the `Element` union, widen `Tool` to `'sand' | 'water' | 'dirt' | 'rainbow' | 'unicorn' | 'eraser'`, and add `ObjectKind`, `PlacedObject`, and `ObjectsState` types in `src/sim/types.ts` (contracts/sim-core.md `types.ts` section)
- [ ] T003 Add `readonly hues: Uint8Array` to the `Grid` interface in `src/sim/types.ts` (data-model.md Grid section)
- [ ] T004 [P] Update `isPowder` in `src/sim/element.ts` to additionally return `true` for `RAINBOW_SAND`; confirm `isLiquid` and all other predicates return `false` for `OBJECT` with no new predicate added (contracts/sim-core.md `element.ts` section, FR-019)
- [ ] T005 [P] Update `createGrid` in `src/sim/grid.ts` to allocate and zero-initialize `hues: Uint8Array(width * height)` alongside `elements`/`shades`/`moved`; confirm `clearGrid` remains unchanged (`elements.fill(EMPTY)` only) (contracts/sim-core.md `grid.ts` section)
- [ ] T006 [P] Extend `tests/unit/sim/grid.test.ts` to assert `createGrid` returns a zero-filled `hues` array of the correct length (data-model.md Grid Validation rules)
- [ ] T007 Extend `step.ts`'s internal move/swap primitives (`moveCell`/`swapCells` or equivalents) in `src/sim/step.ts` to carry `hues[i]` alongside `elements`/`shades` on every move/swap, and to advance the destination's `hues[]` value by a fixed step (mod 256) only when the destination element is `RAINBOW_SAND` and the cell actually moved this tick; confirm `step(grid)`'s exported signature and behavior for `SAND`/`WATER`/`DIRT` are unchanged (research.md §4, contracts/sim-core.md `step.ts` section, FR-021, FR-036)
- [ ] T008 Add `OBJECT_FOOTPRINT_SIZE = 24` constant to `src/lib/layout.ts` alongside the existing grid/brush constants (research.md §6, contracts/sim-core.md Layout constants section)
- [ ] T009 Create `src/sim/objects.ts` with `createObjectsState()` returning `{ rainbows: [], unicorns: [], nextId: 0 }`, and a shared internal `forEachZoneCell(grid, obj, fn)` helper iterating the one-cell ring at Chebyshev distance 1 around a footprint, clipped to grid bounds (research.md §2, contracts/sim-core.md `objects.ts` section, data-model.md PlacedObject zone definition)

**Checkpoint**: Foundation ready — `Grid`/`Element`/`Tool`/`ObjectsState` types exist, `isPowder` covers `RAINBOW_SAND`, `hues` is allocated and carried on move, and `objects.ts` has its state constructor and shared zone helper. User story implementation can now begin.

---

## Phase 3: User Story 1 - Stamp a rainbow and make rainbow sand (Priority: P1) 🎯 MVP

**Goal**: Placing a 🌈 converts touching pink sand, magic purple dirt, and water into rainbow sand, which falls/piles like pink sand while shimmering in motion and freezing at rest.

**Independent Test**: Place a rainbow, pour pink sand onto it, and confirm the grains that touch it come away rainbow-colored and then fall and pile like ordinary sand — fully verifiable against grid state with `vitest`, no browser.

### Tests for User Story 1 (required by FR-037) ⚠️

- [ ] T010 [P] [US1] Test `applyRainbowConversions` in `tests/unit/sim/objects.test.ts`: a `SAND`/`DIRT`/`WATER` cell inside a rainbow's zone becomes `RAINBOW_SAND` with a fresh `hues[]` value on the next call; a cell outside every rainbow's zone is untouched; an already-`RAINBOW_SAND` cell is left alone (idempotent); an `OBJECT` or `EMPTY` zone cell is untouched; multiple rainbows convert independently with no combined effect (FR-014–FR-018, contracts/sim-core.md `applyRainbowConversions`)
- [ ] T011 [P] [US1] Extend `tests/unit/sim/step.test.ts`: `RAINBOW_SAND` falls, diagonal-slides, rests, sinks through water, and piles with sloped sides identically to `SAND` (FR-019); a `RAINBOW_SAND` cell's `hues[]` value changes when it moves/swaps this tick and stays unchanged across a tick where it does not move (FR-021, SC-021)

### Implementation for User Story 1

- [ ] T012 [US1] Implement `applyRainbowConversions(grid, rainbows)` in `src/sim/objects.ts`, using the `forEachZoneCell` helper from T009: for each rainbow, walk its zone and set any `SAND`/`DIRT`/`WATER` cell's element to `RAINBOW_SAND` with a fresh `hues[i]` start value; leave `RAINBOW_SAND`, `OBJECT`, and `EMPTY` zone cells untouched (depends on T009; contracts/sim-core.md `objects.ts` section, FR-014–FR-018)
- [ ] T013 [US1] Wire `PlayArea.svelte`'s per-frame loop to call `applyRainbowConversions(grid, objectsState.rainbows)` immediately after `step(grid)` (research.md §5, contracts/sim-core.md Consumers section) (depends on T012)
- [ ] T014 [US1] In `PlayArea.svelte`'s render pass, colorize `RAINBOW_SAND` cells from `hues[i]` via HSL→RGB at a fixed saturation/lightness instead of a fixed color ramp, so a settled heap shows at least 6 distinguishable hues (research.md §7, FR-020, FR-021, SC-006) (depends on T007)

**Checkpoint**: At this point, placing a rainbow and pouring pink sand/water/purple dirt onto it produces shimmering rainbow sand that piles like ordinary sand — User Story 1 is independently functional. Note: placing the rainbow object itself and the 🌈 toolbar button are delivered by later tasks in this phase's dependency chain — see T017/T023 below, required for this story's own acceptance scenarios to be manually verifiable end-to-end.

- [ ] T015 [US1] Implement `placeObject(grid, state, kind, cx, cy)` in `src/sim/objects.ts`: nudge `(cx, cy)` so the `OBJECT_FOOTPRINT_SIZE × OBJECT_FOOTPRINT_SIZE` footprint fits entirely on-grid (FR-004); if the target kind's list is already at length 3, remove the oldest (index 0) first; stamp every footprint cell's element to `OBJECT`, discarding whatever was there; append a new `PlacedObject` with a fresh `id` (depends on T002, T008, T009; contracts/sim-core.md `placeObject`, FR-002, FR-004, FR-005, FR-006)
- [ ] T016 [US1] Implement `removeObject(grid, state, obj)` in `src/sim/objects.ts`: remove `obj` from its list; for each footprint cell, set it back to `EMPTY` unless another remaining object still covers that cell (depends on T015; contracts/sim-core.md `removeObject`, FR-012)
- [ ] T017 [P] [US1] Test `placeObject`/`removeObject` in `tests/unit/sim/objects.test.ts`: placing clears any element occupying the new footprint; the per-type cap of 3 evicts the oldest object of that type and never refuses a new placement; reaching one type's cap does not affect the other type's count; removing an object whose footprint overlaps a surviving object leaves the shared cells as `OBJECT` (depends on T015, T016; FR-005, FR-006, FR-012, data-model.md ObjectsState)
- [ ] T018 [US1] Add 🌈 to the `Tool` selection in `src/lib/Toolbar.svelte` as a large round emoji-labeled button (depends on T002; FR-001, FR-034)
- [ ] T019 [US1] In `PlayArea.svelte`'s `handlePointerDown`, branch object tools (`'rainbow'`, `'unicorn'`) to call `placeObject` once and skip setting `drawing = true`, so `handlePointerMove`'s existing `if (!drawing) return` guard prevents any repeat placement on drag (depends on T015, T018; research.md §8, FR-002)
- [ ] T020 [US1] In `PlayArea.svelte`'s render pass, draw each `PlacedObject`'s emoji glyph (`🌈` for rainbows) via `ctx.fillText` centered on its footprint's pixel bounds, after the `putImageData` element pass, treating `OBJECT` cells as background for the pixel fill (depends on T015, T019; research.md §7)

**Checkpoint**: User Story 1 fully functional and independently testable — placing rainbows (up to cap 3, oldest rolls off) and pouring sand/water/dirt through them produces shimmering, piling rainbow sand.

---

## Phase 4: User Story 2 - Place a unicorn and delight it (Priority: P2)

**Goal**: Placing a 🦄 makes it emit a sparkle/heart celebration when touched by any element, plus occasional idle sparkles, all purely decorative.

**Independent Test**: Place a unicorn, pour sand onto it, and confirm a sparkle-and-heart burst appears and floats up and fades; then leave it alone and confirm occasional idle sparkles. The touch trigger is verifiable in automated tests against grid state; particle visuals are manual/visual checks (FR-037, spec's Visual checks section).

### Tests for User Story 2 (required by FR-037) ⚠️

- [ ] T021 [P] [US2] Test `isUnicornTouched` in `tests/unit/sim/objects.test.ts`: returns `true` when any zone cell holds `SAND`/`WATER`/`DIRT`/`RAINBOW_SAND`, `false` when every zone cell is `EMPTY` or `OBJECT`; multiple unicorns are evaluated independently (FR-023, contracts/sim-core.md `isUnicornTouched`)

### Implementation for User Story 2

- [ ] T022 [US2] Implement `isUnicornTouched(grid, unicorn)` in `src/sim/objects.ts` using the `forEachZoneCell` helper from T009: returns `true` if any zone cell's element is neither `EMPTY` nor `OBJECT` (depends on T009; contracts/sim-core.md `isUnicornTouched`, FR-023)
- [ ] T023 [US2] Add 🦄 to the `Tool` selection in `src/lib/Toolbar.svelte` as a large round emoji-labeled button, alongside 🌈 within the 10-control cap (depends on T002; FR-001, FR-034)
- [ ] T024 [US2] Extend `PlayArea.svelte`'s `handlePointerDown` object-tool branch (from T019) to also handle `'unicorn'`, calling `placeObject(grid, objectsState, 'unicorn', ...)` once per press (depends on T015, T019, T023; FR-002)
- [ ] T025 [US2] In `PlayArea.svelte`'s render pass, draw each unicorn `PlacedObject`'s `🦄` glyph the same way rainbows are drawn (depends on T020, T024; research.md §7)
- [ ] T026 [US2] Create `src/lib/particles.ts` (new, DOM-free) with the `Particle` interface (`glyph`, `x`, `y`, `spawnedAt`) and `spawnBurst(particles, atX, atY, now)`, `spawnIdleSparkle(particles, atX, atY, now)`, `tickParticles(particles, now)` — `tickParticles` advances position, drops expired particles, and enforces a documented cap by dropping new spawns or retiring the oldest (contracts/sim-core.md `particles.ts` section, FR-026, FR-027, FR-028)
- [ ] T027 [US2] Wire `PlayArea.svelte`'s per-frame loop to call, for each unicorn, `isUnicornTouched(grid, unicorn)` to decide whether to `spawnBurst` (rate-limited per FR-024), an idle-sparkle interval timer calling `spawnIdleSparkle` (FR-025, at least once every 5s per SC-010), then `tickParticles`, using `performance.now()` (depends on T022, T026; research.md §10, contracts/sim-core.md Consumers section)
- [ ] T028 [US2] In `PlayArea.svelte`'s render pass, draw live particles as fading emoji glyphs (`ctx.fillText`) after object glyphs (depends on T026, T027; FR-029)

**Checkpoint**: User Stories 1 AND 2 both work independently — unicorns celebrate on touch and idle-sparkle, with particles purely decorative and capped.

---

## Phase 5: User Story 3 - Objects are solid ground (Priority: P2)

**Goal**: Falling grains and flowing water land on top of objects and slide off their shoulders instead of passing through; objects never fall or move once placed.

**Independent Test**: Place an object in mid-air, pour sand onto it, and confirm the grains rest on top and form a pile rather than passing through — fully verifiable in automated tests against grid state, no browser.

### Tests for User Story 3 (required by FR-037) ⚠️

- [ ] T029 [P] [US3] Extend `tests/unit/sim/step.test.ts`: a falling powder grain stops directly above an `OBJECT` footprint cell instead of entering it, including the case where the grain is blocked on all sides by `OBJECT`/other powders (rests in place, is not destroyed or teleported) — the specific case SC-016 names; a grain resting on an object's shoulder with empty space diagonally below slides off exactly as it would off a powder pile; water resting on an object spreads sideways off it rather than passing through (FR-009, FR-010, FR-011, data-model.md Cell section)
- [ ] T030 [P] [US3] Test in `tests/unit/sim/objects.test.ts`: `placeObject` clears any element occupying the new footprint (FR-006); an object's `x`/`y` remain unchanged across any number of subsequent `step()` calls, including after the elements beneath it are cleared to `EMPTY` (FR-007, SC-020)

### Implementation for User Story 3

- [ ] T031 [US3] Verify (and adjust if needed) that `step.ts`'s existing fall/sink/slide/liquid-spread target checks (`elements[...] === EMPTY`, `isLiquid(elements[...])`) already exclude `OBJECT` with no code change, per research.md §1 — this task is a verification/regression-closing pass driven by the T029 tests going green, not new logic (depends on T029; FR-009, FR-010, FR-011)
- [ ] T032 [US3] Confirm `placeObject` (T015) already clears the footprint from whatever it previously held and that objects are never touched by `step()`'s dispatch (`isPowder`/`isLiquid` both false for `OBJECT`) — close out any gaps found by the T030 tests (depends on T015, T030; FR-006, FR-007)

**Checkpoint**: All three user stories (1–3) are independently functional — objects are solid, elements pile on and slide off them, and objects never move once placed.

---

## Phase 6: User Story 4 - Erase and clear objects (Priority: P3)

**Goal**: The eraser removes whole objects it touches; clear-all removes every element, object, and particle.

**Independent Test**: Place a rainbow and a unicorn, drag the eraser over each, and confirm both disappear; then place several again and tap clear-all and confirm the play area is completely empty.

### Tests for User Story 4 (required by FR-037) ⚠️

- [ ] T033 [P] [US4] Test `eraseObjectsInBrush` in `tests/unit/sim/objects.test.ts`: a brush touching any part of an object's footprint removes the whole object (none of its cells survive), and objects entirely outside the brush's coverage are untouched (FR-031, contracts/sim-core.md `eraseObjectsInBrush`)
- [ ] T034 [P] [US4] Test `clearObjects` in `tests/unit/sim/objects.test.ts`: resets both `rainbows` and `unicorns` lists to empty without touching `grid` (FR-032, contracts/sim-core.md `clearObjects`)

### Implementation for User Story 4

- [ ] T035 [US4] Implement `eraseObjectsInBrush(grid, state, cx, cy, radius)` in `src/sim/objects.ts`: for every object in `state.rainbows`/`state.unicorns`, check whether any footprint cell lies within the brush's circular coverage (reusing `brush.ts`'s footprint-math predicate) and, if so, call `removeObject` for that object in full (depends on T016; contracts/sim-core.md `eraseObjectsInBrush`, FR-031)
- [ ] T036 [US4] Implement `clearObjects(state)` in `src/sim/objects.ts`: sets `state.rainbows = []` and `state.unicorns = []` without touching `grid` (contracts/sim-core.md `clearObjects`, FR-032)
- [ ] T037 [US4] Wire `PlayArea.svelte` to call `eraseObjectsInBrush(grid, objectsState, cx, cy, radius)` immediately before the existing `applyBrush(grid, 'eraser', ...)` call whenever `tool === 'eraser'` (depends on T035; research.md §9, FR-031)
- [ ] T038 [US4] Wire the clear-all control in `App.svelte`/`PlayArea.svelte` to call `clearObjects(objectsState)` alongside the existing `clearGrid(grid)` call, and to clear the live particles array, without changing the selected tool or brush size (depends on T036, T026; FR-032, FR-035)

**Checkpoint**: All four user stories are independently functional — objects can be placed, converted through, celebrated with, built on, erased individually, and cleared entirely.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation that the whole feature meets its cross-cutting requirements (regression safety, toolbar cap, performance, offline build).

- [ ] T039 [P] Run the full `npm test` suite and confirm every test carried over from `001-falling-pink-sand` and `002-water-and-purple-dirt` still passes unmodified, except where a test literal constructs a `Grid` directly and now needs the `hues` field (FR-036, SC-013)
- [ ] T040 [P] Confirm the toolbar (`src/lib/Toolbar.svelte`) has at most 10 controls total (3 element brushes + eraser + clear-all + brush sizes + 🌈 + 🦄), each remaining large, round, emoji-labeled, and finger-sized on a tablet (FR-001, FR-034, superseded-requirements toolbar cap)
- [ ] T041 Run `npm run build`, confirm `dist/` contains exactly one file (`dist/index.html`), and confirm it plays fully when opened directly via `file://` with zero network requests (FR-038, SC-017)
- [ ] T042 Perform the manual performance check from quickstart.md: on a mid-range laptop and a tablet, with 3 rainbows, 3 unicorns, particles at their cap, and the play area at least half full of a mixture of all elements including shimmering rainbow sand, confirm ≥30fps sustained, targeting 60fps (SC-012, FR-030)
- [ ] T043 Perform the manual "Visual checks for the maintainer" pass from spec.md and quickstart.md: legibility of the 🌈/🦄 glyphs at default size, the shimmer-to-freeze transition looking natural, rainbow-sand heaps reading as stripes, the unicorn's celebration and idle twinkle feeling gentle and not distracting, objects floating in mid-air looking like a deliberate shelf, and piles resting visibly on top of objects

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — run first.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories (types/grid/hues/objects-state constructor and zone helper are required by every later phase).
- **User Story 1 (Phase 3)**: Depends on Foundational. No dependency on other stories.
- **User Story 2 (Phase 4)**: Depends on Foundational. Reuses `placeObject`/object rendering built in Phase 3 (T015, T019, T020) for its own object-tool wiring (T024, T025) — implement Phase 3 first for a straight run, though the two stories' *own* mechanics (conversion vs. celebration) are independent of each other.
- **User Story 3 (Phase 5)**: Depends on Foundational and on `placeObject`/`removeObject` (T015/T016 from Phase 3). Independently testable once those exist — does not depend on rainbow conversion or unicorn celebration logic.
- **User Story 4 (Phase 6)**: Depends on Foundational and on `removeObject` (T016 from Phase 3) and the particles array (T026 from Phase 4, for clearing particles on clear-all).
- **Polish (Phase 7)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — no dependency on other stories' *behavior*, though it is also where `placeObject`/`removeObject`/object rendering/pointer-wiring are first built (shared plumbing other stories reuse).
- **User Story 2 (P2)**: Can start after Foundational — its own celebration/particle logic is independent of rainbow conversion, but reuses the object-placement plumbing from US1.
- **User Story 3 (P2)**: Can start after Foundational and after `placeObject`/`removeObject` exist — independently testable via `step.ts`/`objects.test.ts` alone, no UI dependency.
- **User Story 4 (P3)**: Can start after Foundational and after `removeObject` exists — depends on there being objects to erase, which is why it is last.

### Within Each User Story

- Tests (required by FR-037 for the rules it lists) are written before their corresponding implementation task and must fail first.
- Sim-core (`src/sim/*`) changes precede UI-layer (`src/lib/*`) wiring that calls them.
- Story complete before moving to next priority, but stories may proceed in parallel by different developers once Foundational is done, per the dependency notes above.

### Parallel Opportunities

- T004, T005 (element.ts, grid.ts) can run in parallel — different files, both depend only on T002/T003.
- T006 can run in parallel with T007 — different files.
- Within US1: T010 and T011 (different test files) can run in parallel.
- Within US3: T029 and T030 (different test files) can run in parallel.
- Within US4: T033 and T034 (same file, different functions — sequence if working solo, parallel if two people).
- T039 and T040 in Polish can run in parallel — independent checks.
- Across stories: once Foundational and US1's plumbing (T015/T016/T019/T020) exist, US2's celebration logic (T021-T022, T026) and US3's solidity tests (T029-T032) have no code dependency on each other and can be built in parallel by different developers.

---

## Parallel Example: User Story 1

```bash
# Launch both test-writing tasks for User Story 1 together:
Task: "Test applyRainbowConversions in tests/unit/sim/objects.test.ts"
Task: "Extend tests/unit/sim/step.test.ts for RAINBOW_SAND movement parity and hue freeze/advance"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (rainbow + rainbow sand, including the shared `placeObject`/`removeObject`/object-rendering/pointer-wiring plumbing)
4. **STOP and VALIDATE**: Place a rainbow, pour pink sand through it, confirm rainbow sand shimmers and piles correctly
5. Deploy/demo if ready — this alone gives the child a brand-new magical toy on top of existing sand

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo (unicorn joy)
4. Add User Story 3 → Test independently → Deploy/Demo (solidity — closes any gap where objects feel like stickers rather than things)
5. Add User Story 4 → Test independently → Deploy/Demo (erase/clear — keeps the play area from filling up permanently)

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. One developer completes User Story 1 first (it builds the shared `placeObject`/`removeObject`/rendering/pointer plumbing every other story reuses)
3. Once US1's plumbing lands:
   - Developer A: User Story 2 (celebration/particles)
   - Developer B: User Story 3 (solidity tests/verification)
   - Developer C: User Story 4 (erase/clear), once `removeObject` and the particles array exist
4. Stories complete and integrate independently
