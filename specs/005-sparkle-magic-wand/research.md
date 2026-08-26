# Phase 0 Research: Sparkle Magic Wand

This feature's own Clarifications session (2026-08-26, recorded in
`spec.md`) already resolved the three `[NEEDS CLARIFICATION]` questions
raised while drafting — sprinkled glitter is existing rainbow sand in an
already-glittered state (FR-016/FR-017), glitter is permanent until erased/
cleared/reloaded (FR-014), and the wand never gives placed objects a lasting
glittered look (FR-013). No `[NEEDS CLARIFICATION]` markers remain in
`spec.md`, so this research resolves only the remaining
*implementation-technology* unknowns needed to fill Technical Context and
unblock Phase 1 design.

This feature is a direct extension of `001-falling-pink-sand`,
`002-water-and-purple-dirt`, `003-rainbow-unicorn-magic`, and
`004-landscape-scenes`. Their plans/research/data-model/contracts are prior
art and are referenced rather than restated. The current `src/sim/*`/
`src/lib/*` shape (read directly from the checked-out code, which already
includes `004`'s landed `scenes.ts`) is: `types.ts` defines
`EMPTY/SAND/WATER/DIRT/RAINBOW_SAND/OBJECT`, `Grid { width, height,
elements, shades, moved, hues }`, `Tool = 'sand'|'water'|'dirt'|'rainbow'|
'unicorn'|'eraser'`, `BrushSize`, `SceneId`; `grid.ts` has
`createGrid/inBounds/getElement/getShade/setCell/clearGrid`; `step.ts`'s
private `moveCell`/`swapCells` copy/swap `elements`/`shades`/`hues` between
two indices (plus a rainbow-sand hue-cycle nudge) before the public `step()`
dispatches powders/liquids; `brush.ts`'s private `forEachFootprintCell`
walks a circular footprint, used by the exported `applyBrush`/
`applyBrushLine`; `objects.ts` has `createObjectsState/placeObject/
removeObject/eraseObjectsInBrush/eraseObjectsInBrushLine/clearObjects/
applyRainbowConversions/isUnicornTouched` plus a private
`footprintIntersectsCircle`, each object kind capped at 3 with
oldest-evicted; `shade.ts` has `randomShade()`; `particles.ts` (in
`src/lib/`, plain TypeScript, no DOM) has `Particle`, `MAX_PARTICLES = 60`,
`BURST_COUNT = 6`, `spawnBurst`/`spawnIdleSparkle`/`tickParticles`;
`PlayArea.svelte` owns the frame loop (`step` → `applyRainbowConversions` →
`updateUnicorns` → `tickParticles` → `render`), pointer handling
(`paintAt`, dispatching per-tool to `applyBrush(Line)` plus
`eraseObjectsInBrush(Line)` for the eraser), and exported `clearAll()`/
`loadScene()`.

## 1. Glitter is a new parallel array on `Grid`, not a new `Element`

- **Decision**: `Grid` gains one new field, `glitter: Uint8Array` (0 or 1
  per cell), allocated in `createGrid` exactly like `shades`/`hues`. It is
  not a new `Element` value — `SAND`/`WATER`/`DIRT`/`RAINBOW_SAND` cells can
  each independently be glittered or not, and glitter never appears without
  an accompanying element.
- **Rationale**: The spec's Key Entities section defines "Glittered state"
  as "a per-grain... property carried alongside a grain's element type" —
  a parallel array is the direct, minimal-diff way to add a boolean
  per-cell property to a structure-of-arrays grid, exactly how `hues` was
  already added for rainbow sand in `003`. It also means every existing
  `Element`-dispatch in `element.ts`/`step.ts` (`isPowder`/`isLiquid`) is
  completely unaffected — a glittered pink-sand cell is still, in every
  physics-relevant sense, `SAND` (FR-007).
- **Alternatives considered**: A new `Element` value like `GLITTER_SAND` per
  base element — rejected outright: it would multiply the element set
  (four glitterable elements × 2), directly contradicting FR-017's "This
  feature MUST NOT add a new element type" and the constitution's "new
  element types require a spec" constraint, for a property the spec
  explicitly frames as appearance-only (FR-007). A side `Set<number>` of
  glittered cell indices — rejected: `moveCell`/`swapCells` already touch
  fixed-size typed arrays by index for `elements`/`shades`/`hues`; a `Set`
  would need insertion/deletion on every grain movement (allocating,
  GC-pressure-prone) where a `Uint8Array` read/write is a single typed-array
  access, matching the hot loop's existing allocation-free style (FR-023).

## 2. Glitter travels with the grain: `step.ts`'s `moveCell`/`swapCells` carry it

- **Decision**: `step.ts`'s two private helpers are extended to copy/swap
  `grid.glitter[index]` alongside `elements`/`shades`/`hues`, using the same
  read-before-overwrite discipline already used for the other three arrays.
  `moveCell` copies the source's glitter bit to the destination and zeroes
  the vacated source cell's glitter bit (mirroring how it already zeroes
  the vacated cell's `elements`/`shades`/`hues`); `swapCells` exchanges the
  two cells' glitter bits (mirroring its existing element/shade/hue swap).
  This is the one behavior change to an existing sim file this feature
  needs — everything else about `step()`'s dispatch, powder/liquid rules,
  and `moved` bookkeeping is untouched.
- **Rationale**: FR-008 requires glitter to be "a property of the grain,
  not of the location," travelling with a grain through every fall, slide,
  or swap `step()` performs, with the vacated cell left un-glittered.
  `moveCell`/`swapCells` are the *only* two places any cell's contents ever
  relocate under simulation rules — updating them is both necessary and
  sufficient for FR-008/SC-004, and keeps the invariant enforced in exactly
  one place rather than requiring every future physics rule to remember it.
- **Alternatives considered**: Track glitter by a separate "which grain is
  this" identity (e.g., stamp every glittered grain with a small ID that
  survives moves via existing bookkeeping) — rejected: no such per-grain
  identity exists anywhere in the sim today (elements are anonymous typed
  bytes), and inventing one just for glitter would be significant new
  machinery for a property FR-014 already treats as binary
  (glittered/not), not something needing per-grain provenance.

