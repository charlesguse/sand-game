# Phase 1 Data Model: Rainbow and Unicorn Magic

Derived from the spec's Key Entities section and research.md's decisions.
This extends `specs/002-water-and-purple-dirt/data-model.md`'s Element /
Grid / Cell / Occupant / Powder / Liquid / Tool selection / Brush / Stroke
model; only what changes or is new is detailed in full, everything else
(the powder and liquid transition tables, `Uint8Array` encoding rationale,
off-grid-is-always-blocked rule, etc.) is inherited unchanged. All grid/
element types live in `src/sim/types.ts`; the new object/particle concepts
live in `src/sim/objects.ts` and `src/lib/particles.ts` (research.md §1–§10).

## Element

Extends 002's table with one new *element* (a real, falling occupant) and
one new *block marker* (never falls, never converts, not itself an
element an "element" the way the spec's Key Entities section uses the
term, but reusing the same `Uint8Array` encoding for uniform density
checks in `step.ts` — research.md §1).

| Constant | Value | Meaning |
|---|---|---|
| `EMPTY` | `0` | No occupant. Unchanged from 002. |
| `SAND` | `1` | Pink sand. Unchanged from 002. |
| `WATER` | `2` | Water. Unchanged from 002. |
| `DIRT` | `3` | Magic purple dirt. Unchanged from 002. |
| `RAINBOW_SAND` | `4` | New — a powder, see below. |
| `OBJECT` | `5` | New — marks a cell inside any object's footprint. Not a powder, not a liquid; blocks movement into it exactly like an off-grid cell (research.md §1). Never itself moved, converted, or painted by a brush. |

**Validation rules**:
- `isPowder(e)` now covers `SAND`, `DIRT`, **and** `RAINBOW_SAND` — all
  three fall/slide/rest/sink identically (FR-019). `isLiquid(e)` is
  unchanged (`WATER` only). Neither predicate is true for `OBJECT`, so
  `step()`'s existing `if (isPowder) ... else if (isLiquid) ... ` chain
  no-ops on `OBJECT` cells with no code change (FR-007).
- A cell's element never changes as a side effect of `step()` itself
  (inherited FR-003 from 002, still true — `step()` only moves/swaps
  existing values). The one sanctioned type change in this feature,
  rainbow conversion, happens in the separate `applyRainbowConversions`
  pass, not inside `step()` (FR-014, FR-015; research.md §5).
- `OBJECT` cells are never written by `applyBrush`/`applyBrushLine`
  (`'sand'|'water'|'dirt'` tools skip a cell whose current element is
  `OBJECT` — it is neither `EMPTY` nor `WATER`, so the existing painting-
  priority predicates inherited from 002 already exclude it with no
  change) and are never converted by a rainbow (§ conversion zone check
  below explicitly excludes `OBJECT`).

## Grid

Extends 002's `Grid` with one more parallel array.

