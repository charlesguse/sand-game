# Quickstart: validating "People Who Stand, Walk, And Run"

This feature has no DOM/browser test harness (constitution Principle V) —
validation is plain `vitest` over `src/sim/*` and `src/lib/*`, plus one
maintainer eyeball pass per platform for the two checks FR-032 explicitly
says neither maintainer can verify for the other's device. No new build
step, no new dependency.

## Prerequisites

```bash
npm install   # only if node_modules isn't already present
```

## Automated validation

```bash
npm test        # the merge gate — must stay green (FR-029: no existing test may weaken)
npm run build   # must still emit a single dist/index.html (FR-030, SC-008)
```

`npm test` is expected to grow the following coverage (FR-031), mapped to
each user story's Independent Test in spec.md — see data-model.md and
contracts/sim-and-shell-contracts.md for the exact shapes involved:

| Rule | Where it's exercised | Shape of the check |
|---|---|---|
| A person settles onto a solid surface (or the floor) after placement | `tests/unit/sim/pets.test.ts` (or a new `person.test.ts`) | `addPerson` on hills/flat ground/mid-air/water; run `stepPeople` a few frames; assert she ends up on a solid cell or the floor, never sinking through (US1, FR-004) |
| Alternates walking and standing, bounded roaming range, never freezes or moves every frame | same | Run hundreds of frames with no poke; assert `state` visits both `'standing'` and `'walking'`, position changes over time, and never strays more than the roam range from her settle point (SC-002, FR-005) |
| Facing matches direction of travel; frame matches state | same | Assert `facing` flips with `wanderDir`, and the drawn frame (`state`) is `'walking'` exactly on frames she moves and `'standing'` when paused (US1 Acceptance Scenario 3, FR-010/FR-011) |
| Steps up a small ledge; turns around at a taller wall; never climbs/clips | same | Build a 1–2 cell step and a taller wall; assert she mounts the small one and turns around at the tall one (US1 Acceptance Scenario 4, FR-004) |
| Cap of 3, oldest evicted | same | `addPerson` a 4th time; assert exactly 3 remain, oldest gone (FR-003, mirrors `POODLE_CAP`'s/`MERMAID_CAP`'s existing tests) |
| Ignores a finger target entirely; poodle's finger-follow is unaffected | same | Call `stepPets(grid, pets, target)` with a non-null target; assert no person's position is influenced by it while a poodle's is (US1 Acceptance Scenario 6, FR-006) |
| Never made solid; sand falls past her | `tests/unit/sim/pets.test.ts`, `brush.test.ts` | Place a person, pour `SAND` onto her cell via `applyBrush`; assert the cell's element is unaffected by her presence — no grid write comes from `Person` at all (US1 Acceptance Scenario 7, FR-009) |
| Buried, airborne, or off-grid recovers within a bounded number of frames | same | Bury her (`SAND`/`GUMDROP`), levitate her (`y` above ground with nothing below), and place her at `x = 0`/`width - 1`; assert she's back on a surface inside the grid within a small bounded frame count (SC-001, FR-007) |
| 2,000-frame adversarial-terrain stress: hills, ledges, walls, pits, sand poured on her, ground erased from under her | same | One combined long-run test mirroring spec 016's T058-style stress test; assert 0 stuck states across the whole run (SC-001) |
| Frame-selection is a pure function of state, variant, and picture set | `tests/unit/sim/pets.test.ts` or `lib/personGlyphs.test.ts` | Table-test every `(variant, state)` combination against a fabricated `PersonPictureSet`; assert the exact picture returned (US2, FR-010) |
| Variant is fixed at placement and never changes | `tests/unit/sim/pets.test.ts` | `addPerson`, run hundreds of frames including a poke, assert `variant` unchanged throughout (US2 Acceptance Scenario 1, FR-012) |
| No-repeat variant cycle, seeded | `tests/unit/lib/personGlyphs.test.ts` or `sim/person.test.ts` | Seeded `rng`, `drawableVariants = ['neutral','man','woman']`: 3 consecutive `pickPersonVariant` calls yield all 3, in an order the seed determines; repeat with `drawableVariants = ['neutral']` and assert every call returns `'neutral'` (FR-013a, SC-005a) |
| Variant survives save/restore and undo/redo | `tests/unit/sim/save.test.ts`, `history.test.ts` | Place people of each variant; round-trip through `serializeWorld`/`deserializeWorld` and through `HistoryManager.undo`/`redo`; assert variant unchanged (US2 Acceptance Scenario 4, FR-023) |
| Glyph probe fallback ladder — every FR-018 case | `tests/unit/lib/personGlyphs.test.ts` | Fabricate `GlyphProbeInputs` for: everything supported; standing missing; running missing; gendered forms splitting (measureWidth ≈ 2x); nothing supported; a probe that throws or returns nonsense for one glyph. Assert the exact `PersonPictureSet` produced in each case, including `toolbarGlyph` and `canRunPicture` (US3, FR-017–FR-020) |
| Toolbar glyph and canvas glyphs never disagree | `tests/unit/lib/personGlyphs.test.ts` | For each fabricated probe result, assert `toolbarGlyph === pictures.neutral.standing` (FR-015) |
| Probe runs at most once per session | Architectural, not directly unit-tested (no DOM harness to observe a real call count) — verified by code review of the single call site in `App.svelte`/`PlayArea.svelte`'s setup (FR-020) | — |
| Old placed-object person migrates into a walker at the same position | `tests/unit/sim/save.test.ts`, `objects.test.ts` | Feed `deserializeWorld` a wire payload shaped like a pre-feature save (`byKind.person` present, no `people` key); assert the result's people list has one entry at the footprint's center, `variant: 'neutral'` (US4 Acceptance Scenario 1, FR-026) |
| Old footprint cells are released, not left as invisible solid blocks | `tests/unit/sim/objects.test.ts` | `migrateLegacyPersonObjects` on a grid with `OBJECT` cells stamped at a person's old footprint; assert those cells become `EMPTY` unless still covered by a surviving rainbow/unicorn/etc. object (US4 Acceptance Scenario 2, FR-027) |
| Old stored undo history migrates people into walkers | `tests/unit/sim/historySave.test.ts`, `history.test.ts` | Feed `deserializeHistory` a step shaped like a pre-feature persisted history entry; assert people come back as walkers (US4 Acceptance Scenario 3, FR-026) |
| Missing/empty/malformed walker list still restores the rest of the world | `tests/unit/sim/save.test.ts`, `historySave.test.ts` | Wire payload with `people` absent, `null`, or containing a malformed entry; assert the rest of the world restores and `people` defaults to `[]` with no thrown error (US4 Acceptance Scenario 4, FR-025) |
| Old saves' migration respects the cap of 3 even with 3 poodles and 3 mermaids also present | `tests/unit/sim/save.test.ts` | A wire payload with 3 `byKind.person` entries, 3 poodles, 3 mermaids; assert migration never produces more than 3 people and the other pets are untouched (Edge Cases) |
| Save-version and history-version numbers unchanged | `tests/unit/sim/save.test.ts`, `historySave.test.ts` | Assert `SAVE_VERSION`/`HISTORY_SAVE_VERSION` constants are the same values as before this feature (FR-025) |
| Poke → running for a bounded duration, then back to strolling | `tests/unit/sim/pets.test.ts` | `pokePersonAt` at her position; assert `state === 'running'` then, after `PERSON_RUN_DURATION` frames, back to `'standing'`/`'walking'` (US5 Acceptance Scenario 1, FR-016) |
| Poke ignored while already reacting | same | `pokePersonAt` again mid-run; assert no change to her `timer`/`state` (US5 Acceptance Scenario 2, FR-016) |
| Poke with eraser selected erases instead | `tests/unit/lib/PlayArea` wiring is not DOM-tested directly; assert at the `sim` layer that the eraser path calls `erasePeopleInBrush` and never `pokePersonAt` — verified by the shell wiring contract plus an `objects`/`pets`-level erase test | Tap-on-her-with-eraser removes her from `pets.people` (US5 Acceptance Scenario 3, FR-016) |
| Poke with no running picture produces a hop, never a no-op | `tests/unit/lib/personGlyphs.test.ts` + `pets.test.ts` | `canRunPicture: false` in the fabricated picture set; assert the sim state still transitions to `'running'` (a reaction always happens) — the *rendering* choice (hop vs. glyph) is asserted separately at the picture-set level (US5 Acceptance Scenario 5, FR-016a) |
| Eraser removes a person, including a fast drag whose samples straddle her | `tests/unit/sim/pets.test.ts` | `erasePeopleInBrushLine` with `from`/`to` straddling her position at various radii (US6 Acceptance Scenario 1, FR-021) |
| Clear-all removes every person | `tests/unit/sim/pets.test.ts` | `clearPets` empties `people` alongside `poodles`/`mermaids` (US6 Acceptance Scenario 2, FR-022) |
| Undo/redo round-trips a placed person, position and variant | `tests/unit/sim/history.test.ts` | `HistoryManager` cycle: place a person, commit, undo (assert gone), redo (assert back, same position and variant) (US6 Acceptance Scenario 3, FR-024) |
| Grid re-derivation remaps people (clamped, never dropped), roaming anchor moves with them | `tests/unit/sim/resize.test.ts`, `history.test.ts` | `repositionPeople` offset+clamp assertions mirroring `repositionPoodles`/`repositionMermaids`'s existing tests; assert `homeX` is re-anchored so strolling keeps working afterwards (US6 Acceptance Scenario 4, FR-028) |
| Every other object/pet kind is completely unaffected | Existing suites, re-run unchanged | `tests/unit/sim/objects.test.ts`, `pets.test.ts` (poodle/mermaid sections), `history.test.ts`, `save.test.ts` — this is the regression net (US6 Acceptance Scenario 5, FR-029) |
| `'person'` is a valid `Tool` but not an `ObjectKind`; `OBJECT_KINDS` has 6 entries, not 7 | `tests/unit/sim/objects.test.ts`, a type-level check via `tsc` (build) | Assert `OBJECT_KINDS` no longer contains `'person'`; assert no grid-element id was added (`ICE_CREAM`/`DIAMOND` unchanged) (FR-001, FR-009) |
| Toolbar control count is byte-for-byte unchanged | `tests/unit/lib/layout.test.ts` (no file edit needed) | Existing sweep re-runs unchanged — this is a **regression** check, not a new-count check, since `tool-person` already existed (FR-002, FR-006, SC-006) |
| `toolbarGlyphs.test.ts`'s stale "person is 🧑, never 🧍" assertion is replaced | `tests/unit/shell/toolbarGlyphs.test.ts`, `tests/unit/lib/personGlyphs.test.ts` | Old source-text-grep assertion removed; new assertion checks `resolvePersonPictureSet`'s output directly (research.md §11) |

