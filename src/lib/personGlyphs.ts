/**
 * Resolves which walking-person glyphs this device's emoji font can actually draw as single
 * figures, following the same injected-capability shape src/lib/fullscreen.ts already
 * established (constitution Principle V — pure function, no DOM, unit-testable with plain
 * objects). See specs/018-walking-people/research.md §§1-3 for the fallback ladder's reasoning.
 */

import type { PersonVariant } from '../sim/types';

export type PersonFrame = 'standing' | 'walking' | 'running';

export interface GlyphProbeInputs {
  /** True if `glyph` renders as a real figure, not an empty/tofu box. */
  canRender(glyph: string): boolean;
  /** Mirrors CanvasRenderingContext2D.measureText(text).width. */
  measureWidth(text: string): number;
}

export interface PersonPictureSet {
  readonly drawableVariants: readonly PersonVariant[];
  readonly pictures: Readonly<Record<PersonVariant, Readonly<Record<PersonFrame, string>>>>;
  readonly canRunPicture: boolean;
  readonly toolbarGlyph: string;
}

/**
 * Frame selection as a pure function of state, variant, and the resolved picture set (FR-010) —
 * a person's state *is* her frame (data-model.md), so this is a direct lookup, not a computation.
 * Both the render loop and its tests call this rather than indexing `pictures` themselves.
 */
export function frameFor(pictureSet: PersonPictureSet, variant: PersonVariant, frame: PersonFrame): string {
  return pictureSet.pictures[variant][frame];
}

/**
 * The native left/right facing of the walking glyph on this platform's font (FR-011) — a single
 * named constant so a platform that draws 🚶 facing the other way is a one-value correction, not
 * a rewrite. Flagged in quickstart.md for the other maintainer to confirm/correct on their device.
 */
export const WALK_GLYPH_NATIVE_FACING: 1 | -1 = 1;

const GLYPHS: Readonly<Record<PersonVariant, Readonly<Record<PersonFrame, string>>>> = {
  neutral: { standing: '🧍', walking: '🚶', running: '🏃' },
  man: { standing: '🧍‍♂️', walking: '🚶‍♂️', running: '🏃‍♂️' },
  woman: { standing: '🧍‍♀️', walking: '🚶‍♀️', running: '🏃‍♀️' },
};

const VARIANTS: readonly PersonVariant[] = ['neutral', 'man', 'woman'];
const FRAMES: readonly PersonFrame[] = ['standing', 'walking', 'running'];

/** A split ZWJ sequence renders roughly 2x its base glyph's width; anything past this counts as split. */
const SPLIT_WIDTH_RATIO = 1.5;

function safeCanRender(probe: GlyphProbeInputs, glyph: string): boolean {
  try {
    return probe.canRender(glyph);
  } catch {
    return false;
  }
}

function safeMeasureWidth(probe: GlyphProbeInputs, text: string): number {
  try {
    const width = probe.measureWidth(text);
    return Number.isFinite(width) ? width : Infinity;
  } catch {
    return Infinity;
  }
}

/**
 * True iff `genderedGlyph` renders as one figure (not tofu, not visibly split relative to
 * `neutralGlyph`'s width for the same frame). Each probe call is independently guarded, so a
 * thrown/garbage result here degrades only this one glyph's rung, never the whole picture set
 * (research.md §3.5).
 */
function isGenderedGlyphOk(probe: GlyphProbeInputs, genderedGlyph: string, neutralGlyph: string): boolean {
  if (!safeCanRender(probe, genderedGlyph)) return false;
  const genderedWidth = safeMeasureWidth(probe, genderedGlyph);
  const neutralWidth = safeMeasureWidth(probe, neutralGlyph);
  if (!Number.isFinite(genderedWidth) || !Number.isFinite(neutralWidth) || neutralWidth <= 0) return false;
  return genderedWidth <= neutralWidth * SPLIT_WIDTH_RATIO;
}

