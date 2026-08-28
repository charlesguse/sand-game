export const EMPTY = 0;
export const SAND = 1;
export const WATER = 2;
export const DIRT = 3;
export const RAINBOW_SAND = 4;
export const OBJECT = 5;
export const GRASS = 6;
export const STAR_POWER = 7;
export const FOG = 8;
export const GUMDROP = 9;

export type Element =
  | typeof EMPTY
  | typeof SAND
  | typeof WATER
  | typeof DIRT
  | typeof RAINBOW_SAND
  | typeof OBJECT
  | typeof GRASS
  | typeof STAR_POWER
  | typeof FOG
  | typeof GUMDROP;

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
  readonly starPowerAge: Uint8Array;
  readonly starPowerLife: Uint8Array;
  readonly starPowerFuelled: Uint8Array;
  readonly cloud: Uint8Array;
  readonly fogRiseCooldown: Uint8Array;
  readonly fogStuckSteps: Uint16Array;
  readonly fogAge: Uint16Array;
  readonly cloudRainDelay: Uint16Array;
  fogCloudCount: number;
}

export type Tool =
  | 'sand'
  | 'water'
  | 'dirt'
  | 'grass'
  | 'star'
  | 'rainbow'
  | 'unicorn'
  | 'palm'
  | 'eraser'
  | 'wand'
  | 'gumdrop';
export type BrushSize = 'small' | 'medium' | 'large';
export type SceneId = 'empty' | 'landscape1' | 'landscape2';

export type ObjectKind = 'rainbow' | 'unicorn' | 'palm';

export interface PlacedObject {
  readonly id: number;
  readonly kind: ObjectKind;
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

export interface ObjectsState {
  byKind: Record<ObjectKind, PlacedObject[]>;
  nextId: number;
}
