# Quickstart: Rainbow and Unicorn Magic

How to build and validate this feature end-to-end once implemented. See
[data-model.md](./data-model.md) for entity details and
[contracts/sim-core.md](./contracts/sim-core.md) for the sim module's API.
This extends `specs/002-water-and-purple-dirt/quickstart.md` — its build
steps, single-file/offline validation, and resize/rotation checks all still
apply unchanged and are not repeated in full here.

## Prerequisites

- Node 22 (matches `.github/workflows/deploy-pages.yml`)
- `npm install` from a checkout that already has features 001 and 002's
  scaffold (`package.json`, `src/sim/*`, `src/lib/*`, existing tests)

## Build and run the tests

```bash
npm install
npm run build     # emits dist/index.html — must be the ONLY file in dist/
test -f dist/index.html
npm test           # vitest — sim rules, no browser required
```

Both commands must succeed from a clean checkout, and every 001/002 test
must still pass unchanged (FR-036, SC-013).

## Validate User Story 1 — stamp a rainbow and make rainbow sand (P1)

Reference: spec Acceptance Scenarios 1–12 under User Story 1.

1. `npm run dev`, select 🌈, tap the play area → a rainbow appears centered
   on the tap and stays put (Scenario 1).
2. Switch to 🩷, pour sand onto the rainbow → grains touching it come out
   rainbow-colored, keep falling and piling like ordinary sand, and shimmer
   through hues while moving (Scenarios 3, 7, 8).
3. Let a rainbow-sand pile settle, then leave it alone → the settled hues
   stop changing; nothing flickers (Scenario 9, SC-021).
4. Pour a steady stream through a rainbow → the resulting heap reads as
   visibly multi-colored stripes/bands, not one flat color (Scenario 10,
   SC-006: at least 6 distinguishable hues).
5. Pour water onto the rainbow → it stops flowing and starts piling as
   rainbow sand (Scenario 4).
6. Draw 💜 magic purple dirt onto the rainbow → it converts too
   (Scenario 5).
7. Touch a rainbow-sand grain to a rainbow again → nothing further happens
   (Scenario 6).
8. Place a second and third rainbow (up to the cap), pour sand through all
   three → each converts independently (Scenario 11).
9. Place a 4th rainbow → the oldest one silently disappears; the tap is
   never refused and no message appears (Scenario 2, FR-005, SC-019).
10. Leave a rainbow alone with nothing nearby → nothing changes on its own
    (Scenario 12, FR-017, SC-003).

**Automated coverage**: `tests/unit/sim/objects.test.ts` (new) exercises
`applyRainbowConversions` directly against `Grid`/`ObjectsState` — a
`SAND`/`DIRT`/`WATER` cell in a rainbow's zone becomes `RAINBOW_SAND` on the
next call, a cell outside every zone is untouched, an already-`RAINBOW_SAND`
cell is left alone, and multiple rainbows convert independently — with no
browser (FR-037). `tests/unit/sim/step.test.ts` is extended so
`RAINBOW_SAND` cells fall/slide/rest/sink exactly like `SAND` (FR-019) and
so a moved `RAINBOW_SAND` cell's `hues[]` value changes while a resting
one's does not (SC-021).

## Validate User Story 2 — place a unicorn and delight it (P2)

Reference: spec Acceptance Scenarios 1–9 under User Story 2.

1. Select 🦄, tap the play area → a unicorn appears and stays put
   (Scenario 1).
2. Pour sand or water so it touches the unicorn → a burst of ✨/💖 appears
   and floats up, fading completely (Scenarios 3, 4).
3. Leave a unicorn untouched and watch → it emits a sparkle every so often
   on its own (Scenario 5, SC-010: at least once every 5 seconds).
4. Pour a heavy continuous stream onto a unicorn → celebration continues
   but the particle count and frame rate both stay bounded (Scenario 6,
   SC-011).
5. Watch particles drift over sand/water/another object → nothing about
   the grid changes because of them (Scenario 7, FR-027).
6. Place several unicorns, touch each → each celebrates independently
   (Scenario 8).
7. Bury a unicorn under a sand pile, then erase the sand → it is still
   there and still reacts (Scenario 9).

**Automated coverage**: `tests/unit/sim/objects.test.ts` covers
`isUnicornTouched` directly against `Grid` state — any element adjacent to
a unicorn's zone reports touched, an untouched unicorn does not, and
multiple unicorns are evaluated independently (FR-023). Particle
spawn/fade/cap timing (FR-024–FR-028) and the idle-sparkle interval
(FR-025, SC-010) are manual/visual checks per the spec's own "Visual checks
for the maintainer" section, not automated — `src/lib/particles.ts` is
plain DOM-free TypeScript and may optionally be unit-tested, but FR-037
does not require it.

