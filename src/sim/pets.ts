import { isSolid } from './element';
import { EMPTY, GUMDROP, ICE_CREAM, WATER, SAND, RAINBOW_SAND, type Grid, type PersonVariant } from './types';
import { randomHue } from './shade';
import { GRID_WIDTH } from '../lib/layout';

export type PoodleState = 'idle' | 'trotting' | 'eating' | 'shaking' | 'digging' | 'tricking';

export interface Poodle {
  readonly id: number;
  x: number;
  y: number;
  facing: 1 | -1;
  state: PoodleState;
  timer: number;
  soggy: boolean;
  /** x of the gumdrop currently being pursued, or -1 if not pursuing one. */
  pursuitX: number;
  /** Smallest horizontal distance to pursuitX reached so far this pursuit. */
  pursuitBestDist: number;
  /** Frames since pursuitBestDist last improved. */
  pursuitStaleFrames: number;
  /** Frames remaining during which gumdrop scent is ignored, after giving up on one that couldn't be reached. */
  gumdropCooldown: number;
  /** Consecutive frames spent with nothing to do; wandering starts once this passes WANDER_IDLE_DELAY. */
  idleFrames: number;
  /** Where "home" is for wandering: set on each arrival/settle, wandering stays within WANDER_RANGE of it. */
  homeX: number;
  /**
   * x of the finger target she already reached, or null. poodleTarget is never cleared upstream,
   * so an arrived-at target keeps arriving every frame forever; while the incoming target stays
   * within CONSUMED_TARGET_SLACK cells of this, it is treated as absent (letting her get bored
   * and wander) — a touch somewhere genuinely new reactivates pursuit.
   */
  consumedTargetX: number | null;
  /** Which way the current wander is drifting. */
  wanderDir: 1 | -1;
}

export type MermaidState = 'resting' | 'drifting' | 'swimming' | 'eating' | 'freeing' | 'tricking';

export interface Mermaid {
  readonly id: number;
  x: number;
  y: number;
  facing: 1 | -1;
  state: MermaidState;
  /** Frames remaining in a busy state (eating/tricking/freeing); 0 means free to act. */
  timer: number;
  /** Ice cream she is currently pursuing, or -1/-1 if none. */
  pursuitX: number;
  pursuitY: number;
  /** Smallest Chebyshev distance to (pursuitX, pursuitY) reached so far this pursuit. */
  pursuitBestDist: number;
  /** Frames since pursuitBestDist last improved — the give-up clock. */
  pursuitStaleFrames: number;
  /** Frames remaining during which ice-cream scent is ignored, after giving up on an unreachable one. */
  iceCreamCooldown: number;
  /** Where "home" is for drifting: set on each settle; drifting stays within MERMAID_DRIFT_RANGE of it. */
  homeX: number;
  homeY: number;
  /** Which way the current drift is heading. */
  driftDir: 1 | -1;
}

export type PersonState = 'standing' | 'walking' | 'running';

export interface Person {
  readonly id: number;
  x: number;
  y: number;
  facing: 1 | -1;
  /** Also the frame to draw — standing/walking/running map 1:1 to state (FR-010). */
  state: PersonState;
  /**
   * Overloaded like Poodle's/Mermaid's timer field, meaning depends on state:
   * 'standing' -> frames left in the current pause before starting to walk;
   * 'walking'  -> frames left in the current walk burst before pausing;
   * 'running'  -> frames left in the poke reaction before returning to 'standing'.
   */
  timer: number;
  /** Which person this is — chosen once at placement (or migration), kept for life (FR-012). */
  readonly variant: PersonVariant;
  /** Where "home" is for roaming: set on each settle; walking stays within PERSON_ROAM_RANGE of it. */
  homeX: number;
  /** Which way the current walk burst is heading. */
  wanderDir: 1 | -1;
}

export interface PetsState {
  poodles: Poodle[];
  mermaids: Mermaid[];
  people: Person[];
  /** Remaining shuffled drawable variants not yet used this cycle (research.md §4). */
  personVariantBag: PersonVariant[];
  nextId: number;
  /** Frame counter used to stagger poodle footsteps; see STEP_INTERVAL. */
  stride: number;
}

/** At most three poodles; placing a fourth retires the oldest. */
export const POODLE_CAP = 3;
/** At most three mermaids; placing a fourth retires the oldest. */
export const MERMAID_CAP = 3;
/** At most three people; placing a fourth retires the oldest (FR-003). */
export const PERSON_CAP = 3;

/** Frames between footsteps. Low enough to feel responsive, high enough to read as a trot. */
const STEP_INTERVAL = 4;
/** How many cells the poodle can step up in one stride before it must go around. */
const MAX_CLIMB = 2;
/** Horizontal distance within which the poodle considers itself arrived. */
const ARRIVE_DISTANCE = 1.5;
/** How far a poodle can smell a gumdrop, in cells. */
export const GUMDROP_SCENT_RADIUS = 25;
/** Frames spent happily eating. */
const EAT_DURATION = 20;
/** Horizontal distance at which the poodle can reach a gumdrop. */
const EAT_REACH = 2;
/** How far above/below the poodle's feet to search when clearing an eaten gumdrop. */
const EAT_SEARCH_HEIGHT = 3;
/**
 * Frames a poodle will keep trying to close the distance on a pursued
 * gumdrop without any improvement before giving up on it. Generous relative
 * to STEP_INTERVAL so a legitimately-approaching poodle (whose distance only
 * ticks down once per stride) never gives up mid-approach.
 */
const GUMDROP_PATIENCE = 40;
/**
 * Frames a poodle ignores all gumdrop scent after giving up on one it
 * couldn't reach, so it stays with her finger instead of immediately
 * re-committing to the same unreachable spot.
 */
const GUMDROP_COOLDOWN = 150;
/** Frames spent shaking off water. */
const SHAKE_DURATION = 30;
/** Frames spent per scoop when digging out. */
const DIG_DURATION = 3;
/** How close a tap must land to a poodle to count as poking it, in cells. */
export const POKE_RADIUS = 14;
/** Frames spent doing a trick after being poked. */
export const TRICK_DURATION = 36;
/** Consecutive idle frames before boredom sets in and she starts to wander. */
export const WANDER_IDLE_DELAY = 150;
/** Frames between wander steps — an unhurried sniff-about, much slower than a trot. */
const WANDER_PAUSE = 45;
/** How far from homeX a wander may roam, in cells. */
export const WANDER_RANGE = 10;
/** How close a new finger target must be to the consumed one to still count as "the same spot". */
const CONSUMED_TARGET_SLACK = 2;

