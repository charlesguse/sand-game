# Contract: Diamond element, chest conversion, house/person/chest objects

Extends `specs/010-undo-redo/contracts/*`, `specs/012-canvas-first-toolbar/
contracts/toolbar-budget.md`. Boundary: `src/sim/*` pure functions consumed
by `PlayArea.svelte`'s frame loop, exercised directly by no-DOM `vitest`
(constitution Principle V). Everything in prior contracts not mentioned here
is unchanged.

## `src/sim/types.ts` (extended)

```ts
// Unchanged:
export const EMPTY = 0;
export const SAND = 1;
export const WATER = 2;
export const DIRT = 3;
export const RAINBOW_SAND = 4;
export const OBJECT = 5;
export const GRASS = 6;
export const STAR_POWER = 7;
export const FOG = 8;
export const GUMDROP = 9;
export const FLOWER = 10;
// (ID 11 reserved by the concurrent mermaid/ice-cream feature — not declared here.)

// New:
export const DIAMOND = 12;

export type Element =
  | typeof EMPTY | typeof SAND | typeof WATER | typeof DIRT | typeof RAINBOW_SAND
  | typeof OBJECT | typeof GRASS | typeof STAR_POWER | typeof FOG | typeof GUMDROP
  | typeof FLOWER | typeof DIAMOND; // extended

export type ObjectKind =
  | 'rainbow' | 'unicorn' | 'palm' | 'flamingo'
  | 'house' | 'person' | 'chest'; // extended
```

**Contract**: `Grid` interface is **unchanged** — no new typed array. `Tool`
union gains no `'diamond'` member (FR-017: no diamond tool) but gains
`'house' | 'person' | 'chest'` (placement tools, alongside the existing
`'rainbow' | 'unicorn' | 'palm' | 'flamingo'`).

## `src/sim/element.ts` (extended)

```ts
export function isPowder(e: number): boolean {
  return e === SAND || e === DIRT || e === RAINBOW_SAND || e === DIAMOND; // DIAMOND added
}
// isLiquid, isSolid: unchanged signatures; isSolid's behavior for DIAMOND follows
// automatically since it derives from isPowder().

export function usesHueColor(e: number): boolean {
  return e === RAINBOW_SAND || e === GUMDROP || e === FLOWER; // UNCHANGED — DIAMOND deliberately absent (FR-016)
}
```

**Contract**:
- `isPowder(DIAMOND) === true`; `isSolid(DIAMOND) === true` (inherited via
  `isPowder`). `step.ts`'s dispatch (`if (isPowder(element)) stepPowder(...)`)
  requires no new branch — diamonds fall/pile/sink exactly like sand
  (research.md §1).
- `usesHueColor(DIAMOND) === false`. This function and
  `tests/unit/sim/history.test.ts`'s `visibleSnapshot` are **not** edited by
  this feature (FR-016, research.md §2) — a passing test suite after this
  feature must still show `usesHueColor`'s only three `true` cases as
  `RAINBOW_SAND`/`GUMDROP`/`FLOWER`.

## `src/sim/objects.ts` (extended)

```ts
export const OBJECT_KINDS: ObjectKind[] = [
  'rainbow', 'unicorn', 'palm', 'flamingo', 'house', 'person', 'chest',
]; // extended

export function createObjectsState(): ObjectsState; // byKind seed extended with house: [], person: [], chest: []

// Unchanged signatures, behavior extended for free via the OBJECT_KINDS loop:
// placeObject, removeObject, eraseObjectsInBrush(Line), clearObjects, footprintIntersectsCircle

// New — mirrors applyRainbowConversions's shape (research.md §3):
/**
 * For each chest, converts any SAND/DIRT/WATER cell in its one-cell-ring zone to DIAMOND with a
 * fresh shade and the sparkle flag set. Never touches FOG, RAINBOW_SAND, DIAMOND, or any OBJECT
 * footprint. Allocates nothing.
 */
export function applyChestConversions(grid: Grid, chests: PlacedObject[]): void;
```

