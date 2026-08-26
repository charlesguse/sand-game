import { OBJECT_FOOTPRINT_SIZE } from '../lib/layout';
import { clearGrid } from './grid';
import { clearObjects, type ObjectsState } from './objects';
import type { Grid, SceneId } from './types';

export interface SceneRegion {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface SceneRegions {
  sky: SceneRegion;
  lowerPortion: SceneRegion;
  leftHalf: SceneRegion;
  rightHalf: SceneRegion;
}

const LOWER_PORTION_FRACTION = 0.4;
const SKY_GAP_ROWS = OBJECT_FOOTPRINT_SIZE + 2;

/** Proportional named rectangles (grid cells) shared by every generator and by scenes.test.ts. */
export function sceneRegions(width: number, height: number): SceneRegions {
  const lowerY0 = height - Math.round(height * LOWER_PORTION_FRACTION);
  const skyY1 = lowerY0 - SKY_GAP_ROWS;
  const midX = Math.round(width / 2);
  return {
    sky: { x0: 0, y0: 0, x1: width, y1: skyY1 },
    lowerPortion: { x0: 0, y0: lowerY0, x1: width, y1: height },
    leftHalf: { x0: 0, y0: 0, x1: midX, y1: height },
    rightHalf: { x0: midX, y0: 0, x1: width, y1: height },
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function generateLandscape1(grid: Grid, objects: ObjectsState): void {
  // Implemented in T007 (User Story 1).
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function generateLandscape2(grid: Grid, objects: ObjectsState): void {
  // Implemented in T012 (User Story 2).
}

/** Unconditionally clears grid/objects, then generates the requested scene's contents. */
export function loadScene(sceneId: SceneId, grid: Grid, objects: ObjectsState): void {
  clearGrid(grid);
  clearObjects(objects);
  if (sceneId === 'landscape1') generateLandscape1(grid, objects);
  else if (sceneId === 'landscape2') generateLandscape2(grid, objects);
}
