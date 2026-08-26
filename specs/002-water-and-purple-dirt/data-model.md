# Phase 1 Data Model: Water and Magic Purple Dirt

Derived from the spec's Key Entities section and research.md's data-structure
decisions. This extends `specs/001-falling-pink-sand/data-model.md`'s Grid /
Cell / Grain / Tool selection / Brush / Stroke model to three elements; only
what changes or is new is detailed in full, everything else is inherited
unchanged. All types live in `src/sim/types.ts` unless noted; the grid
remains a set of plain typed arrays, not a class, to stay allocation-free
(constitution Principle IV).

## Element

What a cell holds. A small integer, not a string, so it can live in a
`Uint8Array` (research.md §2).

| Constant | Value | Meaning |
|---|---|---|
| `EMPTY` | `0` | No occupant. |
| `SAND` | `1` | Pink sand (unchanged from 001). |
| `WATER` | `2` | Water — new. |
| `DIRT` | `3` | Magic purple dirt — new. |

**Validation rules**:
- A cell's element never changes as a side effect of `step()`; it only
  changes via `setCell`/`clearGrid` (the drawing tools) — FR-003.
- `isPowder(e)` is true for `SAND`/`DIRT`; `isLiquid(e)` is true for
  `WATER`. Every density comparison in `step()`/`brush.ts` goes through
  these two predicates (research.md §2).

## Grid

The fixed-size rectangular field of cells backing the play area — same
dimensions and lifetime rules as 001 (270×160 default, fixed for the page's
life), but now backed by two logical arrays plus one scratch array instead
of one.

| Field | Type | Notes |
|---|---|---|
| `width` | `number` | Cells across. Unchanged from 001. |
| `height` | `number` | Cells down. Unchanged from 001. |
| `elements` | `Uint8Array` | Length `width * height`, row-major (`index = y * width + x`). Holds one of the Element values above. Replaces 001's single `cells` field. |
| `shades` | `Uint8Array` | Same length/indexing as `elements`. Meaningful only where `elements[i] !== EMPTY`; holds a `1–255` shade byte assigned at creation and carried with the cell on every move/swap (FR-002). |
| `moved` | `Uint8Array` | Same length/indexing. Scratch-only: cleared to all-`0` at the start of every `step()` call and used solely to ensure each cell moves at most once per tick (research.md §4). Not logical state — never read by brushes, rendering, or tests except indirectly via `step()`'s output. |

**Validation rules**:
- `width`/`height` are set once at creation and never reassigned (inherited
  from 001).
- Every read/write of `elements`/`shades`/`moved` checks
  `0 <= x < width` and `0 <= y < height`; out-of-bounds reads return `EMPTY`
  and writes are no-ops (inherited from 001's `getCell`/`setCell` contract,
  now split into `getElement`/`getShade`/`setCell`).
- `elements[i] === EMPTY` implies `shades[i]` is not meaningful (it may hold
  a stale value from a cell that was previously occupied and is not
  required to be reset to `0`; nothing reads it while the cell is empty).

**State transitions**: none at the Grid level — it is a container.
Transitions happen per-Cell (below).

## Cell

One position in the grid — the same concept as 001's Cell, now with three
possible occupant kinds instead of one.

| Logical state | Encoding |
|---|---|
| Empty | `elements[i] === EMPTY` |
| Occupied by element `e` with shade `s` | `elements[i] === e`, `shades[i] === s` |

**State transitions** (one simulation tick, applied bottom row to top row,
each cell moving/swapping at most once — research.md §4):

Powder cell (`isPowder(elements[i])`):
1. **Fall**: cell directly below is empty → move (copy `(element, shade)`
   down, source becomes `EMPTY`) — FR-011 (inherits 001 FR-006).
2. **Sink**: cell directly below holds water → swap: the powder's
   `(element, shade)` and the water's `(element, shade)` exchange slots —
   FR-013.
