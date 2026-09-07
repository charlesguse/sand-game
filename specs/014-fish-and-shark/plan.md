# Implementation Plan: Fish And A Shark Living In Her Water

**Branch**: `014-fish-and-shark` | **Date**: 2026-09-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-fish-and-shark/spec.md`

## Summary

Ambient sea life that needs no toolbar control: fish and (rarer) a shark
appear on their own inside big-enough pools of WATER, drift/chase gently,
and vanish cleanly when their pool can no longer support them. The whole
feature is a new, self-contained module, `src/sim/seaLife.ts`, that
mirrors the shape of `src/sim/pets.ts` (a lightweight state array beside
the grid, stepped once per frame, drawn as plain emoji glyphs) rather than
the grid's per-cell byte arrays — no new element identity, no save-format
change, no undo-state change (FR-031, FR-027, FR-029).

Two concerns are kept deliberately separate because they have different
cost and staleness budgets:

1. **Movement/collision** (FR-009…FR-013) is a live, per-frame check
   against the actual grid: a fish or shark only ever steps into an
   adjacent cell that is WATER *right now*. Because "pool" is defined as a
   connected component of water cells, this one rule is sufficient by
   construction to keep every creature inside its own pool forever,
   without the movement code ever consulting pool identity or size. It
   also gives an immediate (not "~1 second") response to a stroke of sand
   poured directly onto a creature's own cell (Edge Case), since the very
   next frame's live check finds its occupied cell is no longer water and
   starts a fade.
2. **Population** (spawn/despawn counts, caps, "largest pools first") is
   driven by a **pool-measurement sweep**: an incremental, resumable
   flood-fill over WATER cells that only processes a bounded budget of
   cells per frame (FR-032) rather than the whole grid at once, sized so a
   full pass — and the spawn/despawn reconciliation that follows it —
   completes roughly once a second (FR-007, FR-022, FR-028, FR-030). A
   small hysteresis band around each threshold (spawn vs. a slightly lower
   despawn line) absorbs the one-cell wobble the Edge Cases call out,
   so crossing the exact threshold does not flicker a creature in and out.

A short list of erase-triggered cooldown points (`{x, y, framesRemaining}`,
naturally bounded by how many creatures can exist at all) implements the
~3 second eraser hold-off (FR-025) without needing pools to carry a
persistent identity across sweeps — the cooldown suppresses *new* spawns
into whatever pool currently contains that point, which is a correct
approximation because erasing does not change a pool's shape.

No `src/sim/step.ts`, `save.ts`, `history.ts`, or `resize.ts` byte-array
shape changes; `PlayArea.svelte` gains a third stepped/rendered/erased
state array (`seaLifeState`) alongside `objectsState` and `petsState`,
following the exact same call-site pattern those two already use.

## Technical Context

**Language/Version**: TypeScript 5.x, Node 22 (matches
`.github/workflows/deploy-pages.yml`) — unchanged from 001–013.

**Primary Dependencies**: `svelte` 5, `vite`, `@sveltejs/vite-plugin-svelte`,
`vite-plugin-singlefile`, `vitest`, `typescript` — unchanged; no new
runtime or dev dependency. Rendering uses the same `CanvasRenderingContext2D.fillText`
emoji-glyph path `PlayArea.svelte` already uses for poodles and objects
(no custom artwork, per the constitution's Product Constraints).

**Storage**: N/A for this feature specifically — `localStorage` world
save/restore (`src/sim/save.ts`) is explicitly untouched: FR-027 requires
no new field and no `SAVE_VERSION` bump, so a save written before this
feature loads exactly as it does today and simply gains fish once its
water is measured (FR-028).

**Testing**: `vitest`, no DOM, no headless browser (constitution Principle
V, FR-034). New `tests/unit/sim/seaLife.test.ts` covers the module as a
set of plain functions over a `Grid` and a `SeaLifeState`, the same way
`tests/unit/sim/pets.test.ts` covers `pets.ts` — construct a grid with a
hand-placed WATER region, call `stepSeaLife` (or the sweep's step
function directly) enough times to complete one or more sweeps, and
assert on the resulting `fish`/`sharks` arrays and `grid.elements`
(unchanged, per FR-012). No rendering/canvas test is added — glyph
legibility and "reads as friendly, not scary" are Manual Verification
items per CLAUDE.md's platform table, exactly like the existing
toolbar-glyph split between automated coverage and eyeballing.

**Target Platform**: Static single-file page opened via `file://` or
served from GitHub Pages; the two reference devices in CLAUDE.md's
platform table (Fire 7 Kids tablet / Silk / desktop Chrome for Charlie,
iPad Safari standalone for Max) — unchanged scope. 🐠 (Unicode 6.0) and 🦈
(Unicode 9.0) both predate the Emoji-13.0/Segoe-UI-Emoji caution in
CLAUDE.md's glyph-coverage row, so no inline SVG fallback (à la
`BucketIcon.svelte`) is built — confirmed by eyeballing both platforms
per Manual Verification, not assumed.

