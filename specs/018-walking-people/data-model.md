# Phase 1 Data Model: People Who Stand, Walk, And Run

One new pet entity and one new resolved-capability value, both extending
existing shapes in `src/sim/` and `src/lib/`. No new storage system, no new
file beyond `src/lib/personGlyphs.ts` — everything else slots into
`types.ts`, `objects.ts`, `pets.ts`, `history.ts`, and `save.ts`'s
already-established patterns (see research.md for the reasoning behind each
choice below).

## Person (pet)

Lives in `PetsState`, alongside (not merged with) `Poodle` and `Mermaid`.
Not a grid element and not a `PlacedObject` — drawn over the grid, like every
existing pet.

```ts
export type PersonVariant = 'neutral' | 'man' | 'woman';
export type PersonState = 'standing' | 'walking' | 'running';

export interface Person {
  readonly id: number;
  x: number;
  y: number;
  facing: 1 | -1;
  /** Also the frame to draw — standing/walking/running map 1:1 to state (FR-010). */
  state: PersonState;
  /**
   * Overloaded like Poodle's/Mermaid's timer field, meaning depends on state:
   * 'standing' → frames left in the current pause before starting to walk;
   * 'walking'  → frames left in the current walk burst before pausing;
   * 'running'  → frames left in the poke reaction before returning to 'standing'.
   */
  timer: number;
  /** Which person this is — chosen once at placement (or migration), kept for life (FR-012). */
  readonly variant: PersonVariant;
  /** Where "home" is for roaming: set on each settle: walking stays within PERSON_ROAM_RANGE of it. */
  homeX: number;
  /** Which way the current walk burst is heading. */
  wanderDir: 1 | -1;
}

export interface PetsState {
  poodles: Poodle[];
  mermaids: Mermaid[];
  people: Person[];              // new
  /** Remaining shuffled drawable variants not yet used this cycle (research.md §4). */
  personVariantBag: PersonVariant[]; // new
  nextId: number;                // shared id counter, unchanged — no cross-kind collision
  stride: number;
}

/** At most three people; placing a fourth retires the oldest (FR-003). */
export const PERSON_CAP = 3;
```

**Validation / invariants**:
- `pets.people.length <= PERSON_CAP` at all times; `addPerson` evicts the
  oldest (`shift()`) before pushing a new one, exactly like `addPoodle`/
  `addMermaid`.
- `variant` is `readonly` at the type level — nothing in `stepPeople`,
  `pokePersonAt`, or any reposition/restore path ever reassigns it (FR-012).
  The only two places a `Person.variant` value is ever produced are
  `addPerson` (fresh placement, via the variant picker) and
  `restorePeopleFromPositions` (restore, using the saved/migrated value
  verbatim).
- `id` is unique across `poodles`, `mermaids`, **and** `people` (one shared
  `nextId` counter) — no cross-kind id collision is possible.
- A person's own grid cell is never made solid by her presence (FR-009) —
  `Person` carries no grid-element write of any kind; she is pure figure
  state, drawn on top.

**State transitions**:

```
placed                          → 'standing'  (settles via groundBelow next frame, like a poodle)
'standing', pause timer hits 0   → 'walking'   (timer = PERSON_WALK_BURST_FRAMES, pick direction)
'walking', burst timer hits 0    → 'standing'  (timer = PERSON_PAUSE_FRAMES)
'walking', blocked by a wall
  taller than she can step, or
  the edge of the roaming range   → turn around in place, stay 'walking' (not stuck — Edge Cases)
any non-busy state, direct poke   → 'running'  (timer = PERSON_RUN_DURATION)
poke arriving while
  timer > 0 already                → ignored (matches the poodle's/mermaid's identical rule)
'running', timer hits 0            → 'standing' (timer = PERSON_PAUSE_FRAMES — resumes fresh, not mid-burst)
any state, own cell becomes solid  → dig-out (one scoop/frame, state unchanged — no dedicated
                                      "digging" frame exists in the 3-picture family)
any state, left off the ground     → settles onto groundBelow's surface within a bounded number
                                      of frames (FR-007) — the same per-frame check that runs
                                      regardless of state
```

**Persistence shapes** (two independent wire formats already exist in this
codebase for two different purposes — people extend both, following the
`mermaids` precedent, plus one legacy-read path mermaids never needed):

| Format | File | Shape added | Restores to |
|---|---|---|---|
| Session save | `src/sim/save.ts` (`SavedWorld`/`WireWorld`) | `people?: { x: number; y: number; variant: PersonVariant }[]` (mirrors `mermaids`, plus `variant`) | Fresh people via `restorePeopleFromPositions` — position and variant trusted as-is, fresh `state: 'standing'`, `timer: 0` |
| Undo/redo history | `src/sim/history.ts` (`WorldState`) | `people: { x: number; y: number; variant: PersonVariant }[]` (new field, alongside the existing `mermaids` field added by spec 016) | Same `restorePeopleFromPositions` rule, applied inside `restoreWorldState` |
| Legacy migration (read-only) | Both of the above, plus `rawByKind.person` | Old `PlacedObject[]` footprints | `migrateLegacyPersonObjects` (see Objects section below) → position list, `variant: 'neutral'` always (research.md §9), merged into the `people` list above before capping to `PERSON_CAP` |