3. **Slide**: blocked straight down (occupied by another powder, or
   off-grid), but below-left and/or below-right is empty or water → move
   (or swap, per case 2's rule) into one such cell, random choice if both
   qualify — FR-014 (inherits 001 FR-007's tie-break rule).
4. **Rest**: below, below-left, and below-right are all
   powder-occupied-or-off-grid → no change — FR-011 (inherits 001 FR-008).

Water cell (`isLiquid(elements[i])`):
1. **Fall**: cell directly below is empty → move down — FR-004.
2. **Diagonal slide**: blocked straight down (occupied by anything, or
   off-grid), but below-left and/or below-right is empty → move into one,
   random choice if both qualify — FR-005. (Water never swaps down through
   a powder — FR-009 — so an occupied-by-powder cell below/diagonally-below
   blocks water exactly like an occupied-by-water or off-grid cell does.)
3. **Sideways spread**: blocked down and diagonally down, but left and/or
   right (same row) is empty → move into one, random choice if both
   qualify — FR-006.
4. **Rest**: no empty cell below, diagonally below, or to either side —
   FR-007.

Cross-cutting rules:
- A tick never creates, destroys, or duplicates a cell's `(element, shade)`
  pair — every transition above is either a move (one source, one
  previously-empty destination) or a swap (two occupied cells trade
  contents) — FR-003, SC-005.
- Off-grid neighbors (below the bottom row, left of column 0, right of the
  last column) are always treated as blocked, never as empty — this is what
  produces the closed-box floor and walls for both families (FR-008,
  inherited from 001 FR-010).
- No transition ever assigns a cell to a row above the one it already
  occupies — trivially true for powders (only cases 1–4 above exist, none
  move upward) and true for water by construction of which offsets are
  tried (research.md §5) — FR-010, SC-015.

## Occupant (generalizes 001's "Grain")

One unit of pink sand, water, or magic purple dirt. Not a standalone object
— its state is the `(element, shade)` pair carried in a matching slot of
`Grid.elements`/`Grid.shades`; "the occupant" is that pair, and it moves or
swaps by being copied (or exchanged) between indices.

| Field | Type | Notes |
|---|---|---|
| `element` | `Element` | Assigned once, when the cell is drawn into (brush) or produced by a swap; never changes except by moving/swapping the whole pair (FR-003). |
| `shade` | `number` (1–255) | Assigned once, at creation, by `randomShade()` (unchanged from 001 — research.md §6); the render layer maps `(element, shade)` to a concrete color from that element's palette. Preserved unchanged across every subsequent move or swap (FR-002). |

**Validation rules**: `shade` is assigned only when an occupant is newly
placed by a brush (never by `step()`, which only moves/swaps existing
pairs); `randomShade()` never returns `0`.

## Powder (family)

Pink sand and magic purple dirt. Both fall, slide, and rest under the
identical cell-transition rules above (FR-011, FR-016 — magic purple dirt is
"purple sand," not a distinct movement profile). Powders rest on other
powders regardless of which of the two elements — a `SAND` cell blocks a
`DIRT` cell above it exactly as another `DIRT` cell would, and vice versa
(FR-012). Powders sink through water (FR-013, FR-014) but never through each
other.

## Liquid (family)

Water is the only liquid. Lighter than every powder (powders sink through
it, it never sinks through or displaces a powder — FR-009). Never moves
upward (FR-010, SC-015). Spreads sideways only when blocked from moving down
or diagonally down (FR-006), which is what produces leveling.

## Tool selection

UI-facing state — which of the three elements or the eraser is active, plus
brush size. Same shape as 001, with `Tool` widened.

| Field | Type | Notes |
|---|---|---|
| `tool` | `'sand' \| 'water' \| 'dirt' \| 'eraser'` | Default `'sand'` (FR-020, inherits 001 FR-023). |
| `brushSize` | `'small' \| 'medium' \| 'large'` | Default `'medium'`, unchanged from 001; shared across all elements and the eraser (spec Assumptions). |

**Validation rules**:
- Exactly one tool is active at a time (FR-019).
- `tool` and `brushSize` persist unchanged across a 🗑️ clear-all (FR-024)
  and across tool switches (spec Assumptions, "Brush sizes are shared").

## Brush

The footprint applied around the pointer position, sized by `brushSize` —
same circular footprint and radii as 001 (research.md §7 there), now with an
element-aware overwrite rule instead of a single "only into empty" rule.

**Painting priority** (research.md §8):

| `tool` | Writes into a footprint cell when... |
|---|---|
| `'sand'` / `'dirt'` | `elements[i] === EMPTY` **or** `elements[i] === WATER` (FR-021) |
| `'water'` | `elements[i] === EMPTY` only (FR-022) |
| `'eraser'` | always (FR-023) |

**Validation rules**: footprint application clips silently to grid bounds
(inherited from 001); a powder brush overwriting a water cell is a direct
replacement (new `(element, shade)` written, the water's old shade
discarded) — not a swap, and not required to conserve the water count,
since drawing is not a simulation tick (spec Assumptions: "Water displaced
by a powder brush is simply removed rather than pushed elsewhere").

## Stroke

Unchanged from 001 — a press-drag-release interaction represented
transiently in `PlayArea.svelte`'s pointer-event handlers, Bresenham-
interpolated between grid positions so `applyBrush` is called with no gaps
along a fast drag. Strokes never touch `step()`'s rules directly; they only
call `applyBrush`/`applyBrushLine`, which write/clear cells, and the next
simulation tick picks up any newly-placed occupants.
