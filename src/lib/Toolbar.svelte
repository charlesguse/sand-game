<script lang="ts">
  import type { Tool, BrushSize, SceneId } from '../sim/types';

  interface Props {
    tool: Tool;
    brushSize: BrushSize;
    onSelectTool: (tool: Tool) => void;
    onSelectBrushSize: (size: BrushSize) => void;
    onSelectScene: (sceneId: SceneId) => void;
    onClearAll: () => void;
  }

  let { tool, brushSize, onSelectTool, onSelectBrushSize, onSelectScene, onClearAll }: Props = $props();
</script>

<div class="toolbar">
  <div class="group elements">
    <button
      class="control"
      class:selected={tool === 'sand'}
      aria-label="Pink sand"
      onclick={() => onSelectTool('sand')}
    >
      🩷
    </button>
    <button
      class="control"
      class:selected={tool === 'water'}
      aria-label="Water"
      onclick={() => onSelectTool('water')}
    >
      💧
    </button>
    <button
      class="control"
      class:selected={tool === 'dirt'}
      aria-label="Magic purple dirt"
      onclick={() => onSelectTool('dirt')}
    >
      💜
    </button>
  </div>

  <div class="group objects">
    <button
      class="control"
      class:selected={tool === 'rainbow'}
      aria-label="Rainbow"
      onclick={() => onSelectTool('rainbow')}
    >
      🌈
    </button>
    <button
      class="control"
      class:selected={tool === 'unicorn'}
      aria-label="Unicorn"
      onclick={() => onSelectTool('unicorn')}
    >
      🦄
    </button>
  </div>

  <div class="group actions">
    <button
      class="control"
      class:selected={tool === 'eraser'}
      aria-label="Eraser"
      onclick={() => onSelectTool('eraser')}
    >
      🧽
    </button>
    <button class="control" aria-label="Clear all" onclick={onClearAll}>🗑️</button>
  </div>

  <div class="group scenes">
    <button class="control" aria-label="Empty canvas" onclick={() => onSelectScene('empty')}>⬜</button>
    <button class="control" aria-label="Hills and lake world" onclick={() => onSelectScene('landscape1')}>
      🏔️
    </button>
    <button class="control" aria-label="Beach and pool world" onclick={() => onSelectScene('landscape2')}>
      🏝️
    </button>
  </div>

  <div class="group sizes">
    <button
      class="control size"
      class:selected={brushSize === 'small'}
      aria-label="Small brush"
      onclick={() => onSelectBrushSize('small')}
    >
      •
    </button>
    <button
      class="control size"
      class:selected={brushSize === 'medium'}
      aria-label="Medium brush"
      onclick={() => onSelectBrushSize('medium')}
    >
      ●
    </button>
    <button
      class="control size"
      class:selected={brushSize === 'large'}
      aria-label="Large brush"
      onclick={() => onSelectBrushSize('large')}
    >
      ⬤
    </button>
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 0.75rem;
    background: #fff0f6;
  }

  .group {
    display: flex;
    gap: 0.4rem;
    padding: 0.4rem;
    border-radius: 1.25rem;
    background: #ffffffaa;
  }

  .control {
    font-size: 2rem;
    line-height: 1;
    width: 3.5rem;
    height: 3.5rem;
    border-radius: 50%;
    border: 3px solid transparent;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    touch-action: manipulation;
  }

  .control.size {
    font-size: 1.5rem;
  }

  .control.selected {
    border-color: #ff69b4;
    transform: scale(1.15);
    box-shadow: 0 0 10px #ff69b4aa;
  }
</style>
