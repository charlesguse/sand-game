import { EMPTY, OBJECT, type Grid } from '../sim/types';

export const FLASH_CAP = 24;

// Reservoir for Algorithm R, allocated once at module load — updateFlashMask
// reuses it in place every frame, allocating nothing per call.
const reservoir = new Int32Array(FLASH_CAP);

/** Allocates a zero-filled flash mask sized to the grid, once. */
export function createFlashMask(width: number, height: number): Uint8Array {
  return new Uint8Array(width * height);
}

/** Clears mask, then reservoir-samples up to FLASH_CAP glittered cell indices into it. Allocates nothing. */
export function updateFlashMask(grid: Grid, mask: Uint8Array): void {
  mask.fill(0);
  const { elements, glitter } = grid;
  let seen = 0;
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (element === EMPTY || element === OBJECT || glitter[i] !== 1) continue;
    if (seen < FLASH_CAP) {
      reservoir[seen] = i;
    } else {
      const j = Math.floor(Math.random() * (seen + 1));
      if (j < FLASH_CAP) reservoir[j] = i;
    }
    seen++;
  }
  const count = Math.min(seen, FLASH_CAP);
  for (let k = 0; k < count; k++) {
    mask[reservoir[k]] = 1;
  }
}
