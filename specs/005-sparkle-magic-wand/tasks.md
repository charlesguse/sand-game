---

description: "Task list template for feature implementation"
---

# Tasks: Sparkle Magic Wand

**Input**: Design documents from `/specs/005-sparkle-magic-wand/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/wand-mechanics.md, quickstart.md

**Tests**: The spec explicitly requires automated tests (FR-027, "The project MUST provide automated tests..."), so test tasks are included per user story.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. This feature builds directly on `001-falling-pink-sand`, `002-water-and-purple-dirt`, `003-rainbow-unicorn-magic`, and `004-landscape-scenes` — no scaffolding tasks are needed; every file touched already exists except the two new ones this feature adds (`src/sim/wand.ts`, `src/lib/sparkle.ts`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single client-only project (unchanged from 001–004): `src/sim/*` (framework-free core), `src/lib/*` (Svelte UI), `tests/unit/sim/*` (vitest, no DOM).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No project initialization is needed — `package.json`, `vite.config.ts`, `vitest.config.ts`, and the 001–004 scaffold already exist and are unchanged by this feature (plan.md's Technical Context). This phase only adds the two additive type-level shapes every later task builds on.

- [X] T001 In `src/sim/types.ts`, add `'wand'` to the `Tool` union (`export type Tool = 'sand' | 'water' | 'dirt' | 'rainbow' | 'unicorn' | 'eraser' | 'wand';`) and add `readonly glitter: Uint8Array;` to the `Grid` interface, alongside `elements`/`shades`/`moved`/`hues` — addition only, no existing field or union member removed (contracts/wand-mechanics.md `src/sim/types.ts` section, data-model.md Grid/Tool sections)

**Checkpoint**: `Tool`/`Grid` compile with the new shapes; nothing yet allocates or reads `glitter`, and no UI offers `'wand'` as a selectable tool.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared per-cell storage and physics-carry behavior every user story depends on — glitter must exist on every `Grid`, be resettable by drawing/erasing/clearing, and travel with a grain through `step()` — before any wand-specific code can be meaningfully tested. This phase has no user-story label because both the conversion story (US1) and the sprinkle story (US2) write and read `glitter` through these same primitives, and a moving/falling grain (from either story) must carry its glitter correctly regardless of which story placed it.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] In `src/sim/grid.ts`: `createGrid` additionally allocates `glitter` as a zero-initialized `Uint8Array(width * height)`, same discipline as `elements`/`shades`/`hues`; `setCell(grid, x, y, element, shade)` additionally sets `grid.glitter[y * grid.width + x] = 0` whenever `(x, y)` is in bounds (out-of-bounds stays a no-op); `clearGrid(grid)` additionally calls `grid.glitter.fill(0)`; add two new exported accessors, `setGlitter(grid: Grid, x: number, y: number, value: 0 | 1): void` (no-op out of bounds, otherwise writes only `glitter[i]`, never touching `elements`/`shades`/`hues`) and `getGlitter(grid: Grid, x: number, y: number): boolean` (returns `false` out of bounds, otherwise `glitter[i] === 1`) — mirrors `setCell`/`getElement`/`getShade`'s existing bounds behavior exactly (contracts/wand-mechanics.md `src/sim/grid.ts` section, research.md §1 and §3; depends on T001)
- [X] T003 [P] In `src/sim/step.ts`, extend the private `moveCell(grid, fromIndex, toIndex)` to additionally copy `grid.glitter[fromIndex]` to `grid.glitter[toIndex]` and then zero `grid.glitter[fromIndex]`, and extend the private `swapCells(grid, aIndex, bIndex)` to additionally swap `grid.glitter[aIndex]` and `grid.glitter[bIndex]` — mirroring exactly how each helper already handles `elements`/`shades`/`hues`; no change to `step()`'s public signature, dispatch order, or `moved` bookkeeping (contracts/wand-mechanics.md `src/sim/step.ts` section, research.md §2, FR-008; depends on T001)
- [X] T004 [P] In `src/sim/brush.ts`, add `export` to the existing private `forEachFootprintCell(cx, cy, radius, fn)` helper — identical implementation, no behavior change to it or to `applyBrush`/`applyBrushLine` (contracts/wand-mechanics.md `src/sim/brush.ts` section; depends on T001)

**Checkpoint**: Every `Grid` carries a working, zero-reset-on-draw, physics-correct `glitter` array; `forEachFootprintCell` is available for reuse. No wand tool exists yet in the UI, and `src/sim/wand.ts` has not been created — that is User Story 1's job below.

---

## Phase 3: User Story 1 - Turn what she already drew into glitter (Priority: P1) 🎯 MVP

**Goal**: A ✨ wand tool that, when dragged over existing pink sand, water, magic purple dirt, or rainbow sand, marks every covered cell glittered without changing its element type or its physics, with glitter travelling with a grain as it moves and surviving rainbow conversion, idempotent on repeat passes, and never touching an occupied cell's contents (FR-001–FR-014).

**Independent Test**: Select the wand, drag it across a region containing each element, and confirm every covered element cell is marked glittered while its element type and its movement behavior are unchanged. Fully verifiable in automated tests against play-area state alone, with no browser; the twinkling itself is a maintainer eyeball check.

### Tests for User Story 1 ⚠️

> Write these tests FIRST, ensure they FAIL before implementation (T007 makes them pass)

- [X] T005 [P] [US1] Create `tests/unit/sim/wand.test.ts` (imports `applyWand`, `applyWandLine` from `../../../src/sim/wand`, `createGrid`, `setCell`, `getElement`, `getGlitter` from `../../../src/sim/grid`, `applyRainbowConversions` from `../../../src/sim/objects`, `SAND`, `WATER`, `DIRT`, `RAINBOW_SAND`, `EMPTY` from `../../../src/sim/types`) with a `describe('wand — conversion rule', ...)` block asserting: (a) seeding one cell of each of `SAND`/`WATER`/`DIRT`/`RAINBOW_SAND` via `setCell`, calling `applyWand` over all of them, every seeded cell reports `getGlitter(...) === true` and `getElement(...)` unchanged (FR-006, SC-002); (b) calling `applyWand` a second and third time with identical arguments against that same grid produces byte-identical `elements`/`shades`/`hues`/`glitter` arrays to the state after the first call (FR-010, SC-005); (c) no seeded cell's `getElement` ever becomes `EMPTY` or a different element, and no cell outside the wand's footprint gains a glitter bit (FR-011, SC-006); (d) seeding a glittered `SAND` cell adjacent to a placed rainbow object (via `createObjectsState`/`placeObject`) and running `applyRainbowConversions`, the resulting `RAINBOW_SAND` cell still reports `getGlitter(...) === true` (FR-009)
- [X] T006 [P] [US1] In `tests/unit/sim/step.test.ts`, add a `describe('step — glitter travels with a grain', ...)` block: seed a glittered powder grain with `setCell` + `setGlitter` above empty space, call `step()`, and assert the glitter bit is now `true` at the grain's new (fallen) position and `false` at the vacated cell (FR-008, SC-004); and a swap case — seed two adjacent grains under rules that cause them to swap (e.g. a powder above a liquid), one glittered and one not, call `step()`, and assert each grain kept its own glittered/plain state after the swap, never trading it (FR-008, US1 Acceptance Scenario 4) (depends on T002, T003)

### Implementation for User Story 1

- [X] T007 [US1] Create `src/sim/wand.ts` and implement `applyWand(grid: Grid, cx: number, cy: number, radius: number): void` per contracts/wand-mechanics.md: iterate the circular footprint via the now-exported `forEachFootprintCell` from `brush.ts`; for each in-bounds covered cell, if `elements[i] === OBJECT` do nothing; else if `elements[i] !== EMPTY` call `setGlitter(grid, x, y, 1)` only (never `setCell`, never touching `elements`/`shades`/`hues`); else (`EMPTY`) do nothing for now — the sprinkle branch is User Story 2's task (T013). Implement `applyWandLine(grid, from, to, radius): void` Bresenham-interpolating `applyWand` along the whole segment, identical interpolation shape to `applyBrushLine`, so a fast drag leaves no gaps (FR-003, US1 Acceptance Scenario 7). Allocates nothing — a single pass per cell, no candidate array (FR-023) (depends on T002, T004; makes T005 pass)
- [X] T008 [US1] Create `src/lib/sparkle.ts` exporting `FLASH_CAP: number` (a small fixed constant, e.g. 24), `createFlashMask(width: number, height: number): Uint8Array` (allocates a zero-filled mask sized `width * height`), and `updateFlashMask(grid: Grid, mask: Uint8Array): void` (clears `mask`, then does one forward pass over `grid.elements`/`grid.glitter`, reservoir-sampling up to `FLASH_CAP` indices where the cell is glittered and non-`EMPTY`/non-`OBJECT`, setting each sampled index's mask bit to `1`) — allocates nothing per call beyond the one-time mask (FR-022, FR-023, research.md §6; not imported by `src/sim/*` or any `tests/unit/sim/*` test, per data-model.md's Sparkle flash section)
- [X] T009 [US1] In `src/lib/PlayArea.svelte`, add a `tool === 'wand'` branch to `paintAt` that calls `applyWandLine`/`applyWand` (imported from `../sim/wand`) instead of `applyBrush(Line)`, using the same `cx`/`cy`/radius-from-`brushSize` plumbing the element brushes already use (FR-004) (depends on T007)
- [X] T010 [US1] In `src/lib/PlayArea.svelte`: allocate one `flashMask` via `createFlashMask` in `onMount`, sized to the grid like `imageData`; call `updateFlashMask(grid, flashMask)` once per animation frame in `frame()`, before `render()`; extend `render()`'s existing per-cell loop to read `flashMask[i]` (draw a brief bright highlight when set) and `grid.glitter[i]` (apply a gentle color-shimmer nudge to the cell's base color, e.g. a small sine-modulated brightness offset keyed off the current frame timestamp) in addition to the existing `colorFor` lookup — both reads are O(1) additions inside the loop that already visits every cell, with no new allocation (FR-023, FR-024, research.md §6; depends on T008)
- [X] T011 [US1] In `src/lib/Toolbar.svelte`, add one `<button class="control" class:selected={tool === 'wand'} aria-label="Magic wand" onclick={() => onSelectTool('wand')}>✨</button>` to the toolbar, participating in the existing `onSelectTool` callback and `.control`/`.selected` pattern exactly like every element/eraser button, sized and placed so the toolbar still fits on screen without scrolling on both a laptop and a tablet (FR-001, FR-002, FR-005; no `Toolbar` `Props` change needed — `onSelectTool` already exists)

**Checkpoint**: The ✨ wand is selectable, paints glitter onto existing grains along the whole drag path with no gaps, glitter travels correctly through `step()`, survives rainbow conversion, is idempotent, and never alters an occupied cell's element or displaces it; glittered grains visibly flash and shimmer. User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Sprinkle glitter into thin air (Priority: P2)

**Goal**: Dragging the wand over empty space sprinkles a sparse, multicoloured dusting of the toy's existing rainbow sand, already glittered, which falls and piles under exactly the rules rainbow sand already obeys — without ever fighting with the occupied-cell glitter rule in a mixed region (FR-015–FR-017).

**Independent Test**: Drag the wand across an entirely empty region and confirm that some but not all covered cells become glitter grains, that the resulting grains fall and pile under the normal powder rules, and that they respond to the eraser, clear-all, rainbow conversion, and unicorn touch like every other element. Fully verifiable without a browser.

### Tests for User Story 2 ⚠️

> Write these tests FIRST, ensure they FAIL before implementation (T013 makes them pass)

- [X] T012 [P] [US2] In `tests/unit/sim/wand.test.ts`, add a `describe('wand — sprinkle into empty space', ...)` block: (a) call `applyWand` against an entirely-`EMPTY` region and assert the resulting count of `RAINBOW_SAND` + glittered cells is strictly greater than zero and no more than one third of the covered empty-cell count (FR-015, SC-007); (b) assert those sprinkled cells report more than one distinct `hues[i]` value (FR-016); (c) assert a sprinkled cell is structurally indistinguishable from any other glittered `RAINBOW_SAND` cell — same `elements`/shape, reachable via the same `getElement`/`getGlitter` accessors, no separate marker (FR-017); (d) a mixed-region test: seed half the covered footprint with an element via `setCell` and leave half `EMPTY`, call `applyWand` once, and assert every originally-occupied cell is glittered with its element unchanged while sprinkled grains appear only among the originally-empty cells, with zero overlap or conflict between the two rules (US2 Acceptance Scenario 7, FR-027); (e) a repeat-pass idempotency test mirroring T005(b) but over the mixed/empty region, confirming SC-005 holds once sprinkling is included (depends on T005)

### Implementation for User Story 2

- [X] T013 [US2] In `src/sim/wand.ts`'s `applyWand`, replace the `EMPTY`-cell no-op from T007 with the sprinkle branch: if `(x, y)` satisfies a fixed position-only lattice test (research.md §4, e.g. `((x + 2 * y) % 5 + 5) % 5 === 0`, giving ~1-in-5 density and never exceeding one third of any supported brush radius's disk), call `setCell(grid, x, y, RAINBOW_SAND, <position-keyed shade>)` then set `grid.hues[i]` to a position-keyed hue derived from `(x, y)` via a different fixed hash than the lattice test (research.md §5), then `setGlitter(grid, x, y, 1)`; otherwise leave the cell untouched. Eligibility and color must depend only on `(x, y)`, never on `Math.random()`, call history, or how many other cells in the pass were already sprinkled, so repeated passes stay byte-identical (FR-010, SC-005, research.md §4/§5) (depends on T007; makes T012 pass)

**Checkpoint**: A wand pass over empty space produces a sparse, multicoloured, physics-correct dusting of glittered rainbow sand; a mixed pass glitters occupied cells and sprinkles only the empty ones with no conflict. User Stories 1 and 2 both work independently and together.

---

## Phase 5: User Story 3 - Glitter the unicorn and get a party (Priority: P3)

**Goal**: When the wand's coverage reaches a placed 🦄 unicorn, it emits a celebration burst visibly bigger than its ordinary touch sparkle, spaced out on repeat and independent per unicorn, while a placed 🌈 rainbow is left completely untouched (FR-018–FR-021, FR-013).

**Independent Test**: Point the wand at a placed unicorn and confirm a celebration burst is emitted that is larger than the unicorn's ordinary touch celebration, that holding the wand there does not emit an unbounded stream, and that the total number of live sparkle glyphs never exceeds the existing cap. Verifiable without a browser by inspecting the sparkle-effect state.

### Tests for User Story 3 ⚠️

> Write T017 FIRST for the grid-state-observable part, ensure it FAILs before T016 makes it pass; burst timing/count are a maintainer-eyeball check per research.md §6/§8 and are not part of the automated suite

- [X] T017 [P] [US3] In `tests/unit/sim/wand.test.ts`, add a `describe('wand — objects are left untouched', ...)` block: place a rainbow and a unicorn via `createObjectsState`/`placeObject`, run `applyWand`/`applyWandLine` with coverage crossing both footprints entirely, and assert every footprint cell still reports `getElement(...) === OBJECT` with `getGlitter(...) === false` throughout, and that `objectsState.rainbows`/`.unicorns` are unchanged in length, position, and size after the wand pass (FR-013, FR-027, US1 Edge Cases "Wand over an object footprint") (depends on T007)

### Implementation for User Story 3

- [X] T014 [P] [US3] In `src/sim/objects.ts`, add `export` to the existing private `footprintIntersectsCircle(obj, cx, cy, radius)` helper — identical implementation, no behavior change to it or to any other export (contracts/wand-mechanics.md `src/sim/objects.ts` section)
- [X] T015 [P] [US3] In `src/lib/particles.ts`, widen `Particle['glyph']` to `'✨' | '💖' | '🎉'` and widen `spawn`'s existing random glyph choice to include `'🎉'`; add an optional fourth parameter `count?: number` to `spawnBurst(particles, atX, atY, now, count = BURST_COUNT)` so the existing ordinary-touch-celebration call site (unchanged, omits the new parameter) is unaffected by the default, while a caller can request a larger burst through the same `spawn()`/`MAX_PARTICLES`-capped path (FR-018, FR-021, research.md §8–§9)
- [X] T016 [US3] In `src/sim/wand.ts`, implement `unicornsTouchedByWandLine(objects: ObjectsState, from: {x,y}, to: {x,y}, radius: number): PlacedObject[]`: Bresenham-walks the segment (identical interpolation shape to `applyWandLine`/`eraseObjectsInBrushLine`) and collects every distinct unicorn in `objects.unicorns` for which the now-exported `footprintIntersectsCircle` is true at any point on the path; returns `[]` if none; never reads or writes `objects.rainbows` or `Grid` (FR-020, research.md §8; depends on T014; makes T017 pass alongside T007)
- [X] T018 [US3] In `src/lib/PlayArea.svelte`'s `paintAt`, when `tool === 'wand'`, additionally call `unicornsTouchedByWandLine` against the current stroke segment and `objectsState`; for each returned unicorn, add/check a new `lastWandBurstAt` timestamp field in that unicorn's existing `unicornTimers` map entry (alongside `lastBurstAt`/`lastIdleAt`) against a fixed cooldown constant — if elapsed, call `spawnBurst(particles, atX, atY, now, WAND_BURST_COUNT)` (a small multiple of `BURST_COUNT`, e.g. 3×) and update `lastWandBurstAt`; the cooldown is tracked independently per unicorn, so one unicorn's cooldown never suppresses another's celebration in the same drag (FR-018, FR-019, FR-020, US3 Acceptance Scenarios 1–3; depends on T015, T016)

**Checkpoint**: All three user stories are independently functional. A wand pass never glitters or alters a rainbow or unicorn's footprint; crossing a unicorn fires a bigger, capped, per-unicorn-cooldown celebration burst.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification that this feature adds no regression and meets its build/performance/manual-check bar.

- [X] T019 [P] Run `npm run build` and confirm `dist/` contains exactly one file, `dist/index.html`, with zero new runtime dependencies added to `package.json` (FR-028, SC-018)
- [X] T020 [P] Run `npm test` and confirm every test from `specs/001-falling-pink-sand` through `specs/004-landscape-scenes` still passes unchanged, alongside the new `wand.test.ts` suite and `step.test.ts`'s new glitter-travel cases (FR-026, FR-027, SC-014, SC-016)
- [ ] T021 [P] BLOCKED (this run has no browser access — requires a maintainer with a running `npm run dev` session): Manually validate quickstart.md's "Manual-only checks" section in a running `npm run dev` session: glittered pink sand still reads as pink sand while shimmering; flashes look like scattered glitter catching the light, never a uniform whole-pile pulse; a large glittered area is comfortable to look at; the sprinkled dusting looks shaken from a pot, not a coloured stripe; the unicorn's wand burst is unmistakably the biggest, most exciting thing in the toy and doesn't get annoying when repeated; the ✨ button reads as "make magic" and the toolbar with it added still fits on screen with no scrolling, on both a laptop and a tablet (spec's "Visual checks for the maintainer" section — no automated coverage)
- [ ] T022 [P] BLOCKED (this run has no browser/devtools access — requires a maintainer on a laptop/tablet): Manually validate quickstart.md's Performance check (FR-024, SC-011, SC-012): on a mid-range laptop and, if available, a tablet, glitter the entire play area (repeated wand drags or a wanded scene) with elements in motion and confirm the devtools FPS overlay shows ≥30fps sustained, targeting 60fps, with no allocation spikes in the per-frame profile

---

## Phase 7: Convergence

- [ ] T023 In `tests/unit/sim/step.test.ts`'s `describe('step — glitter travels with a grain', ...)` block, add a case that seeds a glittered, fully-rested grain (blocked on all sides, matching the existing "rests when fully blocked" pattern), calls `step()` many times (e.g. 50), and asserts `getGlitter(...)` is still `true` throughout — glitter never fades on its own with the passage of simulated time (FR-014, missing)
- [ ] T024 In `tests/unit/sim/grid.test.ts`, add assertions that `setCell` resets `glitter[i]` to `0` when drawing a fresh element over a cell whose `glitter` bit was previously set via `setGlitter`, and that `clearGrid` zeroes the entire `glitter` array alongside `elements` — closing FR-027/FR-012's explicitly-required "erase/clear-all leaving no glitter state behind" automated coverage, which is currently only asserted indirectly (FR-012, missing)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (T001's `Tool`/`Grid` shapes) — BLOCKS all user stories (T007's `applyWand` needs T002's accessors and T004's export; every user story's tests need T002/T003's grid/step behavior).
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) completion only.
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) completion and on User Story 1's `applyWand`/`wand.test.ts` (T007, T005) existing, since T013 extends the same function T007 created and T012 extends the same test file T005 created — not independent of US1's *code*, though it is independently testable once T007 exists (the occupied-cell branch is a no-op that T013 leaves untouched).
- **User Story 3 (Phase 5)**: Depends on Foundational (Phase 2) and on T007 (`applyWand`/`applyWandLine` existing, for the OBJECT-skip behavior T017 asserts); independent of User Story 2's sprinkle branch (T013) — T016/T018 only need `wand.ts` and `objects.ts` to exist, not the sprinkle logic.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### Within Each User Story

- Tests (T005/T006, T012, T017) MUST be written and FAIL before their corresponding implementation task (T007, T013, T016) makes them pass.
- `applyWand`'s conversion branch (T007) before its sprinkle branch (T013) — same function, same file, sequential by construction.
- `sparkle.ts` (T008) before wiring it into `PlayArea.svelte` (T010).
- `PlayArea.svelte` wand-painting wiring (T009) and flash/shimmer wiring (T010) touch the same file — do T009 first so a wand stroke has visible effect before the flash/shimmer polish lands on top of it.
- `unicornsTouchedByWandLine` (T016) before wiring it into `PlayArea.svelte` (T018); `spawnBurst`'s widened signature (T015) before T018 calls it with a `count`.

### Parallel Opportunities

- All Foundational tasks marked [P] (T002, T003, T004) touch different files and can run in parallel once T001 lands.
- T005 and T006 (US1 tests, different files) can be drafted in parallel.
- T008 (`sparkle.ts`, a new file) can be implemented in parallel with T007 (`wand.ts`) — neither depends on the other.
- T014 and T015 (US3, different files — `objects.ts` and `particles.ts`) can run in parallel, and both can run in parallel with US2's T012/T013 once Foundational is done, since US2 and US3 touch disjoint parts of `wand.ts`/`PlayArea.svelte` until their respective wiring tasks (T013 vs. T016/T018).
- T019, T020, T021, T022 (Polish) can all run in parallel with each other.

---

## Parallel Example: User Story 1 foundation

```bash
# Once Setup (T001) is done, these can proceed in parallel:
Task: "Extend grid.ts with glitter allocation/reset/accessors" (T002)
Task: "Extend step.ts's moveCell/swapCells to carry glitter" (T003)
Task: "Export forEachFootprintCell from brush.ts" (T004)

# Once Foundational is done, these can proceed in parallel:
Task: "Create wand.test.ts with conversion-rule assertions" (T005)
Task: "Add glitter-travel assertions to step.test.ts" (T006)
Task: "Create sparkle.ts's flash-mask module" (T008)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001).
2. Complete Phase 2: Foundational (T002–T004) — CRITICAL, blocks all stories.
3. Complete Phase 3: User Story 1 (T005–T011).
4. **STOP and VALIDATE**: Run `wand.test.ts`/`step.test.ts`'s new cases; manually drag the ✨ wand over hand-drawn pink sand, water, and dirt and confirm glitter appears, travels correctly, and never alters the pile.
5. Per the spec's own stretch-feature framing (Assumptions: "if that cannot be done within the performance budget, the whole feature is dropped rather than shipped degraded"), this is the feature's floor — shipping only this already delivers the sparkle party.

### Incremental Delivery

1. Setup + Foundational → glitter storage and physics-carry ready, no visible tool yet.
2. Add User Story 1 → the wand converts existing grains, sparkles, and shimmers; fully shippable on its own (MVP!).
3. Add User Story 2 → the wand also sprinkles glitter into empty space.
4. Add User Story 3 → the wand also triggers a bigger unicorn celebration.
5. Polish → build/test/manual/performance sign-off.

Per the spec's Assumptions, this priority order doubles as the cut order in reverse: if performance or schedule forces a cut, drop User Story 3 first, then User Story 2, keeping User Story 1 intact.

### Parallel Team Strategy

With multiple developers, after Foundational (Phase 2) is done:

- Developer A: User Story 1 (T005–T011) — the critical path, since US2 and US3 both extend `wand.ts`/`wand.test.ts` that US1 creates.
- Developer B: once T007 lands, User Story 2's sprinkle branch (T012–T013).
- Developer C: once T007 lands, User Story 3's object-export and particle work (T014, T015, T017), converging on T016/T018 once T007 and T014/T015 are all in.
- Converge on Polish (Phase 6) once all desired stories are done.

---

## Notes

- [P] tasks touch different files, or independent regions/describe-blocks of the same file, with no dependency ordering between them.
- [Story] label maps task to specific user story for traceability.
- This feature changes exactly two existing `src/sim/*` files' *behavior* (`grid.ts`, `step.ts`) and exports two previously-private helpers unchanged in behavior (`brush.ts`, `objects.ts`) — no existing exported *signature* changes anywhere in `src/sim/*`, so every 001–004 test keeps passing by construction (FR-026).
- No new dependency is added anywhere in this task list — sprinkle placement uses plain positional arithmetic (research.md §4/§5), not a PRNG library.
- Commit after each task or logical group; stop at either checkpoint to validate a story independently.
- T007 and T013 (the two `applyWand` halves) and T016/T018 (the unicorn-burst wiring) are this feature's only tasks with real design risk; everything else is direct reuse of existing, unmodified primitives (`setCell`, `forEachFootprintCell`, `footprintIntersectsCircle`, `spawnBurst`).
