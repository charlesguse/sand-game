import { describe, it, expect } from 'vitest';
import { createGrid, setCell } from '../../../src/sim/grid';
import {
  createSeaLifeState,
  resetSeaLifeState,
  stepSeaLife,
  FISH_PER_POOL_CAP,
  GLOBAL_FISH_CAP,
  SWEEP_TARGET_FRAMES,
} from '../../../src/sim/seaLife';
import { WATER, SAND, type Grid } from '../../../src/sim/types';

/** Fills a rectangular region of grid with WATER. */
function fillWaterRect(grid: Grid, x: number, y: number, w: number, h: number): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) setCell(grid, xx, yy, WATER, 0);
  }
}

/** Hand-places a rectangular WATER region (and optionally other elements) into a fresh Grid. */
function withPool(width: number, height: number, pool: { x: number; y: number; w: number; h: number }): Grid {
  const grid = createGrid(width, height);
  for (let y = pool.y; y < pool.y + pool.h; y++) {
    for (let x = pool.x; x < pool.x + pool.w; x++) setCell(grid, x, y, WATER, 0);
  }
  return grid;
}

describe('createSeaLifeState / resetSeaLifeState', () => {
  it('starts with no creatures and a fresh, fully-unlabeled sweep', () => {
    const grid = createGrid(40, 30);
    const state = createSeaLifeState(grid);
    expect(state.fish).toHaveLength(0);
    expect(state.sharks).toHaveLength(0);
    expect(state.poolId).toHaveLength(40 * 30);
    expect(Array.from(state.poolId).every((v) => v === -1)).toBe(true);
    expect(state.sweepCursor).toBe(0);
  });

  it('reallocates to a new grid shape and clears everything, preserving identity', () => {
    const grid = withPool(40, 30, { x: 5, y: 5, w: 20, h: 20 });
    const state = createSeaLifeState(grid);
    for (let i = 0; i < 200; i++) stepSeaLife(grid, state);

    const bigger = withPool(60, 50, { x: 5, y: 5, w: 20, h: 20 });
    resetSeaLifeState(state, bigger);

    expect(state.fish).toHaveLength(0);
    expect(state.sharks).toHaveLength(0);
    expect(state.poolId).toHaveLength(60 * 50);
    expect(Array.from(state.poolId).every((v) => v === -1)).toBe(true);
    expect(state.sweepCursor).toBe(0);
  });
});

describe('stepSeaLife with zero creatures', () => {
  it('never touches any grid array over many frames', () => {
    const grid = withPool(50, 40, { x: 5, y: 5, w: 30, h: 20 });
    const state = createSeaLifeState(grid);
    const before = grid.elements.slice();
    for (let i = 0; i < 300; i++) stepSeaLife(grid, state);
    expect(grid.elements).toEqual(before);
  });

  it('runs indefinitely without throwing on a grid with no water at all', () => {
    const grid = createGrid(30, 20);
    for (let x = 0; x < 30; x++) setCell(grid, x, 19, SAND, 0);
    const state = createSeaLifeState(grid);
    expect(() => {
      for (let i = 0; i < 500; i++) stepSeaLife(grid, state);
    }).not.toThrow();
  });
});

describe('User Story 1 — fish spawn thresholds and caps', () => {
  it('never spawns a fish in a pool below the threshold', () => {
    const grid = createGrid(60, 40);
    fillWaterRect(grid, 5, 5, 10, 9); // 90 cells, below FISH_SPAWN_THRESHOLD (120)
    const state = createSeaLifeState(grid);
    for (let i = 0; i < 400; i++) stepSeaLife(grid, state);
    expect(state.fish).toHaveLength(0);
  });

  it('spawns a fish once a pool crosses the threshold, within about one sweep', () => {
    const grid = createGrid(60, 40);
    fillWaterRect(grid, 5, 5, 13, 10); // 130 cells, above FISH_SPAWN_THRESHOLD
    const state = createSeaLifeState(grid);
    for (let i = 0; i < SWEEP_TARGET_FRAMES * 2; i++) stepSeaLife(grid, state);
    expect(state.fish.length).toBeGreaterThan(0);
  });

  it('fish count grows with pool size up to the per-pool cap', () => {
    const fishCountFor = (cells: number): number => {
      const grid = createGrid(60, 60);
      const w = 20;
      const h = Math.ceil(cells / w);
      fillWaterRect(grid, 5, 5, w, h);
      const state = createSeaLifeState(grid);
      for (let i = 0; i < SWEEP_TARGET_FRAMES * 3; i++) stepSeaLife(grid, state);
      return state.fish.length;
    };
    expect(fishCountFor(130)).toBe(1);
    expect(fishCountFor(250)).toBe(2);
    expect(fishCountFor(1000)).toBe(FISH_PER_POOL_CAP);
  });

  it('populates the largest pools first when combined targets exceed the global cap', () => {
    const grid = createGrid(100, 30);
    fillWaterRect(grid, 0, 0, 25, 20); // 500 cells -> per-pool target 3
    fillWaterRect(grid, 30, 0, 18, 25); // 450 cells -> per-pool target 3
    fillWaterRect(grid, 55, 0, 20, 20); // 400 cells -> per-pool target 3, but the cap runs out first
    const state = createSeaLifeState(grid);
    for (let i = 0; i < SWEEP_TARGET_FRAMES * 3; i++) stepSeaLife(grid, state);

    const countIn = (x: number, y: number, w: number, h: number): number =>
      state.fish.filter((f) => {
        const fx = Math.round(f.x);
        const fy = Math.round(f.y);
        return fx >= x && fx < x + w && fy >= y && fy < y + h;
      }).length;

    expect(state.fish.length).toBe(GLOBAL_FISH_CAP);
    expect(countIn(0, 0, 25, 20)).toBe(3);
    expect(countIn(30, 0, 18, 25)).toBe(3);
    expect(countIn(55, 0, 20, 20)).toBe(0);
  });
});

