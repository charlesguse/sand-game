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
    OBJECT_KINDS,
  } from '../sim/objects';
  import { createPetsState, addPoodle, stepPets, clearPets, repositionPoodles } from '../sim/pets';
  import {
    type Particle,
    PARTICLE_LIFETIME_MS,
    spawnBurst,
    spawnIdleSparkle,
    tickParticles,
  } from './particles';
  import {
    EMPTY,
    OBJECT,
    type Grid,
    type ObjectKind,
    type PlacedObject,
    type Tool,
    type BrushSize,
    type SceneId,
  } from '../sim/types';
  import { colorFor } from './palette';

  interface Props {
    tool: Tool;
    brushSize: BrushSize;
    onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  }

  let { tool, brushSize, onHistoryChange }: Props = $props();

  const objectsState = createObjectsState();
  const petsState = createPetsState();
  let poodleTarget: { x: number; y: number } | null = null;
  const history = new HistoryManager();
  const particles: Particle[] = [];

  const OBJECT_GLYPHS: Record<ObjectKind, string> = {
    rainbow: '🌈',
    unicorn: '🦄',
    palm: '🌴',
    flamingo: '🦩',
  };
  const PALM_SWAY_RADIANS = 0.06;
  const PALM_SWAY_SPEED = 0.0011;
  const FLAMINGO_BOB_SPEED = 0.0016;
  const FLAMINGO_BOB_PIXELS = 2.5;

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
    for (const kind of OBJECT_KINDS) {
      objectsState.byKind[kind] = repositionObjects(objectsState.byKind[kind], newGrid, offsetX, offsetY);
    }
    repositionPoodles(petsState.poodles, newGrid, offsetX, offsetY);

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

  function drawObjectGlyph(obj: PlacedObject): void {
    ctx.font = `${obj.size}px sans-serif`;
    const cx = obj.x + obj.size / 2;
    const cy = obj.y + obj.size / 2;

    if (obj.kind === 'flamingo') {
      const bob = Math.sin(lastFrameNow * FLAMINGO_BOB_SPEED + obj.id) * FLAMINGO_BOB_PIXELS;
      ctx.fillText(OBJECT_GLYPHS[obj.kind], cx, cy + bob);
      return;
    }

    if (obj.kind !== 'palm') {
      ctx.fillText(OBJECT_GLYPHS[obj.kind], cx, cy);
      return;
    }

    const baseY = obj.y + obj.size;
    const angle = Math.sin(lastFrameNow * PALM_SWAY_SPEED + obj.id) * PALM_SWAY_RADIANS;
    ctx.save();
    ctx.translate(cx, baseY);
    ctx.rotate(angle);
    ctx.fillText(OBJECT_GLYPHS[obj.kind], 0, cy - baseY);
    ctx.restore();
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
    for (const kind of OBJECT_KINDS) {
      for (const obj of objectsState.byKind[kind]) drawObjectGlyph(obj);
    }

    ctx.font = `${OBJECT_FOOTPRINT_SIZE}px sans-serif`;
    for (const poodle of petsState.poodles) {
      if (poodle.state === 'eating') {
        spawnBurst(particles, poodle.x, poodle.y, lastFrameNow, 4);
      } else if (poodle.state === 'shaking') {
        spawnBurst(particles, poodle.x, poodle.y, lastFrameNow, 2);
      } else if (poodle.state === 'trotting' && Math.random() < 0.08) {
        spawnIdleSparkle(particles, poodle.x, poodle.y, lastFrameNow);
      }

      ctx.save();
      ctx.translate(poodle.x, poodle.y);
      if (poodle.facing === -1) ctx.scale(-1, 1);
      ctx.fillText('🐩', 0, 0);
      ctx.restore();
    }

    ctx.font = `${OBJECT_FOOTPRINT_SIZE / 3}px sans-serif`;
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, 1 - (lastFrameNow - p.spawnedAt) / PARTICLE_LIFETIME_MS);
      ctx.fillText(p.glyph, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  function updateUnicorns(now: number): void {
    const liveIds = new Set(objectsState.byKind.unicorn.map((u) => u.id));
    for (const id of unicornTimers.keys()) {
      if (!liveIds.has(id)) unicornTimers.delete(id);
    }

    for (const unicorn of objectsState.byKind.unicorn) {
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
    stepPets(grid, petsState, poodleTarget);
    applyRainbowConversions(grid, objectsState.byKind.rainbow);
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
    poodleTarget = pos;
    if (tool === 'poodle') {
      addPoodle(petsState, pos.x, pos.y);
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    if (tool === 'rainbow' || tool === 'unicorn' || tool === 'palm' || tool === 'flamingo') {
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
    const pos = clientToGrid(event.clientX, event.clientY);
    poodleTarget = pos;
    if (!drawing) return;
    paintAt(pos);
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
    clearPets(petsState);
    particles.length = 0;
    history.commitAction(grid, objectsState);
    onHistoryChange?.(history.canUndo(), history.canRedo());
  }

  export function loadScene(sceneId: SceneId): void {
    if (drawing) handlePointerUp();
    history.beginAction(grid, objectsState);
    loadSceneState(sceneId, grid, objectsState);
    clearPets(petsState);
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
