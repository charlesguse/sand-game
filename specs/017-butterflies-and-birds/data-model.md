# Phase 1 Data Model: Butterflies Over Her Flowers, Birds On Her Palms

Derived from the spec's Key Entities section and research.md's decisions.
This extends 001–016's existing model (`Grid`, `Element`, `Tool`,
`PlacedObject`/`ObjectsState`, `Poodle`/`PetsState`, `WorldState`,
`SavedWorld`/`WireWorld`, `HistoryManager`) — every one of those is reused
**completely unchanged**. This feature adds no `Element`, no `Grid`
field, no `Tool` value, and no field to `WorldState`/`SavedWorld`/
`WireWorld`. This document's new entities — `Butterfly`/`ButterfliesState`
(`src/sim/butterflies.ts`, new) and `Bird`/`BirdsState`
(`src/sim/birds.ts`, new) — are detailed in full below.

## Grid, Element, Tool, PlacedObject, ObjectsState, Poodle, PetsState, WorldState, SavedWorld/WireWorld (all unchanged)

No change of any kind. `FLOWER` (spec 007) and `palm`
(`ObjectKind`, spec 003/004-era objects) are read-only inputs to this
feature; nothing about how they are drawn, grown, placed, swayed, poked,
saved, or undone changes (FR-037). See `research.md` §1/§8 for why this
holds by construction rather than by convention.

## FlowerScanState (new, internal to `butterflies.ts`)

Not exported as part of the feature's public surface beyond
`ButterfliesState.flowerScan` — an implementation detail of the amortized
locate described in research.md §1.

| Field | Type | Notes |
|---|---|---|
| `known` | `{ x: number; y: number }[]` | Every `FLOWER` cell's position as of the last *completed* scan pass. Source of truth for `desiredButterflyCount` and for target selection. Replaced atomically (not mutated in place) when a pass completes. |
| `buffer` | `{ x: number; y: number }[]` | The in-progress pass's accumulator. Never read by anything outside the scan step itself. |
| `nextRow` | `number` | The next grid row to scan, `0 <= nextRow <= grid.height`. Wraps to `0` (and swaps `buffer` into `known`) on reaching `grid.height`. |

**Validation rules**:
- FR-034: `stepButterflies` reads/writes at most `O(width)` cells of
  `grid.elements` per call (a bounded number of full rows), never a full
  `O(width * height)` grid pass within one call.
- On a grid resize/re-derivation, `butterfliesState` (including
  `flowerScan`) is discarded and recreated via `createButterfliesState()`
  (research.md §4) rather than remapped — `nextRow`/`buffer` for the old
  grid's dimensions are never reused against a differently-shaped grid.

## Butterfly (new, `src/sim/butterflies.ts`)

| Field | Type | Notes |
|---|---|---|
| `id` | `number` | Unique per `ButterfliesState`, assigned from `nextId` at spawn. |
| `x`, `y` | `number` | Current position, grid cell coordinates (fractional). Always within `[0, grid.width)` × `[0, grid.height)` by construction (FR-009) — no clamp is ever needed because steering (research.md §3) only ever moves toward an in-bounds target. |
| `state` | `'visiting' \| 'travelling'` | `visiting`: hovering near `targetX`/`targetY` with a wobble offset. `travelling`: steering toward `targetX`/`targetY` from wherever it currently is. |
| `targetX`, `targetY` | `number` | The flower currently being visited (in `visiting`) or travelled toward (in `travelling`) — a position taken from `flowerScan.known` at the moment it was chosen, not a live reference to a grid cell. |
| `headingRadians` | `number` | Current direction of travel while `travelling`, updated each frame by a bearing-to-target term plus a small random wobble (research.md §3) — not stored while `visiting` (the visit wobble uses its own phase, below). |
| `wobblePhase` | `number` | Advances each frame at a per-butterfly rate seeded from `id`; drives both the `visiting` hover offset and the `travelling` heading's added curve, so motion never repeats identically across butterflies — unlike `pets.ts`'s shared `stride` counter (used there to stagger footsteps across poodles), each butterfly's phase is independent because there is no shared "step" for multiple butterflies to stagger. |
| `timer` | `number` | Frames remaining in the current `visiting` dwell before picking a new target. Not used in `travelling` (arrival is distance-based, research.md §3). |
| `facing` | `1 \| -1` | Horizontal facing for the glyph flip, derived from the sign of the last frame's horizontal movement (or bearing while `travelling`); holds its last value while `visiting`. |

