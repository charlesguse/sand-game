import { describe, it, expect } from 'vitest';
import {
  BRUSH_RADII,
  CELL_BUDGET,
  MEDIUM_STROKE_MIN_PX,
  MIN_CELL_SIZE,
  MIN_PITCH,
  MIN_TOUCH_TARGET,
  PHONE_MAX_SHORT_SIDE,
  PREFERRED_CONTROL_SIZE,
  PREFERRED_PITCH,
  TOOLBAR_BAND_MAX_SHARE,
  isPhoneSized,
  computePlayField,
  computeToolbarLayout,
} from '../../../src/lib/layout';
import { shippedToolbarControls } from '../../../src/lib/toolbarControls';

interface ViewportCase {
  label: string;
  width: number;
  height: number;
}

// SC-001's full representative viewport table (research.md §10).
const VIEWPORT_TABLE: ViewportCase[] = [
  { label: 'small phone', width: 320, height: 568 },
  { label: 'iPhone SE 3 portrait', width: 375, height: 667 },
  { label: 'iPhone SE 3 landscape', width: 667, height: 375 },
  { label: 'phone portrait', width: 390, height: 844 },
  { label: 'phone landscape', width: 844, height: 390 },
  { label: 'large phone portrait', width: 412, height: 915 },
  { label: 'small tablet portrait', width: 600, height: 1024 },
  { label: 'small tablet landscape', width: 1024, height: 600 },
  { label: 'tablet portrait', width: 768, height: 1024 },
  { label: 'tablet landscape', width: 1024, height: 768 },
  { label: 'laptop', width: 1280, height: 800 },
  { label: 'extreme aspect ratio', width: 400, height: 1400 },
];

// The real shipped control counts (FR-013) — never a hand-maintained literal (SC-009).
const BASE_CONTROLS = shippedToolbarControls(false, false).length;
const FULL_CONTROLS = shippedToolbarControls(true, true).length;
const CONTROL_COUNTS = [BASE_CONTROLS, FULL_CONTROLS];

// Derives the drawing region left over once the toolbar takes its own capped box, reading
// computeToolbarLayout's own arrangement/thickness fields rather than a locally reimplemented
// model — the check and the sizing rule can never disagree because both call the same function
// (FR-014, research.md §5).
function drawingRegionFor(viewport: ViewportCase, controlCount: number) {
  const toolbar = computeToolbarLayout(viewport.width, viewport.height, controlCount);
  const isRail = toolbar.arrangement === 'rail';
  return {
    toolbar,
    width: isRail ? viewport.width - toolbar.thickness : viewport.width,
    height: isRail ? viewport.height : viewport.height - toolbar.thickness,
  };
}

// Reimplements the pre-006 fixed-grid formula (computeCanvasSize, now removed) purely as a
// baseline for the laptop non-regression comparison below.
function legacyFixedGridSize(regionWidth: number, regionHeight: number) {
  const cellSize = Math.max(1, Math.floor(Math.min(regionWidth / 270, regionHeight / 160)));
  return { width: 270 * cellSize, height: 160 * cellSize };
}

