import {
  EMPTY,
  OBJECT,
  RAINBOW_SAND,
  STAR_POWER,
  type Grid,
  type ObjectsState,
  type PlacedObject,
} from './types';
import { setCell, setGlitter } from './grid';
import { forEachFootprintCell } from './brush';
import { footprintIntersectsCircle } from './objects';

/** ~1-in-5 position-only lattice — never depends on Math.random() or call history (research.md §4). */
function isSprinkleSite(x: number, y: number): boolean {
  return (((x + 2 * y) % 5) + 5) % 5 === 0;
}

/** Position-keyed hash, distinct from the lattice test, so eligibility and color don't visibly correlate (research.md §5). */
function positionalHue(x: number, y: number): number {
  return ((x * 37 + y * 59) % 256 + 256) % 256;
}

function positionalShade(x: number, y: number): number {
  return (((x * 11 + y * 17) % 255) + 255) % 255 + 1;
}

function applyWandCell(grid: Grid, x: number, y: number): void {
  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return;
  const i = y * grid.width + x;
  const element = grid.elements[i];
  if (element === OBJECT || element === STAR_POWER) return;
  if (element !== EMPTY) {
    setGlitter(grid, x, y, 1);
  } else if (isSprinkleSite(x, y)) {
    setCell(grid, x, y, RAINBOW_SAND, positionalShade(x, y));
    grid.hues[i] = positionalHue(x, y);
    setGlitter(grid, x, y, 1);
  }
}

/** Applies one wand dab centered on (cx, cy): glitters every covered non-OBJECT, non-EMPTY cell. Allocates nothing. */
export function applyWand(grid: Grid, cx: number, cy: number, radius: number): void {
  forEachFootprintCell(cx, cy, radius, (x, y) => applyWandCell(grid, x, y));
}

/** Applies applyWand along every point on the line from `from` to `to`, Bresenham-interpolated so a fast drag leaves no gaps. */
export function applyWandLine(
  grid: Grid,
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
    applyWand(grid, x0, y0, radius);
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

/** Bresenham-walks the segment and returns every distinct unicorn whose footprint intersects any point on the path. Never reads or writes objects.rainbows or Grid. */
export function unicornsTouchedByWandLine(
  objects: ObjectsState,
  from: { x: number; y: number },
  to: { x: number; y: number },
  radius: number,
): PlacedObject[] {
  const touched: PlacedObject[] = [];
  const touchedIds = new Set<number>();

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
    for (const unicorn of objects.unicorns) {
      if (touchedIds.has(unicorn.id)) continue;
      if (footprintIntersectsCircle(unicorn, x0, y0, radius)) {
        touchedIds.add(unicorn.id);
        touched.push(unicorn);
      }
    }
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

  return touched;
}
