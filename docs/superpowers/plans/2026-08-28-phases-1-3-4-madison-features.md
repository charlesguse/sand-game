# Phases 1, 3, 4 — Pink Water, Gumdrops, Palm Trees Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the game Madison's — pink water and her name on it — then add gumdrops and swaying palm trees.

**Architecture:** Task 1 extracts the color ramps out of `PlayArea.svelte` into a pure, testable `src/lib/palette.ts` with no behavior change. Task 2 recolors water and retitles. Task 3 adds a `GUMDROP` element that falls straight down (no diagonal spread) so it heaps steeply instead of flowing flat like sand. Task 4 makes `ObjectsState` a record keyed by `ObjectKind` and adds palm trees, whose trunks stamp real grid cells while their fronds sway in the render layer only.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vite + `vite-plugin-singlefile`, vitest (node environment, no DOM).

## Global Constraints

Copied verbatim from `.specify/memory/constitution.md`. Every task's requirements implicitly include these.

- **Single self-contained `index.html`.** No external network requests at runtime. Must work from `file://`. No new runtime dependencies.
- **Playable without reading.** Controls are big, colorful, emoji-labeled buttons. **Toolbar glyphs must be emoji-presentation codepoints** — a text-presentation dingbat renders as a flat monochrome symbol. This bit us once already (`⛶` → `📺`) and bit upstream once (`🩷` → `💗`, commit 71c4b86).
- **No failure states.** No scores, no timers. Nothing she does is ever "wrong". A control that does nothing when pressed is a failure state.
- **Works with mouse *and* touch.** Touch targets respect `MIN_TOUCH_TARGET` via `--control-min`; reuse the `.control` class.
- **Performance is a feature.** 60fps target, ≥30fps floor. **The per-cell hot loop (`step.ts`, `render()`) must stay allocation-free**, and must not gain per-cell property-name indirection.
- **Verifiable without a browser harness.** CI has no browser. Plain vitest, `node` environment. **Never add browser-automation test infrastructure** (no jsdom, happy-dom, playwright, @testing-library). Do not modify `vitest.config.ts`.
- **Keep the element set small.** New element types require a spec — `GUMDROP` is specified here and is the only new element.

## Deliberate deviations from the spec

Both are recorded here so reviewers judge them as decisions, not oversights.

1. **The spec's `moveCell`/`swapCells` field-list refactor is NOT being done.** Replacing 13 inline assignments with a loop over field names introduces megamorphic property access into the hottest code in the project, against the performance principle. Task 3 instead adds a contract test that sets every per-cell field to a distinct value, moves a cell, and asserts all fields transferred — catching the same "forgot a field" bug class at zero runtime cost.
2. **The spec's keyed `ObjectsState` refactor IS being done** (Task 4), because it is not in a hot loop and adding a third object kind otherwise means editing four separate call sites.

---

### Task 1: Extract the palette into a pure module

Pure refactor. **No behavior change** — colors must be byte-identical afterward.

**Files:**
- Create: `src/lib/palette.ts`
- Modify: `src/lib/PlayArea.svelte` (remove the ramp constants, `hslToRgb`, and `colorFor`; import them instead)
- Test: `tests/unit/lib/palette.test.ts` (create)

**Interfaces:**
- Consumes: element constants from `src/sim/types`
- Produces — later tasks rely on these exact signatures:
  - `export type Rgb = [number, number, number];`
  - `export function hslToRgb(h: number, s: number, l: number): Rgb`
  - `export function colorFor(element: number, shade: number, hue: number, isCloud: boolean): Rgb`

- [ ] **Step 1: Write the characterization test**

Create `tests/unit/lib/palette.test.ts`. These assertions pin the CURRENT colors so the refactor cannot silently change them:

