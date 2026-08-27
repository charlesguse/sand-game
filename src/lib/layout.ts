import type { BrushSize } from '../sim/types';

export const GRID_WIDTH = 270;
export const GRID_HEIGHT = 160;

export const BRUSH_RADII: Record<BrushSize, number> = {
  small: 2,
  medium: 4,
  large: 7,
};

export const OBJECT_FOOTPRINT_SIZE = 24;

/** Total cells any derived play field may ever occupy — today's fixed-grid cell count, kept as the budget ceiling (FR-007). */
export const CELL_BUDGET = GRID_WIDTH * GRID_HEIGHT;
/** Smallest a cell may ever be on-screen, px (FR-005). */
export const MIN_CELL_SIZE = 2;
/** Smallest a medium brush stroke's on-screen width may be on a phone-sized viewport, px (FR-006). */
export const MEDIUM_STROKE_MIN_PX = 24;
/** A viewport whose shorter side is at or under this many px counts as "phone-sized". */
export const PHONE_MAX_SHORT_SIDE = 480;
/** Smallest a toolbar control's touchable area may be, px (FR-020). */
export const MIN_TOUCH_TARGET = 44;
/** Debounce window before a resize/re-derivation is acted on, ms (FR-027). */
export const RESIZE_SETTLE_MS = 150;

export interface PlayField {
  gridWidth: number;
  gridHeight: number;
  cellSize: number;
  displayWidth: number;
  displayHeight: number;
}

export interface ToolbarLayoutCheck {
  fits: boolean;
  controlSize: number;
  thickness: number;
}

/** True iff the visible viewport's shorter side is at or under PHONE_MAX_SHORT_SIDE. */
export function isPhoneSized(viewportWidth: number, viewportHeight: number): boolean {
  return Math.min(viewportWidth, viewportHeight) <= PHONE_MAX_SHORT_SIDE;
}

/**
 * Derives a play field's shape and resolution from the drawing region, per research.md §1:
 * cell size is floored by whichever of three constraints binds hardest — the cell-count budget,
 * the general visibility minimum, and (on phone) the medium-stroke visibility minimum — then grid
 * dimensions are floored to fit inside that cell size.
 */
export function computePlayField(
  drawingRegionWidth: number,
  drawingRegionHeight: number,
  isPhone: boolean,
): PlayField {
  const regionW = Math.max(0, drawingRegionWidth);
  const regionH = Math.max(0, drawingRegionHeight);
  const budgetFloor = Math.sqrt((regionW * regionH) / CELL_BUDGET);
  const phoneStrokeFloor = isPhone ? MEDIUM_STROKE_MIN_PX / (2 * BRUSH_RADII.medium + 1) : 0;
  const cellSize = Math.max(MIN_CELL_SIZE, budgetFloor, phoneStrokeFloor);
  const gridWidth = Math.max(1, Math.floor(regionW / cellSize));
  const gridHeight = Math.max(1, Math.floor(regionH / cellSize));
  return {
    gridWidth,
    gridHeight,
    cellSize,
    displayWidth: gridWidth * cellSize,
    displayHeight: gridHeight * cellSize,
  };
}

// 0.4rem (~6.4px), matching Toolbar.svelte's real .group gap between controls.
const TOOLBAR_GAP = 6;
const TOOLBAR_PADDING = 12;

/**
 * Models (for the automated test suite only — the real toolbar is plain CSS flexbox,
 * research.md §6) whether every control fits at or above MIN_TOUCH_TARGET, wrapping along
 * the viewport's relevant axis: row/wrap in portrait (main axis = width, thickness = height
 * consumed), column/rail in landscape-phone (main axis = height, thickness = width consumed) —
 * matching Toolbar.svelte's landscape-phone media query.
 */
export function computeToolbarLayout(
  viewportWidth: number,
  viewportHeight: number,
  controlCount: number,
  _groupCount: number,
): ToolbarLayoutCheck {
  const isRail = viewportHeight <= PHONE_MAX_SHORT_SIDE && viewportWidth > viewportHeight;
  const mainAxis = isRail ? viewportHeight : viewportWidth;
  const controlSize = MIN_TOUCH_TARGET;
  const availableMain = mainAxis - 2 * TOOLBAR_PADDING;

  if (availableMain < controlSize) {
    return { fits: false, controlSize, thickness: mainAxis };
  }

  const perControl = controlSize + TOOLBAR_GAP;
  const perLine = Math.max(1, Math.floor((availableMain + TOOLBAR_GAP) / perControl));
  const lines = Math.ceil(controlCount / perLine);
  const thickness = lines * controlSize + (lines - 1) * TOOLBAR_GAP + 2 * TOOLBAR_PADDING;

  return { fits: true, controlSize, thickness };
}
