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
