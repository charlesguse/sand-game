import { describe, it, expect } from 'vitest';
import { createGrid, setCell } from '../../../src/sim/grid';
import {
  createPetsState,
  addMermaid,
  stepPets,
  stepMermaids,
  pokeMermaidAt,
  MERMAID_CAP,
} from '../../../src/sim/pets';
import { POKE_RADIUS } from '../../../src/sim/pets';
import { SAND, GUMDROP, ICE_CREAM, WATER, EMPTY, type Grid } from '../../../src/sim/types';

function run(grid: Grid, pets: ReturnType<typeof createPetsState>, frames: number): void {
  for (let i = 0; i < frames; i++) stepPets(grid, pets, null);
}

/** Fills the bottom `depth` rows with sand, giving a mermaid a floor to rest on. */
function withFloor(width: number, height: number, depth: number): Grid {
  const grid = createGrid(width, height);
  for (let y = height - depth; y < height; y++) {
    for (let x = 0; x < width; x++) setCell(grid, x, y, SAND, 0);
  }
  return grid;
}

/** A rectangular pool of water, floored underneath so a drained pool has somewhere to settle. */
function withPool(width: number, height: number, x0: number, x1: number, y0: number, y1: number, floorDepth: number): Grid {
  const grid = withFloor(width, height, floorDepth);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) setCell(grid, x, y, WATER, 0);
  }
  return grid;
}

