export interface Grid {
  readonly width: number;
  readonly height: number;
  readonly cells: Uint8ClampedArray; // length === width * height, row-major
}

export type Tool = 'sand' | 'eraser';
export type BrushSize = 'small' | 'medium' | 'large';
