# Phase 0 Research: Undo and Redo

This feature's spec carries no `[NEEDS CLARIFICATION]` marker — the three
that ever existed (toolbar placement, rotation/history interaction, and the
visible-vs-simulation-fidelity memory trade) were already resolved on issue
#28 before this planning stage began, and `spec.md`'s own Clarifications
section records the resolutions. This document resolves the remaining
*implementation-technology* unknowns needed to fill Technical Context and
unblock Phase 1 design — exactly what a "world state" snapshot must hold to
satisfy FR-028's visible-fidelity budget, where the capture/restore/compare
machinery lives, how it plugs into the existing pointer-driven stroke
lifecycle without a second architecture, how the 10-deep bound and redo
invalidation are enforced, and how the two new toolbar buttons fit spec
006's phone-fit gate.

This feature is a direct extension of `001-falling-pink-sand` through
`009-star-powered-weather`, whose `src/sim/*`/`src/lib/*` (read from the
checked-out code) already establish everything this feature builds on:
`Grid` holds `elements`/`shades`/`moved`/`hues`/`glitter` plus `007`'s
`grassHeight`/`grassCooldown`/`grassCount`, `008`'s `starPowerAge`/
`starPowerLife`/`starPowerFuelled`, and `009`'s `cloud`/`fogRiseCooldown`/
`fogStuckSteps`/`fogAge`/`cloudRainDelay`/`fogCloudCount`, all parallel
`Uint8Array`/`Uint16Array`s sized `width * height`; `setCell`/`clearGrid`
(`grid.ts`) are the chokepoints every write funnels through and already
reset per-cell bookkeeping on every call; `ObjectsState` holds `rainbows`/
`unicorns: PlacedObject[]` plus a monotonic `nextId`; `PlayArea.svelte` runs
one `requestAnimationFrame` loop and handles `pointerdown`/`pointermove`/
`pointerup`/`pointercancel` directly on the canvas, tracking a `drawing`
boolean and `lastGridPos`; `clearAll()`/`loadScene()` are already exported
imperative methods App.svelte calls via `bind:this`; `resize()`'s
re-derivation branch already swaps to a freshly `createGrid`'d instance and
cleanly ends any in-progress stroke (spec 006 FR-028); `Toolbar.svelte` is a
flat list of `.group`s of `.control` buttons, `App.svelte` owns `tool`/
`brushSize` as Svelte 5 `$state` passed down as props with callback props
flowing actions back up; `layout.ts`'s `computeToolbarLayout`/
`computePlayField` are generic over a control/group *count*, not particular
controls, and `tests/unit/lib/layout.test.ts` mirrors the real toolbar's
control/group count in two constants for its no-DOM fit assertions
(constitution Principle V).

## 1. A new, isolated `src/sim/history.ts` module owns capture, restore, comparison, and the two bounded stacks

- **Decision**: Add one new file, `src/sim/history.ts`, exporting a
  `WorldState` snapshot type, `captureWorldState`/`restoreWorldState`/pure
  comparison helpers, and a small `HistoryManager` class that owns the
  undo/redo stacks and the begin/commit/undo/redo/reset operations. No
  existing `src/sim/*` file (`grid.ts`, `step.ts`, `types.ts`, `element.ts`,
  `shade.ts`, `brush.ts`, `wand.ts`, `objects.ts`, `scenes.ts`,
  `resize.ts`) needs any change — `history.ts` reads/writes `Grid`'s and
  `ObjectsState`'s existing fields directly, exactly the way `resize.ts`
  and `objects.ts` already read/write `Grid` arrays without needing new
  `grid.ts` exports.
- **Rationale**: This is the same "framework-free `src/sim/*` core, isolated
  from Svelte" posture (constitution Principle III) every prior feature's
  simulation logic already follows, giving `history.ts` the same zero-DOM
  `vitest` testability as `step.ts`/`grid.ts` (constitution Principle V,
  FR-033). Keeping it a *new, separate* file rather than folding capture/
  restore into `grid.ts` mirrors `009`'s own precedent of giving a
  large, self-contained rule set (`weather.test.ts`, though its
  implementation lives in `step.ts`) a dedicated home when the concern is
  large enough to warrant one — here the concern (snapshot shape, the
  bounded-stack policy, no-op detection) is genuinely a different axis from
  "how one simulation step evolves a cell," not an extension of any
  existing per-element rule, so a new file is the more honest boundary than
  bolting it onto `grid.ts`. Needing **zero** change to every existing
  `src/sim/*` file is also the mechanical proof of FR-023's "a session in
  which Undo and Redo are never tapped MUST behave exactly as the previous
  release" and FR-031's non-regression requirement: the entire existing hot
  loop and every existing rule file is byte-for-byte untouched by this
  feature, so nothing about them can have changed.
