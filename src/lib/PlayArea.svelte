<script lang="ts">
  import { onMount } from 'svelte';
  import { GRID_WIDTH, GRID_HEIGHT, BRUSH_RADII, computeCanvasSize } from './layout';
  import { createGrid, clearGrid as clearGridState } from '../sim/grid';
  import { step } from '../sim/step';
  import { applyBrush, applyBrushLine } from '../sim/brush';
  import { randomShade } from '../sim/shade';
  import { EMPTY, SAND, WATER, DIRT, type Tool, type BrushSize } from '../sim/types';

  interface Props {
    tool: Tool;
    brushSize: BrushSize;
  }

  let { tool, brushSize }: Props = $props();

  const grid = createGrid(GRID_WIDTH, GRID_HEIGHT);

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

  function colorFor(element: number, shade: number): [number, number, number] {
    if (element === SAND) return PINK_RAMP[shade % PINK_RAMP.length];
    if (element === WATER) return BLUE_RAMP[shade % BLUE_RAMP.length];
    if (element === DIRT) return PURPLE_RAMP[shade % PURPLE_RAMP.length];
    return [255, 255, 255];
  }

  function render(): void {
    const { width, height, elements, shades } = grid;
    const data = imageData.data;
    for (let i = 0; i < width * height; i++) {
      const element = elements[i];
      const o = i * 4;
      if (element === EMPTY) {
        data[o] = 255;
        data[o + 1] = 255;
        data[o + 2] = 255;
        data[o + 3] = 255;
        continue;
      }
      const [r, g, b] = colorFor(element, shades[i]);
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
  }

  function frame(): void {
    step(grid);
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
    if (lastGridPos) {
      applyBrushLine(grid, tool, lastGridPos, pos, radius, shade);
    } else {
      applyBrush(grid, tool, pos.x, pos.y, radius, shade);
    }
    lastGridPos = pos;
  }

  function handlePointerDown(event: PointerEvent): void {
    drawing = true;
    lastGridPos = null;
    paintAt(clientToGrid(event.clientX, event.clientY));
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
