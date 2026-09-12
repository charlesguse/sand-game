# Phase 1 Data Model: People In Every Skin Tone

One new field on the existing `Person` pet entity, one new independent bag
on `PetsState`, and one new dimension on the existing resolved-capability
value (`PersonPictureSet`). No new storage system, no new file, no new
top-level entity — everything slots into `src/sim/types.ts`, `pets.ts`,
`history.ts`, `save.ts`, `historySave.ts`, and `src/lib/personGlyphs.ts`'s
already-established spec-018 shapes (see research.md for the reasoning
behind each choice below).

## Tone

```ts
// src/sim/types.ts
export type PersonTone = 'default' | 'light' | 'mediumLight' | 'medium' | 'mediumDark' | 'dark';
```

- Six values, `'default'` included as a first-class member, never a "no
  tone" sentinel excluded from any list that iterates tones (FR-001).
- Corresponds 1:1 to Unicode's Fitzpatrick modifiers: `light` = 🏻,
  `mediumLight` = 🏼, `medium` = 🏽, `mediumDark` = 🏾, `dark` = 🏿; `default`
  is the unmodified base glyph (research.md §1).

## Person (extends the spec-018 pet entity)

```ts
export interface Person {
  readonly id: number;
  x: number;
  y: number;
  facing: 1 | -1;
  state: PersonState;
  timer: number;
  readonly variant: PersonVariant;
  /** Which skin tone this is — chosen once at placement (or migration), kept for life (FR-002). */
  readonly tone: PersonTone;                 // new
  homeX: number;
  wanderDir: 1 | -1;
}

export interface PetsState {
  poodles: Poodle[];
  mermaids: Mermaid[];
  people: Person[];
  personVariantBag: PersonVariant[];
  /** Remaining shuffled drawable tones not yet used this cycle — independent of personVariantBag (FR-007). */
  personToneBag: PersonTone[];               // new
  nextId: number;
  stride: number;
}
```

**Validation / invariants** (all additive to spec 018's existing ones,
unchanged otherwise — research.md §6):

- `tone` is `readonly` at the type level; the only two places a
  `Person.tone` value is ever produced are `addPerson` (fresh placement, via
  the tone picker) and `restorePeopleFromPositions` (restore, using the
  saved/migrated value verbatim) — exactly mirroring `variant`'s existing
  two production sites (FR-002).
- `repositionPeople`, `erasePeopleInBrush(Line)`, `pokePersonAt`, and
  `stepPeople` require **no code changes**: none of them inspect `variant`
  today, so none of them need to inspect `tone` either (FR-023).
- A person's own grid cell is still never made solid by her presence —
  unaffected by this feature (spec 018 FR-009, unchanged).

**State transitions**: unchanged from spec 018's `PersonState` machine
(`standing` ⇄ `walking`, poke → `running` → `standing`) — tone is not part
of any transition and is never read by `stepPeople`/`pokePersonAt` (FR-023).

**Persistence shapes** (both existing wire formats gain one optional field
each, following the `mermaids`/`people` precedent exactly — no new key, no
version bump):

| Format | File | Shape added | Restores to |
|---|---|---|---|
| Session save | `src/sim/save.ts` (`WirePerson`) | `tone?: unknown` — resolved to `PersonTone` per-item via `resolvedTone()`, independently of `x`/`y`/`variant` validity (research.md §7) | `restorePeopleFromPositions` — tone trusted as resolved (`'default'` if absent/malformed), fresh `state: 'standing'`, `timer: 0`, exactly like `variant` |
| Undo/redo history | `src/sim/history.ts` (`WorldState.people` entries) | same `{ x, y, variant, tone }` shape, produced by `historySave.ts`'s equivalent resolver | Same `restorePeopleFromPositions` rule, applied inside `restoreWorldState` |
| Legacy migration (read-only) | `save.ts`/`historySave.ts`'s `rawByKind.person` path | No `tone` concept existed; `migrateLegacyPersonObjects` still only returns `{ x, y }` | `tone` defaults to `'default'` via the same `resolvedTone(undefined)` path used for a missing key — no special-casing added to `migrateLegacyPersonObjects` itself (research.md §10) |

A spec-018 payload (has `variant`, no `tone` key at all) restores identically
to a payload with an explicit `tone: 'default'` — both produce
`resolvedTone(undefined) === 'default'` (US4).

## PersonPictureSet (resolved glyph capability — extends spec 018's shape)

