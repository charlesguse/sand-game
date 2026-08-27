import { SAND, WATER, DIRT, RAINBOW_SAND, GRASS, STAR_POWER } from './types';

export function isPowder(e: number): boolean {
  return e === SAND || e === DIRT || e === RAINBOW_SAND;
}

export function isLiquid(e: number): boolean {
  return e === WATER;
}

export function isSolid(e: number): boolean {
  return isPowder(e) || e === GRASS || e === STAR_POWER;
}
