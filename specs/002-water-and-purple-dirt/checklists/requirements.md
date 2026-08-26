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
- **3 open [NEEDS CLARIFICATION] markers** (the maximum this command allows). They are posted as questions on lifecycle issue #2 rather than blocking intake; answers get folded back into the spec.
  1. **FR-010 — how completely must water "find its level"?** Sideways-only flow levels water inside a single open container but cannot push water back *up* into the far arm of a U-tube or a tall narrow neck. A pressure-style rule that lets water rise levels U-tubes correctly but costs more per frame. Scope + performance impact, and it changes what the leveling tests assert.
  2. **FR-016 — does magic purple dirt pile more steeply than pink sand, or is it just purple sand?** The requester marked steeper piling as nice-to-have and plain sand behavior as acceptable, so both readings are live; steeper piling adds a distinct rule to specify, test, and eyeball.
  3. **FR-026 — is a fixed per-cell blue shade enough, or is an animated shimmer required?** The request said "slight blue shade variation *or* shimmer". Static shading is the cheapest option and matches how sand grains already vary; animated shimmer is livelier but touches the per-frame render path (Principle IV).
- Decisions made without a marker, recorded in Assumptions rather than asked:
  - **Brush/element painting priority** — powder brushes may take a water cell, the water brush may not take a powder cell (FR-021/FR-022). Without this, a play area flooded with water would make the 🩷 brush appear broken, which would defeat User Story 2.
  - **Toolbar control count** — the previous spec's SC-006 capped the toy at 6 controls; three element buttons make 8. Recorded explicitly under "Superseded requirements" rather than silently violated, since the constitution forbids regressing earlier features.
  - **No new element interactions beyond density** — no wet sand, no staining, no evaporation. Keeps the feature within a few bounded agent iterations, per the constitution's workflow guidance.
- SC-006 states a frame-rate target. This mirrors the previous spec and the constitution's Principle IV ("Performance Is A Feature"); it is treated as a user-observable smoothness outcome, not an implementation detail.
