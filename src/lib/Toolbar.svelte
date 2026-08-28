<script lang="ts">
  import type { Tool, BrushSize, SceneId } from '../sim/types';
  import { MIN_TOUCH_TARGET } from './layout';

  interface Props {
    tool: Tool;
    brushSize: BrushSize;
    canUndo: boolean;
    canRedo: boolean;
    showFullscreen: boolean;
    onSelectTool: (tool: Tool) => void;
    onSelectBrushSize: (size: BrushSize) => void;
    onSelectScene: (sceneId: SceneId) => void;
    onClearAll: () => void;
    onUndo: () => void;
    onRedo: () => void;
    onToggleFullscreen: () => void;
  }

  let {
    tool,
    brushSize,
    canUndo,
    canRedo,
    showFullscreen,
    onSelectTool,
    onSelectBrushSize,
    onSelectScene,
    onClearAll,
    onUndo,
    onRedo,
    onToggleFullscreen,
  }: Props = $props();
</script>

<div class="toolbar" style="--control-min: {MIN_TOUCH_TARGET}px">
  <div class="group elements">
    <button
      class="control"
      class:selected={tool === 'sand'}
      aria-label="Pink sand"
      onclick={() => onSelectTool('sand')}
    >
      💗
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
    <button
      class="control"
      class:selected={tool === 'grass'}
      aria-label="Grass"
      onclick={() => onSelectTool('grass')}
    >
      🌱
    </button>
    <button
      class="control"
      class:selected={tool === 'star'}
      aria-label="Star power"
      onclick={() => onSelectTool('star')}
    >
      ⭐
    </button>
    <button
      class="control"
      class:selected={tool === 'gumdrop'}
      aria-label="Gumdrops"
      onclick={() => onSelectTool('gumdrop')}
    >
      🍬
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
    <button
      class="control"
      class:selected={tool === 'palm'}
      aria-label="Palm tree"
      onclick={() => onSelectTool('palm')}
    >
      🌴
    </button>
    <button
      class="control"
      class:selected={tool === 'poodle'}
      aria-label="Poodle"
      onclick={() => onSelectTool('poodle')}
    >
      🐩
    </button>
    <button
      class="control"
      class:selected={tool === 'flamingo'}
      aria-label="Flamingo"
      onclick={() => onSelectTool('flamingo')}
    >
      🦩
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
    <button
      class="control"
      class:selected={tool === 'wand'}
      aria-label="Magic wand"
      onclick={() => onSelectTool('wand')}
    >
      ✨
    </button>
  </div>

  <div class="group history">
    <button class="control" aria-label="Undo" disabled={!canUndo} onclick={onUndo}>↩️</button>
    <button class="control" aria-label="Redo" disabled={!canRedo} onclick={onRedo}>↪️</button>
  </div>

  {#if showFullscreen}
    <div class="group screen">
      <button class="control" aria-label="Full screen" onclick={onToggleFullscreen}>📺</button>
    </div>
  {/if}

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
  @property --ring-angle {
    syntax: '<angle>';
    inherits: false;
    initial-value: 0deg;
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 0.75rem;
    padding-top: calc(0.75rem + env(safe-area-inset-top));
    padding-right: calc(0.75rem + env(safe-area-inset-right));
    padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
    padding-left: calc(0.75rem + env(safe-area-inset-left));
    background: linear-gradient(180deg, #ffe1f0, #e8e3fb);
  }

  .group {
    display: flex;
    gap: 0.4rem;
    padding: 0.4rem;
    border-radius: 1.25rem;
    background: rgba(255, 255, 255, 0.55);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.85),
      0 1px 4px rgba(90, 61, 102, 0.08);
  }

  .control {
    font-size: 2rem;
    line-height: 1;
    width: 3.5rem;
    height: 3.5rem;
    min-width: var(--control-min);
    min-height: var(--control-min);
    border-radius: 50%;
    border: 3px solid transparent;
    background:
      linear-gradient(#ffffff, #ffffff) padding-box,
      linear-gradient(180deg, #ffffff, #f2e9f7) border-box;
    box-shadow:
      0 2px 6px rgba(90, 61, 102, 0.16),
      inset 0 -2px 0 rgba(90, 61, 102, 0.06);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    transition:
      transform 120ms ease,
      box-shadow 120ms ease;
  }

  .control:active:not(:disabled) {
    transform: scale(0.92);
    box-shadow: 0 1px 2px rgba(90, 61, 102, 0.18);
  }

  .control.size {
    font-size: 1.5rem;
    color: #5a3d66;
  }

  .control.selected {
    background:
      linear-gradient(#ffffff, #ffffff) padding-box,
      conic-gradient(
          from var(--ring-angle),
          #ff5ca8,
          #ffc93c,
          #7ed957,
          #5cc8ff,
          #b28bff,
          #ff5ca8
        )
        border-box;
    transform: scale(1.15);
    box-shadow: 0 4px 12px rgba(255, 92, 168, 0.35);
    animation: ring-turn 6s linear infinite;
  }

  .control.selected:active {
    transform: scale(1.05);
  }

  @keyframes ring-turn {
    to {
      --ring-angle: 360deg;
    }
  }

  .control:disabled {
    opacity: 0.35;
    filter: grayscale(1);
    cursor: default;
    box-shadow: none;
  }

  .control:focus-visible {
    outline: 3px solid #ff5ca8;
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .control {
      transition: none;
    }

    .control.selected {
      animation: none;
    }
  }

  @media (max-height: 480px) and (orientation: landscape) {
    .toolbar {
      flex-direction: column;
      flex-wrap: wrap;
    }

    .control {
      width: var(--control-min);
      height: var(--control-min);
      font-size: 1.5rem;
    }

    .control.size {
      font-size: 1.1rem;
    }
  }
</style>
