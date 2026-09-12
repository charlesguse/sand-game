# Contract: Walking people (extends every prior `src/sim/*`/`src/lib/*` contract)

This project has no network API. As in `specs/016-mermaid-ice-cream/contracts/
sim-and-shell-contracts.md` (which itself extends 001–013's), the interface
contract that matters is the boundary between the framework-free simulation
core (`src/sim/*`), the UI-layer helpers (`src/lib/*`), the Svelte shell that
calls both, and the `vitest` unit tests that exercise `src/sim/*`/`src/lib/*`
functions directly with no DOM (constitution Principle V, FR-031). This
document is purely additive/narrowing: every function/type in every prior
contract not mentioned here is **unchanged**, except where explicitly noted
(`ObjectKind`/`OBJECT_KINDS` **lose** `'person'`; `history.ts`'s `WorldState`
gains a `people` field alongside its existing `mermaids` one).

## `src/sim/types.ts`

```ts
export type PersonVariant = 'neutral' | 'man' | 'woman'; // new

export type Tool =
  | 'sand' | 'water' | 'dirt' | 'grass' | 'star' | 'rainbow' | 'unicorn' | 'palm'
  | 'poodle' | 'flamingo' | 'eraser' | 'wand' | 'gumdrop' | 'house' | 'person'
  | 'chest' | 'mermaid' | 'icecream'; // unchanged — 'person' stays a Tool id (FR-002)

// ObjectKind loses 'person' (FR-001, FR-009):
export type ObjectKind = 'rainbow' | 'unicorn' | 'palm' | 'flamingo' | 'house' | 'chest';
```

`PlacedObject`/`ObjectsState` are structurally unchanged; they simply can no
longer hold a `'person'`-kind entry going forward.

## `src/sim/objects.ts`

```ts
// OBJECT_KINDS loses 'person':
export const OBJECT_KINDS: ObjectKind[] = ['rainbow', 'unicorn', 'palm', 'flamingo', 'house', 'chest'];

/** Converts a legacy byKind.person list into walker positions and releases the grid cells their
 * footprints stamped solid, unless still covered by a surviving object of another kind
 * (research.md §8, data-model.md's Objects section). Read-only — never called from a live
 * placement path, only from save/history deserialization. */
export function migrateLegacyPersonObjects(
  grid: Grid,
  objects: ObjectsState,
  rawPersonList: readonly PlacedObject[],
): { x: number; y: number }[];

// placeObject/removeObject/eraseObjectsInBrush(Line)/clearObjects/isCoveredByAnyObject:
// unchanged signatures and behavior, operating over the now-smaller OBJECT_KINDS.
```

## `src/lib/personGlyphs.ts` (new file)

```ts
export type PersonFrame = 'standing' | 'walking' | 'running';

export interface GlyphProbeInputs {
  /** True if `glyph` renders as a real figure, not an empty/tofu box. */
  canRender(glyph: string): boolean;
  /** Mirrors CanvasRenderingContext2D.measureText(text).width. */
  measureWidth(text: string): number;
}

export interface PersonPictureSet {
  readonly drawableVariants: readonly PersonVariant[];
  readonly pictures: Readonly<Record<PersonVariant, Readonly<Record<PersonFrame, string>>>>;
  readonly canRunPicture: boolean;
  readonly toolbarGlyph: string;
}

/** Pure, DOM-free resolution of the fallback ladder (FR-017–FR-020, research.md §§1–3).
 * Each of the 9 base glyphs is checked independently; a thrown/garbage result from `probe`
 * for one glyph degrades only that glyph's rung, not the whole picture set. Never called more
 * than once per session by production code — that guarantee lives at the call site (App.svelte
 * or PlayArea.svelte's setup), not inside this function. */
export function resolvePersonPictureSet(probe: GlyphProbeInputs): PersonPictureSet;

/** The one production-facing GlyphProbeInputs implementation: renders each candidate glyph and
 * a known-unassigned codepoint to an off-screen canvas and compares (tofu check), and calls
 * ctx.measureText (split-sequence check). Never imported by src/sim/* or by unit tests, which
 * construct GlyphProbeInputs by hand. */
export function createCanvasGlyphProbe(canvas: HTMLCanvasElement): GlyphProbeInputs;

/** The native left/right facing of the walking glyph on this platform's font — a single named
 * constant per FR-011, corrected in one place if a platform draws it the other way
 * (CLAUDE.md's "flag anything only the other device can verify"). */
export const WALK_GLYPH_NATIVE_FACING: 1 | -1;
```

## `src/sim/pets.ts` (extends `Poodle`'s/`Mermaid`'s existing contracts; nothing about either changes)

```ts
export type PersonState = 'standing' | 'walking' | 'running';

export interface Person {
  readonly id: number;
  x: number;
  y: number;
  facing: 1 | -1;
  state: PersonState;
  timer: number;
  readonly variant: PersonVariant;
  homeX: number;
  wanderDir: 1 | -1;
}

export interface PetsState {
  poodles: Poodle[];
  mermaids: Mermaid[];
  people: Person[]; // new
  personVariantBag: PersonVariant[]; // new
  nextId: number;
  stride: number;
}

export const PERSON_CAP = 3; // FR-003

/** Injectable-RNG shuffle-bag variant chooser (FR-013a, research.md §4). */
export function pickPersonVariant(
  state: PetsState,
  drawableVariants: readonly PersonVariant[],
  rng: () => number,
): PersonVariant;

/** Places a person at (x, y) with a freshly-picked variant (via pickPersonVariant); settles onto
 * the surface below her over the following frames via the normal groundBelow check, exactly like
 * addPoodle. Evicts the oldest person first if already at PERSON_CAP. */
export function addPerson(
  grid: Grid,
  state: PetsState,
  x: number,
  y: number,
  drawableVariants: readonly PersonVariant[],
  rng: () => number,
): void;

/** Advances every person one frame: buried check (dig-out), groundBelow settle, ledge-step, and
 * the two-phase standing/walking stroll cadence (research.md §6) or the running poke-reaction
 * countdown (research.md §7). No touch-target parameter — a person never follows a finger
 * (FR-006). Allocation-free, bounded per person regardless of canvas size (FR-008). */
export function stepPeople(grid: Grid, state: PetsState): void; // called from stepPets, below

/** Pokes the nearest person within POKE_RADIUS of (x, y) whose timer is free; same shape and
 * radius as pokePoodleAt/pokeMermaidAt. Sets state = 'running', timer = PERSON_RUN_DURATION.
 * Returns true iff a run started. */
export function pokePersonAt(pets: PetsState, x: number, y: number): boolean;

/** Shifts every person by (offsetX, offsetY) and clamps back in-bounds — never dropped — exactly
 * mirroring repositionPoodles/repositionMermaids (FR-028). Re-anchors homeX to the shifted x. */
export function repositionPeople(people: Person[], newGrid: Grid, offsetX: number, offsetY: number): void;

/** Removes, in whole, every person within radius of (cx, cy) — same circular-reach shape as
 * eraseMermaidsInBrush, radius is POKE_RADIUS at the call site (FR-021). */
export function erasePeopleInBrush(pets: PetsState, cx: number, cy: number, radius: number): void;

/** Line-interpolated counterpart, mirroring eraseMermaidsInBrushLine (FR-021's fast-drag case). */
export function erasePeopleInBrushLine(
  pets: PetsState,
  from: { x: number; y: number },
  to: { x: number; y: number },
  radius: number,
): void;

/** Rebuilds state.people wholesale from saved/migrated {x, y, variant} entries into fresh
 * default-activity people (state 'standing', timer 0) — mirrors restoreMermaidsFromPositions
 * exactly, with variant carried through verbatim rather than re-picked (FR-012, FR-023). */
export function restorePeopleFromPositions(
  state: PetsState,
  positions: readonly { x: number; y: number; variant: PersonVariant }[],
): void;

// Existing signatures, behavior extended (not narrowed):
export function clearPets(state: PetsState): void; // now also empties people
export function stepPets(grid: Grid, pets: PetsState, target: { x: number; y: number } | null): void; // now also calls stepPeople(grid, pets) internally
```

## `src/sim/history.ts` (every signature below widens an existing one; grid/object fields unchanged)

```ts
export interface WorldState {
  readonly elements: Uint8Array;
  readonly colorAux: Uint8Array;
  readonly cloud: Uint8Array;
  readonly glitter: Uint8Array;
  readonly grassHeight: Uint8Array;
  readonly byKind: Record<ObjectKind, PlacedObject[]>; // ObjectKind is now person-less
  readonly mermaids: { x: number; y: number }[];
  readonly people: { x: number; y: number; variant: PersonVariant }[]; // new — FR-024
}

// captureWorldState/restoreWorldState: already take a PetsState parameter (spec 016) — now also
// read/write .people, no new parameter added.
export function captureWorldState(grid: Grid, objects: ObjectsState, pets: PetsState): WorldState;
export function restoreWorldState(grid: Grid, objects: ObjectsState, pets: PetsState, state: WorldState): boolean;

// worldMatches/remapWorldState/wouldRemapLosslessly: people are clamped into (newWidth, newHeight)
// on remap, never causing a rejection — same treatment as mermaids (spec 016's research.md §9),
// for the same reason (a lone (x, y, variant) triple is always clampable with zero information loss).

export class HistoryManager {
  // beginAction/commitAction/undo/redo: signatures unchanged (already take PetsState since spec 016).
  beginAction(grid: Grid, objects: ObjectsState, pets: PetsState): void;
  commitAction(grid: Grid, objects: ObjectsState, pets: PetsState): void;
  undo(grid: Grid, objects: ObjectsState, pets: PetsState): boolean;
  redo(grid: Grid, objects: ObjectsState, pets: PetsState): boolean;
}
```

## `src/sim/save.ts`

```ts
export interface SavedWorld {
  version: number; // unchanged — SAVE_VERSION is NOT bumped
  width: number;
  height: number;
  state: WorldState;
  poodles: { x: number; y: number }[];
  mermaids: { x: number; y: number }[];
  people: { x: number; y: number; variant: PersonVariant }[]; // new
}

// serializeWorld: signature unchanged, output shape grows (reads pets.people).
export function serializeWorld(grid: Grid, objects: ObjectsState, pets: PetsState): string;

// deserializeWorld: signature unchanged.
// - a missing/malformed `people` field defaults to [] rather than rejecting the payload
//   (mirrors parseMermaids' existing list-level tolerance, research.md §10)
// - a legacy `byKind.person` list (old shape) is additionally read and migrated via
//   migrateLegacyPersonObjects, merged into the final people list, capped to PERSON_CAP
//   (FR-026, research.md §§8–10)
export function deserializeWorld(raw: string): SavedWorld | null;
```

## `src/sim/historySave.ts`

No new exported function. `WireHistoryStep`'s shape (internal, produced by
`encodeStep`) grows a `people` field alongside `byKind`/`mermaids`, falling
out of `WorldState`'s change above. `deserializeHistory` applies the same
missing-field-defaults-to-`[]` tolerance as `save.ts`, **and** the same
legacy `byKind.person` → `migrateLegacyPersonObjects` read for each stored
step (FR-026's "a stored undo history written before this feature must
migrate people"). `HISTORY_SAVE_VERSION` is NOT bumped.

## `src/lib/toolbarControls.ts`

**Unchanged** — `tool-person` already exists (spec 015). No entry added,
removed, or reordered; `shippedToolbarControls`'s signature and logic are
untouched (FR-002, FR-006).

## `src/lib/Toolbar.svelte`

`glyphFor(id: string): string` becomes dependent on a new prop:

```ts
export let personPictureSet: PersonPictureSet; // new prop, resolved once by the parent

// glyphFor's 'tool-person' case changes from a literal to:
case 'tool-person':
  return personPictureSet.toolbarGlyph;
```

No other case changes. The control's `ariaLabel` ("Person") and its
selection/click wiring (`onSelectTool('person')`) are unchanged.

## `src/lib/PlayArea.svelte` (shell wiring — no exported contract, listed for completeness)

- `OBJECT_GLYPHS: Record<ObjectKind, string>` loses its `person: '🧑'` entry
  (a compile-time-enforced consequence of `ObjectKind` losing `'person'`).
- `drawObjectGlyph`'s generic fallthrough branch no longer needs to consider
  `'person'` — it never reaches that function again.
- A new draw loop, styled exactly like the existing poodle/mermaid loops in
  `render()` (`ctx.save(); ctx.translate(...); if (facing === -1)
  ctx.scale(-1, 1); ...; ctx.restore();`), draws each `Person` using
  `personPictureSet.pictures[person.variant][frameFor(person.state)]`, where
  `frameFor` is the identity mapping `'standing'|'walking'|'running'` (state
  *is* frame — data-model.md). When `person.state === 'running' &&
  !personPictureSet.canRunPicture`, the loop instead plays an in-place hop
  bob (mirroring `flamingoHopAt`'s existing bob math) using the standing/
  walking picture, rather than drawing a running glyph.
- `handlePointerDown`: poke check extended with `pokePersonAt(petsState,
  pos.x, pos.y)` alongside the existing `pokePoodleAt`/`pokeMermaidAt`
  checks (same "before any painting/placing, every tool but the eraser"
  gate, FR-016); the batched-object-placement branch's tool list
  (`rainbow`/`unicorn`/`palm`/`flamingo`/`house`/`chest`) **drops** `person`
  — it moves to its own branch calling `addPerson(grid, petsState, pos.x,
  pos.y, personPictureSet.drawableVariants, Math.random)`, alongside the
  existing `tool === 'poodle'`/`tool === 'mermaid'` branches.
- `paintAt`'s `tool === 'eraser'` branch additionally calls
  `erasePeopleInBrush(Line)` alongside the existing
  `eraseMermaidsInBrush(Line)` call (FR-021).
- `resize()` calls `repositionPeople(petsState.people, newGrid, offsetX,
  offsetY)` alongside the existing `repositionPoodles`/`repositionMermaids`
  calls (FR-028).
- `saveNow`/`flushSave`/`tryRestore`: unchanged call shape
  (`serializeWorld(grid, objectsState, petsState)` /
  `deserializeWorld(raw)`), wider output/input per `save.ts` above;
  `tryRestore` rebuilds people from `saved.people` via
  `restorePeopleFromPositions`, the same way it rebuilds mermaids.
- `history.beginAction/commitAction/undo/redo` calls already pass
  `petsState` (spec 016) — no call-site signature change, just wider data
  flowing through it (FR-024).
- `clearAll()`/`loadScene()`: already call `clearPets(petsState)`, which now
  clears people too — no call-site change needed (FR-022).

## `src/App.svelte` (or equivalent top-level shell component)

- Computes `personPictureSet = resolvePersonPictureSet(createCanvasGlyphProbe(...))`
  once at startup (FR-020) and passes it as a prop to both `PlayArea.svelte`
  and `Toolbar.svelte` (FR-015).
