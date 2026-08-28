import { captureWorldState, type WorldState } from './history';
import { OBJECT_KINDS } from './objects';
import type { ObjectKind, ObjectsState, PlacedObject, Grid } from './types';
import type { PetsState } from './pets';

/** Bumped whenever the wire format changes shape; deserializeWorld rejects any other value. */
export const SAVE_VERSION = 1;

export interface SavedWorld {
  version: number;
  width: number;
  height: number;
  state: WorldState;
  poodles: { x: number; y: number }[];
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const BASE64_LOOKUP: Record<string, number> = (() => {
  const lookup: Record<string, number> = {};
  for (let i = 0; i < BASE64_CHARS.length; i++) lookup[BASE64_CHARS[i]] = i;
  return lookup;
})();

/**
 * Hand-rolled base64 encoder — no `btoa` (browser-only) and no `Buffer` (node-only); this file
 * runs in both. Standard RFC 4648 alphabet with `=` padding, three bytes to four characters.
 */
export function encodeBase64(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const hasB1 = i + 1 < bytes.length;
    const hasB2 = i + 2 < bytes.length;
    const b1 = hasB1 ? bytes[i + 1] : 0;
    const b2 = hasB2 ? bytes[i + 2] : 0;

    result += BASE64_CHARS[b0 >> 2];
    result += BASE64_CHARS[((b0 & 0x03) << 4) | (b1 >> 4)];
    result += hasB1 ? BASE64_CHARS[((b1 & 0x0f) << 2) | (b2 >> 6)] : '=';
    result += hasB2 ? BASE64_CHARS[b2 & 0x3f] : '=';
  }
  return result;
}

/** Inverse of encodeBase64. Throws on any character outside the base64 alphabet (padding aside); callers are expected to catch. */
export function decodeBase64(text: string): Uint8Array {
  const clean = text.replace(/=+$/, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const value = BASE64_LOOKUP[clean[i]];
    if (value === undefined) throw new Error('invalid base64 character');
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

interface WireObject {
  id: number;
  kind: string;
  x: number;
  y: number;
  size: number;
}

interface WirePoodle {
  x: number;
  y: number;
}

interface WireWorld {
  version: number;
  width: number;
  height: number;
  elements: string;
  colorAux: string;
  cloud: string;
  glitter: string;
  grassHeight: string;
  byKind: Record<string, WireObject[]>;
  poodles: WirePoodle[];
}

/**
 * Captures grid/objects/pets via the existing capture path (captureWorldState — no second
 * capture path per the brief) and encodes it to a JSON string. Never throws: any failure
 * (allocation, unexpected state) is swallowed and an empty string returned, which
 * deserializeWorld will in turn reject as invalid JSON.
 */
export function serializeWorld(grid: Grid, objects: ObjectsState, pets: PetsState): string {
  try {
    const state = captureWorldState(grid, objects);

    const byKind: Record<string, WireObject[]> = {};
    for (const kind of OBJECT_KINDS) {
      byKind[kind] = state.byKind[kind].map((obj) => ({
        id: obj.id,
        kind: obj.kind,
        x: obj.x,
        y: obj.y,
        size: obj.size,
      }));
    }

    const poodles: WirePoodle[] = pets.poodles.map((poodle) => ({ x: poodle.x, y: poodle.y }));

    const wire: WireWorld = {
      version: SAVE_VERSION,
      width: grid.width,
      height: grid.height,
      elements: encodeBase64(state.elements),
      colorAux: encodeBase64(state.colorAux),
      cloud: encodeBase64(state.cloud),
      glitter: encodeBase64(state.glitter),
      grassHeight: encodeBase64(state.grassHeight),
      byKind,
      poodles,
    };

    return JSON.stringify(wire);
  } catch {
    return '';
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPlacedObjectShape(value: unknown): value is WireObject {
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

function isPoodleShape(value: unknown): value is WirePoodle {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return isFiniteNumber(obj.x) && isFiniteNumber(obj.y);
}

/**
 * Parses and validates a saved-world JSON string. Returns null on ANY invalid input — wrong
 * version, truncated data, corrupt base64, mismatched array lengths, hand-edited garbage — and
 * never throws. The whole body runs under one try/catch so a JSON.parse failure, a base64
 * decode failure (decodeBase64 throws on bad characters), or a malformed-shape read all funnel
 * into the same "return null" path instead of propagating.
 */
export function deserializeWorld(raw: string): SavedWorld | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const wire = parsed as Record<string, unknown>;

    if (wire.version !== SAVE_VERSION) return null;
    if (!isFiniteNumber(wire.width) || !Number.isInteger(wire.width) || wire.width <= 0) return null;
    if (!isFiniteNumber(wire.height) || !Number.isInteger(wire.height) || wire.height <= 0) return null;

    const width = wire.width;
    const height = wire.height;
    const size = width * height;

    if (
      typeof wire.elements !== 'string' ||
      typeof wire.colorAux !== 'string' ||
      typeof wire.cloud !== 'string' ||
      typeof wire.glitter !== 'string' ||
      typeof wire.grassHeight !== 'string'
    ) {
      return null;
    }

    const elements = decodeBase64(wire.elements);
    const colorAux = decodeBase64(wire.colorAux);
    const cloud = decodeBase64(wire.cloud);
    const glitter = decodeBase64(wire.glitter);
    const grassHeight = decodeBase64(wire.grassHeight);

    if (
      elements.length !== size ||
      colorAux.length !== size ||
      cloud.length !== size ||
      glitter.length !== size ||
      grassHeight.length !== size
    ) {
      return null;
    }

    if (typeof wire.byKind !== 'object' || wire.byKind === null) return null;
    const rawByKind = wire.byKind as Record<string, unknown>;
    const byKind = {} as Record<ObjectKind, PlacedObject[]>;
    for (const kind of OBJECT_KINDS) {
      const list = rawByKind[kind];
      if (!Array.isArray(list)) return null;
      const objectsForKind: PlacedObject[] = [];
      for (const item of list) {
        if (!isPlacedObjectShape(item)) return null;
        objectsForKind.push({ id: item.id, kind: kind, x: item.x, y: item.y, size: item.size });
      }
      byKind[kind] = objectsForKind;
    }

    if (!Array.isArray(wire.poodles)) return null;
    const poodles: WirePoodle[] = [];
    for (const item of wire.poodles) {
      if (!isPoodleShape(item)) return null;
      poodles.push({ x: item.x, y: item.y });
    }

    const state: WorldState = { elements, colorAux, cloud, glitter, grassHeight, byKind };

    return { version: wire.version, width, height, state, poodles };
  } catch {
    return null;
  }
}
