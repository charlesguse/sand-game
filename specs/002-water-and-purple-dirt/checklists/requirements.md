# Specification Quality Checklist: Water and Magic Purple Dirt

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
- **All 3 [NEEDS CLARIFICATION] markers are resolved.** They were posted as questions on lifecycle issue #2 rather than blocking intake, and the answers are folded into the spec and recorded under "Clarifications".
  1. **FR-010 — how completely must water "find its level"?** → **Simple flow only.** Fall, diagonal slide, sideways spread; water never rises. Open containers level within themselves; U-tubes and narrow necks may rest unequal, and that is documented as accepted behavior rather than a defect. The leveling tests assert the simple-flow rules directly (SC-002, new SC-015).
  2. **FR-016 — does magic purple dirt pile more steeply than pink sand, or is it just purple sand?** → **Just purple sand.** Identical movement rules, purple palette with per-grain shade variation. No distinct piling rule to specify or test; parity is asserted by US3 scenario 3 and SC-014.
  3. **FR-026 — is a fixed per-cell blue shade enough, or is an animated shimmer required?** → **Fixed per-cell shade**, assigned at creation like sand grains. Animated shimmer is deferred to a possible later follow-up, gated on obvious frame-rate headroom; SC-006 takes precedence (Principle IV).
- Decisions made without a marker, recorded in Assumptions rather than asked:
  - **Brush/element painting priority** — powder brushes may take a water cell, the water brush may not take a powder cell (FR-021/FR-022). Without this, a play area flooded with water would make the 🩷 brush appear broken, which would defeat User Story 2.
  - **Toolbar control count** — the previous spec's SC-006 capped the toy at 6 controls; three element buttons make 8. Recorded explicitly under "Superseded requirements" rather than silently violated, since the constitution forbids regressing earlier features.
  - **No new element interactions beyond density** — no wet sand, no staining, no evaporation. Keeps the feature within a few bounded agent iterations, per the constitution's workflow guidance.
- SC-006 states a frame-rate target. This mirrors the previous spec and the constitution's Principle IV ("Performance Is A Feature"); it is treated as a user-observable smoothness outcome, not an implementation detail.
