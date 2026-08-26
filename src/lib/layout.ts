export const GRID_WIDTH = 270;
export const GRID_HEIGHT = 160;

export interface CanvasSize {
  width: number;
  height: number;
  cellSize: number;
}

/** Largest integer cell size that fits width x height cells inside the given viewport, at least 1. */
export function computeCanvasSize(
  viewportWidth: number,
  viewportHeight: number,
  gridWidth: number = GRID_WIDTH,
  gridHeight: number = GRID_HEIGHT,
): CanvasSize {
  const cellSize = Math.max(
    1,
    Math.floor(Math.min(viewportWidth / gridWidth, viewportHeight / gridHeight)),
  );
  return {
    width: gridWidth * cellSize,
    height: gridHeight * cellSize,
    cellSize,
  };
}
