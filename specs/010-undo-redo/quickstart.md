# Quickstart: Undo and Redo

How to build and validate this feature end-to-end once implemented. See
[data-model.md](./data-model.md) for entity details and
[contracts/undo-redo-mechanics.md](./contracts/undo-redo-mechanics.md) for
the sim/lib modules' APIs. This extends `specs/009-star-powered-weather/
quickstart.md` — its build steps and single-file/offline validation still
apply unchanged and are not repeated in full here.

## Prerequisites

- Node 22 (matches `.github/workflows/deploy-pages.yml`)
- `npm install` from a checkout that already has features 001–009's
  scaffold (`package.json`, `src/sim/*` including `009`'s fog/cloud rules,
  `src/lib/*`, existing tests) — **spec 009 must already be on `main`**
- A real Android Chrome phone or a low-end tablet of the Amazon Fire 7
  Kids class for the SC-012 performance check and the phone-fit visual
  check — same devices 006–009 already required, now exercised with the
  toolbar at 18 controls and history recording running during drawing

## Build and run the tests

```bash
npm install
npm run build     # emits dist/index.html — must be the ONLY file in dist/
test -f dist/index.html
npm test           # vitest — sim rules, no browser required
```

Both commands must succeed from a clean checkout, and every 001–009 test
must still pass **completely unchanged** (FR-023, FR-031) — this feature
adds one new test file and touches only `tests/unit/lib/layout.test.ts`'s
two count constants.

## Validate User Story 1 — taking back the last thing she drew (P1)

Reference: spec Acceptance Scenarios 1–8 under User Story 1.

**Automated coverage** (`tests/unit/sim/history.test.ts` unless noted):
- One stroke with each of the 7 painting tools (💗💧💜🌱⭐🧽✨), captured,
  drawn, and undone, returns the field to a cell-for-cell identical world
  in every visible property (Scenario 1, FR-005, FR-010, SC-002).
- An eraser stroke that removed elements, then undone, restores every
  removed cell exactly (Scenario 2, FR-010, FR-012).
- A ⭐ stroke that ignited grass, left to spread across several `step()`
  calls, then undone, restores the field to before the stroke — burn
  spread included, since the whole field goes back (Scenario 3, FR-008,
  FR-010).
- A stroke followed by many `step()` calls (sand settling, water leveling)
  before undoing still restores the pre-stroke state exactly — capture
  happens before the action, not after the settling (Scenario 4, FR-008).
- Several strokes in a row, undone one at a time, each undo steps back
  exactly one stroke, most recent first (Scenario 5, FR-013).
- After undo, the simulation's next `step()` call runs normally with no
  special pause/freeze state anywhere in `history.ts`'s own code (Scenario
  6, FR-011) — `PlayArea.svelte`'s `frame()` loop is untouched
  (contracts/undo-redo-mechanics.md), so this is also structurally true.
- A single-tap "dot" stroke (`pointerdown` immediately followed by
  `pointerup` with no `pointermove`) is one action, undone by one `undo()`
  call (edge case, FR-005).
- On an empty undo stack, `HistoryManager.undo()` returns `false` and
  changes nothing (Scenario 8, FR-003, FR-013).

**On-device / manual**: ↩️ never becomes the "selected" button and the
active drawing tool's selection never changes across an undo tap (Scenario
7, FR-002, FR-014) — reads instantly as "take it back," not as a tool
switch; an undo *looks* like the mistake being lifted away, not like the
picture flickering or jumping (spec's visual checks section).

## Validate User Story 2 — rescuing everything after the bin (P2)

Reference: spec Acceptance Scenarios 1–4 under User Story 2.

**Automated coverage** (`tests/unit/sim/history.test.ts`):
- A field containing every element type plus at least one 🌈 and one 🦄,
  cleared via `clearAll()`-equivalent (`beginAction`/`clearGrid`/
  `clearObjects`/`commitAction`), then undone, restores 100% of those
  cells and 100% of those objects (Scenario 1, FR-012, SC-003).
- The same, for each of the 3 scene controls in place of clear (Scenario 2,
  FR-012, SC-003).
- After a rescue undo, the field continues to behave normally under
  further painting/erasing/object placement — the restored `Grid`/
  `ObjectsState` are ordinary, valid instances with no special "restored"
  marker anywhere (Scenario 3, FR-024).
- A 🗑️ tap on an already-empty field (a no-op action) records nothing;
  the next `undo()` call takes back the last action that actually changed
  the world, not the no-op tap (Scenario 4, FR-007, SC-008).

**On-device / manual**: undoing the bin feels like a rescue — the picture
reappearing is a happy moment, not a jarring one (spec's visual checks
section).

## Validate User Story 3 — bringing it back (P3)

Reference: spec Acceptance Scenarios 1–5 under User Story 3.

**Automated coverage** (`tests/unit/sim/history.test.ts`):
- An action → undo → redo round trip returns the field to exactly the
  pre-undo state, cell for cell and object for object (Scenario 1, FR-016,
  SC-009).
- Several undos followed by the same number of redos returns to the
  starting state, one step per tap, in both directions (Scenario 2,
  FR-016, SC-009) — run for at least 20 consecutive alternations (SC-009).
- An undo followed by any new recorded action (a stroke, an object
  placement, a clear, a scene tap) discards the entire redo history; a
  subsequent `redo()` call returns `false` and changes nothing (Scenario 3,
  FR-017, SC-010).
- An undo followed by many `step()` calls (sand settling further) before
  redoing still restores exactly the state the undo captured — unaffected
  by how much simulation time passed (Scenario 4, FR-018).
- On an empty redo stack (fresh page load), `HistoryManager.redo()` returns
  `false` and changes nothing (Scenario 5, FR-003).

## Validate User Story 4 — the buttons always behave, everywhere (P4)

Reference: spec Acceptance Scenarios 1–7 under User Story 4.

**Automated coverage**:
- `tests/unit/lib/layout.test.ts`: with `TOOLBAR_CONTROL_COUNT = 18` and
  `TOOLBAR_GROUP_COUNT = 6`, every existing viewport-table assertion (fit,
  no page scroll, minimum touch target, play-area fill floors) still
  passes at every phone portrait/landscape case in the representative
  table (Scenario 2, FR-004, SC-015).
- `tests/unit/sim/history.test.ts`: hammering `undo()`/`redo()` from
  adversarial states (empty histories, full 10-deep histories, alternating
  calls with no draws between) never throws, never leaves `grid`/`objects`
  partially restored, and never lets either stack exceed 10 entries
  (Scenario 4, Scenario 5, FR-003, FR-019, FR-020, SC-006, SC-007, SC-011).
- `tests/unit/sim/history.test.ts`: recording an 11th action drops exactly
  the oldest remembered one, with the newer 10 (including the 11th) intact
  and undoable (Scenario 5, FR-019, SC-007).
- `tests/unit/sim/history.test.ts`: a per-state byte-size check at spec
  006's `CELL_BUDGET` (`5 * 43,200 = 216,000` bytes) and a full-history
  total (`20 * 216,000 ≈ 4.12 MB`) both assert against the FR-028/SC-014
  budget (research.md §2).
- `tests/unit/sim/history.test.ts`: advancing the simulation for at least
  600 `step()` calls from a restored state yields a world with 0 cells in
  an impossible state, 0 cells stuck, 0 fires that fail to burn out, and 0
  clouds that fail to rain — reusing spec 007–009's own settling/validity
  assertions against a restored `Grid` (Scenario 6 overlap, FR-011, SC-004).
- `tests/unit/sim/history.test.ts`: `HistoryManager.reset()` clears both
  stacks and any pending capture in one call (FR-022, SC-020).

**On-device / manual**:
- ↩️/↪️ sit together as their own little group, in the same big round
  emoji-button family, immediately after 🧽/🗑️/✨ and before the scene
  controls, needing no reading to understand (Scenario 1, FR-001).
- On a phone in either orientation, every control including the two new
  ones is fully visible at once, no scrolling, no control on top of the
  play area (Scenario 2, FR-004 — the mechanically-tested count/fit gate
  above is the automated half of this; the visual "does it actually look
  right" half is this check).
- Dimmed ↩️/↪️ read as "not now," not as broken or missing, and stay full
  size, shape, and position in their usual place (Scenario 3, FR-003).
- On a busy field with weather, burning grass, and a lot of falling sand
  on a low-end tablet, drawing stroke after stroke stays as smooth as it is
  today — recording history is never something a child can feel (Scenario
  6, FR-027, SC-012).
- On page reload, the field is empty and both buttons are dimmed — nothing
  is remembered from last time (Scenario 7, FR-021).
- Restarting a burn or a cloud's countdown on restore is invisible in play
  — nothing flares, stalls, or restarts in a way an adult watching closely
  would notice (spec's visual checks section, FR-028).
- The toolbar with 18 buttons still looks like a friendly set of big round
  buttons rather than a cramped strip, on a laptop, a tablet, and a phone
  in both orientations (spec's visual checks section).

## Performance check (FR-027, SC-012, SC-013 — on-device/maintainer, not `vitest`)

On a mid-range laptop, a tablet, a mid-range phone, and a low-end tablet of
the Amazon Fire 7 Kids class, draw 10 strokes in a row on a full field with
weather running and grass burning and confirm `>= 30fps` sustained,
targeting `60fps`, with no single frame during a capture/undo/redo taking
longer than 2 frames' budget (SC-012); compare measured per-frame
simulation cost with a full 10+10 history against an empty-history baseline
and confirm the two are within 2% of each other (SC-013) — a direct
consequence of `history.ts`'s capture/restore/compare logic running only at
action boundaries (FR-029), never inside `PlayArea.svelte`'s per-frame
`frame()` loop, which this feature's contract leaves completely unchanged.

## Validate existing behavior is unchanged (FR-023, FR-031, SC-017)

1. Run `npm test` and confirm every test carried over from
   `specs/001-falling-pink-sand` through `specs/009-star-powered-weather`
   still passes completely unchanged, except
   `tests/unit/lib/layout.test.ts`'s two count constants
   (`TOOLBAR_CONTROL_COUNT`, `TOOLBAR_GROUP_COUNT`).
2. In the running app on a laptop with a mouse, repeat 001–009's quickstart
   validation steps — piling, water flow, purple dirt, rainbow conversion,
   unicorn celebration, eraser, clear-all, brush sizes, scene loading, the
   sparkle wand, phone-sized layout/touch, grass planting/growth, drawing
   and burning star power, water quenching a burn, fog/cloud/rain — and
   confirm identical behavior to before this feature in a session where
   ↩️/↪️ are never tapped.
3. Confirm no existing `src/sim/*` file other than the new `history.ts` has
   any diff — `grid.ts`, `step.ts`, `types.ts`, `element.ts`, `shade.ts`,
   `brush.ts`, `wand.ts`, `objects.ts`, `scenes.ts`, `resize.ts` are all
   byte-identical to spec 009's own state.

## Manual-only checks (no automated coverage — spec's "Visual checks for the maintainer" section)

- The ↩️ and ↪️ buttons read instantly as "take it back" and "put it back"
  to an adult, and are discoverable by a child who cannot read.
- The dimmed state reads as "not now" rather than as broken or missing.
- An undo looks like the mistake being lifted away, not like the picture
  flickering or jumping.
- Undoing the bin feels like a rescue — the picture reappearing is a happy
  moment, not a jarring one.
- The toolbar with 18 buttons still looks like a friendly set of big round
  buttons rather than a cramped strip, on a laptop, a tablet, and a phone
  in both orientations.
- Nothing about the pair invites the accidental taps that 🗑️ already risks
  — sitting right after 🧽/🗑️/✨ reads as "the fixing buttons live
  together."
- Restarting a burn or a cloud's countdown on restore is invisible in play.
- On a Fire 7 tablet specifically: rapid drawing with a full history stays
  smooth in a small hand.
