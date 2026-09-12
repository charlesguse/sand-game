# Phase 0 Research: People Who Stand, Walk, And Run

The spec (specs/018-walking-people/spec.md) already resolved its major open
questions in its own **Clarifications** and **Assumptions** sections (random
no-repeat variant cycle, poke → brief sprint with a hop fallback, idle falls
back to walking not to 🧑, mermaid undo precedent, cap of 3, no version bump).
Those are treated as given below. What follows are the implementation-level
decisions this plan needed while reading the actual codebase
(`src/sim/pets.ts`, `objects.ts`, `history.ts`, `save.ts`, `historySave.ts`,
`src/lib/PlayArea.svelte`, `Toolbar.svelte`, `fullscreen.ts`) — each a real
design choice, not a guess, and each grounded in a concrete line of existing
code.

## 1. The glyph probe is entirely new infrastructure — no code to extend

**Finding**: a full-repo search (`measureText`, `tofu`, glyph-probe-style
names, canvas emoji-detection idioms) turns up nothing outside this spec's
own prose. There is no existing font-capability detector, no
`document.fonts` usage, no "does this platform support X emoji" helper
anywhere in `src/lib` or `src/sim`.

**Decision**: build `src/lib/personGlyphs.ts` from scratch, following the one
architectural precedent that *does* exist for "a pure function over an
injected browser capability, unit-tested with no DOM": `src/lib/fullscreen.ts`
(`isFullscreenSupported(element: FullscreenElement)`, an interface the caller
implements against the real `document`/`Element` at the one production call
site, and against plain objects in tests). The probe takes an injected
capability object rather than touching `document`/`canvas` itself:

```ts
export interface GlyphProbeInputs {
  /** True if `glyph` renders as a real figure rather than an empty/tofu box —
   *  production impl renders it and a known-unassigned codepoint to an
   *  off-screen canvas and compares. */
  canRender(glyph: string): boolean;
  /** Mirrors CanvasRenderingContext2D.measureText(text).width — used to
   *  detect a split ZWJ sequence (gendered width ≈ 2x the base glyph's). */
  measureWidth(text: string): number;
}
```

**Rationale**: this is the only shape that satisfies FR-018 ("a pure
function that takes the measuring and rendering capability as injected
inputs ... unit-testable with no DOM and no browser harness") while reusing
an established pattern instead of inventing a new one.

## 2. One resolver, one output type, shared by canvas and toolbar (FR-015)

**Decision**: `resolvePersonPictureSet(probe: GlyphProbeInputs):
PersonPictureSet` is the single function both the canvas renderer and
`Toolbar.svelte` consume. Its result is computed once (by `App.svelte` or
`PlayArea.svelte` at startup, against the real canvas-backed
`GlyphProbeInputs`) and passed down as a plain value/prop — the "run at most
once per session" requirement (FR-020) is an *architectural* guarantee (one
call site, one result held in a variable/store) rather than something the
pure resolver function enforces internally. Keeping the resolver itself
side-effect-free and un-memoized is what makes it exhaustively unit-testable
per FR-018's required case list without fighting an internal cache.

**Rationale**: FR-015 requires the button and the canvas figures to never
disagree about who a person is; a single resolved value consumed by both is
the only way to make that true by construction rather than by convention (the
current code, by contrast, has `OBJECT_GLYPHS.person` in `PlayArea.svelte`
and a separate literal in `Toolbar.svelte`'s `glyphFor` switch that happen to
agree today with nothing enforcing it — exactly the seam this feature must
close).

**Output shape**:

```ts
export type PersonVariant = 'neutral' | 'man' | 'woman';
export type PersonFrame = 'standing' | 'walking' | 'running';

export interface PersonPictureSet {
  /** Which variants this device can draw as a single figure — either
   *  ['neutral'] or ['neutral', 'man', 'woman'] (FR-014: all-or-nothing). */
  readonly drawableVariants: readonly PersonVariant[];
  /** Resolved glyph per (variant, frame), fallback ladder already applied —
   *  a consumer never branches on availability, only reads. */
  readonly pictures: Readonly<Record<PersonVariant, Readonly<Record<PersonFrame, string>>>>;
  /** False if the running picture had to be dropped for every variant — the
   *  poke reaction must render as a hop instead (FR-016a/FR-019). */
  readonly canRunPicture: boolean;
  /** Same value as pictures.neutral.standing after fallback — the toolbar
   *  button's glyph (FR-015). */
  readonly toolbarGlyph: string;
}
```

