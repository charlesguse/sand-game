# Implementation Plan: Butterflies Over Her Flowers, Birds On Her Palms

**Branch**: `spec/017-butterflies-and-birds` | **Date**: 2026-09-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-butterflies-and-birds/spec.md`

## Summary

Add two new, framework-free `src/sim/*` modules — `butterflies.ts` and
`birds.ts` — that each own a small, capped array of decorative creatures
held *beside* the play field, exactly like `pets.ts`'s `PetsState` already
sits beside it, except neither module is ever saved, captured into a
`WorldState`, or read by `history.ts`/`save.ts` at all (FR-028, FR-033):
population is derived fresh from the live grid/objects every frame, so
reload, undo/redo, resize, rotation, fullscreen and scene switching are
all correct by construction with zero new wiring in `history.ts`,
`save.ts`, or `resize.ts`. `butterflies.ts` maintains its own population
by periodically re-scanning the grid for `FLOWER` cells — bounded to a
handful of rows per frame so a full pass costs one bounded sweep of the
field spread over about a second rather than a repeated full-grid scan
(FR-034) — and drives a small wobble-and-drift steering state machine
per butterfly (visiting a flower, then travelling to another) with no
collision or terrain interaction of any kind (FR-009). `birds.ts` needs
no scan at all: it reads `ObjectsState.byKind.palm` directly (already
capped at 3) and keeps a `Map<palmId, Bird>`, so "one bird per palm,
capped at 3" is the map's own shape, and a bird's perch/hop/short-flight
state machine only ever targets a *live* palm's already-known position.
`PlayArea.svelte` gains: two new per-mount state objects created beside
`objectsState`/`petsState`; two `step*` calls in `frame()`; two draw
loops in `render()`, styled like the existing poodle/object glyph
drawing; two eraser calls in `paintAt()` mirroring
`eraseObjectsInBrushLine`; and one clearing call each in `clearAll()`,
`loadScene()`, and the re-derivation branch of `resize()` (population
simply re-establishes from the new live state within about a second —
no repositioning math is needed because nothing is preserved across a
re-derivation by design). No existing file's exported signature changes,
no toolbar control is added, no sound is added, and `save.ts`/
`history.ts`/`resize.ts` are not touched at all.

## Technical Context

**Language/Version**: TypeScript 5.x, Node 22 (matches
`.github/workflows/deploy-pages.yml`) — unchanged from 001–016.

**Primary Dependencies**: `svelte` 5, `vite`, `@sveltejs/vite-plugin-svelte`,
`vite-plugin-singlefile`, `vitest`, `typescript` — unchanged; no new
runtime dependency. No new browser API of any kind: butterflies/birds are
drawn with `ctx.fillText` on the existing canvas exactly like poodles and
placed objects already are (FR-018), and read no platform capability at
all.

**Storage**: N/A for this feature specifically — `localStorage` continues
to hold only the world save and (if spec 011 has landed) the persisted
history, neither of which gains a field. This is the load-bearing design
choice of the whole feature (FR-028, FR-033): butterflies/birds are
process-lifetime-only state, never written to or read from storage.

**Testing**: `vitest`, adding `tests/unit/sim/butterflies.test.ts` and
`tests/unit/sim/birds.test.ts` (no DOM, plain `Grid`/`ObjectsState`
values and many-frame `step*` loops, exactly the existing
`pets.test.ts`/`objects.test.ts` style). No existing test file's existing
assertions change (FR-037) — this feature's `src/sim/*` diff is two new
files; every other `src/sim/*` file is untouched.

**Target Platform**: Static single-file page opened via `file://` or
served from GitHub Pages; the two maintained platforms per `CLAUDE.md` —
Amazon Fire 7 Kids-class tablet (Silk) and desktop Chrome (Charlie), iPad
standalone home-screen app (Max). 🦋 and 🐦 are both pre-Emoji-13.0 glyphs
(Unicode 9.0 and 1.0 respectively) so no inline-SVG fallback is planned,
per the manual-verification section — Manual Verification below and in
spec.md is the record of what each maintainer must still eyeball.

**Project Type**: Single-page client-only web app — no backend/API.
Unchanged.

**Performance Goals**: Steady 60fps target, 30fps floor (constitution
Principle IV, FR-035), holding with butterflies (≤4), birds (≤3), and
spec 014's sea life (if shipped) all simultaneously at their caps.
`stepButterflies`'s per-frame flower-locating cost is `O(width)` amortized
— a bounded number of grid rows per frame, never a full `O(width *
height)` scan in one frame (FR-034, research.md §1) — and its per-creature
steering math is `O(butterflies)` (≤4). `stepBirds` is `O(palms)` (≤3),
reading `ObjectsState.byKind.palm` directly with no grid scan at all.
Neither module allocates inside its steady-state per-frame path except
the bounded, already-necessary array pushes during a flower-scan pass and
the occasional new-creature object literal at spawn (≤4 + ≤3 total
lifetime-bounded allocations at any moment, the same order `pets.ts`
already accepts for poodles).

**Constraints**: Neither module may write any `Grid` cell, field, or
count (FR-017) — both are verified read-only with respect to `Grid` by
construction (butterflies read `grid.elements`/`grid.width`/
`grid.height` only; birds read nothing from `Grid` at all). Neither may
be captured by `captureWorldState`/`restoreWorldState`/
`serializeWorld`/`deserializeWorld` (FR-028, FR-033) — enforced by
construction, since `history.ts`/`save.ts` are not imported by either new
module and are not modified to import them. No new toolbar control, prop,
or setting (FR-019, FR-020) — `App.svelte`/`Toolbar.svelte`/
`toolbarControls.ts`/`layout.ts` are not touched. No new sound (FR-020) —
`sound.ts` is not touched.

**Scale/Scope**: One feature, three prioritized user stories (butterflies
appear and wander; birds perch and hop and fly between palms; both leave
cleanly and re-derive correctly through every lifecycle event). Adds
exactly two new source files (`src/sim/butterflies.ts`,
`src/sim/birds.ts`) and two new test files
(`tests/unit/sim/butterflies.test.ts`, `tests/unit/sim/birds.test.ts`);
makes small, additive wiring changes to `PlayArea.svelte` only (new
imports, two new module-level state objects, calls added to `frame()`,
`render()`, `paintAt()`, `clearAll()`, `loadScene()`, and `resize()`'s
re-derivation branch). No change to `save.ts`, `history.ts`, `resize.ts`,
`grid.ts`, `step.ts`, `element.ts`, `types.ts`, `shade.ts`, `brush.ts`,
`wand.ts`, `objects.ts`, `pets.ts`, `scenes.ts`, `main.ts`, `App.svelte`,
`Toolbar.svelte`, `toolbarControls.ts`, `layout.ts`, or `sound.ts`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. One Self-Contained Page | Two new, small `src/sim/*` TypeScript files and additive `PlayArea.svelte` wiring — no new asset, font, network call, or build step. Both glyphs (🦋🐦) are drawn with `ctx.fillText`, the same zero-asset mechanism poodles/objects already use. | PASS |
| II. Built For An Almost-5-Year-Old | No button, no menu, no failure state, no score, no text (FR-001, FR-011, FR-019, FR-020, FR-022). A flowerless/palmless canvas showing nothing is the designed-correct state, not an empty-state UI (FR-002, FR-012). Nothing is ever caught, hurt, or lost, and every departure is a silent removal with no message or mark (FR-021, FR-024). | PASS |
| III. Simple, Dependency-Light Svelte | Both modules are plain, framework-free TypeScript operating on `Grid`/`ObjectsState` values, isolated from Svelte exactly like `pets.ts`/`objects.ts` — `PlayArea.svelte`'s diff is thin call-site wiring, not a new state-management layer. No new dependency. | PASS |
| IV. Performance Is A Feature | Flower location is bounded and amortized rather than a full-grid scan per frame (FR-034, research.md §1); bird logic is `O(palms) ≤ 3` with no grid access. Both are allocation-light and bounded by their own hard caps (4 butterflies, 3 birds) regardless of field size or flower count (FR-003, FR-012, FR-035). | PASS |
| V. Verifiable Without A Browser Harness | `npm run build` still emits a single `dist/index.html`; `tests/unit/sim/butterflies.test.ts` and `birds.test.ts` cover every rule FR-036 lists against plain `Grid`/`ObjectsState` values with many-frame `step*` loops — no DOM. The genuinely on-device parts (glyph rendering on Silk/Fire vs. iPad, frame rate with every cap filled) are the maintainers' job, recorded in spec.md's own Manual Verification section and echoed in quickstart.md below. No browser-automation infra is added. | PASS |

No violations — Complexity Tracking is not needed. The most consequential
design decision — keeping butterflies/birds entirely outside
`WorldState`/`save.ts`/`history.ts` rather than folding them in beside
poodles — is not a constitution trade-off; it is the direct, simplest
reading of FR-028/FR-033/FR-030 ("not part of an undo state... simply
re-settle") and it is what makes every re-derivation/undo/reload
acceptance scenario in User Story 3 correct with no new persistence code
to get wrong, rather than a cost paid against some other principle.

## Project Structure

### Documentation (this feature)

```text
specs/017-butterflies-and-birds/
├── plan.md                          # This file (/speckit-plan command output)
├── research.md                      # Phase 0 output
├── data-model.md                    # Phase 1 output
├── quickstart.md                    # Phase 1 output
├── contracts/
│   └── ambient-life-mechanics.md    # Phase 1 output
├── spec-meta.json
└── tasks.md                         # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

This feature extends the scaffold established by `001-falling-pink-sand`
through `016-mermaid-ice-cream` (not greenfield — `package.json`,
`src/sim/*`, `src/lib/*`, `tests/unit/*` already exist). Files marked
**(new)** are added by this feature; files marked **(modified)** have
additive changes only, keeping their existing responsibility and every
existing exported signature; everything else is unchanged.

```text
index.html                  # unchanged
package.json                 # unchanged — no new dependency
tsconfig.json / vite.config.ts / vitest.config.ts   # unchanged

src/
├── main.ts                 # unchanged
├── App.svelte              # unchanged — no new prop, no new control (FR-019, FR-020)
├── lib/
│   ├── PlayArea.svelte     # (modified) two new state objects (butterfliesState, birdsState) created beside objectsState/petsState; stepButterflies/stepBirds called in frame(); two draw loops added to render() (styled like the existing poodle/object glyph drawing); eraseButterfliesInBrush(Line)/eraseBirdsInBrush(Line) called from paintAt() alongside the existing eraseObjectsInBrush(Line) call; clearButterflies/clearBirds called from clearAll() and loadScene() beside clearPets/clearObjects; clearButterflies/clearBirds called from resize()'s re-derivation branch in place of a reposition step (research.md §4) — no other function touched, tryRestore/saveNow/flushSave are not touched at all
│   ├── Toolbar.svelte      # unchanged — no new control (FR-019, FR-020)
│   ├── toolbarControls.ts  # unchanged
│   ├── layout.ts           # unchanged
│   ├── particles.ts        # unchanged
│   ├── sparkle.ts          # unchanged
│   └── sound.ts            # unchanged — no new sound (FR-020)
└── sim/                    # framework-free, hot-path core (constitution III)
    ├── butterflies.ts       # (new) createButterfliesState/stepButterflies/eraseButterfliesInBrush/eraseButterfliesInBrushLine/clearButterflies; owns the amortized FLOWER-cell scan and the per-butterfly visit/travel state machine
    ├── birds.ts              # (new) createBirdsState/stepBirds/eraseBirdsInBrush/eraseBirdsInBrushLine/clearBirds; owns the per-palm perch/hop/flight state machine, reading ObjectsState.byKind.palm directly
    ├── types.ts               # unchanged — no new Element, no new Grid field, no new Tool value (FR-017, FR-033)
    ├── element.ts             # unchanged
    ├── shade.ts               # unchanged
    ├── grid.ts                # unchanged
    ├── step.ts                # unchanged
    ├── brush.ts                # unchanged
    ├── wand.ts                  # unchanged
    ├── objects.ts                # unchanged — birds.ts reads PlacedObject/ObjectsState/OBJECT_KINDS as-is, writes nothing
    ├── pets.ts                    # unchanged — the pattern this feature's two modules follow, not a shared dependency
    ├── scenes.ts                   # unchanged
    ├── resize.ts                    # unchanged — no repositioning helper needed (research.md §4)
    ├── history.ts                    # unchanged — butterflies/birds are never captured (FR-028, FR-030, FR-033)
    ├── historySave.ts                 # unchanged (if spec 011 has landed) — nothing new to persist
    └── save.ts                         # unchanged — SavedWorld/WireWorld shape untouched (FR-028)

tests/
└── unit/
    ├── lib/                   # unchanged — no layout/toolbar change
    └── sim/
        ├── butterflies.test.ts    # (new) the bulk of FR-036's butterfly-specific coverage
        ├── birds.test.ts          # (new) the bulk of FR-036's bird-specific coverage
        ├── pets.test.ts           # unchanged
        ├── objects.test.ts        # unchanged
        ├── flower.test.ts         # unchanged — flower growth/bloom itself is untouched (FR-037)
        ├── palm.test.ts           # unchanged — palm placement/sway/poke is untouched (FR-037)
        ├── flamingo.test.ts       # unchanged
        ├── gumdrop.test.ts        # unchanged
        ├── grass.test.ts          # unchanged
        ├── starPower.test.ts      # unchanged
        ├── weather.test.ts        # unchanged
        ├── history.test.ts        # unchanged
        ├── historySave.test.ts    # unchanged (if present)
        ├── save.test.ts           # unchanged
        ├── resize.test.ts         # unchanged
        ├── scenes.test.ts         # unchanged
        ├── brush.test.ts          # unchanged
        ├── wand.test.ts           # unchanged
        ├── grid.test.ts           # unchanged
        ├── step.test.ts           # unchanged
        └── cellFields.test.ts     # unchanged
```

**Structure Decision**: Same single client-only project 001–016
established — no `backend/`/`frontend/` split, `src/sim/*` stays isolated
from Svelte for zero-DOM `vitest` coverage (constitution Principle V).
Two new sibling files, `butterflies.ts` and `birds.ts`, rather than one
combined `wildlife.ts` (research.md §5) — their population mechanics are
genuinely different shapes (an amortized grid scan feeding a global
count-based cap, versus a direct one-per-object map with no scan at all)
and keeping them separate mirrors the existing `pets.ts`/`objects.ts`
split between "creatures with independent movement" and "placed things
with a footprint," rather than inventing a shared abstraction neither
side needs. `PlayArea.svelte` is the only file this feature modifies
outside of the two new sim files and their two new test files — no
existing exported function signature is removed or incompatibly changed
anywhere, which is what makes FR-037's "existing tests continue to pass
without modification" true by construction.

## Complexity Tracking

*No entries — Constitution Check reported no violations.*
