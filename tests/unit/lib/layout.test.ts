import { describe, it, expect } from 'vitest';
import {
  BRUSH_RADII,
  CELL_BUDGET,
  MEDIUM_STROKE_MIN_PX,
  MIN_CELL_SIZE,
  MIN_TOUCH_TARGET,
  PHONE_MAX_SHORT_SIDE,
  isPhoneSized,
  computePlayField,
  computeToolbarLayout,
} from '../../../src/lib/layout';

// Mirrors Toolbar.svelte's actual control/group count (constitution Principle V — the
// no-DOM suite doesn't import the .svelte file itself).
const TOOLBAR_CONTROL_COUNT = 15;
const TOOLBAR_GROUP_COUNT = 5;

interface ViewportCase {
  label: string;
  width: number;
  height: number;
}

// Representative viewport table (quickstart.md's User Story 1 automated coverage section).
const VIEWPORT_TABLE: ViewportCase[] = [
  { label: 'phone portrait', width: 390, height: 844 },
  { label: 'phone landscape', width: 844, height: 390 },
  { label: 'small phone', width: 320, height: 568 },
  { label: 'tablet portrait', width: 768, height: 1024 },
  { label: 'tablet landscape', width: 1024, height: 768 },
  { label: 'laptop', width: 1440, height: 900 },
  { label: 'extreme aspect ratio', width: 400, height: 1400 },
];

// The toolbar rails (consumes width) exactly when Toolbar.svelte's landscape-phone media query
// would apply — mirrors the CSS `@media (max-height: 480px) and (orientation: landscape)` rule.
function isToolbarRail(viewportWidth: number, viewportHeight: number): boolean {
  return viewportHeight <= PHONE_MAX_SHORT_SIDE && viewportWidth > viewportHeight;
}

// Derives the drawing region left over once the toolbar takes its space, per quickstart.md's
// User Story 1 automated coverage section.
function drawingRegionFor(viewport: ViewportCase) {
  const toolbar = computeToolbarLayout(viewport.width, viewport.height, TOOLBAR_CONTROL_COUNT, TOOLBAR_GROUP_COUNT);
  const rail = isToolbarRail(viewport.width, viewport.height);
  return {
    toolbar,
    width: rail ? viewport.width - toolbar.thickness : viewport.width,
    height: rail ? viewport.height : viewport.height - toolbar.thickness,
  };
}

// Reimplements the pre-006 fixed-grid formula (computeCanvasSize, now removed) purely as a
// baseline for the laptop non-regression comparison below.
function legacyFixedGridSize(regionWidth: number, regionHeight: number) {
  const cellSize = Math.max(1, Math.floor(Math.min(regionWidth / 270, regionHeight / 160)));
  return { width: 270 * cellSize, height: 160 * cellSize };
}

describe('layout — representative viewport table (FR-001, FR-002, FR-003, FR-005, FR-006, FR-007)', () => {
  for (const viewport of VIEWPORT_TABLE) {
    const isPhone = isPhoneSized(viewport.width, viewport.height);
    const region = drawingRegionFor(viewport);
    const field = computePlayField(region.width, region.height, isPhone);

    describe(`${viewport.label} (${viewport.width}x${viewport.height})`, () => {
      it('fills at least 90% of the drawing region on both axes (FR-001)', () => {
        expect(field.displayWidth / region.width).toBeGreaterThanOrEqual(0.9);
        expect(field.displayHeight / region.height).toBeGreaterThanOrEqual(0.9);
      });

      it('cells are square — one cellSize drives both axes (FR-003)', () => {
        expect(field.displayWidth / field.gridWidth).toBeCloseTo(field.displayHeight / field.gridHeight, 6);
      });

      it('cell size is never below the visibility minimum (FR-005)', () => {
        expect(field.cellSize).toBeGreaterThanOrEqual(MIN_CELL_SIZE);
      });

      it('stays within the cell-count budget (FR-007)', () => {
        expect(field.gridWidth * field.gridHeight).toBeLessThanOrEqual(CELL_BUDGET);
      });

      if (isPhone) {
        const strokeFloor = MEDIUM_STROKE_MIN_PX / (2 * BRUSH_RADII.medium + 1);
        it('cell size clears the medium-stroke visibility minimum on phone (FR-006)', () => {
          expect(field.cellSize).toBeGreaterThanOrEqual(strokeFloor);
        });

        const viewportArea = viewport.width * viewport.height;
        const isLandscape = viewport.width > viewport.height;
        const fillFloor = isLandscape ? 0.6 : 0.65;
        it(`covers >= ${fillFloor} of the whole viewport area (FR-002)`, () => {
          expect((field.displayWidth * field.displayHeight) / viewportArea).toBeGreaterThanOrEqual(fillFloor);
        });
      }
    });
  }

  it('does not regress the laptop baseline vs. the pre-006 fixed-grid formula (FR-030, SC-006)', () => {
    const laptop = VIEWPORT_TABLE.find((v) => v.label === 'laptop')!;
    const field = computePlayField(laptop.width, laptop.height, isPhoneSized(laptop.width, laptop.height));
    const legacy = legacyFixedGridSize(laptop.width, laptop.height);

    expect(field.displayWidth).toBeGreaterThanOrEqual(legacy.width);
    expect(field.displayHeight).toBeGreaterThanOrEqual(legacy.height);
  });
});

