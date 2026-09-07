# Implementation Plan: Houses, People, And Treasure

**Branch**: `015-houses-people-treasure` | **Date**: 2026-09-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-houses-people-treasure/spec.md`

## Summary

Three new placeable object kinds — **house** (🏠), **person** (🧑), and
**treasure chest** (no Unicode glyph, drawn from shapes defined in code) —
join `OBJECT_KINDS` alongside rainbow/unicorn/palm/flamingo, reusing the
existing footprint/placement/cap-of-3-eviction/whole-object-erase/clear-all
machinery in `src/sim/objects.ts` with **zero** changes to that machinery
beyond the `ObjectKind` union and array (FR-001–FR-006, research.md §7,
§12). The chest gets the feature's one new behaviour: a new
`applyChestConversions` function, structurally a copy of the rainbow's
existing one-cell-ring `applyRainbowConversions`, converts `SAND | DIRT |
WATER` in its zone into a new element — **diamond**, grid-element ID 12 —
called from `PlayArea.svelte`'s `frame()` immediately *after* the existing
rainbow-conversion call, which is what makes a cell in both a chest's and a
rainbow's ring resolve deterministically to rainbow sand forever, by call
order alone, with no new per-cell state (FR-008–FR-011, research.md §3–§4).
Diamonds fall/pile/sink exactly like sand by joining the single `isPowder`
predicate `step.ts` already dispatches on — no new movement code — and are
deliberately **not** added to `usesHueColor`/`history.test.ts`'s
`visibleSnapshot`, since they are fixed-colour with ordinary shade variation
and the sparkle flag, not hue-varied (FR-013–FR-016, research.md §1–§2,
§5). Ambient sky twinkles are a new, wholly render-only `src/lib/stars.ts`
module modeled on the existing `particles.ts`/`sparkle.ts` precedent —
capped, allocation-free, and structurally outside `Grid`/`WorldState`, so
FR-021's "never saved, undone, erased, or cleared" is true by construction
rather than by an exclusion someone has to remember (FR-019–FR-023,
research.md §8). Three toolbar controls join `toolbarControls.ts`'s
`'objects'` group (23→26 unconditional, 25→28 with fullscreen+photo,
matching FR-031 exactly), which — under spec 012's own sizing rule, unchanged
by this feature — no longer fits the 320×568 row of the guaranteed viewport
table; that row is dropped per FR-031a/FR-031b, the maintainer-sanctioned
escape valve spec 012 built for exactly this situation, and no other row's
guarantee is weakened (research.md §9–§10). Finally, this feature also fixes
a real, pre-existing defect it would otherwise trigger on every user's first
upgrade: `save.ts`/`historySave.ts` currently reject an entire saved world or
undo history outright when *any* object kind's list is missing from the
payload, which every pre-upgrade save now is, for the three new kinds — FR-028
changes both to treat an absent kind list as empty instead (research.md §11).

## Technical Context

**Language/Version**: TypeScript 5.x, Node 22 (matches
`.github/workflows/deploy-pages.yml`) — unchanged from 001–013.

**Primary Dependencies**: `svelte` 5, `vite`, `@sveltejs/vite-plugin-svelte`,
`vite-plugin-singlefile`, `vitest`, `typescript` — unchanged; no new runtime
dependency. Every capability this feature needs (`Uint8Array`/typed arrays,
Canvas2D path/fill primitives, inline SVG in a Svelte component) is already
in use by 001–013 on both target-browser families.

**Storage**: `localStorage`, via the existing `src/sim/save.ts`/
`historySave.ts` wire formats — unchanged shape, only the read-side
tolerance changes (FR-028, research.md §11). No new storage key, no version
bump.

**Testing**: `vitest`. New/extended files: `tests/unit/sim/objects.test.ts`
(or a sibling `objects.chest.test.ts`) for cap/eviction/erase/chest
conversion; `tests/unit/sim/step.test.ts` for diamond fall/pile/sink;
`tests/unit/sim/save.test.ts` and a `historySave.test.ts` equivalent for
FR-028's missing-kind tolerance; `tests/unit/sim/history.test.ts` for
round-trip and remap coverage (explicitly **not** touching
`usesHueColor`/`visibleSnapshot`, FR-016); a new `tests/unit/lib/stars.test.ts`
for the ambient twinkle eligibility/cap/no-persistence rules; `tests/unit/
lib/layout.test.ts` amended to drop the 320×568 row and its known-infeasible
special-case; `tests/unit/shell/toolbarGlyphs.test.ts` extended for the
chest icon and the 🧍 exclusion. No DOM, no browser automation — matching
constitution Principle V and every prior spec's precedent.

**Target Platform**: Static single-file page opened via `file://` or served
from GitHub Pages; Amazon Fire 7 Kids tablet (Silk/Chromium) and desktop
Chrome (upstream), iPad Safari standalone home-screen app (fork) — unchanged
scope.

