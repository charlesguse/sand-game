/**
 * Picks toolbar glyphs a platform can actually draw.
 *
 * Emoji added in recent Unicode revisions are missing from older system emoji
 * fonts — 🪣 (Emoji 13.0) draws as an empty "tofu" box on Windows 10 Chrome and
 * on the Fire tablet, while iPadOS draws it fine. A blank box is exactly the
 * kind of broken surface the constitution forbids, and a five-year-old cannot
 * read a bug report, so each control names a modern glyph plus an older
 * fallback and the platform decides which one it can render.
 *
 * Dependency-injected rather than reaching for globals so it unit-tests with
 * plain functions and no DOM (constitution V).
 */

/** Measures the advance width of a string in the font under test. */
export type MeasureText = (text: string) => number;

/**
 * A permanently-unassigned code point: every font draws it as its "missing
 * glyph" box, so its width is the width of tofu in that font.
 */
export const TOFU_PROBE = '\u{10FFFF}';

/**
 * True when the font draws a real glyph for `glyph` rather than a tofu box.
 * A missing glyph measures exactly as wide as the missing-glyph box, which is
 * what the probe compares against. Degenerate measurements (zero-width fonts,
 * a canvas that measures nothing) answer `false`, so an unsure platform gets
 * the older fallback rather than a gamble on a box.
 */
export function isGlyphRenderable(measure: MeasureText, glyph: string): boolean {
  try {
    const tofu = measure(TOFU_PROBE);
    if (!(tofu > 0)) return false;
    const width = measure(glyph);
    if (!(width > 0)) return false;
    return Math.abs(width - tofu) > 0.01;
  } catch {
    return false;
  }
}

/**
 * Returns the first candidate the platform can draw, in preference order.
 * The last candidate is the guaranteed one and is returned when nothing else
 * survives — the toolbar always shows a picture, never a box, on every device.
 */
export function pickGlyph(candidates: readonly string[], measure: MeasureText | null): string {
  const fallback = candidates[candidates.length - 1] ?? '';
  if (measure === null) return fallback;
  for (const candidate of candidates) {
    if (isGlyphRenderable(measure, candidate)) return candidate;
  }
  return fallback;
}

/**
 * Builds a measurer over a 2D canvas in the given font, or null when the
 * platform gives us no canvas to measure with (in which case every control
 * falls back to its guaranteed glyph). Never throws.
 */
export function createMeasurer(font: string, doc: Pick<Document, 'createElement'>): MeasureText | null {
  try {
    const canvas = doc.createElement('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext?.('2d');
    if (!ctx) return null;
    ctx.font = font;
    return (text: string) => ctx.measureText(text).width;
  } catch {
    return null;
  }
}

/**
 * The toolbar's glyph choices, newest-first with an older guaranteed fallback.
 * 🪣 is Max's bucket (spec'd as "the sand tool is a bucket, not a heart") and
 * stays wherever the platform can draw it; 💗 is what shipped before it and
 * renders everywhere.
 */
export const SAND_GLYPHS = ['🪣', '💗'] as const;

/** Font the probe measures in: the toolbar control's own size and stack. */
export const CONTROL_FONT = '32px system-ui, sans-serif';
