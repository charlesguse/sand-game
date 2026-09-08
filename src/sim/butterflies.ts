import { FLOWER, type Grid } from './types';

export const BUTTERFLY_CAP = 4;
export const FLOWERS_PER_BUTTERFLY = 4;
export const ERASE_HOLDOFF_MS = 3000;
/** Frames for one full amortized flower scan pass — about a second at the 60fps target (research.md §1). */
export const FLOWER_SCAN_PASS_FRAMES = 60;

/** Cells travelled per frame while travelling — a slow, decorative float. */
const FLIGHT_SPEED = 0.12;
/** Distance at which a travelling butterfly is considered arrived. */
const ARRIVE_RADIUS = 0.5;
/** How sharply the travelling heading curves away from the straight bearing to target. */
const WOBBLE_MAGNITUDE = 0.7;
/** Per-frame phase advance driving both the visit hover and the travel wobble. */
const WOBBLE_SPEED = 0.15;
const VISIT_DWELL_MIN = 120;
const VISIT_DWELL_RANGE = 120;
const HOVER_RADIUS = 0.7;

export interface Butterfly {
  readonly id: number;
  x: number;
  y: number;
  state: 'visiting' | 'travelling';
  targetX: number;
  targetY: number;
  headingRadians: number;
  wobblePhase: number;
  timer: number;
  facing: 1 | -1;
}

interface FlowerScanState {
  known: { x: number; y: number }[];
  buffer: { x: number; y: number }[];
  nextRow: number;
}

export interface ButterfliesState {
  butterflies: Butterfly[];
  nextId: number;
  flowerScan: FlowerScanState;
  recentErasesAt: number[];
}

export function createButterfliesState(): ButterfliesState {
  return {
    butterflies: [],
    nextId: 0,
    flowerScan: { known: [], buffer: [], nextRow: 0 },
    recentErasesAt: [],
  };
}

function desiredButterflyCount(knownFlowerCount: number): number {
  return knownFlowerCount === 0 ? 0 : Math.min(BUTTERFLY_CAP, Math.ceil(knownFlowerCount / FLOWERS_PER_BUTTERFLY));
}

function dwellDuration(): number {
  return Math.floor(VISIT_DWELL_MIN + Math.random() * VISIT_DWELL_RANGE);
}

/**
 * Scans a bounded number of grid rows per call, appending every FLOWER cell found to the
 * in-progress buffer; when nextRow reaches grid.height the buffer atomically replaces `known`
 * and a fresh pass begins. Returns true iff a pass just completed this call.
 */
function advanceFlowerScan(grid: Grid, scan: FlowerScanState): boolean {
  const rowsPerFrame = Math.max(1, Math.ceil(grid.height / FLOWER_SCAN_PASS_FRAMES));
  for (let i = 0; i < rowsPerFrame && scan.nextRow < grid.height; i++) {
    const row = scan.nextRow;
    const rowStart = row * grid.width;
    for (let x = 0; x < grid.width; x++) {
      if (grid.elements[rowStart + x] === FLOWER) scan.buffer.push({ x, y: row });
    }
    scan.nextRow++;
  }
  if (scan.nextRow >= grid.height) {
    scan.known = scan.buffer;
    scan.buffer = [];
    scan.nextRow = 0;
    return true;
  }
  return false;
}

function pruneRecentErases(state: ButterfliesState, now: number): void {
  state.recentErasesAt = state.recentErasesAt.filter((t) => now - t < ERASE_HOLDOFF_MS);
}

function spawnButterfly(state: ButterfliesState, known: { x: number; y: number }[]): void {
  const flower = known[Math.floor(Math.random() * known.length)];
  const id = state.nextId++;
  state.butterflies.push({
    id,
    x: flower.x,
    y: flower.y,
    state: 'visiting',
    targetX: flower.x,
    targetY: flower.y,
    headingRadians: 0,
    wobblePhase: id * 0.9,
    timer: dwellDuration(),
    facing: 1,
  });
}

/** Picks a new target flower from `known`, preferring one different from the current target. */
function pickNewTarget(b: Butterfly, known: { x: number; y: number }[]): void {
  let flower = known[Math.floor(Math.random() * known.length)];
  if (known.length > 1) {
    let attempts = 0;
    while (flower.x === b.targetX && flower.y === b.targetY && attempts < 8) {
      flower = known[Math.floor(Math.random() * known.length)];
      attempts++;
    }
  }
  b.targetX = flower.x;
  b.targetY = flower.y;
  b.state = 'travelling';
}

function clampPosition(grid: Grid, b: Butterfly): void {
  const maxX = grid.width - 0.001;
  const maxY = grid.height - 0.001;
  b.x = Math.min(Math.max(b.x, 0), maxX);
  b.y = Math.min(Math.max(b.y, 0), maxY);
}

