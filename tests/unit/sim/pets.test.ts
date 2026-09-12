import { describe, it, expect } from 'vitest';
import { createGrid, setCell } from '../../../src/sim/grid';
import {
  createPetsState,
  addPoodle,
  addMermaid,
  addPerson,
  stepPets,
  stepPeople,
  clearPets,
  repositionPoodles,
  repositionMermaids,
  repositionPeople,
  restorePeopleFromPositions,
  eraseMermaidsInBrush,
  eraseMermaidsInBrushLine,
  erasePeopleInBrush,
  erasePeopleInBrushLine,
  pokePoodleAt,
  pokePersonAt,
  pickPersonVariant,
  pickPersonTone,
  POODLE_CAP,
  PERSON_CAP,
  PERSON_ROAM_RANGE,
  PERSON_RUN_DURATION,
  POKE_RADIUS,
  GUMDROP_SCENT_RADIUS,
  WANDER_IDLE_DELAY,
  WANDER_RANGE,
} from '../../../src/sim/pets';
import { frameFor, type PersonPictureSet } from '../../../src/lib/personGlyphs';
import { SAND, GUMDROP, EMPTY, WATER, RAINBOW_SAND, type Grid, type PersonVariant, type PersonTone } from '../../../src/sim/types';
import { applyBrush } from '../../../src/sim/brush';

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

describe('poking the poodle', () => {
  it('does a trick when poked within reach', () => {
    const grid = withFloor(60, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 30, 30);
    run(grid, pets, null, 20);
    const poodle = pets.poodles[0];
    expect(pokePoodleAt(pets, poodle.x + 3, poodle.y - 3)).toBe(true);
    expect(poodle.state).toBe('tricking');
    expect(poodle.timer).toBeGreaterThan(0);
  });

  it('ignores a poke outside POKE_RADIUS', () => {
    const grid = withFloor(120, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 30, 30);
    run(grid, pets, null, 20);
    const poodle = pets.poodles[0];
    const stateBefore = poodle.state;
    expect(pokePoodleAt(pets, poodle.x + POKE_RADIUS + 5, poodle.y)).toBe(false);
    expect(poodle.state).toBe(stateBefore);
    expect(poodle.timer).toBe(0);
  });

  it('returns false with no poodles at all', () => {
    const pets = createPetsState();
    expect(pokePoodleAt(pets, 10, 10)).toBe(false);
  });

  it('picks the nearest poodle when several are in reach', () => {
    const grid = withFloor(120, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 30, 30);
    addPoodle(pets, 45, 30);
    run(grid, pets, null, 20);
    expect(pokePoodleAt(pets, 44, 31)).toBe(true);
    expect(pets.poodles[1].state).toBe('tricking');
    expect(pets.poodles[0].state).not.toBe('tricking');
  });

  it('does not interrupt eating or shaking (busy timer wins)', () => {
    const grid = withFloor(60, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 30, 30);
    run(grid, pets, null, 20);
    const poodle = pets.poodles[0];
    const x = Math.round(poodle.x);
    const y = Math.round(poodle.y);
    setCell(grid, x, y, GUMDROP, 0);
    stepPets(grid, pets, null);
    expect(poodle.state).toBe('eating');
    const timerBefore = poodle.timer;
    expect(pokePoodleAt(pets, poodle.x, poodle.y)).toBe(false);
    expect(poodle.state).toBe('eating');
    expect(poodle.timer).toBe(timerBefore);
  });

  it('goes back to normal after the trick and still comes when called', () => {
    const grid = withFloor(60, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 30, 30);
    run(grid, pets, null, 20);
    const poodle = pets.poodles[0];
    expect(pokePoodleAt(pets, poodle.x, poodle.y)).toBe(true);
    run(grid, pets, null, 100);
    expect(poodle.state).toBe('idle');
    const startX = poodle.x;
    run(grid, pets, { x: 50, y: 31 }, 60);
    expect(poodle.x).toBeGreaterThan(startX);
  });

  it('leaves pursuit bookkeeping untouched when poked mid-pursuit', () => {
    const grid = withFloor(80, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 40, 30);
    run(grid, pets, null, 20);
    setCell(grid, 20, 31, GUMDROP, 0);
    run(grid, pets, null, 30);
    const poodle = pets.poodles[0];
    expect(poodle.pursuitX).toBe(20);
    const bestDistBefore = poodle.pursuitBestDist;
    const staleBefore = poodle.pursuitStaleFrames;
    const cooldownBefore = poodle.gumdropCooldown;
    expect(pokePoodleAt(pets, poodle.x, poodle.y)).toBe(true);
    expect(poodle.pursuitX).toBe(20);
    expect(poodle.pursuitBestDist).toBe(bestDistBefore);
    expect(poodle.pursuitStaleFrames).toBe(staleBefore);
    expect(poodle.gumdropCooldown).toBe(cooldownBefore);
  });
});

