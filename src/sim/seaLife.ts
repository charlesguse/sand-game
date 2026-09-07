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

/**
 * Spawns/despawns fish and sharks against the sweep's freshly completed labeling
 * (research.md §4). Filled in by the fish and shark user stories; a completed sweep with no
 * creatures yet simply has nothing to do.
 */
function reconcilePopulations(_grid: Grid, _state: SeaLifeState): void {
  // No-op until User Story 1 (fish) and User Story 2 (shark) add their reconciliation rules.
}

/**
 * One frame: ages out expired eraser cooldowns, advances the pool sweep (running reconciliation
 * and restarting the sweep whenever a pass completes), and — once user stories land — steps
 * every fish/shark's fade/movement/AI. Never writes to any `Grid` array (FR-012).
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
}
