import { OBJECT_FOOTPRINT_SIZE } from '../lib/layout';
import type { PlacedObject } from './types';

export const BIRD_CAP = 3;

const ERASE_HOLDOFF_MS = 3000;
const PERCH_DWELL_MIN = 120;
const PERCH_DWELL_RANGE = 180;
const HOP_DURATION = 20;
const HOP_DISTANCE = 1.2;
/** A couple of seconds at the 60fps target. */
const FLIGHT_DURATION_FRAMES = 150;
const ARC_HEIGHT_CELLS = 6;
const LOOP_HEIGHT_CELLS = 5;
const LOOP_RADIUS_CELLS = 4;

export interface Bird {
  readonly id: number;
  palmId: number;
  destPalmId: number;
  x: number;
  y: number;
  state: 'perched' | 'hopping' | 'flying';
  timer: number;
  flightProgress: number;
  takeoffX: number;
  takeoffY: number;
  facing: 1 | -1;
}

export interface BirdsState {
  byPalmId: Map<number, Bird>;
  nextId: number;
  holdoffUntilByPalmId: Map<number, number>;
}

export function createBirdsState(): BirdsState {
  return { byPalmId: new Map(), nextId: 0, holdoffUntilByPalmId: new Map() };
}

function perchDwell(): number {
  return Math.floor(PERCH_DWELL_MIN + Math.random() * PERCH_DWELL_RANGE);
}

function pruneHoldoffs(state: BirdsState, now: number): void {
  for (const [palmId, until] of state.holdoffUntilByPalmId) {
    if (now >= until) state.holdoffUntilByPalmId.delete(palmId);
  }
}

/** Mostly flies to a different live palm when one exists; occasionally loops back to its own. */
function pickFlightDestination(palms: readonly PlacedObject[], originId: number): PlacedObject {
  const origin = palms.find((p) => p.id === originId);
  const others = palms.filter((p) => p.id !== originId);
  if (others.length === 0) return origin ?? palms[0];
  if (origin !== undefined && Math.random() < 0.3) return origin;
  return others[Math.floor(Math.random() * others.length)];
}

/**
 * Advances a flying bird's position along a quadratic-Bézier arc (two distinct palms) or a
 * closed sinusoidal loop (same start/destination palm), each clamped by the flight's own
 * start/end heights and destination footprint so every sampled point is in-bounds by
 * construction (research.md §7) — no Grid reference is needed for this.
 */
function stepFlight(palms: readonly PlacedObject[], state: BirdsState, bird: Bird): void {
  bird.flightProgress = Math.min(1, bird.flightProgress + 1 / FLIGHT_DURATION_FRAMES);
  const dest = palms.find((p) => p.id === bird.destPalmId);
  const destX = dest ? dest.x + dest.size / 2 : bird.takeoffX;
  const destY = dest ? dest.y : bird.takeoffY;
  const t = bird.flightProgress;
  const loop = bird.destPalmId === bird.palmId;

  let x: number;
  let y: number;
  if (loop) {
    const loopRadiusX = Math.min(LOOP_RADIUS_CELLS, (dest ? dest.size : OBJECT_FOOTPRINT_SIZE) / 2);
    const loopHeight = Math.min(LOOP_HEIGHT_CELLS, destY);
    const angle = 2 * Math.PI * t;
    x = destX + loopRadiusX * Math.sin(angle);
    y = destY - (loopHeight * (1 - Math.cos(angle))) / 2;
  } else {
    const arcHeight = Math.min(ARC_HEIGHT_CELLS, bird.takeoffY, destY);
    const midX = (bird.takeoffX + destX) / 2;
    const midY = (bird.takeoffY + destY) / 2 - arcHeight;
    const oneMinusT = 1 - t;
    x = oneMinusT * oneMinusT * bird.takeoffX + 2 * oneMinusT * t * midX + t * t * destX;
    y = oneMinusT * oneMinusT * bird.takeoffY + 2 * oneMinusT * t * midY + t * t * destY;
  }

  bird.facing = x >= bird.x ? 1 : -1;
  bird.x = x;
  bird.y = y;

  if (bird.flightProgress >= 1) {
    if (dest) {
      if (bird.palmId !== dest.id) {
        state.byPalmId.delete(bird.palmId);
        state.byPalmId.set(dest.id, bird);
      }
      bird.palmId = dest.id;
      bird.x = destX;
      bird.y = destY;
      bird.state = 'perched';
      bird.timer = perchDwell();
    } else {
      // destPalmId vanished in the same frame it was last validated — remove rather than
      // strand it flying forever.
      state.byPalmId.delete(bird.palmId);
    }
  }
}