## 3. `setCell` and `clearGrid` own clearing glitter — erase/clear-all/scene-load need no new code

- **Decision**: `grid.ts`'s `setCell(grid, x, y, element, shade)` — called
  by every element brush stroke and by the eraser (`setCell(grid, x, y,
  EMPTY, 0)`) — additionally resets `grid.glitter[i] = 0` on every call,
  since `setCell` always represents *drawing a fresh grain* (or erasing
  one), never a wand action. `clearGrid` additionally calls
  `grid.glitter.fill(0)` alongside its existing `elements.fill(EMPTY)`. Two
  new small accessors are added alongside `setCell`/`getElement`/
  `getShade` for the wand's own use: `setGlitter(grid, x, y, value)` and
  `getGlitter(grid, x, y): boolean`, so `wand.ts` never reaches into
  `grid.glitter` by raw index itself (matching how it already never reaches
  into `grid.elements` directly).
- **Rationale**: FR-012 requires erasing, clearing, or loading a scene to
  "leave no glitter state behind," with no exception. Because
  `applyBrush`'s eraser path and `clearAll`/every `loadScene` call already
  funnel through `setCell`/`clearGrid` (unchanged by `004`), this single
  change satisfies FR-012 for the eraser, 🗑️ clear-all, *and* all three
  scene buttons simultaneously, with zero new code in `brush.ts`,
  `PlayArea.svelte`, or `scenes.ts`. It also means a freshly *drawn* element
  brush stroke can never accidentally inherit a stale glitter bit left over
  from whatever occupied that cell before (e.g., pour sand, wand it, erase
  it, pour dirt on the same cell — the dirt must not appear pre-glittered).
- **Alternatives considered**: Clear glitter explicitly at each of the
  eraser/clear-all/scene-load call sites in `PlayArea.svelte`/`scenes.ts`
  instead of inside `grid.ts`'s primitives — rejected: `004`'s own research
  (§8) already established the project's preference for routing
  "replace/remove" operations through one shared primitive rather than
  duplicating the effect at every caller; doing it in `setCell`/`clearGrid`
  is the same principle applied here, and is what keeps `scenes.ts`
  completely unmodified by this feature (it already calls `clearGrid`).

## 4. Sprinkle placement uses a fixed position-only lattice, not `Math.random()`

