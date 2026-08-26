# Quickstart: Water and Magic Purple Dirt

How to build and validate this feature end-to-end once implemented. See
[data-model.md](./data-model.md) for entity details and
[contracts/sim-core.md](./contracts/sim-core.md) for the sim module's API.
This extends `specs/001-falling-pink-sand/quickstart.md` — its build steps,
single-file/offline validation, and resize/rotation checks all still apply
unchanged and are not repeated in full here.

## Prerequisites

- Node 22 (matches `.github/workflows/deploy-pages.yml`)
- `npm install` from a checkout that already has feature 001's scaffold
  (`package.json`, `src/sim/*`, `src/lib/*`)

## Build and run the tests

```bash
npm install
npm run build     # emits dist/index.html — must be the ONLY file in dist/
test -f dist/index.html
npm test           # vitest — sim rules, no browser required
```

Both commands must succeed from a clean checkout, and 001's existing tests
must still pass unchanged (FR-030, SC-007).

## Validate User Story 1 — pour water and watch it flow (P1)

Reference: spec Acceptance Scenarios 1–9 under User Story 1.

1. `npm run dev`, select 💧, press and drag on the play area → water is
   deposited continuously along the drag path (Scenario 1).
2. Pour a blob onto a flat floor → it flattens into a wide sheet rather than
   piling like sand (Scenario 5, SC-002: height varies ≤2 cells between
   middle and edges once a ≥20-cell column settles).
3. Pour into a bowl-shaped hollow in a sand pile → water collects and stays
   in the hollow (Scenario 6, SC-003: 100% of water cells remain inside the
   container after settling).
4. Pour against the left/right wall → water stacks up and stays inside the
   play area, nothing leaks off the edge (Scenario 7).
5. Look closely at a settled body of water → individual cells show visibly
   different blue shades (Scenario 8, SC-010: at least 6 distinguishable
   blue shades).
6. Fill the play area with water and keep pouring → no crash, no visible
   effect past full (Edge case: play area completely full of water).

**Automated coverage**: `tests/unit/sim/step.test.ts` exercises water
falling, diagonal slide, sideways spread/leveling, resting when fully
blocked, and floor/wall containment directly against `Grid` state
(FR-004–FR-008, FR-010), plus the never-rises invariant (SC-015), with no
browser (FR-029).

## Validate User Story 2 — sink pink sand through the water (P2)

Reference: spec Acceptance Scenarios 1–5 under User Story 2.

1. Fill part of the play area with water, switch to 🩷, pour sand over it →
   every grain travels to the bottom of the pool; the water level rises
   above the deposited sand (Scenario 2, SC-004: after settling every grain
   rests below every water cell in that column).
2. Repeat with 💜 magic purple dirt → it sinks through water exactly like
   pink sand (Scenario 4).
3. Watch closely while sand sinks → the water above does not sink into or
   swap down through the sand once the sand has passed it (Scenario 5,
   FR-009).
4. Count elements before and after a sinking run → the number of water
   cells and sand cells is unchanged (Scenario 3, SC-005 conservation).

**Automated coverage**: `tests/unit/sim/step.test.ts` covers the sink-swap
directly (a powder with water below exchanges places in one step),
a full column settling with all sand at the bottom and all water above, and
an element-count-conservation check across many steps (FR-013, FR-014,
FR-003, SC-005), with no browser.

## Validate User Story 3 — build with a second color: magic purple dirt (P3)

Reference: spec Acceptance Scenarios 1–6 under User Story 3.

1. Select 💜 and draw a pile → it falls and slopes exactly like pink sand
   while reading as clearly purple (Scenario 2).
2. Draw the same shape once in 🩷 and once in 💜, let both settle → the two
   piles occupy the identical set of cells (Scenario 3, SC-014).
3. Draw pink and purple side by side, including grains resting directly on
   each other → neither sinks through the other, and every grain keeps its
   own element and shade (Scenario 4, Scenario 6).
4. Look closely at a purple pile → individual grains show visibly different
   purple shades, distinct from the pink range at a glance (Scenario 5,
   SC-010: at least 8 distinguishable purple shades).

**Automated coverage**: `tests/unit/sim/step.test.ts` asserts a purple-dirt
grid and a pink-sand grid, given the same initial layout, settle into
identical occupied-cell sets (FR-011, FR-016, SC-014), and that mixed
pink/purple piles never change either grain's element (FR-003).

## Validate User Story 4 — pick any element, erase anything, clear everything (P3)

Reference: spec Acceptance Scenarios 1–6 under User Story 4.

1. Load the page → 🩷 is selected by default and visibly distinct from the
   other buttons (Scenario 1, FR-020).
2. Tap 💧, then 💜, then 🩷 → the highlight moves each time and the deposited
   element changes accordingly (Scenario 2).
3. Look at the toolbar → 🩷 💧 💜 sit together as an obvious visual group,
   separate from 🧽/🗑️/brush sizes (Scenario 3, FR-018, SC-011: an adult can
   name the group and the selected element in under 2 seconds).
4. Draw a mixed pile of all three elements, drag 🧽 across it → every cell
   under the brush empties regardless of which element it held (Scenario 4,
   SC-008: 0 occupied cells left in the footprint).
5. With all three elements on screen, tap 🗑️ → the play area empties
   instantly with no confirmation (Scenario 5, SC-009: within one frame).
6. Pick a brush size, switch across 🩷/💧/💜/🧽 → the same brush size applies
   to each (Scenario 6).

**Automated coverage**: `tests/unit/sim/brush.test.ts` covers the
painting-priority matrix (powder-over-empty-or-water, water-over-empty-only,
eraser-over-anything) and clear-all zeroing every element, with no browser.

## Validate existing pink-sand behavior is unchanged (SC-007)

1. Run `npm test` and confirm every test carried over from
   `specs/001-falling-pink-sand` (updated only for the `elements`/`shades`
   field rename per data-model.md) still passes.
2. In the running app, with only 🩷 selected and no water or purple dirt
   drawn, repeat 001's quickstart validation steps for User Stories 1–3
   there — piling, sliding, eraser, clear-all, brush sizes — and confirm
   identical behavior to before this feature.

## Manual-only checks (no automated coverage — spec's "Visual checks" section)

- Water looks wet and lively at a glance, not like a blue rectangle.
- Water flowing into an erased hole, or down a slope, looks fun to watch.
- Pink and purple piles read as two clearly different, cheerful colors.
- The three element buttons look like a family; the selected one is obvious
  from across a room.
- Pouring sand into water feels satisfying — visible sinking, not an
  instant snap to the bottom.

## Performance check (SC-006)

On a mid-range laptop and a tablet, with the play area at least half full of
a mixture of all three elements, and separately with the play area entirely
filled with actively flowing water, confirm the devtools performance/FPS
overlay shows ≥30fps sustained, targeting 60fps.
