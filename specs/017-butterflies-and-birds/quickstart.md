# Quickstart: Butterflies Over Her Flowers, Birds On Her Palms

How to build and validate this feature end-to-end once implemented. See
[data-model.md](./data-model.md) for entity details and
[contracts/ambient-life-mechanics.md](./contracts/ambient-life-mechanics.md)
for the two new sim modules' exact APIs and invariants.

## Prerequisites

- Node 22 (matches `.github/workflows/deploy-pages.yml`)
- `npm install` from a checkout that already has features 001–016's
  scaffold, in particular spec 007's flower bloom (`FLOWER` element,
  `stepGrass`'s bloom branch) and palm placement (`objects.ts`,
  `OBJECT_KINDS` including `'palm'`) — **both must already be on `main`**
- A real Amazon Fire 7 Kids-class tablet (Silk) and desktop Chrome
  (Charlie's column) and a real iPad standalone home-screen app (Max's
  column) for the manual glyph/frame-rate checks — same devices every
  prior spec requires

## Build and run the tests

```bash
npm install
npm run build     # emits dist/index.html — must be the ONLY file in dist/
test -f dist/index.html
npm test           # vitest — sim rules, no browser required
```

Both commands must succeed from a clean checkout, and every 001–016 test
must still pass **completely unchanged** (FR-037) — this feature adds
exactly two new test files (`butterflies.test.ts`, `birds.test.ts`) and
touches no other test file.

## Validate User Story 1 — butterflies come to her garden (P1)

Reference: spec Acceptance Scenarios 1–8 under User Story 1.

**Automated coverage** (`tests/unit/sim/butterflies.test.ts`):
- A grid with zero `FLOWER` cells: run `stepButterflies` for well over one
  scan pass' worth of frames; `state.butterflies` stays empty throughout
  (Scenario 1, FR-002).
- Set one `FLOWER` cell; run frames until a scan pass completes; assert a
  butterfly exists, appearing within roughly `FLOWER_SCAN_PASS_FRAMES`
  frames of the flower being set (Scenario 2, FR-004, SC-001).
- Sweep flower counts `0, 1, 4, 5, 8, 9, 12, 13, 16, 17, 40`: after a
  settle period, assert `butterflies.length === Math.min(4,
  Math.ceil(n / 4))` for every `n > 0`, and `0` for `n === 0` (Scenario 3,
  FR-003).
- Track one butterfly's `state` and `targetX`/`targetY` across many
  frames with several flowers present: assert it alternates
  `visiting`→`travelling`→`visiting` repeatedly, dwelling a few seconds'
  worth of frames each `visiting` phase, and that `targetX`/`targetY`
  changes to a different flower's position on at least some transitions
  (Scenario 4, FR-007).
- Across a long `travelling` run, assert the recorded heading is never
  exactly the straight bearing to target for more than one consecutive
  frame (the wobble term is always present) and that motion speed stays
  within the tuned `FLIGHT_SPEED` bound — a float, not a dart or a crawl
  (Scenario 4/FR-008).
- Run with butterflies present over cells set to every liquid/powder/
  weather element in turn (`WATER`, `SAND`, `FOG` with `cloud=1`,
  `STAR_POWER`): assert no butterfly's `y` ever moves toward that
  terrain's surface and no butterfly's velocity is affected by it
  (Scenario 5, FR-006).
- With butterflies present and active, run `step(grid)` (the ordinary sim
  tick) and confirm grass drinking/blooming, water flow, and star power
  are bit-for-bit identical to a control run with no butterflies present
  at all — and separately assert no call in this feature's own two
  modules ever writes any `Grid` array (Scenario 6, FR-017, FR-037).
- Instantiate a `Grid` with `SAND`/`DIRT`/`WATER` cells directly in a
  straight line between a butterfly and its target flower: assert the
  butterfly's path is unaffected (no deflection, no pause) and it still
  arrives (Scenario 8, FR-009).
- Remove the flower a `travelling` butterfly is headed toward mid-flight
  (both immediately, and only after the next scan pass): assert it never
  keeps heading for that now-stale coordinate past the next scan pass or
  its own arrival check, whichever comes first (edge case, FR-010).

