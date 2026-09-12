# Quickstart: validating "People In Every Skin Tone"

This feature has no DOM/browser test harness (constitution Principle V) —
validation is plain `vitest` over `src/sim/*` and `src/lib/*`, plus the two
maintainer eyeball checks FR-027 explicitly says neither maintainer can
verify for the other's device. No new build step, no new dependency.

## Prerequisites

```bash
npm install   # only if node_modules isn't already present
```

## Automated validation

```bash
npm test        # the merge gate — must stay green (FR-025: no existing test may weaken)
npm run build   # must still emit a single dist/index.html (FR-024, SC-010)
```

`npm test` is expected to grow the following coverage (FR-026), mapped to
each user story's Independent Test in spec.md — see data-model.md and
contracts/sim-and-shell-contracts.md for the exact shapes involved:

| Rule | Where it's exercised | Shape of the check |
|---|---|---|
| Tone is fixed at placement and never changes | `tests/unit/sim/pets.test.ts` | `addPerson`, run hundreds of frames including a poke; assert `tone` unchanged throughout, for every frame and facing (US1, FR-002) |
| Every (form, tone, frame) picture is defined and composed in the FR-005 order | `tests/unit/lib/personGlyphs.test.ts` | Table-test a representative sample (or all 54) of `TONED_GLYPHS`/`composePicture` output; assert the exact codepoint sequence base→modifier→ZWJ→gender→VS16 (US1, FR-004, FR-005) |
| Six placements yield six distinct tones; three placements yield three distinct tones *and* three distinct forms | `tests/unit/sim/pets.test.ts` or `tests/unit/lib/personGlyphs.test.ts` | Seeded `rng`, `drawableTones` = all six: 6 consecutive `pickPersonTone`/`addPerson` calls yield all 6 tones before a repeat; 3 consecutive calls yield 3 distinct tones *and* (independently) 3 distinct variants; a 7th call starts a fresh cycle (US2, FR-006, FR-007, SC-001) |
| A device with only some tones drawable never yields an undrawable one and never stalls | same | `drawableTones` with 2–3 entries: repeated `pickPersonTone` calls cycle only over those, no repeat within a cycle, no exception (US2 Acceptance Scenario 3, FR-013) |
| The two bags advance independently | same | Exhaust the tone bag's cycle while the variant bag is mid-cycle (or vice versa); assert neither's position affects the other's (US2 Acceptance Scenario 5, FR-007) |
| Glyph probe tone rung — every FR-026 case | `tests/unit/lib/personGlyphs.test.ts` | Fabricate `GlyphProbeInputs` for: every toned picture fine; exactly one tone splitting on one frame of one form; all five modifier tones splitting; gendered forms splitting *and* tones splitting; a probe that throws; a probe returning zero/non-finite widths. Assert the exact `drawableTones` and `pictures` produced each time (US3, FR-009–FR-013) |
| FR-012's fixed ordering: frame ladder first, tone check against its output | same | A probe where the *untoned* stander is tofu (so spec 018 already replaced it with walking) but the toned walker is fine: assert the tone survives. A probe where the untoned stander is fine but the toned stander splits: assert the tone is dropped (US3 Acceptance Scenario 2 & 8, FR-012) |
| A split or empty-box tone picture is never reachable, canvas or toolbar | same | For every fabricated probe outcome above, assert no value anywhere in `pictures` equals an unresolved/raw split composition, and `toolbarGlyph` is always `pictures.neutral.default.standing` (US1 Acceptance Scenario 4, US3 Acceptance Scenario 7, FR-014, FR-015) |
| Probe still runs at most once per session, covers all 54 pictures, no visible startup delay | Architectural (no DOM harness to observe a real call count) — verified by code review of the single call site in `App.svelte` (FR-016, SC-009), plus a plain timing sanity check in `personGlyphs.test.ts` if practical (call count assertion via a probe stub with call counters) | — |
| Tone survives save/restore, undo/redo, and grid re-derivation | `tests/unit/sim/save.test.ts`, `history.test.ts`, `resize.test.ts` | Place people of every tone; round-trip through `serializeWorld`/`deserializeWorld`, `HistoryManager.undo`/`redo`, and a resize; assert tone unchanged in every case (US5 Acceptance Scenarios 1–3, FR-017, SC-004) |
| A restored person whose stored tone this device can't draw renders as default but keeps her stored tone | `tests/unit/sim/save.test.ts` | Restore a person with `tone: 'medium'` against a `PersonPictureSet` whose `drawableTones` excludes `'medium'`; assert `frameFor(...)` returns the default-tone picture while `person.tone === 'medium'` still, and a subsequent `serializeWorld` still writes `tone: 'medium'` (US5 Acceptance Scenario 5, FR-017, SC-004) |
| Two worlds differing only in one person's tone are not treated as equal | `tests/unit/sim/history.test.ts` | Two `WorldState`s identical except one person's `tone`; assert `worldMatches` returns `false` (US5 Acceptance Scenario 4, FR-021) |
| A spec-018 save (no tone field) restores every person as default tone | `tests/unit/sim/save.test.ts`, `historySave.test.ts` | Wire payload shaped like a pre-this-feature save (`people` entries with `variant` but no `tone` key); assert every restored person has `tone: 'default'` and the rest of the world is untouched (US4 Acceptance Scenario 1, FR-020) |
| A malformed/empty/unrecognised tone for one person doesn't affect other people or the rest of the world | same | Wire payload with 3 people, one with `tone: 'chartreuse'` (or `tone: ''`, or `tone: null`); assert only that person falls back to `'default'`, the other two keep their tones, and the rest of the world restores normally (US4 Acceptance Scenario 2, FR-018) |
| A pre-018 placed-object migration still produces default-tone walkers | `tests/unit/sim/save.test.ts`, `objects.test.ts` | Feed `deserializeWorld` a wire payload shaped like a pre-018 save (`byKind.person` present); assert migrated people have `tone: 'default'` (and `variant: 'neutral'`, unchanged from spec 018) (US4 Acceptance Scenario 3, FR-020) |
| Save/history format numbers unchanged; a feature-written save still loads on a pre-feature build | `tests/unit/sim/save.test.ts`, `historySave.test.ts` | Assert `SAVE_VERSION`/`HISTORY_SAVE_VERSION` constants unchanged; a save written with tone data, read by logic that ignores the `tone` key entirely, still restores position/variant correctly (US4 Acceptance Scenarios 4–5, FR-019) |
| Composition order (FR-005) is verified, not assumed | `tests/unit/lib/personGlyphs.test.ts` | Direct codepoint-sequence assertions on `composePicture`'s output for at least one neutral, one gendered, toned example — modifier immediately after the base, before any ZWJ/gender/VS16 (FR-005, FR-026) |
| Existing spec-018 behavior is unaffected | Existing suites, re-run unchanged | `tests/unit/sim/pets.test.ts` (stroll/poke/eviction sections), `objects.test.ts`, `history.test.ts`, `save.test.ts`, `historySave.test.ts`, `resize.test.ts` — this is the regression net (US6, FR-023, FR-025) |

