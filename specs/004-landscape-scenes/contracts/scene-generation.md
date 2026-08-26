# Contract: Scene generation (extends 003's `src/sim/*` contract)

This project has no network API. As in
`specs/003-rainbow-unicorn-magic/contracts/sim-core.md` (which itself
extends 001/002's), the interface contract that matters is the boundary
between the framework-free simulation core (`src/sim/*`) and both (a) the
Svelte UI shell that calls it on a toolbar tap and (b) the `vitest` unit
tests that exercise it directly with no DOM (constitution Principle V,
FR-028). This document is purely additive — it does not change any
signature 001/002/003 already established; every function listed there is
unchanged and is not repeated here.

## `src/sim/types.ts` (extended)

```ts
export type SceneId = 'empty' | 'landscape1' | 'landscape2';
```

**Addition only**: nothing else in `types.ts` changes. `Grid`,
`Element`, `Tool`, `BrushSize`, `ObjectKind`, `PlacedObject`,
`ObjectsState` are all unchanged from 003.

## `src/sim/scenes.ts` (new)

```ts
export interface SceneRegion {
  x0: number; // inclusive, grid cells
  y0: number; // inclusive, grid cells
  x1: number; // exclusive, grid cells
  y1: number; // exclusive, grid cells
}

export interface SceneRegions {
  sky: SceneRegion;
  lowerPortion: SceneRegion;
  leftHalf: SceneRegion;
  rightHalf: SceneRegion;
}

export function sceneRegions(width: number, height: number): SceneRegions;

export function generateLandscape1(grid: Grid, objects: ObjectsState): void;

export function generateLandscape2(grid: Grid, objects: ObjectsState): void;

export function loadScene(
  sceneId: SceneId,
  grid: Grid,
  objects: ObjectsState,
): void;
```

**Contract**:
- `sceneRegions(width, height)`: pure, allocates one small object per call
  (four plain-number rectangles), no side effects, safe to call from a hot
  path if ever needed even though this feature only calls it during
  generation (data-model.md's SceneRegion/SceneRegions). Every returned
  rectangle satisfies `0 <= x0 < x1 <= width` and `0 <= y0 < y1 <= height`
  for any positive `width`/`height`.
- `generateLandscape1`/`generateLandscape2`: assume `grid` is already fully
  `EMPTY` and `objects` is already `{ rainbows: [], unicorns: [], nextId
  }` on entry — they do not clear anything themselves (`loadScene`, below,
  is responsible for clearing). Write terrain directly via the grid's
  existing `setCell` (from `grid.ts`, unchanged) and place every rainbow/
  unicorn via the existing `placeObject` (from `objects.ts`, unchanged) —
  never by constructing a `PlacedObject` literal directly (research.md
  §5). Calling either function twice in a row on two fresh, equally-sized
  grids produces byte-for-byte identical `elements`/`shades`/`hues` arrays
  and structurally identical `ObjectsState.rainbows`/`.unicorns` (same
  length, same `kind`/`x`/`y`/`size` per entry — `id` values may differ
  only if `objects.nextId` did not start at the same value, which it does
  for a freshly created `ObjectsState`) (FR-023). Never call
  `Math.random()`, `randomShade()`, or `performance.now()` (research.md
  §1). Never touch any cell outside the region(s) `sceneRegions` returns
  for the relevant content (FR-022).
- `loadScene(sceneId, grid, objects)`: unconditionally calls the existing
  `clearGrid(grid)` (from `grid.ts`) and `clearObjects(objects)` (from
  `objects.ts`) first, for every `sceneId` including `'empty'` (FR-009,
  FR-011). For `sceneId === 'landscape1'` / `'landscape2'`, then calls the
  matching generator above. For `sceneId === 'empty'`, does nothing
  further. Synchronous, allocates no more than the generator itself does,
  and returns only after the grid/objects are fully in their final state —
  no intermediate state is ever observable by a caller (FR-010).
- None of the above ever imports from `src/lib/*` except the existing
  `OBJECT_FOOTPRINT_SIZE` constant (`src/lib/layout.ts`, unchanged) needed
  to size clearance around placed objects (research.md §6) — no Svelte,
  no DOM, no `performance`.

## `src/sim/grid.ts`, `src/sim/objects.ts`, `src/sim/step.ts`, `src/sim/brush.ts`, `src/sim/element.ts`, `src/sim/shade.ts`

**Unchanged** — no signature, exported name, or documented behavior
changes in any of these files (FR-027). `scenes.ts` is a consumer of
`grid.ts`'s `setCell`/`clearGrid` and `objects.ts`'s
`placeObject`/`clearObjects` only, exactly as `PlayArea.svelte` already is.

## `src/lib/PlayArea.svelte` (extended)

```ts
export function loadScene(sceneId: SceneId): void;
```

**Contract**: mirrors the existing `export function clearAll(): void`
exactly. Calls `scenes.ts`'s `loadScene(sceneId, grid, objectsState)`
against this component's own `grid`/`objectsState` instances, then resets
`particles.length = 0` (particles are UI-layer-only state, untouched by
`scenes.ts` itself — research.md §8). Does not read or write `tool`/
`brushSize` (FR-004). Synchronous; by the time it returns, the next
`requestAnimationFrame` tick renders the new scene with no partial-draw
frame in between (FR-010, FR-024).

## `src/lib/Toolbar.svelte` (extended)

```ts
interface Props {
  tool: Tool;
  brushSize: BrushSize;
  onSelectTool: (tool: Tool) => void;
  onSelectBrushSize: (size: BrushSize) => void;
  onSelectScene: (sceneId: SceneId) => void; // new
  onClearAll: () => void;
}
```

**Contract**: `onSelectScene` is called once per tap on one of the three
new scene buttons (⬜🏔️🏝️), with no debounce and no guard against rapid
repeated taps (FR-005 — "most recent tap wins" is satisfied because each
tap is an independent, synchronous call all the way down to `loadScene`,
with no queue at any layer). None of the three scene buttons ever binds a
`selected`/active CSS class to `tool`, `brushSize`, or any new piece of
state (FR-006) — visually and structurally, they are peers of the existing
`onClearAll` button (`🗑️`), not peers of the tool-selection buttons.

## `src/App.svelte` (extended)

**Contract**: adds one handler, e.g. `function selectScene(id: SceneId) {
playArea.loadScene(id); }`, passed to `Toolbar` as `onSelectScene`. Does
not call `selectTool`/`selectBrushSize` — `tool`/`brushSize` `$state` is
left exactly as it was before the tap (FR-004).

## Consumers

- `PlayArea.svelte` is the only runtime caller of `scenes.ts`. A scene tap
  flows: `Toolbar` button `onclick` → `App.svelte`'s `selectScene` → `Play
  Area.loadScene(id)` → `scenes.ts`'s `loadScene(id, grid, objectsState)`
  → (clear, then generate) → `PlayArea.loadScene` resets `particles` →
  return. The existing per-frame loop (`step` → `applyRainbowConversions`
  → `updateUnicorns` → `tickParticles` → `render`) is completely unaware a
  scene was just loaded — it simply sees new grid/object contents on its
  next tick, exactly as it would after a hand-drawn stroke or a `clearAll`
  (FR-013).
- `tests/unit/sim/scenes.test.ts` imports `sceneRegions`,
  `generateLandscape1`, `generateLandscape2`, and `loadScene` directly from
  `src/sim/scenes.ts`, plus `createGrid`/`getElement` from `grid.ts` and
  `createObjectsState` from `objects.ts` (all unchanged), and asserts on
  `grid.elements`/`grid.shades`/`grid.hues`/`ObjectsState` contents — no DOM
  and no Svelte involved (FR-028).
