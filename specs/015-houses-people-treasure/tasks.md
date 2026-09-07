---

description: "Task list template for feature implementation"
---

# Tasks: Houses, People, And Treasure

**Input**: Design documents from `/specs/015-houses-people-treasure/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/elements-and-objects.md, contracts/toolbar-and-rendering.md, quickstart.md (all present)

**Tests**: FR-033 explicitly requires headless `vitest` coverage for every new rule (chest→diamond conversion, diamond settling, cap/eviction, whole-object erase, clear-all, save/restore round-trip, undo/redo round-trip, backward-compatible restore, resize remap) with no DOM/browser harness — test tasks are included below, one per file/rule named in plan.md's Testing section and quickstart.md's Automated coverage lists.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation and testing of each story. `src/lib/PlayArea.svelte`, `src/lib/Toolbar.svelte`, `src/lib/toolbarControls.ts`, and `tests/unit/sim/objects.test.ts` are each touched by more than one phase — `[P]` is used only where two tasks truly touch different files with no ordering dependency between them.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single client-only project (no `backend/`/`frontend/` split) — `src/sim/`, `src/lib/`, `tests/unit/` at repository root, per plan.md's Project Structure.

---

## Phase 1: Setup

**Purpose**: Confirm the pre-feature baseline before any change

- [ ] T001 Run `npm install`, `npm test`, and `npm run build` from a clean checkout of the current branch to confirm the pre-feature baseline is green (all specs 001–014/016 tests pass, `dist/index.html` is the only build output) — no files modified in this task

**Checkpoint**: Baseline confirmed green — safe to start Foundational work.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared type/kind plumbing both User Story 1 (chest) and User Story 2 (house/person) build on — element ID 12, the three new `ObjectKind`/`Tool` members, the extended `OBJECT_KINDS` array, and the one hand-maintained placement-dispatch list that doesn't derive from `OBJECT_KINDS` automatically. User Story 3 (ambient stars) needs none of this and may start any time after Setup (see Dependencies below).

**⚠️ CRITICAL**: No User Story 1 or User Story 2 work can begin until this phase is complete

- [ ] T002 In `src/sim/types.ts`: add `export const DIAMOND = 12;` (ID 11 stays unclaimed — reserved by the concurrent mermaid/ice-cream feature) and extend the `Element` union with `typeof DIAMOND`; extend `ObjectKind` to `'rainbow' | 'unicorn' | 'palm' | 'flamingo' | 'house' | 'person' | 'chest'`; extend `Tool` to add `'house' | 'person' | 'chest'` (no `'diamond'` member — FR-017, no diamond tool) — per contracts/elements-and-objects.md
- [ ] T003 In `src/sim/objects.ts`: extend `OBJECT_KINDS` to `['rainbow', 'unicorn', 'palm', 'flamingo', 'house', 'person', 'chest']` and `createObjectsState()`'s `byKind` seed to include `house: [], person: [], chest: []` (depends on T002)
- [ ] T004 In `src/lib/PlayArea.svelte`'s `handlePointerDown`, extend the placement-tool condition (`tool === 'rainbow' || tool === 'unicorn' || tool === 'palm' || tool === 'flamingo'`) to also match `tool === 'house' || tool === 'person' || tool === 'chest'`, per data-model.md's "Amended: `ObjectKind`" validation rule and contracts/toolbar-and-rendering.md (depends on T002, T003)

**Checkpoint**: `ObjectKind`/`Tool`/`OBJECT_KINDS` extended and placement dispatch wired — User Story 1 and User Story 2 implementation can now begin.

---

## Phase 3: User Story 1 - The treasure chest turns her sand into diamonds (Priority: P1) 🎯 MVP

**Goal**: Every chest continuously converts pourable material (sand, dirt, water) in its one-cell-ring touch zone into diamonds — a settling powder, sparkling, fixed-colour — with no counter, cooldown, or capacity, and with a chest/rainbow ring overlap resolving deterministically to rainbow sand by call order alone.

**Independent Test**: Place a chest on a grid, drop sand/dirt/water cells into its one-cell ring, call `applyChestConversions`, and assert those cells are now diamonds that then fall and pile like sand when `step` runs — all headless, no DOM.

### Implementation for User Story 1

- [ ] T005 [US1] In `src/sim/element.ts`, extend `isPowder` to `e === SAND || e === DIRT || e === RAINBOW_SAND || e === DIAMOND` (no change to `isSolid`, which already derives from `isPowder`; `usesHueColor` stays explicitly unchanged — FR-016) (depends on T002)
- [ ] T006 [P] [US1] In `src/lib/palette.ts`, add a new `DIAMOND_RAMP: Rgb[]` (6-8 fixed icy-blue/white shades, visually distinct from `PINK_RAMP`/`GOLD_RAMP`) and one new branch in `colorFor`: `if (element === DIAMOND) return DIAMOND_RAMP[shade % DIAMOND_RAMP.length];`, ignoring `hue`/`isCloud` exactly like the SAND/WATER/DIRT branches (depends on T002)
- [ ] T007 [US1] In `src/sim/objects.ts`, add `applyChestConversions(grid: Grid, chests: PlacedObject[]): void` — structurally identical to `applyRainbowConversions`'s ring-bounds/footprint-skip loop, but converting only `SAND | DIRT | WATER` (never `FOG`, so no `fogCloudCount` bookkeeping) into `DIAMOND` with a fresh `randomShade()` plus `setGlitter(grid, x, y, 1)`; allocates nothing per call (depends on T002, T003)
- [ ] T008 [P] [US1] Create `src/lib/chestShape.ts` exporting `ChestShapePart` (`{ kind: 'rect' | 'path', d?, rect?, fill, stroke?, strokeWidth? }`) and `CHEST_SHAPE: readonly ChestShapePart[]` — the chest's box/lid/highlight geometry in the same 0–36 unit box `BucketIcon.svelte` uses, as the single source both the toolbar icon and the on-canvas drawing read (research.md §6)
- [ ] T009 [US1] Create `src/lib/ChestIcon.svelte` — an inline `<svg viewBox="0 0 36 36" width="1em" height="1em" aria-hidden="true" focusable="false">` built by mapping `CHEST_SHAPE`'s parts to `<rect>`/`<path>` elements, structurally identical in spirit to `BucketIcon.svelte` including its doc-comment convention explaining why an inline SVG exists (no treasure-chest Unicode glyph at all — FR-007) (depends on T008)
- [ ] T010 [P] [US1] In `src/lib/toolbarControls.ts`, add `{ id: 'tool-chest', group: 'objects', ariaLabel: 'Treasure chest' }` to `TOOLBAR_CONTROLS`
- [ ] T011 [US1] In `src/lib/Toolbar.svelte`: import `ChestIcon`, add a `{:else if control.id === 'tool-chest'}` branch rendering `<ChestIcon />` (same special-cased pattern `tool-sand`/`BucketIcon` already uses), and add `case 'tool-chest': onSelectTool('chest'); return;` to `handleClick` and `case 'tool-chest': return tool === 'chest';` to `isSelected` (no `glyphFor` case needed — chest never reaches that branch) (depends on T009, T010)
- [ ] T012 [US1] In `src/lib/PlayArea.svelte`'s `drawObjectGlyph`, add a branch before the existing `if (obj.kind !== 'palm')` fallback: `if (obj.kind === 'chest') { /* scales CHEST_SHAPE's 0-36 unit box to obj.size, draws each part via ctx.fillRect / ctx.beginPath()+fill(), translated to (obj.x, obj.y); no ctx.fillText — there is no glyph */ return; }` (depends on T008)
- [ ] T013 [US1] In `src/lib/PlayArea.svelte`'s `frame()`, add `applyChestConversions(grid, objectsState.byKind.chest);` immediately after the existing `applyRainbowConversions(grid, objectsState.byKind.rainbow);` call — this fixed call order is what makes FR-011's "no cell may alternate between diamond and rainbow sand" true by construction (research.md §4) (depends on T007; same file as T012, apply after it)

### Tests for User Story 1

- [ ] T014 [P] [US1] In `tests/unit/sim/objects.test.ts` (or a sibling `tests/unit/sim/objects.chest.test.ts`): place a chest via `placeObject`, seed `SAND`/`DIRT`/`WATER` into its ring, call `applyChestConversions`, assert every seeded cell is now `DIAMOND` with `glitter[i] === 1` (Scenarios 1-2); assert conversion still occurs after many synthetic re-seeded steps with no capacity flag anywhere on `PlacedObject` (Scenario 3, SC-002); assert an existing `DIAMOND` cell in the ring is left unchanged (Scenario 5); assert `GRASS`/`FLOWER`/`GUMDROP`/`STAR_POWER`/`FOG` in the ring are untouched and `grid.fogCloudCount` is unchanged (Scenario 6, FR-009); assert a chest at the grid edge converts only its in-bounds ring with no out-of-bounds write (Edge Cases) (depends on T007)
- [ ] T015 [P] [US1] In `tests/unit/sim/objects.test.ts` (same file/location as T014): place a rainbow and a chest with overlapping rings, seed pourable material in the overlap, call `applyRainbowConversions` then `applyChestConversions` (the same order `frame()` uses) across many synthetic steps, assert every overlap cell settles on `RAINBOW_SAND` and never becomes `DIAMOND`, and that re-running both calls produces no further change (Scenario 7, FR-011) (depends on T007; sequential with T014, same file)
- [ ] T016 [P] [US1] In `tests/unit/sim/step.test.ts`: seed `DIAMOND` cells on a slope, run `step(grid)`, assert they fall and pile at the same angle of repose as an equivalent `SAND` seed, and sink through a `WATER` cell exactly like `SAND` does (Scenario 4, FR-014) (depends on T005)
- [ ] T017 [P] [US1] In `tests/unit/sim/element.test.ts`: assert `isPowder(DIAMOND) === true` and `isSolid(DIAMOND) === true`; assert `usesHueColor(DIAMOND) === false` and that `usesHueColor`'s only `true` cases remain exactly `RAINBOW_SAND`/`GUMDROP`/`FLOWER` (FR-016 non-regression) (depends on T005)
- [ ] T018 [P] [US1] In `tests/unit/lib/palette.test.ts`: assert `colorFor(DIAMOND, shade, hue, isCloud)` depends only on `shade` (varying `hue`/`isCloud` produces no change) and cycles through `DIAMOND_RAMP` (depends on T006)
- [ ] T019 [P] [US1] In `tests/unit/shell/toolbarGlyphs.test.ts`: assert `Toolbar.svelte`'s source contains `<ChestIcon` and does not contain a substitute glyph (`🎁`, `📦`, `💰`) anywhere (FR-007) (depends on T011)

**Checkpoint**: User Story 1 is independently functional and testable — a chest converts pourable material to diamonds, diamonds fall/pile/sink like sand, the chest/rainbow overlap is stable, and the chest renders from code with no emoji fallback.

---

## Phase 4: User Story 2 - She builds a little world: a house and some people (Priority: P2)

**Goal**: House and person join the placeable-object roster as purely decorative kinds — same footprint/cap-of-3/eviction/erase/clear-all machinery as rainbow/unicorn/palm/flamingo, zero new simulation rules.

**Independent Test**: Place four houses and assert three remain with the oldest gone; drag an eraser across a house and a person and assert both are removed whole; clear-all and assert none remain.

### Implementation for User Story 2

- [ ] T020 [US2] In `src/lib/PlayArea.svelte`, extend `OBJECT_GLYPHS: Record<ObjectKind, string>` with `house: '🏠'` and `person: '🧑'` (not 🧍 — FR-005) — both hit the existing unanimated `ctx.fillText(OBJECT_GLYPHS[obj.kind], cx, cy)` fallback in `drawObjectGlyph`, no new animation state (FR-004) (depends on T002; same file as T012/T013, apply after them)
- [ ] T021 [US2] In `src/lib/toolbarControls.ts`, add `{ id: 'tool-house', group: 'objects', ariaLabel: 'House' }` and `{ id: 'tool-person', group: 'objects', ariaLabel: 'Person' }` to `TOOLBAR_CONTROLS` (same file as T010, apply after it)
- [ ] T022 [US2] In `src/lib/Toolbar.svelte`, add `case 'tool-house': return '🏠';` / `case 'tool-person': return '🧑';` to `glyphFor`, `case 'tool-house': onSelectTool('house'); return;` / matching `'tool-person'` case to `handleClick`, and matching `tool === 'house'` / `'person'` cases to `isSelected` (depends on T021; same file as T011, apply after it)

### Tests for User Story 2

- [ ] T023 [US2] In `tests/unit/sim/objects.test.ts`: place four houses, assert exactly three remain and the first-placed is gone while any existing person/chest lists are untouched (Scenario 2, SC-003); repeat the same shape for person and confirm chest's own cap-of-3 (already covered by T014) is unaffected by house/person placements (depends on T003; sequential with T014/T015, same file)
- [ ] T024 [US2] In `tests/unit/sim/objects.test.ts`: place a house and a person, erase across both in one interpolated drag (`eraseObjectsInBrushLine`), assert both are fully removed with no leftover `OBJECT` cell anywhere in their former footprints (Scenario 3, SC-004) (depends on T003; sequential, same file)
- [ ] T025 [US2] In `tests/unit/sim/objects.test.ts`: place all three new kinds plus existing kinds and some `DIAMOND` material, call `clearObjects`/`clearGrid`, assert the canvas is empty of every object and every element including diamonds (Scenario 4, FR-025) (depends on T003, T007; sequential, same file)
- [ ] T026 [US2] In `tests/unit/sim/objects.test.ts`: place a house at the very edge of the canvas, assert it nudges fully on-canvas exactly like a rainbow does today (Scenario 1) (depends on T003; sequential, same file)
- [ ] T027 [US2] In `tests/unit/shell/toolbarGlyphs.test.ts`: assert `Toolbar.svelte`'s source never contains `🧍` even though it does contain `🧑` (FR-005) (depends on T022)

**Checkpoint**: User Stories 1 AND 2 both work independently — houses and people place, cap, evict, erase, and clear exactly like existing objects, with no regression to rainbow/unicorn/palm/flamingo or to the chest/diamond mechanic.

---

## Phase 5: User Story 3 - Stars twinkle in her empty sky (Priority: P3)

**Goal**: Ambient sky twinkles appear over empty upper-canvas cells and fade in/out over time, entirely outside `Grid`/`WorldState` — never placed, never erased, never saved, never undone.

**Independent Test**: Ask the eligibility rule `updateStarField` uses which cells qualify for a given canvas and assert it returns only empty sky cells, never a cell holding material or covered by an object footprint, and never more than the cap.

### Implementation for User Story 3

- [ ] T028 [P] [US3] Create `src/lib/stars.ts` exporting `STAR_CAP = 16`, `STAR_SKY_FRACTION = 1/3`, `STAR_RESAMPLE_MS = 400`, the `StarField` interface (fixed-size `Int32Array`/`Uint8Array`/`Float64Array` slots, allocated once), `createStarField()`, `updateStarField(grid, field, now)` (reservoir-resamples eligible empty-sky cells — `elements[i] === EMPTY && y < grid.height * STAR_SKY_FRACTION` — at most once per `STAR_RESAMPLE_MS`, modeled on `sparkle.ts`'s `updateFlashMask`), and `drawStarField(ctx, field, now)` (sine-based fade alpha per slot); allocates nothing after `createStarField()` — no dependency on Foundational (T002-T004), may be built any time after Setup
- [ ] T029 [US3] In `src/lib/PlayArea.svelte`: create a `StarField` alongside `flashMask` in `onMount`/`resize()`; in `frame()`, add `updateStarField(grid, starField, now);` alongside the existing `updateFlashMask` call; in `render()`, add `drawStarField(ctx, starField, lastFrameNow);` after the existing particle-drawing loop so a twinkle is drawn last, over everything else; `saveNow`/`flushSave`/`tryRestore`/`clearAll` are untouched — `starField` is never a parameter to any of them (FR-021) (depends on T028; same file as T012/T013/T020, apply after them)

### Tests for User Story 3

- [ ] T030 [P] [US3] Create `tests/unit/lib/stars.test.ts`: build a grid with a mix of empty cells, painted material, and an `OBJECT` footprint; assert the eligibility rule returns exactly the empty cells in the upper `STAR_SKY_FRACTION` of the grid and that active slot count never exceeds `STAR_CAP` (Scenario 1, FR-020, FR-023); fill every upper-sky cell with `SAND` and assert no slot stays active over it (Scenario 2); assert `createStarField`/`updateStarField`/`drawStarField` are never referenced by `serializeWorld`, `captureWorldState`, `clearObjects`, or `clearGrid` — a static source-check plus a behavioral one (mutate a `StarField`, run undo/redo/clear-all/save-restore, assert none of those operations observably depend on or reset it) (Scenario 3, FR-021) (depends on T028)

**Checkpoint**: All three user stories are independently functional — stars twinkle over empty sky and never intersect the saved/undoable/erasable world.

---

## Phase 6: Cross-Cutting & Polish

**Purpose**: The FR-028 backward-compatibility fix, round-trip/remap coverage spanning all three stories, the toolbar-budget row drop that only makes sense once all three controls exist, and closing regression/manual gates

- [ ] T031 [P] In `src/sim/save.ts`'s `deserializeWorld`, change the per-kind loop so `const list = rawByKind[kind]; const rawList = Array.isArray(list) ? list : [];` (was: reject the whole payload when `list` isn't an array) — a *missing* key now reads as an empty list for that kind; a *present but malformed* list or item still returns `null` (FR-028, research.md §11) (depends on T003)
- [ ] T032 [P] In `src/sim/historySave.ts`'s `deserializeHistory` per-step loop, apply the identical `rawList` tolerance as T031 (depends on T003; independent file from T031)
- [ ] T033 [P] In `tests/unit/sim/save.test.ts`: construct a wire payload whose `byKind` has no `house`/`person`/`chest` keys (and, separately, no keys at all, simulating a genuinely pre-upgrade save) and assert `deserializeWorld` succeeds with those kinds' lists empty rather than `null`; construct a payload with a present-but-malformed `byKind.house` value and assert it still returns `null`; assert a world containing all three new kinds plus mid-fall diamonds round-trips cell-for-cell through `serializeWorld`/`deserializeWorld` (FR-026) (depends on T031)
- [ ] T034 [P] In `tests/unit/sim/historySave.test.ts`: mirror T033's missing-key/malformed-value coverage for `deserializeHistory`, plus a diamond round-trip through `serializeHistory`/`deserializeHistory` (depends on T032)
- [ ] T035 [P] In `tests/unit/sim/history.test.ts`: add round-trip/remap coverage for house/person/chest objects and diamonds through `captureWorldState`/`restoreWorldState`/`remapWorldState` (FR-026, FR-027, FR-029); explicitly assert `visibleSnapshot` and `usesHueColor`'s true-cases remain exactly `RAINBOW_SAND`/`GUMDROP`/`FLOWER` — this file is deliberately **not** touched to add `DIAMOND` (FR-016) (depends on T003, T005)
- [ ] T036 [P] In `tests/unit/sim/resize.test.ts`: add remap coverage for the three new kinds and diamonds through `resizeGrid` (FR-029) (depends on T003, T005)
- [ ] T037 In `tests/unit/lib/layout.test.ts`: remove the `{ label: 'small phone', width: 320, height: 568 }` row from `VIEWPORT_TABLE` and delete the `KNOWN_INFEASIBLE` set plus its dedicated "cannot clear both floors" test block (FR-031a); add a comment at `VIEWPORT_TABLE`'s declaration recording why (no device either maintainer verifies on is smaller than 375×667); confirm every remaining row passes `computeToolbarLayout(...).fits === true` at the real shipped counts (`shippedToolbarControls(false, false).length === 26`, `(true, true).length === 28`) with `controlSize >= MIN_TOUCH_TARGET` and `pitch >= MIN_PITCH`, with no widened band, lowered floor, or hidden control (FR-031b) (depends on T010, T011, T021, T022 — all three toolbar controls must exist first)
- [ ] T038 [P] Run `npm test` and confirm every test from specs 001–014/016 still passes, changed only where this feature's amendments make an assertion obsolete (the dropped 320×568 row) — no other existing test file changes (FR-030, SC-011) (depends on T014-T037)
- [ ] T039 [P] Run `npm run build`, confirm `dist/index.html` is the only file emitted, and confirm no new external asset or runtime network request was introduced by the chest's code-drawn appearance (FR-007, Constitution Principle I, SC-010) (depends on T014-T037)
- [ ] T040 Perform the manual/on-device checks from quickstart.md's "Manual-only checks" section: Charlie on Fire 7 Silk + desktop Chrome and Max on iPad Safari standalone — the drawn chest reads as a treasure chest at footprint size (not an abstract box); diamonds read as sparkling treasure, visually distinct from pink sand and gumdrops; 🏠/🧑 render as glyphs, not boxes; the ambient sky twinkle is pretty, not distracting; the toolbar at 26/28 controls still reads as a friendly cluster at the smallest guaranteed viewport (375×667) — record findings on issue #47 (depends on T038, T039)
- [ ] T041 Governance reminder (FR-035, not a file edit in this task list): this feature's final PR must include a constitution amendment to `.specify/memory/constitution.md`'s Product Constraints stating (a) diamonds join the element list and house/person/chest join the objects list, and (b) the objects list's "no custom artwork assets" clause is amended to permit shapes drawn in code for an object with no Unicode glyph (the chest's case). Per Governance, merging that amendment is the human gate's call — flag it on issue #47 rather than authoring it here

**Checkpoint**: Every functional requirement is implemented and covered by headless tests; the toolbar budget check reflects the real 26/28-control count; the full pre-existing suite passes unchanged; manual/on-device gates and the governance amendment are flagged for the human reviewer.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS User Story 1 and User Story 2
- **User Story 1 (Phase 3)**: Depends on Foundational (T002, T003) completion
- **User Story 2 (Phase 4)**: Depends on Foundational (T002, T003); its `Toolbar.svelte`/`toolbarControls.ts` tasks (T021, T022) also depend on User Story 1's edits to the same files (T010, T011) since both extend the same manifest/component; its `objects.test.ts` tasks (T023-T026) depend on User Story 1's tests in the same file (T014, T015) only in the sense of avoiding merge conflicts, not logical dependency
- **User Story 3 (Phase 5)**: Has **no** dependency on Foundational or on User Story 1/2 — `stars.ts` (T028) touches no `src/sim/*` type and no `ObjectKind`/`Tool` member; only its `PlayArea.svelte` wiring (T029) needs to interleave with the other stories' edits to the same file (T012, T013, T020) to avoid merge conflicts. T028/T030 may be built in parallel with Phases 2-4
- **Cross-Cutting & Polish (Phase 6)**: T031-T036 depend only on Foundational (T003) and, where noted, on User Story 1's `applyChestConversions`/`isPowder` (T007, T005); T037 depends on all three toolbar controls existing (T010, T011, T021, T022); T038-T041 depend on everything above

### Within Each User Story

- `src/lib/PlayArea.svelte` edits are strictly sequential across the whole feature in this order: T004 (Foundational) → T012 → T013 (US1) → T020 (US2) → T029 (US3) — every one edits the same file
- `src/lib/Toolbar.svelte` edits are strictly sequential: T011 (US1) → T022 (US2)
- `src/lib/toolbarControls.ts` edits are strictly sequential: T010 (US1) → T021 (US2)
- `tests/unit/sim/objects.test.ts` edits are strictly sequential: T014 → T015 (US1) → T023 → T024 → T025 → T026 (US2)
- `src/sim/objects.ts` edits are sequential: T003 (Foundational) → T007 (US1, `applyChestConversions`)

### Parallel Opportunities

- T002 has no parallel partner (everything in Foundational depends on it directly or transitively)
- T005 (element.ts) and T006 (palette.ts) — different files, both depend only on T002, no dependency on each other
- T008 (chestShape.ts) and T010 (toolbarControls.ts) — different files, no dependency on each other or on T005/T006/T007
- T028 (stars.ts) and T030 (stars.test.ts, once T028 lands) can proceed at any point after Setup, in parallel with all of Phases 2-4
- T031 (save.ts) and T032 (historySave.ts) — different files, identical fix applied independently
- T033-T036 — four different test files, each depending only on the sim-layer change it covers
- T038 and T039 — independent commands (`npm test`, `npm run build`)

---

## Parallel Example: Foundational → User Story 1 handoff

```bash
# After T002 (types.ts) lands, launch both together — different files, both depend only on T002:
Task: "Extend isPowder in src/sim/element.ts to include DIAMOND"
Task: "Add DIAMOND_RAMP and colorFor's new branch in src/lib/palette.ts"

# Independently, once Setup is done, this can start any time regardless of the above:
Task: "Create src/lib/stars.ts per contracts/toolbar-and-rendering.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002-T004) — CRITICAL, blocks US1 and US2
3. Complete Phase 3: User Story 1 (T005-T019)
4. **STOP and VALIDATE**: `npm test` proves chest conversion, diamond fall/pile/sink, and the rainbow/chest overlap ordering all hold; on-device, drop a chest and pour sand over it and confirm it reads as a "diamond fountain" (SC-001)
5. This alone delivers the feature's one new behaviour and the reason diamonds exist — houses/people/stars are additive delight that can each ship as a fast-follow

### Incremental Delivery

1. Setup + Foundational → shared `ObjectKind`/`Tool`/placement-dispatch plumbing ready
2. Add User Story 1 → chest→diamond mechanic ships (MVP!)
3. Add User Story 2 → house/person decoration ships, no regression to US1
4. Add User Story 3 → ambient stars ship, structurally isolated from everything saved/undoable
5. Cross-Cutting & Polish → FR-028 backward-compat fix, round-trip/remap coverage, toolbar-budget row drop, full regression, manual gates, governance flag

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T004)
2. Once Foundational is done:
   - Developer A: User Story 1 (chest/diamond) — T005-T019
   - Developer B: User Story 3 (stars) — T028-T030, fully independent, can start even before Foundational finishes
   - Developer C: waits for Developer A's toolbar edits (T010, T011) before starting User Story 2's toolbar tasks (T021, T022), but can start `objects.test.ts` cap/eviction assertions (T023) as soon as T003 lands
3. Cross-Cutting & Polish (Phase 6) starts once all three stories' sim-layer pieces exist; T037 (toolbar table) specifically waits on every toolbar-manifest task from both US1 and US2

## Notes

- `[P]` tasks = different files, no dependencies
- `[Story]` label maps task to specific user story for traceability
- Foundational tasks carry no `[Story]` label by design (per the task-format rules) even though they exist entirely to unblock US1/US2
- This feature adds zero new runtime dependencies and touches no build tooling — every task above is a source or test file edit
- Diamonds are deliberately **not** added to `usesHueColor` or `history.test.ts`'s `visibleSnapshot` (FR-016) — T035 asserts this explicitly rather than silently relying on no task touching those two spots
- Commit after each task or logical group; stop at any checkpoint to validate a story independently
- Tests are interleaved with implementation within each story (per quickstart.md's per-scenario mapping) rather than a separate "write tests first" phase, matching this repository's existing spec 012/013 task-list convention
