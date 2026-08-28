import { describe, it, expect } from 'vitest';
import { createGrid, setCell } from '../../../src/sim/grid';
import {
  createPetsState,
  addPoodle,
  stepPets,
  clearPets,
  repositionPoodles,
  POODLE_CAP,
  GUMDROP_SCENT_RADIUS,
} from '../../../src/sim/pets';
import { SAND, GUMDROP, EMPTY, WATER, RAINBOW_SAND, type Grid } from '../../../src/sim/types';

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

  it('does not get stuck beneath a gumdrop it cannot reach, on a tall mound', () => {
    const grid = withFloor(80, 40, 8);
    // A steep pillar rising well above the poodle's resting height (row 31),
    // with its top surface at row 19 — 12 cells taller than the floor.
    for (let y = 20; y < 32; y++) {
      for (let x = 38; x < 43; x++) setCell(grid, x, y, SAND, 0);
    }
    const pets = createPetsState();
    addPoodle(pets, 30, 30);
    run(grid, pets, null, 20);
    setCell(grid, 40, 19, GUMDROP, 0);
    // Finger target is well away from the mound, in the opposite direction.
    run(grid, pets, { x: 5, y: 31 }, 400);
    expect(pets.poodles[0].x).toBeLessThan(20);
  });

  it('does not get stuck against a wall taller than it can climb, with a gumdrop at its own height beyond it', () => {
    const grid = withFloor(80, 40, 8);
    // A fence at the poodle's own standing height: solid from row 24 to the
    // base floor, at columns 40-41 — far taller than MAX_CLIMB (2), and the
    // ground stays level (row 31) on both sides.
    for (let y = 24; y < 32; y++) {
      for (let x = 40; x < 42; x++) setCell(grid, x, y, SAND, 0);
    }
    const pets = createPetsState();
    addPoodle(pets, 30, 30);
    run(grid, pets, null, 20);
    // Gumdrop past the fence, at the same height as the poodle.
    setCell(grid, 50, 31, GUMDROP, 0);
    // Finger target is on the poodle's own side, away from the fence.
    run(grid, pets, { x: 5, y: 31 }, 600);
    expect(pets.poodles[0].x).toBeLessThan(20);
  });

  it('pursues a gumdrop well more than EAT_SEARCH_HEIGHT rows above it, on a reachable staircase', () => {
    const grid = withFloor(80, 40, 8);
    // A staircase rising in MAX_CLIMB-sized (2-row) steps, so every step is
    // climbable, topping out 6 rows above the poodle's resting height (31) —
    // well past the old EAT_SEARCH_HEIGHT (3) cap, but comfortably inside
    // GUMDROP_SCENT_RADIUS.
    const steps = [
      { x0: 32, x1: 34, top: 30 },
      { x0: 34, x1: 36, top: 28 },
      { x0: 36, x1: 38, top: 26 },
    ];
    for (const { x0, x1, top } of steps) {
      for (let y = top; y < 40; y++) {
        for (let x = x0; x < x1; x++) setCell(grid, x, y, SAND, 0);
      }
    }
    const pets = createPetsState();
    addPoodle(pets, 30, 30);
    run(grid, pets, null, 20);
    // Gumdrop atop the tallest step: 7 columns away, 6 rows above.
    setCell(grid, 37, 25, GUMDROP, 0);
    run(grid, pets, null, 500);
    expect(grid.elements[25 * grid.width + 37]).toBe(EMPTY);
  });

  it('does not get stuck in a pit exactly as deep as its vertical scent range', () => {
    const grid = withFloor(80, 40, 8);
    // A pit with a climbable shelf on the entry side (a 1-cell step down from
    // the normal row-31 surface, then a further 2-cell drop to the pit floor
    // — each step within MAX_CLIMB) but a sheer far wall (a 3-cell rise,
    // unclimbable) toward the gumdrop. Falling in and climbing back out the
    // way she came stays possible; reaching the far side does not.
    setCell(grid, 40, 32, EMPTY, 0); // shelf: rest y=32, one step down from 31
    for (let y = 32; y <= 34; y++) {
      for (let x = 41; x < 45; x++) setCell(grid, x, y, EMPTY, 0); // pit floor: rest y=34
    }
    const pets = createPetsState();
    addPoodle(pets, 30, 30);
    run(grid, pets, null, 20);
    // Gumdrop on the original surface height, past the far (unclimbable) wall.
    setCell(grid, 50, 31, GUMDROP, 0);
    // Finger target is back on the poodle's own side.
    run(grid, pets, { x: 5, y: 31 }, 800);
    expect(pets.poodles[0].x).toBeLessThan(20);
  });
});

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