describe('layout — representative viewport table (FR-001, FR-003, FR-005, FR-006, FR-007)', () => {
  for (const viewport of VIEWPORT_TABLE) {
    const isPhone = isPhoneSized(viewport.width, viewport.height);
    const region = drawingRegionFor(viewport, BASE_CONTROLS);
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

// computeToolbarLayout folds spec 006's phone-scoped area-fill floor into its own fits/shrink
// search (FR-014, FR-015 — one function, one search, both floors), so on a phone-sized viewport
// `fits` can legitimately be false even though the 40% axis cap alone would have been clearable:
// 44px touch targets at 4px pitch, wrapping the *full* (fullscreen+photo-included) control set,
// cannot both stay under TOOLBAR_BAND_MAX_SHARE *and* leave computePlayField's 65% portrait
// fill floor intact at the smallest table viewport — a genuine, provable infeasibility of the
// combination (44px floor, 4px pitch floor, 0.4 axis cap, 0.65 area floor, real control count),
// not a bug in the search. FR-012 exists exactly for this: a control set that cannot satisfy the
// floors is a reported build-time shortfall, never a silently-violated floor.
const KNOWN_INFEASIBLE = new Set(['small phone:25']);

describe('computeToolbarLayout — axis floor holds universally, both control sets (FR-002, FR-006, FR-015)', () => {
  for (const viewport of VIEWPORT_TABLE) {
    describe(`${viewport.label} (${viewport.width}x${viewport.height})`, () => {
      for (const controlCount of CONTROL_COUNTS) {
        if (KNOWN_INFEASIBLE.has(`${viewport.label}:${controlCount}`)) continue;

        it(`keeps the drawing region at >= 60% of the constrained axis (${controlCount} controls)`, () => {
          const toolbar = computeToolbarLayout(viewport.width, viewport.height, controlCount);
          const constrainedAxisLength = toolbar.arrangement === 'rail' ? viewport.width : viewport.height;
          expect((constrainedAxisLength - toolbar.thickness) / constrainedAxisLength).toBeGreaterThanOrEqual(0.6);
        });

        it(`fits every control at or above the touch-target and pitch floors simultaneously (${controlCount} controls)`, () => {
          const toolbar = computeToolbarLayout(viewport.width, viewport.height, controlCount);
          expect(toolbar.fits).toBe(true);
          expect(toolbar.controlSize).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
          expect(toolbar.pitch).toBeGreaterThanOrEqual(MIN_PITCH);
        });
      }
    });
  }
});

describe('computeToolbarLayout — phone-sized area-fill floors hold alongside the axis floor (FR-004, FR-015)', () => {
  for (const viewport of VIEWPORT_TABLE.filter((v) => isPhoneSized(v.width, v.height))) {
    describe(`${viewport.label} (${viewport.width}x${viewport.height})`, () => {
      for (const controlCount of CONTROL_COUNTS) {
        if (KNOWN_INFEASIBLE.has(`${viewport.label}:${controlCount}`)) continue;

        it(`covers the whole-viewport-area fill floor (${controlCount} controls)`, () => {
          const region = drawingRegionFor(viewport, controlCount);
          const field = computePlayField(region.width, region.height, true);
          const isLandscape = viewport.width > viewport.height;
          const fillFloor = isLandscape ? 0.6 : 0.65;
          const viewportArea = viewport.width * viewport.height;
          expect((field.displayWidth * field.displayHeight) / viewportArea).toBeGreaterThanOrEqual(fillFloor);
        });
      }
    });
  }
});

describe('computeToolbarLayout — the one known-infeasible combination reports fits: false, not a silently-violated floor (FR-012, FR-012b)', () => {
  it('small phone (320x568) with both feature-detected controls shown cannot clear both floors', () => {
    const smallest = VIEWPORT_TABLE.find((v) => v.label === 'small phone')!;
    const toolbar = computeToolbarLayout(smallest.width, smallest.height, FULL_CONTROLS);
    const constrainedAxisLength = toolbar.arrangement === 'rail' ? smallest.width : smallest.height;
    const cap = TOOLBAR_BAND_MAX_SHARE * constrainedAxisLength;

    // The tightest legal arrangement (44px controls, 4px pitch) does clear the bare 40% axis
    // cap on its own...
    expect(toolbar.requiredThickness).toBeLessThanOrEqual(cap);
    // ...but still doesn't leave computePlayField's 65% area-fill floor intact, so the search
    // correctly refuses to report a false fits: true.
    expect(toolbar.fits).toBe(false);
  });
});

describe('computeToolbarLayout — desktop non-regression, no active shrinking (FR-016, SC-007)', () => {
  const laptop = VIEWPORT_TABLE.find((v) => v.label === 'laptop')!;

  it('stays at the preferred control size and pitch at 1280x800', () => {
    const toolbar = computeToolbarLayout(laptop.width, laptop.height, BASE_CONTROLS);
    expect(toolbar.controlSize).toBe(PREFERRED_CONTROL_SIZE);
    expect(toolbar.pitch).toBe(PREFERRED_PITCH);
  });

  it("keeps the play area at or above today's pre-feature size", () => {
    const region = drawingRegionFor(laptop, BASE_CONTROLS);
    const field = computePlayField(region.width, region.height, false);
    const legacy = legacyFixedGridSize(laptop.width, laptop.height);
    expect(field.displayWidth).toBeGreaterThanOrEqual(legacy.width);
    expect(field.displayHeight).toBeGreaterThanOrEqual(legacy.height);
  });
});

describe('shippedToolbarControls — manifest shape and feature-detected gating (FR-013, FR-014)', () => {
  it('omits both the fullscreen- and photo-tagged entries when neither capability is available', () => {
    const controls = shippedToolbarControls(false, false);
    expect(controls.some((c) => c.conditional === 'fullscreen')).toBe(false);
    expect(controls.some((c) => c.conditional === 'photo')).toBe(false);
  });

  it('includes both the fullscreen- and photo-tagged entries when both capabilities are available', () => {
    const controls = shippedToolbarControls(true, true);
    expect(controls.some((c) => c.conditional === 'fullscreen')).toBe(true);
    expect(controls.some((c) => c.conditional === 'photo')).toBe(true);
  });

  it('gives every control a non-empty ariaLabel', () => {
    for (const control of shippedToolbarControls(true, true)) {
      expect(control.ariaLabel.length).toBeGreaterThan(0);
    }
  });

  it('has at most two conditional controls', () => {
    const conditional = shippedToolbarControls(true, true).filter((c) => c.conditional !== undefined);
    expect(conditional.length).toBeLessThanOrEqual(2);
  });
});

describe('computeToolbarLayout — the guarantee reacts to a changed control count (SC-008)', () => {
  it('one extra control changes the computed layout for at least one representative viewport', () => {
    const changed = VIEWPORT_TABLE.some((viewport) => {
      const before = computeToolbarLayout(viewport.width, viewport.height, FULL_CONTROLS);
      const after = computeToolbarLayout(viewport.width, viewport.height, FULL_CONTROLS + 1);
      return (
        after.thickness !== before.thickness ||
        after.controlSize !== before.controlSize ||
        after.pitch !== before.pitch ||
        after.fits !== before.fits
      );
    });
    expect(changed).toBe(true);
  });

  it('never needs less space than before when a control is added, at every representative viewport', () => {
    for (const viewport of VIEWPORT_TABLE) {
      const before = computeToolbarLayout(viewport.width, viewport.height, FULL_CONTROLS);
      const after = computeToolbarLayout(viewport.width, viewport.height, FULL_CONTROLS + 1);
      expect(after.requiredThickness).toBeGreaterThanOrEqual(before.requiredThickness);
    }
  });
});

describe('computeToolbarLayout — a control set that cannot fit is reported, not silently accepted (FR-012, FR-012b, SC-012)', () => {
  it('reports fits: false with the exact shortfall at the smallest table viewport', () => {
    const smallest = VIEWPORT_TABLE.find((v) => v.label === 'small phone')!;
    const toolbar = computeToolbarLayout(smallest.width, smallest.height, 500);
    const constrainedAxisLength = toolbar.arrangement === 'rail' ? smallest.width : smallest.height;
    const cap = TOOLBAR_BAND_MAX_SHARE * constrainedAxisLength;

    // A maintainer could compose "<viewport> <arrangement>: needs <requiredThickness>px, has
    // <cap>px" directly from these fields, with nothing re-derived by hand.
    expect(toolbar.fits).toBe(false);
    expect(toolbar.requiredThickness).toBeGreaterThan(cap);
  });
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
