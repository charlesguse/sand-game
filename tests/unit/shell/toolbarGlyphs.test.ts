import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const toolbar = readFileSync(
  fileURLToPath(new URL('../../../src/lib/Toolbar.svelte', import.meta.url)),
  'utf8',
);

describe('the sand tool renders as a bucket on every platform', () => {
  it('renders the inline SVG bucket icon', () => {
    expect(toolbar).toContain('<BucketIcon');
  });

  it('still labels it for assistive tech', () => {
    expect(toolbar).toMatch(/aria-label="Pink sand"/);
  });

  it('has no literal bucket or heart emoji left over from the old glyph fallback', () => {
    expect(toolbar).not.toContain('🪣');
    expect(toolbar).not.toContain('💗');
  });

  it('avoids Emoji 13.0+ glyphs, which are missing from Windows 10 / Fire emoji fonts', () => {
    // Use an inline SVG (src/lib/BucketIcon.svelte) instead of a glyph from this era.
    const laterEmoji = ['🪣', '🪄', '🪅', '🪩'];
    for (const glyph of laterEmoji) {
      expect(toolbar).not.toContain(glyph);
    }
  });
});

describe('the treasure chest renders as a drawn shape, never a glyph (FR-007)', () => {
  it('renders the inline SVG chest icon', () => {
    expect(toolbar).toContain('<ChestIcon');
  });

  it('still labels it for assistive tech', () => {
    expect(toolbar).toMatch(/aria-label="Treasure chest"/);
  });

  it('has no substitute chest/treasure emoji anywhere', () => {
    const substitutes = ['🎁', '📦', '💰', '🧰'];
    for (const glyph of substitutes) {
      expect(toolbar).not.toContain(glyph);
    }
  });
});

describe('the person tool button reads its glyph from the resolved picture set, never a literal (research.md §11)', () => {
  it('has no literal 🧑/🧍 glyph baked into the component — glyphFor(\'tool-person\') reads personPictureSet.toolbarGlyph instead', () => {
    expect(toolbar).not.toContain("'🧑'");
    expect(toolbar).toContain('personPictureSet.toolbarGlyph');
  });
});

describe('the mermaid and ice cream tools use pre-Emoji-13.0 glyphs (FR-031)', () => {
  it('ships the single-codepoint mermaid glyph (🧜, Emoji 5.0) rather than a newer replacement', () => {
    expect(toolbar).toContain('🧜');
  });

  it('never ships a gendered ZWJ mermaid/merman variant (FR-003)', () => {
    expect(toolbar).not.toContain('🧜‍♀');
    expect(toolbar).not.toContain('🧜‍♂');
  });

  it('ships the ice cream glyph (🍦, Emoji 1.0) rather than a newer replacement', () => {
    expect(toolbar).toContain('🍦');
  });
});