- **Alternatives considered**: Adding capture/restore functions directly to
  `grid.ts` — rejected: `grid.ts` is the per-cell-write chokepoint file
  (`setCell`/`clearGrid`/`createFog`/`igniteStarPower`), a different
  concern from "snapshot a whole grid and diff two snapshots," and every
  prior feature's own file boundaries follow "one file, one coherent
  concern" (e.g. `wand.ts` didn't get folded into `brush.ts` despite both
  being footprint-based per-cell appliers). Owning the stacks/bounds inside
  `PlayArea.svelte` directly (no `HistoryManager` class, just two arrays as
  component state) — rejected: it would mix Svelte reactivity concerns
  with pure bookkeeping logic that has nothing to do with the DOM, making
  the bound/no-op/redo-invalidation rules untestable without a browser
  harness, which FR-033 explicitly requires to be avoidable (constitution
  Principle V).

## 2. `WorldState` captures exactly FR-028's five named visible properties, one array each, sized to hit its own ~0.19 MB/state estimate

- **Decision**: A captured `WorldState` holds five parallel `Uint8Array`s,
  each sized `width * height`, plus two small object-list copies:
  - `elements: Uint8Array` — a plain copy of `grid.elements`.
  - `colorAux: Uint8Array` — the single per-cell "colour" value FR-028's
    "its colour shade" phrase refers to: `grid.shades[i]` for every element
    **except** `RAINBOW_SAND`, for which it is `grid.hues[i]` instead. One
    array suffices because `shades[i]` and `hues[i]` are never both the
    *rendered* colour source for the same cell — `PlayArea.svelte`'s
    `colorFor` reads `hues[i]` only for `RAINBOW_SAND` and `shades[i]` for
    every other element/ramp, including `FOG` (whose ramp choice is
    separately carried by `cloud`, next). `shades[i]` is written by
    `setCell` for `RAINBOW_SAND` cells too, but never read for rendering or
    any simulation rule at that element — it is dead weight there, so
    dropping it from the snapshot loses nothing visible.
  - `cloud: Uint8Array` — a plain copy of `grid.cloud` (`0`/`1`), needed
    **in addition to** `colorAux`, not merged into it: `FOG` cells are the
    one element that needs *two* independent visible values at once — a
    shade (`colorAux`, indexing `FOG_RAMP`/`CLOUD_RAMP`) **and** the
    fog-vs-cloud ramp choice itself (`cloud`) — so unlike the
    `shades`/`hues` pair, this one cannot be folded away.
  - `glitter: Uint8Array` — a plain copy of `grid.glitter`.
  - `grassHeight: Uint8Array` — a plain copy of `grid.grassHeight`.
  - `rainbows`/`unicorns: PlacedObject[]` — shallow-cloned copies (`{
    ...obj }` per entry) of `objects.rainbows`/`objects.unicorns`, each
    `PlacedObject` being four numbers plus an id.
