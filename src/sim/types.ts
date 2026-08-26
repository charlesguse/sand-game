export const EMPTY = 0;
export const SAND = 1;
export const WATER = 2;
export const DIRT = 3;
export const RAINBOW_SAND = 4;
export const OBJECT = 5;

export type Element =
  | typeof EMPTY
  | typeof SAND
  | typeof WATER
  | typeof DIRT
  | typeof RAINBOW_SAND
  | typeof OBJECT;

export interface Grid {
  readonly width: number;
  readonly height: number;
  readonly elements: Uint8Array;
  readonly shades: Uint8Array;
  readonly moved: Uint8Array;
  readonly hues: Uint8Array;
}

export type Tool = 'sand' | 'water' | 'dirt' | 'rainbow' | 'unicorn' | 'eraser';
export type BrushSize = 'small' | 'medium' | 'large';

export type ObjectKind = 'rainbow' | 'unicorn';

export interface PlacedObject {
  readonly id: number;
  readonly kind: ObjectKind;
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

export interface ObjectsState {
  rainbows: PlacedObject[];
  unicorns: PlacedObject[];
  nextId: number;
}
