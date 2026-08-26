# Phase 0 Research: Water and Magic Purple Dirt

The spec's Clarifications section already resolved its three open questions
(simple-flow-only water, purple dirt as "purple sand", fixed per-cell shade).
This research resolves the remaining *implementation-technology* unknowns
needed to fill Technical Context and unblock Phase 1 design — chiefly how to
extend feature 001's single-element grid to three elements without
regressing pink sand or the 60fps budget.

This feature is a direct extension of `001-falling-pink-sand`. Its plan,
research, data-model, and contracts (`specs/001-falling-pink-sand/`) are
prior art and are referenced throughout rather than restated.

## 1. Grid data structure for multiple elements

- **Decision**: Replace 001's single `Uint8ClampedArray` (`cells`, where a
  nonzero byte meant "sand, this shade") with two parallel flat arrays on the
  same `Grid`, both length `width * height`, row-major:
  - `elements: Uint8Array` — `0` = empty, `1` = pink sand, `2` = water,
    `3` = magic purple dirt.
  - `shades: Uint8Array` — per-cell shade byte, meaningful only where
    `elements[i] !== 0`; carried alongside `elements[i]` on every move/swap.
  A third scratch array, `moved: Uint8Array` (same length), is allocated
  once in `createGrid` and reused every tick by `step()` (see §4) — it holds
  no logical state and is not touched by rendering, brushes, or tests other
  than indirectly through `step()`'s behavior.
- **Rationale**: 001's encoding conflated "what element" with "what shade"
  in one byte, which only worked because sand was the only element. Three
  elements need to be distinguished independently of their shade (FR-001,
  FR-002), and density comparisons (is the cell below a powder, water, or
  empty?) are checked on nearly every cell every tick — a single equality
  check against a small integer (`elements[i] === WATER`) is both the
  cheapest and the clearest way to do that. Two flat typed arrays keep the
  hot loop allocation-free (constitution Principle IV) exactly like 001's
  single array did, at the cost of one extra byte read per cell per tick,
  which is negligible next to the branching logic itself.
- **Alternatives considered**: Encode element by byte *range* in a single
  array (e.g. `1–84` = sand shades, `85–169` = water shades, `170–254` =
  dirt shades) to avoid a second array — rejected: every density check
  becomes a range comparison instead of an equality test, the three ranges
  eat into the shade resolution available to each element (fewer than
  SC-010's required 6–8 distinguishable shades per element would fit
  comfortably), and it is substantially harder to read and get right than
  two arrays. A `Uint16Array` packing element in the high byte and shade in
  the low byte — rejected: no memory or speed win over two `Uint8Array`s at
  this grid size, and 001's `getCell`/`setCell` contract already returns a
  plain `number`, which two arrays preserve more directly via
  `getElement`/`getShade`. Object-per-cell — rejected for the same
  allocation reasons 001 already rejected it.
- **Migration note**: this changes the `Grid` shape 001 defined
  (`cells: Uint8ClampedArray` → `elements`/`shades`/`moved`). That is an
  intentional, spec-anticipated extension (spec Assumptions: "this feature
  assumes the falling-pink-sand toy... exists and is the base being
  extended") of the sim core's *internal representation*, not a behavior
  regression — every 001 acceptance scenario and functional requirement
  must still hold (FR-015, SC-007), just re-expressed against the new
  fields. `tests/unit/sim/grid.test.ts` and `step.test.ts` from 001 are
  updated to the new field names as part of this feature rather than kept
  on the old shape.

## 2. Element and density constants

- **Decision**: Export numeric constants from `src/sim/types.ts` —
  `EMPTY = 0`, `SAND = 1`, `WATER = 2`, `DIRT = 3` — plus two pure helper
  predicates in `src/sim/element.ts`: `isPowder(e)` (`e === SAND ||
  e === DIRT`) and `isLiquid(e)` (`e === WATER`).
- **Rationale**: Named constants make `step.ts` and `brush.ts` read as
  density rules ("if the cell below is a powder…") instead of magic numbers,
  at zero runtime cost (they inline to the same integer comparisons).
  Centralizing `isPowder`/`isLiquid` in one place means "which family is
  this element in" is answered identically everywhere sinking/resting logic
  needs it (FR-009, FR-012, FR-013).
- **Alternatives considered**: A TypeScript string-union `Element` type
  (`'empty' | 'sand' | 'water' | 'dirt'`) stored as strings in the grid —
  rejected, strings can't live in a `Uint8Array` and boxing them would
  reintroduce per-cell allocation.

## 3. Powder-sinks-through-water as a swap, not a displacement

- **Decision**: When a powder cell's neighbor (directly below, or diagonally
  below when blocked straight down) holds water, the two cells exchange
  their full `(element, shade)` pairs in place: the powder's values move
  into the water's old slot and the water's values move into the powder's
  old slot. This is one `step()` case, not "delete water, place sand" —
  no water cell is ever created or destroyed by sinking (FR-013, SC-004,
  SC-005 conservation).
