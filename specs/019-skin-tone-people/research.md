# Phase 0 Research: People In Every Skin Tone

The spec (`specs/019-skin-tone-people/spec.md`) already resolved its two open
questions in its own **Clarifications** section (FR-012's fixed
frame-ladder-then-tone-check order; FR-017's keep-stored/draw-default
substitution). Both are treated as given below — this document is the
implementation-level decisions this plan needed while reading the actual
spec 018 code (`src/lib/personGlyphs.ts`, `src/sim/pets.ts`, `types.ts`,
`history.ts`, `save.ts`, `historySave.ts`), each grounded in a concrete line
of existing code, not a guess.

## 1. Tone naming and the five modifier codepoints

**Decision**: `PersonTone` lives in `src/sim/types.ts` next to `PersonVariant`:

```ts
export type PersonTone = 'default' | 'light' | 'mediumLight' | 'medium' | 'mediumDark' | 'dark';
```

mapping to the Fitzpatrick modifiers in order: `light` = 🏻 (U+1F3FB),
`mediumLight` = 🏼 (U+1F3FC), `medium` = 🏽 (U+1F3FD), `mediumDark` = 🏾
(U+1F3FE), `dark` = 🏿 (U+1F3FF). `default` carries no modifier codepoint at
all — it *is* today's unmodified glyph (FR-001: default is a tone, not an
absence).

**Rationale**: mirrors `PersonVariant`'s existing naming style (readable
camelCase identifiers, not raw emoji or numeric Fitzpatrick-scale indices)
and needs no lookup table to reason about in code review — `mediumDark` reads
as what it is. Alternatives considered: Fitzpatrick numeric labels (`'I-II'`,
`'III'`, …) — rejected as meaningless to skim without cross-referencing a
chart; raw modifier codepoints as the type's string values — rejected
because it would put non-printing/hard-to-diff Unicode literals in type
signatures and diagnostics.

## 2. The 54-picture table is generated once, then pinned by literal-string tests

