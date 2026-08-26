# Phase 1 Data Model: Phone Support

Derived from the spec's Key Entities section and research.md's decisions.
This extends `specs/005-sparkle-magic-wand/data-model.md`'s Element / Grid /
Cell / Occupant / PlacedObject / ObjectsState / Tool selection / Brush /
Stroke / Particle / Scene / Glittered state / Glitter grain / Wand coverage
/ Sparkle flash / Celebration burst model. Everything there is reused as-is
except `Grid`'s dimensions, which are no longer fixed for the life of the
page (below). This feature's new entities — Play field, Drawing region,
Visible viewport, On-screen scale, Re-derivation, Toolbar layout — are
detailed in full below.

## Grid (usage change only — shape unchanged)

| Field | Type | Notes |
|---|---|---|
| `width`, `height` | `number` | **No longer fixed at 270×160 for the life of the page.** Set by `createGrid` at mount to the first computed `PlayField`'s `gridWidth`/`gridHeight`, and replaced (via `resizeGrid`, below) whenever a re-derivation occurs. Every existing consumer (`step.ts`, `brush.ts`, `objects.ts`, `wand.ts`, `scenes.ts`) already reads `width`/`height` from the `Grid` instance it's given rather than from a module-level constant, so none of them need to change. |
| `elements`, `shades`, `moved`, `hues`, `glitter` | `Uint8Array` | Unchanged shape and meaning; sized to the current `width * height`, exactly as `createGrid` already does. |

**Validation rules**:
- At any moment, exactly one `Grid` instance is live in `PlayArea.svelte`
  (module-scope, reassigned on re-derivation) — there is never a "resize in
  progress" state visible to the simulation; a re-derivation is an atomic
  swap from one fully-formed `Grid` to another (research.md §5).
- `CELL_BUDGET = GRID_WIDTH * GRID_HEIGHT = 43,200` (research.md §11) bounds
  `width * height` for every `Grid` this feature ever creates, on every
  supported viewport (FR-007).

## Play field (new)

The grid of cells being simulated, now a function of the drawing region
rather than a fixed 270×160 (FR-004). Represented at runtime purely by the
live `Grid`'s `width`/`height` plus the on-screen scale below — there is no
separate "PlayField" runtime object; `computePlayField` (a pure function)
is how its dimensions are *decided*, not a type that is stored.

| Concept | Type / Signature | Notes |
|---|---|---|
| `PlayField` | `{ gridWidth: number; gridHeight: number; cellSize: number; displayWidth: number; displayHeight: number }` | Return type of `computePlayField`. `cellSize` may be fractional (research.md §1); `displayWidth = gridWidth * cellSize`, `displayHeight = gridHeight * cellSize` are the canvas's CSS pixel dimensions. |
| `computePlayField` | `(drawingRegionWidth: number, drawingRegionHeight: number, isPhone: boolean) => PlayField` | Pure, no DOM access (constitution Principle V). See research.md §1 for the formula. |

**Validation rules**:
- `gridWidth * gridHeight <= CELL_BUDGET` for every input (FR-007).
- `cellSize >= MIN_CELL_SIZE` (2) always (FR-005); `cellSize >=
  MEDIUM_STROKE_MIN_PX / (2 * BRUSH_RADII.medium + 1)` (≈2.667) whenever
  `isPhone` is `true` (FR-006).
- `gridWidth`, `gridHeight` are both `>= 1` for any positive-area input,
  including the Edge Cases section's "very narrow or very short viewport"
  (a `Math.max(1, ...)` floor prevents a zero-sized or negative grid, which
  would otherwise be reachable if a drawing region collapsed toward zero on
  either axis).
- `displayWidth / drawingRegionWidth >= 0.90` and `displayHeight /
  drawingRegionHeight >= 0.90` for every representative viewport in the
  test table (FR-001) — a direct consequence of `floor` losing less than
  one cell width/height, verified by the test table rather than asserted
  inside the function itself.

## Drawing region (new)