| Field | Type | Notes |
|---|---|---|
| `width`, `height` | `number` | Unchanged from 002. |
| `elements` | `Uint8Array` | Unchanged shape; now ranges over 6 values instead of 4 (`EMPTY`/`SAND`/`WATER`/`DIRT`/`RAINBOW_SAND`/`OBJECT`). |
| `shades` | `Uint8Array` | Unchanged from 002. Meaningful for `SAND`/`WATER`/`DIRT`; **not** used for `RAINBOW_SAND` (which is colored from `hues` instead — research.md §7) and not meaningful for `OBJECT` (objects are colored by kind, not by a per-cell byte). |
| `moved` | `Uint8Array` | Unchanged from 002 — cleared and used by `step()` exactly as before. `OBJECT` cells are never marked `moved` (they're never a move source or destination). |
| `hues` | `Uint8Array` | **New.** Same length/indexing as the others. Meaningful only where `elements[i] === RAINBOW_SAND`; holds a `0–255` byte mapped to a hue angle by the render layer (research.md §7). Assigned a fresh value when a cell is converted (`applyRainbowConversions`) and advanced only when the cell is moved/swapped by `step()`'s move primitives (research.md §4) — otherwise left untouched, which is what makes a settled grain's hue stable (FR-021, SC-021). |

**Validation rules**:
- `createGrid` zero-initializes `hues` along with the other three arrays
  (inherited contract, extended to the new field).
- `elements[i] === OBJECT` cells never have meaningful `shades[i]` or
  `hues[i]` values — nothing reads either for an `OBJECT` cell.
- Every read/write still goes through `inBounds` (unchanged from 002);
  out-of-bounds is always treated as blocked, never as empty — which is
  also, not coincidentally, how an in-bounds `OBJECT` cell now behaves too
  (research.md §1).

## Cell

Extends 002's transition tables. The **powder** and **liquid** transition
tables are unchanged in *shape* from 002 (fall → sink/slide → rest for
powders; fall → diagonal → sideways → rest for liquids) except that every
place 002 said "occupied" or "not empty" now additionally includes `OBJECT`
cells and `RAINBOW_SAND` is a third member of the powder family alongside
`SAND`/`DIRT`. Concretely:

- A powder's **fall** target (`elements[belowIndex] === EMPTY`) is
  unaffected by `OBJECT` — an `OBJECT` cell below is not `EMPTY`, so fall
  is blocked exactly as it would be by another powder (FR-009).
- A powder's **sink** target (`isLiquid(elements[belowIndex])`) is
  unaffected — `OBJECT` is not a liquid, so no swap is attempted into it.
- A powder's **slide** targets (`elements[...] === EMPTY ||
  isLiquid(elements[...])`) exclude `OBJECT` for the same reason — a grain
  resting on an object's shoulder with empty diagonal cells slides off
  exactly as it would off another powder pile (FR-010, User Story 3
  Acceptance Scenario 2).
- A liquid's **fall**/**diagonal**/**sideways** targets (all
  `elements[...] === EMPTY`) exclude `OBJECT` identically — water rests on
  an object and spreads off its sides rather than passing through
  (FR-011).
- `RAINBOW_SAND` participates in all four powder transitions identically to
  `SAND`/`DIRT` (FR-019) — `isPowder(RAINBOW_SAND) === true`, and nothing
  in `step.ts` branches on *which* powder it is.
- `OBJECT` cells are **never visited as a move source**: `step()`'s main
  scan calls `stepPowder`/`stepLiquid` only when `isPowder(element)` or
  `isLiquid(element)` is true for the cell at `(x, y)`; `OBJECT` matches
  neither, so the scan's `if/else if` simply does nothing for that cell —
  it is inert with respect to `step()`, which is exactly FR-007 (objects
  never fall, settle, or move on their own).

**Rainbow-sand-specific transition** (applied by `applyRainbowConversions`,
a separate pass — research.md §5 — not part of the table above):

| Current element | In a rainbow's zone? | Result |
|---|---|---|
| `SAND`, `DIRT`, or `WATER` | Yes | Becomes `RAINBOW_SAND`; `hues[i]` gets a fresh start value; `shades[i]` is left as-is but no longer read (FR-014). |
| `RAINBOW_SAND` | Yes | No change — already converted, idempotent (FR-016). |
| `OBJECT` | Yes | No change — objects are never converted (FR-017). |
| `EMPTY` | Yes | No change — nothing to convert. |
| Anything | No (outside every rainbow's zone) | No change (FR-017, SC-003). |

Cross-cutting rules (extend 002's, unchanged in spirit):
- A tick never creates, destroys, or duplicates an `(element, shade)` pair
  via `step()` — still true, unmodified from 002. Rainbow conversion is the
  **one** sanctioned type-in-place change, applied by a separate function,
  and it also creates/destroys nothing — the same cell keeps its identity,
  only its `element` (and `hues`) fields change (FR-015, SC-005 as amended
  by this spec's Superseded-requirements section).
- No transition ever assigns a cell to a row above the one it already
  occupies for powders/liquids (unchanged from 002); `OBJECT` cells don't
  have rows that change at all, by construction (§ Grid above).

## Occupant

Extends 002's Occupant (`element` + `shade`) with the new `hues` field,
meaningful only for `RAINBOW_SAND`:

| Field | Type | Notes |
|---|---|---|
| `element` | `Element` | Unchanged contract. Assigned once, changed only by conversion (rainbow) or a move/swap (never a bare re-assignment) elsewhere. |
| `shade` | `number` (1–255) | Unchanged contract for `SAND`/`WATER`/`DIRT`. For a `RAINBOW_SAND` cell, this byte is inert leftover from whatever it was before conversion — never read by rendering or `step()` once the cell is `RAINBOW_SAND`. |
| `hue` | `number` (0–255) | **New**, meaningful only when `element === RAINBOW_SAND`. Set fresh at conversion time. Advanced by a fixed step (mod 256) only when the cell is the destination of a move or swap this tick (research.md §4); otherwise unchanged. Maps to a hue angle (`hue / 255 × 360°`) at render time (research.md §7). |

## PlacedObject (new)

One placed 🌈 rainbow or 🦄 unicorn. Lives in `ObjectsState`, not in the
grid's per-cell arrays — the grid only records *that* a cell is blocked
(`OBJECT`), not *which* object blocks it (research.md §1).

| Field | Type | Notes |
|---|---|---|
| `id` | `number` | Monotonically increasing, assigned from `ObjectsState.nextId` at placement. Used only to distinguish objects in code/tests, never rendered or exposed to the player. |
| `kind` | `'rainbow' \| 'unicorn'` | Which behavior applies — conversion (rainbow) or celebration (unicorn). Determines which emoji glyph is drawn. |
| `x`, `y` | `number` | Footprint's top-left grid cell, after edge-nudging (FR-004). Fixed for the object's lifetime (FR-007) — never reassigned by anything in this feature. |
| `size` | `number` | Footprint side length in cells; `OBJECT_FOOTPRINT_SIZE` (research.md §6) for every object of either kind. |

**Validation rules**:
- `x`/`y` are chosen at placement so `[x, x + size)` and `[y, y + size)`
  both lie within `[0, width)`/`[0, height)` — FR-004, "never refused,
  clipped, or produce a message."
- An object's footprint cells are exactly `{(px, py) : x <= px < x+size,
  y <= py < y+size}`. Its **zone** (used identically for rainbow conversion
  and unicorn touch, research.md §2) is every in-bounds cell at Chebyshev
  distance exactly 1 from that footprint rectangle (the one-cell ring
  around it), excluding the footprint itself.
- `x`/`y`/`size` never change after placement; an object is removed and a
  new one placed rather than an existing one ever being moved or resized
  (FR-007, FR-003).

## ObjectsState (new)

Per-play-area container for all live objects, owned by `PlayArea.svelte`
alongside its `Grid` (created once, same lifetime).

| Field | Type | Notes |
|---|---|---|
| `rainbows` | `PlacedObject[]` | Kind `'rainbow'`, oldest-first order. Length never exceeds 3 (FR-005) — `placeObject` evicts index `0` (oldest) before appending when already at 3. |
| `unicorns` | `PlacedObject[]` | Kind `'unicorn'`, same shape and cap, independent of `rainbows` (FR-005: "reaching the cap for one type MUST NOT affect the other type's count"). |
| `nextId` | `number` | Incremented on every `placeObject` call; supplies each new `PlacedObject.id`. |

**State transitions**:
- `placeObject(grid, state, kind, cx, cy)`: nudges `(cx, cy)` so the
  footprint fits on-grid, evicts-and-removes the oldest object of `kind` if
  that list is already at length 3 (calling `removeObject`, below, so the
  vacated cells are correctly released per the overlap rule), stamps every
  footprint cell to `OBJECT` (discarding whatever was there — FR-006), and
  pushes the new `PlacedObject` onto the matching list.
- `removeObject(grid, state, obj)`: removes `obj` from its list; for each of
  its footprint cells, sets it back to `EMPTY` **only if** no remaining
  object (in either list) still covers that cell, otherwise leaves it as
  `OBJECT` (the "objects overlap" edge case — spec Edge Cases: "placing an
  object on top of an existing object... allowed... both objects remain
  solid and active"). Anything that was resting on a now-`EMPTY` cell
  resumes falling on the next `step()` call, with no special-casing needed
  (the cell is just `EMPTY` again) — FR-012.
- `eraseObjectsInBrush(grid, state, cx, cy, radius)`: for every live object
  whose footprint contains at least one cell inside the brush's circular
  coverage (same footprint math as `brush.ts`'s `forEachFootprintCell`,
  research.md §9), calls `removeObject` for that object in full — never a
  partial footprint (FR-031).
- `clearObjects(state)`: sets `rainbows`/`unicorns` to empty arrays. Called
  by clear-all alongside the existing `clearGridState(grid)` (which already
  zeroes every `elements` byte, including `OBJECT` cells) — FR-032.
- No transition ever mutates an existing `PlacedObject`'s `x`/`y`/`size` —
  objects are only ever added to or removed from a list, never edited in
  place (FR-007).

## Tool selection

Extends 002's `Tool` union with the two object tools.

| Field | Type | Notes |
|---|---|---|
| `tool` | `'sand' \| 'water' \| 'dirt' \| 'rainbow' \| 'unicorn' \| 'eraser'` | Default `'sand'`, unchanged. `'rainbow'`/`'unicorn'` are new (FR-001). |
| `brushSize` | `'small' \| 'medium' \| 'large'` | Unchanged from 002. Not applied to object tools — placement always uses the fixed `OBJECT_FOOTPRINT_SIZE`, ignoring `brushSize` entirely (spec Assumptions: "brush sizes do not apply to object tools"). |

**Validation rules**:
- Exactly one tool active at a time, across all six values now (FR-033,
  inherits 002 FR-019).
- Selecting `'rainbow'`/`'unicorn'` does not reset `brushSize`; it is simply
  unused until an element/eraser tool is reselected (spec Assumptions).

## Brush

Unchanged element-painting contract from 002 (`applyBrush`/
`applyBrushLine`, footprint math, painting-priority-by-tool), **except**:
the eraser's whole-object removal (`eraseObjectsInBrush`, above) is called
by the UI layer as a *separate, preceding* step whenever `tool ===
'eraser'`, rather than being folded into `applyBrush` itself
(research.md §9) — `brush.ts`'s exported signatures are unchanged by this
feature. Object tools (`'rainbow'`/`'unicorn'`) never call `applyBrush` at
all; they call `placeObject` directly, once, on press only (research.md §8).

## Stroke

Unchanged from 002 for element/eraser tools. For object tools, a "stroke"
is degenerate by design — `PlayArea.svelte`'s pointerdown handler calls
`placeObject` once and does not enter the `drawing` state, so
`pointermove`'s existing `if (!drawing) return` guard already prevents any
further placement for the rest of that press-drag-release, with no new
per-tool state needed (research.md §8, FR-002).

## Particle (new, UI-layer only — not part of the `Grid`)

A short-lived decorative ✨ or 💖 glyph, drawn over the canvas after
objects. Lives in `src/lib/particles.ts`'s state, entirely outside
`src/sim/*` and the `Grid` (FR-027: particles never occupy cells, block
movement, or change any element/object).

| Field | Type | Notes |
|---|---|---|
| `glyph` | `'✨' \| '💖'` | Which emoji to draw. |
| `x`, `y` | `number` | Pixel (not grid-cell) position, updated each frame as the particle drifts upward. |
| `spawnedAt` | `number` | `performance.now()` timestamp at spawn; drives fade-out and expiry (FR-026). |

**Validation rules**:
- A particle is removed once its age exceeds its lifetime (FR-026, "drift
  upward and fade out completely within a short lifetime").
- The total live count is capped (FR-028); when at cap, spawning a new
  particle either drops the request or retires the oldest particle first —
  either way the cap is never exceeded, and the choice never depends on
  frame rate (i.e. it's a count check, not a timing heuristic).
- Particles are read by the render loop only; nothing in `src/sim/*` ever
  reads or writes `Particle` state, and no grid cell is ever consulted by
  the particle system except indirectly via `isUnicornTouched`'s boolean
  result (research.md §10), which triggers a spawn but carries no grid
  position/element data into the particle itself.