**Project Type**: Single-page client-only web app — no backend/API.
Unchanged.

**Performance Goals**: Steady 60fps target, 30fps floor (constitution
Principle IV) — unchanged. `applyChestConversions` adds a bounded per-frame
cost (~104 cells per chest, capped at 3 chests) of the same order as the
already-shipped `applyRainbowConversions`; the ambient star system is
capped and allocation-free after one-time setup (research.md §8, §13).

**Constraints**: The per-frame simulation/render path (`step`,
`applyChestConversions`, `updateStarField`, `render`) stays allocation-free
(constitution Principle IV). Production build still emits exactly one
output file with zero runtime network requests — the chest's on-canvas
appearance and toolbar icon are drawn from code (Canvas2D calls / inline
SVG), never an external image asset (FR-007, Constitution Principle I). No
diamond toolbar control or tool exists — a chest is the only source
(FR-017).

**Scale/Scope**: One feature, three prioritized user stories (chest→diamond
mechanic; house/person decoration; ambient stars). Adds three files
(`src/lib/chestShape.ts`, `src/lib/ChestIcon.svelte`, `src/lib/stars.ts`);
extends `src/sim/types.ts` (`DIAMOND`, `ObjectKind`), `src/sim/element.ts`
(`isPowder`), `src/sim/objects.ts` (`OBJECT_KINDS`,
`applyChestConversions`), `src/lib/palette.ts` (`DIAMOND_RAMP`,
`colorFor`), `src/sim/save.ts`/`src/sim/historySave.ts` (FR-028 tolerance),
`src/lib/toolbarControls.ts` (three manifest entries), `src/lib/
Toolbar.svelte` (glyph/click/selected cases + `ChestIcon` special-case),
`src/App.svelte` (`Tool` type flows through, no prop change), `src/lib/
PlayArea.svelte` (`OBJECT_GLYPHS`, `drawObjectGlyph`'s chest branch,
placement-tool condition, `frame()`'s new calls, `render()`'s star draw).
No change to `src/sim/step.ts`'s dispatch logic, `src/sim/history.ts`,
`src/sim/resize.ts`, or `src/sim/wand.ts`/`brush.ts`'s signatures
(research.md §1, §12).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. One Self-Contained Page | No new build step, external asset, font, or runtime dependency. The chest's appearance (toolbar + canvas) is drawn entirely from code (`chestShape.ts` data, consumed by an inline-SVG Svelte component and by Canvas2D calls) — no image file, matching the bucket-icon precedent (FR-007). | PASS |
| II. Built For An Almost-5-Year-Old | No reading required; house/person/chest are placed exactly like existing objects. Nothing about diamonds, houses, people, or stars can fail or show an error — a chest never runs out (FR-010), stars never displace her drawing (FR-020), and the one place this feature *could* have introduced a visible failure (a pre-upgrade save silently vanishing after upgrade) is explicitly fixed rather than shipped (FR-028). | PASS |
| III. Simple, Dependency-Light Svelte | No new dependency. `applyChestConversions` and the star system reuse existing patterns (`applyRainbowConversions`, `particles.ts`/`sparkle.ts`) rather than inventing new abstractions; the sim core stays plain TypeScript operating on the typed-array grid, `PlayArea.svelte` stays the thin per-frame orchestrator it already is. | PASS |
| IV. Performance Is A Feature | No new per-frame allocation: `applyChestConversions` mirrors the already-shipped rainbow loop's cost; the star field is a fixed-size typed-array structure allocated once, resampled on a throttled interval, drawn every frame at a small fixed cost (research.md §8a, §13). | PASS |
| V. Verifiable Without A Browser Harness | Every new rule (chest conversion, diamond fall/pile/sink, cap/eviction for the new kinds, whole-object erase, clear-all, save/restore round-trip, undo/redo round-trip, backward-compatible restore, resize remap, star eligibility/cap/non-persistence) is covered by headless `vitest` (FR-033). The genuinely device-only judgments (chest/diamond legibility, glyph rendering, twinkle prettiness) are named explicitly in quickstart.md's manual-check list (FR-034), not automated. No browser-automation infrastructure is added. | PASS |

