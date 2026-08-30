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

export const GEOMETRY_INVARIANTS: readonly GeometryInvariant[] = [];

/** Classifies a CSS property name as guarded: box sizing, border/padding/margin longhands, width/height (incl. min/max), transform. */
export const GUARDED_PROPERTY_PATTERN =
  /^(box-sizing|border(-\w+)?|padding(-\w+)?|margin(-\w+)?|width|height|min-width|min-height|max-width|max-height|transform)$/;

// One allowed-declarations map per guarded rule block this feature scans (FR-018, FR-018a). A
// guarded property present in a rule block but absent from its component's map fails as
// unrecognized; present with a non-matching value fails as drifted.
export const CONTROL_ALLOWED_DECLARATIONS: Record<string, string | RegExp> = {};
export const CONTROL_SELECTED_ALLOWED_DECLARATIONS: Record<string, string | RegExp> = {};
export const PLAY_AREA_CONTAINER_ALLOWED_DECLARATIONS: Record<string, string | RegExp> = {};
export const PLAY_AREA_CANVAS_ALLOWED_DECLARATIONS: Record<string, string | RegExp> = {};
