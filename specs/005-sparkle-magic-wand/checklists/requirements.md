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

- [ ] No [NEEDS CLARIFICATION] markers remain
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
- **3 [NEEDS CLARIFICATION] markers remain open** and are posted as questions on lifecycle
  issue #5. They are deliberately the only three; everything else was decided with a
  documented assumption.
  1. **FR-017 — what is the glitter sprinkled into empty space?** A new "glitter dust"
     element with its own identity, or the existing rainbow sand placed already-glittered?
     This is the only decision in the feature that can change the toy's element set, which
     the constitution's product constraints deliberately keep small and gate behind a spec.
     It also decides whether the sprinkle needs its own physics tuning ("very fine sand") or
     inherits the existing powder behavior wholesale.
  2. **FR-014 — is glitter permanent or does it fade?** Permanent is the simplest reading of
     "glitter versions of themselves" and makes the conversion rule trivially testable, but a
     fade keeps sparkle special and caps how much of the screen can be glittered at once. The
     two readings produce visibly different toys, and the acceptance scenarios for User
     Story 1 assume permanence until this is answered.
  3. **FR-013 — does the wand give placed 🌈 and 🦄 objects a lasting glittered look?** The
     issue only specifies the unicorn's celebration burst. Objects are emoji glyphs rather
     than grains, so a lasting glittered appearance for them is a separate visual treatment
     from the grain shimmer and a separate piece of work. Either answer leaves the wand
     harmless to objects (FR-013 forbids damaging, moving, or removing them).
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
