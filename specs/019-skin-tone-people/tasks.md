# Tasks: People In Every Skin Tone

**Input**: Design documents from `/specs/019-skin-tone-people/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/sim-and-shell-contracts.md, quickstart.md

**Tests**: Explicitly requested by the spec (FR-026) — this feature ships plain `vitest` unit tests with no DOM, extending existing suites. No new test file is required (plan.md's Project Structure); every test task below adds cases to an existing spec-018 suite.

**Organization**: Every touched file already exists (spec 018's layout) — no new files. Tasks are grouped by user story per the constitution's "one axis at a time" development style, but because this feature is one small, tightly-coupled type change threaded through six existing files, most user stories share the same edits; each phase lists exactly which new assertions make that story's independent test pass, so the phases stay independently checkable even though the production code lands once.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US6)

## Path Conventions

Single project. Production code in `src/sim/*` (framework-free) and `src/lib/*` (Svelte-adjacent helpers); Svelte shell in `src/lib/PlayArea.svelte`; tests in `tests/unit/sim/*` and `tests/unit/lib/*`. All paths below are exact, existing files (plan.md's Project Structure).

---

## Phase 1: Setup

No setup tasks — no new dependency, no new build step, no new top-level directory or file (plan.md Technical Context, FR-024). Proceed directly to Foundational.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Introduce the `PersonTone` type and widen the two core state shapes (`Person`, `PetsState`) it lives on, so every user story's tests and code have something to compile against.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete — every story below reads or writes `Person.tone`, `PetsState.personToneBag`, or `PersonPictureSet.drawableTones`.

- [X] T001 Add `export type PersonTone = 'default' | 'light' | 'mediumLight' | 'medium' | 'mediumDark' | 'dark';` to `src/sim/types.ts`, next to the existing `PersonVariant` type (data-model.md "Tone", research.md §1)
- [X] T002 In `src/sim/pets.ts`, add `readonly tone: PersonTone;` to the `Person` interface (next to `readonly variant: PersonVariant;`, ~line 82) and add `personToneBag: PersonTone[];` to the `PetsState` interface (next to `personVariantBag: PersonVariant[];`, ~line 94); import `PersonTone` from `./types`
- [X] T003 In `src/sim/pets.ts`, update `createPetsState()` (~line 162) to initialize `personToneBag: []` alongside the existing `personVariantBag: []`

**Checkpoint**: `PersonTone` exists and `Person`/`PetsState` compile with the new fields (production code that populates them is added story-by-story below — TypeScript will show the new fields as unassigned at call sites until Phase 3/US1 lands `pickPersonTone`/`addPerson`/`restorePeopleFromPositions`, which is expected and resolved within this same PR before merge).

---

## Phase 3: User Story 1 - People who look like everyone (Priority: P1) 🎯 MVP

**Goal**: A placed person has one tone out of six and one form out of three, fixed for life across every frame and facing.

**Independent Test**: Drive the placement path with seeded randomness and an all-drawable probe result; place people; assert tone and form are fixed at placement and unchanged after hundreds of simulated frames including a poke-run; assert the picture chosen for every (form, tone, frame) is the one belonging to that appearance.

### Implementation for User Story 1

- [X] T004 [P] [US1] In `src/lib/personGlyphs.ts`, add the five-entry `TONE_MODIFIERS` map (`light` = `\u{1F3FB}`, `mediumLight` = `\u{1F3FC}`, `medium` = `\u{1F3FD}`, `mediumDark` = `\u{1F3FE}`, `dark` = `\u{1F3FF}`) and a `composePicture(variant, tone, frame)` function that builds the FR-005 sequence — base emoji, then the tone modifier (for non-`'default'` tones), then, for `man`/`woman`, the existing ZWJ + gender sign + VS16 tail already embedded in `GLYPHS[variant][frame]` — reusing the existing `GLYPHS` table as the base/gendered-suffix source rather than hand-writing 54 literals (research.md §2)
- [X] T005 [US1] In `src/lib/personGlyphs.ts`, build a module-scope `TONED_GLYPHS: Readonly<Record<PersonVariant, Readonly<Record<PersonTone, Readonly<Record<PersonFrame, string>>>>>>` constant from `composePicture`, computed once at module load (depends on T004)
- [X] T006 [US1] In `src/lib/personGlyphs.ts`, widen `PersonPictureSet.pictures` to `Readonly<Record<PersonVariant, Readonly<Record<PersonTone, Readonly<Record<PersonFrame, string>>>>>>`, add `readonly drawableTones: readonly PersonTone[];`, and update `frameFor` to `frameFor(pictureSet, variant, tone, frame)` returning `pictureSet.pictures[variant][tone][frame]` (contracts/sim-and-shell-contracts.md `src/lib/personGlyphs.ts`) — implementation of the tone-resolution rung itself is T012–T014 (US3); this task only reshapes the type and `frameFor`'s signature so US1's placement/continuity tests can compile
- [X] T007 [US1] In `src/sim/pets.ts`, add `pickPersonTone(state, drawableTones, rng)` as a byte-for-byte structural twin of `pickPersonVariant` (~line 230), operating on `state.personToneBag` (data-model.md "Tone bag", research.md §5)
- [X] T008 [US1] In `src/sim/pets.ts`, widen `addPerson`'s signature to accept a new `drawableTones: readonly PersonTone[]` parameter (positioned after `drawableVariants`, before `rng`) and assign `tone: pickPersonTone(state, drawableTones, rng)` in the pushed `Person` object (~line 251)
- [X] T009 [US1] In `src/sim/pets.ts`, widen `restorePeopleFromPositions`'s `positions` parameter type to `readonly { x: number; y: number; variant: PersonVariant; tone: PersonTone }[]` and carry `tone: p.tone` through verbatim in the mapped `Person` (~line 207)
- [X] T010 [US1] In `src/lib/PlayArea.svelte`, update the `frameFor` call site (~line 600–601) to pass `person.tone`: `frameFor(personPictureSet, person.variant, person.tone, 'standing')` / `frameFor(personPictureSet, person.variant, person.tone, person.state)`; update the `addPerson` call site (~line 851) to pass `personPictureSet.drawableTones` alongside the existing `personPictureSet.drawableVariants`
- [X] T011 [P] [US1] In `tests/unit/lib/personGlyphs.test.ts`, add table-driven assertions pinning `composePicture`/`TONED_GLYPHS` output for a representative sample spanning every variant × every tone × every frame (or all 54): assert the exact codepoint sequence is base, then tone modifier, then (for gendered forms) ZWJ + gender sign + VS16 — modifier before the joiner, never after the gender sign (FR-004, FR-005, quickstart.md's composition-order row)
- [X] T012 [P] [US1] In `tests/unit/sim/pets.test.ts`, add a test that places a person via `addPerson` with a seeded `rng` and a fully-drawable `drawableTones`, then runs hundreds of `stepPeople` frames including a poke (`pokePersonAt`) and asserts `person.tone` and `person.variant` are unchanged throughout every frame, every state (`standing`/`walking`/`running`), and both facings (US1 Acceptance Scenarios 1–3)
- [X] T013 [US1] In `tests/unit/sim/pets.test.ts`, add a test asserting `frameFor(pictureSet, variant, tone, frame)` (via a fabricated all-drawable `PersonPictureSet`) returns the picture belonging to that exact (variant, tone, frame) triple for every combination reachable from a placed person's fields — never a different tone's or a different frame's picture (US1 Acceptance Scenario 4)

**Checkpoint**: A person placed on an all-capable device keeps one fixed (form, tone) pair for life, and every (form, tone, frame) lookup is provably correct. `npm test` still fails at this point wherever a tone-resolution call site (`resolvePersonPictureSet`) hasn't been updated yet — that's Phase 4 (US3), completed before this phase's tests can pass end-to-end; see Dependencies below.

---

## Phase 4: User Story 3 - Never a broken picture, on any device (Priority: P1)

**Goal**: An unsupported tone is dropped from the drawable set entirely; a device with no drawable modifier tone falls back to default with no stall or exception; the toolbar button never shows anything but the untoned neutral stander.

**Independent Test**: Feed `resolvePersonPictureSet` fabricated `GlyphProbeInputs` (every toned picture fine; one tone splitting on one frame of one form; all five tones splitting; gendered forms splitting and tones splitting; the untoned stander missing; a probe that throws; a probe returning zero/nonsense widths) and assert the exact resolved `drawableTones` and `pictures` each time — no DOM.

**Why placed before US2's tests can fully close the loop**: US2's independent test needs `drawableTones` to come from a real resolver output shape; this phase is what produces it. (Both US1 and US2's own tests use hand-fabricated `drawableTones` arrays directly and do not block on this phase — only the end-to-end `npm test` green bar, and US2's Acceptance Scenario 3 replay against a real resolver output, do.)

### Implementation for User Story 3

- [X] T014 [US3] In `src/lib/personGlyphs.ts`, after the existing three rungs of `resolvePersonPictureSet` run unchanged (gendered → neutral, standing → walking, running → hop), add a tone rung: for each modifier tone, for each `variant` in `drawableVariants` and each frame in the *distinct set of frames actually drawn* for that variant (`{'standing','walking','running'}`, or `{'walking','running'}` when `pictures[variant].standing === pictures[variant].walking`, i.e. rung 2 already collapsed standing into walking), run `safeCanRender`/width-vs-untoned-counterpart checks (mirroring `isGenderedGlyphOk`'s shape, reusing each frame's already-resolved untoned width as the one-time baseline for all five tones' checks against it) — a tone is usable only if every one of those checks passes (FR-010, FR-011, FR-012, research.md §3)
- [X] T015 [US3] In `src/lib/personGlyphs.ts`, build `drawableTones = ['default', ...usable modifier tones]` (unconditionally including `'default'`) and build the widened `pictures` table from `TONED_GLYPHS`/`drawableTones`: for every `variant` and every tone in `drawableTones`, populate the resolved (possibly rung-2-collapsed) toned picture; for every `variant` and every tone **not** in `drawableTones`, populate `pictures[variant][tone][frame] := pictures[variant]['default'][frame]` (FR-017's substitution, a value copy at resolution time, never a per-draw branch) (depends on T014)
- [X] T016 [US3] In `src/lib/personGlyphs.ts`, update `resolvePersonPictureSet`'s return statement so `toolbarGlyph: pictures.neutral.default.standing` (was `pictures.neutral.standing`) — the one-line consequence of `pictures` gaining a tone dimension (FR-015, research.md §9)
- [X] T017 [P] [US3] In `tests/unit/lib/personGlyphs.test.ts`, add `resolvePersonPictureSet` cases for: every toned picture fine (`drawableTones` has all six); exactly one tone splitting on exactly one frame of one form (that tone absent, all others present); all five modifier tones splitting (`drawableTones === ['default']`, no stall/exception); gendered forms splitting *and* tones splitting (tones judged only against `['neutral']`); a probe that throws; a probe returning zero or non-finite widths — asserting the exact `drawableTones` array each time (FR-026, quickstart.md's probe-ladder row)
- [X] T018 [P] [US3] In `tests/unit/lib/personGlyphs.test.ts`, add the FR-012 ordering pair: (a) a probe where the untoned neutral stander is tofu (so rung 2 already substitutes walking) but the toned walker/runner are fine — assert that tone survives despite its own toned-stander picture being unprobed/unavailable; (b) a probe where the untoned stander is fine but the toned stander alone splits — assert that tone is dropped (US3 Acceptance Scenarios 2 & 8, FR-012)
- [X] T019 [P] [US3] In `tests/unit/lib/personGlyphs.test.ts`, add an assertion sweeping every fabricated probe outcome from T017–T018 and asserting no value anywhere in the resulting `pictures` table is an unresolved raw split composition (i.e., every non-drawable tone's entries equal that variant's `'default'`-tone entries) and `toolbarGlyph` always equals `pictures.neutral.default.standing` (US1 Acceptance Scenario 4, US3 Acceptance Scenario 7, FR-014, FR-015)
- [X] T020 [P] [US3] In `tests/unit/sim/pets.test.ts`, add a test that `pickPersonTone`/`addPerson` with `drawableTones = ['default']` (the collapsed-bag case) never stalls, throws, or returns anything but `'default'` across many consecutive placements (US3 Acceptance Scenario 3, FR-013)

**Checkpoint**: Every fabricated probe outcome resolves to a safe, never-split `drawableTones`/`pictures` pair; the toolbar glyph is provably invariant. Combined with Phase 3, `npm test` is now green end-to-end for placement, continuity, and glyph safety.

---

## Phase 5: User Story 2 - Three people, three different people (Priority: P1)

**Goal**: Placements cycle tone and form as two independent no-repeat bags — three placements differ on both axes, six placements exhaust all six tones before any repeat, and a partially-capable device cycles only its drawable tones.

**Independent Test**: Seeded randomness against an all-drawable probe result: six consecutive placements yield six distinct tones; three consecutive placements yield three distinct forms *and* three distinct tones; a seventh placement starts a fresh tone cycle; a partially-drawable probe result never yields an undrawable tone and never stalls or repeats early within a cycle.

### Implementation for User Story 2

No new production code — `pickPersonTone`/`addPerson`'s two-bag independence already falls out of T007/T008's structural mirroring of the existing variant bag (research.md §5: "independence... falls out of using two separate bag arrays and two separate shuffle calls, not from call order"). This phase is tests-only.

- [X] T021 [P] [US2] In `tests/unit/sim/pets.test.ts`, add a seeded-`rng` test with `drawableTones` = all six: assert 6 consecutive `pickPersonTone` calls yield all 6 distinct tones before any repeat, and a 7th call starts a fresh cycle (US2 Acceptance Scenario 2, FR-006, SC-001)
- [X] T022 [P] [US2] In `tests/unit/sim/pets.test.ts`, add a seeded-`rng` test with both `drawableVariants` (3) and `drawableTones` (6) fully drawable: assert 3 consecutive `addPerson` calls yield 3 distinct `variant` values *and* (independently) 3 distinct `tone` values (US2 Acceptance Scenario 1, FR-007, SC-001)
- [X] T023 [P] [US2] In `tests/unit/sim/pets.test.ts`, add a test with `drawableTones` holding only 2–3 entries: repeated `pickPersonTone` calls cycle only over those entries, never yield one outside the set, and never repeat within a cycle (US2 Acceptance Scenario 3, edge case "six people over time on a device with only two drawable tones")
- [X] T024 [P] [US2] In `tests/unit/sim/pets.test.ts`, add a test that exhausts the tone bag's cycle mid-way through the variant bag's own cycle (different-length `drawableTones`/`drawableVariants`, e.g. 2 tones vs. 3 variants) and asserts each bag's position is unaffected by the other's wraparound (US2 Acceptance Scenario 5, FR-007)

**Checkpoint**: Both bags are proven independent and non-repeating under every drawable-set size tested. All three P1 "variety and safety" stories (US1, US2, US3) are now demonstrable together — this is the MVP boundary.

---

## Phase 6: User Story 4 - The people she already has come back (Priority: P1)

**Goal**: A spec-018 save (people with `variant`, no `tone` key) restores every person at the same position and form, now in the default tone, with no rejection and no message; a pre-018 placed-object migration still produces default-tone walkers.

**Independent Test**: Feed the world-restore and history-restore paths a spec-018 payload with no tone field, a payload with an unrecognised/empty tone for one person, and a pre-018 placed-object payload; assert each restores fully, unknown/missing tones read as default, and the rest of the world is untouched.

### Implementation for User Story 4

- [X] T025 [US4] In `src/sim/save.ts`, add `function isPersonTone(value: unknown): value is PersonTone` (mirrors `isPersonVariant` at ~line 206: `value === 'default' || value === 'light' || value === 'mediumLight' || value === 'medium' || value === 'mediumDark' || value === 'dark'`) and `function resolvedTone(raw: unknown): PersonTone { return isPersonTone(raw) ? raw : 'default'; }`, kept deliberately **outside** `isPersonShape`'s boolean gate (research.md §7, FR-018)
- [X] T026 [US4] In `src/sim/save.ts`, add `tone?: unknown` to the internal `WirePerson` interface (~line 111–115, alongside `x`/`y`/`variant`); widen the `SavedWorld.people` element type (~line 16) to `{ x: number; y: number; variant: PersonVariant; tone: PersonTone }`; update `parsePeople` (~line 233–240) to push `tone: resolvedTone(item.tone)` per already-shape-valid item, and update the serialize side (~line 155) to write `tone: person.tone` into each mapped `WirePerson` (depends on T025)
- [X] T027 [US4] In `src/sim/save.ts`, update the legacy pre-018 `byKind.person` migration path (~line 318–341) so each migrated entry gets `tone: 'default'` alongside its existing `variant: 'neutral' as const` (research.md §10) — `migrateLegacyPersonObjects` itself is unchanged; the `tone` field is added where the migrated `{x, y, variant}` tuple is assembled into the people list
- [X] T028 [US4] In `src/sim/historySave.ts`, apply the same three changes as T025–T027 to `WireHistoryPerson`, `isWireHistoryPersonShape`'s sibling `resolvedTone` usage, `parseHistoryPeople` (~line 181–188), the serialize side (~line 88), and the legacy migration path (~line 264–284) — an independent tolerant-per-person resolution, not shared code with `save.ts` (contracts/sim-and-shell-contracts.md `src/sim/historySave.ts`)
- [X] T029 [P] [US4] In `tests/unit/sim/save.test.ts`, add a test that `deserializeWorld` on a wire payload shaped like a pre-this-feature save (`people` entries with `variant` but no `tone` key) restores every person with `tone: 'default'`, correct position and variant, and the rest of the world untouched (US4 Acceptance Scenario 1, FR-020)
- [X] T030 [P] [US4] In `tests/unit/sim/save.test.ts`, add a test with 3 people where one has `tone: 'chartreuse'` (and a variant with `tone: ''`, and one with `tone: null`, as separate cases or one combined case) — assert only the malformed one(s) fall back to `'default'`, the others keep their tones, and no person or other world content is dropped (US4 Acceptance Scenario 2, FR-018)
- [X] T031 [P] [US4] In `tests/unit/sim/save.test.ts`, add a test that `deserializeWorld` on a pre-018 payload (`byKind.person` present, no `people` array shape at all) produces migrated people with `tone: 'default'` and `variant: 'neutral'`, honouring `PERSON_CAP` (US4 Acceptance Scenario 3, FR-020)
- [X] T032 [P] [US4] In `tests/unit/sim/historySave.test.ts`, add the same three cases as T029–T031 against the history-save path (`WireHistoryPerson`/`parseHistoryPeople`/legacy migration)
- [X] T033 [P] [US4] In `tests/unit/sim/save.test.ts` and `tests/unit/sim/historySave.test.ts`, add an assertion that `SAVE_VERSION`/`HISTORY_SAVE_VERSION` constants are unchanged, and that a save/history payload containing `tone` data still restores correct position/variant when parsed by logic that ignores the `tone` key entirely (simulating a pre-feature reader) (US4 Acceptance Scenarios 4–5, FR-019, SC-006)

**Checkpoint**: Every restore path — fresh spec-018 saves, malformed tones, and pre-018 legacy migration — is tolerant and non-destructive, on both the world-save and history-save formats, with zero format-version change.

---

## Phase 7: User Story 5 - Tone survives the whole world (Priority: P2)

**Goal**: Tone round-trips through save/restore, undo/redo, and grid re-derivation exactly like position and form; a restored person whose stored tone this device can't draw renders as default while her stored tone survives a further save; two worlds differing only in tone are treated as different by history's change detection.

**Independent Test**: Unit tests over save/restore, undo/redo, and resize asserting person count, positions, forms, *and* tones before and after; a restore-then-resave test for an undrawable stored tone; a `worldMatches` test isolating a tone-only difference.

### Implementation for User Story 5

- [X] T034 [US5] In `src/sim/history.ts`, widen `WorldState.people`'s element type (~line 29) to `{ x: number; y: number; variant: PersonVariant; tone: PersonTone }`, and update the `captureWorldState` mapping (~line 60) and the resize/remap mapping (~line 280–286) to include `tone: p.tone` (contracts/sim-and-shell-contracts.md `src/sim/history.ts`; `captureWorldState`/`restoreWorldState`/`remapWorldState` carry the entry shape through structurally, so no other line in those functions needs to change — research.md §8)
- [X] T035 [US5] In `src/sim/history.ts`, widen `worldMatches`'s per-person comparison (~line 360) from `a.x !== b.x || a.y !== b.y || a.variant !== b.variant` to also include `|| a.tone !== b.tone` (FR-021, research.md §8)
- [X] T036 [US5] In `src/lib/PlayArea.svelte`, confirm (no code change expected) that `restorePeopleFromPositions(pets, state.people)` at the undo/redo restore call site (~line 166) and the resize/remap call site already pass through whatever shape `WorldState.people`'s entries have — verify by running `npm test` after T034/T009 land that both call sites type-check with `tone` included
- [X] T037 [P] [US5] In `tests/unit/sim/save.test.ts`, add a round-trip test: place people of every one of the six tones (`addPerson` with a seeded `rng` and full `drawableTones`), `serializeWorld`, `deserializeWorld`, and assert every person's tone is unchanged — zero tone drift (US5 Acceptance Scenario 1, SC-004)
- [X] T038 [P] [US5] In `tests/unit/sim/history.test.ts`, add an undo/redo round-trip test: place a person, `commitAction`, `undo` (person gone), `redo` (person back at the same position, form, *and* tone) (US5 Acceptance Scenario 2)
- [X] T039 [P] [US5] In `tests/unit/sim/resize.test.ts`, add a test that people of several tones survive `repositionPeople`/grid re-derivation with their tones intact, exactly like position and form already are (US5 Acceptance Scenario 3) — no production code change expected here (research.md §6); this is a regression/coverage check on already-correct pass-through behavior
- [X] T040 [P] [US5] In `tests/unit/sim/history.test.ts`, add a `worldMatches` test with two otherwise-identical `WorldState`s differing only in one person's `tone`, asserting `worldMatches` returns `false` (US5 Acceptance Scenario 4, FR-021)
- [X] T041 [P] [US5] In `tests/unit/sim/save.test.ts`, add a test that restores a person with `tone: 'medium'` against a fabricated `PersonPictureSet` whose `drawableTones` excludes `'medium'`: assert `frameFor(pictureSet, person.variant, person.tone, frame)` returns the default-tone picture for that (variant, frame) while `person.tone === 'medium'` still holds in memory, and that a subsequent `serializeWorld` still writes `tone: 'medium'` for that person (US5 Acceptance Scenario 5, FR-017, SC-004)

**Checkpoint**: Tone is durable across every persistence and re-derivation path this toy has, including the cross-device undrawable-tone substitution, with a dedicated regression test proving the substitution never leaks back into storage.

---

## Phase 8: User Story 6 - Everything else still works (Priority: P2)

**Goal**: Every spec-018 behaviour — stroll cadence, poke-to-run and its hop fallback, eraser reach, clear-all, the cap of three, poodles, mermaids — is provably unaffected by tone.

**Independent Test**: Existing spec-018 suites pass unchanged, plus targeted assertions that stroll cadence, poke-to-run (including the hop fallback), eraser reach, clear-all, and the cap of three are unaffected by tone.

### Implementation for User Story 6

No production code changes — `repositionPeople`, `erasePeopleInBrush(Line)`, `pokePersonAt`, `stepPeople`, `clearPets`, and `PERSON_CAP` eviction never read or write `variant` today and therefore need no change to read or write `tone` either (research.md §6, FR-023). This phase is a regression/coverage pass.

- [X] T042 [P] [US6] Run the full existing suite (`npm test`) and confirm every pre-existing spec-018 test in `tests/unit/sim/pets.test.ts`, `objects.test.ts`, `history.test.ts`, `save.test.ts`, `historySave.test.ts`, and `resize.test.ts` still passes unchanged after Phases 2–7 (FR-025)
- [X] T043 [P] [US6] In `tests/unit/sim/pets.test.ts`, add a test that people of mixed tones stroll, pause, step up ledges, and turn at edges identically regardless of tone (place two people with different tones via a fabricated `drawableTones`, run `stepPeople` in lockstep, assert their state/position transitions are identical apart from starting position) (US6 Acceptance Scenario 1)
- [X] T044 [P] [US6] In `tests/unit/sim/pets.test.ts`, add a test that `pokePersonAt` on a person of any tone starts her running in her own tone and form, and that the existing hop fallback (`canRunPicture === false`) is unaffected by tone (US6 Acceptance Scenario 2)
- [X] T045 [P] [US6] In `tests/unit/sim/pets.test.ts`, add a test that `erasePeopleInBrush`/`erasePeopleInBrushLine` and a fourth-placement cap eviction (`PERSON_CAP`) behave identically regardless of the erased/evicted/retiring person's tone, and that a retired person's tone does not disturb `personToneBag`'s cycle position for the remaining people (US6 Acceptance Scenarios 3–4, edge case "a person poked mid-cycle, evicted, or erased... none of these... replays or rewinds the bag")
- [X] T046 [P] [US6] Confirm (via existing suites, no new test needed unless a gap is found) that poodles, mermaids, and every placed object are untouched by any code path this feature adds — spot-check `tests/unit/sim/objects.test.ts`/`mermaid.test.ts` pass unchanged (US6 Acceptance Scenario 5, FR-025)

**Checkpoint**: All six user stories are independently demonstrable; the full regression net is green.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final invariant/perf/build checks spanning every story.

- [X] T047 [P] Re-run `tests/unit/lib/layout.test.ts`'s toolbar control-count sweep as a regression check — confirm it needs no edit (plan.md "Toolbar cost: zero")
- [X] T048 Run `npm run build` and confirm it still emits a single self-contained `dist/index.html` that plays from `file://`, with no new dependency, asset, or build step (FR-024, SC-010)
- [X] T049 Manual/eyeball validation per quickstart.md: `npm run dev`, place several people, confirm they visibly differ in both tone and form, confirm tone/form never change mid-cycle (poke to run), confirm the toolbar person button is unchanged, confirm save/restore and undo/redo preserve tone, and confirm a pre-feature save (if available) restores every person in the default tone with no error (quickstart.md "Manual / eyeball validation", FR-027) — flag the two platform-specific checks (toned figures reading as the same person across frames; toned man/woman forms as one figure vs. a figure-plus-square) for the *other* maintainer's device per CLAUDE.md's platform table, since neither maintainer can verify the other's device — **not runnable in this headless implement session (no browser/display available); left for a maintainer to eyeball on both the Fire 7 Kids tablet/desktop Chrome and iPad Safari before merge**

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately. BLOCKS every later phase (all of them read/write `Person.tone` or `PetsState.personToneBag`).
- **US1 (Phase 3)**: Depends on Phase 2. Its production code (T004–T010) can proceed independently of US3's tone-resolution rung, but its tests (T011–T013) exercise `frameFor`'s new 4-argument signature and a fabricated (not resolver-produced) `PersonPictureSet`, so they do not need US3 to be done first.
- **US3 (Phase 4)**: Depends on Phase 2 and on T006 (the `PersonPictureSet`/`frameFor` reshape from US1) for its type surface, but its own resolver logic (T014–T016) is independent of US1's `addPerson`/`pickPersonTone` work. In practice, land Phase 3 and Phase 4 together before either's tests can pass end-to-end via `npm test`, since `App.svelte`'s single `resolvePersonPictureSet` call site is what supplies real `drawableTones` to `addPerson` in production.
- **US2 (Phase 5)**: Depends on Phase 3 (T007/T008, the bag mechanism). Tests-only phase.
- **US4 (Phase 6)**: Depends on Phase 2 (needs `PersonTone`) but is otherwise independent of US1/US3's rendering work — it only touches `save.ts`/`historySave.ts`. Can run in parallel with Phases 3–5 by a second contributor.
- **US5 (Phase 7)**: Depends on Phase 2, Phase 3 (T009, `restorePeopleFromPositions`), and Phase 6 (T026/T028, the widened wire shapes) — its round-trip tests exercise both the sim-level restore and the wire-level (de)serialization together.
- **US6 (Phase 8)**: Depends on Phase 3 (people must exist with tone) but is otherwise a pure regression pass; can start as soon as Phase 3 lands.
- **Polish (Phase 9)**: Depends on all of Phases 2–8.

### Recommended Order

Given the shared-file coupling above (most stories touch the same few files), sequential delivery in priority order is simpler than parallel-team delivery for this feature:

1. Phase 2 (Foundational)
2. Phase 3 (US1) + Phase 4 (US3) together — both are needed before `npm test` is green end-to-end, and both touch `src/lib/personGlyphs.ts` (T004–T006 then T014–T016 in the same file, sequentially)
3. Phase 5 (US2) — tests-only, fast
4. Phase 6 (US4) — independent file surface (`save.ts`/`historySave.ts`); could be done by a second contributor in parallel with step 2 once Phase 2 lands
5. Phase 7 (US5) — needs both 2's and 6's output
6. Phase 8 (US6) — regression pass, can start once Phase 3 lands, finish after Phase 7
7. Phase 9 (Polish)

### Parallel Opportunities

- Within Phase 4: T017, T018, T019, T020 are all `[P]` (independent test cases, same file `personGlyphs.test.ts`/`pets.test.ts` but non-overlapping test blocks)
- Within Phase 5: T021–T024 are all `[P]` (independent test cases in `pets.test.ts`)
- Within Phase 6: T029–T033 are all `[P]` (independent test cases across `save.test.ts`/`historySave.test.ts`)
- Within Phase 7: T037–T041 are all `[P]` (independent test cases across `save.test.ts`/`history.test.ts`/`resize.test.ts`)
- Within Phase 8: T042–T046 are all `[P]`
- Phase 6 (US4, `save.ts`/`historySave.ts`) can proceed in parallel with Phases 3–4 (US1/US3, `personGlyphs.ts`/`pets.ts`) by a second contributor, since they touch disjoint files until Phase 7 needs both

---

## Implementation Strategy

### MVP First (User Stories 1 + 3 + 2)

All three are Priority P1 and mutually load-bearing: US1 (tone exists and is fixed) needs US3 (tone resolution never produces a broken picture) to be safe to ship at all, and US2 (variety) is what makes the feature visible. Together:

1. Complete Phase 2: Foundational
2. Complete Phase 3: User Story 1
3. Complete Phase 4: User Story 3
4. Complete Phase 5: User Story 2
5. **STOP and VALIDATE**: `npm test` green, manual eyeball check on desktop Chrome per quickstart.md
6. This is the demoable MVP — people come in six tones, safely, with variety

### Incremental Delivery

1. Foundational → nothing visible yet, but everything compiles
2. US1 + US3 + US2 → MVP: tones work, are safe on every device, and vary
3. US4 → old saves still open correctly (required before shipping to an existing user, not just for a fresh install)
4. US5 → tone survives the whole session lifecycle (saves, undo, resize, cross-device)
5. US6 → regression net confirms nothing else broke
6. Polish → build/perf/manual sign-off
