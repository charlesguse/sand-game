# Contract: Skin-tone people (extends `specs/018-walking-people/contracts/sim-and-shell-contracts.md`)

This project has no network API. As in every prior spec's contracts file,
the interface contract that matters is the boundary between the
framework-free simulation core (`src/sim/*`), the UI-layer helpers
(`src/lib/*`), the Svelte shell that calls both, and the `vitest` unit tests
that exercise `src/sim/*`/`src/lib/*` functions directly with no DOM
(constitution Principle V, FR-026). This document is purely
additive/widening: every function/type in spec 018's contract not mentioned
here is **unchanged**.

## `src/sim/types.ts`

```ts
export type PersonTone = 'default' | 'light' | 'mediumLight' | 'medium' | 'mediumDark' | 'dark'; // new
// PersonVariant, Tool, ObjectKind: unchanged.
```

## `src/lib/personGlyphs.ts`

```ts
export interface PersonPictureSet {
  readonly drawableVariants: readonly PersonVariant[];               // unchanged
  readonly drawableTones: readonly PersonTone[];                     // new — always includes 'default'
  readonly pictures: Readonly<Record<PersonVariant, Readonly<Record<PersonTone, Readonly<Record<PersonFrame, string>>>>>>; // widened
  readonly canRunPicture: boolean;                                   // unchanged
  readonly toolbarGlyph: string;                                     // unchanged meaning: pictures.neutral.default.standing
}

/** Frame selection as a pure function of state, variant, tone, and the resolved picture set —
 *  widened from (pictureSet, variant, frame) to (pictureSet, variant, tone, frame); still a direct
 *  lookup, still allocation-free (FR-022). */
export function frameFor(
  pictureSet: PersonPictureSet,
  variant: PersonVariant,
  tone: PersonTone,
  frame: PersonFrame,
): string;

/** Pure, DOM-free resolution, now covering all 54 (variant, tone, frame) pictures (FR-004,
 *  FR-009). Existing gendered/standing/running rungs are unchanged; a new tone rung runs after
 *  them, checked only against the frames those rungs actually resolved to draw (FR-012,
 *  research.md §3). Each probe call remains independently guarded, so a thrown/garbage result
 *  degrades only the one picture it was asked about (FR-016, research.md §7 of spec 018). */
export function resolvePersonPictureSet(probe: GlyphProbeInputs): PersonPictureSet;

// GlyphProbeInputs, createCanvasGlyphProbe, WALK_GLYPH_NATIVE_FACING: unchanged.
```

## `src/sim/pets.ts`

```ts
export interface Person {
  readonly id: number;
  x: number;
  y: number;
  facing: 1 | -1;
  state: PersonState;
  timer: number;
  readonly variant: PersonVariant;
  readonly tone: PersonTone;              // new
  homeX: number;
  wanderDir: 1 | -1;
}

export interface PetsState {
  poodles: Poodle[];
  mermaids: Mermaid[];
  people: Person[];
  personVariantBag: PersonVariant[];
  personToneBag: PersonTone[];            // new
  nextId: number;
  stride: number;
}

/** Injectable-RNG shuffle-bag tone chooser (FR-006, FR-008, research.md §5) — structurally
 *  identical to pickPersonVariant, operating on state.personToneBag. */
export function pickPersonTone(
  state: PetsState,
  drawableTones: readonly PersonTone[],
  rng: () => number,
): PersonTone;

/** Widened: picks both a variant and a tone (independently, via pickPersonVariant/pickPersonTone)
 *  at placement; everything else about placement (settling, cap eviction) is unchanged. */
export function addPerson(
  grid: Grid,
  state: PetsState,
  x: number,
  y: number,
  drawableVariants: readonly PersonVariant[],
  drawableTones: readonly PersonTone[],   // new parameter
  rng: () => number,
): void;

/** Widened: positions now carry tone alongside variant; tone is carried through verbatim, never
 *  re-picked (FR-002, FR-017). */
export function restorePeopleFromPositions(
  state: PetsState,
  positions: readonly { x: number; y: number; variant: PersonVariant; tone: PersonTone }[],
): void;

// pickPersonVariant, stepPeople, pokePersonAt, repositionPeople, erasePeopleInBrush(Line),
// clearPets, stepPets, PERSON_CAP: unchanged signatures and behavior — none of them read or
// write tone (research.md §6, FR-023).
```

## `src/sim/history.ts`

