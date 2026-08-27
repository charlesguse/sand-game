export const EMPTY = 0;
export const SAND = 1;
export const WATER = 2;
export const DIRT = 3;
export const RAINBOW_SAND = 4;
export const OBJECT = 5;
export const GRASS = 6;

export type Element =
  | typeof EMPTY
  | typeof SAND
  | typeof WATER
  | typeof DIRT
  | typeof RAINBOW_SAND
  | typeof OBJECT
  | typeof GRASS;

export interface Grid {
  readonly width: number;
  readonly height: number;
  readonly elements: Uint8Array;
  readonly shades: Uint8Array;
  readonly moved: Uint8Array;
  readonly hues: Uint8Array;
  readonly glitter: Uint8Array;
  readonly grassHeight: Uint8Array;
  readonly grassCooldown: Uint8Array;
  grassCount: number;
}

export type Tool = 'sand' | 'water' | 'dirt' | 'grass' | 'rainbow' | 'unicorn' | 'eraser' | 'wand';
export type BrushSize = 'small' | 'medium' | 'large';
export type SceneId = 'empty' | 'landscape1' | 'landscape2';

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
