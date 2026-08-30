<script lang="ts">
  import { onMount } from 'svelte';
  import type { Tool, BrushSize, SceneId } from '../sim/types';
  import { MIN_TOUCH_TARGET, RESIZE_SETTLE_MS, computeToolbarLayout } from './layout';
  import { shippedToolbarControls } from './toolbarControls';
  import BucketIcon from './BucketIcon.svelte';

  interface Props {
    tool: Tool;
    brushSize: BrushSize;
    canUndo: boolean;
    canRedo: boolean;
    showFullscreen: boolean;
    showPhoto: boolean;
    muted: boolean;
    onSelectTool: (tool: Tool) => void;
    onSelectBrushSize: (size: BrushSize) => void;
    onSelectScene: (sceneId: SceneId) => void;
    onClearAll: () => void;
    onUndo: () => void;
    onRedo: () => void;
    onToggleFullscreen: () => void;
    onToggleMuted: () => void;
    onSharePhoto: () => void;
  }

  let {
    tool,
    brushSize,
    canUndo,
    canRedo,
    showFullscreen,
    showPhoto,
    muted,
    onSelectTool,
    onSelectBrushSize,
    onSelectScene,
    onClearAll,
    onUndo,
    onRedo,
    onToggleFullscreen,
    onToggleMuted,
    onSharePhoto,
  }: Props = $props();

  // Controls render as one flat sequence in manifest order (FR-008: grouping is a purely
  // visual cue via each control's own data-group tint, never a forced line break at a group
  // boundary — a nested per-group flex box would make the *real* CSS wrap at group granularity
  // while computeToolbarLayout's own model assumes individual controls flow freely, which is
  // exactly the FR-014 drift this feature exists to close).
  const controls = $derived(shippedToolbarControls(showFullscreen, showPhoto));

  function isSelected(id: string): boolean {
    switch (id) {
      case 'tool-water':
        return tool === 'water';
      case 'tool-dirt':
        return tool === 'dirt';
      case 'tool-grass':
        return tool === 'grass';
      case 'tool-star':
        return tool === 'star';
      case 'tool-gumdrop':
        return tool === 'gumdrop';
      case 'tool-rainbow':
        return tool === 'rainbow';
      case 'tool-unicorn':
        return tool === 'unicorn';
      case 'tool-palm':
        return tool === 'palm';
      case 'tool-poodle':
        return tool === 'poodle';
      case 'tool-flamingo':
        return tool === 'flamingo';
      case 'tool-eraser':
        return tool === 'eraser';
      case 'tool-wand':
        return tool === 'wand';
      case 'size-small':
        return brushSize === 'small';
      case 'size-medium':
        return brushSize === 'medium';
      case 'size-large':
        return brushSize === 'large';
      default:
        return false;
    }
  }

  function isDisabled(id: string): boolean {
    if (id === 'action-undo') return !canUndo;
    if (id === 'action-redo') return !canRedo;
    return false;
  }

  function glyphFor(id: string): string {
    switch (id) {
      case 'tool-water':
        return '💧';
      case 'tool-dirt':
        return '💜';
      case 'tool-grass':
        return '🌱';
      case 'tool-star':
        return '⭐';
      case 'tool-gumdrop':
        return '🍬';
      case 'tool-rainbow':
        return '🌈';
      case 'tool-unicorn':
        return '🦄';
      case 'tool-palm':
        return '🌴';
      case 'tool-poodle':
        return '🐩';
      case 'tool-flamingo':
        return '🦩';
      case 'tool-eraser':
        return '🧽';
      case 'action-clear':
        return '🗑️';
      case 'tool-wand':
        return '✨';
      case 'action-mute':
        return muted ? '🔇' : '🔊';
      case 'action-undo':
        return '↩️';
      case 'action-redo':
        return '↪️';
      case 'action-fullscreen':
        return '📺';
      case 'action-photo':
        return '📷';
      case 'scene-empty':
        return '⬜';
      case 'scene-landscape1':
        return '🏔️';
      case 'scene-landscape2':
        return '🏝️';
      case 'size-small':
        return '•';
      case 'size-medium':
        return '●';
      case 'size-large':
        return '⬤';
      default:
        return '';
    }
  }

  function handleClick(id: string): void {
    switch (id) {
      case 'tool-water':
        onSelectTool('water');
        return;
      case 'tool-dirt':
        onSelectTool('dirt');
        return;
      case 'tool-grass':
        onSelectTool('grass');
        return;
      case 'tool-star':
        onSelectTool('star');
        return;
      case 'tool-gumdrop':
        onSelectTool('gumdrop');
        return;
      case 'tool-rainbow':
        onSelectTool('rainbow');
        return;
      case 'tool-unicorn':
        onSelectTool('unicorn');
        return;
      case 'tool-palm':
        onSelectTool('palm');
        return;
      case 'tool-poodle':
        onSelectTool('poodle');
        return;
      case 'tool-flamingo':
        onSelectTool('flamingo');
        return;
      case 'tool-eraser':
        onSelectTool('eraser');
        return;
      case 'action-clear':
        onClearAll();
        return;
      case 'tool-wand':
        onSelectTool('wand');
        return;
      case 'action-mute':
        onToggleMuted();
        return;
      case 'action-undo':
        onUndo();
        return;
      case 'action-redo':
        onRedo();
        return;
      case 'action-fullscreen':
        onToggleFullscreen();
        return;
      case 'action-photo':
        onSharePhoto();
        return;
      case 'scene-empty':
        onSelectScene('empty');
        return;
      case 'scene-landscape1':
        onSelectScene('landscape1');
        return;
      case 'scene-landscape2':
        onSelectScene('landscape2');
        return;
      case 'size-small':
        onSelectBrushSize('small');
        return;
      case 'size-medium':
        onSelectBrushSize('medium');
        return;
      case 'size-large':
        onSelectBrushSize('large');
        return;
      default:
        return;
    }
  }

  // Self-measures the whole visible viewport (research.md §6) — the toolbar's constrained axis
  // is the full viewport axis, not a leftover region, so there's no circular dependency on
  // PlayArea's own size.
  let viewportWidth = $state(window.visualViewport?.width ?? window.innerWidth);
  let viewportHeight = $state(window.visualViewport?.height ?? window.innerHeight);

  const layout = $derived(computeToolbarLayout(viewportWidth, viewportHeight, controls.length));

  function measureViewport(): void {
    viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  }

  let resizeTimer: ReturnType<typeof setTimeout> | undefined;

  function scheduleMeasure(): void {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(measureViewport, RESIZE_SETTLE_MS);
  }

  onMount(() => {
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(document.documentElement);
    window.visualViewport?.addEventListener('resize', scheduleMeasure);
    window.addEventListener('orientationchange', scheduleMeasure);
    return () => {
      clearTimeout(resizeTimer);
      observer.disconnect();
      window.visualViewport?.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('orientationchange', scheduleMeasure);
    };
  });

  const boxStyle = $derived(
    `--control-min: ${MIN_TOUCH_TARGET}px; --control-size: ${layout.controlSize}px; --pitch: ${layout.pitch}px; ${
      layout.arrangement === 'rail' ? `width: ${layout.thickness}px;` : `height: ${layout.thickness}px;`
    }`,
  );