```ts
import { describe, it, expect } from 'vitest';
import { colorFor, hslToRgb } from '../../../src/lib/palette';
import { SAND, WATER, DIRT, RAINBOW_SAND, GRASS, STAR_POWER, FOG, EMPTY } from '../../../src/sim/types';

describe('colorFor — existing elements are unchanged by the extraction', () => {
  it('renders sand as the hot-pink ramp', () => {
    expect(colorFor(SAND, 0, 0, false)).toEqual([255, 214, 232]);
    expect(colorFor(SAND, 4, 0, false)).toEqual([255, 105, 180]);
  });

  it('renders magic dirt as the purple ramp', () => {
    expect(colorFor(DIRT, 0, 0, false)).toEqual([230, 200, 255]);
  });

  it('wraps the shade index rather than reading past the ramp', () => {
    expect(colorFor(SAND, 8, 0, false)).toEqual(colorFor(SAND, 0, 0, false));
    expect(colorFor(SAND, 9, 0, false)).toEqual(colorFor(SAND, 1, 0, false));
  });

  it('spreads rainbow sand continuously by hue', () => {
    expect(colorFor(RAINBOW_SAND, 0, 0, false)).not.toEqual(colorFor(RAINBOW_SAND, 0, 128, false));
  });

  it('distinguishes cloud fog from ground fog', () => {
    expect(colorFor(FOG, 0, 0, true)).not.toEqual(colorFor(FOG, 0, 0, false));
  });

  it('falls back to white for an unknown element', () => {
    expect(colorFor(EMPTY, 0, 0, false)).toEqual([255, 255, 255]);
  });

  it('gives grass and star power their own ramps', () => {
    expect(colorFor(GRASS, 0, 0, false)).not.toEqual(colorFor(SAND, 0, 0, false));
    expect(colorFor(STAR_POWER, 0, 0, false)).not.toEqual(colorFor(SAND, 0, 0, false));
  });
});

describe('hslToRgb', () => {
  it('converts primary hues', () => {
    expect(hslToRgb(0, 1, 0.5)).toEqual([255, 0, 0]);
    expect(hslToRgb(120, 1, 0.5)).toEqual([0, 255, 0]);
    expect(hslToRgb(240, 1, 0.5)).toEqual([0, 0, 255]);
  });

  it('returns grey when saturation is zero', () => {
    const [r, g, b] = hslToRgb(200, 0, 0.5);
    expect(r).toBe(g);
    expect(g).toBe(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/lib/palette.test.ts`
Expected: FAIL — `Failed to resolve import "../../../src/lib/palette"`.

- [ ] **Step 3: Create the module by MOVING code**

Create `src/lib/palette.ts`. **Move** — do not retype — the seven ramp constants (`PINK_RAMP`, `BLUE_RAMP`, `PURPLE_RAMP`, `GREEN_RAMP`, `GOLD_RAMP`, `CLOUD_RAMP`, `FOG_RAMP`), the `hslToRgb` function, and the `colorFor` function out of `src/lib/PlayArea.svelte` and into it. Copy the values exactly; a single transposed digit will fail the characterization test.

The module's shape:

```ts
import { SAND, WATER, DIRT, RAINBOW_SAND, GRASS, STAR_POWER, FOG } from '../sim/types';

export type Rgb = [number, number, number];

const PINK_RAMP: Rgb[] = [ /* moved verbatim from PlayArea.svelte */ ];
// ...the other six ramps, moved verbatim...

/** Converts a 0-360 hue angle at fixed saturation/lightness to RGB, for a continuous rainbow spread. */
export function hslToRgb(h: number, s: number, l: number): Rgb { /* moved verbatim */ }

export function colorFor(element: number, shade: number, hue: number, isCloud: boolean): Rgb {
  /* moved verbatim */
}
```

In `src/lib/PlayArea.svelte`, delete the moved code and add the import:

```ts
  import { colorFor } from './palette';
```

Leave `render()` and every other line of `PlayArea.svelte` untouched. Remove any element-constant imports in `PlayArea.svelte` that become unused (`noUnusedLocals` is on and the build will fail otherwise) — but keep every constant `render()` still references.

- [ ] **Step 4: Run the tests and the build**

