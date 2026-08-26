# Phase 0 Research: Landscape Scenes

The spec's own Requirement Completeness checklist confirms all three
`[NEEDS CLARIFICATION]` markers raised while drafting were already resolved
on issue #4 before this spec was accepted (see
`checklists/requirements.md`): no persistent "current world" highlight on
scene buttons (FR-006), keep both ⬜ and 🗑️ (FR-008), and implementation
waits for `003-rainbow-unicorn-magic` to land first (Assumptions). No
`[NEEDS CLARIFICATION]` markers remain in `spec.md`, so this research
resolves only the remaining *implementation-technology* unknowns needed to
fill Technical Context and unblock Phase 1 design — chiefly how to generate
a deterministic, already-settled "world" from the existing element/object
primitives without adding a new subsystem.

This feature is a direct extension of `001-falling-pink-sand`,
`002-water-and-purple-dirt`, and `003-rainbow-unicorn-magic`. Their plans,
research, data-model, and contracts are prior art and are referenced
throughout rather than restated. The current `src/sim/*` shape (read
directly from the checked-out code, which already includes 003's landed
objects/rainbow-sand work) is: `types.ts` defines
`EMPTY/SAND/WATER/DIRT/RAINBOW_SAND/OBJECT`, `Grid { width, height,
elements, shades, moved, hues: Uint8Array }`, `Tool`, `BrushSize`,
`ObjectKind`, `PlacedObject`, `ObjectsState`; `grid.ts` has
`createGrid/inBounds/getElement/getShade/setCell/clearGrid`; `step.ts`
scans bottom-to-top dispatching powders/liquids, with `RAINBOW_SAND` fully
folded into the powder family; `objects.ts` has
`createObjectsState/placeObject/removeObject/eraseObjectsInBrush/
eraseObjectsInBrushLine/clearObjects/applyRainbowConversions/
isUnicornTouched`, each object capped at 3 per kind with oldest-evicted;
`shade.ts` has one function, `randomShade()`, backed by `Math.random()`.
`PlayArea.svelte` owns the frame loop, pointer handling, rendering, and an
exported `clearAll()` that clears the grid, clears objects, and empties the
particle array — the closest existing precedent for what a scene-load
"replace everything" operation needs to do.

## 1. Determinism: pure position-keyed math, not a seeded PRNG

