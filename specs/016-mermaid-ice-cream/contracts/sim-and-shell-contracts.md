# Contract: Mermaid + ice cream (extends every prior `src/sim/*`/`src/lib/*` contract)

This project has no network API. As in `specs/010-undo-redo/contracts/
undo-redo-mechanics.md` (which itself extends 001–009's), the interface
contract that matters is the boundary between the framework-free simulation
core (`src/sim/*`), the UI-layer helpers (`src/lib/*`), the Svelte shell that
calls both, and the `vitest` unit tests that exercise `src/sim/*` functions
directly with no DOM (constitution Principle V, FR-033). This document is
purely additive: every function/type in every prior contract not mentioned
here is **unchanged**, except where a signature is explicitly widened below
(`history.ts`'s capture/restore/remap functions and `HistoryManager` methods
gain a `PetsState` parameter; `save.ts`/`historySave.ts`'s wire shapes gain a
`mermaids` field).

## `src/sim/types.ts`

```ts
export const ICE_CREAM = 11; // FR-013 — reserved; 12/13 belong to another concurrently-filed feature

export type Element =
  | typeof EMPTY | typeof SAND | typeof WATER | typeof DIRT | typeof RAINBOW_SAND
  | typeof OBJECT | typeof GRASS | typeof STAR_POWER | typeof FOG | typeof GUMDROP
  | typeof FLOWER | typeof ICE_CREAM; // + ICE_CREAM

export type Tool =
  | 'sand' | 'water' | 'dirt' | 'grass' | 'star' | 'rainbow' | 'unicorn' | 'palm'
  | 'poodle' | 'flamingo' | 'eraser' | 'wand' | 'gumdrop'
  | 'mermaid' | 'icecream'; // + both new tools
```

## `src/sim/element.ts`

```ts
// isSolid(): + ICE_CREAM
export function isSolid(e: number): boolean; // now also true for ICE_CREAM

// usesHueColor(): + ICE_CREAM (FR-014 — mandatory, see element.ts's own doc comment on this predicate)
export function usesHueColor(e: number): boolean;
```

## `src/sim/step.ts`

No new function. `step()`'s per-cell dispatch gains one branch:

```ts
} else if (element === GUMDROP || element === ICE_CREAM) {
  stepGumdrop(grid, x, y, i); // reused verbatim — FR-015, "no new movement rule"
}
```

## `src/sim/brush.ts`

`paintCell()` gains one branch, structurally identical to the existing
`gumdrop` case:

```ts
} else if (tool === 'icecream' && (paintable || current === WATER)) {
  setCell(grid, x, y, ICE_CREAM, shade);
  grid.hues[y * grid.width + x] = randomHue();
}
```

The `eraser` branch (`setCell(grid, x, y, EMPTY, 0)`) is unconditional on
current element already — ice cream is erasable with **no change** there
(FR-024's ice-cream half).

## `src/sim/pets.ts` (extends `Poodle`'s existing contract; nothing about
`Poodle`/`stepPoodle`/`addPoodle`/`pokePoodleAt`/`repositionPoodles` changes)

```ts
export type MermaidState = 'resting' | 'drifting' | 'swimming' | 'eating' | 'freeing' | 'tricking';

export interface Mermaid {
  readonly id: number;
  x: number;
  y: number;
  facing: 1 | -1;
  state: MermaidState;
  timer: number;
  pursuitX: number;
  pursuitY: number;
  pursuitBestDist: number;
  pursuitStaleFrames: number;
  iceCreamCooldown: number;
  homeX: number;
  homeY: number;
  driftDir: 1 | -1;
}

export interface PetsState {
  poodles: Poodle[];
  mermaids: Mermaid[]; // new
  nextId: number;
  stride: number;
}

export const MERMAID_CAP = 3; // FR-002

/** Bounded square-window scan (mirrors nearestGumdropX's shape) for the nearest WATER cell around
 * (x, y); if found, places a mermaid there (state 'drifting'). If not, places her at
 * groundBelow(grid, x, y) with state 'resting' (FR-008) — never refused, never hidden. Evicts the
 * oldest mermaid first if already at MERMAID_CAP (FR-002). */
export function addMermaid(grid: Grid, state: PetsState, x: number, y: number): void;

/** Advances every mermaid one frame: own-cell ice cream check, buried check ('freeing'),
 * resting→water check, pursuit/give-up/cooldown, drift. Allocation-free (constitution Principle
 * IV, FR-010). No touch-target parameter — a mermaid never follows a finger (FR-011). */
export function stepMermaids(grid: Grid, state: PetsState): void; // called from stepPets, below

/** Pokes the nearest mermaid within POKE_RADIUS of (x, y) whose timer is free; same shape and
 * radius as pokePoodleAt (FR-011). Returns true iff a trick started. */
export function pokeMermaidAt(pets: PetsState, x: number, y: number): boolean;

/** Shifts every mermaid by (offsetX, offsetY) and clamps back in-bounds — never dropped — exactly
 * mirroring repositionPoodles (FR-028). */
export function repositionMermaids(mermaids: Mermaid[], newGrid: Grid, offsetX: number, offsetY: number): void;

/** Removes, in whole, every mermaid within radius of (cx, cy) — same circular-reach shape as
 * eraseObjectsInBrush, radius is POKE_RADIUS at the call site (research.md §12). */
export function eraseMermaidsInBrush(pets: PetsState, cx: number, cy: number, radius: number): void;

/** Line-interpolated counterpart, mirroring eraseObjectsInBrushLine. */
export function eraseMermaidsInBrushLine(
  pets: PetsState,
  from: { x: number; y: number },
  to: { x: number; y: number },
  radius: number,
): void;

// Existing signatures, behavior extended (not narrowed):
export function clearPets(state: PetsState): void; // now empties both poodles AND mermaids
export function stepPets(grid: Grid, pets: PetsState, target: { x: number; y: number } | null): void; // now also calls stepMermaids(grid, pets) internally
```

## `src/sim/history.ts` (every signature below widens an existing one; `WorldState`'s
grid/object fields are unchanged)

