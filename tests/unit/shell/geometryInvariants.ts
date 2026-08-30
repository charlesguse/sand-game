/**
 * The single, named, documented invariant list this feature exists to create (FR-008, FR-009,
 * FR-011) — one entry per geometry-critical fact the layout model (computeToolbarLayout /
 * computePlayField) depends on, for every derived-geometry component. Read this file to see the
 * full set of protected facts without opening the test suite (SC-008).
 *
 * Pure data. Zero imports from src/, zero readFileSync/DOM access — geometryGate.ts is the
 * enforcement arm that reads component source and checks it against this list.
 */

export type GeometryComponent = 'toolbar-band' | 'toolbar-control' | 'play-area-container' | 'play-area-canvas';

export type GeometryCategory =
  | 'box-sizing'
  | 'borders'
  | 'padding'
  | 'margins'
  | 'flow-direction'
  | 'wrapping'
  | 'gaps'
  | 'transforms'
  | 'sizing';

export type GeometryMechanism = 'derived' | 'pinned' | 'inert';

export interface GeometryInvariant {
  id: string;
  component: GeometryComponent;
  category: GeometryCategory;
  assumption: string;
  mechanism: GeometryMechanism;
  historicalCause?: 1 | 2 | 3;
  /** Required iff mechanism === 'pinned' — names the geometryGate.ts export that enforces this entry. */
  checkId?: string;
}