## Manual / eyeball validation (constitution Principle V: not automatable)

1. `npm run dev`, open in a desktop browser.
2. Paint some hills, tap the person button, tap onto the terrain — confirm
   she settles on the surface and, after a moment, starts an unhurried
   stroll: a few steps, a pause, a few more steps — not a strobe, not
   frozen.
3. Place three people; confirm they read as visibly different figures (or
   all the same neutral figure, on a font without gendered support) and
   never all identical on a capable font.
4. Poke a person directly — confirm a brief run, then a return to
   strolling; poke elsewhere — confirm the tap just paints.
5. Pour sand on a strolling person; confirm sand falls past her (she's not
   a wall) and, if it buries her, she frees herself within a second or two.
6. Erase a person with the eraser tool; confirm a fast swipe through her
   still removes her.
7. Toggle fullscreen / resize the window (re-derivation); confirm every
   person is still there, inside the grid, still strolling afterwards.
8. Undo immediately after placing a person — confirm she disappears; redo —
   confirm she's back, same spot, same variant.
9. Close and reopen the tab (or trigger the visibility-flush save); confirm
   people come back as walkers, same positions, same variants.
10. If you have a save from before this feature shipped (people as a static
    🧑 object), open it — confirm every old person appears as a walker at
    the same place, and nothing behaves like an invisible wall where she
    used to stand.
11. **Flag for the other maintainer** (per CLAUDE.md's platform table and
    FR-032, since neither maintainer can verify the other's device):
    (a) do 🧍/🚶/🏃 (and their ♂/♀ forms, if drawable) read as the *same*
    figure on that platform's emoji font, or does one look like a different
    person; (b) which way does 🚶 natively face there — confirm
    `WALK_GLYPH_NATIVE_FACING` matches what's actually observed, correcting
    the single constant if not.

## Expected outcome

Every item above passes with `npm test` green and `npm run build` still
emitting one self-contained `dist/index.html` that plays from `file://`
(SC-008). No existing test is weakened or deleted to get there (FR-029) —
`toolbarGlyphs.test.ts`'s stale assertion is replaced by a more precise one,
not simply removed.