describe('computeToolbarLayout — every control fits and stays tappable on phone (FR-020, FR-020a, FR-035)', () => {
  for (const viewport of VIEWPORT_TABLE.filter((v) => isPhoneSized(v.width, v.height))) {
    describe(`${viewport.label} (${viewport.width}x${viewport.height})`, () => {
      const toolbar = computeToolbarLayout(viewport.width, viewport.height, TOOLBAR_CONTROL_COUNT, TOOLBAR_GROUP_COUNT);

      it('fits every control at or above the minimum touch target', () => {
        expect(toolbar.fits).toBe(true);
        expect(toolbar.controlSize).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
      });

      it("does not push the play area below User Story 1's fill floors", () => {
        const region = drawingRegionFor(viewport);
        const field = computePlayField(region.width, region.height, true);

        expect(field.displayWidth / region.width).toBeGreaterThanOrEqual(0.9);
        expect(field.displayHeight / region.height).toBeGreaterThanOrEqual(0.9);

        const isLandscape = viewport.width > viewport.height;
        const fillFloor = isLandscape ? 0.6 : 0.65;
        const viewportArea = viewport.width * viewport.height;
        expect((field.displayWidth * field.displayHeight) / viewportArea).toBeGreaterThanOrEqual(fillFloor);
      });
    });
  }
});

describe('re-derivation trigger — distinguishable by pure comparison of PlayField (FR-025 vs FR-026)', () => {
  it('a small address-bar-collapse-like change that keeps the same grid dimensions is not a re-derivation trigger', () => {
    const before = computePlayField(390, 844, true);
    // A few px shorter, as an address bar might collapse/expand by — same drawing-region shape,
    // same grid dimensions.
    const after = computePlayField(390, 840, true);

    expect(after.gridWidth).toBe(before.gridWidth);
    expect(after.gridHeight).toBe(before.gridHeight);
  });

  it('a change that alters the computed grid dimensions is distinguishable as a re-derivation trigger', () => {
    const portrait = computePlayField(390, 844, true);
    const landscape = computePlayField(844, 390, true);

    expect(
      landscape.gridWidth !== portrait.gridWidth || landscape.gridHeight !== portrait.gridHeight,
    ).toBe(true);
  });
});

// Reimplements PlayArea.svelte's clientToGrid formula as a pure helper so touch-to-cell mapping
// is verifiable without a browser/DOM (FR-012).
function clientToGrid(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  gridWidth: number,
  gridHeight: number,
): { x: number; y: number } {
  const scaleX = gridWidth / rect.width;
  const scaleY = gridHeight / rect.height;
  return {
    x: Math.floor((clientX - rect.left) * scaleX),
    y: Math.floor((clientY - rect.top) * scaleY),
  };
}

