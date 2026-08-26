<script lang="ts">
  import type { Tool, BrushSize } from './sim/types';

  let tool: Tool = $state('sand');
  let brushSize: BrushSize = $state('medium');
</script>

<main>
  <header>🌈 Rainbow Sand 🦄</header>
  <!-- Toolbar mount point (wired in Phase 4) -->
  <!-- PlayArea mount point (wired in Phase 3) -->
</main>

<style>
  header {
    text-align: center;
    font-size: 1.5rem;
  }
</style>
