import { describe, it, expect } from 'vitest';
import { createGrid } from '../../../src/sim/grid';
import { createObjectsState, placeObject, removeObject, OBJECT_KINDS } from '../../../src/sim/objects';
import { createPetsState, addPoodle } from '../../../src/sim/pets';
import { restoreWorldState } from '../../../src/sim/history';
import { SAND, WATER, RAINBOW_SAND, GUMDROP, DIRT, OBJECT } from '../../../src/sim/types';
import {
  SAVE_VERSION,
  serializeWorld,
  deserializeWorld,
  encodeBase64,
  decodeBase64,
  resyncNextId,
} from '../../../src/sim/save';

// 60x40 so a 24px object footprint, placed in the far corner below, cannot clip back over
// the sand/water/dirt/rainbow/gumdrop cells planted near the origin (OBJECT_FOOTPRINT_SIZE
// is large relative to a small test grid and placeObject clamps rather than rejects).
function buildPopulatedWorld() {
  const grid = createGrid(60, 40);
  const objects = createObjectsState();
  const pets = createPetsState();

  // Sand, water, dirt scattered.
  grid.elements[0] = SAND;
  grid.shades[0] = 2;
  grid.elements[1] = WATER;
  grid.shades[1] = 1;
  grid.elements[2] = DIRT;
  grid.shades[2] = 3;

  // Rainbow sand with a distinctive hue.
  const rainbowIndex = 10;
  grid.elements[rainbowIndex] = RAINBOW_SAND;
  grid.hues[rainbowIndex] = 200;

  // Gumdrop with a distinctive hue.
  const gumdropIndex = 20;
  grid.elements[gumdropIndex] = GUMDROP;
  grid.hues[gumdropIndex] = 77;

  grid.glitter[rainbowIndex] = 1;
  grid.grassHeight[5] = 9;
  grid.cloud[6] = 1;

  for (const kind of OBJECT_KINDS) {
    placeObject(grid, objects, kind, 50, 30);
  }

  addPoodle(pets, 3, 4);
  addPoodle(pets, 12, 6);

  return { grid, objects, pets };
}

describe('save — codec round trip (Task 1)', () => {
  it('round-trips a populated world: every array cell-for-cell equal, objects and poodles intact', () => {
    const { grid, objects, pets } = buildPopulatedWorld();

    const json = serializeWorld(grid, objects, pets);
    const saved = deserializeWorld(json);

    expect(saved).not.toBeNull();
    if (saved === null) return;

    expect(saved.version).toBe(SAVE_VERSION);
    expect(saved.width).toBe(grid.width);
    expect(saved.height).toBe(grid.height);

    const expectedColorAux = Array.from(grid.elements).map((element, i) =>
      element === RAINBOW_SAND || element === GUMDROP ? grid.hues[i] : grid.shades[i],
    );
    expect(Array.from(saved.state.elements)).toEqual(Array.from(grid.elements));
    expect(Array.from(saved.state.colorAux)).toEqual(expectedColorAux);
    expect(Array.from(saved.state.cloud)).toEqual(Array.from(grid.cloud));
    expect(Array.from(saved.state.glitter)).toEqual(Array.from(grid.glitter));
    expect(Array.from(saved.state.grassHeight)).toEqual(Array.from(grid.grassHeight));

    for (const kind of OBJECT_KINDS) {
      expect(saved.state.byKind[kind]).toEqual(objects.byKind[kind]);
    }

    expect(saved.poodles).toEqual([
      { x: 3, y: 4 },
      { x: 12, y: 6 },
    ]);
  });

  it('preserves rainbow-sand and gumdrop hues through the round trip (the standing trap)', () => {
    const { grid, objects, pets } = buildPopulatedWorld();

    const json = serializeWorld(grid, objects, pets);
    const saved = deserializeWorld(json);

    expect(saved).not.toBeNull();
    if (saved === null) return;

    const rainbowIndex = 10;
    const gumdropIndex = 20;
    // colorAux carries hue for RAINBOW_SAND/GUMDROP cells (per captureWorldState).
    expect(saved.state.colorAux[rainbowIndex]).toBe(200);
    expect(saved.state.colorAux[gumdropIndex]).toBe(77);
  });

  it('returns null, never throws, for empty string / non-JSON / truncated arrays / wrong version', () => {
    expect(() => deserializeWorld('')).not.toThrow();
    expect(deserializeWorld('')).toBeNull();

    expect(() => deserializeWorld('not json')).not.toThrow();
    expect(deserializeWorld('not json')).toBeNull();

    const { grid, objects, pets } = buildPopulatedWorld();
    const json = serializeWorld(grid, objects, pets);
    const wire = JSON.parse(json) as Record<string, unknown>;

    // Truncate the elements array by re-encoding a shorter byte buffer.
    const truncated = { ...wire, elements: encodeBase64(new Uint8Array(3)) };
    const truncatedJson = JSON.stringify(truncated);
    expect(() => deserializeWorld(truncatedJson)).not.toThrow();
    expect(deserializeWorld(truncatedJson)).toBeNull();

    const wrongVersion = { ...wire, version: SAVE_VERSION + 1 };
    const wrongVersionJson = JSON.stringify(wrongVersion);
    expect(() => deserializeWorld(wrongVersionJson)).not.toThrow();
    expect(deserializeWorld(wrongVersionJson)).toBeNull();
  });

  it('returns null when width*height disagrees with an array length (tampered dimensions)', () => {
    const { grid, objects, pets } = buildPopulatedWorld();
    const json = serializeWorld(grid, objects, pets);
    const wire = JSON.parse(json) as Record<string, unknown>;

    const tampered = { ...wire, width: (wire.width as number) + 5 };
    const tamperedJson = JSON.stringify(tampered);

    expect(() => deserializeWorld(tamperedJson)).not.toThrow();
    expect(deserializeWorld(tamperedJson)).toBeNull();
  });

  it('never throws on garbage input of any shape', () => {
    const garbageInputs = [
      'null',
      '42',
      '"just a string"',
      '[]',
      '{}',
      '{"version":1}',
      '{"version":1,"width":"nope","height":10}',
      '{"version":1,"width":10,"height":10,"elements":123}',
      '{"version":1,"width":-1,"height":10,"elements":"","colorAux":"","cloud":"","glitter":"","grassHeight":"","byKind":{},"poodles":[]}',
      '{{{not even json',
      String.fromCharCode(0, 1, 2, 3),
    ];
    for (const input of garbageInputs) {
      expect(() => deserializeWorld(input)).not.toThrow();
      expect(deserializeWorld(input)).toBeNull();
    }
  });
});

