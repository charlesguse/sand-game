import { WATER, type Grid } from './types';

export interface Fish {
  readonly id: number;
  x: number;
  y: number;
  dirX: -1 | 0 | 1;
  dirY: -1 | 0 | 1;
  bobPhase: number;
  turnCooldown: number;
  scatterTimer: number;
  fadeTimer: number;
}

export interface Shark {
  readonly id: number;
  x: number;
  y: number;
  facing: 1 | -1;
  targetFishId: number | null;
  chaseTimer: number;
  cruiseCooldown: number;
  fadeTimer: number;
}

export interface SeaLifeState {
  fish: Fish[];
  sharks: Shark[];
  nextId: number;
  poolId: Int32Array;
  poolSize: number[];
  spawnSample: number[][];
  sweepQueue: Int32Array;
  sweepQueueHead: number;
  sweepQueueTail: number;
  sweepCursor: number;
  sweepNextLabel: number;
  sweepBudget: number;
  eraserCooldowns: { x: number; y: number; framesRemaining: number }[];
}

export const FISH_SPAWN_THRESHOLD = 120;
export const FISH_DESPAWN_THRESHOLD = 110;
export const SHARK_SPAWN_THRESHOLD = 700;
export const SHARK_DESPAWN_THRESHOLD = 690;
export const FISH_PER_POOL_CAP = 3;
export const SHARK_PER_POOL_CAP = 1;
export const GLOBAL_FISH_CAP = 6;
export const GLOBAL_SHARK_CAP = 2;
export const SHARK_MIN_SEPARATION = 2;
export const ERASER_HOLD_OFF_FRAMES = 180;
export const SWEEP_TARGET_FRAMES = 45;

/** Reservoir-sampled candidate cells kept per pool for spawn placement (research.md §3). */
const SPAWN_SAMPLE_SIZE = 8;

/** Frames a fading fish/shark takes to fully disappear once its fadeTimer starts. */
export const CREATURE_FADE_FRAMES = 30;
/** Cells/frame a drifting fish covers — a "steady glide" (FR-009), not a snap between cells. */
const FISH_SPEED = 0.06;
/** Multiplier applied to FISH_SPEED while a fish is scattering from a nearby shark (FR-018). */
const FISH_SCATTER_SPEED_MULT = 2.2;
const FISH_TURN_COOLDOWN_MIN = 90;
const FISH_TURN_COOLDOWN_MAX = 240;
/** Radians/frame the cosmetic bob offset advances (research.md §7 — never touches x/y). */
const BOB_SPEED = 0.12;
/** Cells/frame a shark covers while cruising or chasing — faster than a fish's drift. */
const SHARK_SPEED = 0.1;
/** Frames a chase runs before ending regardless of progress (FR-019, research.md §6: "~5s"). */
const SHARK_CHASE_DURATION = 300;
/** Frames after a chase ends during which the shark only drifts, never re-targeting (FR-019). */
const SHARK_CRUISE_COOLDOWN = 120;
/** Per-frame chance a cruising shark (no target) turns around on its own, like a fish's whim. */
const SHARK_RANDOM_TURN_CHANCE = 0.01;
/** Distance within which a shark's approach sets a fish scattering (FR-018). */
const SCATTER_TRIGGER_RANGE = 6;
/** Frames a scattered fish keeps using the faster shark-avoiding movement rule (FR-018). */
const SCATTER_DURATION = 24;

function sweepBudgetFor(grid: Grid): number {
  return Math.max(1, Math.ceil((grid.width * grid.height) / SWEEP_TARGET_FRAMES));
}

export function createSeaLifeState(grid: Grid): SeaLifeState {
  const size = grid.width * grid.height;
  return {
    fish: [],
    sharks: [],
    nextId: 0,
    poolId: new Int32Array(size).fill(-1),
    poolSize: [],
    spawnSample: [],
    sweepQueue: new Int32Array(size),
    sweepQueueHead: 0,
    sweepQueueTail: 0,
    sweepCursor: 0,
    sweepNextLabel: 0,
    sweepBudget: sweepBudgetFor(grid),
    eraserCooldowns: [],
  };
}