## Validate User Story 3 — objects are solid ground (P2)

Reference: spec Acceptance Scenarios 1–7 under User Story 3.

1. Place a rainbow or unicorn in open air (over empty cells), pour sand
   onto it → the grains stop on top and pile up, supported by the object,
   with empty space still visible underneath (Scenario 3, SC-008).
2. Watch a grain land on the object's edge with empty space diagonally
   below → it slides off the shoulder exactly like it would off a sand
   pile (Scenario 2).
3. Erase or let fall away the sand pile under a floating object → the
   object itself stays exactly where it was placed; it never drops
   (Scenario 4, SC-020: 0 cells of drift across a run).
4. Pour water onto an object → it rests on top and spreads off the sides
   rather than passing through (Scenario 5).
5. Pour a large volume of elements over/around several objects → no
   element cell ever appears inside an object's footprint (Scenario 6,
   SC-007: 0 such cells across 10,000+ grains).
6. Place an object where sand/water/dirt already sits → placement succeeds
   immediately, clearing the footprint (Scenario 7, FR-006).

**Automated coverage**: `tests/unit/sim/step.test.ts` (extended) asserts a
falling grain stops directly above an `OBJECT` footprint instead of
entering it, including the fully-blocked-on-all-sides case (rests, does
not disappear or teleport) — the specific case SC-016 calls out by name.
`tests/unit/sim/objects.test.ts` asserts `placeObject` clears any element
occupying the new footprint and that an object's `x`/`y` are unchanged
across any number of subsequent `step()` calls, including after the
elements beneath it are cleared (FR-007, FR-006, SC-020).

## Validate User Story 4 — erase and clear objects (P3)

Reference: spec Acceptance Scenarios 1–5 under User Story 4.

1. Place a rainbow and a unicorn, drag 🧽 across each → both disappear
   entirely, never partially (Scenario 1, SC-014).
2. Erase an object with sand piled on it → the sand that was resting on it
   releases and falls normally on the next tick (Scenario 2).
3. With elements, both object types, and live particles all on screen, tap
   🗑️ → everything is removed immediately, no confirmation (Scenario 3,
   SC-015: within one frame).
4. After clearing everything, select 🌈 or 🦄 and tap again → new objects
   place exactly as before (Scenario 4).
5. With an object tool selected, tap 🗑️ → the selected tool and brush size
   are unchanged afterward (Scenario 5).

**Automated coverage**: `tests/unit/sim/objects.test.ts` covers
`eraseObjectsInBrush` (a brush touching any part of an object's footprint
removes the whole object, none of its cells survive) and `clearObjects`
(resets both lists to empty) with no browser.

## Validate existing sand/water/dirt behavior is unchanged (SC-013)

1. Run `npm test` and confirm every test carried over from
   `specs/001-falling-pink-sand` and `specs/002-water-and-purple-dirt`
   (unmodified, or updated only for the new `Grid.hues` field where a test
   constructs a `Grid` literal directly) still passes.
2. In the running app, with no rainbow or unicorn placed, repeat 001/002's
   quickstart validation steps for their user stories — piling, water flow,
   sinking, purple dirt, eraser, clear-all, brush sizes — and confirm
   identical behavior to before this feature.

## Manual-only checks (no automated coverage — spec's "Visual checks" section)

- The rainbow and the unicorn read instantly as themselves at default play-
  area size, not as illegible specks.
- Sand streaming through a rainbow and coming out rainbow-colored looks
  magical, not glitchy; the shimmer-to-freeze transition looks natural.
- A rainbow-sand heap looks like cheerful rainbow stripes next to the pink
  and purple heaps.
- An object floating over empty space looks like a deliberate magic shelf.
- The unicorn's sparkle-and-heart burst feels celebratory and gentle, never
  obscuring the play area or flashing harshly; the idle twinkle is
  noticeable but not distracting.
- Piles building on top of an object look like they're resting on it.
- The 10-button toolbar still looks like a friendly row of big round
  buttons, not a cramped strip.

## Performance check (SC-012, FR-030)

On a mid-range laptop and a tablet, with 3 rainbows, 3 unicorns, particles
at their cap, and the play area at least half full of a mixture of all
elements including shimmering rainbow sand, confirm the devtools
performance/FPS overlay shows ≥30fps sustained, targeting 60fps.