- **Decision**: Whether an empty cell `(x, y)` is a sprinkle site is a pure
  function of its absolute grid coordinates alone — e.g. a small diagonal
  lattice test such as `((x + 2 * y) % 5 + 5) % 5 === 0`, giving a fixed
  ~1-in-5 density with no dependence on `Math.random()`, on how many other
  cells the current wand stroke covers, or on how many times the wand has
  passed over this area before. `applyWand(grid, cx, cy, radius)` iterates
  the circular footprint (via `brush.ts`'s now-exported
  `forEachFootprintCell`) once: for each covered cell that already holds an
  element other than `OBJECT`, it sets that cell's glitter bit; for each
  covered cell that is `EMPTY` *and* satisfies the lattice test, it places a
  glitter grain (rainbow sand, glittered, with a position-keyed hue/shade —
  see §5); `OBJECT` cells are skipped entirely (§7). No candidate list is
  built and no random number is drawn — the whole pass is a single
  allocation-free loop.
- **Rationale**: This single decision satisfies three requirements at once,
  by construction rather than by tuning:
  - **FR-015's density bounds** ("strictly more than zero... no more than
    one third of the covered empty cells"): a 1-in-5 lattice can be shown,
    for the smallest supported brush (`BRUSH_RADII.small = 2`, a ~13-cell
    disk), to hit at least one eligible cell for *any* disk center — the 13
    integer offsets `(dx, dy)` with `dx² + dy² ≤ 4` produce `dx + 2·dy`
    values covering all five residues mod 5, so whatever residue a given
    disk center needs to complete the lattice condition, some offset in the
    disk supplies it. The same disk's eligible-cell count never exceeds 3
    of its 13 cells (~23%), comfortably under one third; every larger brush
    radius's disk is a superset of the radius-2 disk around the same
    center, so the "at least one" guarantee only gets easier to satisfy as
    the disk grows, while the density stays anchored near 1-in-5 rather
    than climbing. (Exact constants — the lattice's period and offset
    coefficients — are an implementation tuning choice, as `004`'s own
    landscape composition section treated its illustrative fractions; this
    shows one worked construction that provably satisfies FR-015 for this
    project's actual `BRUSH_RADII`, not a requirement to use these exact
    numbers.)
  - **SC-005's idempotency** ("repeating a wand pass over the same region
    any number of times produces a state identical to a single pass"):
    because eligibility depends only on `(x, y)`, never on call history or
    on how many neighboring cells are already filled, a cell that failed
    the lattice test on pass 1 fails it identically on pass 2 (it is still
    `EMPTY`, so it is re-evaluated the same way), and a cell that passed on
    pass 1 is no longer `EMPTY` on pass 2 (it now holds a grain, so it
    falls into the "already holds an element → set glitter bit" branch,
    which is already a no-op per §1/FR-010). No cap or quota is
    recomputed per call, which is exactly what a `Math.random()`-driven
    "sprinkle N% of empty cells, capped at count/3" design cannot promise:
    the cap itself would shrink on every subsequent pass as the empty-cell
    count shrinks, letting a second pass sprinkle cells a first pass had
    correctly excluded — silently violating SC-005.
  - **FR-023's allocation-free requirement**: a closed-form per-cell test
    needs no scratch buffer, no reservoir sample, and no array of
    candidates — just arithmetic on the two loop-local coordinates already
    in hand from `forEachFootprintCell`.
- **Alternatives considered**: `Math.random() < density` per empty cell,
  with a global `Math.max(1, Math.floor(emptyCount / 3))` cap and a
  fallback "force one if zero landed" rule for the lower bound — this was
  the first design considered and is rejected specifically because it
  cannot satisfy SC-005 (traced above: the cap recomputes smaller on every
  repeated pass as previously-sprinkled cells stop counting as "empty",
  so a second identical pass is *not* guaranteed to reproduce the first
  pass's exact result, and the "force one" fallback's target cell also
  shifts between passes once its first choice is no longer empty). A
  seeded PRNG re-seeded from `(cx, cy)` per call — rejected as strictly more
  machinery than a closed-form lattice test for the same guarantee, and it
  reintroduces exactly the "remember to reset the seed correctly" discipline
  `004`'s research (§1) already rejected once for scene generation.

## 5. Sprinkled-grain hue/shade is also position-keyed, for the same reason

