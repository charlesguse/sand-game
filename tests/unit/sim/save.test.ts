import { describe, it, expect } from 'vitest';
import { createGrid, setCell } from '../../../src/sim/grid';
import { createObjectsState, placeObject, removeObject, OBJECT_KINDS } from '../../../src/sim/objects';
import { createPetsState, addPoodle, addMermaid, addPerson, PERSON_CAP } from '../../../src/sim/pets';
import { restoreWorldState } from '../../../src/sim/history';
import { step } from '../../../src/sim/step';
import { SAND, WATER, RAINBOW_SAND, GUMDROP, ICE_CREAM, DIRT, DIAMOND, OBJECT, type PersonTone } from '../../../src/sim/types';
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
  pets.mermaids.push(
    { id: pets.nextId++, x: 8, y: 9, facing: 1, state: 'drifting', timer: 0, pursuitX: -1, pursuitY: -1, pursuitBestDist: Infinity, pursuitStaleFrames: 0, iceCreamCooldown: 0, homeX: 8, homeY: 9, driftDir: 1 },
    { id: pets.nextId++, x: 15, y: 11, facing: 1, state: 'drifting', timer: 0, pursuitX: -1, pursuitY: -1, pursuitBestDist: Infinity, pursuitStaleFrames: 0, iceCreamCooldown: 0, homeX: 15, homeY: 11, driftDir: 1 },
  );

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
    expect(saved.mermaids).toEqual([
      { x: 8, y: 9 },
      { x: 15, y: 11 },
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

describe('save — a byKind key missing for an ObjectKind reads as empty rather than rejecting the payload (FR-028)', () => {
  it('a payload missing the house/chest keys still deserializes, with those kinds empty', () => {
    const { grid, objects, pets } = buildPopulatedWorld();
    const json = serializeWorld(grid, objects, pets);
    const wire = JSON.parse(json) as Record<string, unknown>;
    const byKind = wire.byKind as Record<string, unknown>;
    const { house, chest, ...rest } = byKind;
    void house;
    void chest;
    const tampered = { ...wire, byKind: rest };

    const saved = deserializeWorld(JSON.stringify(tampered));
    expect(saved).not.toBeNull();
    if (saved === null) return;
    expect(saved.state.byKind.house).toEqual([]);
    expect(saved.state.byKind.chest).toEqual([]);
    // Every other, still-present kind is unaffected.
    for (const kind of OBJECT_KINDS) {
      if (kind === 'house' || kind === 'chest') continue;
      expect(saved.state.byKind[kind]).toEqual(objects.byKind[kind]);
    }
  });

  it('a payload with an entirely empty byKind (simulating a genuinely pre-upgrade save) deserializes with every kind empty', () => {
    const { grid, objects, pets } = buildPopulatedWorld();
    const json = serializeWorld(grid, objects, pets);
    const wire = JSON.parse(json) as Record<string, unknown>;
    const tampered = { ...wire, byKind: {} };

    const saved = deserializeWorld(JSON.stringify(tampered));
    expect(saved).not.toBeNull();
    if (saved === null) return;
    for (const kind of OBJECT_KINDS) {
      expect(saved.state.byKind[kind]).toEqual([]);
    }
  });

  it('a present-but-malformed byKind.house value still rejects the whole payload', () => {
    const { grid, objects, pets } = buildPopulatedWorld();
    const json = serializeWorld(grid, objects, pets);
    const wire = JSON.parse(json) as Record<string, unknown>;
    const byKind = wire.byKind as Record<string, unknown>;
    const tampered = { ...wire, byKind: { ...byKind, house: 'not-an-array' } };

    expect(deserializeWorld(JSON.stringify(tampered))).toBeNull();
  });

  it('a world with all three new kinds plus mid-fall diamonds round-trips cell-for-cell (FR-026)', () => {
    const grid = createGrid(60, 40);
    const objects = createObjectsState();
    const pets = createPetsState();
    setCell(grid, 5, 5, DIAMOND, 3);
    setCell(grid, 6, 5, DIAMOND, 9);
    step(grid); // a diamond mid-fall
    placeObject(grid, objects, 'house', 10, 10);
    placeObject(grid, objects, 'palm', 40, 10);
    placeObject(grid, objects, 'chest', 10, 30);

    const json = serializeWorld(grid, objects, pets);
    const saved = deserializeWorld(json);
    expect(saved).not.toBeNull();
    if (saved === null) return;

    expect(Array.from(saved.state.elements)).toEqual(Array.from(grid.elements));
    expect(Array.from(saved.state.colorAux)).toEqual(Array.from(grid.shades));
    for (const kind of ['house', 'palm', 'chest'] as const) {
      expect(saved.state.byKind[kind]).toEqual(objects.byKind[kind]);
    }
  });
});

describe('save — mermaids and ice cream round trip (US4, FR-026, FR-029)', () => {
  it('round-trips every un-eaten ice cream cell along with its flavour colour', () => {
    const grid = createGrid(20, 20);
    const objects = createObjectsState();
    const pets = createPetsState();
    grid.elements[5] = ICE_CREAM;
    grid.hues[5] = 111;

    const json = serializeWorld(grid, objects, pets);
    const saved = deserializeWorld(json);
    expect(saved).not.toBeNull();
    if (saved === null) return;

    expect(saved.state.elements[5]).toBe(ICE_CREAM);
    expect(saved.state.colorAux[5]).toBe(111);
  });

  it('deserializes a wire payload shaped like today\'s (no `mermaids` key) with mermaids: [] and no error', () => {
    const { grid, objects, pets } = buildPopulatedWorld();
    const json = serializeWorld(grid, objects, pets);
    const wire = JSON.parse(json) as Record<string, unknown>;
    delete wire.mermaids;
    const legacyJson = JSON.stringify(wire);

    expect(() => deserializeWorld(legacyJson)).not.toThrow();
    const saved = deserializeWorld(legacyJson);
    expect(saved).not.toBeNull();
    if (saved === null) return;
    expect(saved.mermaids).toEqual([]);
    // Everything else about the payload still restores cleanly — a pre-feature save's mermaids
    // field simply doesn't exist yet, and that alone must never reject the whole picture.
    expect(saved.poodles).toEqual([
      { x: 3, y: 4 },
      { x: 12, y: 6 },
    ]);
  });

  it('defaults to mermaids: [] when the field is present but malformed, instead of rejecting the payload', () => {
    const { grid, objects, pets } = buildPopulatedWorld();
    const json = serializeWorld(grid, objects, pets);
    const wire = JSON.parse(json) as Record<string, unknown>;
    const tampered = { ...wire, mermaids: 'not-an-array' };
    const tamperedJson = JSON.stringify(tampered);

    expect(() => deserializeWorld(tamperedJson)).not.toThrow();
    const saved = deserializeWorld(tamperedJson);
    expect(saved).not.toBeNull();
    if (saved === null) return;
    expect(saved.mermaids).toEqual([]);
  });
});

describe('save — people round trip, position and variant (US2/US4, FR-023, FR-025, FR-026)', () => {
  it('round-trips every placed person of every variant, position and variant intact', () => {
    const grid = createGrid(60, 40);
    const objects = createObjectsState();
    const pets = createPetsState();
    addPerson(grid, pets, 5, 5, ['neutral'], ['default'], () => 0);
    addPerson(grid, pets, 10, 10, ['man'], ['default'], () => 0);
    addPerson(grid, pets, 15, 15, ['woman'], ['default'], () => 0);

    const json = serializeWorld(grid, objects, pets);
    const saved = deserializeWorld(json);
    expect(saved).not.toBeNull();
    if (saved === null) return;

    expect(saved.people).toHaveLength(3);
    expect(saved.people.map((p) => p.variant)).toEqual(['neutral', 'man', 'woman']);
    expect(saved.people[0].x).toBeCloseTo(5);
  });

  it('round-trips tone alongside variant, for every tone (US5 Acceptance Scenario 1, SC-004)', () => {
    // PERSON_CAP is 3, so every tone is exercised across two separate worlds rather than one
    // six-person placement (which would evict the first three before they could be saved).
    const allTones: readonly PersonTone[] = ['default', 'light', 'mediumLight', 'medium', 'mediumDark', 'dark'];
    for (const batch of [allTones.slice(0, 3), allTones.slice(3)]) {
      const grid = createGrid(60, 40);
      const objects = createObjectsState();
      const pets = createPetsState();
      for (let i = 0; i < batch.length; i++) addPerson(grid, pets, 5 + i * 5, 5, ['neutral'], [batch[i]], () => 0);

      const json = serializeWorld(grid, objects, pets);
      const saved = deserializeWorld(json);
      expect(saved).not.toBeNull();
      if (saved === null) continue;

      expect(saved.people.map((p) => p.tone)).toEqual(batch);
    }
  });

  it('defaults to tone: \'default\' for a wire payload shaped like a pre-this-feature save (people entries with variant but no tone key) (US4 Acceptance Scenario 1, FR-020)', () => {
    const grid = createGrid(60, 40);
    const objects = createObjectsState();
    const pets = createPetsState();
    addPerson(grid, pets, 5, 5, ['neutral'], ['default'], () => 0);

    const json = serializeWorld(grid, objects, pets);
    const wire = JSON.parse(json) as Record<string, unknown>;
    const people = wire.people as Record<string, unknown>[];
    delete people[0].tone;
    const legacyJson = JSON.stringify(wire);

    const saved = deserializeWorld(legacyJson);
    expect(saved).not.toBeNull();
    if (saved === null) return;
    expect(saved.people).toHaveLength(1);
    expect(saved.people[0].tone).toBe('default');
    expect(saved.people[0].variant).toBe('neutral');
    expect(saved.people[0].x).toBeCloseTo(5);
  });

  it('falls back only a malformed tone to \'default\', leaving other people\'s tones and the rest of the world untouched (US4 Acceptance Scenario 2, FR-018)', () => {
    const grid = createGrid(60, 40);
    const objects = createObjectsState();
    const pets = createPetsState();
    addPerson(grid, pets, 5, 5, ['neutral'], ['dark'], () => 0);
    addPerson(grid, pets, 10, 10, ['neutral'], ['dark'], () => 0);
    addPerson(grid, pets, 15, 15, ['neutral'], ['dark'], () => 0);

    const json = serializeWorld(grid, objects, pets);
    const wire = JSON.parse(json) as Record<string, unknown>;
    const people = wire.people as Record<string, unknown>[];
    // Person 0 keeps a valid tone; 1/2/3 each get a differently-malformed one.
    people[1].tone = 'chartreuse';
    people[2].tone = '';
    const tamperedJson = JSON.stringify(wire);

    const saved = deserializeWorld(tamperedJson);
    expect(saved).not.toBeNull();
    if (saved === null) return;
    expect(saved.people).toHaveLength(3);
    expect(saved.people[0].tone).toBe('dark');
    expect(saved.people[1].tone).toBe('default');
    expect(saved.people[2].tone).toBe('default');
    expect(saved.people.map((p) => p.x)).toEqual([5, 10, 15]);
  });

  it('falls back a null tone to \'default\' too', () => {
    const grid = createGrid(60, 40);
    const objects = createObjectsState();
    const pets = createPetsState();
    addPerson(grid, pets, 5, 5, ['neutral'], ['dark'], () => 0);

    const json = serializeWorld(grid, objects, pets);
    const wire = JSON.parse(json) as Record<string, unknown>;
    const people = wire.people as Record<string, unknown>[];
    people[0].tone = null;
    const tamperedJson = JSON.stringify(wire);

    const saved = deserializeWorld(tamperedJson);
    expect(saved).not.toBeNull();
    if (saved === null) return;
    expect(saved.people[0].tone).toBe('default');
  });

  it('deserializes a wire payload shaped like today\'s (no `people` key) with people: [] and no error (FR-025)', () => {
    const { grid, objects, pets } = buildPopulatedWorld();
    const json = serializeWorld(grid, objects, pets);
    const wire = JSON.parse(json) as Record<string, unknown>;
    delete wire.people;
    const legacyJson = JSON.stringify(wire);

    expect(() => deserializeWorld(legacyJson)).not.toThrow();
    const saved = deserializeWorld(legacyJson);
    expect(saved).not.toBeNull();
    if (saved === null) return;
    expect(saved.people).toEqual([]);
    // Everything else still restores cleanly — a pre-feature save's people field simply doesn't
    // exist yet, and that alone must never reject the whole picture.
    expect(saved.poodles).toEqual([
      { x: 3, y: 4 },
      { x: 12, y: 6 },
    ]);
  });

  it('defaults to people: [] when the field is present but malformed (null, or containing a bad entry), instead of rejecting the payload (FR-025)', () => {
    const { grid, objects, pets } = buildPopulatedWorld();
    const json = serializeWorld(grid, objects, pets);
    const wire = JSON.parse(json) as Record<string, unknown>;

    for (const badPeople of [null, 'not-an-array', [{ x: 1, y: 2 }], [{ x: 1, y: 2, variant: 'alien' }]]) {
      const tampered = { ...wire, people: badPeople };
      const tamperedJson = JSON.stringify(tampered);
      expect(() => deserializeWorld(tamperedJson)).not.toThrow();
      const saved = deserializeWorld(tamperedJson);
      expect(saved).not.toBeNull();
      if (saved === null) continue;
      expect(saved.people).toEqual([]);
    }
  });

  it('migrates a legacy byKind.person list into walkers at the footprint center, variant neutral (US4 Acceptance Scenario 1, FR-026)', () => {
    const grid = createGrid(100, 100);
    const objects = createObjectsState();
    const pets = createPetsState();
    placeObject(grid, objects, 'house', 30, 30);
    const json = serializeWorld(grid, objects, pets);
    const wire = JSON.parse(json) as Record<string, unknown>;
    const byKind = wire.byKind as Record<string, unknown>;
    const house = (byKind.house as unknown[])[0];
    // Simulate a pre-feature save: the same footprint, but stored under the old 'person' key
    // instead of 'house', and with no `people` field at all.
    const tampered = { ...wire, byKind: { ...byKind, house: [], person: [house] } };
    delete (tampered as Record<string, unknown>).people;

    const saved = deserializeWorld(JSON.stringify(tampered));
    expect(saved).not.toBeNull();
    if (saved === null) return;
    expect(saved.people).toHaveLength(1);
    expect(saved.people[0].variant).toBe('neutral');
    expect(saved.people[0].tone).toBe('default');
  });

  it('a malformed byKind.person entry still rejects the whole payload, same strictness as any other legacy object kind', () => {
    const { grid, objects, pets } = buildPopulatedWorld();
    const json = serializeWorld(grid, objects, pets);
    const wire = JSON.parse(json) as Record<string, unknown>;
    const byKind = wire.byKind as Record<string, unknown>;
    const tampered = { ...wire, byKind: { ...byKind, person: [{ not: 'valid' }] } };

    expect(deserializeWorld(JSON.stringify(tampered))).toBeNull();
  });

  it('never produces more than PERSON_CAP people even with 3 byKind.person entries plus 3 poodles and 3 mermaids present (Edge Cases)', () => {
    const grid = createGrid(200, 200);
    const objects = createObjectsState();
    const pets = createPetsState();
    for (let i = 0; i < 3; i++) addPoodle(pets, 10 + i * 5, 10);
    for (let i = 0; i < 3; i++) {
      setCell(grid, 20 + i * 5, 20, WATER, 0);
      addMermaid(grid, pets, 20 + i * 5, 20);
    }
    const json = serializeWorld(grid, objects, pets);
    const wire = JSON.parse(json) as Record<string, unknown>;
    const legacyPeople = [
      { id: 100, kind: 'person', x: 10, y: 10, size: 24 },
      { id: 101, kind: 'person', x: 40, y: 10, size: 24 },
      { id: 102, kind: 'person', x: 70, y: 10, size: 24 },
    ];
    const byKind = wire.byKind as Record<string, unknown>;
    const tampered = { ...wire, byKind: { ...byKind, person: legacyPeople } };

    const saved = deserializeWorld(JSON.stringify(tampered));
    expect(saved).not.toBeNull();
    if (saved === null) return;
    expect(saved.people.length).toBeLessThanOrEqual(PERSON_CAP);
    expect(saved.poodles).toHaveLength(3);
    expect(saved.mermaids).toHaveLength(3);
  });

  it('SAVE_VERSION is unchanged by this feature (FR-019, SC-006)', () => {
    expect(SAVE_VERSION).toBe(1);
  });

  it('restores correct position/variant from a payload carrying tone data even if a reader ignored the tone key entirely (FR-019, SC-006)', () => {
    const grid = createGrid(60, 40);
    const objects = createObjectsState();
    const pets = createPetsState();
    addPerson(grid, pets, 5, 5, ['man'], ['dark'], () => 0);
    const json = serializeWorld(grid, objects, pets);
    const wire = JSON.parse(json) as Record<string, unknown>;
    const people = wire.people as Record<string, unknown>[];
    expect(people[0].tone).toBe('dark'); // the new field really is present on the wire...

    // ...but a hypothetical pre-feature reader, blind to `tone`, would still read x/variant fine
    // (y settles onto the ground below the requested point, exactly as it always has).
    const { x, variant } = people[0] as { x: number; y: number; variant: string };
    expect({ x, variant }).toEqual({ x: 5, variant: 'man' });
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
