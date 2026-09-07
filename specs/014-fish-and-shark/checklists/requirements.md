# Specification Quality Checklist: Fish And A Shark Living In Her Water

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-07
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

- **Three [NEEDS CLARIFICATION] markers remain open** and are posted to lifecycle
  issue #45 for @charlesguse rather than blocking the spec. Each has a working
  default written into the requirement, so the spec is implementable as-is if the
  defaults stand:
  1. **FR-003 / FR-005 — threshold calibration.** Default: fish at 120 connected
     water cells, shark at 700, against the 270×160 default field. The issue
     explicitly left the numbers to the spec but asked for "rare but findable",
     which only the maintainer's own devices can settle.
  2. **FR-006 — global caps on a canvas of many puddles.** Default: 6 fish and 2
     sharks overall, largest pools populated first. Alternatives are per-pool caps
     with no global limit, or spreading one fish per pool before any pool gets a
     second.
  3. **FR-025 — repopulation hold-off after an eraser removal.** Default: about 3
     seconds, so the eraser is visibly effective. Alternatives are "stays empty
     until the water changes" or "replacement appears at once".
- **Content-quality note on the naming of platform specifics**: the Manual
  Verification section names the Fire 7 and iPad and the two emoji code points.
  That is deliberate and is not an implementation leak — Constitution Principle V
  requires specs to state what a maintainer must eyeball and `CLAUDE.md` requires
  the two-platform split to be named per feature.
- The persistence question the issue asked to be answered explicitly is **decided,
  not deferred**: respawn-from-water, no individual save/restore (FR-027…FR-030,
  Assumptions). It is not one of the three open markers.
- Items marked incomplete require spec updates before `/speckit-clarify` or
  `/speckit-plan`.
