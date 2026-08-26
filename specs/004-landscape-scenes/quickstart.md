# Quickstart: Landscape Scenes

How to build and validate this feature end-to-end once implemented. See
[data-model.md](./data-model.md) for entity details and
[contracts/scene-generation.md](./contracts/scene-generation.md) for the
sim module's API. This extends
`specs/003-rainbow-unicorn-magic/quickstart.md` — its build steps,
single-file/offline validation, and resize/rotation checks all still apply
unchanged and are not repeated in full here.

## Prerequisites

- Node 22 (matches `.github/workflows/deploy-pages.yml`)
- `npm install` from a checkout that already has features 001, 002, and
  003's scaffold (`package.json`, `src/sim/*` including `objects.ts`'s
  rainbow/unicorn support, `src/lib/*`, existing tests)

## Build and run the tests

```bash
npm install
npm run build     # emits dist/index.html — must be the ONLY file in dist/
test -f dist/index.html
npm test           # vitest — sim rules, no browser required
```

Both commands must succeed from a clean checkout, and every 001/002/003
test must still pass unchanged (FR-027, SC-012).

## Validate User Story 1 — load the purple hills and lake world (P1)

Reference: spec Acceptance Scenarios 1–8 under User Story 1.

1. `npm run dev`, tap 🏔️ on an empty play area → rolling purple-dirt hills
   with at least two crests appear across the lower part of the screen, a
   lake of water sits in the valley between them, a rainbow arcs in the
   sky, and a unicorn stands on a hilltop — all instantly, no message
   (Scenarios 1, 3).
2. Pour a large pile of 🩷 pink sand somewhere first, then tap 🏔️ → the
   sand is completely gone, only the scene remains (Scenario 2).
3. Leave the freshly loaded scene alone and watch the simulation run → the
   hills keep their shape and the lake stays full; nothing slumps or drains
   (Scenario 4).
4. Pour 🩷 pink sand onto a hill → it piles and slides exactly as it would
   on hand-drawn dirt (Scenario 5).
5. Drag 🧽 through the lake → the water erases exactly like drawn water
   (Scenario 6).
6. Tap 🗑️ → the play area empties completely, scene contents included
   (Scenario 7).
7. Tap 🏔️ twice in a row → the play area holds exactly the same scene both
   times (Scenario 8, FR-023).

**Automated coverage**: `tests/unit/sim/scenes.test.ts` calls
`generateLandscape1` directly against freshly created grids and asserts,
using `sceneRegions`: `DIRT` cells with at least two local height maxima
appear only within `lowerPortion`, `WATER` cells fill the valley between
them, at least one rainbow's footprint lies within `sky`, and exactly one
unicorn is present with its footprint resting on a crest (FR-017). A
determinism test calls `generateLandscape1` twice on equally-sized fresh
grids and asserts identical `elements`/`shades`/`hues` arrays and
structurally identical object lists (FR-023). An at-rest test runs `step()`
a number of times after generation and asserts the terrain's height
profile and the lake's cell count are unchanged (FR-020, SC-006).

## Validate User Story 2 — switch between worlds and back to blank (P1)

Reference: spec Acceptance Scenarios 1–9 under User Story 2.

1. From any play-area contents, tap 🏝️ → a pink-sand beach sloping toward
   one side appears, a large pool of water sits on that side, two rainbows
   are in the sky, and a unicorn stands on the sand near the water's edge
   (Scenario 1).
2. Tap 🏔️ → the beach is completely gone, replaced by the purple-hills
   scene with no trace of the beach's contents (Scenario 2).
3. Tap ⬜ → the play area becomes completely empty — no elements, no
   rainbows, no unicorns, no particles (Scenario 3, SC-008).
4. Tap ⬜ again on an already-empty play area → nothing changes, nothing is
   refused or reported (Scenario 4).
5. Tap scene buttons rapidly several times in a row → the play area shows
   only the last tap's scene, with no flicker or intermediate state, and
   stays smooth (Scenario 5, FR-010).
6. Start a press-and-drag with an element brush, then lift and tap a scene
   button mid-stroke → the scene replaces everything including the
   in-progress stroke; the next drag paints normally on the new scene
   (Scenario 6).
7. Tap any scene button → the previously selected tool and brush size are
   unchanged afterward (Scenario 7, FR-004, SC-011).
8. Look at the toolbar right after any scene loads → no scene button shows
   a selected/active look; only the active drawing tool does (Scenario 8,
   FR-006, SC-017).