export const GEOMETRY_INVARIANTS: readonly GeometryInvariant[] = [
  // --- toolbar-control ---------------------------------------------------
  {
    id: 'toolbar-control-box-sizing',
    component: 'toolbar-control',
    category: 'box-sizing',
    mechanism: 'pinned',
    historicalCause: 1,
    checkId: 'checkControlBoxSizing',
    assumption:
      "the control's rendered box is exactly --control-size on both axes, border included — box-sizing: border-box folds the border inside that size instead of adding it on top.",
  },
  {
    id: 'toolbar-control-borders-resting',
    component: 'toolbar-control',
    category: 'borders',
    mechanism: 'pinned',
    checkId: 'checkControlGuardedDeclarations',
    assumption:
      "the resting control's border (3px solid transparent) and border-radius (50%) are the only guarded border declarations, both counted inside --control-size.",
  },
  {
    id: 'toolbar-control-borders-selected',
    component: 'toolbar-control',
    category: 'borders',
    mechanism: 'pinned',
    checkId: 'checkSelectedGuardedDeclarations',
    assumption:
      "the selected control's emphasis border-width (5px) still counts inside --control-size (box-sizing: border-box) — selecting a control never grows its rendered box.",
  },
  {
    id: 'toolbar-control-padding',
    component: 'toolbar-control',
    category: 'padding',
    mechanism: 'pinned',
    checkId: 'checkControlGuardedDeclarations',
    assumption: 'the control has zero padding, so its rendered box matches --control-size exactly.',
  },
  {
    id: 'toolbar-control-margins',
    component: 'toolbar-control',
    category: 'margins',
    mechanism: 'inert',
    assumption:
      'controls are spaced by the band\'s own column-gap/row-gap (the pitch), never by a margin on the control itself — no margin declaration exists to guard.',
  },
  {
    id: 'toolbar-control-sizing',
    component: 'toolbar-control',
    category: 'sizing',
    mechanism: 'pinned',
    checkId: 'checkControlGuardedDeclarations',
    assumption:
      'width and height are both var(--control-size), the exact value computeToolbarLayout budgeted, with min-width/min-height floored at var(--control-min) (MIN_TOUCH_TARGET).',
  },
  {
    id: 'toolbar-control-transforms-resting',
    component: 'toolbar-control',
    category: 'transforms',
    mechanism: 'pinned',
    historicalCause: 3,
    checkId: 'checkControlGuardedDeclarations',
    assumption: "the resting control carries no transform whose scale factor exceeds 1 — nothing may grow the rendered box.",
  },
  {
    id: 'toolbar-control-transforms-selected',
    component: 'toolbar-control',
    category: 'transforms',
    mechanism: 'pinned',
    historicalCause: 3,
    checkId: 'checkSelectedGuardedDeclarations',
    assumption:
      "the selected control's emphasis never uses a scale() factor above 1 — a scale-up shipped the ring clipped against the screen edge on the outer line.",
  },
  {
    id: 'toolbar-control-flow-direction',
    component: 'toolbar-control',
    category: 'flow-direction',
    mechanism: 'inert',
    assumption: 'an individual control has no flow-direction of its own — the band, not the control, decides row-vs-column flow.',
  },
  {
    id: 'toolbar-control-wrapping',
    component: 'toolbar-control',
    category: 'wrapping',
    mechanism: 'inert',
    assumption: 'an individual control has no wrapping behavior of its own — flex-wrap is set on the band.',
  },
  {
    id: 'toolbar-control-gaps',
    component: 'toolbar-control',
    category: 'gaps',
    mechanism: 'inert',
    assumption: 'an individual control has no gap of its own — column-gap/row-gap (the pitch) is set on the band.',
  },

  // --- toolbar-band --------------------------------------------------------
  {
    id: 'toolbar-band-flow-direction',
    component: 'toolbar-band',
    category: 'flow-direction',
    mechanism: 'pinned',
    historicalCause: 2,
    checkId: 'checkRailFlowDirection',
    assumption:
      "the band flows controls along the row axis in the rows arrangement (the CSS default, no override) and down the column axis in the rail arrangement (flex-direction: column) — the axis computeToolbarLayout's mainAxisLength budgets against. Flowing the rail arrangement in rows wraps controls inside the narrow band and runs them off the bottom of the screen.",
  },
  {
    id: 'toolbar-band-arrangement-single-source',
    component: 'toolbar-band',
    category: 'flow-direction',
    mechanism: 'pinned',
    checkId: 'checkArrangementSingleSource',
    assumption:
      'App.svelte and Toolbar.svelte both read the rows-vs-rail decision from the same readArrangement()/RAIL_MEDIA_QUERY exported by layout.ts, with no independently-thresholded @media rule left in either <style> block — the two can never disagree at a viewport the representative table does not cover, and a pinch-zoom (which only shrinks the visual viewport) cannot flip the arrangement.',
  },
  {
    id: 'toolbar-band-wrapping',
    component: 'toolbar-band',
    category: 'wrapping',
    mechanism: 'pinned',
    checkId: 'checkBandWrapping',
    assumption:
      'the band wraps controls onto additional lines (flex-wrap: wrap) rather than clipping or scrolling them, in both arrangements — the line-count arithmetic computeToolbarLayout performs assumes wrapping is on.',
  },
  {
    id: 'toolbar-band-gaps',
    component: 'toolbar-band',
    category: 'gaps',
    mechanism: 'pinned',
    checkId: 'checkGapAxes',
    assumption:
      "the band gaps along the flow axis only — column-gap: var(--pitch) with row-gap: 0 in the rows arrangement, row-gap: var(--pitch) with column-gap: 0 in the rail arrangement — because computeToolbarLayout's thickness arithmetic counts lines only, reserving no additional between-line gap.",
  },
  {
    id: 'toolbar-band-sizing',
    component: 'toolbar-band',
    category: 'sizing',
    mechanism: 'derived',
    assumption:
      "the band's thickness on the constrained axis (width in rail, height in rows) comes straight from computeToolbarLayout's own layout.thickness output through one inline-style channel — nothing to assert separately.",
  },
  {
    id: 'toolbar-band-box-sizing',
    component: 'toolbar-band',
    category: 'box-sizing',
    mechanism: 'pinned',
    checkId: 'checkBandBoxSizing',
    assumption:
      "the band's own box-sizing is border-box, so any border or padding it carries counts inside the inline thickness style rather than adding to it.",
  },
  {
    id: 'toolbar-band-padding',
    component: 'toolbar-band',
    category: 'padding',
    mechanism: 'pinned',
    checkId: 'checkBandSafeAreaPadding',
    assumption:
      "the rows arrangement carries no padding at all; the rail arrangement's only padding is the four safe-area-inset values (env(safe-area-inset-*)), which track the device's own physical inset rather than adding fixed extra thickness the model did not budget for.",
  },
  {
    id: 'toolbar-band-borders',
    component: 'toolbar-band',
    category: 'borders',
    mechanism: 'inert',
    assumption: 'the band declares no border of its own — nothing to guard.',
  },
  {
    id: 'toolbar-band-margins',
    component: 'toolbar-band',
    category: 'margins',
    mechanism: 'inert',
    assumption: 'the band declares no margin of its own — nothing to guard.',
  },
  {
    id: 'toolbar-band-transforms',
    component: 'toolbar-band',
    category: 'transforms',
    mechanism: 'inert',
    assumption: 'the band applies no transform of its own — nothing to guard.',
  },

  // --- play-area-container / play-area-canvas (Story 4) ---------------------
  {
    id: 'play-area-canvas-sizing',
    component: 'play-area-canvas',
    category: 'sizing',
    mechanism: 'derived',
    checkId: 'checkCanvasSizeDerivation',
    assumption:
      "the canvas's on-screen box comes straight from computePlayField's own displayWidth/displayHeight output through one inline-style channel (style=\"width: {displayWidth}px; height: {displayHeight}px;\") — checkCanvasSizeDerivation confirms the channel itself is real (by source inspection) rather than leaving the derivation as an unenforced claim; there is no separate pinned value to assert on top of it.",
  },
  {
    id: 'play-area-canvas-box-sizing',
    component: 'play-area-canvas',
    category: 'box-sizing',
    mechanism: 'inert',
    assumption: 'the canvas declares no box-sizing of its own — nothing to guard.',
  },
  {
    id: 'play-area-canvas-borders',
    component: 'play-area-canvas',
    category: 'borders',
    mechanism: 'inert',
    assumption: 'the canvas declares no border of its own — nothing to guard.',
  },
  {
    id: 'play-area-canvas-padding',
    component: 'play-area-canvas',
    category: 'padding',
    mechanism: 'inert',
    assumption: 'the canvas declares no padding of its own — nothing to guard.',
  },
  {
    id: 'play-area-canvas-margins',
    component: 'play-area-canvas',
    category: 'margins',
    mechanism: 'inert',
    assumption: 'the canvas declares no margin of its own — nothing to guard.',
  },
  {
    id: 'play-area-canvas-flow-direction',
    component: 'play-area-canvas',
    category: 'flow-direction',
    mechanism: 'inert',
    assumption: 'a single canvas element has no flow-direction of its own — nothing to guard.',
  },
  {
    id: 'play-area-canvas-wrapping',
    component: 'play-area-canvas',
    category: 'wrapping',
    mechanism: 'inert',
    assumption: 'a single canvas element has no wrapping behavior of its own — nothing to guard.',
  },
  {
    id: 'play-area-canvas-gaps',
    component: 'play-area-canvas',
    category: 'gaps',
    mechanism: 'inert',
    assumption: 'a single canvas element has no gap of its own — nothing to guard.',
  },
  {
    id: 'play-area-canvas-transforms',
    component: 'play-area-canvas',
    category: 'transforms',
    mechanism: 'inert',
    assumption: 'the canvas applies no transform of its own — nothing to guard.',
  },
  {
    id: 'play-area-container-sizing',
    component: 'play-area-container',
    category: 'sizing',
    mechanism: 'pinned',
    checkId: 'checkPlayAreaGuardedDeclarations',
    assumption:
      "the container fills its flex slot (width: 100%; height: 100%) and is measured back via clientWidth/clientHeight at resize time — it does not itself budget a geometry-critical size the way the toolbar band does, but the closed-allowlist scan still guards the declaration against an unnoticed drift.",
  },
  {
    id: 'play-area-container-box-sizing',
    component: 'play-area-container',
    category: 'box-sizing',
    mechanism: 'inert',
    assumption: 'the container declares no box-sizing of its own — nothing to guard.',
  },
  {
    id: 'play-area-container-borders',
    component: 'play-area-container',
    category: 'borders',
    mechanism: 'inert',
    assumption: 'the container declares no border of its own — nothing to guard.',
  },
  {
    id: 'play-area-container-padding',
    component: 'play-area-container',
    category: 'padding',
    mechanism: 'inert',
    assumption:
      'the container declares no padding today; if one were added later, container.clientWidth/clientHeight (what measureField reads) already includes it, so the next measurement would pick it up rather than silently shrinking the canvas below what was measured — still guarded so a maintainer never has to re-derive that self-correction by hand.',
  },
  {
    id: 'play-area-container-margins',
    component: 'play-area-container',
    category: 'margins',
    mechanism: 'inert',
    assumption: 'the container declares no margin of its own — nothing to guard.',
  },
  {
    id: 'play-area-container-flow-direction',
    component: 'play-area-container',
    category: 'flow-direction',
    mechanism: 'inert',
    assumption: 'the container centers one canvas child via flex — no wrap-relevant flow direction to guard.',
  },
  {
    id: 'play-area-container-wrapping',
    component: 'play-area-container',
    category: 'wrapping',
    mechanism: 'inert',
    assumption: 'the container holds a single child — nothing to wrap.',
  },
  {
    id: 'play-area-container-gaps',
    component: 'play-area-container',
    category: 'gaps',
    mechanism: 'inert',
    assumption: 'the container holds a single child — no gap to guard.',
  },
  {
    id: 'play-area-container-transforms',
    component: 'play-area-container',
    category: 'transforms',
    mechanism: 'inert',
    assumption: 'the container applies no transform of its own — nothing to guard.',
  },
];

