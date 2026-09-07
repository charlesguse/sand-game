<script lang="ts">
  import { CHEST_SHAPE } from './chestShape';
</script>

<!--
  Inline SVG treasure chest.

  No treasure-chest emoji exists in Unicode at all (unlike the bucket, where 🪣 exists but is
  Emoji 13.0+ and unsupported on Windows 10 Chrome / the Fire tablet — see BucketIcon.svelte).
  Drawing it from CHEST_SHAPE's own data means the toolbar icon and the on-canvas object share
  one source of truth and always agree, on every platform.
-->
<svg viewBox="0 0 36 36" width="1em" height="1em" aria-hidden="true" focusable="false">
  {#each CHEST_SHAPE as part}
    {#if part.kind === 'rect' && part.rect}
      <rect
        x={part.rect.x}
        y={part.rect.y}
        width={part.rect.width}
        height={part.rect.height}
        rx={part.rect.rx ?? 0}
        fill={part.fill}
        stroke={part.stroke}
        stroke-width={part.strokeWidth}
      />
    {:else if part.kind === 'path' && part.d}
      <path d={part.d} fill={part.fill} stroke={part.stroke} stroke-width={part.strokeWidth} stroke-linecap="round" />
    {/if}
  {/each}
</svg>
