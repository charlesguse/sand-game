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

- **All three [NEEDS CLARIFICATION] markers are resolved**, answered by
  @charlesguse on lifecycle issue #45 and recorded in the spec's Clarifications
  section. Every one confirmed the spec's working default:
  1. **FR-003 / FR-005 — threshold calibration.** Fish at 120 connected water
     cells, shark at 700, as fixed cell counts against the 270×160 default field
     rather than a fraction of the field.
  2. **FR-006 — global caps on a canvas of many puddles.** 6 fish and 2 sharks
     overall, largest pools populated first, matching the existing cap pattern in
     the game and keeping the performance budget bounded.
  3. **FR-025 — repopulation hold-off after an eraser removal.** About 3 seconds,
     after which the pool repopulates on its own — visibly effective without
     leaving the pond permanently emptied.
- **Content-quality note on the naming of platform specifics**: the Manual
  Verification section names the Fire 7 and iPad and the two emoji code points.
  That is deliberate and is not an implementation leak — Constitution Principle V
  requires specs to state what a maintainer must eyeball and `CLAUDE.md` requires
  the two-platform split to be named per feature.
- The persistence question the issue asked to be answered explicitly is **decided,
  not deferred**: respawn-from-water, no individual save/restore (FR-027…FR-030,
  Assumptions). It was never one of the three markers.
- Every checklist item now passes; no spec updates are outstanding before
  `/speckit-plan`.
