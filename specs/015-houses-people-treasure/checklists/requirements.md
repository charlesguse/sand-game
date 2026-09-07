# Specification Quality Checklist: Houses, People, And Treasure

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

- **Both clarifications are resolved** on lifecycle issue #47; no
  [NEEDS CLARIFICATION] markers remain.
  1. **Stars (FR-019)** — ambient sky twinkle confirmed, no toolbar control. The
     spec's working default stood, so FR-019/FR-021/FR-022 needed no scope
     change; reserved element ID 13 stays unclaimed.
  2. **Toolbar shortfall (FR-031)** — resolved by dropping the 320×568 row from
     spec 012's guaranteed viewport table, the escape valve spec 012 FR-012c
     explicitly sanctions, with the reasoning recorded (no device either
     maintainer ships to is smaller than the 375×667 iPhone SE 3). Captured as
     new **FR-031a** (drop the row, record why) and **FR-031b** (that is the only
     concession — every remaining row still passes at the real shipped count, no
     widened band, no sub-44px control, no hidden control). SC-012 and the
     smallest-screen edge case were updated to match.

- **Deliberate identifier references.** The spec names a small number of concrete
  identifiers — grid-element ID 12 for diamonds, ID 11 left to the concurrent
  mermaid/ice-cream feature, ID 13 left unclaimed, the `'star'` tool id and
  `STAR_POWER` element that must not be reused, and the `usesHueColor` /
  `visibleSnapshot` pair in FR-016. These are not leaked implementation choices:
  the lifecycle issue reserves them explicitly and requires the hue-colour
  question to be answered "explicitly either way", and a collision on any of them
  is exactly the failure the issue filed the spec to prevent. Every other
  requirement is stated as behaviour.

- **Two items the specifying pass surfaced that the issue did not ask about**,
  both worth the reviewer's attention before planning:
  1. **FR-028 (backward-compatible restore)** — both the world save and the
     persisted undo history currently reject the entire saved payload when any
     object kind's list is missing. Adding three kinds therefore makes the first
     launch after upgrade silently discard everything she had built. This spec
     requires missing kind lists to read as empty instead.
  2. **FR-031 (toolbar budget)** — the three new controls take the shipped count
     from 23 to 26 (28 with fullscreen and photo), which by spec 012's own sizing
     rule is infeasible at the 320×568 row of the guaranteed viewport table. The
     maintainer decision this required has now been made (FR-031a: retire that
     row), but planning should note that the feature also **narrows a shipped
     guarantee** — a reviewer should agree to that, not just to the new objects.

- **FR-035 records a required constitution amendment** (diamonds and the three
  objects join the Product Constraints lists; the "no custom artwork assets"
  clause is amended to permit shapes drawn in code for an object with no Unicode
  glyph). The spec does not edit the constitution — that amendment is the human
  gate's call, per Governance.
