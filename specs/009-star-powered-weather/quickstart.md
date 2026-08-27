# Quickstart: Star-Powered Weather

How to build and validate this feature end-to-end once implemented. See
[data-model.md](./data-model.md) for entity details and
[contracts/weather-mechanics.md](./contracts/weather-mechanics.md) for the
sim/lib modules' APIs. This extends `specs/008-star-power-burns-grass/
quickstart.md` — its build steps and single-file/offline validation still
apply unchanged and are not repeated in full here.

## Prerequisites

- Node 22 (matches `.github/workflows/deploy-pages.yml`)
- `npm install` from a checkout that already has features 001–008's
  scaffold (`package.json`, `src/sim/*` including `008`'s star-power rules,
  `src/lib/*`, existing tests) — **spec 008 must already be on `main`**,
  since star power is the only thing that starts the weather
- A real Android Chrome phone or a low-end tablet of the Amazon Fire 7
  Kids class for the SC-020 performance check — same devices 006/007/008
  already required, now exercised with a full sky, rain falling, a lake
  below, grass drinking, and a lawn burning all at once

## Build and run the tests

```bash
npm install
npm run build     # emits dist/index.html — must be the ONLY file in dist/
test -f dist/index.html
npm test           # vitest — sim rules, no browser required
```

Both commands must succeed from a clean checkout, and every 001–008 test
must still pass unchanged except the one narrowed assertion in
`starPower.test.ts` this feature's own Superseded requirements section
calls for (FR-040, SC-023, research.md §18).

## Validate User Story 1 — making sparkle-mist off the lake (P1)

Reference: spec Acceptance Scenarios 1–8 under User Story 1.

**Automated coverage** (`tests/unit/sim/weather.test.ts` unless noted):
- The ⭐ brush turns every water cell inside its footprint into fog, one
  for one, in place, and changes `0` cells of pink sand, purple dirt,
  rainbow sand, glitter, grass, or placed objects inside that same
  footprint (Scenario 1, FR-008, FR-010, SC-002) — via `brush.test.ts`'s
  new `star`-on-`WATER` case and a `weather.test.ts` full-footprint check.
- Drawn (unfuelled) star power quenched by adjacent water charms exactly
  one water cell into fog per quenching star-power cell — never `0`, never
  more than `1` (Scenario 2, FR-007, SC-003); star power that arrived by
  burning grass (fuelled) leaves the water untouched, and a one-cell water
  stripe still stops a burn with `0` far-side cells catching, exactly as
  spec 008's SC-007 requires (FR-007, SC-004) — the one assertion updated
  in `starPower.test.ts` covers both halves of this split.
- Fog rises between 12 and 20 cells per second through clear space
  (Scenario 3, FR-012, SC-005).
- A rising plume's sideways wander stays within 1 cell per upward move,
  with a net horizontal drift of `0` measured over a long run (Scenario 4,
  FR-013, SC-005).
- Fog created below the surface of a body of water reaches the surface in
  100% of cases, with `0` water cells lost or gained (Scenario 5, FR-014,
  SC-006).
- Fog changes, moves, or damages `0` cells of grass, powder, glitter,
  star power, or placed objects, and `0` fog/cloud cells ever exist outside
  the play field (Scenario 7, FR-005, FR-015, SC-007).
- 100% of fog cells that cannot reach the sky condense into exactly 1
  water cell within 5 seconds (300 steps) of getting stuck, and `0` fog
  cells anywhere survive longer than 30 seconds (1800 steps) without
  becoming cloud (Scenario 8, FR-016, SC-008).

**On-device / manual** (maintainer): waving the ⭐ brush across a lake and
watching it steam is satisfying the very first time, with no explanation
(Scenario 1, SC-001, visual checks section); fog reads instantly as pretty
sparkle-mist — pale, pearly, twinkling — and never as smoke or anything
grey/dirty (Scenario 6, visual checks section); a rising plume looks alive,
wobbling and spreading rather than marching in a rigid straight column
(Scenario 4, visual checks section); fog bubbling up through the lake looks
like bubbles, not a glitch (Scenario 5, visual checks section).

## Validate User Story 2 — clouds gathering at the top (P2)

Reference: spec Acceptance Scenarios 1–6 under User Story 2.

**Automated coverage** (`tests/unit/sim/weather.test.ts`):
- Fog rising with nothing above it becomes cloud on reaching the sky
  ceiling and stops rising there (Scenario 1, FR-017, SC-009).
- Fog arriving underneath an existing cloud also becomes cloud, thickening
  the cloud downward — a steaming lake left running visibly builds a
  bigger cloud than a single brief wave (Scenario 2, FR-018, SC-009).
- Cloud cells never move — across any run, `0` cloud cells are ever found
  at a different index than where they formed (Scenario 3, FR-018, SC-010).
- Cloud is never seeded by any scene, and fog blocked only by ordinary
  matter (powder/grass/objects) never becomes cloud — it only ever
  condenses (FR-017, SC-009).
- Pouring sand or water through a cloud makes the grain fall straight
  through, exchanging places with the cloud cell, in exactly 1 step
  (Scenario 5, FR-004, SC-016) — shared coverage with User Story 4's own
  sink-through assertion.
- Nothing about cloud interferes with drawing, erasing, scenes, or any
  other tool (Scenario 6, FR-019, FR-026) — covered by `brush.test.ts`/
  `wand.test.ts`/`scenes.test.ts`'s own additions (User Story 4, below).

**On-device / manual**: the cloud building itself at the top over several
seconds, out of a lake she steamed a moment ago, is worth watching all by
itself (visual checks section); the cloud reads as a soft, fluffy, obviously
different thing from the thin mist below it, at a glance and with no
reading (Scenario 4, FR-003).

## Validate User Story 3 — rain falling back down (P3)

Reference: spec Acceptance Scenarios 1–7 under User Story 3.

**Automated coverage** (`tests/unit/sim/weather.test.ts`):
- Every cloud cell rains within 180–480 simulation steps of forming, and
  no cloud cell survives past 600 steps; the moments at which one cloud's
  cells rain are staggered rather than identical (Scenario 1, FR-020,
  SC-011).
- Advancing an identical field seeded one way by rain and the other by the
  💧 tool produces `0` differing cells after any number of `step()` calls
  (Scenario 2, FR-021, FR-022, SC-012).
- Rain landing in a lake raises the water level back — the total of water
  plus fog plus cloud never increases across a full cycle and returns to
  its starting value apart from cells drunk by grass or converted by a
  rainbow (Scenario 3, FR-023, SC-013).
- Rain landing on grass that can still grow is drunk exactly under spec
  007's unchanged pacing/ceilings — a storm waters the whole garden at
  once with no new rule (Scenario 4, FR-022, spec 007 unchanged).
- Rain reaching burning (fuelled) star power quenches it exactly as
  ordinary water does (Scenario 5, FR-022, spec 008 unchanged).
- Across any run with no drawing, every last cloud cell has rained and
  disappeared within a few seconds — no cloud can hang in the sky forever
  (Scenario 6, FR-020, SC-011, SC-015 overlap).
- A full cycle from wave to rain returns exactly the water that started,
  apart from what grass drank or a rainbow caught — `0` cells created from
  nothing (Scenario 7, FR-023, SC-013).

**On-device / manual**: rain patters — drops let go at different moments —
rather than the cloud falling as a block (Scenario 1, visual checks
section); rain landing on the garden and the grass growing taller reads as
an obvious reward, not a surprise (visual checks section); the full loop,
lake to mist to cloud to rain to lake, is watchable end to end without
getting boring or feeling slow (visual checks section).

## Validate User Story 4 — it always settles, and it belongs with everything else (P4)

Reference: spec Acceptance Scenarios 1–9 under User Story 4.

**Automated coverage**:
- `tests/unit/sim/weather.test.ts`: charming as hard as possible across a
  field mostly full of water fills the sky only up to the FR-011 ceiling
  and no further, with no message/refusal/failure state to detect
  (Scenario 1, FR-011, SC-014); from any amount of fog/cloud, running with
  no further drawing and no star power left brings the field to `0` fog
  and `0` cloud within 45 seconds and then at rest (Scenario 2, FR-024,
  SC-015), exercised from several adversarial starting states (a field
  entirely full of freshly-charmed fog; a sky entirely full of cloud at
  varying ages; a mix of both).
- `tests/unit/sim/brush.test.ts`: dragging the eraser through fog and
  cloud removes them on the spot, leaving the cells empty with `0` water
  cells left behind (Scenario 3, FR-026); every element brush painted
  through fog/cloud places that element in 100% of the covered cells
  (FR-026, SC-017).
- Clear-all (`PlayArea.svelte`'s existing `clearAll`, backed by
  `clearGrid`) removes all fog and cloud immediately with no confirmation
  (Scenario 4, FR-028) — covered via `grid.test.ts`'s `clearGrid` case.
- `tests/unit/sim/scenes.test.ts`: tapping a scene button replaces the
  field with that scene with no error, arriving with clear skies — `0`
  fog/cloud cells in any of the three scenes immediately after loading
  (Scenario 5, FR-035).
- `tests/unit/sim/brush.test.ts`/`weather.test.ts`: painting any element
  brush where fog is drifting places the element there — a wisp of mist
  never blocks drawing (Scenario 6, FR-026).
- `tests/unit/sim/resize.test.ts`: a grid containing fog and cloud,
  re-derived via `resizeGrid`, carries every surviving cell across on the
  same bottom-centre offset as every other element, each cell remaining
  `FOG` (fog or cloud) and continuing to rise/gather/rain normally
  afterward (Scenario 7, FR-034).
- `tests/unit/sim/wand.test.ts`: a wand pass over fog/cloud leaves those
  cells' element, `cloud`, and every timer field completely unchanged, and
  does not sprinkle into them (Scenario 6 overlap, FR-030, SC-018).
- `tests/unit/sim/objects.test.ts`: `applyRainbowConversions` converts fog
  and cloud into rainbow sand exactly as it already converts water, and
  `isUnicornTouched` returns `true` when fog or cloud occupies a unicorn's
  touch zone, firing the existing celebration with no new burst type
  (edge cases section, FR-031).
- No test anywhere asserts or exercises a message, confirmation, score, or
  failure state for any weather interaction (Scenario 9, SC-024) — there
  is no such code path to test.
- `tests/unit/sim/weather.test.ts`: a field with `0` fog and `0` cloud
  produces byte-identical `step()` behavior to spec 008's own toy across
  every existing 001–008 scenario this feature does not touch (FR-040,
  SC-023) — the regression-parity check, run alongside spec 008's own
  carried-forward test suite.

**On-device / manual**: turning the phone with fog/cloud on the field
carries across whatever fits under the existing preservation rule, with
the weather continuing to run and no message appearing (Scenario 7,
FR-034); on a Fire 7 tablet specifically, a full sky with rain coming down
stays smooth in a small hand (Scenario 8, visual checks section).

## Performance check (FR-037, FR-038, SC-020, SC-021 — on-device/maintainer, not `vitest`)

On a mid-range laptop, a tablet, a mid-range phone, and a low-end tablet of
the Amazon Fire 7 Kids class, drive the field to its worst named case at
once — fog and cloud at the FR-011 sky limit, rain actively falling, a full
lake below, grass drinking at spec 007's own ceiling, and a lawn burning
(spec 008) — and confirm `>= 30fps` sustained, targeting `60fps` (SC-020);
compare the same field's per-step cost against an equally-full field of
plain falling sand and confirm the two are within 20% of each other
(SC-021), consistent with `stepFog`/`stepCloud`/`createFog`'s fixed-
neighbor-count, allocation-free design (research.md §5, §6, §9) adding no
asymptotic cost to the existing hot loop, and with the twinkle reusing the
existing `FLASH_CAP = 24` reservoir rather than a second one (SC-022,
research.md §8).

## Validate existing behavior is unchanged (FR-040, SC-023)

1. Run `npm test` and confirm every test carried over from
   `specs/001-falling-pink-sand` through `specs/008-star-power-burns-grass`
   still passes, except the one narrowed `starPower.test.ts` assertion this
   feature's Superseded requirements section explicitly calls for
   (research.md §18) — no other existing test file's assertions change.
2. In the running app on a laptop with a mouse, repeat 001–008's quickstart
   validation steps — piling, water flow, purple dirt, rainbow conversion,
   unicorn celebration, eraser, clear-all, brush sizes, scene loading, the
   sparkle wand, phone-sized layout/touch, grass planting/growth, drawing
   and burning star power, water quenching a burn — and confirm identical
   behavior to before this feature when no fog/cloud is on the field.
3. Confirm the toolbar is pixel-for-pixel what spec 008 left it — no
   control added, removed, or reordered (FR-027, SC-019) —
   `tests/unit/lib/layout.test.ts` needs no change at all.

## Manual-only checks (no automated coverage — spec's "Visual checks for the maintainer" section)

- Waving the star over the lake and watching it steam is satisfying the
  very first time, with no explanation.
- The mist reads as pretty sparkle-mist, never as smoke — a child should
  think "magic steam," never "something is burning."
- A rising plume looks alive: it wobbles, spreads, and thins rather than
  marching up in a straight line.
- Fog bubbling up through the lake looks like bubbles, not like water
  glitching.
- The cloud building itself at the top over several seconds is worth
  watching all by itself.
- Rain patters — drops let go at different moments — rather than the cloud
  falling as a block.
- The full loop, lake to mist to cloud to rain to lake, is watchable end
  to end without getting boring or feeling slow.
- Rain landing on the garden and the grass growing taller reads as an
  obvious reward, not as a surprise.
- Nothing in the whole cycle is scary, sad, or looks like something
  breaking.
- On a Fire 7 tablet specifically: a full sky with rain coming down stays
  smooth in a small hand.
