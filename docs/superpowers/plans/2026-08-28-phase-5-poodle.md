# Phase 5 — The Poodle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Madison a poodle that trots to where she touches, eats gumdrops, shakes off water, grooms sand into rainbow, and digs itself out when buried.

**Architecture:** A poodle is deliberately **not** a grid element. Moving creatures in a cellular automaton are miserable — double-stepping, `moved`-flag bookkeeping, partial updates. Instead a new `src/sim/pets.ts` owns a short list of poodle entities, each with a position, a state and a timer, stepped once per frame *after* `step(grid)`. It reads the grid to find the ground and writes to it to groom, dig and eat. At most three exist, so the per-frame cost is negligible and it never touches the per-cell hot loop. It is pure logic with no DOM, so every behaviour is unit-testable.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vite + `vite-plugin-singlefile`, vitest (node environment, no DOM).

## Global Constraints

Copied verbatim from `.specify/memory/constitution.md`. Every task's requirements implicitly include these.

- **Single self-contained `index.html`.** No external network requests at runtime. Must work from `file://`. No new runtime dependencies.
- **Playable without reading.** Controls are big, colourful, emoji-labeled buttons. **Toolbar glyphs must be emoji-presentation codepoints** — a text-presentation dingbat renders flat and monochrome. This has bitten this project twice (`⛶`→`📺`, and upstream's `🩷`→`💗`).
- **No failure states.** No scores, no timers, nothing she does is ever "wrong". The poodle must never get permanently stuck, never vanish unexpectedly, and never show an error.
- **Works with mouse *and* touch.** Reuse the existing `.control` class.
- **Performance is a feature.** 60fps target, ≥30fps floor. **Nothing in this plan may enter the per-cell hot loop** in `step.ts` or the per-pixel loop in `render()`. Pet stepping is per-entity, capped at 3.
- **Verifiable without a browser harness.** CI has no browser. Plain vitest, `node` environment. **Never add browser-automation test infrastructure.** Do not modify `vitest.config.ts`.
- **Keep the element set small.** This phase adds **no new grid elements**.
- TypeScript is `strict` with `noUnusedLocals` and `noUnusedParameters`.

## Design decisions made up front

Recorded so reviewers judge them as decisions, not oversights.

1. **Poodles are excluded from undo/redo.** `history.ts` snapshots the grid and placed objects. Poodles are live agents, not drawn content — undo teleporting the dog backwards would be baffling rather than useful. Their *effects* on the grid (grooming, digging, eating) are ordinary grid state and are captured by existing snapshots for free. `captureWorldState` / `restoreWorldState` / `worldMatches` must **not** be extended to cover pets.
2. **Poodles are entities, not objects.** They do not go in `ObjectsState.byKind` and do not stamp an `OBJECT` footprint. Sand falls through where a poodle stands; the poodle walks on the surface rather than being a solid obstacle. This keeps the sim simple and keeps her from being able to wall herself in.
3. **Particles stay in the render layer.** `pets.ts` is pure and returns no visual effects. The renderer reads poodle `state` each frame and spawns sparkles accordingly, the same way unicorn bursts already work.

---

### Task 1: The poodle module — standing, trotting, and the state machine

**Files:**
- Create: `src/sim/pets.ts`
- Test: `tests/unit/sim/pets.test.ts` (create)

**Interfaces:**
- Consumes: `Grid` and element constants from `src/sim/types`; `isSolid` from `src/sim/element`
- Produces — every later task and the UI rely on these exact signatures:
  - `export type PoodleState = 'idle' | 'trotting' | 'eating' | 'shaking' | 'digging';`
  - `export interface Poodle { readonly id: number; x: number; y: number; facing: 1 | -1; state: PoodleState; timer: number; soggy: boolean; }`
  - `export interface PetsState { poodles: Poodle[]; nextId: number; }`
  - `export const POODLE_CAP = 3;`
  - `export function createPetsState(): PetsState`
  - `export function addPoodle(state: PetsState, x: number, y: number): void`
  - `export function stepPets(grid: Grid, pets: PetsState, target: { x: number; y: number } | null): void`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/sim/pets.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createGrid, setCell } from '../../../src/sim/grid';
