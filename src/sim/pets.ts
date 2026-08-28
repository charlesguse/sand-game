import { isSolid } from './element';
import { EMPTY, GUMDROP, WATER, SAND, RAINBOW_SAND, type Grid } from './types';
import { randomHue } from './shade';

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
/** Frames spent shaking off water. */
const SHAKE_DURATION = 30;
/** Frames spent per scoop when digging out. */
const DIG_DURATION = 3;

export function createPetsState(): PetsState {
  return { poodles: [], nextId: 0, stride: 0 };
}

/** Sends every poodle home. `nextId` keeps counting so ids stay unique. */
export function clearPets(state: PetsState): void {
  state.poodles.length = 0;
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

/**
 * Shifts every poodle by (offsetX, offsetY) — the same offset the grid's
 * objects get on a resize re-derivation — and clamps the result back inside
 * the new grid rather than dropping it. Unlike repositionObjects, a poodle
 * is never removed: an out-of-bounds landing is clamped to the nearest edge
 * cell instead, because losing a pet on a rotation is worse than a frame or
 * two of odd footing. The per-frame groundBelow settle resolves the vertical
 * position (and any horizontal overlap with terrain) on the next step, so
 * this only needs to land the coordinates somewhere sane and in-bounds.
 */
export function repositionPoodles(
  poodles: Poodle[],
  newGrid: Grid,
  offsetX: number,
  offsetY: number,
): void {
  for (const poodle of poodles) {
    poodle.x = Math.min(Math.max(poodle.x + offsetX, 0), newGrid.width - 1);
    poodle.y = Math.min(Math.max(poodle.y + offsetY, 0), newGrid.height - 1);
  }
}

function cellIsSolid(grid: Grid, x: number, y: number): boolean {
  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return false;
  return isSolid(grid.elements[y * grid.width + x]);
}

function cellIsWater(grid: Grid, x: number, y: number): boolean {
  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return false;
  return grid.elements[y * grid.width + x] === WATER;
}

function cellIsGumdrop(grid: Grid, x: number, y: number): boolean {
  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return false;
  return grid.elements[y * grid.width + x] === GUMDROP;
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
 * The scan window is square, GUMDROP_SCENT_RADIUS cells in every direction —
 * matching what "scent radius" actually claims to mean. It used to cap the
 * vertical span at EAT_SEARCH_HEIGHT, a leftover geometric guard from before
 * the pursuit/give-up patience mechanism existed (see GUMDROP_PATIENCE):
 * that guard made a gumdrop just a few rows above or below the poodle
 * invisible even when well within the nominal radius, which defeated the
 * point of dropping one to steer her. Patience — abandoning a target that
 * stops getting closer, for whatever reason — is what actually prevents the
 * softlock now, terrain-independent of this scan's shape. This window says
 * nothing about horizontal obstructions (walls, pits) between here and
 * there, so it is not by itself a guarantee the returned gumdrop is
 * reachable; that guarantee still comes entirely from the pursuit bookkeeping
 * in stepPoodle.
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

  const occupiedX = Math.round(poodle.x);
  const occupiedY = Math.round(poodle.y);

  if (cellIsGumdrop(grid, occupiedX, occupiedY)) {
    // A gumdrop landed exactly on her own cell (dropped there directly, or
    // uncovered by her own digging). isSolid() counts GUMDROP as solid for
    // burial purposes below, but this is eating, not digging: check for it
    // first so the two don't share a predicate and this gumdrop doesn't get
    // silently deleted with no eating state and no sparkle.
    grid.elements[occupiedY * grid.width + occupiedX] = EMPTY;
    poodle.state = 'eating';
    poodle.timer = EAT_DURATION;
    poodle.pursuitX = -1;
    poodle.pursuitBestDist = Infinity;
    poodle.pursuitStaleFrames = 0;
    return;
  }

  if (cellIsSolid(grid, occupiedX, occupiedY)) {
    // Buried: the cell she's standing in is solid. Dig it out one scoop at a
    // time rather than in one jump, so this reads as digging rather than
    // teleporting, and so a very deep burial can't produce a single
    // unbounded-cost frame. Each scoop only ever clears the cell she already
    // occupies and steps up into the space it leaves — it never digs
    // sideways or downward, so this can't tunnel her into a pocket she can't
    // leave. Progress toward the surface is monotonic: the cell above is
    // exactly the one evaluated next scoop, so even if displaced sand slumps
    // back in behind her (or above, from neighbouring columns), the total
    // amount of solid material above her position is finite and only ever
    // shrinks — she cannot dig forever, and once the column above her is
    // clear the ordinary ground-settle below takes over and rests her on
    // whatever surface she uncovered.
    grid.elements[occupiedY * grid.width + occupiedX] = EMPTY;
    // Clamp rather than let a column reaching row 0 push her to y = -1 —
    // she'd render above the canvas top for a few frames before the settle
    // corrects it.
    poodle.y = Math.max(0, occupiedY - 1);
    poodle.state = 'digging';
    poodle.timer = DIG_DURATION;
    return;
  }

  poodle.y = groundBelow(grid, poodle.x, poodle.y);

  const feetX = Math.round(poodle.x);
  const feetY = Math.round(poodle.y);
  const inWater = cellIsWater(grid, feetX, feetY) || cellIsWater(grid, feetX, feetY + 1);
  if (inWater) poodle.soggy = true;

  if (poodle.soggy && !inWater) {
    // Only start shaking once she's actually out of the water — starting it
    // while still standing in a pond would shake forever and never resolve.
    poodle.state = 'shaking';
    poodle.timer = SHAKE_DURATION;
    poodle.soggy = false;
    return;
  }

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

  const groundX = Math.round(nextX);
  const groundY = nextY + 1;
  if (groundY < grid.height) {
    const groundI = groundY * grid.width + groundX;
    if (grid.elements[groundI] === SAND) {
      grid.elements[groundI] = RAINBOW_SAND;
      grid.hues[groundI] = randomHue();
    }
  }
}

export function stepPets(grid: Grid, pets: PetsState, target: { x: number; y: number } | null): void {
  pets.stride++;
  for (const poodle of pets.poodles) stepPoodle(grid, poodle, target, pets.stride);
}
