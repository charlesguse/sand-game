# Implementation Plan: People Who Stand, Walk, And Run

**Branch**: `018-walking-people` | **Date**: 2026-09-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/018-walking-people/spec.md`

## Summary

Turn the person 🧑 placed-object into a pet-style walker (like the poodle and
mermaid): a living figure with position/facing/state/variant that stands,
strolls, and (on a poke) runs, drawn as the 🧍/🚶/🏃 family — each with ♂/♀
forms — mirrored left/right the way the poodle, fish, and mermaid already are.
The toolbar keeps its existing `'person'` tool id and `tool-person` control
unchanged (zero control-count delta); only what the button places, and what
glyph it and the figures show, change. Because whether this device's emoji
font can draw 🧍 and the gendered ZWJ forms as single glyphs is unverified,
the feature's largest new piece is a from-scratch, DOM-free glyph probe
(`src/lib/personGlyphs.ts`) resolved once per session and shared by the
toolbar and the canvas. The person's old placed-object shape
(`OBJECT_KINDS`'s `'person'` entry, stamping solid `OBJECT` cells) is removed
entirely; old saves and old stored undo history that still hold a
`byKind.person` list are migrated into walkers at the same positions with
their old footprint cells released, without bumping `SAVE_VERSION` or
`HISTORY_SAVE_VERSION` (the `mermaids`-field precedent from spec 016). Undo
history follows the mermaid precedent, not the poodle one (FR-024), since a
person is undoable today and must not silently stop being so.

## Technical Context

**Language/Version**: TypeScript 5, Svelte 5 (runes), targeting evergreen
browser JS (no transpilation target changes)

**Primary Dependencies**: none added — Svelte 5 + Vite + vite-plugin-singlefile
only, per constitution Principle III. No emoji-detection library: the glyph
probe is hand-written, injected-capability, DOM-free logic (mirrors
`src/lib/fullscreen.ts`'s existing dependency-injection shape).

**Storage**: `localStorage`, the same two keys already in use
(`rainbow-sand-world-v1`, `rainbow-sand-history-v1`); this feature extends
their JSON shape (a new optional `people` field, mirroring `mermaids`) and
removes writing to the old `byKind.person` shape — it does not add a key and
does not bump either format version.

**Testing**: `vitest`, plain unit tests over `src/sim/*` and `src/lib/*` with
no DOM (constitution Principle V); existing suites this feature extends:
`tests/unit/sim/pets.test.ts`, `objects.test.ts`, `history.test.ts`,
`save.test.ts`, `historySave.test.ts`, `resize.test.ts`, and
`tests/unit/shell/toolbarGlyphs.test.ts` (whose current "person is 🧑, never
🧍" assertion is the exact opposite of this feature's goal and must be
replaced — see research.md §9). A new `tests/unit/lib/personGlyphs.test.ts`
(or `sim/person.test.ts` for the entity/step logic) is added for the probe
and the variant-cycle picker.

**Target Platform**: browser via `file://` (build artifact) and GitHub Pages;
both maintainers' devices (iPad Safari standalone, Fire tablet Silk, desktop
Chrome) per CLAUDE.md's platform table — this feature is the platform table's
"Emoji glyph coverage" row made concrete for the first time via an actual
runtime probe rather than an assumption.

**Project Type**: single-page web app — one Svelte shell (`src/App.svelte`,
`src/lib/*`) over a framework-free simulation core (`src/sim/*`)

**Performance Goals**: 60fps target / ≥30fps floor (constitution Principle
IV) with 3 people + 3 poodles + 3 mermaids live (SC-007); every new per-frame
search bounded by a fixed window independent of canvas size (FR-008); the
glyph probe itself runs at most once per session, never per person or per
frame (FR-020).

**Constraints**: single self-contained `dist/index.html`, must play from
`file://` (FR-030); no DOM/browser test harness (FR-031); no new sounds
(FR-016); no new grid-element id (FR-009); toolbar control count is
byte-for-byte unchanged (FR-002, FR-006 below).

**Scale/Scope**: default grid 270×160 (`src/lib/layout.ts`); toolbar control
count is **unchanged** — `tool-person` already exists in
`src/lib/toolbarControls.ts` from spec 015, so this feature adds zero entries
to `TOOLBAR_CONTROLS` (unlike spec 016, which added two). Files touched:
`src/sim/types.ts`, `src/sim/objects.ts`, `src/sim/pets.ts`,
`src/sim/history.ts`, `src/sim/save.ts`, `src/sim/historySave.ts`,
`src/lib/personGlyphs.ts` (new), `src/lib/PlayArea.svelte`,
`src/lib/Toolbar.svelte`, `src/App.svelte` (wiring the once-per-session probe
result down to both).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. One Self-Contained Page** — PASS. No new runtime dependency, no
  network call, no new build step, no new asset file. Every picture is a
  literal emoji string chosen at runtime by the probe (FR-030) — nothing
  `file://` can't serve.
- **II. Built For An Almost-5-Year-Old** — PASS by construction: the entire
  glyph-coverage half of this feature exists so that no device can ever show
  her an empty box or a split glyph (User Story 3, FR-017–FR-020); no failure
  states, no reading, no new control (FR-002, FR-013). A buried, airborne, or
  off-grid person always recovers within a bounded time with no rescue
  needed (FR-007).
- **III. Simple, Dependency-Light Svelte** — PASS. The walker's per-frame
  logic lives in `src/sim/pets.ts` next to the poodle's and mermaid's, in
  plain TS. The glyph probe is a pure function over an injected
  measurer/renderer (`src/lib/personGlyphs.ts`), the same
  dependency-injection shape `src/lib/fullscreen.ts` already established —
  no new architectural pattern, no new abstraction layer.
- **IV. Performance Is A Feature** — PASS by design: a person's per-frame
  work reuses the poodle's already-`O(1)`-per-pet, allocation-free primitives
  (`groundBelow`, ledge-step, dig-out) with every pursuit/scent-search field
  the poodle needs for finger-chasing and gumdrop-scent dropped entirely,
  since FR-006 means a person never chases anything — her step function is
  *strictly smaller* than `stepPoodle`'s. SC-007 is the acceptance test.
- **V. Verifiable Without A Browser Harness** — PASS. FR-031 lists the exact
  rule set this feature must cover in plain `vitest`, including the glyph
  probe's fallback ladder with zero DOM (FR-018); see quickstart.md.
- **Product Constraints note (non-blocking, FR-033)**: the constitution's
  "Objects and pets" bullet lists "person 🧑" among the placed objects. This
  plan does not amend the constitution — FR-033 explicitly defers that to a
  human PR at finalize (the treasure-chest precedent). Flagging it here for
  the final-PR reviewer, not treating it as a plan-blocking gate failure.

No violations requiring justification. Complexity Tracking table is empty.

### Toolbar cost: zero, named explicitly (FR-002, FR-006)

Unlike spec 016 (which added two controls), this feature's `tool-person`
control already exists (`src/lib/toolbarControls.ts` line 40, shipped in
spec 015). `shippedToolbarControls(...).length` is unchanged by this feature
— confirmed by reading the current file: no entry is added, removed, or
reordered in `TOOLBAR_CONTROLS`. What changes is `Toolbar.svelte`'s
`glyphFor('tool-person')` case, which currently returns the string literal
`'🧑'` and must instead return the resolved toolbar picture from the
once-per-session `PersonPictureSet` (passed in as a prop) — a value change,
not a structural one. `tests/unit/lib/layout.test.ts`'s control-count sweep
therefore needs no edit and should be re-run as a **regression check**, not
a "new count" check.

## Project Structure

### Documentation (this feature)

```text
specs/018-walking-people/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── sim-and-shell-contracts.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

Single project — no frontend/backend split, no separate packages. Same
`src/sim/*` (framework-free simulation, vitest-only surface) + `src/lib/*`
(Svelte UI helpers) + `src/App.svelte`/`src/lib/PlayArea.svelte`/
`src/lib/Toolbar.svelte` (Svelte shell) layout every prior spec uses.

```text
src/
├── sim/
│   ├── types.ts                # 'person' removed from ObjectKind/OBJECT_KINDS' companion
│   │                            #   union; PersonVariant type added; Tool keeps 'person'
│   ├── objects.ts               # OBJECT_KINDS drops 'person'; + migrateLegacyPersonObjects()
│   │                            #   (footprint→position math + old-cell release, FR-026/FR-027)
│   ├── pets.ts                  # + Person type, PetsState.people, PERSON_CAP,
│   │                            #   addPerson/stepPeople/pokePersonAt/repositionPeople/
│   │                            #   erasePeopleInBrush(Line)/restorePeopleFromPositions,
│   │                            #   createVariantPicker (seeded, injectable RNG)
│   ├── history.ts                # + WorldState.people; capture/restore/remap/worldMatches
│   │                             #   updated; HistoryManager methods already take PetsState
│   │                             #   (spec 016) — no new parameter, just a new field read
│   ├── save.ts                    # + SavedWorld/WireWorld.people (+ legacy byKind.person read
│   │                              #   for migration, never written again)
│   └── historySave.ts             # + WireHistoryStep.people (+ same legacy-read migration)
│
├── lib/
│   ├── personGlyphs.ts          # NEW — the glyph probe: injected measurer/renderer,
│   │                            #   resolvePersonPictureSet(), PersonPictureSet type,
│   │                            #   the 9-glyph literal table, native-facing constant
│   ├── toolbarControls.ts       # unchanged (tool-person already exists)
│   ├── Toolbar.svelte           # glyphFor('tool-person') reads the resolved picture set
│   │                            #   prop instead of a literal
│   └── PlayArea.svelte          # OBJECT_GLYPHS loses 'person'; + place/poke/erase/render/
│                                 #   resize/save/restore wiring for people, mirroring the
│                                 #   existing poodle/mermaid call sites; person mirroring
│                                 #   moves into the poodle/mermaid-style render loop
│
tests/unit/
├── sim/
│   ├── pets.test.ts (or a new person.test.ts) # stroll/ledge/buried/poke/variant-stability
│   ├── objects.test.ts                         # migration: footprint→position, cell release
│   ├── history.test.ts                         # people round-trip through undo/redo
│   ├── save.test.ts                             # people round-trip; legacy byKind.person
│   │                                             #   migration; pre-feature save compatibility
│   └── historySave.test.ts                      # same, for the persisted-history payload
├── lib/
│   └── personGlyphs.test.ts     # NEW — the fallback ladder (FR-018's required cases) and
│                                 #   the seeded no-repeat variant cycle (FR-013a), no DOM
└── shell/
    └── toolbarGlyphs.test.ts    # REPLACES its "person is 🧑, never 🧍" assertion — see
                                  #   research.md §9
```

**Structure Decision**: Single project, no new top-level directories. Every
touched file already exists except `src/lib/personGlyphs.ts` (the glyph
probe) and its test file — additive within the established `src/sim/*`
(pure logic) / `src/lib/*` (Svelte UI + browser glue) split every prior spec
follows. The one structurally new thing, following spec 016's own precedent,
is that `WorldState` (already extended once for `mermaids`) gains a third
pet-shaped field, `people`.

## Complexity Tracking

*No entries — no constitution violation requires justification.*