**On-device / manual**: On the Fire 7 tablet and the iPad standalone app,
water grass until the first flower blooms and confirm a butterfly turns
up within about a second unprompted; grow a full garden and confirm the
count settles and stays capped at 4; watch one for a full visit-then-
travel cycle and confirm it reads as a friendly, floating butterfly with
no reading required (Scenario 7).

## Validate User Story 2 — a bird lives in her palm tree (P2)

Reference: spec Acceptance Scenarios 1–8 under User Story 2.

**Automated coverage** (`tests/unit/sim/birds.test.ts`):
- An empty `palms` array: run `stepBirds` for many frames; `byPalmId`
  stays empty (Scenario 1, FR-012).
- Place one palm (`ObjectsState.byKind.palm` with one `PlacedObject`):
  within about a second of frames, assert a bird exists keyed to that
  palm's id, positioned at its top-center anchor (Scenario 2, FR-013,
  SC-002).
- Place two and then three palms: assert each gets exactly one bird (no
  palm holds two, no bird is shared), up to `BIRD_CAP` (Scenario 3,
  FR-012).
- Hold a bird `perched` for many frames: assert its `x` (relative to the
  palm anchor) changes at least once during a `hopping` interlude, never
  staying bit-for-bit identical for the whole run (Scenario 4, FR-014).
- With two or three palms present, run until a bird enters `flying`:
  assert `flightProgress` reaches `1` with `state === 'perched'` and
  `palmId` set to a live palm id, across many repeated flights (Scenario
  5, FR-015).
- With exactly one palm present, run until its bird flies: assert every
  sampled `(x, y)` across the whole loop stays within grid bounds and the
  bird ends `perched` back on the same `palmId` it started from (Scenario
  6, FR-015, FR-016).
- With birds present and active, run the existing palm sway/poke logic
  (`PlayArea.svelte`'s `drawObjectGlyph`/`palmShiverAt` path is DOM/
  canvas-only and out of `vitest`'s reach, but `objects.ts`'s own
  `placeObject`/`removeObject`/`eraseObjectsInBrush` behavior) and confirm
  it is bit-for-bit unaffected by a bird's presence, and that `stepBirds`
  never mutates the `palms` array or any `PlacedObject` (Scenario 7,
  FR-017, FR-037).

**On-device / manual**: On both platforms, place a palm and confirm a
bird perches within about a second unprompted; place a second and third
and confirm each gets its own; watch a two-palm flight and a single-palm
flight and confirm both read as short, gentle, and fully in view, never
vanishing off an edge (Scenario 8).

## Validate User Story 3 — they come and go without anything looking broken (P3)

Reference: spec Acceptance Scenarios 1–10 under User Story 3.

**Automated coverage** (`tests/unit/sim/butterflies.test.ts` and
`birds.test.ts`):
- Remove the last `FLOWER` cell from a grid with butterflies present:
  within about a second of frames (one scan pass), `butterflies.length
  === 0` (Scenario 1, FR-023).
- Erase a palm with a bird on it, with another palm present: the bird's
  `palmId` changes to the remaining palm (or it flies there) rather than
  disappearing; with no palm remaining: the bird is removed within about
  a second (Scenario 2, FR-023).
- Call `eraseButterfliesInBrush`/`eraseBirdsInBrush` centered exactly on
  a creature, and again along a line whose two endpoints straddle one
  without landing exactly on it (mirroring `eraseObjectsInBrushLine`'s
  own straddle test): assert the creature is removed either way,
  immediately (Scenario 4, FR-025).
- After an eraser removal, assert no replacement appears for
  `ERASE_HOLDOFF_MS`, and does appear once that window elapses and the
  ordinary population rule would otherwise call for one (Scenario 4,
  FR-026).
- Call `clearButterflies`/`clearBirds` with populations present: both
  are empty immediately afterward, and stepping further frames on an
  otherwise-unchanged grid does not repopulate them (mirroring
  `clearAll`'s contract: the grid itself was also cleared, so there is
  nothing to repopulate from) (Scenario 5, FR-027).