describe('grooming as it goes', () => {
  // withFloor(60, 40, 8) fills rows 32-39 with SAND; groundBelow rests the
  // poodle one row *above* the first solid cell (confirmed by the "stays on
  // the surface" test above, which settles to y≈31 against this same floor).
  // So row 31 is the poodle's own standing row (always empty) and row 32 is
  // the actual sand surface under its feet — the row grooming acts on and
  // the row these assertions check.
  it('turns the sand it walks over into rainbow sand', () => {
    const grid = withFloor(60, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 15, 30);
    run(grid, pets, null, 20);
    run(grid, pets, { x: 45, y: 31 }, 400);

    let rainbow = 0;
    for (let x = 15; x <= 45; x++) {
      if (grid.elements[32 * grid.width + x] === RAINBOW_SAND) rainbow++;
    }
    expect(rainbow).toBeGreaterThan(0);
  });

  it('leaves sand it never walked over alone', () => {
    const grid = withFloor(60, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 15, 30);
    run(grid, pets, null, 20);
    run(grid, pets, { x: 25, y: 31 }, 200);
    expect(grid.elements[32 * grid.width + 55]).toBe(SAND);
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

  it('never dips below y = 0 even buried in a full-height column', () => {
    const grid = withFloor(60, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 30, 30);
    run(grid, pets, null, 20);
    // A column solid from the very top of the grid down through the floor.
    for (let y = 0; y <= 31; y++) setCell(grid, 30, y, SAND, 0);
    pets.poodles[0].y = 30;
    for (let i = 0; i < 300; i++) {
      stepPets(grid, pets, null);
      expect(pets.poodles[0].y).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('a gumdrop at her own cell', () => {
  it('gets eaten rather than dug out', () => {
    const grid = withFloor(60, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 30, 30);
    run(grid, pets, null, 20);
    const x = Math.round(pets.poodles[0].x);
    const y = Math.round(pets.poodles[0].y);
    setCell(grid, x, y, GUMDROP, 0);
    stepPets(grid, pets, null);
    expect(pets.poodles[0].state).toBe('eating');
    expect(grid.elements[y * grid.width + x]).toBe(EMPTY);
  });
});

describe('repositioning on resize', () => {
  it('shifts every poodle by the same offset the grid content gets', () => {
    const pets = createPetsState();
    addPoodle(pets, 20, 15);
    addPoodle(pets, 30, 10);
    const newGrid = createGrid(80, 40);
    repositionPoodles(pets.poodles, newGrid, 10, 5);
    expect(pets.poodles[0].x).toBeCloseTo(30);
    expect(pets.poodles[0].y).toBeCloseTo(20);
    expect(pets.poodles[1].x).toBeCloseTo(40);
    expect(pets.poodles[1].y).toBeCloseTo(15);
  });

  it('clamps a poodle back inside the new grid rather than dropping it', () => {
    const pets = createPetsState();
    addPoodle(pets, 5, 5);
    const newGrid = createGrid(40, 20);
    // An offset that would push her well outside the new, smaller grid.
    repositionPoodles(pets.poodles, newGrid, -20, -20);
    expect(pets.poodles).toHaveLength(1);
    expect(pets.poodles[0].x).toBeGreaterThanOrEqual(0);
    expect(pets.poodles[0].x).toBeLessThan(40);
    expect(pets.poodles[0].y).toBeGreaterThanOrEqual(0);
    expect(pets.poodles[0].y).toBeLessThan(20);
  });

  it('clamps against the far edge too, not just zero', () => {
    const pets = createPetsState();
    addPoodle(pets, 35, 15);
    const newGrid = createGrid(20, 10);
    repositionPoodles(pets.poodles, newGrid, 20, 20);
    expect(pets.poodles[0].x).toBeLessThanOrEqual(newGrid.width - 1);
    expect(pets.poodles[0].y).toBeLessThanOrEqual(newGrid.height - 1);
  });
});

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
