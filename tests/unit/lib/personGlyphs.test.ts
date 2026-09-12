import { describe, it, expect } from 'vitest';
import {
  resolvePersonPictureSet,
  frameFor,
  type GlyphProbeInputs,
  type PersonPictureSet,
  type PersonFrame,
} from '../../../src/lib/personGlyphs';
import type { PersonVariant } from '../../../src/sim/types';

const NEUTRAL = { standing: '🧍', walking: '🚶', running: '🏃' };
const MAN = { standing: '🧍‍♂️', walking: '🚶‍♂️', running: '🏃‍♂️' };
const WOMAN = { standing: '🧍‍♀️', walking: '🚶‍♀️', running: '🏃‍♀️' };
const ALL_GLYPHS = [
  ...Object.values(NEUTRAL),
  ...Object.values(MAN),
  ...Object.values(WOMAN),
];

/** A width table keyed by glyph text; unlisted glyphs default to the base width (renders fine, not split). */
function probeFrom(opts: {
  tofu?: readonly string[];
  widths?: Record<string, number>;
  canRenderThrows?: readonly string[];
  measureThrows?: readonly string[];
}): GlyphProbeInputs {
  const tofu = new Set(opts.tofu ?? []);
  const widths = opts.widths ?? {};
  const canRenderThrows = new Set(opts.canRenderThrows ?? []);
  const measureThrows = new Set(opts.measureThrows ?? []);
  return {
    canRender(glyph: string): boolean {
      if (canRenderThrows.has(glyph)) throw new Error('probe failure');
      return !tofu.has(glyph);
    },
    measureWidth(text: string): number {
      if (measureThrows.has(text)) throw new Error('probe failure');
      return widths[text] ?? 10;
    },
  };
}

describe('resolvePersonPictureSet — everything supported', () => {
  it('resolves all three variants, running enabled, toolbarGlyph is 🧍', () => {
    const probe = probeFrom({});
    const result = resolvePersonPictureSet(probe);
    expect(result.drawableVariants).toEqual(['neutral', 'man', 'woman']);
    expect(result.canRunPicture).toBe(true);
    expect(result.toolbarGlyph).toBe('🧍');
    expect(result.pictures.neutral).toEqual(NEUTRAL);
    expect(result.pictures.man).toEqual(MAN);
    expect(result.pictures.woman).toEqual(WOMAN);
  });
});

describe('resolvePersonPictureSet — standing missing', () => {
  it('falls back the idle frame to walking, per family, never to 🧑', () => {
    const probe = probeFrom({ tofu: [NEUTRAL.standing, MAN.standing, WOMAN.standing] });
    const result = resolvePersonPictureSet(probe);
    expect(result.pictures.neutral.standing).toBe(result.pictures.neutral.walking);
    expect(result.pictures.neutral.standing).toBe('🚶');
    expect(result.pictures.man.standing).toBe(result.pictures.man.walking);
    expect(result.pictures.woman.standing).toBe(result.pictures.woman.walking);
    expect(result.toolbarGlyph).toBe('🚶');
    expect(result.toolbarGlyph).not.toBe('🧑');
  });
});

describe('resolvePersonPictureSet — running missing', () => {
  it('flags canRunPicture false without substituting a glyph', () => {
    const probe = probeFrom({ tofu: [NEUTRAL.running, MAN.running, WOMAN.running] });
    const result = resolvePersonPictureSet(probe);
    expect(result.canRunPicture).toBe(false);
    expect(result.pictures.neutral.running).toBe('🏃');
  });
});

describe('resolvePersonPictureSet — gendered forms splitting', () => {
  it('drops to neutral-only when a gendered sequence measures ~2x its base glyph', () => {
    const probe = probeFrom({
      widths: { [MAN.standing]: 20, [MAN.walking]: 20, [MAN.running]: 20 },
    });
    const result = resolvePersonPictureSet(probe);
    expect(result.drawableVariants).toEqual(['neutral']);
    expect(result.pictures.neutral).toEqual(NEUTRAL);
  });
});

describe('resolvePersonPictureSet — nothing supported', () => {
  it('still returns the safest known-drawable set, never empty', () => {
    const probe = probeFrom({ tofu: ALL_GLYPHS });
    const result = resolvePersonPictureSet(probe);
    expect(result.drawableVariants).toEqual(['neutral']);
    expect(result.drawableVariants.length).toBeGreaterThan(0);
    expect(result.toolbarGlyph).toBeTruthy();
    expect(result.canRunPicture).toBe(false);
  });
});

describe('resolvePersonPictureSet — a measurer/renderer that throws or returns nonsense', () => {
  it('degrades only the affected glyph\'s rung, not the whole picture set', () => {
    const probe = probeFrom({ canRenderThrows: [NEUTRAL.running], measureThrows: [MAN.standing] });
    const result = resolvePersonPictureSet(probe);
    // Running throws for neutral -> canRunPicture false, but standing/walking unaffected.
    expect(result.canRunPicture).toBe(false);
    expect(result.pictures.neutral.standing).toBe('🧍');
    expect(result.pictures.neutral.walking).toBe('🚶');
    // A throwing measurer for man's standing glyph fails that gendered check -> neutral-only,
    // but nothing else about the resolution throws or comes back empty.
    expect(result.drawableVariants).toEqual(['neutral']);
  });
});

describe('frameFor — a pure lookup, every (variant, state) combination (US2, FR-010)', () => {
  it('returns exactly the picture the fabricated set holds for that combination', () => {
    const fabricated: PersonPictureSet = {
      drawableVariants: ['neutral', 'man', 'woman'],
      pictures: {
        neutral: { standing: 'N-stand', walking: 'N-walk', running: 'N-run' },
        man: { standing: 'M-stand', walking: 'M-walk', running: 'M-run' },
        woman: { standing: 'W-stand', walking: 'W-walk', running: 'W-run' },
      },
      canRunPicture: true,
      toolbarGlyph: 'N-stand',
    };
    const variants: readonly PersonVariant[] = ['neutral', 'man', 'woman'];
    const frames: readonly PersonFrame[] = ['standing', 'walking', 'running'];
    for (const variant of variants) {
      for (const frame of frames) {
        expect(frameFor(fabricated, variant, frame)).toBe(fabricated.pictures[variant][frame]);
      }
    }
  });
});

describe('resolvePersonPictureSet — toolbar and canvas never disagree (FR-015)', () => {
  it('toolbarGlyph always equals pictures.neutral.standing, across every case above', () => {
    const cases: GlyphProbeInputs[] = [
      probeFrom({}),
      probeFrom({ tofu: [NEUTRAL.standing, MAN.standing, WOMAN.standing] }),
      probeFrom({ tofu: [NEUTRAL.running, MAN.running, WOMAN.running] }),
      probeFrom({ widths: { [WOMAN.walking]: 21 } }),
      probeFrom({ tofu: ALL_GLYPHS }),
    ];
    for (const probe of cases) {
      const result = resolvePersonPictureSet(probe);
      expect(result.toolbarGlyph).toBe(result.pictures.neutral.standing);
    }
  });
});
