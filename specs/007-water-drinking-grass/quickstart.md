# Quickstart: Water-Drinking Grass

How to build and validate this feature end-to-end once implemented. See
[data-model.md](./data-model.md) for entity details and
[contracts/grass-mechanics.md](./contracts/grass-mechanics.md) for the
sim/lib modules' APIs. This extends `specs/006-phone-support/
quickstart.md` — its build steps and single-file/offline validation still
apply unchanged and are not repeated in full here.

## Prerequisites

- Node 22 (matches `.github/workflows/deploy-pages.yml`)
- `npm install` from a checkout that already has features 001–006's
  scaffold (`package.json`, `src/sim/*` including `resize.ts`, `src/lib/*`
  including `layout.ts`'s `computePlayField`, existing tests)
- A real Android Chrome phone or a low-end tablet of the Amazon Fire 7 Kids
  class for the SC-014 performance check — same devices 006 already
  required, now exercised with grass in the worst-case scene

## Build and run the tests

```bash
npm install
npm run build     # emits dist/index.html — must be the ONLY file in dist/
test -f dist/index.html
npm test           # vitest — sim rules, no browser required
```

Both commands must succeed from a clean checkout, and every 001–006 test
must still pass unchanged except the landscape-1 composition assertions
the spec's own Superseded requirements section calls out (FR-033, SC-017).

## Validate User Story 1 — planting grass (P1)

Reference: spec Acceptance Scenarios 1–7 under User Story 1.

**Automated coverage**:
- `tests/unit/lib/Toolbar` is not itself unit-tested (no DOM, constitution
  Principle V) — the toolbar's control count is verified indirectly via
  `tests/unit/lib/layout.test.ts`'s updated `TOOLBAR_CONTROL_COUNT = 15`
  (research.md §7): confirms a 🌱 button fits alongside the other 14
  controls at every representative viewport without breaking FR-024's
  fit requirement.
- `tests/unit/sim/brush.test.ts`: the `grass` tool paints only into
  `EMPTY`/`WATER` footprint cells, never overwrites `SAND`/`DIRT`/
  `RAINBOW_SAND`/`OBJECT` (Scenario 4), and removes water from any cell it
  claims (Scenario 5) — mirroring the existing `sand`/`water`/`dirt` brush
  test shape.
- `tests/unit/sim/grass.test.ts`: a grass cell's position is unchanged
  across any number of `step()` calls with nothing else on the field,
  including a cell created with `EMPTY` beneath it (mid-air — Edge Cases,
  FR-004, Scenario 3).
- `tests/unit/sim/wand.test.ts`: one new case confirms `applyWand` glitters
  a `GRASS` cell without changing its element (Scenario 7's "reads as
  green grass" is a rendering claim covered by the maintainer check below,
  but the glitter mechanic itself is automated).

**On-device / manual** (maintainer): tap the 🌱 button — it sits in the
same round-emoji-button family as sand/water/dirt, no reading needed
(Scenario 1); press-and-drag with mouse and touch paints continuously
along the whole path at all three brush sizes (Scenario 2, 6); grass reads
instantly as green, with visible per-blade shade variation, next to pink
sand/purple dirt/water (Scenario 7, SC-011).

## Validate User Story 2 — watering makes it grow (P2)

Reference: spec Acceptance Scenarios 1–8 under User Story 2.

**Automated coverage** (`tests/unit/sim/grass.test.ts`, all against
`createGrid`/`setCell`/`step` directly, no DOM):
- A water cell orthogonally adjacent to a grass cell that can still grow is
  consumed (`EMPTY`) within one `step()`, and the grass cell's
  `grassCount` rises by exactly one grass cell (Scenario 1, FR-007).
- A grass patch with water resting on top of it (from above) absorbs it
  and grows upward into the vacated space (Scenario 2).
- New grass appears only directly above or diagonally above an existing
  cell, never below and never sideways without a solid cell beneath the
  target (Scenario 3, FR-010) — assert across many steps that 0 new grass
  cells ever appear at `y > parent.y`.
- Running `step()` in a tight loop from a freshly-watered patch, the first
  new grass cell appears within a small number of steps (well under the
  2-second/~120-frame budget at any plausible frame rate — Scenario 4,
  FR-015, SC-003).
- A patch that has stopped growing (no eligible target, or no more
  adjacent water) is byte-identical across further `step()` calls —
  0 changes (Scenario 5, FR-016, SC-010).
- With zero `WATER` cells anywhere on the field, running `step()` 10,000
  times produces 0 new grass cells and 0 changes to existing ones
  (Scenario 6, SC-010).
- A growth target that would land on `SAND`/`DIRT`/`WATER`/`OBJECT` is
  never chosen — `pickGrowthTargetIndex`'s emptiness check rejects it,
  verified by seeding a fully-boxed-in grass cell and asserting no new
  cell appears and the boxing elements are unchanged (Scenario 7, FR-026).
- Grass buried under a pile of sand survives unharmed and produces 0 new
  cells until the covering sand is removed, then resumes exactly as an
  unburied cell would (Scenario 8, Edge Cases).

**On-device / manual**: pour water onto a grass patch and watch new blades
visibly sprout upward/outward within about two seconds, looking like
sprouting rather than a block inflating (Scenario 4, visual checks
section); watch the puddle beside a growing patch visibly shrink rather
than vanish in a blink (Scenario 1, SC-008).

## Validate User Story 3 — gentle and bounded, never a takeover (P3)

Reference: spec Acceptance Scenarios 1–6 under User Story 3.

**Automated coverage** (`tests/unit/sim/grass.test.ts`):
- Flood a small grid with an effectively unlimited water supply against a
  grass patch (refill water each step, or seed a very large pool), run
  `step()` until the grid stops changing between consecutive steps, then
  assert: 0 grass cells have `grassHeight > 12` (Scenario 1, SC-006); the
  final `grassCount / (width * height)` is `<= 0.25` (Scenario 2, SC-006);
  at least some `WATER` cells remain on the field once growth has halted,
  and further `step()` calls neither absorb nor grow anything further
  (Scenario 3, FR-008, SC-007) — for a seeded pool of `>= 200` water cells
  specifically, 100% of the water remaining once grass can no longer grow
  stays in place indefinitely (SC-007).
- A single grass cell beside a very large body of water absorbs at most
  `floor(stepsRun / 10)` water cells (pacing bound, FR-009/SC-008), and
  never more water cells than the number of grass cells its growth
  produced (SC-005, FR-014).
- The same "flood and run to standstill" scenario, re-derived at a phone-
  sized grid via `computePlayField`, produces the identical qualitative
  outcome (height ceiling respected, field-share ceiling respected) —
  confirming the rules are size-independent (Scenario 5, FR-032).

**Performance check** (FR-030, FR-031, SC-014, SC-015 — on-device/
maintainer, not `vitest`): on a mid-range laptop, a tablet, and a low-end
tablet of the Amazon Fire 7 Kids class, fill the (cell-budget-capped) play
area with grass and actively flowing water — the worst case FR-030 names
explicitly — and confirm `>= 30fps` sustained, targeting `60fps` (SC-014);
compare the same field's per-step cost against an equally-full field of
plain sand and confirm the two are within 20% of each other (SC-015),
consistent with `stepGrass`'s `O(1)`-per-cell, allocation-free design
(research.md §5) adding no asymptotic cost to the existing hot loop.

## Validate User Story 4 — grass belongs with everything else (P4)

Reference: spec Acceptance Scenarios 1–11 under User Story 4.

**Automated coverage**:
- `tests/unit/sim/brush.test.ts`: the eraser removes grass from every cell
  in its footprint exactly as it does sand/water/dirt (Scenario 1);
  `clearGrid` empties a grass-populated grid, including resetting
  `grassCount` to `0` (Scenario 2).
- `tests/unit/sim/objects.test.ts` (no change expected, verified
  unaffected): placing a rainbow/unicorn over grass and rainbow-converting
  a grass-adjacent cell behave exactly as they do over any other element,
  since object placement only checks `EMPTY`/`OBJECT`, and rainbow
  conversion only checks `SAND`/`DIRT`/`WATER` — grass is deliberately
  outside that conversion set (Scenario 5; the wand's *glitter* rule, not
  rainbow conversion, is what applies to grass — Scenario 4, covered under
  User Story 1 above).
- `tests/unit/sim/resize.test.ts`: a grid containing grass, re-derived via
  `resizeGrid`, carries every surviving grass cell's element/shade/
  `grassHeight`/`grassCooldown` at the same bottom-centre offset every
  other element uses, and the new grid's `grassCount` matches the number
  of carried grass cells exactly (Scenario 6).
- `tests/unit/sim/scenes.test.ts`: `loadScene` clears every existing grass
  cell (along with every other element/object) before generating the
  chosen scene's contents, with `grassCount` reset accordingly (Scenario
  7); the 🏔️ landscape-1 generator places grass on its hills at every
  supported grid size, deterministically (loading it twice at the same
  size produces byte-identical grass placement — Scenario 9), and its
  hills/lake/rainbow/unicorn are all still present and correctly shaped
  (Scenario 9); running `step()` on a freshly-generated landscape-1 to a
  standstill leaves the hill height profile unchanged and at least half
  the scene's original water-cell count still present (Scenario 10,
  SC-022); the 🏝️ landscape-2 generator places exactly 0 grass cells at
  every supported grid size (Scenario 11, SC-021).
- No test anywhere asserts or exercises a message, confirmation, score, or
  failure state for any grass interaction (Scenario 8, SC-018) — there is
  no such code path to test.

**On-device / manual**: sand/dirt/wand-sprinkled rainbow sand poured onto
grass visibly piles on top rather than sinking through (Scenario 3, visual
checks); the sparkle wand over grass glitters exactly as it does over sand
(Scenario 4); rotating a phone mid-garden carries the grass across and it
keeps growing when watered afterward (Scenario 6); the hills-and-lake
scene reads as the same world it always was, now with green hillsides, and
watching it load is the intended "oh!" moment — shoreline grass visibly
drinks and rises a little, then settles, without draining the lake (visual
checks section).

## Validate existing behavior is unchanged (FR-033, SC-017)

1. Run `npm test` and confirm every test carried over from
   `specs/001-falling-pink-sand` through `specs/006-phone-support` still
   passes, changed only where the Superseded requirements section makes an
   assertion obsolete — expected changes are limited to
   `tests/unit/sim/scenes.test.ts`'s landscape-1 composition assertions
   (now also expecting grass) and `tests/unit/lib/layout.test.ts`'s
   `TOOLBAR_CONTROL_COUNT` constant (14 → 15); every landscape-2 assertion
   and every other existing test file's assertions are unchanged.
2. In the running app on a laptop with a mouse, repeat 001–006's
   quickstart validation steps — piling, water flow, purple dirt, rainbow
   conversion, unicorn celebration, eraser, clear-all, brush sizes, scene
   loading, the sparkle wand, phone-sized layout/touch — and confirm
   identical behavior to before this feature when no grass is on the
   field.

## Manual-only checks (no automated coverage — spec's "Visual checks for
the maintainer" section)

- Grass reads instantly as grass — green, alive, and clearly not "green
  sand."
- Watering a lawn and watching it rise looks like sprouting, not like a
  green block inflating.
- The pool visibly shrinking as the grass drinks is legible to a child
  watching it.
- A fully grown lawn looks like a lawn — varied heights, not a flat
  rectangle of green.
- The grass button looks like it has always belonged with the other
  element buttons.
- Sand piling on top of grass looks like sand on a hillside.
- The sparkle wand over grass looks as magical as it does over sand.
- The 🏔️ hills-and-lake scene still reads as the same world it always
  was, now with green hillsides — the grass looks planted on the hills,
  not scattered over them.
- Loading that scene and watching the shoreline grass drink and rise is
  the "oh!" moment it is meant to be, and it settles rather than eating
  the lake.
- On a Fire 7 tablet specifically: a busy garden with water running
  through it stays smooth in a small hand.

## Performance check (FR-030, FR-031, SC-014, SC-015)

See "Validate User Story 3" above — the single performance check this
feature requires (a full garden with actively flowing water, on the same
three target devices spec 006 already established) is stated there rather
than repeated here.
