import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const toolbar = readFileSync(
  fileURLToPath(new URL('../../../src/lib/Toolbar.svelte', import.meta.url)),
  'utf8',
);

describe('the sand tool is labelled as sand, not as a colour', () => {
  it('uses the bucket glyph', () => {
    expect(toolbar).toContain('🪣');
  });

  it('no longer uses a heart for sand', () => {
    expect(toolbar).not.toContain('💗');
  });

  it('still labels it for assistive tech', () => {
    expect(toolbar).toMatch(/aria-label="Pink sand"/);
  });
});
