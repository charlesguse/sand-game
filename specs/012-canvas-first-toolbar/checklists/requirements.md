# Specification Quality Checklist: Canvas-First Toolbar Budget

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-30
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

- **All three clarifications are resolved** (2026-08-30, answered by
  `charlesguse` on lifecycle issue #38). The spec was produced by the
  non-interactive intake stage of the pipeline, so the questions were posted to
  the issue rather than answered inline. The decisions:
  1. FR-002 — **both floors hold.** The drawing region keeps ≥ 60% of the
     constrained axis *and* spec 006's 65%/60% viewport-area floors (FR-004)
     are asserted alongside it at every test viewport. 60% is confirmed as the
     right axis number: at 375×667 it leaves real headroom rather than being
     barely met.
  2. FR-006 — **universal.** The axis floor applies at every viewport size, with
     no threshold; only the rows-vs-rail arrangement stays gated on the existing
     480-pixel phone threshold.
  3. FR-012 — **hard build-time gate, no runtime fallback.** Neither scrolling
     the band nor letting it exceed its budget is permitted. FR-012a fixes what
     is hard (44px target, canvas floor) versus flexible (pitch, spent first),
     FR-012b requires the failure to name the shortfall, and FR-012c makes
     resolution an explicit maintainer decision.
  These answers added FR-012a/b/c, SC-011, SC-012, US1 scenario 7, US3
  scenario 4, and a scope amendment for spec 006's toolbar-fit rule.
- Pixel figures that appear in requirements (44-pixel touch target, 480-pixel
  phone threshold, 65%/60% fill floors) are inherited product constraints from
  spec 006 and the constitution, not implementation choices introduced here.
- The "What the maintainers eyeball" subsection is deliberately split by
  maintainer platform, per `CLAUDE.md` — neither maintainer can verify the
  other's device.
