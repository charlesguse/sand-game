import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const html = readFileSync(
  fileURLToPath(new URL('../../../index.html', import.meta.url)),
  'utf8',
);

describe('index.html iOS standalone shell', () => {
  it('declares itself an iOS standalone web app', () => {
    expect(html).toContain('name="apple-mobile-web-app-capable"');
    expect(html).toMatch(
      /name="apple-mobile-web-app-capable"[^>]*content="yes"/,
    );
  });

  it('sets a status bar style that lets the page paint under the bar', () => {
    expect(html).toMatch(
      /name="apple-mobile-web-app-status-bar-style"[^>]*content="black-translucent"/,
    );
  });

  it('keeps viewport-fit=cover so safe-area insets resolve', () => {
    expect(html).toContain('viewport-fit=cover');
  });

  it('makes no external network requests', () => {
    expect(html).not.toMatch(/(?:src|href)="https?:\/\//);
  });
});
