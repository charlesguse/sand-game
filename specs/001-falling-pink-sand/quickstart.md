# Quickstart: Falling Pink Sand

How to build and validate this feature end-to-end once implemented. See
[data-model.md](./data-model.md) for entity details and
[contracts/sim-core.md](./contracts/sim-core.md) for the sim module's API.

## Prerequisites

- Node 22 (matches `.github/workflows/deploy-pages.yml`)
- `npm install` from a clean checkout

## Build and run the tests

```bash
npm install
npm run build     # emits dist/index.html — must be the ONLY file in dist/
test -f dist/index.html
npm test           # vitest — sim rules, no browser required
```

Both commands must succeed from a clean checkout (FR-032).

## Validate the single-file, offline build (FR-029, FR-030, SC-008)

1. `npm run build`.
2. Open `dist/index.html` directly by double-clicking it (or
   `file://` URL) — no local server.
3. Confirm the page loads and is fully playable (see User Story checks
   below) with the browser devtools Network tab showing zero requests.

## Validate User Story 1 — pour and pile (P1)

Reference: spec Acceptance Scenarios 1–8 under User Story 1.

1. Open the built page (or `npm run dev` during development).
2. Press and hold on the play area at one spot → sand pours and accumulates
   below it (Scenario 1).
3. Press and drag quickly across the play area → the deposited trail has no
   gaps, even on a fast drag (Scenario 2, SC-005).
4. Watch a poured pile settle → it slopes rather than forming single-cell
   towers; no tower taller than 2 cells persists once settled (SC-002).
5. Look closely at a pile → individual grains show visibly different pink
   shades (Scenario 7, SC-010: at least 8 distinguishable shades).
6. Release the pointer → no new sand appears, but existing sand keeps
   settling until at rest (Scenario 8).
7. Keep pouring until the play area is full → drawing has no visible effect
   past that point and the toy stays responsive (Edge case: play area full).

**Automated coverage**: `tests/unit/sim/step.test.ts` exercises Scenarios 3–6
directly against `Grid` state (fall, slide with random diagonal, blocked/no
movement, floor/wall stop) with no browser (FR-031, SC-009).

## Validate User Story 2 — erase and clear (P2)

Reference: spec Acceptance Scenarios 1–4 under User Story 2.

1. Draw some sand, select 🧽, drag over part of a pile → the dragged region
   empties while surrounding sand remains and keeps settling (Scenario 1).
2. Drag the eraser over empty space → nothing happens, no error (Scenario 2).
3. Tap 🗑️ → the play area is empty immediately, no confirmation dialog
   (Scenario 3, SC-007: within one frame).
4. After clearing, draw again → the previously selected tool/brush size is
   unchanged and drawing resumes normally (Scenario 4, FR-028).

## Validate User Story 3 — tool and brush selection (P3)

Reference: spec Acceptance Scenarios 1–5 under User Story 3.

1. Load the page → 🩷 sand is visibly selected by default, medium brush is
   the default (Scenario 1, FR-023).
2. Tap each toolbar button → the tapped button becomes visibly selected and
   the previous one returns to unselected (Scenario 2).
3. Draw with small vs. large brush → stroke width visibly differs
   (Scenario 3).
4. Switch tools after picking a brush size → the brush size carries over to
   the newly active tool (Scenario 4, FR-026).
5. Compare the three brush-size buttons → their glyph sizes visually
   communicate small/medium/large without text (Scenario 5, FR-025).

## Validate resize/rotation (FR-033–FR-035, SC-011)

1. Draw some sand.
2. Resize the browser window (or rotate a tablet/emulated viewport).
3. Confirm every grain keeps its exact cell and shade (nothing shifts, added,
   or lost), the play area rescales to fit with letterboxing where the
   viewport's aspect ratio doesn't match the grid's, and the page still does
   not scroll.
4. Draw again after the resize → pointer position still maps to the correct
   cell at the new on-screen scale.

## Manual-only checks (no automated coverage — spec's "Visual checks" section)

- Piles look soft/textured, not a flat pink block.
- Header and toolbar read as cheerful/rainbow-themed at a glance.
- Selected-tool highlight is obvious from across a room.
- Drawing feels immediate — no perceptible lag under the finger.

## Performance check (SC-003)

On a mid-range laptop and a tablet, with the play area at least half full of
sand at the default grid resolution, confirm the devtools performance/FPS
overlay shows ≥30fps sustained, targeting 60fps.