- **Rationale**: A swap is the natural cellular-automaton expression of "the
  heavier thing and the lighter thing trade places" and trivially preserves
  the count of every element (FR-003, SC-005) without a separate
  conservation check. It also naturally implements "water pushed up out of
  the way" (User Story 2) as a side effect of the same rule that makes sand
  fall, rather than a second mechanism.
- **Alternatives considered**: Model water as "displaced" and re-inserted
  via a search for the nearest empty cell above — rejected, far more
  complex, can fail to find space (violating conservation) in a full
  column, and isn't needed since a direct swap already produces the correct
  visible result (water rises one cell at a time as sand falls through it).

## 4. Preventing double-hops within one tick (the `moved` scratch buffer)

- **Decision**: `step()` scans bottom row to top row (as 001 already did),
  and within a row left to right. Before scanning, `grid.moved.fill(0)`.
  Whenever a cell at index `i` is moved or swapped, both its source and
  destination indices are marked `moved[i] = 1`; the scan skips any cell
  already marked `moved` when it reaches it (this can only happen for a
  destination in the *current* row, since the bottom-up order already
  guarantees a lower row is never revisited — see 001 research.md §4).
- **Rationale**: 001's fall/slide/rest rules never needed this, because a
  grain only ever moves into a row that direction of scan won't revisit.
  Water's *sideways* spread (FR-006) breaks that invariant: sideways moves
  land in the same row the scan is still traversing, so without a guard a
  single water cell could be walked rightward (or leftward) more than once
  per tick, moving 2+ cells in one step. That would violate the spec's
  explicit one-cell-per-step model (User Story 1 Acceptance Scenarios 2–4,
  each phrased as "moves down/into ... one cell") and make the leveling
  rate in SC-002 depend on scan direction instead of tick count. Marking
  both endpoints of every move closes this for falls, diagonal slides, and
  swaps too, uniformly, at the cost of one extra array clear (`fill(0)`,
  O(width·height), same cost class as the scan itself) and one extra check
  per cell — comfortably inside the performance budget (see §7).
- **Alternatives considered**: Double-buffer the whole grid each tick (read
  from a snapshot, write into a fresh copy) — rejected, reintroduces a
  per-tick allocation (or a second permanently-resident buffer with a
  swap-and-copy step) for a problem the much cheaper `moved` flag already
  solves. Restricting sideways spread to alternate left/right by tick
  parity instead of a moved flag — rejected, does not actually prevent a
  cell from being read twice in one scan of the *same* tick; it only
  changes bias, not correctness.

## 5. Water movement rule order and never-rises invariant

- **Decision**: For each unmarked water cell, evaluate in order: (1) empty
  directly below → move down; (2) if blocked, empty diagonally below-left
  or below-right → move into one, random choice if both open; (3) if still
  blocked, empty directly left or right → move into one, random choice if
  both open; (4) otherwise stay. Water's own moves only ever target `row+1`
  (cases 1–2) or the same row (case 3) — never `row-1` — so "water never
  rises" (FR-010, SC-015) is true by construction of which offsets are ever
  tried, not by an extra check.
- **Rationale**: This is exactly FR-004–FR-008 read as a priority list, and
  matches 001's existing fall/slide priority shape (down, then diagonal,
  then — new for water — sideways) so the two element families share a
  recognizable structure in `step.ts` instead of two unrelated algorithms.
- **Alternatives considered**: Give water a "pressure" or fill-rate value to
  approximate rising in closed vessels — explicitly out of scope per spec
  FR-010 and the Assumptions section; not evaluated further.

## 6. Shade mechanism is unchanged; palette selection moves to the render layer

- **Decision**: `src/sim/shade.ts`'s `randomShade(): number` keeps its exact
  001 signature and behavior (returns 1–255, never 0). It is called for
  every newly-placed cell of *any* element. What changes is downstream: the
  render code (inside `PlayArea.svelte`'s per-frame `putImageData` buffer
  fill) picks one of three fixed small color ramps — pink, blue, or purple —
  keyed by `elements[i]`, and indexes into that ramp using `shades[i]`.
