import {
  EMPTY,
  FOG,
  GRASS,
  GUMDROP,
  OBJECT,
  RAINBOW_SAND,
  STAR_POWER,
  type Grid,
  type ObjectKind,
  type ObjectsState,
  type PlacedObject,
} from './types';
import { OBJECT_KINDS } from './objects';
import { randomBurnLife, randomCloudRainDelay, randomFogRiseCooldown } from './shade';

/** Undo/redo stack depth cap, each direction (FR-019, FR-020). */
export const HISTORY_DEPTH = 10;

export interface WorldState {
  readonly elements: Uint8Array;
  readonly colorAux: Uint8Array;
  readonly cloud: Uint8Array;
  readonly glitter: Uint8Array;
  readonly grassHeight: Uint8Array;
  readonly byKind: Record<ObjectKind, PlacedObject[]>;
}

function cloneObjectList(list: PlacedObject[]): PlacedObject[] {
  return list.map((obj) => ({ ...obj }));
}

function cloneObjectsByKind(byKind: Record<ObjectKind, PlacedObject[]>): Record<ObjectKind, PlacedObject[]> {
  const clone = {} as Record<ObjectKind, PlacedObject[]>;
  for (const kind of OBJECT_KINDS) {
    clone[kind] = cloneObjectList(byKind[kind]);
  }
  return clone;
}

/** Snapshots every visible property of grid/objects (FR-028). Allocates five typed arrays plus one small object-list clone per kind in OBJECT_KINDS. O(width * height). */
export function captureWorldState(grid: Grid, objects: ObjectsState): WorldState {
  const size = grid.width * grid.height;
  const elements = new Uint8Array(grid.elements);
  const colorAux = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    colorAux[i] =
      elements[i] === RAINBOW_SAND || elements[i] === GUMDROP ? grid.hues[i] : grid.shades[i];
  }
  return {
    elements,
    colorAux,
    cloud: new Uint8Array(grid.cloud),
    glitter: new Uint8Array(grid.glitter),
    grassHeight: new Uint8Array(grid.grassHeight),
    byKind: cloneObjectsByKind(objects.byKind),
  };
}

/**
 * True iff every typed array in state has exactly grid.width * grid.height elements. A state of
 * the wrong shape (e.g. one that predates a resize and was never remapped) must never be
 * restored: reading past the end of a typed array silently yields `undefined`, which writes as
 * 0 (EMPTY) — quietly erasing the picture instead of failing loudly. Checking only `elements`
 * would miss a partially-remapped state where some other array is the wrong length, so every
 * array is checked. O(1) — length reads, no iteration.
 */
export function worldStateFits(state: WorldState, grid: Grid): boolean {
  const size = grid.width * grid.height;
  return (
    state.elements.length === size &&
    state.colorAux.length === size &&
    state.cloud.length === size &&
    state.glitter.length === size &&
    state.grassHeight.length === size
  );
}

/**
 * Writes state back into grid/objects in place; resets every excluded internal timer
 * (grassCooldown, star-power age/life/fuelled, fog/cloud timers) to its own "freshly created"
 * value (research.md §4); recomputes grassCount/fogCloudCount; leaves grid.moved and
 * objects.nextId untouched. O(width * height).
 *
 * Refuses (returns false, writes nothing at all — no partial mutation) when state does not fit
 * grid, per worldStateFits. Never throws: a refusal must be silent and safe (constitution
 * principle II — nothing the child does is ever "wrong"), not an error dialog or a crash.
 */
