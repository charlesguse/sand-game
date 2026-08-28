import { isSolid } from './element';
import { EMPTY, GUMDROP, type Grid } from './types';

export type PoodleState = 'idle' | 'trotting' | 'eating' | 'shaking' | 'digging';

export interface Poodle {
  readonly id: number;
  x: number;
  y: number;
  facing: 1 | -1;
  state: PoodleState;
  timer: number;
  soggy: boolean;
  /** x of the gumdrop currently being pursued, or -1 if not pursuing one. */
  pursuitX: number;
  /** Smallest horizontal distance to pursuitX reached so far this pursuit. */
  pursuitBestDist: number;
  /** Frames since pursuitBestDist last improved. */
  pursuitStaleFrames: number;
  /** Frames remaining during which gumdrop scent is ignored, after giving up on one that couldn't be reached. */
  gumdropCooldown: number;
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
/** How far a poodle can smell a gumdrop, in cells. */
export const GUMDROP_SCENT_RADIUS = 25;
/** Frames spent happily eating. */
const EAT_DURATION = 20;
/** Horizontal distance at which the poodle can reach a gumdrop. */
const EAT_REACH = 2;
/** How far above/below the poodle's feet to search when clearing an eaten gumdrop. */
const EAT_SEARCH_HEIGHT = 3;
/**
 * Frames a poodle will keep trying to close the distance on a pursued
 * gumdrop without any improvement before giving up on it. Generous relative
 * to STEP_INTERVAL so a legitimately-approaching poodle (whose distance only
 * ticks down once per stride) never gives up mid-approach.
 */
const GUMDROP_PATIENCE = 40;
/**
 * Frames a poodle ignores all gumdrop scent after giving up on one it
 * couldn't reach, so it stays with her finger instead of immediately
 * re-committing to the same unreachable spot.
 */
const GUMDROP_COOLDOWN = 150;

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
    pursuitX: -1,
    pursuitBestDist: Infinity,
    pursuitStaleFrames: 0,
    gumdropCooldown: 0,
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

/**
 * Nearest gumdrop within scent range, or -1 if none. Scans a bounded window
 * around the poodle rather than the whole grid, so cost does not grow with
 * canvas size.
 *
 * The vertical span of the scan is capped at EAT_SEARCH_HEIGHT — the same
 * window eatGumdropNear uses to actually eat — instead of the full scent
 * radius. This is a pruning optimization only: it keeps the scan cheaper and
 * avoids proposing a gumdrop that's obviously too far above or below to eat
 * from the poodle's *current* standing height. It says nothing about
 * horizontal obstructions (walls, pits) between here and there, so it is not
 * by itself a guarantee the returned gumdrop is reachable — that guarantee
 * comes from the pursuit/give-up bookkeeping in stepPoodle, which abandons a
 * target that stops getting closer regardless of why.
 */
function nearestGumdropX(grid: Grid, poodle: Poodle): number {
  const cx = Math.round(poodle.x);
  const cy = Math.round(poodle.y);
  let bestX = -1;
  let bestDist = Infinity;

  const minX = Math.max(0, cx - GUMDROP_SCENT_RADIUS);
  const maxX = Math.min(grid.width - 1, cx + GUMDROP_SCENT_RADIUS);
  const minY = Math.max(0, cy - EAT_SEARCH_HEIGHT);
  const maxY = Math.min(grid.height - 1, cy + EAT_SEARCH_HEIGHT);

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

/**
 * Clears the GUMDROP cell nearest the poodle's feet at the given column, if
 * one exists within a small neighbourhood. Returns true if a cell was cleared.
 */
function eatGumdropNear(grid: Grid, gx: number, poodle: Poodle): boolean {
  const cy = Math.round(poodle.y);
  const minY = Math.max(0, cy - EAT_SEARCH_HEIGHT);
  const maxY = Math.min(grid.height - 1, cy + EAT_SEARCH_HEIGHT);
  let bestY = -1;
  let bestDist = Infinity;
  for (let y = minY; y <= maxY; y++) {
    if (grid.elements[y * grid.width + gx] !== GUMDROP) continue;
    const dist = Math.abs(y - cy);
    if (dist < bestDist) {
      bestDist = dist;
      bestY = y;
    }
  }
  if (bestY === -1) return false;
  grid.elements[bestY * grid.width + gx] = EMPTY;
  return true;
}

/** Advances one poodle by one frame. Allocation-free. */
function stepPoodle(grid: Grid, poodle: Poodle, target: { x: number; y: number } | null, stride: number): void {
  if (poodle.timer > 0) {
    poodle.timer--;
    if (poodle.timer === 0) poodle.state = 'idle';
    return;
  }

  poodle.y = groundBelow(grid, poodle.x, poodle.y);

  let targetX: number | null = null;

  if (poodle.gumdropCooldown > 0) {
    poodle.gumdropCooldown--;
  } else {
    const gumdropX = nearestGumdropX(grid, poodle);
    if (gumdropX === -1) {
      poodle.pursuitX = -1;
      poodle.pursuitBestDist = Infinity;
      poodle.pursuitStaleFrames = 0;
    } else {
      if (poodle.pursuitX !== gumdropX) {
        poodle.pursuitX = gumdropX;
        poodle.pursuitBestDist = Infinity;
        poodle.pursuitStaleFrames = 0;
      }

      const dist = Math.abs(gumdropX - poodle.x);
      if (dist < poodle.pursuitBestDist) {
        poodle.pursuitBestDist = dist;
        poodle.pursuitStaleFrames = 0;
      } else {
        poodle.pursuitStaleFrames++;
      }

      if (poodle.pursuitStaleFrames > GUMDROP_PATIENCE) {
        // She hasn't gotten any closer to this one in a while — give up on
        // it (whatever the reason: a wall, a pit, a ledge too high) and
        // ignore gumdrop scent for a while so her finger gets control back
        // instead of immediately re-committing to the same dead end.
        poodle.pursuitX = -1;
        poodle.pursuitBestDist = Infinity;
        poodle.pursuitStaleFrames = 0;
        poodle.gumdropCooldown = GUMDROP_COOLDOWN;
      } else if (dist <= EAT_REACH && eatGumdropNear(grid, gumdropX, poodle)) {
        poodle.state = 'eating';
        poodle.timer = EAT_DURATION;
        poodle.pursuitX = -1;
        poodle.pursuitBestDist = Infinity;
        poodle.pursuitStaleFrames = 0;
        return;
      } else {
        targetX = gumdropX;
      }
    }
  }

  if (targetX === null) {
    if (target === null) {
      poodle.state = 'idle';
      return;
    }
    targetX = target.x;
  }

  const dx = targetX - poodle.x;
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
