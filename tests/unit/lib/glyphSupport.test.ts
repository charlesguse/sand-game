import { describe, it, expect } from 'vitest';
import {
  isGlyphRenderable,
  pickGlyph,
  createMeasurer,
  SAND_GLYPHS,
  TOFU_PROBE,
} from '../../../src/lib/glyphSupport';

/** A font that draws `supported` and renders everything else as a 24px tofu box. */
function fontWith(supported: string[]) {
  return (text: string) => (supported.includes(text) ? 43.94 : 24);
}

describe('isGlyphRenderable', () => {
  it('says yes when the glyph is wider than the tofu box', () => {
    expect(isGlyphRenderable(fontWith(['🪣']), '🪣')).toBe(true);
  });

  it('says no when the glyph measures exactly as wide as the tofu box', () => {
    expect(isGlyphRenderable(fontWith([]), '🪣')).toBe(false);
  });

  it('says no rather than guessing when the measurement is degenerate', () => {
    expect(isGlyphRenderable(() => 0, '🪣')).toBe(false);
  });

  it('says no rather than throwing when measuring fails', () => {
    expect(
      isGlyphRenderable(() => {
        throw new Error('no font');
      }, '🪣'),
    ).toBe(false);
  });

  it('measures the unassigned probe code point to find the tofu width', () => {
    const seen: string[] = [];
    isGlyphRenderable((t) => {
      seen.push(t);
      return 24;
    }, '🪣');
    expect(seen).toContain(TOFU_PROBE);
  });
});

describe('pickGlyph', () => {
  it('keeps the preferred glyph on a platform that can draw it', () => {
    expect(pickGlyph(SAND_GLYPHS, fontWith(['🪣', '💗']))).toBe('🪣');
  });

  it('falls back to the older glyph where the newer one is a box', () => {
    expect(pickGlyph(SAND_GLYPHS, fontWith(['💗']))).toBe('💗');
  });

  it('falls back rather than showing a box when nothing can be measured', () => {
    expect(pickGlyph(SAND_GLYPHS, null)).toBe('💗');
  });

  it('never returns a glyph the platform cannot draw when a fallback exists', () => {
    expect(pickGlyph(SAND_GLYPHS, fontWith([]))).toBe('💗');
  });
});

describe('createMeasurer', () => {
  it('returns null when the platform gives no 2D canvas, so callers fall back', () => {
    const doc = { createElement: () => ({ getContext: () => null }) } as unknown as Document;
    expect(createMeasurer('32px sans-serif', doc)).toBeNull();
  });

  it('returns null rather than throwing when there is no canvas at all', () => {
    const doc = {
      createElement: () => {
        throw new Error('no DOM');
      },
    } as unknown as Document;
    expect(createMeasurer('32px sans-serif', doc)).toBeNull();
  });

  it('measures in the font it was given', () => {
    let assigned = '';
    const ctx = {
      set font(v: string) {
        assigned = v;
      },
      get font() {
        return assigned;
      },
      measureText: (t: string) => ({ width: t.length }),
    };
    const doc = { createElement: () => ({ getContext: () => ctx }) } as unknown as Document;
    const measure = createMeasurer('32px system-ui', doc);
    expect(assigned).toBe('32px system-ui');
    expect(measure?.('ab')).toBe(2);
  });
});

describe('the sand glyph candidates', () => {
  it('prefers the bucket, so platforms that can draw it still get it', () => {
    expect(SAND_GLYPHS[0]).toBe('🪣');
  });

  it('ends with a glyph old enough that every platform has it', () => {
    expect(SAND_GLYPHS[SAND_GLYPHS.length - 1]).toBe('💗');
  });
});
