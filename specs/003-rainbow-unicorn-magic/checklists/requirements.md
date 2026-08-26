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
- **3 [NEEDS CLARIFICATION] markers remain open.** Per the pipeline's intake rules they are left in the spec and posted as questions on lifecycle issue #3 rather than blocking intake. None of them blocks planning of the other user stories.
  1. **FR-005 — how many rainbows and unicorns may exist at once, and what happens at the cap?** The issue says "a few can exist at once" without a number. Affects scope (object bookkeeping), performance headroom, and the feel of the toy. Both candidate behaviors at the cap (replace oldest / ignore the tap) must be silent, per the never-punishing constraint.
  2. **FR-007 — do objects float where tapped, or drop to rest on the ground/piles?** The issue says the unicorn "stands on the ground/piles" but also that the rainbow is "stamped" where tapped. These are different mechanics: a floating shelf is a placement rule, while dropping requires object gravity and a re-settle rule when the pile beneath changes. This directly shapes User Story 3.
  3. **FR-021 — is rainbow sand's color fixed at conversion, cycling while falling, or cycling forever?** The issue asks for grains that "cycle/shimmer through rainbow colors as they fall and settle into rainbow-striped piles", which spans all three. Per-frame recoloring of every rainbow grain is the main frame-rate risk in this feature, and the equivalent question for water was resolved in favor of fixed shades in `002` (its FR-026). FR-030 is stated to take precedence over the answer.
- Decisions made without a marker, recorded in Assumptions or Requirements rather than asked:
  - **Contact-based, one-cell-deep conversion zone** (FR-013) — an aura or radius would let a rainbow convert a whole pool from a distance, which contradicts the issue's "lands on a rainbow".
  - **Water converted by a rainbow becomes a powder** (FR-014) — it stops flowing. This is what the issue asks for, and it is called out in Assumptions because it means a rainbow can permanently consume water.
  - **Rainbow sand has no brush and does not convert its neighbors** (FR-022, Assumptions) — keeps the magic sourced at the rainbow and keeps the toolbar at 10 controls.
  - **One press places one object** (FR-002) — supersedes the continuous-pour rule from `001` for the object tools only; a drag that streamed dozens of unicorns would blow past any cap instantly.
  - **Placement always succeeds** (FR-004, FR-006) — near-edge taps are nudged inside, elements in the footprint are cleared, and overlapping objects are allowed, so no tap is ever refused (Principle II: nothing she does is "wrong").
  - **Particles live outside the grid** (FR-027) — decorative overlay only, so the hot loop is untouched and the cap in FR-028 is the whole performance story.
- **Superseded requirements are enumerated explicitly** rather than silently overridden, because the constitution forbids regressing earlier features. Note especially that `002`'s "elements never change type" rule (its FR-003/SC-005) is superseded *only* for rainbow conversion; SC-005 here restates the conservation invariant in the form that still holds.
- FR-030, SC-012, and the particle cap state frame-rate targets. As in the previous specs, these mirror the constitution's Principle IV ("Performance Is A Feature") and are treated as user-observable smoothness outcomes, not implementation details.
