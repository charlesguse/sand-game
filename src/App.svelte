<script lang="ts">
  import type { Tool, BrushSize } from './sim/types';
  import PlayArea from './lib/PlayArea.svelte';
  import Toolbar from './lib/Toolbar.svelte';

  let tool: Tool = $state('sand');
  let brushSize: BrushSize = $state('medium');
  let playArea: ReturnType<typeof PlayArea> | undefined;
</script>

<main>
  <header>🌈 Rainbow Sand 🦄</header>
  <Toolbar
    {tool}
    {brushSize}
    onSelectTool={(t) => (tool = t)}
    onSelectBrushSize={(b) => (brushSize = b)}
    onClear={() => playArea?.clear()}
  />
  <PlayArea bind:this={playArea} {tool} {brushSize} />
</main>

<style>
  header {
    text-align: center;
    font-size: 1.5rem;
  }

  main {
    display: flex;
    flex-direction: column;
    height: 100vh;
    margin: 0;
    overflow: hidden;
  }
</style>
