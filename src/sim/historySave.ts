import { HISTORY_DEPTH, type WorldState } from './history';
import { OBJECT_KINDS, migrateLegacyPersonObjects } from './objects';
import { encodeBase64, decodeBase64 } from './save';
import type { Grid, ObjectKind, PersonVariant, PlacedObject } from './types';
import { PERSON_CAP } from './pets';

/** Bumped whenever this wire format's shape changes; deserializeHistory rejects any other value. Independent of save.ts's SAVE_VERSION. */
export const HISTORY_SAVE_VERSION = 1;

/** ~2 MB of serialized JSON characters (a conservative proxy for bytes — research.md §3). Decides how many undo steps survive a close; never the in-memory HISTORY_DEPTH cap. */
export const HISTORY_BYTE_BUDGET = 2 * 1024 * 1024;

/**
 * Cheap, deterministic, synchronous hash (32-bit FNV-1a, hex-encoded) of a raw serialized-world
 * JSON string, used to pair a history payload to the exact world save it was written beside
 * (FR-017, research.md §2). Never throws.
 */
export function computeFingerprint(raw: string): string {
  try {
    let hash = 0x811c9dc5;
    for (let i = 0; i < raw.length; i++) {
      hash ^= raw.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  } catch {
    return '';
  }
}

interface WireHistoryObject {
  id: number;
  kind: string;
  x: number;
  y: number;
  size: number;
}

interface WireHistoryMermaid {
  x: number;
  y: number;
}

interface WireHistoryPerson {
  x: number;
  y: number;
  variant: PersonVariant;
}

interface WireHistoryStep {
  elements: string;
  colorAux: string;
  cloud: string;
  glitter: string;
  grassHeight: string;
  byKind: Record<string, WireHistoryObject[]>;
  mermaids?: WireHistoryMermaid[];
  people?: WireHistoryPerson[];
}

interface WireHistory {
  version: number;
  width: number;
  height: number;
  worldFingerprint: string;
  steps: WireHistoryStep[];
}

function encodeStep(state: WorldState): WireHistoryStep {
  const byKind: Record<string, WireHistoryObject[]> = {};
  for (const kind of OBJECT_KINDS) {
    byKind[kind] = state.byKind[kind].map((obj) => ({
      id: obj.id,
      kind: obj.kind,
      x: obj.x,
      y: obj.y,
      size: obj.size,
    }));
  }
  return {
    elements: encodeBase64(state.elements),
    colorAux: encodeBase64(state.colorAux),
    cloud: encodeBase64(state.cloud),
    glitter: encodeBase64(state.glitter),
    grassHeight: encodeBase64(state.grassHeight),
    byKind,
    mermaids: state.mermaids.map((m) => ({ x: m.x, y: m.y })),
    people: state.people.map((p) => ({ x: p.x, y: p.y, variant: p.variant })),
  };
}

/**
 * Fills steps newest-first against HISTORY_BYTE_BUDGET, preserving relative order in the output
 * (FR-008/FR-009). steps is HistoryManager's own undo-stack order (oldest-first, newest-last) —
 * the same order getPersistableUndoStack() returns. Returns '' if nothing is kept — either
 * because steps is empty or even the single newest step does not fit (FR-010) — exactly
 * serializeWorld's own failure-sentinel convention. Never throws.
 */
export function serializeHistory(
  steps: readonly WorldState[],
  width: number,
  height: number,
  worldFingerprint: string,
): string {
  try {
    const kept: WireHistoryStep[] = [];
    let total = 0;
    for (let i = steps.length - 1; i >= 0; i--) {
      const wireStep = encodeStep(steps[i]);
      const stepLength = JSON.stringify(wireStep).length;
      if (total + stepLength > HISTORY_BYTE_BUDGET) break;
      total += stepLength;
      kept.push(wireStep);
    }
    if (kept.length === 0) return '';
    kept.reverse();

    const wire: WireHistory = {
      version: HISTORY_SAVE_VERSION,
      width,
      height,
      worldFingerprint,
      steps: kept,
    };
    return JSON.stringify(wire);
  } catch {
    return '';
  }
}

export interface PersistedHistory {
  readonly width: number;
  readonly height: number;
  readonly steps: WorldState[]; // oldest-kept-first, newest-last; length <= HISTORY_DEPTH
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isWireHistoryObjectShape(value: unknown): value is WireHistoryObject {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    isFiniteNumber(obj.id) &&
    typeof obj.kind === 'string' &&
    isFiniteNumber(obj.x) &&
    isFiniteNumber(obj.y) &&
    isFiniteNumber(obj.size)
  );
}

function isWireHistoryMermaidShape(value: unknown): value is WireHistoryMermaid {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return isFiniteNumber(obj.x) && isFiniteNumber(obj.y);
}

function isPersonVariant(value: unknown): value is PersonVariant {
  return value === 'neutral' || value === 'man' || value === 'woman';
}

function isWireHistoryPersonShape(value: unknown): value is WireHistoryPerson {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return isFiniteNumber(obj.x) && isFiniteNumber(obj.y) && isPersonVariant(obj.variant);
}

/** Tolerantly parses a step's mermaids field: a missing field, a non-array, or any individually malformed entry all default to [] rather than rejecting the whole payload (FR-029), mirroring save.ts's parseMermaids. */
function parseHistoryMermaids(value: unknown): WireHistoryMermaid[] {
  if (!Array.isArray(value)) return [];
  const mermaids: WireHistoryMermaid[] = [];
  for (const item of value) {
    if (!isWireHistoryMermaidShape(item)) return [];
    mermaids.push({ x: item.x, y: item.y });
  }
  return mermaids;
}

/** Structurally identical to parseHistoryMermaids (FR-025), mirroring save.ts's parsePeople. */
function parseHistoryPeople(value: unknown): WireHistoryPerson[] {
  if (!Array.isArray(value)) return [];
  const people: WireHistoryPerson[] = [];
  for (const item of value) {
    if (!isWireHistoryPersonShape(item)) return [];
    people.push({ x: item.x, y: item.y, variant: item.variant });
  }
  return people;
}

/**
 * Parses and validates a persisted-history JSON string. Returns null on ANY invalid input —
 * wrong version, truncated data, corrupt base64, mismatched per-step array lengths, hand-edited
 * garbage, or a worldFingerprint that does not equal expectedFingerprint (FR-017, FR-018) — and
 * never throws. Defensively caps the returned steps array at the newest HISTORY_DEPTH entries
 * even if a hand-edited payload's steps array is longer.
 */
export function deserializeHistory(raw: string, expectedFingerprint: string): PersistedHistory | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const wire = parsed as Record<string, unknown>;

    if (wire.version !== HISTORY_SAVE_VERSION) return null;
    if (!isFiniteNumber(wire.width) || !Number.isInteger(wire.width) || wire.width <= 0) return null;
    if (!isFiniteNumber(wire.height) || !Number.isInteger(wire.height) || wire.height <= 0) return null;
    if (typeof wire.worldFingerprint !== 'string' || wire.worldFingerprint !== expectedFingerprint) return null;
    if (!Array.isArray(wire.steps)) return null;

    const width = wire.width;
    const height = wire.height;
    const size = width * height;

    const steps: WorldState[] = [];
    for (const item of wire.steps) {
      if (typeof item !== 'object' || item === null) return null;
      const step = item as Record<string, unknown>;

      if (
        typeof step.elements !== 'string' ||
        typeof step.colorAux !== 'string' ||
        typeof step.cloud !== 'string' ||
        typeof step.glitter !== 'string' ||
        typeof step.grassHeight !== 'string'
      ) {
        return null;
      }

      const elements = decodeBase64(step.elements);
      const colorAux = decodeBase64(step.colorAux);
      const cloud = decodeBase64(step.cloud);
      const glitter = decodeBase64(step.glitter);
      const grassHeight = decodeBase64(step.grassHeight);

      if (
        elements.length !== size ||
        colorAux.length !== size ||
        cloud.length !== size ||
        glitter.length !== size ||
        grassHeight.length !== size
      ) {
        return null;
      }

      if (typeof step.byKind !== 'object' || step.byKind === null) return null;
      const rawByKind = step.byKind as Record<string, unknown>;
      const byKind = {} as Record<ObjectKind, PlacedObject[]>;
      for (const kind of OBJECT_KINDS) {
        // Identical FR-028 tolerance as save.ts's deserializeWorld: a missing key reads as an
        // empty list; a present-but-malformed key still rejects the whole payload.
        const list = rawByKind[kind];
        const rawList = list === undefined ? [] : list;
        if (!Array.isArray(rawList)) return null;
        const objectsForKind: PlacedObject[] = [];
        for (const obj of rawList) {
          if (!isWireHistoryObjectShape(obj)) return null;
          objectsForKind.push({ id: obj.id, kind, x: obj.x, y: obj.y, size: obj.size });
        }
        byKind[kind] = objectsForKind;
      }

      const mermaids = parseHistoryMermaids(step.mermaids);

      // Legacy compatibility (US4): a stored history step written before this feature held people
      // as byKind.person PlacedObjects — same read-only migration save.ts's deserializeWorld
      // applies (FR-026, FR-027, research.md §8).
      const rawLegacyPersonList = rawByKind.person;
      let migratedPeople: WireHistoryPerson[] = [];
      if (rawLegacyPersonList !== undefined) {
        if (!Array.isArray(rawLegacyPersonList)) return null;
        const legacyPeople: PlacedObject[] = [];
        for (const obj of rawLegacyPersonList) {
          if (!isWireHistoryObjectShape(obj)) return null;
          legacyPeople.push({ id: obj.id, kind: 'person' as unknown as ObjectKind, x: obj.x, y: obj.y, size: obj.size });
        }
        const legacyGrid = { width, height, elements } as unknown as Grid;
        migratedPeople = migrateLegacyPersonObjects(legacyGrid, { byKind, nextId: 0 }, legacyPeople).map((p) => ({
          x: p.x,
          y: p.y,
          variant: 'neutral' as const,
        }));
      }

      const people = [...migratedPeople, ...parseHistoryPeople(step.people)];
      while (people.length > PERSON_CAP) people.shift();

      steps.push({ elements, colorAux, cloud, glitter, grassHeight, byKind, mermaids, people });
    }

    const cappedSteps = steps.length > HISTORY_DEPTH ? steps.slice(-HISTORY_DEPTH) : steps;

    return { width, height, steps: cappedSteps };
  } catch {
    return null;
  }
}

