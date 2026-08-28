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
  /** Frame counter used to stagger poodle footsteps; see STEP_INTERVAL. */
  stride: number;
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
  return { poodles: [], nextId: 0, stride: 0 };
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
function stepPoodle(grid: Grid, poodle: Poodle, target: { x: number; y: number } | null, stride: number): void {
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

export function stepPets(grid: Grid, pets: PetsState, target: { x: number; y: number } | null): void {
  pets.stride++;
  for (const poodle of pets.poodles) stepPoodle(grid, poodle, target, pets.stride);
}