Run: `npm test && npm run build`
Expected: all tests pass including the new palette file; build succeeds. If any pre-existing test changed behavior, the move was not faithful — fix the ramp values rather than the test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/palette.ts src/lib/PlayArea.svelte tests/unit/lib/palette.test.ts
git commit -m "refactor: extract color palette into a testable module"
```

---

### Task 2: Pink water and Madison's name

**Files:**
- Modify: `src/lib/palette.ts` (rename `BLUE_RAMP` → `WATER_RAMP`, new values)
- Modify: `index.html` (title)
- Modify: `README.md` (heading and first paragraph)
- Test: `tests/unit/lib/palette.test.ts` (extend), `tests/unit/shell/indexHtml.test.ts` (extend)

**Interfaces:**
- Consumes: `colorFor` from Task 1
- Produces: nothing new

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/lib/palette.test.ts`:

```ts
describe('water is pink, and readable as its own element', () => {
  it('renders water in the pink family, not blue', () => {
    for (let shade = 0; shade < 6; shade++) {
      const [r, g, b] = colorFor(WATER, shade, 0, false);
      expect(r).toBeGreaterThan(b);
      expect(r).toBeGreaterThan(g);
    }
  });

  it('stays lighter than sand at the same shade, so the two pinks read apart', () => {
    for (let shade = 0; shade < 6; shade++) {
      const water = colorFor(WATER, shade, 0, false);
      const sand = colorFor(SAND, shade, 0, false);
      const lightness = (c: number[]) => c[0] + c[1] + c[2];
      expect(lightness(water)).toBeGreaterThan(lightness(sand));
    }
  });

  it('never renders the same colour as sand at the same shade', () => {
    for (let shade = 0; shade < 6; shade++) {
      expect(colorFor(WATER, shade, 0, false)).not.toEqual(colorFor(SAND, shade, 0, false));
    }
  });
});
```

Add `WATER` to that file's existing import from `../../../src/sim/types` if it is not already there.

Append to `tests/unit/shell/indexHtml.test.ts` — this also closes a deferred finding from Phase 0, where the Home Screen name and the page title disagreed:

```ts
describe('the game is named for Madison', () => {
  it('names her in the page title', () => {
    expect(html).toMatch(/<title>[^<]*Madison[^<]*<\/title>/);
  });

  it('uses the same name for the Home Screen icon as for the page', () => {
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    const appTitle = html.match(/name="apple-mobile-web-app-title"[^>]*content="([^"]*)"/)?.[1] ?? '';
    expect(appTitle.length).toBeGreaterThan(0);
    expect(title).toContain(appTitle);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/lib/palette.test.ts tests/unit/shell/indexHtml.test.ts`
Expected: FAIL — water is still blue (`r > b` fails), and the title still reads "Rainbow Sand".

- [ ] **Step 3: Recolor the water**

In `src/lib/palette.ts`, rename `BLUE_RAMP` to `WATER_RAMP` (update its use inside `colorFor`) and replace its values with this rose ramp. It is deliberately lighter and less saturated than `PINK_RAMP` so pink water and pink sand stay distinguishable:

```ts
const WATER_RAMP: Rgb[] = [
  [255, 245, 250],
  [255, 236, 246],
  [254, 226, 241],
  [252, 214, 235],
  [250, 201, 229],
  [246, 186, 221],
];
```

- [ ] **Step 4: Put her name on it**

In `index.html`, change the title line to:

```html
    <title>🌈 Madison's Sand 🦄</title>
```

The existing `apple-mobile-web-app-title` is already `Madison's Sand`, so the two now agree.

In `README.md`, change the first heading and opening sentence to:

```markdown
# 🌈 Madison's Sand 🦄

A falling-sand toy for Madison, who is almost 5 and likes rainbows, unicorns,
sparkles, poodles and the colour pink. Draw with pink sand, pour pink water,
sprinkle magic purple dirt, and watch rainbows and unicorns do fun things.
```

Leave the rest of the README — including the upstream credit and the iPad setup
section — exactly as it is.