/**
 * Reallocates the sweep buffers to grid's (possibly new) dimensions and clears every creature —
 * used on every path that replaces grid's contents wholesale (resize, load, undo/redo, scene
 * switch), since fish/sharks are never saved or undo-tracked (FR-027, FR-029, FR-030).
 */
export function resetSeaLifeState(state: SeaLifeState, grid: Grid): void {
  const size = grid.width * grid.height;
  state.fish.length = 0;
  state.sharks.length = 0;
  state.eraserCooldowns.length = 0;
  state.poolId = new Int32Array(size).fill(-1);
  state.poolSize = [];
  state.spawnSample = [];
  state.sweepQueue = new Int32Array(size);
  state.sweepQueueHead = 0;
  state.sweepQueueTail = 0;
  state.sweepCursor = 0;
  state.sweepNextLabel = 0;
  state.sweepBudget = sweepBudgetFor(grid);
}

/** Restarts the sweep in place, reusing the already-allocated buffers (no reallocation). */
function beginNewSweep(state: SeaLifeState): void {
  state.poolId.fill(-1);
  state.poolSize = [];
  state.spawnSample = [];
  state.sweepQueueHead = 0;
  state.sweepQueueTail = 0;
  state.sweepCursor = 0;
  state.sweepNextLabel = 0;
}

/**
 * Labels cell `index` with `label`, updating that pool's running size and its reservoir-sampled
 * spawn candidates in the same pass (research.md §3) — no second per-pool scan is ever needed.
 */
function labelCell(state: SeaLifeState, label: number, index: number): void {
  state.poolId[index] = label;
  const n = ++state.poolSize[label];
  const sample = state.spawnSample[label];
  if (n <= SPAWN_SAMPLE_SIZE) {
    sample.push(index);
  } else {
    const r = Math.floor(Math.random() * n);
    if (r < SPAWN_SAMPLE_SIZE) sample[r] = index;
  }
}

function tryLabel(state: SeaLifeState, elements: Uint8Array, label: number, ni: number): void {
  if (state.poolId[ni] !== -1) return;
  if (elements[ni] !== WATER) return;
  labelCell(state, label, ni);
  state.sweepQueue[state.sweepQueueTail++] = ni;
}

/**
 * Advances the incremental, resumable pool-measurement flood-fill by up to `state.sweepBudget`
 * cells (research.md §1) — every cell *examined*, not just every cell labeled, counts against
 * the budget, so a mostly-empty grid can't scan past its budget for free while looking for the
 * next water cell to start a region from. 4-connectivity BFS over `grid.elements === WATER`,
 * using the reusable `sweepQueue`. Returns true once a full pass completes (cursor reaches the
 * grid's end with an empty queue) — never writes to `grid`.
 */
function advanceSweep(grid: Grid, state: SeaLifeState): boolean {
  const { width, height, elements } = grid;
  const total = width * height;
  let budget = state.sweepBudget;

  while (budget > 0) {
    if (state.sweepQueueHead < state.sweepQueueTail) {
      const i = state.sweepQueue[state.sweepQueueHead++];
      budget--;
      const label = state.poolId[i];
      const x = i % width;
      const y = (i / width) | 0;
      if (x > 0) tryLabel(state, elements, label, i - 1);
      if (x < width - 1) tryLabel(state, elements, label, i + 1);
      if (y > 0) tryLabel(state, elements, label, i - width);
      if (y < height - 1) tryLabel(state, elements, label, i + width);
      continue;
    }

    if (state.sweepCursor >= total) return true;

    const i = state.sweepCursor++;
    budget--;
    if (state.poolId[i] === -1 && elements[i] === WATER) {
      const label = state.sweepNextLabel++;
      state.poolSize.push(0);
      state.spawnSample.push([]);
      labelCell(state, label, i);
      state.sweepQueue[state.sweepQueueTail++] = i;
    }
  }

  return state.sweepQueueHead >= state.sweepQueueTail && state.sweepCursor >= total;
}

function cellIsWater(grid: Grid, x: number, y: number): boolean {
  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return false;
  return grid.elements[y * grid.width + x] === WATER;
}

