import type { Grid, Tool } from './types';
import { getCell, setCell } from './grid';

export function applyBrush(
  grid: Grid,
  tool: Tool,
  cx: number,
  cy: number,
  radius: number,
  shade: number,
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
      if (dx * dx + dy * dy > r2) continue;

      if (tool === 'eraser') {
        setCell(grid, x, y, 0);
      } else if (getCell(grid, x, y) === 0) {
        setCell(grid, x, y, shade);
      }
    }
  }
}

export function applyBrushLine(
  grid: Grid,
  tool: Tool,
  from: { x: number; y: number },
  to: { x: number; y: number },
  radius: number,
  shade: number,
): void {
  let x0 = from.x;
  let y0 = from.y;
  const x1 = to.x;
  const y1 = to.y;
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
