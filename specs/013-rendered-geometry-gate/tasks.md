---

description: "Task list template for feature implementation"
---

# Tasks: Rendered Geometry Matches The Layout Model

**Input**: Design documents from `/specs/013-rendered-geometry-gate/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/geometry-gate.md, quickstart.md (all present)

**Tests**: This feature is almost entirely tests and the two non-test support modules they consume (constitution Principle V — no DOM, no headless browser). Every implementation task below is paired with the invariant-list/gate assertions that cover it, per quickstart.md. `tests/unit/shell/geometryInvariants.ts` and `tests/unit/shell/geometryGate.ts` are new, non-runtime support modules — not application code and not test files themselves, but neither ships in `dist/`.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent verification of each story's guarantee. Because `geometryInvariants.ts` and `geometryGate.ts` are shared data/logic that every story's tests read from, most cross-story ordering is "the shared module exists" rather than a hard code dependency — `[P]` is used only where two tasks truly touch different files with no ordering dependency.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

Single client-only project (no `backend/`/`frontend/` split) — `src/`, `tests/unit/` at repository root, per plan.md's Project Structure. Production changes are confined to `src/lib/layout.ts`, `src/lib/Toolbar.svelte`, `src/App.svelte`; everything else is new or modified under `tests/unit/`.

---

## Phase 1: Setup

**Purpose**: Confirm the pre-feature baseline before any change

- [X] T001 Run `npm install`, `npm test`, and `npm run build` from a clean checkout of the current branch to confirm the pre-feature baseline is green — specs 001–012 all pass, `dist/index.html` is the only build output, and the three historical causes are already fixed on `main` per the spec's Assumptions (border-box sizing, rail flows down height, selected emphasis is a border not a scale) — no files modified in this task

**Checkpoint**: Baseline confirmed green — safe to start Foundational work.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Unify the rows-versus-rail decision onto one owner (FR-007) and stand up the shared gate/invariant-list scaffolding every story's tests read from — nothing downstream can be written until both exist

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] In `src/lib/layout.ts`, add `export const RAIL_MEDIA_QUERY = '(max-height: 480px) and (orientation: landscape)'` and `export function readArrangement(matchMedia = (q) => window.matchMedia(q)): 'rows' | 'rail'`; change `computeToolbarLayout`'s signature from `(viewportWidth, viewportHeight, controlCount)` to `(viewportWidth, viewportHeight, controlCount, arrangement: 'rows' | 'rail')`, removing its internal `viewportHeight <= PHONE_MAX_SHORT_SIDE && viewportWidth > viewportHeight` derivation and using the passed-in `arrangement` instead — every other line of the two-phase shrink and `clearsAreaFillFloor` arithmetic is byte-for-byte unchanged (research.md §6, contracts/geometry-gate.md)
- [X] T003 In `src/lib/Toolbar.svelte`, import `readArrangement` from `./layout` alongside the existing `computeToolbarLayout` import; re-read `readArrangement()` into a `$state` on the same `measureViewport`/`scheduleMeasure` debounced path (mount, `visualViewport` resize, `orientationchange`) rather than adding a second listener; pass it as `computeToolbarLayout`'s new fourth argument in the `layout = $derived(...)` call (depends on T002)
- [X] T004 In `src/App.svelte`, import `readArrangement`/`RAIL_MEDIA_QUERY` from `./lib/layout`; add `let arrangement = $state(readArrangement())` updated via `window.matchMedia(RAIL_MEDIA_QUERY).addEventListener('change', () => arrangement = readArrangement())` registered in `onMount` (mirroring `Toolbar.svelte`/`PlayArea.svelte`'s existing teardown pattern); change `<main>` to `<main class:rail={arrangement === 'rail'}>`; replace the `<style>` block's `@media (max-height: 480px) and (orientation: landscape) { main { flex-direction: row; } }` with a plain, non-conditional `main.rail { flex-direction: row; }` rule (depends on T002)
- [X] T005 [P] In `tests/unit/lib/layout.test.ts`, update every existing `computeToolbarLayout(...)` call site (including the `drawingRegionFor` helper) to pass its fourth `arrangement` argument, computed the same way the pre-013 internal derivation did, so the existing floor assertions keep passing unchanged in value (depends on T002)
- [X] T006 [P] Create `tests/unit/shell/geometryInvariants.ts`: `GeometryComponent` (`'toolbar-band' | 'toolbar-control' | 'play-area-container' | 'play-area-canvas'`), `GeometryCategory` (the nine FR-009 categories), `GeometryMechanism` (`'derived' | 'pinned' | 'inert'`), the `GeometryInvariant` interface, an initially-empty `GEOMETRY_INVARIANTS: readonly GeometryInvariant[]` array, `GUARDED_PROPERTY_PATTERN` (`/^(box-sizing|border(-\w+)?|padding(-\w+)?|margin(-\w+)?|width|height|min-width|min-height|max-width|max-height|transform)$/`), and four initially-empty allowed-declaration maps — `CONTROL_ALLOWED_DECLARATIONS`, `CONTROL_SELECTED_ALLOWED_DECLARATIONS`, `PLAY_AREA_CONTAINER_ALLOWED_DECLARATIONS`, `PLAY_AREA_CANVAS_ALLOWED_DECLARATIONS` — per data-model.md and contracts/geometry-gate.md; zero imports from `src/`, zero `readFileSync`/DOM access
- [X] T007 Create `tests/unit/shell/geometryGate.ts`: the `GeometryCheckResult` interface (`{ ok, component, invariant, assumption, found }`, `component` typed from `GeometryInvariant`'s `GeometryComponent`) and `formatFailure(result): string`; the shared parsing primitives `extractRuleBlock(source, selector)` and `parseDeclarations(ruleBlockSource)` (split a rule block on `;`, then on the first `:`, trim, per research.md §3); no component-specific checks or mutators yet — every function pure, no I/O (depends on T006)

**Checkpoint**: Arrangement has one owner in production code; the gate's shared plumbing exists — user story implementation can now begin.

---

## Phase 3: User Story 1 - Every button stays on the screen she can touch (Priority: P1) 🎯 MVP

**Goal**: Every geometry-critical declaration of the toolbar band and its controls is derived from `computeToolbarLayout`'s output or pinned-and-checked against it, so a rendered control or band can never exceed what the model budgeted.

**Independent Test**: For `Toolbar.svelte`'s (and `App.svelte`'s) live source text, every `GEOMETRY_INVARIANTS` entry with `component: 'toolbar-control'` or `'toolbar-band'` and `mechanism: 'pinned'` passes its named `geometryGate.ts` check, including the guarded-set declaration scan over `.control`'s and `.control.selected`'s rule blocks.

### Implementation for User Story 1

- [X] T008 [US1] In `tests/unit/shell/geometryInvariants.ts`, add `GEOMETRY_INVARIANTS` entries for `component: 'toolbar-control'` covering all nine categories: `box-sizing` pinned to `border-box` (historicalCause 1), `borders`/`padding`/`margins` pinned inside the guarded-set map, `sizing` pinned to `width`/`height: var(--control-size)`, `transforms` pinned to "no growth beyond factor 1" for both resting and `.selected` states (historicalCause 3), `flow-direction`/`wrapping`/`gaps` recorded `'inert'` for a single control (the band, not the control, owns flow) — each `'pinned'` entry's `checkId` naming the `geometryGate.ts` export planned in T011 (depends on T006)
- [X] T009 [US1] In `tests/unit/shell/geometryInvariants.ts`, add `GEOMETRY_INVARIANTS` entries for `component: 'toolbar-band'` covering all nine categories: `flow-direction` pinned to column-in-rows/row-in-rail (historicalCause 2), `wrapping` pinned to wrap-across-the-cross-axis, `gaps` pinned to flow-axis-only spacing (`row-gap`/`column-gap` per arrangement), `sizing` derived from `layout.thickness`'s inline style, `box-sizing`/`borders`/`padding`/`margins`/`transforms` recorded `'inert'` or pinned as the band's actual CSS requires — each `'pinned'` entry's `checkId` naming a T011 export (depends on T006)
- [X] T010 [US1] In `tests/unit/shell/geometryInvariants.ts`, populate `CONTROL_ALLOWED_DECLARATIONS` and `CONTROL_SELECTED_ALLOWED_DECLARATIONS` with the exact property→value pairs `Toolbar.svelte`'s `.control` and `.control.selected` rule blocks pin today (`box-sizing: border-box`, `width`/`height: var(--control-size)`, the control's border width, etc.), read from the component's current `<style>` block (research.md §3) (depends on T008)
- [X] T011 [US1] In `tests/unit/shell/geometryGate.ts`, implement `checkControlBoxSizing`, `checkControlGuardedDeclarations`, `checkSelectedGuardedDeclarations` (closed-allowlist scan via `parseDeclarations`/`extractRuleBlock`/`GUARDED_PROPERTY_PATTERN` against T010's maps, with `transform` special-cased to parse `scale`/`scaleX`/`scaleY`/`scale3d`/`matrix` factors and fail only when a factor's magnitude exceeds `1`, per research.md §4), `checkRailFlowDirection`, `checkGapAxes`, and `checkArrangementSingleSource(appSource, toolbarSource)` (confirms both files import `readArrangement`/`RAIL_MEDIA_QUERY` from `./lib/layout` and neither `<style>` block has an `@media` rule mentioning `orientation` or `max-height`, per research.md §7) (depends on T007, T010)
- [X] T012 [US1] Rewrite `tests/unit/shell/toolbarGeometry.test.ts` to `readFileSync` `Toolbar.svelte`'s and `App.svelte`'s live source, run every `'pinned'` `GEOMETRY_INVARIANTS` entry for `toolbar-control`/`toolbar-band` through its named `geometryGate.ts` check, and assert `result.ok === true` with `formatFailure(result)` as the failure message (FR-014) — this replaces the file's four ad-hoc regex assertions with equivalent (and broader) coverage folded into the named list (FR-024) (depends on T011)
- [X] T013 [US1] In `tests/unit/lib/layout.test.ts`, add cases confirming `readArrangement()` (called with a stubbed `matchMedia`) at every row of the representative viewport table produces the same `'rows' | 'rail'` value the pre-013 internal derivation would have, and that `computeToolbarLayout`'s `fits`/`controlSize`/`pitch`/`thickness` at each row are unchanged from spec 012's numbers when fed that value (SC-014, FR-007b) (depends on T005)

**Checkpoint**: User Story 1 is independently verifiable — `npm test` proves no toolbar control or band declaration can silently exceed what the model budgeted, on top of the maintainer's on-device edge check (Story 3).

---

## Phase 4: User Story 2 - A drifting stylesheet fails the suite, not the review (Priority: P1)

**Goal**: Each of the three historical causes is a permanent regression test, derived from the shipped component's own current source at test time, and the closed allowlist rejects an unrecognized guarded declaration while staying silent on cosmetic changes.

**Independent Test**: The suite re-derives each of the three historical causes on every run — taking the shipped component's own source, producing the drifted variant in memory, and requiring the check to reject it with a message naming the broken fact — while a purely cosmetic mutation stays green.

### Implementation for User Story 2

- [X] T014 [US2] In `tests/unit/shell/geometryGate.ts`, implement `HISTORICAL_CAUSE_MUTATORS: readonly Mutator[]` with exactly three entries: `'content-box-control'` (replaces `box-sizing: border-box` with `box-sizing: content-box` inside `.control`'s rule block), `'rail-row-flow'` (replaces the rail arrangement's `flex-direction: column` with `flex-direction: row`), `'selected-scale-up'` (introduces or amplifies a `transform: scale(...)` value above `1` inside `.control.selected`'s rule block) — each `targetCheckId` naming one of T011's checks (depends on T011)
- [X] T015 [US2] In `tests/unit/shell/toolbarGeometry.test.ts`, add the three permanent regression tests (FR-013, FR-013a): for each `HISTORICAL_CAUSE_MUTATORS` entry, assert `mutate(source) !== source` against the live component source (guards against a silently-defeated mutator, Edge Case "the shipped component gets refactored"), assert the targeted check's result is `ok === true` on the unmutated source, and assert `ok === false` on the mutated source with `formatFailure` naming the component, invariant, assumption, and what was found (FR-013b, FR-014, SC-001, SC-011) (depends on T014)
- [X] T016 [US2] In `tests/unit/shell/toolbarGeometry.test.ts`, add a test that copies `.control`'s rule block text, injects one guarded-set declaration the invariant list does not name (e.g. `border-radius: 10%;`), and confirms `checkControlGuardedDeclarations` rejects it as unrecognized even though no invariant entry mentions `border-radius` (FR-018a, SC-013) (depends on T012)
- [X] T017 [US2] In `tests/unit/shell/toolbarGeometry.test.ts`, add a test that mutates a purely cosmetic declaration in a copy of the source (a `box-shadow` colour, a `conic-gradient` stop on the control-group cue) and confirms every check run against it stays `ok === true` (FR-015, SC-012) (depends on T012)

**Checkpoint**: Re-introducing any of the three historical causes fails `npm test`; an unrecognized guarded declaration fails; a cosmetic tweak stays green.

---

## Phase 5: User Story 3 - Layout changes name what to eyeball, and on whose device (Priority: P2)

**Goal**: The spec's eyeball checklist is checkable, not a vibe — every item names a maintainer, a device, an orientation/viewport, and a single true-or-false observable, split by CLAUDE.md's platform table.

**Independent Test**: Read the eyeball checklist and confirm each item names a maintainer, a device, a viewport or orientation, and one observable statement — no item requiring judgement about whether something "looks right."

### Implementation for User Story 3

- [X] T018 [US3] Review spec.md's "What the maintainers eyeball" section and quickstart.md's copy of it against FR-019/FR-020: confirm every item names a maintainer, a device, an orientation/viewport, and one true-or-false observable with no "looks right"/judgement language, and that the pinch-zoom item is explicitly marked verifiable only on Max's touch device — this is a reading/verification task with no automated coverage by design (spec's Independent Test), no code or test file changes expected

**Checkpoint**: The checklist itself satisfies FR-019/FR-020 — verified by inspection, not by `npm test`.

---

## Phase 6: User Story 4 - The play area gets the same protection (Priority: P3)

**Goal**: The play area's container and canvas get the same derived-or-pinned treatment and the same closed-allowlist scan as the toolbar, and the rows-versus-rail decision is provably a single source of truth.

**Independent Test**: Enumerate the play area's geometry-critical declarations against the same categories used for the toolbar and confirm each is derived, pinned, or explicitly recorded as geometrically inert.

### Implementation for User Story 4

- [ ] T019 [US4] In `tests/unit/shell/geometryInvariants.ts`, add `GEOMETRY_INVARIANTS` entries for `component: 'play-area-container'` and `'play-area-canvas'` covering all nine categories: `sizing` derived from `computePlayField`'s `displayWidth`/`displayHeight` via the canvas's inline `style` attribute (`checkId` naming T020's `checkCanvasSizeDerivation`); every other category (`box-sizing`, `borders`, `padding`, `margins`, `flow-direction`, `wrapping`, `gaps`, `transforms`) recorded `'inert'` for both components, with `padding`'s entry noting `.play-area-container` self-corrects via `clientWidth`/`clientHeight` measurement (research.md §5) — still guarded via the closed-allowlist scan rather than left as an unenforced claim (depends on T009)
- [ ] T020 [US4] In `tests/unit/shell/geometryGate.ts`, implement `checkCanvasSizeDerivation(playAreaSource)` (confirms the canvas's inline `style` attribute binds `width`/`height` to `displayWidth`/`displayHeight` by source inspection) and `checkPlayAreaGuardedDeclarations(playAreaSource)` (the closed-allowlist scan over `.play-area-container`'s and `.play-area`'s rule blocks against `PLAY_AREA_CONTAINER_ALLOWED_DECLARATIONS`/`PLAY_AREA_CANVAS_ALLOWED_DECLARATIONS`, both empty today, so any future guarded declaration there fails immediately) (depends on T019, T007)
- [ ] T021 [US4] Create `tests/unit/shell/playAreaGeometry.test.ts`: `readFileSync` `PlayArea.svelte`'s live source, assert `checkCanvasSizeDerivation`'s result is `ok === true`, run `checkPlayAreaGuardedDeclarations` and assert every result is `ok === true`, each failure message routed through `formatFailure` (depends on T020)
- [ ] T022 [US4] In `tests/unit/shell/playAreaGeometry.test.ts`, add the arrangement-single-source assertion for Story 4 Acceptance Scenario 3: run `checkArrangementSingleSource` (from T011) against `App.svelte`'s and `Toolbar.svelte`'s live source and assert `ok === true` (depends on T011, T004)
- [ ] T023 [US4] In `tests/unit/lib/layout.test.ts` or `tests/unit/shell/playAreaGeometry.test.ts`, add a source-inspection assertion that `readArrangement`'s implementation in `src/lib/layout.ts` contains no reference to `visualViewport`, so the pinch-zoom hazard has no code path left to trigger (Story 4 Acceptance Scenario 4, SC-014) (depends on T002)
- [ ] T024 [US4] In `tests/unit/shell/playAreaGeometry.test.ts`, add the FR-009 coverage test: enumerate the Cartesian product of all four `GeometryComponent`s × all nine `GeometryCategory`s and assert `GEOMETRY_INVARIANTS` has at least one entry for every pair (depends on T008, T009, T019)
- [ ] T025 [US4] In `tests/unit/shell/playAreaGeometry.test.ts`, add the FR-010 two-way correspondence test: every `'pinned'` `GEOMETRY_INVARIANTS` entry's `checkId` names a real `geometryGate.ts` export, and every assertion export of `geometryGate.ts` is named by at least one entry's `checkId` (depends on T011, T014, T020)

**Checkpoint**: All four user stories are independently functional — the play area is covered by the same mechanism, and the invariant list's own coverage/correspondence rules are enforced, not just claimed.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Confirm nothing outside this feature's scope regressed, and close out the manual/on-device gates the spec reserves for a human

- [ ] T026 [P] Run `npm test` and confirm every test from specs 001–012 still passes, changed only where FR-024 folds `toolbarGeometry.test.ts`'s existing four assertions into the new list-and-gate mechanism — no other existing test file content changes beyond the `computeToolbarLayout` call-site signature updates from T005 (FR-024)
- [ ] T027 [P] Run `npm run build`, confirm `dist/index.html` is the only file emitted, and open it via `file://` to confirm the toy plays exactly as before — same controls, same positions, same sizes, same interactions, same undo/redo/persistence behaviour (FR-022, FR-023, SC-009, SC-010)
- [ ] T028 Audit `src/lib/layout.ts`'s diff against its pre-013 arithmetic to confirm `TOOLBAR_BAND_MAX_SHARE`, `MIN_TOUCH_TARGET`, `MIN_PITCH`, the area-fill floors, and the fail-rather-than-degrade `fits: false` path are byte-for-byte unchanged except for `arrangement` becoming an explicit parameter — 0 spec-012 floors weakened, relaxed, or made conditional (FR-021, SC-007) (depends on T002)
- [ ] T029 Perform the manual/on-device checks from quickstart.md's "What the maintainers eyeball" section (also T018's subject): Charlie on Fire 7 Kids tablet (Silk) and desktop Chrome, Max on iPad Safari standalone — no control touches or crosses a screen/window edge in either orientation, all scene/brush-size buttons present and tappable, the selected control's ring stays inside the band including through a rotation, pinch-zoom in landscape does not flip the arrangement, and rotate/resize switches the band and play area together — record findings on issue #41 or a follow-up rather than blocking this task list (depends on T012, T021, T026, T027)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (T002, T006, T007) completion
- **User Story 2 (Phase 4)**: Depends on Foundational; its tests depend on User Story 1's rewritten `toolbarGeometry.test.ts` and checks (T011, T012)
- **User Story 3 (Phase 5)**: Depends on nothing but spec.md/quickstart.md's own text — can run any time after Setup, independent of every code task
- **User Story 4 (Phase 6)**: Depends on Foundational (T007) and reuses User Story 1's `checkArrangementSingleSource` (T011) and `App.svelte` change (T004); its coverage/correspondence tests (T024, T025) depend on User Story 1's and User Story 2's invariant entries and checks existing
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### Within Each User Story

