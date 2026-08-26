import { OBJECT_FOOTPRINT_SIZE } from '../lib/layout';
import {
  EMPTY,
  SAND,
  WATER,
  DIRT,
  RAINBOW_SAND,
  OBJECT,
  type Grid,
  type ObjectKind,
  type ObjectsState,
  type PlacedObject,
} from './types';

export function createObjectsState(): ObjectsState {
  return { rainbows: [], unicorns: [], nextId: 0 };
}

function randomHue(): number {
  return Math.floor(Math.random() * 256);
}

/** For each rainbow, converts any SAND/DIRT/WATER cell in its zone to RAINBOW_SAND with a fresh hue. Allocates nothing. */
export function applyRainbowConversions(grid: Grid, rainbows: PlacedObject[]): void {
  for (const rainbow of rainbows) {
    const minX = Math.max(0, rainbow.x - 1);
    const maxX = Math.min(grid.width - 1, rainbow.x + rainbow.size);
    const minY = Math.max(0, rainbow.y - 1);
    const maxY = Math.min(grid.height - 1, rainbow.y + rainbow.size);

    for (let py = minY; py <= maxY; py++) {
      const inFootprintRow = py >= rainbow.y && py < rainbow.y + rainbow.size;
      for (let px = minX; px <= maxX; px++) {
        if (inFootprintRow && px >= rainbow.x && px < rainbow.x + rainbow.size) continue;
        const i = py * grid.width + px;
        const element = grid.elements[i];
        if (element === SAND || element === DIRT || element === WATER) {
          grid.elements[i] = RAINBOW_SAND;
          grid.hues[i] = randomHue();
        }
      }
    }
  }
}

function listFor(state: ObjectsState, kind: ObjectKind): PlacedObject[] {
  return kind === 'rainbow' ? state.rainbows : state.unicorns;
}

function isCoveredByAnyObject(state: ObjectsState, px: number, py: number): boolean {
  for (const o of state.rainbows) {
    if (px >= o.x && px < o.x + o.size && py >= o.y && py < o.y + o.size) return true;
  }
  for (const o of state.unicorns) {
    if (px >= o.x && px < o.x + o.size && py >= o.y && py < o.y + o.size) return true;
  }
  return false;
}

/** Places a new object, nudged to fit on-grid, evicting the oldest of its kind if already at the cap of 3. */
export function placeObject(
  grid: Grid,
  state: ObjectsState,
  kind: ObjectKind,
  cx: number,
  cy: number,
): void {
  const size = OBJECT_FOOTPRINT_SIZE;
  let x = Math.round(cx - size / 2);
  let y = Math.round(cy - size / 2);
  x = Math.max(0, Math.min(x, grid.width - size));
  y = Math.max(0, Math.min(y, grid.height - size));

  const list = listFor(state, kind);
  if (list.length >= 3) {
    removeObject(grid, state, list[0]);
  }

  for (let py = y; py < y + size; py++) {
    for (let px = x; px < x + size; px++) {
      grid.elements[py * grid.width + px] = OBJECT;
    }
  }

  list.push({ id: state.nextId++, kind, x, y, size });
}

/** Removes obj from its list; releases footprint cells to EMPTY unless another live object still covers them. */
export function removeObject(grid: Grid, state: ObjectsState, obj: PlacedObject): void {
  const list = listFor(state, obj.kind);
  const idx = list.findIndex((o) => o.id === obj.id);
  if (idx !== -1) list.splice(idx, 1);

  for (let py = obj.y; py < obj.y + obj.size; py++) {
    for (let px = obj.x; px < obj.x + obj.size; px++) {
      if (isCoveredByAnyObject(state, px, py)) continue;
      const i = py * grid.width + px;
      grid.elements[i] = EMPTY;
    }
  }
}

/** True if any cell in the unicorn's zone holds an element (not EMPTY, not OBJECT). Allocates nothing. */
export function isUnicornTouched(grid: Grid, unicorn: PlacedObject): boolean {
  const minX = Math.max(0, unicorn.x - 1);
  const maxX = Math.min(grid.width - 1, unicorn.x + unicorn.size);
  const minY = Math.max(0, unicorn.y - 1);
  const maxY = Math.min(grid.height - 1, unicorn.y + unicorn.size);

  for (let py = minY; py <= maxY; py++) {
    const inFootprintRow = py >= unicorn.y && py < unicorn.y + unicorn.size;
    for (let px = minX; px <= maxX; px++) {
      if (inFootprintRow && px >= unicorn.x && px < unicorn.x + unicorn.size) continue;
      const element = grid.elements[py * grid.width + px];
      if (element !== EMPTY && element !== OBJECT) return true;
    }
  }
  return false;
}

/** True if any cell of obj's footprint lies within the circle of the given radius centered at (cx, cy). */
export function footprintIntersectsCircle(obj: PlacedObject, cx: number, cy: number, radius: number): boolean {
  const closestX = Math.max(obj.x, Math.min(cx, obj.x + obj.size - 1));
  const closestY = Math.max(obj.y, Math.min(cy, obj.y + obj.size - 1));
  const dx = closestX - cx;
  const dy = closestY - cy;
  return dx * dx + dy * dy <= radius * radius;
}

/** Removes, in whole, every object whose footprint touches the eraser brush's circular coverage. Allocates nothing. */
export function eraseObjectsInBrush(
  grid: Grid,
  state: ObjectsState,
  cx: number,
  cy: number,
  radius: number,
): void {
  for (let i = state.rainbows.length - 1; i >= 0; i--) {
    const obj = state.rainbows[i];
    if (footprintIntersectsCircle(obj, cx, cy, radius)) removeObject(grid, state, obj);
  }
  for (let i = state.unicorns.length - 1; i >= 0; i--) {
    const obj = state.unicorns[i];
    if (footprintIntersectsCircle(obj, cx, cy, radius)) removeObject(grid, state, obj);
  }
}

/** Applies eraseObjectsInBrush along every point on the line from `from` to `to`, Bresenham-interpolated the same way applyBrushLine works, so a fast eraser drag whose consecutive pointer samples straddle an object's footprint cannot skip over it. */
export function eraseObjectsInBrushLine(
  grid: Grid,
  state: ObjectsState,
  from: { x: number; y: number },
  to: { x: number; y: number },
  radius: number,
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
    eraseObjectsInBrush(grid, state, x0, y0, radius);
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

/** Resets both object lists to empty without touching grid. */
export function clearObjects(state: ObjectsState): void {
  state.rainbows = [];
  state.unicorns = [];
}
