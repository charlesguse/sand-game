<script lang="ts">
  import Toolbar from './lib/Toolbar.svelte';
  import PlayArea from './lib/PlayArea.svelte';
  import type { Tool, BrushSize, SceneId } from './sim/types';
  import { isFullscreenSupported, toggleFullscreen } from './lib/fullscreen';
  import { isMuted, setMuted } from './lib/sound';

  let tool = $state<Tool>('sand');
  let brushSize = $state<BrushSize>('medium');
  let canUndo = $state(false);
  let canRedo = $state(false);
  let muted = $state(isMuted());
  let playArea: PlayArea;

  const showFullscreen = isFullscreenSupported(document.documentElement);

  // The 📺 pattern: computed once, and the 📷 button simply does not exist where the platform
  // can't share a file (desktop browsers, older iOS) — absent, never broken. The probe File is
  // constructed inside the try because the File constructor itself can throw on old engines.
  function isPhotoShareSupported(): boolean {
    try {
      if (typeof navigator.canShare !== 'function') return false;
      const probe = new File(['probe'], 'probe.png', { type: 'image/png' });
      return navigator.canShare({ files: [probe] });
    } catch {
      return false;
    }
  }
  const showPhoto = isPhotoShareSupported();

  function sharePhoto(): void {
    void playArea.sharePhoto();
  }

  function handleToggleFullscreen(): void {
    void toggleFullscreen(document.documentElement, document);
  }

  function handleToggleMuted(): void {
    setMuted(!muted);
    muted = isMuted();
  }

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
    {showFullscreen}
    {showPhoto}
    {muted}
    onSelectTool={selectTool}
    onSelectBrushSize={selectBrushSize}
    onSelectScene={selectScene}
    onClearAll={clearAll}
    onUndo={undo}
    onRedo={redo}
    onToggleFullscreen={handleToggleFullscreen}
    onToggleMuted={handleToggleMuted}
    onSharePhoto={sharePhoto}
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
