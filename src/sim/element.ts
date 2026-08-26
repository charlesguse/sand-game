import { SAND, WATER, DIRT } from './types';

export function isPowder(e: number): boolean {
  return e === SAND || e === DIRT;
}

export function isLiquid(e: number): boolean {
  return e === WATER;
}
