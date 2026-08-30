# Phase 1 Data Model: Undo That Survives Closing The App

Derived from the spec's Key Entities section and research.md's decisions.
This extends `specs/010-undo-redo/data-model.md`'s World state / User
action / Undo history / Redo history / Undo control / Redo control model
(and, transitively, 001–009's every prior entity, plus PR #33's auto-save
`SavedWorld`/`WireWorld`). Everything there is reused **completely
unchanged** — this feature adds no element, no `Grid` field, no `Tool`
value, no `Toolbar.svelte` control, and no change to `save.ts`'s
`SavedWorld`/`WireWorld` shape. This document's new entities — Persisted
history payload, History budget, `KeyValueStore`, and the extended
`HistoryManager`/reopen-restore behavior — are detailed in full below.

## Grid, Element, Tool, Scene, PlacedObject, ObjectsState, WorldState, SavedWorld/WireWorld (all unchanged)

No change of any kind. Every field/shape `010-undo-redo/data-model.md`
and PR #33's auto-save established is exactly as it was: `WorldState`
(`elements`/`colorAux`/`cloud`/`glitter`/`grassHeight`/`byKind`, per
`history.ts`'s current shape), `captureWorldState`/`restoreWorldState`/
`worldStateFits`/`remapWorldState`/`wouldRemapLosslessly`, and `save.ts`'s
`SavedWorld`/`WireWorld`/`serializeWorld`/`deserializeWorld`/
`encodeBase64`/`decodeBase64`/`resyncNextId`. This is itself load-bearing
for FR-023 ("the world save and restore MUST behave exactly as they do
today") — nothing about how a world is captured, restored, remapped, or
saved changes.

## Persisted history payload (new)

The on-disk wire format for the tail of the previous session's undo
stack, stored under `localStorage` key `rainbow-sand-history-v1`
(`src/sim/historySave.ts`, new):

| Field | Type | Notes |
|---|---|---|
| `version` | `number` | `HISTORY_SAVE_VERSION` — bumped whenever this wire shape changes; `deserializeHistory` rejects any other value (FR-018). Independent of `save.ts`'s own `SAVE_VERSION`. |
| `width`, `height` | `number` | The live grid's dimensions at the moment of the flush that wrote this payload — the dimensions every step's arrays are sized to before any reopen-time remap. Compared against the paired world save's own recorded `width`/`height` on restore (FR-017's "same recorded field dimensions" — research.md §5), *not* against the live grid at reopen (that is the separate re-anchoring step, FR-016, research.md §6). |
| `worldFingerprint` | `string` | `computeFingerprint(rawWorldJson)` — a short deterministic hash of the world save's own just-serialized JSON string, computed at the same flush that wrote this payload (research.md §2). Restoring compares this against a fingerprint freshly computed from whatever raw world-save string is currently stored — a mismatch means the two payloads were not written by the same save moment, and the whole payload is rejected (FR-017). |
| `steps` | `WireHistoryStep[]` | The kept undo-stack tail, oldest-kept-first / newest-last (the same relative order `HistoryManager`'s own `undoStack` uses), filled newest-first against the budget and reversed back into that order before storage (FR-009, research.md §3). Length is at most `HISTORY_DEPTH` (10) by construction — the source array (`getPersistableUndoStack()`) can never exceed it — and in practice far fewer once the budget is exhausted (User Story 2). |

Each `WireHistoryStep` mirrors `save.ts`'s existing `WireWorld` per-cell
shape exactly (reusing `encodeBase64`/`OBJECT_KINDS` — no duplicated
codec):

| Field | Type | Notes |
|---|---|---|
| `elements`, `colorAux`, `cloud`, `glitter`, `grassHeight` | `string` (base64) | Base64-encoded `Uint8Array`s, one `WorldState` step, sized `width * height` bytes each before encoding. |
| `byKind` | `Record<ObjectKind, WireObject[]>` | One entry per `OBJECT_KINDS` value, each a plain array of `{ id, kind, x, y, size }` — identical shape to `save.ts`'s own `WireObject`. |

**Explicitly not part of a persisted step**: poodles/pets (spec's own
Assumption: "pets are not part of a history step today and do not become
part of one here" — unchanged from spec 010); any redo-stack content
(FR-007 — the redo stack is never persisted at all, `serializeHistory`
only ever reads `getPersistableUndoStack()`, which exposes the undo stack
only); every internal per-cell timer `WorldState` itself already excludes
(unchanged from spec 010's FR-028 — nothing new is captured by this
feature that spec 010's own capture did not already capture).

**Size**: bounded by `HISTORY_BYTE_BUDGET` (research.md §3) —
approximately 2,097,152 characters of serialized JSON, a conservative
proxy for bytes given the spec's own UTF-16-accounting caveat
(Assumptions). At spec 006's `CELL_BUDGET = 43,200` (the largest field
size), one step's five base64'd arrays alone run to roughly the same
order of magnitude as the measured ~286 KB whole-world save (Assumptions:
"each history snapshot serializes to roughly the same [size as the world
save]"), so the budget holds roughly 5–7 steps at that field size and
fewer at a larger one (User Story 2) — never more than `HISTORY_DEPTH`
(10) regardless of field size, since the source stack itself is capped
there.

**Serialize** (`serializeHistory(steps: readonly WorldState[], width:
number, height: number, worldFingerprint: string): string`, new,
`historySave.ts`): greedy newest-first fill against the budget (research.md
§3), one pass, `O(kept steps)` allocation. Never throws — any internal
failure is swallowed and `''` returned, exactly `serializeWorld`'s own
contract, which `writeFlushSave` (below) already treats as "nothing to
persist, remove any stale key" (FR-012).

**Deserialize** (`deserializeHistory(raw: string, expectedFingerprint:
string): { width: number; height: number; steps: WorldState[] } | null`,
new, `historySave.ts`): validates JSON shape, `version`, every step's
per-array length against `width * height`, and `worldFingerprint`
equality — returns `null` on **any** failure (wrong version, truncated
data, corrupt base64, mismatched lengths, hand-edited garbage, a
fingerprint mismatch), never throws (FR-018). Defensively truncates a
successfully-parsed `steps` array to at most the newest `HISTORY_DEPTH`
(10) entries before returning, guarding the invariant `HistoryManager`
relies on elsewhere even against a hand-edited payload for a small field
size where more than 10 steps could otherwise fit under the byte budget
(research.md's note under §8 — not spec-mandated explicitly, a defensive
extension of FR-011).

## History budget (new)

| Concept | Value | Notes |
|---|---|---|
| `HISTORY_BYTE_BUDGET` | `2 * 1024 * 1024` (2,097,152) | Serialized-JSON character count, not raw byte count (research.md §3). Decides how many steps survive a close; never decides how many steps the *running* app remembers — `HISTORY_DEPTH` (10, unchanged from spec 010) still governs the in-memory stacks (FR-011). |
| `HISTORY_SAVE_VERSION` | `1` | Independent of `save.ts`'s `SAVE_VERSION`; bumped only if this feature's own wire shape changes. |

**Validation rules**:
- FR-008/SC-004: `serializeHistory`'s output is always `<=` roughly
  `HISTORY_BYTE_BUDGET` (plus a small, deliberately-uncounted envelope
  overhead — research.md §3) at every field size spec 006 allows.
- FR-009/SC-005: the steps present in a successfully-deserialized payload
  are always the newest ones from the session that wrote them, in their
  original relative order.
- FR-010: an empty `steps` array is a fully valid, successfully-parsed
  payload (or the payload is simply absent) — either way, `canUndo()` is
  `false` and the reopen is indistinguishable from today's behavior.

## `KeyValueStore` and storage orchestration (new)

| Concept | Type | Notes |
|---|---|---|
| `KeyValueStore` | `{ getItem(key): string \| null; setItem(key, value): void; removeItem(key): void }` | Structural interface `localStorage` already satisfies; exists so `writeOrdinarySave`/`writeFlushSave` are unit-testable with a plain in-memory fake, no DOM (research.md §4, FR-025). |
| `writeOrdinarySave(store, saveKey, historyKey, worldJson)` | function | The existing during-play debounced save's storage-side effect: writes the world, then unconditionally removes the history key (FR-013a) — unless `worldJson` is the `serializeWorld`-failure sentinel (`''`) or the world write itself throws, in which case nothing is touched at all. |
| `writeFlushSave(store, saveKey, historyKey, worldJson, historyJson)` | function | The going-away flush's storage-side effect: writes the world (same short-circuits as above), then, only if that succeeded, writes or removes the history key depending on whether `historyJson` is empty — each step independently guarded so a history-write failure (quota, storage disabled) can never prevent or undo the world write, and never leaves a stale history behind (FR-012, FR-019). |

**Validation rules**:
- FR-013/FR-013a: history is written to storage **only** from inside
  `writeFlushSave`; `writeOrdinarySave` never calls `store.setItem` for
  `historyKey`, only `store.removeItem` — the two functions' names and
  bodies are the mechanical proof of "written only at flush moments."
- FR-012/SC-006: with a `KeyValueStore` whose `setItem` always throws,
  `writeFlushSave`/`writeOrdinarySave` still leave the world's own
  `setItem` call attempted and, if it throws too, the function returns
  having touched nothing — never a partial write of one key without the
  other's own guard running.
- SC-016: a `writeOrdinarySave` call after a prior `writeFlushSave` call
  (same store) always results in `historyKey` absent, modeling "a world
  save lands between flushes."

## Undo history / Redo history (extended — `HistoryManager`, `src/sim/history.ts`)

Everything in `010-undo-redo/data-model.md`'s "Undo history / Redo
history" section is unchanged (the bounded stacks, `HISTORY_DEPTH = 10`,
`pending`, eviction/clear rules). This feature adds two methods and one
exported free function:

| Addition | Type | Notes |
|---|---|---|
| `getPersistableUndoStack()` | `(): readonly WorldState[]` | Returns the live `undoStack` array (not cloned) in its existing oldest-first/newest-last order — the one and only read this feature's persistence code performs against `HistoryManager`'s private state (research.md §8). |
| `restoreFromPersisted(states)` | `(states: WorldState[]): void` | Replaces `undoStack` with `states`, clears `redoStack` to `[]` and `pending` to `null` — the reopen-restore counterpart to the existing `reset()`. Called by `tryRestore` with either the (possibly remapped) persisted steps or `[]` when nothing survived validation. |
| `remapWorldStates(states, oldWidth, oldHeight, newWidth, newHeight, offsetX, offsetY)` | exported free function `(states: readonly WorldState[], ...) => WorldState[]` | Factored out of `HistoryManager.remap`'s existing body (research.md §6) — filters to states that remap losslessly, maps the survivors, preserves relative order. Shared by `HistoryManager.remap` (live re-derivation, unchanged behavior) and `PlayArea.svelte`'s reopen path (new caller). |

**Validation rules**:
- FR-001/FR-004: after a successful `restoreFromPersisted` with at least
  one state, `canUndo()` is `true`; with zero states (or when
  `history.reset()` is called instead, on any validation failure),
  `canUndo()` is `false` — indistinguishable, from `Toolbar.svelte`'s
  point of view, from today's page-load state (no `Toolbar.svelte` change
  needed — spec 010's existing `disabled={!canUndo}` wiring already
  produces the correct dimmed/lit rendering for whichever boolean
  `onHistoryChange` reports).
- FR-005/FR-006: a new action recorded after `restoreFromPersisted`
  behaves exactly as it does after `reset()` today — `commitAction`'s
  existing eviction-past-`HISTORY_DEPTH` and clear-redo-stack logic is
  completely unmodified by this feature.
- FR-007: `restoreFromPersisted` always sets `redoStack = []` regardless
  of what (if anything) is passed in — there is no code path by which a
  persisted redo entry could ever reach `HistoryManager`, since
  `serializeHistory` never reads the redo stack in the first place.
- FR-016: `remapWorldStates`'s output is byte-for-byte what
  `HistoryManager.remap`'s pre-refactor inline logic already produced for
  the same inputs — the refactor is behavior-preserving by construction
  (same `wouldRemapLosslessly`/`remapWorldState` calls, same filter-then-
  map shape, just relocated and exported).

## Reopen restore (extended — `PlayArea.svelte`'s `tryRestore`)

The moment a saved world and its paired history are read back into a
fresh session. Extends spec 010's data-model note that this was
previously an unconditional `history.reset()`; now a five-way outcome:

| Outcome | When | Result |
|---|---|---|
| No saved world | `localStorage.getItem(SAVE_KEY) === null`, or invalid | Fresh grid, both histories empty — unchanged from today. |
| World restored, no history key | `getItem(HISTORY_KEY) === null` | World restored as today; `history.reset()` — unchanged from today's behavior (also covers a page load that predates this feature ever having written a history payload). |
| World restored, history payload invalid | `deserializeHistory` returns `null` (bad version/shape/fingerprint) | World restored as today; `history.reset()` — FR-018/FR-019: a broken or stale history never costs the picture. |
| World restored, history valid, same dimensions as the world save | `persisted.width === saved.width && persisted.height === saved.height` (§5) **and** those equal the live grid's dimensions | `history.restoreFromPersisted(persisted.steps)` — no remap (FR-016 Scenario 4: "no re-anchoring happens at all and every persisted step comes back untouched"). |
| World restored, history valid, live grid reshaped | Same as above, but `saved.width`/`saved.height` differ from the live grid | `history.restoreFromPersisted(remapWorldStates(persisted.steps, saved.width, saved.height, grid.width, grid.height, offsetX, offsetY))` — same `offsetX`/`offsetY` `tryRestore` already computes for the world's own remap (User Story 3). |

**Validation rules**:
- FR-002/FR-003: every outcome above ends with exactly one
  `onHistoryChange?.(history.canUndo(), history.canRedo())` call (moved
  from its current unconditional position after `history.reset()` to
  after whichever of the five branches ran) — the toolbar's dimmed/lit
  state always reflects the true outcome, with no intermediate flash of
  the wrong state.
- FR-017: the "history valid" branches are only reached after **both**
  the fingerprint check (research.md §2) and the recorded-dimension
  equality check (research.md §5) pass — either failing alone is
  sufficient to fall through to `history.reset()`.
- Edge case ("closing mid-stroke"): unaffected — a `pending` (in-progress)
  capture was never part of `getPersistableUndoStack()`'s output
  (`HistoryManager`'s existing field, not the persisted stack) and
  `restoreFromPersisted` always sets `pending = null` regardless.

## Superseded / extended contracts

- Spec 010's **FR-021** ("History MUST NOT be persisted. On page load
  both histories are empty and both buttons are dimmed") is superseded
  for the *undo* history only, exactly as `spec.md`'s own "Superseded
  requirements" section states — its redo clause is unchanged and is
  restated as this spec's FR-007, itself unchanged in behavior from
  spec 010's own wording.
- Spec 010's amended **FR-022**/`wouldRemapLosslessly`/`remapWorldState`
  contract is **not** superseded and is relied on directly, now through
  the newly-exported `remapWorldStates` wrapper (research.md §6) rather
  than only through `HistoryManager.remap`'s private body — the
  underlying re-anchoring semantics are byte-for-byte unchanged.
- The phase-6 auto-save behavior ("History starts empty after a restore —
  the restored world is the new baseline," `tryRestore`'s current
  unconditional `history.reset()` call) is superseded by the five-outcome
  table above — the restored world is no longer treated as a baseline
  when a valid, paired history survives.
- No entity 001–010 already defined changes meaning, shape, or validation
  rules — `Grid`, `Element`, `Tool`, `SceneId`, `PlacedObject`,
  `ObjectsState`, `WorldState`, `SavedWorld`/`WireWorld`, and every
  fog/star-power/grass/undo-redo entity from specs 007–010 are completely
  unaffected by this feature (see `contracts/persistent-history-
  mechanics.md` for the exact per-file signature diff, which is empty for
  `save.ts` and every `src/sim/*` file this feature does not add).
