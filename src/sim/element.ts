import { SAND, WATER, DIRT, RAINBOW_SAND } from './types';

export function isPowder(e: number): boolean {
  return e === SAND || e === DIRT || e === RAINBOW_SAND;
}

export function isLiquid(e: number): boolean {
  return e === WATER;
}