No violations — Complexity Tracking is not needed. One non-obvious
design decision worth flagging (not a constitution trade-off, a technical
interpretation): FR-031's toolbar-budget shortfall is resolved by *dropping
a guaranteed-viewport row* (FR-031a/FR-031b), a maintainer decision the spec
already made explicit on issue #47 and recorded in
`checklists/requirements.md` — this plan implements that decision but does
not re-open it. Similarly, FR-035's required constitution amendment is
scoped to the final PR, per Governance — this plan's file edits stay inside
`specs/015-houses-people-treasure/` and do not touch
`.specify/memory/constitution.md`.

## Project Structure

### Documentation (this feature)

```text
specs/015-houses-people-treasure/
├── plan.md                              # This file (/speckit-plan command output)
├── research.md                          # Phase 0 output
├── data-model.md                        # Phase 1 output
├── quickstart.md                        # Phase 1 output
├── contracts/
│   ├── elements-and-objects.md          # Phase 1 output — sim-layer contract
│   └── toolbar-and-rendering.md         # Phase 1 output — lib/UI-layer contract
├── checklists/requirements.md           # already present (spec stage)
└── tasks.md                             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

This feature extends the scaffold established by `001-falling-pink-sand`
through `013-rendered-geometry-gate` (not greenfield). Files marked **(new)**
are added by this feature; files marked **(modified)** have their contents
changed but keep their existing responsibility; everything else is
unchanged.

```text
index.html                  # unchanged
package.json                 # unchanged — no new dependency
tsconfig.json / vite.config.ts / vitest.config.ts   # unchanged

src/
├── main.ts                 # unchanged
├── App.svelte              # unchanged in substance — Tool union flows through from sim/types.ts
├── lib/
│   ├── PlayArea.svelte     # (modified) OBJECT_GLYPHS + drawObjectGlyph chest branch; placement-tool condition extended; frame() calls applyChestConversions + updateStarField; render() calls drawStarField; StarField created alongside flashMask
│   ├── Toolbar.svelte      # (modified) ChestIcon special-case; glyphFor/handleClick/isSelected cases for house/person/chest
│   ├── toolbarControls.ts  # (modified) three new 'objects'-group entries (FR-031, FR-032)
│   ├── chestShape.ts       # (new) CHEST_SHAPE geometry data — single source for toolbar icon + on-canvas drawing (research.md §6)
│   ├── ChestIcon.svelte    # (new) inline-SVG toolbar icon built from chestShape.ts, precedent: BucketIcon.svelte
│   ├── stars.ts            # (new) StarField: createStarField/updateStarField/drawStarField — render-only, capped, allocation-free (research.md §8)
│   ├── BucketIcon.svelte   # unchanged
│   ├── layout.ts           # unchanged — computeToolbarLayout/toolbarThickness/clearsAreaFillFloor need no edit (research.md §10); consumes the larger control count via toolbarControls.ts unchanged
│   ├── palette.ts          # (modified) DIAMOND_RAMP + colorFor's new branch
│   ├── particles.ts        # unchanged — precedent only
│   ├── sparkle.ts          # unchanged — precedent only
│   ├── sound.ts            # unchanged
│   └── fullscreen.ts       # unchanged
└── sim/
    ├── types.ts             # (modified) DIAMOND = 12; ObjectKind gains house/person/chest; Tool gains house/person/chest
    ├── element.ts           # (modified) isPowder gains DIAMOND; usesHueColor explicitly UNCHANGED (FR-016)
    ├── grid.ts               # unchanged — setCell/clearGrid/setGlitter already generic over element value
    ├── step.ts                # unchanged — isPowder dispatch already routes DIAMOND to stepPowder
    ├── brush.ts               # unchanged — no diamond tool; eraser branch already generic
    ├── wand.ts                # unchanged — element-guard already generic
    ├── objects.ts             # (modified) OBJECT_KINDS extended; createObjectsState's byKind seed extended; new applyChestConversions
    ├── pets.ts                # unchanged
    ├── resize.ts              # unchanged — resizeGrid already generic over OBJECT_KINDS/element value
    ├── shade.ts                # unchanged — randomShade() reused for diamonds, no new random helper
    ├── history.ts              # unchanged — capture/restore/remap already generic over OBJECT_KINDS and usesHueColor
    ├── historySave.ts          # (modified) FR-028 missing-kind-list tolerance
    ├── save.ts                 # (modified) FR-028 missing-kind-list tolerance
    └── scenes.ts                # unchanged

