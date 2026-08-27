# Phase 1 Data Model: Water-Drinking Grass

Derived from the spec's Key Entities section and research.md's decisions.
This extends `specs/006-phone-support/data-model.md`'s Grid / Play field /
Drawing region / Visible viewport / On-screen scale / Re-derivation /
Toolbar layout model (and, transitively, 001–005's Element / Cell /
Occupant / PlacedObject / ObjectsState / Tool selection / Brush / Stroke /
Particle / Scene / Glittered state / Glitter grain / Wand coverage /
Sparkle flash / Celebration burst model). Everything there is reused as-is
except `Grid`'s shape (below) and `Tool`'s value set (below). This
feature's new entities — Grass cell, Root/height, Absorption-and-growth
event, Grass ceilings — are detailed in full below.

## Element (extended)

| Field | Type | Notes |
|---|---|---|
| `GRASS` | `6` (new constant, `src/sim/types.ts`) | Added to the `Element` union alongside `EMPTY`/`SAND`/`WATER`/`DIRT`/`RAINBOW_SAND`/`OBJECT`. |

**Validation rules**:
- A cell still holds at most one element (FR-001, unchanged invariant).
- `GRASS` is neither `isPowder` nor `isLiquid` (`element.ts`, unchanged
  functions) — it is a third, static family. A new `isSolid(e)` helper
  (`isPowder(e) || e === GRASS`) is added for FR-010's sideways-growth
  support check (research.md §1, §4); no existing function's behavior
  changes.

## Grid (extended)

| Field | Type | Notes |
|---|---|---|
| `elements`, `shades`, `moved`, `hues`, `glitter` | `Uint8Array` | Unchanged shape and meaning. `moved[i]` gains one new use this feature: a freshly-grown grass cell has `moved[targetIndex] = 1` set for the remainder of the step that created it, preventing same-step growth cascades (research.md §5) — this is an additional *use* of the existing field, not a shape or meaning change. |
| `grassHeight` | `Uint8Array` (new) | Sized `width * height`. `grassHeight[i]` is cell `i`'s height above its root (0 = the cell is its own root), meaningful only where `elements[i] === GRASS`; undefined/stale for any other element and never read in that case. Saturates at 255 (irrelevant to correctness — every comparison against it is `<= 12`). |
| `grassCooldown` | `Uint8Array` (new) | Sized `width * height`. `grassCooldown[i]` is the number of remaining simulation steps before cell `i` may next attempt to absorb water, meaningful only where `elements[i] === GRASS`. |
| `grassCount` | `number` (new, plain mutable field — not a typed array) | The live count of cells with `elements[i] === GRASS` on this `Grid` instance. Maintained incrementally by `setCell`/`clearGrid` (data-model "Grass cell" section below) and by `resizeGrid`'s copy loop — never recomputed by a full-grid scan. |

**Validation rules**:
- `createGrid(width, height)` allocates `grassHeight`/`grassCooldown` as
  zero-filled `Uint8Array(width * height)` and initializes `grassCount = 0`
  — identical zero-init pattern to every existing `Grid` field.
- `grassCount` always equals the true number of `GRASS` cells in
  `elements` — an invariant maintained by construction (every element
  write that can create or remove a grass cell goes through `setCell`,
  which updates the counter atomically with the write; `clearGrid` and
  `resizeGrid` maintain it directly for their own bulk operations) rather
  than being re-derived by scanning.
- `CELL_BUDGET = 43,200` (spec 006, unchanged) still bounds `width *
  height` for every `Grid` this feature's grass logic ever runs against;
  the grass rules' own per-step cost is `O(1)` per grass cell visited, so
  the existing budget is what keeps FR-031 satisfied, not a new cap.

## Grass cell (new)

A cell holding `GRASS` (spec Key Entities: "a living, static element").
Not a separate runtime object — represented purely by `elements[i] ===
GRASS` plus the three parallel fields (`shades[i]`, `grassHeight[i]`,
`grassCooldown[i]`) at the same index.

