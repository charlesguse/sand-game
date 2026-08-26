import { type Grid, type ObjectsState } from './types';

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
