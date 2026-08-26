export interface Particle {
  glyph: '✨' | '💖' | '🎉';
  x: number;
  y: number;
  spawnedAt: number;
}

export const PARTICLE_LIFETIME_MS = 1200;
const DRIFT_SPEED_PX_PER_MS = 0.03;
const MAX_PARTICLES = 60;
const BURST_COUNT = 6;

let lastTickNow: number | null = null;

function spawn(particles: Particle[], glyph: '✨' | '💖' | '🎉', atX: number, atY: number, now: number): void {
  if (particles.length >= MAX_PARTICLES) {
    particles.shift();
  }
  const jitterX = (Math.random() - 0.5) * 20;
  particles.push({ glyph, x: atX + jitterX, y: atY, spawnedAt: now });
}

const BURST_GLYPHS: Array<'✨' | '💖' | '🎉'> = ['✨', '💖', '🎉'];

/** Spawns a small celebration burst of sparkle/heart/party glyphs. */
export function spawnBurst(
  particles: Particle[],
  atX: number,
  atY: number,
  now: number,
  count: number = BURST_COUNT,
): void {
  for (let i = 0; i < count; i++) {
    spawn(particles, BURST_GLYPHS[Math.floor(Math.random() * BURST_GLYPHS.length)], atX, atY, now);
  }
}

/** Spawns a single idle sparkle glyph. */
export function spawnIdleSparkle(particles: Particle[], atX: number, atY: number, now: number): void {
  spawn(particles, '✨', atX, atY, now);
}

/** Advances every particle's position, drops expired ones, and enforces the cap in place. */
export function tickParticles(particles: Particle[], now: number): void {
  const delta = lastTickNow === null ? 0 : now - lastTickNow;
  lastTickNow = now;

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (now - p.spawnedAt >= PARTICLE_LIFETIME_MS) {
      particles.splice(i, 1);
      continue;
    }
    p.y -= DRIFT_SPEED_PX_PER_MS * delta;
  }
}
