# Phase 1 Data Model: Landscape Scenes

Derived from the spec's Key Entities section and research.md's decisions.
This extends `specs/003-rainbow-unicorn-magic/data-model.md`'s Element /
Grid / Cell / Occupant / PlacedObject / ObjectsState / Tool selection /
Brush / Stroke / Particle model unchanged — nothing about those entities
changes in this feature. Only what is new (`Scene`, `SceneId`,
`SceneRegions`) is detailed in full here; every existing entity is reused
exactly as 003 defined it.

## Element, Grid, Cell, Occupant, PlacedObject, ObjectsState, Tool, Brush, Stroke, Particle

Unchanged from 003. In particular:

- No new `Element` value is introduced — a scene's terrain is composed
  entirely of `DIRT`, `SAND`, and `WATER`; a scene's objects are ordinary
  `PlacedObject` entries of kind `'rainbow'`/`'unicorn'` (FR-012).
- `Grid.hues` is only ever populated by rainbow conversion (unchanged,
  003's `applyRainbowConversions`) — scene generation never writes `hues`
  directly, because scene terrain starts as plain `DIRT`/`SAND`/`WATER`,
  not `RAINBOW_SAND` (a scene's rainbow may of course convert nearby
  hand-drawn or scene terrain later, exactly like a hand-placed rainbow —
  but not its own terrain, which research.md §6 keeps out of every
  rainbow's zone).
- `ObjectsState`'s per-kind cap of 3 and oldest-evicted rule apply to
  scene-placed objects exactly as to hand-placed ones (FR-014, research.md
  §5) — `PlacedObject.id` is assigned from the same `ObjectsState.nextId`
  counter regardless of who called `placeObject`.

## Scene (new — conceptual, not a runtime object)

A named, preloaded arrangement of the toy's existing elements/objects that
can replace the play area's contents on a single tap. Exactly three exist,
identified by `SceneId`. A `Scene` has no runtime representation of its
own beyond the `SceneId` string used to select which generator to run —
there is no persisted or stored "Scene" object (FR-015: nothing is
persisted or restored).

| `SceneId` value | Meaning |
|---|---|
| `'empty'` | Blank canvas — identical to the post-🗑️ / initial-load state (FR-011). |
| `'landscape1'` | 🏔️ Rolling purple-dirt hills, a valley lake, one rainbow, one unicorn on a crest (FR-017). |
| `'landscape2'` | 🏝️ Pink-sand beach sloping into a large pool, two rainbows, one unicorn near the shore (FR-018). |

**Validation rules**:
- Selecting the same `SceneId` twice at the same `Grid` size produces
  identical `elements`/`shades`/`hues` arrays and an identical
  `ObjectsState` (module structure and object order), cell for cell and
  object for object (FR-023).
- A `Scene`'s contents are determined solely by the target `Grid`'s
  `width`/`height` — nothing else (no wall-clock time, no prior grid
  contents, no session state) affects what is generated.

## Scene generator (new)

The deterministic function that turns a `Grid`'s current `width`/`height`
into that scene's contents, written in place. This is the unit under test
for FR-028's automated coverage. Lives in the new `src/sim/scenes.ts`.

| Function | Signature | Notes |
|---|---|---|
| `loadScene` | `(sceneId: SceneId, grid: Grid, objects: ObjectsState) => void` | The only entry point `PlayArea.svelte` calls. First fully clears (`clearGrid(grid)` + `clearObjects(objects)` — both existing, unmodified `objects.ts`/`grid.ts` functions), satisfying FR-009 unconditionally for every `SceneId` including `'empty'`. For `'landscape1'`/`'landscape2'`, then delegates to the matching generator below. For `'empty'`, does nothing further — the clear alone is the whole scene (FR-011). |
| `generateLandscape1` | `(grid: Grid, objects: ObjectsState) => void` | Writes the FR-017 contents onto a grid **assumed already empty** (does not itself clear — that is `loadScene`'s job, so tests calling this directly against a freshly `createGrid`'d grid see the same result as through `loadScene`). Deterministic in `grid.width`/`grid.height` alone. |
| `generateLandscape2` | `(grid: Grid, objects: ObjectsState) => void` | Same contract as `generateLandscape1`, writing the FR-018 contents. |
| `sceneRegions` | `(width: number, height: number) => SceneRegions` | Pure. Used internally by both generators above and directly by `scenes.test.ts` (research.md §4) — the single shared source of "what counts as the sky / the lower portion / etc." for both composition and assertion. |

**Validation rules**:
- Every generator is a pure function of its `Grid`'s `width`/`height`
  (plus, for `generateLandscape1`/`generateLandscape2`, the assumption that
  the grid is already empty on entry) — no `Math.random()`, no
  `performance.now()`, no closure over any value that differs between
  calls (research.md §1).
- Every cell a generator writes is set through the same primitives brush
  strokes use (`setCell` for terrain, `placeObject` for objects) — never a
  new, parallel way of marking a cell, which is what keeps scene-placed
  content "indistinguishable in behavior from the same cell or object
  drawn by the child" (FR-013).
- A generator never reads or writes anything outside `Grid`/`ObjectsState`
  (no particle-array access, no DOM) — clearing particles on scene load is
  `PlayArea.svelte`'s responsibility (research.md §8), exactly mirroring
  how `clearObjects`/particle-clearing are already split between
  `objects.ts` and `PlayArea.svelte`'s `clearAll()`.

## SceneRegion / SceneRegions (new)

A proportional rectangle of the play area, expressed as fractions of the
target `Grid`'s `width`/`height`, resolved to concrete grid-cell bounds at
generation time. Named regions are grouped in one `SceneRegions` value per
`(width, height)` pair.

| Field | Type | Notes |
|---|---|---|
| `x0`, `y0` | `number` (grid cells) | Region's inclusive top-left corner. |
| `x1`, `y1` | `number` (grid cells) | Region's exclusive bottom-right corner. |

`sceneRegions(width, height)` returns a small fixed set of such rectangles
— at minimum a `sky` region (upper portion, where every scene's rainbow(s)
must lie) and a `lowerPortion` region (lower portion, where every scene's
terrain must lie), plus whatever left/right split each landscape's
generator needs for its water body. Exact fraction values (how tall "the
sky" is, how wide "the lower portion" is) are an implementation choice —
research.md §9 gives illustrative, non-binding figures — but whatever
values are chosen are defined exactly once, in this one function, and used
identically by generation and by `scenes.test.ts`'s region assertions.

**Validation rules**:
- Every named region is fully inside `[0, width) × [0, height)` for any
  `width`/`height` a generator is called with (FR-022 — never clipped).
- The `sky` region and `lowerPortion` region never overlap, and are
  separated by at least enough rows to satisfy research.md §6's rainbow-
  clearance rule for the largest object footprint (`OBJECT_FOOTPRINT_SIZE`,
  unchanged from 003) that will be placed in `sky`.
- `sceneRegions` never allocates per-cell data (no `Uint8Array`, no
  per-cell loop) — it returns a handful of numbers, cheap to call from
  both a generator and a test with no shared mutable state between calls.

## Terrain height profile (new — internal generation concept, not exported)

An implementation detail of `generateLandscape1`/`generateLandscape2`,
described here because research.md §2/§3 depend on it and because
`scenes.test.ts`'s at-rest assertions need to reconstruct it from `Grid`
state (by scanning each column for its topmost non-`EMPTY` row) without
needing `scenes.ts` to export it separately.

| Concept | Notes |
|---|---|
| Height profile | One row-index per column: the topmost row in the `lowerPortion` region that generation fills with `DIRT` (landscape 1) or `SAND` (landscape 2). Computed inside the generator from a smooth function of `x / width`, then clamped so adjacent columns differ by at most 1 row (research.md §2) before being written to the grid. |
| Water surface row | A single fixed row (per scene, per grid size) at least one row below the shortest wall column bounding the water body; every column inside the water body's span is `WATER` from this row down to that column's terrain surface (research.md §3). |

**Validation rules**:
- The *written* height profile (read back from `grid.elements` after
  generation) never differs by more than 1 row between horizontally
  adjacent columns within a scene's terrain span — this is exactly what
  `scenes.test.ts`'s at-rest test relies on being true both immediately
  after generation and after any number of subsequent `step()` calls
  (FR-020, SC-006).
- The water surface row is strictly below every wall column's height
  profile value on both sides of the water body, by at least 1 row — this
  is what keeps `stepLiquid` from ever finding an open lateral/downhill
  neighbor (research.md §3).

## Superseded / extended contracts

None. This feature adds a new module and new UI wiring; it does not change
the meaning, shape, or validation rules of any entity 001/002/003 already
defined (`Element`, `Grid`, `Cell`, `Occupant`, `PlacedObject`,
`ObjectsState`, `Tool`, `BrushSize`, `Brush`, `Stroke`, `Particle`).
