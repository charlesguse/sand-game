<script lang="ts">
  import type { Tool, BrushSize } from '../sim/types';
  import { createGrid, clearGrid as clearGridCells } from '../sim/grid';
  import { step } from '../sim/step';
  import { applyBrush, applyBrushLine } from '../sim/brush';
  import { randomShade } from '../sim/shade';
  import { computeLayout, clientToGrid } from './layout';

  const GRID_WIDTH = 270;
  const GRID_HEIGHT = 160;

  const BRUSH_RADIUS: Record<BrushSize, number> = {
    small: 2,
    medium: 5,
    large: 9,
  };

  let { tool, brushSize }: { tool: Tool; brushSize: BrushSize } = $props();

  const grid = createGrid(GRID_WIDTH, GRID_HEIGHT);
  const imageData = new ImageData(GRID_WIDTH, GRID_HEIGHT);

  let container: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;

  let displayWidth = $state(GRID_WIDTH);
  let displayHeight = $state(GRID_HEIGHT);
  let scale = 1;

  let strokeActive = false;
  let lastGridPos: { x: number; y: number } | null = null;

  export function clear(): void {
    clearGridCells(grid);
  }

  function updateLayout(): void {
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const layout = computeLayout(GRID_WIDTH, GRID_HEIGHT, rect.width, rect.height);
    scale = layout.scale;
    displayWidth = layout.displayWidth;
    displayHeight = layout.displayHeight;
  }

  function pointerToGrid(event: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return clientToGrid(event.clientX, event.clientY, rect, scale);
  }

  function handlePointerDown(event: PointerEvent): void {
    canvas.setPointerCapture(event.pointerId);
    strokeActive = true;
    const pos = pointerToGrid(event);
    applyBrush(grid, tool, pos.x, pos.y, BRUSH_RADIUS[brushSize], randomShade());
    lastGridPos = pos;
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!strokeActive || !lastGridPos) return;
    const pos = pointerToGrid(event);
    applyBrushLine(grid, tool, lastGridPos, pos, BRUSH_RADIUS[brushSize], randomShade());
    lastGridPos = pos;
  }

  function endStroke(): void {
    strokeActive = false;
    lastGridPos = null;
  }

  // While the pointer stays pressed at one spot, cells under the brush keep
  // emptying out as sand falls away; re-apply once per frame (research.md §8)
  // so the tool keeps pouring instead of stalling after the first fill.
  function applyActiveStroke(): void {
    if (!strokeActive || !lastGridPos) return;
    applyBrush(grid, tool, lastGridPos.x, lastGridPos.y, BRUSH_RADIUS[brushSize], randomShade());
  }

  function render(): void {
    const { cells } = grid;
    const pixels = imageData.data;
    for (let i = 0; i < cells.length; i++) {
      const value = cells[i];
      const offset = i * 4;
      if (value === 0) {
        pixels[offset] = 20;
        pixels[offset + 1] = 16;
        pixels[offset + 2] = 28;
        pixels[offset + 3] = 255;
      } else {
        pixels[offset] = 200 + (value % 56);
        pixels[offset + 1] = 60 + (value % 100);
        pixels[offset + 2] = 140 + (value % 80);
        pixels[offset + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  function frame(): void {
    applyActiveStroke();
    step(grid);
    render();
    requestAnimationFrame(frame);
  }

  $effect(() => {
    ctx = canvas.getContext('2d')!;
    updateLayout();
    window.addEventListener('resize', updateLayout);
    requestAnimationFrame(frame);
    return () => {
      window.removeEventListener('resize', updateLayout);
    };
  });
</script>

<div class="play-area" bind:this={container}>
  <canvas
    bind:this={canvas}
    width={GRID_WIDTH}
    height={GRID_HEIGHT}
    style:width="{displayWidth}px"
    style:height="{displayHeight}px"
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={endStroke}
    onpointercancel={endStroke}
    onlostpointercapture={endStroke}
  ></canvas>
</div>

<style>
  .play-area {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    touch-action: none;
  }

  canvas {
    image-rendering: pixelated;
    touch-action: none;
  }
</style>