describe('User Story 1 — fish movement stays inside water', () => {
  it('keeps every fish inside its own pool, on a water cell, at every frame of a long run', () => {
    const grid = createGrid(60, 40);
    fillWaterRect(grid, 5, 5, 20, 15); // 300 cells
    const state = createSeaLifeState(grid);
    for (let i = 0; i < 3000; i++) {
      stepSeaLife(grid, state);
      for (const fish of state.fish) {
        if (fish.fadeTimer > 0) continue;
        const cx = Math.round(fish.x);
        const cy = Math.round(fish.y);
        expect(grid.elements[cy * grid.width + cx]).toBe(WATER);
        expect(cx).toBeGreaterThanOrEqual(5);
        expect(cx).toBeLessThan(25);
        expect(cy).toBeGreaterThanOrEqual(5);
        expect(cy).toBeLessThan(20);
      }
    }
    expect(state.fish.length).toBeGreaterThan(0);
  });

  it('reverses direction rather than passing through a pool edge', () => {
    const grid = createGrid(60, 40);
    fillWaterRect(grid, 5, 5, 20, 15);
    const state = createSeaLifeState(grid);
    for (let i = 0; i < 200; i++) stepSeaLife(grid, state);
    expect(state.fish.length).toBeGreaterThan(0);

    const seenDirections = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      stepSeaLife(grid, state);
      for (const fish of state.fish) seenDirections.add(`${fish.dirX},${fish.dirY}`);
    }
    // Confined to a rectangle, a fish that ever drifted must eventually be observed reversing
    // along at least one axis — otherwise it would have exited the pool.
    const bothWaysHorizontally = seenDirections.has('1,0') && seenDirections.has('-1,0');
    const bothWaysVertically = seenDirections.has('0,1') && seenDirections.has('0,-1');
    expect(bothWaysHorizontally || bothWaysVertically).toBe(true);
  });

  it("changes direction at least once over a long run with no external input", () => {
    const grid = createGrid(60, 40);
    fillWaterRect(grid, 5, 5, 20, 15);
    const state = createSeaLifeState(grid);
    for (let i = 0; i < 200; i++) stepSeaLife(grid, state);
    expect(state.fish.length).toBeGreaterThan(0);

    const fish = state.fish[0];
    const startDir = `${fish.dirX},${fish.dirY}`;
    let changed = false;
    for (let i = 0; i < 2000; i++) {
      stepSeaLife(grid, state);
      if (`${fish.dirX},${fish.dirY}` !== startDir) {
        changed = true;
        break;
      }
    }
    expect(changed).toBe(true);
  });

  it('starts fading immediately when a stroke of sand is drawn straight through its own cell', () => {
    const grid = createGrid(60, 40);
    fillWaterRect(grid, 5, 5, 20, 15);
    const state = createSeaLifeState(grid);
    for (let i = 0; i < 200; i++) stepSeaLife(grid, state);
    expect(state.fish.length).toBeGreaterThan(0);

    const fish = state.fish[0];
    const fx = Math.round(fish.x);
    const fy = Math.round(fish.y);
    setCell(grid, fx, fy, SAND, 0);
    stepSeaLife(grid, state);
    expect(fish.fadeTimer).toBeGreaterThan(0);
  });
});

describe('User Story 1 — never mutates the grid', () => {
  it('leaves every grid array byte-for-byte unchanged across a run that spawns and moves fish', () => {
    const grid = createGrid(60, 40);
    fillWaterRect(grid, 5, 5, 20, 15);
    const state = createSeaLifeState(grid);

    const snapshot = () => ({
      elements: grid.elements.slice(),
      shades: grid.shades.slice(),
      hues: grid.hues.slice(),
      moved: grid.moved.slice(),
      glitter: grid.glitter.slice(),
      grassHeight: grid.grassHeight.slice(),
      grassCooldown: grid.grassCooldown.slice(),
      starPowerAge: grid.starPowerAge.slice(),
      starPowerLife: grid.starPowerLife.slice(),
      starPowerFuelled: grid.starPowerFuelled.slice(),
      cloud: grid.cloud.slice(),
      fogRiseCooldown: grid.fogRiseCooldown.slice(),
      fogStuckSteps: grid.fogStuckSteps.slice(),
      fogAge: grid.fogAge.slice(),
      cloudRainDelay: grid.cloudRainDelay.slice(),
      grassCount: grid.grassCount,
      fogCloudCount: grid.fogCloudCount,
    });

    const before = snapshot();
    for (let i = 0; i < 2000; i++) stepSeaLife(grid, state);
    expect(state.fish.length).toBeGreaterThan(0);
    expect(snapshot()).toEqual(before);
  });
});
