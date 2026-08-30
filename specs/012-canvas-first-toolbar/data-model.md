# Phase 1 Data Model: Canvas-First Toolbar Budget

Extends `specs/006-phone-support/data-model.md`'s Grid / Play field /
Drawing region / Visible viewport / On-screen scale / Re-derivation /
Toolbar layout model. Everything there is reused as-is except **Toolbar
layout**, which this feature replaces with a real sizing rule (§5 below),
and **Drawing region**, whose size now depends on the new **Toolbar band**
entity rather than the toolbar's intrinsic content size. This feature adds
two new entities — **Toolbar control** and **Toolbar band** — and changes
none of 001–011's simulation-layer entities (research.md §11).

## Toolbar control (new)

One button the toolbar can ever show. Declared once, statically, in
`src/lib/toolbarControls.ts` — the single source of truth `Toolbar.svelte`
renders from and the test suite imports (research.md §4, FR-013).

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Stable identifier (e.g. `'tool-sand'`, `'action-undo'`, `'scene-landscape1'`). Used both as the Svelte `{#each}` key and to look up the control's behavior (`onclick`, `selected`, `disabled`, glyph) from a small map built inside `Toolbar.svelte` from its existing props. |
| `group` | `ToolbarGroupId` | One of `'elements' \| 'objects' \| 'actions' \| 'history' \| 'screen' \| 'photo' \| 'scenes' \| 'sizes'` — purely a visual clustering key (FR-008); never affects whether the control fits. |
| `ariaLabel` | `string` | Unchanged meaning from today's `aria-label` attributes. |
| `conditional` | `'fullscreen' \| 'photo' \| undefined` | `undefined` for the 24 controls that always render. `'fullscreen'`/`'photo'` mark the two feature-detected controls (📺/📷), included only when the matching capability probe (`App.svelte`'s `showFullscreen`/`showPhoto`) is `true`. |

**Validation rules**:
- `TOOLBAR_CONTROLS` (the full static list, all 26 possible entries) is the
  only place a control is declared; `Toolbar.svelte` has no button that
  isn't produced by iterating this list, and the list has no entry that
  isn't rendered when its `conditional` gate (if any) passes — the two can
  never disagree because one is generated from the other (FR-013, FR-014).
- `shippedToolbarControls(showFullscreen, showPhoto)` returns exactly the
  controls a given device actually shows: all `conditional === undefined`
  entries, plus `'fullscreen'` entries iff `showFullscreen`, plus
  `'photo'` entries iff `showPhoto`. Its `.length` is `controlCount` for
  every `computeToolbarLayout` call, at runtime and in tests alike.

## Toolbar band (new — replaces 006's "Toolbar layout" verification-only model)

The strip of screen the toolbar actually occupies, now a real runtime
quantity (not just a test model) — `Toolbar.svelte` applies its computed
`thickness`/`controlSize`/`pitch` as the component's own inline size and
CSS custom properties, and the exact same function computes the value the
test suite asserts against (research.md §5).

| Concept | Type / Signature | Notes |
|---|---|---|
| `PREFERRED_CONTROL_SIZE` | `number` (constant, 56) | Today's fixed `3.5rem` control diameter, kept as the ceiling continuous sizing shrinks from. |
| `PREFERRED_PITCH` | `number` (constant, 16) | Today's `1rem` inter-group gap, kept as the ceiling the pitch-shrink phase starts from. |
| `MIN_PITCH` | `number` (constant, 4) | Floor below which pitch never shrinks — keeps neighbouring targets from crowding close enough to co-activate (FR-009). |
| `TOOLBAR_BAND_MAX_SHARE` | `number` (constant, 0.4) | FR-002's cap: the band's thickness must never exceed this fraction of the constrained axis. |
| `ToolbarLayoutResult` | `{ fits: boolean; controlSize: number; pitch: number; thickness: number; requiredThickness: number; arrangement: 'rows' \| 'rail' }` | Return type of `computeToolbarLayout` (contracts/toolbar-budget.md). `requiredThickness` is always populated — equal to `thickness` when `fits` is `true`; the tightest-legal-arrangement thickness when `fits` is `false` (FR-012b). |
| `computeToolbarLayout` | `(viewportWidth: number, viewportHeight: number, controlCount: number) => ToolbarLayoutResult` | Pure. Determines `arrangement` internally via `isPhoneSized`/width-vs-height (research.md §7, unchanged threshold ownership from 006), then runs the two-phase shrink (research.md §2) against the constrained axis's `TOOLBAR_BAND_MAX_SHARE` cap. |

**Validation rules**:
- `controlSize >= MIN_TOUCH_TARGET` (44) always, whether or not `fits` is
  `true` — the shrink algorithm never proposes a smaller control, per
  FR-007/FR-012c ("MUST NOT... shrinking a control below 44 pixels").
- `pitch >= MIN_PITCH` always, for the same reason applied to spacing
  (FR-009).
- `thickness <= TOOLBAR_BAND_MAX_SHARE * constrainedAxisLength` whenever
  `fits` is `true` — this is FR-002 restated as the function's own
  postcondition, not just an external assertion.
- `fits === false` if and only if `requiredThickness` (computed at
  `controlSize = MIN_TOUCH_TARGET`, `pitch = MIN_PITCH`) still exceeds the
  cap — the FR-012 gate condition, expressed as data rather than as a
  side effect.
- For every viewport in the representative table (research.md §10) with
  the real 24/26-control set, `fits` is `true` — asserted by
  `tests/unit/lib/layout.test.ts`; a future control addition that makes
  any row's `fits` become `false` is what SC-008 means by "the check
  reacts."
- `arrangement` matches `Toolbar.svelte`'s CSS media-query condition
  exactly (`viewportHeight <= PHONE_MAX_SHORT_SIDE && viewportWidth >
  viewportHeight` → `'rail'`, else `'rows'`) — both read the same
  `isPhoneSized`/`PHONE_MAX_SHORT_SIDE` from `layout.ts` (research.md §7).

## Drawing region (extended)

Unchanged concept from 006 (the part of the visible viewport left for the
play area) but now a *consequence* of the Toolbar band rather than of the
toolbar's unconstrained content size — `PlayArea.svelte`'s `container`
(`flex: 1; min-width: 0; min-height: 0`) still supplies the two numbers
`computePlayField` takes, unchanged; what changed is only what decides how
big `Toolbar.svelte`'s own box is before the flex remainder is computed
(research.md §1).

**Validation rules** (new, on top of 006's):
- For every representative-table viewport, with the real shipped control
  set, `(constrainedAxisLength - toolbarBand.thickness) /
  constrainedAxisLength >= 0.6` — FR-002's axis floor, holding
  simultaneously with 006's `PlayField` fill-floor validation rules on the
  phone-sized subset (FR-004, FR-015).

## Constrained axis (new — naming only, no new runtime state)

The screen axis `computeToolbarLayout` budgets against: viewport height
when `arrangement === 'rows'`, viewport width when `arrangement ===
'rail'`. Not a stored value — it is simply `arrangement === 'rows' ?
viewportHeight : viewportWidth`, read directly off the function's two
viewport arguments. Named here only because FR-002/FR-006 are stated
against it explicitly in the spec.

## Superseded / extended contracts

- 006's **Toolbar layout** entity (verification-only model,
  `computeToolbarLayout(viewportWidth, viewportHeight, controlCount,
  groupCount) => { fits, controlSize, thickness }` with a hand-maintained
  `controlCount`/`groupCount` in the test file) is superseded by this
  feature's **Toolbar band** entity above: the function is now the actual
  sizing rule the component runs, its `groupCount` parameter is dropped
  (research.md §3), and its `controlCount` input comes from the new
  **Toolbar control** manifest instead of a literal constant (FR-013,
  FR-014).
- 006's **FR-020a** characterization ("shrink toward the 44-pixel
  minimum," binary — 56px or 44px, gated by a single landscape media
  query) is superseded by the continuous two-phase shrink above (FR-007).
- No entity from 001–011 beyond **Toolbar layout** changes shape,
  meaning, or validation rules — `Grid`, `PlayField`, `computePlayField`,
  `Drawing region`'s formula, `Visible viewport`, `On-screen scale`,
  `Re-derivation`, and every simulation-layer entity are unchanged
  (research.md §11).