```ts
export interface WorldState {
  readonly elements: Uint8Array;
  readonly colorAux: Uint8Array;
  readonly cloud: Uint8Array;
  readonly glitter: Uint8Array;
  readonly grassHeight: Uint8Array;
  readonly byKind: Record<ObjectKind, PlacedObject[]>;
  readonly mermaids: { x: number; y: number }[]; // new — FR-027
}

// Every function below gains a `pets: PetsState` parameter, reading/writing only .mermaids:
export function captureWorldState(grid: Grid, objects: ObjectsState, pets: PetsState): WorldState;
export function restoreWorldState(grid: Grid, objects: ObjectsState, pets: PetsState, state: WorldState): boolean;

// remapWorldState/wouldRemapLosslessly: mermaid positions are clamped into (newWidth, newHeight),
// never causing a rejection (research.md §9) — signature otherwise unchanged (mermaids travel
// inside WorldState itself, not as a separate parameter).
export function remapWorldState(/* unchanged params */): WorldState;

export class HistoryManager {
  beginAction(grid: Grid, objects: ObjectsState, pets: PetsState): void;
  commitAction(grid: Grid, objects: ObjectsState, pets: PetsState): void;
  undo(grid: Grid, objects: ObjectsState, pets: PetsState): boolean;
  redo(grid: Grid, objects: ObjectsState, pets: PetsState): boolean;
  // canUndo/canRedo/reset/remap/getPersistableUndoStack/restoreFromPersisted: unchanged signatures
}
```

## `src/sim/save.ts`