/**
 * Pure, DOM-free resolution of the fallback ladder (FR-017–FR-020, research.md §§1-3). Never
 * called more than once per session by production code — that guarantee lives at the call site
 * (App.svelte), not inside this function.
 */
export function resolvePersonPictureSet(probe: GlyphProbeInputs): PersonPictureSet {
  // Rung 1: gendered forms are all-or-nothing across every frame (research.md §3.1) — a person
  // must look like the same figure across all her frames, so one bad gendered rung disqualifies
  // the whole gendered family rather than being checked per-frame.
  let genderedOk = true;
  for (const frame of FRAMES) {
    if (!isGenderedGlyphOk(probe, GLYPHS.man[frame], GLYPHS.neutral[frame])) genderedOk = false;
    if (!isGenderedGlyphOk(probe, GLYPHS.woman[frame], GLYPHS.neutral[frame])) genderedOk = false;
  }
  const drawableVariants: readonly PersonVariant[] = genderedOk ? VARIANTS : ['neutral'];

  // Rung 2: standing falls back to walking, per family, whenever standing alone is tofu (FR-019).
  // Walking itself has no defined fallback (research.md §3.4) — shown best-effort, raw, always.
  const pictures = {} as Record<PersonVariant, Record<PersonFrame, string>>;
  for (const variant of VARIANTS) {
    const walking = GLYPHS[variant].walking;
    const standing = safeCanRender(probe, GLYPHS[variant].standing) ? GLYPHS[variant].standing : walking;
    const running = GLYPHS[variant].running;
    pictures[variant] = { standing, walking, running };
  }

  // Rung 3: running is a rendering fallback (a hop), never a glyph substitution — only the
  // resolved/drawable families count toward this decision (research.md §3.3).
  let canRunPicture = true;
  for (const variant of drawableVariants) {
    if (!safeCanRender(probe, GLYPHS[variant].running)) canRunPicture = false;
  }

  return {
    drawableVariants,
    pictures,
    canRunPicture,
    toolbarGlyph: pictures.neutral.standing,
  };
}

/**
 * The one production-facing GlyphProbeInputs implementation: renders each candidate glyph and a
 * known-unassigned codepoint to an off-screen canvas and compares them (tofu check), and calls
 * ctx.measureText (split-sequence check). Never imported by src/sim/* or by unit tests, which
 * construct GlyphProbeInputs by hand.
 */
export function createCanvasGlyphProbe(canvas: HTMLCanvasElement): GlyphProbeInputs {
  const ctx = canvas.getContext('2d');
  const PROBE_SIZE = 32;
  // A known-unassigned codepoint every font renders as the same tofu box — the baseline a real
  // glyph's render must differ from to count as "drawable".
  const TOFU_PROBE = '\u{10FFFD}';

  function renderMetrics(text: string): { width: number; data: Uint8ClampedArray } | null {
    if (ctx === null) return null;
    canvas.width = PROBE_SIZE;
    canvas.height = PROBE_SIZE;
    ctx.clearRect(0, 0, PROBE_SIZE, PROBE_SIZE);
    ctx.font = `${PROBE_SIZE}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000';
    const width = ctx.measureText(text).width;
    ctx.fillText(text, PROBE_SIZE / 2, PROBE_SIZE / 2);
    const data = ctx.getImageData(0, 0, PROBE_SIZE, PROBE_SIZE).data;
    return { width, data };
  }

  return {
    canRender(glyph: string): boolean {
      const glyphMetrics = renderMetrics(glyph);
      const tofuMetrics = renderMetrics(TOFU_PROBE);
      if (glyphMetrics === null || tofuMetrics === null) return false;
      if (Math.abs(glyphMetrics.width - tofuMetrics.width) > 0.5) return true;
      for (let i = 0; i < glyphMetrics.data.length; i++) {
        if (glyphMetrics.data[i] !== tofuMetrics.data[i]) return true;
      }
      return false;
    },
    measureWidth(text: string): number {
      if (ctx === null) return 0;
      ctx.font = `${PROBE_SIZE}px sans-serif`;
      return ctx.measureText(text).width;
    },
  };
}
