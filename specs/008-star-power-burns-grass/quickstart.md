# Quickstart: Shining Star Power

How to build and validate this feature end-to-end once implemented. See
[data-model.md](./data-model.md) for entity details and
[contracts/star-power-mechanics.md](./contracts/star-power-mechanics.md)
for the sim/lib modules' APIs. This extends `specs/007-water-drinking-
grass/quickstart.md` — its build steps and single-file/offline validation
still apply unchanged and are not repeated in full here.

## Prerequisites

- Node 22 (matches `.github/workflows/deploy-pages.yml`)
- `npm install` from a checkout that already has features 001–007's
  scaffold (`package.json`, `src/sim/*` including `007`'s grass rules,
  `src/lib/*` including `layout.ts`'s `computePlayField`, existing tests)
  — **spec 007 must already be on `main`**, since grass is star power's
  only fuel
- A real Android Chrome phone or a low-end tablet of the Amazon Fire 7
  Kids class for the SC-014 performance check — same devices 006/007
  already required, now exercised with a full-field burn in progress

## Build and run the tests

```bash
npm install
npm run build     # emits dist/index.html — must be the ONLY file in dist/
test -f dist/index.html
npm test           # vitest — sim rules, no browser required
```

Both commands must succeed from a clean checkout, and every 001–007 test
must still pass unchanged (FR-036, SC-018) — this feature's own Superseded
requirements section makes no existing assertion obsolete, so no existing
test file's assertions need to change beyond the toolbar control count
below.

## Validate User Story 1 — drawing shining star power (P1)

Reference: spec Acceptance Scenarios 1–8 under User Story 1.

**Automated coverage**:
- `tests/unit/lib/layout.test.ts`: `TOOLBAR_CONTROL_COUNT` updated to
  `16` (research.md §13) — confirms a ⭐ button fits alongside the other
  15 controls at every representative viewport without breaking FR-026's
  fit requirement.
- `tests/unit/sim/brush.test.ts`: the `star` tool paints an unfuelled
  star power cell into an `EMPTY` footprint cell and nothing else
  (Scenario 5's "fills only the empty cells"); it never paints into
  `WATER` (Scenario 6, FR-018), `SAND`/`DIRT`/`RAINBOW_SAND`/`OBJECT`
  (Scenario 5, Edge Cases), or an already-`STAR_POWER` cell.
- `tests/unit/sim/starPower.test.ts`: a star power cell's position is
  unchanged across any number of `step()` calls with nothing else on the
  field (Scenario 3, FR-004); on an empty field it burns out within
  `starPowerLife` steps (≤60, "about a second" at 60 steps/second) and
  leaves the cell `EMPTY` with `0` glitter (Scenario 4, FR-002, FR-008);
  drawing across a pile of sand/dirt/glitter deposits star power only
  into the pile's empty gaps, moving/replacing nothing (Scenario 5);
  drawing through water places nothing and leaves the water untouched
  (Scenario 6, FR-018); a placed rainbow/unicorn under the brush is
  unharmed (Scenario 7, covered further under User Story 4 below).

**On-device / manual** (maintainer): tap the ⭐ button — it sits in the
same round-emoji-button family as sand/water/dirt/grass, no reading
needed (Scenario 1); press-and-drag with mouse and touch paints
continuously along the whole path at all three brush sizes (Scenario 2);
star power reads instantly as gold/white/twinkling magic, never as
flame/ember/smoke, and is visually distinct from every other element at a
glance (Scenario 8, SC-001, visual checks section).

## Validate User Story 2 — burning grass into multicoloured glitter (P2)

Reference: spec Acceptance Scenarios 1–10 under User Story 2.

**Automated coverage** (`tests/unit/sim/starPower.test.ts`, all against
`createGrid`/`igniteStarPower`/`step` directly, no DOM):
- A grass cell painted directly with the ⭐ brush is fuelled star power
  immediately (Scenario 1, FR-022).
- A star power cell beside (not on) grass ignites that neighbor within
  `STAR_POWER_IGNITE_DELAY` steps once created — well under 0.5s/30 steps
  (Scenario 2, FR-011, FR-012, SC-004).
- A solid 60-cell run of grass, lit at one end, is fully converted
  (ignited-then-glittered) in between 6 and 20 seconds of simulated
  steps — the burn-front pace bound (Scenario 3, FR-012, SC-004).
- Every consumed grass cell yields exactly one `RAINBOW_SAND` cell with
  `glitter = 1` in the same cell, once its own burn life elapses
  (Scenario 4, FR-008, FR-010, SC-005) — for a patch of `N` grass cells,
  running to a standstill produces exactly `N` new glitter grains.
- Glitter produced by a burn falls/tumbles/piles identically to the
  wand's sprinkled glitter: advancing an identical field seeded one way
  by burning and the other way by the wand produces `0` differing cells
  after any number of `step()` calls (Scenario 5, SC-011).
- A one-cell gap of `EMPTY` (or a `SAND`/`WATER`/`OBJECT` cell) across a
  lawn stops the burn at the gap — `0` cells of the far side ever catch,
  for any of these blocker types (Scenario 6, FR-014, SC-007).
- Running `step()` well past every star power cell's maximum possible
  life leaves `0` star power cells anywhere on the field (Scenario 7,
  FR-015, SC-006).
- A glitter grain produced by burning is never re-ignited by further
  contact with star power (it is not `GRASS`) (Scenario 8, FR-013).
- With grass on the field and `0` star power anywhere, running `step()`
  for 10,000 steps changes `0` grass cells beyond spec 007's own
  watering-and-growth rule (Scenario 9, FR-013, SC-010 — this remains
  spec 007's own SC-010 assertion, re-verified with star power's code
  paths present but unreached).
- A grass cell far from any burn keeps drinking adjacent water and
  growing exactly as spec 007 specifies while a burn proceeds elsewhere
  on the same field (Scenario 10, FR-019, FR-036).

**On-device / manual**: the burn front's advance is a watchable, "ooh"
pace — not an instant flash, not a crawl (visual checks section); a
burning blade bursting into multicoloured glitter reads as *bursting*,
not as a cell swapping color (visual checks section); the resulting
heap reads as treasure, not ash (visual checks section).

## Validate User Story 3 — water puts it out (P3)

Reference: spec Acceptance Scenarios 1–6 under User Story 3.

**Automated coverage** (`tests/unit/sim/starPower.test.ts`):
- A star power cell orthogonally adjacent to `WATER` is extinguished
  within one `step()` call in 100% of cases, regardless of its current
  age (Scenario 1, FR-016, SC-009).
- Pouring water directly onto burning grass (making the burning cell
  itself orthogonally adjacent to water) stops it immediately, leaving a
  glitter grain if fuelled (Scenario 2, FR-016).
- A one-cell-wide stripe of water fully separating two halves of a lawn
  stops a burn lit on one side — `0` cells of the far half ever catch,
  even after running to a standstill (Scenario 3, FR-014, SC-007).
- The water cell(s) that extinguish star power are read but never
  written by the quench event — before/after grids differ only in the
  extinguished star-power cell(s) (Scenario 4, FR-017, SC-009).
- No code path introduces a message, sound, or visual state beyond the
  ordinary element transition (Scenario 5, FR-031, FR-032) — there is no
  such code to test.
- Watering non-burning grass beside a firebreak continues to drink and
  grow exactly per spec 007's `stepGrass` rule, unaffected by star power
  existing elsewhere on the grid (Scenario 6, FR-017a, FR-036).

**On-device / manual**: pouring water in front of an advancing burn front
and watching it stop is legible to a child with no explanation needed
(visual checks section); no steam, hiss, message, or bang accompanies
quenching (Scenario 5).

## Validate User Story 4 — star power belongs with everything else (P4)

Reference: spec Acceptance Scenarios 1–9 under User Story 4.

**Automated coverage**:
- `tests/unit/sim/brush.test.ts`: the eraser removes star power from
  every cell in its footprint, leaving those cells `EMPTY` with `0`
  glitter produced (Scenario 1, FR-024); `clearGrid` empties a field
  containing star power and glitter alike, including resetting
  `starPowerAge`/`starPowerLife`/`starPowerFuelled` to `0` (Scenario 2).
- `tests/unit/sim/scenes.test.ts`: `loadScene` clears every existing
  star power cell (along with every other element/object) before
  generating the chosen scene's contents, with no error and nothing left
  burning (Scenario 3); none of the three scenes (`empty`,
  `landscape1`, `landscape2`) ever contains a `STAR_POWER` cell
  immediately after loading, and landscape-1's grass/waterline growth
  behavior is unchanged from spec 007 (Scenario 4, FR-030).
- `tests/unit/sim/wand.test.ts`: one new case confirms `applyWand` leaves
  a `STAR_POWER` cell's element and `starPowerAge`/`starPowerLife`/
  `starPowerFuelled` completely unchanged, and does not sprinkle into it
  (Scenario 5, FR-027) — plus the pre-existing case confirming the wand's
  behavior on every other element (sand, water, dirt, grass, rainbow
  sand) is unaffected.
- `tests/unit/sim/resize.test.ts`: a grid containing star power,
  re-derived via `resizeGrid`, carries every surviving cell's element/
  shade/`starPowerFuelled` at the same bottom-centre offset every other
  element uses, and each carried cell still burns out (and, if fuelled,
  still leaves a glitter grain) within a further bounded number of
  `step()` calls afterward (Scenario 6, FR-029).
- `tests/unit/sim/objects.test.ts`: `isUnicornTouched` returns `true`
  when a `STAR_POWER` cell occupies a unicorn's touch zone, exactly as
  it does for any other non-`EMPTY`, non-`OBJECT` element, and
  `applyRainbowConversions` never converts a `STAR_POWER` cell (Scenario
  5/objects unaffected, FR-028).
- No test anywhere asserts or exercises a message, confirmation, score,
  or failure state for any star-power interaction (Scenario 8, SC-019) —
  there is no such code path to test.
- Replanting and watering grass after a burn (via the existing grass
  brush and spec 007's growth rule) is exactly spec 007's own already-
  tested behavior — nothing star-power-specific is needed to confirm
  Scenario 9's "nothing is lost forever."

**Performance check** (FR-033, FR-034, SC-014, SC-016 — on-device/
maintainer, not `vitest`): on a mid-range laptop, a tablet, and a
low-end tablet of the Amazon Fire 7 Kids class, grow grass to spec 007's
own field-share ceiling and ignite the entire lawn at once — the worst
case FR-033 names explicitly — and confirm `>= 30fps` sustained,
targeting `60fps` (SC-014), with the resulting glitter fall/pile
smoothly; compare the same field's per-step cost against an equally-full
field of plain falling sand and confirm the two are within 20% of each
other (SC-016), consistent with `stepStarPower`'s fixed-neighbor-count,
allocation-free design (research.md §5) adding no asymptotic cost to the
existing hot loop.

## Validate existing behavior is unchanged (FR-036, SC-018)

1. Run `npm test` and confirm every test carried over from
   `specs/001-falling-pink-sand` through `specs/007-water-drinking-grass`
   still passes unchanged — this feature's Superseded requirements
   section makes no existing assertion obsolete, so the only expected
   test-file change anywhere is `tests/unit/lib/layout.test.ts`'s
   `TOOLBAR_CONTROL_COUNT` (15 → 16).
2. In the running app on a laptop with a mouse, repeat 001–007's
   quickstart validation steps — piling, water flow, purple dirt,
   rainbow conversion, unicorn celebration, eraser, clear-all, brush
   sizes, scene loading, the sparkle wand, phone-sized layout/touch,
   grass planting/growth — and confirm identical behavior to before this
   feature when no star power is on the field.

## Manual-only checks (no automated coverage — spec's "Visual checks for
the maintainer" section)

- Star power reads instantly as *magic*, not as fire — sparkles, never
  "something is burning down."
- Drawing a ⭐ trail across an empty screen is satisfying on its own,
  even with no grass to catch.
- The burn front travelling across a lawn is the watchable "ooh" moment
  it is meant to be.
- Grass turning into glitter looks like a blade *bursting* into
  sparkles, not a green cell swapping to a coloured one.
- The heap of glitter left behind looks like treasure, not ash.
- Pouring water in front of the front and watching it stop is legible to
  a child without any explanation.
- The ⭐ button looks like it has always belonged with the other element
  buttons.
- Nothing about the whole sequence is scary or sad to watch — the
  maintainer's call on whether star power lands, with plain fire as the
  stated fallback if it does not.
- On a Fire 7 tablet specifically: a whole hillside going up in glitter
  stays smooth in a small hand.

## Performance check (FR-033, FR-034, SC-014, SC-016)

See "Validate User Story 4" above — the single performance check this
feature requires (a full lawn igniting at once, on the same three target
devices specs 006/007 already established) is stated there rather than
repeated here.
