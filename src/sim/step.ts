import { EMPTY, type Grid } from './types';
import { isPowder, isLiquid } from './element';

function moveCell(grid: Grid, fromIndex: number, toIndex: number): void {
  grid.elements[toIndex] = grid.elements[fromIndex];
  grid.shades[toIndex] = grid.shades[fromIndex];
  grid.elements[fromIndex] = EMPTY;
  grid.shades[fromIndex] = 0;
  grid.moved[fromIndex] = 1;
  grid.moved[toIndex] = 1;
}

function stepPowder(grid: Grid, x: number, y: number, i: number): void {
  const { width, height, elements } = grid;
  const belowY = y + 1;
  const belowInBounds = belowY < height;
  const belowIndex = belowInBounds ? belowY * width + x : -1;

  if (belowInBounds && elements[belowIndex] === EMPTY) {
    moveCell(grid, i, belowIndex);
    return;
  }

  const leftX = x - 1;
  const rightX = x + 1;
  const belowLeftOpen = belowInBounds && leftX >= 0 && elements[belowY * width + leftX] === EMPTY;
  const belowRightOpen =
    belowInBounds && rightX < width && elements[belowY * width + rightX] === EMPTY;

  if (belowLeftOpen && belowRightOpen) {
    const goLeft = Math.random() < 0.5;
    moveCell(grid, i, belowY * width + (goLeft ? leftX : rightX));
  } else if (belowLeftOpen) {
    moveCell(grid, i, belowY * width + leftX);
  } else if (belowRightOpen) {
    moveCell(grid, i, belowY * width + rightX);
  }
  // else: rest, no change.
}

function stepLiquid(grid: Grid, x: number, y: number, i: number): void {
  const { width, height, elements } = grid;
  const belowY = y + 1;
  const belowInBounds = belowY < height;
  const belowIndex = belowInBounds ? belowY * width + x : -1;

  if (belowInBounds && elements[belowIndex] === EMPTY) {
    moveCell(grid, i, belowIndex);
    return;
  }

  const leftX = x - 1;
  const rightX = x + 1;
  const belowLeftOpen = belowInBounds && leftX >= 0 && elements[belowY * width + leftX] === EMPTY;
  const belowRightOpen =
    belowInBounds && rightX < width && elements[belowY * width + rightX] === EMPTY;

  if (belowLeftOpen && belowRightOpen) {
    const goLeft = Math.random() < 0.5;
    moveCell(grid, i, belowY * width + (goLeft ? leftX : rightX));
    return;
  } else if (belowLeftOpen) {
    moveCell(grid, i, belowY * width + leftX);
    return;
  } else if (belowRightOpen) {
    moveCell(grid, i, belowY * width + rightX);
    return;
  }

  const sideLeftOpen = leftX >= 0 && elements[y * width + leftX] === EMPTY;
  const sideRightOpen = rightX < width && elements[y * width + rightX] === EMPTY;

  if (sideLeftOpen && sideRightOpen) {
    const goLeft = Math.random() < 0.5;
    moveCell(grid, i, y * width + (goLeft ? leftX : rightX));
  } else if (sideLeftOpen) {
    moveCell(grid, i, y * width + leftX);
  } else if (sideRightOpen) {
    moveCell(grid, i, y * width + rightX);
  }
  // else: rest, no change.
}

/** Advances the simulation by one tick, mutating the grid in place. */
export function step(grid: Grid): void {
  const { width, height, elements, moved } = grid;
  moved.fill(0);

  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (moved[i]) continue;
      const element = elements[i];
      if (element === EMPTY) continue;

      if (isPowder(element)) {
        stepPowder(grid, x, y, i);
      } else if (isLiquid(element)) {
        stepLiquid(grid, x, y, i);
      }
    }
  }
}
