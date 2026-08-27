<script lang="ts">
  import { onMount } from 'svelte';
  import {
    BRUSH_RADII,
    OBJECT_FOOTPRINT_SIZE,
    RESIZE_SETTLE_MS,
    isPhoneSized,
    computePlayField,
  } from './layout';
  import { createGrid, clearGrid as clearGridState } from '../sim/grid';
  import { resizeGrid } from '../sim/resize';
  import { loadScene as loadSceneState } from '../sim/scenes';
  import { HistoryManager } from '../sim/history';
  import { step } from '../sim/step';
  import { applyBrush, applyBrushLine } from '../sim/brush';
  import { applyWand, applyWandLine, unicornsTouchedByWandLine } from '../sim/wand';
  import { createFlashMask, updateFlashMask } from './sparkle';
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
  import {
    EMPTY,
    SAND,
    WATER,
    DIRT,
    RAINBOW_SAND,
    OBJECT,
    GRASS,
    STAR_POWER,
    FOG,
    type Grid,
    type PlacedObject,
    type Tool,
    type BrushSize,
    type SceneId,
  } from '../sim/types';

  interface Props {
    tool: Tool;
    brushSize: BrushSize;
    onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  }

  let { tool, brushSize, onHistoryChange }: Props = $props();

  const objectsState = createObjectsState();
  const history = new HistoryManager();
  const particles: Particle[] = [];

  const OBJECT_GLYPHS: Record<string, string> = { rainbow: '🌈', unicorn: '🦄' };

  const BURST_COOLDOWN_MS = 2000;
  const IDLE_INTERVAL_MS = 5000;
  const WAND_BURST_COOLDOWN_MS = 2000;
  const WAND_BURST_COUNT = 18; // 3x the ordinary touch celebration's burst size
  const unicornTimers = new Map<
    number,
    { lastBurstAt: number; lastIdleAt: number; lastWandBurstAt: number }
  >();

  let container: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let grid: Grid;
  let imageData: ImageData;
  let flashMask: Uint8Array;
  let drawing = false;
  let lastGridPos: { x: number; y: number } | null = null;
  let displayWidth = $state(0);
  let displayHeight = $state(0);

  function measureField() {
    const viewportW = window.visualViewport?.width ?? window.innerWidth;
    const viewportH = window.visualViewport?.height ?? window.innerHeight;
    const isPhone = isPhoneSized(viewportW, viewportH);
    return computePlayField(container.clientWidth, container.clientHeight, isPhone);
  }

  // Repositions obj by (offsetX, offsetY), re-stamping its OBJECT footprint into newGrid only if
  // the entire offset footprint fits; drops it from the returned list otherwise (never clipped).
  function repositionObjects(
    list: PlacedObject[],
    newGrid: Grid,
    offsetX: number,
    offsetY: number,
  ): PlacedObject[] {
    const kept: PlacedObject[] = [];
    for (const obj of list) {
      const x = obj.x + offsetX;
      const y = obj.y + offsetY;
      if (x < 0 || x + obj.size > newGrid.width || y < 0 || y + obj.size > newGrid.height) continue;
      for (let py = y; py < y + obj.size; py++) {
        for (let px = x; px < x + obj.size; px++) {
          newGrid.elements[py * newGrid.width + px] = OBJECT;
        }
      }
      kept.push({ ...obj, x, y });
    }
    return kept;
  }

  function resize(): void {
    const field = measureField();

    if (field.gridWidth === grid.width && field.gridHeight === grid.height) {
      // Not a re-derivation (FR-025): only the canvas's CSS display size changes.
      displayWidth = field.displayWidth;
      displayHeight = field.displayHeight;
      return;
    }

    // Re-derivation (FR-026): swap to a freshly resized grid, carrying content at a fixed
    // bottom-centre-anchored offset.
    const { grid: newGrid, offsetX, offsetY } = resizeGrid(grid, field.gridWidth, field.gridHeight);
    objectsState.rainbows = repositionObjects(objectsState.rainbows, newGrid, offsetX, offsetY);
    objectsState.unicorns = repositionObjects(objectsState.unicorns, newGrid, offsetX, offsetY);

    grid = newGrid;
    canvas.width = grid.width;
    canvas.height = grid.height;
    imageData = ctx.createImageData(grid.width, grid.height);
    flashMask = createFlashMask(grid.width, grid.height);
    displayWidth = field.displayWidth;
    displayHeight = field.displayHeight;

    if (drawing) {
      // End any in-progress stroke cleanly rather than continuing it across the swap (FR-028).
      drawing = false;
      lastGridPos = null;
    }

    // The old history's WorldStates are sized to the old grid — discard both (FR-022).
    history.reset();
    onHistoryChange?.(history.canUndo(), history.canRedo());
  }

  let resizeTimer: ReturnType<typeof setTimeout> | undefined;

  function scheduleResize(): void {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, RESIZE_SETTLE_MS);
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

  // Green ramp: 8 shades from pale spring green to deep grass green, indexed by shades[i] % length.
  const GREEN_RAMP: [number, number, number][] = [
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
  const GOLD_RAMP: [number, number, number][] = [
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
  const FOG_RAMP: [number, number, number][] = [
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
  const CLOUD_RAMP: [number, number, number][] = [
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

  function colorFor(
    element: number,
    shade: number,
    hue: number,
    isCloud: boolean,
  ): [number, number, number] {
    if (element === SAND) return PINK_RAMP[shade % PINK_RAMP.length];
    if (element === WATER) return BLUE_RAMP[shade % BLUE_RAMP.length];
    if (element === DIRT) return PURPLE_RAMP[shade % PURPLE_RAMP.length];
    if (element === RAINBOW_SAND) return hslToRgb((hue / 255) * 360, 0.85, 0.6);
    if (element === GRASS) return GREEN_RAMP[shade % GREEN_RAMP.length];
    if (element === STAR_POWER) return GOLD_RAMP[shade % GOLD_RAMP.length];
    if (element === FOG) return isCloud ? CLOUD_RAMP[shade % CLOUD_RAMP.length] : FOG_RAMP[shade % FOG_RAMP.length];
    return [255, 255, 255];
  }

  function drawObjectGlyph(obj: { kind: string; x: number; y: number; size: number }): void {
    ctx.font = `${obj.size}px sans-serif`;
    ctx.fillText(OBJECT_GLYPHS[obj.kind], obj.x + obj.size / 2, obj.y + obj.size / 2);
  }

  function render(): void {
    const { width, height, elements, shades, hues, glitter, cloud } = grid;
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
      let [r, g, b] = colorFor(element, shades[i], hues[i], cloud[i] === 1);
      if (glitter[i] === 1) {
        const shimmer = Math.sin(lastFrameNow * 0.006 + i) * 20;
        r = Math.max(0, Math.min(255, r + shimmer));
        g = Math.max(0, Math.min(255, g + shimmer));
        b = Math.max(0, Math.min(255, b + shimmer));
        if (flashMask[i] === 1) {
          r = Math.min(255, r + 60);
          g = Math.min(255, g + 60);
          b = Math.min(255, b + 60);
        }
      }
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
      const timers = unicornTimers.get(unicorn.id) ?? {
        lastBurstAt: -Infinity,
        lastIdleAt: now,
        lastWandBurstAt: -Infinity,
      };

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
    updateFlashMask(grid, flashMask);
    render();
    requestAnimationFrame(frame);
  }

  function clientToGrid(clientX: number, clientY: number): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const scaleX = grid.width / rect.width;
    const scaleY = grid.height / rect.height;
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
    if (tool === 'wand') {
      const from = lastGridPos ?? pos;
      if (lastGridPos) {
        applyWandLine(grid, lastGridPos, pos, radius);
      } else {
        applyWand(grid, pos.x, pos.y, radius);
      }
      const now = performance.now();
      for (const unicorn of unicornsTouchedByWandLine(objectsState, from, pos, radius)) {
        const timers = unicornTimers.get(unicorn.id) ?? {
          lastBurstAt: -Infinity,
          lastIdleAt: now,
          lastWandBurstAt: -Infinity,
        };
        if (now - timers.lastWandBurstAt >= WAND_BURST_COOLDOWN_MS) {
          const atX = unicorn.x + unicorn.size / 2;
          const atY = unicorn.y + unicorn.size / 2;
          spawnBurst(particles, atX, atY, now, WAND_BURST_COUNT);
          timers.lastWandBurstAt = now;
        }
        unicornTimers.set(unicorn.id, timers);
      }
    } else if (lastGridPos) {
      applyBrushLine(grid, tool, lastGridPos, pos, radius, shade);
    } else {
      applyBrush(grid, tool, pos.x, pos.y, radius, shade);
    }
    lastGridPos = pos;
  }

  function handlePointerDown(event: PointerEvent): void {
    if (drawing) handlePointerUp();
    const pos = clientToGrid(event.clientX, event.clientY);
    if (tool === 'rainbow' || tool === 'unicorn') {
      history.beginAction(grid, objectsState);
      placeObject(grid, objectsState, tool, pos.x, pos.y);
      history.commitAction(grid, objectsState);
      onHistoryChange?.(history.canUndo(), history.canRedo());
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    history.beginAction(grid, objectsState);
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
    history.commitAction(grid, objectsState);
    onHistoryChange?.(history.canUndo(), history.canRedo());
  }

  export function clearAll(): void {
    if (drawing) handlePointerUp();
    history.beginAction(grid, objectsState);
    clearGridState(grid);
    clearObjects(objectsState);
    particles.length = 0;
    history.commitAction(grid, objectsState);
    onHistoryChange?.(history.canUndo(), history.canRedo());
  }

  export function loadScene(sceneId: SceneId): void {
    if (drawing) handlePointerUp();
    history.beginAction(grid, objectsState);
    loadSceneState(sceneId, grid, objectsState);
    particles.length = 0;
    history.commitAction(grid, objectsState);
    onHistoryChange?.(history.canUndo(), history.canRedo());
  }

  export function undo(): void {
    if (drawing) handlePointerUp();
    if (history.undo(grid, objectsState)) {
      onHistoryChange?.(history.canUndo(), history.canRedo());
    }
  }

  export function redo(): void {
    if (drawing) handlePointerUp();
    if (history.redo(grid, objectsState)) {
      onHistoryChange?.(history.canUndo(), history.canRedo());
    }
  }

  onMount(() => {
    ctx = canvas.getContext('2d')!;
    const field = measureField();
    grid = createGrid(field.gridWidth, field.gridHeight);
    canvas.width = grid.width;
    canvas.height = grid.height;
    imageData = ctx.createImageData(grid.width, grid.height);
    flashMask = createFlashMask(grid.width, grid.height);
    displayWidth = field.displayWidth;
    displayHeight = field.displayHeight;
    const observer = new ResizeObserver(scheduleResize);
    observer.observe(container);
    window.visualViewport?.addEventListener('resize', scheduleResize);
    window.addEventListener('orientationchange', scheduleResize);
    requestAnimationFrame(frame);
    return () => {
      clearTimeout(resizeTimer);
      observer.disconnect();
      window.visualViewport?.removeEventListener('resize', scheduleResize);
      window.removeEventListener('orientationchange', scheduleResize);
    };
  });
</script>

<div bind:this={container} class="play-area-container">
  <canvas
    bind:this={canvas}
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
    background: linear-gradient(180deg, #ffffff 55%, #fbf1f9);
  }

  .play-area {
    display: block;
    image-rendering: pixelated;
    touch-action: none;
    box-shadow: 0 6px 24px rgba(90, 61, 102, 0.1);
  }
</style>
