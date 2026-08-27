# Phase 1 Data Model: Undo and Redo

Derived from the spec's Key Entities section and research.md's decisions.
This extends `specs/009-star-powered-weather/data-model.md`'s Element /
Grid / Fog cell / Cloud sub-state / Charming / Rise / Wander / Condense /
Become-cloud / Rain / Sky limit model (and, transitively, 001–008's every
prior entity). Everything there is reused **completely unchanged** — this
feature adds no element, no `Grid` field, and no change to any existing
`src/sim/*` rule. This document's new entities — World state, User action,
Undo history, Redo history, Undo control, Redo control — are detailed in
full below.

## Element, Grid, Tool, Scene, PlacedObject, ObjectsState (all unchanged)

No change of any kind. `Grid`'s shape, every element's behavior, `Tool`'s
value set, `SceneId`'s value set, and `PlacedObject`/`ObjectsState`'s shape
are exactly as `009-star-powered-weather/data-model.md` and its own
predecessors left them. This is itself a load-bearing fact for FR-023
("a session in which Undo and Redo are never tapped MUST behave exactly as
the previous release") — nothing about how the simulation evolves a cell,
or how a brush/wand/scene/object writes one, changes.

## World state (new)

Everything visible the play field holds that outlives a frame (spec Key
Entities), captured as a `WorldState` value (`src/sim/history.ts`, new):

| Field | Type | Notes |
|---|---|---|
| `elements` | `Uint8Array` (size `width * height`) | Plain copy of `Grid.elements` at capture time. |
| `colorAux` | `Uint8Array` (size `width * height`) | `Grid.shades[i]` for every element except `RAINBOW_SAND`, for which it is `Grid.hues[i]` instead (research.md §2) — the single per-cell "colour shade" FR-028 names. |
| `cloud` | `Uint8Array` (size `width * height`) | Plain copy of `Grid.cloud` — meaningful only where `elements[i] === FOG`, needed independently of `colorAux` because a fog/cloud cell's shade and its fog-vs-cloud ramp choice are two separate visible values at once (research.md §2). |
| `glitter` | `Uint8Array` (size `width * height`) | Plain copy of `Grid.glitter`. |
| `grassHeight` | `Uint8Array` (size `width * height`) | Plain copy of `Grid.grassHeight`. |
| `rainbows`, `unicorns` | `PlacedObject[]` | Shallow clones (`{ ...obj }` per entry, preserving `id`) of `ObjectsState.rainbows`/`.unicorns` at capture time. |

**Explicitly not part of a `WorldState`** (FR-028): `Grid.moved` (a
per-step scratch array, never meaningful between steps); `grassCooldown`;
`starPowerAge`/`starPowerLife`/`starPowerFuelled`; `fogRiseCooldown`/
`fogStuckSteps`/`fogAge`/`cloudRainDelay`; `grassCount`/`fogCloudCount`
(recomputed from `elements` on restore, never stored — research.md §4);
the selected tool; the brush size; transient particles/sparkle decoration
(`src/lib/particles.ts`, `src/lib/sparkle.ts` — untouched by this feature).

**Size**: `5 * (width * height)` bytes for the five arrays, plus a few
hundred bytes at most for object-list clones (at most 3 rainbows + 3
unicorns, spec 003's unchanged placement cap). At spec 006's `CELL_BUDGET =
43,200` (the largest field spec 006 ever derives), one `WorldState` is
`5 * 43,200 = 216,000` bytes ≈ **0.206 MB** (research.md §2) — within a few
percent of FR-028's own "roughly 0.19 MB per state" estimate.

**Capture** (`captureWorldState(grid: Grid, objects: ObjectsState):
WorldState`, new, `history.ts`): a single `O(width * height)` pass copying
each of the five arrays and cloning the two object lists. Allocates five
fresh typed arrays and two fresh plain arrays every call — acceptable
because this only ever runs at a user-action boundary (FR-029), never per
frame.

**Restore** (`restoreWorldState(grid: Grid, objects: ObjectsState, state:
WorldState): void`, new, `history.ts`): a single `O(width * height)` pass
that, per cell: writes `elements[i]`/`glitter[i]`/`grassHeight[i]` back
from `state`; writes `colorAux[i]` back into `shades[i]` or `hues[i]`
depending on the restored `elements[i]` (the other of the pair set to `0`);
resets `grassCooldown[i]` to `0` unconditionally; if the restored element
is `STAR_POWER`, sets `starPowerAge[i] = 0` and draws a fresh
`starPowerLife[i] = randomBurnLife()`, and always sets
`starPowerFuelled[i] = 0` (research.md §4); if the restored element is
`FOG`, sets `fogRiseCooldown`/`fogStuckSteps`/`fogAge`/`cloudRainDelay` to
the same values `createFog`/`becomeCloud` set for a freshly-created cell of
that sub-state (research.md §4), otherwise all four are `0`; tallies
`GRASS`/`FOG` occurrences to recompute `grassCount`/`fogCloudCount`. After
the per-cell pass, replaces `objects.rainbows`/`.unicorns` with fresh
clones of `state`'s lists (`objects.nextId` is untouched — research.md
§9). Never touches `grid.moved`.

**Validation rules**:
- FR-010/FR-024: a restored world is indistinguishable from the captured
  one in every property `WorldState` holds — restore is a straight
  per-field copy back, with no lossy step in either direction.
- FR-028: a restored world always differs from the original, if at all,
  only in the *internal* timers named above, each reset to its own
  established "freshly created" value — never to an arbitrary or
  out-of-range one, so `stepFog`/`stepStarPower`/`stepGrass`'s own
  invariants (spec 007/008/009, unchanged) hold immediately on the very
  next `step()` call. No cell can come back in an impossible or stuck
  state (FR-024) because every reset value is one an ordinary creation
  code path already produces today.
- FR-014: restore never touches the selected tool, brush size, or any
  toolbar state — `WorldState` simply has no field for any of them.

## User action (new — a same-input-event span, not a stored entity)

One of exactly four things (FR-005), each wrapped by a `beginAction`/
`commitAction` pair (research.md §8) against the single `HistoryManager`
instance `PlayArea.svelte` owns:

| Kind | Begins | Ends |
|---|---|---|
| Painting stroke (any of 💗💧💜🌱⭐🧽✨) | `pointerdown` (before the first `paintAt`) | `pointerup`/`pointercancel` (`handlePointerUp`) |
| Object placement (🌈/🦄) | `pointerdown`, immediately before `placeObject` | Same `pointerdown` call, immediately after `placeObject` |
| Clear-all (🗑️) | Start of `clearAll()` | End of `clearAll()`, after `clearGrid`/`clearObjects` |
| Scene tap (⬜/🏔️/🏝️) | Start of `loadScene()` | End of `loadScene()`, after `loadScene` (sim) |

**Validation rules**:
- FR-006: nothing else ever calls `beginAction`/`commitAction` — the
  simulation's own per-frame `step()`/`applyRainbowConversions`/
  `updateUnicorns` calls (`PlayArea.svelte`'s `frame()` loop) are
  completely unaware `history.ts` exists.
- FR-007/FR-008: `beginAction` always runs *before* the action's first
  possible mutation, so the captured "before" state is the state exactly
  as it stood the instant before the action began, guaranteeing an undo
  removes the action's effect and everything that followed from it. If the
  action changes nothing, `commitAction`'s comparison against the live
  grid/objects finds no difference and records nothing (research.md §3).
- FR-009: if `undo()`/`redo()` is invoked while a painting stroke's
  `pending` span is still open (`drawing === true`), `PlayArea.svelte`
  first calls `handlePointerUp()` (ending and committing that stroke as
  its own action) before proceeding — see "Undo control / Redo control,"
  below.

## Undo history / Redo history (new — the two bounded stacks)

| Field | Type | Notes |
|---|---|---|
| Undo stack | `WorldState[]`, private to `HistoryManager` | At most `HISTORY_DEPTH = 10` entries (FR-019); a successful `commitAction` push evicts the oldest (`shift()`) once length exceeds 10. Most-recently-recorded action last. |
| Redo stack | `WorldState[]`, private to `HistoryManager` | Cleared entirely (`length = 0`) on every successful `commitAction` (FR-017); grows by exactly one push per successful `undo()` call, shrinks by exactly one pop per successful `redo()` call. Never exceeds 10 by construction (research.md §5), matching FR-020. |
| `pending` | `WorldState \| null`, private to `HistoryManager` | The one in-flight "before" capture, set by `beginAction`, consumed (pushed-or-discarded) by `commitAction`. `null` whenever no action is in flight. |

**Validation rules**:
- FR-019/FR-020/SC-006/SC-007: both stacks are plain arrays with the
  eviction/clear rules above — `undoStack.length <= 10` and
  `redoStack.length <= 10` hold at every point after any `HistoryManager`
  method returns; recording an 11th action evicts exactly the oldest
  (index `0`) with no other observable change.
- FR-021: neither stack, nor `pending`, is ever written to or read from
  any persistence mechanism — a fresh `HistoryManager` (page load) starts
  with both stacks empty.
- FR-022/SC-020: `HistoryManager.reset()` clears both stacks and `pending`
  in one call, invoked exactly once by `PlayArea.svelte`'s `resize()`
  re-derivation branch (research.md §6) — never by the non-re-deriving
  early-return branch, so an ordinary viewport change (address-bar
  collapse, desktop resize with unchanged grid dimensions) leaves both
  stacks completely untouched.

## Undo control / Redo control (new — `Toolbar.svelte` buttons, not stored entities)

| Concept | Notes |
|---|---|
| Undo button (↩️) | New `.control` in a new `.group` in `Toolbar.svelte`, positioned immediately after `.group.actions` (🧽/🗑️/✨) and before `.group.scenes` (FR-001). `disabled={!canUndo}`; never receives the `.selected` class (FR-002). `onclick` calls the `onUndo` prop, which `App.svelte` wires to `PlayArea`'s exported `undo()` method. |
| Redo button (↪️) | Same group, immediately after Undo. `disabled={!canRedo}`; never `.selected`. `onclick` calls `onRedo`, wired to `PlayArea`'s exported `redo()`. |
| `canUndo`/`canRedo` | `let canUndo = $state(false); let canRedo = $state(false);` in `App.svelte`, updated by a new `onHistoryChange(canUndo, canRedo)` callback prop `PlayArea` invokes after every `commitAction`/`undo`/`redo`/`reset` that could change either value (research.md §7). Both start `false` on page load (FR-021). |

**Validation rules**:
- FR-003: the native `disabled` attribute means a dimmed button's
  `onclick` never fires and it is never focusable — tapping it produces
  literally zero DOM events, zero calls into `PlayArea`, and zero change to
  the world or toolbar.
- FR-004: `layout.ts`'s `computeToolbarLayout`/`computePlayField` are
  unchanged (generic over control/group *count*); only
  `tests/unit/lib/layout.test.ts`'s `TOOLBAR_CONTROL_COUNT` (`16 → 18`) and
  `TOOLBAR_GROUP_COUNT` (`5 → 6`) constants change, re-verifying the
  existing fit assertions at the new count (research.md §10).
- FR-009: `PlayArea.svelte`'s exported `undo()`/`redo()` methods each
  check `drawing` first and, if `true`, call `handlePointerUp()` (finishing
  and committing the in-progress stroke) before calling into
  `HistoryManager`.

## Superseded / extended contracts

- The successive **caps on the number of on-screen controls** (retired by
  spec 004's FR-007 in favor of a fit constraint, carried forward unchanged
  by every later spec through 009) remain retired: FR-004 (this spec) is
  the binding constraint, extended from 16 to 18 controls / 5 to 6 groups.
- Spec 004's **FR-008**/**SC-017** (exactly one button wears the selected
  look, always the active drawing tool) is unchanged and is explicitly
  preserved by this spec's FR-002: Undo and Redo are action buttons and
  never appear selected, exactly like 🗑️.
- Spec 002's **FR-003**/**SC-005** and spec 003's **SC-005** (element/
  occupied-cell conservation under the simulation with no drawing) are
  unaffected in their own terms — undo/redo are child-initiated, not
  simulation rules — but this spec's own Superseded requirements section
  notes restoring a world state may change any count to a value it
  previously held, which is not a violation of either statement (both are
  about the simulation's own behavior between draws, not about explicit
  restores).
- No entity 001–009 already defined changes meaning, shape, or validation
  rules — `Grid`, `Element`, `Tool`, `SceneId`, `PlacedObject`,
  `ObjectsState`, and every fog/star-power/grass entity from specs
  007–009 are completely unaffected by this feature (see
  `contracts/undo-redo-mechanics.md` for the exact per-file signature
  diff, which is empty for every existing `src/sim/*` file except the
  four Svelte-layer files this feature's UI wiring touches).
