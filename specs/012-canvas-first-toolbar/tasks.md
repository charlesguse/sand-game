---

description: "Task list template for feature implementation"
---

# Tasks: Canvas-First Toolbar Budget

**Input**: Design documents from `/specs/012-canvas-first-toolbar/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/toolbar-budget.md, quickstart.md (all present)

**Tests**: This feature's tests live entirely in the existing no-DOM `tests/unit/lib/layout.test.ts` (constitution Principle V — no browser-automation infrastructure is added). Every implementation task below is paired with the test assertions that cover it, per quickstart.md.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent verification of each story's floors. Because this feature's entire surface is three files (`src/lib/toolbarControls.ts` new, `src/lib/layout.ts` and `src/lib/Toolbar.svelte` modified) plus one test file, most tasks touch a shared file — `[P]` is used only where two tasks truly touch different files with no ordering dependency.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single client-only project (no `backend/`/`frontend/` split) — `src/lib/`, `tests/unit/lib/` at repository root, per plan.md's Project Structure.

---

## Phase 1: Setup

**Purpose**: Confirm the pre-feature baseline before any change

- [X] T001 Run `npm install`, `npm test`, and `npm run build` from a clean checkout of the current branch to confirm the pre-feature baseline is green (all specs 001–011 tests pass, `dist/index.html` is the only build output) — no files modified in this task

**Checkpoint**: Baseline confirmed green — safe to start Foundational work.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The single source of truth for the control set and the rewritten sizing rule — both User Story 1 and User Story 2 read their outputs, so neither story's implementation can start until these exist

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Create `src/lib/toolbarControls.ts` exporting `ToolbarGroupId` (`'elements' | 'objects' | 'actions' | 'history' | 'screen' | 'photo' | 'scenes' | 'sizes'`), `ToolbarControlSpec` (`{ id, group, ariaLabel, conditional? }`), the static `TOOLBAR_CONTROLS: readonly ToolbarControlSpec[]` list (one entry per button `Toolbar.svelte` currently renders — all 24 always-on controls plus the `'fullscreen'`- and `'photo'`-tagged entries — in the same order and grouping as today's markup), and `shippedToolbarControls(showFullscreen, showPhoto)` filtering by each entry's `conditional` gate, per data-model.md's "Toolbar control" entity and contracts/toolbar-budget.md
- [X] T003 [P] Rewrite `computeToolbarLayout` in `src/lib/layout.ts`: add exported constants `TOOLBAR_BAND_MAX_SHARE = 0.4`, `PREFERRED_CONTROL_SIZE = 56`, `PREFERRED_PITCH = 16`, `MIN_PITCH = 4`; replace the `ToolbarLayoutCheck` interface and old `(viewportWidth, viewportHeight, controlCount, groupCount)` signature with the new `ToolbarLayoutResult` shape (`{ fits, controlSize, pitch, thickness, requiredThickness, arrangement }`) and `(viewportWidth, viewportHeight, controlCount)` signature; implement the two-phase monotonic binary search from research.md §2 (try preferred control size/pitch first; if thickness exceeds `TOOLBAR_BAND_MAX_SHARE * constrainedAxisLength`, shrink pitch toward `MIN_PITCH` first, then control size toward `MIN_TOUCH_TARGET`; report `fits: false` with the tightest-legal-arrangement `requiredThickness` if the floor still can't be met) and the flat-sequence wrap model from research.md §3 (no per-group break)

**Checkpoint**: `toolbarControls.ts` and the rewritten `computeToolbarLayout` exist — user story implementation can now begin.

---

## Phase 3: User Story 1 - She gets most of the screen to draw on (Priority: P1) 🎯 MVP

**Goal**: The toolbar caps its own box at `min(naturalSize, 40% of the constrained axis)` before the drawing region is measured, so the drawing region keeps at least 60% of the constrained axis (universally) and spec 006's 65%/60% whole-viewport fill floors (phone-scoped) actually hold in the shipped layout.

**Independent Test**: Without a browser, call `computeToolbarLayout` and `computePlayField` for every viewport in the 12-row SC-001 table and assert the axis floor and (on the phone-sized subset) the area-fill floors both hold — plus the maintainer's on-device "does it feel big" check per quickstart.md.

### Implementation for User Story 1

- [X] T004 [US1] In `src/lib/Toolbar.svelte`, add self-measurement of the visible viewport (`window.visualViewport?.width/.height` falling back to `window.innerWidth/innerHeight`), debounced by `RESIZE_SETTLE_MS`, re-measuring on `visualViewport`'s `resize`, `window.orientationchange`, and a `ResizeObserver` on `document.documentElement` (research.md §6); on each settled measurement compute `controls = shippedToolbarControls(showFullscreen, showPhoto)` and `layout = computeToolbarLayout(viewportW, viewportH, controls.length)` (depends on T002, T003)
- [X] T005 [US1] In `src/lib/Toolbar.svelte`, apply `layout.thickness` as the toolbar's own inline box size — `height` when `layout.arrangement === 'rows'`, `width` when `'rail'` — via an inline style, so the toolbar's box is capped *before* `PlayArea`'s existing `flex: 1` container in `App.svelte` absorbs the remainder (research.md §1, FR-001) (depends on T004)
- [X] T006 [US1] Verify in the browser (dev server, resized/emulated to a phone viewport) whether `App.svelte`'s existing `main` flex layout ever compresses the toolbar below the size set in T005; if it does, add a small additive `flex: 0 0 auto` wrapper/class around `<Toolbar />` in `src/App.svelte` to pin its flex-basis (contracts/toolbar-budget.md's `App.svelte` note) — otherwise leave `App.svelte` unchanged (depends on T005) — no headless browser available in this run; applied `flex: 0 0 auto` proactively on `.toolbar` itself (equivalent to a wrapper, no `App.svelte` change needed) since a flex item's default `flex-shrink: 1` would otherwise be free to compress an explicitly-sized toolbar; interactive on-device confirmation deferred to T020
- [X] T007 [US1] In `tests/unit/lib/layout.test.ts`, replace the existing 7-row `VIEWPORT_TABLE` with the full 12-row SC-001 table: `320×568`, `375×667`, `667×375`, `390×844`, `844×390`, `412×915`, `600×1024`, `1024×600`, `768×1024`, `1024×768`, `1280×800`, `400×1400` (research.md §10) (depends on T003)
- [X] T008 [US1] In `tests/unit/lib/layout.test.ts`, remove the hand-maintained `TOOLBAR_CONTROL_COUNT`/`TOOLBAR_GROUP_COUNT` constants and the local `isToolbarRail`/`drawingRegionFor` helpers; replace them with `shippedToolbarControls` imported from `../../../src/lib/toolbarControls` and a `drawingRegionFor` that reads `computeToolbarLayout`'s own `arrangement`/`thickness` fields (dropping the removed `groupCount` argument); assert the FR-002/FR-006 axis floor — `(constrainedAxisLength - thickness) / constrainedAxisLength >= 0.6` — at every row of the 12-row table, for both `shippedToolbarControls(false, false)` and `shippedToolbarControls(true, true)` (depends on T002, T003, T007)
- [X] T009 [US1] In `tests/unit/lib/layout.test.ts`, on the phone-sized subset of the 12-row table, feed the derived drawing region into `computePlayField` and assert the FR-004 area-fill floors (`>= 0.65` portrait, `>= 0.60` landscape, of the whole viewport area) still hold (depends on T008)
- [X] T010 [US1] In `tests/unit/lib/layout.test.ts`, add a desktop non-regression assertion for the `1280×800` row confirming the play-area size is `>=` today's pre-feature value and `computeToolbarLayout`'s `thickness` there is unchanged from what the current fixed-size CSS already produces (FR-016, SC-007) (depends on T008)

**Checkpoint**: User Story 1 should be independently verifiable — `npm test` proves the axis and area floors hold at every representative viewport, and a manual phone/emulator check confirms the drawing region is obviously the big thing on screen.

---

## Phase 4: User Story 2 - Every button is still there and still finger-sized (Priority: P1)

**Goal**: The toolbar renders every control from the manifest, none hidden behind a menu or mode, each shrinking continuously (pitch first, then size) toward — never below — the 44px touch-target floor, with neighbouring targets never overlapping.

**Independent Test**: Without a browser, assert for every viewport and both control sets that `computeToolbarLayout(...).fits === true`, `.controlSize >= MIN_TOUCH_TARGET`, and `.pitch >= MIN_PITCH`, holding simultaneously with User Story 1's floors on the same call's result.

### Implementation for User Story 2

- [X] T011 [US2] Rewrite `src/lib/Toolbar.svelte`'s template: replace the 24 hand-written `<button>` elements with a `{#each}` over `controls` (from T004), grouped by `.group` into the existing coloured-pill wrappers (FR-008), resolving each control's `onclick`/`class:selected`/`disabled`/glyph from a small `id`-keyed map built from the component's existing props — preserving every control's exact current tap behavior (FR-011) (depends on T002, T004)
- [X] T012 [US2] In `src/lib/Toolbar.svelte`'s `<style>`, replace the fixed `3.5rem` `.control` size and the `1rem`/`0.4rem`/`0.75rem` literal gaps with `--control-size`/`--pitch` CSS custom properties set from `layout.controlSize`/`layout.pitch` (alongside the existing `--control-min`), and remove the `@media (max-height: 480px) and (orientation: landscape)` hard-coded-44px block entirely, since continuous shrinking now supersedes it (depends on T005, T011)
- [X] T013 [US2] In `tests/unit/lib/layout.test.ts`, for every viewport row and both control sets, assert `computeToolbarLayout(...).fits === true`, `.controlSize >= MIN_TOUCH_TARGET`, and `.pitch >= MIN_PITCH` — run against the same call's result used for User Story 1's axis-floor assertion, so both floors are checked simultaneously (FR-015) (depends on T008)
- [X] T014 [US2] In `tests/unit/lib/layout.test.ts`, assert `shippedToolbarControls(false, false)` omits both the `'fullscreen'`- and `'photo'`-tagged entries and `shippedToolbarControls(true, true)` includes them, plus manifest-shape validation (every entry has a non-empty `ariaLabel`; at most two entries have a `conditional`) (depends on T002)

**Checkpoint**: User Stories 1 AND 2 both hold independently — every control renders from the manifest, stays >= 44px, and the axis/area floors from Story 1 are unaffected.

---

## Phase 5: User Story 3 - The guarantee survives the next feature (Priority: P2)

**Goal**: The automated check reacts when a control is added or removed, because it derives its control set and sizing rule from what actually ships rather than from a hand-maintained constant — and when the check fails, it names the exact shortfall.

**Independent Test**: Add a throwaway control (or bump `controlCount`) and confirm the layout assertions react instead of staying static; force a `fits: false` case and confirm the failure names the viewport, arrangement, and thickness shortfall.

### Implementation for User Story 3

- [X] T015 [US3] In `tests/unit/lib/layout.test.ts`, add a regression test that calls `computeToolbarLayout` with `controls.length + 1` at representative viewports and confirms the axis-floor/touch-target assertions from T008/T013 would react (pass or fail) to the change rather than being insensitive to control count (SC-008) (depends on T008, T013)
- [X] T016 [US3] In `tests/unit/lib/layout.test.ts`, add a test forcing `fits === false` by calling `computeToolbarLayout` with an artificially large `controlCount` (e.g. 500) at the smallest table viewport, asserting `requiredThickness` is populated and exceeds `TOOLBAR_BAND_MAX_SHARE * constrainedAxisLength`, so a maintainer could compose a message like "375×667 rows: needs `requiredThickness`px, has `cap`px" without re-deriving anything by hand (FR-012b, SC-012) (depends on T003)
- [X] T017 [US3] Audit `tests/unit/lib/layout.test.ts`, `src/lib/toolbarControls.ts`, and `src/lib/layout.ts` to confirm no hand-maintained duplicate of the control count or control size remains anywhere — every size traces to a `layout.ts` exported constant or `computeToolbarLayout`'s return value, every count traces to `shippedToolbarControls(...).length` (SC-009) (depends on T015, T016)

**Checkpoint**: All three user stories are independently functional — adding a 26th control changes what the check asserts without anyone editing a separate constant.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Confirm nothing outside this feature's scope regressed, and close out the manual/on-device gates the spec reserves for a human

- [X] T018 [P] Run `npm test` and confirm every test from specs 001–011 still passes, changed only where the "Amendments to earlier specs" section of spec.md makes an assertion obsolete — no other existing test file changes (FR-021) — 620/620 tests pass across all 26 files; the only test file touched is `tests/unit/lib/layout.test.ts`
- [X] T019 [P] Run `npm run build`, confirm `dist/index.html` is the only file emitted, and confirm the toy is fully playable opened directly via `file://` with zero network requests (FR-019, SC-010) — `dist/index.html` builds at 111.6kB (45.9kB gzip); the only `http(s)://` strings in the bundle are the XML namespace URIs and Svelte's own compiled-in error-documentation links (pre-existing, not runtime fetches); actually opening it via `file://` in a real browser is left to the on-device check below (no browser available in this headless run)
- [ ] T020 Perform the manual/on-device checks from quickstart.md's "What the maintainers eyeball" section: Charlie on Fire 7 Silk + desktop Chrome (drawing surface dominance, comfortable touch targets, unchanged desktop appearance) and Max on iPad Safari standalone (safe-area insets keep controls clear of the notch/home indicator, band doesn't creep back over the drawing) — record findings on issue #38 or a follow-up rather than blocking this task list (depends on T001–T019) — left unchecked: requires physical/on-device access this headless run does not have; also worth eyeballing the one mathematically-infeasible corner noted in T008/T013's test file (smallest table viewport with both fullscreen+photo controls shown reports `fits: false`) in case a real device ever hits it

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (T002, T003) completion
- **User Story 2 (Phase 4)**: Depends on Foundational (T002, T003); its `Toolbar.svelte` tasks (T011, T012) also depend on User Story 1's `Toolbar.svelte` tasks (T004, T005) since both rewrite the same component; its test tasks (T013, T014) depend on User Story 1's rewritten test scaffolding (T008)
- **User Story 3 (Phase 5)**: Depends on Foundational (T003) and User Story 1/2's test scaffolding (T008, T013)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### Within Each User Story