| Concept | Type / Signature | Notes |
|---|---|---|
| Creation | via `setCell(grid, x, y, GRASS, shade)` | The **only** way a grass cell is created (brush, scene generation, or the growth rule calling `setCell` itself — research.md §3, §5) — never by direct array mutation elsewhere, so the height/count bookkeeping below always runs. |
| `setCell`'s extended contract | `(grid, x, y, element, shade) => void` | In addition to its existing behavior (write `elements[i]`/`shades[i]`/reset `glitter[i]`), `setCell` now: computes `grassHeight[i]` as `elements[belowIndex] === GRASS ? min(255, grassHeight[belowIndex] + 1) : 0` whenever the written `element === GRASS` (and `0` whenever it is not); resets `grassCooldown[i] = 0` whenever the cell's grass-ness changes (becomes or stops being grass); increments `grassCount` when the cell becomes grass and wasn't previously, decrements it when the cell stops being grass and was previously. |
| `clearGrid`'s extended contract | `(grid) => void` | In addition to its existing behavior (`elements.fill(EMPTY)`, `glitter.fill(0)`), also fills `grassHeight`/`grassCooldown` to `0` and sets `grassCount = 0`. |

**Validation rules**:
- FR-004: a grass cell's `(x, y)` never changes except via a drawing tool
  or a play-field re-derivation — there is no move/swap path for `GRASS`
  anywhere in `step.ts` (research.md §1).
- FR-005: `stepPowder`/`stepLiquid` treat a grass-occupied cell exactly as
  they treat any non-`EMPTY`, non-liquid cell — no grass-specific code
  exists in either function (research.md §1).
- FR-006: grass may be destroyed only by the grass brush's overwrite rule
  (never — the brush never overwrites grass, §Tool below), the eraser, or
  clear-all/scene-loading's implicit clear — never by any other simulation
  rule.

## Root / height-above-root (new — derived, not a separate stored entity)

The spec's "root" (lowest grass cell in an unbroken vertical run) and
"height above root" are **not** stored as a root reference — only the
already-resolved height (`grassHeight[i]`) is stored, computed once at
creation time from the cell directly below (data-model "Grass cell"
section above, research.md §3).

**Validation rules**:
- A grass cell with no grass cell directly beneath it (off the bottom edge,
  or the cell below holds anything other than `GRASS`) has `grassHeight =
  0` and is its own root — this covers both a genuinely ground-planted
  blade and the Edge Cases section's "grass drawn in mid-air" case
  identically, with no special-casing (FR-004).
- `grassHeight` is a structural snapshot taken at creation time; it is
  **not** recomputed if the cell below is later removed (e.g. by the
  eraser, leaving a floating blade whose stored height no longer reflects
  "what's really below it right now"). The spec does not require live
  recomputation — FR-016 ("grass never changes over time in the absence of
  water") and the Edge Cases entry "erasing the base of a tall blade... the
  blade above does not fall or collapse" together mean a blade's own
  position and appearance never react to what happens beneath it; only its
  *stored* height (used solely to gate *further* growth on top of it) can
  go stale, which is conservative (can only make growth stop *earlier*
  than 12 true cells, never later) and therefore never breaks SC-006's
  ceiling guarantee.

## Absorption-and-growth event (new — a same-step transition, not a stored entity)

The event of a grass cell drinking one adjacent water cell and sprouting
one new grass cell, as one atomic operation within a single `step()` call
(research.md §2, §5). Not a stored type — it is the branch `stepGrass`
(private to `step.ts`) takes when all of its preconditions hold.

| Precondition (all required) | Field(s) involved |
|---|---|
| `grassCooldown[i] === 0` | FR-009 pacing |
| At least one orthogonal neighbor holds `WATER` | FR-007 |
| `pickGrowthTargetIndex(grid, x, y) !== -1` — an eligible target exists per FR-010's preference order, where "eligible" folds in emptiness, the field-share ceiling, and the *target's own* would-be height ceiling (research.md §4) | FR-008, FR-010, FR-011, FR-012, FR-013 |

**State transitions** (per grass cell `i`, per step, in `stepGrass`):

| From | Event | To |
|---|---|---|
| `grassCooldown[i] > 0` | any step | `grassCooldown[i] - 1`, no absorption attempted |
| `grassCooldown[i] === 0`, no adjacent water | any step | unchanged |
| `grassCooldown[i] === 0`, adjacent water, no eligible target | any step | unchanged — **not** absorbed (FR-008) |
| `grassCooldown[i] === 0`, adjacent water, eligible target found | any step | the water cell → `EMPTY`; the target cell → `GRASS` (fresh shade, `grassHeight` computed per its own below-neighbor, `grassCount` incremented, `moved[target] = 1`); `grassCooldown[i] = 10` |

**Validation rules**:
- Each single `stepGrass` invocation absorbs at most one water cell and
  creates at most one grass cell — FR-014's "each absorbed water cell
  yields at most one new grass cell" holds by construction (there is no
  code path that absorbs more than one neighbor or creates more than one
  target per invocation).