/** Advances a perched/hopping bird by one frame; position always derives from the live palm's anchor. */
function stepPerchedOrHopping(palms: readonly PlacedObject[], bird: Bird): void {
  const palm = palms.find((p) => p.id === bird.palmId);
  const anchorX = palm ? palm.x + palm.size / 2 : bird.x;
  const anchorY = palm ? palm.y : bird.y;

  if (bird.state === 'hopping') {
    bird.timer--;
    const hopPhase = 1 - Math.max(0, bird.timer) / HOP_DURATION;
    const hopHeight = Math.min(0.4, anchorY);
    bird.x = anchorX + Math.sin(hopPhase * Math.PI) * HOP_DISTANCE * bird.facing;
    bird.y = anchorY - Math.sin(hopPhase * Math.PI) * hopHeight;
    if (bird.timer <= 0) {
      bird.state = 'perched';
      bird.x = anchorX;
      bird.y = anchorY;
      bird.timer = perchDwell();
    }
    return;
  }

  bird.x = anchorX;
  bird.y = anchorY;
  bird.timer--;
  if (bird.timer > 0) return;

  if (Math.random() < 0.5) {
    bird.facing = Math.random() < 0.5 ? 1 : -1;
    bird.state = 'hopping';
    bird.timer = HOP_DURATION;
    return;
  }

  const dest = pickFlightDestination(palms, bird.palmId);
  bird.takeoffX = anchorX;
  bird.takeoffY = anchorY;
  bird.destPalmId = dest.id;
  bird.flightProgress = 0;
  bird.state = 'flying';
}

/**
 * Ensures every live, non-held-off palm (up to BIRD_CAP total birds) has a bird; retargets or
 * removes any bird whose owning/destination palm no longer exists; steps every bird's
 * perch/hop/flight state machine one frame. Reads `palms` only — never writes to it or to any Grid.
 */
export function stepBirds(palms: readonly PlacedObject[], state: BirdsState, now: number): void {
  pruneHoldoffs(state, now);
  const liveIds = new Set(palms.map((p) => p.id));

  const claimed = new Set<number>();
  for (const bird of state.byPalmId.values()) {
    const ownerId = bird.state === 'flying' ? bird.destPalmId : bird.palmId;
    if (liveIds.has(ownerId)) claimed.add(ownerId);
  }

  for (const bird of [...state.byPalmId.values()]) {
    const ownerId = bird.state === 'flying' ? bird.destPalmId : bird.palmId;
    if (liveIds.has(ownerId)) continue;

    const fallback = palms.find((p) => !claimed.has(p.id));
    if (fallback === undefined) {
      state.byPalmId.delete(bird.palmId);
      continue;
    }
    claimed.add(fallback.id);
    if (bird.state !== 'flying') {
      bird.takeoffX = bird.x;
      bird.takeoffY = bird.y;
      bird.flightProgress = 0;
      bird.state = 'flying';
    }
    bird.destPalmId = fallback.id;
  }

  for (const palm of palms) {
    if (state.byPalmId.size >= BIRD_CAP) break;
    if (claimed.has(palm.id)) continue;
    const holdoff = state.holdoffUntilByPalmId.get(palm.id);
    if (holdoff !== undefined && now < holdoff) continue;
    claimed.add(palm.id);
    const id = state.nextId++;
    state.byPalmId.set(palm.id, {
      id,
      palmId: palm.id,
      destPalmId: palm.id,
      x: palm.x + palm.size / 2,
      y: palm.y,
      state: 'perched',
      timer: perchDwell(),
      flightProgress: 0,
      takeoffX: 0,
      takeoffY: 0,
      facing: 1,
    });
  }

  for (const bird of [...state.byPalmId.values()]) {
    if (bird.state === 'flying') {
      stepFlight(palms, state, bird);
    } else {
      stepPerchedOrHopping(palms, bird);
    }
  }
}

/** Removes every bird within `radius` of (cx, cy); each removal sets a hold-off for that bird's palmId. */
export function eraseBirdsInBrush(state: BirdsState, cx: number, cy: number, radius: number, now: number): void {
  for (const [palmId, bird] of [...state.byPalmId]) {
    if (Math.hypot(bird.x - cx, bird.y - cy) <= radius) {
      state.byPalmId.delete(palmId);
      state.holdoffUntilByPalmId.set(bird.palmId, now + ERASE_HOLDOFF_MS);
    }
  }
}

/** Line-interpolated form of eraseBirdsInBrush, mirroring eraseObjectsInBrushLine. */
export function eraseBirdsInBrushLine(
  state: BirdsState,
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
    eraseBirdsInBrush(state, x0, y0, radius, now);
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

/** Empties byPalmId and holdoffUntilByPalmId. */
export function clearBirds(state: BirdsState): void {
  state.byPalmId.clear();
  state.holdoffUntilByPalmId.clear();
}
