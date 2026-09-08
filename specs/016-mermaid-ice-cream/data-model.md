# Phase 1 Data Model: A Mermaid And Her Ice Cream

Two entities, both extending existing shapes in `src/sim/`. No new storage
system, no new file — everything below slots into `types.ts`, `pets.ts`,
`history.ts`, and `save.ts`'s already-established patterns.

## Ice cream (grid element)

Not a stored object — a value of `grid.elements[i]`, exactly like sand, water,
or a gumdrop. Lives entirely in the existing `Grid` typed arrays.

| Field | Where | Meaning |
|---|---|---|
| `ICE_CREAM = 11` | `src/sim/types.ts` | The grid-element id (FR-013). Reserved; 12/13 belong to a concurrently-filed feature and MUST NOT be touched. |
| `grid.elements[i] === ICE_CREAM` | `Grid.elements` (existing `Uint8Array`) | A cell holds ice cream. |
| `grid.hues[i]` | `Grid.hues` (existing `Uint8Array`) | The flavour colour, set to `randomHue()` at paint time — same mechanism as `GUMDROP`/`FLOWER`/`RAINBOW_SAND`. |

**Validation / derived rules**:
- `isSolid(ICE_CREAM) === true` (`src/sim/element.ts`) — it falls and rests
  like a solid, and other systems that check "is this cell solid" (grass
  growth eligibility, a mermaid's own-cell-burial check) treat it correctly
  with no separate case.
- `usesHueColor(ICE_CREAM) === true` (`src/sim/element.ts`) — required per
  FR-014 so history/save codecs (which key their one shared `colorAux` byte
  on this exact predicate) and the history test's `visibleSnapshot` helper
  pick `hues[i]` rather than `shades[i]` for this element.
- **State transitions**: `EMPTY/FOG/WATER → ICE_CREAM` (painted, brush.ts,
  mirrors the gumdrop paint case) → falls via the existing `stepGumdrop` rule
  (moves into `EMPTY` below it, swaps into `WATER`/`FOG` below it, otherwise
  rests) → `ICE_CREAM → EMPTY` when a mermaid eats it, or when the eraser (or
  clear-all, or a scene load) removes it. It never self-transitions (no
  timer, no melt, no float — FR-015).
- **Relationships**: consumed by exactly one entity kind (Mermaid, below).
  Participates in the shared `Grid` arrays a mermaid's `cellIsIceCream`
  predicate reads directly — no separate registry of "where is the ice
  cream," same as gumdrops today.

## Mermaid (pet)

Lives in `PetsState`, alongside (not merged with) `Poodle`. Not a grid
element — drawn over the grid, like every existing pet/object.

```ts
export type MermaidState = 'resting' | 'drifting' | 'swimming' | 'eating' | 'freeing' | 'tricking';

export interface Mermaid {
  readonly id: number;
  x: number;
  y: number;
  facing: 1 | -1;
  state: MermaidState;
  /** Frames remaining in a busy state (eating/tricking/freeing); 0 means free to act. */
  timer: number;
  /** Ice cream she is currently pursuing, or -1/-1 if none. */
  pursuitX: number;
  pursuitY: number;
  /** Smallest Chebyshev distance to (pursuitX, pursuitY) reached so far this pursuit. */
  pursuitBestDist: number;
  /** Frames since pursuitBestDist last improved — the give-up clock (FR-019). */
  pursuitStaleFrames: number;
  /** Frames remaining during which ice-cream scent is ignored, after giving up on an unreachable one. */
  iceCreamCooldown: number;
  /** Where "home" is for drifting: set on each settle; drifting stays within MERMAID_DRIFT_RANGE of it. */
  homeX: number;
  homeY: number;
  /** Which way the current drift is heading. */
  driftDir: 1 | -1;
}

export interface PetsState {
  poodles: Poodle[];
  mermaids: Mermaid[];        // new
  nextId: number;              // shared id counter, unchanged — a poodle and a mermaid never collide
  stride: number;
}
```

**Validation / invariants**:
- `pets.mermaids.length <= MERMAID_CAP` (3, FR-002) at all times; `addMermaid`
  evicts the oldest (`shift()`) before pushing a new one, exactly like
  `addPoodle`.
- While reachable water exists, `grid.elements[round(y) * width + round(x)]
  === WATER` (FR-004/FR-005) is true for every mermaid whose `state` is
  `'drifting'` or `'swimming'`. It is deliberately *not* an invariant for
  `'resting'` (no water anywhere yet — FR-008) or `'freeing'` (mid-escape from
  burial — FR-009); those two states are the documented, non-alarming
  exceptions the spec's Edge Cases section calls out.
- `pursuitX/pursuitY` are always either both `-1` (not pursuing) or both a
  valid in-bounds coordinate holding `ICE_CREAM` at the moment they were set
  — they are cleared (`-1/-1`) the same frame the target is eaten, erased
  from under her, or given up on, so a stale target can never be read.
- `id` is unique across **both** `poodles` and `mermaids` (shared `nextId`
  counter) — no cross-kind id collision is possible, same guarantee
  `resyncNextId`-style logic gives `ObjectsState`.

**State transitions** (mirrors the shape of `PoodleState`'s transitions, see
`src/sim/pets.ts`'s existing `stepPoodle` for the poodle's version):

```
placed on water        → 'drifting'
placed off water,
  water found nearby    → 'drifting'  (snapped into that water first)
placed off water,
  none found            → 'resting'
'resting', water
  reaches her cell       → 'drifting'
'drifting'/'swimming',
  ice cream in scent     → 'swimming' (pursuing)
'swimming', reaches
  ice cream               → 'eating' (timer = MERMAID_EAT_DURATION)
'swimming', gives up
  (patience exceeded)     → 'drifting' (+ iceCreamCooldown set)
'eating', timer hits 0    → 'drifting'
any state, own cell
  becomes solid            → 'freeing' (until a nearby non-solid cell is found)
'freeing', freed            → 'drifting' or 'resting' (water vs. not, at the freed cell)
any non-busy state,
  direct poke                → 'tricking' (timer = MERMAID_TRICK_DURATION)
'tricking', timer hits 0     → 'drifting' (or 'resting', whichever her cell now is)
```

A poke arriving while `timer > 0` (already `'eating'`/`'freeing'`/
`'tricking'`) is ignored (FR-011, ignoring not interrupting — matches the
poodle's identical rule).

**Persistence shapes** (two independent wire formats already exist in this
codebase for two different purposes — mermaids extend both):

| Format | File | Shape added | Restores to |
|---|---|---|---|
| Session save | `src/sim/save.ts` (`SavedWorld`/`WireWorld`) | `mermaids: { x: number; y: number }[]` (mirrors the existing `poodles` field exactly) | Fresh mermaids via the same "position only, default activity" rule `addMermaid`-adjacent restore logic uses (no re-search for water — a saved position is trusted valid) |
| Undo/redo history | `src/sim/history.ts` (`WorldState`) | `mermaids: { x: number; y: number }[]` (new — no pet data existed in `WorldState` before this feature) | Same "position only, default activity" rule, applied inside `restoreWorldState` |

Both are **position-only**: a mermaid's `state`/`timer`/pursuit bookkeeping is
never persisted, matching the spec's Key Entities note ("restored into a
fresh pet with default activity") and the poodle's own existing precedent
(`WirePoodle` is `{x, y}` only, `state` is likewise never saved for poodles
today).

## Pool / connected water

Explicitly **not** a stored entity (per the spec's own Key Entities section
and research.md §1) — no `Pool` type, no pool-id field anywhere. "Which pool
a mermaid is in" is emergent from the invariant that she only ever steps
between adjacent `WATER` cells; nothing computes or caches pool membership.