- `tests/unit/shell/geometryInvariants.ts` tasks are additive to the same file and mostly sequential by component (T006 → T008/T009 → T010 → T019)
- `tests/unit/shell/geometryGate.ts` tasks are additive to the same file (T007 → T011 → T014 → T020)
- `tests/unit/shell/toolbarGeometry.test.ts` tasks are strictly sequential — every one edits the same file (T012 → T015 → T016 → T017)
- `tests/unit/shell/playAreaGeometry.test.ts` tasks are strictly sequential — every one edits the same file (T021 → T022 → T023 → T024 → T025)
- `src/lib/Toolbar.svelte` (T003) and `src/App.svelte` (T004) have no dependency on each other and can run in parallel once T002 lands

### Parallel Opportunities

- T002, T006 (Foundational, different files, no shared dependency) can start together; T003/T004/T005 each depend only on T002, not on each other
- T026 and T027 (Polish, independent commands) can run in parallel
- User Story 3 (T018) has no code dependency and can run in parallel with all of Phases 2–4, 6
- Most task pairs within Phases 3, 4, and 6 are same-file (`geometryInvariants.ts`, `geometryGate.ts`, or one `*.test.ts` file) and therefore sequential, not parallel — expected for a feature whose entire surface is a handful of files by design (research.md §1)

