import { OBJECT_FOOTPRINT_SIZE } from '../lib/layout';
import { clearGrid, setCell } from './grid';
import { clearObjects, placeObject, type ObjectsState } from './objects';
import { DIRT, SAND, WATER, type Grid, type SceneId } from './types';

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

/** Fixed positional hash in 1-255, standing in for randomShade() so terrain shade is reproducible. */
function positionalShade(x: number, y: number): number {
  return 1 + ((x * 928371 + y * 128371) % 255);
}

/** Rounds and clamps each raw value into [minVal, maxVal], then limits adjacent-column jumps to ±1 row. */
function clampProfile(raw: number[], minVal: number, maxVal: number): number[] {
  const clampTo = (v: number): number => Math.max(minVal, Math.min(maxVal, v));
  const out: number[] = new Array(raw.length);
  out[0] = clampTo(Math.round(raw[0]));
  for (let i = 1; i < raw.length; i++) {
    const r = clampTo(Math.round(raw[i]));
    const prev = out[i - 1];
    out[i] = clampTo(Math.max(prev - 1, Math.min(prev + 1, r)));
  }
  return out;
}

/** Rolling purple-dirt hills: two crests, a valley lake, one rainbow, one unicorn on the taller crest (FR-017). */
export function generateLandscape1(grid: Grid, objects: ObjectsState): void {
  const { width, height } = grid;
  const regions = sceneRegions(width, height);
  const { x0, x1, y0: bandTop, y1: bandBottom } = regions.lowerPortion;
  const bandWidth = x1 - x0;
  const bandHeight = bandBottom - bandTop;
  const amplitude = bandHeight * 0.28;
  const baseline = bandTop + bandHeight * 0.4;

  const raw: number[] = new Array(bandWidth);
  for (let i = 0; i < bandWidth; i++) {
    const frac = i / bandWidth;
    raw[i] = baseline - amplitude * Math.sin(3 * Math.PI * frac);
  }
  const heights = clampProfile(raw, bandTop, bandBottom - 1);

  const mid = Math.floor(bandWidth / 2);
  let crest1 = 0;
  for (let i = 1; i < mid; i++) if (heights[i] < heights[crest1]) crest1 = i;
  let crest2 = mid;
  for (let i = mid; i < bandWidth; i++) if (heights[i] < heights[crest2]) crest2 = i;

  for (let i = 0; i < bandWidth; i++) {
    const x = x0 + i;
    for (let y = heights[i]; y < bandBottom; y++) {
      setCell(grid, x, y, DIRT, positionalShade(x, y));
    }
  }

  const wallY = Math.max(heights[crest1], heights[crest2]);
  const waterSurfaceRow = wallY + 2;
  for (let i = crest1 + 1; i < crest2; i++) {
    if (heights[i] <= waterSurfaceRow) continue;
    const x = x0 + i;
    for (let y = waterSurfaceRow; y < heights[i]; y++) {
      setCell(grid, x, y, WATER, positionalShade(x, y));
    }
  }

  const skyCx = Math.round((regions.sky.x0 + regions.sky.x1) / 2);
  const skyCy = Math.round(regions.sky.y1 / 2);
  placeObject(grid, objects, 'rainbow', skyCx, skyCy);

  const tallerCrest = heights[crest1] <= heights[crest2] ? crest1 : crest2;
  const unicornCx = x0 + tallerCrest;
  const unicornCy = heights[tallerCrest] - OBJECT_FOOTPRINT_SIZE / 2;
  placeObject(grid, objects, 'unicorn', unicornCx, unicornCy);
}

/** Pink-sand beach sloping into a large pool: two rainbows, one unicorn near the shore (FR-018). */
export function generateLandscape2(grid: Grid, objects: ObjectsState): void {
  const { width, height } = grid;
  const regions = sceneRegions(width, height);
  const { x0, x1, y0: bandTop, y1: bandBottom } = regions.lowerPortion;
  const bandWidth = x1 - x0;
  const bandHeight = bandBottom - bandTop;

  const raw: number[] = new Array(bandWidth);
  for (let i = 0; i < bandWidth; i++) {
    const frac = i / bandWidth;
    raw[i] = bandTop + bandHeight * 0.15 + bandHeight * 0.55 * frac;
  }
  const heights = clampProfile(raw, bandTop, bandBottom - 1);

  for (let i = 0; i < bandWidth; i++) {
    const x = x0 + i;
    for (let y = heights[i]; y < bandBottom; y++) {
      setCell(grid, x, y, SAND, positionalShade(x, y));
    }
  }

  const midX = regions.rightHalf.x0;
  const poolStart = midX - x0;
  const wallHeight = heights[poolStart];
  const waterSurfaceRow = wallHeight + 2;
  for (let i = poolStart; i < bandWidth; i++) {
    if (heights[i] <= waterSurfaceRow) continue;
    const x = x0 + i;
    for (let y = waterSurfaceRow; y < heights[i]; y++) {
      setCell(grid, x, y, WATER, positionalShade(x, y));
    }
  }

  const skyCy = Math.round(regions.sky.y1 / 2);
  const rainbow1Cx = Math.round(regions.sky.x0 + (regions.sky.x1 - regions.sky.x0) * 0.3);
  const rainbow2Cx = Math.round(regions.sky.x0 + (regions.sky.x1 - regions.sky.x0) * 0.7);
  placeObject(grid, objects, 'rainbow', rainbow1Cx, skyCy);
  placeObject(grid, objects, 'rainbow', rainbow2Cx, skyCy);

  const unicornCx = midX;
  const unicornCy = heights[poolStart] - OBJECT_FOOTPRINT_SIZE / 2;
  placeObject(grid, objects, 'unicorn', unicornCx, unicornCy);
}

/** Unconditionally clears grid/objects, then generates the requested scene's contents. */
export function loadScene(sceneId: SceneId, grid: Grid, objects: ObjectsState): void {
  clearGrid(grid);
  clearObjects(objects);
  if (sceneId === 'landscape1') generateLandscape1(grid, objects);
  else if (sceneId === 'landscape2') generateLandscape2(grid, objects);
}
