/** Returns an integer shade byte in 1-255, never 0. */
export function randomShade(): number {
  return 1 + Math.floor(Math.random() * 255);
}