## 3. The fallback ladder, rung by rung, and one gap the spec leaves open

**Decision** (mirrors FR-019 exactly, plus one explicit judgment call):

1. **Gendered → neutral (whole-device, all-or-nothing)**: probe all 6
   gendered glyphs (man/woman × standing/walking/running) for both tofu
   (`canRender`) and split (`measureWidth(gendered) ≈ 2 × measureWidth(base)`,
   threshold `> 1.5×`). If **any** of the 6 fails either check,
   `drawableVariants = ['neutral']`. This is checked as one bundle, not
   per-frame, because FR-012 requires a variant to look consistent across
   every frame — offering "woman standing" but not "woman running" would
   itself be a same-figure-continuity violation, so a single bad rung
   disqualifies the whole gendered family.
2. **Standing missing → walking, per family**: for whichever family
   (neutral, and separately man/woman if drawable) has a tofu standing
   glyph, `pictures[variant].standing` is set to that same family's
   (already-resolved) walking glyph. This is why `pictures` stores resolved
   strings rather than "is available" flags — a renderer never needs to know
   *why* standing equals walking, only that it does.
3. **Running missing → hop, globally**: if the running picture is tofu for
   the resolved family/families, `canRunPicture = false` and no glyph
   substitution happens for it (there is nothing sensible to substitute a
   *moving* picture with) — the render layer instead plays the flamingo-style
   in-place hop animation for the poke reaction. This is a rendering
   decision, not a glyph one, so it lives as a boolean flag, not a string.
4. **Walking missing — no defined rung (flagged, not guessed)**: FR-017(a)
   requires probing walking for tofu same as standing and running, but
   FR-019's ladder defines no fallback if walking itself fails, because the
   spec's own Assumptions section treats it as old enough to be safe
   everywhere and only "covers it anyway" defensively. If it somehow fails,
   this plan's judgment call is: **do not reintroduce 🧑** (explicitly banned
   as an idle frame by FR-019) and do not invent an unspecified fourth rung
   — `pictures[variant].walking` (and therefore `.standing`, which cascades
   from it) is simply the raw, unresolved walking glyph, shown best-effort.
   **Flagged in the issue comment as a decision made without clarification**:
   the spec does not say what should happen here, and this is the
   conservative "never show the banned glyph, never invent new fallback
   prose" choice.
