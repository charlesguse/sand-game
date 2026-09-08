# Implementation Plan: A Mermaid And Her Ice Cream

**Branch**: `016-mermaid-ice-cream` | **Date**: 2026-09-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-mermaid-ice-cream/spec.md`

## Summary

Add a new pet (🧜 mermaid, capped at 3, drawn over the grid like a poodle) that
swims cell-to-cell through connected water instead of walking, and a new
paintable element (🍦 ice cream, grid ID 11, hue-coloured) that falls and rests
exactly like a gumdrop. The mermaid reuses the poodle/gumdrop pursuit shape —
bounded scent window, closest-target, patience-then-give-up, cooldown — adapted
from 1D ground pursuit to 2D water-only stepping. Both new entities are wired
through every cross-cutting path the constitution's checklist calls out
(eraser, clear-all, save/restore, undo/redo, grid re-derivation), which is the
largest share of the diff: the mermaid is the *first* pet to participate in
undo/redo at all (poodles still do not, and stay that way — out of scope, not a
regression), so `src/sim/history.ts`, `src/sim/save.ts`, and
`src/sim/historySave.ts` all gain a `mermaids` field alongside their existing
`byKind`/`poodles` handling.

## Technical Context

**Language/Version**: TypeScript 5, Svelte 5 (runes), targeting evergreen
browser JS (no transpilation target changes)

**Primary Dependencies**: none added — Svelte 5 + Vite + vite-plugin-singlefile
only, per constitution Principle III

**Storage**: `localStorage`, two keys already in use
(`rainbow-sand-world-v1`, `rainbow-sand-history-v1`); this feature extends
their JSON shape, does not add a key

**Testing**: `vitest`, plain unit tests over `src/sim/*` with no DOM
(constitution Principle V); existing suites in `tests/unit/sim/pets.test.ts`,
`gumdrop.test.ts`, `history.test.ts`, `save.test.ts`, `historySave.test.ts`,
`resize.test.ts` are the ones this feature extends or mirrors

**Target Platform**: browser via `file://` (build artifact) and GitHub Pages;
both maintainers' devices (iPad Safari standalone, Fire tablet Silk, desktop
Chrome) per CLAUDE.md's platform table

**Project Type**: single-page web app — one Svelte shell (`src/App.svelte`,
`src/lib/*`) over a framework-free simulation core (`src/sim/*`)

**Performance Goals**: 60fps target / ≥30fps floor (constitution Principle
IV) with 3 mermaids + 3 poodles live; every new per-frame search bounded by a
fixed window independent of canvas size (FR-010)

**Constraints**: single self-contained `dist/index.html`, must play from
`file://` (FR-032); no DOM/browser test harness (FR-033); no new sounds
(FR-023); toolbar must stay within the existing 44px-floor scale-to-fit system
with no new mechanism (FR-030)

**Scale/Scope**: default grid 270×160 (`src/lib/layout.ts`); toolbar control
count rises by exactly 2 (one `elements`-group control, one `objects`-group
control) — see "Toolbar cost" below for the exact before/after numbers

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. One Self-Contained Page** — PASS. No new runtime dependency, no
  network call, no new build step. Ice cream/mermaid glyphs are drawn as
  `fillText` emoji exactly like existing pets/elements (or gumdrop-style hue
  colours off a typed array) — nothing added at play time that `file://`
  can't serve.
- **II. Built For An Almost-5-Year-Old** — PASS by construction: no failure
  states are introduced (a mermaid placed dry rests instead of erroring, a
  buried mermaid frees herself, ice cream out of reach just sits there as
  decoration — FR-008/009/015 and the Edge Cases section make this explicit).
  No reading is required; two new emoji-labelled buttons, same tap-to-place /
  drag-to-paint gestures already in use.
- **III. Simple, Dependency-Light Svelte** — PASS. The mermaid's per-frame
  logic lives in `src/sim/pets.ts` next to the poodle's, in plain TS, no new
  runtime dependency. Svelte (`PlayArea.svelte`) only wires input, render, and
  save/undo glue, exactly as it does for poodles/gumdrops today.
- **IV. Performance Is A Feature** — PASS by design, not just by hope: the
  mermaid's ice-cream search reuses the poodle's bounded-square-window
  pattern (ported to 2D) and her per-frame swim step only ever inspects her
  own up-to-8 neighbour cells — both are O(1) per mermaid, independent of
  grid size, and allocate nothing on the hot path (mirrors `stepPoodle`'s
  existing no-allocation discipline). SC-005 is the acceptance test for this.
- **V. Verifiable Without A Browser Harness** — PASS. FR-033 lists the exact
  rule set this feature must cover in plain `vitest`; see quickstart.md and
  the Independent Test in each user story. No browser-automation
  infrastructure is added.
- **Product Constraints note (non-blocking)**: the constitution's "Objects
  and pets" bullet currently reads "...and up to three poodle 🐩 pets..." and
  doesn't yet mention a second pet kind. That's stale prose, not a violated
  principle — nothing in Principles I–V is violated by a second pet kind,
  and Governance reserves amending the constitution's text to a human PR.
  Flagging it here for whoever reviews the final PR, not treating it as a
  plan-blocking gate failure.

No violations requiring justification. Complexity Tracking table is empty.

### Toolbar cost (FR-030), named explicitly

`src/lib/toolbarControls.ts`'s `TOOLBAR_CONTROLS` list is the single source
of truth `tests/unit/lib/layout.test.ts` already reads via
`shippedToolbarControls(...).length` rather than a hand-maintained literal
(SC-009 in spec 013). Counting it directly against this branch's fork point
(which already includes "Houses, People, And Treasure"'s `tool-house`,
`tool-person`, and `tool-chest`): 6 `elements` + 8 `objects` + 4 `actions`
+ 2 `history` + 1 conditional `screen` + 1 conditional `photo` + 3 `scenes`
+ 3 `sizes` = **28** with both conditionals shown (`FULL_CONTROLS` in that
test file), **26** with neither (`BASE_CONTROLS`). The spec's own FR-030 text
("from 24 to 26") is the issue author's approximate recollection, not the
codebase's actual current count — see research.md's "Toolbar count baseline"
decision. Adding one unconditional `elements` control (`tool-icecream`) and
one unconditional `objects` control (`tool-mermaid`) takes those two numbers
to **30** and **28** respectively. Because the layout system sizes itself
from `shippedToolbarControls(...).length` at runtime (never a literal), this
is a pure count bump with no new sizing mechanism — exactly what FR-030 asks
for — and `layout.test.ts`'s representative-viewport sweep
(`CONTROL_COUNTS = [BASE_CONTROLS, FULL_CONTROLS]`) automatically re-runs
against the new numbers with no test-file edit required.

## Project Structure

### Documentation (this feature)

```text
specs/016-mermaid-ice-cream/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   └── sim-and-shell-contracts.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

Single project — no frontend/backend split, no separate packages. This is the
same `src/sim/*` (framework-free simulation) + `src/lib/*` (Svelte UI helpers)
+ `src/App.svelte`/`src/lib/PlayArea.svelte`/`src/lib/Toolbar.svelte` (Svelte
shell) layout every prior spec in this repo has used.

```text
src/
├── sim/                       # framework-free simulation core (vitest-only surface)
│   ├── types.ts               # + ICE_CREAM = 11; Element union; Tool union: 'mermaid', 'icecream'
│   ├── element.ts             # + ICE_CREAM in isSolid() and usesHueColor()
│   ├── step.ts                # + route ICE_CREAM through the existing stepGumdrop()
│   ├── brush.ts                # + paint ICE_CREAM like GUMDROP (hue-coloured, falls solid)
│   ├── pets.ts                 # + Mermaid type, PetsState.mermaids, MERMAID_CAP,
│   │                           #   addMermaid/stepMermaid/pokeMermaidAt/repositionMermaids/
│   │                           #   eraseMermaidsInBrush(Line), clearPets() clears both arrays
│   ├── history.ts              # + WorldState.mermaids; capture/restore/remap/worldMatches
│   │                           #   updated; HistoryManager methods gain a PetsState param
│   ├── save.ts                  # + SavedWorld/WireWorld.mermaids (session persistence)
│   └── historySave.ts           # + WireHistoryStep.mermaids (falls out of history.ts change)
│
├── lib/
│   ├── toolbarControls.ts      # + tool-icecream (elements group), tool-mermaid (objects group)
│   ├── Toolbar.svelte           # + glyph/aria/selection cases for the two new control ids
│   ├── palette.ts               # + ICE_CREAM_COLORS ramp + colorFor() case
│   ├── sound.ts                  # + 'icecream' PourKind + pitch (pouring only — FR-023 is
│   │                            #   about eating/poke, not pouring; see research.md)
│   └── PlayArea.svelte           # + place/poke/erase/render/resize/save/restore wiring for
│                                 #   mermaids and ice cream, mirroring the existing poodle/
│                                 #   gumdrop/object call sites
│
tests/unit/
├── sim/
│   ├── pets.test.ts (or a new mermaid.test.ts) # swim/eat/give-up/no-water/buried/poke rules
│   ├── gumdrop.test.ts (or a new iceCream.test.ts) # pour/fall/rest/hue-colour rules
│   ├── history.test.ts          # mermaid round-trip; visibleSnapshot helper gains ICE_CREAM
│   ├── save.test.ts              # mermaid + ice-cream round-trip; pre-feature save compatibility
│   ├── historySave.test.ts       # same, for the persisted-history payload
│   └── resize.test.ts             # mermaid remap (clamp, never dropped)
└── lib/layout.test.ts            # unchanged file, but now exercises 28/30-control counts
```

**Structure Decision**: Single project, no new top-level directories. Every
touched file already exists; this feature is additive within the established
`src/sim/*` (pure logic, vitest-covered) / `src/lib/*` (Svelte UI + browser
glue) split every prior spec follows. The one structurally new thing is that
`src/sim/history.ts`'s `WorldState` — previously grid + objects only — now
also carries pet data, because FR-027 requires mermaids (unlike poodles) to
round-trip through undo/redo.

## Complexity Tracking

*No entries — no constitution violation requires justification.*