tests/
└── unit/
    ├── lib/
    │   ├── layout.test.ts       # (modified) VIEWPORT_TABLE drops the 320×568 row; KNOWN_INFEASIBLE special-case removed; control counts now 26/28 via shippedToolbarControls
    │   ├── stars.test.ts        # (new) eligibility/cap/non-persistence coverage
    │   ├── palette.test.ts      # (modified) DIAMOND_RAMP coverage, fixed-colour assertion
    │   ├── fullscreen.test.ts   # unchanged
    │   ├── sound.test.ts        # unchanged
    │   └── glyphSupport.test.ts # unchanged (module does not exist; glyph fallback logic lives in Toolbar.svelte directly, per current codebase — see toolbarGlyphs.test.ts below)
    ├── shell/
    │   ├── toolbarGlyphs.test.ts    # (modified) chest-icon usage + no-🧍 assertions
    │   ├── indexHtml.test.ts        # unchanged
    │   ├── toolbarGeometry.test.ts  # unchanged mechanism — now exercises 26/28 controls via the same shippedToolbarControls-derived count
    │   └── playAreaGeometry.test.ts # unchanged
    └── sim/
        ├── objects.test.ts       # (modified) house/person/chest cap/eviction/erase; new chest-conversion coverage (or a sibling objects.chest.test.ts)
        ├── step.test.ts          # (modified) diamond fall/pile/sink coverage
        ├── element.test.ts       # (modified) isPowder(DIAMOND)/usesHueColor(DIAMOND) assertions
        ├── save.test.ts          # (modified) FR-028 missing-kind-list tolerance; diamond round-trip
        ├── historySave.test.ts   # (modified) FR-028 missing-kind-list tolerance; diamond round-trip
        ├── history.test.ts       # (modified) round-trip/remap for new kinds + diamonds; visibleSnapshot explicitly UNCHANGED
        ├── resize.test.ts        # (modified) remap coverage for new kinds + diamonds
        └── scenes.test.ts         # unchanged
```

**Structure Decision**: Same single client-only project 001–013 established
— no `backend/`/`frontend/` split. This feature adds three small new
modules (a shape-data module, an SVG icon component, and a render-only
ambient-decoration module), extends the existing `ObjectKind`/element
machinery in `src/sim/*` by data (one new ID, three new kind strings, one
new conversion function) rather than by new architecture, and extends the
toolbar's existing single-source-of-truth manifest by three entries. No new
test directory, no new build tooling, no new top-level architecture. The
one intentionally *narrowed* guarantee (the dropped 320×568 viewport row) is
a test-table edit, not a code-path removal — `computeToolbarLayout` itself
is untouched (research.md §10).

## Complexity Tracking

*No entries — Constitution Check reported no violations.*
