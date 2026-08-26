# Quickstart: Sparkle Magic Wand

How to build and validate this feature end-to-end once implemented. See
[data-model.md](./data-model.md) for entity details and
[contracts/wand-mechanics.md](./contracts/wand-mechanics.md) for the sim/lib
modules' APIs. This extends
`specs/004-landscape-scenes/quickstart.md` — its build steps,
single-file/offline validation, and resize/rotation checks all still apply
unchanged and are not repeated in full here.

## Prerequisites

- Node 22 (matches `.github/workflows/deploy-pages.yml`)
- `npm install` from a checkout that already has features 001–004's
  scaffold (`package.json`, `src/sim/*` including `scenes.ts`, `src/lib/*`,
  existing tests)

## Build and run the tests

```bash
npm install
npm run build     # emits dist/index.html — must be the ONLY file in dist/
test -f dist/index.html
npm test           # vitest — sim rules, no browser required
```

Both commands must succeed from a clean checkout, and every 001–004 test
must still pass unchanged (FR-026).

## Validate User Story 1 — turn what she already drew into glitter (P1)

Reference: spec Acceptance Scenarios 1–13 under User Story 1.

1. `npm run dev`, draw a pile of pink sand, a puddle of water, and a hill of
   purple dirt, tap ✨, drag across all of them → every covered grain keeps
   its element type and starts sparkling; nothing moves that wasn't already
   moving (Scenario 1).
2. Let the simulation run on a glittered pile → it falls, slides, and piles
   exactly like the same pile un-glittered (Scenario 2).
3. Pour more sand on top of a glittered pile, or tip it by drawing an
   opening beside it → glitter travels with each grain as it moves; the
   cell it left behind is not glittered (Scenario 3).
4. Drag the wand over the same region a second and third time → nothing
   changes further; no new state, no visible difference (Scenario 5).
5. Drag the wand over the region quickly → the glitter follows the whole
   path with no gaps, exactly like the element brushes (Scenario 7).
6. Change brush size, then wand → the covered area matches the selected
   size (Scenario 8).
7. Drag 🧽 over glittered grains → they're removed exactly like plain ones;
   tap 🗑️ → the play area is completely empty (Scenarios 9–10).
8. Glitter a pink-sand grain, then let a 🌈 rainbow catch it → it becomes
   rainbow sand and stays glittered (Scenario 11).
9. Tap a different tool after selecting the wand → exactly one tool shows
   as selected, same as every other tool switch (Scenario 12).
10. Leave a glittered pile running for an extended time → it's still fully
    glittered; nothing fades on its own (Scenario 13).

**Automated coverage**: `tests/unit/sim/wand.test.ts` calls `applyWand`/
`applyWandLine` directly against a `createGrid`-built grid seeded with each
element type via `setCell`, and asserts (using `getGlitter`/`getElement`):
every covered element cell reports glittered afterward with its element
type unchanged (FR-006, SC-002); a second/third identical call produces a
byte-identical grid (FR-010, SC-005); the wand never writes `EMPTY` or a
different element into an occupied cell (FR-011, SC-006); an occupied cell
next to a `RAINBOW_SAND`/rainbow-touch conversion keeps its glitter bit
after `applyRainbowConversions` runs (FR-009). `tests/unit/sim/step.test.ts`
gains a case seeding a glittered grain with `setCell`+`setGlitter`, calling
`step()`, and asserting the glitter bit moved with the grain and the
vacated cell reports `false` (FR-008, SC-004); and a case where two
adjacent grains swap under the simulation's rules, each keeping its own
glitter/plain state (Scenario 4).

## Validate User Story 2 — sprinkle glitter into thin air (P2)

Reference: spec Acceptance Scenarios 1–8 under User Story 2.

1. Drag the wand across an entirely empty region → a scattering of
   multicoloured specks appears — clearly not a solid stripe (Scenarios
   1–2).
2. Let the simulation run → the specks fall, tumble off any slope, and
   settle exactly as rainbow sand does (Scenario 3).
3. Pour pink sand on top of settled glitter → it's buried and behaves
   normally underneath (Scenario 4).
4. Erase glitter grains or tap 🗑️ → they're removed exactly like any other
   grain (Scenario 5).
5. Let glitter grains settle next to a 🦄 unicorn → it celebrates exactly as
   for any other element (Scenario 6).
6. Drag the wand across a region that's partly full and partly empty → the
   occupied cells glitter in place and only the empty cells get new grains,
   with no overlap or conflict between the two rules (Scenario 7).
7. Hold the wand still over one empty spot for several seconds → glitter
   keeps trickling out gradually rather than instantly filling the column
   or the toy stuttering (Scenario 8).

