# Implementation Plan: Undo and Redo

**Branch**: `spec/010-undo-redo` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-undo-redo/spec.md`

## Summary

Add whole-field Undo/Redo as one new, framework-free module,
`src/sim/history.ts` (`WorldState` + `captureWorldState`/
`restoreWorldState` + a small `HistoryManager` class), and wire it into
`PlayArea.svelte` at exactly the four existing action boundaries FR-005
names — paint-stroke `pointerdown`/`pointerup`, object-placement
`pointerdown`, and the existing `clearAll()`/`loadScene()` methods —
touching **no** existing `src/sim/*` rule file at all. A `WorldState`
snapshot holds precisely the five visible properties FR-028 enumerates as
one array each, sized `width * height`: `elements`, a merged `colorAux`
(`shades[i]`, except `hues[i]` for `RAINBOW_SAND` cells — the two are
never both meaningful for the same cell), `cloud` (needed separately from
`colorAux` because a fog/cloud cell has both a shade *and* a fog-vs-cloud
flag at once), `glitter`, and `grassHeight`, plus shallow clones of the
placed-object lists — five `Uint8Array`s at spec 006's `CELL_BUDGET =
43,200` is `216,000` bytes ≈ 0.206 MB/state, ≈4.12 MB for a full 10-undo-
plus-10-redo history, landing within a few percent of FR-028's own
"roughly 0.19 MB"/"roughly 4 MB" estimates. Every internal timer FR-028
excludes (grass drinking cooldown, star-power burn age/life, fog rise/
stuck/age, cloud rain delay) is reset on restore to the exact value its own
"freshly created" code path already produces elsewhere in this codebase
(`createFog`, `becomeCloud`, `igniteStarPower`, `setCell`'s own
unconditional `grassCooldown = 0`) — no new random-range constant is
invented. `starPowerFuelled` is treated as part of that same excluded
bundle rather than captured, a considered extension of FR-028's named-four
to a fifth, closely-related piece of purely-internal state whose only
effect is deferred past the moment of restore, which SC-004 already
permits. `HistoryManager` owns two plain-array stacks (undo capped at 10 by
eviction on push; redo cleared on every new recorded action and
mathematically never exceeding 10 as a consequence of the undo cap, needing
no separate cap of its own) plus a single `pending` "before" snapshot slot
— single, not queued, because this toy's input model never has two actions
in flight at once. No-op detection (FR-007) compares the live grid/objects
directly against `pending` rather than capturing a second snapshot to diff,
the cheaper of two ways to satisfy FR-029's "nothing may be captured,
compared, or copied except at an action boundary." `PlayArea.svelte` gains
two exported methods, `undo()`/`redo()`, each finishing an in-progress
stroke first (FR-009, by calling the existing `handlePointerUp`) before
delegating to `HistoryManager`; a re-derivation (spec 006's existing
resize-swap branch) gains one call, `history.reset()` (FR-022). Two new
`Toolbar.svelte` buttons (↩️/↪️, their own group immediately after 🧽/🗑️/✨
and before the scene controls, FR-001) use the native `disabled` attribute
for FR-003's "tapping it does nothing" guarantee, with `canUndo`/`canRedo`
lifted to `App.svelte` via one new callback prop, `onHistoryChange`,
mirroring this codebase's existing props-down/callbacks-up convention
exactly. `layout.ts`'s generic, control-count-only math needs no change —
only `tests/unit/lib/layout.test.ts`'s two count constants move (16→18
controls, 5→6 groups), re-verifying spec 006's phone-fit gate (FR-004) at
the new count for free. Because every existing `src/sim/*` file — `grid.ts`,
`step.ts`, `types.ts`, `element.ts`, `shade.ts`, `brush.ts`, `wand.ts`,
`objects.ts`, `scenes.ts`, `resize.ts` — is untouched, "a session in which
Undo and Redo are never tapped behaves exactly as the previous release"
(FR-023) holds by construction, not by a separate regression pass.

## Technical Context

**Language/Version**: TypeScript 5.x, Node 22 (matches
`.github/workflows/deploy-pages.yml`) — unchanged from 001–009.

**Primary Dependencies**: `svelte` 5, `vite`, `@sveltejs/vite-plugin-svelte`,
`vite-plugin-singlefile`, `vitest`, `typescript` — unchanged; no new
runtime dependency (research.md §11). No new browser API — snapshotting is
built entirely from plain `Uint8Array` copies and `TypeScript` object
clones, the same primitives every existing `src/sim/*` module already uses.

**Storage**: N/A — unchanged. FR-021 requires history to be explicitly
**not** persisted; a fresh page load always starts both histories empty.

**Testing**: `vitest`, adding `tests/unit/sim/history.test.ts` (new — the
bulk of FR-033's coverage: one stroke per painting tool captured and
undone to cell-for-cell identity; object placement/clear-all/scene-control
recorded and undone including placed objects; simulation-only changes
never recording an action; a no-op action recording nothing; the
pre-action capture point rewinding consequences that followed it; undo/
redo round trips and 20+ alternations; a new action clearing redo; the
10-action bound dropping the oldest silently; undo/redo no-ops on empty
histories; both histories discarded on re-derivation and left intact when
not; every element type and visible cell property surviving a round trip;
no internal countdown surviving capture, and a restored burning/rising/
gathering cell running its restarted countdown to completion; the
per-state/total budget staying within FR-028's figures; the simulation
staying valid for 600+ steps from a restored state) and a small, targeted
change to `tests/unit/lib/layout.test.ts` (`TOOLBAR_CONTROL_COUNT`
`16 → 18`, `TOOLBAR_GROUP_COUNT` `5 → 6` — research.md §10). No other
existing test file changes at all (FR-023, FR-031) — this feature's entire
`src/sim/*` diff is one new file. All plain, DOM-free `TypeScript` against
`Grid`/`ObjectsState`/`HistoryManager` state (constitution Principle V,
FR-033) — no browser-automation infra is added. The genuinely DOM-only
parts of this feature (an undo *looking* like the mistake lifting away
rather than a flicker/jump, the dimmed state reading as "not now" rather
than broken, the rescue-after-🗑️ feeling like a happy moment, restarted
countdowns being invisible in play, the 18-button toolbar still looking
friendly rather than cramped, button *order* on screen) are the
maintainer's on-device job per quickstart.md, matching constitution
Principle V's existing precedent and research.md §10's explicit reasoning
for why button order stays a manual check rather than a new source-parsing
test.

**Target Platform**: Static single-file page opened via `file://` or
served from GitHub Pages; evergreen browsers on a mid-range laptop
(mouse/trackpad), a tablet, a mid-range phone (spec 006), and a low-end
tablet of the Amazon Fire 7 Kids class (spec 007/008/009's own binding
performance/memory constraint, carried forward unchanged and now the
binding constraint for FR-028's memory budget too, per the spec's own
resolved clarification).

**Project Type**: Single-page client-only web app — no backend/API.
Unchanged.

**Performance Goals**: Steady 60fps target, 30fps floor (constitution
Principle IV, FR-027), required specifically while drawing stroke after
stroke on a full field with weather running, grass drinking, and a lawn
burning (SC-012) — i.e. this feature's worst case is orthogonal to, not
compounding, spec 009's own named worst case, since capture/restore only
ever runs at an action boundary, never inside the per-frame `step`/
`applyRainbowConversions`/`updateUnicorns`/`tickParticles`/
`updateFlashMask`/`render` sequence (FR-029, SC-013 — measured per-frame
cost with a full history within 2% of an empty one). `captureWorldState`/
`restoreWorldState` are each `O(width * height)` — one pass per action, per
undo, per redo, never per frame — a strictly cheaper obligation than any
existing per-frame simulation rule already meets at the same cell count
(`CELL_BUDGET = 43,200`, spec 006, unchanged).

**Constraints**: The per-frame simulation/effect/render path must stay
allocation-free (constitution Principle IV) — satisfied by construction,
since `history.ts`'s only allocations (five `Uint8Array`s plus two small
object-list clones per capture) happen exclusively at action/undo/redo
boundaries, never inside `frame()` (research.md §3, §8). Peak history
memory must stay at or below "roughly 4 MB" (FR-028, SC-014) — met by the
five-array-per-state design at ≈4.12 MB for a full 10+10 history
(research.md §2), asserted by a concrete unit test against `CELL_BUDGET`.
Production build must still emit exactly one output file with zero runtime
network requests and grow by at most 5 KB (FR-030) — satisfied by
construction: one new, modestly-sized source file and small UI-wiring
diffs across three existing Svelte files, no new dependency. The two new
toolbar buttons must not break spec 006's phone-fit gate (FR-004) —
enforced by `tests/unit/lib/layout.test.ts`'s bumped count constants
re-running every existing fit assertion at 18 controls / 6 groups. History
must never persist (FR-021) — enforced by construction: `HistoryManager`
holds its stacks in plain instance fields, with no `localStorage`/
`IndexedDB`/cookie/URL write anywhere in this feature's diff.

**Scale/Scope**: One feature, four prioritized user stories (take back the
last stroke; rescue everything after the bin; bring it back with redo; the
buttons always behave, everywhere). Adds exactly one new source file
(`src/sim/history.ts`) and one new test file (`tests/unit/sim/
history.test.ts`); extends `Toolbar.svelte` (one new `.group`, two new
buttons, four new props), `App.svelte` (two new `$state` booleans, one new
callback, two new handlers), and `PlayArea.svelte` (one `HistoryManager`
instance, `beginAction`/`commitAction` wrapping the four existing action
call sites, two new exported methods, one added call in the existing
re-derivation branch) without changing any existing function's signature
in a breaking way; extends `tests/unit/lib/layout.test.ts` by two constant
values. No change whatsoever to `main.ts`, `index.html`,
`src/sim/types.ts`, `element.ts`, `shade.ts`, `grid.ts`, `step.ts`,
`brush.ts`, `wand.ts`, `objects.ts`, `scenes.ts`, `resize.ts`,
`src/lib/layout.ts`, `particles.ts`, or `sparkle.ts` — and no change to any
existing `tests/unit/sim/*.test.ts` file other than the layout constant
bump. No new top-level architecture, no new build tooling.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. One Self-Contained Page | No new build step, asset, font, or runtime dependency; the one new file (`src/sim/history.ts`) and every UI-wiring change live in `src/sim/*`/`src/lib/*`, already bundled into `dist/index.html` by `vite-plugin-singlefile`. Build size growth is bounded by source-code size alone with zero new dependency, comfortably under FR-030's 5 KB ceiling. | PASS |
| II. Built For An Almost-5-Year-Old | No new failure state, message, confirmation, score, or text prompt anywhere (FR-025) — the two new controls are big, round, emoji-labeled, and dimmed-not-hidden when unavailable (FR-003), exactly the existing toolbar's own visual language. Works identically with mouse and touch, since `undo()`/`redo()` are plain imperative methods triggered by an ordinary button `onclick`, no new input mechanism. Nothing scary or punitive — a dimmed button simply does nothing, never an error. | PASS |
| III. Simple, Dependency-Light Svelte | No new dependency (research.md §11). The entire capture/restore/bookkeeping mechanism lives in one new, framework-free `src/sim/*` module (`history.ts`), isolated from Svelte exactly like every existing simulation concern — `PlayArea.svelte` calls into it the same way it already calls `step`/`applyBrush`/`resizeGrid`, not a parallel state-management architecture. The `WorldState` shape is a direct, minimal reading of FR-028's own five named visible properties, deliberately merging `shades`/`hues` into one array where the codebase's own render logic already proves they are mutually exclusive, rather than inventing extra fields "for symmetry." | PASS |
| IV. Performance Is A Feature | Capture/restore/compare are all `O(width * height)` and run exclusively at action/undo/redo boundaries, never inside the per-frame hot loop (research.md §3, §8) — the hot loop (`step`/`render`/etc.) is untouched by this feature's diff, so its existing allocation-free discipline is trivially preserved. SC-012/SC-013 name this feature's own worst case (drawing stroke after stroke on a full, busy field) and this design's cost model (one `O(n)` pass per user action, never per frame) directly satisfies both. | PASS |
| V. Verifiable Without A Browser Harness | `npm run build` still emits a single `dist/index.html`; `tests/unit/sim/history.test.ts` plus a two-constant change to `layout.test.ts` cover every rule FR-033 lists — capture/restore fidelity per element, no-op detection, the pre-action capture point, round trips and alternation, redo invalidation, the 10-deep bound, empty-history no-ops, re-derivation discarding, restarted-countdown validity over 600+ steps, and the memory budget — directly against `Grid`/`ObjectsState`/`HistoryManager` state, no DOM. The genuinely DOM-only behaviors (button order/appearance, the "rescue feels like a rescue" quality, restarted countdowns being invisible in play, Fire-7 smoothness with a full history) are the maintainer's on-device job per quickstart.md's explicit manual-check list, including a specific, precedent-consistent reason (research.md §10) for why button *order* stays manual rather than gaining a new, unprecedented source-parsing test. No browser-automation infra is added. | PASS |

No violations — Complexity Tracking is not needed. The most consequential
design decision — merging `shades`/`hues` into one `colorAux` array in
`WorldState` rather than storing both (research.md §2) — is not a
constitution trade-off; it is a direct, provable consequence of this
codebase's own existing render logic (`colorFor` never reads `shades[i]`
for a `RAINBOW_SAND` cell), taken in service of both Principle III
(minimal, non-redundant state) and FR-028's own memory budget.

## Project Structure

### Documentation (this feature)

```text
specs/010-undo-redo/
├── plan.md                          # This file (/speckit-plan command output)
├── research.md                      # Phase 0 output
├── data-model.md                    # Phase 1 output
├── quickstart.md                    # Phase 1 output
├── contracts/
│   └── undo-redo-mechanics.md       # Phase 1 output
└── tasks.md                         # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

This feature extends the scaffold established by `001-falling-pink-sand`
through `009-star-powered-weather` (not greenfield — `package.json`,
`src/sim/*`, `src/lib/*`, `tests/unit/*` already exist, including `009`'s
landed fog/cloud rules). Files marked **(new)** are added by this feature;
files marked **(modified)** have their contents changed but keep their
existing responsibility; everything else is unchanged.

```text
index.html                  # unchanged
package.json                 # unchanged — no new dependency
tsconfig.json / vite.config.ts / vitest.config.ts   # unchanged

src/
├── main.ts                 # unchanged
├── App.svelte              # (modified) canUndo/canRedo $state, handleHistoryChange callback, undo()/redo() handlers, four new props passed to PlayArea/Toolbar
├── lib/
│   ├── PlayArea.svelte     # (modified) HistoryManager instance; beginAction/commitAction wrapping paint-stroke pointerdown/pointerup, object placement, clearAll(), loadScene(); new exported undo()/redo() methods; history.reset() added to the existing re-derivation branch; onHistoryChange prop — render()/frame()/step-adjacent code otherwise unchanged
│   ├── Toolbar.svelte      # (modified) one new .group (↩️/↪️) between .group.actions and .group.scenes; four new props (canUndo, canRedo, onUndo, onRedo); no other button/group changed
│   ├── layout.ts           # unchanged — computePlayField/computeToolbarLayout/MIN_TOUCH_TARGET/CELL_BUDGET/etc. already generic over control/group count
│   ├── particles.ts        # unchanged
│   └── sparkle.ts          # unchanged
└── sim/                    # framework-free, hot-path core (constitution III)
    ├── history.ts           # (new) WorldState type; captureWorldState/restoreWorldState; HistoryManager (begin/commit/undo/redo/canUndo/canRedo/reset); HISTORY_DEPTH = 10
    ├── types.ts             # unchanged — no new element, no new Grid field, no new Tool value
    ├── element.ts            # unchanged
    ├── shade.ts               # unchanged — randomBurnLife/randomFogRiseCooldown/randomCloudRainDelay reused as-is by restoreWorldState
    ├── grid.ts               # unchanged — history.ts reads/writes Grid's existing fields directly, no new grid.ts export needed
    ├── step.ts               # unchanged
    ├── brush.ts               # unchanged
    ├── objects.ts             # unchanged — history.ts clones PlacedObject[] directly, no new objects.ts export needed
    ├── scenes.ts               # unchanged
    ├── wand.ts                 # unchanged
    └── resize.ts               # unchanged

tests/
└── unit/
    ├── lib/
    │   └── layout.test.ts    # (modified) TOOLBAR_CONTROL_COUNT 16→18, TOOLBAR_GROUP_COUNT 5→6 — no other change
    └── sim/
        ├── history.test.ts    # (new) the bulk of FR-033's undo/redo-specific coverage
        ├── grid.test.ts       # unchanged
        ├── element.test.ts    # does not exist, unchanged (precedent: specs 007/008/009)
        ├── step.test.ts       # unchanged
        ├── grass.test.ts      # unchanged
        ├── starPower.test.ts  # unchanged
        ├── weather.test.ts    # unchanged
        ├── brush.test.ts      # unchanged
        ├── objects.test.ts    # unchanged
        ├── scenes.test.ts     # unchanged
        ├── wand.test.ts       # unchanged
        └── resize.test.ts     # unchanged
```

**Structure Decision**: Same single client-only project 001–009
established — no `backend/`/`frontend/` split, `src/sim/*` stays isolated
from Svelte for zero-DOM `vitest` coverage (constitution Principle V).
This feature adds exactly two new files anywhere in the repo
(`src/sim/history.ts`, `tests/unit/sim/history.test.ts`) and otherwise
extends three existing Svelte-layer files (`App.svelte`, `PlayArea.svelte`,
`Toolbar.svelte`) plus one existing test file's two constants — no existing
exported function's signature is removed or incompatibly changed anywhere,
and **every** existing `src/sim/*` file is untouched, which is what makes
FR-023's "a session in which Undo and Redo are never tapped MUST behave
exactly as the previous release" true by construction rather than by a
separately-verified regression pass. `history.ts`'s capture/restore/
bookkeeping logic is deliberately kept in its own new file rather than
folded into `grid.ts` (research.md §1) — the same "one file, one coherent
concern" boundary this codebase already draws between, e.g., `brush.ts` and
`wand.ts`. Unlike spec 009 (which touched ten `src/sim/*` files to add one
new element's simulation rules), this feature is structurally the inverse
shape: its `src/sim/*` footprint is a single, wholly new, orthogonal
module, and its real surface area is entirely in the Svelte UI layer that
wires four existing action boundaries to it.

## Complexity Tracking

*No entries — Constitution Check reported no violations.*
