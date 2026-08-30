# Quickstart: Undo That Survives Closing The App

How to build and validate this feature end-to-end once implemented. See
[data-model.md](./data-model.md) for entity details and
[contracts/persistent-history-mechanics.md](./contracts/persistent-history-mechanics.md)
for the sim modules' APIs. This extends `specs/010-undo-redo/quickstart.md`
— its build steps and single-file/offline validation still apply
unchanged and are not repeated in full here.

## Prerequisites

- Node 22 (matches `.github/workflows/deploy-pages.yml`)
- `npm install` from a checkout that already has features 001–010's
  scaffold plus PR #33's auto-save (`src/sim/save.ts`, `SAVE_KEY`/
  `scheduleSave`/`tryRestore` in `PlayArea.svelte`) — **spec 010 and PR
  #33 must already be on `main`**
- A real Amazon Fire 7 Kids-class tablet (Silk) and desktop Chrome
  (Charlie's column) for the close-and-reopen and smoothness checks; a
  real iPad standalone home-screen app (Max's column) for the same,
  plus a rotation/fullscreen-toggle check — same devices 006–010 and PR
  #33 already required

## Build and run the tests

```bash
npm install
npm run build     # emits dist/index.html — must be the ONLY file in dist/
test -f dist/index.html
npm test           # vitest — sim rules, no browser required
```

Both commands must succeed from a clean checkout, and every 001–010 test
must still pass **completely unchanged** (FR-023) — this feature adds two
new test files' worth of coverage (`historySave.test.ts` new, `history.
test.ts` additive-only) and touches no other test file.

## Validate User Story 1 — taking back the last thing she did before she closed the app (P1)

Reference: spec Acceptance Scenarios 1–7 under User Story 1.

**Automated coverage** (`tests/unit/sim/historySave.test.ts` unless
noted):
- A session with several recorded actions: capture the live undo stack,
  `serializeHistory` it against the world's own fingerprint, discard
  everything in memory, `deserializeHistory` at the same field size,
  `restoreFromPersisted` into a fresh `HistoryManager`, and assert
  `canUndo()` is `true` and each `undo()` call restores exactly the world
  state its counterpart restored before the round trip — cell for cell in
  every visible property, plus every placed object (Scenario 1–3, FR-001,
  FR-002, SC-001, SC-002).
- Consecutive `undo()` calls after a restore walk the surviving steps
  most-recent-first until they run out, at which point `canUndo()` becomes
  `false` and a further `undo()` call is a no-op — indistinguishable from
  an in-session history emptying (`history.test.ts`, reusing
  `HistoryManager`'s own existing empty-stack coverage against a
  `restoreFromPersisted`-seeded instance) (Scenario 3–4, FR-004).
- A new action recorded after `restoreFromPersisted` pushes onto the
  restored stack under the existing 10-deep cap, silently evicting the
  oldest restored step once the cap is reached, and is itself undoable
  with one `undo()` call (`history.test.ts`) (Scenario 5, FR-005).
- `restoreFromPersisted` always leaves the redo stack empty (`canRedo() ===
  false`) regardless of what is passed in — redo only lights up after an
  `undo()` call in the new session (`history.test.ts`) (Scenario 7,
  FR-007).
- `deserializeHistory` returning a non-`null` result and
  `restoreFromPersisted` consuming it involves no marker, pause, or
  special state anywhere in either function's own code — undoing past the
  "reopen point" is structurally the same call as any other `undo()`
  (Scenario 6, FR-003).

**On-device / manual**: On the Fire 7 tablet and the iPad standalone app,
close the app with a busy picture and several strokes behind it, reopen,
confirm ↩️ is bright and a tap lifts the last stroke without a stall or
flicker, and that an adult watching cannot tell where the previous
session ended (spec's visual checks section).

## Validate User Story 2 — a big picture, a small budget (P2)

Reference: spec Acceptance Scenarios 1–4 under User Story 2.

**Automated coverage** (`tests/unit/sim/historySave.test.ts`):
- A full 10-step undo history whose steps together exceed
  `HISTORY_BYTE_BUDGET`: `serializeHistory`'s output never exceeds the
  budget, the kept steps are always the newest ones (verified by
  comparing each kept step's identity/content back to the tail of the
  original stack), and their relative order is preserved (Scenario 1,
  FR-008, FR-009, SC-004, SC-005).
- A play-field size large enough that not even one step fits:
  `serializeHistory` returns `''`; `writeFlushSave` with that empty
  string removes any existing history key rather than writing an empty
  payload; a subsequent restore is indistinguishable from today's
  behaviour (Scenario 2, FR-010).
- A `KeyValueStore` fake whose `setItem` always throws (modeling quota
  exhaustion / storage disabled / private mode): `writeFlushSave` and
  `writeOrdinarySave` both still leave the world's own `setItem` call
  attempted, 0 history bytes stored, and 0 exceptions escaping either
  function (Scenario 3, FR-012, SC-006).
- A `KeyValueStore` fake pre-seeded with a stale history entry: a
  `writeOrdinarySave` call (modeling an ordinary during-play save)
  removes it; a `writeFlushSave` call whose `historyJson` argument is
  `''` also removes it — in both cases the fake's `removeItem` is
  observed to have been called with the history key (Scenario 4, FR-013a,
  SC-016).
- Serialized JSON length is measured (not estimated) at a representative
  range of field sizes spanning spec 006's supported sizes, across at
  least 20 varied synthetic sessions, and asserted `<=` the budget in
  100% of cases (SC-004).

**On-device / manual**: on a busy field on the Fire 7 tablet, confirm the
close itself is not noticeably slower than an ordinary close, and that
ordinary play beforehand shows no new periodic hiccup (the write-only-at-
flush design means there should be none — this is the device where a
regression here would bite, per the spec's own visual-checks section).

## Validate User Story 3 — reopening in a different shape (P3)

Reference: spec Acceptance Scenarios 1–4 under User Story 3.

**Automated coverage** (`tests/unit/sim/history.test.ts` and
`historySave.test.ts`):
- A session serialized at one field size, deserialized and
  `remapWorldStates`-remapped into a fresh field size: every surviving
  step is exactly what a live `HistoryManager.remap` call would have
  produced for the same inputs (byte-for-byte comparison against the
  pre-refactor behavior), and every dropped step genuinely fails
  `wouldRemapLosslessly` — never a state with silently missing cells or
  objects, never the wrong shape (Scenario 1–2, FR-016, SC-008).
- A reshape so severe that zero persisted steps survive
  `remapWorldStates`: `restoreFromPersisted([])` leaves `canUndo()`
  `false`, matching User Story 2's "budget forced zero steps" outcome
  exactly at the `HistoryManager` level (Scenario 3, FR-016).
- A restore at the *same* field size as the persisted payload's own
  recorded `width`/`height`: `tryRestore`'s branch selection (per
  data-model.md's outcome table) never calls `remapWorldStates` at all —
  covered by asserting the "same dimensions" branch condition directly
  (`persisted.width === saved.width && ... === grid.width`) rather than
  by re-deriving `PlayArea.svelte`'s own control flow in a test (Scenario
  4, FR-016).

**On-device / manual**: on the iPad, close in portrait, reopen in
landscape and again straight into fullscreen; confirm the picture carries
across as it already does, ↩️ is bright if anything survived and dim if
nothing did, and nothing flickers at the restore (spec's visual checks
section, Max's column).

## Storage-key and consistency checks (FR-017, FR-018, FR-019 — automated, cross-cutting)

**Automated coverage** (`tests/unit/sim/historySave.test.ts`):
- `deserializeHistory` rejects, returning `null`: a wrong `version`; a
  step whose decoded array length does not equal `width * height`;
  truncated/corrupt base64; a `worldFingerprint` that does not match the
  fingerprint of a different world string (FR-018, SC-007).
- A history payload whose own `worldFingerprint` matches but whose
  `width`/`height` do not match the paired world save's own recorded
  `width`/`height` (simulating a bug or a hand-edited payload) is treated
  as inconsistent per data-model.md's "Reopen restore" table — `tryRestore`
  falls through to `history.reset()` (FR-017).
- A history payload that parses and passes every check independently of
  whether the *world* payload it should be checked against is itself
  present or valid: when the world restore does not succeed at all, the
  history branch is never reached — the existing `tryRestore` early
  return (unchanged, see contract) already guarantees this by construction
  (FR-019).
- `computeFingerprint` is deterministic (same input always produces the
  same output) and — practically, not cryptographically — collision-free
  across a batch of dozens of distinct synthetic world strings (FR-017).

## Performance check (FR-014, FR-015, SC-009, SC-010 — on-device/maintainer, not `vitest`)

On the Fire 7 tablet, the iPad, and desktop Chrome: play normally with a
full 10-step undo history, a full play field, weather running, and a
lawn burning, and confirm `>= 30fps` sustained, targeting `60fps`,
throughout — including through a close (flush) — with no single frame
taking longer than 2 frames' budget (SC-009). Separately, compare measured
per-frame simulation cost with a full persisted history in storage against
a session with none and confirm the two are within 2% of each other
(SC-010) — a direct consequence of `historySave.ts`'s functions running
only inside `flushSave`/`tryRestore`, never inside `PlayArea.svelte`'s
per-frame `frame()` loop (FR-014), which this feature's contract leaves
completely unchanged.

## Validate existing behavior is unchanged (FR-023, SC-011)

1. Run `npm test` and confirm every test carried over from
   `specs/001-falling-pink-sand` through `specs/010-undo-redo` still
   passes completely unchanged.
2. In the running app, repeat 001–010's and PR #33's quickstart
   validation steps — piling, water flow, purple dirt, rainbow
   conversion, unicorn celebration, eraser, clear-all, brush sizes, scene
   loading, the sparkle wand, phone-sized layout/touch, grass
   planting/growth, drawing and burning star power, fog/cloud/rain,
   undo/redo within a single session, and the world surviving an ordinary
   close-and-reopen — and confirm identical behavior to before this
   feature in a session where the reopen either never happens or nothing
   survived the budget/reshape.
3. Confirm `src/sim/save.ts` has no diff at all from its pre-feature
   state — the single strongest, most literal check of this feature's own
   "world save and restore MUST behave exactly as they do today"
   requirement.
4. Confirm no existing `src/sim/*` file other than the new
   `historySave.ts` and the additively-extended `history.ts` has any diff.

## Manual-only checks (no automated coverage — spec's "Visual checks for the maintainer" section)

- On the Fire 7 Kids tablet (Charlie): close the app with a busy picture
  and several strokes behind it, reopen, confirm ↩️ is bright, a tap lifts
  the last stroke without a stall, and ordinary play afterwards is as
  smooth as before — including no new periodic hiccup during ordinary
  play (flush-only writing should produce none), and the close itself is
  not noticeably slow.
- On the iPad standalone home-screen app (Max): the same close-and-reopen,
  plus reopening after a rotation and after toggling fullscreen, and
  confirm the button state matches what came back with nothing flickering
  at the restore.
- Both platforms: after several days of ordinary use, confirm the world
  save has not started failing — the history must not have crowded it out
  of storage.
- The seam is invisible: an adult watching a child undo past the reopen
  cannot tell where the previous session ended.
- Dimmed ↩️ on reopen (nothing survived) reads as "not now," never as
  broken or missing — the same visual language spec 010 already
  established, now also produced by the zero-steps-survived path.
