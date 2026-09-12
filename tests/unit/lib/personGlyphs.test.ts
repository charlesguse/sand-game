import { describe, it, expect } from 'vitest';
import {
  resolvePersonPictureSet,
  frameFor,
  type GlyphProbeInputs,
  type PersonPictureSet,
  type PersonFrame,
} from '../../../src/lib/personGlyphs';
import type { PersonVariant, PersonTone } from '../../../src/sim/types';

const NEUTRAL = { standing: '🧍', walking: '🚶', running: '🏃' };
const MAN = { standing: '🧍‍♂️', walking: '🚶‍♂️', running: '🏃‍♂️' };
const WOMAN = { standing: '🧍‍♀️', walking: '🚶‍♀️', running: '🏃‍♀️' };
const ALL_GLYPHS = [
  ...Object.values(NEUTRAL),
  ...Object.values(MAN),
  ...Object.values(WOMAN),
];

const VARIANTS: readonly PersonVariant[] = ['neutral', 'man', 'woman'];
const FRAMES: readonly PersonFrame[] = ['standing', 'walking', 'running'];
const ALL_TONES: readonly PersonTone[] = ['default', 'light', 'mediumLight', 'medium', 'mediumDark', 'dark'];
const MODIFIER_TONES: readonly PersonTone[] = ['light', 'mediumLight', 'medium', 'mediumDark', 'dark'];

const BASE: Readonly<Record<PersonFrame, string>> = { standing: '🧍', walking: '🚶', running: '🏃' };
const GENDER_TAIL: Readonly<Record<'man' | 'woman', string>> = {
  man: '‍♂️',
  woman: '‍♀️',
};
const TONE_MODIFIER: Readonly<Record<Exclude<PersonTone, 'default'>, string>> = {
  light: '\u{1F3FB}',
  mediumLight: '\u{1F3FC}',
  medium: '\u{1F3FD}',
  mediumDark: '\u{1F3FE}',
  dark: '\u{1F3FF}',
};

/**
 * Independently reconstructs the FR-004/FR-005 composition order — base glyph, then the tone
 * modifier (skipped for 'default'), then (for gendered forms) the ZWJ + gender sign + VS16 tail —
 * so tests can pin exact expected picture strings without importing production internals.
 */
function composed(variant: PersonVariant, tone: PersonTone, frame: PersonFrame): string {
  const base = BASE[frame];
  const mod = tone === 'default' ? '' : TONE_MODIFIER[tone];
  const tail = variant === 'neutral' ? '' : GENDER_TAIL[variant];
  return base + mod + tail;
}

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
  it('resolves all three variants, all six tones, running enabled, toolbarGlyph is 🧍', () => {
    const probe = probeFrom({});
    const result = resolvePersonPictureSet(probe);
    expect(result.drawableVariants).toEqual(['neutral', 'man', 'woman']);
    expect(result.drawableTones).toEqual(ALL_TONES);
    expect(result.canRunPicture).toBe(true);
    expect(result.toolbarGlyph).toBe('🧍');
    expect(result.pictures.neutral.default).toEqual(NEUTRAL);
    expect(result.pictures.man.default).toEqual(MAN);
    expect(result.pictures.woman.default).toEqual(WOMAN);
  });

  it('composes every (variant, tone, frame) picture as base, then tone modifier, then gendered tail — modifier before the joiner, never after the gender sign (FR-004, FR-005)', () => {
    const probe = probeFrom({});
    const result = resolvePersonPictureSet(probe);
    for (const variant of VARIANTS) {
      for (const tone of ALL_TONES) {
        for (const frame of FRAMES) {
          expect(result.pictures[variant][tone][frame]).toBe(composed(variant, tone, frame));
        }
      }
    }
  });
});

describe('resolvePersonPictureSet — standing missing', () => {
  it('falls back the idle frame to walking, per family, never to 🧑', () => {
    const probe = probeFrom({ tofu: [NEUTRAL.standing, MAN.standing, WOMAN.standing] });
    const result = resolvePersonPictureSet(probe);
    expect(result.pictures.neutral.default.standing).toBe(result.pictures.neutral.default.walking);
    expect(result.pictures.neutral.default.standing).toBe('🚶');
    expect(result.pictures.man.default.standing).toBe(result.pictures.man.default.walking);
    expect(result.pictures.woman.default.standing).toBe(result.pictures.woman.default.walking);
    expect(result.toolbarGlyph).toBe('🚶');
    expect(result.toolbarGlyph).not.toBe('🧑');
  });
});