/** Frames spent standing (paused) between walk bursts — a breath before ambling off again (research.md §6). */
const PERSON_PAUSE_FRAMES = 90;
/** Frames spent walking per burst — long enough to read as a stroll, not a twitch. */
const PERSON_WALK_BURST_FRAMES = 120;
/** Frames between steps while walking — slower than the poodle's trot (STEP_INTERVAL), an amble not a strobe. */
const PERSON_STEP_INTERVAL = 10;
/** How far from homeX a walk burst may roam, in cells. */
export const PERSON_ROAM_RANGE = 12;
/** Frames spent running after being poked — a new named constant, not a bare reuse of TRICK_DURATION (research.md §7). */
export const PERSON_RUN_DURATION = 36;

export function createPetsState(): PetsState {
  return { poodles: [], mermaids: [], people: [], personVariantBag: [], nextId: 0, stride: 0 };
}

/** Sends every poodle, mermaid, and person home. `nextId` keeps counting so ids stay unique. */
export function clearPets(state: PetsState): void {
  state.poodles.length = 0;
  state.mermaids.length = 0;
  state.people.length = 0;
}

/**
 * Replaces state.mermaids wholesale with fresh default-activity mermaids rebuilt from just each
 * position (state 'drifting', timer 0, pursuit cleared) — the "position only, saved trusted
 * as-is, no re-search for water" restore rule shared by both restore paths that reconstruct
 * mermaids from persisted data: history.ts's restoreWorldState (undo/redo) and PlayArea.svelte's
 * tryRestore (session save). Deliberately not addMermaid: that function re-searches for the
 * nearest water cell, which is wrong here — a saved/captured position is already known-valid and
 * re-snapping it could move her, or (before any reposition-by-offset has run) search at the wrong
 * coordinates entirely.
 */
export function restoreMermaidsFromPositions(state: PetsState, positions: readonly { x: number; y: number }[]): void {
  state.mermaids = positions.map((p) => ({
    id: state.nextId++,
    x: p.x,
    y: p.y,
    facing: 1,
    state: 'drifting',
    timer: 0,
    pursuitX: -1,
    pursuitY: -1,
    pursuitBestDist: Infinity,
    pursuitStaleFrames: 0,
    iceCreamCooldown: 0,
    homeX: p.x,
    homeY: p.y,
    driftDir: 1,
  }));
}

/**
 * Rebuilds state.people wholesale from saved/migrated {x, y, variant} entries into fresh
 * default-activity people (state 'standing', timer 0) — mirrors restoreMermaidsFromPositions
 * exactly, with variant carried through verbatim rather than re-picked (FR-012, FR-023).
 */
export function restorePeopleFromPositions(
  state: PetsState,
  positions: readonly { x: number; y: number; variant: PersonVariant }[],
): void {
  state.people = positions.map((p) => ({
    id: state.nextId++,
    x: p.x,
    y: p.y,
    facing: 1,
    state: 'standing',
    timer: 0,
    variant: p.variant,
    homeX: p.x,
    wanderDir: 1,
  }));
}

/**
 * Injectable-RNG shuffle-bag variant chooser (FR-013a, research.md §4): Fisher-Yates-shuffles
 * drawableVariants into state.personVariantBag whenever it's empty, then pops one. A
 * single-element drawableVariants list degenerates to "always that element" with no
 * special-casing needed.
 */
export function pickPersonVariant(
  state: PetsState,
  drawableVariants: readonly PersonVariant[],
  rng: () => number,
): PersonVariant {
  if (state.personVariantBag.length === 0) {
    const shuffled = [...drawableVariants];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    state.personVariantBag = shuffled;
  }
  return state.personVariantBag.pop()!;
}

/**
 * Places a person at (x, y) with a freshly-picked variant (via pickPersonVariant); settles onto
 * the surface below her over the following frames via the normal groundBelow check, exactly like
 * addPoodle. Evicts the oldest person first if already at PERSON_CAP.
 */
export function addPerson(
  grid: Grid,
  state: PetsState,
  x: number,
  y: number,
  drawableVariants: readonly PersonVariant[],
  rng: () => number,
): void {
  if (state.people.length >= PERSON_CAP) state.people.shift();
  state.people.push({
    id: state.nextId++,
    x,
    y: groundBelow(grid, x, y),
    facing: 1,
    state: 'standing',
    timer: PERSON_PAUSE_FRAMES,
    variant: pickPersonVariant(state, drawableVariants, rng),
    homeX: x,
    wanderDir: 1,
  });
}

export function addPoodle(state: PetsState, x: number, y: number): void {
  if (state.poodles.length >= POODLE_CAP) state.poodles.shift();
  state.poodles.push({
    id: state.nextId++,
    x,
    y,
    facing: 1,
    state: 'idle',
    timer: 0,
    soggy: false,
    pursuitX: -1,
    pursuitBestDist: Infinity,
    pursuitStaleFrames: 0,
    gumdropCooldown: 0,
    idleFrames: 0,
    homeX: x,
    consumedTargetX: null,
    wanderDir: 1,
  });
}

/**
 * Shifts every poodle by (offsetX, offsetY) — the same offset the grid's
 * objects get on a resize re-derivation — and clamps the result back inside
 * the new grid rather than dropping it. Unlike repositionObjects, a poodle
 * is never removed: an out-of-bounds landing is clamped to the nearest edge
 * cell instead, because losing a pet on a rotation is worse than a frame or
 * two of odd footing. The per-frame groundBelow settle resolves the vertical
 * position (and any horizontal overlap with terrain) on the next step, so
 * this only needs to land the coordinates somewhere sane and in-bounds.
 */
export function repositionPoodles(
  poodles: Poodle[],
  newGrid: Grid,
  offsetX: number,
  offsetY: number,
): void {
  for (const poodle of poodles) {
    poodle.x = Math.min(Math.max(poodle.x + offsetX, 0), newGrid.width - 1);
    poodle.y = Math.min(Math.max(poodle.y + offsetY, 0), newGrid.height - 1);
    // Home moves with her: a stale homeX further than WANDER_RANGE from the shifted position
    // would fail wanderStep's leash check in both directions, permanently disabling wandering.
    poodle.homeX = poodle.x;
  }
}

/** Shifts every mermaid by (offsetX, offsetY) and clamps back in-bounds, exactly mirroring repositionPoodles (FR-028) — never dropped. */
export function repositionMermaids(mermaids: Mermaid[], newGrid: Grid, offsetX: number, offsetY: number): void {
  for (const mermaid of mermaids) {
    mermaid.x = Math.min(Math.max(mermaid.x + offsetX, 0), newGrid.width - 1);
    mermaid.y = Math.min(Math.max(mermaid.y + offsetY, 0), newGrid.height - 1);
    mermaid.homeX = mermaid.x;
    mermaid.homeY = mermaid.y;
  }
}

