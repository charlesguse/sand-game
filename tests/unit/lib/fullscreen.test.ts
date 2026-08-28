import { describe, it, expect, vi } from 'vitest';
import {
  isFullscreenSupported,
  isFullscreen,
  toggleFullscreen,
  type FullscreenElement,
  type FullscreenDocument,
} from '../../../src/lib/fullscreen';

describe('isFullscreenSupported', () => {
  it('is true when the standard API exists', () => {
    expect(isFullscreenSupported({ requestFullscreen: async () => {} })).toBe(true);
  });

  it('is true when only the webkit API exists (older iPadOS Safari)', () => {
    expect(isFullscreenSupported({ webkitRequestFullscreen: () => {} })).toBe(true);
  });

  it('is false when neither exists (iPhone Safari)', () => {
    expect(isFullscreenSupported({})).toBe(false);
  });
});

describe('isFullscreen', () => {
  it('is false when no element is fullscreen', () => {
    expect(isFullscreen({ fullscreenElement: null })).toBe(false);
  });

  it('is true via the standard property', () => {
    expect(isFullscreen({ fullscreenElement: {} as Element })).toBe(true);
  });

  it('is true via the webkit property', () => {
    expect(isFullscreen({ webkitFullscreenElement: {} as Element })).toBe(true);
  });

  it('is false for an empty document object', () => {
    expect(isFullscreen({})).toBe(false);
  });
});

describe('toggleFullscreen', () => {
  it('requests fullscreen when not currently fullscreen', async () => {
    const requestFullscreen = vi.fn(async () => {});
    const element: FullscreenElement = { requestFullscreen };
    const doc: FullscreenDocument = { fullscreenElement: null };

    await toggleFullscreen(element, doc);

    expect(requestFullscreen).toHaveBeenCalledOnce();
  });

  it('prefers the webkit request when the standard one is absent', async () => {
    const webkitRequestFullscreen = vi.fn(() => {});
    const element: FullscreenElement = { webkitRequestFullscreen };

    await toggleFullscreen(element, {});

    expect(webkitRequestFullscreen).toHaveBeenCalledOnce();
  });

  it('exits fullscreen when already fullscreen', async () => {
    const exitFullscreen = vi.fn(async () => {});
    const doc: FullscreenDocument = { fullscreenElement: {} as Element, exitFullscreen };

    await toggleFullscreen({ requestFullscreen: async () => {} }, doc);

    expect(exitFullscreen).toHaveBeenCalledOnce();
  });

  it('resolves without throwing when nothing is supported', async () => {
    await expect(toggleFullscreen({}, {})).resolves.toBeUndefined();
  });

  it('swallows a rejected request so the toy never shows an error', async () => {
    const element: FullscreenElement = {
      requestFullscreen: async () => {
        throw new Error('denied');
      },
    };

    await expect(toggleFullscreen(element, {})).resolves.toBeUndefined();
  });
});
