import { SAND, WATER, DIRT, RAINBOW_SAND, GRASS } from './types';

export function isPowder(e: number): boolean {
  return e === SAND || e === DIRT || e === RAINBOW_SAND;
}

export function isLiquid(e: number): boolean {
  return e === WATER;
}

export function isSolid(e: number): boolean {
  return isPowder(e) || e === GRASS;
}
