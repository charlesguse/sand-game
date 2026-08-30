import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

/**
 * computeToolbarLayout budgets the band from --control-size and lays controls out along a
 * known axis. These assertions pin the CSS facts that make the rendered toolbar agree with
 * that model (FR-014). Each one, when broken, put controls outside the viewport where a child
 * could not reach them — none of which the model-level tests in layout.test.ts can see.
 */
const toolbar = readFileSync(
  fileURLToPath(new URL('../../../src/lib/Toolbar.svelte', import.meta.url)),
  'utf8',
);

const controlRule = toolbar.slice(toolbar.indexOf('.control {'), toolbar.indexOf('.control[data-group'));
const selectedRule = toolbar.slice(toolbar.indexOf('.control.selected {'));

describe('the rendered toolbar matches the layout model (FR-010, FR-014)', () => {
  it('counts a control\'s border inside --control-size, so a rendered line is never wider than the modelled one', () => {
    expect(controlRule).toMatch(/box-sizing:\s*border-box/);
  });

  it('flows the rail arrangement down the viewport height, the axis the model budgets against', () => {
    expect(toolbar).toMatch(/\.toolbar\.rail\s*\{[^}]*flex-direction:\s*column/);
  });

  it('applies the rail class from the computed arrangement rather than a media query', () => {
    expect(toolbar).toMatch(/class:rail=\{layout\.arrangement === 'rail'\}/);
  });

  it('keeps the selected control\'s emphasis inside its box — a scale-up clips against the screen edge', () => {
    expect(selectedRule.slice(0, selectedRule.indexOf('}'))).not.toMatch(/transform:\s*scale\(\s*1\.[1-9]/);
  });

  it('gaps the flow axis only, since the modelled thickness counts lines and no gaps between them', () => {
    expect(toolbar).toMatch(/row-gap:\s*0;\s*column-gap:\s*var\(--pitch\)/);
    expect(toolbar).toMatch(/\.toolbar\.rail\s*\{[^}]*row-gap:\s*var\(--pitch\);[^}]*column-gap:\s*0/);
  });
});
