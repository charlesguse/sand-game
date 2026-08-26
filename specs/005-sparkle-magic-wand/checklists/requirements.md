# Specification Quality Checklist: Sparkle Magic Wand

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-26
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`
- **All 3 [NEEDS CLARIFICATION] markers are now resolved.** They were answered on lifecycle
  issue #5 and folded into the spec's `## Clarifications` section (session 2026-08-26); no
  markers remain. They were deliberately the only three; everything else was decided with a
  documented assumption.
  1. **FR-017 — what is the glitter sprinkled into empty space?** *Resolved: the toy's
     existing rainbow sand, placed in an already-glittered state.* No new element type, so
     the constitution's element-set gate is not engaged and there is no separate physics
     tuning or interaction matrix. Sprinkled glitter is indistinguishable from rainbow sand
     the wand glittered in place, and falls with rainbow sand's weight rather than feeling
     lighter — an accepted trade for the smallest footprint. FR-016, the Key Entities entry,
     the Superseded-requirements note, User Story 2, SC-008, and new SC-020 were updated to
     match.
  2. **FR-014 — is glitter permanent or does it fade?** *Resolved: permanent — glitter lasts
     until the grain is erased, cleared, or replaced by a scene load, and never fades on its
     own.* Because the simultaneous-flash cap in FR-022 is fixed, an individual grain flashes
     less often as coverage grows, so a fully glittered screen twinkles gently rather than
     frantically — no per-grain timer state, and nothing beyond what FR-022 already requires.
     User Story 1 gained acceptance scenario 13 and the spec gained SC-019.
  3. **FR-013 — does the wand give placed 🌈 and 🦄 objects a lasting glittered look?**
     *Resolved: no.* The wand's lasting effect is purely a grain thing: a unicorn emits its
     celebration burst (FR-018) and a rainbow is untouched; neither takes on a glittered
     appearance. This keeps the conversion rule and its tests to the smallest testable core,
     which is what the issue asks for in a stretch feature. The wand remains forbidden from
     damaging, moving, resizing, or removing an object. The object edge case, User Story 3
     scenario 6, and new SC-021 were updated to match.
- Decisions made without a marker, recorded in Assumptions or Requirements rather than asked:
  - **Glitter is appearance only** (FR-007) — the issue's "they keep their physics but
    sparkle" is read strictly. This is what makes the conversion rule cheaply unit-testable
    and what guarantees the feature cannot regress the sim.
  - **Glitter travels with the grain, not the cell** (FR-008) — the alternative would smear a
    glittered pile into a static stencil the moment anything fell.
  - **Rainbow sand is glitterable too** (Assumptions) — the issue names "sand/dirt/water", but
    excluding the fourth element would be a hole a child finds immediately.
  - **Glitter survives rainbow conversion** (FR-009) — losing sparkle when a rainbow catches a
    grain would read as the toy taking her magic away.
  - **Glittering is idempotent and never destructive** (FR-010, FR-011) — the wand only adds
    appearance; it cannot empty, retype, or displace a cell, so repeated passes have a ceiling.
  - **"Light dusting" is given testable bounds** (FR-015: more than zero, at most one third of
    the covered empty cells) — otherwise the requester's "light dusting" cannot be asserted
    without a browser.
  - **Sparkle flashes are a capped rendering effect, not per-grain state** (FR-022) — this is
    the only reading that satisfies the issue's "capped and allocation-free in the hot loop"
    when the whole screen is glittered.
  - **The wand is a normal selectable brush**, not a momentary action like 🗑️ or the scene
    buttons (FR-001, FR-004) — it is used by dragging, so it must honor brush size and the
    existing one-selected-tool rule.
- **A cut order is stated explicitly** in Assumptions, because the issue instructs the
  implementer to cut parts rather than gold-plate. Reverse priority order: User Story 3
  (unicorn burst) goes first, then User Story 2 (sprinkling). User Story 1 is the feature —
  if it cannot meet the performance budget, the whole feature is dropped rather than shipped
  degraded.
- FR-022, FR-023, FR-024, SC-011, and SC-012 state frame-rate, cap, and allocation targets.
  These come from the issue itself and mirror the constitution's Principle IV ("Performance
  Is A Feature"); they are treated as user-observable smoothness outcomes, not implementation
  details.
- **Superseded requirements are enumerated explicitly** rather than silently overridden,
  because the constitution forbids regressing earlier features. Only two carry over: the
  toolbar-fits outcome now includes the wand button, and the unicorn gains a second, larger
  burst variant alongside its unchanged ordinary celebration.