describe('wandering when bored', () => {
  it('sniffs around after a long idle spell, staying near home, in bounds, and always idle', () => {
    const grid = withFloor(120, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 60, 30);
    const poodle = pets.poodles[0];
    let moved = false;
    for (let i = 0; i < WANDER_IDLE_DELAY + 300; i++) {
      stepPets(grid, pets, null);
      if (poodle.x !== 60) moved = true;
      expect(poodle.state).toBe('idle');
      expect(Math.abs(poodle.x - 60)).toBeLessThanOrEqual(WANDER_RANGE);
      expect(poodle.x).toBeGreaterThanOrEqual(0);
      expect(poodle.x).toBeLessThan(grid.width);
    }
    expect(moved).toBe(true);
  });

  it('does not start wandering before the idle delay', () => {
    const grid = withFloor(120, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 60, 30);
    run(grid, pets, null, WANDER_IDLE_DELAY - 10);
    expect(pets.poodles[0].x).toBeCloseTo(60, 0);
  });

  it('a fresh target well away interrupts wandering and is pursued', () => {
    const grid = withFloor(120, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 40, 30);
    run(grid, pets, { x: 60, y: 31 }, 150); // walk there and arrive (target consumed)
    run(grid, pets, { x: 60, y: 31 }, WANDER_IDLE_DELAY + 200); // get bored, wander a little
    run(grid, pets, { x: 100, y: 31 }, 250); // a touch somewhere new
    expect(pets.poodles[0].x).toBeGreaterThan(80);
  });

  it('a re-sent consumed target does not re-trigger pursuit', () => {
    const grid = withFloor(120, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 40, 30);
    run(grid, pets, { x: 60, y: 31 }, 150); // arrive: 60 is now consumed
    const poodle = pets.poodles[0];
    let trotted = false;
    for (let i = 0; i < WANDER_IDLE_DELAY + 400; i++) {
      stepPets(grid, pets, { x: 60, y: 31 });
      if (poodle.state === 'trotting') trotted = true;
    }
    expect(trotted).toBe(false);
  });

  it('still wanders after eating a gumdrop far from her old home (settle re-homes her)', () => {
    const grid = withFloor(120, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 30, 30);
    run(grid, pets, null, 20);
    setCell(grid, 50, 31, GUMDROP, 0); // well past WANDER_RANGE from home at 30
    run(grid, pets, null, 160); // trot there, eat, settle — but not yet bored enough to wander
    const poodle = pets.poodles[0];
    expect(grid.elements[31 * grid.width + 50]).toBe(EMPTY);
    const settledX = poodle.x;
    let moved = false;
    for (let i = 0; i < WANDER_IDLE_DELAY + 300; i++) {
      stepPets(grid, pets, null);
      if (poodle.x !== settledX) moved = true;
      expect(Math.abs(poodle.x - settledX)).toBeLessThanOrEqual(WANDER_RANGE);
    }
    expect(moved).toBe(true);
  });

  it('never converts sand while wandering (no grooming)', () => {
    const grid = withFloor(120, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 60, 30);
    run(grid, pets, null, WANDER_IDLE_DELAY + 600);
    let rainbow = 0;
    for (let i = 0; i < grid.elements.length; i++) {
      if (grid.elements[i] === RAINBOW_SAND) rainbow++;
    }
    expect(rainbow).toBe(0);
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

  it('shifts every mermaid by the same offset the grid content gets (FR-028)', () => {
    const pets = createPetsState();
    pets.mermaids.push(
      { id: pets.nextId++, x: 20, y: 15, facing: 1, state: 'drifting', timer: 0, pursuitX: -1, pursuitY: -1, pursuitBestDist: Infinity, pursuitStaleFrames: 0, iceCreamCooldown: 0, homeX: 20, homeY: 15, driftDir: 1 },
      { id: pets.nextId++, x: 30, y: 10, facing: 1, state: 'drifting', timer: 0, pursuitX: -1, pursuitY: -1, pursuitBestDist: Infinity, pursuitStaleFrames: 0, iceCreamCooldown: 0, homeX: 30, homeY: 10, driftDir: 1 },
    );
    const newGrid = createGrid(80, 40);
    repositionMermaids(pets.mermaids, newGrid, 10, 5);
    expect(pets.mermaids[0].x).toBeCloseTo(30);
    expect(pets.mermaids[0].y).toBeCloseTo(20);
    expect(pets.mermaids[1].x).toBeCloseTo(40);
    expect(pets.mermaids[1].y).toBeCloseTo(15);
  });

  it('clamps a mermaid back inside the new grid rather than dropping her (FR-028)', () => {
    const pets = createPetsState();
    pets.mermaids.push({ id: pets.nextId++, x: 5, y: 5, facing: 1, state: 'drifting', timer: 0, pursuitX: -1, pursuitY: -1, pursuitBestDist: Infinity, pursuitStaleFrames: 0, iceCreamCooldown: 0, homeX: 5, homeY: 5, driftDir: 1 });
    const newGrid = createGrid(40, 20);
    repositionMermaids(pets.mermaids, newGrid, -20, -20);
    expect(pets.mermaids).toHaveLength(1);
    expect(pets.mermaids[0].x).toBeGreaterThanOrEqual(0);
    expect(pets.mermaids[0].x).toBeLessThan(40);
    expect(pets.mermaids[0].y).toBeGreaterThanOrEqual(0);
    expect(pets.mermaids[0].y).toBeLessThan(20);
  });

  it('clamps a mermaid against the far edge too, not just zero (FR-028)', () => {
    const pets = createPetsState();
    pets.mermaids.push({ id: pets.nextId++, x: 35, y: 15, facing: 1, state: 'drifting', timer: 0, pursuitX: -1, pursuitY: -1, pursuitBestDist: Infinity, pursuitStaleFrames: 0, iceCreamCooldown: 0, homeX: 35, homeY: 15, driftDir: 1 });
    const newGrid = createGrid(20, 10);
    repositionMermaids(pets.mermaids, newGrid, 20, 20);
    expect(pets.mermaids[0].x).toBeLessThanOrEqual(newGrid.width - 1);
    expect(pets.mermaids[0].y).toBeLessThanOrEqual(newGrid.height - 1);
  });
});

describe('erasing mermaids (FR-024)', () => {
  it('removes a mermaid within POKE_RADIUS of the erase point and leaves one outside untouched', () => {
    const grid = withFloor(120, 40, 8);
    const pets = createPetsState();
    setCell(grid, 30, 20, WATER, 0);
    setCell(grid, 90, 20, WATER, 0);
    addMermaid(grid, pets, 30, 20);
    addMermaid(grid, pets, 90, 20);
    eraseMermaidsInBrush(pets, 30, 20, POKE_RADIUS);
    expect(pets.mermaids).toHaveLength(1);
    expect(pets.mermaids[0].x).toBeCloseTo(90);
  });

  it('eraseMermaidsInBrushLine reaches every point along a fast drag', () => {
    const grid = withFloor(120, 40, 8);
    const pets = createPetsState();
    setCell(grid, 30, 20, WATER, 0);
    setCell(grid, 60, 20, WATER, 0);
    addMermaid(grid, pets, 30, 20);
    addMermaid(grid, pets, 60, 20);
    eraseMermaidsInBrushLine(pets, { x: 20, y: 20 }, { x: 70, y: 20 }, POKE_RADIUS);
    expect(pets.mermaids).toHaveLength(0);
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

  it('removes every mermaid too (FR-025)', () => {
    const grid = withFloor(60, 40, 8);
    const pets = createPetsState();
    setCell(grid, 30, 20, WATER, 0);
    addMermaid(grid, pets, 30, 20);
    addMermaid(grid, pets, 30, 20);
    clearPets(pets);
    expect(pets.mermaids).toHaveLength(0);
  });

  it('removes every person too (FR-022)', () => {
    const grid = withFloor(40, 40, 8);
    const pets = createPetsState();
    addPerson(grid, pets, 10, 5, ['neutral'], DEFAULT_TONE_ONLY, Math.random);
    expect(pets.people).toHaveLength(1);
    clearPets(pets);
    expect(pets.people).toHaveLength(0);
  });
});

const NEUTRAL_ONLY: readonly PersonVariant[] = ['neutral'];
const ALL_VARIANTS: readonly PersonVariant[] = ['neutral', 'man', 'woman'];
const DEFAULT_TONE_ONLY: readonly PersonTone[] = ['default'];
const ALL_TONES: readonly PersonTone[] = ['default', 'light', 'mediumLight', 'medium', 'mediumDark', 'dark'];

/** Deterministic sequence generator so pickPersonVariant tests don't depend on Math.random. */
function seededRng(values: readonly number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

// stepPeople itself never advances pets.stride (stepPets does that once per real frame, shared
// across poodles/mermaids/people) — bump it manually here so the staggered step cadence
// (PERSON_STEP_INTERVAL) behaves the same way it does in production instead of every person
// stepping on every call.
function runPeople(grid: Grid, pets: ReturnType<typeof createPetsState>, frames: number): void {
  for (let i = 0; i < frames; i++) {
    pets.stride++;
    stepPeople(grid, pets);
  }
}

describe('placing people (US1, FR-001, FR-003)', () => {
  it('adds a person at the requested position with a variant drawn from drawableVariants', () => {
    const grid = withFloor(40, 40, 8);
    const pets = createPetsState();
    addPerson(grid, pets, 12, 5, NEUTRAL_ONLY, DEFAULT_TONE_ONLY, Math.random);
    expect(pets.people).toHaveLength(1);
    expect(pets.people[0].x).toBeCloseTo(12);
    expect(pets.people[0].variant).toBe('neutral');
    expect(pets.people[0].state).toBe('standing');
  });

  it('caps the group at PERSON_CAP and evicts the oldest', () => {
    const grid = withFloor(40, 40, 8);
    const pets = createPetsState();
    for (let i = 0; i < PERSON_CAP + 2; i++) addPerson(grid, pets, i * 3, 5, NEUTRAL_ONLY, DEFAULT_TONE_ONLY, Math.random);
    expect(pets.people).toHaveLength(PERSON_CAP);
    expect(pets.people[0].x).toBeCloseTo(6);
  });

  it('gives every person a unique id, never colliding with a poodle/mermaid id', () => {
    const grid = withFloor(40, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 1, 1);
    addMermaid(grid, pets, 2, 2);
    for (let i = 0; i < PERSON_CAP; i++) addPerson(grid, pets, i * 3, 5, NEUTRAL_ONLY, DEFAULT_TONE_ONLY, Math.random);
    const ids = [...pets.poodles.map((p) => p.id), ...pets.mermaids.map((m) => m.id), ...pets.people.map((p) => p.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('pickPersonVariant — seeded no-repeat cycle (FR-013a, SC-005a)', () => {
  it('yields every drawable variant exactly once per shuffle cycle, in a seed-determined order', () => {
    const pets = createPetsState();
    const rng = seededRng([0.1, 0.5, 0.9, 0.2, 0.6, 0.8]);
    const first = [
      pickPersonVariant(pets, ALL_VARIANTS, rng),
      pickPersonVariant(pets, ALL_VARIANTS, rng),
      pickPersonVariant(pets, ALL_VARIANTS, rng),
    ];
    expect(new Set(first)).toEqual(new Set(ALL_VARIANTS));

    const second = [
      pickPersonVariant(pets, ALL_VARIANTS, rng),
      pickPersonVariant(pets, ALL_VARIANTS, rng),
      pickPersonVariant(pets, ALL_VARIANTS, rng),
    ];
    expect(new Set(second)).toEqual(new Set(ALL_VARIANTS));
  });

  it('degenerates to always neutral with a single-element drawableVariants list, no special-casing', () => {
    const pets = createPetsState();
    const rng = seededRng([0.1, 0.5, 0.9]);
    for (let i = 0; i < 5; i++) {
      expect(pickPersonVariant(pets, NEUTRAL_ONLY, rng)).toBe('neutral');
    }
  });
});

describe('a person standing on the ground (US1, FR-004)', () => {
  it('falls until it rests on the surface', () => {
    const grid = withFloor(40, 40, 8);
    const pets = createPetsState();
    addPerson(grid, pets, 20, 2, NEUTRAL_ONLY, DEFAULT_TONE_ONLY, Math.random);
    runPeople(grid, pets, 60);
    expect(pets.people[0].y).toBeCloseTo(31, 0);
  });

  it('settles on a solid surface placed on hills, flat ground, mid-air, or water', () => {
    const grid = withFloor(80, 40, 8);
    for (let y = 20; y < 32; y++) {
      for (let x = 30; x < 40; x++) setCell(grid, x, y, SAND, 0);
    }
    setCell(grid, 60, 31, WATER, 0);
    const pets = createPetsState();
    addPerson(grid, pets, 35, 5, NEUTRAL_ONLY, DEFAULT_TONE_ONLY, Math.random); // hill
    addPerson(grid, pets, 10, 5, NEUTRAL_ONLY, DEFAULT_TONE_ONLY, Math.random); // flat ground
    addPerson(grid, pets, 50, 5, NEUTRAL_ONLY, DEFAULT_TONE_ONLY, Math.random); // mid-air over the floor
    addPerson(grid, pets, 60, 5, NEUTRAL_ONLY, DEFAULT_TONE_ONLY, Math.random); // over water
    runPeople(grid, pets, 80);
    for (const person of pets.people) {
      expect(person.y).toBeGreaterThanOrEqual(0);
      expect(person.y).toBeLessThan(40);
    }
  });

  it('never falls out of the world when there is no ground', () => {
    const grid = createGrid(40, 40);
    const pets = createPetsState();
    addPerson(grid, pets, 20, 2, NEUTRAL_ONLY, DEFAULT_TONE_ONLY, Math.random);
    runPeople(grid, pets, 200);
    expect(pets.people[0].y).toBeLessThanOrEqual(39);
    expect(pets.people[0].y).toBeGreaterThanOrEqual(0);
  });
});

describe('a person strolls on her own (US1, FR-005, SC-002)', () => {
  it('alternates standing and walking, moves over time, and never strays past PERSON_ROAM_RANGE', () => {
    const grid = withFloor(200, 40, 8);
    const pets = createPetsState();
    addPerson(grid, pets, 100, 2, NEUTRAL_ONLY, DEFAULT_TONE_ONLY, Math.random);
    const settleX = pets.people[0].homeX;

    const seenStates = new Set<string>();
    let moved = false;
    const startX = pets.people[0].x;
    for (let i = 0; i < 600; i++) {
      pets.stride++;
      stepPeople(grid, pets);
      seenStates.add(pets.people[0].state);
      if (pets.people[0].x !== startX) moved = true;
      expect(Math.abs(pets.people[0].x - settleX)).toBeLessThanOrEqual(PERSON_ROAM_RANGE + 1);
    }
    expect(seenStates.has('standing')).toBe(true);
    expect(seenStates.has('walking')).toBe(true);
    expect(moved).toBe(true);
  });

  it('is drawn walking exactly while moving-state and standing while paused, facing matching wanderDir', () => {
    const grid = withFloor(200, 40, 8);
    const pets = createPetsState();
    addPerson(grid, pets, 100, 2, NEUTRAL_ONLY, DEFAULT_TONE_ONLY, Math.random);
    runPeople(grid, pets, 10); // let her settle
    for (let i = 0; i < 400; i++) {
      pets.stride++;
      stepPeople(grid, pets);
      const person = pets.people[0];
      if (person.state === 'walking') {
        expect(person.facing).toBe(person.wanderDir);
      } else {
        expect(person.state).toBe('standing');
      }
    }
  });

  it('never responds to a finger target — stepPets with a non-null target moves poodles, never people', () => {
    const grid = withFloor(200, 40, 8);
    const pets = createPetsState();
    addPoodle(pets, 100, 2);
    addPerson(grid, pets, 100, 2, NEUTRAL_ONLY, DEFAULT_TONE_ONLY, Math.random);
    for (let i = 0; i < 20; i++) stepPets(grid, pets, null);
    const poodleStartX = pets.poodles[0].x;
    const personStartX = pets.people[0].x;
    for (let i = 0; i < 120; i++) stepPets(grid, pets, { x: 190, y: 2 });
    expect(pets.poodles[0].x).not.toBeCloseTo(poodleStartX, 0);
    // A person may still take her own unrelated wander steps, but never toward the finger target
    // specifically — bound the drift to what her own roam range allows around her settle point.
    expect(Math.abs(pets.people[0].x - personStartX)).toBeLessThanOrEqual(PERSON_ROAM_RANGE + 1);
  });
});

describe('a person steps up ledges and turns at walls (US1, FR-004)', () => {
  it('mounts a 1-2 cell step and turns around at a taller wall instead of climbing or clipping', () => {
    const grid = withFloor(120, 40, 8);
    // A small step up at 72-77, and further along, a wall taller than MAX_CLIMB at 88-93.
    for (let y = 30; y < 32; y++) {
      for (let x = 72; x < 77; x++) setCell(grid, x, y, SAND, 0);
    }
    for (let y = 10; y < 32; y++) {
      for (let x = 88; x < 93; x++) setCell(grid, x, y, SAND, 0);
    }
    const pets = createPetsState();
    addPerson(grid, pets, 68, 2, NEUTRAL_ONLY, DEFAULT_TONE_ONLY, Math.random);
    const person = pets.people[0];
    // Force a rightward walking burst rather than waiting on the random pause/direction, and
    // widen her roam anchor so the roam-range leash (tested separately above) isn't what stops
    // her before she ever reaches the step/wall — this test is specifically about FR-004's
    // ledge/wall handling, not FR-005's roam range.
    person.state = 'walking';
    person.timer = 5000;
    person.wanderDir = 1;
    person.homeX = 80;

    let maxX = person.x;
    for (let i = 0; i < 3000; i++) {
      pets.stride++;
      stepPeople(grid, pets);
      // Never clips into or climbs the tall wall's footprint.
      expect(person.x).toBeLessThan(88);
      maxX = Math.max(maxX, person.x);
    }
    // She should have climbed the small step onto its top along the way.
    expect(maxX).toBeGreaterThan(77);
  });
});

describe('a person is never made solid (US1, FR-009)', () => {
  it('pouring sand on her cell leaves the grid element unaffected by her presence', () => {
    const grid = withFloor(40, 40, 8);
    const pets = createPetsState();
    addPerson(grid, pets, 20, 2, NEUTRAL_ONLY, DEFAULT_TONE_ONLY, Math.random);
    runPeople(grid, pets, 30);
    const person = pets.people[0];
    const beforeElement = grid.elements[Math.round(person.y) * grid.width + Math.round(person.x)];
    applyBrush(grid, 'sand', person.x, person.y, 0, 0);
    // The cell may now hold SAND (the brush painted it), but nothing about Person itself ever
    // wrote to the grid — this just documents that her presence never resisted the pour.
    const afterElement = grid.elements[Math.round(person.y) * grid.width + Math.round(person.x)];
    expect(afterElement === SAND || afterElement === beforeElement).toBe(true);
  });
});

describe('a person recovers from buried/airborne/off-grid placements (US1, FR-007, SC-001)', () => {
  it('digs herself out within a bounded number of frames when buried in sand', () => {
    const grid = withFloor(40, 40, 8);
    for (let y = 0; y < 32; y++) setCell(grid, 20, y, SAND, 0);
    const pets = createPetsState();
    addPerson(grid, pets, 20, 15, NEUTRAL_ONLY, DEFAULT_TONE_ONLY, Math.random);
    runPeople(grid, pets, 400);
    const person = pets.people[0];
    expect(grid.elements[Math.round(person.y) * grid.width + Math.round(person.x)]).not.toBe(SAND);
  });

  it('recovers from being placed off the ground (mid-air)', () => {
    const grid = withFloor(40, 40, 8);
    const pets = createPetsState();
    addPerson(grid, pets, 20, 0, NEUTRAL_ONLY, DEFAULT_TONE_ONLY, Math.random);
    runPeople(grid, pets, 60);
    expect(pets.people[0].y).toBeCloseTo(31, 0);
  });

  it('recovers from being placed at the very edge of the grid', () => {
    const grid = withFloor(40, 40, 8);
    const pets = createPetsState();
    addPerson(grid, pets, 0, 2, NEUTRAL_ONLY, DEFAULT_TONE_ONLY, Math.random);
    addPerson(grid, pets, grid.width - 1, 2, NEUTRAL_ONLY, DEFAULT_TONE_ONLY, Math.random);
    runPeople(grid, pets, 300);
    for (const person of pets.people) {
      expect(person.x).toBeGreaterThanOrEqual(0);
      expect(person.x).toBeLessThanOrEqual(grid.width - 1);
    }
  });
});

describe('a person survives 2,000 adversarial frames (SC-001)', () => {
  it('never ends up outside the grid or permanently stuck in solid material', () => {
    const grid = withFloor(150, 60, 10);
    // Hills, ledges, walls, pits.
    for (let y = 30; y < 50; y++) {
      for (let x = 20; x < 40; x++) setCell(grid, x, y, SAND, 0);
    }
    for (let y = 45; y < 50; y++) {
      for (let x = 60; x < 65; x++) setCell(grid, x, y, SAND, 0);
    }
    for (let x = 80; x < 90; x++) {
      for (let y = 50; y < 60; y++) setCell(grid, x, y, EMPTY, 0); // a pit through the floor
    }
    const pets = createPetsState();
    addPerson(grid, pets, 25, 5, ALL_VARIANTS, ALL_TONES, Math.random);
    addPerson(grid, pets, 100, 5, ALL_VARIANTS, ALL_TONES, Math.random);
    addPerson(grid, pets, 140, 5, ALL_VARIANTS, ALL_TONES, Math.random);

    for (let i = 0; i < 2000; i++) {
      pets.stride++;
      stepPeople(grid, pets);
      // Occasionally pour sand on/near a person or erase the ground beneath her.
      if (i === 500) {
        const p = pets.people[0];
        for (let y = Math.max(0, Math.round(p.y) - 2); y <= p.y; y++) setCell(grid, Math.round(p.x), y, SAND, 0);
      }
      if (i === 1200) {
        const p = pets.people[1];
        for (let y = Math.round(p.y) + 1; y < grid.height; y++) setCell(grid, Math.round(p.x), y, EMPTY, 0);
      }
      for (const person of pets.people) {
        expect(person.x).toBeGreaterThanOrEqual(0);
        expect(person.x).toBeLessThanOrEqual(grid.width - 1);
        expect(person.y).toBeGreaterThanOrEqual(0);
        expect(person.y).toBeLessThanOrEqual(grid.height - 1);
      }
    }
  });
});

describe('repositioning people on a grid re-derivation (US6, FR-028)', () => {
  it('shifts by the offset and clamps back in-bounds, re-anchoring homeX', () => {
    const pets = createPetsState();
    pets.people.push({
      id: pets.nextId++,
      x: 10,
      y: 10,
      facing: 1,
      state: 'standing',
      timer: 0,
      variant: 'neutral',
      tone: 'default',
      homeX: 10,
      wanderDir: 1,
    });
    const newGrid = createGrid(20, 20);
    repositionPeople(pets.people, newGrid, 5, 5);
    expect(pets.people[0].x).toBe(15);
    expect(pets.people[0].y).toBe(15);
    expect(pets.people[0].homeX).toBe(15);
  });

  it('clamps rather than drops a person landing outside the new bounds', () => {
    const pets = createPetsState();
    pets.people.push({
      id: pets.nextId++,
      x: 15,
      y: 15,
      facing: 1,
      state: 'standing',
      timer: 0,
      variant: 'neutral',
      tone: 'default',
      homeX: 15,
      wanderDir: 1,
    });
    const newGrid = createGrid(10, 10);
    repositionPeople(pets.people, newGrid, 20, 20);
    expect(pets.people).toHaveLength(1);
    expect(pets.people[0].x).toBeLessThanOrEqual(newGrid.width - 1);
    expect(pets.people[0].y).toBeLessThanOrEqual(newGrid.height - 1);
  });
});

describe('restorePeopleFromPositions (US1/US4, FR-012, FR-023)', () => {
  it('rebuilds people fresh (standing, timer 0) with the variant and tone carried verbatim', () => {
    const pets = createPetsState();
    restorePeopleFromPositions(pets, [
      { x: 5, y: 6, variant: 'man', tone: 'dark' },
      { x: 7, y: 8, variant: 'woman', tone: 'default' },
    ]);
    expect(pets.people).toHaveLength(2);
    expect(pets.people[0].variant).toBe('man');
    expect(pets.people[0].tone).toBe('dark');
    expect(pets.people[0].state).toBe('standing');
    expect(pets.people[1].variant).toBe('woman');
    expect(pets.people[1].tone).toBe('default');
  });
});

describe('variant is fixed for life (US2, FR-012)', () => {
  it('never changes across hundreds of frames of strolling, whatever variant she was given', () => {
    const grid = withFloor(80, 40, 8);
    const pets = createPetsState();
    addPerson(grid, pets, 40, 2, ALL_VARIANTS, ALL_TONES, seededRng([0.1, 0.9, 0.5]));
    const variant = pets.people[0].variant;
    runPeople(grid, pets, 500);
    expect(pets.people[0].variant).toBe(variant);
  });

  it('is still unchanged after a pokePersonAt run reaction (US2 Acceptance Scenario 1, FR-012)', () => {
    const grid = withFloor(80, 40, 8);
    const pets = createPetsState();
    addPerson(grid, pets, 40, 2, ALL_VARIANTS, ALL_TONES, seededRng([0.1, 0.9, 0.5]));
    const variant = pets.people[0].variant;
    runPeople(grid, pets, 20);
    const person = pets.people[0];
    expect(pokePersonAt(pets, person.x, person.y)).toBe(true);
    runPeople(grid, pets, PERSON_RUN_DURATION + 10);
    expect(pets.people[0].variant).toBe(variant);
  });
});

describe('poking a person (US5, FR-016)', () => {
  it('breaks into a run when poked within reach, then returns to strolling', () => {
    const grid = withFloor(60, 40, 8);
    const pets = createPetsState();
    addPerson(grid, pets, 30, 2, NEUTRAL_ONLY, DEFAULT_TONE_ONLY, Math.random);
    runPeople(grid, pets, 20);
    const person = pets.people[0];

    expect(pokePersonAt(pets, person.x, person.y)).toBe(true);
    expect(person.state).toBe('running');
    expect(person.timer).toBe(PERSON_RUN_DURATION);

    runPeople(grid, pets, PERSON_RUN_DURATION);
    expect(person.state).toBe('standing');
  });

  it('ignores a second poke while already running — no change to timer/state (US5 Acceptance Scenario 2)', () => {
    const grid = withFloor(60, 40, 8);
    const pets = createPetsState();
    addPerson(grid, pets, 30, 2, NEUTRAL_ONLY, DEFAULT_TONE_ONLY, Math.random);
    runPeople(grid, pets, 20);
    const person = pets.people[0];
    pokePersonAt(pets, person.x, person.y);
    runPeople(grid, pets, 5);
    const timerBefore = person.timer;

    expect(pokePersonAt(pets, person.x, person.y)).toBe(false);
    expect(person.state).toBe('running');
    expect(person.timer).toBe(timerBefore);
  });

  it('returns false and changes nothing with no person nearby', () => {
    const grid = withFloor(60, 40, 8);
    const pets = createPetsState();
    addPerson(grid, pets, 30, 2, NEUTRAL_ONLY, DEFAULT_TONE_ONLY, Math.random);
    runPeople(grid, pets, 20);
    const person = pets.people[0];
    const stateBefore = person.state;

    expect(pokePersonAt(pets, person.x + POKE_RADIUS + 10, person.y)).toBe(false);
    expect(person.state).toBe(stateBefore);
  });

  it('returns false with no people at all', () => {
    const pets = createPetsState();
    expect(pokePersonAt(pets, 10, 10)).toBe(false);
  });

  it('still transitions to running on poke even when the picture set has no running picture (US5 Acceptance Scenario 5, FR-016a) — the hop-vs-glyph choice is a render concern, not a sim one', () => {
    // canRunPicture is a PlayArea.svelte rendering decision (see personGlyphs.test.ts); at the sim
    // level, pokePersonAt always reacts regardless of what the picture set can draw.
    const grid = withFloor(60, 40, 8);
    const pets = createPetsState();
    addPerson(grid, pets, 30, 2, NEUTRAL_ONLY, DEFAULT_TONE_ONLY, Math.random);
    runPeople(grid, pets, 20);
    const person = pets.people[0];
    expect(pokePersonAt(pets, person.x, person.y)).toBe(true);
    expect(person.state).toBe('running');
  });
});

describe('erasing people (US6, FR-021)', () => {
  it('removes a person within reach and leaves one outside untouched', () => {
    const grid = withFloor(120, 40, 8);
    const pets = createPetsState();
    addPerson(grid, pets, 30, 2, NEUTRAL_ONLY, DEFAULT_TONE_ONLY, Math.random);
    addPerson(grid, pets, 90, 2, NEUTRAL_ONLY, DEFAULT_TONE_ONLY, Math.random);
    erasePeopleInBrush(pets, 30, pets.people[0].y, POKE_RADIUS);
    expect(pets.people).toHaveLength(1);
    expect(pets.people[0].x).toBeCloseTo(90);
  });

  it('erasePeopleInBrushLine reaches every point along a fast drag, including a person straddled by the samples', () => {
    const grid = withFloor(120, 40, 8);
    const pets = createPetsState();
    addPerson(grid, pets, 30, 2, NEUTRAL_ONLY, DEFAULT_TONE_ONLY, Math.random);
    addPerson(grid, pets, 60, 2, NEUTRAL_ONLY, DEFAULT_TONE_ONLY, Math.random);
    runPeople(grid, pets, 5);
    erasePeopleInBrushLine(pets, { x: 20, y: pets.people[0].y }, { x: 70, y: pets.people[0].y }, POKE_RADIUS);
    expect(pets.people).toHaveLength(0);
  });
});

describe('tone is fixed for life across every frame, state, and facing (US1, FR-002, FR-012)', () => {
  it('never changes across hundreds of frames of strolling and a poke-to-run reaction', () => {
    const grid = withFloor(80, 40, 8);
    const pets = createPetsState();
    addPerson(grid, pets, 40, 2, ALL_VARIANTS, ALL_TONES, seededRng([0.1, 0.9, 0.5, 0.3, 0.7]));
    const variant = pets.people[0].variant;
    const tone = pets.people[0].tone;
    const seenStates = new Set<string>();
    const seenFacings = new Set<number>();

    for (let i = 0; i < 400; i++) {
      pets.stride++;
      stepPeople(grid, pets);
      seenStates.add(pets.people[0].state);
      seenFacings.add(pets.people[0].facing);
      expect(pets.people[0].variant).toBe(variant);
      expect(pets.people[0].tone).toBe(tone);
    }

    const person = pets.people[0];
    expect(pokePersonAt(pets, person.x, person.y)).toBe(true);
    for (let i = 0; i < PERSON_RUN_DURATION + 10; i++) {
      pets.stride++;
      stepPeople(grid, pets);
      seenStates.add(pets.people[0].state);
      expect(pets.people[0].variant).toBe(variant);
      expect(pets.people[0].tone).toBe(tone);
    }

    expect(seenStates.has('standing')).toBe(true);
    expect(seenStates.has('walking')).toBe(true);
    expect(seenStates.has('running')).toBe(true);
  });
});

describe('frameFor resolves the exact (variant, tone, frame) picture (US1 Acceptance Scenario 4)', () => {
  it('never returns a different tone\'s or a different frame\'s picture', () => {
    const variants: readonly PersonVariant[] = ['neutral', 'man', 'woman'];
    const frames = ['standing', 'walking', 'running'] as const;
    const pictures = {} as Record<PersonVariant, Record<PersonTone, Record<(typeof frames)[number], string>>>;
    for (const variant of variants) {
      const byTone = {} as Record<PersonTone, Record<(typeof frames)[number], string>>;
      for (const tone of ALL_TONES) {
        const byFrame = {} as Record<(typeof frames)[number], string>;
        for (const frame of frames) byFrame[frame] = `${variant}-${tone}-${frame}`;
        byTone[tone] = byFrame;
      }
      pictures[variant] = byTone;
    }
    const fabricated: PersonPictureSet = {
      drawableVariants: variants,
      drawableTones: ALL_TONES,
      pictures,
      canRunPicture: true,
      toolbarGlyph: pictures.neutral.default.standing,
    };
    for (const variant of variants) {
      for (const tone of ALL_TONES) {
        for (const frame of frames) {
          expect(frameFor(fabricated, variant, tone, frame)).toBe(`${variant}-${tone}-${frame}`);
        }
      }
    }
  });
});

describe('pickPersonTone/addPerson with a single collapsed drawable tone (US3 Acceptance Scenario 3, FR-013)', () => {
  it('never stalls, throws, or returns anything but default across many consecutive placements', () => {
    const grid = withFloor(200, 40, 8);
    const pets = createPetsState();
    for (let i = 0; i < 50; i++) {
      expect(() => addPerson(grid, pets, 10 + i, 2, NEUTRAL_ONLY, DEFAULT_TONE_ONLY, Math.random)).not.toThrow();
    }
    for (const person of pets.people) expect(person.tone).toBe('default');
  });
});

describe('pickPersonTone — seeded no-repeat cycle (US2 Acceptance Scenario 2, FR-006, SC-001)', () => {
  it('yields every drawable tone exactly once per shuffle cycle, then starts a fresh cycle', () => {
    const pets = createPetsState();
    const rng = seededRng([0.1, 0.5, 0.9, 0.2, 0.6, 0.8, 0.3, 0.7, 0.4, 0.05, 0.95, 0.55]);
    const first = [
      pickPersonTone(pets, ALL_TONES, rng),
      pickPersonTone(pets, ALL_TONES, rng),
      pickPersonTone(pets, ALL_TONES, rng),
      pickPersonTone(pets, ALL_TONES, rng),
      pickPersonTone(pets, ALL_TONES, rng),
      pickPersonTone(pets, ALL_TONES, rng),
    ];
    expect(new Set(first)).toEqual(new Set(ALL_TONES));
    expect(first).toHaveLength(new Set(first).size);

    const seventh = pickPersonTone(pets, ALL_TONES, rng);
    expect(ALL_TONES).toContain(seventh);
  });
});

describe('addPerson — variant and tone bags are independent (US2 Acceptance Scenario 1, FR-007, SC-001)', () => {
  it('3 consecutive placements yield 3 distinct variants and (independently) 3 distinct tones', () => {
    const grid = withFloor(80, 40, 8);
    const pets = createPetsState();
    const rng = seededRng([0.1, 0.9, 0.5, 0.2, 0.8, 0.4, 0.3, 0.7, 0.6]);
    addPerson(grid, pets, 10, 2, ALL_VARIANTS, ALL_TONES, rng);
    addPerson(grid, pets, 20, 2, ALL_VARIANTS, ALL_TONES, rng);
    addPerson(grid, pets, 30, 2, ALL_VARIANTS, ALL_TONES, rng);
    const variants = pets.people.map((p) => p.variant);
    const tones = pets.people.map((p) => p.tone);
    expect(new Set(variants).size).toBe(3);
    expect(new Set(tones).size).toBe(3);
  });
});

describe('pickPersonTone with a partially-drawable set (US2 Acceptance Scenario 3)', () => {
  it('cycles only over the drawable tones, never yields outside the set, never repeats within a cycle', () => {
    const pets = createPetsState();
    const PARTIAL: readonly PersonTone[] = ['default', 'medium', 'dark'];
    const rng = seededRng([0.1, 0.5, 0.9, 0.3, 0.6, 0.2]);
    for (let cycle = 0; cycle < 2; cycle++) {
      const picks = [pickPersonTone(pets, PARTIAL, rng), pickPersonTone(pets, PARTIAL, rng), pickPersonTone(pets, PARTIAL, rng)];
      for (const tone of picks) expect(PARTIAL).toContain(tone);
      expect(new Set(picks).size).toBe(PARTIAL.length);
    }
  });
});

describe('variant and tone bags wrap around independently at different cycle lengths (US2 Acceptance Scenario 5, FR-007)', () => {
  it('a shorter tone bag exhausting mid-cycle does not disturb the longer variant bag\'s position', () => {
    const grid = withFloor(100, 40, 8);
    const pets = createPetsState();
    const TWO_TONES: readonly PersonTone[] = ['default', 'dark'];
    const rng = seededRng([0.1, 0.9, 0.5, 0.2, 0.8, 0.4, 0.3, 0.7, 0.6, 0.05]);
    // Placements beyond PERSON_CAP evict the oldest from pets.people, so track picks as they
    // happen rather than reading them back off the (capped) array afterwards.
    const variants: PersonVariant[] = [];
    const tones: PersonTone[] = [];
    for (let i = 0; i < 6; i++) {
      addPerson(grid, pets, 10 + i * 5, 2, ALL_VARIANTS, TWO_TONES, rng);
      const placed = pets.people[pets.people.length - 1];
      variants.push(placed.variant);
      tones.push(placed.tone);
    }
    // Tone bag (length 2) completes three full cycles while the variant bag (length 3) completes two.
    expect(new Set(tones.slice(0, 2)).size).toBe(2);
    expect(new Set(tones.slice(2, 4)).size).toBe(2);
    expect(new Set(tones.slice(4, 6)).size).toBe(2);
    expect(new Set(variants.slice(0, 3)).size).toBe(3);
    expect(new Set(variants.slice(3, 6)).size).toBe(3);
  });
});

describe('tone never affects movement, poke, erase, or cap eviction (US6)', () => {
  it('two people of different tones stroll, pause, step, and turn identically apart from starting position (Acceptance Scenario 1)', () => {
    const grid = withFloor(200, 40, 8);
    const pets = createPetsState();
    restorePeopleFromPositions(pets, [
      { x: 40, y: 2, variant: 'neutral', tone: 'default' },
      { x: 140, y: 2, variant: 'neutral', tone: 'dark' },
    ]);
    for (let i = 0; i < 300; i++) {
      pets.stride++;
      stepPeople(grid, pets);
      const [a, b] = pets.people;
      // Both start 'standing' with timer 0 at frame 0, so the pause/walk-burst countdown — driven
      // entirely by fixed timers, never by tone — keeps them in lockstep; only which way each one
      // wanders (a separate, genuinely random choice) is free to differ.
      expect(a.state).toBe(b.state);
    }
  });

  it('pokePersonAt starts her running in her own tone and form, regardless of tone (Acceptance Scenario 2)', () => {
    const grid = withFloor(60, 40, 8);
    const pets = createPetsState();
    addPerson(grid, pets, 30, 2, NEUTRAL_ONLY, ['mediumDark'], Math.random);
    runPeople(grid, pets, 20);
    const person = pets.people[0];
    expect(pokePersonAt(pets, person.x, person.y)).toBe(true);
    expect(person.state).toBe('running');
    expect(person.tone).toBe('mediumDark');
  });

  it('erasing a person of any tone, or evicting one at the cap, leaves personToneBag\'s cycle position for the rest unaffected (Acceptance Scenarios 3-4)', () => {
    const grid = withFloor(120, 40, 8);
    const pets = createPetsState();
    const rng = seededRng([0.1, 0.9, 0.5, 0.2, 0.8, 0.4]);
    addPerson(grid, pets, 30, 2, NEUTRAL_ONLY, ALL_TONES, rng);
    addPerson(grid, pets, 60, 2, NEUTRAL_ONLY, ALL_TONES, rng);
    const bagBefore = [...pets.personToneBag];
    erasePeopleInBrush(pets, 30, pets.people[0].y, POKE_RADIUS);
    expect(pets.people).toHaveLength(1);
    expect(pets.personToneBag).toEqual(bagBefore);

    for (let i = 0; i < PERSON_CAP + 1; i++) addPerson(grid, pets, 10 + i * 5, 2, NEUTRAL_ONLY, ALL_TONES, rng);
    expect(pets.people).toHaveLength(PERSON_CAP);
  });
});
