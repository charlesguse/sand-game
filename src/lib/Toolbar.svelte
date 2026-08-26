<script lang="ts">
  import type { Tool, BrushSize } from '../sim/types';

  let {
    tool,
    brushSize,
    onSelectTool,
    onSelectBrushSize,
    onClear,
  }: {
    tool: Tool;
    brushSize: BrushSize;
    onSelectTool: (tool: Tool) => void;
    onSelectBrushSize: (brushSize: BrushSize) => void;
    onClear: () => void;
  } = $props();
</script>

<div class="toolbar">
  <button
    type="button"
    class="tool-button"
    class:selected={tool === 'sand'}
    aria-label="Pink sand"
    onclick={() => onSelectTool('sand')}
  >
    🩷
  </button>
  <button
    type="button"
    class="tool-button"
    class:selected={tool === 'eraser'}
    aria-label="Eraser"
    onclick={() => onSelectTool('eraser')}
  >
    🧽
  </button>
  <button type="button" class="tool-button" aria-label="Clear" onclick={onClear}>
    🗑️
  </button>

  <button
    type="button"
    class="brush-button brush-small"
    class:selected={brushSize === 'small'}
    aria-label="Small brush"
    onclick={() => onSelectBrushSize('small')}
  >
    ⚪
  </button>
  <button
    type="button"
    class="brush-button brush-medium"
    class:selected={brushSize === 'medium'}
    aria-label="Medium brush"
    onclick={() => onSelectBrushSize('medium')}
  >
    ⚪
  </button>
  <button
    type="button"
    class="brush-button brush-large"
    class:selected={brushSize === 'large'}
    aria-label="Large brush"
    onclick={() => onSelectBrushSize('large')}
  >
    ⚪
  </button>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 0.75rem;
    flex-wrap: wrap;
  }

  button {
    border: 4px solid transparent;
    border-radius: 50%;
    background: #fff0f6;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  .tool-button {
    width: 4rem;
    height: 4rem;
    font-size: 2rem;
  }

  .brush-button {
    width: 3rem;
    height: 3rem;
    background: transparent;
  }

  .brush-small {
    font-size: 0.75rem;
  }

  .brush-medium {
    font-size: 1.5rem;
  }

  .brush-large {
    font-size: 2.5rem;
  }

  .selected {
    border-color: #ff69b4;
    background: #ffe0ef;
  }
</style>
