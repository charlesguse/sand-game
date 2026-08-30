import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const toolbar = readFileSync(
  fileURLToPath(new URL('../../../src/lib/Toolbar.svelte', import.meta.url)),
  'utf8',
);

describe('the sand tool is labelled as sand, not as a colour', () => {
  it('prefers the bucket glyph', () => {
    expect(toolbar).toContain('SAND_GLYPHS');
  });

  it('renders the sand glyph the platform can actually draw, never a hard-coded one', () => {
    expect(toolbar).toMatch(/\{sandGlyph\}/);
    expect(toolbar).toMatch(/pickGlyph\(\s*SAND_GLYPHS/);
  });

  it('still labels it for assistive tech', () => {
    expect(toolbar).toMatch(/aria-label="Pink sand"/);
  });
});
