/** Returns an integer shade byte in 1-255, never 0. */
export function randomShade(): number {
  return 1 + Math.floor(Math.random() * 255);
}

/** Returns an integer burn life in [30, 60] inclusive. */
export function randomBurnLife(): number {
  return 30 + Math.floor(Math.random() * 31);
}

/** Returns an integer hue in [0, 256). */
export function randomHue(): number {
  return Math.floor(Math.random() * 256);
}
