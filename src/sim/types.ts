export const EMPTY = 0;
export const SAND = 1;
export const WATER = 2;
export const DIRT = 3;

export type Element = typeof EMPTY | typeof SAND | typeof WATER | typeof DIRT;

export interface Grid {
  readonly width: number;
  readonly height: number;
  readonly elements: Uint8Array;
  readonly shades: Uint8Array;
  readonly moved: Uint8Array;
}

export type Tool = 'sand' | 'water' | 'dirt' | 'eraser';
export type BrushSize = 'small' | 'medium' | 'large';
