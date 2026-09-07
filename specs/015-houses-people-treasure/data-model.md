# Phase 1 Data Model: Houses, People, And Treasure

Extends the entity model built by specs 001–013 (`Grid`, `ObjectsState`/
`PlacedObject`, `WorldState`, `SavedWorld`, `ToolbarControl`/`ToolbarBand`).
Everything not mentioned below is reused as-is (research.md §12). This
feature adds one new element (**Diamond**), three new object kinds
(**House**, **Person**, **Treasure chest**), one new render-only entity
(**Star twinkle**), and amends three existing entities (**ObjectKind**,
**Toolbar control** manifest, the **guaranteed viewport table**).

## Diamond (new element, grid-element ID 12)

A settling powder, produced only by a treasure chest (FR-013, FR-017).

| Concept | Value | Notes |
|---|---|---|
| `DIAMOND` | `12` (`src/sim/types.ts`) | Reserved by the lifecycle issue; ID 11 stays with the concurrent mermaid/ice-cream feature (FR-013). |
| Movement | via `isPowder(DIAMOND) === true` | Falls, slides, piles, sinks through water/fog — identical to SAND/DIRT/RAINBOW_SAND, no new code in `step.ts` (research.md §1). |
| Color | `colorFor(DIAMOND, shade, _hue, _isCloud)` → `DIAMOND_RAMP[shade % DIAMOND_RAMP.length]` | Fixed colour family, shade-varied like SAND/WATER/DIRT — **not** hue-coloured (research.md §5). |
| Sparkle | `glitter[i] === 1`, set once at creation by `applyChestConversions` | Reuses the existing per-cell sparkle/shimmer render path (`PlayArea.svelte` render loop) unchanged — no new visual system (FR-015). |
| `usesHueColor(DIAMOND)` | `false` (unchanged predicate) | FR-016's explicit statement — `usesHueColor` and `history.test.ts`'s `visibleSnapshot` are **not** edited by this feature (research.md §2). |
| Persistence | via `elements`/`shades`/`glitter` arrays only | No new `Grid`/`WorldState` field; `captureWorldState`/`restoreWorldState`/`resizeGrid`/`remapWorldState` handle it generically, keyed only on `usesHueColor` and element equality checks that already exist (research.md §12). |

**Validation rules**:
- A `DIAMOND` cell is only ever created by `applyChestConversions` (no
  toolbar tool paints it directly — FR-017; `paintCell` in `brush.ts` gets no
  `'diamond'` case because `Tool` never gains a `'diamond'` member).
