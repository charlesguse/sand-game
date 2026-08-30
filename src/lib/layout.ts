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

/** FR-002's cap: the toolbar band's thickness must never exceed this fraction of the constrained axis. */
export const TOOLBAR_BAND_MAX_SHARE = 0.4;
/** Today's fixed 3.5rem control diameter, px — the ceiling continuous sizing shrinks from. */
export const PREFERRED_CONTROL_SIZE = 56;
/** Today's 1rem inter-group gap, px — the ceiling the pitch-shrink phase starts from. */
export const PREFERRED_PITCH = 16;
/** Floor below which pitch never shrinks, px — keeps neighbouring targets from crowding close enough to co-activate (FR-009). */
export const MIN_PITCH = 4;

export interface ToolbarLayoutResult {
  fits: boolean;
  /** px, always >= MIN_TOUCH_TARGET */
  controlSize: number;
  /** px, always >= MIN_PITCH */
  pitch: number;
  /** px consumed on the constrained axis; <= TOOLBAR_BAND_MAX_SHARE * constrainedAxisLength whenever fits is true */
  thickness: number;
  /** px needed at the tightest legal arrangement (controlSize=MIN_TOUCH_TARGET, pitch=MIN_PITCH) — always populated, for FR-012b */
  requiredThickness: number;
  arrangement: 'rows' | 'rail';
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

/**
 * Thickness (px, on the constrained axis) needed to wrap controlCount controls of the given
 * size and pitch across mainAxisLength (research.md §3 — groups are a visual cue only, never a
 * forced line break). Pitch spaces neighbours within a line (matching CSS column-gap, which is
 * what governs FR-009's same-row separation and what perLine below is sized against); lines
 * stack with no additional cross-axis gap (CSS row-gap: 0) — each line's own controlSize already
 * separates one line's targets from the next, and reserving further budget for a between-line
 * gap on top of that is what makes the tightest real viewport/control-count combination
 * infeasible under the 44px/4px floors.
 */
function toolbarThickness(
  controlSize: number,
  pitch: number,
  mainAxisLength: number,
  controlCount: number,
): number {
  const perControl = controlSize + pitch;
  const perLine = Math.max(1, Math.floor((mainAxisLength + pitch) / perControl));
  const lines = Math.ceil(controlCount / perLine);
  return lines * controlSize;
}

/**
 * Largest x in [lo, hi] for which predicate(x) holds, assuming predicate(lo) is true and
 * predicate(hi) is false (predicate monotonic non-increasing in x) — binary search to
 * sub-pixel precision, floored to a whole px at the end.
 */
function largestFitting(lo: number, hi: number, predicate: (x: number) => boolean): number {
  let low = lo;
  let high = hi;
  for (let i = 0; i < 32; i++) {
    const mid = (low + high) / 2;
    if (predicate(mid)) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return Math.floor(low);
}

/**
 * True iff a toolbar of the given thickness, on a phone-sized viewport, still leaves
 * computePlayField's own phone-scoped area-fill floor intact (spec 006's FR-004, restated —
 * not weakened — by this feature's FR-015). Universally true off-phone, where FR-004 never
 * applied. Folding this into computeToolbarLayout's own search (rather than leaving it to a
 * separate, uncoordinated check) is what makes FR-014's "the check MUST NOT be able to pass
 * while the shipped layout violates the floors" true of *both* floors, not just the axis one.
 */
function clearsAreaFillFloor(
  thickness: number,
  arrangement: 'rows' | 'rail',
  viewportWidth: number,
  viewportHeight: number,
): boolean {
  if (!isPhoneSized(viewportWidth, viewportHeight)) return true;
  const regionWidth = arrangement === 'rail' ? viewportWidth - thickness : viewportWidth;
  const regionHeight = arrangement === 'rail' ? viewportHeight : viewportHeight - thickness;
  const field = computePlayField(regionWidth, regionHeight, true);
  const fillFloor = viewportWidth > viewportHeight ? 0.6 : 0.65;
  return (field.displayWidth * field.displayHeight) / (viewportWidth * viewportHeight) >= fillFloor;
}

/**
 * The toolbar's own sizing rule, run both by Toolbar.svelte at render time and by the test
 * suite (research.md §5) — the two can never disagree because both call this exact function.
 * Shrinks pitch first (down to MIN_PITCH), then control size (down to MIN_TOUCH_TARGET), via a
 * two-phase monotonic binary search (research.md §2), stopping as soon as the band both clears
 * TOOLBAR_BAND_MAX_SHARE of the constrained axis and (on phone) still leaves computePlayField's
 * area-fill floor intact; reports fits: false with the tightest-legal-arrangement
 * requiredThickness if even that combination can't be met (FR-012, FR-012a-c).
 */
export function computeToolbarLayout(
  viewportWidth: number,
  viewportHeight: number,
  controlCount: number,
): ToolbarLayoutResult {
  const arrangement: 'rows' | 'rail' =
    viewportHeight <= PHONE_MAX_SHORT_SIDE && viewportWidth > viewportHeight ? 'rail' : 'rows';
  const constrainedAxisLength = arrangement === 'rail' ? viewportWidth : viewportHeight;
  const mainAxisLength = arrangement === 'rail' ? viewportHeight : viewportWidth;
  const cap = TOOLBAR_BAND_MAX_SHARE * constrainedAxisLength;

  const requiredThickness = toolbarThickness(MIN_TOUCH_TARGET, MIN_PITCH, mainAxisLength, controlCount);

  function clears(controlSize: number, pitch: number): boolean {
    const thickness = toolbarThickness(controlSize, pitch, mainAxisLength, controlCount);
    return thickness <= cap && clearsAreaFillFloor(thickness, arrangement, viewportWidth, viewportHeight);
  }

  // Phase 1: preferred control size and pitch — the common case (FR-016's non-regression).
  if (clears(PREFERRED_CONTROL_SIZE, PREFERRED_PITCH)) {
    return {
      fits: true,
      controlSize: PREFERRED_CONTROL_SIZE,
      pitch: PREFERRED_PITCH,
      thickness: toolbarThickness(PREFERRED_CONTROL_SIZE, PREFERRED_PITCH, mainAxisLength, controlCount),
      requiredThickness,
      arrangement,
    };
  }

  // Phase 2: hold preferred control size, shrink pitch toward MIN_PITCH.
  if (clears(PREFERRED_CONTROL_SIZE, MIN_PITCH)) {
    const pitch = largestFitting(MIN_PITCH, PREFERRED_PITCH, (p) => clears(PREFERRED_CONTROL_SIZE, p));
    return {
      fits: true,
      controlSize: PREFERRED_CONTROL_SIZE,
      pitch,
      thickness: toolbarThickness(PREFERRED_CONTROL_SIZE, pitch, mainAxisLength, controlCount),
      requiredThickness,
      arrangement,
    };
  }

  // Phase 3: hold pitch at its floor, shrink control size toward MIN_TOUCH_TARGET.
  if (clears(MIN_TOUCH_TARGET, MIN_PITCH)) {
    const controlSize = largestFitting(MIN_TOUCH_TARGET, PREFERRED_CONTROL_SIZE, (size) => clears(size, MIN_PITCH));
    return {
      fits: true,
      controlSize,
      pitch: MIN_PITCH,
      thickness: toolbarThickness(controlSize, MIN_PITCH, mainAxisLength, controlCount),
      requiredThickness,
      arrangement,
    };
  }

  // Even the tightest legal arrangement doesn't clear both floors — no runtime fallback (FR-012).
  return {
    fits: false,
    controlSize: MIN_TOUCH_TARGET,
    pitch: MIN_PITCH,
    thickness: requiredThickness,
    requiredThickness,
    arrangement,
  };
}
