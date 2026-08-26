import { EMPTY, type Grid } from './types';
import { isPowder } from './element';

function tryMove(grid: Grid, fromIndex: number, toIndex: number): void {
  grid.elements[toIndex] = grid.elements[fromIndex];
  grid.shades[toIndex] = grid.shades[fromIndex];
  grid.elements[fromIndex] = EMPTY;
  grid.shades[fromIndex] = 0;
}

/** Advances the simulation by one tick, mutating the grid in place. */
export function step(grid: Grid): void {
  const { width, height, elements } = grid;

  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const element = elements[i];
      if (element === EMPTY) continue;

      if (isPowder(element)) {
        const belowY = y + 1;
        const belowInBounds = belowY < height;
        const belowIndex = belowInBounds ? belowY * width + x : -1;

        if (belowInBounds && elements[belowIndex] === EMPTY) {
          tryMove(grid, i, belowIndex);
          continue;
        }

        const leftX = x - 1;
        const rightX = x + 1;
        const belowLeftOpen =
          belowInBounds && leftX >= 0 && elements[belowY * width + leftX] === EMPTY;
        const belowRightOpen =
          belowInBounds && rightX < width && elements[belowY * width + rightX] === EMPTY;

        if (belowLeftOpen && belowRightOpen) {
          const goLeft = Math.random() < 0.5;
          tryMove(grid, i, belowY * width + (goLeft ? leftX : rightX));
        } else if (belowLeftOpen) {
          tryMove(grid, i, belowY * width + leftX);
        } else if (belowRightOpen) {
          tryMove(grid, i, belowY * width + rightX);
        }
        // else: rest, no change.
      }
    }
  }
}