export function restoreWorldState(grid: Grid, objects: ObjectsState, state: WorldState): boolean {
  if (!worldStateFits(state, grid)) return false;

  const size = grid.width * grid.height;
  let grassCount = 0;
  let fogCloudCount = 0;

  for (let i = 0; i < size; i++) {
    const element = state.elements[i];
    grid.elements[i] = element;
    grid.glitter[i] = state.glitter[i];
    grid.grassHeight[i] = state.grassHeight[i];
    grid.cloud[i] = state.cloud[i];

    if (element === RAINBOW_SAND || element === GUMDROP) {
      grid.hues[i] = state.colorAux[i];
      grid.shades[i] = 0;
    } else {
      grid.shades[i] = state.colorAux[i];
      grid.hues[i] = 0;
    }

    grid.grassCooldown[i] = 0;

    if (element === STAR_POWER) {
      grid.starPowerAge[i] = 0;
      grid.starPowerLife[i] = randomBurnLife();
      grid.starPowerFuelled[i] = 0;
    } else {
      grid.starPowerAge[i] = 0;
      grid.starPowerLife[i] = 0;
      grid.starPowerFuelled[i] = 0;
    }

    if (element === FOG) {
      if (state.cloud[i] === 1) {
        grid.fogRiseCooldown[i] = 0;
        grid.fogStuckSteps[i] = 0;
        grid.fogAge[i] = 0;
        grid.cloudRainDelay[i] = randomCloudRainDelay();
      } else {
        grid.fogRiseCooldown[i] = randomFogRiseCooldown();
        grid.fogStuckSteps[i] = 0;
        grid.fogAge[i] = 0;
        grid.cloudRainDelay[i] = 0;
      }
      fogCloudCount++;
    } else {
      grid.fogRiseCooldown[i] = 0;
      grid.fogStuckSteps[i] = 0;
      grid.fogAge[i] = 0;
      grid.cloudRainDelay[i] = 0;
    }

    if (element === GRASS) grassCount++;
  }

  grid.grassCount = grassCount;
  grid.fogCloudCount = fogCloudCount;

  objects.byKind = cloneObjectsByKind(state.byKind);
  return true;
}

/**
 * Re-anchors a captured WorldState from its old grid dimensions to new ones, mirroring exactly
 * what resizeGrid (src/sim/resize.ts) and repositionObjects (PlayArea.svelte) already do to the
 * *live* world, so a restored snapshot lines up the same way the live grid does after a
 * re-derivation.
 *
 * Fork divergence from upstream FR-022 (specs/010-undo-redo/spec.md): upstream discards the
 * entire undo/redo history on every re-derivation. That was written when re-derivation only ever
 * happened on a physical device rotation. This fork's fullscreen toggle turns re-derivation into
 * a one-tap control sitting right next to Undo, and the target user rotates/toggles constantly —
 * wiping history on every tap makes Undo effectively useless. So this fork remaps and keeps
 * history across re-derivation instead of discarding it. Do not "fix" this back to reset().
 *
 * OBJECT cells are skipped when copying elements (exactly as resizeGrid does) and re-stamped
 * below only for objects that survive the reposition. This ordering is required, not
 * cosmetic: restoreWorldState writes state.elements straight into the grid and never re-stamps
 * footprints itself. Copying OBJECT cells verbatim and then dropping an object that no longer
 * fits would leave orphan OBJECT cells — permanently solid, invisible, unerasable — with no
 * object behind them. Skipping OBJECT on copy and re-stamping only kept objects' footprints
 * makes that outcome structurally impossible: every OBJECT cell in the output corresponds to a
 * kept object's footprint, by construction.
 */
/** True iff (x, y) offset by (offsetX, offsetY) lands inside a newWidth x newHeight grid. Shared by remapWorldState and wouldRemapLosslessly so their bounds arithmetic cannot drift apart. */
function destInBounds(
  x: number,
  y: number,
  offsetX: number,
  offsetY: number,
  newWidth: number,
  newHeight: number,
): boolean {
  const destX = x + offsetX;
  const destY = y + offsetY;
  return destX >= 0 && destX < newWidth && destY >= 0 && destY < newHeight;
}

/** True iff obj's whole footprint, offset by (offsetX, offsetY), lands inside a newWidth x newHeight grid. Shared by remapWorldState and wouldRemapLosslessly. */
function objectFits(
  obj: PlacedObject,
  offsetX: number,
  offsetY: number,
  newWidth: number,
  newHeight: number,
): boolean {
  const x = obj.x + offsetX;
  const y = obj.y + offsetY;
  return x >= 0 && x + obj.size <= newWidth && y >= 0 && y + obj.size <= newHeight;
}

