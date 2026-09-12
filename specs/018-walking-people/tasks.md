---

description: "Task list for feature implementation"
---

# Tasks: People Who Stand, Walk, And Run

**Input**: Design documents from `/specs/018-walking-people/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/sim-and-shell-contracts.md, quickstart.md

**Tests**: This feature explicitly requires unit tests (FR-031, constitution Principle V — no DOM/browser harness). Test tasks are included throughout, not optional.

**Organization**: Tasks are grouped by user story so each story can be implemented and independently validated. All six user stories in spec.md are Priority P1/P1/P1/P1/P2/P2 — Setup and Foundational phases below are shared prerequisites; User Stories 1–4 (all P1) form the MVP together (see Implementation Strategy).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US6)
- File paths are exact — every one is confirmed against the current repository (research.md, contracts).

## Path Conventions

Single project. Simulation core: `src/sim/*` (framework-free, vitest-only). UI/shell: `src/lib/*`, `src/App.svelte`. Tests: `tests/unit/**`.

---

## Phase 1: Setup

**Purpose**: No project scaffolding is needed — every touched file already exists except one. This phase just creates that one new file's skeleton so later phases have somewhere to add to.

- [X] T001 Create `src/lib/personGlyphs.ts` with the module doc comment and the exported types `PersonFrame`, `GlyphProbeInputs`, `PersonPictureSet` from contracts/sim-and-shell-contracts.md §`src/lib/personGlyphs.ts` (no implementation yet — just the shapes, so Phase 2/3 tasks have a file to add functions to)

**Checkpoint**: New file exists with its public types; nothing else touched yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The glyph probe and the `Person`/`PetsState` shape are shared by every user story below — none of US1–US6 can be implemented, let alone tested, without them.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] In `src/lib/personGlyphs.ts`, implement `resolvePersonPictureSet(probe: GlyphProbeInputs): PersonPictureSet` per research.md §§1–3: the 9-glyph literal table (🧍/🧍‍♂️/🧍‍♀️, 🚶/🚶‍♂️/🚶‍♀️, 🏃/🏃‍♂️/🏃‍♀️), per-glyph try/catch so one glyph's probe failure degrades only that glyph, the all-or-nothing gendered→neutral rung (tofu OR split-width ≥1.5× disqualifies the whole gendered family), the per-family standing→walking fallback (`pictures[v].standing === pictures[v].walking` whenever standing is tofu for that family), `canRunPicture` set false (not substituted) when running is tofu, and `toolbarGlyph = pictures.neutral.standing` after fallback. Also add `WALK_GLYPH_NATIVE_FACING: 1 | -1` (initial value `1`, flagged in quickstart.md for maintainer correction) and `createCanvasGlyphProbe(canvas: HTMLCanvasElement): GlyphProbeInputs` (off-screen 2D context, `canRender` compares glyph metrics/pixels against a known-unassigned codepoint, `measureWidth` calls `ctx.measureText(text).width`)
- [X] T003 [P] Add `tests/unit/lib/personGlyphs.test.ts` covering FR-018's required cases with fabricated `GlyphProbeInputs`: everything supported (drawableVariants has all 3, canRunPicture true, toolbarGlyph is 🧍), standing missing (idle falls back to walking, per-family), running missing (canRunPicture false, no substitution glyph), gendered forms splitting (measureWidth ≈ 2×, drawableVariants = ['neutral'] only), nothing supported (safest known-drawable set, never empty), and a measurer/renderer that throws or returns nonsense for one glyph (only that glyph's rung degrades); also assert `toolbarGlyph === pictures.neutral.standing` in every case (FR-015)
- [X] T004 In `src/sim/types.ts`, remove `'person'` from `ObjectKind`'s union (keep `'person'` in `Tool`) and add `export type PersonVariant = 'neutral' | 'man' | 'woman';`
- [X] T005 In `src/sim/objects.ts`, remove `'person'` from `OBJECT_KINDS` and from `createObjectsState`'s `byKind` initializer (now 6 entries)
- [X] T006 [P] In `src/sim/pets.ts`, add `PersonState = 'standing' | 'walking' | 'running'`, the `Person` interface, and extend `PetsState` with `people: Person[]` and `personVariantBag: PersonVariant[]`, plus `export const PERSON_CAP = 3` and the new tuning constants named in research.md §6 (`PERSON_PAUSE_FRAMES`, `PERSON_WALK_BURST_FRAMES`, `PERSON_STEP_INTERVAL`, `PERSON_ROAM_RANGE`, `PERSON_RUN_DURATION`) — exact shapes from data-model.md's Person/PetsState — and update `createPetsState()` to initialize `people: []`, `personVariantBag: []`
- [X] T007 In `src/sim/pets.ts`, export the ledge-step/turn-around and dig-out primitives `stepPoodle` currently uses privately (`groundBelow`, the `MAX_CLIMB` check, the buried/dig-out branch) — or factor the minimal shared pieces into standalone functions `groundBelow`/`stepUpOrTurnAround`/`digOutOneScoop` callable from both `stepPoodle` and the new `stepPerson` (T012) — per research.md §5's "reuse unmodified, do not fork". Re-run `tests/unit/sim/pets.test.ts`'s existing poodle suite to confirm no behavior change from the refactor.
- [X] T008 [P] In `src/sim/pets.ts`, implement `pickPersonVariant(state: PetsState, drawableVariants: readonly PersonVariant[], rng: () => number): PersonVariant` per research.md §4 and data-model.md's Variant picker: Fisher-Yates-shuffle `drawableVariants` into `state.personVariantBag` via the injected `rng` whenever the bag is empty, then pop one
- [X] T009 [P] Add `tests/unit/sim/pets.test.ts` (or a new `tests/unit/sim/person.test.ts` — pick one and use it for every US1/US2/US5 test below) coverage for `pickPersonVariant`: seeded `rng`, `drawableVariants = ['neutral','man','woman']` → 3 consecutive calls yield all 3 in a seed-determined order (FR-013a, SC-005a); `drawableVariants = ['neutral']` → every call returns `'neutral'`, no special-casing needed
- [X] T010 In `src/sim/history.ts`, add `people: { x: number; y: number; variant: PersonVariant }[]` to `WorldState`; update `captureWorldState` to populate it from `pets.people` and `restoreWorldState` to call `restorePeopleFromPositions(pets, state.people)` (T013), mirroring the existing `mermaids` field exactly (contracts/sim-and-shell-contracts.md `src/sim/history.ts`); update `worldMatches`/`remapWorldState` to compare/clamp `people` the same way `mermaids` is compared/clamped, never causing a rejection

**Checkpoint**: Foundation ready — `Person`/`PetsState`/`PersonPictureSet`/`ObjectKind` shapes exist and compile; user story implementation can now begin.

---

## Phase 3: User Story 1 - People who stroll around her world (Priority: P1) 🎯 MVP

**Goal**: A person placed on the canvas settles onto a surface, then strolls on her own — alternating short walks with pauses, staying on solid ground, stepping up small ledges, turning at tall walls and the grid edge, ignoring the child's finger, capped at 3 with oldest eviction, never solidifying her own cell.

**Independent Test**: Build a grid with hills, place people, advance the sim a few hundred frames, and assert each person is always standing on a solid surface or the floor, always inside the grid, that her position changes over time, that her frame is "walking" exactly on frames she moves and "standing" when paused, and that her facing matches her direction of travel; assert a finger target moves poodles and never people.

### Implementation for User Story 1

- [X] T011 [P] [US1] In `src/sim/pets.ts`, implement `addPerson(grid, state, x, y, drawableVariants, rng)` per contracts: evict oldest at `PERSON_CAP` (mirrors `addPoodle`), settle via `groundBelow`, initial `state: 'standing'`, `timer: PERSON_PAUSE_FRAMES`, `variant` from `pickPersonVariant`, `homeX = x`, `wanderDir: 1`
- [X] T012 [US1] In `src/sim/pets.ts`, implement `stepPerson(grid, person, stride)` (no `target` parameter — FR-006): buried dig-out (reuse T007), `groundBelow` settle every frame regardless of state, then the two-phase cadence from research.md §6 — `'standing'` counts down `timer` to 0 then flips to `'walking'` (`timer = PERSON_WALK_BURST_FRAMES`, pick `wanderDir`); `'walking'` counts down `timer`, attempts one cell-step on the `person.id % PERSON_STEP_INTERVAL === stride % PERSON_STEP_INTERVAL` stagger (turning around in place, not ending the burst, if the destination is blocked by a wall taller than `MAX_CLIMB` or the roam range/grid edge), flips to `'standing'` at `timer === 0`; sets `facing = wanderDir` while walking
- [X] T013 [US1] In `src/sim/pets.ts`, implement `stepPeople(grid, state: PetsState): void` iterating `state.people` calling `stepPerson`, and export `restorePeopleFromPositions(state, positions: readonly {x,y,variant}[])` rebuilding `state.people` wholesale as fresh `state: 'standing'`, `timer: 0` people (mirrors `restoreMermaidsFromPositions` exactly, variant carried verbatim per FR-012/FR-023)
- [X] T014 [US1] In `src/sim/pets.ts`, wire `stepPeople(grid, pets)` into `stepPets(grid, pets, target)` (after the existing poodle/mermaid stepping, unaffected by `target`) and update `clearPets` to also empty `state.people`
- [X] T015 [US1] In `src/sim/pets.ts`, implement `repositionPeople(people: Person[], newGrid: Grid, offsetX: number, offsetY: number): void` mirroring `repositionPoodles`/`repositionMermaids` exactly — shift, clamp in-bounds, never dropped, re-anchor `homeX` to the shifted `x`
- [X] T016 [US1] In `tests/unit/sim/pets.test.ts` (or `person.test.ts`), add: `addPerson` settles onto a solid surface on hills/flat ground/mid-air/water (US1 Acceptance Scenario 1, FR-004); running `stepPeople` hundreds of frames with no poke visits both `'standing'` and `'walking'`, position changes over time, and never strays more than `PERSON_ROAM_RANGE` from her settle point (SC-002, FR-005); `facing` matches `wanderDir` while walking and the drawn frame is `'walking'` exactly on move frames and `'standing'` when paused (US1 Acceptance Scenario 3); a 1–2 cell step is mounted and a taller wall causes a turn-around, never a climb/clip (US1 Acceptance Scenario 4, FR-004)
- [X] T017 [US1] In `tests/unit/sim/pets.test.ts`, add: cap of 3 — placing a 4th evicts the oldest (FR-003); `stepPets(grid, pets, target)` with a non-null `target` never influences any person's position while a poodle's is influenced (US1 Acceptance Scenario 6, FR-006); buried (SAND/GUMDROP), airborne, and off-grid (`x = 0`/`width - 1`) placements each recover onto a surface inside the grid within a small bounded frame count (SC-001, FR-007)
- [X] T018 [US1] In `tests/unit/sim/pets.test.ts` (and/or `brush.test.ts`), add: pouring `SAND` onto a person's cell via `applyBrush` leaves the cell's element unaffected by her presence — no grid write comes from `Person` at all (US1 Acceptance Scenario 7, FR-009)
- [X] T019 [US1] Add a 2,000-frame adversarial-terrain stress test in `tests/unit/sim/pets.test.ts` mirroring spec 016's stress test (hills, ledges, walls, pits, sand poured on her, ground erased from under her): assert 0 stuck states — never outside the grid, never inside solid material for longer than a short bounded interval, always resumes strolling (SC-001)

**Checkpoint**: A person placed via `addPerson` strolls correctly in isolation — testable and demoable without wiring to the Svelte shell yet.

---

## Phase 4: User Story 2 - The same person in every frame (Priority: P1)

**Goal**: Each walker keeps one variant (neutral/man/woman) for her whole life — across every frame, save/restore, and undo/redo — and frame selection is a pure function of state, variant, and the resolved picture set.

**Independent Test**: Table-test every `(variant, state)` combination against a fabricated `PersonPictureSet` and assert the exact picture returned; assert variant is unchanged after hundreds of simulated frames and after a save/restore round trip; drive the variant picker with seeded randomness and assert no repeat until every drawable variant has been used, on a font that draws all three and one that draws only neutral.

### Implementation for User Story 2

- [X] T020 [P] [US2] In `src/lib/personGlyphs.ts` (or `src/sim/pets.ts`, whichever the resolver naturally lives beside — keep it a pure function with no DOM), add a `frameFor`/picture-lookup helper: given `(pictureSet: PersonPictureSet, variant: PersonVariant, state: PersonState)`, returns `pictureSet.pictures[variant][state]` (state *is* frame, data-model.md) — this is the function both the render loop (T031) and its tests call
- [X] T021 [US2] In `tests/unit/sim/pets.test.ts` or `tests/unit/lib/personGlyphs.test.ts`, table-test the frame-selection helper across every `(variant, state)` combination against a fabricated `PersonPictureSet`, asserting the exact picture returned (US2 Acceptance Scenario 1, FR-010)
- [ ] T022 [US2] In `tests/unit/sim/pets.test.ts`, assert `variant` is unchanged on a `Person` after `addPerson`, hundreds of frames of `stepPeople`, and a `pokePersonAt` reaction (US2 Acceptance Scenario 1, FR-012) — `variant` is `readonly`, so this is really "nothing ever reassigns the field", confirmed by a `tsc` compile check as well as runtime behavior (partially done: addPerson + hundreds of frames covered now; the `pokePersonAt` reaction assertion is added in Phase 7 once that function exists)
- [X] T023 [US2] In `tests/unit/sim/save.test.ts`, place people of each variant, round-trip through `serializeWorld`/`deserializeWorld`, assert variant unchanged for each (US2 Acceptance Scenario 4, FR-023) — depends on T025/T026 (save.ts's `people` field) below being implemented first, so schedule after Phase 6's save tasks or stub against `restorePeopleFromPositions` directly if run standalone
- [X] T024 [US2] In `tests/unit/sim/history.test.ts`, place people of each variant, round-trip through `HistoryManager.undo`/`redo`, assert variant unchanged (US2 Acceptance Scenario 4, FR-024) — depends on T010 (history.ts's `people` field)

**Checkpoint**: Frame/variant selection is proven correct in isolation; US1+US2 together give a strolling, visually-stable person.

---

## Phase 5: User Story 3 - Never a broken picture (Priority: P1)

**Goal**: The person button and the people on the canvas are always a recognisable person on every device — the glyph probe (built in Foundational, T002/T003) is wired to be the single source of truth for both, resolved once per session.

**Independent Test**: Already covered at the unit level by T003 (the probe itself). This phase's remaining work is wiring the resolved `PersonPictureSet` through `App.svelte` to both `Toolbar.svelte` and `PlayArea.svelte` so the button and the canvas never disagree (FR-015), and confirming the probe runs exactly once.

### Implementation for User Story 3

- [~] T025 [US3] In `src/App.svelte`, compute `personPictureSet = resolvePersonPictureSet(createCanvasGlyphProbe(canvas))` exactly once at startup (FR-020) — a plain `const`/`$state` computed before `<PlayArea>`/`<Toolbar>` render, not inside a reactive block that could re-run — and pass it as a prop to both `<PlayArea>` and `<Toolbar>` (done: computed once via a throwaway off-screen canvas and passed to `<Toolbar>`; the `<PlayArea>` prop is wired in Phase 7 alongside T038, where it is first consumed, so it isn't left as an unused prop in the meantime)
- [X] T026 [US3] In `src/lib/Toolbar.svelte`, add `export let personPictureSet: PersonPictureSet;` prop and change `glyphFor`'s `case 'tool-person':` (currently `return '🧑';`, Toolbar.svelte:133-134) to `return personPictureSet.toolbarGlyph;`
- [X] T027 [US3] In `tests/unit/shell/toolbarGlyphs.test.ts`, delete the `describe('person is 🧑, never the gender-neutral standing-person glyph (FR-005)', ...)` block (lines ~50-54, source-text-grep against the old literal) entirely per research.md §11 — its coverage moves to T003's `resolvePersonPictureSet` assertions, not a weakened test (FR-029)
- [X] T028 [US3] Confirm (code review, not a new test — quickstart.md notes probe-call-count has no DOM harness to observe) that `resolvePersonPictureSet`/`createCanvasGlyphProbe` is called at exactly one call site (T025) and its result is threaded as a value/prop everywhere else, never recomputed per person or per frame (FR-020)

**Checkpoint**: Toolbar button and canvas figures share one resolved picture set; a device with no standing/gendered support degrades gracefully everywhere.

---

## Phase 6: User Story 4 - The people she already has are not lost (Priority: P1)

**Goal**: An old save or old stored undo history with people in the previous placed-object shape (`byKind.person`) migrates into walkers at the same positions, releasing their old footprint cells, without bumping either save-format version.

**Independent Test**: Feed the restore paths a saved world and a saved undo history written in the old shape and assert restore succeeds, people come back as walkers at the same positions, old footprint cells are not left as invisible solid blocks, and every other object kind is untouched; repeat with a save that has neither shape, and with a malformed walker list.

### Implementation for User Story 4

- [X] T029 [US4] In `src/sim/objects.ts`, implement `migrateLegacyPersonObjects(grid: Grid, objects: ObjectsState, rawPersonList: readonly PlacedObject[]): { x: number; y: number }[]` per research.md §8 and the contracts doc: for each old person object, compute the footprint-center anchor (`x + size/2, y + size/2`, rounded) and clear every footprint cell to `EMPTY` unless still covered by a surviving object of another kind (replicate `isCoveredByAnyObject`'s check inline against the current, person-less `OBJECT_KINDS` — do not call `removeObject`, which requires a live `ObjectKind`)
- [X] T030 [US4] In `tests/unit/sim/objects.test.ts`, add: `migrateLegacyPersonObjects` on a grid with `OBJECT` cells stamped at a person's old footprint returns the correct center position and clears those cells to `EMPTY` (US4 Acceptance Scenario 2, FR-027); repeat with a surviving rainbow/unicorn/etc. object still covering part of the footprint and assert those specific cells stay solid (FR-027's "unless another surviving object still covers them")
- [X] T031 [US4] In `src/sim/save.ts`: add `WirePerson = { x: number; y: number; variant: PersonVariant }` and `people?: WirePerson[]` to the wire shape and `people: {x,y,variant}[]` to `SavedWorld`; add `parsePeople` structurally identical to `parseMermaids` (missing/non-array/any malformed entry → whole list defaults to `[]`); in `deserializeWorld`, additionally read `rawByKind.person` (if present) through `migrateLegacyPersonObjects`, merge with the parsed `people` list, cap to `PERSON_CAP` (oldest-first eviction, matching `list.shift()` semantics); update `serializeWorld` to emit `people` from `pets.people`. **Do not bump `SAVE_VERSION`.**
- [X] T032 [US4] In `src/sim/historySave.ts`: mirror T031 exactly for `WireHistoryStep`'s `people?` field and `deserializeHistory`'s per-step legacy-read + migration + cap. **Do not bump `HISTORY_SAVE_VERSION`.**
- [X] T033 [US4] In `tests/unit/sim/save.test.ts`, add: `deserializeWorld` fed a payload shaped like a pre-feature save (`byKind.person` present, no `people` key) produces a people list with one entry at the footprint's center, `variant: 'neutral'` (US4 Acceptance Scenario 1, FR-026); a payload with `people` absent, `null`, or containing a malformed entry still restores the rest of the world with `people` defaulting to `[]` and no thrown error (US4 Acceptance Scenario 4, FR-025); a payload with 3 `byKind.person` entries plus 3 poodles plus 3 mermaids never produces more than 3 people and leaves the other pets untouched (Edge Cases); `SAVE_VERSION`'s value is unchanged from before this feature (FR-025)
- [X] T034 [US4] In `tests/unit/sim/historySave.test.ts`, add the historySave-layer counterparts of T033: legacy step migrates people into walkers (US4 Acceptance Scenario 3, FR-026), missing/malformed `people` field defaults to `[]` (FR-025), `HISTORY_SAVE_VERSION` unchanged (FR-025)
- [X] T035 [US4] In `tests/unit/sim/history.test.ts`, assert `restoreWorldState`/`captureWorldState` round-trip `people` correctly (depends on T010) and that a stored history step written in the old placed-object shape is carried over as walkers when replayed through the deserialization path from T032 (US4 Acceptance Scenario 3)

**Checkpoint**: A save or undo history from before this feature restores with people intact as walkers, no invisible walls left behind, and no version bump — the sharpest regression risk in the feature is closed.

---

## Phase 7: User Story 5 - Poke a person and she runs (Priority: P2)

**Goal**: Tapping directly on a person makes her run briefly (or hop in place, if the running picture is undrawable) and then resume strolling; tapping elsewhere just paints; the eraser still erases her instead of poking.

**Independent Test**: Poke a person's cell and assert she enters the running state for a bounded number of frames then returns to strolling; poke away from her and assert nothing changes; poke with the eraser selected and assert she is erased instead; with a probe result reporting no running picture, assert the poke still produces a bounded hop-in-place reaction.

### Implementation for User Story 5

- [ ] T036 [US5] In `src/sim/pets.ts`, implement `pokePersonAt(pets: PetsState, x: number, y: number): boolean` byte-for-byte mirroring `pokePoodleAt`/`pokeMermaidAt` (nearest within `POKE_RADIUS`, `timer === 0` gate, sets `state = 'running'`, `timer = PERSON_RUN_DURATION`); on `timer` reaching 0 in `stepPerson` (T012) from `'running'`, return to `'standing'` with `timer = PERSON_PAUSE_FRAMES` (fresh pause, not mid-burst, per data-model.md's state-transition table)
- [ ] T037 [US5] In `src/lib/PlayArea.svelte`'s `handlePointerDown`, add `pokePersonAt(petsState, pos.x, pos.y)` to the existing poke-check chain (alongside `pokePoodleAt`/`pokeMermaidAt`, PlayArea.svelte:762-771) inside the `if (tool !== 'eraser')` gate, before the batched-object-placement branch; remove `'person'` from that branch's tool list (PlayArea.svelte:798-806) and add a new `if (tool === 'person') { addPerson(grid, petsState, pos.x, pos.y, personPictureSet.drawableVariants, Math.random); canvas.setPointerCapture(event.pointerId); return; }` branch alongside the existing `tool === 'poodle'`/`tool === 'mermaid'` branches
- [ ] T038 [US5] In `src/lib/PlayArea.svelte`, add `export let personPictureSet: PersonPictureSet;` prop (populated from T025's `App.svelte` wiring)
- [ ] T039 [US5] In `tests/unit/sim/pets.test.ts`, add: `pokePersonAt` at her position sets `state === 'running'`, and after `PERSON_RUN_DURATION` frames she's back to `'standing'` (US5 Acceptance Scenario 1, FR-016); a second `pokePersonAt` while `timer > 0` is ignored — no change to `timer`/`state` (US5 Acceptance Scenario 2, FR-016); `pokePersonAt` at a point with no person nearby returns `false` and changes nothing
- [ ] T040 [US5] In `tests/unit/sim/pets.test.ts` or `tests/unit/lib/personGlyphs.test.ts`, add: with a fabricated `PersonPictureSet` where `canRunPicture: false`, the sim state still transitions to `'running'` on poke (a reaction always happens at the state level — FR-016a) — the hop-vs-glyph rendering choice is a `PlayArea.svelte` concern (T041), asserted separately at the picture-set/render level, not the sim level (US5 Acceptance Scenario 5)
- [ ] T041 [US5] In `src/lib/PlayArea.svelte`'s render loop, add a person draw loop styled like the existing poodle/mermaid loops (`ctx.save(); ctx.translate(person.x, person.y); if (person.facing === -1) ctx.scale(-1, 1); ctx.fillText(...); ctx.restore();`) drawing `personPictureSet.pictures[person.variant][person.state]`; when `person.state === 'running' && !personPictureSet.canRunPicture`, play an in-place hop bob instead (mirroring `flamingoHopAt`'s existing bob math, PlayArea.svelte:385-390) using the standing/walking picture rather than a running glyph
- [ ] T042 [US5] In `src/lib/PlayArea.svelte`'s `paintAt`'s `tool === 'eraser'` branch, add `erasePeopleInBrush`/`erasePeopleInBrushLine` calls alongside the existing `eraseMermaidsInBrush(Line)` calls (PlayArea.svelte:686/692) — confirms a tap on a person with the eraser selected erases her rather than reaching `pokePersonAt` at all, since the eraser path already bypasses the `if (tool !== 'eraser')` poke gate (US5 Acceptance Scenario 3, FR-016)

**Checkpoint**: Poking a person produces a run (or hop fallback), never a no-op; the eraser exception is preserved; US1–US5 together are the feature's full interactive surface.

---

## Phase 8: User Story 6 - Everything else still works (Priority: P2)

**Goal**: Erase, clear-all, undo/redo, and grid re-derivation treat people like every other pet; every other object/pet kind is completely unaffected by this feature's changes.

**Independent Test**: Unit tests over erase/clear-all/undo-redo/grid-re-derivation asserting people count, positions, and variants before and after, plus an unchanged pass of the existing object/poodle/mermaid suites.

### Implementation for User Story 6

- [ ] T043 [US6] In `src/sim/pets.ts`, implement `erasePeopleInBrush(pets, cx, cy, radius)` and `erasePeopleInBrushLine(pets, from, to, radius)` mirroring `eraseMermaidsInBrush`/`eraseMermaidsInBrushLine` exactly (circular-reach removal; line-interpolated for fast drags) — this is what T042 wires into `PlayArea.svelte`
- [ ] T044 [US6] In `tests/unit/sim/pets.test.ts`, add: `erasePeopleInBrush`/`erasePeopleInBrushLine` remove a person within reach, including a fast drag whose samples straddle her (US6 Acceptance Scenario 1, FR-021); `clearPets` empties `people` alongside `poodles`/`mermaids` (US6 Acceptance Scenario 2, FR-022, confirms T014)
- [ ] T045 [US6] In `tests/unit/sim/history.test.ts`, add a full `HistoryManager` cycle: place a person, `commitAction`, `undo` (assert gone), `redo` (assert back, same position and variant) (US6 Acceptance Scenario 3, FR-024)
- [ ] T046 [US6] In `tests/unit/sim/resize.test.ts`, add `repositionPeople` offset+clamp assertions mirroring the existing `repositionPoodles`/`repositionMermaids` tests, including that `homeX` is re-anchored to the shifted `x` so strolling keeps working afterwards (US6 Acceptance Scenario 4, FR-028)
- [ ] T047 [US6] In `src/lib/PlayArea.svelte`'s `resize()`, add `repositionPeople(petsState.people, newGrid, offsetX, offsetY)` alongside the existing `repositionPoodles`/`repositionMermaids` calls (PlayArea.svelte:341); in `tryRestore()`, add `restorePeopleFromPositions(petsState, saved.people)` alongside the existing `restoreMermaidsFromPositions` call (PlayArea.svelte:260) and include people in the re-derivation-after-restore reposition pass (PlayArea.svelte:269)
- [ ] T048 [US6] In `src/lib/PlayArea.svelte`, remove `person: '🧑'` from `OBJECT_GLYPHS` (PlayArea.svelte:124) — now a compile error surface (`ObjectKind` no longer has `'person'`) confirming no other code path still references it; delete the now-unreachable `'person'` handling (if any) in `drawObjectGlyph`'s generic fallthrough
- [ ] T049 [US6] Run the full existing suite (`tests/unit/sim/objects.test.ts`, `pets.test.ts`'s poodle/mermaid sections, `history.test.ts`, `save.test.ts`, `historySave.test.ts`, `resize.test.ts`, `tests/unit/lib/layout.test.ts`) and confirm every rainbow/unicorn/palm/flamingo/house/chest and both existing pets place/draw/convert/poke/erase/save/restore/undo/remap exactly as before (US6 Acceptance Scenario 5, FR-029) — no existing assertion may be weakened; fix any regression found rather than adjusting the test
- [ ] T050 [US6] In `tests/unit/sim/objects.test.ts`, add an explicit assertion that `OBJECT_KINDS` has exactly 6 entries and does not contain `'person'`, and that no grid-element ID was added (`ICE_CREAM`/`DIAMOND` etc. unchanged) — FR-001, FR-009
- [ ] T051 [US6] Run `tests/unit/lib/layout.test.ts`'s existing toolbar control-count sweep unchanged and confirm it still passes as a **regression** check (not a new-count check) — `tool-person` already existed before this feature (FR-002, FR-006, SC-006)

**Checkpoint**: All user stories complete; the full existing suite plus every new test is green.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final validation the plan calls out that doesn't belong to any single user story.

- [ ] T052 [P] Run `npm run build` and confirm it still emits a single self-contained `dist/index.html` with no new runtime dependency and no new asset file (FR-030, SC-008)
- [ ] T053 [P] Run `npm test` and confirm the full suite (existing + all tasks above) is green with no skipped/weakened test (FR-029, quickstart.md's merge gate)
- [ ] T054 Follow quickstart.md's manual/eyeball validation checklist on `npm run dev`: settle-then-stroll cadence reads as an amble not a strobe; three placements read as visibly different figures (or all-neutral, on a limited font) and never all identical on a capable font; poke → brief run → resume strolling, poke elsewhere → just paints; sand poured on a person falls past her and, if buried, she frees herself; eraser removes her including a fast swipe; fullscreen/resize re-derivation leaves her inside the grid and still strolling; undo/redo round-trips her position and variant; closing/reopening the tab restores her as a walker
- [ ] T055 Flag for the other maintainer, per FR-032 and CLAUDE.md's platform table (do not assert an answer for the platform this run cannot verify): (a) whether 🧍/🚶/🏃 (and ♂/♀ forms, if drawable) read as the *same* figure on their platform's emoji font, and (b) which way 🚶 natively faces there, so `WALK_GLYPH_NATIVE_FACING` (T002) can be corrected as a one-value change if needed
- [ ] T056 Note in the PR description (not a code change) that the constitution's Product Constraints "person 🧑" bullet needs a follow-up documentation amendment with a version bump, per FR-033 and the treasure-chest precedent — out of scope for this feature's own code change

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS every user story — `Person`/`PetsState`/`PersonPictureSet`/`ObjectKind` shapes are shared by all of them.
- **User Stories (Phases 3–8)**: All depend on Foundational. Within that constraint:
  - US1 (Phase 3) has no dependency on any other user story — it is the MVP core.
  - US2 (Phase 4) depends on US1's `Person`/`addPerson`/`stepPeople` existing (T011–T013) for its stability tests, and on Phase 6's save/history plumbing for its save/undo assertions (T023/T024) — schedule those two sub-tasks after Phase 6, or run them against `restorePeopleFromPositions` directly if testing standalone.
  - US3 (Phase 5) depends on Foundational's T002/T003 only — independent of US1/US2's sim logic, but its manual "button and canvas agree" claim is only fully meaningful once US5's render loop (T041) exists.
  - US4 (Phase 6) depends on Foundational (T004/T005's `ObjectKind` change) and is otherwise independent of US1/US2/US3/US5/US6 — it only touches migration/persistence.
  - US5 (Phase 7) depends on US1 (`Person`/`stepPeople`/`addPerson`) and US3 (`personPictureSet` prop wiring) for its shell-wiring tasks (T037/T038/T041).
  - US6 (Phase 8) depends on US1 (erase/reposition operate on `state.people`) and US4 (history/save fields) for its round-trip tests, and T048 depends on T004/T005.
- **Polish (Phase 9)**: Depends on all six user stories being complete.

### Parallel Opportunities

- T002 and T004–T010 (Foundational) can mostly run in parallel once T001 exists — they touch different files (`personGlyphs.ts` vs. `types.ts` vs. `objects.ts` vs. `pets.ts` vs. `history.ts`) except T004→T005/T006/T010 which must precede those (type change first).
- Within US1: T011 and T015 can run in parallel with each other (different functions, same file — coordinate on file, not blocking); tests T016–T019 can be written in parallel once T011–T014 land.
- US3 (Phase 5) can be implemented in parallel with US4 (Phase 6) — no shared files.
- Test-writing tasks marked without a hard "depends on" note in the same phase can generally run in parallel with each other once their implementation task lands.

---

## Implementation Strategy

### MVP First (User Stories 1–4, all Priority P1)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (critical — blocks everything).
3. Complete Phase 3: User Story 1 (strolling person, sim-only — testable and demoable in isolation via `vitest`, no Svelte wiring needed yet).
4. Complete Phase 4: User Story 2 (variant stability).
5. Complete Phase 5: User Story 3 (glyph-probe wiring to the shell) — this is what makes US1's person actually visible and correct on every device.
6. Complete Phase 6: User Story 4 (save/history migration) — closes the sharpest regression risk before shipping to either maintainer's existing world.
7. **STOP and VALIDATE**: `npm test` green, `npm run build` clean, manual eyeball pass (T054) on at least one platform. This is a complete, shippable feature even without the poke reaction.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 → a person strolls, sim-verified (MVP core).
3. US2 → she stays the same person, sim-verified.
4. US3 → she's never a broken picture, on any device.
5. US4 → yesterday's people are not lost.
6. **Ship point**: everything above is the complete "wish" from the issue, minus the poke.
7. US5 → poke → run (or hop), a lovely payoff, added without touching US1–US4.
8. US6 → erase/clear/undo/resize parity plus the full regression sweep, confirming zero collateral damage to every other object and pet.
9. Polish → build/test/manual/cross-maintainer validation, constitution-amendment flag.

### Parallel Team Strategy

With multiple contributors: one person takes Foundational solo (it's the narrow waist everything else depends on); once done, one takes US1+US2 (sim core), a second takes US3+US5 (glyph probe + shell wiring, converging on `PlayArea.svelte`/`Toolbar.svelte`), a third takes US4 (save/history migration, `objects.ts`/`save.ts`/`historySave.ts` — largely untouched by the others). US6's regression sweep (Phase 8) is the integration point where everyone's changes are proven not to collide.
