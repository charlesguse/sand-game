/**
 * Resolves which walking-person glyphs this device's emoji font can actually draw as single
 * figures, following the same injected-capability shape src/lib/fullscreen.ts already
 * established (constitution Principle V — pure function, no DOM, unit-testable with plain
 * objects). See specs/018-walking-people/research.md §§1-3 for the fallback ladder's reasoning.
 */

import type { PersonVariant, PersonTone } from '../sim/types';

export type PersonFrame = 'standing' | 'walking' | 'running';

export interface GlyphProbeInputs {
  /** True if `glyph` renders as a real figure, not an empty/tofu box. */
  canRender(glyph: string): boolean;
  /** Mirrors CanvasRenderingContext2D.measureText(text).width. */
  measureWidth(text: string): number;
}

export interface PersonPictureSet {
  readonly drawableVariants: readonly PersonVariant[];
  readonly drawableTones: readonly PersonTone[];
  readonly pictures: Readonly<Record<PersonVariant, Readonly<Record<PersonTone, Readonly<Record<PersonFrame, string>>>>>>;
  readonly canRunPicture: boolean;
  readonly toolbarGlyph: string;
}

/**
 * Frame selection as a pure function of state, variant, tone, and the resolved picture set
 * (FR-010) — a person's state *is* her frame (data-model.md), so this is a direct lookup, not a
 * computation. Both the render loop and its tests call this rather than indexing `pictures`
 * themselves.
 */
export function frameFor(pictureSet: PersonPictureSet, variant: PersonVariant, tone: PersonTone, frame: PersonFrame): string {
  return pictureSet.pictures[variant][tone][frame];
}

/**
 * The native left/right facing of the walking glyph on this platform's font (FR-011) — a single
 * named constant so a platform that draws 🚶 facing the other way is a one-value correction, not
 * a rewrite. -1 means the glyph walks toward -x (screen left) as drawn. Verified by eye on
 * Windows 11 desktop Chrome (Segoe UI Emoji): 🚶 and 🏃 both face left, so a person heading right
 * must be mirrored. Apple's and Noto's 🚶 also face left, but iPad Safari is Max's to confirm
 * (quickstart.md, FR-032).
 */
export const WALK_GLYPH_NATIVE_FACING: 1 | -1 = -1;

const GLYPHS: Readonly<Record<PersonVariant, Readonly<Record<PersonFrame, string>>>> = {
  neutral: { standing: '🧍', walking: '🚶', running: '🏃' },
  man: { standing: '🧍‍♂️', walking: '🚶‍♂️', running: '🏃‍♂️' },
  woman: { standing: '🧍‍♀️', walking: '🚶‍♀️', running: '🏃‍♀️' },
};

const VARIANTS: readonly PersonVariant[] = ['neutral', 'man', 'woman'];
const FRAMES: readonly PersonFrame[] = ['standing', 'walking', 'running'];
/** Every tone but 'default', which draws with no modifier at all (FR-005). */
const MODIFIER_TONES: readonly PersonTone[] = ['light', 'mediumLight', 'medium', 'mediumDark', 'dark'];

/** Fitzpatrick emoji modifiers (Unicode Emoji 1.0+), one per non-default tone (FR-004). */
const TONE_MODIFIERS: Readonly<Record<Exclude<PersonTone, 'default'>, string>> = {
  light: '\u{1F3FB}',
  mediumLight: '\u{1F3FC}',
  medium: '\u{1F3FD}',
  mediumDark: '\u{1F3FE}',
  dark: '\u{1F3FF}',
};

/**
 * Builds one (variant, tone, frame) picture: the bare base glyph, then the tone modifier (skipped
 * for 'default'), then — for `man`/`woman` — the ZWJ + gender sign + VS16 tail already embedded
 * in `GLYPHS[variant][frame]` (FR-005). The tail is sliced off the existing gendered glyph rather
 * than hand-written, since `GLYPHS.neutral[frame]` is always an exact prefix of
 * `GLYPHS[variant][frame]` for the gendered variants.
 */
function composePicture(variant: PersonVariant, tone: PersonTone, frame: PersonFrame): string {
  const base = GLYPHS.neutral[frame];
  const toneModifier = tone === 'default' ? '' : TONE_MODIFIERS[tone];
  const tail = variant === 'neutral' ? '' : GLYPHS[variant][frame].slice(base.length);
  return base + toneModifier + tail;
}

