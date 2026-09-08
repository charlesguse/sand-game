# Contract: Toolbar manifest, chest icon, on-canvas glyphs, ambient stars

Extends `specs/012-canvas-first-toolbar/contracts/toolbar-budget.md`
(control manifest, `computeToolbarLayout`) and `specs/013-rendered-geometry-
gate`'s geometry-gate tests. Boundary: `src/lib/*` (Svelte shell + pure
render-support modules) and the no-DOM `vitest` suites in
`tests/unit/lib/*`, `tests/unit/shell/*` that exercise them without a
browser (constitution Principle V).

## `src/lib/toolbarControls.ts` (extended)

```ts
export const TOOLBAR_CONTROLS: readonly ToolbarControlSpec[] = [
  // ...existing 23 unconditional + 2 conditional entries, unchanged order/content...
  { id: 'tool-house', group: 'objects', ariaLabel: 'House' },
  { id: 'tool-person', group: 'objects', ariaLabel: 'Person' },
  { id: 'tool-chest', group: 'objects', ariaLabel: 'Treasure chest' },
];
```

**Contract**: `shippedToolbarControls(false, false).length === 26`,
`shippedToolbarControls(true, true).length === 28` (FR-031) — not asserted
as literals in tests, read from the manifest as spec 012 established.
`ToolbarGroupId` gains no new member; the three entries join `'objects'`.

## `src/lib/chestShape.ts` (new)

```ts
export interface ChestShapePart {
  kind: 'rect' | 'path';
  d?: string;       // SVG path data, for kind: 'path', in a 0-36 viewBox unit (matches BucketIcon's convention)
  rect?: { x: number; y: number; width: number; height: number; rx?: number };
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}

/** The chest's shape, box + lid + a highlight, in the same 0-36 unit box BucketIcon.svelte uses. Consumed by both ChestIcon.svelte (toolbar, <svg>) and PlayArea.svelte's drawObjectGlyph (canvas, scaled to the object's footprint). */
export const CHEST_SHAPE: readonly ChestShapePart[];
```

**Contract**: `CHEST_SHAPE` is the single source of the chest's visual
geometry — no other module hand-derives a competing chest drawing. Both
consumers below read this array; a shape tweak here changes both renderers
in lockstep (research.md §6).

## `src/lib/ChestIcon.svelte` (new — precedent: `BucketIcon.svelte`)

**Contract**: An inline `<svg viewBox="0 0 36 36" ...>` built by mapping
`CHEST_SHAPE`'s parts to `<rect>`/`<path>` elements — structurally identical
in spirit to `BucketIcon.svelte`, carrying the same doc-comment convention
explaining *why* an inline SVG exists (no Unicode treasure-chest glyph
exists at all, not even a later-Emoji-version one to avoid — FR-007). Used
in `Toolbar.svelte` exactly like `BucketIcon`:

```svelte
{#if control.id === 'tool-sand'}
  <button ...><BucketIcon /></button>
{:else if control.id === 'tool-chest'}
  <button ...><ChestIcon /></button>
{:else}
  <button ...>{glyphFor(control.id)}</button>
{/if}
```

## `src/lib/Toolbar.svelte` (extended)

**Contract**:
- Imports and special-cases `ChestIcon` as shown above.
- `glyphFor(id)` gains `case 'tool-house': return '🏠';` and `case
  'tool-person': return '🧑';` (no case needed for `'tool-chest'` — it never
  reaches the `{glyphFor(...)}` branch).
- `handleClick(id)` gains `case 'tool-house': onSelectTool('house'); return;`
  and matching cases for `'tool-person'`/`'tool-chest'`.
- `isSelected(id)` gains matching `tool === 'house'` / `'person'` / `'chest'`
  cases.
- `Props` interface and every other existing case: unchanged.

## `src/App.svelte` (extended)

**Contract**: `Tool` union usage flows through unchanged prop wiring — no
new prop, no new callback. The only required change is that `tool =
$state<Tool>('sand')` continues to type-check once `Tool` gains `'house' |
'person' | 'chest'` in `src/sim/types.ts`.

## `src/lib/PlayArea.svelte` (extended)

**Contract**:
- `OBJECT_GLYPHS: Record<ObjectKind, string>` gains `house: '🏠'`, `person:
  '🧑'` (no `chest` entry — chest never reaches the glyph-lookup path).
- `drawObjectGlyph(obj)` gains a branch before its existing `if (obj.kind !==
  'palm')` fallback:
  ```ts
  if (obj.kind === 'chest') {
    // Scales CHEST_SHAPE's 0-36 unit box to obj.size and draws each part via
    // ctx.fillRect / ctx.beginPath+fill (rect/path), translated to (obj.x, obj.y).
    // No ctx.fillText call — there is no glyph.
    return;
  }
  ```
  `house`/`person` fall through to the existing unanimated
  `ctx.fillText(OBJECT_GLYPHS[obj.kind], cx, cy)` branch — no new animation
  state (no timer map like `flamingoHopAt`/`palmShiverAt`), matching FR-004.
