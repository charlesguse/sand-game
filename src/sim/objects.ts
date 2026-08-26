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

/** Visits every in-bounds cell at Chebyshev distance 1 from obj's footprint, excluding the footprint itself. */
function forEachZoneCell(
  grid: Grid,
  obj: { x: number; y: number; size: number },
  fn: (i: number) => void,
): void {
  const minX = obj.x - 1;
  const maxX = obj.x + obj.size;
  const minY = obj.y - 1;
  const maxY = obj.y + obj.size;

  for (let py = minY; py <= maxY; py++) {
    if (py < 0 || py >= grid.height) continue;
    const inFootprintRow = py >= obj.y && py < obj.y + obj.size;
    for (let px = minX; px <= maxX; px++) {
      if (px < 0 || px >= grid.width) continue;
      if (inFootprintRow && px >= obj.x && px < obj.x + obj.size) continue;
      fn(py * grid.width + px);
    }
  }
}

function randomHue(): number {
  return Math.floor(Math.random() * 256);
}

/** For each rainbow, converts any SAND/DIRT/WATER cell in its zone to RAINBOW_SAND with a fresh hue. */
export function applyRainbowConversions(grid: Grid, rainbows: PlacedObject[]): void {
  for (const rainbow of rainbows) {
    forEachZoneCell(grid, rainbow, (i) => {
      const element = grid.elements[i];
      if (element === SAND || element === DIRT || element === WATER) {
        grid.elements[i] = RAINBOW_SAND;
        grid.hues[i] = randomHue();
      }
    });
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

/** True if any cell in the unicorn's zone holds an element (not EMPTY, not OBJECT). */
export function isUnicornTouched(grid: Grid, unicorn: PlacedObject): boolean {
  let touched = false;
  forEachZoneCell(grid, unicorn, (i) => {
    const element = grid.elements[i];
    if (element !== EMPTY && element !== OBJECT) touched = true;
  });
  return touched;
}