/**
 * Shifts every person by (offsetX, offsetY) and clamps back in-bounds, exactly mirroring
 * repositionPoodles/repositionMermaids (FR-028) — never dropped. Re-anchors homeX to the shifted
 * x so strolling keeps working afterwards.
 */
export function repositionPeople(people: Person[], newGrid: Grid, offsetX: number, offsetY: number): void {
  for (const person of people) {
    person.x = Math.min(Math.max(person.x + offsetX, 0), newGrid.width - 1);
    person.y = Math.min(Math.max(person.y + offsetY, 0), newGrid.height - 1);
    person.homeX = person.x;
  }
}

function cellIsSolid(grid: Grid, x: number, y: number): boolean {
  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return false;
  return isSolid(grid.elements[y * grid.width + x]);
}

function cellIsWater(grid: Grid, x: number, y: number): boolean {
  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return false;
  return grid.elements[y * grid.width + x] === WATER;
}

function cellIsGumdrop(grid: Grid, x: number, y: number): boolean {
  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return false;
  return grid.elements[y * grid.width + x] === GUMDROP;
}

/**
 * The y the poodle should stand at for a given column: resting on top of the
 * first solid cell at or below its current height, or the floor if there is none.
 */
function groundBelow(grid: Grid, x: number, fromY: number): number {
  const col = Math.round(x);
  for (let y = Math.max(0, Math.floor(fromY)); y < grid.height; y++) {
    if (cellIsSolid(grid, col, y)) return y - 1;
  }
  return grid.height - 1;
}

/**
 * If `entity`'s own cell is solid (buried), clears it and steps up one scoop, returning true.
 * Shared by stepPoodle and stepPerson (research.md §5, T007) — each caller decides what a scoop
 * means for its own state/timer, since a person has no dedicated "digging" frame the way a
 * poodle does. Progress toward the surface is monotonic for the same reason it is in the
 * poodle's own dig-out: only the cell already occupied is ever cleared, one scoop per frame.
 */
function digOutOneScoop(grid: Grid, entity: { x: number; y: number }): boolean {
  const occupiedX = Math.round(entity.x);
  const occupiedY = Math.round(entity.y);
  if (!cellIsSolid(grid, occupiedX, occupiedY)) return false;
  grid.elements[occupiedY * grid.width + occupiedX] = EMPTY;
  // Clamp rather than let a column reaching row 0 push her to y = -1 — she'd render above the
  // canvas top for a few frames before the settle corrects it.
  entity.y = Math.max(0, occupiedY - 1);
  return true;
}

/**
 * Nearest gumdrop within scent range, or -1 if none. Scans a bounded window
 * around the poodle rather than the whole grid, so cost does not grow with
 * canvas size.
 *
 * The scan window is square, GUMDROP_SCENT_RADIUS cells in every direction —
 * matching what "scent radius" actually claims to mean. It used to cap the
 * vertical span at EAT_SEARCH_HEIGHT, a leftover geometric guard from before
 * the pursuit/give-up patience mechanism existed (see GUMDROP_PATIENCE):
 * that guard made a gumdrop just a few rows above or below the poodle
 * invisible even when well within the nominal radius, which defeated the
 * point of dropping one to steer her. Patience — abandoning a target that
 * stops getting closer, for whatever reason — is what actually prevents the
 * softlock now, terrain-independent of this scan's shape. This window says
 * nothing about horizontal obstructions (walls, pits) between here and
 * there, so it is not by itself a guarantee the returned gumdrop is
 * reachable; that guarantee still comes entirely from the pursuit bookkeeping
 * in stepPoodle.
 */
function nearestGumdropX(grid: Grid, poodle: Poodle): number {
  const cx = Math.round(poodle.x);
  const cy = Math.round(poodle.y);
  let bestX = -1;
  let bestDist = Infinity;

  const minX = Math.max(0, cx - GUMDROP_SCENT_RADIUS);
  const maxX = Math.min(grid.width - 1, cx + GUMDROP_SCENT_RADIUS);
  const minY = Math.max(0, cy - GUMDROP_SCENT_RADIUS);
  const maxY = Math.min(grid.height - 1, cy + GUMDROP_SCENT_RADIUS);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (grid.elements[y * grid.width + x] !== GUMDROP) continue;
      const dist = Math.abs(x - cx) + Math.abs(y - cy);
      if (dist < bestDist) {
        bestDist = dist;
        bestX = x;
      }
    }
  }
  return bestDist <= GUMDROP_SCENT_RADIUS ? bestX : -1;
}

/**
 * Clears the GUMDROP cell nearest the poodle's feet at the given column, if
 * one exists within a small neighbourhood. Returns true if a cell was cleared.
 */
function eatGumdropNear(grid: Grid, gx: number, poodle: Poodle): boolean {
  const cy = Math.round(poodle.y);
  const minY = Math.max(0, cy - EAT_SEARCH_HEIGHT);
  const maxY = Math.min(grid.height - 1, cy + EAT_SEARCH_HEIGHT);
  let bestY = -1;
  let bestDist = Infinity;
  for (let y = minY; y <= maxY; y++) {
    if (grid.elements[y * grid.width + gx] !== GUMDROP) continue;
    const dist = Math.abs(y - cy);
    if (dist < bestDist) {
      bestDist = dist;
      bestY = y;
    }
  }
  if (bestY === -1) return false;
  grid.elements[bestY * grid.width + gx] = EMPTY;
  return true;
}

/**
 * Pokes the nearest poodle within POKE_RADIUS of (x, y): if there is one and
 * its timer is free (not eating/shaking/digging/mid-trick), it does a trick —
 * state 'tricking', held via the existing timer gate exactly like eating and
 * shaking, so it must not (and does not) touch any pursuit field. Returns
 * true iff a trick started. Never throws.
 */
export function pokePoodleAt(pets: PetsState, x: number, y: number): boolean {
  let nearest: Poodle | null = null;
  let bestDist = Infinity;
  for (const poodle of pets.poodles) {
    const dist = Math.hypot(poodle.x - x, poodle.y - y);
    if (dist <= POKE_RADIUS && dist < bestDist) {
      bestDist = dist;
      nearest = poodle;
    }
  }
  if (nearest === null || nearest.timer > 0) return false;
  nearest.state = 'tricking';
  nearest.timer = TRICK_DURATION;
  return true;
}

/**
 * One unhurried wander step: a single cell in the drifting direction, turning around at the
 * WANDER_RANGE leash around homeX, at the grid's edges, and (sometimes) on a whim. State is
 * deliberately NOT touched — a wandering poodle stays 'idle' — and there is no grooming here:
 * sniffing about is not a trot, so it never converts sand.
 */
