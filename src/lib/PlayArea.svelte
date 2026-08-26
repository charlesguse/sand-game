<script lang="ts">
  import { onMount } from 'svelte';
  import { GRID_WIDTH, GRID_HEIGHT, BRUSH_RADII } from './layout';
  import { createGrid, clearGrid as clearGridState } from '../sim/grid';
  import { step } from '../sim/step';
  import { applyBrush, applyBrushLine } from '../sim/brush';
  import { randomShade } from '../sim/shade';
  import { EMPTY, SAND, type Tool, type BrushSize } from '../sim/types';

  interface Props {
    tool: Tool;
    brushSize: BrushSize;
  }

  let { tool, brushSize }: Props = $props();

  const grid = createGrid(GRID_WIDTH, GRID_HEIGHT);

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let imageData: ImageData;
  let drawing = false;
  let lastGridPos: { x: number; y: number } | null = null;

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

  function colorFor(element: number, shade: number): [number, number, number] {
    if (element === SAND) return PINK_RAMP[shade % PINK_RAMP.length];
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
    requestAnimationFrame(frame);
  });
</script>

<canvas
  bind:this={canvas}
  width={GRID_WIDTH}
  height={GRID_HEIGHT}
  class="play-area"
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
></canvas>

<style>
  .play-area {
    width: 100%;
    height: 100%;
    display: block;
    image-rendering: pixelated;
    touch-action: none;
    background: white;
  }
</style>