**Validation rules**:
- FR-006: nothing ever sets a butterfly's `y` based on gravity, ground
  height, or any element check — the only per-frame writes to `x`/`y` are
  the wobble/steering formulas in research.md §3.
- FR-007/FR-008: `visiting` always transitions to `travelling` (never
  directly to another `visiting` target) and vice versa; a `travelling`
  butterfly's per-frame heading is never exactly the straight bearing to
  target (the wobble term is always added), so the path measurably
  curves over any multi-frame window.
- FR-010: a `travelling` butterfly whose `targetX`/`targetY` is found
  absent from a freshly-completed `flowerScan.known` (or, at arrival,
  from one live cell read) is retargeted or removed that same frame —
  never left `travelling` toward a coordinate already known to be empty.

## ButterfliesState (new, `src/sim/butterflies.ts`)

| Field | Type | Notes |
|---|---|---|
| `butterflies` | `Butterfly[]` | `0 <= butterflies.length <= BUTTERFLY_CAP` (4) at the end of every `stepButterflies` call. |
| `nextId` | `number` | Monotonic, never reused within a session (mirrors `PetsState.nextId`/`ObjectsState.nextId`). |
| `flowerScan` | `FlowerScanState` | See above. |
| `recentErasesAt` | `number[]` | Timestamps (`performance.now()`-scale, or a test-injected clock — see contracts) of recent eraser removals, pruned of entries older than `ERASE_HOLDOFF_MS` (3000) every `stepButterflies` call. Its live (unpruned-but-still-within-window) length is subtracted from `desiredButterflyCount` before spawning (research.md §6). |

**Derived / exported constants**:

| Constant | Value | Notes |
|---|---|---|
| `BUTTERFLY_CAP` | `4` | FR-003's global cap. |
| `FLOWERS_PER_BUTTERFLY` | `4` | FR-003's ratio; `desiredButterflyCount = knownFlowerCount === 0 ? 0 : Math.min(BUTTERFLY_CAP, Math.ceil(knownFlowerCount / FLOWERS_PER_BUTTERFLY))`. |
| `ERASE_HOLDOFF_MS` | `3000` | FR-026, matching spec 014's value by the issue's own instruction. |

**Validation rules**:
- FR-002: `desiredButterflyCount` is `0` whenever `flowerScan.known.length
  === 0`, and `stepButterflies` never spawns when it is `0` — a
  flowerless canvas's `butterflies` array is always empty within one scan
  pass of becoming flowerless.
- FR-005: because `desiredButterflyCount` only changes when
  `flowerScan.known` swaps (at most once per `FLOWER_SCAN_PASS_FRAMES`
  frames), the population cannot grow and shrink more than once within
  that same window.
- FR-023: when `desiredButterflyCount` drops to `0` (the last flower is
  gone, once the scan reflects it), every butterfly is removed within
  that same step — not staged or animated out.

## Bird (new, `src/sim/birds.ts`)

| Field | Type | Notes |
|---|---|---|
| `id` | `number` | Unique per `BirdsState`. |
| `palmId` | `number` | The `PlacedObject.id` of the palm this bird currently belongs to: the perch it is sitting on/hopping on, or (while `flying`) the palm it took off from. |
| `destPalmId` | `number` | Only meaningful while `state === 'flying'`: the `PlacedObject.id` of the palm it is flying to (equal to `palmId` for a single-palm loop). |
| `x`, `y` | `number` | Current drawn position. While `perched`/`hopping`, derived from the live palm object's own `x`/`y`/`size` every frame (never stored independently of it, so a swaying/poked palm's glyph position and the bird's perch position can never drift apart — the bird is drawn at the palm's *current* perch anchor each frame). While `flying`, computed from `flightProgress` via the arc/loop formula (research.md §7). |
| `state` | `'perched' \| 'hopping' \| 'flying'` | |
| `timer` | `number` | Frames remaining in the current `perched` dwell or `hopping` duration. Unused during `flying` (`flightProgress` drives it instead). |
| `flightProgress` | `number` | `0..1` across `FLIGHT_DURATION_FRAMES`, only meaningful while `flying`. |
| `takeoffX`, `takeoffY` | `number` | The perch position captured at the moment a flight begins — the fixed start point of that flight's arc/loop, independent of the origin palm moving afterward (a palm does not move, but capturing this avoids re-deriving "where did this flight start" from a palm that could since have been erased mid-flight, research.md §7/§3-equivalent for birds). |
| `facing` | `1 \| -1` | Derived from the sign of horizontal movement each frame while `hopping`/`flying`; holds its last value while `perched`. |