function wanderStep(grid: Grid, poodle: Poodle): void {
  if (Math.random() < 0.25) poodle.wanderDir = poodle.wanderDir === 1 ? -1 : 1;

  const stepOk = (x: number): boolean =>
    x >= 0 && x <= grid.width - 1 && Math.abs(x - poodle.homeX) <= WANDER_RANGE;

  let nextX = poodle.x + poodle.wanderDir;
  if (!stepOk(nextX)) {
    poodle.wanderDir = poodle.wanderDir === 1 ? -1 : 1;
    nextX = poodle.x + poodle.wanderDir;
    if (!stepOk(nextX)) return; // cornered (home right at an edge); just stand there
  }

  const nextY = groundBelow(grid, nextX, Math.max(0, poodle.y - MAX_CLIMB));
  if (poodle.y - nextY > MAX_CLIMB) {
    // Too tall to bother climbing while just sniffing about — drift the other way next time.
    poodle.wanderDir = poodle.wanderDir === 1 ? -1 : 1;
    return;
  }

  poodle.facing = poodle.wanderDir;
  poodle.x = nextX;
  poodle.y = nextY;
}

/** Advances one poodle by one frame. Allocation-free. */
function stepPoodle(grid: Grid, poodle: Poodle, target: { x: number; y: number } | null, stride: number): void {
  if (poodle.timer > 0) {
    poodle.timer--;
    poodle.idleFrames = 0;
    if (poodle.timer === 0) poodle.state = 'idle';
    return;
  }

  const occupiedX = Math.round(poodle.x);
  const occupiedY = Math.round(poodle.y);

  if (cellIsGumdrop(grid, occupiedX, occupiedY)) {
    // A gumdrop landed exactly on her own cell (dropped there directly, or
    // uncovered by her own digging). isSolid() counts GUMDROP as solid for
    // burial purposes below, but this is eating, not digging: check for it
    // first so the two don't share a predicate and this gumdrop doesn't get
    // silently deleted with no eating state and no sparkle.
    grid.elements[occupiedY * grid.width + occupiedX] = EMPTY;
    poodle.state = 'eating';
    poodle.timer = EAT_DURATION;
    poodle.pursuitX = -1;
    poodle.pursuitBestDist = Infinity;
    poodle.pursuitStaleFrames = 0;
    return;
  }

  if (digOutOneScoop(grid, poodle)) {
    // Buried: the cell she's standing in was solid, and digOutOneScoop just cleared one scoop of
    // it. This reads as digging rather than teleporting, and a very deep burial can't produce a
    // single unbounded-cost frame — see digOutOneScoop's own doc comment for why progress toward
    // the surface is monotonic. Once the column above her is clear the ordinary ground-settle
    // below takes over and rests her on whatever surface she uncovered.
    poodle.state = 'digging';
    poodle.timer = DIG_DURATION;
    return;
  }

  poodle.y = groundBelow(grid, poodle.x, poodle.y);

  const feetX = Math.round(poodle.x);
  const feetY = Math.round(poodle.y);
  const inWater = cellIsWater(grid, feetX, feetY) || cellIsWater(grid, feetX, feetY + 1);
  if (inWater) poodle.soggy = true;

  if (poodle.soggy && !inWater) {
    // Only start shaking once she's actually out of the water — starting it
    // while still standing in a pond would shake forever and never resolve.
    poodle.state = 'shaking';
    poodle.timer = SHAKE_DURATION;
    poodle.soggy = false;
    return;
  }

  let targetX: number | null = null;

  if (poodle.gumdropCooldown > 0) {
    poodle.gumdropCooldown--;
  } else {
    const gumdropX = nearestGumdropX(grid, poodle);
    if (gumdropX === -1) {
      poodle.pursuitX = -1;
      poodle.pursuitBestDist = Infinity;
      poodle.pursuitStaleFrames = 0;
    } else {
      if (poodle.pursuitX !== gumdropX) {
        poodle.pursuitX = gumdropX;
        poodle.pursuitBestDist = Infinity;
        poodle.pursuitStaleFrames = 0;
      }

      const dist = Math.abs(gumdropX - poodle.x);
      if (dist < poodle.pursuitBestDist) {
        poodle.pursuitBestDist = dist;
        poodle.pursuitStaleFrames = 0;
      } else {
        poodle.pursuitStaleFrames++;
      }

      if (poodle.pursuitStaleFrames > GUMDROP_PATIENCE) {
        // She hasn't gotten any closer to this one in a while — give up on
        // it (whatever the reason: a wall, a pit, a ledge too high) and
        // ignore gumdrop scent for a while so her finger gets control back
        // instead of immediately re-committing to the same dead end.
        poodle.pursuitX = -1;
        poodle.pursuitBestDist = Infinity;
        poodle.pursuitStaleFrames = 0;
        poodle.gumdropCooldown = GUMDROP_COOLDOWN;
      } else if (dist <= EAT_REACH && eatGumdropNear(grid, gumdropX, poodle)) {
        poodle.state = 'eating';
        poodle.timer = EAT_DURATION;
        poodle.pursuitX = -1;
        poodle.pursuitBestDist = Infinity;
        poodle.pursuitStaleFrames = 0;
        return;
      } else {
        targetX = gumdropX;
      }
    }
  }

  let chasingFinger = false;
  if (targetX === null && target !== null) {
    if (poodle.consumedTargetX !== null && Math.abs(target.x - poodle.consumedTargetX) <= CONSUMED_TARGET_SLACK) {
      // Still the touch she already answered — treat it as absent (see consumedTargetX).
    } else {
      poodle.consumedTargetX = null;
      targetX = target.x;
      chasingFinger = true;
    }
  }

  if (targetX === null) {
    // Nothing to chase at all. Boredom accrues, and once it passes the delay she takes one
    // wander step every WANDER_PAUSE frames — but never while a gumdrop cooldown is pending
    // pursuit (her finger, or the resumed chase, gets her first).
    poodle.state = 'idle';
    // The first idle frame after doing anything (a trot, a meal, a trick, a dig) is a settle:
    // wherever she is now is the home her wandering stays near. Without this, eating a gumdrop
    // more than WANDER_RANGE from the old home would strand her outside her own leash and
    // silently disable wandering forever.
    if (poodle.idleFrames === 0) poodle.homeX = poodle.x;
    poodle.idleFrames++;
    if (
      poodle.gumdropCooldown === 0 &&
      poodle.idleFrames >= WANDER_IDLE_DELAY &&
      (poodle.idleFrames - WANDER_IDLE_DELAY) % WANDER_PAUSE === 0
    ) {
      wanderStep(grid, poodle);
    }
    return;
  }

  const dx = targetX - poodle.x;
  if (Math.abs(dx) <= ARRIVE_DISTANCE) {
    poodle.state = 'idle';
    if (poodle.idleFrames === 0) poodle.homeX = poodle.x; // settle: see the branch above
    poodle.idleFrames++;
    if (chasingFinger) {
      // Arrived at her finger: consume this target so it stops re-arriving forever.
      poodle.consumedTargetX = targetX;
    }
    return;
  }

  poodle.facing = dx > 0 ? 1 : -1;
  poodle.state = 'trotting';
  poodle.idleFrames = 0;

  if (poodle.id % STEP_INTERVAL !== stride % STEP_INTERVAL) return;

  const nextX = poodle.x + poodle.facing;
  if (nextX < 0 || nextX > grid.width - 1) {
    poodle.state = 'idle';
    return;
  }

  const nextY = groundBelow(grid, nextX, Math.max(0, poodle.y - MAX_CLIMB));
  if (poodle.y - nextY > MAX_CLIMB) {
    poodle.state = 'idle';
    return;
  }

  poodle.x = nextX;
  poodle.y = nextY;

  const groundX = Math.round(nextX);
  const groundY = nextY + 1;
  if (groundY < grid.height) {
    const groundI = groundY * grid.width + groundX;
    if (grid.elements[groundI] === SAND) {
      grid.elements[groundI] = RAINBOW_SAND;
      grid.hues[groundI] = randomHue();
    }
  }
}

