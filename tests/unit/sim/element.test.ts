import { describe, it, expect } from 'vitest';
import { isPowder, isSolid, isLiquid, usesHueColor } from '../../../src/sim/element';
import { SAND, WATER, DIRT, RAINBOW_SAND, GRASS, STAR_POWER, GUMDROP, FLOWER, DIAMOND } from '../../../src/sim/types';

describe('element — DIAMOND joins the powder/solid family (US1, FR-014, FR-016)', () => {
  it('isPowder(DIAMOND) is true', () => {
    expect(isPowder(DIAMOND)).toBe(true);
  });

  it('isSolid(DIAMOND) is true, derived from isPowder with no separate DIAMOND case', () => {
    expect(isSolid(DIAMOND)).toBe(true);
  });

  it('isLiquid(DIAMOND) is false', () => {
    expect(isLiquid(DIAMOND)).toBe(false);
  });

  it('usesHueColor(DIAMOND) is false — diamonds are fixed-colour, not hue-varied', () => {
    expect(usesHueColor(DIAMOND)).toBe(false);
  });

  it("usesHueColor's only true cases remain exactly RAINBOW_SAND/GUMDROP/FLOWER (non-regression)", () => {
    expect(usesHueColor(RAINBOW_SAND)).toBe(true);
    expect(usesHueColor(GUMDROP)).toBe(true);
    expect(usesHueColor(FLOWER)).toBe(true);
    expect(usesHueColor(SAND)).toBe(false);
    expect(usesHueColor(WATER)).toBe(false);
    expect(usesHueColor(DIRT)).toBe(false);
    expect(usesHueColor(GRASS)).toBe(false);
    expect(usesHueColor(STAR_POWER)).toBe(false);
    expect(usesHueColor(DIAMOND)).toBe(false);
  });
});