export function remapWorldState(
  state: WorldState,
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number,
  offsetX: number,
  offsetY: number,
): WorldState {
  const newSize = newWidth * newHeight;
  const elements = new Uint8Array(newSize);
  const colorAux = new Uint8Array(newSize);
  const cloud = new Uint8Array(newSize);
  const glitter = new Uint8Array(newSize);
  const grassHeight = new Uint8Array(newSize);

  for (let y = 0; y < oldHeight; y++) {
    for (let x = 0; x < oldWidth; x++) {
      const srcIndex = y * oldWidth + x;
      if (state.elements[srcIndex] === OBJECT) continue;
      if (!destInBounds(x, y, offsetX, offsetY, newWidth, newHeight)) continue;

      const destIndex = (y + offsetY) * newWidth + (x + offsetX);
      elements[destIndex] = state.elements[srcIndex];
      colorAux[destIndex] = state.colorAux[srcIndex];
      cloud[destIndex] = state.cloud[srcIndex];
      glitter[destIndex] = state.glitter[srcIndex];
      grassHeight[destIndex] = state.grassHeight[srcIndex];
    }
  }

  const byKind = {} as Record<ObjectKind, PlacedObject[]>;
  for (const kind of OBJECT_KINDS) {
    const kept: PlacedObject[] = [];
    for (const obj of state.byKind[kind]) {
      if (!objectFits(obj, offsetX, offsetY, newWidth, newHeight)) continue;

      const x = obj.x + offsetX;
      const y = obj.y + offsetY;
      for (let py = y; py < y + obj.size; py++) {
        for (let px = x; px < x + obj.size; px++) {
          elements[py * newWidth + px] = OBJECT;
        }
      }
      kept.push({ ...obj, x, y });
    }
    byKind[kind] = kept;
  }

  return { elements, colorAux, cloud, glitter, grassHeight, byKind };
}

/**
 * True iff remapping state with these old/new dimensions and offsets would lose nothing: every
 * non-EMPTY cell lands inside the new bounds, and every object still fits. Reuses destInBounds
 * and objectFits — the exact same arithmetic remapWorldState itself uses — so the two checks
 * cannot drift apart. Bails on the first violation found (cells first, then objects), so a
 * doomed state is rejected as cheaply as possible; a state that does pass has always walked
 * every cell (same O(width * height) cost remapWorldState itself pays).
 *
 * OBJECT cells are skipped in the per-cell scan for the same reason remapWorldState skips them
 * when copying: an OBJECT cell is a hollow marker for a placed object, not independent content,
 * and whether it survives is entirely decided by the object-fit check below.
 */
function wouldRemapLosslessly(
  state: WorldState,
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number,
  offsetX: number,
  offsetY: number,
): boolean {
  for (let y = 0; y < oldHeight; y++) {
    for (let x = 0; x < oldWidth; x++) {
      const element = state.elements[y * oldWidth + x];
      if (element === EMPTY || element === OBJECT) continue;
      if (!destInBounds(x, y, offsetX, offsetY, newWidth, newHeight)) return false;
    }
  }

  for (const kind of OBJECT_KINDS) {
    for (const obj of state.byKind[kind]) {
      if (!objectFits(obj, offsetX, offsetY, newWidth, newHeight)) return false;
    }
  }

  return true;
}

function objectListsEqual(a: readonly PlacedObject[], b: readonly PlacedObject[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x.id !== y.id || x.kind !== y.kind || x.x !== y.x || x.y !== y.y || x.size !== y.size) return false;
  }
  return true;
}

/** True iff the live grid/objects exactly match every field pending holds (research.md §3) — read-compare, no allocation. */
function worldMatches(pending: WorldState, grid: Grid, objects: ObjectsState): boolean {
  const size = grid.width * grid.height;
  for (let i = 0; i < size; i++) {
    const element = grid.elements[i];
    if (element !== pending.elements[i]) return false;
    const colorAux = element === RAINBOW_SAND || element === GUMDROP ? grid.hues[i] : grid.shades[i];
    if (colorAux !== pending.colorAux[i]) return false;
    if (grid.cloud[i] !== pending.cloud[i]) return false;
    if (grid.glitter[i] !== pending.glitter[i]) return false;
    if (grid.grassHeight[i] !== pending.grassHeight[i]) return false;
  }
  for (const kind of OBJECT_KINDS) {
    if (!objectListsEqual(pending.byKind[kind], objects.byKind[kind])) return false;
  }
  return true;
}

/** Owns the bounded undo/redo stacks and the begin/commit/undo/redo/reset operations (research.md §3, §5). */
export class HistoryManager {
  private undoStack: WorldState[] = [];
  private redoStack: WorldState[] = [];
  private pending: WorldState | null = null;