/** Frames between drift steps — an unhurried, gentle amble, slower-paced than the poodle's trot (FR-006). */
const MERMAID_SWIM_INTERVAL = 6;
/**
 * Frames between steps while actively pursuing spotted ice cream — faster than ordinary drifting
 * (FR-006 only constrains the unhurried, nothing-to-chase cadence). Needed for SC-001: with
 * ICE_CREAM_SCENT_RADIUS now covering the toy's whole max grid, a mermaid at one end of a
 * canvas-spanning pool must be able to close a ~265-cell beeline within the 600-frame/10s budget,
 * which the drift-paced interval alone cannot do (T056).
 */
const MERMAID_PURSUIT_INTERVAL = 2;
/** Bounded square-window scan (mirrors nearestGumdropX's shape) for the nearest WATER cell when placing her. */
const MERMAID_PLACEMENT_SEARCH_RADIUS = 30;
/** Bounded neighbourhood scanned each frame while buried, looking for an escape cell. */
const MERMAID_FREE_RADIUS = 6;
/** Cosmetic hold once freed — mirrors DIG_DURATION's cadence so escaping still reads as an event, not a teleport. */
const MERMAID_FREE_DURATION = 12;
/** How far from home a drift may roam, in cells. */
export const MERMAID_DRIFT_RANGE = 10;
/** Frames spent doing a trick after being poked. */
export const MERMAID_TRICK_DURATION = 36;
/**
 * How far a mermaid can smell ice cream, in cells. Sized to the toy's own max grid width
 * (GRID_WIDTH, a fixed constant that does not grow with any particular canvas/resize) rather than
 * GUMDROP_SCENT_RADIUS's smaller value, so a mermaid at one end of a canvas-spanning pool can
 * always sense — and make a beeline for — ice cream at the other end (SC-001, T056). Still a
 * fixed window per FR-010's letter: it is pinned to the toy's fixed maximum grid, never to the
 * live grid's actual (possibly smaller) width/height.
 */
export const ICE_CREAM_SCENT_RADIUS = GRID_WIDTH;
/** Frames spent happily eating. */
const MERMAID_EAT_DURATION = 20;
/**
 * Frames a mermaid will keep trying to close the distance on a pursued ice cream without any
 * improvement before giving up on it — mirrors GUMDROP_PATIENCE, generalized to Chebyshev
 * distance (research.md §2).
 */
const ICE_CREAM_PATIENCE = 40;
/** Frames a mermaid ignores all ice-cream scent after giving up on one it couldn't reach — mirrors GUMDROP_COOLDOWN. */
const ICE_CREAM_COOLDOWN = 150;

/**
 * Nearest WATER cell within a bounded square window around (x, y), or null if none — the
 * placement-time snap used by addMermaid. Mirrors nearestGumdropX's shape (bounded scan, no
 * allocation) but searches both axes since a mermaid's target is a cell, not a column.
 */
function nearestWaterCell(grid: Grid, x: number, y: number): { x: number; y: number } | null {
  const cx = Math.round(x);
  const cy = Math.round(y);
  let bestX = -1;
  let bestY = -1;
  let bestDist = Infinity;
  let tieCount = 0;

  const minX = Math.max(0, cx - MERMAID_PLACEMENT_SEARCH_RADIUS);
  const maxX = Math.min(grid.width - 1, cx + MERMAID_PLACEMENT_SEARCH_RADIUS);
  const minY = Math.max(0, cy - MERMAID_PLACEMENT_SEARCH_RADIUS);
  const maxY = Math.min(grid.height - 1, cy + MERMAID_PLACEMENT_SEARCH_RADIUS);

  for (let yy = minY; yy <= maxY; yy++) {
    for (let xx = minX; xx <= maxX; xx++) {
      if (grid.elements[yy * grid.width + xx] !== WATER) continue;
      const dist = Math.max(Math.abs(xx - cx), Math.abs(yy - cy));
      if (dist < bestDist) {
        bestDist = dist;
        bestX = xx;
        bestY = yy;
        tieCount = 1;
      } else if (dist === bestDist) {
        tieCount++;
        if (Math.random() < 1 / tieCount) {
          bestX = xx;
          bestY = yy;
        }
      }
    }
  }
  return bestDist === Infinity ? null : { x: bestX, y: bestY };
}

/**
 * Nearest non-solid cell within a bounded square neighbourhood around (cx, cy), excluding (cx,
 * cy) itself, or null if the whole neighbourhood is solid. Used to find an escape cell when a
 * mermaid is buried (research.md §4) — bounded, allocation-free, re-scanned every frame she stays
 * buried rather than cached, so it always reflects the current grid.
 *
 * Prefers WATER over any other non-solid cell (tracked as a separate running best in the same
 * pass, no second scan): a mermaid buried near the edge of her pool, right beside both open water
 * and a dry gap of equal distance, must not have a coin-flip chance of escaping onto the dry gap
 * and being stranded there forever if it can never receive water (T058 — this was a real,
 * reproducible stuck state, not just a hypothetical one). Non-water is still the fallback when no
 * water at all is in reach, matching FR-009's "water or free cell" and FR-008's no-water-nearby
 * resting behaviour.
 */
