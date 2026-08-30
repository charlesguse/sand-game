<!--
  Inline SVG bucket for the sand tool.

  🪣 is Emoji 13.0 and is the only bucket in Unicode, so no emoji fallback
  exists — Windows 10 Chrome and the Fire tablet draw it as an empty "tofu"
  box (see src/lib/Toolbar.svelte). Drawing our own pail instead of picking
  between glyphs means every platform shows the same picture, always.
-->
<svg viewBox="0 0 36 36" width="1em" height="1em" aria-hidden="true" focusable="false">
  <path
    d="M8.5 13.5h19l-2.4 15.6a3 3 0 0 1-3 2.5H13.9a3 3 0 0 1-3-2.5L8.5 13.5z"
    fill="#ff8fc4"
    stroke="#5a3d66"
    stroke-width="1.8"
    stroke-linejoin="round"
  />
  <path d="M14.5 16.5l1.4 12M18 16.5v12M21.5 16.5l-1.4 12" stroke="#ffd6ea" stroke-width="1.6" stroke-linecap="round" />
  <rect x="7" y="11.6" width="22" height="3.6" rx="1.8" fill="#ff5ca8" stroke="#5a3d66" stroke-width="1.8" />
  <path
    d="M11 11.6a7 7 0 0 1 14 0"
    fill="none"
    stroke="#5a3d66"
    stroke-width="1.8"
    stroke-linecap="round"
  />
</svg>
