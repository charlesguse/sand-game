---

description: "Task list for A Mermaid And Her Ice Cream"
---

# Tasks: A Mermaid And Her Ice Cream

**Input**: Design documents from `/specs/016-mermaid-ice-cream/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/sim-and-shell-contracts.md, quickstart.md

**Tests**: This feature explicitly requires tests (FR-033, FR-034) — every user story below includes its test tasks, written before the implementation tasks they verify, per quickstart.md's coverage table.

**Organization**: Tasks are grouped by user story (spec.md's P1/P1/P1/P2 stories) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

Single project. `src/sim/*` is the framework-free simulation core (vitest-only surface); `src/lib/*` + `src/App.svelte` is the Svelte shell. `tests/unit/sim/*` and `tests/unit/lib/*` / `tests/unit/shell/*` mirror that split.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Reserve the new element id and tool literals that every later phase depends on. No new project scaffolding is needed — every touched file already exists.

- [ ] T001 Add `export const ICE_CREAM = 11;` to `src/sim/types.ts`, add `ICE_CREAM` to the `Element` union, and add `'mermaid'` and `'icecream'` to the `Tool` union (per contracts/sim-and-shell-contracts.md's `types.ts` section)

**Checkpoint**: The id/type vocabulary exists; every other phase can now reference `ICE_CREAM`, `'mermaid'`, and `'icecream'` without forward-declaring them.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core element-level and pet-state plumbing that both US1 (mermaid) and US2/US3 (ice cream, seeking) build on. Nothing in Phase 3+ can be tested until this phase is green.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T002 [P] Add `ICE_CREAM` to `isSolid()` and to `usesHueColor()` in `src/sim/element.ts` (FR-014, FR-015; data-model.md's "Validation / derived rules")
- [ ] T003 [P] Add the `Mermaid` interface, `MermaidState` type, and `mermaids: Mermaid[]` field on `PetsState` in `src/sim/pets.ts`, per data-model.md's exact shape (`id`, `x`, `y`, `facing`, `state`, `timer`, `pursuitX`, `pursuitY`, `pursuitBestDist`, `pursuitStaleFrames`, `iceCreamCooldown`, `homeX`, `homeY`, `driftDir`); add `export const MERMAID_CAP = 3;` next to the existing `POODLE_CAP`
- [ ] T004 Update `clearPets()` in `src/sim/pets.ts` to also empty `state.mermaids` (FR-025)

**Checkpoint**: `PetsState` now carries mermaids end-to-end through the one shared-state entry point (`clearPets`); `ICE_CREAM` is a recognized solid, hue-colored element. User story implementation can now begin.

---

## Phase 3: User Story 1 - A mermaid of her own, swimming in her pool (Priority: P1) 🎯 MVP

**Goal**: A placed mermaid swims between water cells of her connected pool, drifts when idle, snaps into nearby water or rests gracefully when placed off-water, frees herself if buried, responds only to a direct poke (trick), and is capped at 3.

**Independent Test**: Build a grid with a pool via `createGrid`/`setCell`, `addMermaid`, run `stepMermaids`/`stepPets` for a few hundred frames in a plain vitest test, and assert she is always in a water cell, always inside the pool she started in, and that her position changes over time. Repeat with no water, a one-cell pool, and a pool drained mid-run.

### Tests for User Story 1 ⚠️

- [X] T005 [P] [US1] Test: `addMermaid` places on a water cell directly, evicts the oldest at `MERMAID_CAP` (mirrors `POODLE_CAP` test), and never exceeds 3 mermaids, in `tests/unit/sim/pets.test.ts` (or new `tests/unit/sim/mermaid.test.ts`) (FR-002)
- [X] T006 [P] [US1] Test: a mermaid placed on dry sand a few cells from a pool snaps into that pool's nearest water cell within the bounded search window; placed with no water anywhere at all, she rests at `groundBelow` and her position is unchanged over many frames until water is painted under her, at which point she starts swimming, in `tests/unit/sim/mermaid.test.ts` (FR-008)
- [X] T007 [P] [US1] Test: over several hundred simulated frames in a pool, a mermaid's position is always `WATER` and always within the original pool's bounds, and her position changes over time (never frozen) with no ice cream present, in `tests/unit/sim/mermaid.test.ts` (FR-004, FR-005, FR-006, FR-007)
- [X] T008 [P] [US1] Test: a one-cell-wide/tall pool keeps her bobbing in place without triggering a stuck/give-up state; a pool that is drained mid-run settles her onto the now-solid/empty cell below rather than leaving her stranded mid-air, in `tests/unit/sim/mermaid.test.ts` (Edge Cases: "pool exactly one cell wide", "water drains from under her")
- [X] T009 [P] [US1] Test: pouring sand/gumdrop/ice cream onto her own cell buries her; within a small bounded frame count she is relocated to the nearest non-solid cell and never remains inside solid material (SC-002), in `tests/unit/sim/mermaid.test.ts` (FR-009)
- [X] T010 [P] [US1] Test: `pokeMermaidAt` at her exact position starts a trick (`state === 'tricking'`); calling it elsewhere is a no-op on her state; calling it while `timer > 0` (already tricking/eating/freeing) is ignored, in `tests/unit/sim/mermaid.test.ts` (FR-011)

### Implementation for User Story 1

- [X] T011 [US1] Implement `addMermaid(grid, state, x, y)` in `src/sim/pets.ts`: bounded square-window scan for nearest `WATER` (mirrors `nearestGumdropX`'s shape, predicate swapped), `state: 'drifting'` if found, else `groundBelow`-placed with `state: 'resting'`; evicts oldest via `shift()` at `MERMAID_CAP` (depends on T003; makes T005/T006 pass)
- [X] T012 [US1] Implement the per-mermaid step logic in `src/sim/pets.ts`: own-cell-solid check → `'freeing'` (bounded neighbourhood search for nearest non-solid cell, research.md §4), `'resting'`-own-cell-is-water check → `'drifting'`, greedy up-to-8-neighbour water stepping toward `homeX/homeY`-bounded drift target (no boredom delay, research.md §3), all allocation-free (FR-010) (depends on T011; makes T007/T008/T009 pass)
- [X] T013 [US1] Implement `pokeMermaidAt(pets, x, y)` in `src/sim/pets.ts`: nearest mermaid within `POKE_RADIUS` whose `timer === 0` enters `'tricking'` (`timer = MERMAID_TRICK_DURATION`); returns whether a trick started; ignored if no free-timer mermaid is in range (mirrors `pokePoodleAt`) (depends on T003; makes T010 pass)
- [X] T014 [US1] Implement `stepMermaids(grid, state)` in `src/sim/pets.ts` iterating all mermaids through the step logic from T012, and wire it into the existing `stepPets(grid, pets, target)` so it runs every frame alongside `stepPoodle` (contracts/sim-and-shell-contracts.md's `stepPets` signature note) (depends on T012)
- [X] T015 [US1] Add the `tool-mermaid` control (`group: 'objects'`, `ariaLabel: 'Mermaid'`) to `TOOLBAR_CONTROLS` in `src/lib/toolbarControls.ts` (FR-001, FR-030)
- [X] T016 [US1] Add the mermaid glyph/aria/selection case for `tool-mermaid` in `src/lib/Toolbar.svelte`, using the single-codepoint 🧜 (U+1F9DC) — never a gendered ZWJ variant (FR-003)
- [X] T017 [US1] Wire mermaid placement, poke, drawing, and clear-all into `src/lib/PlayArea.svelte`: `createPetsState()` already covers `mermaids` via T003; add `tool === 'mermaid'` branch calling `addMermaid(grid, petsState, pos.x, pos.y)` alongside the existing `tool === 'poodle'` branch; add `pokeMermaidAt(petsState, pos.x, pos.y)` to the existing poke-gate check before painting; render each mermaid every frame (own loop, own `ctx.font`, `spawnBurst` on `'eating'`/`'tricking'` — no new sound call, FR-023) alongside the poodle render loop (depends on T011, T013, T014)

**Checkpoint**: A mermaid can be placed, swims/drifts/rests/frees herself correctly, is capped at 3, and reacts only to a direct poke — fully functional and testable independently of ice cream.

---

## Phase 4: User Story 2 - Ice cream she can pour (Priority: P1)

**Goal**: Ice cream is a paintable, hue-colored element that falls and rests exactly like a gumdrop, with no effect on any other element's behavior.

**Independent Test**: Paint ice cream onto a grid at each brush size in a unit test and assert the expected cells hold ice cream with flavour colours that survive round trips (this story's tests cover the physics/paint half; save/undo round trips are US4), that a poured cell falls and rests cell-for-cell like a gumdrop poured in the same place, and that no other element's behaviour changed.

### Tests for User Story 2 ⚠️

- [X] T018 [P] [US2] Test: painting `ICE_CREAM` via `applyBrush`/`applyBrushLine` at each brush size produces the expected cells, each with a hue set at paint time, in `tests/unit/sim/brush.test.ts` (or new `tests/unit/sim/iceCream.test.ts`) (FR-012)
- [X] T019 [P] [US2] Test: an `ICE_CREAM` cell poured above a pool falls and comes to rest cell-for-cell identically to a `GUMDROP` poured in the same spot (same `step()` outcomes over N frames); poured on dry land it simply rests and never moves again, never melts, never disappears on its own, in `tests/unit/sim/iceCream.test.ts` (FR-015)
- [X] T020 [P] [US2] Test: with `ICE_CREAM` cells present, sand/water/dirt/rainbow-sand/grass/star-power/fog/gumdrop/flower behaviour is byte-for-byte unchanged versus the existing suites — run `tests/unit/sim/{grid,step,brush,grass,flower,starPower,gumdrop}.test.ts` unmodified and confirm all still pass (FR-016, FR-034)

### Implementation for User Story 2

- [X] T021 [US2] Add the `ICE_CREAM` branch to `step()`'s per-cell dispatch in `src/sim/step.ts`, routing it through the existing `stepGumdrop()` verbatim (`element === GUMDROP || element === ICE_CREAM`) (depends on T001, T002; makes T019 pass)
- [X] T022 [US2] Add the `icecream` tool branch to `paintCell()` in `src/sim/brush.ts`: `setCell(grid, x, y, ICE_CREAM, shade)` plus `grid.hues[...] = randomHue()`, mirroring the existing gumdrop paint case (depends on T001; makes T018 pass)
- [X] T023 [US2] Add `ICE_CREAM_COLORS` ramp and a `colorFor()` branch in `src/lib/palette.ts`, same shape as `GUMDROP_COLORS`/`FLOWER_COLORS` (FR-014)
- [X] T024 [US2] Add the `tool-icecream` control (`group: 'elements'`, `ariaLabel: 'Ice cream'`) to `TOOLBAR_CONTROLS` in `src/lib/toolbarControls.ts` (FR-012, FR-030)
- [X] T025 [US2] Add the ice cream glyph/aria/selection case for `tool-icecream` in `src/lib/Toolbar.svelte`, using 🍦 (FR-031)
- [X] T026 [US2] Add an `'icecream'` `PourKind` entry and pitch to `POUR_PITCH` in `src/lib/sound.ts`, mirroring every other pourable element (research.md §10)
- [X] T027 [US2] Wire the `tool === 'icecream'` paint path into `src/lib/PlayArea.svelte`'s existing paint/pour call sites (brush stroke handling, pour sound trigger) alongside the existing gumdrop wiring (depends on T022, T024, T026)

**Checkpoint**: Ice cream can be poured, falls/rests like a gumdrop, is hue-colored, and every existing element is unaffected — fully functional and testable independently of the mermaid's pursuit behaviour.

---

## Phase 5: User Story 3 - She swims for the ice cream (Priority: P1)

**Goal**: A mermaid detects ice cream in her scent window, swims to the nearest one, eats it (cell empties, sparkle, brief eating state), and gives up gracefully (with cooldown) on ice cream she cannot reach — mirroring the poodle/gumdrop pursuit shape.

**Independent Test**: In a unit test, put a mermaid at one end of a pool and ice cream at the other; advance frames and assert the ice cream cell becomes empty within a bounded number of frames and the mermaid enters her eating state. Then put ice cream outside the water, or behind a wall of sand, and assert she gives up within a bounded number of frames and resumes ordinary drifting.

**Depends on**: Phase 3 (mermaid stepping must exist) and Phase 4 (ice cream must exist as a paintable element) — this story wires the two together.

### Tests for User Story 3 ⚠️

- [X] T028 [P] [US3] Test: a mermaid in a pool with ice cream within her scent window in the same pool moves closer over successive frames and eventually the ice cream cell empties while she enters `'eating'` within the bounded frame budget (SC-001), in `tests/unit/sim/mermaid.test.ts` (FR-017, FR-018)
- [X] T029 [P] [US3] Test: ice cream erased/covered mid-pursuit stops her pursuit cleanly (no stuck/twitching state, `pursuitX/pursuitY` reset to `-1/-1`); ice cream far outside her scent window causes no reaction at all, in `tests/unit/sim/mermaid.test.ts` (Acceptance Scenarios US3 #2–3)
- [X] T030 [P] [US3] Test: ice cream she cannot swim to (dry land, a different pool, walled off) causes her to try for a bounded number of frames, then give up, enter `iceCreamCooldown`, and resume ordinary drifting without ever leaving the water (FR-019, FR-020), in `tests/unit/sim/mermaid.test.ts`
- [X] T031 [P] [US3] Test: ice cream poured directly onto a mermaid's own cell is eaten rather than ignored or silently vanishing (FR-021, Edge Cases), in `tests/unit/sim/mermaid.test.ts`
- [X] T032 [P] [US3] Test: with a poodle + gumdrops and a mermaid + ice cream on one grid, the poodle only reacts to gumdrops and the mermaid only reacts to ice cream (FR-022), in `tests/unit/sim/pets.test.ts`
- [X] T033 [P] [US3] Test: eating produces no new sound-producing call — assert no mermaid-specific sound function exists / is invoked on the `'eating'` transition, in `tests/unit/lib/sound.test.ts` (FR-023)

### Implementation for User Story 3

- [X] T034 [US3] Add a `cellIsIceCream`-style bounded scent-window scan and closest-target selection to the mermaid step logic in `src/sim/pets.ts` (mirrors `nearestGumdropX`'s shape, reading `ICE_CREAM` instead of `GUMDROP`), transitioning `'drifting'`/`'swimming'` → `'swimming'` (pursuing) when ice cream is found (depends on T012, T021, T022; makes T028, T032 pass)
- [X] T035 [US3] Add pursuit/give-up/cooldown bookkeeping to the mermaid step (`pursuitBestDist`, `pursuitStaleFrames`, `iceCreamCooldown`), reusing the poodle's `GUMDROP_PATIENCE`/`GUMDROP_COOLDOWN`-shaped constants generalized to Chebyshev distance (research.md §2); on give-up, clear `pursuitX/pursuitY` to `-1/-1` and return to `'drifting'` (depends on T034; makes T029, T030 pass)
- [X] T036 [US3] On reaching ice cream (Chebyshev distance 0 to `pursuitX/pursuitY`), empty that grid cell, set `state = 'eating'` with `timer = MERMAID_EAT_DURATION`, and trigger the same sparkle feedback (`spawnBurst`) the poodle gets on eating a gumdrop — no sound call (depends on T034; makes T028, T031, T033 pass)
- [X] T037 [US3] Confirm/assert mutual exclusivity: the poodle's existing `nearestGumdropX` must never match `ICE_CREAM`, and the mermaid's scent scan must never match `GUMDROP` — add the guard if either predicate is not already element-specific (depends on T034; makes T032 pass)

**Checkpoint**: All three P1 stories are complete — a mermaid can be placed, drift, be poked, and now also seek out and eat ice cream, giving up gracefully when she can't reach it. This is a fully demonstrable MVP.

---

## Phase 6: User Story 4 - Nothing about her gets lost (Priority: P2)

**Goal**: Mermaids and ice cream participate correctly in every cross-cutting system: eraser, clear-all, save/restore, undo/redo, and grid re-derivation — with pre-feature saves still restoring cleanly.

**Independent Test**: Unit tests over the erase, clear, save/restore, undo/redo, and grid-re-derivation paths asserting mermaid count/positions and ice cream cells/colours before and after.

### Tests for User Story 4 ⚠️

- [X] T038 [P] [US4] Test: `eraseMermaidsInBrush`/`eraseMermaidsInBrushLine` remove a mermaid within `POKE_RADIUS` of the erase point and leave one outside untouched; erasing an ice cream cell already sets it to `EMPTY` with no code change needed (confirm this stays true now that `ICE_CREAM` exists) (FR-024), in `tests/unit/sim/pets.test.ts` and `tests/unit/sim/brush.test.ts`
- [X] T039 [P] [US4] Test: `clearPets` (already updated in T004) empties both `poodles` and `mermaids`; a full clear-all removes every mermaid and every ice cream cell (FR-025), in `tests/unit/sim/pets.test.ts`
- [X] T040 [P] [US4] Test: `serializeWorld`/`deserializeWorld` round-trips mermaid count/position and every un-eaten ice cream cell's flavour colour; a wire payload shaped like today's (no `mermaids` key) deserializes successfully with `mermaids: []` and no error (FR-026, FR-029), in `tests/unit/sim/save.test.ts`
- [X] T041 [P] [US4] Test: `HistoryManager` round-trips mermaids and ice cream (including colour) across `beginAction`/`commitAction`/`undo`/`redo`, with no colour drift across many undo/redo cycles; `visibleSnapshot`'s test helper is updated to read hue (not shade) for `ICE_CREAM` cells (FR-014, FR-027), in `tests/unit/sim/history.test.ts`
- [X] T042 [P] [US4] Test: a wire history payload shaped like today's (no `mermaids` key) deserializes successfully via `deserializeHistory` with `mermaids: []` and no error (FR-029), in `tests/unit/sim/historySave.test.ts`
- [X] T043 [P] [US4] Test: `repositionMermaids` shifts every mermaid by `(offsetX, offsetY)` and clamps in-bounds rather than dropping her, mirroring the existing `repositionPoodles` tests; `remapWorldState` clamps a mermaid position near an edge and never causes `wouldRemapLosslessly` to reject the snapshot because of a mermaid (FR-028), in `tests/unit/sim/resize.test.ts` and `tests/unit/sim/history.test.ts` (landed in `tests/unit/sim/pets.test.ts`, mirroring `repositionPoodles`' own home, and `tests/unit/sim/history.test.ts` for the remap-clamp half — `resize.test.ts` covers only grid-level `resizeGrid`, not pet repositioning, so there is no matching test to add there)

### Implementation for User Story 4

- [X] T044 [US4] Implement `eraseMermaidsInBrush(pets, cx, cy, radius)` and `eraseMermaidsInBrushLine(pets, from, to, radius)` in `src/sim/pets.ts`, mirroring `eraseObjectsInBrush`/`eraseObjectsInBrushLine`'s shape but operating on `PetsState.mermaids` (depends on T003; makes T038 pass)
- [X] T045 [US4] Add `mermaids: { x: number; y: number }[]` to `WorldState` in `src/sim/history.ts`; widen `captureWorldState`, `restoreWorldState`, and every `HistoryManager` method (`beginAction`, `commitAction`, `undo`, `redo`) to accept a `PetsState` parameter, reading/writing only `.mermaids`; on restore, rebuild each mermaid as a fresh default-activity mermaid (`state: 'drifting'`, `timer: 0`, pursuit cleared) from just `{x, y}` (depends on T003; makes T041 pass). Implementation note: `pets` defaults to a fresh empty `PetsState` at every widened call site (trailing parameter, or reordered-to-trailing for `restoreWorldState` specifically) so the ~240 pre-existing call sites across `history.test.ts`/`historySave.test.ts` that don't care about mermaids keep compiling and behaving unchanged — only call sites that want mermaid round-tripping pass a real `PetsState`.
- [X] T046 [US4] Update `remapWorldState` in `src/sim/history.ts` to clamp mermaid positions into the new grid bounds (never dropped, never causing `wouldRemapLosslessly` to reject the snapshot) (depends on T045; makes T043 pass)
- [X] T047 [US4] Update `visibleSnapshot`'s test helper in `tests/unit/sim/history.test.ts` to read `hues[i]` (not `shades[i]`) for `ICE_CREAM` cells (FR-014; makes T041 pass)
- [X] T048 [US4] Add `mermaids: { x: number; y: number }[]` to `SavedWorld`/`WireWorld` in `src/sim/save.ts`; widen `serializeWorld` to read `PetsState.mermaids`; make `deserializeWorld` default a missing/malformed `mermaids` field to `[]` rather than rejecting the payload; do not bump `SAVE_VERSION` (depends on T003; makes T040 pass)
- [X] T049 [US4] Add the corresponding `mermaids` field to `WireHistoryStep` in `src/sim/historySave.ts` (falls out of T045's `WorldState` change); make `deserializeHistory` apply the same missing-field-defaults-to-`[]` tolerance; do not bump `HISTORY_SAVE_VERSION` (depends on T045; makes T042 pass)
- [X] T050 [US4] Implement `repositionMermaids(mermaids, newGrid, offsetX, offsetY)` in `src/sim/pets.ts`, mirroring `repositionPoodles` exactly (shift + clamp, never drop) (depends on T003; makes T043 pass)
- [X] T051 [US4] Wire the remaining cross-cutting call sites in `src/lib/PlayArea.svelte`: eraser branch calls `eraseMermaidsInBrush(Line)` alongside `eraseObjectsInBrush(Line)`; `resize()` calls `repositionMermaids(petsState.mermaids, newGrid, offsetX, offsetY)` alongside `repositionPoodles`; `history.beginAction/commitAction/undo/redo` calls pass `petsState`; `saveNow`/`tryRestore` pass through `serializeWorld`/`deserializeWorld`'s wider shape and rebuild mermaids from `saved.mermaids` via a new shared `restoreMermaidsFromPositions` helper (not `addMermaid`, which would incorrectly re-search for water) the way poodles are rebuilt from `saved.poodles` (depends on T044, T045, T048, T050)

**Checkpoint**: Mermaids and ice cream now survive every cross-cutting path the constitution's checklist calls out — erase, clear-all, save/restore, undo/redo, and grid re-derivation — with pre-feature saves restoring with no error.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Platform/shell verification and final regression sweep across all stories.

- [X] T052 [P] Extend `tests/unit/shell/toolbarGlyphs.test.ts`'s "avoids Emoji 13.0+ glyphs" check to cover 🧜 (Emoji 5.0) and 🍦 (Emoji 1.0), confirming neither control was accidentally given a newer glyph (FR-031)
- [X] T053 Confirm `tests/unit/lib/layout.test.ts`'s `CONTROL_COUNTS` sweep (`BASE_CONTROLS`/`FULL_CONTROLS`, now 25/27 controls per plan.md's "Toolbar cost") passes at every representative viewport — every control stays at or above the 44px floor and the drawing region keeps its guaranteed share (FR-030, SC-006). Required two small, verified-necessary `layout.test.ts` edits beyond T015/T024 (see Phase 4's commit): `KNOWN_INFEASIBLE` gained `'small phone:25'` (BASE_CONTROLS crossed into the same infeasibility the old FULL_CONTROLS already had) alongside the updated `'small phone:27'`, both describe-registration loops guard against registering an empty `describe` when every control count is infeasible for a viewport, and SC-008's control-count-sensitivity probe uses `FULL_CONTROLS + 2` instead of `+ 1` (a verified floor-division coincidence makes 27→28 controls produce byte-identical layouts at every representative viewport, while 26→27 and 28→29 both do differ)
- [X] T054 Run the full suite (`npm test`) and confirm every existing test still passes unweakened, then `npm run build` and confirm a single self-contained `dist/index.html` is emitted that still plays from `file://` (FR-032, FR-034, SC-007). 732 tests pass across 31 files; `dist/index.html` builds at 119.06 kB (47.74 kB gzip) with no external `src=`/`href="http"` references — `public/`'s manifest/icons ride alongside per CLAUDE.md, unreferenced by the inlined page itself.
- [ ] T055 Manual/eyeball validation pass per quickstart.md's "Manual / eyeball validation" section on a real device (`npm run dev`): mermaid settles under the surface and drifts gently, notices and eats ice cream with a sparkle and no sound, gives up gracefully on unreachable ice cream, responds only to a direct poke, frees herself when buried, survives fullscreen/resize and a save/reload cycle — flag Fire tablet / Windows desktop Chrome glyph and 44px-floor verification for Charlie per CLAUDE.md's platform table (FR-031, Edge Cases). **Not performed**: this run is headless with no display/browser/physical device available — left unchecked for a human (Charlie or Max) to run on real hardware per CLAUDE.md's two-maintainer verification split.

---

## Phase 8: Convergence

**Purpose**: Remediate gaps found by an empirical re-check of `spec.md`'s Success Criteria and Edge Cases against the implemented behaviour (not just the original task list) after Phase 1-7 completed. Found via direct headless-sim reproduction, not code reading alone.

- [X] T056 Fix SC-001: a mermaid placed at one end of a canvas-spanning pool (the toy's actual max grid, 270×160) does not reliably reach and eat ice cream placed at the other end within 600 frames (10s @ 60fps) — reproduced directly (pool spanning the full grid width, mermaid at x=2, ice cream at x=267: never entered `'eating'` in 600 frames). Root cause: `MERMAID_DRIFT_RANGE` (10 cells) confines ordinary drifting to a fixed leash around her original settle point forever — `homeX`/`homeY` never re-anchor during a continuous drift (unlike the poodle, which re-homes on every fresh idle settle) — so she never wanders far enough for `ICE_CREAM_SCENT_RADIUS` (25 cells) to bring a far-away target into range. Fix by re-anchoring her drift home periodically as she drifts (turning ordinary wandering into an unbounded-over-time sweep of the connected pool, while staying locally bounded at any instant per FR-006) and/or by enlarging `ICE_CREAM_SCENT_RADIUS` to a fixed constant sized to the toy's actual max grid dimensions (still a fixed, canvas-size-independent constant per FR-010's letter, since the toy's own max grid is itself a fixed budget — not scaling the search dynamically with the live grid's width/height). Verify against a new test mirroring SC-001's exact scenario (canvas-spanning pool, opposite ends, 600-frame budget, must succeed) before considering this done (contradicts: SC-001)
- [X] T057 Decide and (if warranted) fix FR-020/Edge Cases' "ice cream that ends up out of reach... on dry land... she gives up on it": reproduced directly that ice cream painted exactly one cell onto dry land, immediately touching a pool's edge, IS reached and eaten rather than given up on — `swimToward`'s `allowTarget` exception (`src/sim/pets.ts`, needed so she can step onto in-pool ice cream, which is also technically a non-WATER cell once painted) cannot distinguish "ice cream poured into water" from "ice cream poured one cell onto the adjacent shore," since the grid keeps no memory of what a cell held before it was painted. This is a narrow, architecturally-ambiguous corner case (not the common path — most out-of-reach ice cream is many cells from any water and is unaffected). Either implement a distinction worth its complexity, or explicitly record in research.md that this one-cell shore-beaching is accepted given the architecture's lack of "original terrain" memory, so a future reader doesn't mistake it for an unnoticed bug (contradicts: FR-020, Edge Cases)
- [X] T058 Add one combined adversarial-terrain stress test per SC-002's own scenario in `tests/unit/sim/mermaid.test.ts`: a mermaid on terrain combining walls/split pools, ice cream placed on dry land, and sand poured on top of her, run for 2,000 simulated frames, asserting she is never inside solid material for more than a short bounded interval, never leaves the water she is connected to (modulo T057's finding), and always resumes drifting within the give-up period — today's coverage tests each hazard (buried-frees-herself, give-up/cooldown, one-cell pool, drained pool) separately but never combined over SC-002's full 2,000-frame budget, so the aggregate "0 stuck states across the whole run" property is inferred from the pieces rather than directly measured (partial: SC-002)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup (needs `ICE_CREAM`/`'mermaid'`/`'icecream'` to exist) — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational. Independently testable and shippable on its own (a mermaid that swims but has nothing to eat yet).
- **User Story 2 (Phase 4)**: Depends on Foundational. Independent of Phase 3 — can be built and tested in parallel with it (ice cream physics don't need a mermaid to exist).
- **User Story 3 (Phase 5)**: Depends on **both** Phase 3 (mermaid stepping) and Phase 4 (ice cream element) — this is where they're wired together.
- **User Story 4 (Phase 6)**: Depends on Phase 3 (mermaids must exist to be erased/saved/remapped) and Phase 4 (ice cream's hue-color piece already lands in Phase 2/4, but the `mermaids` half of save/history needs Phase 3's `PetsState.mermaids`). Can start once Phase 3 is done; doesn't strictly need Phase 5.
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### User Story Dependencies

- **US1 (mermaid swims)**: No dependency on other stories.
- **US2 (ice cream pours)**: No dependency on other stories.
- **US3 (she swims for it)**: Depends on US1 and US2 both being implemented (not just Foundational).
- **US4 (nothing gets lost)**: Depends on US1 (mermaids must exist); ice cream's save/history round-trip is largely already covered once US2 + T002 (hue-color) land, so US4's marginal work is almost entirely mermaid-shaped.

### Within Each User Story

- Tests are written first and MUST fail before their corresponding implementation task lands.
- `src/sim/pets.ts` changes precede `src/lib/*` wiring changes within a story.
- Toolbar-control-list changes (`toolbarControls.ts`) and `Toolbar.svelte` glyph cases can proceed in parallel with `src/sim/*` work within a story, since they touch different files.

### Parallel Opportunities

- All Setup tasks (just T001) run first, alone.
- T002 and T003 (Phase 2) touch different files (`element.ts` vs `pets.ts`) and can run in parallel.
- All US1 test tasks (T005–T010) touch the same test file and are logically independent of each other but should land as one coherent test-writing pass; they can be drafted in parallel by different people since each asserts a distinct rule.
- US2's test tasks (T018–T020) and US1's test tasks (T005–T010) can be written and run in parallel — different files, no shared state.
- Once Phase 3 and Phase 4 are both done, US3's test tasks (T028–T033) can be drafted in parallel with US4's test tasks (T038–T043), though US4's mermaid-shaped tests still need Phase 3/US1 complete first.
- T052 (glyph test) and T053 (layout sweep) in Polish can run in parallel — different test files.

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (all touch tests/unit/sim/mermaid.test.ts
# or pets.test.ts but assert independent rules — draft together, run together):
Task: "Test addMermaid cap/eviction in tests/unit/sim/pets.test.ts"
Task: "Test placement snapping and no-water resting in tests/unit/sim/mermaid.test.ts"
Task: "Test swim-confined-to-pool and drift-never-frozen in tests/unit/sim/mermaid.test.ts"
Task: "Test one-cell pool and drained-pool settling in tests/unit/sim/mermaid.test.ts"
Task: "Test buried-and-frees-herself in tests/unit/sim/mermaid.test.ts"
Task: "Test poke-triggers-trick / poke-elsewhere-noop / poke-while-busy-ignored in tests/unit/sim/mermaid.test.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1, 2, and 3 — all P1)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
3. Complete Phase 3: User Story 1 (mermaid swims, drifts, pokes, caps at 3).
4. Complete Phase 4: User Story 2 (ice cream pours, falls, rests) — can overlap with Phase 3's later tasks since they touch different files.
5. Complete Phase 5: User Story 3 (she seeks and eats ice cream) — needs both 3 and 4 done.
6. **STOP and VALIDATE**: all three P1 stories together are the MVP the issue asked for — a mermaid who swims, ice cream to pour, and her eating it. Test independently per each story's Independent Test in spec.md.
7. Deploy/demo if ready.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. Add US1 → test independently → mermaid alone is already a complete, delightful toy.
3. Add US2 → test independently → ice cream alone is already fun to pour.
4. Add US3 → test independently → the full MVP (this is the whole reason ice cream exists per spec.md).
5. Add US4 (P2) → test independently → nothing about her gets lost across erase/clear/save/undo/resize. Ships after the MVP but is not optional — spec.md is explicit that these are "not optional for shipping," just lower priority for demonstrability.
6. Polish → toolbar/glyph verification, full regression sweep, manual device pass.

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001–T004).
2. Once Foundational is done:
   - Developer A: User Story 1 (mermaid movement/poke/cap)
   - Developer B: User Story 2 (ice cream paint/physics/palette/sound)
3. Once both land, one developer picks up User Story 3 (the seek-and-eat wiring that needs both).
4. User Story 4 (cross-cutting persistence) can start as soon as US1 lands, in parallel with US2/US3, since most of its surface (`history.ts`, `save.ts`, `historySave.ts`, `resize.ts`-adjacent repositioning) only needs `PetsState.mermaids` to exist, not the full seek/eat behavior.
5. Polish tasks (toolbar glyph test, layout sweep, full regression, device pass) come last, after all four stories are integrated on the same branch.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- This feature requires tests (FR-033/FR-034) — every implementation task above has a corresponding test task that must be written and failing first.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently.
- No shared `Pet`/`Pursuer` abstraction is introduced between `Poodle` and `Mermaid` (research.md §7) — tasks above deliberately duplicate the pursuit/give-up shape rather than factor it out, per the plan's explicit decision.
- Poodles gain no new capability in this feature (no poodle erasure, no poodle undo/redo participation) — research.md §8 and §12 already ruled this scope creep out; no task above should be read as implying otherwise.