**Validation rules**:
- FR-014: `perched`/`hopping` positions are always exactly on the live
  palm's footprint (top-center anchor), never floating beside it or
  buried in it — enforced by deriving position from the palm object every
  frame rather than storing an independent offset that could go stale.
- FR-015: `flying` never ends in any `state` other than `perched` on a
  palm present in `ObjectsState.byKind.palm` at the moment
  `flightProgress` reaches `1` — if `destPalmId` is no longer live at
  that moment (erased mid-flight), the bird retargets before completing
  rather than landing on nothing (see BirdsState below).
- FR-016: every sampled `(x, y)` during `flying` satisfies `0 <= x <
  grid.width` and `0 <= y < grid.height` by the clamp formulas in
  research.md §7 — not by a runtime bounds check.

## BirdsState (new, `src/sim/birds.ts`)

| Field | Type | Notes |
|---|---|---|
| `byPalmId` | `Map<number, Bird>` | Keyed by the palm id each bird currently belongs to (its `Bird.palmId`) — the map's own shape enforces "at most one bird per palm" (FR-012); iterating `.values()` gives every live bird. A `flying` bird is still keyed by its *origin* `palmId`, not `destPalmId`, until it lands (at which point it is re-keyed). |
| `nextId` | `number` | Monotonic. |
| `holdoffUntilByPalmId` | `Map<number, number>` | Set (to `now + ERASE_HOLDOFF_MS`) when a bird is erased; the spawn check for that specific palm id is skipped until `now` passes the stored value (research.md §6). Entries are pruned once expired. |

**Derived / exported constant**:

| Constant | Value | Notes |
|---|---|---|
| `BIRD_CAP` | `3` | FR-012's global cap — also the existing per-kind object cap `objects.ts` already enforces for palms, so "one per palm, capped at 3" is automatically consistent with "at most 3 palms can ever exist." |

**Validation rules**:
- FR-012: `byPalmId.size <= BIRD_CAP` always, and `byPalmId.size <=
  ObjectsState.byKind.palm.length` always (a bird is only ever created
  for a palm id that exists at spawn time).
- FR-023: if a bird's `palmId` (while `perched`/`hopping`) or `destPalmId`
  (while `flying`) is no longer present in `ObjectsState.byKind.palm`
  (the palm was erased, evicted, or cleared), the bird either retargets
  to a different live palm (if any remain) that same step, or is removed
  that same step if none remain — never left rendered against a palm
  that no longer exists.
- Edge case ("a bird mid-flight when every palm is erased in the same
  stroke"): the retarget-or-remove check above runs unconditionally every
  step for every bird regardless of `state`, so this is the same code
  path as any other palm removal, not a special case.

## Superseded / extended contracts

- No entity 001–016 already defined changes meaning, shape, or validation
  rules — `Grid`, `Element`, `Tool`, `SceneId`, `PlacedObject`,
  `ObjectsState`, `Poodle`, `PetsState`, `WorldState`,
  `SavedWorld`/`WireWorld`, and `HistoryManager` are completely
  unaffected by this feature (see `contracts/ambient-life-mechanics.md`
  for the exact per-file signature diff, which is empty for every
  `src/sim/*` file this feature does not add).
- Flower growth (spec 007, `FLOWER` element/`stepGrass`'s bloom branch)
  and palm placement/sway/poke (spec 003/004-era `objects.ts`
  `drawObjectGlyph` sway math in `PlayArea.svelte`) are read-only
  dependencies of this feature, not superseded or extended by it — this
  feature adds no field either one reads or writes.