**Automated coverage**: `tests/unit/sim/wand.test.ts` calls `applyWand`
against an entirely-`EMPTY` region and asserts the resulting `RAINBOW_SAND`+
glittered cell count is strictly greater than zero and no more than one
third of the covered empty cells (FR-015, SC-007), that those cells report
more than one distinct hue (FR-016), and that they are indistinguishable
from any other `RAINBOW_SAND` cell in stored shape (FR-017). A mixed-region
test seeds half the covered footprint with an element and leaves half
`EMPTY`, calls `applyWand` once, and asserts every originally-occupied cell
is glittered with its element unchanged while sprinkled grains appear only
among the originally-empty cells (US2 Scenario 7, FR-027).

## Validate User Story 3 — glitter the unicorn and get a party (P3)

Reference: spec Acceptance Scenarios 1–6 under User Story 3.

1. Place a 🦄 unicorn, drag the wand over it → a burst of 🎉 ✨ 💖 fires that
   is clearly bigger than the unicorn's ordinary touch sparkle (Scenario
   1).
2. Hold or slowly drag the wand over the same unicorn for several seconds →
   bursts are spaced out, not continuous (Scenario 2).
3. Place several unicorns and drag the wand across all of them in one
   stroke → each one celebrates (Scenario 3).
4. Trigger enough bursts (wand and/or ordinary touch) to exceed the
   existing particle cap → the oldest glyphs disappear as new ones appear;
   the total count never grows past the cap (Scenario 4).
5. Erase a unicorn that just wand-celebrated, or tap 🗑️ → it disappears and
   its sparkles fade out normally (Scenario 5).
6. Place a 🌈 rainbow and drag the wand over it → nothing happens to it at
   all — no glittered look, no damage, no movement (Scenario 6, FR-013).

**Automated coverage**: this user story's grid-state-observable behavior —
that the wand never touches a rainbow or unicorn's footprint cells — is
covered by `wand.test.ts`'s object-untouched assertions (FR-027: "the wand
leaving placed objects entirely unglittered and unharmed"), built by
placing a rainbow and a unicorn via `objects.ts`'s `placeObject`, running
`applyWand`/`applyWandLine` across their footprints, and asserting every
footprint cell is still `OBJECT` with `getGlitter` reporting `false`
throughout, and that `objectsState.rainbows`/`.unicorns` are unchanged in
length, position, and size. Burst *timing* and *count* (FR-018–FR-021) are
a maintainer-eyeball check per research.md §6/§8 and constitution Principle
V, matching the existing (untested) particle-cap precedent — not part of
the automated suite.

## Validate existing behavior is unchanged (FR-026, SC-014)

1. Run `npm test` and confirm every test carried over from
   `specs/001-falling-pink-sand` through `specs/004-landscape-scenes`
   (only `step.test.ts` intentionally gains new cases) still passes.
2. In the running app, with the wand never selected, repeat 001–004's
   quickstart validation steps — piling, water flow, purple dirt, rainbow
   conversion, unicorn celebration, eraser, clear-all, brush sizes, scene
   loading — and confirm identical behavior to before this feature.

## Manual-only checks (no automated coverage — spec's "Visual checks" section)

- Glittered pink sand still reads as *pink sand* at a glance, shimmering
  rather than washing out its color.
- Flashes look like glitter catching the light — brief, bright, scattered
  across random grains, never a uniform whole-pile pulse.
- The gentle color shimmer is pretty, not strobing; a large glittered area
  is comfortable to look at for a long time.
- The sprinkled dusting looks like glitter shaken from a pot, not a
  coloured stripe under the wand.
- The unicorn's wand burst is unmistakably the biggest, most exciting thing
  in the toy, and doesn't get annoying when repeated.
- The ✨ wand button reads as "make magic" next to the element brushes, and
  the toolbar with it added still looks like a friendly row of big round
  buttons with no page scrolling, on both a laptop and a tablet.
- Dragging the wand over a big pile feels instant and smooth, with no
  stutter as more of the screen becomes glittered.

## Performance check (FR-024, SC-011, SC-012)

On a mid-range laptop and a tablet: glitter the entire play area (repeated
wand drags, or start from a scene and wand the whole thing) and set
elements in motion (pour more sand through it) → confirm the devtools
performance/FPS overlay shows ≥30fps sustained, targeting 60fps, and no
allocation spikes in the per-frame profile (the flash-mask update and
shimmer render are both O(width × height) with no allocation — research.md
§6). This is the worst case FR-024 explicitly names; every lighter case
(a partially glittered area) costs strictly less per frame.