function nearestNonSolidCell(grid: Grid, cx: number, cy: number, radius: number): { x: number; y: number } | null {
  let bestX = -1;
  let bestY = -1;
  let bestDist = Infinity;
  let tieCount = 0;
  let bestWaterX = -1;
  let bestWaterY = -1;
  let bestWaterDist = Infinity;
  let waterTieCount = 0;

  const minX = Math.max(0, cx - radius);
  const maxX = Math.min(grid.width - 1, cx + radius);
  const minY = Math.max(0, cy - radius);
  const maxY = Math.min(grid.height - 1, cy + radius);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (x === cx && y === cy) continue;
      if (cellIsSolid(grid, x, y)) continue;
      const dist = Math.max(Math.abs(x - cx), Math.abs(y - cy));
      if (dist < bestDist) {
        bestDist = dist;
        bestX = x;
        bestY = y;
        tieCount = 1;
      } else if (dist === bestDist) {
        tieCount++;
        if (Math.random() < 1 / tieCount) {
          bestX = x;
          bestY = y;
        }
      }
      if (!cellIsWater(grid, x, y)) continue;
      if (dist < bestWaterDist) {
        bestWaterDist = dist;
        bestWaterX = x;
        bestWaterY = y;
        waterTieCount = 1;
      } else if (dist === bestWaterDist) {
        waterTieCount++;
        if (Math.random() < 1 / waterTieCount) {
          bestWaterX = x;
          bestWaterY = y;
        }
      }
    }
  }
  if (bestWaterDist !== Infinity) return { x: bestWaterX, y: bestWaterY };
  return bestDist === Infinity ? null : { x: bestX, y: bestY };
}

/**
 * The best neighbour (of up to 8, dx/dy in {-1,0,1} excluding (0,0)) to step onto — Chebyshev
 * distance to (targetX, targetY), ties broken uniformly at random via reservoir sampling.
 * Allocation-free (constitution Principle IV): no candidate array, just running best/tie-count.
 * Mirrors research.md §1's "greedy neighbour stepping, not pathfinding" decision.
 *
 * A candidate is valid if it is WATER, or if it exactly matches (allowX, allowY) — the latter
 * lets a mermaid step directly onto her pursuit target even when that one cell holds ICE_CREAM
 * rather than WATER (otherwise she could approach to distance 1 and never actually reach it, see
 * FR-017/FR-018). Pass -1, -1 (never a real coordinate) to disable that exception for ordinary
 * drifting/recovery, which must only ever step onto genuine WATER.
 */
function bestSwimNeighbour(
  grid: Grid,
  cx: number,
  cy: number,
  targetX: number,
  targetY: number,
  allowX: number,
  allowY: number,
): { x: number; y: number } | null {
  let bestX = -1;
  let bestY = -1;
  let bestDist = Infinity;
  let tieCount = 0;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = cx + dx;
      const ny = cy + dy;
      const valid = cellIsWater(grid, nx, ny) || (nx === allowX && ny === allowY);
      if (!valid) continue;
      const dist = Math.max(Math.abs(nx - targetX), Math.abs(ny - targetY));
      if (dist < bestDist) {
        bestDist = dist;
        bestX = nx;
        bestY = ny;
        tieCount = 1;
      } else if (dist === bestDist) {
        tieCount++;
        if (Math.random() < 1 / tieCount) {
          bestX = nx;
          bestY = ny;
        }
      }
    }
  }
  return bestDist === Infinity ? null : { x: bestX, y: bestY };
}

function bestWaterNeighbour(grid: Grid, cx: number, cy: number, targetX: number, targetY: number): { x: number; y: number } | null {
  return bestSwimNeighbour(grid, cx, cy, targetX, targetY, -1, -1);
}

/**
 * At most once every `interval` frames (per mermaid, staggered by id), steps onto whichever
 * neighbour is closest to (targetX, targetY) — ordinarily WATER only, or also (targetX, targetY)
 * itself when allowTarget is true (the pursuit case, so she can step onto an ice cream cell).
 * No-op if there is no valid neighbour at all. Callers pass MERMAID_SWIM_INTERVAL for ordinary
 * drifting/recovery and the faster MERMAID_PURSUIT_INTERVAL while actively chasing ice cream.
 */
function swimToward(
  grid: Grid,
  mermaid: Mermaid,
  targetX: number,
  targetY: number,
  stride: number,
  allowTarget = false,
  interval: number = MERMAID_SWIM_INTERVAL,
): void {
  if (mermaid.id % interval !== stride % interval) return;
  const next = bestSwimNeighbour(
    grid,
    Math.round(mermaid.x),
    Math.round(mermaid.y),
    targetX,
    targetY,
    allowTarget ? targetX : -1,
    allowTarget ? targetY : -1,
  );
  if (next === null) return;
  if (next.x !== mermaid.x) mermaid.facing = next.x > mermaid.x ? 1 : -1;
  mermaid.x = next.x;
  mermaid.y = next.y;
}

/**
 * One gentle drift step: no target to chase, so she ambles along her drift direction within
 * MERMAID_DRIFT_RANGE of home, turning around at the leash (mirrors wanderStep's shape) — with no
 * boredom delay (research.md §3): a mermaid drifts from frame one, she never just stands still.
 *
 * Reaching the leash edge re-anchors home to her current spot and rerolls the direction, rather
 * than always turning back toward the old home: at any instant she is still bounded to
 * MERMAID_DRIFT_RANGE of her (current) home per FR-006, but the anchor itself can keep sliding in
 * the same direction indefinitely, so over many leash-lengths of ordinary drifting she eventually
 * sweeps the whole connected pool instead of orbiting her original settle point forever (T056).
 */
function driftStep(grid: Grid, mermaid: Mermaid, stride: number): void {
  if (Math.random() < 0.02) mermaid.driftDir = mermaid.driftDir === 1 ? -1 : 1;
  if (Math.abs(mermaid.x - mermaid.homeX) >= MERMAID_DRIFT_RANGE) {
    mermaid.homeX = mermaid.x;
    mermaid.homeY = mermaid.y;
    mermaid.driftDir = Math.random() < 0.5 ? 1 : -1;
  }
  const targetX = Math.max(0, Math.min(grid.width - 1, mermaid.homeX + mermaid.driftDir * MERMAID_DRIFT_RANGE));
  mermaid.state = 'drifting';
  swimToward(grid, mermaid, targetX, mermaid.y, stride);
}

/**
 * Nearest ICE_CREAM cell within a bounded square window around (x, y), or null if none — mirrors
 * nearestGumdropX's shape (bounded scan, no allocation), predicate swapped, and scans both axes
 * since a mermaid's target is a cell, not a column.
 */