- A newly-created target cell cannot itself absorb/grow again within the
  same `step()` pass (`moved[target] = 1` is checked by `step()`'s
  dispatcher before calling `stepGrass` on any cell) — bounds how much a
  single frame can grow a column even under "unlimited water" (research.md
  §5), keeping SC-003/FR-015's "visible growth" timing meaningful rather
  than instantaneous.
- Two grass cells simultaneously adjacent to the same single water cell in
  the same step never both absorb it — whichever is visited first (per
  `step()`'s existing bottom-to-top, left-to-right scan order) mutates that
  cell to `EMPTY` in place, so the second cell's own neighbor scan no
  longer finds `WATER` there (research.md §5).

## Grass ceilings (new — pure constants and comparisons, not stored state)

| Concept | Value | Notes |
|---|---|---|
| `GRASS_HEIGHT_CEILING` | `12` (constant, `step.ts`) | FR-011. A target is ineligible if its own would-be `grassHeight` would exceed this. |
| `GRASS_FIELD_SHARE_CEILING` | `0.25` (constant, `step.ts`) | FR-012. A target is ineligible whenever `grassCount >= floor(width * height * GRASS_FIELD_SHARE_CEILING)` at the moment of the check — growth-only; never removes or blocks grass the child planted (the brush's own writes go through `setCell` directly, not through `pickGrowthTargetIndex`, so the ceiling can never block a hand-plant, only a `stepGrass`-triggered sprout). |
| `GRASS_ABSORB_COOLDOWN` | `10` (constant, `step.ts`) | FR-009. Steps a cell must wait after absorbing before it may absorb again. |

**Validation rules**:
- Both ceilings are evaluated fresh (against the *live* `grassCount`/
  target's live would-be height) on every `pickGrowthTargetIndex` call —
  never cached — so they correctly reflect grass created earlier in the
  very same step (e.g. a chain of distinct, not-yet-`moved` cells each
  independently reaching the field-share ceiling partway through one pass).

## Tool (extended)

| Field | Type | Notes |
|---|---|---|
| `Tool` | `'sand' \| 'water' \| 'dirt' \| 'grass' \| 'rainbow' \| 'unicorn' \| 'eraser' \| 'wand'` | Adds `'grass'` (`src/sim/types.ts`). |

**Validation rules**:
- The `grass` tool deposits `GRASS` into a footprint cell iff that cell
  currently holds `EMPTY` or `WATER` (matching `sand`/`dirt`'s existing
  "never overwrite an occupant" pattern, extended to also claim water cells
  — FR-020); it never overwrites `SAND`/`DIRT`/`RAINBOW_SAND`/`OBJECT`.
- `eraser` and `wand` need no `Tool`-level change — both already operate
  generically on "any non-`EMPTY`[, non-`OBJECT`]" cells (research.md §6).
- Pink sand (`'sand'`) remains the tool selected on page load — unchanged
  from spec 002 (FR-023).

## Scene (extended — landscape-1 only)

`SceneId`, `sceneRegions`, `generateLandscape2`, and `loadScene`'s own
clear-then-generate contract are unchanged. `generateLandscape1` gains two
additive, deterministic grass-placement passes (research.md §9):

| Pass | Placement rule | Purpose |
|---|---|---|
| Hill cap | For every column `i` in the lower-portion band where `heights[i] <= waterSurfaceRow` (dry / not flooded), `setCell(grid, x0+i, heights[i]-1, GRASS, positionalShade(...))`. | Visual — "the hillsides are already green" (FR-028a). Never overwrites `DIRT` (placed one row above the existing surface, into what was previously empty air), so every existing dirt-height-profile assertion in `scenes.test.ts` is unaffected. |
| Shoreline seed | For a small fixed number of flooded columns nearest each crest (research.md §9's tuned count), `setCell(grid, x, waterSurfaceRow-1, GRASS, positionalShade(...))`. | Guarantees at least a few grass cells are orthogonally adjacent (same column, one row above) to a `WATER` cell at load time — the deliberate, bounded "drinks and grows a little" trigger (Acceptance Scenario 10, FR-028a). |

**Validation rules**:
- Both passes use only `heights[]`/`waterSurfaceRow` (already deterministic
  outputs of the existing profile computation) and `positionalShade` (the
  existing non-random shade hash) — loading landscape-1 twice at the same
  size produces byte-identical grass placement, differing only in nothing
  (shade is itself deterministic too) — FR-028a's determinism requirement.
- `generateLandscape2` places zero grass cells, unconditionally — the
  Superseded requirements section's "landscape-2 remains exactly as it is
  today" (spec 004 FR-018, unchanged).
- The scene's hills and lake still satisfy every pre-existing spec 004
  requirement (crest/valley shape, water strictly below the crests, one
  rainbow, one unicorn on the taller crest) — neither new pass touches
  `DIRT`/`WATER`/object placement in any way.

## Superseded / extended contracts

- Spec 002's **FR-003** (an element never changes into another, counts
  change only via drawing tools) is superseded in grass's presence, exactly
  as spec.md's own Superseded requirements section states: `setCell`
  writing `EMPTY` over a former `WATER` cell as part of absorption, and
  writing `GRASS` into a previously-`EMPTY` target, are both simulation-
  driven element changes — the *only* ones this codebase has ever had.
  With no grass on the field, every existing element-conservation
  invariant holds exactly as before (FR-033) — nothing in this feature's
  `setCell`/`stepGrass` changes runs unless a `GRASS` cell is actually
  present and eligible.
- Spec 004's **FR-020**/**SC-006** (a scene is at rest on load) is
  superseded for landscape-1 only, exactly as spec.md's Superseded
  requirements section states — its seeded shoreline grass is expected to
  visibly drink and grow a bounded amount on the very first steps after
  load (see "Shoreline seed" above), then stop.
- No entity 001–006 already defined changes meaning, shape, or validation
  rules beyond `Grid` gaining `grassHeight`/`grassCooldown`/`grassCount`
  and `Tool` gaining `'grass'` (both covered above) — `PlacedObject`/
  `ObjectsState`/`PlayField`/`Re-derivation`/`Toolbar layout` and every
  other prior entity are unaffected; `resizeGrid` (spec 006) is extended
  only to also copy `grassHeight`/`grassCooldown` per carried cell and
  accumulate the new grid's `grassCount` during its existing copy loop —
  its offset/drop/`OBJECT`-skip contract is otherwise unchanged (see
  contracts/grass-mechanics.md).
