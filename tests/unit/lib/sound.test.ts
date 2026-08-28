import { describe, it, expect, beforeEach } from 'vitest';
import {
  initSoundOnGesture,
  setMuted,
  isMuted,
  playPour,
  playPop,
  playBloop,
  playWobble,
  playTrill,
  playWhoosh,
  playSweep,
  playChime,
  canPlayPour,
  POUR_THROTTLE_MS,
  type PourKind,
} from '../../../src/lib/sound';

// This suite runs under vitest's `environment: 'node'` (see vitest.config.ts) — there is no
// `window`, no `AudioContext`, no `localStorage`. That absence is exactly the point: it proves
// every exported function degrades to a silent no-op rather than assuming a browser exists.
// Sound *quality* (pitch, envelope shape) is an ear-check per the task brief, not something
// unit tests can assert without a real AudioContext.

const POUR_KINDS: PourKind[] = ['sand', 'water', 'dirt', 'gumdrop', 'grass', 'star'];

describe('sound module — node safety (no AudioContext, no window)', () => {
  it('imports without throwing', () => {
    // Import already happened above; reaching this line proves it didn't throw at module load.
    expect(true).toBe(true);
  });

  it('initSoundOnGesture never throws, and is safe to call repeatedly (idempotent)', () => {
    expect(() => initSoundOnGesture()).not.toThrow();
    expect(() => initSoundOnGesture()).not.toThrow();
    expect(() => initSoundOnGesture()).not.toThrow();
  });

  it('every playPour kind runs without throwing', () => {
    for (const kind of POUR_KINDS) {
      expect(() => playPour(kind)).not.toThrow();
    }
  });

  it('playPop runs without throwing', () => {
    expect(() => playPop()).not.toThrow();
  });

  it('playBloop runs without throwing', () => {
    expect(() => playBloop()).not.toThrow();
  });

  it('playWobble runs without throwing', () => {
    expect(() => playWobble()).not.toThrow();
  });

  it('playTrill runs without throwing', () => {
    expect(() => playTrill()).not.toThrow();
  });

  it('playWhoosh runs without throwing', () => {
    expect(() => playWhoosh()).not.toThrow();
  });

  it('playSweep runs without throwing', () => {
    expect(() => playSweep()).not.toThrow();
  });

  it('playChime runs without throwing', () => {
    expect(() => playChime()).not.toThrow();
  });

  it('calling every export back-to-back with no AudioContext never throws', () => {
    expect(() => {
      initSoundOnGesture();
      playPour('sand');
      playPop();
      playBloop();
      playWobble();
      playTrill();
      playWhoosh();
      playSweep();
      playChime();
      setMuted(true);
      isMuted();
      setMuted(false);
    }).not.toThrow();
  });
});

describe('setMuted / isMuted — round trip', () => {
  it('defaults to unmuted', () => {
    // Default state: nothing has muted it yet in this describe block. (localStorage doesn't
    // exist in node, so persistence can't leak between test files either.)
    expect(isMuted()).toBe(false);
  });

  it('round-trips true', () => {
    setMuted(true);
    expect(isMuted()).toBe(true);
  });

  it('round-trips back to false', () => {
    setMuted(false);
    expect(isMuted()).toBe(false);
  });

  it('setMuted never throws even though localStorage does not exist in node', () => {
    expect(() => setMuted(true)).not.toThrow();
    setMuted(false);
  });
});

describe('canPlayPour — pure, injectable-clock throttle helper', () => {
  it('gates a second call inside the throttle window', () => {
    const lastPlayedAt = 1000;
    const now = lastPlayedAt + POUR_THROTTLE_MS - 1; // 1ms short of the window
    expect(canPlayPour(now, lastPlayedAt)).toBe(false);
  });

  it('admits a call exactly at the throttle window boundary', () => {
    const lastPlayedAt = 1000;
    const now = lastPlayedAt + POUR_THROTTLE_MS;
    expect(canPlayPour(now, lastPlayedAt)).toBe(true);
  });

  it('admits a call well after the throttle window', () => {
    const lastPlayedAt = 1000;
    const now = lastPlayedAt + POUR_THROTTLE_MS + 500;
    expect(canPlayPour(now, lastPlayedAt)).toBe(true);
  });

  it('admits the very first call (no prior play, lastPlayedAt is -Infinity)', () => {
    expect(canPlayPour(0, -Infinity)).toBe(true);
  });

  it('honors a custom throttle window when supplied', () => {
    expect(canPlayPour(100, 0, 200)).toBe(false);
    expect(canPlayPour(200, 0, 200)).toBe(true);
  });
});

describe('playPour internal throttle (integration through the real export)', () => {
  beforeEach(() => {
    setMuted(false);
  });

  it('rapid repeated calls never throw, regardless of throttling', () => {
    expect(() => {
      for (let i = 0; i < 50; i++) playPour('water');
    }).not.toThrow();
  });
});