Not a persisted entity — a plain value computed once per session by
`src/lib/personGlyphs.ts`'s `resolvePersonPictureSet`, held by the Svelte
shell and passed to both `PlayArea.svelte` (canvas) and `Toolbar.svelte`
(button), exactly as spec 018 left it. This feature widens its shape, not
its call sites' contract.

```ts
export interface PersonPictureSet {
  readonly drawableVariants: readonly PersonVariant[];
  /** Which tones this device can draw as a single figure across every drawable variant and every
   *  frame actually shown (FR-011/FR-012). Always includes 'default' (FR-001, FR-013). */
  readonly drawableTones: readonly PersonTone[];                              // new
  /** Resolved glyph per (variant, tone, frame). An undrawable tone's entries are pre-substituted
   *  to that variant's 'default'-tone pictures at resolution time — a direct lookup here never
   *  branches on drawableTones (FR-017, FR-022). */
  readonly pictures: Readonly<Record<PersonVariant, Readonly<Record<PersonTone, Readonly<Record<PersonFrame, string>>>>>>;
  readonly canRunPicture: boolean;
  /** Unchanged in meaning: === pictures.neutral.default.standing after fallback (FR-015). */
  readonly toolbarGlyph: string;
}
```

**Validation / derived rules** (additive to spec 018's existing ones):

- `drawableTones[0]` is not guaranteed to be `'default'` positionally, but
  `'default'` is always a member (order is otherwise resolution-order, not
  meaningful).
- For every `variant`, every `tone` **not** in `drawableTones`, and every
  `frame`: `pictures[variant][tone][frame] === pictures[variant]['default'][frame]`
  — a value-equality invariant the resolver guarantees once, not something a
  consumer (render loop, `frameFor`) ever checks (FR-017).
- For every `variant` and `tone` (drawable or not), `pictures[variant][tone].standing === pictures[variant][tone].walking`
  whenever `pictures[variant].default.standing === pictures[variant].default.walking`
  (i.e., whenever spec 018's rung 2 already collapsed standing into walking
  for the untoned picture) — the toned standing slot inherits the same
  collapse rather than being independently probed (research.md §3, FR-012's
  fixed ordering).
- `pictures` always has all six top-level `PersonTone` keys populated under
  every `PersonVariant` key, even when `drawableTones` excludes some of them
  — nothing in `addPerson`'s tone picker will ever choose a tone outside
  `drawableTones` (see Tone bag below), so an undrawable tone's *entry* in
  `pictures` is only ever reached via a **restored** person whose stored
  tone this device can't draw (FR-017's actual use case), never via a fresh
  placement.

**No caching field lives on `PersonPictureSet` itself** — "run at most once
per session" (FR-016) is enforced the same way spec 018 already enforces it
for the untoned ladder: one call site, one held result, not internal
memoization (research.md §3 of spec 018, unchanged).

## Tone bag

Not a stored entity — a small stateful helper colocated with `Person` in
`src/sim/pets.ts`, backed by the `PetsState.personToneBag` field above,
structurally identical to the existing variant picker.

```ts
/** Injectable-RNG shuffle-bag: reshuffles drawableTones into the bag whenever empty, then pops
 *  one. A single-element drawableTones list ('default' only) degenerates to "always default"
 *  with no special-casing (FR-013, mirrors pickPersonVariant exactly). */
export function pickPersonTone(
  state: PetsState,
  drawableTones: readonly PersonTone[],
  rng: () => number,
): PersonTone;
```

**Validation / invariants**:

- Within any run of `drawableTones.length` consecutive calls (after the bag
  was last empty), every distinct value in `drawableTones` appears exactly
  once (FR-006, SC-001).
- Independent of `personVariantBag`/`pickPersonVariant` — the two bags never
  share state, and exhausting one's cycle has no effect on the other's
  position in its own cycle (FR-007, SC-001).
- `rng` is always injected — production code passes `Math.random`, tests
  pass a seeded generator (FR-008).

## addPerson (widened signature)

```ts
export function addPerson(
  grid: Grid,
  state: PetsState,
  x: number,
  y: number,
  drawableVariants: readonly PersonVariant[],
  drawableTones: readonly PersonTone[],        // new parameter
  rng: () => number,
): void;
```

Picks both a variant (via `pickPersonVariant`) and a tone (via
`pickPersonTone`) at placement, using the same injected `rng` for both
shuffles; assigns both to the new `Person`'s `readonly variant`/`readonly
tone` fields, never revisited afterward (FR-002, FR-003).
