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
    font-size: 2rem;
    font-weight: 800;
    padding: 0.5rem 0;
    background: linear-gradient(
      90deg,
      #ff9ecb,
      #ffd6a5,
      #fdffb6,
      #caffbf,
      #9bf6ff,
      #a0c4ff,
      #ffc6ff
    );
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
  }

  main {
    display: flex;
    flex-direction: column;
    height: 100vh;
    margin: 0;
    overflow: hidden;
    background: #fff5fa;
  }
</style>