describe('resolvePersonPictureSet — running missing', () => {
  it('flags canRunPicture false without substituting a glyph', () => {
    const probe = probeFrom({ tofu: [NEUTRAL.running, MAN.running, WOMAN.running] });
    const result = resolvePersonPictureSet(probe);
    expect(result.canRunPicture).toBe(false);
    expect(result.pictures.neutral.default.running).toBe('🏃');
  });
});

describe('resolvePersonPictureSet — gendered forms splitting', () => {
  it('drops to neutral-only when a gendered sequence measures ~2x its base glyph', () => {
    const probe = probeFrom({
      widths: { [MAN.standing]: 20, [MAN.walking]: 20, [MAN.running]: 20 },
    });
    const result = resolvePersonPictureSet(probe);
    expect(result.drawableVariants).toEqual(['neutral']);
    expect(result.pictures.neutral.default).toEqual(NEUTRAL);
  });
});

describe('resolvePersonPictureSet — nothing supported', () => {
  it('still returns the safest known-drawable set, never empty', () => {
    const probe = probeFrom({ tofu: ALL_GLYPHS });
    const result = resolvePersonPictureSet(probe);
    expect(result.drawableVariants).toEqual(['neutral']);
    expect(result.drawableVariants.length).toBeGreaterThan(0);
    expect(result.drawableTones).toContain('default');
    expect(result.toolbarGlyph).toBeTruthy();
    expect(result.canRunPicture).toBe(false);
  });
});

describe('resolvePersonPictureSet — a measurer/renderer that throws or returns nonsense', () => {
  it("degrades only the affected glyph's rung, not the whole picture set", () => {
    const probe = probeFrom({ canRenderThrows: [NEUTRAL.running], measureThrows: [MAN.standing] });
    const result = resolvePersonPictureSet(probe);
    // Running throws for neutral -> canRunPicture false, but standing/walking unaffected.
    expect(result.canRunPicture).toBe(false);
    expect(result.pictures.neutral.default.standing).toBe('🧍');
    expect(result.pictures.neutral.default.walking).toBe('🚶');
    // A throwing measurer for man's standing glyph fails that gendered check -> neutral-only,
    // but nothing else about the resolution throws or comes back empty.
    expect(result.drawableVariants).toEqual(['neutral']);
  });
});

describe('resolvePersonPictureSet — tone resolution (US3, FR-010, FR-011, FR-012)', () => {
  it('keeps every tone when every toned picture renders fine', () => {
    const probe = probeFrom({});
    const result = resolvePersonPictureSet(probe);
    expect(result.drawableTones).toEqual(ALL_TONES);
  });

  it('drops exactly one tone when it alone splits on exactly one frame of one form, keeping the rest', () => {
    const probe = probeFrom({ widths: { [composed('woman', 'medium', 'running')]: 25 } });
    const result = resolvePersonPictureSet(probe);
    expect(result.drawableTones).toEqual(['default', 'light', 'mediumLight', 'mediumDark', 'dark']);
  });

  it('drops every modifier tone when all five split, degrading to default with no stall or exception', () => {
    const widths = Object.fromEntries(MODIFIER_TONES.map((tone) => [composed('neutral', tone, 'standing'), 30]));
    const probe = probeFrom({ widths });
    expect(() => resolvePersonPictureSet(probe)).not.toThrow();
    const result = resolvePersonPictureSet(probe);
    expect(result.drawableTones).toEqual(['default']);
  });

  it('judges tones only against the drawable (neutral-only) variant when gendered forms are also splitting', () => {
    const probe = probeFrom({
      widths: {
        [MAN.standing]: 20,
        [MAN.walking]: 20,
        [MAN.running]: 20,
        // Would split a tone if man were judged, but man isn't drawable — must not disqualify it.
        [composed('man', 'dark', 'standing')]: 30,
      },
    });
    const result = resolvePersonPictureSet(probe);
    expect(result.drawableVariants).toEqual(['neutral']);
    expect(result.drawableTones).toContain('dark');
  });

  it('never throws when the probe itself throws for a toned glyph', () => {
    const probe = probeFrom({ canRenderThrows: [composed('neutral', 'light', 'walking')] });
    expect(() => resolvePersonPictureSet(probe)).not.toThrow();
    const result = resolvePersonPictureSet(probe);
    expect(result.drawableTones).not.toContain('light');
  });

  it('never throws on a non-finite width (excluded as split) or a zero width (counts as fine, mirroring the gendered check)', () => {
    const probe = probeFrom({
      widths: { [composed('neutral', 'dark', 'running')]: NaN, [composed('neutral', 'mediumDark', 'walking')]: 0 },
    });
    expect(() => resolvePersonPictureSet(probe)).not.toThrow();
    const result = resolvePersonPictureSet(probe);
    expect(result.drawableTones).not.toContain('dark');
    expect(result.drawableTones).toContain('mediumDark');
  });

  it("keeps a tone whose own toned stander is unavailable, once rung 2 already collapsed standing into walking (FR-012)", () => {
    const probe = probeFrom({ tofu: [NEUTRAL.standing, composed('neutral', 'dark', 'standing')] });
    const result = resolvePersonPictureSet(probe);
    expect(result.pictures.neutral.default.standing).toBe(result.pictures.neutral.default.walking);
    expect(result.drawableTones).toContain('dark');
  });

  it("drops a tone whose own toned stander alone splits, when the untoned stander itself is fine (FR-012)", () => {
    const probe = probeFrom({ widths: { [composed('neutral', 'dark', 'standing')]: 30 } });
    const result = resolvePersonPictureSet(probe);
    expect(result.pictures.neutral.default.standing).not.toBe(result.pictures.neutral.default.walking);
    expect(result.drawableTones).not.toContain('dark');
  });
});