  /** Captures grid/objects' current state as the pending "before" snapshot for an action about to start (FR-008). */
  beginAction(grid: Grid, objects: ObjectsState): void {
    this.pending = captureWorldState(grid, objects);
  }

  /** Compares the live grid/objects against the pending snapshot; discards it with no history change if identical (FR-007); otherwise pushes it onto the undo stack (evicting the oldest past HISTORY_DEPTH, FR-019) and clears the redo stack (FR-017). No-op if no action is pending. */
  commitAction(grid: Grid, objects: ObjectsState): void {
    const pending = this.pending;
    if (pending === null) return;
    this.pending = null;
    if (worldMatches(pending, grid, objects)) return;

    this.undoStack.push(pending);
    if (this.undoStack.length > HISTORY_DEPTH) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  /**
   * Pops the most recent undo entry (false, no-op, if none — FR-013); captures the current state
   * onto the redo stack (FR-015); restores the popped state; returns true.
   *
   * If the popped state does not fit grid (wrong shape — e.g. a bug elsewhere left a
   * pre-remap entry behind), it is unrestorable: discard it and clear the rest of the undo
   * stack too, since every remaining entry was captured at the same now-stale shape and is
   * therefore equally unusable. Returns false; grid/objects are left untouched (restoreWorldState
   * never partially mutates). This degrades to exactly the old reset()-on-every-resize behaviour
   * for that one stack instead of corrupting the child's picture.
   */
  undo(grid: Grid, objects: ObjectsState): boolean {
    const state = this.undoStack.pop();
    if (state === undefined) return false;
    if (!worldStateFits(state, grid)) {
      this.undoStack.length = 0;
      return false;
    }
    this.redoStack.push(captureWorldState(grid, objects));
    restoreWorldState(grid, objects, state);
    return true;
  }

  /**
   * Pops the most recent redo entry (false, no-op, if none — FR-016); captures the current state
   * onto the undo stack; restores the popped state; returns true.
   *
   * Mirrors undo()'s shape guard: a popped state that does not fit grid is discarded along with
   * the rest of the redo stack (same stale shape, equally unusable), and grid/objects are left
   * untouched.
   */
  redo(grid: Grid, objects: ObjectsState): boolean {
    const state = this.redoStack.pop();
    if (state === undefined) return false;
    if (!worldStateFits(state, grid)) {
      this.redoStack.length = 0;
      return false;
    }
    this.undoStack.push(captureWorldState(grid, objects));
    restoreWorldState(grid, objects, state);
    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Clears both stacks and any pending capture (FR-022). */
  reset(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.pending = null;
  }

  /**
   * Re-anchors every stored state — undo stack and redo stack, in place, order preserved — to
   * new grid dimensions via remapWorldState. This is the fork's deliberate replacement for
   * reset() at a re-derivation site (see remapWorldState's doc comment for why upstream's FR-022
   * no longer fits this fork). Any pending (in-progress) capture is discarded rather than
   * remapped, matching how reset() treats it: resize() already aborts an in-progress stroke
   * before calling this, so a pending capture is stale and would restore to a state the child
   * never asked for.
   *
   * Only states that remap losslessly (wouldRemapLosslessly) are kept — remapWorldState itself
   * silently drops any cell/object that falls outside the new bounds, so keeping a lossy remap
   * would restore a picture quietly missing pieces (and the loss compounds across repeated
   * rotations). Discarding those states instead restores upstream's "undo is always correct"
   * guarantee: fewer undo steps survive a shrink, but every one that does restores exactly the
   * picture it captured. Filtering (not just mapping) still preserves the relative order of the
   * states that do survive.
   */
  remap(
    oldWidth: number,
    oldHeight: number,
    newWidth: number,
    newHeight: number,
    offsetX: number,
    offsetY: number,
  ): void {
    const remapLosslessly = (state: WorldState): WorldState | null =>
      wouldRemapLosslessly(state, oldWidth, oldHeight, newWidth, newHeight, offsetX, offsetY)
        ? remapWorldState(state, oldWidth, oldHeight, newWidth, newHeight, offsetX, offsetY)
        : null;
    const isWorldState = (state: WorldState | null): state is WorldState => state !== null;

    this.undoStack = this.undoStack.map(remapLosslessly).filter(isWorldState);
    this.redoStack = this.redoStack.map(remapLosslessly).filter(isWorldState);
    this.pending = null;
  }
}
