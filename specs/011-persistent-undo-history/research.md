# Phase 0 Research: Undo That Survives Closing The App

This feature's spec carries no `[NEEDS CLARIFICATION]` marker — every
question it ever had (persistence depth/budget, viewport-mismatch
handling, write timing, redo persistence, corruption/version handling)
was already resolved on issue #35 before this planning stage began, and
`spec.md`'s own Clarifications section records both rounds of resolution.
This document resolves the remaining *implementation-technology*
unknowns needed to fill Technical Context and unblock Phase 1 design —
how a persisted history is paired to the world save it belongs beside
without touching `save.ts`'s existing wire format, exactly how the ~2 MB
budget is filled newest-first, how the write-only-at-flush /
invalidate-on-ordinary-save split (FR-013/FR-013a) is made unit-testable
with no DOM, and how re-anchoring on a reshaped reopen reuses spec 010's
existing remap machinery rather than re-implementing it.

This feature is a direct extension of `001-falling-pink-sand` through
`010-undo-redo`, plus the auto-save behaviour merged in PR #33, all read
from the checked-out code: `save.ts` already owns a versioned,
base64-plus-JSON wire format (`SavedWorld`/`WireWorld`,
`serializeWorld`/`deserializeWorld`, hand-rolled `encodeBase64`/
`decodeBase64` because neither `btoa` nor `Buffer` is available in both
the browser and `vitest`'s Node environment) and a `resyncNextId` helper,
none of which this feature needs to change; `history.ts` already owns
`WorldState` (five parallel `Uint8Array`s plus a `byKind` object list),
`captureWorldState`/`restoreWorldState`/`worldStateFits`, the amended
`remapWorldState`/`wouldRemapLosslessly` pair used both by live
re-derivation and (per FR-016) by this feature's reopen path, and
`HistoryManager` (bounded undo/redo stacks, `HISTORY_DEPTH = 10`,
begin/commit/undo/redo/reset/remap); `PlayArea.svelte` already runs
`saveNow`/`scheduleSave` (a 2000ms-debounced during-play save) and
`tryRestore` (reads `localStorage`, remaps the saved world to the live
grid's dimensions using a bottom-centre offset, calls
`resyncNextId`/`clearPets`/`addPoodle`/`repositionPoodles`, and today
unconditionally calls `history.reset()` at the end), with
`handleVisibilityHidden`/the `pagehide` listener both currently calling
`saveNow` directly as the app's two going-away-flush moments.

## 1. A new key, `rainbow-sand-history-v1`, alongside the existing world-save key — no change to the world-save key's own format

- **Decision**: Persist the history under a second `localStorage` key,
  independent of `SAVE_KEY`. `save.ts`'s `SavedWorld`/`WireWorld` types
  and `serializeWorld`/`deserializeWorld` functions are not touched by
  this feature in any way.
- **Rationale**: This is the most literal way to satisfy FR-012 ("the
  world save MUST take absolute priority... independent... any stale
  history payload MUST be removed rather than left") and FR-023 ("the
  world save and restore MUST behave exactly as they do today") —
  keeping the two payloads under two keys, with the history's own
  key the only one this feature ever writes to, means a bug in this
  feature's new code can structurally never corrupt or resize the world
  save's own storage entry. It also matches the spec's own Key Entities
  framing of "Persisted undo history" as something stored *beside* the
  saved world, not folded into it.
- **Alternatives considered**: Embedding the history inside the existing
  world-save JSON payload (a `history` field on `WireWorld`) — rejected:
  it would force every ordinary during-play world save (which happens far
  more often than a flush, FR-013) to either always carry a stale-or-empty
  `history` field or conditionally omit it, adding a branch to `save.ts`'s
  currently-flush-agnostic `serializeWorld`/`deserializeWorld` and
  coupling a file this feature does not otherwise need to change to a
  concern (flush-only timing) that only `PlayArea.svelte` currently knows
  about. Two independent keys keep that timing knowledge entirely in
  `PlayArea.svelte`, where it already lives today.

## 2. Pairing history to its world save: fingerprint the world's own just-serialized JSON, store the fingerprint inside the history payload

- **Decision**: `computeFingerprint(raw: string): string` (in
  `historySave.ts`) computes a cheap, deterministic hash (32-bit FNV-1a,
  hex-encoded) of the world save's own raw JSON string at the moment it
  is serialized. `serializeHistory` takes that fingerprint as a parameter
  and stores it verbatim as a `worldFingerprint` field in the history
  wire object. On restore, `tryRestore` recomputes the fingerprint of
  whatever raw world-save string it just read from `SAVE_KEY` and passes
  it into `deserializeHistory`, which rejects the payload outright if the
  stored `worldFingerprint` does not match.
- **Rationale**: This is the direct implementation of FR-017's "the
  history payload agrees with the world save it accompanies... and the
  two were written by the same save moment" without adding any field to
  `save.ts`'s own wire format (§1) — the fingerprint is computed *outside*
  `save.ts`, from the string `serializeWorld` already produces, so
  `save.ts` itself stays byte-for-byte unchanged (the strongest possible
  form of FR-023). Because the fingerprint is taken over the world's
  *entire* serialized content (every cell, every object, every poodle),
  it changes on essentially any world-affecting event between two
  flushes, which is exactly the granularity FR-017 needs: two flushes
  producing visually-identical worlds by coincidence would still only
  collide if the world's exact byte content also happened to collide,
  which is the same "safe to treat as equal" case FR-017 is checking for
  in the first place. `writeOrdinarySave` (§4) separately deletes the
  history key on every non-flush save regardless of fingerprinting, which
  is what actually prevents the common "world moved on since the last
  flush" case (spec's own edge case, "a world save lands between
  flushes") — the fingerprint's job is narrower: catching the rarer case
  where a flush's own two writes (world, then history) are interrupted
  between the two, leaving a *stale* history sitting beside a *newer*
  world (§4 elaborates the write ordering that makes this the only
  window where a mismatch can occur).
- **Alternatives considered**: A random or monotonic token generated at
  flush time and written into *both* payloads — rejected because writing
  it into the world payload requires exactly the `save.ts` wire-format
  change §1 rejects, for a guarantee (pairing) the fingerprint already
  gives at zero cost to `save.ts`. A cryptographic hash (SHA-256 via
  `crypto.subtle`) — rejected as needless: `crypto.subtle` is async
  (would force `flushSave`/`tryRestore` to become promise-based for no
  behavioral benefit, complicating the synchronous flush this feature
  must stay inside per FR-013/FR-015) and collision-resistance against an
  adversary is not the property FR-017 needs — a cheap, fast, synchronous
  hash that makes an accidental cross-session collision astronomically
  unlikely is sufficient, and FR-017's own fallback (treat any mismatch as
  stale, discard) means a hash collision fails safe rather than silently
  corrupting anything.

## 3. `serializeHistory`: newest-first greedy fill against a ~2 MB character budget, one pass, no re-stringify-the-whole-object loop

- **Decision**: `HISTORY_BYTE_BUDGET = 2 * 1024 * 1024` (2,097,152)
  characters of serialized JSON — a conservative proxy for bytes given
  the spec's own UTF-16-accounting caveat (Assumptions: "some browsers
  account for stored strings at two bytes per character"). `serializeHistory(steps, width, height, worldFingerprint)`
  walks `steps` (the live undo stack, oldest-first/newest-last, exactly
  `HistoryManager`'s own internal order) from the end backward — newest
  first. For each candidate step it builds the same per-step wire shape
  `save.ts`'s `WireWorld` already uses for a whole world (base64'd
  `elements`/`colorAux`/`cloud`/`glitter`/`grassHeight` plus a `byKind`
  object, reusing `encodeBase64`/`OBJECT_KINDS` — no duplicated codec),
  measures that one step's own `JSON.stringify` length, and accumulates a
  running total; the moment adding a step would push the running total
  over the budget, the loop stops (the step is not added — steps are
  either fully in or fully out, never partially serialized). The kept
  steps are then reversed back to their original oldest-first/newest-last
  relative order before being wrapped in the final `{ version, width,
  height, worldFingerprint, steps }` envelope and `JSON.stringify`'d once.
- **Rationale**: This is FR-008/FR-009's literal shape ("filled
  newest-first... persisted steps MUST keep their relative order") and
  FR-010's edge case falls out for free: if even the single newest step's
  own size already exceeds the budget, the loop's first iteration finds
  `0 + thatStep'sSize > BUDGET` and stops without adding it, leaving
  `steps` empty — "if not even one step fits the budget, zero steps MUST
  be persisted" requires no special-cased branch. The per-step
  measure-then-accumulate approach is `O(n)` in the number of *candidate*
  steps (at most `HISTORY_DEPTH = 10`, almost always far fewer once the
  budget is exhausted), never `O(n^2)` — each step's JSON is computed
  exactly once, never re-stringified as part of a growing whole-object
  probe, keeping this well inside FR-015's "no hitch a child can see" even
  though it runs at a moment (app close) where a hitch is least excusable
  because it is also the least visible to test manually.
- **Alternatives considered**: Filling oldest-first and dropping from the
  end once over budget — rejected outright by FR-009's explicit
  newest-first requirement (the whole point is that *recent* mistakes are
  the ones worth being able to take back after a reopen, per User Story
  2). Re-`JSON.stringify`-ing the accumulating `{ ...envelope, steps:
  [...] }` object after every push to get an exact byte count — rejected
  as the `O(n^2)` alternative to the per-step accumulation above, for a
  precision gain the spec's own Assumptions section explicitly says is
  not required ("correctness must never depend on the arithmetic being
  right — a refused write degrades silently"); the ~1–2% envelope
  overhead (the `version`/`width`/`height`/`worldFingerprint` fields
  and JSON punctuation) not being counted in the running total is
  immaterial against a budget sized with the same conservative slack the
  spec itself calls for.

## 4. `writeOrdinarySave`/`writeFlushSave`: a small `KeyValueStore`-parameterized storage layer, so FR-025's "invalidation... MUST be covered by automated tests that need no DOM" is literally true

- **Decision**: `historySave.ts` exports a minimal structural interface,
  `KeyValueStore` (`getItem`/`setItem`/`removeItem`, exactly
  `localStorage`'s own shape), and two pure orchestration functions
  written against it rather than against the global `localStorage`:
  - `writeOrdinarySave(store, saveKey, historyKey, worldJson)`: if
    `worldJson === ''` (the existing `serializeWorld`-failed sentinel),
    does nothing at all — mirrors `saveNow`'s current "keep whatever save
    exists" comment, extended to leave history untouched too, since an
    aborted save attempt must not invalidate a history that is still
    correctly paired with whatever world save is already on disk.
    Otherwise, writes `worldJson` to `saveKey` (inside its own
    `try`/`catch`, returning early — and leaving the history key
    untouched — if the world write itself throws, e.g. quota), then, only
    if the world write succeeded, removes `historyKey` in its own
    `try`/`catch` (FR-013a: cheap discard, never serializes).
  - `writeFlushSave(store, saveKey, historyKey, worldJson, historyJson)`:
    same `worldJson === ''` / world-write-throws short-circuits as above
    (leaving history exactly as it was — there is nothing valid to pair
    it against). Once the world write succeeds, writes `historyJson` to
    `historyKey` if non-empty, or removes `historyKey` if `historyJson ===
    ''` (the `serializeHistory` "nothing fit the budget" sentinel, §3) —
    each inside its own `try`/`catch`, falling back to a best-effort
    `removeItem` on failure so a quota error partway through never leaves
    a stale history payload behind (FR-012).
  - `PlayArea.svelte` calls both functions passing the global
    `localStorage` directly — it structurally satisfies `KeyValueStore`
    with no adapter object needed.
- **Rationale**: FR-025 explicitly lists "the invalidation of a stored
  history by a world-only save (FR-013a)" among the behaviors that "MUST
  all be covered by automated tests that need no DOM." `localStorage`
  itself is a browser API `vitest`'s `node` environment does not provide
  (confirmed: `vitest.config.ts` sets `environment: 'node'`, and neither
  `save.ts` nor `save.test.ts` ever touches `localStorage` — the existing
  project precedent is that *codec* logic is unit-tested with plain
  strings and `localStorage` plumbing itself is left to `PlayArea.svelte`,
  untested, same as every other DOM-only concern). Parameterizing the two
  orchestration functions over a `KeyValueStore` interface lets
  `historySave.test.ts` exercise the *exact* invalidation/pairing
  decisions (which key gets written, which gets removed, under which
  failure) against a trivial in-memory fake object (a `Map`-backed
  implementation of three methods) with zero DOM and zero new test
  infrastructure — consistent with, not a departure from, constitution
  Principle V's "no browser-automation test infrastructure," since a
  three-method plain-object fake is not automation of a browser, it is
  the same kind of fake collaborator any DOM-free test already uses.
- **Alternatives considered**: Leaving the `localStorage.setItem`/
  `removeItem` calls inline in `PlayArea.svelte`'s `saveNow`/new
  `flushSave`, same as `save.ts`'s current call sites — rejected because
  FR-025 explicitly, by name, requires the invalidation behavior to have
  DOM-free automated coverage, unlike the rest of `PlayArea.svelte`'s
  glue (which this plan deliberately leaves as maintainer-verified,
  matching every prior feature's own DOM/UI-wiring precedent). Passing a
  full mock of the `Storage` interface (implementing every property
  `localStorage` has, e.g. `length`, `key()`) — rejected as needless:
  `writeOrdinarySave`/`writeFlushSave` only ever call three methods, so
  the interface — and therefore the test fake — needs only those three.

## 5. Consistency check has two independent parts: fingerprint (pairing) and recorded-dimension equality (FR-017's "same recorded field dimensions") — re-anchoring to the *live* grid (FR-016) is a separate, later step

- **Decision**: `deserializeHistory(raw, expectedFingerprint)` returns
  `null` (rejected) unless: the payload parses as valid JSON with the
  expected shape; `wire.version === HISTORY_SAVE_VERSION`; every step's
  five arrays decode to exactly `wire.width * wire.height` bytes each
  (mirroring `deserializeWorld`'s own per-field length checks); and
  `wire.worldFingerprint === expectedFingerprint`. On success it returns
  `{ width, height, steps }` — the width/height the history was
  *recorded* at, which `tryRestore` then separately compares against
  `saved.width`/`saved.height` (the width/height the *world save* was
  recorded at, already available from `deserializeWorld`'s own return
  value) before accepting the history at all. Only after both pass does
  `tryRestore` compare `saved.width`/`saved.height` against the *live*
  grid's current dimensions and, if they differ, call the newly-exported
  `remapWorldStates` (§6) to re-anchor the steps — using the exact same
  `offsetX`/`offsetY` `tryRestore` already computes for the world's own
  remap, so the history and the world are re-anchored identically.
- **Rationale**: FR-017 names three independent conditions ("same format
  version, same recorded field dimensions, same session lineage") plus a
  fourth ("written by the same save moment") — this reads as validating
  that the history payload and the world payload *describe the same
  session's save*, which is a check between the two *stored* payloads at
  their own recorded dimensions, not a check against whatever dimensions
  the live grid happens to be at reopen (that is FR-016's separate,
  later concern, worded distinctly as "re-anchored to the new field").
  Keeping the two checks textually and temporally separate in
  `tryRestore` (pairing-and-dimension-match first, live re-anchoring
  second) mirrors the spec's own two-clause structure and is what lets
  `historySave.test.ts` test "same recorded field dimensions" as a pure
  rejection rule with no grid or remap involved at all, while
  `remapWorldStates`'s own tests (§6) cover the "different live field"
  case entirely separately.
- **Alternatives considered**: Treating "same recorded field dimensions"
  as *redundant* with the fingerprint (since both are written from the
  same live grid at the same flush, they can never legitimately differ)
  and skipping the explicit check — rejected: it is one cheap integer
  comparison, and keeping it as an explicit, independently-testable rule
  is more defensive than relying on the fingerprint alone to catch every
  possible way the two payloads could end up mismatched (e.g. a future
  code change that reorders the two writes), at negligible cost.

## 6. `remapWorldStates`: factored out of `HistoryManager.remap` and exported, so the reopen path and the live-re-derivation path share one implementation

- **Decision**: Extract `HistoryManager.remap`'s existing per-state
  filter-then-map body (`wouldRemapLosslessly` + `remapWorldState`,
  already private to `history.ts`) into one new exported free function,
  `remapWorldStates(states, oldWidth, oldHeight, newWidth, newHeight,
  offsetX, offsetY): WorldState[]`. `HistoryManager.remap` becomes a
  two-line wrapper calling it for `undoStack` and `redoStack` in turn
  (behavior-identical — existing `history.test.ts` remap coverage is
  expected to pass unchanged). `PlayArea.svelte`'s `tryRestore` calls the
  same exported function directly on the persisted steps array (after §5's
  checks pass, only when `saved.width`/`saved.height` differ from the
  live grid) before handing the result to
  `HistoryManager.restoreFromPersisted` (§8).
- **Rationale**: This is the literal reading of FR-016 ("re-anchored to
  the new field exactly as spec 010's amended FR-022 re-anchors live
  history on a re-derivation... The machinery already exists") — sharing
  one function rather than re-implementing the same filter-then-map logic
  a second time inside `PlayArea.svelte` or `historySave.ts` means the two
  call sites can never drift out of sync (the exact same argument spec
  010's own `wouldRemapLosslessly`/`remapWorldState` split already makes
  for its two internal call sites, extended to a third).
- **Alternatives considered**: Duplicating the filter-then-map loop
  inside `historySave.ts` (which cannot see `HistoryManager`'s private
  `wouldRemapLosslessly` today) — rejected: it would create exactly the
  kind of "two places that must never drift apart" risk `history.ts`'s
  own doc comments already warn against for `destInBounds`/`objectFits`.
  Calling `HistoryManager.remap` itself (which operates on the *live*
  stacks in place) from `tryRestore` before seeding them — rejected: at
  the point `tryRestore` needs to remap, the persisted steps are not yet
  the live undo stack (they still need the fingerprint/dimension gate of
  §5 to pass first, and a failed gate must produce *zero* steps, not a
  remap of steps that should have been discarded outright); a pure
  function taking and returning a plain array is the right shape for that
  ordering.

## 7. `historySave.ts` is a new file, not folded into `save.ts` or `history.ts`

- **Decision**: All of §1–§6's machinery lives in one new file,
  `src/sim/historySave.ts`.
- **Rationale**: Its concern — a bounded, budgeted, fingerprint-paired
  persistence format for a *list* of `WorldState`s, plus the storage
  orchestration deciding which key gets touched when — is a third axis
  distinct from "serialize one world" (`save.ts`) and "own the in-memory
  bounded stacks and their remap" (`history.ts`). This is the same
  "one file, one coherent concern" boundary spec 010's own research.md
  drew between `history.ts` and `grid.ts` (§1 there), and keeping it
  separate from `save.ts` specifically is what makes "zero change to
  `save.ts`" (§1 here, and this plan's Summary) a structural fact rather
  than a discipline to maintain by hand.
- **Alternatives considered**: Adding history persistence functions
  directly to `save.ts` (natural home for "the other persisted thing") —
  rejected: `save.ts` currently has no concept of a *budget*, a *list* of
  states, or *flush-vs-ordinary* timing, all of which are this feature's
  entire reason for existing; bolting them on would make `save.ts` do two
  substantially different jobs. Adding them to `history.ts` — rejected on
  the same "different axis" grounds spec 010 already used to justify
  giving `history.ts` its own file rather than folding it into `grid.ts`;
  `history.ts`'s existing job (own the live bounded stacks) stays exactly
  as focused as it is today, gaining only the two small persistence-facing
  methods (§8) it must expose as its own public surface.

## 8. `HistoryManager` gains exactly two new methods; nothing about its existing surface changes

- **Decision**: `HistoryManager` gains:
  - `getPersistableUndoStack(): readonly WorldState[]` — returns the live
    `undoStack` array directly (not cloned) in its existing oldest-first/
    newest-last order, for `flushSave` to read from. Callers must not
    mutate the returned array; `historySave.ts` only ever reads it.
  - `restoreFromPersisted(states: WorldState[]): void` — replaces
    `undoStack` with `states` (already validated, already re-anchored if
    needed), clears `redoStack` to `[]` (FR-007: redo is never persisted),
    and clears `pending` to `null` — the reopen-restore counterpart to the
    existing `reset()`, called by `tryRestore` in place of today's
    unconditional `history.reset()`.
- **Rationale**: This is the minimum surface `PlayArea.svelte`'s
  `flushSave`/`tryRestore` need and mirrors the existing
  `canUndo()`/`canRedo()` pattern of exposing only booleans/small reads,
  never the raw mutable stacks, from outside `history.ts` (spec 010's own
  contract: "No getter exposes the raw stacks"). `getPersistableUndoStack`
  is the one narrow, deliberate exception — it exposes the array
  reference itself (not a clone) because `historySave.ts` only reads it
  once, synchronously, inside the same flush call that produced it, so a
  defensive clone would be a wasted allocation on the very path FR-014/
  FR-015 ask this feature to keep cheap.
- **Alternatives considered**: Exposing the raw `undoStack` field as
  public and letting `PlayArea.svelte`/`historySave.ts` read it directly
  — rejected: keeping a named accessor method preserves `HistoryManager`'s
  existing "no getter exposes the raw stacks" contract's *spirit* (the
  field itself stays `private`, encapsulation is preserved, only a
  read-only *view* is exposed) and gives the accessor a name
  (`getPersistableUndoStack`) that documents its one intended caller and
  purpose, rather than a bare public field any future code could read or
  reassign.

All Technical Context unknowns are resolved; nothing carries forward to
Phase 1 as unresolved.

## Decisions made without clarification

Both rounds of `[NEEDS CLARIFICATION]` markers this spec ever had were
already resolved on issue #35 before this planning stage began (`spec.md`'s
own Clarifications section: persistence depth/budget, viewport-mismatch
handling, write timing, undo-past-reopen semantics, and version/corruption
handling in the first round; redo persistence and write cadence in the
second). The following implementation-technology choices were made without
further clarification because the spec leaves them as implementation
detail, not product intent:

- **The fingerprint-of-the-world's-own-JSON pairing mechanism** (§2),
  chosen specifically so `save.ts`'s existing wire format needs no change
  — the spec's FR-017 specifies *what* must be checked ("same save
  moment," "same session lineage") but not *how*; a shared token embedded
  in both payloads was the most obvious alternative and was rejected in
  favor of the fingerprint precisely to keep `save.ts` untouched.
- **The exact history wire shape and the `~2 MB` budget's units**
  (character count of serialized JSON, not raw byte count) — the spec's
  own Assumptions section explicitly flags this arithmetic as
  "approximate and platform-dependent" and says "correctness must never
  depend on the arithmetic being right," so the exact constant
  (`2 * 1024 * 1024` characters) and the per-step greedy-fill algorithm
  (§3) are this plan's own reading, sized conservatively per the spec's
  own instruction.
- **The `KeyValueStore`-parameterized storage layer** (§4) — an
  implementation-technology choice made specifically to satisfy FR-025's
  explicit "no DOM" testing requirement for the invalidation behavior;
  the spec does not mandate any particular test-architecture shape.
- **Splitting the consistency check into two independent parts**
  (fingerprint/pairing vs. recorded-dimension equality, §5) rather than
  one combined check, and **factoring `remapWorldStates` out of
  `HistoryManager.remap`** (§6) rather than re-implementing re-anchoring a
  second time — both are internal code-organization choices in service of
  FR-017/FR-016's behavioral requirements, not requirements the spec
  itself names as implementation constraints.
- **The two new `HistoryManager` method names and shapes** (§8) — the
  spec's Key Entities section describes "Persisted undo history" and
  "Reopen restore" as concepts, not as a method-level API; this plan's
  naming follows the existing `HistoryManager` method-naming convention
  (`canUndo`/`canRedo`/`reset`) as closely as possible.
