# Specification Quality Checklist: Rainbow and Unicorn Magic

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
- **Clarifications resolved 2026-08-26** from the reply on issue #3; every checklist item above is now checked.
- **All 3 [NEEDS CLARIFICATION] markers are now resolved** from the answer on lifecycle issue #3. 0 markers remain open, and the spec is ready for `/speckit-plan`.
  1. **FR-005 — how many rainbows and unicorns may exist at once, and what happens at the cap?** → **Up to 3 of each type; the tap always places, and the oldest object of that same type silently disappears to make room.** The rationale given was that for a 4-year-old a button that silently stops responding is the worst outcome, and a small cap keeps the frame budget safe. Folded into FR-005, FR-012, FR-030, User Story 1 scenarios 1–2, User Story 2 scenarios 1–2, the cap and rapid-tap edge cases, SC-012, SC-019, FR-037, and Assumptions.
  2. **FR-007 — do objects float where tapped, or drop to rest on the ground/piles?** → **Objects stay exactly where tapped, floating and solid.** One predictable rule; it makes the mid-air rainbow shelf a deliberate toy, and dropping would still leave objects hanging when a supporting pile is erased. Folded into FR-007, User Story 3 scenario 4, the floating-object edge case, SC-020, FR-037, the visual checks, and Assumptions.
  3. **FR-021 — is rainbow sand's color fixed at conversion, cycling while falling, or cycling forever?** → **Cycle hue while the grain is moving, freeze it when the grain settles.** Cost is bounded by moving grains only, settled piles still read as rainbow stripes, and the sanctioned fallback if profiling strains FR-030 is fixing the hue at conversion — not shrinking the grid. Folded into FR-021, User Story 1 (narrative and scenarios 8–9), FR-030, SC-012, SC-021, the visual checks, and Assumptions.
- Decisions made without a marker, recorded in Assumptions or Requirements rather than asked:
  - **Contact-based, one-cell-deep conversion zone** (FR-013) — an aura or radius would let a rainbow convert a whole pool from a distance, which contradicts the issue's "lands on a rainbow".
  - **Water converted by a rainbow becomes a powder** (FR-014) — it stops flowing. This is what the issue asks for, and it is called out in Assumptions because it means a rainbow can permanently consume water.
  - **Rainbow sand has no brush and does not convert its neighbors** (FR-022, Assumptions) — keeps the magic sourced at the rainbow and keeps the toolbar at 10 controls.
  - **One press places one object** (FR-002) — supersedes the continuous-pour rule from `001` for the object tools only; a drag that streamed dozens of unicorns would blow past any cap instantly.
  - **Placement always succeeds** (FR-004, FR-006) — near-edge taps are nudged inside, elements in the footprint are cleared, and overlapping objects are allowed, so no tap is ever refused (Principle II: nothing she does is "wrong").
  - **Particles live outside the grid** (FR-027) — decorative overlay only, so the hot loop is untouched and the cap in FR-028 is the whole performance story.
- **Superseded requirements are enumerated explicitly** rather than silently overridden, because the constitution forbids regressing earlier features. Note especially that `002`'s "elements never change type" rule (its FR-003/SC-005) is superseded *only* for rainbow conversion; SC-005 here restates the conservation invariant in the form that still holds.
- FR-030, SC-012, and the particle cap state frame-rate targets. As in the previous specs, these mirror the constitution's Principle IV ("Performance Is A Feature") and are treated as user-observable smoothness outcomes, not implementation details.