- **Rationale**: FR-002 and FR-026 both describe this as "the same
  mechanism that already varies pink-sand grains," just reinterpreted per
  element family — i.e., the *simulation* doesn't need to know it now has
  three color ramps, only the renderer does. This keeps `src/sim/*` free of
  any color/palette concept (matching 001's own note that "exact palette is
  a rendering detail, not a simulation one") and means zero changes to
  `shade.ts`'s tested contract.
- **Alternatives considered**: Parameterize `randomShade(element)` and
  return element-specific ranges from `sim/`— rejected, it would leak a
  rendering concern (color ramps) into the framework-free sim core for no
  behavioral benefit, since the sim never reads a shade's numeric value for
  any decision (only whether the cell is occupied).

## 7. Performance budget with three elements and the `moved` buffer

- **Decision**: Keep 001's grid size (270×160, research.md §2) and
  `putImageData`-per-frame render path unchanged. Budget the new work per
  cell per tick as: one extra array read (`elements[i]` vs. the old single
  `cells[i]`), one `moved` array clear per tick, one `moved` check per cell,
  and (only for water cells) up to two extra neighbor reads for the
  sideways case. None of this changes the asymptotic cost (still one pass
  over `width * height` cells) or adds any allocation.
- **Rationale**: SC-006/FR-028's worst case — the play area entirely filled
  with actively flowing water — is exactly the case this design was built
  for: every cell is visited once, does a handful of integer comparisons,
  and at most one swap/move. If profiling later shows this case dips below
  30fps, the spec's own fallback (Assumptions, inherited from 001) is to
  shrink the grid, not to add complexity to the rule set.
- **Alternatives considered**: Only step a "dirty region" bounding box
  instead of the full grid — rejected as premature optimization; not
  needed to hit the 30–60fps target at this grid size per 001's existing
  headroom, and would add real complexity (tracking and merging dirty
  rects) for a problem that doesn't yet exist.

## 8. Painting priority (brush overwrite rules)

- **Decision**: `applyBrush` for `tool === 'sand'` or `tool === 'dirt'`
  writes into a footprint cell when `elements[i] === EMPTY OR
  elements[i] === WATER` (the powder simply takes the cell, discarding
  whatever water shade was there — no swap, no conservation requirement,
  since this is a drawing action, not a simulation tick). `tool === 'water'`
  writes only when `elements[i] === EMPTY`. `tool === 'eraser'` always
  writes `EMPTY` regardless of current contents.
- **Rationale**: This is FR-021/FR-022 directly. Keeping "water losing to a
  powder brush" a hard overwrite (not a search for a place to push the
  water) matches the spec's Assumptions ("Water displaced by a powder brush
  is simply removed rather than pushed elsewhere") and keeps `applyBrush` a
  simple per-cell predicate with no neighbor-search logic, unlike `step()`'s
  swap rule.
- **Alternatives considered**: Route brush-time powder-over-water through
  the same swap primitive `step()` uses (push the water to the nearest open
  cell) — rejected per the spec's explicit assumption and because it would
  make a single brush stroke's cost depend on how much empty space exists
  nearby, unlike every other brush operation which is O(footprint size).

## 9. Toolbar layout for five element/tool buttons plus clear

- **Decision**: Group the three element buttons (🩷 💧 💜) in their own
  flex container with tighter internal spacing than the gap separating that
  group from 🧽/🗑️/brush-size controls, so the grouping is visual (spacing +
  a subtle shared background/border) rather than needing any text label.
  The active button (one of the three elements, or the eraser) gets a
  distinct visual state (border/scale/glow) reused unchanged from 001's
  existing selected-state styling. If all 8 controls (3 elements + eraser +
  clear + 3 brush sizes) don't fit on one row at a comfortable tap-target
  size on the narrower target viewport, the toolbar wraps to a second row
  via CSS flex-wrap rather than shrinking buttons below a child-finger-sized
  minimum.
- **Rationale**: Directly implements FR-017–FR-019 and FR-025, and the
  spec's own superseding note (SC-006 cap raised from 6 to 8 controls,
  Assumptions: "toolbar growth... if 8 buttons cannot be laid out large
  enough... the layout wraps to a second row rather than shrinking the
  buttons"). No new dependency or layout library is needed — flexbox with
  `flex-wrap: wrap` and a fixed minimum button size is sufficient.
- **Alternatives considered**: A dropdown/palette picker for elements
  instead of three always-visible buttons — rejected, spec requires the
  three element buttons to be simultaneously visible and groupable at a
  glance (FR-018, SC-011); hiding them behind a menu fails "understandable
  without reading" for this age group (constitution Principle II).

## 10. Testing approach

- **Decision**: Extend 001's `vitest`/`node`-environment approach with no
  new test infrastructure. New/updated files: `tests/unit/sim/grid.test.ts`
  (updated for `elements`/`shades`/`moved`), `tests/unit/sim/step.test.ts`
  (extended with water fall/diagonal/sideways/rest, powder-sinks-through-
  water swap, powder-rests-on-powder, water-never-displaces-powder,
  water-never-rises, and element-conservation cases), and
  `tests/unit/sim/brush.test.ts` (extended with the painting-priority matrix
  from §8). No component/browser tests are added, matching constitution
  Principle V and 001's precedent.
- **Rationale**: Every new rule in FR-029 (water falling/spreading/leveling,
  powders sinking, water-not-displacing-powders, purple-dirt-piles-like-
  sand, element conservation) is a pure function of grid state before/after
  one or more `step()` calls — exactly what 001 already proved is testable
  without a DOM.
- **Alternatives considered**: None — this is a continuation of a
  constitution-mandated, already-validated approach, not a new choice.

All Technical Context unknowns are resolved; nothing carries forward to
Phase 1 as unresolved. No spec-level `[NEEDS CLARIFICATION]` markers exist
in `spec.md` (they were already resolved in its Clarifications section), so
no clarification-avoidance decisions are recorded here beyond the
implementation-technology choices above.