9. Look at the toolbar → ⬜ (third in the scene group) and 🗑️ (in its usual
   place) are both present and visibly in separate groups; tapping either
   leaves the play area equally empty (Scenario 9, FR-008, SC-015).

**Automated coverage**: `tests/unit/sim/scenes.test.ts` asserts
`generateLandscape2`'s contents (dominant `SAND`, a monotonic slope, a
large `WATER` body on one side, exactly two rainbow footprints in `sky`,
one unicorn near the sand/water boundary — FR-018), that `loadScene`
clears every previous element/object/hue before writing new contents
regardless of what was there before (FR-009), and that `loadScene('empty',
...)` leaves zero non-`EMPTY` cells and empty `rainbows`/`unicorns` lists
starting from a grid that had elements, objects, *and* had just run several
`step()` ticks (FR-011).

## Validate User Story 3 — keep playing on top of a world (P2)

Reference: spec Acceptance Scenarios 1–6 under User Story 3.

1. Load either scene, let the simulation run → every element obeys the
   same falling/sliding/flowing/piling rules as hand-drawn elements
   (Scenario 1).
2. Dig a channel through a hill wall with 🧽 → the water behind it flows
   through the gap under normal water rules (Scenario 2).
3. Drag 🧽 over the scene's rainbow or unicorn → the whole object
   disappears exactly as a hand-placed one would (Scenario 3).
4. Pour an element so it touches the scene's unicorn → it celebrates
   exactly as a hand-placed unicorn does (Scenario 4).
5. Pour an element so it touches one of the scene's rainbows → it converts
   to rainbow sand exactly as it would by a hand-placed rainbow (Scenario
   5).
6. With a scene loaded, place more rainbows/unicorns by hand until the
   per-type cap of 3 is reached → the scene's own rainbow/unicorn rolls off
   first if it was the oldest, silently, with nothing refused or reported
   (Scenario 6, FR-014).

**Automated coverage**: this user story's behavior is entirely inherited
from 003's already-tested `step`/`applyRainbowConversions`/
`isUnicornTouched`/`eraseObjectsInBrush`/`placeObject` — because
`scenes.ts` writes plain `DIRT`/`SAND`/`WATER` cells and calls the same
`placeObject` hand-placed objects use (research.md §5), no new interaction
logic exists for `scenes.test.ts` to duplicate-test; its job is only to
confirm scene *generation* itself is correct (Stories 1–2 above), and
003's existing suite continues to prove the interaction rules against
generic grid/object state.

## Validate existing behavior is unchanged (SC-012)

1. Run `npm test` and confirm every test carried over from
   `specs/001-falling-pink-sand`, `specs/002-water-and-purple-dirt`, and
   `specs/003-rainbow-unicorn-magic` (unmodified) still passes.
2. In the running app, with no scene ever loaded, repeat 001/002/003's
   quickstart validation steps — piling, water flow, sinking, purple dirt,
   rainbow conversion, unicorn celebration, eraser, clear-all, brush sizes —
   and confirm identical behavior to before this feature.

## Manual-only checks (no automated coverage — spec's "Visual checks" section)

- Each landscape reads instantly as a *place* — hills with a lake, a beach
  with a pool — not a random scatter of colored cells.
- The purple hills look rolling rather than blocky or stair-stepped, and
  the lake sits convincingly in the valley.
- The beach slopes into the water in a way that reads as a shoreline.
- The rainbows sit in the sky where a rainbow belongs and are not clipped
  by the top or side edges.
- The unicorn looks like it is standing on the ground, not floating above
  it or half-buried in it.
- Loading a scene feels instantaneous and satisfying — no flicker, no
  visible sweep as the world is drawn.
- The scene buttons read as "pick a world," not as three more drawing
  tools, and the toolbar still looks like a friendly row of big round
  buttons.
- The scene group and 🗑️ read as clearly separate things despite ⬜ and 🗑️
  doing the same job.
- Switching back and forth between the two landscapes and the blank canvas
  feels like flipping between pages, with no lag and no surprise.

## Performance check (SC-010, FR-024, FR-025)

On a mid-range laptop and a tablet: tapping any scene button shows the new
world on the very next frame, with no progress indicator or visible
redraw sweep (FR-024). With either landscape loaded and elements in
motion (e.g. pouring sand through a rainbow or into the lake/pool),
confirm the devtools performance/FPS overlay shows ≥30fps sustained,
targeting 60fps (SC-010) — the same budget 003 already validated, since a
loaded scene adds no new per-tick cost (research.md §7).
