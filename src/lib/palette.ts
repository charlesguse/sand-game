import { SAND, WATER, DIRT, RAINBOW_SAND, GRASS, STAR_POWER, FOG } from '../sim/types';

export type Rgb = [number, number, number];

// Pink ramp: 8 hand-picked shades from pale to hot pink, indexed by shades[i] % length.
const PINK_RAMP: Rgb[] = [
  [255, 214, 232],
  [255, 192, 219],
  [255, 168, 205],
  [255, 145, 191],
  [255, 105, 180],
  [255, 80, 165],
  [244, 63, 148],
  [219, 39, 119],
];

// Blue ramp: 6 shades from pale sky to deep ocean, indexed by shades[i] % length.
const BLUE_RAMP: Rgb[] = [
  [173, 216, 240],
  [130, 190, 235],
  [90, 165, 230],
  [55, 140, 220],
  [30, 110, 205],
  [15, 80, 180],
];

// Purple ramp: 8 shades from pale lavender to deep magic purple, indexed by shades[i] % length.
const PURPLE_RAMP: Rgb[] = [
  [230, 200, 255],
  [210, 170, 250],
  [190, 140, 245],
  [165, 105, 235],
  [140, 75, 220],
  [115, 50, 200],
  [95, 30, 180],
  [75, 15, 155],
];

// Green ramp: 8 shades from pale spring green to deep grass green, indexed by shades[i] % length.
const GREEN_RAMP: Rgb[] = [
  [200, 240, 180],
  [170, 225, 145],
  [140, 210, 110],
  [110, 195, 85],
  [85, 175, 65],
  [60, 155, 50],
  [40, 130, 40],
  [25, 105, 30],
];

// Gold ramp: 8 shades from pale yellow to warm gold, indexed by shades[i] % length.
const GOLD_RAMP: Rgb[] = [
  [255, 250, 210],
  [255, 244, 180],
  [255, 235, 140],
  [255, 223, 100],
  [255, 208, 70],
  [250, 190, 50],
  [235, 170, 30],
  [210, 145, 15],
];

// Fog ramp: 8 pale pearly/lavender shades for rising sparkle-mist, indexed by shades[i] % length.
const FOG_RAMP: Rgb[] = [
  [250, 248, 255],
  [244, 240, 252],
  [238, 232, 250],
  [230, 222, 248],
  [222, 212, 245],
  [214, 202, 242],
  [206, 194, 238],
  [198, 186, 235],
];

// Cloud ramp: 8 brighter, higher-lightness off-whites for gathered cloud, indexed by shades[i] % length.
const CLOUD_RAMP: Rgb[] = [
  [255, 255, 255],
  [253, 253, 252],
  [251, 251, 249],
  [249, 249, 246],
  [247, 246, 243],
  [245, 244, 240],
  [243, 242, 238],
  [241, 240, 236],
];

// Converts a 0-360 hue angle at fixed saturation/lightness to RGB, for a continuous rainbow spread.
export function hslToRgb(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hh = h / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 1) [r, g, b] = [c, x, 0];
  else if (hh < 2) [r, g, b] = [x, c, 0];
  else if (hh < 3) [r, g, b] = [0, c, x];
  else if (hh < 4) [r, g, b] = [0, x, c];
  else if (hh < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

export function colorFor(element: number, shade: number, hue: number, isCloud: boolean): Rgb {
  if (element === SAND) return PINK_RAMP[shade % PINK_RAMP.length];
  if (element === WATER) return BLUE_RAMP[shade % BLUE_RAMP.length];
  if (element === DIRT) return PURPLE_RAMP[shade % PURPLE_RAMP.length];
  if (element === RAINBOW_SAND) return hslToRgb((hue / 255) * 360, 0.85, 0.6);
  if (element === GRASS) return GREEN_RAMP[shade % GREEN_RAMP.length];
  if (element === STAR_POWER) return GOLD_RAMP[shade % GOLD_RAMP.length];
  if (element === FOG) return isCloud ? CLOUD_RAMP[shade % CLOUD_RAMP.length] : FOG_RAMP[shade % FOG_RAMP.length];
  return [255, 255, 255];
}