```ts
export interface SavedWorld {
  version: number;
  width: number;
  height: number;
  state: WorldState;
  poodles: { x: number; y: number }[];
  mermaids: { x: number; y: number }[]; // new
}

// serializeWorld gains a PetsState read (mermaids only — poodles already read from it today):
export function serializeWorld(grid: Grid, objects: ObjectsState, pets: PetsState): string; // signature unchanged, output shape grows

// deserializeWorld: a missing/malformed `mermaids` field defaults to [] rather than rejecting the
// payload (FR-029, research.md §13) — SAVE_VERSION is NOT bumped.
export function deserializeWorld(raw: string): SavedWorld | null; // signature unchanged
```

## `src/sim/historySave.ts`

No new exported function. `WireHistoryStep`'s shape (internal, produced by
`encodeStep`) grows a `mermaids` field alongside `byKind`, falling out of
`WorldState`'s change above. `deserializeHistory` applies the same
missing-field-defaults-to-`[]` tolerance as `save.ts` (research.md §13).
`HISTORY_SAVE_VERSION` is NOT bumped.

## `src/lib/toolbarControls.ts`

`TOOLBAR_CONTROLS` gains two unconditional entries (no new `ToolbarGroupId`,
no new `conditional` value):

```ts
{ id: 'tool-icecream', group: 'elements', ariaLabel: 'Ice cream' },
{ id: 'tool-mermaid', group: 'objects', ariaLabel: 'Mermaid' },
```

`shippedToolbarControls`'s own signature and logic are unchanged — the count
change is purely data (plan.md's "Toolbar cost" section).

## `src/lib/palette.ts`

```ts
// New ramp, same shape as GUMDROP_COLORS/FLOWER_COLORS:
const ICE_CREAM_COLORS: Rgb[]; // flavour palette, hue-indexed

// colorFor(): + one branch
export function colorFor(element: number, shade: number, hue: number, isCloud: boolean): Rgb;
// (adds: if (element === ICE_CREAM) return ICE_CREAM_COLORS[hue % ICE_CREAM_COLORS.length];)
```

## `src/lib/sound.ts`

```ts
export type PourKind =
  | 'sand' | 'water' | 'dirt' | 'gumdrop' | 'grass' | 'star' | 'icecream'; // + icecream

// POUR_PITCH gains an 'icecream' entry. playPour()'s signature is unchanged.
export function playPour(kind: PourKind): void;
```

No other function in `sound.ts` changes — eating and poking a mermaid call
only the *existing* `playTrill()`/no-sound path (FR-023, FR-011).

## `src/lib/PlayArea.svelte` (shell wiring — no exported contract, listed for
completeness since prior contracts documented shell call sites too)

- `handlePointerDown`: poke check extended with `pokeMermaidAt(petsState, pos.x,
  pos.y)` alongside the existing `pokePoodleAt` check (same "before any
  painting/placing, every tool but the eraser" gate); `tool === 'mermaid'`
  branch calls `addMermaid(grid, petsState, pos.x, pos.y)` alongside the
  existing `tool === 'poodle'` branch.
- `paintAt`'s `tool === 'eraser'` branch additionally calls
  `eraseMermaidsInBrush(Line)` alongside the existing
  `eraseObjectsInBrush(Line)` call.
- `render()` draws mermaids the same way it draws poodles (own loop, own
  `ctx.font`, `spawnBurst` on `'eating'`/`'tricking'`, **no** new sound call
  on state transitions — poodle's `playBloop()`/`playWobble()` calls are
  poodle-specific and do not gain a mermaid counterpart, FR-023).
- `resize()` calls `repositionMermaids(petsState.mermaids, newGrid, offsetX,
  offsetY)` alongside the existing `repositionPoodles` call.
- `saveNow`/`flushSave`/`tryRestore`: unchanged call shape
  (`serializeWorld(grid, objectsState, petsState)` /
  `deserializeWorld(raw)`), wider output/input per `save.ts` above;
  `tryRestore` rebuilds mermaids from `saved.mermaids` the same way it
  rebuilds poodles from `saved.poodles`.
- `history.beginAction/commitAction/undo/redo` calls gain the `petsState`
  argument per `history.ts` above.
- `clearAll()`/`loadScene()`: already call `clearPets(petsState)`, which now
  clears mermaids too — no call-site change needed.
