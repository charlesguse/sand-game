import { EMPTY, type Grid } from '../sim/types';

/** Fixed, small upper bound on simultaneous twinkles (FR-023). */
export const STAR_CAP = 16;
/** Only the top third of the grid is eligible sky (FR-020). */
export const STAR_SKY_FRACTION = 1 / 3;
/** Resample interval, ms — a star field only re-picks its eligible cells this often. */
export const STAR_RESAMPLE_MS = 400;

/**
 * Render-only ambient decoration state — never a Grid/WorldState field, never saved, undone,
 * erased, or cleared (FR-021), by construction: nothing in src/sim reads or writes this type.
 * Fixed-size typed arrays, allocated once by createStarField.
 */
export interface StarField {
  readonly width: number;
  readonly height: number;
  /** Grid cell index per slot, or -1 for an inactive slot. */
  readonly cellIndex: Int32Array;
  /** Per-slot sine-fade phase offset, assigned fresh each time a slot is (re)filled. */
  readonly phase: Float64Array;
  /** Number of currently-active slots, <= STAR_CAP. */
  count: number;
  lastResampleAt: number;
}

// Reservoir for Algorithm R, allocated once at module load — updateStarField reuses it in place
// every call, allocating nothing (mirrors sparkle.ts's updateFlashMask reservoir).
const reservoir = new Int32Array(STAR_CAP);

/** Allocates a star field sized to the grid, once, with no active slots. */
export function createStarField(width: number, height: number): StarField {
  const cellIndex = new Int32Array(STAR_CAP);
  cellIndex.fill(-1);
  return {
    width,
    height,
    cellIndex,
    phase: new Float64Array(STAR_CAP),
    count: 0,
    lastResampleAt: -Infinity,
  };
}

/**
 * At most once per STAR_RESAMPLE_MS, reservoir-samples up to STAR_CAP empty upper-sky cells
 * (elements[i] === EMPTY and y < grid.height * STAR_SKY_FRACTION — never a cell holding material
 * or an OBJECT footprint, since OBJECT !== EMPTY) into field, dropping any slot whose eligible-cell
 * count falls below what it held before. Allocates nothing.
 */
export function updateStarField(grid: Grid, field: StarField, now: number): void {
  if (now - field.lastResampleAt < STAR_RESAMPLE_MS) return;
  field.lastResampleAt = now;

  const skyLimit = Math.floor(grid.height * STAR_SKY_FRACTION);
  let seen = 0;
  for (let y = 0; y < skyLimit; y++) {
    for (let x = 0; x < grid.width; x++) {
      const i = y * grid.width + x;
      if (grid.elements[i] !== EMPTY) continue;
      if (seen < STAR_CAP) {
        reservoir[seen] = i;
      } else {
        const j = Math.floor(Math.random() * (seen + 1));
        if (j < STAR_CAP) reservoir[j] = i;
      }
      seen++;
    }
  }

  const count = Math.min(seen, STAR_CAP);
  for (let k = 0; k < count; k++) {
    field.cellIndex[k] = reservoir[k];
    field.phase[k] = Math.random() * Math.PI * 2;
  }
  for (let k = count; k < STAR_CAP; k++) {
    field.cellIndex[k] = -1;
  }
  field.count = count;
}

const STAR_TWINKLE_SPEED = 0.0025;

/**
 * Draws each active slot as a small sine-faded white twinkle. Allocates nothing.
 * Wrapped in save/restore so the per-twinkle fillStyle (a translucent white) never leaks into
 * whatever the caller paints next — color-emoji glyphs drawn afterward would otherwise inherit
 * that alpha even though they ignore its color, fading and vanishing along with the twinkle.
 */
export function drawStarField(ctx: CanvasRenderingContext2D, field: StarField, now: number): void {
  ctx.save();
  for (let k = 0; k < field.count; k++) {
    const index = field.cellIndex[k];
    if (index < 0) continue;
    const x = index % field.width;
    const y = Math.floor(index / field.width);
    const alpha = (Math.sin(now * STAR_TWINKLE_SPEED + field.phase[k]) + 1) / 2;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.restore();
}