```ts
export interface WorldState {
  readonly elements: Uint8Array;
  readonly colorAux: Uint8Array;
  readonly cloud: Uint8Array;
  readonly glitter: Uint8Array;
  readonly grassHeight: Uint8Array;
  readonly byKind: Record<ObjectKind, PlacedObject[]>;
  readonly mermaids: { x: number; y: number }[];
  readonly people: { x: number; y: number; variant: PersonVariant; tone: PersonTone }[]; // widened
}

// captureWorldState/restoreWorldState/remapWorldState/wouldRemapLosslessly: signatures unchanged
// — they carry the People entry's shape through structurally, without destructuring specific
// fields, so widening the element type is sufficient (research.md §8).

// worldMatches: the existing per-person loop gains one comparison —
//   if (a.x !== b.x || a.y !== b.y || a.variant !== b.variant || a.tone !== b.tone) return false;
// (FR-021, research.md §8) — otherwise unchanged.

export class HistoryManager {
  // beginAction/commitAction/undo/redo: signatures unchanged.
}
```

## `src/sim/save.ts`

```ts
// WirePerson (internal): gains an optional, independently-tolerant tone field.
interface WirePerson {
  x: number;
  y: number;
  variant: PersonVariant;
  tone?: PersonTone;   // new — absent/malformed resolves to 'default' for this person only (FR-018)
}

// SavedWorld.people: widened element type mirrors WirePerson, with tone always resolved
// (never left optional) after parsing:
export interface SavedWorld {
  version: number;        // unchanged — SAVE_VERSION is NOT bumped (FR-019)
  width: number;
  height: number;
  state: WorldState;
  poodles: { x: number; y: number }[];
  mermaids: { x: number; y: number }[];
  people: { x: number; y: number; variant: PersonVariant; tone: PersonTone }[]; // widened
}

// serializeWorld/deserializeWorld: signatures unchanged.
// - isPersonShape's x/y/variant validity gate is UNCHANGED (still whole-list-reject on a bad
//   x/y/variant, per spec 018's existing precedent — FR-025 forbids weakening this).
// - tone is resolved per already-shape-valid item via a new, separate helper
//   (`resolvedTone(item.tone)` — 'default' on missing/unrecognised/malformed), never folded into
//   isPersonShape's boolean gate, so one bad tone value never rejects its person, let alone the
//   whole list (FR-018, research.md §7).
export function serializeWorld(grid: Grid, objects: ObjectsState, pets: PetsState): string;
export function deserializeWorld(raw: string): SavedWorld | null;
```

## `src/sim/historySave.ts`

No new exported function. `WireHistoryPerson`'s shape gains the same
optional `tone?: PersonTone` field as `WirePerson`, resolved by the same
`resolvedTone` helper, with the same "never gates `isWireHistoryPersonShape`"
rule as `save.ts` above. `HISTORY_SAVE_VERSION` is NOT bumped.

## `src/lib/toolbarControls.ts`, `src/lib/Toolbar.svelte`

**Unchanged.** `glyphFor('tool-person')` continues to return
`personPictureSet.toolbarGlyph`; the value that constant resolves to
(`pictures.neutral.default.standing`) changes internally, but the prop
shape and the read site do not (FR-015, FR-024, research.md §9).

## `src/lib/PlayArea.svelte` (shell wiring — no exported contract, listed for completeness)

- The render loop's picture lookup widens from
  `frameFor(personPictureSet, person.variant, person.state)` to
  `frameFor(personPictureSet, person.variant, person.tone, person.state)` —
  the one call site spec 018 established, now passing one more field
  straight off the `Person` object (no branch, no lookup-outside-the-set).
- `addPerson(...)`'s call site gains `personPictureSet.drawableTones` as a
  new argument, positioned alongside the existing
  `personPictureSet.drawableVariants` one.
- `saveNow`/`flushSave`/`tryRestore`: unchanged call shape; `tryRestore`
  rebuilds people via `restorePeopleFromPositions`, now also passing through
  each restored person's `tone` (wider input type only).
- `resize()`, `handlePointerDown`'s poke/erase branches, `clearAll()`,
  `loadScene()`: **no changes** — none of them reference `variant` today, so
  none of them need to reference `tone` (research.md §6).

## `src/App.svelte`

- `resolvePersonPictureSet(createCanvasGlyphProbe(...))`'s one call site is
  unchanged in shape; its result now carries the tone dimension, still
  computed exactly once per session (FR-016) and passed to both
  `PlayArea.svelte` and `Toolbar.svelte` as before.