- `handlePointerDown`'s placement-tool condition:
  ```ts
  if (tool === 'rainbow' || tool === 'unicorn' || tool === 'palm' || tool === 'flamingo'
      || tool === 'house' || tool === 'person' || tool === 'chest') { // extended
    ...
    placeObject(grid, objectsState, tool, pos.x, pos.y);
    ...
  }
  ```
  This is the one placement-dispatch list that does not derive from
  `OBJECT_KINDS` automatically (data-model.md, "Amended: `ObjectKind`") and
  must be edited explicitly.
- `frame()` gains one line, directly after the existing
  `applyRainbowConversions` call:
  ```ts
  function frame(now: number): void {
    lastFrameNow = now;
    step(grid);
    stepPets(grid, petsState, poodleTarget);
    applyRainbowConversions(grid, objectsState.byKind.rainbow);
    applyChestConversions(grid, objectsState.byKind.chest); // new — FR-011's ordering guarantee
    updateUnicorns(now);
    sweepPokeReactions(now);
    tickParticles(particles, now);
    updateFlashMask(grid, flashMask);
    updateStarField(grid, starField, now); // new
    render();
    requestAnimationFrame(frame);
  }
  ```
- `render()` gains one call after the existing particle-drawing loop:
  `drawStarField(ctx, starField, lastFrameNow)` — drawn last, over
  everything else, so a twinkle is never occluded by material drawn first
  (though FR-020 means it should never coexist with material at the same
  cell in the first place).
- No change to `saveNow`/`flushSave`/`tryRestore`/`clearAll` beyond what
  `serializeWorld`/`OBJECT_KINDS` already propagate generically — `stars`
  are never read or written by any of these (FR-021).

## `src/lib/stars.ts` (new)

```ts
export const STAR_CAP = 16;
export const STAR_SKY_FRACTION = 1 / 3;
export const STAR_RESAMPLE_MS = 400;

export interface StarField {
  readonly x: Int32Array;   // length STAR_CAP
  readonly y: Int32Array;   // length STAR_CAP
  readonly active: Uint8Array; // length STAR_CAP, 1 if this slot currently holds a twinkling star
  readonly bornAt: Float64Array; // length STAR_CAP, timestamp each active slot started fading in
}

export function createStarField(): StarField;

/** Resamples eligible empty-sky cells into field's slots at most once per STAR_RESAMPLE_MS. Allocates nothing after createStarField. */
export function updateStarField(grid: Grid, field: StarField, now: number): void;

/** Draws each active slot at a sine-based fade alpha derived from now - bornAt. Allocates nothing. */
export function drawStarField(ctx: CanvasRenderingContext2D, field: StarField, now: number): void;
```

**Contract**:
- `updateStarField`'s eligibility test: `grid.elements[i] === EMPTY && Math
  .floor(i / grid.width) < grid.height * STAR_SKY_FRACTION` — never `OBJECT`,
  never any material (FR-020).
- `StarField` is created once per grid instance (alongside `flashMask` in
  `PlayArea.svelte`'s `resize()`/mount path) and is never read by
  `serializeWorld`, `captureWorldState`, `clearObjects`, or `clearGrid`
  (FR-021) — it is not a parameter to any of them.
- Calling `updateStarField`/`drawStarField` allocates no new object/array
  (FR-023) — the four typed arrays inside `StarField` are mutated in place.

## `tests/unit/lib/layout.test.ts` (amended)

**Contract**:
- `VIEWPORT_TABLE` loses the `'small phone'` (320×568) row (FR-031a,
  data-model.md).
- `KNOWN_INFEASIBLE` and its dedicated "cannot clear both floors" test block
  are deleted (there is no longer a known-infeasible row to document).
- All other assertions continue reading `controlCount` from
  `shippedToolbarControls(...).length` — no hand-updated `23`/`25` literal
  anywhere in the file (unchanged mechanism from spec 012, now exercising
  26/28).

## `tests/unit/shell/toolbarGlyphs.test.ts` (amended)

**Contract**: Gains assertions mirroring the existing bucket-icon checks:
- `Toolbar.svelte`'s source contains `<ChestIcon` and does not contain a
  substitute glyph (`🎁`, `📦`, `💰`) anywhere (FR-007).
- `Toolbar.svelte`'s source never contains `🧍` (FR-005) even though it does
  contain `🧑`.
