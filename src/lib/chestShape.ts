/**
 * Treasure chest geometry, in the same 0-36 unit box BucketIcon.svelte uses. The single source
 * both ChestIcon.svelte (toolbar) and PlayArea.svelte's drawObjectGlyph (on-canvas) read, so the
 * chest looks identical in both places with no duplicated shape data.
 */

export interface ChestShapePart {
  kind: 'rect' | 'path';
  d?: string;
  rect?: { x: number; y: number; width: number; height: number; rx?: number };
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}

export const CHEST_SHAPE: readonly ChestShapePart[] = [
  // Body.
  { kind: 'rect', rect: { x: 5, y: 16, width: 26, height: 15, rx: 2 }, fill: '#b5772e', stroke: '#5a3d66', strokeWidth: 1.8 },
  // Lid.
  { kind: 'rect', rect: { x: 4.5, y: 9, width: 27, height: 9, rx: 3 }, fill: '#d99a4e', stroke: '#5a3d66', strokeWidth: 1.8 },
  // Plank highlight lines on the body.
  {
    kind: 'path',
    d: 'M5 22h26M5 27h26',
    fill: 'none',
    stroke: '#8f5a22',
    strokeWidth: 1.2,
  },
  // Metal band across lid and body.
  { kind: 'rect', rect: { x: 15.5, y: 9, width: 5, height: 22 }, fill: '#ffd85c', stroke: '#5a3d66', strokeWidth: 1.4 },
  // Lock.
  { kind: 'rect', rect: { x: 15, y: 17, width: 6, height: 6, rx: 1.5 }, fill: '#ffe98a', stroke: '#5a3d66', strokeWidth: 1.4 },
];