import { createPetsState, addPoodle, stepPets, POODLE_CAP } from '../../../src/sim/pets';
import { SAND, type Grid } from '../../../src/sim/types';

/** Fills the bottom `depth` rows with sand, giving the poodle a floor to stand on. */
function withFloor(width: number, height: number, depth: number): Grid {
  const grid = createGrid(width, height);
  for (let y = height - depth; y < height; y++) {
    for (let x = 0; x < width; x++) setCell(grid, x, y, SAND, 0);
  }
  return grid;
}

function run(grid: Grid, pets: ReturnType<typeof createPetsState>, target: { x: number; y: number } | null, frames: number): void {
  for (let i = 0; i < frames; i++) stepPets(grid, pets, target);
}

describe('placing poodles', () => {
  it('adds a poodle at the requested position', () => {
    const pets = createPetsState();
    addPoodle(pets, 12, 5);
    expect(pets.poodles).toHaveLength(1);
    expect(pets.poodles[0].x).toBeCloseTo(12);
  });

  it('caps the pack and evicts the oldest', () => {
    const pets = createPetsState();
    for (let i = 0; i < POODLE_CAP + 2; i++) addPoodle(pets, i * 3, 5);
    expect(pets.poodles).toHaveLength(POODLE_CAP);
    expect(pets.poodles[0].x).toBeCloseTo(6);
  });

  it('gives every poodle a unique id', () => {
    const pets = createPetsState();
    for (let i = 0; i < POODLE_CAP; i++) addPoodle(pets, i * 3, 5);
    const ids = pets.poodles.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('standing on the ground', () => {
  it('falls until it rests on the surface', () => {
    const grid = withFloor(40, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 20, 2);
    run(grid, pets, null, 60);
    expect(pets.poodles[0].y).toBeCloseTo(31, 0);
  });

  it('stays on the surface once settled', () => {
    const grid = withFloor(40, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 20, 2);
    run(grid, pets, null, 60);
    const settled = pets.poodles[0].y;
    run(grid, pets, null, 30);
    expect(pets.poodles[0].y).toBeCloseTo(settled, 0);
  });

  it('never falls out of the world when there is no ground', () => {
    const grid = createGrid(40, 40);
    const pets = createPetsState();
    addPoodle(pets, 20, 2);
    run(grid, pets, null, 200);
    expect(pets.poodles[0].y).toBeLessThanOrEqual(39);
    expect(pets.poodles[0].y).toBeGreaterThanOrEqual(0);
  });
});

describe('trotting toward where she touched', () => {
  it('walks toward a target to its right', () => {
    const grid = withFloor(60, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 10, 30);
    run(grid, pets, null, 20);
    const startX = pets.poodles[0].x;
    run(grid, pets, { x: 50, y: 31 }, 60);
    expect(pets.poodles[0].x).toBeGreaterThan(startX);
  });

  it('walks toward a target to its left', () => {
    const grid = withFloor(60, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 50, 30);
    run(grid, pets, null, 20);
    const startX = pets.poodles[0].x;
    run(grid, pets, { x: 10, y: 31 }, 60);
    expect(pets.poodles[0].x).toBeLessThan(startX);
  });

  it('faces the way it is walking', () => {
    const grid = withFloor(60, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 30, 30);
    run(grid, pets, { x: 55, y: 31 }, 30);
    expect(pets.poodles[0].facing).toBe(1);
    run(grid, pets, { x: 5, y: 31 }, 30);
    expect(pets.poodles[0].facing).toBe(-1);
  });

  it('stops when it arrives instead of jittering across the target', () => {
    const grid = withFloor(60, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 30, 30);
    run(grid, pets, { x: 40, y: 31 }, 200);
    expect(Math.abs(pets.poodles[0].x - 40)).toBeLessThanOrEqual(2);
  });

  it('is trotting while it walks and idle once it arrives', () => {
    const grid = withFloor(60, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 10, 30);
    run(grid, pets, { x: 40, y: 31 }, 20);
    expect(pets.poodles[0].state).toBe('trotting');
    run(grid, pets, { x: 40, y: 31 }, 300);
    expect(pets.poodles[0].state).toBe('idle');
  });

  it('climbs a low step rather than stalling against it', () => {
    const grid = withFloor(60, 40, 8);
    for (let y = 30; y < 32; y++) {
      for (let x = 30; x < 34; x++) setCell(grid, x, y, SAND, 0);
    }
    const pets = createPetsState();
    addPoodle(pets, 20, 30);
    run(grid, pets, null, 20);
    run(grid, pets, { x: 45, y: 29 }, 200);
    expect(pets.poodles[0].x).toBeGreaterThan(34);
  });

  it('does nothing alarming with no target', () => {
    const grid = withFloor(60, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 30, 30);
    run(grid, pets, null, 100);
    expect(pets.poodles[0].state).toBe('idle');
    expect(Number.isFinite(pets.poodles[0].x)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/sim/pets.test.ts`
Expected: FAIL — `Failed to resolve import "../../../src/sim/pets"`.

- [ ] **Step 3: Write the module**

Create `src/sim/pets.ts`:

```ts
import { isSolid } from './element';
import { type Grid } from './types';

export type PoodleState = 'idle' | 'trotting' | 'eating' | 'shaking' | 'digging';

export interface Poodle {
  readonly id: number;
  x: number;
  y: number;
  facing: 1 | -1;
  state: PoodleState;
  timer: number;
  soggy: boolean;
}

export interface PetsState {
  poodles: Poodle[];
  nextId: number;
}

/** At most three poodles; placing a fourth retires the oldest. */
export const POODLE_CAP = 3;

/** Frames between footsteps. Low enough to feel responsive, high enough to read as a trot. */
const STEP_INTERVAL = 4;
/** How many cells the poodle can step up in one stride before it must go around. */
const MAX_CLIMB = 2;
/** Horizontal distance within which the poodle considers itself arrived. */
const ARRIVE_DISTANCE = 1.5;

export function createPetsState(): PetsState {
  return { poodles: [], nextId: 0 };
}

export function addPoodle(state: PetsState, x: number, y: number): void {
  if (state.poodles.length >= POODLE_CAP) state.poodles.shift();
  state.poodles.push({
    id: state.nextId++,
    x,
    y,
    facing: 1,
    state: 'idle',
    timer: 0,
    soggy: false,
  });
}

function cellIsSolid(grid: Grid, x: number, y: number): boolean {
  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return false;
  return isSolid(grid.elements[y * grid.width + x]);
}

/**
 * The y the poodle should stand at for a given column: resting on top of the
 * first solid cell at or below its current height, or the floor if there is none.
 */
function groundBelow(grid: Grid, x: number, fromY: number): number {
  const col = Math.round(x);
  for (let y = Math.max(0, Math.floor(fromY)); y < grid.height; y++) {
    if (cellIsSolid(grid, col, y)) return y - 1;
  }
  return grid.height - 1;
}

/** Advances one poodle by one frame. Allocation-free. */
function stepPoodle(grid: Grid, poodle: Poodle, target: { x: number; y: number } | null): void {
  if (poodle.timer > 0) {
    poodle.timer--;
    if (poodle.timer === 0) poodle.state = 'idle';
    return;
  }

  poodle.y = groundBelow(grid, poodle.x, poodle.y);

  if (target === null) {
    poodle.state = 'idle';
    return;
  }

  const dx = target.x - poodle.x;
  if (Math.abs(dx) <= ARRIVE_DISTANCE) {
    poodle.state = 'idle';
    return;
  }

  poodle.facing = dx > 0 ? 1 : -1;
  poodle.state = 'trotting';

  if (poodle.id % STEP_INTERVAL !== stride % STEP_INTERVAL) return;

  const nextX = poodle.x + poodle.facing;
  if (nextX < 0 || nextX > grid.width - 1) {
    poodle.state = 'idle';
    return;
  }

  const nextY = groundBelow(grid, nextX, Math.max(0, poodle.y - MAX_CLIMB));
  if (poodle.y - nextY > MAX_CLIMB) {
    poodle.state = 'idle';
    return;
  }

  poodle.x = nextX;
  poodle.y = nextY;
}

let stride = 0;

export function stepPets(grid: Grid, pets: PetsState, target: { x: number; y: number } | null): void {
  stride++;
  for (const poodle of pets.poodles) stepPoodle(grid, poodle, target);
}
```

**Note on the `stride` gate:** the expression `poodle.id % STEP_INTERVAL !== stride % STEP_INTERVAL` is what makes the poodle take a step every `STEP_INTERVAL` frames rather than sprinting one cell per frame, while staggering different poodles so a pack does not move in lockstep. If you find a cleaner way to express that which keeps both properties and passes the tests, use it — but do not remove the rate limit, and do not use a module-level mutable that would break if two grids ran at once. Prefer moving `stride` onto `PetsState` if that reads better; if you do, update the interface in your report so later tasks know.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/sim/pets.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: 382 pre-existing plus your 13, all passing. Nothing else touches `pets.ts` yet, so any pre-existing failure means something unrelated broke.

- [ ] **Step 6: Commit**

```bash
git add src/sim/pets.ts tests/unit/sim/pets.test.ts
git commit -m "feat: add the poodle, who stands on the ground and trots to a target"
```

---

### Task 2: Put the poodle in the game

Wires the module to the UI. **No automated test** — this is Svelte component code, and the constitution forbids adding browser test infrastructure. Task 1 covers the logic.

**Files:**
- Modify: `src/sim/types.ts` (`Tool` union)
- Modify: `src/lib/Toolbar.svelte` (🐩 button)
- Modify: `src/lib/PlayArea.svelte` (state, frame loop, placement, render)

**Interfaces:**
- Consumes: everything Task 1 produced

- [ ] **Step 1: Add the tool**

In `src/sim/types.ts`, add `| 'poodle'` to the `Tool` union.

- [ ] **Step 2: Add the button**

In `src/lib/Toolbar.svelte`, add to the `objects` group next to the palm tree:

```svelte
    <button
      class="control"
      class:selected={tool === 'poodle'}
      aria-label="Poodle"
      onclick={() => onSelectTool('poodle')}
    >
      🐩
    </button>
```

`🐩` (U+1F429) is emoji-presentation by default.

- [ ] **Step 3: Hold the pets state and a touch target**

In `src/lib/PlayArea.svelte`'s script block, alongside the existing `objectsState`:

```ts
  import { createPetsState, addPoodle, stepPets } from '../sim/pets';

  const petsState = createPetsState();
  let poodleTarget: { x: number; y: number } | null = null;
```

- [ ] **Step 4: Step the pets each frame**

In `frame(now)`, immediately **after** the existing `step(grid);` call:

```ts
    stepPets(grid, petsState, poodleTarget);
```

Order matters: the grid settles first, then the poodle reads the settled surface. Do not move it before `step(grid)`.

- [ ] **Step 5: Place poodles, and set the target from her touch**

Find the placement branch `if (tool === 'rainbow' || tool === 'unicorn' || tool === 'palm')` and add a separate branch for the poodle before or after it — poodles are entities, not objects, so they must **not** route through `placeObject`:

```ts
    if (tool === 'poodle') {
      addPoodle(petsState, gridX, gridY);
      return;
    }
```

Use whatever local variables that function already has for the pointer's grid coordinates — read the surrounding code and match it rather than inventing new names.

Then, wherever a pointer down/move updates drawing position, also record the target so the poodle follows her finger regardless of which tool is selected:

```ts
    poodleTarget = { x: gridX, y: gridY };
```

- [ ] **Step 6: Draw the poodle**

In `render()`, after the object glyphs are drawn and before the particle loop, add:

```ts
    for (const poodle of petsState.poodles) {
      ctx.save();
      ctx.translate(poodle.x * cellSize, poodle.y * cellSize);
      if (poodle.facing === -1) ctx.scale(-1, 1);
      ctx.fillText('🐩', 0, 0);
      ctx.restore();
    }
```

`cellSize` is whatever the file already uses to convert grid coordinates to canvas pixels — read `render()` and the resize code and use the existing name and convention. Set `ctx.font` for the poodle the same way `drawObjectGlyph` does, sized so the poodle reads as a similar scale to the unicorn. The `scale(-1, 1)` is what makes it face the way it walks.

This loop is per-entity (at most three), outside the per-pixel loop, so it does not affect the frame budget.

- [ ] **Step 7: Verify**

Run: `npm test && npm run build`
Expected: all tests pass; build succeeds.

Run: `grep -cE '(src|href)="https?://' dist/index.html`
Expected: `0`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: put the poodle in the game, following her finger"
```

---

### Task 3: The poodle eats gumdrops

A gumdrop within range outranks her finger — dropping one is how she steers the dog.

**Files:**
- Modify: `src/sim/pets.ts`
- Test: `tests/unit/sim/pets.test.ts` (extend)

**Interfaces:**
- Produces: `export const GUMDROP_SCENT_RADIUS = 25;`

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/sim/pets.test.ts` (add `GUMDROP` and `EMPTY` to the `types` import, and `GUMDROP_SCENT_RADIUS` to the `pets` import):

```ts
describe('chasing gumdrops', () => {
  it('walks toward a gumdrop instead of her finger', () => {
    const grid = withFloor(80, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 40, 30);
    run(grid, pets, null, 20);
    setCell(grid, 20, 31, GUMDROP, 0);
    run(grid, pets, { x: 70, y: 31 }, 120);
    expect(pets.poodles[0].x).toBeLessThan(40);
  });

  it('eats the gumdrop when it arrives', () => {
    const grid = withFloor(80, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 30, 30);
    run(grid, pets, null, 20);
    setCell(grid, 24, 31, GUMDROP, 0);
    run(grid, pets, null, 300);
    expect(grid.elements[31 * grid.width + 24]).toBe(EMPTY);
  });

  it('is in the eating state just after a gumdrop goes', () => {
    const grid = withFloor(80, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 30, 30);
    run(grid, pets, null, 20);
    setCell(grid, 27, 31, GUMDROP, 0);
    let sawEating = false;
    for (let i = 0; i < 300; i++) {
      stepPets(grid, pets, null);
      if (pets.poodles[0].state === 'eating') sawEating = true;
    }
    expect(sawEating).toBe(true);
  });

  it('ignores a gumdrop far outside its range', () => {
    const grid = withFloor(200, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 100, 30);
    run(grid, pets, null, 20);
    setCell(grid, 100 - (GUMDROP_SCENT_RADIUS + 20), 31, GUMDROP, 0);
    const startX = pets.poodles[0].x;
    run(grid, pets, null, 60);
    expect(pets.poodles[0].x).toBeCloseTo(startX, 0);
  });

  it('goes back to following her finger once the sweets are gone', () => {
    const grid = withFloor(80, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 30, 30);
    run(grid, pets, null, 20);
    setCell(grid, 26, 31, GUMDROP, 0);
    run(grid, pets, { x: 70, y: 31 }, 400);
    expect(pets.poodles[0].x).toBeGreaterThan(40);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/sim/pets.test.ts -t "chasing gumdrops"`
Expected: FAIL — `GUMDROP_SCENT_RADIUS` is not exported and the poodle ignores gumdrops.

- [ ] **Step 3: Implement**

In `src/sim/pets.ts`:

```ts
/** How far a poodle can smell a gumdrop, in cells. */
export const GUMDROP_SCENT_RADIUS = 25;
/** Frames spent happily eating. */
const EAT_DURATION = 20;
/** Horizontal distance at which the poodle can reach a gumdrop. */
const EAT_REACH = 2;
```

Add a scan that finds the nearest gumdrop. Search only the band the poodle could plausibly reach — do **not** scan the whole grid every frame:

```ts
/**
 * Nearest gumdrop within scent range, or -1 if none. Scans a bounded window
 * around the poodle rather than the whole grid, so cost does not grow with
 * canvas size.
 */
function nearestGumdropX(grid: Grid, poodle: Poodle): number {
  const cx = Math.round(poodle.x);
  const cy = Math.round(poodle.y);
  let bestX = -1;
  let bestDist = Infinity;

  const minX = Math.max(0, cx - GUMDROP_SCENT_RADIUS);
  const maxX = Math.min(grid.width - 1, cx + GUMDROP_SCENT_RADIUS);
  const minY = Math.max(0, cy - GUMDROP_SCENT_RADIUS);
  const maxY = Math.min(grid.height - 1, cy + GUMDROP_SCENT_RADIUS);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (grid.elements[y * grid.width + x] !== GUMDROP) continue;
      const dist = Math.abs(x - cx) + Math.abs(y - cy);
      if (dist < bestDist) {
        bestDist = dist;
        bestX = x;
      }
    }
  }
  return bestDist <= GUMDROP_SCENT_RADIUS ? bestX : -1;
}
```

In `stepPoodle`, after the timer check and the ground settle, before the finger-target logic: look for a gumdrop. If one is within `EAT_REACH` horizontally, clear that cell (search the column around the poodle's feet for the `GUMDROP` cell and set it to `EMPTY`), set `state = 'eating'` and `timer = EAT_DURATION`, and return. Otherwise, if one is in range, use its x as the movement target in place of `target`.

Import `GUMDROP` and `EMPTY` from `./types`.

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/sim/pets.ts tests/unit/sim/pets.test.ts
git commit -m "feat: the poodle chases and eats gumdrops"
```

---

### Task 4: Soggy, and the shake

**Files:**
- Modify: `src/sim/pets.ts`
- Test: `tests/unit/sim/pets.test.ts` (extend)

- [ ] **Step 1: Write the failing tests**

Append (add `WATER` to the `types` import):

```ts
describe('getting wet', () => {
  it('becomes soggy after walking through water', () => {
    const grid = withFloor(60, 40, 8);
    for (let x = 25; x < 35; x++) setCell(grid, x, 31, WATER, 0);
    const pets = createPetsState();
    addPoodle(pets, 20, 30);
    run(grid, pets, null, 20);
    let sawSoggy = false;
    for (let i = 0; i < 300; i++) {
      stepPets(grid, pets, { x: 45, y: 31 });
      if (pets.poodles[0].soggy || pets.poodles[0].state === 'shaking') sawSoggy = true;
    }
    expect(sawSoggy).toBe(true);
  });

  it('shakes itself dry and carries on', () => {
    const grid = withFloor(60, 40, 8);
    for (let x = 25; x < 35; x++) setCell(grid, x, 31, WATER, 0);
    const pets = createPetsState();
    addPoodle(pets, 20, 30);
    run(grid, pets, null, 20);
    run(grid, pets, { x: 55, y: 31 }, 600);
    expect(pets.poodles[0].soggy).toBe(false);
    expect(pets.poodles[0].state).not.toBe('shaking');
  });

  it('stays dry when it never meets water', () => {
    const grid = withFloor(60, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 20, 30);
    run(grid, pets, { x: 45, y: 31 }, 200);
    expect(pets.poodles[0].soggy).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/sim/pets.test.ts -t "getting wet"`
Expected: FAIL — the poodle never becomes soggy.

- [ ] **Step 3: Implement**

Add to `src/sim/pets.ts`:

```ts
/** Frames spent shaking off water. */
const SHAKE_DURATION = 30;
```

In `stepPoodle`, after settling to the ground: if the cell at the poodle's feet — or the one just below it — is `WATER`, set `poodle.soggy = true`. Then, before the gumdrop and finger logic, if `poodle.soggy` **and** the poodle is no longer standing in water, set `state = 'shaking'`, `timer = SHAKE_DURATION`, `soggy = false`, and return. Shaking must not begin while still in the water, or the poodle would shake forever in a pond — that is the "never permanently stuck" constraint.

Import `WATER` from `./types`.

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/sim/pets.ts tests/unit/sim/pets.test.ts
git commit -m "feat: the poodle gets soggy and shakes itself dry"
```

---

### Task 5: Grooming and digging

**Files:**
- Modify: `src/sim/pets.ts`
- Test: `tests/unit/sim/pets.test.ts` (extend)

- [ ] **Step 1: Write the failing tests**

Append (add `RAINBOW_SAND` to the `types` import):

```ts
describe('grooming as it goes', () => {
  it('turns the sand it walks over into rainbow sand', () => {
    const grid = withFloor(60, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 15, 30);
    run(grid, pets, null, 20);
    run(grid, pets, { x: 45, y: 31 }, 400);

    let rainbow = 0;
    for (let x = 15; x <= 45; x++) {
      if (grid.elements[31 * grid.width + x] === RAINBOW_SAND) rainbow++;
    }
    expect(rainbow).toBeGreaterThan(0);
  });

  it('leaves sand it never walked over alone', () => {
    const grid = withFloor(60, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 15, 30);
    run(grid, pets, null, 20);
    run(grid, pets, { x: 25, y: 31 }, 200);
    expect(grid.elements[31 * grid.width + 55]).toBe(SAND);
  });
});

describe('digging out', () => {
  it('digs its way up when buried', () => {
    const grid = withFloor(60, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 30, 30);
    run(grid, pets, null, 20);
    for (let y = 24; y <= 31; y++) setCell(grid, 30, y, SAND, 0);
    pets.poodles[0].y = 30;

    let sawDigging = false;
    for (let i = 0; i < 200; i++) {
      stepPets(grid, pets, null);
      if (pets.poodles[0].state === 'digging') sawDigging = true;
    }
    expect(sawDigging).toBe(true);
    expect(pets.poodles[0].y).toBeLessThanOrEqual(31);
  });

  it('ends up somewhere it can stand, not stuck inside the sand', () => {
    const grid = withFloor(60, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 30, 30);
    run(grid, pets, null, 20);
    for (let y = 24; y <= 31; y++) setCell(grid, 30, y, SAND, 0);
    pets.poodles[0].y = 30;
    run(grid, pets, null, 400);
    const i = Math.round(pets.poodles[0].y) * grid.width + Math.round(pets.poodles[0].x);
    expect(grid.elements[i]).not.toBe(SAND);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/sim/pets.test.ts -t "grooming as it goes"`
Expected: FAIL — no rainbow sand appears.

- [ ] **Step 3: Implement**

Add to `src/sim/pets.ts`:

```ts
/** Frames spent per scoop when digging out. */
const DIG_DURATION = 3;
```

**Digging** takes priority over everything except an active timer. In `stepPoodle`, before settling to the ground: if the cell the poodle occupies is solid, it is buried — clear that cell (set it to `EMPTY`), move the poodle up one row, set `state = 'digging'` and `timer = DIG_DURATION`, and return. Repeated frames dig it out one scoop at a time, which is what makes the second test terminate.

**Grooming** happens while trotting. After a successful step to a new cell, look at the cell directly beneath the poodle's feet: if it is `SAND`, set it to `RAINBOW_SAND` and give it a fresh hue via `randomHue()` from `./shade`. Only plain `SAND` grooms — leave dirt, grass, gumdrops and water alone.

Import `RAINBOW_SAND` from `./types` and `randomHue` from `./shade`.

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/sim/pets.ts tests/unit/sim/pets.test.ts
git commit -m "feat: the poodle grooms sand into rainbow and digs itself out"
```

---

### Task 6: Sparkles, and clearing the pack

The visual payoff, plus making sure the poodles obey clear-all.

**Files:**
- Modify: `src/sim/pets.ts` (a `clearPets` helper)
- Modify: `src/lib/PlayArea.svelte` (particles by state; clear-all; scene loads)
- Test: `tests/unit/sim/pets.test.ts` (extend)

**Interfaces:**
- Produces: `export function clearPets(state: PetsState): void`

- [ ] **Step 1: Write the failing test**

Append:

```ts
describe('clearing the pack', () => {
  it('removes every poodle', () => {
    const pets = createPetsState();
    addPoodle(pets, 10, 5);
    addPoodle(pets, 20, 5);
    clearPets(pets);
    expect(pets.poodles).toHaveLength(0);
  });

  it('keeps handing out fresh ids afterwards', () => {
    const pets = createPetsState();
    addPoodle(pets, 10, 5);
    const firstId = pets.poodles[0].id;
    clearPets(pets);
    addPoodle(pets, 10, 5);
    expect(pets.poodles[0].id).not.toBe(firstId);
  });
});
```

Add `clearPets` to the `pets` import at the top of the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/sim/pets.test.ts -t "clearing the pack"`
Expected: FAIL — `clearPets` is not exported.

- [ ] **Step 3: Implement `clearPets`**

```ts
/** Sends every poodle home. `nextId` keeps counting so ids stay unique. */
export function clearPets(state: PetsState): void {
  state.poodles.length = 0;
}
```

- [ ] **Step 4: Wire it to clear-all and scene loads**

In `src/lib/PlayArea.svelte`, find `clearAll()` and `loadScene()` and call `clearPets(petsState)` in each, next to wherever objects are cleared. A poodle left trotting on a freshly cleared canvas would be a surprise.

- [ ] **Step 5: Spawn the sparkles**

In `render()`, in the poodle loop, before drawing each glyph:

```ts
      if (poodle.state === 'eating') {
        spawnBurst(particles, poodle.x * cellSize, poodle.y * cellSize, lastFrameNow, 4);
      } else if (poodle.state === 'shaking') {
        spawnBurst(particles, poodle.x * cellSize, poodle.y * cellSize, lastFrameNow, 2);
      } else if (poodle.state === 'trotting' && Math.random() < 0.08) {
        spawnIdleSparkle(particles, poodle.x * cellSize, poodle.y * cellSize, lastFrameNow);
      }
```

`spawnBurst` and `spawnIdleSparkle` are already imported in this file for the unicorn and wand effects — reuse them rather than adding new particle code. The `spawnBurst` helper already caps the particle array, so this cannot grow without bound.

The `Math.random() < 0.08` gate on trotting is what makes pawprint sparkles occasional rather than a solid stream.

- [ ] **Step 6: Verify**

Run: `npm test && npm run build`
Expected: all pass; build succeeds.

Run: `grep -cE '(src|href)="https?://' dist/index.html`
Expected: `0`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: poodle sparkles, and clear-all sends the pack home"
```

---

## Verification

```bash
npm test && npm run build
```

Expected: all tests pass; `dist/index.html` emitted as a single file with zero external references.

**Maintainer eyeball checks** (the constitution assigns visual verification to review time):

1. Place a poodle — it lands on the ground and trots toward wherever you touch.
2. It faces the direction it is walking.
3. Drop gumdrops — it abandons your finger and goes for the sweets, then sparkles as it eats.
4. Walk it through water — it comes out and shakes, and does not shake forever while standing in the pond.
5. Sand it walks over turns rainbow behind it.
6. Bury it under a pile — it digs out rather than staying stuck.
7. Clear-all removes the poodles along with everything else.
8. Three poodles at once still holds 60fps.