function isFlowerAt(grid: Grid, x: number, y: number): boolean {
  const cx = Math.round(x);
  const cy = Math.round(y);
  if (cx < 0 || cx >= grid.width || cy < 0 || cy >= grid.height) return false;
  return grid.elements[cy * grid.width + cx] === FLOWER;
}

/** Advances one butterfly by one frame. Never reads/writes grid except the single arrival recheck. */
function stepButterfly(grid: Grid, b: Butterfly, known: { x: number; y: number }[]): void {
  b.wobblePhase += WOBBLE_SPEED;

  if (b.state === 'visiting') {
    b.x = b.targetX + Math.sin(b.wobblePhase) * HOVER_RADIUS;
    b.y = b.targetY - Math.abs(Math.cos(b.wobblePhase * 0.6)) * HOVER_RADIUS;
    b.timer--;
    if (b.timer <= 0 && known.length > 0) pickNewTarget(b, known);
    clampPosition(grid, b);
    return;
  }

  const dx = b.targetX - b.x;
  const dy = b.targetY - b.y;
  const dist = Math.hypot(dx, dy);

  if (dist <= ARRIVE_RADIUS) {
    // The scan may have completed since this flight began; a single live-cell recheck here
    // catches a flower that vanished after the last completed pass but before arrival.
    if (isFlowerAt(grid, b.targetX, b.targetY)) {
      b.state = 'visiting';
      b.x = b.targetX;
      b.y = b.targetY;
      b.timer = dwellDuration();
    } else if (known.length > 0) {
      pickNewTarget(b, known);
    }
    clampPosition(grid, b);
    return;
  }

  const bearing = Math.atan2(dy, dx);
  const wobble = Math.sin(b.wobblePhase * 2.1 + b.id) * WOBBLE_MAGNITUDE;
  b.headingRadians = bearing + wobble;
  b.facing = Math.cos(b.headingRadians) >= 0 ? 1 : -1;
  b.x += Math.cos(b.headingRadians) * FLIGHT_SPEED;
  b.y += Math.sin(b.headingRadians) * FLIGHT_SPEED;
  clampPosition(grid, b);
}

/**
 * Advances the flower scan by its per-frame bounded row budget, updates population against the
 * (possibly just-refreshed) known flower list, and steps every butterfly's visit/travel state
 * machine one frame. Never writes to `grid`.
 */
export function stepButterflies(grid: Grid, state: ButterfliesState, now: number): void {
  const passCompleted = advanceFlowerScan(grid, state.flowerScan);
  pruneRecentErases(state, now);

  const known = state.flowerScan.known;
  const desired = desiredButterflyCount(known.length);

  if (state.butterflies.length > desired) {
    state.butterflies.length = desired;
  }

  // Recent eraser removals suppress exactly that many spawn slots for ERASE_HOLDOFF_MS, rather
  // than blocking the whole population (research.md §6).
  const spawnTarget = Math.max(0, desired - state.recentErasesAt.length);
  while (state.butterflies.length < spawnTarget && known.length > 0) {
    spawnButterfly(state, known);
  }

  if (passCompleted) {
    for (const b of state.butterflies) {
      if (b.state === 'travelling' && !known.some((f) => f.x === b.targetX && f.y === b.targetY)) {
        if (known.length > 0) pickNewTarget(b, known);
      }
    }
  }

  for (const b of state.butterflies) stepButterfly(grid, b, known);
}

/** Removes every butterfly within `radius` of (cx, cy); each removal records `now` into `recentErasesAt`. */
export function eraseButterfliesInBrush(
  state: ButterfliesState,
  cx: number,
  cy: number,
  radius: number,
  now: number,
): void {
  for (let i = state.butterflies.length - 1; i >= 0; i--) {
    const b = state.butterflies[i];
    if (Math.hypot(b.x - cx, b.y - cy) <= radius) {
      state.butterflies.splice(i, 1);
      state.recentErasesAt.push(now);
    }
  }
}

/** Bresenham-interpolated form of eraseButterfliesInBrush, mirroring objects.ts's eraseObjectsInBrushLine. */
export function eraseButterfliesInBrushLine(
  state: ButterfliesState,
  from: { x: number; y: number },
  to: { x: number; y: number },
  radius: number,
  now: number,
): void {
  let x0 = Math.round(from.x);
  let y0 = Math.round(from.y);
  const x1 = Math.round(to.x);
  const y1 = Math.round(to.y);

  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;

  for (;;) {
    eraseButterfliesInBrush(state, x0, y0, radius, now);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/** Empties `butterflies` and resets the flower scan cursor, without touching `grid`. */
export function clearButterflies(state: ButterfliesState): void {
  state.butterflies.length = 0;
  state.flowerScan.known = [];
  state.flowerScan.buffer = [];
  state.flowerScan.nextRow = 0;
}