</script>

<div class="toolbar" class:rail={layout.arrangement === 'rail'} style={boxStyle}>
  {#each controls as control (control.id)}
    {#if control.id === 'tool-sand'}
      <button
        class="control"
        data-group={control.group}
        class:selected={tool === 'sand'}
        aria-label="Pink sand"
        onclick={() => onSelectTool('sand')}
      >
        <BucketIcon />
      </button>
    {:else}
      <button
        class="control"
        data-group={control.group}
        class:size={control.group === 'sizes'}
        class:selected={isSelected(control.id)}
        aria-label={control.ariaLabel}
        disabled={isDisabled(control.id)}
        onclick={() => handleClick(control.id)}
      >
        {glyphFor(control.id)}
      </button>
    {/if}
  {/each}
</div>

<style>
  @property --ring-angle {
    syntax: '<angle>';
    inherits: false;
    initial-value: 0deg;
  }

  .toolbar {
    box-sizing: border-box;
    display: flex;
    flex: 0 0 auto;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    row-gap: 0;
    column-gap: var(--pitch);
  }

  /* In the rail arrangement the band's thickness is its WIDTH, so controls must flow down the
     viewport's height and wrap into columns — exactly the axis computeToolbarLayout budgets
     against (mainAxisLength = viewport height). Left in row flow they wrap inside the narrow
     band instead and run off the bottom of the screen (FR-010, FR-014). Gaps mirror the rows
     case: pitch along the flow, zero between lines, since thickness counts lines only. */
  .toolbar.rail {
    flex-direction: column;
    row-gap: var(--pitch);
    column-gap: 0;
    padding-top: env(safe-area-inset-top);
    padding-right: env(safe-area-inset-right);
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
    background: linear-gradient(180deg, #ffe1f0, #e8e3fb);
  }

  .control {
    /* The border and the button UA padding MUST live inside --control-size: computeToolbarLayout
       budgets the band from that number, so a content-box control would render wider than the
       model believes and push the last line outside the viewport (FR-014). */
    box-sizing: border-box;
    padding: 0;
    font-size: calc(var(--control-size) * 0.5714);
    line-height: 1;
    width: var(--control-size);
    height: var(--control-size);
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

  /* A soft per-group ring tint — grouping stays a visual cue (FR-008) without a shared
     parent box, so the toolbar's real wrap (flex-wrap on .toolbar, one control per flex
     item) matches computeToolbarLayout's flat-sequence model exactly (FR-014). */
  .control[data-group='elements'] {
    box-shadow:
      0 2px 6px rgba(90, 61, 102, 0.16),
      inset 0 -2px 0 rgba(90, 61, 102, 0.06),
      0 0 0 2px rgba(255, 92, 168, 0.25);
  }

  .control[data-group='objects'] {
    box-shadow:
      0 2px 6px rgba(90, 61, 102, 0.16),
      inset 0 -2px 0 rgba(90, 61, 102, 0.06),
      0 0 0 2px rgba(178, 139, 255, 0.25);
  }

  .control[data-group='actions'] {
    box-shadow:
      0 2px 6px rgba(90, 61, 102, 0.16),
      inset 0 -2px 0 rgba(90, 61, 102, 0.06),
      0 0 0 2px rgba(92, 200, 255, 0.25);
  }

  .control[data-group='history'] {
    box-shadow:
      0 2px 6px rgba(90, 61, 102, 0.16),
      inset 0 -2px 0 rgba(90, 61, 102, 0.06),
      0 0 0 2px rgba(126, 217, 87, 0.25);
  }

  .control[data-group='scenes'] {
    box-shadow:
      0 2px 6px rgba(90, 61, 102, 0.16),
      inset 0 -2px 0 rgba(90, 61, 102, 0.06),
      0 0 0 2px rgba(255, 201, 60, 0.25);
  }

  .control:active:not(:disabled) {
    transform: scale(0.92);
    box-shadow: 0 1px 2px rgba(90, 61, 102, 0.18);
  }

  .control.size {
    font-size: calc(var(--control-size) * 0.4286);
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
    /* Emphasis has to stay INSIDE the control's box: the band now hugs the viewport edge, so a
       scale() on the selected control shaved its ring off against the screen edge on the outer
       line. A thicker rainbow border reads just as loudly and costs no layout (FR-010). */
    border-width: 5px;
    box-shadow: 0 4px 12px rgba(255, 92, 168, 0.35);
    animation: ring-turn 6s linear infinite;
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
</style>