Both non-legacy formats are **position + variant only**: `state`/`timer`/
`homeX`/`wanderDir` are never persisted, matching the poodle's and mermaid's
existing "restored into a fresh pet with default activity" precedent.

## PersonPictureSet (resolved glyph capability)

Not a persisted entity — a plain value computed once per session by
`src/lib/personGlyphs.ts`'s `resolvePersonPictureSet`, held by the Svelte
shell and passed to both `PlayArea.svelte` (canvas) and `Toolbar.svelte`
(button). See research.md §§1–3 for the full fallback-ladder reasoning.

```ts
export type PersonFrame = 'standing' | 'walking' | 'running';

export interface PersonPictureSet {
  readonly drawableVariants: readonly PersonVariant[]; // ['neutral'] or ['neutral','man','woman']
  readonly pictures: Readonly<Record<PersonVariant, Readonly<Record<PersonFrame, string>>>>;
  readonly canRunPicture: boolean;   // false → poke reaction renders as a hop, not a glyph
  readonly toolbarGlyph: string;     // === pictures.neutral.standing after fallback (FR-015)
}
```

**Validation / derived rules**:
- `pictures[v].standing === pictures[v].walking` for every `v` whenever the
  standing picture for that family is undrawable (FR-019's idle-falls-back-
  to-walking rung) — this is a *value* equality the resolver guarantees, not
  something a consumer checks.
- `drawableVariants` is never empty — `'neutral'` is always present, the
  ladder's terminal safe rung.
- `pictures` always has all three top-level `PersonVariant` keys populated
  (even `man`/`woman` when undrawable), each pointing at whatever the
  resolver would show for that identity — but nothing in `addPerson`'s
  variant picker will ever choose a variant outside `drawableVariants`
  (§ below), so `pictures.man`/`pictures.woman` are simply unread on a
  device that only draws neutral.

**No caching field lives on `PersonPictureSet` itself** — "run at most once
per session" (FR-020) is enforced by calling `resolvePersonPictureSet`
exactly once at the application's top level and threading the single result
down, not by the resolver memoizing internally (research.md §2).

## Objects (legacy migration surface)

`src/sim/objects.ts`'s `ObjectKind`/`OBJECT_KINDS` lose `'person'` entirely
(FR-001, FR-009) — a person is never again a `PlacedObject`. The one new
export in this file exists purely to bridge an **old** save/history shape
into the new `Person` entity:

```ts
/**
 * Converts a legacy byKind.person list (from a save/history payload written
 * before this feature) into walker positions, and releases every footprint
 * cell those old objects stamped solid — unless a still-existing object of
 * another kind now covers that cell (research.md §8). Read-only: this
 * feature's own code never writes to the old shape again.
 */
export function migrateLegacyPersonObjects(
  grid: Grid,
  objects: ObjectsState,
  rawPersonList: readonly PlacedObject[],
): { x: number; y: number }[];
```

**Validation / invariants**:
- The returned list's length, after the caller merges it with any parsed
  `people` field and caps to `PERSON_CAP`, never exceeds 3 (FR-003, Edge
  Cases — "never produces more than three people").
- Every footprint cell released by this function becomes `EMPTY` unless
  `isCoveredByAnyObject`-equivalent logic (checked against the *current*,
  person-less `OBJECT_KINDS`) says otherwise — never leaves an orphaned
  solid `OBJECT` cell (FR-027).
- This function is called from `save.ts`'s `deserializeWorld` and
  `historySave.ts`'s `deserializeHistory` only — never from any live
  placement path, since a live `ObjectsState` can no longer contain a
  `'person'` kind at all once this feature ships.

## Variant picker

Not a stored entity — a small stateful helper colocated with `Person` in
`src/sim/pets.ts`, backed by the `PetsState.personVariantBag` field above.

```ts
/** Injectable-RNG shuffle-bag: reshuffles drawableVariants into the bag
 *  whenever empty, then pops one. A single-element drawableVariants list
 *  degenerates to "always that element" with no special-casing (research.md §4). */
export function pickPersonVariant(
  state: PetsState,
  drawableVariants: readonly PersonVariant[],
  rng: () => number,
): PersonVariant;
```

**Validation / invariants**:
- Within any run of `drawableVariants.length` consecutive calls (after the
  bag was last empty), every distinct value in `drawableVariants` appears
  exactly once (FR-013a, SC-005a).
- `rng` is always injected — production code passes `Math.random`, tests
  pass a seeded generator (FR-013a's "the randomness MUST be an injectable
  input").