describe('resolvePersonPictureSet — no leaked split composition, toolbar/canvas parity (US1 Acceptance Scenario 4, US3 Acceptance Scenario 7, FR-014, FR-015)', () => {
  it("every non-drawable tone falls back wholesale to that variant's default row, and toolbarGlyph always matches pictures.neutral.default.standing", () => {
    const cases: GlyphProbeInputs[] = [
      probeFrom({}),
      probeFrom({ tofu: [NEUTRAL.standing, MAN.standing, WOMAN.standing] }),
      probeFrom({ tofu: [NEUTRAL.running, MAN.running, WOMAN.running] }),
      probeFrom({ widths: { [MAN.standing]: 20, [MAN.walking]: 20, [MAN.running]: 20 } }),
      probeFrom({ tofu: ALL_GLYPHS }),
      probeFrom({ widths: { [composed('woman', 'medium', 'running')]: 25 } }),
      probeFrom({ widths: Object.fromEntries(MODIFIER_TONES.map((tone) => [composed('neutral', tone, 'standing'), 30])) }),
      probeFrom({
        widths: { [MAN.standing]: 20, [MAN.walking]: 20, [MAN.running]: 20, [composed('man', 'dark', 'standing')]: 30 },
      }),
      probeFrom({ canRenderThrows: [composed('neutral', 'light', 'walking')] }),
      probeFrom({ widths: { [composed('neutral', 'dark', 'running')]: NaN, [composed('neutral', 'mediumDark', 'walking')]: 0 } }),
      probeFrom({ tofu: [NEUTRAL.standing, composed('neutral', 'dark', 'standing')] }),
      probeFrom({ widths: { [composed('neutral', 'dark', 'standing')]: 30 } }),
    ];
    for (const probe of cases) {
      const result = resolvePersonPictureSet(probe);
      expect(result.toolbarGlyph).toBe(result.pictures.neutral.default.standing);
      for (const variant of VARIANTS) {
        for (const tone of MODIFIER_TONES) {
          if (!result.drawableTones.includes(tone)) {
            expect(result.pictures[variant][tone]).toEqual(result.pictures[variant].default);
          }
        }
      }
    }
  });
});

describe('frameFor — a pure lookup, every (variant, tone, frame) combination (US1, FR-010)', () => {
  it('returns exactly the picture the fabricated set holds for that combination', () => {
    const pictures = {} as Record<PersonVariant, Record<PersonTone, Record<PersonFrame, string>>>;
    for (const variant of VARIANTS) {
      const byTone = {} as Record<PersonTone, Record<PersonFrame, string>>;
      for (const tone of ALL_TONES) {
        const byFrame = {} as Record<PersonFrame, string>;
        for (const frame of FRAMES) byFrame[frame] = `${variant}-${tone}-${frame}`;
        byTone[tone] = byFrame;
      }
      pictures[variant] = byTone;
    }
    const fabricated: PersonPictureSet = {
      drawableVariants: VARIANTS,
      drawableTones: ALL_TONES,
      pictures,
      canRunPicture: true,
      toolbarGlyph: pictures.neutral.default.standing,
    };
    for (const variant of VARIANTS) {
      for (const tone of ALL_TONES) {
        for (const frame of FRAMES) {
          expect(frameFor(fabricated, variant, tone, frame)).toBe(fabricated.pictures[variant][tone][frame]);
        }
      }
    }
  });
});
