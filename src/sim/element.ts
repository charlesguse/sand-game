import { SAND, WATER, DIRT, RAINBOW_SAND, GRASS, STAR_POWER, GUMDROP, FLOWER } from './types';

export function isPowder(e: number): boolean {
  return e === SAND || e === DIRT || e === RAINBOW_SAND;
}

export function isLiquid(e: number): boolean {
  return e === WATER;
}

export function isSolid(e: number): boolean {
  return isPowder(e) || e === GRASS || e === STAR_POWER || e === GUMDROP || e === FLOWER;
}

/**
 * The elements whose colour comes from `hues` rather than `shades`. History and the save codec
 * pack both into one colorAux array keyed on exactly this predicate — every new hue-coloured
 * element MUST be added here (and to the test-local visibleSnapshot in history.test.ts), or its
 * colour is silently lost across undo/redo and restore. This predicate exists because that bug
 * has shipped once already, when the ternaries were spelled out longhand at each site.
 */
export function usesHueColor(e: number): boolean {
  return e === RAINBOW_SAND || e === GUMDROP || e === FLOWER;
}