describe('clientToGrid — touch-to-cell coordinate mapping (FR-012)', () => {
  const SCALE_CASES = ['phone portrait', 'small phone', 'laptop', 'extreme aspect ratio'];

  for (const label of SCALE_CASES) {
    const viewport = VIEWPORT_TABLE.find((v) => v.label === label)!;
    const field = computePlayField(viewport.width, viewport.height, isPhoneSized(viewport.width, viewport.height));
    // A non-zero offset so the test also exercises rect.left/rect.top, not just scale.
    const rect = { left: 37, top: 21, width: field.displayWidth, height: field.displayHeight };

    describe(`${label} (${field.gridWidth}x${field.gridHeight} cells at ${field.cellSize.toFixed(2)}px)`, () => {
      it('maps the top-left corner to cell (0, 0)', () => {
        expect(clientToGrid(rect.left, rect.top, rect, field.gridWidth, field.gridHeight)).toEqual({ x: 0, y: 0 });
      });

      it('maps just inside the top-right corner to the last column, first row', () => {
        const pos = clientToGrid(rect.left + rect.width - 0.001, rect.top, rect, field.gridWidth, field.gridHeight);
        expect(pos).toEqual({ x: field.gridWidth - 1, y: 0 });
      });

      it('maps just inside the bottom-left corner to the first column, last row', () => {
        const pos = clientToGrid(rect.left, rect.top + rect.height - 0.001, rect, field.gridWidth, field.gridHeight);
        expect(pos).toEqual({ x: 0, y: field.gridHeight - 1 });
      });

      it('maps just inside the bottom-right corner to the last column, last row', () => {
        const pos = clientToGrid(
          rect.left + rect.width - 0.001,
          rect.top + rect.height - 0.001,
          rect,
          field.gridWidth,
          field.gridHeight,
        );
        expect(pos).toEqual({ x: field.gridWidth - 1, y: field.gridHeight - 1 });
      });

      it('maps the centre to the middle cell', () => {
        const pos = clientToGrid(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
          rect,
          field.gridWidth,
          field.gridHeight,
        );
        expect(pos).toEqual({ x: Math.floor(field.gridWidth / 2), y: Math.floor(field.gridHeight / 2) });
      });
    });
  }

  it('has no drift after a simulated resize — mapping always uses the live grid/rect, never a stale pair', () => {
    const before = VIEWPORT_TABLE.find((v) => v.label === 'phone portrait')!;
    const after = VIEWPORT_TABLE.find((v) => v.label === 'phone landscape')!;

    const fieldBefore = computePlayField(before.width, before.height, isPhoneSized(before.width, before.height));
    const rectBefore = { left: 0, top: 0, width: fieldBefore.displayWidth, height: fieldBefore.displayHeight };
    const centreBefore = clientToGrid(
      rectBefore.width / 2,
      rectBefore.height / 2,
      rectBefore,
      fieldBefore.gridWidth,
      fieldBefore.gridHeight,
    );
    expect(centreBefore).toEqual({ x: Math.floor(fieldBefore.gridWidth / 2), y: Math.floor(fieldBefore.gridHeight / 2) });

    // "Resize" to a different viewport — a correct implementation re-measures the rect and reads
    // the (possibly re-derived) grid's current dimensions, never the pre-resize pair.
    const fieldAfter = computePlayField(after.width, after.height, isPhoneSized(after.width, after.height));
    const rectAfter = { left: 0, top: 0, width: fieldAfter.displayWidth, height: fieldAfter.displayHeight };
    const centreAfter = clientToGrid(
      rectAfter.width / 2,
      rectAfter.height / 2,
      rectAfter,
      fieldAfter.gridWidth,
      fieldAfter.gridHeight,
    );
    expect(centreAfter).toEqual({ x: Math.floor(fieldAfter.gridWidth / 2), y: Math.floor(fieldAfter.gridHeight / 2) });

    // Using the stale pre-resize grid dimensions against the post-resize rect would drift away
    // from the centre cell whenever the grid's shape actually changed — demonstrating why the
    // live implementation must always read the current grid, not a cached one.
    const staleCentre = clientToGrid(
      rectAfter.width / 2,
      rectAfter.height / 2,
      rectAfter,
      fieldBefore.gridWidth,
      fieldBefore.gridHeight,
    );
    expect(staleCentre).not.toEqual({ x: Math.floor(fieldAfter.gridWidth / 2), y: Math.floor(fieldAfter.gridHeight / 2) });
  });
});
