import { EMPTY, SAND, WATER, type Grid, type Tool } from './types';
import { setCell, inBounds } from './grid';

function forEachFootprintCell(
  cx: number,
  cy: number,
  radius: number,
  fn: (x: number, y: number) => void,
): void {
  const r2 = radius * radius;
  const minX = Math.floor(cx - radius);
  const maxX = Math.ceil(cx + radius);
  const minY = Math.floor(cy - radius);
  const maxY = Math.ceil(cy + radius);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) fn(x, y);
    }
  }
}

function paintCell(grid: Grid, tool: Tool, x: number, y: number, shade: number): void {
  if (!inBounds(grid, x, y)) return;
  const current = grid.elements[y * grid.width + x];

  if (tool === 'eraser') {
    setCell(grid, x, y, EMPTY, 0);
    return;
  }

  if (tool === 'sand' && current === EMPTY) {
    setCell(grid, x, y, SAND, shade);
  } else if (tool === 'water' && current === EMPTY) {
    setCell(grid, x, y, WATER, shade);
  }
}

/** Applies a circular brush footprint centered on (cx, cy) with the given radius. */
export function applyBrush(
  grid: Grid,
  tool: Tool,
  cx: number,
  cy: number,
  radius: number,
  shade: number,
): void {
  forEachFootprintCell(cx, cy, radius, (x, y) => paintCell(grid, tool, x, y, shade));
}

/** Applies the brush footprint along every point on the line from `from` to `to`, Bresenham-interpolated so a fast drag leaves no gaps. */
export function applyBrushLine(
  grid: Grid,
  tool: Tool,
  from: { x: number; y: number },
  to: { x: number; y: number },
  radius: number,
  shade: number,
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
    applyBrush(grid, tool, x0, y0, radius, shade);
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