---

## Parallel Example: Foundational Phase

```bash
# Launch both foundational tasks together — different files, no shared dependency:
Task: "Add RAIL_MEDIA_QUERY/readArrangement and the explicit arrangement parameter to src/lib/layout.ts"
Task: "Create tests/unit/shell/geometryInvariants.ts's types, empty list, and empty allowed-declaration maps"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T007) — CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T008–T013)
4. **STOP and VALIDATE**: `npm test` proves no toolbar control or band declaration can silently exceed what the model budgeted; open the dev server on an emulated 667×375 viewport and confirm all six previously-off-screen controls are reachable
5. This alone closes the shipped bug (Story 1 is the reported failure); Story 2's permanent regression tests are the other P1 and are expected in the same change

### Incremental Delivery

1. Setup + Foundational → arrangement has one owner, gate scaffolding exists
2. Add User Story 1 → the toolbar's rendered geometry can no longer silently exceed the model → this is the fix the issue asked for
3. Add User Story 2 → the three historical causes become permanent regression tests, and the closed allowlist/cosmetic-safety guarantees are proven
4. Add User Story 3 → the eyeball checklist itself is confirmed checkable (no code dependency; can land any time)
5. Add User Story 4 → the play area gets the identical protection, and the invariant list's own coverage/correspondence rules become enforced facts
6. Polish → confirm no regression elsewhere, run the manual device gates, close out issue #41

## Notes

- `[P]` tasks = different files, no dependencies — genuinely rare past the Foundational phase given how much of this feature's surface is two shared data/logic files
- `[Story]` label maps task to specific user story for traceability
- This feature has no new runtime dependency and touches no `src/sim/*` file — no task above modifies simulation code
- Commit after each task or logical group; stop at any checkpoint to validate a story independently
- Tests are not a separate "write tests first" phase here because the spec's Independent Tests *are* the gate assertions — each user story's tasks interleave invariant-list entries, gate implementation, and the tests that exercise them, in dependency order