**Project Type**: Single-page client-only web app — no backend/API.
Unchanged.

**Performance Goals**: Steady 60fps target, 30fps floor at the default
270×160 field with every cap filled (constitution Principle IV, FR-033).
The pool sweep is bounded to a fixed cell budget per frame
(`SWEEP_BUDGET_CELLS_PER_FRAME`, research.md §1) sized so one full sweep
of the default field (43,200 cells) takes on the order of 45 frames —
strictly cheaper per frame than `step()`'s own full-grid pass, which
already runs every frame today. Per-creature movement is O(1) per fish/
shark per frame against a hard cap of 8 total creatures (6 fish + 2
sharks) — negligible next to the existing hot loop.

**Constraints**: Per-frame simulation/render path stays allocation-free
in its steady state (constitution Principle IV) — the sweep's queue and
`poolId` buffer are allocated once (at creation and on resize) and reused,
never per-frame; spawning reuses a small reservoir-sampled candidate list
built during the sweep rather than re-scanning a pool's cells at spawn
time. `src/sim/seaLife.ts` never writes to any `Grid` array (FR-012) —
enforced by convention (the module takes `grid: Grid` as a read-only
parameter in every function that inspects it) and verified by the test
suite asserting `grid.elements` (and every other grid array) is
byte-identical before and after a run that spawns, chases, and despawns
creatures. No new toolbar control, no new sound, no saved-world field, no
undo-state field (FR-008, FR-014, FR-027, FR-029, FR-031).

**Scale/Scope**: One feature, three prioritized user stories (fish appear
and drift; a shark plays a harmless game of tag; populations come and go
without ever looking broken). One new production module
(`src/sim/seaLife.ts`), small additive wiring in `src/lib/PlayArea.svelte`
(step, render, eraser, clear-all, and every grid-replacing code path:
load, undo/redo, scene switch, resize), and one new test file. No changes
to `src/sim/step.ts`, `save.ts`, `history.ts`, `resize.ts`, `grid.ts`,
`types.ts`, or any toolbar file.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. One Self-Contained Page | New code is one more plain-TypeScript `src/sim/*` module plus a few lines in an existing `.svelte` file — no new asset, no new build step, no runtime dependency, no network request. `vite-plugin-singlefile` bundles it into `dist/index.html` exactly as it does every existing `src/sim/*` file. | PASS |
| II. Built For An Almost-5-Year-Old | The entire feature is unsolicited delight with zero controls (FR-001, FR-008) — she never presses anything and can never fail to get fish. The shark's "game of tag that nobody ever wins" is designed around the constitution's "nothing scary, no failure states" from the ground up: a hard-floor minimum separation (FR-017) makes catching structurally impossible, not just usually avoided, and departures are a gentle fade (FR-023), never a death, a bite, or a message. | PASS |
| III. Simple, Dependency-Light Svelte | No new dependency. `seaLife.ts` is plain TypeScript operating on the existing typed-array `Grid` plus its own small state arrays, following `pets.ts`'s established shape exactly (state struct + `create*`/`step*`/`clear*`/erase-in-brush functions) rather than inventing a new pattern. `PlayArea.svelte` gains call sites, not new architecture. | PASS |
| IV. Performance Is A Feature | The pool sweep is explicitly budgeted per frame rather than a full-grid pass (FR-032, research.md §1); per-creature AI is O(1) against a cap of 8. Both are cheap relative to `step()`'s existing full 43,200-cell pass, which already meets the 60fps target today. FR-033 is a direct, testable performance requirement at full caps. | PASS |
| V. Verifiable Without A Browser Harness | `seaLife.ts` is pure functions over `Grid`/`SeaLifeState` — no DOM, no canvas, no browser needed to test the spawn-threshold rule, the caps, the hold-off, or the "shark never catches a fish" invariant (FR-034), exactly like `pets.test.ts` covers `pets.ts` today. Glyph legibility and "reads as friendly, not scary" are named Manual Verification items, not automated ones, matching the constitution's own carve-out for visual/feel checks. | PASS |