**Decision**: extend the existing `GLYPHS` table shape with a `composeToned`
helper used **only** at module scope (still zero per-frame/per-render
allocation — the table is built once when `personGlyphs.ts` is first
evaluated, exactly like today's 9-entry `GLYPHS` literal):

```ts
const TONE_MODIFIERS: Readonly<Record<Exclude<PersonTone, 'default'>, string>> = {
  light: '\u{1F3FB}', mediumLight: '\u{1F3FC}', medium: '\u{1F3FD}',
  mediumDark: '\u{1F3FE}', dark: '\u{1F3FF}',
};

/** Base, then tone modifier, then (gendered forms only) ZWJ + gender sign + VS16 — FR-005's
 *  order, enforced in exactly one place so it can never be assembled wrong at a second call site. */
function composePicture(variant: PersonVariant, tone: PersonTone, frame: PersonFrame): string { … }
```

`composePicture` builds every one of the 54 strings once, at load time, into
a literal-shaped `Record<PersonVariant, Record<PersonTone, Record<PersonFrame, string>>>`
constant (call it `TONED_GLYPHS`) that plays the same role `GLYPHS` plays
today. FR-004's "stated explicitly in one table" and FR-005's "verified by
test or review, not assumed" are satisfied by: (a) the table exists as one
named constant consumers read from, never reassembled at a draw or a probe
call site; and (b) `tests/unit/lib/personGlyphs.test.ts` pins the exact
codepoint sequence (base, then modifier, then ZWJ/gender/VS16) for a
representative sample spanning every variant × every tone × every frame
(54 literal-string assertions, or an equivalent per-codepoint composition
check), so a swapped modifier/ZWJ order fails a test immediately rather than
only showing up as a coloured square on a real device.

**Rationale**: hand-typing 54 emoji ZWJ sequences directly into source is the
exact mistake FR-004/FR-005 warn about (order is "the easiest thing here to
get wrong") — a generator with one composition function is less error-prone
than 54 independent literals, provided the generator's *output* is pinned by
test rather than trusted by construction. Alternative considered: hand-write
all 54 literals directly — rejected, since a single miskeyed sequence among
54 would be far harder to spot in review than one shared composition
function with a test asserting its output.

## 3. Tone-support resolution: extends `resolvePersonPictureSet`, runs after the existing ladder, checked against actually-drawn frames only

**Decision**: `resolvePersonPictureSet` keeps its existing three rungs
(gendered → neutral, standing → walking, running → hop) completely
unchanged, computing `drawableVariants` and the untoned `pictures[variant][frame]`
exactly as spec 018 left them. **Only then** does a new tone rung run,
against that already-resolved output — per FR-012's fixed order and the
clarification's "judge it on the pictures actually drawn":

1. For each `variant` in `drawableVariants` (already possibly just
   `['neutral']`), compute the *distinct set of base frames actually drawn*:
   `{'standing', 'walking', 'running'}` normally, or `{'walking', 'running'}`
   when `pictures[variant].standing === pictures[variant].walking` (rung 2
   already collapsed them — standing is never separately drawn there, so it
   is never separately tone-checked there either).
2. For each modifier tone (`light` … `dark`), and each `variant`/base-frame
   pair from step 1: compose `composePicture(variant, tone, frame)`, run the
   existing tofu check (`safeCanRender`) and a split-width check against
   `pictures[variant][frame]` (the already-resolved *untoned* picture for
   that exact frame and form — not a single reference glyph, per FR-010).
   The untoned width for a given `(variant, frame)` is computed once and
   reused across all five tones' checks against it (not re-measured per
   tone), keeping the added probe work linear in distinct-frames-drawn ×
   tones rather than quadratic (FR-016's "reduce the probe's own repeated
   work" instruction).
3. A tone is **usable** only if every one of those checks, across every
   drawable variant and every actually-drawn frame, passes (FR-011's
   all-or-nothing). `drawableTones = ['default', ...usable modifier tones]`
   — `'default'` is unconditionally present (FR-001, FR-013).
4. Build the toned `pictures` table (see §4) from `drawableTones` and
   `TONED_GLYPHS`.

Because step 1 excludes a frame that rung 2 already replaced with another
frame's picture, a tone whose *standing* picture would split is never even
checked when this device doesn't draw standing at all — exactly the
clarification's worked example (spec 018's idle-is-walking devices keep the
most tones). Where standing *is* drawn (not collapsed), it's included in
step 1's set like any other frame, so a tone whose toned stander splits is
still correctly dropped there (FR-011).

**Rationale**: reusing the already-resolved `pictures[variant][frame]` as
both "what frame is actually drawn" and "the untoned baseline to compare
against" makes the two clarification answers (fixed ordering; judge against
drawn pictures) fall out of one shared data structure instead of needing a
parallel "which frames does this device actually show" computation.

## 4. `PersonPictureSet.pictures` gains tone as a lookup dimension, with undrawable tones pre-substituted to default — no per-frame branch anywhere downstream

**Decision**: widen the existing `pictures` field by one dimension rather
than introducing a second parallel toned-pictures map:

```ts
export interface PersonPictureSet {
  readonly drawableVariants: readonly PersonVariant[];
  readonly drawableTones: readonly PersonTone[];       // new — always includes 'default'
  readonly pictures: Readonly<Record<PersonVariant, Readonly<Record<PersonTone, Readonly<Record<PersonFrame, string>>>>>>;
  readonly canRunPicture: boolean;
  readonly toolbarGlyph: string;                        // unchanged: pictures.neutral.default.standing
}
```

For every `variant` and every `tone` (including tones this device *cannot*
draw), `pictures[variant][tone][frame]` is always populated: when `tone` is
in `drawableTones`, it's the composed/resolved toned picture (itself falling
back the same way standing falls back to walking, per §3 step 1, if that's
what already happened for the untoned frame); when `tone` is **not**
drawable, `pictures[variant][tone][frame] := pictures[variant]['default'][frame]`
— a plain value copy computed once during resolution, not a runtime branch.

`frameFor` (in `personGlyphs.ts`) gains a `tone` parameter:
`frameFor(pictureSet, variant, tone, frame): string` — still a pure,
allocation-free lookup (FR-022), now three-dimensional instead of two. The
render call site in `PlayArea.svelte` passes `person.tone` through exactly
like it already passes `person.variant`, whether or not this device can
actually draw that tone — FR-017's "no per-frame branch and no allocation"
is satisfied because the substitution already happened once during
`resolvePersonPictureSet`, not on every draw call.