- [ ] **Step 5: Run the tests and the build**

Run: `npm test && npm run build`
Expected: all pass, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/lib/palette.ts index.html README.md tests/unit/lib/palette.test.ts tests/unit/shell/indexHtml.test.ts
git commit -m "feat: pink water, and the game is Madison's now"
```

---

### Task 3: Gumdrops

A candy that falls and heaps steeply instead of flowing flat.

**Files:**
- Modify: `src/sim/types.ts` (add `GUMDROP`, extend `Element` and `Tool`)
- Modify: `src/sim/element.ts` (`isSolid`)
- Modify: `src/sim/step.ts` (add a gumdrop branch)
- Modify: `src/sim/brush.ts` (paint gumdrops)
- Modify: `src/lib/palette.ts` (candy colors)
- Modify: `src/lib/Toolbar.svelte` (🍬 button)
- Test: `tests/unit/sim/gumdrop.test.ts` (create), `tests/unit/sim/cellFields.test.ts` (create)

**Interfaces:**
- Consumes: `colorFor` (Task 1), `setCell` from `src/sim/grid`
- Produces: `export const GUMDROP = 9;` in `src/sim/types.ts`; `'gumdrop'` added to the `Tool` union

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/sim/gumdrop.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createGrid, setCell } from '../../../src/sim/grid';
import { step } from '../../../src/sim/step';
import { EMPTY, GUMDROP, SAND, type Grid } from '../../../src/sim/types';

function at(grid: Grid, x: number, y: number): number {
  return grid.elements[y * grid.width + x];
}

function settle(grid: Grid, steps: number): void {
  for (let i = 0; i < steps; i++) step(grid);
}

describe('gumdrops fall', () => {
  it('falls straight down through empty space', () => {
    const grid = createGrid(9, 9);
    setCell(grid, 4, 0, GUMDROP, 0);
    step(grid);
    expect(at(grid, 4, 0)).toBe(EMPTY);
    expect(at(grid, 4, 1)).toBe(GUMDROP);
  });

  it('comes to rest on the floor', () => {
    const grid = createGrid(9, 9);
    setCell(grid, 4, 0, GUMDROP, 0);
    settle(grid, 30);
    expect(at(grid, 4, 8)).toBe(GUMDROP);
  });

  it('stacks on top of another gumdrop instead of displacing it', () => {
    const grid = createGrid(9, 9);
    setCell(grid, 4, 8, GUMDROP, 0);
    setCell(grid, 4, 0, GUMDROP, 0);
    settle(grid, 30);
    expect(at(grid, 4, 8)).toBe(GUMDROP);
    expect(at(grid, 4, 7)).toBe(GUMDROP);
  });
});

describe('gumdrops heap instead of flowing flat', () => {
  it('keeps a tall column standing, where sand would collapse into a dune', () => {
    const gumdrops = createGrid(11, 11);
    for (let y = 4; y <= 10; y++) setCell(gumdrops, 5, y, GUMDROP, 0);
    settle(gumdrops, 60);

    const sand = createGrid(11, 11);
    for (let y = 4; y <= 10; y++) setCell(sand, 5, y, SAND, 0);
    settle(sand, 60);

    const columnHeight = (grid: Grid, element: number) => {
      let count = 0;
      for (let y = 0; y < grid.height; y++) if (at(grid, 5, y) === element) count++;
      return count;
    };

    expect(columnHeight(gumdrops, GUMDROP)).toBe(7);
    expect(columnHeight(sand, SAND)).toBeLessThan(7);
  });

  it('does not slide off the side of a pile', () => {
    const grid = createGrid(11, 11);
    setCell(grid, 5, 10, GUMDROP, 0);
    setCell(grid, 5, 9, GUMDROP, 0);
    settle(grid, 40);
    expect(at(grid, 4, 10)).toBe(EMPTY);
    expect(at(grid, 6, 10)).toBe(EMPTY);
    expect(at(grid, 5, 9)).toBe(GUMDROP);
  });
});

describe('gumdrops are candy-coloured', () => {
  it('gives gumdrops a hue so a poured handful is multicoloured', () => {
    const grid = createGrid(9, 9);
    setCell(grid, 1, 0, GUMDROP, 0);
    setCell(grid, 5, 0, GUMDROP, 0);
    expect(grid.hues[0 * grid.width + 1]).toBeGreaterThanOrEqual(0);
    expect(grid.hues[0 * grid.width + 5]).toBeGreaterThanOrEqual(0);
  });
});
```