## Manual / eyeball validation (constitution Principle V: not automatable)

1. `npm run dev`, open in a desktop browser (Windows 11 desktop Chrome is
   already confirmed to draw all nine untoned pictures as single figures —
   FR-027).
2. Place several people; confirm they visibly differ in both skin tone and
   form (neutral/man/woman) rather than only one axis moving at a time.
3. Watch one person cycle through standing → walking → running (poke her);
   confirm her skin tone and form never change mid-cycle.
4. Confirm the toolbar's person button still shows the same untoned
   standing figure it always has, regardless of what tones have been placed.
5. Save (close/reopen, or trigger the visibility-flush save) and confirm
   every person's tone is exactly as it was.
6. Undo immediately after placing a person; confirm she disappears; redo;
   confirm she's back with the same tone and form.
7. If you have a save from before this feature shipped, open it; confirm
   every person appears in the default tone, nothing is dropped, and no
   error or message appears.
8. **Flag for the other maintainer** (per CLAUDE.md's platform table and
   FR-027, since neither maintainer can verify the other's device): (a) do
   the toned figures read as the *same* person across standing, walking,
   and running on that platform's emoji font; (b) are the toned man/woman
   forms drawn as one figure there, or as a figure plus a coloured square
   (in which case that tone should have been excluded and is worth a bug
   report with the device/OS/browser combination).

## Expected outcome

Every item above passes with `npm test` green and `npm run build` still
emitting one self-contained `dist/index.html` that plays from `file://`
(SC-010). No existing test is weakened or deleted to get there (FR-025).
