# Quickstart: Houses, People, And Treasure

How to build and validate this feature end-to-end once implemented. See
[data-model.md](./data-model.md) for entity details and
[contracts/elements-and-objects.md](./contracts/elements-and-objects.md) /
[contracts/toolbar-and-rendering.md](./contracts/toolbar-and-rendering.md)
for the exact APIs. This extends every prior spec's quickstart — the
single-file/`file://` build steps are not repeated in full here.

## Prerequisites

- Node 22 (matches `.github/workflows/deploy-pages.yml`)
- `npm install` from a checkout with specs 001–013's scaffold already in
  place (`src/sim/*`, `src/lib/layout.ts`, `src/lib/toolbarControls.ts`,
  `src/lib/BucketIcon.svelte`, existing tests)

## Build and run the tests

```bash
npm install
npm run build     # emits dist/index.html — must be the ONLY file in dist/
test -f dist/index.html
npm test           # vitest — sim/lib rules, no browser required
```

Both must succeed from a clean checkout. Every existing test from specs
001–013 must still pass, changed only where this feature's amendments make
an assertion obsolete (the dropped 320×568 viewport row, FR-031a).

## Validate User Story 1 — the treasure chest turns her sand into diamonds (P1)

Reference: spec Acceptance Scenarios 1–7 under User Story 1.

**Automated coverage** (new tests alongside `tests/unit/sim/objects.test.ts`
/ a new `tests/unit/sim/objects.chest.test.ts`, headless, no DOM):
1. Place a chest via `placeObject(grid, state, 'chest', cx, cy)`; paint
   `SAND`/`WATER`/`DIRT` cells into its one-cell ring (`SAND`/`DIRT`/`WATER`
   via `setCell`, matching how `applyRainbowConversions`'s own tests seed
   cells); call `applyChestConversions(grid, state.byKind.chest)`; assert
   every seeded ring cell is now `DIAMOND` with `glitter[i] === 1` (Scenario
   1, 2).
2. Call `applyChestConversions` repeatedly across many synthetic "steps"
   (interleaved with `step(grid)` so diamonds actually fall) with a
   continuous re-seed of `SAND` into the ring each iteration; assert
   conversion still occurs at iteration 10,000 with no thrown error, no
   capacity flag anywhere on `PlacedObject` (Scenario 3, SC-002).
3. Seed a `DIAMOND` cell directly in a chest's ring, run
   `applyChestConversions` again, assert it is unchanged (Scenario 5).
4. Seed `GRASS`, `FLOWER`, `GUMDROP`, `STAR_POWER`, `FOG` in a chest's ring,
   run `applyChestConversions`, assert every one is untouched and (for FOG)
   `grid.fogCloudCount` is unchanged (Scenario 6, FR-009).
5. Place a rainbow and a chest with overlapping rings; seed pourable
   material in the overlap; call `applyRainbowConversions` then
   `applyChestConversions` (the same order `frame()` uses) across many
   synthetic steps; assert every overlap cell settles to `RAINBOW_SAND` and
   never becomes `DIAMOND`, and that re-running the same two calls produces
   no further change (Scenario 7, FR-011 — research.md §4).
6. Seed `DIAMOND` cells on a slope with `step(grid)`; assert they fall,
   pile at the same angle of repose as an equivalent SAND seed, and sink
   through a `WATER` cell exactly like SAND does (Scenario 4, FR-014).
7. A chest at the grid edge (ring clipped to bounds) still converts the
   in-bounds portion of its ring with no out-of-bounds write (Edge Cases).

**On-device / manual** (FR-034): the drawn chest reads as a treasure chest
at footprint size on a real screen (not an abstract box); diamonds read as
sparkling and are visually distinct from pink sand and gumdrops; a chest
under a continuous stream of sand is satisfying to watch as a "diamond
fountain" (SC-001).

## Validate User Story 2 — she builds a little world: a house and some people (P2)

Reference: spec Acceptance Scenarios 1–4 under User Story 2.

**Automated coverage**:
1. Place four houses; assert exactly three remain and the first placed is
   gone, while any existing person/chest lists are untouched (Scenario 2,
   SC-003) — mirrors the existing rainbow/unicorn cap-of-3 test shape.
2. Place a house and a person; erase across both in one interpolated drag
   (`eraseObjectsInBrushLine`); assert both are fully removed with no
   leftover `OBJECT` cell anywhere in their former footprints (Scenario 3,
   SC-004).
3. Place all three new kinds plus existing kinds and some `DIAMOND`
   material; call `clearObjects` and `clearGrid`; assert the canvas is
   empty of every object and every element, including diamonds (Scenario 4,
   FR-025).