/**
 * True if (x, y) is at least SHARK_MIN_SEPARATION from every live shark. The hard separation
 * floor (FR-017) has to hold regardless of which side initiates the approach, so both the
 * shark's own movement (research.md §6) and the fish's ordinary movement (below) reject a
 * candidate cell that would violate it — a fish drifting toward a stationary-ish shark is
 * exactly as much a violation as a shark closing in on a fish.
 */
function clearOfSharks(state: SeaLifeState, x: number, y: number): boolean {
  for (const shark of state.sharks) {
    if (shark.fadeTimer > 0) continue;
    if (Math.hypot(shark.x - x, shark.y - y) < SHARK_MIN_SEPARATION) return false;
  }
  return true;
}

function cellXY(grid: Grid, index: number): { x: number; y: number } {
  return { x: index % grid.width, y: Math.floor(index / grid.width) };
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function currentLabel(grid: Grid, state: SeaLifeState, x: number, y: number): number {
  const cx = Math.round(x);
  const cy = Math.round(y);
  if (cx < 0 || cx >= grid.width || cy < 0 || cy >= grid.height) return -1;
  return state.poolId[cy * grid.width + cx];
}

function hasCooldownIn(grid: Grid, state: SeaLifeState, label: number): boolean {
  for (const cooldown of state.eraserCooldowns) {
    if (currentLabel(grid, state, cooldown.x, cooldown.y) === label) return true;
  }
  return false;
}

/**
 * Picks a spawn cell from a pool's reservoir sample, preferring one at least `minDist` from
 * every position in `avoid` (keeps a fresh fish from landing right on top of a shark and vice
 * versa) — falls back to any sampled cell if none clear that distance.
 */
function pickSpawnIndex(
  grid: Grid,
  sample: number[] | undefined,
  avoid: ReadonlyArray<{ x: number; y: number }>,
  minDist: number,
): number | null {
  if (sample === undefined || sample.length === 0) return null;
  const candidates = sample.filter((index) => {
    const { x, y } = cellXY(grid, index);
    return avoid.every((a) => Math.hypot(a.x - x, a.y - y) >= minDist);
  });
  const pool = candidates.length > 0 ? candidates : sample;
  return pool[Math.floor(Math.random() * pool.length)];
}

function spawnFish(grid: Grid, state: SeaLifeState, label: number): void {
  const index = pickSpawnIndex(grid, state.spawnSample[label], state.sharks, SHARK_MIN_SEPARATION);
  if (index === null) return;
  const { x, y } = cellXY(grid, index);
  state.fish.push({
    id: state.nextId++,
    x,
    y,
    dirX: Math.random() < 0.5 ? -1 : 1,
    dirY: 0,
    bobPhase: Math.random() * Math.PI * 2,
    turnCooldown: randomInt(FISH_TURN_COOLDOWN_MIN, FISH_TURN_COOLDOWN_MAX),
    scatterTimer: 0,
    fadeTimer: 0,
  });
}

function spawnShark(grid: Grid, state: SeaLifeState, label: number): void {
  const index = pickSpawnIndex(grid, state.spawnSample[label], state.fish, SHARK_MIN_SEPARATION);
  if (index === null) return;
  const { x, y } = cellXY(grid, index);
  state.sharks.push({
    id: state.nextId++,
    x,
    y,
    facing: Math.random() < 0.5 ? -1 : 1,
    targetFishId: null,
    chaseTimer: 0,
    cruiseCooldown: 0,
    fadeTimer: 0,
  });
}

type Spawner = (grid: Grid, state: SeaLifeState, label: number) => void;

/**
 * Shared spawn/despawn target computation for one kind (fish or sharks) against the sweep's
 * freshly completed pool labeling: size-sorted (largest first), hysteresis-banded around the
 * spawn/despawn thresholds, clamped by the per-pool and global caps, and held (never grown)
 * for any pool a recent eraser removal still covers (research.md §4, §5).
 */
function reconcileKind<T extends { x: number; y: number; fadeTimer: number }>(
  grid: Grid,
  state: SeaLifeState,
  creatures: T[],
  despawnThreshold: number,
  spawnThreshold: number,
  perPoolCap: number,
  globalCap: number,
  spawn: Spawner,
): void {
  const byLabel = new Map<number, T[]>();
  for (const creature of creatures) {
    if (creature.fadeTimer > 0) continue;
    const label = currentLabel(grid, state, creature.x, creature.y);
    if (label === -1) continue;
    let list = byLabel.get(label);
    if (list === undefined) {
      list = [];
      byLabel.set(label, list);
    }
    list.push(creature);
  }

  const labels = new Set<number>(byLabel.keys());
  for (let label = 0; label < state.sweepNextLabel; label++) {
    if (state.poolSize[label] >= despawnThreshold) labels.add(label);
  }
  const sorted = Array.from(labels).sort((a, b) => state.poolSize[b] - state.poolSize[a]);

  let remaining = globalCap;
  const targets = new Map<number, number>();
  for (const label of sorted) {
    const size = state.poolSize[label];
    const current = byLabel.get(label)?.length ?? 0;
    let target: number;
    if (size >= spawnThreshold) {
      target = Math.min(Math.floor(size / spawnThreshold), perPoolCap);
    } else if (size >= despawnThreshold) {
      target = current; // hysteresis band: hold, absorbing a one-cell wobble at the threshold
    } else {
      target = 0;
    }
    if (hasCooldownIn(grid, state, label)) target = Math.min(target, current);
    target = Math.min(target, remaining);
    targets.set(label, target);
    remaining -= target;
  }

  for (const [label, list] of byLabel) {
    const target = targets.get(label) ?? 0;
    if (list.length > target) {
      const excess = list.length - target;
      for (let k = 0; k < excess; k++) list[list.length - 1 - k].fadeTimer = CREATURE_FADE_FRAMES;
    }
  }

  for (const [label, target] of targets) {
    const current = byLabel.get(label)?.length ?? 0;
    for (let k = current; k < target; k++) spawn(grid, state, label);
  }
}

/**
 * Spawns/despawns fish and sharks against the sweep's freshly completed labeling
 * (research.md §4).
 */
function reconcilePopulations(grid: Grid, state: SeaLifeState): void {
  reconcileKind(
    grid,
    state,
    state.fish,
    FISH_DESPAWN_THRESHOLD,
    FISH_SPAWN_THRESHOLD,
    FISH_PER_POOL_CAP,
    GLOBAL_FISH_CAP,
    spawnFish,
  );
  reconcileKind(
    grid,
    state,
    state.sharks,
    SHARK_DESPAWN_THRESHOLD,
    SHARK_SPAWN_THRESHOLD,
    SHARK_PER_POOL_CAP,
    GLOBAL_SHARK_CAP,
    spawnShark,
  );
}

/**
 * Picks a direction different from the fish's current one whenever a water-valid alternative
 * exists (FR-010's "sometimes change direction for no reason at all") — favors horizontal drift
 * since that's the common case, but falls back to any valid cardinal direction.
 */
function randomizeDirection(grid: Grid, fish: Fish): void {
  const cx = Math.round(fish.x);
  const cy = Math.round(fish.y);
  const options: Array<[-1 | 0 | 1, -1 | 0 | 1]> =
    Math.random() < 0.7
      ? [
          [1, 0],
          [-1, 0],
        ]
      : [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ];
  const candidates = options
    .filter(([dx, dy]) => dx !== fish.dirX || dy !== fish.dirY)
    .sort(() => Math.random() - 0.5);
  for (const [dx, dy] of candidates) {
    if (cellIsWater(grid, cx + dx, cy + dy)) {
      fish.dirX = dx;
      fish.dirY = dy;
      return;
    }
  }
}

/**
 * Advances one live (non-fading) fish by one frame: an immediate safety check that its own cell
 * is still water (starting a fade the instant it isn't, research.md §2), then bob/turn/glide —
 * movement only ever commits into a candidate cell that is WATER right now, reversing rather
 * than passing through a wall or a pool's edge (the cell just left is guaranteed water).
 */
function fishCanEnter(grid: Grid, state: SeaLifeState, x: number, y: number): boolean {
  return cellIsWater(grid, Math.round(x), Math.round(y)) && clearOfSharks(state, x, y);
}

function stepFishAlive(grid: Grid, state: SeaLifeState, fish: Fish): void {
  const cx = Math.round(fish.x);
  const cy = Math.round(fish.y);
  if (!cellIsWater(grid, cx, cy)) {
    fish.fadeTimer = CREATURE_FADE_FRAMES;
    return;
  }

  fish.bobPhase = (fish.bobPhase + BOB_SPEED) % (Math.PI * 2);
  if (fish.scatterTimer > 0) fish.scatterTimer--;

  if (fish.turnCooldown > 0) {
    fish.turnCooldown--;
  } else {
    randomizeDirection(grid, fish);
    fish.turnCooldown = randomInt(FISH_TURN_COOLDOWN_MIN, FISH_TURN_COOLDOWN_MAX);
  }

  if (fish.dirX === 0 && fish.dirY === 0) return;

  const speed = fish.scatterTimer > 0 ? FISH_SPEED * FISH_SCATTER_SPEED_MULT : FISH_SPEED;
  let nx = fish.x + fish.dirX * speed;
  let ny = fish.y + fish.dirY * speed;
  if (fishCanEnter(grid, state, nx, ny)) {
    fish.x = nx;
    fish.y = ny;
    return;
  }

  fish.dirX = (fish.dirX * -1) as -1 | 0 | 1;
  fish.dirY = (fish.dirY * -1) as -1 | 0 | 1;
  nx = fish.x + fish.dirX * speed;
  ny = fish.y + fish.dirY * speed;
  if (fishCanEnter(grid, state, nx, ny)) {
    fish.x = nx;
    fish.y = ny;
  }
}

/**
 * Turns a nearby fish (and anything else close enough to the shark) away in a short burst
 * (FR-018) — a fish already scattering just gets its timer refreshed, not re-triggered oddly.
 */
function scatterFishFrom(grid: Grid, fish: Fish, shark: Shark): void {
  fish.scatterTimer = SCATTER_DURATION;
  let dirX = Math.sign(fish.x - shark.x) as -1 | 0 | 1;
  const dirY = Math.sign(fish.y - shark.y) as -1 | 0 | 1;
  if (dirX === 0 && dirY === 0) dirX = fish.dirX !== 0 ? fish.dirX : 1;

  if (dirX !== 0 && cellIsWater(grid, Math.round(fish.x) + dirX, Math.round(fish.y))) {
    fish.dirX = dirX;
    fish.dirY = 0;
  } else if (dirY !== 0 && cellIsWater(grid, Math.round(fish.x), Math.round(fish.y) + dirY)) {
    fish.dirX = 0;
    fish.dirY = dirY;
  }
  // Otherwise leave direction as-is — the ordinary movement water-check next tick will turn it.
}

function applyScatter(grid: Grid, state: SeaLifeState, shark: Shark): void {
  for (const fish of state.fish) {
    if (fish.fadeTimer > 0) continue;
    if (Math.hypot(fish.x - shark.x, fish.y - shark.y) < SCATTER_TRIGGER_RANGE) {
      scatterFishFrom(grid, fish, shark);
    }
  }
}

/**
 * Moves a shark one frame toward its target (if any) or cruising in its facing direction —
 * a candidate move is rejected outright, not merely discouraged, if it would bring the shark
 * within SHARK_MIN_SEPARATION of *any* live fish (research.md §6, FR-017's hard floor).
 */
function moveShark(grid: Grid, state: SeaLifeState, shark: Shark): void {
  const target =
    shark.targetFishId !== null
      ? (state.fish.find((f) => f.id === shark.targetFishId && f.fadeTimer === 0) ?? null)
      : null;

  let dirX: number;
  let dirY: number;
  if (target) {
    dirX = Math.sign(target.x - shark.x);
    dirY = Math.sign(target.y - shark.y);
    if (dirX === 0 && dirY === 0) return;
  } else {
    if (Math.random() < SHARK_RANDOM_TURN_CHANCE) shark.facing = shark.facing === 1 ? -1 : 1;
    dirX = shark.facing;
    dirY = 0;
  }

  const nx = shark.x + dirX * SHARK_SPEED;
  const ny = shark.y + dirY * SHARK_SPEED;

  if (!cellIsWater(grid, Math.round(nx), Math.round(ny))) {
    if (!target) shark.facing = shark.facing === 1 ? -1 : 1;
    return;
  }
  for (const fish of state.fish) {
    if (fish.fadeTimer > 0) continue;
    if (Math.hypot(fish.x - nx, fish.y - ny) < SHARK_MIN_SEPARATION) return;
  }

  shark.x = nx;
  shark.y = ny;
  if (dirX !== 0) shark.facing = dirX > 0 ? 1 : -1;
}

/**
 * Advances one live (non-fading) shark by one frame: the same immediate own-cell water check as
 * a fish, then chase AI (pick the globally nearest live fish, chase it for ~5s, then cruise
 * before picking a new one — research.md §6) and movement, then the scatter reaction on any
 * fish it closes on.
 */
function stepSharkAlive(grid: Grid, state: SeaLifeState, shark: Shark): void {
  const cx = Math.round(shark.x);
  const cy = Math.round(shark.y);
  if (!cellIsWater(grid, cx, cy)) {
    shark.fadeTimer = CREATURE_FADE_FRAMES;
    return;
  }

  if (shark.cruiseCooldown > 0) shark.cruiseCooldown--;

  if (shark.targetFishId !== null) {
    const target = state.fish.find((f) => f.id === shark.targetFishId && f.fadeTimer === 0);
    if (!target) {
      shark.targetFishId = null;
      shark.chaseTimer = 0;
      shark.cruiseCooldown = SHARK_CRUISE_COOLDOWN;
    } else {
      shark.chaseTimer--;
      if (shark.chaseTimer <= 0) {
        shark.targetFishId = null;
        shark.cruiseCooldown = SHARK_CRUISE_COOLDOWN;
      }
    }
  }

  if (
    shark.targetFishId === null &&
    shark.cruiseCooldown === 0 &&
    state.fish.some((f) => f.fadeTimer === 0)
  ) {
    let best: Fish | null = null;
    let bestDist = Infinity;
    for (const fish of state.fish) {
      if (fish.fadeTimer > 0) continue;
      const dist = Math.hypot(fish.x - shark.x, fish.y - shark.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = fish;
      }
    }
    if (best) {
      shark.targetFishId = best.id;
      shark.chaseTimer = SHARK_CHASE_DURATION;
    }
  }

  moveShark(grid, state, shark);
  applyScatter(grid, state, shark);
}

/**
 * One frame: ages out expired eraser cooldowns, advances the pool sweep (running reconciliation
 * and restarting the sweep whenever a pass completes), and steps every fish/shark's
 * fade/movement/AI. Never writes to any `Grid` array (FR-012).
 */
export function stepSeaLife(grid: Grid, state: SeaLifeState): void {
  for (let i = state.eraserCooldowns.length - 1; i >= 0; i--) {
    const cooldown = state.eraserCooldowns[i];
    cooldown.framesRemaining--;
    if (cooldown.framesRemaining <= 0) state.eraserCooldowns.splice(i, 1);
  }

  if (advanceSweep(grid, state)) {
    reconcilePopulations(grid, state);
    beginNewSweep(state);
  }

  for (let i = state.fish.length - 1; i >= 0; i--) {
    const fish = state.fish[i];
    if (fish.fadeTimer > 0) {
      fish.fadeTimer--;
      if (fish.fadeTimer <= 0) state.fish.splice(i, 1);
      continue;
    }
    stepFishAlive(grid, state, fish);
  }

  for (let i = state.sharks.length - 1; i >= 0; i--) {
    const shark = state.sharks[i];
    if (shark.fadeTimer > 0) {
      shark.fadeTimer--;
      if (shark.fadeTimer <= 0) state.sharks.splice(i, 1);
      continue;
    }
    stepSharkAlive(grid, state, shark);
  }
}
