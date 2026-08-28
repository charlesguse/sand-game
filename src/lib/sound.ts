/**
 * Pure WebAudio synthesis for gentle toy sounds — oscillators + gain envelopes only, per
 * constitution I (no audio assets, single self-contained file). Every exported function is a
 * silent no-op when muted, when `AudioContext`/`webkitAudioContext` is unavailable (node has
 * neither; some browsers lack it too), or when anything throws — nothing here may ever
 * propagate an error to the render loop or surface a broken-toy moment to a 4-year-old.
 *
 * The `AudioContext` is created lazily, only inside `initSoundOnGesture()`, and never at
 * module load: iOS Safari's autoplay policy keeps a context created outside a user gesture
 * permanently suspended, so PlayArea calls `initSoundOnGesture()` from `pointerdown`.
 */

const MUTE_KEY = 'madisons-sand-muted';
const MASTER_GAIN = 0.12;

export type PourKind = 'sand' | 'water' | 'dirt' | 'gumdrop' | 'grass' | 'star';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function loadMutedFromStorage(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(MUTE_KEY) === 'true';
  } catch {
    return false;
  }
}

let muted = loadMutedFromStorage();

export function setMuted(next: boolean): void {
  muted = next;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MUTE_KEY, String(next));
    }
  } catch {
    // Storage unavailable (private mode, quota) — the mute toggle still works for this
    // session, it just won't be remembered next launch. Silent, like Task 1's save guard.
  }
}

export function isMuted(): boolean {
  return muted;
}

type AudioContextCtor = new () => AudioContext;

function resolveAudioContextCtor(): AudioContextCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext;
}

/**
 * Creates (once) and resumes the shared AudioContext. Idempotent and safe to call from
 * anywhere, any number of times — later calls just resume a context an earlier call already
 * made. Must be called from a real user gesture (pointerdown) for iOS to allow audio at all.
 */
export function initSoundOnGesture(): void {
  try {
    if (ctx === null) {
      const Ctor = resolveAudioContextCtor();
      if (!Ctor) return;
      const created = new Ctor();
      const gain = created.createGain();
      gain.gain.value = MASTER_GAIN;
      gain.connect(created.destination);
      ctx = created;
      master = gain;
    }
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {
        // Resume can reject (e.g. no gesture yet on some browsers) — ignore, next gesture retries.
      });
    }
  } catch {
    // Construction failed for some reason — leave everything null so every play* stays a no-op.
    ctx = null;
    master = null;
  }
}

/** Runs `fn` only when sound is actually available and unmuted; never lets it throw outward.
 * Checked *before* any node is built, so a muted toy never even schedules silent oscillators. */
function safe(fn: () => void): void {
  if (muted || ctx === null || master === null) return;
  try {
    fn();
  } catch {
    // Never propagate — a broken oscillator must never crash the game.
  }
}

interface ToneOptions {
  type?: OscillatorType;
  /** Peak gain of this voice, 0..1, before the master gain node scales it down further. */
  peak?: number;
  /** Optional linear frequency ramp target, reached by the end of `duration`. */
  freqEnd?: number;
  /** Seconds to ramp up from silence to `peak` — keeps every sound click-free. */
  attack?: number;
  /** Seconds to wait before this tone starts, for sequencing multiple tones (e.g. a trill). */
  delay?: number;
}

/** Schedules one oscillator + gain-envelope voice. Soft-ramps in (never steps to full volume)
 * and exponentially decays to silence — the only shape that never produces an audible click. */
function scheduleTone(freq: number, duration: number, options: ToneOptions = {}): void {
  if (ctx === null || master === null) return;
  const { type = 'sine', peak = 0.6, freqEnd, attack = 0.015, delay = 0 } = options;
  const t0 = ctx.currentTime + delay;
  const tEnd = t0 + duration;

  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd !== undefined) {
    osc.frequency.linearRampToValueAtTime(freqEnd, tEnd);
  }

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, tEnd);

  osc.connect(gain);
  gain.connect(master);
  osc.start(t0);
  osc.stop(tEnd + 0.02);
}