Create `tests/unit/sim/cellFields.test.ts`. This is the guard that replaces the spec's hot-loop refactor — it fails the moment someone adds a per-cell field and forgets to copy it in `moveCell`:

```ts
import { describe, it, expect } from 'vitest';
import { createGrid } from '../../../src/sim/grid';
import { step } from '../../../src/sim/step';
import { GUMDROP } from '../../../src/sim/types';

/**
 * Every per-cell typed array on the Grid. When a new field is added to Grid,
 * add it here — this list is the contract moveCell/swapCells must honour.
 */
const PER_CELL_FIELDS = [
  'shades', 'hues', 'glitter', 'grassHeight', 'grassCooldown',
  'starPowerAge', 'starPowerLife', 'starPowerFuelled', 'cloud',
  'fogRiseCooldown', 'fogStuckSteps', 'fogAge', 'cloudRainDelay',
] as const;

describe('the Grid per-cell field list is complete', () => {
  it('names every typed array on the grid except elements and moved', () => {
    const grid = createGrid(4, 4);
    const actual = Object.keys(grid)
      .filter((k) => ArrayBuffer.isView((grid as never)[k]))
      .filter((k) => k !== 'elements' && k !== 'moved')
      .sort();
    expect(actual).toEqual([...PER_CELL_FIELDS].sort());
  });
});

describe('moving a cell carries its per-cell state with it', () => {
  it('transfers every per-cell field and clears the source', () => {
    const grid = createGrid(5, 5);
    const from = 0 * grid.width + 2;

    grid.elements[from] = GUMDROP;
    for (const field of PER_CELL_FIELDS) grid[field][from] = 7;

    step(grid);

    const to = 1 * grid.width + 2;
    expect(grid.elements[to]).toBe(GUMDROP);
    for (const field of PER_CELL_FIELDS) {
      expect({ field, value: grid[field][to] }).toEqual({ field, value: 7 });
      expect({ field, value: grid[field][from] }).toEqual({ field, value: 0 });
    }
  });
});
```

Note the `hues` assertion: gumdrops advance no hue on move (only `RAINBOW_SAND` does), so 7 must survive the move unchanged.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/sim/gumdrop.test.ts tests/unit/sim/cellFields.test.ts`
Expected: FAIL — `GUMDROP` is not exported from `types`.

- [ ] **Step 3: Add the element**

In `src/sim/types.ts`, after `export const FOG = 8;`:

```ts
export const GUMDROP = 9;
```

Add `| typeof GUMDROP` to the `Element` union, and `| 'gumdrop'` to the `Tool` union.

In `src/sim/element.ts`, make gumdrops solid so other elements rest on them — add `GUMDROP` to the import and change `isSolid`:

```ts
export function isSolid(e: number): boolean {
  return isPowder(e) || e === GRASS || e === STAR_POWER || e === GUMDROP;
}
```

Do **not** add `GUMDROP` to `isPowder` — powders flow diagonally, and heaping steeply is the whole point of this element.

- [ ] **Step 4: Make gumdrops fall**

In `src/sim/step.ts`, add `GUMDROP` to the import from `./types`, then add this function next to `stepPowder`:

```ts
/**
 * Gumdrops fall straight down and stop. Unlike powders they never slide
 * diagonally, so a poured handful heaps up steeply into a candy pile
 * instead of collapsing into a flat dune.
 */