5. **Probe unavailable entirely (FR-020)**: if the injected `canRender`/
   `measureWidth` throw, `resolvePersonPictureSet` catches at the
   individual-glyph-check level (not around the whole function) so a
   thrown/garbage result for one glyph degrades only that glyph's rung
   rather than the entire picture set — e.g., a measurer that throws only on
   the running glyph still resolves standing/walking normally. This is a
   stronger, more forgiving reading of "the probe cannot run at all" than a
   single try/catch around everything would give, and is one of FR-018's
   explicitly required test cases ("a measurer that fails or returns
   nonsense").

## 4. Variant selection: a shuffled bag over `drawableVariants`, no special-casing the single-variant case

**Decision**: `createVariantPicker(rng: () => number)` returns a closure
holding a mutable remaining-bag; `next(drawableVariants): PersonVariant`
Fisher-Yates-shuffles `drawableVariants` into the bag whenever it's empty
(using the injected `rng`, mirroring the reservoir-sampling `Math.random()`
call sites already in `pets.ts`, but injectable here per FR-013a), then pops
one entry per call.

**Rationale**: when `drawableVariants` is `['neutral']` (gendered forms
unsupported), a shuffle of a one-element array trivially yields that element
every time — the Edge Cases section's "the no-repeat rule collapses
harmlessly to always neutral" falls out of the general algorithm for free,
with no `if (drawableVariants.length === 1)` branch needed anywhere. The bag
lives on `PetsState` (`PetsState.personVariantBag: PersonVariant[]`) so a
fresh `createPetsState()` — used by every test — starts with an empty bag
and reshuffles on first placement, keeping tests hermetic without needing to
reset any module-level singleton.

## 5. Person's per-frame step reuses poodle primitives, drops everything pursuit-related

**Decision**: `stepPeople(grid, pets)` (no `target` parameter — mirrors
`stepMermaids`'s signature, since FR-006 means a person never receives a
finger target at all) reuses, unmodified: `groundBelow` (ground-following
settle), the `MAX_CLIMB`-bounded ledge-step/turn-around check, and a
scoop-per-frame dig-out when buried (all currently private to `stepPoodle`
in `src/sim/pets.ts` — exporting/sharing them, or copying the small check
inline, is an implementation choice for tasks.md, not a design fork). It
does **not** reuse: `pursuitX`/`pursuitBestDist`/`pursuitStaleFrames`,
`gumdropCooldown`, `soggy`, `consumedTargetX` — none of these have a person
equivalent, because a person never chases a scent and never receives a
finger target (FR-006). This makes `Person`'s step function strictly
*smaller* than `stepPoodle`'s, not a peer-sized rewrite.

**Rationale**: `groundBelow`/ledge-step/dig-out are gravity-shaped primitives
a walking (not swimming) figure needs regardless of what she's walking
*toward* — reusing them is free correctness (they're already tested via the
poodle). Everything dropped is specifically the *poodle's reason to move
somewhere in particular* (a scent, a finger), which FR-006 rules out for a
person by design.

## 6. Stroll cadence needs a new two-phase timer shape, not the poodle's `wanderStep`

**Decision**: the poodle's existing `wanderStep` moves exactly one cell per
`WANDER_PAUSE` (45-frame) tick and never changes `state` — invisible to the
rendering layer, because a wandering poodle doesn't need to *look* different
from an idle one (🐩 has one glyph). A person's whole point is the opposite:
"walking" must be a visually sustained, multi-step burst so it reads as a
stroll, and "standing" must be a visually distinct pause — exactly the
"stops and stands for a breath, then ambles off again" language in User
Story 1. So `Person` needs a **two-phase** cadence instead of one continuous
wander state:

- `state === 'standing'`: `timer` counts down a pause (`PERSON_PAUSE_FRAMES`);
  at 0, flip to `'walking'` with `timer = PERSON_WALK_BURST_FRAMES` and pick
  a direction (reusing the ledge/edge/roam-range turn-around checks from
  §5).
- `state === 'walking'`: `timer` counts down the burst; on frames where
  `person.id % PERSON_STEP_INTERVAL === pets.stride % PERSON_STEP_INTERVAL`
  (the same modulo-stagger `stepPoodle` already uses for smooth, offset
  footsteps), attempt one cell-step, turning around in place (without
  ending the burst) if the destination is blocked. At `timer === 0`, flip to
  `'standing'` with `timer = PERSON_PAUSE_FRAMES`.
- `state === 'running'`: the poke reaction (§7) preempts either phase and
  restores to `'standing'` when it ends, letting the normal cadence resume
  from a fresh pause rather than resuming mid-burst.

**Rationale**: reusing `wanderStep` verbatim would produce a person who
either never visibly "stands" (if state always shows 'walking') or never
visibly "walks" (if it stays 'idle', per the poodle's actual behavior) —
neither satisfies FR-005's "alternates ... MUST NOT stand perfectly still ...
MUST NOT move every frame" as a *visible* alternation, only as a positional
one. The two-phase timer is the minimal new shape that makes state and
motion agree. Exact frame counts are, per the spec's own Assumptions
section, "an implementation tuning value the maintainers can eyeball and
adjust" — this plan does not pin numbers, only the mechanism.

## 7. The poke reaction is in-place, reusing the poodle/mermaid `timer`-gate shape

**Decision**: `pokePersonAt(pets, x, y): boolean` is byte-for-byte the same
shape as `pokePoodleAt`/`pokeMermaidAt` (nearest within `POKE_RADIUS`,
`timer === 0` gate, sets `state = 'running'`, `timer = PERSON_RUN_DURATION`
— a new named constant, not a bare reuse of `TRICK_DURATION`, since a run and
a trick are conceptually different even if likely the same magnitude
initially). She does **not** displace during the reaction — no positional
movement is computed for `state === 'running'`, exactly like a poked
flamingo's hop or palm's shiver, which are draw-time-only reactions with no
grid-position change. When `canRunPicture` is `false` (§3 rung 3), the
*state* is unaffected (still `'running'`, same `timer`, same
`pokePersonAt`); only the **rendering** of that state differs — a
flamingo-style in-place hop bob instead of a mirrored running glyph.

**Rationale**: FR-016 only requires "breaks into a brief run ... for a
bounded moment" and never requires her to end up somewhere else — treating
it as in-place avoids a second class of bounds/collision checking during a
short reaction window, and keeps the hop fallback a pure rendering swap
rather than a second, parallel sim-state machine. This mirrors the existing
flamingo-hop/palm-shiver mechanism in `PlayArea.svelte` (`flamingoHopAt`/
`palmShiverAt`, wall-clock-keyed maps) in *spirit* (a poke reaction that
doesn't move the object), even though those are object-id-keyed wall-clock
timers external to the sim step and a person's reaction is a genuine
sim-frame state on the entity itself (since, unlike a flamingo, she's a
`pets.ts`-style stepped entity that already has a `timer` field to reuse).

## 8. Migrating old `byKind.person` objects must also release grid cells, not just positions

**Finding**: `placeObject` (`src/sim/objects.ts`) doesn't just track a
person in `ObjectsState.byKind.person` — it stamps every cell of her 24×24
footprint to `OBJECT` (solid) in `grid.elements`, which is itself part of the
serialized save (`WireWorld.elements`, base64-encoded). A saved world
written before this feature therefore has **both** a `byKind.person` list
*and* solid `OBJECT` bytes at those grid coordinates. Converting only the
list (dropping `'person'` from `ObjectKind`/`OBJECT_KINDS` and reading the
old key for positions) without also clearing those grid cells would leave
exactly the "invisible solid block" FR-027 explicitly warns against — sand
would pile up on / bounce off a wall that no longer has any object entry
explaining why.

**Decision**: `src/sim/objects.ts` gains
`migrateLegacyPersonObjects(grid: Grid, objects: ObjectsState, rawPersonList:
readonly PlacedObject[]): { x: number; y: number }[]` that, for each old
person object: (a) computes a walker anchor at the footprint's center
(`x + size / 2, y + size / 2`, rounded), and (b) clears every footprint cell
to `EMPTY` unless it's still covered by a **surviving** object of a
different kind — the same check `removeObject`'s existing
`isCoveredByAnyObject` already performs, replicated inline against the
*current* (person-less) `OBJECT_KINDS` rather than calling `removeObject`
itself (which requires a live, still-typed `ObjectKind`, and `'person'` no
longer is one — this is a small, deliberate duplication rather than
contorting `removeObject`'s public signature around a migration-only
legacy kind). The returned position list is capped to `PERSON_CAP` (oldest —
i.e., earliest in list order, since `placeObject` always `push`es and cap
eviction always `shift()`s index 0 — dropped first) before being handed to
`restorePeopleFromPositions`.

**Rationale**: this is the concrete mechanism FR-026/FR-027 describe in
prose; without reading the code this closely, it would be easy to migrate
only the metadata list and ship a save-compatibility bug that silently
reintroduces invisible walls — precisely the failure mode CLAUDE.md and the
constitution's "absence means none of this yet, never corrupt" amendment
exist to prevent.

## 9. Migrated legacy people are always the neutral variant — no probe access at parse time

**Decision**: `deserializeWorld`/`deserializeHistory` are pure, DOM-free
parsing functions today (no canvas, no `PersonPictureSet` dependency) and
this feature keeps them that way. A migrated legacy person (who had no
variant concept in the old placed-object shape) is always assigned
`variant: 'neutral'` — never run through the variant picker, never given
access to a `drawableVariants` list.

**Rationale**: `'neutral'` is guaranteed to be in `drawableVariants` on every
device (the ladder's terminal safe rung — §3), so this can never produce an
undrawable person, and it avoids coupling the save/history parsing layer
(today entirely synchronous and canvas-free, callable before any probe has
even run) to session-scoped probe state. The alternative — deferring
migration until after the probe resolves, or threading a `PersonPictureSet`
into `save.ts`/`historySave.ts` — would be a much larger, riskier change to
files that currently have zero UI/canvas dependencies, for a cosmetic
variant choice on people the child never picked a variant for in the first
place.

## 10. Save/history: mirror `mermaids`' tolerant-optional-field pattern exactly, plus one legacy read

**Decision**: `WireWorld`/`WireHistoryStep` each gain `people?: WirePerson[]`
(`WirePerson = { x: number; y: number; variant: PersonVariant }`), parsed by
`parsePeople`/`parseHistoryPeople` functions structurally identical to the
existing `parseMermaids`/`parseHistoryMermaids` (missing field, non-array, or
any individually malformed entry all default the **whole list** to `[]` —
matching the existing, if stricter-than-per-item, precedent rather than
inventing a more lenient per-entry-skip rule). Separately, and only for
backward compatibility, both deserializers also read
`rawByKind.person` (if present, before/alongside the now-smaller
`OBJECT_KINDS` loop) and feed it through `migrateLegacyPersonObjects` (§8) —
merged with any parsed `people` list, then capped to `PERSON_CAP`. Neither
`SAVE_VERSION` nor `HISTORY_SAVE_VERSION` is bumped.

**Rationale**: this is exactly the "mermaids was added" precedent research
turned up in `save.ts`/`historySave.ts`, extended by exactly one new step
(the legacy-key read) that mermaids never needed because mermaids never
previously existed in any shape. In practice a payload has `people` XOR
`byKind.person`, never meaningfully both (a save written by this feature's
own code never writes `byKind.person` again — "migration reads, never
writes, the old shape", per the spec's own Assumptions) — merging is a
defensive no-op for the ordinary case and only matters for a hand-edited or
adversarial payload.

## 11. Toolbar's dynamic glyph forces `toolbarGlyphs.test.ts`'s existing person assertion to be replaced, not tweaked

**Finding**: `tests/unit/shell/toolbarGlyphs.test.ts` currently asserts (from
spec 015 / issue #47) that `Toolbar.svelte`'s source text "contains 🧑 but
never 🧍" — a static grep of the `.svelte` file's literal source. Once
`glyphFor('tool-person')` reads a runtime-resolved `PersonPictureSet` prop
instead of returning a string literal (§2), **neither** glyph will appear as
literal text in `Toolbar.svelte`'s source at all — the assertion would
either false-fail (if 🧍 happens to appear in a comment) or, worse, silently
stop testing anything meaningful once its "contains 🧑" half starts failing
and someone naively deletes the whole block instead of understanding why.

**Decision**: replace that `describe` block with assertions against
`resolvePersonPictureSet`'s output directly (e.g., "a fully-capable probe
resolves the toolbar glyph to 🧍, never 🧑") in the new
`tests/unit/lib/personGlyphs.test.ts`, and drop the source-text-grep version
from `toolbarGlyphs.test.ts` entirely rather than editing it in place.

**Rationale**: this is a real, easy-to-miss regression trap flagged during
research specifically so tasks.md doesn't discover it mid-implementation as
a mysteriously failing pre-existing test. It is not a "weakened" test per
FR-029's "no existing test may be weakened" — the coverage moves to a
strictly more precise unit (the resolver function itself, testable across
every fallback-ladder case) rather than being deleted outright.

## 12. No shared `Pet`/base-entity abstraction, following spec 016's own precedent

**Decision**: `Person` is its own interface and `stepPeople` its own
function in `src/sim/pets.ts`, not a generalization of `Poodle`/`Mermaid`
behind a shared base type.

**Rationale**: spec 016's research.md already made and justified this call
for Poodle vs. Mermaid ("forcing that into one abstraction now, for two
pets, would cost more than it saves"); a third pet with yet another
locomotion shape (gravity-based but pursuit-free, unlike either existing
pet) is exactly the kind of divergence that precedent anticipated, not a
reason to revisit it. A future fourth pet is still the point at which a real
shared shape would earn its keep.
