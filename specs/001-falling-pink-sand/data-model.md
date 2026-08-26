# Phase 1 Data Model: Falling Pink Sand

Derived from the spec's Key Entities section and research.md's data-structure
decisions. All types live in `src/sim/types.ts` unless noted; the grid itself
is a plain typed array, not a class, to stay allocation-free (constitution
Principle IV).

## Grid

The fixed-size rectangular field of cells backing the play area.

| Field | Type | Notes |
|---|---|---|
| `width` | `number` | Cells across. Default 270 (research.md §2). Fixed for the page's lifetime (FR-005). |
| `height` | `number` | Cells down. Default 160. |
| `cells` | `Uint8ClampedArray` | Length `width * height`, row-major (`index = y * width + x`). `0` = empty; `1–255` = grain present, value is the grain's shade index (research.md §1). |

**Validation rules**:
- `width` and `height` are set once at grid creation and never reassigned
  (FR-005, FR-033).
- Every read/write must check `0 <= x < width` and `0 <= y < height`; the
  simulation and brush code never index outside these bounds (FR-009, FR-020).

**State transitions**: none at the Grid level — it is a container. Transitions
happen per-Cell (see below).

## Cell

One position in the grid; conceptually either empty or occupied by a single
grain. Not a separate object — represented by one byte in `Grid.cells` at a
given `(x, y)` (research.md §1).

| Logical state | Encoding |
|---|---|
| Empty | `cells[i] === 0` |
| Occupied by a grain with shade `s` (`1 <= s <= 255`) | `cells[i] === s` |

**State transitions** (one simulation tick, applied bottom-up per research.md §4):

1. **Fall**: occupied cell, cell directly below is empty → move (copy value
   down, zero the source) — FR-006.
2. **Slide**: occupied cell, cell below is occupied/off-grid, but
   below-left and/or below-right is empty → move into one available
   diagonal (random choice if both available) — FR-007.
3. **Rest**: occupied cell, below/below-left/below-right all
   occupied-or-off-grid → no change — FR-008.
4. Cells below the bottom row or outside `[0, width)` are treated as
   "off-grid" = never empty, producing the closed-box floor/walls (FR-010).

A tick never creates, destroys, or duplicates a grain — every transition is a
move of the same byte value (FR-009).

## Grain

One unit of pink sand. Not a standalone object — its only state is the shade
byte carried in a `Grid.cells` slot; "the grain" is the value, and it moves
by being copied to a new index and zeroed at the old one (FR-012).

| Field | Type | Notes |
|---|---|---|
| shade | `number` (1–255, stored in the cell byte) | Assigned once, at creation (brush application), from a small fixed pink palette or narrow HSL range (research.md; exact palette is a rendering detail, not a simulation one). Preserved unchanged across every subsequent move. |

**Validation rules**: shade is assigned only when a grain is created (sand
tool writes a nonzero byte into an empty cell); it is never reassigned by the
simulation step, only copied.

## Tool selection

UI-facing state: which tool is active and which brush size is active. Lives
in Svelte 5 `$state` in `App.svelte` / passed to `Toolbar.svelte` and
`PlayArea.svelte` — not part of the grid.

| Field | Type | Notes |
|---|---|---|
| `tool` | `'sand' \| 'eraser'` | Default `'sand'` (FR-023). |
| `brushSize` | `'small' \| 'medium' \| 'large'` | Default `'medium'` (FR-023). |

**Validation rules**:
- Exactly one tool and one brush size are active at a time.
- Both persist unchanged across a 🗑️ clear-all (FR-028) and across tool
  switches (FR-026).

## Brush

The footprint applied around the pointer position by the active tool, sized
by `brushSize`. A pure function of `brushSize`, not stored state.

| brushSize | radius (cells) | diameter (cells) |
|---|---|---|
| small | 2 | 5 |
| medium | 5 | 11 |
| large | 9 | 19 |

Footprint test: cell `(x, y)` relative to brush center `(cx, cy)` is inside
the brush iff `(x-cx)^2 + (y-cy)^2 <= radius^2` (research.md §7).

**Validation rules**: footprint application clips silently to grid bounds
(FR-020) — cells outside `[0,width) x [0,height)` are simply skipped, never
written.

## Stroke

A press-drag-release interaction: a continuous sequence of pointer positions
along which the active tool is applied. Represented transiently in
`PlayArea.svelte`'s pointer-event handlers — not persisted state.

| Field | Type | Notes |
|---|---|---|
| `active` | `boolean` | True between `pointerdown` (with capture) and `pointerup`/`pointercancel`/pointer-left-window. |
| `lastGridPos` | `{x: number, y: number} \| null` | Last cell position the brush was applied at; used to Bresenham-interpolate to the new position on the next `pointermove` (research.md §6, FR-014). |

**Transitions**:
- `pointerdown` inside the play area → `active = true`, apply brush once at
  the down position, set `lastGridPos`.
- `pointermove` while `active` → interpolate from `lastGridPos` to the new
  position, applying the brush along the line; update `lastGridPos`.
- `pointerup` / `pointercancel` / pointer capture lost → `active = false`,
  `lastGridPos = null` (FR-015; covers "released outside the window").

Strokes never touch the simulation's fall/slide/rest rules directly — they
only call `applyBrush`, which writes/clears cells; the next simulation tick
picks up any newly-placed grains.