- **Decision**: Scene generation never calls `Math.random()` or
  `randomShade()` (which wraps it). Instead: (a) terrain *shape* comes from
  a small, fixed combination of sine waves evaluated at each column's
  `x / width` fraction (deterministic for a given `width`); (b) terrain
  *shade* variation (so a hill doesn't render as one flat color swatch)
  comes from a small fixed hash of `(x, y)` — e.g.
  `1 + ((x * 928371 + y * 128371) % 255)` — mapped into the same 1–255
  range `randomShade()` produces, but reproducing byte-for-byte on every
  call for the same cell coordinates.
- **Rationale**: FR-023 requires "any variation used to make terrain look
  natural MUST come from a fixed, reproducible source rather than from a
  source that differs between loads or between sessions." A pure function
  of position trivially satisfies this — calling it twice with the same
  `(x, y, width, height)` always returns the same value, with no seed to
  thread through, no state to reset between calls, and nothing new to add
  to `Grid`/`ObjectsState`. It also composes for free with the size-
  robustness requirement (FR-022): the same formula, evaluated at a
  different `width`/`height`, produces a proportionally equivalent shape
  with no extra parameter.
- **Alternatives considered**: A small seeded PRNG (e.g. mulberry32) fed a
  fixed constant seed — rejected as unnecessary complexity: it would need
  its own tiny implementation or a new dependency (constitution Principle
  III forbids the latter without justification), plus a discipline of
  "reset the seed at the start of every generation call," for a visual
  effect (mild shade variation, a couple of terrain crests) that a direct
  positional formula already achieves with strictly less state and an
  simpler determinism proof ("it's a pure function" vs. "the seed is
  always reset correctly").

## 2. Terrain is structurally at rest by construction, not by settling

- **Decision**: Every terrain height profile (`hillHeight(x)` for
  landscape 1, `beachHeight(x)` for landscape 2) is computed in two steps:
  first evaluate a smooth function of `x / width` (sum of one or two fixed-
  phase sine terms) to get a candidate row per column; then run one
  left-to-right pass that clamps each column's height to within ±1 row of
  its neighbor's *already-clamped* height. The clamped profile, not the raw
  sine values, is what gets written to `elements`/`shades`.
- **Rationale**: `step.ts`'s existing `stepPowder` only slides a surface
  grain diagonally when the cell directly below it is blocked *and* at
  least one diagonal-below neighbor is open — which, for a solid terrain
  column, happens exactly when the neighboring column's surface is more
  than one row lower. Clamping adjacent-column height differences to ≤1 row
  therefore makes every surface cell's diagonal-below neighbors already
  occupied, so `stepPowder` has nothing to do on it — the hill (or beach
  slope) is at rest the instant it's written, satisfying FR-020 ("hills
  MUST hold their shape... no part of the scene may collapse... when the
  simulation advances with no drawing") as a structural guarantee, testable
  by running `step()` a number of times and asserting the height profile is
  unchanged, rather than an empirically-tuned "looks stable enough"
  approximation. The lake/pool water is filled as a single flat level (§3)
  strictly below the surrounding walls' clamped height, so it has no open
  downhill path either.
- **Alternatives considered**: Pick sine amplitude/frequency constants by
  eye and hope no column pair exceeds a 1-row jump — rejected: fragile
  under the exact size-robustness requirement this feature has to prove
  (FR-022's "any supported play-area size"), since the same amplitude in
  *rows* means a steeper *slope in columns* on a narrower grid. A
  post-generation "run `step()` N times and see if it settles" simulation
  pass before first render — rejected: reintroduces exactly the "loose
  material dropping into place" behavior the spec's own Assumptions
  section rules out ("no collapse animation on load"), and would make
  FR-024's single-frame load either slower or itself non-deterministic in
  wall-clock terms.

## 3. Water body: a single flat fill, strictly contained by taller walls

- **Decision**: A lake or pool is filled by, for each column inside its
  horizontal span, setting every cell from a fixed flat water-surface row
  down to that column's terrain surface (exclusive) to `WATER` — but only
  for columns whose *clamped* terrain height (§2) is below the chosen
  water-surface row, and only where the water-surface row itself is at
  least one row below the shortest surrounding wall column's height. No
  column outside the basin's span is touched.
- **Rationale**: A flat fill bounded by taller walls on both sides (per §2)
  has no open lateral or downhill path for `stepLiquid` to find — the same
  structural argument as §2, but for liquids: `stepLiquid` only moves a
  cell into an `EMPTY` neighbor, and there is none within the basin once
  it's filled flat below the walls. This reads visually as "a lake sitting
  in the valley" / "a pool on one side" (the spec's own phrasing) rather
  than an arbitrary blob, and is trivial to assert in a test (count of
  `WATER` cells stays within a small tolerance across many `step()` calls —
  SC-006).
- **Alternatives considered**: Drop water from above the valley and let
  `step()` settle it into place — rejected for the same "no collapse
  animation on load" reason as §2, and because it would make the exact
  resting shape depend on `step()`'s left/right tie-breaking
  `Math.random()` calls (used for symmetric diagonal slides), which would
  make the *result*, not just the *process*, non-deterministic — directly
  conflicting with FR-023.

## 4. One shared `sceneRegions(width, height)` helper for generation *and* tests

- **Decision**: `src/sim/scenes.ts` exports a small pure function,
  `sceneRegions(width, height): SceneRegions`, returning named rectangles
  in grid-cell coordinates (e.g. `sky`, `lowerPortion`, `leftHalf`,
  `rightHalf`) as fixed fractions of `width`/`height`. Both the generators
  (to decide where to draw terrain/water/sky) and `scenes.test.ts` (to
  assert "the hill terrain's cells are within `lowerPortion`," "the
  rainbow's footprint is within `sky`") call this same function.
- **Rationale**: The spec's own Key Entities section names "Scene region"
  as a first-class concept "used both to compose a scene and to assert its
  contents in tests" — sharing one function is the literal reading of that
  requirement, and it structurally prevents generation and test
  expectations from drifting apart (a change to, say, how tall the sky band
  is automatically updates what the tests consider "the sky," rather than
  requiring two places to be kept in sync by hand). It also directly serves
  FR-022 (proportional at any supported size) and FR-028 (region-based
  automated coverage) with a single, reused piece of logic.
- **Alternatives considered**: Inline fraction math separately in each
  generator and again in each test — rejected: 003's `research.md` already
  established the project's preference for one shared helper over
  duplicated math wherever generation and verification need the same
  shape (see 003 §2's shared zone-iteration helper); duplicating region
  math here would repeat that mistake for no benefit.

## 5. Rainbows and unicorns are placed through the existing `placeObject` — never a bespoke path

- **Decision**: `scenes.ts` never constructs a `PlacedObject` literal or
  pushes directly onto `ObjectsState.rainbows`/`.unicorns`. Every rainbow
  and unicorn in a scene is placed by calling the existing, unmodified
  `placeObject(grid, objects, kind, cx, cy)` from `objects.ts`, choosing
  `(cx, cy)` deterministically from `sceneRegions` fractions.
- **Rationale**: FR-014 requires scene-placed rainbows/unicorns to "count
  as ordinary placed objects for the existing per-type on-screen cap, in
  placement order" — calling the same function the toolbar's 🌈/🦄 tools
  call means the cap-of-3/oldest-evicted rule (already implemented and
  tested in `objects.test.ts`) applies automatically, with zero new logic
  and zero risk of the two code paths (scene vs. hand-placed) diverging.
  It also means `placeObject`'s existing on-grid nudging keeps a scene's
  objects safely inside bounds at any grid size for free (contributing to
  FR-022).
- **Alternatives considered**: A parallel "scene object" concept exempt
  from the cap — rejected outright by FR-014 itself ("treated as ordinary
  placed objects"), and would have needed a second, redundant cap-and-evict
  implementation for no requirement that asks for one.

## 6. Rainbow clearance from the scene's own terrain

- **Decision**: Each scene's rainbow(s) are positioned in the `sky` region
  (§4) such that the rainbow's footprint *and* its existing one-cell zone
  ring (the exact ring `applyRainbowConversions`/`isUnicornTouched` already
  walk, per 003's research §2 — unchanged by this feature) never overlaps
  any cell the generator itself writes as terrain or water. Concretely, the
  sky region's lower edge is placed at least
  `OBJECT_FOOTPRINT_SIZE + 2` rows above the tallest point of the terrain
  it sits above (1 row of zone clearance on each side of the footprint,
  rounded up).
- **Rationale**: FR-021 requires "a scene's rainbows MUST be placed clear
  of the scene's own elements, so that loading a scene does not immediately
  convert its own terrain or water into rainbow sand" — this is testable
  directly (call `applyRainbowConversions` once right after generation,
  assert no terrain/water cell changed) and is a natural consequence of the
  same zone geometry 003 already implemented, requiring no new zone
  concept, only correct placement arithmetic.
- **Alternatives considered**: Special-case `applyRainbowConversions` to
  ignore "the rainbow that was just placed by a scene" for one tick —
  rejected: it would need a way to distinguish scene-placed rainbows from
  hand-placed ones (contradicting §5's "ordinary object" requirement) and
  would only mask a placement bug rather than prevent it; placing the
  rainbow far enough away is strictly simpler and is what the spec's own
  Edge Cases section asks for ("scenes place rainbows clear of the elements
  they contain").

## 7. Generation cost is a one-shot event, not a hot-loop concern

- **Decision**: Scene generators write directly into `grid.elements`/
  `grid.shades` (via the existing `setCell`, or equivalent direct index
  writes for terrain fills) and call `placeObject` a handful of times (1–2
  rainbows, 1 unicorn) — a single pass over at most `width × height` cells,
  run once per tap, never inside `step()` or the per-frame render loop.
- **Rationale**: Constitution Principle IV's "allocation-free hot loop"
  requirement targets `step()`/`render()`, which run every animation frame;
  a scene load runs once, in response to a discrete tap, and at the current
  default grid (270×160 = 43,200 cells) completes in well under a
  millisecond — many orders of magnitude inside the single-frame budget
  FR-024 asks for. No pooling, batching, or incremental-generation scheme
  is needed.
- **Alternatives considered**: Spread generation across multiple frames to
  "smooth out" any cost — rejected as solving a problem that doesn't exist
  at this scale, and it would directly violate FR-010/FR-024 (atomic,
  single-frame replacement, no visible partial draw).

## 8. UI wiring mirrors the existing `clearAll` pattern exactly

- **Decision**: `PlayArea.svelte` gains one new exported function,
  `loadScene(sceneId: SceneId): void`, structured identically to the
  existing `clearAll()`: it calls `scenes.ts`'s `loadScene(sceneId, grid,
  objectsState)`, then resets `particles.length = 0` (particles are UI-
  layer state, outside `Grid`/`ObjectsState`, so `scenes.ts` cannot and
  does not touch them — 003's research §10 boundary is unchanged) exactly
  as `clearAll()` already does. `App.svelte` adds one new handler,
  `selectScene(id: SceneId)`, that calls `playArea.loadScene(id)` and
  nothing else — critically, it does **not** call `selectTool`, so `tool`/
  `brushSize` are left exactly as they were (FR-004). `Toolbar.svelte`
  adds one new button group with three buttons, none of which ever binds
  `class:selected` to any piece of state (FR-006) — the only interactive
  feedback is the existing CSS `.control:active` press affordance
  (transform/box-shadow on `:active`, no new state).
- **Rationale**: This is the smallest possible change that satisfies every
  scene-control requirement: FR-003 (instant, no confirmation — a
  synchronous function call), FR-004 (tool/brush untouched — the handler
  simply never touches that state), FR-005 (usable any number of times,
  most recent tap wins — no queuing, no debounce, a plain function call
  each tap), and FR-006 (no persistent highlight — solved by never adding
  the binding in the first place, not by adding and then suppressing one).
  Reusing `clearAll`'s exact shape also means reviewers already know what
  to check for regressions, since it's the same pattern proven in
  001–003.
- **Alternatives considered**: Give scene buttons a `selected`-like visual
  state that clears on the next draw stroke — rejected explicitly by
  FR-006 and the spec's own Assumptions ("a second kind of highlight would
  compete with the active-tool highlight for a child who cannot read").

## 9. Landscape composition (illustrative — implementation may tune exact fractions)

Both landscapes satisfy FR-017/FR-018's minimums using the mechanisms
above; exact fractions/positions are implementation tuning choices per the
spec's own Assumptions ("exact hill count above two, exact shoreline curve,
exact rainbow positions are tuning choices for the implementer"):

- **🏔️ Landscape 1**: `hillHeight(x)` (§2) produces two crests and one
  valley across the bottom ~40% of the grid, all `DIRT`; the valley is
  filled flat with `WATER` (§3) strictly below both surrounding crests;
  one rainbow sits in the `sky` region (§4/§6) roughly centered
  horizontally; one unicorn is placed (§5) with its footprint's bottom
  edge resting on the taller crest's surface — the spec's Edge Cases
  section explicitly welcomes the unicorn celebrating immediately here,
  since the ground touches it by design.
- **🏝️ Landscape 2**: `beachHeight(x)` (§2) slopes monotonically from a
  higher elevation on one side to a lower one on the other, all `SAND`
  (clamped exactly as §2 describes, so the slope itself cannot avalanche);
  a large flat `WATER` fill (§3) occupies the lower-elevation side; two
  rainbows sit in the `sky` region (§4/§6), spaced apart horizontally
  (visually distinguishing this scene from landscape 1's single rainbow —
  FR-019); one unicorn is placed (§5) on the sand near the sand/water
  boundary, its footprint's bottom edge resting on the sloped surface at
  that column.

Both differ in dominant element (`DIRT` vs `SAND`), terrain shape
(symmetric two-crest valley vs. one-directional slope), and rainbow count
(1 vs. 2) — directly satisfying FR-019's "clearly different at a glance."

## 10. "Range of play-area sizes" means testing the generator's own robustness, not a runtime resize

- **Decision**: `GRID_WIDTH`/`GRID_HEIGHT` (`src/lib/layout.ts`) remain
  fixed constants; as today, `PlayArea.svelte`'s `ResizeObserver`-driven
  `resize()` only recomputes the on-screen pixel size (`computeCanvasSize`),
  never the grid's cell dimensions, and never calls into `scenes.ts` (FR-016
  — no regeneration on resize/rotation). FR-022/FR-028's "any supported
  play-area size" / "a range of play-area sizes" is therefore validated by
  calling the generators directly with several different `createGrid(width,
  height)` combinations in `scenes.test.ts` — proving the *algorithm* is
  proportional and self-consistent — rather than by resizing the live app.
  Test sizes are chosen comfortably larger than `OBJECT_FOOTPRINT_SIZE`
  (24 cells, from 003), matching 003's own inherited assumption that grid
  dimensions are always large relative to a fixed object footprint;
  pathologically tiny grids where that 003 assumption itself would already
  break are out of this feature's scope.
- **Rationale**: This matches how the codebase already works (grid
  resolution is constant; only CSS pixel scaling adapts to the viewport),
  so nothing about resize handling needs to change, and it keeps FR-022's
  proportionality claim honest and testable at the level where it actually
  varies today — the generator function's own math — without inventing a
  runtime capability (dynamic grid resolution) this feature doesn't
  otherwise need.
- **Alternatives considered**: Make grid resolution itself responsive to
  viewport size as part of this feature — rejected as far out of scope; no
  requirement asks for it, and it would touch `PlayArea.svelte`'s
  `createGrid`/render sizing in ways unrelated to scene generation,
  risking exactly the kind of regression FR-027 forbids.

All Technical Context unknowns are resolved; nothing carries forward to
Phase 1 as unresolved. No spec-level `[NEEDS CLARIFICATION]` markers exist
in `spec.md` (all three were already resolved on issue #4, per
`checklists/requirements.md`), so no clarification-avoidance decisions are
recorded here beyond the implementation-technology choices above.