/** Every (variant, tone, frame) picture, composed once at module load (FR-005). */
const TONED_GLYPHS: Readonly<Record<PersonVariant, Readonly<Record<PersonTone, Readonly<Record<PersonFrame, string>>>>>> =
  (() => {
    const toned = {} as Record<PersonVariant, Record<PersonTone, Record<PersonFrame, string>>>;
    for (const variant of VARIANTS) {
      const byTone = {} as Record<PersonTone, Record<PersonFrame, string>>;
      for (const tone of ['default', ...MODIFIER_TONES] as const) {
        const byFrame = {} as Record<PersonFrame, string>;
        for (const frame of FRAMES) byFrame[frame] = composePicture(variant, tone, frame);
        byTone[tone] = byFrame;
      }
      toned[variant] = byTone;
    }
    return toned;
  })();

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
 * True iff `tonedGlyph` renders as one figure relative to `baselineWidth` — the already-resolved
 * untoned width for that same (variant, frame) — mirroring isGenderedGlyphOk's shape (FR-010,
 * FR-011). Takes the baseline as a number rather than re-measuring a neutral glyph each time, so
 * callers can measure each frame's baseline once and reuse it across all five modifier tones.
 */
function isToneGlyphOk(probe: GlyphProbeInputs, tonedGlyph: string, baselineWidth: number): boolean {
  if (!safeCanRender(probe, tonedGlyph)) return false;
  const tonedWidth = safeMeasureWidth(probe, tonedGlyph);
  if (!Number.isFinite(tonedWidth) || !Number.isFinite(baselineWidth) || baselineWidth <= 0) return false;
  return tonedWidth <= baselineWidth * SPLIT_WIDTH_RATIO;
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

  // Rung 4 (tone): for each drawable variant, standing is only actually drawn separately from
  // walking when rung 2 didn't already collapse it — checking a variant's toned stander when its
  // own untoned stander is unprobed/unavailable would wrongly disqualify a tone over a picture
  // nothing ever draws (FR-012, research.md §3).
  function distinctFrames(variant: PersonVariant): readonly PersonFrame[] {
    return pictures[variant].standing === pictures[variant].walking ? ['walking', 'running'] : FRAMES;
  }

  const untonedFrameWidths = {} as Record<PersonVariant, Partial<Record<PersonFrame, number>>>;
  for (const variant of drawableVariants) {
    const widths: Partial<Record<PersonFrame, number>> = {};
    for (const frame of distinctFrames(variant)) widths[frame] = safeMeasureWidth(probe, pictures[variant][frame]);
    untonedFrameWidths[variant] = widths;
  }

  const usableTones: PersonTone[] = [];
  for (const tone of MODIFIER_TONES) {
    let toneOk = true;
    for (const variant of drawableVariants) {
      for (const frame of distinctFrames(variant)) {
        if (!isToneGlyphOk(probe, TONED_GLYPHS[variant][tone][frame], untonedFrameWidths[variant][frame]!)) {
          toneOk = false;
        }
      }
    }
    if (toneOk) usableTones.push(tone);
  }
  const drawableTones: readonly PersonTone[] = ['default', ...usableTones];

  // Builds the widened, tone-keyed pictures table: a drawable tone gets its own (possibly
  // rung-2-collapsed) composed row; a non-drawable tone falls back wholesale to the variant's
  // already-resolved untoned row (FR-017) — a value copy made once here, never a per-draw branch.
  const tonedPictures = {} as Record<PersonVariant, Record<PersonTone, Readonly<Record<PersonFrame, string>>>>;
  for (const variant of VARIANTS) {
    const collapsed = pictures[variant].standing === pictures[variant].walking;
    const rows = {} as Record<PersonTone, Readonly<Record<PersonFrame, string>>>;
    rows.default = pictures[variant];
    for (const tone of MODIFIER_TONES) {
      rows[tone] = drawableTones.includes(tone)
        ? {
            standing: collapsed ? TONED_GLYPHS[variant][tone].walking : TONED_GLYPHS[variant][tone].standing,
            walking: TONED_GLYPHS[variant][tone].walking,
            running: TONED_GLYPHS[variant][tone].running,
          }
        : pictures[variant];
    }
    tonedPictures[variant] = rows;
  }

  return {
    drawableVariants,
    drawableTones,
    pictures: tonedPictures,
    canRunPicture,
    toolbarGlyph: tonedPictures.neutral.default.standing,
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
