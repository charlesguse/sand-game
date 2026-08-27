import { createGrid } from './grid';
import { GRASS, OBJECT, type Grid } from './types';

/**
 * Allocates a fresh grid at the new dimensions and carries every non-OBJECT source cell across at
 * a fixed bottom-centre-anchored offset — the ground stays at the bottom, a pile stays where the
 * child put it (FR-026). Cells whose offset destination falls outside the new bounds are dropped,
 * never clamped or wrapped. OBJECT cells are always skipped — the caller repositions objects
 * separately using the same offset (contracts/layout-and-touch.md). Never mutates oldGrid.
 */
export function resizeGrid(
  oldGrid: Grid,
  newWidth: number,
  newHeight: number,
): { grid: Grid; offsetX: number; offsetY: number } {
  const grid = createGrid(newWidth, newHeight);
  const offsetX = Math.round((newWidth - oldGrid.width) / 2);
  const offsetY = newHeight - oldGrid.height;

  for (let y = 0; y < oldGrid.height; y++) {
    for (let x = 0; x < oldGrid.width; x++) {
      const srcIndex = y * oldGrid.width + x;
      if (oldGrid.elements[srcIndex] === OBJECT) continue;

      const destX = x + offsetX;
      const destY = y + offsetY;
      if (destX < 0 || destX >= newWidth || destY < 0 || destY >= newHeight) continue;

      const destIndex = destY * newWidth + destX;
      grid.elements[destIndex] = oldGrid.elements[srcIndex];
      grid.shades[destIndex] = oldGrid.shades[srcIndex];
      grid.hues[destIndex] = oldGrid.hues[srcIndex];
      grid.glitter[destIndex] = oldGrid.glitter[srcIndex];
      grid.grassHeight[destIndex] = oldGrid.grassHeight[srcIndex];
      grid.grassCooldown[destIndex] = oldGrid.grassCooldown[srcIndex];
      if (oldGrid.elements[srcIndex] === GRASS) grid.grassCount++;
    }
  }

  return { grid, offsetX, offsetY };
}
