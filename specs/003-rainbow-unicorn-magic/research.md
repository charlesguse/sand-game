# Phase 0 Research: Rainbow and Unicorn Magic

The spec's Assumptions section already resolved every open product question
(clarified on issue #3): the per-type cap of 3 rolls rather than blocks,
objects float exactly where tapped with no gravity of their own, and
rainbow sand shimmers while moving and freezes at rest with a documented
fallback. No `[NEEDS CLARIFICATION]` markers remain in `spec.md`. This
research resolves the remaining *implementation-technology* unknowns needed
to fill Technical Context and unblock Phase 1 design — chiefly how to add
non-falling, multi-cell "objects" and a decorative particle overlay to a
sim core that has so far only ever known about single-cell elements.

This feature is a direct extension of `001-falling-pink-sand` and
`002-water-and-purple-dirt`. Their plans, research, data-model, and
contracts are prior art and are referenced throughout rather than restated.
The current `src/sim/*` shape (read directly from the checked-out code, not
assumed from 002's docs) is: `types.ts` defines `EMPTY/SAND/WATER/DIRT` and
`Grid { width, height, elements: Uint8Array, shades: Uint8Array, moved:
Uint8Array }`; `grid.ts` has `createGrid/inBounds/getElement/getShade/
setCell/clearGrid`; `element.ts` has `isPowder/isLiquid`; `step.ts` scans
bottom-to-top, left-to-right, skipping cells already marked `moved` this
tick, dispatching powders to `stepPowder` (fall → sink-swap-through-water →
diagonal slide into empty-or-water → rest) and liquids to `stepLiquid`
(fall → diagonal slide into empty → sideways spread into empty → rest);
`brush.ts` has `applyBrush/applyBrushLine` with a `paintCell` priority rule
per tool. `PlayArea.svelte` owns the `requestAnimationFrame` loop, pointer
handling, and `putImageData` rendering with three fixed color ramps keyed
by element.

## 1. Representing objects: a shared "blocked" element value plus a small object list

- **Decision**: Add two new element constants to `src/sim/types.ts`:
  `RAINBOW_SAND = 4` (a real, falling powder) and `OBJECT = 5` (a shared
  marker meaning "this cell is inside some object's footprint," used
  identically for rainbow and unicorn cells — it never needs to
  distinguish which object owns a cell, because `step()` never inspects an
  `OBJECT` cell's identity, only that it is neither empty nor liquid).
  Object *identity* (kind, position, size, id) lives outside the grid, in a
  small capped list — a new `src/sim/objects.ts` module owns an
  `ObjectsState { rainbows: PlacedObject[]; unicorns: PlacedObject[];
  nextId: number }`, each list capped at 3 (FR-005). `PlacedObject` is
  `{ id, kind, x, y, size }`, `x`/`y` the footprint's top-left grid cell.
- **Rationale**: `step()`'s existing neighbor-openness checks
  (`elements[belowIndex] === EMPTY`, `isLiquid(elements[...])`) already
  treat anything that is neither `EMPTY` nor a liquid as blocked — exactly
  the floor/wall/off-grid contract 001 and 002 built on. Giving objects a
  distinct, non-powder, non-liquid element value means **`step.ts`'s
  movement code needs zero changes**: an `OBJECT` cell blocks a fall or
  swap the same way a wall does, and the main scan's
  `if (isPowder(...)) ... else if (isLiquid(...)) ...` chain already
  no-ops on any other value, which is exactly FR-007 ("objects MUST NOT be
  affected by gravity rules"). This is the single biggest simplification
  available here, and it is only possible because objects don't need a
  *different kind of blocking* from a wall, just the same blocking at
  interior cells.
- **Alternatives considered**: Encode object kind directly in the element
  byte (e.g. `OBJECT_RAINBOW = 5`, `OBJECT_UNICORN = 6`) — rejected: no
  code path needs to recover kind from a raw footprint cell (conversion and
  celebration both iterate the small object *list*, never scan the grid
  for objects), so the extra distinction would be dead information, and it
  would complicate the "cell still covered by another object" check in §3
  below (a shared marker is simpler to reason about than two markers whose
  overlap must be reconciled). A parallel `Uint8Array` of object-ids per
  cell — rejected as unnecessary allocation and complexity for a problem
  §3's recompute-on-change approach already solves cheaply, since object
  count is capped at 6 total.

## 2. Rainbow conversion and unicorn touch share one "zone" shape

- **Decision**: Both FR-013 (rainbow conversion zone) and FR-023 (unicorn
  touch) are "the ring of cells at Chebyshev distance 1 from the
  footprint, excluding the footprint itself, clipped to grid bounds." One
  shared helper in `objects.ts`, `forEachZoneCell(grid, obj, fn)`, iterates
  that ring for any `PlacedObject` regardless of kind. Because the object
  count is capped at 6 and each footprint is small (§6), this is called
  once per object per tick — not a grid scan — costing at most
  `6 × O(perimeter)` cell visits per tick, independent of grid size.
- **Rationale**: The spec's own Assumptions section states the conversion
  zone is "contact-based, one cell deep... not a radius or an aura," and
  User Story 2's independent test frames the unicorn trigger the same way
  ("the reaction trigger (grain touching the unicorn's zone)"). Sharing one
  iteration helper keeps the rule visibly identical for both object kinds,
  which matters for FR-017/FR-018 (independent, non-amplified rainbows) and
  the equivalent unicorn independence (Acceptance Scenario 8 of User Story
  2) — both fall out of "iterate this object's own ring, look only at
  current grid contents," with no cross-object interaction of any kind.
- **Alternatives considered**: A precomputed boolean "zone" bitmap
  recomputed alongside the object mask in §3 — rejected: it would need to
  be re-derived every tick anyway (zone *contents* change every tick, only
  zone *shape* is static), so it buys nothing over iterating the ring
  directly from the object's stored `x/y/size`, which needs no extra
  memory at all.

## 3. Footprint mask maintenance: recompute only on placement/removal, never per tick

- **Decision**: `placeObject(grid, state, kind, cx, cy)` nudges the
  requested center so the whole `size × size` footprint fits on-grid
  (FR-004), evicts the oldest object of that kind if the cap is already at
  3 (FR-005, calling the same removal path as below), stamps every cell in
  the new footprint to `OBJECT` (which necessarily discards whatever
  element or object marker was there before — FR-006), and appends the new
  `PlacedObject`. `removeObject(grid, state, obj)` deletes `obj` from its
  list, then for every cell in `obj`'s footprint checks whether any
  *remaining* object (either list) still covers that cell; if none do, the
  cell is set back to `EMPTY` (releasing anything that was resting on it to
  fall next tick — FR-012), otherwise it is left as `OBJECT` (still covered
  by the surviving object — the overlap case in the spec's Edge Cases).
- **Rationale**: This is the only place footprint/element interaction needs
  to reconcile "is this `OBJECT` cell still owned by something," and it is
  bounded by footprint size (§6) times at most 5 other live objects — a
  handful of cheap integer comparisons, run only on the (rare, human-paced)
  events of placing or removing an object, never inside the per-tick
  `step()` hot loop. Recomputing beats trying to track per-cell ownership
  counts (e.g. a ref-count array) for the same reason §1 rejected an
  id-per-cell array: nothing else needs that information, so it would be
  pure overhead.
- **Alternatives considered**: Track a ref-count `Uint8Array` incremented/
  decremented per cell on every placement/removal so removal is O(footprint)
  without the "check other objects" scan — rejected as a needless second
  parallel array; with at most 6 objects total the "check other objects"
  scan this decision uses is already cheaper than maintaining a whole extra
  grid-sized array just to avoid a tiny constant-bounded loop.

## 4. Rainbow-sand hue: a fourth parallel array, incremented only on movement

- **Decision**: Add `hues: Uint8Array` (same length/indexing as `elements`/
  `shades`/`moved`) to `Grid`, meaningful only where `elements[i] ===
  RAINBOW_SAND`. Conversion (§5) initializes `hues[i]` to a fresh pseudo-
  random start value. `step.ts`'s existing `moveCell`/`swapCells`
  primitives are extended to also carry `hues[i]` alongside `elements`/
  `shades` on every move or swap (so a grain's hue always travels with it,
  exactly like its shade does), and — only when the cell landing at the
  destination is `RAINBOW_SAND` — the destination's `hues` value is
  advanced by a fixed step (mod a cycle length) as part of that same move.
  A grain that does not move this tick has its move/swap primitives never
  called on it, so its `hues[i]` is untouched — it stays frozen at rest,
  which is exactly FR-021's freeze rule, for free, with no separate
  "is this cell resting" check needed anywhere.
- **Rationale**: FR-021 requires "only moving grains may be recolored per
  frame, which bounds the cost" and "a grain that never moves must never
  change hue." Piggy-backing the hue advance onto the exact same code path
  that already decides whether a cell moved (`moveCell`/`swapCells`, called
  only for cells that actually relocate this tick) satisfies both
  requirements structurally, with zero additional scanning: there is no
  second pass over the grid looking for "which cells moved," because the
  advance happens exactly where the move already happens. This also
  automatically satisfies "a grain that starts moving again must resume
  cycling" (Acceptance Scenario 8) since it's the same per-move code path
  regardless of how long the grain had been resting.
- **Alternatives considered**: A second full-grid pass after `step()`,
  scanning `moved` for `RAINBOW_SAND` cells and advancing their hue —
  rejected: functionally equivalent but strictly more expensive (an extra
  `width × height` scan every tick on top of the one `step()` already
  does), for no benefit; the move-primitive approach achieves the same
  result inline. Storing hue as a full RGB triple instead of one byte —
  rejected: FR-021 only needs a cyclic position along a hue wheel, one byte
  (0–255 mapped to 0–360°) is exactly the same shape 001/002 already use
  for `shades`, and keeps `Grid`'s memory footprint growing linearly (one
  more `Uint8Array`) rather than by a larger factor.
- **Documented fallback (per FR-021 itself)**: if profiling later shows
  even this bounded per-move cost strains the 60fps target, the sanctioned
  fallback is to stop advancing `hues[i]` on move and instead fix it once,
  at conversion time only (§5) — a static striped pile, no shimmer. This
  requires deleting the one `hues[destination] = ...` line from the move
  primitives; no other structural change. FR-030 (performance) takes
  precedence over the shimmer per the spec's own text.

## 5. Rainbow conversion is a small, targeted pass — not folded into `step()`'s scan

- **Decision**: `step(grid)` itself is **not modified** to know about
  objects at all (beyond already treating `OBJECT` as blocked per §1, which
  required no code change). A new exported function,
  `applyRainbowConversions(grid, rainbows)`, is called once per tick,
  immediately after `step(grid)` — by `PlayArea.svelte`'s frame loop, and
  directly by tests. For each rainbow, it walks that rainbow's zone cells
  (§2) and, for any cell currently holding exactly `SAND`, `DIRT`, or
  `WATER` (not `RAINBOW_SAND` — already converted, not `OBJECT` — not a
  convertible element at all), sets its element to `RAINBOW_SAND` in place
  and gives it a fresh `hues[i]` start value, preserving the cell's
  existing `shades[i]` byte unused thereafter (rainbow sand's color comes
  from `hues`, not `shades` — see §7) — no cell is created, destroyed, or
  moved by this pass (FR-015).
- **Rationale**: Keeping conversion as its own pass, called right after
  `step()` rather than folded into its per-cell scan, means (a) `step()`'s
  existing, already-tested fall/slide/rest/sink logic for 001/002 stays
  byte-for-byte unchanged (directly protecting FR-036/SC-013 — no
  regression risk to the existing test suite), and (b) conversion is
  `O(objects × zone size)` rather than `O(grid size)`, since only rainbows'
  own small rings ever need inspecting — a rainbow "reaching out" to affect
  the grid, rather than every grid cell asking "am I near a rainbow,"
  matches both the spec's phrasing (FR-013: rainbow *defines* a zone) and
  the performance goal (FR-030) far more directly than a full-grid check
  ever could. Ordering it *after* `step()` means a grain that just moved
  into the zone this tick is seen as converted on "the following simulation
  step" exactly as SC-002 specifies (the grain moves during `step()`, then
  conversion sees its new position in the same overall tick before the next
  render).
- **Alternatives considered**: Fold a per-cell "is there a rainbow adjacent"
  check into `step()`'s main scan — rejected: that check is naturally
  `O(grid size × nearby-rainbow-lookup)` unless every cell already knows
  whether it's near a rainbow (which would need the same zone-marking work
  this decision avoids), and it would entangle 001/002's proven `step()`
  logic with a feature-3 concern for no gain. Running conversion *before*
  `step()` instead of after — rejected: would convert based on last tick's
  positions, delaying the visible reaction by one extra frame with no
  compensating benefit.

## 6. Footprint size

- **Decision**: Both object kinds use one shared constant,
  `OBJECT_FOOTPRINT_SIZE = 24` (cells square), exported from
  `src/lib/layout.ts` alongside `GRID_WIDTH`/`GRID_HEIGHT`/`BRUSH_RADII`.
  At the existing 270×160 grid, that's ~9% of width and 15% of height —
  large enough for a 🌈 or 🦄 glyph to read clearly at the default canvas
  size, small enough that three of each (the FR-005 cap) plus flowing
  elements around them still fit comfortably (SC-012's worst-case scene).
- **Rationale**: The spec's own Assumptions section leaves the exact cell
  count as "an implementation tuning choice," constrained only by "roughly
  one tenth of the play area's width" and legibility. A single shared
  square size (rather than separate tunable sizes per kind) keeps
  `objects.ts` and the zone/mask logic in §1–§3 uniform across both kinds,
  and nothing in the spec asks for the two objects to differ in footprint
  size.
- **Alternatives considered**: Size the footprint from a fraction of grid
  *height* instead of width, or make it configurable at runtime — rejected,
  no requirement calls for either, and a fixed constant is the simplest
  thing that satisfies FR-003/SC-006 (a settled heap still reads as
  6+ hues) and the toolbar's/frame's need for a predictable worst case.

## 7. Rendering objects and rainbow sand — render-layer concern, not sim-core

- **Decision**: `PlayArea.svelte`'s per-frame `putImageData` fill treats
  `OBJECT` cells the same as `EMPTY` (background color) for the underlying
  pixel grid — the emoji glyph itself is drawn afterward, once per object
  (not per cell), via `ctx.fillText('🌈'|'🦄', ...)` centered on the
  footprint's pixel bounds, directly on the canvas 2D context, after
  `putImageData` and before particles. `RAINBOW_SAND` cells compute an RGB
  color from `hues[i]` via HSL→RGB at a fixed saturation/lightness (so
  every hue value maps to a distinct, vivid, rainbow-family color) instead
  of an index into a fixed ramp table the way the other three elements do.
- **Rationale**: This is exactly how 002's research (§6 there) already
  drew the line between `src/sim/*` (never contains color/palette
  concepts) and the render layer (owns all color decisions) — extended
  here to objects (glyph is purely a render-time overlay keyed off the
  small object list, never a per-cell grid concept beyond the `OBJECT`
  block marker) and to rainbow sand (its color is *computed* from a hue
  angle rather than looked up in a fixed small ramp, because FR-020 wants
  a continuous rainbow spread, not 6–8 discrete swatches like the other
  elements).
- **Alternatives considered**: Give `RAINBOW_SAND` its own fixed ramp table
  like `PINK_RAMP`/`BLUE_RAMP`/`PURPLE_RAMP` — rejected: a small fixed ramp
  (6–8 entries) reused across the whole grid would make every rainbow-sand
  grain sharing a `hues[i] % rampLength` cycle look identical in bands,
  whereas FR-021's shimmer-then-freeze rule wants each grain's hue to be
  its own continuously-advancing value; HSL→RGB from a single byte is no
  more expensive than a table lookup and gives the smoother "cycles through
  the rainbow" look FR-021 and the visual-checks section ask for.

## 8. Object tools place once per press, never continuously

- **Decision**: `Tool` widens to `'sand' | 'water' | 'dirt' | 'rainbow' |
  'unicorn' | 'eraser'`. `PlayArea.svelte`'s `handlePointerDown` branches on
  whether the selected tool is an object kind: if so, it calls
  `placeObject(grid, objectsState, tool, gridX, gridY)` once and does
  **not** set `drawing = true` (so the existing `handlePointerMove`'s
  `if (!drawing) return` guard already prevents any repeat placement along
  a drag, with no new drag-tracking logic needed); otherwise the existing
  element-brush press/drag path runs unchanged.
- **Rationale**: This is FR-002 exactly ("one press places one object...
  MUST NOT pour continuously"), and reusing the existing `drawing` boolean
  rather than adding a parallel piece of state means the object-tool path
  can't accidentally inherit any of the drag/line-interpolation machinery
  built for continuous brushes (`applyBrushLine`'s Bresenham walk is simply
  never invoked for object tools).
- **Alternatives considered**: Let `pointerdown` set `drawing = true` for
  object tools too, and have `paintAt` internally no-op after the first
  call — rejected, it would leave `lastGridPos` tracking and Bresenham-line
  logic engaged for no reason, and "don't start" is simpler and harder to
  get wrong than "start, then immediately suppress."

## 9. Eraser removes whole objects; clear-all resets object state too

- **Decision**: A new `eraseObjectsInBrush(grid, state, cx, cy, radius)` in
  `objects.ts` is called by `PlayArea.svelte` immediately before its
  existing `applyBrush(grid, 'eraser', ...)` call, whenever `tool ===
  'eraser'`. It walks every live object (≤6) and, for any object whose
  footprint contains at least one cell inside the brush's circular
  coverage (same footprint math `forEachFootprintCell` in `brush.ts`
  already computes), calls `removeObject` (§3) for that object in full.
  The existing element-only `applyBrush(grid, 'eraser', ...)` call then
  proceeds unchanged and simply clears element cells in the brush's
  footprint (harmless no-op on cells already `EMPTY` from the removal
  above). `clearAll()` in `App.svelte`/`PlayArea.svelte` additionally
  resets `objectsState` to empty lists (`rainbows = []`, `unicorns = []`)
  alongside the existing `clearGridState(grid)` call, which already zeroes
  every `elements` byte including `OBJECT` cells.
- **Rationale**: FR-031 requires the eraser to remove a touched object "in
  whole — no partial objects," which a plain per-cell `setCell(EMPTY)`
  brush (as used for elements) cannot guarantee once a brush stroke only
  grazes part of a 24×24 footprint. Doing the whole-object removal as an
  explicit, separate, small (≤6-object) pass keeps `brush.ts`'s existing
  `applyBrush`/`paintCell` contract for elements completely untouched
  (protecting 002's existing `brush.test.ts` from any behavior change),
  while still composing cleanly with it — the caller just makes two calls
  instead of one when the eraser is active.
- **Alternatives considered**: Teach `paintCell`'s eraser branch to look up
  and remove a whole object when it touches an `OBJECT` cell — rejected:
  `brush.ts` would need a reference to `ObjectsState` purely for the eraser
  case, growing every other tool branch's mental model (and its exported
  signatures) for a concern (objects) that 001/002's module never had and
  doesn't need for `'sand'/'water'/'dirt'` painting.

## 10. Unicorn celebration and idle sparkle are UI-layer, not sim-core-tested

- **Decision**: `objects.ts` exports one more small pure function,
  `isUnicornTouched(grid, unicorn): boolean` (walks the same zone shape as
  §2, returns true if any zone cell holds a non-`EMPTY`, non-`OBJECT`
  element) — this is the one piece of unicorn behavior FR-037 requires
  automated coverage for. Everything downstream of that boolean — spawning
  ✨/💖 particles, rate-limiting repeated contact (FR-024), the idle
  sparkle timer (FR-025), particle drift/fade/cap (FR-026/FR-028) — is
  implemented as a small framework-free particle module,
  `src/lib/particles.ts` (plain TypeScript, no DOM), driven once per
  animation frame from `PlayArea.svelte` using `performance.now()`
  timestamps for rate-limiting and lifetime, and rendered as floating
  emoji glyphs (`ctx.fillText`) with fading alpha, after the object glyphs.
- **Rationale**: FR-037's explicit test list is "the rainbow conversion
  rule... rainbow sand moving identically to pink sand... elements landing
  on and sliding off solid objects... the per-type cap of 3... objects
  staying at their placed cells" — it does not list particle visuals or
  idle-sparkle timing, and the spec's own "Visual checks for the
  maintainer (no automated coverage)" section explicitly defers particle
  *feel* to manual review. Keeping the touch/no-touch decision
  (`isUnicornTouched`) as one pure, grid-only function gives FR-023's
  actual trigger condition automated coverage without needing to bring
  animation timing, `performance.now()`, or particle rendering into
  `vitest`'s no-DOM environment (constitution Principle V already frames
  visual/feel checks as the maintainer's job, not CI's).
- **Alternatives considered**: Build the whole particle system inside
  `src/sim/*` so it's "framework-free" like the grid code — rejected: FR-027
  is explicit that particles never touch grid cells or affect the
  simulation, so there is no grid-state behavior to unit-test there; forcing
  animation/timing logic into the same module as `step()` would blur
  constitution Principle III's "Svelte owns the UI shell, sim core owns the
  hot loop" boundary for a system that is, by the spec's own design, pure
  decoration.

## 11. Performance budget with objects, conversion, and particles

- **Decision**: Keep 001/002's grid size (270×160) and `putImageData`
  render path unchanged. Per-tick added cost: `step()` itself is unchanged
  (§1, §4's hue advance rides inside existing move primitives, adding one
  extra array write only for cells that already moved); `applyRainbow
  Conversions` and the unicorn touch check are bounded by `6 objects ×
  O(24-cell perimeter)` regardless of grid fullness; particle
  update/render is bounded by FR-028's documented cap, checked once per
  frame. None of this changes the asymptotic shape (one grid pass per tick
  plus a small constant amount of object/particle bookkeeping) that 001/002
  already validated against the 60fps target.
- **Rationale**: SC-012's worst case (3 rainbows, 3 unicorns, particles at
  cap, half the play area full of flowing elements including shimmering
  rainbow sand) is exactly the case this design targets: the grid pass cost
  is unchanged from 002, and every new piece of work is bounded by small
  constants (object count ≤6, particle count ≤ the cap) independent of grid
  size. If profiling later shows this dips below 30fps, FR-021's own
  fallback (§4) removes the shimmer's per-move cost first, and the general
  fallback inherited from 001/002 (shrink the grid) remains available but is
  explicitly lower-priority than dropping the shimmer.
- **Alternatives considered**: Cap particle count lower than needed "just in
  case" — rejected pre-emptively narrowing scope; the actual cap value is a
  Phase-2/implementation tuning choice (like brush radii), not a planning
  decision, and is left to be picked (and profiled) during implementation
  against FR-028/SC-011's requirement that frame rate never degrades.

All Technical Context unknowns are resolved; nothing carries forward to
Phase 1 as unresolved. No spec-level `[NEEDS CLARIFICATION]` markers exist
in `spec.md` (they were already resolved in its own Assumptions section,
each explicitly tagged "clarified on issue #3"), so no clarification-
avoidance decisions are recorded here beyond the implementation-technology
choices above.
