<script lang="ts">
  import Toolbar from './lib/Toolbar.svelte';
  import PlayArea from './lib/PlayArea.svelte';
  import type { Tool, BrushSize, SceneId } from './sim/types';

  let tool = $state<Tool>('sand');
  let brushSize = $state<BrushSize>('medium');
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
</script>

<main>
  <PlayArea bind:this={playArea} {tool} {brushSize} />
  <Toolbar
    {tool}
    {brushSize}
    onSelectTool={selectTool}
    onSelectBrushSize={selectBrushSize}
    onSelectScene={selectScene}
    onClearAll={clearAll}
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
  }

  main :global(.play-area-container) {
    flex: 1;
    min-height: 0;
    min-width: 0;
  }
</style>
