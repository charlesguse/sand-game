<script lang="ts">
  import { onMount } from 'svelte';
  import { GRID_WIDTH, GRID_HEIGHT, BRUSH_RADII, OBJECT_FOOTPRINT_SIZE, computeCanvasSize } from './layout';
  import { createGrid, clearGrid as clearGridState } from '../sim/grid';
  import { step } from '../sim/step';
  import { applyBrush, applyBrushLine } from '../sim/brush';
  import { randomShade } from '../sim/shade';
  import {
    createObjectsState,
    placeObject,
    applyRainbowConversions,
    isUnicornTouched,
    eraseObjectsInBrush,
    eraseObjectsInBrushLine,
    clearObjects,
  } from '../sim/objects';
  import {
    type Particle,
    PARTICLE_LIFETIME_MS,
    spawnBurst,
    spawnIdleSparkle,
    tickParticles,
  } from './particles';
  import { EMPTY, SAND, WATER, DIRT, RAINBOW_SAND, OBJECT, type Tool, type BrushSize } from '../sim/types';

  interface Props {
    tool: Tool;
    brushSize: BrushSize;
  }

  let { tool, brushSize }: Props = $props();

  const grid = createGrid(GRID_WIDTH, GRID_HEIGHT);
  const objectsState = createObjectsState();
  const particles: Particle[] = [];

  const OBJECT_GLYPHS: Record<string, string> = { rainbow: '🌈', unicorn: '🦄' };

  const BURST_COOLDOWN_MS = 2000;
  const IDLE_INTERVAL_MS = 5000;
  const unicornTimers = new Map<number, { lastBurstAt: number; lastIdleAt: number }>();

  let container: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let imageData: ImageData;
  let drawing = false;
  let lastGridPos: { x: number; y: number } | null = null;
  let displayWidth = $state(GRID_WIDTH);
  let displayHeight = $state(GRID_HEIGHT);

  function resize(): void {
    const { width, height } = computeCanvasSize(container.clientWidth, container.clientHeight);
    displayWidth = width;
    displayHeight = height;
  }

  // Pink ramp: 8 hand-picked shades from pale to hot pink, indexed by shades[i] % length.
  const PINK_RAMP: [number, number, number][] = [
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
  const BLUE_RAMP: [number, number, number][] = [
    [173, 216, 240],
    [130, 190, 235],
    [90, 165, 230],
    [55, 140, 220],
    [30, 110, 205],
    [15, 80, 180],
  ];

  // Purple ramp: 8 shades from pale lavender to deep magic purple, indexed by shades[i] % length.
  const PURPLE_RAMP: [number, number, number][] = [
    [230, 200, 255],
    [210, 170, 250],
    [190, 140, 245],
    [165, 105, 235],
    [140, 75, 220],
    [115, 50, 200],
    [95, 30, 180],
    [75, 15, 155],
  ];

  // Converts a 0-360 hue angle at fixed saturation/lightness to RGB, for a continuous rainbow spread.
  function hslToRgb(h: number, s: number, l: number): [number, number, number] {
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

  function colorFor(element: number, shade: number, hue: number): [number, number, number] {
    if (element === SAND) return PINK_RAMP[shade % PINK_RAMP.length];
    if (element === WATER) return BLUE_RAMP[shade % BLUE_RAMP.length];
    if (element === DIRT) return PURPLE_RAMP[shade % PURPLE_RAMP.length];
    if (element === RAINBOW_SAND) return hslToRgb((hue / 255) * 360, 0.85, 0.6);
    return [255, 255, 255];
  }

  function drawObjectGlyph(obj: { kind: string; x: number; y: number; size: number }): void {
    ctx.font = `${obj.size}px sans-serif`;
    ctx.fillText(OBJECT_GLYPHS[obj.kind], obj.x + obj.size / 2, obj.y + obj.size / 2);
  }

  function render(): void {
    const { width, height, elements, shades, hues } = grid;
    const data = imageData.data;
    for (let i = 0; i < width * height; i++) {
      const element = elements[i];
      const o = i * 4;
      if (element === EMPTY || element === OBJECT) {
        data[o] = 255;
        data[o + 1] = 255;
        data[o + 2] = 255;
        data[o + 3] = 255;
        continue;
      }
      const [r, g, b] = colorFor(element, shades[i], hues[i]);
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const obj of objectsState.rainbows) drawObjectGlyph(obj);
    for (const obj of objectsState.unicorns) drawObjectGlyph(obj);

    ctx.font = `${OBJECT_FOOTPRINT_SIZE / 3}px sans-serif`;
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, 1 - (lastFrameNow - p.spawnedAt) / PARTICLE_LIFETIME_MS);
      ctx.fillText(p.glyph, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  function updateUnicorns(now: number): void {
    const liveIds = new Set(objectsState.unicorns.map((u) => u.id));
    for (const id of unicornTimers.keys()) {
      if (!liveIds.has(id)) unicornTimers.delete(id);
    }

    for (const unicorn of objectsState.unicorns) {
      const atX = unicorn.x + unicorn.size / 2;
      const atY = unicorn.y + unicorn.size / 2;
      const timers = unicornTimers.get(unicorn.id) ?? { lastBurstAt: -Infinity, lastIdleAt: now };

      if (isUnicornTouched(grid, unicorn) && now - timers.lastBurstAt >= BURST_COOLDOWN_MS) {
        spawnBurst(particles, atX, atY, now);
        timers.lastBurstAt = now;
      }
      if (now - timers.lastIdleAt >= IDLE_INTERVAL_MS) {
        spawnIdleSparkle(particles, atX, atY, now);
        timers.lastIdleAt = now;
      }

      unicornTimers.set(unicorn.id, timers);
    }
  }

  let lastFrameNow = 0;

  function frame(now: number): void {
    lastFrameNow = now;
    step(grid);
    applyRainbowConversions(grid, objectsState.rainbows);
    updateUnicorns(now);
    tickParticles(particles, now);
    render();
    requestAnimationFrame(frame);
  }

  function clientToGrid(clientX: number, clientY: number): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const scaleX = GRID_WIDTH / rect.width;
    const scaleY = GRID_HEIGHT / rect.height;
    return {
      x: Math.floor((clientX - rect.left) * scaleX),
      y: Math.floor((clientY - rect.top) * scaleY),
    };
  }

  function paintAt(pos: { x: number; y: number }): void {
    const radius = BRUSH_RADII[brushSize];
    const shade = randomShade();
    if (tool === 'eraser') {
      if (lastGridPos) {
        eraseObjectsInBrushLine(grid, objectsState, lastGridPos, pos, radius);
      } else {
        eraseObjectsInBrush(grid, objectsState, pos.x, pos.y, radius);
      }
    }
    if (lastGridPos) {
      applyBrushLine(grid, tool, lastGridPos, pos, radius, shade);
    } else {
      applyBrush(grid, tool, pos.x, pos.y, radius, shade);
    }
    lastGridPos = pos;
  }

  function handlePointerDown(event: PointerEvent): void {
    const pos = clientToGrid(event.clientX, event.clientY);
    if (tool === 'rainbow' || tool === 'unicorn') {
      placeObject(grid, objectsState, tool, pos.x, pos.y);
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    drawing = true;
    lastGridPos = null;
    paintAt(pos);
    canvas.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!drawing) return;
    paintAt(clientToGrid(event.clientX, event.clientY));
  }

  function handlePointerUp(): void {
    drawing = false;
    lastGridPos = null;
  }

  export function clearAll(): void {
    clearGridState(grid);
    clearObjects(objectsState);
    particles.length = 0;
  }

  onMount(() => {
    ctx = canvas.getContext('2d')!;
    imageData = ctx.createImageData(GRID_WIDTH, GRID_HEIGHT);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    requestAnimationFrame(frame);
    return () => observer.disconnect();
  });
</script>

<div bind:this={container} class="play-area-container">
  <canvas
    bind:this={canvas}
    width={GRID_WIDTH}
    height={GRID_HEIGHT}
    style="width: {displayWidth}px; height: {displayHeight}px;"
    class="play-area"
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerUp}
  ></canvas>
</div>

<style>
  .play-area-container {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
  }

  .play-area {
    display: block;
    image-rendering: pixelated;
    touch-action: none;
  }
</style>