The part of the visible screen available to the play area once the
toolbar has taken its space (spec Key Entities). Represented at runtime by
`PlayArea.svelte`'s `container` element's `clientWidth`/`clientHeight` —
already correct by construction because the container's CSS is `flex: 1;
min-width: 0; min-height: 0` inside `App.svelte`'s toolbar-aware flex
layout (research.md §7). Not a named type in `layout.ts` — it is simply the
two numbers passed as `computePlayField`'s first two arguments.

**Validation rules**:
- Always non-negative; can be zero only in a degenerate pre-mount state
  (before `container` has been laid out), which `PlayArea.svelte`'s
  `onMount` ordering (measure only after the DOM has painted once) avoids
  in practice.

## Visible viewport (new)

The part of the browser window actually visible to the child, excluding
collapsible browser chrome (spec Key Entities). Represented at runtime by
`window.visualViewport.width`/`.height`, falling back to
`window.innerWidth`/`innerHeight` (research.md §8).

| Concept | Type / Signature | Notes |
|---|---|---|
| `isPhoneSized` | `(viewportWidth: number, viewportHeight: number) => boolean` | Pure. `true` iff `Math.min(viewportWidth, viewportHeight) <= PHONE_MAX_SHORT_SIDE` (480). |

**Validation rules**:
- Computed fresh on every debounced resize (research.md §4), never cached
  across a resize, so an in-session transition from a phone-sized to a
  non-phone-sized viewport (e.g. a foldable unfolding) is picked up on the
  next settled recompute.

## On-screen scale (extended — no longer integer-only)

How many screen pixels one cell occupies (spec Key Entities); this is
`PlayField.cellSize` (above). No longer restricted to whole numbers
(FR-004's "Note" in the spec); realized as the canvas element's CSS
`width`/`height` style while the canvas's `width`/`height` *attributes*
stay equal to the grid's cell dimensions — the same CSS-scales-a-fixed-
resolution-bitmap technique `001` already used for integer scale factors,
which needs no change to support a fractional one.

**Validation rules**:
- `clientToGrid` (in `PlayArea.svelte`) always derives its scale factor from
  the *current* `grid.width`/`grid.height` divided by the canvas's live
  `getBoundingClientRect()` size, never from a cached or constant value
  (research.md §10), so a touch maps to the correct cell at the current
  scale even immediately after a resize or re-derivation (FR-012).

## Re-derivation (new)

The event of the play field taking new dimensions in cells because the
drawing region changed shape substantially (spec Key Entities). Not a
stored type — it is the branch `PlayArea.svelte`'s debounced `resize()`
takes when the newly computed `gridWidth`/`gridHeight` differ from the
current `Grid`'s (research.md §4).

| Function | Signature | Notes |
|---|---|---|
| `resizeGrid` | `(oldGrid: Grid, newWidth: number, newHeight: number) => { grid: Grid; offsetX: number; offsetY: number }` | New, in `src/sim/resize.ts`. Pure — allocates a fresh `Grid` via `createGrid`, copies every non-`OBJECT` cell's `elements`/`shades`/`hues`/`glitter` from `oldGrid` at a fixed bottom-centre-anchored offset, dropping cells that fall outside the new bounds. Never touches `oldGrid`. See research.md §5. |

**State transitions** (grid-level):

| From | Event | To |
|---|---|---|
| `Grid` at `(w, h)`, resize computes same `(w, h)` | non-re-deriving resize | same `Grid` instance, unchanged contents; only the canvas's CSS display size changes — FR-025 |
| `Grid` at `(w, h)`, resize computes different `(w', h')` | re-derivation | new `Grid` instance at `(w', h')`, contents carried via `resizeGrid`'s offset — FR-026 |
| any `Grid`, mid-drag | re-derivation occurs | in-progress stroke ends cleanly (`drawing = false`, `lastGridPos = null`), never continuing across the swap — FR-028 |
| any `Grid` | re-derivation occurs | `tool`/`brushSize` (owned by `App.svelte`, not `Grid`) are untouched — FR-028 |
| any `Grid`, objects present | re-derivation occurs | each `PlacedObject` whose *entire* offset footprint fits the new bounds is kept at its new `(x + offsetX, y + offsetY)`; any that doesn't fully fit is removed from `ObjectsState` and its footprint is not re-stamped — FR-026, Edge Cases |
| any `Grid` | re-derivation occurs | a loaded scene is never regenerated — carried content is whatever `elements`/`shades`/`hues`/`glitter` already held, hand-drawn or scene-generated alike — FR-029 |

**Validation rules**:
- `resizeGrid`'s offset is uniform across every carried cell — `offsetX =
  round((newWidth - oldGrid.width) / 2)`, `offsetY = newHeight -
  oldGrid.height` — never a per-cell or proportional transform
  (research.md §5).
- A cell is carried if and only if `elements[i] !== OBJECT` at the source
  and its offset destination is in `[0, newWidth) × [0, newHeight)`;
  `OBJECT` cells are always skipped by `resizeGrid` itself (objects are
  repositioned separately by the caller, next row).
- An object is carried if and only if **every** cell of its offset
  footprint (`x + offsetX .. x + offsetX + size - 1`, `y + offsetY .. y +
  offsetY + size - 1`) lies in `[0, newWidth) × [0, newHeight)` — partial
  fit is treated as no fit (Edge Cases: "any that no longer fit are removed
  cleanly rather than drawn half off the play area").
- `resize()` is never invoked (and no re-derivation can occur) more often
  than once per `RESIZE_SETTLE_MS` (150) of quiet across all three event
  sources combined (FR-027).

## Toolbar layout (new — verification model, not a runtime type)

Models, for the automated test suite only, whether the toolbar's real CSS
flexbox wrap/rail (research.md §6) fits every control at or above the
minimum touch target for a given viewport, and how much of the viewport it
consumes on the relevant axis.

| Concept | Type / Signature | Notes |
|---|---|---|
| `MIN_TOUCH_TARGET` | `number` (constant, 44) | FR-020's minimum control size; shared with `Toolbar.svelte`'s CSS via a custom property (research.md §6). |
| `computeToolbarLayout` | `(viewportWidth: number, viewportHeight: number, controlCount: number, groupCount: number) => { fits: boolean; controlSize: number; thickness: number }` | Pure. `thickness` is the toolbar's consumed height (portrait wrap) or width (landscape rail) at the computed `controlSize`; `fits` is `false` only if even the minimum control size can't make every control fit within the viewport's relevant axis without the toolbar's own thickness. |

**Validation rules**:
- `controlSize >= MIN_TOUCH_TARGET` whenever `fits` is `true` (FR-020) —
  `computeToolbarLayout` never reports a fit achieved by shrinking below the
  minimum.
- For every phone-sized entry in the representative viewport table,
  `fits === true` and the resulting drawing region (`viewport minus
  thickness` on the appropriate axis) still satisfies `PlayField`'s FR-001/
  FR-002 fill floors when passed through `computePlayField` (FR-035's
  combined toolbar-fit-and-play-area-fill assertion).
- `controlCount` and `groupCount` are literal constants in the test file
  mirroring `Toolbar.svelte`'s actual control/group count (14 controls, 5
  groups at the time of writing) — not derived from the component, since
  `Toolbar.svelte` is a `.svelte` file the no-DOM test suite does not
  import (constitution Principle V).

## Superseded / extended contracts

- `001-falling-pink-sand`'s **Play field** entity (fixed 270×160,
  `computeCanvasSize` picking only an integer cell size) is superseded by
  the `PlayField`/`computePlayField` model above (FR-004, spec's own
  Superseded requirements section).
- `001`'s "On-screen scale... restricted to whole numbers" characterization
  is superseded: scale may now be fractional (FR-004's Note).
- `001`'s exact-preservation-on-every-resize characterization is superseded
  *only* for re-derivations, per the Re-derivation state-transition table
  above (FR-025, FR-026) — exact preservation still holds for every
  viewport change that doesn't change `gridWidth`/`gridHeight`.
- No entity 001–005 already defined (`Element`, `Cell`, `Occupant`,
  `PlacedObject`, `ObjectsState`, `BrushSize`, `Brush`, `Stroke`, `Scene`,
  `SceneRegion`/`SceneRegions`, `Glittered state`, `Glitter grain`, `Wand
  coverage`, `Sparkle flash`, `Celebration burst`) changes meaning, shape,
  or validation rules in this feature beyond `Grid.width`/`Grid.height` no
  longer being fixed for the life of the page, and `ObjectsState` entries
  being repositionable by a re-derivation (both already covered above).