- The eraser (`paintCell`'s `tool === 'eraser'` branch) and the magic wand
  (`applyWandCell`) treat `DIAMOND` like any other non-`OBJECT`, non-`STAR_POWER`,
  non-`FOG` element — no new branch in either (FR-018): erasing calls
  `setCell(grid, x, y, EMPTY, 0)` unconditionally; the wand's existing
  `element !== OBJECT && element !== STAR_POWER && element !== FOG` guard
  already lets it glitter a `DIAMOND` cell like it would sand.

## Treasure chest (new object kind, with behavior)

| Field | Type | Notes |
|---|---|---|
| `id`, `x`, `y`, `size` | as `PlacedObject` (unchanged shape) | Same footprint size (`OBJECT_FOOTPRINT_SIZE = 24`) and placement/nudge/cap-of-3/eviction rules as every other kind (FR-001–FR-003). |
| `kind` | `'chest'` (new `ObjectKind` member) | — |
| Behavior | `applyChestConversions(grid, chests: PlacedObject[])` | Called once per frame from `PlayArea.svelte`'s `frame()`, **immediately after** `applyRainbowConversions` (FR-011, research.md §3, §4). Converts `SAND \| DIRT \| WATER` cells in the one-cell ring around each chest's footprint to `DIAMOND` with a fresh `randomShade()` and `glitter = 1`. Never touches `FOG`, `RAINBOW_SAND`, `DIAMOND` itself, any other element, or any `OBJECT` footprint cell (FR-009). Endless — no counter, cooldown, or capacity field on the chest (FR-010). |
| On-canvas appearance | new branch in `drawObjectGlyph` reading `src/lib/chestShape.ts`'s shape data, drawn via `ctx.fillRect`/`ctx.beginPath`+`ctx.fill` | No emoji fallback (FR-007); shares shape data with the toolbar's `ChestIcon.svelte` (research.md §6). |
| Toolbar control | `tool-chest`, group `'objects'` | Renders `<ChestIcon />` in `Toolbar.svelte`, the same special-cased pattern `tool-sand`/`BucketIcon` already uses. |

**Validation rules**:
- `applyChestConversions` never allocates per call (plain nested loops over
  a bounded ring, exactly like `applyRainbowConversions`) — FR-012.
- A cell in both a chest's ring and a rainbow's ring resolves to
  `RAINBOW_SAND`, never `DIAMOND`, and never alternates across steps — a
  consequence of call order, not of new per-cell state (research.md §4,
  FR-011).
- Evicting a chest (4th chest placed) removes only the chest object; any
  `DIAMOND` cells it already produced are ordinary material and are
  unaffected (Edge Cases: "chest evicted while its diamonds remain").

## House, Person (new object kinds, no new behavior)

| Field | Type | Notes |
|---|---|---|
| `id`, `x`, `y`, `size`, placement/cap/eviction | as `PlacedObject` (unchanged shape) | Identical mechanism to rainbow/unicorn/palm/flamingo (FR-001–FR-003). |
| `kind` | `'house' \| 'person'` (new `ObjectKind` members) | — |
| Behavior | none — never moves, converts, grows, consumes, or reacts (FR-004) | No entry in `unicornTimers`/`flamingoHopAt`/`palmShiverAt`-style per-kind reaction maps; `drawObjectGlyph` hits the existing unanimated `ctx.fillText(OBJECT_GLYPHS[obj.kind], cx, cy)` branch (`PlayArea.svelte:343-346`). |
| Glyph | 🏠 (house), 🧑 (person) — **not** 🧍 (FR-005, FR-006) | `OBJECT_GLYPHS` map entries; `tests/unit/shell/toolbarGlyphs.test.ts` gains an assertion that `Toolbar.svelte`'s source never contains `🧍`. |
| Toolbar control | `tool-house`, `tool-person`, group `'objects'` | Ordinary `glyphFor`/`handleClick`/`isSelected` cases, no special-cased icon component (unlike chest). |

## Amended: `ObjectKind` / `OBJECT_KINDS`

```ts
// src/sim/types.ts
export type ObjectKind = 'rainbow' | 'unicorn' | 'palm' | 'flamingo' | 'house' | 'person' | 'chest';

// src/sim/objects.ts
export const OBJECT_KINDS: ObjectKind[] = ['rainbow', 'unicorn', 'palm', 'flamingo', 'house', 'person', 'chest'];
```

**Validation rules**:
- `createObjectsState()`'s `byKind` seed gains matching empty-array entries
  for `house`/`person`/`chest`.
- Every function that already iterates `OBJECT_KINDS` generically —
  `isCoveredByAnyObject`, `eraseObjectsInBrush(Line)`, `clearObjects`,
  `objectAtPoint` (`PlayArea.svelte`), `repositionObjects`'s per-kind loop in
  `resize()`, `remapWorldState`'s per-kind loop, `render()`'s draw loop —
  needs **no** code change beyond this array/type edit (research.md §12);
  each one's behavior for the three new kinds is a direct consequence of the
  array now containing them.
- Placement dispatch (`PlayArea.svelte`'s `handlePointerDown`, the `tool ===
  'rainbow' || ... ` check) is **not** generic and must explicitly add
  `'house' | 'person' | 'chest'` to its condition — this is the one
  hand-maintained list that doesn't derive from `OBJECT_KINDS` today (it
  exists to gate "is this a placement tool" separately from "is this a
  painting tool"), so it is called out here rather than assumed free.

## Star twinkle (new — render-only, no saved/undoable state)

| Field | Type | Notes |
|---|---|---|
| slot position | grid `(x, y)`, an eligible empty-sky cell | "Eligible" = `elements[i] === EMPTY` and `y < grid.height * STAR_SKY_FRACTION` (research.md §8). Never a cell holding material or an `OBJECT` footprint (FR-020). |
| fade phase | a stored per-slot value (e.g. a start time or phase offset) | Drives a sine-based fade in `drawStarField`, same style as `drawObjectGlyph`'s flamingo-bob/palm-shiver phase math. |
| cap | `STAR_CAP` (module constant, e.g. 16) | FR-023 — fixed, small upper bound on simultaneous twinkles. |
| owner | `src/lib/stars.ts`'s module-level `StarField` (fixed-size typed arrays, allocated once) | **Not** a `Grid` field, **not** part of `WorldState`/`SavedWorld`/`ObjectsState` (research.md §8). |

**Validation rules**:
- Never appears in `serializeWorld`/`deserializeWorld`,
  `serializeHistory`/`deserializeHistory`, `captureWorldState`/
  `restoreWorldState`, or `clearObjects`/`clearGrid` — structurally
  guaranteed by living outside every type those functions read (FR-021).
- `updateStarField` and `drawStarField` allocate nothing per call after
  `createStarField()`'s one-time array allocation (FR-023, mirrors
  `sparkle.ts`'s `updateFlashMask` reservoir pattern).
- A star slot whose cell becomes non-empty (painted over) is dropped on the
  next resample and never drawn over the new material (FR-020 — "a star
  never hides or replaces anything she drew").

## Amended: Toolbar control manifest (`src/lib/toolbarControls.ts`)

Three new entries, group `'objects'`, unconditional (no `conditional` gate):

```ts
{ id: 'tool-house', group: 'objects', ariaLabel: 'House' },
{ id: 'tool-person', group: 'objects', ariaLabel: 'Person' },
{ id: 'tool-chest', group: 'objects', ariaLabel: 'Treasure chest' },
```

**Validation rules** (extends spec 012's, unchanged mechanism):
- `shippedToolbarControls(false, false).length` becomes 26 (was 23);
  `shippedToolbarControls(true, true).length` becomes 28 (was 25) — matching
  FR-031 exactly, read from the manifest rather than hand-counted (SC-009,
  unchanged from spec 012).
- No new `ToolbarGroupId` is introduced — all three join the existing
  `'objects'` group.

## Amended: guaranteed viewport table (`tests/unit/lib/layout.test.ts`)

The `{ label: 'small phone', width: 320, height: 568 }` row and its
`KNOWN_INFEASIBLE` special-case are **removed**, not extended (FR-031a,
research.md §10). The table's smallest row becomes `{ label: 'iPhone SE 3
portrait', width: 375, height: 667 }`.

**Validation rules**:
- Every remaining row of the table must pass `computeToolbarLayout(...)
  .fits === true` at both the 26-control and 28-control real shipped counts,
  with `controlSize >= MIN_TOUCH_TARGET` and `pitch >= MIN_PITCH` — no
  widened `TOOLBAR_BAND_MAX_SHARE`, no lowered `MIN_TOUCH_TARGET`, no hidden
  control (FR-031b). `computeToolbarLayout`/`toolbarThickness`/
  `clearsAreaFillFloor` in `src/lib/layout.ts` are **unchanged** — only the
  table and the control counts feeding it change (research.md §10).
- If a future row's `fits` becomes `false` at the real shipped count, that
  MUST surface as a failing `vitest` assertion, never a runtime fallback
  (FR-031b, restates spec 012 FR-012b).

## Amended: save / persisted-history wire formats (FR-028)

No shape change — `byKind: Record<string, WireObject[]>` is unchanged in
both `src/sim/save.ts` and `src/sim/historySave.ts`. Only the **read-side
tolerance** changes (research.md §11):

**Validation rules**:
- A `byKind` object missing a key for any `ObjectKind` (including the three
  new ones, and — retroactively — any pre-upgrade payload missing all seven
  because it predates this feature) is read as `[]` for that kind, not as a
  reason to reject the whole payload.
- A `byKind` entry that is *present* but not an array, or whose items fail
  `isPlacedObjectShape`/`isWireHistoryObjectShape`, still rejects the whole
  payload — unchanged from today (FR-028 only relaxes "key absent," not
  "value malformed").
- This tolerance is added identically to `deserializeWorld` (`save.ts`) and
  `deserializeHistory` (`historySave.ts`), since both share the exact same
  defect shape today (research.md §11).

## Superseded / extended entities

- Spec 012/013's **Toolbar control** / **Toolbar band** entities are extended
  (three new manifest rows) but keep their exact shape and validation rules
  — no field, constant, or function signature in `src/lib/layout.ts` changes
  (data-model above, research.md §10).
- No entity from specs 001–014 beyond `ObjectKind`/`OBJECT_KINDS` and the
  toolbar/viewport-table entities above changes shape or meaning — `Grid`,
  `WorldState`, `SavedWorld`, `PlacedObject`, `HistoryManager`'s public
  surface, `resizeGrid`, and every simulation-layer entity not named above
  are unchanged (research.md §12).