describe('placing mermaids', () => {
  it('places directly on a water cell she is dropped on', () => {
    const grid = withPool(40, 40, 10, 20, 20, 25, 8);
    const pets = createPetsState();
    addMermaid(grid, pets, 15, 22);
    expect(pets.mermaids).toHaveLength(1);
    expect(grid.elements[Math.round(pets.mermaids[0].y) * grid.width + Math.round(pets.mermaids[0].x)]).toBe(WATER);
  });

  it('caps the pack and evicts the oldest', () => {
    const grid = withPool(60, 40, 5, 55, 10, 15, 8);
    const pets = createPetsState();
    for (let i = 0; i < MERMAID_CAP + 2; i++) addMermaid(grid, pets, 6 + i * 5, 12);
    expect(pets.mermaids).toHaveLength(MERMAID_CAP);
  });

  it('never exceeds MERMAID_CAP however many are placed', () => {
    const grid = withPool(80, 40, 5, 75, 10, 15, 8);
    const pets = createPetsState();
    for (let i = 0; i < 10; i++) addMermaid(grid, pets, 6 + i * 6, 12);
    expect(pets.mermaids.length).toBeLessThanOrEqual(MERMAID_CAP);
  });

  it('gives every mermaid a unique id', () => {
    const grid = withPool(60, 40, 5, 55, 10, 15, 8);
    const pets = createPetsState();
    for (let i = 0; i < MERMAID_CAP; i++) addMermaid(grid, pets, 6 + i * 5, 12);
    const ids = pets.mermaids.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('placement snapping and no-water resting', () => {
  it('snaps onto the nearest water cell of a pool when placed a few cells away on dry land', () => {
    const grid = withPool(60, 40, 20, 30, 20, 25, 8);
    const pets = createPetsState();
    setCell(grid, 15, 22, SAND, 0);
    addMermaid(grid, pets, 15, 22);
    const mermaid = pets.mermaids[0];
    expect(grid.elements[Math.round(mermaid.y) * grid.width + Math.round(mermaid.x)]).toBe(WATER);
    expect(mermaid.state).toBe('drifting');
  });

  it('rests at the ground when there is no water anywhere, and stays put', () => {
    const grid = withFloor(60, 40, 8);
    const pets = createPetsState();
    addMermaid(grid, pets, 30, 5);
    expect(pets.mermaids[0].state).toBe('resting');
    const before = { x: pets.mermaids[0].x, y: pets.mermaids[0].y };
    run(grid, pets, 200);
    expect(pets.mermaids[0].x).toBeCloseTo(before.x);
    expect(pets.mermaids[0].y).toBeCloseTo(before.y);
    expect(pets.mermaids[0].state).toBe('resting');
  });

  it('starts swimming once water is painted under a resting mermaid', () => {
    const grid = withFloor(60, 40, 8);
    const pets = createPetsState();
    addMermaid(grid, pets, 30, 5);
    run(grid, pets, 20);
    const mermaid = pets.mermaids[0];
    setCell(grid, Math.round(mermaid.x), Math.round(mermaid.y), WATER, 0);
    stepMermaids(grid, pets);
    expect(mermaid.state).toBe('drifting');
  });
});

describe('swimming confined to her pool', () => {
  it('stays in WATER, inside the original pool, and moves over time', () => {
    const grid = withPool(60, 40, 10, 40, 15, 25, 8);
    const pets = createPetsState();
    addMermaid(grid, pets, 25, 20);
    const mermaid = pets.mermaids[0];
    let moved = false;
    for (let i = 0; i < 400; i++) {
      stepPets(grid, pets, null);
      const x = Math.round(mermaid.x);
      const y = Math.round(mermaid.y);
      expect(grid.elements[y * grid.width + x]).toBe(WATER);
      expect(x).toBeGreaterThanOrEqual(10);
      expect(x).toBeLessThanOrEqual(40);
      expect(y).toBeGreaterThanOrEqual(15);
      expect(y).toBeLessThanOrEqual(25);
      if (x !== 25 || y !== 20) moved = true;
    }
    expect(moved).toBe(true);
  });
});

describe('edge cases: one-cell pool and a pool draining mid-run', () => {
  it('bobs in place in a one-cell-wide pool without a stuck/give-up state', () => {
    const grid = withFloor(40, 40, 8);
    setCell(grid, 20, 20, WATER, 0);
    const pets = createPetsState();
    addMermaid(grid, pets, 20, 20);
    const mermaid = pets.mermaids[0];
    for (let i = 0; i < 200; i++) {
      stepPets(grid, pets, null);
      expect(mermaid.x).toBeCloseTo(20);
      expect(mermaid.y).toBeCloseTo(20);
      expect(mermaid.state).not.toBe('freeing');
    }
  });

  it('settles onto the solid/empty cell below rather than floating when the pool drains mid-run', () => {
    const grid = withPool(40, 40, 10, 30, 20, 25, 8);
    const pets = createPetsState();
    addMermaid(grid, pets, 20, 22);
    run(grid, pets, 60);

    for (let y = 20; y <= 25; y++) {
      for (let x = 10; x <= 30; x++) setCell(grid, x, y, EMPTY, 0);
    }
    run(grid, pets, 200);

    const mermaid = pets.mermaids[0];
    expect(mermaid.state).toBe('resting');
    const belowIndex = (Math.round(mermaid.y) + 1) * grid.width + Math.round(mermaid.x);
    expect(grid.elements[belowIndex]).toBe(SAND);
  });
});

describe('buried mermaids free themselves', () => {
  it('never remains inside solid material, and relocates within a bounded number of frames', () => {
    const grid = withPool(40, 40, 10, 30, 20, 25, 8);
    const pets = createPetsState();
    addMermaid(grid, pets, 20, 22);
    const mermaid = pets.mermaids[0];
    setCell(grid, Math.round(mermaid.x), Math.round(mermaid.y), SAND, 0);

    let sawFreeing = false;
    for (let i = 0; i < 60; i++) {
      stepPets(grid, pets, null);
      if (mermaid.state === 'freeing') sawFreeing = true;
      const x = Math.round(mermaid.x);
      const y = Math.round(mermaid.y);
      expect(grid.elements[y * grid.width + x]).not.toBe(SAND);
    }
    expect(sawFreeing).toBe(true);
  });

  it('escapes burial under a gumdrop or ice cream the same way as under sand', () => {
    for (const element of [GUMDROP, ICE_CREAM]) {
      const grid = withPool(40, 40, 10, 30, 20, 25, 8);
      const pets = createPetsState();
      addMermaid(grid, pets, 20, 22);
      const mermaid = pets.mermaids[0];
      setCell(grid, Math.round(mermaid.x), Math.round(mermaid.y), element, 0);

      for (let i = 0; i < 60; i++) {
        stepPets(grid, pets, null);
        const x = Math.round(mermaid.x);
        const y = Math.round(mermaid.y);
        expect(grid.elements[y * grid.width + x]).not.toBe(element);
      }
    }
  });
});

describe('poking the mermaid', () => {
  it('does a trick when poked within reach', () => {
    const grid = withPool(40, 40, 10, 30, 20, 25, 8);
    const pets = createPetsState();
    addMermaid(grid, pets, 20, 22);
    const mermaid = pets.mermaids[0];
    expect(pokeMermaidAt(pets, mermaid.x + 2, mermaid.y - 2)).toBe(true);
    expect(mermaid.state).toBe('tricking');
    expect(mermaid.timer).toBeGreaterThan(0);
  });

  it('ignores a poke elsewhere (no-op on her state)', () => {
    const grid = withPool(120, 40, 10, 110, 20, 25, 8);
    const pets = createPetsState();
    addMermaid(grid, pets, 20, 22);
    const mermaid = pets.mermaids[0];
    const stateBefore = mermaid.state;
    expect(pokeMermaidAt(pets, mermaid.x + POKE_RADIUS + 10, mermaid.y)).toBe(false);
    expect(mermaid.state).toBe(stateBefore);
    expect(mermaid.timer).toBe(0);
  });

  it('is ignored while she is already busy (timer > 0)', () => {
    const grid = withPool(40, 40, 10, 30, 20, 25, 8);
    const pets = createPetsState();
    addMermaid(grid, pets, 20, 22);
    const mermaid = pets.mermaids[0];
    expect(pokeMermaidAt(pets, mermaid.x, mermaid.y)).toBe(true);
    const timerBefore = mermaid.timer;
    expect(pokeMermaidAt(pets, mermaid.x, mermaid.y)).toBe(false);
    expect(mermaid.state).toBe('tricking');
    expect(mermaid.timer).toBe(timerBefore);
  });

  it('returns false with no mermaids at all', () => {
    const pets = createPetsState();
    expect(pokeMermaidAt(pets, 10, 10)).toBe(false);
  });
});