function stepGumdrop(grid: Grid, x: number, y: number, i: number): void {
  const { width, height, elements } = grid;
  const belowY = y + 1;
  if (belowY >= height) return;

  const belowIndex = belowY * width + x;
  if (elements[belowIndex] === EMPTY) {
    moveCell(grid, i, belowIndex);
    return;
  }
  if (isLiquid(elements[belowIndex]) || elements[belowIndex] === FOG) {
    swapCells(grid, i, belowIndex);
  }
}
```

Then dispatch to it in the main per-cell loop, alongside the existing element branches. Read the loop's existing structure and follow it exactly — the `moved` flag guard and iteration order are load-bearing, so add a branch in the same shape as the powder and liquid branches rather than restructuring anything.

- [ ] **Step 5: Let her paint them**

In `src/sim/brush.ts`, add `GUMDROP` to the import from `./types`, and add a branch to `paintCell` alongside the others:

```ts
  } else if (tool === 'gumdrop' && (paintable || current === WATER)) {
    setCell(grid, x, y, GUMDROP, shade);
```

Gumdrops need a candy hue. Find where the brush assigns a hue for rainbow sand (or where `randomHue` is used for a painted cell) and follow that same pattern for `GUMDROP` so each painted gumdrop gets its own colour. If no such pattern exists in `brush.ts`, set it directly after the `setCell` call:

```ts
    grid.hues[y * grid.width + x] = randomHue();
```

importing `randomHue` from `./shade`.

- [ ] **Step 6: Colour them**

In `src/lib/palette.ts`, add a fixed candy palette and a `colorFor` branch. A small fixed set reads as distinct sweets, where a continuous hue spread would look like rainbow sand:

```ts
const GUMDROP_COLORS: Rgb[] = [
  [244, 63, 148],
  [255, 138, 76],
  [255, 214, 74],
  [122, 214, 122],
  [96, 178, 245],
  [176, 122, 240],
];
```

and inside `colorFor`, before the fallback:

```ts
  if (element === GUMDROP) return GUMDROP_COLORS[hue % GUMDROP_COLORS.length];
```

Import `GUMDROP` from `../sim/types`.

- [ ] **Step 7: Add the toolbar button**

In `src/lib/Toolbar.svelte`, add a button to the `elements` group, following the exact shape of the existing element buttons:

```svelte
    <button
      class="control"
      class:selected={tool === 'gumdrop'}
      aria-label="Gumdrops"
      onclick={() => onSelectTool('gumdrop')}
    >
      🍬
    </button>
```

`🍬` (U+1F36C) is emoji-presentation by default — it renders in colour with no variation selector, per the global constraint.

- [ ] **Step 8: Run the tests and the build**

Run: `npm test && npm run build`
Expected: all pass — the new gumdrop and cell-field tests plus every pre-existing test. Build succeeds.

Then confirm the single-file principle:

Run: `grep -cE '(src|href)="https?://' dist/index.html`
Expected: `0`.

- [ ] **Step 9: Commit**

```bash
git add src/sim/types.ts src/sim/element.ts src/sim/step.ts src/sim/brush.ts src/lib/palette.ts src/lib/Toolbar.svelte tests/unit/sim/gumdrop.test.ts tests/unit/sim/cellFields.test.ts
git commit -m "feat: add gumdrops that heap into candy piles"
```

---

### Task 4: Swaying palm trees

**Files:**
- Modify: `src/sim/types.ts` (`ObjectKind`, `ObjectsState`, `Tool`)
- Modify: `src/sim/objects.ts` (keyed record)
- Modify: `src/lib/PlayArea.svelte` (glyph map, sway, reposition, render)
- Modify: `src/lib/Toolbar.svelte` (🌴 button)
- Test: `tests/unit/sim/palm.test.ts` (create)

**Interfaces:**
- Consumes: `placeObject`, `removeObject` from `src/sim/objects.ts`
- Produces: `ObjectsState` becomes `{ byKind: Record<ObjectKind, PlacedObject[]>; nextId: number }`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/sim/palm.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createGrid } from '../../../src/sim/grid';
import { createObjectsState, placeObject } from '../../../src/sim/objects';
import { step } from '../../../src/sim/step';
import { OBJECT, SAND, EMPTY, type Grid } from '../../../src/sim/types';

function at(grid: Grid, x: number, y: number): number {
  return grid.elements[y * grid.width + x];
}

describe('palm trees are placeable objects', () => {
  it('stamps an OBJECT footprint into the grid', () => {
    const grid = createGrid(40, 40);
    const state = createObjectsState();
    placeObject(grid, state, 'palm', 20, 20);
    expect(state.byKind.palm).toHaveLength(1);
    expect(at(grid, 20, 20)).toBe(OBJECT);
  });

  it('keeps its own cap of 3 without evicting rainbows or unicorns', () => {
    const grid = createGrid(60, 60);
    const state = createObjectsState();
    placeObject(grid, state, 'rainbow', 10, 10);
    placeObject(grid, state, 'unicorn', 20, 10);
    for (let i = 0; i < 5; i++) placeObject(grid, state, 'palm', 10 + i * 8, 40);
    expect(state.byKind.palm).toHaveLength(3);
    expect(state.byKind.rainbow).toHaveLength(1);
    expect(state.byKind.unicorn).toHaveLength(1);
  });

  it('gives every object a unique id across all kinds', () => {
    const grid = createGrid(60, 60);
    const state = createObjectsState();
    placeObject(grid, state, 'palm', 10, 10);
    placeObject(grid, state, 'rainbow', 30, 10);
    placeObject(grid, state, 'unicorn', 10, 40);
    const ids = Object.values(state.byKind).flat().map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('sand piles against a palm trunk', () => {
  it('does not fall through the trunk', () => {
    const grid = createGrid(40, 40);
    const state = createObjectsState();
    placeObject(grid, state, 'palm', 20, 30);
    const trunkTop = state.byKind.palm[0].y;
    grid.elements[(trunkTop - 1) * grid.width + 20] = SAND;
    for (let i = 0; i < 20; i++) step(grid);
    expect(at(grid, 20, trunkTop)).toBe(OBJECT);
    expect(at(grid, 20, trunkTop - 1)).not.toBe(EMPTY);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/sim/palm.test.ts`
Expected: FAIL — `'palm'` is not a valid `ObjectKind` and `state.byKind` does not exist.

- [ ] **Step 3: Make ObjectsState keyed**

In `src/sim/types.ts`:

```ts
export type ObjectKind = 'rainbow' | 'unicorn' | 'palm';

export interface ObjectsState {
  byKind: Record<ObjectKind, PlacedObject[]>;
  nextId: number;
}
```

Add `| 'palm'` to the `Tool` union.

In `src/sim/objects.ts`:

```ts
export const OBJECT_KINDS: ObjectKind[] = ['rainbow', 'unicorn', 'palm'];

export function createObjectsState(): ObjectsState {
  return { byKind: { rainbow: [], unicorn: [], palm: [] }, nextId: 0 };
}

function listFor(state: ObjectsState, kind: ObjectKind): PlacedObject[] {
  return state.byKind[kind];
}

function isCoveredByAnyObject(state: ObjectsState, px: number, py: number): boolean {
  for (const kind of OBJECT_KINDS) {
    for (const o of state.byKind[kind]) {
      if (px >= o.x && px < o.x + o.size && py >= o.y && py < o.y + o.size) return true;
    }
  }
  return false;
}
```

Then update every remaining reference to `state.rainbows` / `state.unicorns` in that file to go through `state.byKind`. `applyRainbowConversions` keeps taking a `PlacedObject[]` — its signature does not change.

- [ ] **Step 4: Update the call sites**

`state.rainbows` and `state.unicorns` are also read in `src/lib/PlayArea.svelte` (repositioning on resize, rendering glyphs, the unicorn burst timers, and the wand). Update each to `state.byKind.rainbow` / `state.byKind.unicorn`. Search for both names and fix every hit — the build will fail on any you miss, which is the intended safety net.

Also check `src/sim/scenes.ts`, `src/sim/history.ts`, `src/sim/resize.ts` and `src/sim/wand.ts` for the same two property names and update them the same way.

- [ ] **Step 5: Add the palm glyph and its sway**

In `src/lib/PlayArea.svelte`, extend the glyph map:

```ts
  const OBJECT_GLYPHS: Record<string, string> = { rainbow: '🌈', unicorn: '🦄', palm: '🌴' };
```

Replace `drawObjectGlyph` so palms sway. Pivot at the base of the trunk so it bends like a tree rather than spinning like a pinwheel, and offset each tree's phase by its id so a row ripples instead of moving in lockstep:

```ts
  const PALM_SWAY_RADIANS = 0.06;
  const PALM_SWAY_SPEED = 0.0011;

  function drawObjectGlyph(obj: { id: number; kind: string; x: number; y: number; size: number }): void {
    ctx.font = `${obj.size}px sans-serif`;
    const cx = obj.x + obj.size / 2;
    const cy = obj.y + obj.size / 2;

    if (obj.kind !== 'palm') {
      ctx.fillText(OBJECT_GLYPHS[obj.kind], cx, cy);
      return;
    }

    const baseY = obj.y + obj.size;
    const angle = Math.sin(lastFrameNow * PALM_SWAY_SPEED + obj.id) * PALM_SWAY_RADIANS;
    ctx.save();
    ctx.translate(cx, baseY);
    ctx.rotate(angle);
    ctx.fillText(OBJECT_GLYPHS[obj.kind], 0, cy - baseY);
    ctx.restore();
  }
```

In `render()`, replace the two explicit loops over rainbows and unicorns with one over every kind, so palms draw too:

```ts
    for (const kind of OBJECT_KINDS) {
      for (const obj of objectsState.byKind[kind]) drawObjectGlyph(obj);
    }
```

importing `OBJECT_KINDS` from `../sim/objects`.

`ctx.save()`/`ctx.restore()` here are per-object, not per-cell — with at most 9 objects on screen this is nowhere near the hot loop and does not threaten the frame budget.

- [ ] **Step 6: Let her place them**

In `src/lib/PlayArea.svelte`, find the branch `if (tool === 'rainbow' || tool === 'unicorn')` and include palms so they route through the same placement path:

```ts
    if (tool === 'rainbow' || tool === 'unicorn' || tool === 'palm') {
```

In `src/lib/Toolbar.svelte`, add a button to the `objects` group next to the rainbow and unicorn:

```svelte
    <button
      class="control"
      class:selected={tool === 'palm'}
      aria-label="Palm tree"
      onclick={() => onSelectTool('palm')}
    >
      🌴
    </button>
```

- [ ] **Step 7: Run the tests and the build**

Run: `npm test && npm run build`
Expected: all pass, including every pre-existing objects/scenes/history/resize/wand test. Those suites are the real check that the keyed-record change did not break rainbows or unicorns — if any fail, the migration missed a call site.

Run: `grep -cE '(src|href)="https?://' dist/index.html`
Expected: `0`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add swaying palm trees, and key objects by kind"
```

---

## Verification

```bash
npm test && npm run build
```

Expected: all tests pass; `dist/index.html` emitted as a single file with zero external references.

**Maintainer eyeball checks** (the constitution assigns visual verification to review time):

1. Pink water next to pink sand — are they clearly different materials? If they read as the same pink, the `WATER_RAMP` needs to go lighter or cooler. This is the single most likely thing to need tuning.
2. Gumdrops heap into steep candy piles rather than flat dunes, and a poured handful is multicoloured.
3. Palm trees sway gently, pivot at the trunk base, and a row of them ripples rather than moving in lockstep.
4. Sand piles against a palm trunk.
5. All four new buttons (🍬 🌴 and the existing set) render in colour on the iPad, not as flat monochrome glyphs.