describe('save — hand-rolled base64 helpers (do not trust the happy path)', () => {
  it('round-trips a Uint8Array containing 0, 255, and every value mod pattern, at several lengths', () => {
    for (const length of [0, 1, 2, 3, 4, 5, 10, 37, 256, 300]) {
      const bytes = new Uint8Array(length);
      for (let i = 0; i < length; i++) bytes[i] = i % 256;
      if (length > 0) {
        bytes[0] = 0;
        bytes[length - 1] = 255;
      }
      const encoded = encodeBase64(bytes);
      const decoded = decodeBase64(encoded);
      expect(Array.from(decoded)).toEqual(Array.from(bytes));
    }
  });

  it('deserializeWorld returns null, never throws, when a base64 field contains a non-alphabet character', () => {
    const grid = createGrid(60, 40);
    const objects = createObjectsState();
    const pets = createPetsState();
    grid.elements[0] = SAND;

    const json = serializeWorld(grid, objects, pets);
    const wire = JSON.parse(json) as Record<string, unknown>;
    // '!' is outside the base64 alphabet (A-Z a-z 0-9 + / =) — decodeBase64 must throw on it,
    // and that throw must be caught inside deserializeWorld rather than propagating.
    const tampered = { ...wire, elements: '!!!!not-base64!!!!' };
    const tamperedJson = JSON.stringify(tampered);

    expect(() => deserializeWorld(tamperedJson)).not.toThrow();
    expect(deserializeWorld(tamperedJson)).toBeNull();
  });
});

describe('save — resyncNextId (Critical fix: id collisions after restore)', () => {
  // Reproduces the reviewer's exact repro: place an object (id 0), save, restore into a fresh
  // ObjectsState (nextId also starts at 0), place a new object of the same kind. Without
  // resyncNextId the new object silently reuses id 0 — erasing it then deletes the *restored*
  // object's list entry while only clearing the *new* object's grid cells, leaving the restored
  // object's footprint as orphan OBJECT cells: permanently solid, invisible, unerasable.
  it('a freshly placed object after restore never reuses an id a restored object still holds', () => {
    const grid = createGrid(120, 120);
    const sourceObjects = createObjectsState();
    const pets = createPetsState();
    placeObject(grid, sourceObjects, 'unicorn', 30, 30);
    const restoredUnicornId = sourceObjects.byKind.unicorn[0].id;

    const json = serializeWorld(grid, sourceObjects, pets);
    const saved = deserializeWorld(json);
    expect(saved).not.toBeNull();
    if (saved === null) return;

    // A fresh mount: brand-new grid/ObjectsState, exactly like a page reload.
    const freshGrid = createGrid(120, 120);
    const freshObjects = createObjectsState();
    expect(restoreWorldState(freshGrid, freshObjects, saved.state)).toBe(true);

    // This is the fix under test — the glue in PlayArea.svelte calls the same helper
    // immediately after a successful restoreWorldState.
    resyncNextId(freshObjects);

    // Place a new unicorn well clear of the restored one's footprint.
    placeObject(freshGrid, freshObjects, 'unicorn', 90, 90);
    const newUnicorn = freshObjects.byKind.unicorn[1];
    expect(newUnicorn.id).not.toBe(restoredUnicornId);

    // Erasing the new object must not touch the restored one at all.
    removeObject(freshGrid, freshObjects, newUnicorn);

    expect(freshObjects.byKind.unicorn).toHaveLength(1);
    expect(freshObjects.byKind.unicorn[0].id).toBe(restoredUnicornId);

    const restored = freshObjects.byKind.unicorn[0];
    for (let py = restored.y; py < restored.y + restored.size; py++) {
      for (let px = restored.x; px < restored.x + restored.size; px++) {
        expect(freshGrid.elements[py * freshGrid.width + px]).toBe(OBJECT);
      }
    }
  });
});
