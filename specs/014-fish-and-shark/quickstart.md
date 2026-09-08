# Quickstart: Fish And A Shark Living In Her Water

How to build and validate this feature end-to-end once implemented. See
[data-model.md](./data-model.md) for entity details and
[contracts/sea-life.md](./contracts/sea-life.md) for the exact module
API. This extends the existing build/test flow from specs 001–013 —
nothing about `npm install`/`npm run build`/`npm test` changes shape.

## Prerequisites

- Node 22 (matches `.github/workflows/deploy-pages.yml`)
- `npm install` from a checkout that already has specs 001–013's scaffold
  (`src/sim/grid.ts`, `src/sim/step.ts`, `src/sim/pets.ts`,
  `src/sim/objects.ts`, `src/lib/PlayArea.svelte`)

## Build and run the tests

```bash
npm install
npm run build     # emits dist/index.html — must be the ONLY file in dist/
test -f dist/index.html
npm test           # vitest — no browser, no DOM required
```

Both commands must succeed from a clean checkout, and every existing test
from specs 001–013 must still pass unchanged (SC-010) — this feature adds
one new test file and touches no existing one.

## Validate User Story 1 — fish come to live in her pond (P1)

Reference: spec Acceptance Scenarios 1–8 under User Story 1.

**Automated coverage** (`tests/unit/sim/seaLife.test.ts`): build a `Grid`
with a WATER region below `FISH_SPAWN_THRESHOLD`, run `stepSeaLife`
enough times to complete several sweeps, assert `state.fish.length ===
0` throughout (Scenario 1). Grow the region past the threshold; assert a
fish appears within roughly `SWEEP_TARGET_FRAMES` frames (Scenario 2) and
that fish count scales with pool size up to `FISH_PER_POOL_CAP`
(Scenario 3, contracts' `FISH_PER_POOL_CAP`). Step a fish for many frames
and assert its `(round(x), round(y))` cell is `WATER` at every single
frame, never sand/dirt/grass/flower/gumdrop/fog/cloud/object/empty/
out-of-bounds (Scenario 5, FR-011) — including a case where a stroke of
sand is drawn straight through the pool mid-run (Edge Cases). Assert a
fish's direction changes at least once over a long run without external
input (Scenario 6) and that every `Grid` array is byte-identical before
and after the run (Scenario 7, FR-012).

**On-device / manual**: none required for this story's logic — Scenario
4's "a pace she can follow with her eyes" and Scenario 8's "reads
instantly as a friendly little fish" are covered under Manual
Verification below, per CLAUDE.md's carve-out for feel/legibility checks.

## Validate User Story 2 — a shark comes to play in the big lake (P2)

Reference: spec Acceptance Scenarios 1–9 under User Story 2.

**Automated coverage**: a pool sized between the fish and shark
thresholds never spawns a shark over a long run (Scenario 1). A pool at
or above `SHARK_SPAWN_THRESHOLD` gets exactly one shark, never two, even
across many completed sweeps (Scenario 2). Run a long simulated chase and
assert: `state.fish.length` never decreases at any frame attributable to
the shark (only the eraser/pool-threshold paths ever remove a fish,
Scenario 4, SC-002); the minimum observed distance between the shark and
any fish across the entire run is `>= SHARK_MIN_SEPARATION` and never 0
(Scenario 5, FR-017); a chase's `chaseTimer` reaches 0 and the shark's
`targetFishId` changes or clears within a bounded number of frames
(Scenario 6, FR-019); a scattered fish's `scatterTimer` returns to 0
within a few seconds and it resumes ordinary drift (Scenario 7); with
`state.fish` emptied mid-run, the shark's movement pattern matches a
plain fish's drift rule (Scenario 8, FR-020).

**On-device / manual**: Scenario 9 ("nothing about it reads as
frightening") is a Manual Verification item — see below.

## Validate User Story 3 — fish come and go without anything looking broken (P3)

Reference: spec Acceptance Scenarios 1–10 under User Story 3.

**Automated coverage**: drive each lifecycle event against a running
`SeaLifeState`/`Grid` pair and assert, after each, that every remaining
fish/shark sits inside water and inside the grid, and that nothing
throws:
- Drain, evaporate, draw over, or erase a pool below
  `FISH_DESPAWN_THRESHOLD` → its fish are gone within about a second
  (Scenario 1, FR-022).
- Shrink a lake below `SHARK_DESPAWN_THRESHOLD` but keep it above
  `FISH_DESPAWN_THRESHOLD` → the shark leaves, fish stay (Scenario 2).
- Split one qualifying pool into two smaller ones (paint a sand line
  through it) → each fragment's population matches its own size under
  the ordinary rule after the next sweep; merge two pools → the combined
  lake's population matches its combined size (Scenario 3).
- Call `eraseSeaLifeInBrush`/`Line` across a fish/shark → it's gone that
  same call, and the containing pool's spawn target does not grow again
  until `ERASER_HOLD_OFF_FRAMES` has elapsed, then repopulates under the
  ordinary rule with no further action (Scenario 5, FR-025, SC-008).
- Call `clearSeaLife` → `fish`/`sharks`/`eraserCooldowns` are all empty,
  and a subsequent sweep over an emptied grid spawns nothing (Scenario 6).
- Call `resetSeaLifeState` against a restored/undo'd/redo'd `WorldState`
  and against a differently-shaped resized `Grid` → populations
  re-settle from the restored/resized water within about a second, with
  nothing out of bounds and nothing outside water at any point in
  between (Scenarios 7, 9, 10, FR-028, FR-029, FR-030).
- A save written before this feature existed (no `poodles`/sea-life
  fields relevant here) still deserializes via `deserializeWorld`
  unchanged, then gains fish once its restored water is measured
  (Scenario 8, FR-027).

## Validate existing behavior is unchanged (FR-012, SC-010)

1. Run `npm test` and confirm every test from specs 001–013 still
   passes unmodified — water flow, evaporation/fog/cloud/rain, grass
   drinking, star power, and poodle behavior are exercised by their own
   existing suites and none of those files change.
2. In `tests/unit/sim/seaLife.test.ts`, run a scenario that exercises
   fog formation, rain, grass drinking, and a poodle walking/shaking
   through a populated pool simultaneously with fish/shark stepping, and
   assert every existing-feature invariant those other suites already
   check still holds (Edge Case: "a poodle walking or shaking through a
   populated pool" disturbs neither).
3. `npm run build` still emits exactly one `dist/index.html`; open it via
   `file://` and confirm the toolbar is pixel-for-pixel unchanged from
   spec 013 (FR-008, SC-004) — no new button, no layout shift.

## What the maintainers eyeball

Per CLAUDE.md's platform split and this spec's own Manual Verification
section — the human gates this spec's automated checks cannot cover:

- **Max — iPad (Safari, home-screen app)**: 🐠 and 🦈 render as real emoji
  at the sizes used (not empty boxes); a chase reads as playful, not
  frightening, at iPad pixel density; the pond doesn't stutter with every
  cap filled (6 fish + 2 sharks); rotate the device with a populated lake
  on screen and confirm nothing is stranded, nothing flickers, and the
  undo history survives.
- **Charlie — Fire 7 Kids tablet (Silk) and desktop Chrome**: 🐠 and 🦈
  render as real emoji, not empty boxes (both predate the Emoji-13.0/
  Segoe-UI-Emoji cutoff, but confirmed by looking, per CLAUDE.md); frame
  rate holds at 30fps+ on the Fire 7 with every cap filled; same rotation
  check as above.
- **Either maintainer**: watch a full chase start-to-finish and confirm
  it reads as "playing," not "hunting" — no fish ever appears to vanish
  at the moment the shark reaches it (SC-009); erase a fish and confirm
  an adult watching over her shoulder can tell the eraser worked (a
  visible pause before that pool's next fish arrives, SC-008).

## Performance check

With every cap filled (6 fish + 2 sharks, one lake at or above
`SHARK_SPAWN_THRESHOLD`), the sim must hold at least 30fps on a Fire 7
Kids tablet and an iPad at the default 270×160 field, and 60fps on a
mid-range laptop (FR-033, SC-005) — the same bar constitution Principle
IV sets for every existing feature, re-confirmed here specifically
because this is the first feature to add a per-frame background sweep
alongside the existing `step()`/`render()` hot path.