function nearestIceCreamCell(grid: Grid, x: number, y: number): { x: number; y: number } | null {
  const cx = Math.round(x);
  const cy = Math.round(y);
  let bestX = -1;
  let bestY = -1;
  let bestDist = Infinity;
  let tieCount = 0;

  const minX = Math.max(0, cx - ICE_CREAM_SCENT_RADIUS);
  const maxX = Math.min(grid.width - 1, cx + ICE_CREAM_SCENT_RADIUS);
  const minY = Math.max(0, cy - ICE_CREAM_SCENT_RADIUS);
  const maxY = Math.min(grid.height - 1, cy + ICE_CREAM_SCENT_RADIUS);

  for (let yy = minY; yy <= maxY; yy++) {
    for (let xx = minX; xx <= maxX; xx++) {
      if (grid.elements[yy * grid.width + xx] !== ICE_CREAM) continue;
      const dist = Math.max(Math.abs(xx - cx), Math.abs(yy - cy));
      if (dist < bestDist) {
        bestDist = dist;
        bestX = xx;
        bestY = yy;
        tieCount = 1;
      } else if (dist === bestDist) {
        tieCount++;
        if (Math.random() < 1 / tieCount) {
          bestX = xx;
          bestY = yy;
        }
      }
    }
  }
  return bestDist === Infinity ? null : { x: bestX, y: bestY };
}

/**
 * Scent/pursuit/give-up/cooldown bookkeeping, mirroring stepPoodle's gumdrop pursuit shape
 * exactly (research.md §2) but with Chebyshev distance in place of a 1D column distance. Returns
 * true iff she is actively pursuing this frame (state set to 'swimming', a swim step attempted);
 * false means the caller should fall through to ordinary drifting.
 */
function pursueIceCream(grid: Grid, mermaid: Mermaid, stride: number): boolean {
  if (mermaid.iceCreamCooldown > 0) {
    mermaid.iceCreamCooldown--;
    return false;
  }

  const target = nearestIceCreamCell(grid, mermaid.x, mermaid.y);
  if (target === null) {
    mermaid.pursuitX = -1;
    mermaid.pursuitY = -1;
    mermaid.pursuitBestDist = Infinity;
    mermaid.pursuitStaleFrames = 0;
    return false;
  }

  if (mermaid.pursuitX !== target.x || mermaid.pursuitY !== target.y) {
    mermaid.pursuitX = target.x;
    mermaid.pursuitY = target.y;
    mermaid.pursuitBestDist = Infinity;
    mermaid.pursuitStaleFrames = 0;
  }

  const dist = Math.max(Math.abs(mermaid.pursuitX - mermaid.x), Math.abs(mermaid.pursuitY - mermaid.y));
  if (dist < mermaid.pursuitBestDist) {
    mermaid.pursuitBestDist = dist;
    mermaid.pursuitStaleFrames = 0;
  } else {
    mermaid.pursuitStaleFrames++;
  }

  if (mermaid.pursuitStaleFrames > ICE_CREAM_PATIENCE) {
    // Hasn't gotten any closer in a while — give up (wall, unreachable pool, dry land) and ignore
    // ice-cream scent for a while so she settles back into ordinary drifting instead of
    // immediately re-committing to the same unreachable spot.
    mermaid.pursuitX = -1;
    mermaid.pursuitY = -1;
    mermaid.pursuitBestDist = Infinity;
    mermaid.pursuitStaleFrames = 0;
    mermaid.iceCreamCooldown = ICE_CREAM_COOLDOWN;
    return false;
  }

  mermaid.state = 'swimming';
  swimToward(grid, mermaid, mermaid.pursuitX, mermaid.pursuitY, stride, true, MERMAID_PURSUIT_INTERVAL);
  return true;
}

/** At most three mermaids at once; placing a fourth retires the oldest, mirroring addPoodle. */
export function addMermaid(grid: Grid, state: PetsState, x: number, y: number): void {
  if (state.mermaids.length >= MERMAID_CAP) state.mermaids.shift();
  const water = nearestWaterCell(grid, x, y);
  const placeX = water !== null ? water.x : Math.round(x);
  const placeY = water !== null ? water.y : groundBelow(grid, x, y);
  state.mermaids.push({
    id: state.nextId++,
    x: placeX,
    y: placeY,
    facing: 1,
    state: water !== null ? 'drifting' : 'resting',
    timer: 0,
    pursuitX: -1,
    pursuitY: -1,
    pursuitBestDist: Infinity,
    pursuitStaleFrames: 0,
    iceCreamCooldown: 0,
    homeX: placeX,
    homeY: placeY,
    driftDir: 1,
  });
}

/**
 * Pokes the nearest mermaid within POKE_RADIUS of (x, y): if there is one and its timer is free
 * (not eating/freeing/mid-trick), she does a trick. Returns true iff a trick started. Mirrors
 * pokePoodleAt exactly — a mermaid never follows a finger, so this is the only touch interaction
 * she has (FR-011).
 */
export function pokeMermaidAt(pets: PetsState, x: number, y: number): boolean {
  let nearest: Mermaid | null = null;
  let bestDist = Infinity;
  for (const mermaid of pets.mermaids) {
    const dist = Math.hypot(mermaid.x - x, mermaid.y - y);
    if (dist <= POKE_RADIUS && dist < bestDist) {
      bestDist = dist;
      nearest = mermaid;
    }
  }
  if (nearest === null || nearest.timer > 0) return false;
  nearest.state = 'tricking';
  nearest.timer = MERMAID_TRICK_DURATION;
  return true;
}

/** Removes, in whole, every mermaid within radius of (cx, cy) — same circular-reach shape as eraseObjectsInBrush (research.md §12). */
export function eraseMermaidsInBrush(pets: PetsState, cx: number, cy: number, radius: number): void {
  for (let i = pets.mermaids.length - 1; i >= 0; i--) {
    const mermaid = pets.mermaids[i];
    const dx = mermaid.x - cx;
    const dy = mermaid.y - cy;
    if (dx * dx + dy * dy <= radius * radius) pets.mermaids.splice(i, 1);
  }
}

