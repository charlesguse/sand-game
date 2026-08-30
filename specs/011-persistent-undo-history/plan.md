# Implementation Plan: Undo That Survives Closing The App

**Branch**: `spec/011-persistent-undo-history` | **Date**: 2026-08-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-persistent-undo-history/spec.md`

## Summary

Add one new, framework-free module, `src/sim/historySave.ts`, that
serializes a bounded, newest-first slice of `HistoryManager`'s live undo
stack to a versioned wire format under a ~2 MB character budget
(FR-008/FR-009), and deserializes it back on reopen — reusing the exact
`captureWorldState`/`restoreWorldState`/`remapWorldState` machinery
`src/sim/history.ts` already owns, and the exact base64/JSON codec
`src/sim/save.ts` already owns, so this feature adds **zero** lines to
either of those two files' existing exported behavior for the world save
itself (FR-023's "world save and restore MUST behave exactly as they do
today" holds by construction, not by a separately-verified regression
pass). Pairing a persisted history to the world save it was written
beside (FR-017's "same save moment") is done by hashing the world save's
own just-serialized JSON string into a short fingerprint stored inside
the history payload — no new field is added to the world wire format, so
`save.ts`'s `SavedWorld`/`WireWorld` shape and `serializeWorld`/
`deserializeWorld` signatures are untouched. `history.ts` gains two small
`HistoryManager` methods (`getPersistableUndoStack`/
`restoreFromPersisted`) and one exported free function
(`remapWorldStates`, factored out of the existing `HistoryManager.remap`
so the live-re-derivation path and the reopen-restore path share one
re-anchoring implementation, per FR-016's explicit "the machinery already
exists" instruction). `historySave.ts` also exports two small storage-
orchestration functions, `writeOrdinarySave`/`writeFlushSave`, written
against a minimal `KeyValueStore` interface (`getItem`/`setItem`/
`removeItem`) rather than calling `localStorage` directly — this is what
makes FR-025's explicit requirement to cover "the invalidation of a
stored history by a world-only save (FR-013a)" with a no-DOM test
possible: a plain in-memory fake object satisfies `KeyValueStore` in
`vitest` with no browser API at all, exactly like `save.test.ts` already
exercises `serializeWorld`/`deserializeWorld` with plain strings and no
`localStorage`. `PlayArea.svelte` gains one new constant
(`HISTORY_KEY`), one new function (`flushSave`, wired to the existing
`visibilitychange`-hidden/`pagehide` listeners in place of `saveNow`),
and a small addition to the existing `tryRestore` that reads the history
key, verifies it against the just-read world save via the same
fingerprint, remaps it if the field size differs (reusing the offsets
`tryRestore` already computes for the world remap), and calls
`history.restoreFromPersisted` instead of the current unconditional
`history.reset()` — `saveNow` itself keeps writing the world save exactly
as it does today and additionally calls `writeOrdinarySave` (which
invalidates any stored history, FR-013a) in place of its own bare
`localStorage.setItem`.

## Technical Context

**Language/Version**: TypeScript 5.x, Node 22 (matches
`.github/workflows/deploy-pages.yml`) — unchanged from 001–010.

**Primary Dependencies**: `svelte` 5, `vite`, `@sveltejs/vite-plugin-svelte`,
`vite-plugin-singlefile`, `vitest`, `typescript` — unchanged; no new
runtime dependency (research.md §8). No new browser API: this feature
reuses the `localStorage` PR #33's auto-save already established as the
project's one persistence mechanism (constitution "Persistence" clause),
under a second key alongside the existing world-save key.

**Storage**: `localStorage`, extended with one new key,
`rainbow-sand-history-v1` (research.md §1, §3), written and read beside
the existing `rainbow-sand-world-v1` world-save key. No IndexedDB, no
cookies, no network — unchanged from PR #33's auto-save (FR-021, FR-026).

**Testing**: `vitest`, adding `tests/unit/sim/historySave.test.ts` (new —
codec round trips per element/property, budget filling newest-first at a
range of field sizes, version/shape/fingerprint/dimension rejection,
`writeOrdinarySave`/`writeFlushSave` against a plain in-memory fake
`KeyValueStore`, `remapWorldStates` losslessness) and a small, additive
set of new `describe` blocks in `tests/unit/sim/history.test.ts`
(`getPersistableUndoStack`/`restoreFromPersisted`, and `remapWorldStates`
producing identical output to the pre-refactor `HistoryManager.remap`
internals it now shares). No existing test file's existing assertions
change (FR-023) — this feature's entire `src/sim/*` diff is one new file
plus additive, non-breaking extensions to `history.ts`. All plain,
DOM-free `TypeScript` against `Grid`/`ObjectsState`/`HistoryManager`/
plain strings and a fake `KeyValueStore` object (constitution Principle
V, FR-025) — no browser-automation infra added. The genuinely DOM-only
parts of this feature (the seam being invisible on-device, the flush not
stalling on close, `localStorage` actually surviving a real close-and-
reopen on each maintained platform) are the maintainers' on-device job
per quickstart.md, matching PR #33's and spec 010's own precedent.

**Target Platform**: Static single-file page opened via `file://` or
served from GitHub Pages; the two maintained platforms per `CLAUDE.md` —
Amazon Fire 7 Kids-class tablet (Silk) and desktop Chrome (Charlie), iPad
standalone home-screen app (Max). Same storage mechanism, no
platform-specific code path (FR-026).

**Project Type**: Single-page client-only web app — no backend/API.
Unchanged.

**Performance Goals**: Steady 60fps target, 30fps floor (constitution
Principle IV, FR-015), specifically unaffected during ordinary play — the
2 MB-budget history write happens exactly once per going-away flush, never
per frame and never on the existing debounced during-play save path
(FR-013, FR-014, SC-010, SC-015). `serializeHistory`/`computeFingerprint`
are each `O(width * height)` per persisted step (at most `HISTORY_DEPTH =
10` steps, in practice far fewer under the 2 MB budget) — the same per-
action cost order `captureWorldState` already pays, run once at the one
flush moment rather than per action (SC-009).

**Constraints**: The per-frame simulation/render path stays untouched and
allocation-free (constitution Principle IV) — this feature's only
allocations happen inside `flushSave`/`tryRestore`, never inside
`frame()` (FR-014). Persisted history bounded to ~2 MB serialized
character count, conservatively sized against the ~5 MB per-origin quota
per the spec's own UTF-16 accounting caveat (FR-008, SC-004). Production
build must still emit exactly one output file, zero runtime network
requests, and grow by at most 3 KB (FR-024) — satisfied by construction:
one new, modestly-sized source file, small additive wiring in three
existing files, no new dependency. History must never be written outside
a going-away flush (FR-013, FR-013a) and must add no visible hitch
(FR-015) — enforced by construction (`flushSave` is the only call site
that ever calls `serializeHistory`) and spot-checked by
`tests/unit/sim/historySave.test.ts` asserting `serializeHistory` is a
pure function of its inputs with no timers, no `localStorage`, no
side-channel state.

**Scale/Scope**: One feature, three prioritized user stories (survive a
close; degrade silently under a size budget; survive a reshaped reopen).
Adds exactly one new source file (`src/sim/historySave.ts`) and one new
test file (`tests/unit/sim/historySave.test.ts`); extends `history.ts`
(two new `HistoryManager` methods, one new exported free function,
`HistoryManager.remap`'s body refactored to call it — no behavior change)
and its test file additively; extends `PlayArea.svelte` (one new
constant, one new function, a small branch inside the existing
`tryRestore`, the existing `visibilitychange`/`pagehide` listeners
retargeted from `saveNow` to the new `flushSave`) without changing
`saveNow`'s or `tryRestore`'s existing world-save behavior. No change
whatsoever to `save.ts`, `main.ts`, `index.html`, `types.ts`,
`element.ts`, `shade.ts`, `grid.ts`, `step.ts`, `brush.ts`, `wand.ts`,
`objects.ts`, `scenes.ts`, `resize.ts`, `App.svelte`, `Toolbar.svelte`, or
`src/lib/layout.ts` — this feature adds no control, no prop, no toolbar
change of any kind (FR-020). No new top-level architecture, no new build
tooling.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. One Self-Contained Page | No new build step, asset, font, or runtime dependency; the one new file (`src/sim/historySave.ts`) and every wiring change live in `src/sim/*`/`src/lib/*`, already bundled into `dist/index.html`. Build size growth is bounded by source-code size alone, comfortably under FR-024's 3 KB ceiling. | PASS |
| II. Built For An Almost-5-Year-Old | No new control, message, confirmation, score, or text prompt anywhere (FR-020) — the only observable change is whether ↩️ is lit or dimmed on reopen, using the exact same dimmed-vs-lit visual language spec 010 already established. Every failure path (quota, corruption, staleness, a field that no longer fits) degrades silently to today's exact behaviour (FR-010, FR-012, FR-018, FR-019). | PASS |
| III. Simple, Dependency-Light Svelte | No new dependency (research.md §8). The entire serialize/deserialize/budget/fingerprint/storage-orchestration mechanism lives in one new, framework-free `src/sim/*` module, isolated from Svelte exactly like `history.ts` and `save.ts` already are — `PlayArea.svelte`'s diff is a thin call-site change, not a parallel state-management layer. | PASS |
| IV. Performance Is A Feature | `serializeHistory`/`deserializeHistory`/`computeFingerprint` are `O(width * height)` per step and run exclusively inside `flushSave` (going-away moments only) and `tryRestore` (page load only) — never inside `frame()` (FR-014, SC-010). SC-009 names this feature's own worst case (a full history, full field, weather running, a lawn burning, on a Fire 7) and the design's cost model (bounded one-time work at a flush, not a frame) directly satisfies it. | PASS |
| V. Verifiable Without A Browser Harness | `npm run build` still emits a single `dist/index.html`; `tests/unit/sim/historySave.test.ts` plus additive `history.test.ts` blocks cover every rule FR-025 lists — serialization, deserialization, budget filling, version/consistency/staleness rejection, the storage-invalidation contract (via the injectable `KeyValueStore`, needing no `localStorage`/DOM), re-anchoring on a size change, and the restored history's effect on `canUndo`/`canRedo` — directly against plain TypeScript values, no DOM. The genuinely on-device parts (the seam being invisible, the close not stalling, real `localStorage` surviving a real close on each platform) are the maintainers' job per quickstart.md, the same split spec 010 and PR #33 already established. No browser-automation infra is added. | PASS |

No violations — Complexity Tracking is not needed. The most consequential
design decision — pairing a history payload to its world save via a
fingerprint of the world's own serialized JSON, rather than adding a
shared token field to `save.ts`'s wire format — is not a constitution
trade-off; it is what keeps `save.ts` (and therefore the world save's own
tested, shipped behavior) completely untouched by this feature, which is
the most direct possible proof of FR-023.

## Project Structure

### Documentation (this feature)

```text
specs/011-persistent-undo-history/
├── plan.md                              # This file (/speckit-plan command output)
├── research.md                          # Phase 0 output
├── data-model.md                        # Phase 1 output
├── quickstart.md                        # Phase 1 output
├── contracts/
│   └── persistent-history-mechanics.md  # Phase 1 output
├── spec-meta.json
└── tasks.md                             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

This feature extends the scaffold established by `001-falling-pink-sand`
through `010-undo-redo`, plus the auto-save behaviour merged in PR #33
(not greenfield — `package.json`, `src/sim/*`, `src/lib/*`, `tests/unit/*`
already exist). Files marked **(new)** are added by this feature; files
marked **(modified)** have additive changes only, keeping their existing
responsibility and every existing exported signature; everything else is
unchanged.

```text
index.html                  # unchanged
package.json                 # unchanged — no new dependency
tsconfig.json / vite.config.ts / vitest.config.ts   # unchanged

src/
├── main.ts                 # unchanged
├── App.svelte              # unchanged — no new prop, no new control (FR-020)
├── lib/
│   ├── PlayArea.svelte     # (modified) HISTORY_KEY constant; new flushSave() function calling writeFlushSave; saveNow() calls writeOrdinarySave in place of its bare localStorage.setItem; visibilitychange-hidden/pagehide listeners retarget from saveNow to flushSave; tryRestore() gains a history-restore branch (reads HISTORY_KEY, fingerprints, validates, remaps via remapWorldStates, calls history.restoreFromPersisted) replacing the current unconditional history.reset() call — no other function touched
│   ├── Toolbar.svelte      # unchanged — no new control (FR-020)
│   ├── layout.ts           # unchanged
│   ├── particles.ts        # unchanged
│   └── sparkle.ts          # unchanged
└── sim/                    # framework-free, hot-path core (constitution III)
    ├── historySave.ts       # (new) HISTORY_SAVE_VERSION; HISTORY_BYTE_BUDGET; computeFingerprint; serializeHistory/deserializeHistory (newest-first budget fill, versioned wire, fingerprint + dimension pairing check); KeyValueStore interface; writeOrdinarySave/writeFlushSave
    ├── history.ts            # (modified, additive) HistoryManager gains getPersistableUndoStack()/restoreFromPersisted(); new exported remapWorldStates() free function; HistoryManager.remap()'s body refactored to call it (behavior-identical) — WorldState/captureWorldState/restoreWorldState/remapWorldState/HISTORY_DEPTH all unchanged
    ├── save.ts                # unchanged — SavedWorld/WireWorld shape, serializeWorld/deserializeWorld, encodeBase64/decodeBase64, resyncNextId all untouched; historySave.ts imports encodeBase64/decodeBase64 from here rather than duplicating the codec
    ├── types.ts               # unchanged
    ├── element.ts             # unchanged
    ├── shade.ts               # unchanged
    ├── grid.ts                # unchanged
    ├── step.ts                # unchanged
    ├── brush.ts                # unchanged
    ├── objects.ts               # unchanged — historySave.ts reuses OBJECT_KINDS as-is
    ├── scenes.ts                 # unchanged
    ├── wand.ts                   # unchanged
    ├── resize.ts                  # unchanged
    └── pets.ts                     # unchanged — history never captures pets (unchanged assumption from spec 010)

tests/
└── unit/
    ├── lib/                   # unchanged — no layout/toolbar change
    └── sim/
        ├── historySave.test.ts    # (new) the bulk of FR-025's persistence-specific coverage
        ├── history.test.ts        # (modified, additive-only) new describe blocks for getPersistableUndoStack/restoreFromPersisted/remapWorldStates; every existing describe block unchanged
        ├── save.test.ts           # unchanged
        ├── grid.test.ts           # unchanged
        ├── step.test.ts           # unchanged
        ├── grass.test.ts          # unchanged
        ├── starPower.test.ts      # unchanged
        ├── weather.test.ts        # unchanged
        ├── brush.test.ts          # unchanged
        ├── objects.test.ts        # unchanged
        ├── scenes.test.ts         # unchanged
        ├── wand.test.ts           # unchanged
        ├── resize.test.ts         # unchanged
        ├── pets.test.ts           # unchanged
        ├── flamingo.test.ts       # unchanged
        ├── palm.test.ts           # unchanged
        ├── flower.test.ts         # unchanged
        ├── gumdrop.test.ts        # unchanged
        └── cellFields.test.ts     # unchanged
```

**Structure Decision**: Same single client-only project 001–010
established — no `backend/`/`frontend/` split, `src/sim/*` stays isolated
from Svelte for zero-DOM `vitest` coverage (constitution Principle V).
This feature adds exactly two new files (`src/sim/historySave.ts`,
`tests/unit/sim/historySave.test.ts`), makes purely additive extensions
to one existing `src/sim/*` file (`history.ts`) and its test file, and
otherwise touches only `PlayArea.svelte`'s save/restore glue — no
existing exported function's signature is removed or incompatibly
changed anywhere, `save.ts` is not touched at all, and `App.svelte`/
`Toolbar.svelte`/`layout.ts` are not touched at all, which is what makes
FR-020's "no new control, message, or setting" and FR-023's "world save
and restore MUST behave exactly as they do today" true by construction
rather than by a separately-verified regression pass. `historySave.ts` is
deliberately a new file rather than folded into `save.ts` or `history.ts`
(research.md §7) — its concern (a bounded, budgeted, fingerprint-paired
persistence format for a *list* of `WorldState`s) is genuinely a third
axis distinct from "serialize one world" (`save.ts`) and "own the
in-memory bounded stacks" (`history.ts`), mirroring the same "one file,
one coherent concern" boundary spec 010's own research.md drew between
`history.ts` and `grid.ts`.

## Complexity Tracking

*No entries — Constitution Check reported no violations.*