/** Classifies a CSS property name as guarded: box sizing, border/padding/margin longhands, width/height (incl. min/max), transform. */
export const GUARDED_PROPERTY_PATTERN =
  /^(box-sizing|border(-\w+)?|padding(-\w+)?|margin(-\w+)?|width|height|min-width|min-height|max-width|max-height|transform)$/;

// One allowed-declarations map per guarded rule block the closed-allowlist scan covers (FR-018,
// FR-018a) — scoped to .control's and .control.selected's rule blocks per the spec's answer to
// "how completely is the class closed" (contracts/geometry-gate.md). A guarded property present
// in a rule block but absent from its component's map fails as unrecognized; present with a
// non-matching value fails as drifted.
export const CONTROL_ALLOWED_DECLARATIONS: Record<string, string | RegExp> = {
  'box-sizing': 'border-box',
  padding: '0',
  width: 'var(--control-size)',
  height: 'var(--control-size)',
  'min-width': 'var(--control-min)',
  'min-height': 'var(--control-min)',
  border: '3px solid transparent',
  'border-radius': '50%',
};

export const CONTROL_SELECTED_ALLOWED_DECLARATIONS: Record<string, string | RegExp> = {
  'border-width': '5px',
};

// The container fills its flex slot at a fixed 100%/100% — the only guarded declarations it
// carries today; any other future guarded declaration on it fails immediately rather than being
// silently permitted (research.md §5, Story 4).
export const PLAY_AREA_CONTAINER_ALLOWED_DECLARATIONS: Record<string, string | RegExp> = {
  width: '100%',
  height: '100%',
};

// Empty today — .play-area (the canvas) carries no guarded declaration at all, so any future one
// fails immediately (research.md §5, Story 4).
export const PLAY_AREA_CANVAS_ALLOWED_DECLARATIONS: Record<string, string | RegExp> = {};