/** Structural subset of the DOM Storage interface — localStorage satisfies this with no adapter. Exists so the two functions below are unit-testable with a plain in-memory fake and no DOM (FR-025, research.md §4). */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * The existing debounced during-play save's storage-side effect. If worldJson === '' (the
 * serializeWorld failure sentinel), does nothing at all. Otherwise writes worldJson to saveKey
 * (returning early, touching nothing else, if that throws), then unconditionally removes
 * historyKey (FR-013a) — cheap discard, never serializes, never called with a historyJson
 * argument because ordinary saves never produce one.
 */
export function writeOrdinarySave(store: KeyValueStore, saveKey: string, historyKey: string, worldJson: string): void {
  if (worldJson === '') return;
  try {
    store.setItem(saveKey, worldJson);
  } catch {
    return;
  }
  try {
    store.removeItem(historyKey);
  } catch {
    // Storage unavailable (private mode, quota). Silent — nothing the child does is ever wrong.
  }
}

/**
 * The going-away flush's storage-side effect (FR-013). Same worldJson === ''/throws
 * short-circuit as writeOrdinarySave (leaving history untouched — nothing valid to pair it
 * against). Once the world write succeeds, writes historyJson to historyKey if non-empty, or
 * removes historyKey if historyJson === '' (the serializeHistory "nothing fit" sentinel) — a
 * write failure falls back to a best-effort removal so a quota error partway through never
 * leaves a stale history payload behind (FR-012, FR-019).
 */
export function writeFlushSave(
  store: KeyValueStore,
  saveKey: string,
  historyKey: string,
  worldJson: string,
  historyJson: string,
): void {
  if (worldJson === '') return;
  try {
    store.setItem(saveKey, worldJson);
  } catch {
    return;
  }

  if (historyJson === '') {
    try {
      store.removeItem(historyKey);
    } catch {
      // Storage unavailable. Silent.
    }
    return;
  }

  try {
    store.setItem(historyKey, historyJson);
  } catch {
    try {
      store.removeItem(historyKey);
    } catch {
      // Storage unavailable. Silent — nothing further to do.
    }
  }
}
