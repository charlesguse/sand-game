# Specification Quality Checklist: Rendered Geometry Matches The Layout Model

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

- **All 3 clarifications are resolved** (answered by @charlesguse on lifecycle
  issue #41, 2026-08-30; recorded in the spec's Clarifications section). (1) The
  check closes the class *hybrid*: a closed allowlist over declarations that
  change a control's border box or flow participation, assert-only elsewhere, so
  the toolbar's cosmetic box-shadow/gradient grouping cue never trips it
  (FR-018…FR-018c, SC-013). (2) The rows/rail decision is **unified** onto one
  owner read from the *layout* viewport with the existing media query's
  semantics — no behaviour change at any spec-012 table viewport, and a
  pinch-zoom can no longer flip the arrangement (FR-007…FR-007b, SC-014). (3) The
  "each historical cause fails the suite" acceptance is a **permanent** mechanism
  whose negative cases are derived from the shipped component's current source at
  test time, which makes the check a pure function over source text
  (FR-013a…FR-013c, SC-001). 0 [NEEDS CLARIFICATION] markers remain.
- **Implementation-name mentions are deliberate and bounded.** The Assumptions
  section names `computeToolbarLayout`, `computePlayField`, and
  `tests/unit/shell/toolbarGeometry.test.ts`. This feature's subject *is* the
  agreement between an existing model and an existing stylesheet, and the issue
  itself scopes the work by naming them; spec 012 sets the same precedent.
  Requirements (FR-001…FR-024) and Success Criteria (SC-001…SC-012) are stated
  in terms of behaviour and observable facts, not code.
- **Success criteria phrasing.** The "users" of Stories 2–4 are the two
  maintainers, so several criteria are counts of protected facts and unlisted
  assertions rather than end-user timings. SC-002 and SC-009 carry the
  child-facing outcomes; the rest measure the guarantee that keeps SC-002 true.
- Constitution Principle V is treated as binding and unamendable by this
  feature: FR-012 and SC-006 forbid any browser, headless browser, or DOM
  environment.
- No spec-012 or spec-006 floor is weakened; FR-021 and SC-007 make that a
  requirement of this feature rather than an assumption.
