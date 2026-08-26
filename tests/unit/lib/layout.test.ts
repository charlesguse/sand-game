import { describe, it, expect } from 'vitest';
import {
  BRUSH_RADII,
  CELL_BUDGET,
  MEDIUM_STROKE_MIN_PX,
  MIN_CELL_SIZE,
  PHONE_MAX_SHORT_SIDE,
  isPhoneSized,
  computePlayField,
  computeToolbarLayout,
} from '../../../src/lib/layout';

// Mirrors Toolbar.svelte's actual control/group count (constitution Principle V — the
// no-DOM suite doesn't import the .svelte file itself).
const TOOLBAR_CONTROL_COUNT = 14;
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
