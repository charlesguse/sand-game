# Phase 1 Data Model: Fish And A Shark Living In Her Water

All entities below are new, declared in `src/sim/seaLife.ts`. No existing
entity (`Grid`, `PetsState`/`Poodle`, `ObjectsState`/`PlacedObject`,
`WorldState`, `SavedWorld`) changes shape — this feature's whole point is
that it can be built entirely beside those, per FR-031.

## Fish (new)

One drifting creature belonging to whichever pool its position currently
falls inside (Key Entities: Fish).

| Field | Type | Notes |
|---|---|---|
| `id` | `number` | Stable within a session (`SeaLifeState.nextId`), never persisted (FR-027) — used only to track render-time particle/state transitions the way `Poodle.id` is used in `PlayArea.svelte` today. |
| `x`, `y` | `number` | Fractional grid coordinates — the fish's *logical* position; every containment/movement check reads these directly (research.md §2). Never touched by bob (§below). |
| `dirX`, `dirY` | `-1 \| 0 \| 1` each | Current glide direction; at most one of the two is ever non-zero in the common case (mostly horizontal drift, research.md), but both exist so a diagonal drift or a scatter burst can use them uniformly. |
| `bobPhase` | `number` | Advances every frame, wraps; feeds a purely cosmetic vertical pixel offset at render time (research.md §7). Never read by any water/containment check. |
| `turnCooldown` | `number` | Frames remaining before the next random direction change is eligible (FR-010's "sometimes change direction... for no reason at all"); re-randomized on every voluntary turn. |
| `scatterTimer` | `number` | `> 0` while scattering from a nearby shark (FR-018); movement uses a faster, shark-avoiding rule while this is positive, ordinary drift once it reaches 0. |
| `fadeTimer` | `number` | `0` = fully present. `> 0` = fading out (started because its pool fell below the despawn threshold, its own cell stopped being water, or an eraser stroke touched it); the fish is removed from `SeaLifeState.fish` the frame this reaches 0. Movement stops once fading begins (FR-023 — "just fades out," not still swimming while translucent). |

**Validation rules**:
- `grid.elements[round(y) * width + round(x)] === WATER` whenever
  `fadeTimer === 0` — enforced by construction (movement never commits a
  move to a non-water cell, and any cell that stops being water out from
  under a fish starts its fade the same frame it's detected) rather than
  asserted after the fact; the test suite checks it holds after every
  step of a long run (FR-011, mirrored by FR-034's "no fish ever drawn
  outside water").
- A fish's `id` is never reused while it is alive; `SeaLifeState.nextId`
  only increments, matching `PetsState.nextId`'s existing pattern.

## Shark (new)

One larger, faster creature that takes a playful, harmless interest in
fish in reach (Key Entities: Shark).

| Field | Type | Notes |
|---|---|---|
| `id` | `number` | Same role as `Fish.id`. |
| `x`, `y` | `number` | Same containment guarantee as `Fish.x`/`y`. |
| `facing` | `1 \| -1` | Horizontal facing for the glyph flip, updated from its current direction of travel (mirrors `Poodle.facing`). |
| `targetFishId` | `number \| null` | The fish currently being approached, or `null` while cruising with no interest (FR-020). Cleared whenever the named fish no longer exists (despawned/erased) or the chase timer expires. |
| `chaseTimer` | `number` | Counts down while `targetFishId !== null`; reaching 0 ends this pursuit (FR-019) regardless of distance closed. |
| `cruiseCooldown` | `number` | `> 0` immediately after a chase ends; while positive the shark only drifts (like a fish) and will not pick a new target — this is what guarantees "no fish is ever cornered... without relief" has an actual gap in it, not an instant re-pursuit that looks the same as no relief at all. |
| `fadeTimer` | `number` | Same role and guarantee as `Fish.fadeTimer` — starts when its pool falls below the shark despawn threshold, its own cell stops being water, or it's erased. |

**Validation rules**:
- `distance(shark, fish) >= SHARK_MIN_SEPARATION` for every live fish at
  every frame — enforced as a hard pre-move check (a candidate move that
  would violate this for *any* fish, not just the current target, is
  rejected, research.md's shark-movement description) rather than a
  tendency; the test suite runs a long simulated chase and asserts the
  minimum ever observed distance never drops below the constant (FR-017,
  FR-034).
- `SeaLifeState.sharks.length <= GLOBAL_SHARK_CAP` and at most one shark
  per pool label at any completed sweep (FR-005, FR-006).
- No code path ever removes, hides, shrinks, or moves a `Fish` entry as a
  *direct result* of a `Shark`'s proximity or movement — the only
  functions that ever splice `SeaLifeState.fish` are the fade-completion
  sweep (population rules, FR-003…FR-006) and the eraser (FR-024); shark
  stepping only ever mutates `Shark` fields and, indirectly, a fish's
  `scatterTimer`/`dirX`/`dirY` (FR-016).

## SeaLifeState (new)

The whole feature's state, held beside the grid exactly as `PetsState`
is (Key Entities: Sea life state).

| Field | Type | Notes |
|---|---|---|
| `fish` | `Fish[]` | Live fish, across every pool. `length <= GLOBAL_FISH_CAP`. |
| `sharks` | `Shark[]` | Live sharks, across every pool. `length <= GLOBAL_SHARK_CAP`. |
| `nextId` | `number` | Shared id counter across both `fish` and `sharks` (ids are unique across kinds, simplifying render-side per-id tracking the way `PlayArea.svelte` already keys a `Map` by poodle id). |
| `poolId` | `Int32Array` | Length `width * height`; `poolId[i]` is the current sweep's connected-component label for cell `i`, or `-1` if cell `i` is not water or not yet labeled this sweep. Reallocated by `resetSeaLifeState` whenever the grid's dimensions change. |
| `poolSize` | `number[]` | `poolSize[label]` = cell count of that pool; authoritative only once the sweep that produced it has completed (`sweepComplete === true`); rebuilt fresh every sweep. |
| `spawnSample` | `number[][]` | `spawnSample[label]` = up to 8 reservoir-sampled linear cell indices from that pool, used to place new spawns (research.md §3). |
| `sweepQueue` | `Int32Array` | Reusable BFS queue, length `width * height`, indexed by `sweepQueueHead`/`sweepQueueTail` (a ring or a simple head/tail pair over a preallocated array — no per-frame allocation). |
| `sweepQueueHead`, `sweepQueueTail` | `number` | Queue bookkeeping. |
| `sweepCursor` | `number` | Next linear cell index to examine when starting a new region (advances monotonically within a sweep). |
| `sweepNextLabel` | `number` | Next unused pool label. |
| `sweepBudget` | `number` | Cells processed per `stepSeaLife` call, fixed at creation/reset from grid size (research.md §1). |
| `eraserCooldowns` | `{ x: number; y: number; framesRemaining: number }[]` | Naturally small (bounded by recent erase events against an 8-creature total cap). Decremented and pruned every `stepSeaLife` call. |

**Validation rules**:
- `poolId.length === grid.width * grid.height` and `sweepQueue.length ===
  grid.width * grid.height` at all times — `resetSeaLifeState` is the
  only place these are reallocated, and it is called on every code path
  that replaces `grid` with a differently-shaped one (resize, fullscreen
  re-derivation, rotation) before the next `stepSeaLife` call (FR-030).
- Every function that reads `grid` in this module takes it as a
  parameter typed `Grid` and never assigns into any of its arrays — the
  test suite snapshots every `Grid` array before and after a run that
  exercises spawning, chasing, scattering, and despawning, and asserts
  byte-for-byte equality (FR-012, FR-031).
- `fish.length + (creatures currently fading)` never exceeds
  `GLOBAL_FISH_CAP` at the moment a sweep's reconciliation finishes
  handing out new spawns — a fading creature still counts against the
  cap it's leaving so a same-sweep despawn-then-respawn in a different
  pool can't transiently exceed the global cap (an implementation detail
  of the reconciliation order in research.md §4, not a separately stored
  field).

## Public module functions (contract surface — see contracts/sea-life.md for full signatures)

| Function | Role |
|---|---|
| `createSeaLifeState(grid)` | Allocates a fresh `SeaLifeState` sized to `grid`, empty of creatures, sweep restarted from cell 0. |
| `resetSeaLifeState(state, grid)` | Reallocates the sweep buffers to `grid`'s (possibly new) dimensions, clears `fish`/`sharks`/`eraserCooldowns`, restarts the sweep — used for resize/re-derivation (FR-030) and every grid-replacing restore path (load, undo, redo, scene switch), since fish/sharks are never saved (FR-027, FR-028, FR-029). |
| `stepSeaLife(grid, state)` | One frame: advances the sweep by `sweepBudget` cells (running reconciliation if a sweep completes this call), decrements `eraserCooldowns`, steps every fish and shark's movement/AI/fade. Never writes `grid`. |
| `eraseSeaLifeInBrush(state, cx, cy, radius)` | Removes every fish/shark whose position falls inside the circular brush footprint, immediately, and pushes an `eraserCooldowns` entry per removal (FR-024, FR-025). |
| `eraseSeaLifeInBrushLine(state, from, to, radius)` | Bresenham-interpolated repetition of `eraseSeaLifeInBrush` along a drag, matching `eraseObjectsInBrushLine`'s existing pattern so a fast stroke can't skip a creature (FR-024). |
| `clearSeaLife(state)` | Empties `fish`, `sharks`, and `eraserCooldowns` — used by 🗑️ clear-all (FR-026). Leaves sweep buffers alone (the next sweep simply finds an empty or repainted grid and reconciles accordingly). |

## Key Entities cross-reference (from spec.md)

- **Pool** — not a stored entity; it is `poolId`'s current labeling plus
  `poolSize`, re-derived every sweep from `grid.elements` directly, which
  is exactly the spec's own framing ("re-measured from the water as it
  is... what makes every population automatically correct").
- **Fish**, **Shark**, **Sea life state** — modeled above, 1:1 with the
  spec's Key Entities section.
