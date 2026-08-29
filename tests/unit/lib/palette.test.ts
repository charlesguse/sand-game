import { describe, it, expect } from 'vitest';
import { colorFor, hslToRgb } from '../../../src/lib/palette';
import { SAND, WATER, DIRT, RAINBOW_SAND, GRASS, STAR_POWER, FOG, EMPTY } from '../../../src/sim/types';

describe('colorFor — existing elements are unchanged by the extraction', () => {
  it('renders sand as the hot-pink ramp', () => {
    expect(colorFor(SAND, 0, 0, false)).toEqual([255, 214, 232]);
    expect(colorFor(SAND, 4, 0, false)).toEqual([255, 105, 180]);
  });

  it('renders magic dirt as the purple ramp', () => {
    expect(colorFor(DIRT, 0, 0, false)).toEqual([230, 200, 255]);
  });

  it('wraps the shade index rather than reading past the ramp', () => {
    expect(colorFor(SAND, 8, 0, false)).toEqual(colorFor(SAND, 0, 0, false));
    expect(colorFor(SAND, 9, 0, false)).toEqual(colorFor(SAND, 1, 0, false));
  });

  it('spreads rainbow sand continuously by hue', () => {
    expect(colorFor(RAINBOW_SAND, 0, 0, false)).not.toEqual(colorFor(RAINBOW_SAND, 0, 128, false));
  });

  it('distinguishes cloud fog from ground fog', () => {
    expect(colorFor(FOG, 0, 0, true)).not.toEqual(colorFor(FOG, 0, 0, false));
  });

  it('falls back to white for an unknown element', () => {
    expect(colorFor(EMPTY, 0, 0, false)).toEqual([255, 255, 255]);
  });

  it('gives grass and star power their own ramps', () => {
    expect(colorFor(GRASS, 0, 0, false)).not.toEqual(colorFor(SAND, 0, 0, false));
    expect(colorFor(STAR_POWER, 0, 0, false)).not.toEqual(colorFor(SAND, 0, 0, false));
  });
});

describe('hslToRgb', () => {
  it('converts primary hues', () => {
    expect(hslToRgb(0, 1, 0.5)).toEqual([255, 0, 0]);
    expect(hslToRgb(120, 1, 0.5)).toEqual([0, 255, 0]);
    expect(hslToRgb(240, 1, 0.5)).toEqual([0, 0, 255]);
  });

  it('returns grey when saturation is zero', () => {
    const [r, g, b] = hslToRgb(200, 0, 0.5);
    expect(r).toBe(g);
    expect(g).toBe(b);
  });
});

describe('water is pink, and readable as its own element', () => {
  it('renders water in the pink family, not blue', () => {
    for (let shade = 0; shade < 6; shade++) {
      const [r, g, b] = colorFor(WATER, shade, 0, false);
      expect(r).toBeGreaterThan(b);
      expect(r).toBeGreaterThan(g);
    }
  });

  it('stays lighter than sand at the same shade, so the two pinks read apart', () => {
    for (let shade = 0; shade < 6; shade++) {
      const water = colorFor(WATER, shade, 0, false);
      const sand = colorFor(SAND, shade, 0, false);
      const lightness = (c: number[]) => c[0] + c[1] + c[2];
      expect(lightness(water)).toBeGreaterThan(lightness(sand));
    }
  });

  it('never renders the same colour as sand at the same shade', () => {
    for (let shade = 0; shade < 6; shade++) {
      expect(colorFor(WATER, shade, 0, false)).not.toEqual(colorFor(SAND, shade, 0, false));
    }
  });
});