// ---------------------------------------------------------------------------------------------
// Pour throttling — extracted as a pure, injectable-clock function so it is unit-testable in
// node without any AudioContext at all.
// ---------------------------------------------------------------------------------------------

export const POUR_THROTTLE_MS = 160;

/** Pure throttle decision: admits (true) once at least `throttleMs` has elapsed since
 * `lastPlayedAt`; gates (false) otherwise. Clock is injected (`now`, `lastPlayedAt`) rather
 * than read internally, so this is testable with plain numbers and no timers. */
export function canPlayPour(now: number, lastPlayedAt: number, throttleMs: number = POUR_THROTTLE_MS): boolean {
  return now - lastPlayedAt >= throttleMs;
}

let lastPourAt = -Infinity;

const POUR_PITCH: Record<PourKind, number> = {
  sand: 300,
  water: 520,
  dirt: 190,
  gumdrop: 700,
  grass: 380,
  star: 640,
};

/** A soft trickling blip, pitched per material so pouring sand doesn't sound like pouring
 * water. Internally throttled to at most one sound per `POUR_THROTTLE_MS`, regardless of how
 * fast `paintAt` calls this during a fast drag stroke. */
export function playPour(kind: PourKind): void {
  if (muted || ctx === null || master === null) return;
  const now = Date.now();
  if (!canPlayPour(now, lastPourAt)) return;
  lastPourAt = now;
  const freq = POUR_PITCH[kind];
  safe(() => scheduleTone(freq, 0.11, { type: 'triangle', peak: 0.45, freqEnd: freq * 0.82, attack: 0.008 }));
}

/** A short, bright click for an object (rainbow/unicorn/palm/flamingo) landing on the canvas. */
export function playPop(): void {
  safe(() => scheduleTone(560, 0.09, { type: 'sine', peak: 0.6, freqEnd: 320, attack: 0.004 }));
}

/** A soft rising "bloop" for the poodle eating a gumdrop. */
export function playBloop(): void {
  safe(() => scheduleTone(280, 0.13, { type: 'sine', peak: 0.55, freqEnd: 460, attack: 0.01 }));
}

/** A brief wobbly vibrato for the poodle shaking. */
export function playWobble(): void {
  safe(() => {
    if (ctx === null || master === null) return;
    const duration = 0.24;
    const t0 = ctx.currentTime;
    const tEnd = t0 + duration;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(380, t0);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 20;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 35;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(0.45, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, tEnd);

    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    lfo.start(t0);
    osc.stop(tEnd + 0.02);
    lfo.stop(tEnd + 0.02);
  });
}

/** A quick three-note trill for the pet being poked (wired by Task 4). */
export function playTrill(): void {
  safe(() => {
    const notes = [520, 660, 780];
    const noteDuration = 0.06;
    const gap = 0.05;
    notes.forEach((freq, i) => {
      scheduleTone(freq, noteDuration, { type: 'sine', peak: 0.4, attack: 0.004, delay: i * gap });
    });
  });
}

/** A gentle downward whoosh for undo/redo. */
export function playWhoosh(): void {
  safe(() => scheduleTone(640, 0.18, { type: 'sine', peak: 0.45, freqEnd: 260, attack: 0.01 }));
}

/** A broader, longer downward sweep for clear-all. */
export function playSweep(): void {
  safe(() => scheduleTone(500, 0.28, { type: 'triangle', peak: 0.5, freqEnd: 130, attack: 0.015 }));
}

/** A soft two-tone chime for the magic wand. */
export function playChime(): void {
  safe(() => {
    scheduleTone(880, 0.24, { type: 'sine', peak: 0.45, attack: 0.006 });
    scheduleTone(1320, 0.2, { type: 'sine', peak: 0.22, attack: 0.006, delay: 0.015 });
  });
}