**Contract**:
- `applyChestConversions`'s zone math (ring bounds, footprint-skip) is
  byte-for-byte the same shape as `applyRainbowConversions`'s
  (`objects.ts:24-45`), differing only in: (a) convertible set is `SAND |
  DIRT | WATER` (no `FOG`, no `fogCloudCount` decrement); (b) output is
  `setCell`-equivalent write of `DIAMOND` + `randomShade()` (not a fresh hue)
  plus `setGlitter(grid, x, y, 1)`.
- Calling `applyChestConversions` with an empty array is a no-op; calling it
  repeatedly with the same chests and no new pourable material in the zone
  produces no further change (idempotent on settled state) — mirrors
  `applyRainbowConversions`'s existing behavior.
- `placeObject(grid, state, 'chest', cx, cy)` / `'house'` / `'person'` use
  the exact same cap-of-3-per-kind eviction as every existing kind — no
  parameter or behavior change to `placeObject` itself.

## `src/sim/brush.ts`, `src/sim/wand.ts` (unchanged signatures, generic behavior extended)

**Contract**: `paintCell`'s `tool === 'eraser'` branch and `applyWandCell`'s
`element !== OBJECT && element !== STAR_POWER && element !== FOG` guard both
already generalize over any other element value, so `DIAMOND` is erased and
glittered by the wand with **no new branch** in either file (FR-018).
`paintCell` gets no `'house'`/`'person'`/`'chest'`/`'diamond'` case — placing
the three new object kinds is dispatched in `PlayArea.svelte`, not through
`applyBrush`/`paintCell` (see `contracts/toolbar-and-rendering.md`).

## `src/sim/step.ts` (unchanged)

**Contract**: No new element branch. `isPowder(element)` already routes
`DIAMOND` to the existing `stepPowder` function (research.md §1) — this file
has zero line changes.

## `src/lib/palette.ts` (extended)

```ts
// New:
const DIAMOND_RAMP: Rgb[]; // 6-8 fixed icy-blue/white shades, indexed by shade % length — same pattern as PINK_RAMP/WATER_RAMP

export function colorFor(element: number, shade: number, hue: number, isCloud: boolean): Rgb {
  // ...existing branches unchanged...
  if (element === DIAMOND) return DIAMOND_RAMP[shade % DIAMOND_RAMP.length]; // new branch
  return [255, 255, 255];
}
```

**Contract**: `colorFor(DIAMOND, shade, hue, isCloud)` ignores `hue`/`isCloud`
exactly like the SAND/WATER/DIRT branches do — output depends only on
`shade` (FR-016).

## `src/sim/save.ts`, `src/sim/historySave.ts` (extended — read-side tolerance, FR-028)

```ts
// Both files' per-kind loop inside deserializeWorld / deserializeHistory, changed identically:
for (const kind of OBJECT_KINDS) {
  const list = rawByKind[kind];
  const rawList = Array.isArray(list) ? list : []; // was: if (!Array.isArray(list)) return null;
  const objectsForKind: PlacedObject[] = [];
  for (const item of rawList) {
    if (!isPlacedObjectShape(item)) return null; // unchanged — a malformed *present* item still rejects
    objectsForKind.push({ id: item.id, kind, x: item.x, y: item.y, size: item.size });
  }
  byKind[kind] = objectsForKind;
}
```

**Contract**:
- A `byKind` missing any of `house`/`person`/`chest` (or, for a genuinely
  pre-upgrade payload, missing all seven keys) deserializes successfully
  with those kinds' lists empty — never `null`.
- A `byKind` entry present as a non-array value, or containing an item that
  fails shape validation, still returns `null` for the whole payload —
  unchanged from today.
- Wire format (JSON shape, field names, base64 codec) is otherwise
  byte-for-byte unchanged; no `SAVE_VERSION`/`HISTORY_DEPTH` bump is implied
  by this fix.

## `src/sim/history.ts`, `src/sim/resize.ts`, `PlayArea.svelte`'s `repositionObjects` (unchanged)

**Contract**: No signature or behavior change. `captureWorldState`/
`restoreWorldState`/`remapWorldState`/`resizeGrid`/`repositionObjects` all
iterate `OBJECT_KINDS` (now length 7) or operate generically on `elements`/
`colorAux` by index — both already correct for `DIAMOND` and the three new
kinds with zero edits (research.md §12, data-model.md "Amended:
`ObjectKind`").