- **Decision**: A sprinkled cell's hue and shade (needed because it is
  placed via the same `setCell(grid, x, y, RAINBOW_SAND, shade)` primitive
  every element uses, then `grid.hues[i]` is set directly) are computed from
  a small fixed hash of `(x, y)` — the same "position-keyed, not
  `Math.random()`" style `004`'s `positionalShade` already established for
  terrain shade — using different multiplier constants than the lattice
  test in §4 so a cell's *eligibility* and its *color* don't visibly
  correlate. `shade` itself is written only because `setCell` requires a
  value; `RAINBOW_SAND`'s actual render color comes entirely from `hues[i]`
  (`PlayArea.svelte`'s `colorFor` ignores `shade` for `RAINBOW_SAND`,
  unchanged), so this is a minor determinism-completeness detail, not a
  visual one.
- **Rationale**: FR-016 requires sprinkled grains to be "multicoloured...
  individual grains differing in colour," which any hash spreading values
  across the hue range satisfies; keeping it position-keyed (rather than
  `randomHue()`'s `Math.random()`) is what makes repeated wand passes over
  the same still-empty cells (§4) produce byte-identical `hues`/`shades`
  arrays too, closing the last gap in SC-005's "0 differing cells" claim —
  a random hue on the (idempotent) *eligibility* decision would still leave
  the *color* of a hypothetically-re-sprinkled cell non-reproducible, and
  while §4 already guarantees a cell is never sprinkled twice, keeping the
  color deterministic removes any doubt for an exact-equality test.
- **Alternatives considered**: Call the existing `randomHue()` (currently a
  private helper in `objects.ts`, backed by `Math.random()`) — rejected for
  the determinism reason above; also not moved/exported for this feature's
  use, since hand-drawn interactions (rainbow conversion) legitimately want
  fresh randomness on every conversion and mixing the two concerns in one
  shared function would blur that distinction for no benefit.

## 6. Sparkle flash and shimmer are UI-layer, allocation-free, and untested by design

- **Decision**: A new `src/lib/sparkle.ts` (plain TypeScript, no DOM,
  placed alongside `particles.ts` rather than in `src/sim/*`, matching the
  spec's own Key Entities framing of "Sparkle flash" as "a rendering
  effect... hold[ing] no simulation state") exports `createFlashMask(width,
  height): Uint8Array` and `updateFlashMask(grid: Grid, mask: Uint8Array):
  void`. `PlayArea.svelte` allocates one `flashMask` once in `onMount`
  (sized to the grid, like `imageData`) and calls `updateFlashMask` once per
  animation frame, before `render()`. `updateFlashMask` clears the mask
  (`mask.fill(0)`), then does a single forward pass over `grid.elements`/
  `grid.glitter`, using reservoir sampling (Algorithm R) to select up to a
  small fixed `FLASH_CAP` (e.g. 24) glittered, non-`EMPTY`, non-`OBJECT`
  cell indices and set their mask bit — a single-pass, allocation-free
  algorithm needing only the preallocated mask and a running count, no
  matter how many glittered cells exist. `render()` reads `mask[i]` (an O(1)
  lookup already inside its existing per-cell loop) to draw a brighter
  highlight on the sampled cells, and separately nudges every glittered
  cell's base color by a small, cheap function of `grid.glitter[i]` and the
  current frame's timestamp (e.g. a sine-modulated brightness offset) for
  the "gentle color shimmer" that is distinct from the brief flash.
- **Rationale**: FR-022 requires the number of simultaneous flashes to be
  "capped at a fixed maximum that does not grow with the number of
  glittered grains," and FR-014's closing sentence spells out the visible
  consequence: "an individual glittered grain flashes less often as more of
  the play area becomes glittered." Resampling a fixed-size reservoir every
  frame delivers exactly this for free — as the population of glittered
  cells grows, any one cell's per-frame odds of landing in the same-size
  reservoir shrink proportionally, with no per-grain timer or counter
  needed (matching FR-023's allocation-free requirement and the "flash...
  hold[s] no simulation state" framing, since nothing about a flash
  persists in `Grid` between frames). Keeping this in `src/lib/*` rather
  than `src/sim/*` also keeps `wand.test.ts`/`step.test.ts`'s assertions
  entirely about durable grid/object state, matching FR-027's own
  enumerated test list, which does not mention flash timing or count at
  all.
- **Alternatives considered**: A per-cell "next flash time" scalar array
  (simulation-like state) — rejected: this is exactly the "timer per grain"
  approach the spec's own Assumptions section preempts ("Sparkle flashes
  are a capped rendering effect, not simulation state: the toy picks a
  bounded number of glittered grains to flash each frame rather than
  tracking a timer per grain"), and it would need its own array on `Grid`
  for a value that, per FR-022, must never scale with the glittered
  population anyway. Adding a dedicated `tests/unit/lib/sparkle.test.ts` —
  considered but not required: FR-027/SC-016 do not list flash-cap
  behavior among the required automated coverage (unlike every glitter/wand
  grid-state item, which they enumerate explicitly), and the existing
  precedent (`particles.ts`'s `MAX_PARTICLES` cap has never had a dedicated
  test) suggests this project treats capped visual-effect mechanisms as a
  maintainer-review concern, consistent with constitution Principle V
  ("Visual/feel checks are the maintainer's job at review time").

## 7. The wand skips `OBJECT` footprint cells entirely — no special-casing needed for FR-013

- **Decision**: `applyWand`'s per-cell branch is exactly three-way: an
  `OBJECT` cell is skipped (no glitter set, not counted as empty, nothing
  written); any other non-`EMPTY` element gets its glitter bit set; an
  `EMPTY` cell is a sprinkle candidate (§4). Rainbows are therefore never
  touched by wand logic in any way — no rainbow-specific code exists in
  `wand.ts` at all.
- **Rationale**: FR-013 requires the wand to leave placed objects
  (rainbows *and* unicorns) with no lasting glittered look and never
  damage/move/resize/remove one. Since an object's entire footprint is
  already marked `OBJECT` in `grid.elements` by the existing `placeObject`
  (unchanged), a single `=== OBJECT` exclusion in the wand's per-cell
  branch is sufficient and total — there is no way for the wand to write
  into, read out of, or otherwise special-case a rainbow's footprint,
  which is the simplest possible way to guarantee US3 Acceptance Scenario
  6 ("the rainbow is left completely untouched") by construction rather
  than by a rainbow-specific guard clause.
- **Alternatives considered**: Detect rainbow/unicorn footprints via
  `ObjectsState` (as `isUnicornTouched`/`eraseObjectsInBrush` do) and
  exclude those cells explicitly — rejected as redundant: the grid already
  encodes "this cell belongs to an object" via the `OBJECT` element value,
  so re-deriving the same fact from `ObjectsState` would be duplicate
  logic for no additional correctness.

## 8. Unicorn wand-burst: reuse `footprintIntersectsCircle` and `spawnBurst`, add one cooldown field

- **Decision**: `objects.ts`'s existing private `footprintIntersectsCircle`
  gains `export`. A new function, `unicornsTouchedByWandLine(state:
  ObjectsState, from, to, radius): PlacedObject[]`, Bresenham-walks the
  stroke line exactly as `eraseObjectsInBrushLine` already does, and
  collects (deduplicated — objects are capped at 3 per kind, so this list
  is tiny) every unicorn whose footprint intersects any point on the path.
  `PlayArea.svelte`'s `paintAt`, when `tool === 'wand'`, calls this
  alongside `applyWandLine`/`applyWand`; for each returned unicorn, it
  checks a new `lastWandBurstAt` timestamp (added to the existing
  `unicornTimers` map entry, alongside the existing `lastBurstAt`/
  `lastIdleAt`) against a cooldown constant, and if elapsed, calls
  `particles.ts`'s existing `spawnBurst(particles, atX, atY, now,
  WAND_BURST_COUNT)` — `spawnBurst` gains one optional fourth parameter,
  `count = BURST_COUNT`, so every existing call site (the ordinary
  touch-celebration call in `updateUnicorns`) is unaffected by the default.
  `WAND_BURST_COUNT` is a small multiple of `BURST_COUNT` (e.g. 3×) so the
  burst is "noticeably bigger" (FR-018) while still funneling through the
  same `MAX_PARTICLES`-capped `spawn()` (FR-021).
- **Rationale**: This is the same "reuse the existing capped mechanism,
  add a bigger variant rather than a second particle system" approach the
  spec's own Assumptions section calls for ("Wand bursts reuse the existing
  sparkle-particle mechanism and its cap; the wand adds a bigger burst, not
  a second particle system"). Walking the whole drag path (not just the
  pointer's two sampled endpoints) is what satisfies FR-020 ("every unicorn
  the wand's coverage reaches during a drag MUST celebrate") for a fast
  drag whose consecutive samples straddle a unicorn, exactly mirroring the
  comment already on `eraseObjectsInBrushLine` for the same reason. A
  per-unicorn cooldown (not a single global one) is what satisfies FR-019
  ("repeat wand bursts on **one** unicorn MUST be spaced out") without
  suppressing a burst on a *different* unicorn the same drag also crosses
  (US3 Acceptance Scenario 3, "each one that was crossed celebrates").
- **Alternatives considered**: A single shared "last wand burst, any
  unicorn" timestamp — rejected: it would fail Acceptance Scenario 3
  outright (crossing two unicorns in one drag would only let the first one
  celebrate, since the second's check would see the cooldown the first
  burst just started). A brand-new particle kind/spawn function for wand
  bursts — rejected as the "second particle system" the Assumptions section
  explicitly rules out, and unnecessary: `spawnBurst`'s existing glyph
  choice (`✨`/`💖`, `🎉` is not currently emitted — see §9) and cap
  already do everything a "bigger burst" needs from a plain count bump.

## 9. `🎉` needs to join `particles.ts`'s existing glyph set

- **Decision**: `particles.ts`'s `Particle['glyph']` type and `spawn`'s
  glyph choice are widened to include `'🎉'` alongside the existing `'✨'`/
  `'💖'`, so that both the ordinary touch celebration and the bigger wand
  burst draw from the full `🎉 ✨ 💖` set FR-018 names ("more glyphs, drawn
  from 🎉 ✨ 💖"). This is an additive change to an existing union type and
  an existing random-choice expression — no function signature changes.
- **Rationale**: The current `spawn()` only ever picks between `✨`/`💖`;
  the spec's celebration-burst wording for *both* the ordinary and the
  wand-triggered burst names `🎉` as one of the three glyphs a burst draws
  from (Key Entities: "Celebration burst: the group of 🎉 ✨ 💖 glyphs a
  unicorn emits"), so the existing two-glyph set is missing one of the
  three the feature's own vocabulary requires.
- **Alternatives considered**: Reserve `🎉` for wand bursts only, keeping
  ordinary touch bursts at two glyphs — rejected: nothing in the spec
  distinguishes the *glyph set* between the two burst sizes, only the
  *count*; Key Entities describes one shared "Celebration burst" concept
  with a "larger variant triggered by the wand," not two different glyph
  vocabularies.

## 10. Toolbar placement and exact tuning constants are implementation choices

- **Decision**: The ✨ button's exact position/grouping in `Toolbar.svelte`,
  the lattice's exact period/coefficients (§4), the sprinkle color hash's
  exact constants (§5), `FLASH_CAP`'s exact value (§6), and
  `WAND_BURST_COUNT`'s exact multiple (§8) are left as implementation
  tuning choices for the tasks/implement stage, same as `004`'s own
  research explicitly left its landscape fractions and this project's
  established convention of documenting *bounds and guarantees* rather than
  pixel-perfect constants in the plan stage.
- **Rationale**: FR-002/FR-005 constrain the button to "finger-sized... one
  tap away" and the toolbar to "still fit on screen without page scrolling"
  — satisfiable by several different groupings, and not meaningfully
  decidable without seeing the rendered toolbar at both target viewport
  sizes. The spec's own Assumptions section models this precedent directly
  ("Where the density lands inside those bounds is a tuning choice for the
  implementer").
- **Alternatives considered**: Prescribe an exact button position/group
  name now — rejected as premature specificity the spec itself doesn't
  require, and risks conflicting with whatever the implementer finds fits
  best once the sixth control group is actually laid out.

All Technical Context unknowns are resolved; nothing carries forward to
Phase 1 as unresolved. No spec-level `[NEEDS CLARIFICATION]` markers exist
in `spec.md` (all three were already resolved in the Clarifications
session on 2026-08-26), so no clarification-avoidance decisions are
recorded here beyond the implementation-technology choices above.

## Decisions made without clarification

None of the decisions above required guessing at unstated product intent —
every one traces to an explicit FR/SC or to an established prior-feature
convention (`004`'s determinism-over-`Math.random()` and shared-primitive
preferences). No `[NEEDS CLARIFICATION]` marker existed in `spec.md` to
resolve.
