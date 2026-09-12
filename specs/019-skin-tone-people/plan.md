# Implementation Plan: People In Every Skin Tone

**Branch**: `019-skin-tone-people` | **Date**: 2026-09-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-skin-tone-people/spec.md`

## Summary

Give each of spec 018's strolling people a **skin tone** — the default
(unmodified) figure or one of the five Fitzpatrick modifier tones — chosen
once at placement from a second, independent no-repeat bag alongside the
existing form (neutral/man/woman) bag, and kept for life exactly like form
already is. The existing once-per-session glyph probe
(`src/lib/personGlyphs.ts`) is extended, not forked: it already resolves
which of the 9 untoned (variant × frame) pictures this device can draw as
single figures; this feature adds a tone rung that runs *after* that ladder
and is judged against the frames the ladder actually resolved to draw (per
the issue's own clarification), covering the full 54 (variant × tone ×
frame) picture space. An undrawable tone is dropped from the bag entirely;
if none is drawable, everyone is the default tone and the toy behaves
exactly as it does today. Tone rides through `Person`, save, undo/redo, and
grid re-derivation as a `readonly` field, tolerant of absence or corruption
on restore, with no save/history format-version bump and no new toolbar
control, sound, grid-element id, or dependency.

## Technical Context

**Language/Version**: TypeScript 5, Svelte 5 (runes), targeting evergreen
browser JS (no transpilation target changes) — unchanged from spec 018.

**Primary Dependencies**: none added — Svelte 5 + Vite + vite-plugin-singlefile
only, per constitution Principle III. No emoji-detection library: the tone
rung is hand-written, injected-capability, DOM-free logic added to the
existing `src/lib/personGlyphs.ts` probe (mirrors the shape spec 018 already
established there).

**Storage**: `localStorage`, the same two keys already in use
(`rainbow-sand-world-v1`, `rainbow-sand-history-v1`); this feature extends
their existing `people` entries with one new optional field (`tone`),
mirroring how spec 018 added `people` itself alongside `mermaids` — it does
not add a key and does not bump either format version (FR-019).

**Testing**: `vitest`, plain unit tests over `src/sim/*` and `src/lib/*` with
no DOM (constitution Principle V); existing suites this feature extends:
`tests/unit/lib/personGlyphs.test.ts` (the probe ladder and the toolbar
glyph invariant), `tests/unit/sim/pets.test.ts` (tone fixed at placement,
the two-bag cycle), `tests/unit/sim/save.test.ts`, `historySave.test.ts`,
`history.test.ts`, and `resize.test.ts` (round-trip and `worldMatches`).
No new test *file* is required — every change slots into an existing
spec-018 suite.

**Target Platform**: browser via `file://` (build artifact) and GitHub
Pages; both maintainers' devices (iPad Safari standalone, Fire tablet Silk,
desktop Chrome) per CLAUDE.md's platform table — this feature is squarely
CLAUDE.md's "Emoji glyph coverage" row again, now for skin-tone modifiers
specifically (Emoji 2.0 on 🚶/🏃, Emoji 12.0 on 🧍), which is exactly why
FR-027 flags two eyeball checks for the maintainers rather than asserting
an answer for either device.

**Project Type**: single-page web app — one Svelte shell (`src/App.svelte`,
`src/lib/*`) over a framework-free simulation core (`src/sim/*`) — unchanged.

**Performance Goals**: 60fps target / ≥30fps floor (constitution Principle
IV) with 3 people + 3 poodles + 3 mermaids live (SC-008), per-frame work per
person unchanged from spec 018 (tone is read, never computed, on the render
path — FR-022). The glyph probe still runs at most once per session
(FR-016); its added tone-rung work is bounded (≤3 drawable variants ×
≤3 distinct actually-drawn frames × 5 modifier tones ≈ 45 checks, each
reusing an already-computed untoned baseline width rather than
re-measuring it) so it adds no perceptible startup delay (SC-009).

**Constraints**: single self-contained `dist/index.html`, must play from
`file://` (FR-024); no DOM/browser test harness (FR-026); no new sounds, no
new grid-element id, no new toolbar control, no new runtime dependency, no
new asset file (FR-024); no existing behavior or test weakened (FR-025).

**Scale/Scope**: default grid 270×160 (`src/lib/layout.ts`), unaffected;
toolbar control count is **unchanged** — this feature adds zero entries
anywhere in `src/lib/toolbarControls.ts` and touches zero lines in
`Toolbar.svelte`'s markup (only the value `glyphFor` reads shifts one field
deeper — research.md §9). Files touched: `src/sim/types.ts`,
`src/sim/pets.ts`, `src/sim/history.ts`, `src/sim/save.ts`,
`src/sim/historySave.ts`, `src/lib/personGlyphs.ts`, `src/lib/PlayArea.svelte`
(the two call sites that pass `person.variant`/`drawableVariants` through
today). No new files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. One Self-Contained Page** — PASS. No new runtime dependency, no
  network call, no new build step, no new asset file. Every toned picture is
  a literal emoji sequence composed at module load from existing codepoints
  (FR-024) — nothing `file://` can't serve.
- **II. Built For An Almost-5-Year-Old** — PASS by construction: tone is
  chosen with no reading and no new control (FR-003); a split or empty-box
  picture is never shown, on canvas or toolbar, on any code path (FR-014);
  an undrawable tone is simply absent from the bag, with the bag collapsing
  harmlessly to the default alone when nothing is drawable (FR-013) — the
  constitution's "feature-detect and hide, never break" rule applied to a
  second axis of the same probe.
- **III. Simple, Dependency-Light Svelte** — PASS. The tone rung lives next
  to the existing fallback ladder in `src/lib/personGlyphs.ts`, in plain TS,
  following the exact injected-capability shape already established there
  (no new architectural pattern). The tone bag is a structural twin of the
  existing variant bag in `src/sim/pets.ts` — no new abstraction layer.
- **IV. Performance Is A Feature** — PASS: the render path gains one more
  `readonly` field read per person (`person.tone`, threaded into `frameFor`)
  with no new allocation and no per-frame branch (FR-022) — the
  drawable/undrawable substitution is resolved once, at probe time, into the
  picture table itself (FR-017). SC-008 (unchanged per-person frame cost)
  and SC-009 (no visible probe-startup delay despite 9→54 pictures) are the
  acceptance tests, addressed structurally in research.md §3 by reusing each
  untoned baseline width across all five tone checks against it rather than
  re-measuring it five times.
- **V. Verifiable Without A Browser Harness** — PASS. FR-026 lists the exact
  rule set this feature must cover in plain `vitest`, including the tone
  rung's fallback ladder with zero DOM; see quickstart.md.
- **Product Constraints note (non-blocking, FR-028)**: the constitution's
  pets clause (amended by spec 018/#64) says people "keep the
  neutral/man/woman form they were born with." This plan does not amend the
  constitution — FR-028 explicitly defers appending "and skin tone" to a
  human PR at finalize (the treasure-chest/spec-018 precedent). Flagging it
  here for the final-PR reviewer, not treating it as a plan-blocking gate
  failure.

No violations requiring justification. Complexity Tracking table is empty.

### Toolbar cost: zero, named explicitly (FR-015, FR-024)

`tool-person`'s control already exists and needs no changes for this
feature — the toolbar button's glyph is (and remains) a fixed lookup,
`pictures.neutral.default.standing`, resolved once per session and never
re-picked (research.md §9). `tests/unit/lib/layout.test.ts`'s control-count
sweep needs no edit and should be re-run as a **regression check**.

## Project Structure

### Documentation (this feature)

```text
specs/019-skin-tone-people/
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
`src/lib/Toolbar.svelte` (Svelte shell) layout every prior spec uses. Every
file below already exists — this feature adds no new file.

```text
src/
├── sim/
│   ├── types.ts                # + PersonTone
│   ├── pets.ts                  # Person.tone; PetsState.personToneBag;
│   │                            #   pickPersonTone (twin of pickPersonVariant);
│   │                            #   addPerson gains drawableTones param;
│   │                            #   restorePeopleFromPositions carries tone through
│   ├── history.ts                # WorldState.people entries widen to include tone;
│   │                             #   worldMatches compares tone (FR-021)
│   ├── save.ts                    # WirePerson.tone? (independently tolerant —
│   │                              #   research.md §7); legacy migration unaffected,
│   │                              #   resolves to 'default' via the same tolerant path
│   └── historySave.ts             # WireHistoryPerson.tone?, same tolerant-resolution rule
│
├── lib/
│   ├── personGlyphs.ts          # + PersonTone-aware TONED_GLYPHS/composePicture table;
│   │                            #   tone rung in resolvePersonPictureSet (research.md §3);
│   │                            #   PersonPictureSet.drawableTones + widened `pictures`;
│   │                            #   frameFor gains a tone parameter
│   ├── toolbarControls.ts       # unchanged
│   ├── Toolbar.svelte           # unchanged — glyphFor('tool-person') keeps reading
│   │                            #   personPictureSet.toolbarGlyph, whose *source* shifted
│   │                            #   one field deeper inside personGlyphs.ts, not here
│   └── PlayArea.svelte          # frameFor call site passes person.tone; addPerson call
│                                 #   site passes personPictureSet.drawableTones; tryRestore
│                                 #   passes tone through restorePeopleFromPositions
│
tests/unit/
├── sim/
│   ├── pets.test.ts             # tone fixed at placement; two-bag independence;
│   │                            #   single/limited-drawableTones cycling
│   ├── history.test.ts          # tone round-trips through undo/redo; worldMatches
│   │                            #   distinguishes a tone-only difference
│   ├── save.test.ts             # tone round-trip; per-person tolerant malformed-tone
│   │                            #   handling; spec-018 (no-tone-field) migration;
│   │                            #   pre-018 byKind.person migration → default tone
│   ├── historySave.test.ts      # same, for the persisted-history payload
│   └── resize.test.ts           # tone survives repositionPeople (no code change
│                                 #   expected here — regression check only)
└── lib/
    └── personGlyphs.test.ts     # NEW coverage in an existing file — the tone rung's
                                  #   fallback ladder (FR-026's required cases), the
                                  #   FR-012 ordering, the FR-005 composition-order
                                  #   assertions, and the toolbar-glyph invariant
```

**Structure Decision**: Single project, no new top-level directories, no new
files. Every touched file already exists from spec 018 — this feature is
purely additive within the established `src/sim/*` (pure logic) / `src/lib/*`
(Svelte UI + browser glue) split, widening `Person`, `PetsState`,
`PersonPictureSet`, `WorldState`, `WirePerson`, and `WireHistoryPerson` by
exactly one field/dimension each.

## Complexity Tracking

*No entries — no constitution violation requires justification.*
