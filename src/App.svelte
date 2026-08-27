<script lang="ts">
  import Toolbar from './lib/Toolbar.svelte';
  import PlayArea from './lib/PlayArea.svelte';
  import type { Tool, BrushSize, SceneId } from './sim/types';

  let tool = $state<Tool>('sand');
  let brushSize = $state<BrushSize>('medium');
  let canUndo = $state(false);
  let canRedo = $state(false);
  let playArea: PlayArea;

  function selectTool(next: Tool): void {
    tool = next;
  }

  function selectBrushSize(next: BrushSize): void {
    brushSize = next;
  }

  function clearAll(): void {
    playArea.clearAll();
  }

  function selectScene(id: SceneId): void {
    playArea.loadScene(id);
  }

  function handleHistoryChange(nextCanUndo: boolean, nextCanRedo: boolean): void {
    canUndo = nextCanUndo;
    canRedo = nextCanRedo;
  }

  function undo(): void {
    playArea.undo();
  }

  function redo(): void {
    playArea.redo();
  }
</script>

<main>
  <PlayArea bind:this={playArea} {tool} {brushSize} onHistoryChange={handleHistoryChange} />
  <Toolbar
    {tool}
    {brushSize}
    {canUndo}
    {canRedo}
    onSelectTool={selectTool}
    onSelectBrushSize={selectBrushSize}
    onSelectScene={selectScene}
    onClearAll={clearAll}
    onUndo={undo}
    onRedo={redo}
  />
</main>

<style>
  :global(html, body) {
    margin: 0;
    height: 100%;
    overflow: hidden;
    font-family: sans-serif;
  }

  main {
    display: flex;
    flex-direction: column;
    height: 100vh;
    height: 100dvh;
  }

  main :global(.play-area-container) {
    flex: 1;
    min-height: 0;
    min-width: 0;
  }

  @media (max-height: 480px) and (orientation: landscape) {
    main {
      flex-direction: row;
    }
  }
</style>