**Rationale**: this is the direct implementation of FR-017's "the
substitution MUST live in the resolved picture set" and FR-022's "direct
lookup … whether that is a third dimension … is the implementation's call" —
a third dimension, chosen here, keeps `frameFor`'s shape and every existing
call site's structure (just one more argument) rather than requiring a
combined `${variant}:${tone}` string key that would need per-call string
concatenation (violating Principle IV's allocation-free hot path).

## 5. Two independent bags: a new `personToneBag`, mirroring `personVariantBag` exactly

**Decision**: `PetsState` gains `personToneBag: PersonTone[]`, and
`pickPersonTone(state, drawableTones, rng)` is a byte-for-byte structural
twin of `pickPersonVariant` (Fisher-Yates shuffle into the bag when empty,
then pop), operating on the new field. `addPerson`'s signature grows one
parameter, `drawableTones: readonly PersonTone[]`, and calls both pickers:

```ts
export function addPerson(
  grid: Grid, state: PetsState, x: number, y: number,
  drawableVariants: readonly PersonVariant[],
  drawableTones: readonly PersonTone[],
  rng: () => number,
): void;
```

Both pickers consume the same injected `rng`, called as many times as each
shuffle needs — order between the two shuffles is whatever the
implementation happens to do first (variant, then tone, in the reference
implementation) and is treated as an implementation detail seeded tests pin
directly, not a spec requirement in itself. What FR-007 actually requires —
independence of the two cycles — falls out of using two separate bag arrays
and two separate shuffle calls, not from call order.

**Rationale**: identical structure to spec 018's proven bag mechanism means
zero new algorithmic risk; a single-element `drawableTones` (`['default']`
only) degenerates to "always default" for free, exactly like the existing
single-variant case (FR-013's "collapses to the default alone... no
special-casing").

## 6. `Person` gains one new, immutable field; restore, reposition, erase, and step are otherwise untouched

**Decision**: `Person.tone: PersonTone` (`readonly`, like `variant`).
`restorePeopleFromPositions` takes `{ x, y, variant, tone }` positions
instead of `{ x, y, variant }` and carries `tone` through verbatim (FR-002,
mirroring FR-012/FR-023's variant treatment exactly). `repositionPeople`,
`erasePeopleInBrush(Line)`, `pokePersonAt`, and `stepPeople` need **no
changes at all** — none of them read or write `variant` today, so none of
them need to read or write `tone` either; tone rides along on the `Person`
object passed through unmodified, exactly the way `id`/`homeX` already do.

**Rationale**: this is the smallest possible change surface — the spec is
explicit (FR-023) that frame selection, facing, cadence, poke, eraser,
cap, and remap are unchanged "beyond carrying tone along," and the existing
code's total lack of `variant` references outside `addPerson`/
`restorePeopleFromPositions`/rendering confirms there is nothing else to
touch.

## 7. Persistence: tone is tolerant *per person*, not gated into the existing per-list validity check

**Finding**: `save.ts`'s `isPersonShape`/`parsePeople` (and
`historySave.ts`'s equivalents) currently reject the **entire** `people`
list if any single entry fails `isPersonShape` (missing/invalid `x`, `y`, or
`variant`) — a whole-list-reject-on-any-malformed-item precedent, not a
per-item-skip one. FR-018 of *this* spec requires something stricter for
tone specifically: "an unrecognised or malformed tone reads as default **for
that person only**, and neither ever causes the whole payload — or any
other person in it — to be rejected."

**Decision**: `tone` is deliberately kept **outside** `isPersonShape`'s
boolean gate. `WirePerson`/`WireHistoryPerson` gain an optional
`tone?: unknown` field that is not part of the shape-validity check; a
separate small helper resolves it independently per already-shape-valid
item:

```ts
function isPersonTone(value: unknown): value is PersonTone {
  return value === 'default' || value === 'light' || value === 'mediumLight'
      || value === 'medium' || value === 'mediumDark' || value === 'dark';
}
function resolvedTone(raw: unknown): PersonTone {
  return isPersonTone(raw) ? raw : 'default';
}
```

`parsePeople`/`parseHistoryPeople` call `resolvedTone(item.tone)` when
building each entry, after `isPersonShape` has already accepted the item on
its existing (unchanged) `x`/`y`/`variant` criteria. A missing `people` key
entirely, or a non-array `people` value, still defaults the **whole list**
to `[]` — that pre-existing list-level tolerance (`mermaids`' precedent,
research.md §10 of spec 018) is untouched and is *not* what FR-018 is asking
this spec to change; FR-018's "tolerant optional field" promise is about the
`tone` key within an otherwise-valid person, not about resurrecting
malformed positions.

**Rationale**: keeping `x`/`y`/`variant` validation exactly as strict as it
already is (FR-025: no existing behaviour may be weakened) while adding a
genuinely more lenient per-field rule for the one new key is the only
reading that satisfies both FR-018 (new field, tolerant) and FR-025 (nothing
existing gets weaker or stricter). Folding `tone` into `isPersonShape`
instead would either (a) make one bad tone value reject an otherwise-valid
person's `x`/`y`/`variant` too (violating FR-018), or (b) require loosening
`isPersonShape`'s existing all-or-nothing semantics for `x`/`y`/`variant` as
a side effect (an unrelated, unrequested behavior change).

## 8. `history.ts`'s `worldMatches` gains a tone comparison alongside its existing variant one

**Decision**: the existing per-person loop in `worldMatches`
(`a.x !== b.x || a.y !== b.y || a.variant !== b.variant`) gains
`|| a.tone !== b.tone`. `captureWorldState`/`restoreWorldState`/
`remapWorldState` all already carry whatever shape `WorldState.people`'s
entries have (they don't destructure specific fields), so widening that
entry type to include `tone` is sufficient — no other line in `history.ts`
needs to change.

**Rationale**: this is FR-021 verbatim ("a difference in tone as a
difference"), and it's a one-line, mechanically obvious addition once
`WorldState.people`'s element type includes `tone` — flagged explicitly so
tasks.md doesn't miss it the way a purely mechanical type-widening pass
might (TypeScript won't force this addition; `a.tone !== b.tone` compiles
fine as dead code if forgotten, since the surrounding `if` only needs *some*
boolean).

## 9. Toolbar is provably unaffected — it already reads a fixed key

**Finding**: `Toolbar.svelte`'s `glyphFor('tool-person')` reads
`personPictureSet.toolbarGlyph`, itself always `pictures.neutral.standing`
(now `pictures.neutral.default.standing`) regardless of any tone logic.
Nothing in this feature changes what produces that value or what reads it.

**Decision**: no `Toolbar.svelte` change at all. `toolbarGlyph`'s assignment
in `resolvePersonPictureSet` moves from `pictures.neutral.standing` to
`pictures.neutral.default.standing` (a one-line consequence of §4's
reshaped `pictures`), and a test asserts this stays true across every
fabricated tone-probe outcome (FR-015, US3 Acceptance Scenario 7).

**Rationale**: confirms by inspection, rather than assumption, that FR-015
and FR-024 ("no new toolbar control") need zero UI-layer code changes —
only the resolver's internal indexing shifts.

## 10. Legacy people (spec-018 saves, and pre-018 migrated placed-objects) are always `tone: 'default'` — no probe access at parse time, mirroring spec 018's `variant: 'neutral'` precedent

**Decision**: exactly like spec 018's research.md §9 (migrated legacy people
are always `variant: 'neutral'`, chosen without probe access because parsing
is synchronous and canvas-free), a person restored from a spec-018 payload
(no `tone` key at all) or from a pre-018 `byKind.person` migration gets
`tone: 'default'` — via the same `resolvedTone(undefined) === 'default'`
path already described in §7, requiring no special-casing in
`migrateLegacyPersonObjects` itself (which never touches `tone` — it only
ever produced `{ x, y }`, and still only does).

**Rationale**: `'default'` is guaranteed representable on every device (it's
the unmodified glyph — always in `drawableTones`), so this can never produce
an undrawable person, satisfying FR-020 (spec-018 saves restore as
default-tone people) for free from the same tolerant-parse mechanism that
handles a same-shape save with a missing `tone` key.