4. Place a house at the very edge of the canvas; assert it nudges fully
   on-canvas exactly like a rainbow does today (Scenario 1).

**On-device / manual**: house and person read clearly at footprint size and
never animate; picking either tool and tapping behaves exactly like picking
rainbow/unicorn does today (FR-034).

## Validate User Story 3 — stars twinkle in her empty sky (P3)

Reference: spec Acceptance Scenarios 1–3 under User Story 3.

**Automated coverage** (`tests/unit/lib/stars.test.ts`, headless):
1. Build a grid with a mix of empty cells, painted material, and an
   `OBJECT` footprint; call the eligibility rule `updateStarField` uses;
   assert eligible cells are exactly the empty ones in the upper
   `STAR_SKY_FRACTION` of the grid, and that the count of active slots never
   exceeds `STAR_CAP` (Scenario 1, FR-020, FR-023).
2. Fill every upper-sky cell with `SAND`; call `updateStarField`; assert no
   slot is active over a non-empty cell (Scenario 2).
3. Assert `createStarField`/`updateStarField`/`drawStarField` are never
   referenced by `serializeWorld`, `captureWorldState`, `clearObjects`, or
   `clearGrid` (a static/import-level check plus a behavioral one: mutate a
   `StarField`, run undo/redo/clear-all/save-restore, and assert none of
   those operations observably depend on or reset it) (Scenario 3, FR-021).

**On-device / manual**: the ambient twinkle is pretty, not distracting, at
a real frame rate (FR-034).

## Validate cross-cutting requirements

**Automated coverage**:
- Backward-compatible restore (FR-028): construct a wire payload whose
  `byKind` has no `house`/`person`/`chest` keys (simulating a pre-upgrade
  save) via both `deserializeWorld` and `deserializeHistory`; assert both
  succeed with those kinds' lists empty rather than returning `null`.
  Construct a payload with a present-but-malformed `byKind.house` value;
  assert it still returns `null` (the tolerance is narrow, not a general
  loosening).
- Resize/rotate remap (FR-029): place all three new kinds plus falling
  diamonds; call `resizeGrid`/`remapWorldState` at new dimensions; assert
  every object is remapped or correctly dropped exactly like existing kinds,
  and diamonds remap as ordinary material.
- Undo/redo round-trip (FR-027) and save/restore round-trip (FR-026): a
  world containing all three new kinds and mid-fall diamonds round-trips
  cell-for-cell through `captureWorldState`/`restoreWorldState` and through
  `serializeWorld`/`deserializeWorld`.
- Existing behavior non-regression (FR-030): the full pre-existing test
  suite (rainbow conversion, unicorn touch, palm/flamingo animation,
  poodles, save/undo) still passes unchanged.
- Toolbar budget (FR-031, FR-032): `shippedToolbarControls(false,
  false).length === 26`, `(true, true).length === 28`; every row of the
  amended `VIEWPORT_TABLE` (smallest now 375×667) passes `fits: true` at
  both counts with `controlSize >= 44` and `pitch >= 4`.

## Manual-only checks (no automated coverage — FR-034)

- **Charlie (Fire 7 Silk, desktop Chrome)**: 🏠/🧑 render as glyphs, not
  boxes; the chest's inline-SVG-derived on-canvas shape and toolbar icon
  look like the same object; diamonds are visually distinct from sand and
  gumdrops; ambient stars look charming, not distracting, at the toy's
  frame rate.
- **Max (iPad Safari, standalone home-screen app)**: same checks, on the
  fork's target platform.
- **Either**: the toolbar, now at 26/28 controls, still reads as a friendly
  cluster rather than cramped, at the smallest guaranteed viewport
  (375×667) — the maintainer who narrows the guaranteed table should
  confirm this by eye, not just by the automated `fits: true`.

## Performance check

`applyChestConversions`'s ring scan adds a bounded, small per-frame cost
(research.md §13) — no dedicated new benchmark is required; re-confirm
during the on-device checks above that three chests converting a continuous
stream, alongside existing rainbows/unicorns/poodles, hold ≥30fps/target
60fps (SC-009), matching every prior spec's performance check.

## Governance note (FR-035 — not part of this plan's file edits)

This feature's final PR must include a constitution amendment (Product
Constraints: diamonds join the element list, house/person/chest join the
objects list; the "no custom artwork assets" clause is amended to permit
shapes drawn in code for an object with no Unicode glyph). Per Governance,
merging that amendment is the human gate's call — it is not authored as
part of this plan or its `specs/015-houses-people-treasure/` artifacts.