/** Applies eraseMermaidsInBrush along every point on the line from `from` to `to`, Bresenham-interpolated exactly like eraseObjectsInBrushLine. */
export function eraseMermaidsInBrushLine(
  pets: PetsState,
  from: { x: number; y: number },
  to: { x: number; y: number },
  radius: number,
): void {
  let x0 = Math.round(from.x);
  let y0 = Math.round(from.y);
  const x1 = Math.round(to.x);
  const y1 = Math.round(to.y);

  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;

  for (;;) {
    eraseMermaidsInBrush(pets, x0, y0, radius);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/** Advances one mermaid by one frame. Allocation-free. */
function stepMermaid(grid: Grid, mermaid: Mermaid, stride: number): void {
  if (mermaid.timer > 0) {
    mermaid.timer--;
    if (mermaid.timer === 0) {
      const ownWater = cellIsWater(grid, Math.round(mermaid.x), Math.round(mermaid.y));
      mermaid.state = ownWater ? 'drifting' : 'resting';
      mermaid.homeX = mermaid.x;
      mermaid.homeY = mermaid.y;
    }
    return;
  }

  const ownX = Math.round(mermaid.x);
  const ownY = Math.round(mermaid.y);

  if (grid.elements[ownY * grid.width + ownX] === ICE_CREAM) {
    // Ice cream landed exactly on her own cell (poured there directly, or arrived at via
    // pursuit): eat it. isSolid() counts ICE_CREAM as solid for burial purposes below, but this
    // is eating, not freeing — check for it first so the two don't share a predicate and this
    // scoop doesn't get silently deleted with no eating state (mirrors stepPoodle's own gumdrop-
    // on-her-own-cell check, FR-021).
    grid.elements[ownY * grid.width + ownX] = EMPTY;
    mermaid.state = 'eating';
    mermaid.timer = MERMAID_EAT_DURATION;
    mermaid.pursuitX = -1;
    mermaid.pursuitY = -1;
    mermaid.pursuitBestDist = Infinity;
    mermaid.pursuitStaleFrames = 0;
    return;
  }

  if (cellIsSolid(grid, ownX, ownY)) {
    // Buried: no gravity relationship exists to guide "up", so search-and-relocate rather than
    // dig (research.md §4). Re-attempted every frame she stays buried, in case the grid changes.
    mermaid.state = 'freeing';
    const free = nearestNonSolidCell(grid, ownX, ownY, MERMAID_FREE_RADIUS);
    if (free !== null) {
      mermaid.x = free.x;
      mermaid.y = free.y;
      mermaid.timer = MERMAID_FREE_DURATION;
      mermaid.pursuitX = -1;
      mermaid.pursuitY = -1;
      mermaid.pursuitBestDist = Infinity;
      mermaid.pursuitStaleFrames = 0;
    }
    return;
  }

  if (mermaid.state === 'resting') {
    // Placed with no water anywhere, or settled after one drained out from under her: rests here
    // (unchanged) until water reaches her cell, at which point she starts swimming (FR-008).
    if (cellIsWater(grid, ownX, ownY)) {
      mermaid.state = 'drifting';
      mermaid.homeX = mermaid.x;
      mermaid.homeY = mermaid.y;
    }
    return;
  }

  if (!cellIsWater(grid, ownX, ownY)) {
    // Her own cell stopped being water (the pool receded/drained). Try to recover onto an
    // adjacent water cell immediately; if none exists anywhere nearby, settle onto solid ground
    // below rather than leaving her stranded mid-air (Edge Cases: "water drains from under her").
    const recover = bestWaterNeighbour(grid, ownX, ownY, ownX, ownY);
    if (recover !== null) {
      mermaid.x = recover.x;
      mermaid.y = recover.y;
      return;
    }
    mermaid.x = ownX;
    mermaid.y = groundBelow(grid, ownX, ownY);
    mermaid.state = 'resting';
    mermaid.pursuitX = -1;
    mermaid.pursuitY = -1;
    mermaid.pursuitBestDist = Infinity;
    mermaid.pursuitStaleFrames = 0;
    return;
  }

  if (!pursueIceCream(grid, mermaid, stride)) {
    driftStep(grid, mermaid, stride);
  }
}

export function stepMermaids(grid: Grid, state: PetsState): void {
  for (const mermaid of state.mermaids) stepMermaid(grid, mermaid, state.stride);
}

/**
 * Advances one person by one frame. Allocation-free. No `target` parameter — a person never
 * chases anything or follows a finger (FR-006). Reuses groundBelow/MAX_CLIMB/digOutOneScoop from
 * the poodle unmodified (research.md §5); drops everything pursuit-related, which a person has
 * no equivalent of.
 */
function stepPerson(grid: Grid, person: Person, stride: number): void {
  if (digOutOneScoop(grid, person)) return; // buried: one scoop this frame; no dedicated "digging" frame exists, so state/timer are untouched

  person.y = groundBelow(grid, person.x, person.y);

  if (person.state === 'running') {
    person.timer--;
    if (person.timer <= 0) {
      person.state = 'standing';
      person.timer = PERSON_PAUSE_FRAMES;
    }
    return;
  }

  if (person.state === 'standing') {
    person.timer--;
    if (person.timer <= 0) {
      person.state = 'walking';
      person.timer = PERSON_WALK_BURST_FRAMES;
      person.wanderDir = Math.random() < 0.5 ? 1 : -1;
      // Sync facing to the freshly-picked direction on this same frame — otherwise she'd be drawn
      // in the walking frame for one frame still facing her old direction (FR-010/FR-011).
      person.facing = person.wanderDir;
    }
    return;
  }

  // 'walking': attempt one cell-step on the staggered frame; turn around in place (without ending
  // the burst) if blocked by the roam range, the grid edge, or a wall taller than MAX_CLIMB.
  person.timer--;

  if (person.id % PERSON_STEP_INTERVAL === stride % PERSON_STEP_INTERVAL) {
    const nextX = person.x + person.wanderDir;
    const withinRoam = Math.abs(nextX - person.homeX) <= PERSON_ROAM_RANGE;
    const withinGrid = nextX >= 0 && nextX <= grid.width - 1;
    if (withinRoam && withinGrid) {
      const nextY = groundBelow(grid, nextX, Math.max(0, person.y - MAX_CLIMB));
      if (person.y - nextY <= MAX_CLIMB) {
        person.x = nextX;
        person.y = nextY;
      } else {
        person.wanderDir = person.wanderDir === 1 ? -1 : 1;
      }
    } else {
      person.wanderDir = person.wanderDir === 1 ? -1 : 1;
    }
  }

  person.facing = person.wanderDir;

  if (person.timer <= 0) {
    person.state = 'standing';
    person.timer = PERSON_PAUSE_FRAMES;
  }
}

/** Advances every person one frame (research.md §5-6). No `target` parameter (FR-006). */
export function stepPeople(grid: Grid, state: PetsState): void {
  for (const person of state.people) stepPerson(grid, person, state.stride);
}

export function stepPets(grid: Grid, pets: PetsState, target: { x: number; y: number } | null): void {
  pets.stride++;
  for (const poodle of pets.poodles) stepPoodle(grid, poodle, target, pets.stride);
  stepMermaids(grid, pets);
  stepPeople(grid, pets);
}
