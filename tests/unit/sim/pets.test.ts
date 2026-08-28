import { describe, it, expect } from 'vitest';
import { createGrid, setCell } from '../../../src/sim/grid';
import { createPetsState, addPoodle, stepPets, POODLE_CAP, GUMDROP_SCENT_RADIUS } from '../../../src/sim/pets';
import { SAND, GUMDROP, EMPTY, type Grid } from '../../../src/sim/types';

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
});