- **Rationale**: This is the literal, minimal reading of FR-028's own
  enumerated list — "its element, its colour shade, whether it is
  glittered, how tall the grass is, whether it is burning, and whether it
  is fog, cloud, or rain" — where "whether it is burning" is already fully
  recoverable from `elements[i] === STAR_POWER` (no separate flag needed)
  and "whether it is fog, cloud, or rain" is `elements[i] === FOG` (fog or
  cloud) vs. `elements[i] === WATER` (rain, once landed) plus the `cloud`
  bit distinguishing the first two. Five `Uint8Array`s at `CELL_BUDGET =
  43,200` (spec 006's largest field, unchanged) is `5 * 43,200 = 216,000`
  bytes ≈ **0.206 MB per state** — within a few percent of FR-028's own
  "roughly 0.19 MB per state" estimate, and `20 * 0.206 MB ≈ 4.12 MB` for a
  full 10-undo-plus-10-redo history — within a few percent of FR-028's own
  "roughly 4 MB" ceiling and SC-014's "roughly 4 MB" success criterion,
  comfortably clear of the rejected ~15 MB full-fidelity alternative. The
  object-list copies add a few hundred bytes at most (at most 3 rainbows +
  3 unicorns per spec 003's placement cap, unchanged) — negligible against
  the budget.
- **Alternatives considered**: Six separate arrays (`elements`/`shades`/
  `hues`/`glitter`/`grassHeight`/`cloud`, i.e. not merging `shades`/`hues`)
  — rejected: costs `6 * 43,200 = 259,200` bytes ≈ 0.247 MB/state, `≈4.94
  MB` for a full history — a further ~20% over FR-028's own "roughly 4 MB"
  figure for no fidelity gain, since `shades[i]` is provably unread for
  `RAINBOW_SAND` cells by any current code path. Also merging `cloud` into
  `colorAux` (treating shade-or-hue-or-cloud as one shared byte) — rejected
  as **incorrect**, not merely suboptimal: a `FOG` cell needs its shade
  (for `FOG_RAMP`/`CLOUD_RAMP` indexing) *and* the `cloud` flag (for which
  ramp) simultaneously, so collapsing them would silently discard one of
  two independently-visible properties for every fog/cloud cell. Storing
  `starPowerFuelled` in the snapshot to preserve extinguish-outcome
  fidelity — considered and rejected; see §4.

## 3. `HistoryManager`: begin/commit around each action, with no-op detection by direct comparison — no intermediate "after" snapshot

- **Decision**: `HistoryManager` (in `history.ts`) exposes:
  - `beginAction(grid, objects): void` — captures a `WorldState` via
    `captureWorldState` and stashes it as `pending` (a single slot, not a
    stack — only one action is ever "in flight" at a time, since drawing
    is single-pointer and object placement/clear/scene taps are
    synchronous).
  - `commitAction(grid, objects): void` — if `pending` is `null`, returns
    immediately (defensive no-op, not expected to fire in practice). Else
    compares the *current* grid/objects state against `pending` cell-by-
    cell and object-by-object (see below); if identical, discards
    `pending` without recording anything (FR-007); if different, pushes
    `pending` onto the undo stack (evicting the oldest if the stack now
    exceeds 10 — FR-019), clears the redo stack entirely (FR-017), and
    clears `pending`.
  - `undo(grid, objects): boolean` / `redo(grid, objects): boolean` — see
    §5.
  - `canUndo()`/`canRedo(): boolean`, `reset(): void` (clears both stacks
    and any `pending` — used on re-derivation, §6).
  - The no-op comparison (`commitAction`'s internal `worldsEqual`-style
    check) reads `grid.elements`/`shades`/`hues`/`cloud`/`glitter`/
    `grassHeight` and `objects.rainbows`/`unicorns` **directly**, comparing
    each against `pending`'s stored values in one pass, short-circuiting on
    the first difference — it does **not** call `captureWorldState` a
    second time and diff two full snapshots, since a plain read-compare is
    strictly cheaper than an extra 0.2 MB allocation-and-copy for the
    common case (some cells almost always differ, so the comparison
    usually exits early).
- **Rationale**: A single `pending` slot (not a queue) is sufficient and
  correct because the four action kinds (FR-005) are each, by construction,
  never nested or overlapping: a paint stroke's `pointerdown`→`pointerup`
  span is the only "action in progress" state PlayArea ever has (object
  placement, clear, and scene taps are single synchronous calls that
  begin-then-immediately-commit). Comparing directly against the live grid
  rather than capturing-then-diffing two snapshots is the literal reading
  of FR-029 ("nothing may be captured, compared, or copied except when a
  user action is recorded") — it still only runs once per action boundary,
  never per frame, but it is the cheaper of two ways to satisfy that
  requirement, and this project's constitution (Principle IV) favors
  avoiding avoidable allocation even off the hot path. Discarding `pending`
  on a no-op (rather than recording an unchanged state) is FR-007's direct
  requirement and is also what keeps SC-008 ("an action that changes 0
  cells and 0 objects records 0 history steps") true by construction.
- **Alternatives considered**: A queue/stack of pending actions to support
  overlapping strokes — rejected: nothing in this toy's input model
  (single-pointer canvas drawing; toolbar taps are their own separate,
  synchronous actions) ever produces two actions in flight at once, so a
  single slot is not a simplification that costs correctness, it is an
  accurate model of the real constraint. Capturing an "after" snapshot and
  comparing two `WorldState` objects field-by-field — rejected per the
  rationale above (strictly more allocation for the same answer).

## 4. Restore resets exactly FR-028's named internal timers to their own "freshly created" values; `starPowerFuelled` is treated as part of that same internal-timer group

- **Decision**: `restoreWorldState(grid, objects, state)` writes
  `state`'s five arrays back into `grid`'s corresponding fields (splitting
  `colorAux` back into `shades`/`hues` by element, §2) and replaces
  `objects.rainbows`/`unicorns` with fresh clones of `state`'s lists
  (`objects.nextId` is **left untouched** — see §7). For every cell index,
  it then resets exactly the fields FR-028 names as excluded, to the same
  values their own "just created" code paths already use elsewhere in this
  codebase:
  - `grassCooldown[i] = 0` for every cell (matches `setCell`'s own
    unconditional reset).
  - For `STAR_POWER` cells: `starPowerAge[i] = 0`, `starPowerLife[i] =
    randomBurnLife()` (a fresh draw, exactly as `igniteStarPower` performs
    at creation), **and** `starPowerFuelled[i] = 0` — treated as part of
    this same "burn timer" bundle rather than captured, discussed below.
  - For `FOG` cells with `cloud[i] === 0` (rising fog): `fogRiseCooldown[i]
    = randomFogRiseCooldown()`, `fogStuckSteps[i] = 0`, `fogAge[i] = 0` —
    exactly `createFog`'s own field-setting for a brand-new fog cell.
  - For `FOG` cells with `cloud[i] === 1` (cloud): `fogRiseCooldown[i] =
    0`, `fogStuckSteps[i] = 0`, `fogAge[i] = 0`, `cloudRainDelay[i] =
    randomCloudRainDelay()` — exactly `becomeCloud`'s own field-setting.
  - For every other cell: all of the above fields are `0` (matching
    `setCell`'s existing reset-on-non-matching-element behavior).
  - `grid.moved` is left entirely alone — it is a per-step scratch array
    `step()` unconditionally `.fill(0)`s at the top of its very next call,
    so restoring it is pure wasted work regardless of its value at the
    moment of restore.
  - `grid.grassCount`/`grid.fogCloudCount` are recomputed by tallying
    `GRASS`/`FOG` occurrences during the same single pass that copies
    `elements` back in, rather than stored in `WorldState` — this is
    strictly more robust than storing-and-restoring two more numbers, since
    it cannot ever drift out of sync with the `elements` array it was
    derived from.
- **Rationale**: This is the direct, literal implementation of FR-028's
  "the in-flight timers... MUST NOT be captured, and MUST restart from
  their normal starting value when a state is restored" — for every one of
  the four timers FR-028 names by name (fog rise, cloud gathering/rain,
  burn life remaining, grass drinking cooldown), "restart from their normal
  starting value" is unambiguous and already has exactly one established
  meaning elsewhere in this codebase (what `createFog`/`becomeCloud`/
  `igniteStarPower`/`setCell` themselves write for a freshly-created cell
  of that kind), so restore reuses those same values rather than inventing
  new ones. `starPowerFuelled` is **not** one of FR-028's four named
  timers, and is not itself a "colour shade/glitter/height/fog-cloud-rain"
  visible property either (spec's own Key Entities "World state" paragraph
  does not mention it) — its *only* effect is deferred to the moment the
  cell's `starPowerLife` timer elapses (whether it leaves rainbow sand
  behind or vanishes), which is itself already re-randomized by this same
  restore. Since SC-004 explicitly states "step-for-step cell identity with
  the original beyond the moment of restore is explicitly not required,"
  and a burning cell restored as unfuelled is still a completely valid
  world the rules could produce (FR-024's own requirement), resetting it to
  `0` alongside the rest of the burn-timer bundle is the reading most
  consistent with the spirit of FR-028's trade — it is called out below in
  "Decisions made without clarification" since FR-028's own wording does
  not name it explicitly.
- **Alternatives considered**: Capturing `starPowerFuelled` as a sixth
  snapshot array — rejected: it is one more `Uint8Array` (`43,200` more
  bytes/state, `≈0.86` MB across a full history) for a property whose only
  observable effect happens strictly after the moment of restore, which
  SC-004 explicitly says need not match the original; keeping the snapshot
  at exactly FR-028's five named properties is both cheaper and the more
  literal reading of "capture only what she can see." Restoring
  `starPowerLife` to a fixed constant instead of a fresh random draw —
  rejected: every other "freshly created" value in this codebase (a new
  fog cell's rise cooldown, a new cloud's rain delay) is drawn randomly
  within its established range, and a fixed value would be inconsistent
  with — and more conspicuous than — that existing pattern.

## 5. Undo/redo: pop, capture the counterpart onto the other stack, restore — symmetric, no special-casing

- **Decision**: `HistoryManager.undo(grid, objects)`: pop the most recent
  `WorldState` off the undo stack (return `false`, no-op, if empty);
  capture the grid/objects' *current* state via `captureWorldState` and
  push it onto the redo stack; call `restoreWorldState` with the popped
  state; return `true`. `redo(grid, objects)` is the exact mirror: pop off
  the redo stack (return `false` if empty), capture current state onto the
  undo stack, restore the popped state, return `true`. Neither function
  caps the *other* stack's length after pushing — see rationale.
- **Rationale**: This is FR-010/FR-015/FR-016's literal shape: "each Undo
  MUST capture the world state as it stands at that moment onto the redo
  history before restoring" (FR-015) and "tapping Redo MUST... put the
  corresponding action back on the undo history" (FR-016) — i.e. undo and
  redo are exact inverses of the same primitive (pop-one-stack,
  push-current-onto-the-other, restore-the-popped-value), so one
  symmetric pair of functions covers both directions with no per-tool or
  per-direction special case, directly satisfying FR-012's "Undo MUST
  behave identically for every tool, element, and recorded action kind."
  Not separately capping the redo stack after `undo()` pushes onto it is
  safe by construction, not an oversight: the redo stack can only ever
  grow by one push per successful `undo()` call, and `undo()` can only
  succeed as many consecutive times as the undo stack had entries, which
  `commitAction` (§3) already caps at 10 — so the redo stack mathematically
  never exceeds 10 either, exactly matching FR-020's own reasoning ("never
  more than as many states as there have been consecutive Undos... and
  therefore never more than 10"). Symmetrically, `redo()` pushing onto the
  undo stack never needs a fresh eviction check beyond what already exists,
  since `redo()` can only run as many consecutive times as `undo()` most
  recently ran, which is itself bounded.
- **Alternatives considered**: Re-checking/re-capping both stacks' lengths
  inside both `undo()` and `redo()` "just in case" — rejected as needless
  defensive code once the bound is shown to hold by construction (above);
  the project favors trusting established invariants over redundant
  runtime checks (see also `grid.ts`'s own precedent of trusting `setCell`
  as the sole chokepoint rather than re-validating bookkeeping elsewhere).

## 6. Re-derivation discards both histories unconditionally; no other resize path touches them

- **Decision**: `PlayArea.svelte`'s `resize()` function, in its existing
  re-derivation branch (the one that swaps to a freshly `createGrid`'d
  instance — spec 006), gains one call: `history.reset()`, placed
  alongside the existing `drawing = false; lastGridPos = null;` cleanup for
  an interrupted stroke. The early-return branch for a non-re-deriving
  viewport change (address-bar collapse, desktop resize with unchanged
  grid dimensions) is **not** touched — it already returns before reaching
  any grid-replacing code, so the histories are naturally left alone.
- **Rationale**: Direct implementation of FR-022 — histories hold
  `WorldState`s sized to the *old* grid's `width * height`; the new grid
  from `resizeGrid` has different dimensions, so a captured `WorldState`
  from before the re-derivation is now the wrong shape to ever legally
  restore. `history.reset()` also clears any `pending` capture (§3), so an
  in-progress stroke interrupted by the resize (already handled by spec
  006's own `drawing = false` cleanup, FR-028 in that spec) has its
  half-finished "before" snapshot silently discarded rather than
  erroneously committed or left dangling — consistent with this spec's own
  edge case ("the stroke ends cleanly... and counts as one completed
  action" is about the *stroke itself* ending without getting stuck, not
  about that stroke surviving into a undo history that is about to be
  wiped a moment later regardless).
- **Alternatives considered**: Attempting to re-anchor old `WorldState`s at
  the new grid's dimensions (padding/cropping to fit) — rejected outright
  by the spec's own resolved clarification (FR-022's "rather than restoring
  or re-anchoring a state of the wrong shape"), and rejected on
  engineering grounds too: it would require carrying `resizeGrid`'s own
  bottom-centre-offset logic into every stored `WorldState`, coupling
  `history.ts` to `resize.ts` for a case the spec explicitly says is not
  worth solving.

## 7. Toolbar wiring: two new buttons, one new group, state lifted through a callback prop — no new architecture

- **Decision**: `Toolbar.svelte` gains one new `.group` (reusing the
  existing `.group`/`.control` CSS classes verbatim) containing exactly two
  buttons — ↩️ (`aria-label="Undo"`) and ↪️ (`aria-label="Redo"`) — placed
  in the DOM immediately after the existing `.group.actions` (🧽/🗑️/✨) and
  before `.group.scenes` (⬜/🏔️/🏝️), matching FR-001's ordering exactly.
  Each new button takes a `disabled={!canUndo}` / `disabled={!canRedo}`
  attribute (native HTML `disabled` — a disabled button neither fires
  `onclick` nor is focusable, which by itself satisfies FR-003's "tapping
  it MUST do nothing whatsoever") and a `dimmed` CSS class applying reduced
  opacity while `disabled`, with no change to `width`/`height`/`min-width`/
  `min-height` (so the button never shrinks — FR-003's "keeping its full
  size, shape, and position"). Neither button ever receives the existing
  `.selected` class/styling — like 🗑️, they are plain action buttons, not
  tool-selecting ones (FR-002). `Toolbar.svelte` gains four new props:
  `canUndo: boolean`, `canRedo: boolean`, `onUndo: () => void`, `onRedo: ()
  => void` — the same shape as its existing `onClearAll: () => void`.
  `App.svelte` gains `let canUndo = $state(false); let canRedo =
  $state(false);`, updated by a new callback prop passed to `PlayArea`,
  `onHistoryChange: (canUndo: boolean, canRedo: boolean) => void`, invoked
  by `PlayArea` immediately after every `commitAction`/`undo`/`redo`/
  `reset` call that could change either flag. `App.svelte`'s new `undo`/
  `redo` handler functions simply forward to two new exported imperative
  methods on `PlayArea`, `undo(): void` / `redo(): void` (§8) — the same
  `bind:this` pattern `clearAll`/`loadScene` already use.
- **Rationale**: `App.svelte` already owns `tool`/`brushSize` as reactive
  state passed down, with actions flowing back up via callback props
  (`onSelectTool`, `onClearAll`, ...) — `onHistoryChange` is the same
  shape applied to state that changes over time rather than on every
  render, and is the natural fit for Svelte 5's props-down/callbacks-up
  convention this codebase already uses everywhere, without introducing a
  store, a context, or any other new state-sharing mechanism. Using the
  native `disabled` attribute (rather than a click-handler guard like `if
  (!canUndo) return;`) is both simpler and stronger: it is browser-enforced
  (no accidental future regression could make a "dimmed" button still
  clickable) and it is the same mechanism every plain HTML disabled control
  already uses, requiring no new interaction-blocking code.
- **Alternatives considered**: Exposing `canUndo`/`canRedo` as Svelte 5
  `$state` runes directly on the `PlayArea` instance and having `App`
  read them reactively via `bind:this` — considered, but Svelte 5's
  instance-export reactivity for plain (non-`$bindable`) `$state` values
  read from a parent is significantly less idiomatic than this codebase's
  existing callback-prop convention, and would be the first place this
  project reached for that pattern; the callback-prop approach keeps this
  feature's UI wiring uniform with every prior feature's own toolbar/state
  plumbing. A guard inside the click handler instead of the `disabled`
  attribute — rejected per the rationale above (weaker, and inconsistent
  with `disabled`-attribute idioms elsewhere the web platform already
  provides for free).

## 8. `PlayArea.svelte`: begin/commit wrapping the four action kinds; `undo()`/`redo()` finish an in-progress stroke first

- **Decision**: `PlayArea.svelte` instantiates one `HistoryManager` at
  module scope (component-instance scope, alongside `objectsState`).
  - **Paint strokes**: `handlePointerDown`'s existing paint-tool branch
    calls `history.beginAction(grid, objectsState)` immediately before
    setting `drawing = true` and painting the first point.
    `handlePointerUp` (already shared by `onpointerup`/`onpointercancel`)
    calls `history.commitAction(grid, objectsState)` immediately after its
    existing `drawing = false; lastGridPos = null;`, then notifies
    `onHistoryChange`.
  - **Object placement**: `handlePointerDown`'s existing `rainbow`/
    `unicorn` branch wraps its single `placeObject` call with
    `beginAction`/`commitAction` back-to-back (no `pointerup` involvement,
    matching that branch's existing single-tap-only shape) and notifies
    `onHistoryChange`.
  - **Clear-all / scene load**: the existing exported `clearAll()`/
    `loadScene()` methods each wrap their existing body with `beginAction`/
    `commitAction` and notify `onHistoryChange` — no change to what either
    method actually does to the grid/objects/particles.
  - **New exported methods**: `undo(): void` and `redo(): void`. Each
    first checks `if (drawing) { handlePointerUp(); }` — finishing and
    recording the in-progress stroke as its own action (FR-009) — **before**
    calling `history.undo(grid, objectsState)` / `history.redo(...)`; if
    that call returns `true`, notify `onHistoryChange`. Neither function
    clears `particles` (unlike `clearAll`/`loadScene`, which do) — see
    rationale.
  - **Re-derivation** (§6): `resize()`'s existing re-derivation branch adds
    `history.reset()` and a matching `onHistoryChange` notification.
- **Rationale**: This wraps every one of FR-005's four action kinds at
  exactly their natural existing begin/end points, adding no new event
  listeners and no new control-flow branches beyond the wrapping calls
  themselves — the pointer lifecycle, `clearAll`/`loadScene`'s call
  signatures, and `resize()`'s re-derivation detection are all completely
  unchanged. Checking `drawing` and finishing the stroke first inside
  `undo()`/`redo()` is the direct implementation of FR-009 ("If a stroke is
  still in progress when Undo or Redo is tapped, that stroke MUST be
  completed and recorded as one action before the tap takes effect... MUST
  end cleanly with no brush left stuck on") — reusing `handlePointerUp`
  itself (rather than duplicating its two-line cleanup) guarantees the
  in-progress-stroke-ends-cleanly behavior can never drift out of sync
  between the two call sites. A consequence worth naming explicitly: since
  finishing a stroke is itself a newly recorded action, it clears the redo
  stack (FR-017) — so tapping Redo while a second finger is still drawing
  will, correctly, finish and record that stroke first and then find
  nothing left to redo; this is not a special case, it is what FR-009 and
  FR-017 already require in combination, and needs no extra code to
  produce. Not clearing `particles` in `undo()`/`redo()` is the direct
  reading of FR-026 ("transient decoration... need not be captured or
  restored, and MUST simply continue from the restored world without any
  visible glitch") — an abrupt clear would itself be the kind of visible
  glitch that sentence rules out; existing in-flight particles simply keep
  aging out under their own `PARTICLE_LIFETIME_MS`, unaffected by the
  world-state swap beneath them.
- **Alternatives considered**: Clearing `particles` on every undo/redo for
  consistency with `clearAll`/`loadScene` — rejected per FR-026's explicit
  "no visible glitch" wording; `clearAll`/`loadScene` clear particles
  because they are *intentional full wipes* the child asked for, not
  because particles are considered part of "world state" needing to move
  in lockstep with the grid. A dedicated `pointerup`-only commit with no
  `undo`/`redo`-triggered early-finish — rejected outright by FR-009's
  explicit requirement.

## 9. `nextId` is never captured or restored — restored objects keep their original ids, future placements never collide

- **Decision**: `WorldState`'s object-list clones preserve each
  `PlacedObject`'s original `id`. `ObjectsState.nextId` is **not** part of
  `WorldState` and is never touched by `captureWorldState`/
  `restoreWorldState` — it continues incrementing monotonically exactly as
  it does today, undisturbed by undo/redo.
- **Rationale**: `nextId` only exists to hand out ids that have never been
  used before (`placeObject`'s `state.nextId++`); leaving it untouched by
  restore means a restored rainbow/unicorn keeps the exact id it had when
  captured (so `PlayArea.svelte`'s `unicornTimers` `Map<number, ...>`,
  which is keyed by id and lives entirely outside undo/redo's scope,
  continues to associate correctly with a restored unicorn with zero extra
  code — its burst/idle-sparkle cooldowns simply resume counting from
  whatever they were, which is itself unremarkable "invisible" drift
  exactly in the spirit of FR-028), and guarantees every future placement
  after any undo/redo still gets a brand-new id no restored object could
  ever collide with, since `nextId` never decreases.
- **Alternatives considered**: Capturing/restoring `nextId` alongside the
  object lists — rejected: it would allow `nextId` to *decrease* on undo,
  which reopens the possibility of a future placement reusing an id an
  still-live restored object already holds (e.g. undo past a placement,
  place two new objects, redo forward past the undone placement — a naive
  restore-then-continue could collide two objects on the same id if
  `nextId` had been rolled back and only advanced from the rolled-back
  value). Never restoring it sidesteps this class of bug entirely by
  construction, at zero cost (ids are never displayed or otherwise user-
  visible, so restored objects keeping their "true" original id vs. some
  other never-reused id is unobservable to the child either way).

## 10. Toolbar layout tests: bump the two count constants, no new DOM/order test — order/appearance stay maintainer-verified

- **Decision**: `tests/unit/lib/layout.test.ts`'s `TOOLBAR_CONTROL_COUNT`
  constant moves from `16` to `18`; `TOOLBAR_GROUP_COUNT` moves from `5` to
  `6`. No other change to that file — its existing viewport-table
  assertions (fit, no-scroll, fill floors, touch target) automatically
  re-verify FR-004/SC-015 at the new count with zero new test code. No new
  test attempts to verify the two new buttons' on-screen *order*, glyph
  choice, or grouping — those remain maintainer-verified visual checks
  (quickstart.md), exactly as every prior feature's own button
  order/appearance requirements (e.g. spec 004's FR-008/SC-017 "exactly
  one button wears the selected look") have always been, since this
  project has no `.svelte`-component-rendering test infrastructure and the
  constitution's Principle V explicitly directs visual/DOM-structure checks
  to the maintainer's review rather than new browser-automation tooling.
- **Rationale**: `computeToolbarLayout`/`computePlayField` (`layout.ts`)
  are already generic over a control/group *count*, not particular named
  controls — this is the exact mechanism spec 008 itself used to prove its
  own new element button still fit (bumping the same constant from 15 to
  16), and it is the only mechanically-testable part of FR-001/FR-004 this
  project's no-DOM-harness testing strategy can reach. FR-001's specific
  ordering requirement ("their own visually grouped pair... immediately
  after the actions group... before the scene controls") is genuinely a
  DOM-structure/visual claim with no existing project precedent for
  automating it outside a real browser, so it is listed in quickstart.md's
  manual-check section instead of invented as a new, unprecedented
  source-parsing test.
- **Alternatives considered**: Writing a test that reads `Toolbar.svelte`'s
  source text and asserts the relative order of `aria-label` strings —
  considered as a way to give FR-033's "the two controls appearing as
  their own group in Undo-then-Redo order" line literal automated coverage,
  but rejected: no test in this codebase parses a `.svelte` file's markup
  today, and doing so here would be a one-off, brittle pattern (any
  cosmetic edit to `Toolbar.svelte`'s markup could break a purely textual
  assertion) introduced for a single feature rather than an established,
  reusable testing approach — inconsistent with this project's own
  unbroken precedent of leaving DOM-order/appearance claims to the
  maintainer's visual pass.

## 11. No new runtime dependency; production build size

- **Decision**: This feature needs no new package, browser API, or build
  step. `HistoryManager`/`WorldState`/capture/restore are built entirely
  from plain `TypeScript`/`Uint8Array`s, exactly like every existing
  `src/sim/*` module.
- **Rationale**: Constitution Principle III and the project's unbroken
  precedent. FR-030's "page MUST NOT grow by more than 5 KB" is satisfied
  by construction: one new, modestly-sized source file plus a handful of
  lines in three existing files, with zero new dependencies to bundle —
  the single-file build's size growth is bounded by source code size alone,
  which this feature's total diff is well under.
- **Alternatives considered**: None — no candidate dependency (e.g. a
  general-purpose undo library, a structural-clone/immutability library)
  was ever in scope; this toy's `Grid` is already flat typed arrays, for
  which a hand-written capture/restore is simpler and cheaper than any
  general-purpose library could be.

All Technical Context unknowns are resolved; nothing carries forward to
Phase 1 as unresolved.

## Decisions made without clarification

All three `[NEEDS CLARIFICATION]` markers this spec ever had were already
resolved on issue #28 before this planning stage began (`spec.md`'s own
Clarifications section: toolbar placement, FR-001; rotation/history
interaction, FR-022; visible-vs-simulation-fidelity memory trade, FR-028/
SC-004). The following implementation-technology choices were made without
further clarification because the spec leaves them as implementation
detail, not product intent:

- The exact `WorldState` snapshot shape — five parallel arrays, with
  `shades`/`hues` merged into one `colorAux` array by element and `cloud`
  kept separate (§2) — is the plan's own reading of "capture only what the
  child can see," chosen to land close to FR-028's own ~0.19 MB/state,
  ~4 MB/history estimates; the spec does not pin an exact byte layout.
- Treating `starPowerFuelled` as part of the excluded "burn timer" bundle
  rather than a captured visible property (§4) — FR-028 names four
  specific timers by name and does not mention this flag either way; this
  is a considered extension of the same trade to a fifth, closely-related
  piece of internal state whose only effect is deferred past the moment of
  restore (SC-004 already permits this).
- The single-`pending`-slot, direct-comparison design for no-op detection
  (§3) and the symmetric pop/push/restore shape of undo/redo (§5) are
  implementation-technology choices satisfying FR-007/FR-010/FR-015/
  FR-016/FR-029's behavioral requirements without a single specified
  mechanism.
- Leaving `ObjectsState.nextId` outside undo/redo's scope entirely (§9) is
  an implementation choice that happens to also be the one that avoids a
  latent id-collision class of bug; the spec is silent on object ids as an
  implementation concept.
- Not adding a source-parsing or other new test-automation mechanism to
  cover FR-001/FR-033's button-*order* wording, leaving it a maintainer
  visual check instead (§10) — consistent with, not a departure from, this
  project's existing no-DOM-harness testing precedent, but the spec itself
  does not spell out which specific automated-vs-manual split each clause
  of FR-033 gets.