No violations — Complexity Tracking is not needed. One non-obvious
interpretation worth flagging: FR-032's "bounded and spread out over
time" is read as a binding architectural requirement (an incremental,
budgeted sweep), not merely a nice-to-have, even though a naive full
recompute every frame would likely still hold 60fps at the default field
size — the spec states it as a MUST, so the plan does not take the
naive-and-probably-fine shortcut (research.md §1).

## Project Structure

### Documentation (this feature)

```text
specs/014-fish-and-shark/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   └── sea-life.md       # Phase 1 output — seaLife.ts's module contract
└── tasks.md              # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

This feature extends the scaffold established by `001-falling-pink-sand`
through `013-rendered-geometry-gate` (not greenfield). Files marked
**(new)** are added by this feature; files marked **(modified)** keep
their existing responsibility with small additive changes; everything
else is unchanged.

```text
index.html                  # unchanged
package.json                 # unchanged — no new dependency
tsconfig.json / vite.config.ts / vitest.config.ts   # unchanged

src/
├── main.ts                 # unchanged
├── App.svelte              # unchanged — no toolbar/layout change (FR-008)
├── lib/
│   ├── PlayArea.svelte     # (modified) owns seaLifeState beside objectsState/petsState: creates it, steps it once per frame (after stepPets, before render), draws fish/shark glyphs in render(), routes eraser strokes through eraseSeaLifeInBrush/Line, resets it in clearAll() and on every grid-replacing path (load, undo/redo, scene switch, resize/re-derivation) exactly where petsState is already reset or repositioned
│   ├── toolbarControls.ts, layout.ts, Toolbar.svelte, glyphSupport.ts, particles.ts, sparkle.ts, BucketIcon.svelte, fullscreen.ts, sound.ts, palette.ts  # unchanged
└── sim/
    ├── seaLife.ts          # (new) SeaLifeState, Fish, Shark; createSeaLifeState, resetSeaLifeState, stepSeaLife, eraseSeaLifeInBrush, eraseSeaLifeInBrushLine, clearSeaLife (contracts/sea-life.md)
    ├── pets.ts, objects.ts, grid.ts, step.ts, save.ts, history.ts, resize.ts, types.ts, brush.ts, wand.ts, scenes.ts, element.ts, shade.ts  # unchanged — no grid/element/save/undo shape change (FR-012, FR-027, FR-029, FR-031)

tests/
└── unit/
    ├── sim/
    │   └── seaLife.test.ts   # (new) spawn-threshold rule at/below/above each threshold; per-pool and global caps with largest-pools-first; hysteresis (no flicker at the exact threshold); eraser hold-off and its expiry; "shark never catches a fish" over a long run; no grid cell is ever written; draining/erasing/clearing leave nothing outside water; re-derivation onto a different field shape (FR-034)
    ├── sim/pets.test.ts, objects.test.ts, grid.test.ts, step.test.ts, save.test.ts, history.test.ts, resize.test.ts, ...  # unchanged — no existing sim test is touched (SC-010)
    └── lib/, shell/          # unchanged — no toolbar/layout test change (FR-008, SC-004)
```

**Structure Decision**: Same single client-only project 001–013
established — no new top-level directory, no `backend/`/`frontend`
split. Sea life lives in its own `src/sim/*` module rather than folded
into `pets.ts`, because it is a structurally different kind of state (no
ground-finding, no per-poodle save/reposition on resize, and a very
different lifecycle driven by pool measurement rather than a finger
target) — mirroring the existing precedent of `objects.ts` and `pets.ts`
being separate modules despite both being "things placed on the canvas."
`PlayArea.svelte` is the only `.svelte` file touched, and only additively
(new state, new call sites at the same points `petsState`/`objectsState`
already hook in) — no toolbar file changes at all, which is what keeps
the canvas-first toolbar budget from specs 012/013 exactly as it is
today (FR-008, SC-004).

## Complexity Tracking

*No entries — Constitution Check reported no violations.*
