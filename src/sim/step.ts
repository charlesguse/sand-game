import type { Grid } from './types';
import { getCell, setCell, inBounds } from './grid';

export function step(grid: Grid): void {
  const { width, height } = grid;

  for (let y = height - 2; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const value = getCell(grid, x, y);
      if (value === 0) continue;

      if (getCell(grid, x, y + 1) === 0) {
        setCell(grid, x, y, 0);
        setCell(grid, x, y + 1, value);
        continue;
      }

      const leftOpen = inBounds(grid, x - 1, y + 1) && getCell(grid, x - 1, y + 1) === 0;
      const rightOpen = inBounds(grid, x + 1, y + 1) && getCell(grid, x + 1, y + 1) === 0;

      if (leftOpen && rightOpen) {
        const dx = Math.random() < 0.5 ? -1 : 1;
        setCell(grid, x, y, 0);
        setCell(grid, x + dx, y + 1, value);
      } else if (leftOpen) {
        setCell(grid, x, y, 0);
        setCell(grid, x - 1, y + 1, value);
      } else if (rightOpen) {
        setCell(grid, x, y, 0);
        setCell(grid, x + 1, y + 1, value);
      }
    }
  }
}
