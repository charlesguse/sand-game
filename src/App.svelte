<script lang="ts">
  import type { Tool, BrushSize } from './sim/types';
  import PlayArea from './lib/PlayArea.svelte';

  let tool: Tool = $state('sand');
  let brushSize: BrushSize = $state('medium');
</script>

<main>
  <header>🌈 Rainbow Sand 🦄</header>
  <!-- Toolbar mount point (wired in Phase 4) -->
  <PlayArea {tool} {brushSize} />
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