- Simulate a reload: build a fresh `ButterfliesState`/`BirdsState`
  (`createButterfliesState`/`createBirdsState`) against a grid/objects
  already containing flowers/palms (as `tryRestore` would leave them);
  assert populations establish within about a second exactly as a fresh
  mount does (Scenario 6/7, FR-029).
- Simulate undo/redo: mutate `grid`/`palms` directly to a "before" and
  "after" flower/palm layout (standing in for `HistoryManager.undo`/
  `redo`, which never touches either new module) and confirm
  `stepButterflies`/`stepBirds` re-settle to match whichever layout is
  live, with no special call needed (Scenario 8, FR-030).
- Simulate a re-derivation: call `clearButterflies`/`clearBirds`, then
  build a differently-shaped `Grid`/`palms` list (mirroring `resize()`'s
  re-derivation branch) and confirm re-establishment within about a
  second, with no out-of-bounds creature at any frame in between
  (Scenario 9, FR-031).
- Simulate a scene switch: `clearButterflies`/`clearBirds` then step
  against the new scene's flowers/palms; confirm the old scene's
  creatures are gone immediately and the new scene's appear within about
  a second (Scenario 10, FR-032).

**On-device / manual**: On both platforms, burn a garden's flowers with
star power and confirm butterflies leave within about a second with no
visual glitch; erase a palm with a bird on it and confirm the same; press
🗑️ with both populations present and confirm the canvas stays empty;
close and reopen the app with a garden and palms saved and confirm both
populations return within about a second; undo/redo a few flower/palm-
affecting strokes and confirm nothing flickers or freezes; rotate the
tablet / toggle fullscreen with a full garden and three palms on screen
and confirm nothing is stranded, nothing flickers, and the undo history
still survives (per `CLAUDE.md`'s two-platform table and spec.md's own
Manual Verification section).

## Performance check (FR-034, FR-035, SC-006 — on-device/maintainer, not `vitest`)

On the Fire 7 tablet, the iPad, and desktop Chrome: fill a garden past
the butterfly cap (≥16 flowers), place three palms, and — if spec 014 has
shipped — fill its sea-life caps too; confirm `>= 30fps` sustained,
targeting `60fps`, throughout, with no visible hitch from the flower scan
(it is bounded per frame by design, research.md §1) and no visible hitch
from bird flight math (`O(palms) <= 3` per frame).

## Validate existing behavior is unchanged (FR-037, SC-010)

1. Run `npm test` and confirm every test carried over from
   `specs/001-falling-pink-sand` through `specs/016-mermaid-ice-cream`
   still passes completely unchanged.
2. In the running app, repeat 001–016's own quickstart validation steps —
   piling, water flow, purple dirt, rainbow conversion, unicorn
   celebration, eraser, clear-all, brush sizes, scene loading, the
   sparkle wand, phone-sized layout/touch, grass planting/growth/bloom,
   drawing and burning star power, fog/cloud/rain, poodles, palm/
   flamingo/rainbow/unicorn placement and poke reactions, undo/redo,
   saving, and the toolbar layout — and confirm identical behavior to
   before this feature.
3. Confirm `src/sim/save.ts`, `history.ts`, and `resize.ts` have no diff
   at all from their pre-feature state — the single strongest, most
   literal check of FR-028/FR-030/FR-033/FR-037.

## Manual-only checks (no automated coverage — spec.md's own Manual Verification section)

- **iPad (Safari, home-screen app) — Max**: 🦋 and 🐦 render as real emoji
  at the sizes used, the flutter and the perch read clearly at that pixel
  density, and the canvas does not stutter with all caps filled.
- **Fire 7 Kids tablet (Silk) and desktop Chrome — Charlie**: the same two
  glyphs render as emoji and not as empty boxes, confirmed by looking, and
  the frame rate holds on the Fire 7.
- **Both**: rotate the device with a full garden and three palms on
  screen and confirm nothing is stranded, nothing flickers, and the undo
  history survives.