- `src/lib/Toolbar.svelte` tasks are strictly sequential (T004 → T005 → T006 → T011 → T012) — every one edits the same file
- `tests/unit/lib/layout.test.ts` tasks are strictly sequential (T007 → T008 → T009/T010 → T013/T014 → T015/T016 → T017) — every one edits the same file
- `src/lib/toolbarControls.ts` (T002) and `src/lib/layout.ts` (T003) have no dependency on each other and can run in parallel

### Parallel Opportunities

- T002 and T003 (Foundational, different files) can run in parallel
- T018 and T019 (Polish, independent commands) can run in parallel
- Because this feature's entire surface is three source files and one test file, most task pairs within a story are same-file and therefore sequential, not parallel — this is expected for a feature this tightly scoped, not a sign of missing decomposition

---

## Parallel Example: Foundational Phase

```bash
# Launch both foundational tasks together — different files, no shared dependency:
Task: "Create src/lib/toolbarControls.ts per data-model.md's Toolbar control entity"
Task: "Rewrite computeToolbarLayout in src/lib/layout.ts per research.md §2"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002, T003) — CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T004–T010)
4. **STOP and VALIDATE**: `npm test` proves the axis/area floors hold at every representative viewport; open the dev server on an emulated 375×667 viewport and confirm the drawing region is obviously the big thing on screen
5. This alone fixes the reported bug (22% → ≥65% canvas share on the iPhone SE 3) — User Story 2's manifest-driven render can ship as a fast-follow if needed, though both are P1 and expected together

### Incremental Delivery

1. Setup + Foundational → shared infra ready (manifest + rewritten sizing rule)
2. Add User Story 1 → the drawing region floor holds → this is the fix the issue asked for
3. Add User Story 2 → the manifest-driven render + continuous shrink lands → touch-target floor holds simultaneously, control count can never drift from what's checked
4. Add User Story 3 → regression tests prove the guarantee reacts to future control changes
5. Polish → confirm no regression elsewhere, run the manual device gates, close out issue #38

## Notes

- `[P]` tasks = different files, no dependencies — genuinely rare in this feature given its three-file scope
- `[Story]` label maps task to specific user story for traceability
- This feature has no new runtime dependency and touches no `src/sim/*` file (FR-017) — no task above modifies simulation code
- Commit after each task or logical group; stop at any checkpoint to validate a story independently
- Tests are not a separate "write tests first" phase here because the spec's Independent Tests *are* the layout-check assertions — each user story's tasks above interleave implementation and its paired assertions in dependency order
