# Rainbow Sand

A falling-sand web toy for two small kids, built as a single self-contained
`dist/index.html` (Svelte 5 + Vite + vite-plugin-singlefile) that must run
via `file://`. Kid-first rules live in `.specify/memory/constitution.md`:
no reading, no failure states, no error surfaces — features that a platform
lacks are feature-detected and hidden, never broken.

- `npm test` — vitest suite (the merge gate; run it before any PR)
- `npm run build` — single-file build into `dist/` (`public/` assets ride along)

## Two maintainers, two platforms

Upstream (Charlie) tests on an **Amazon Fire 7 Kids tablet (Silk/Chromium)
and desktop Chrome**. Max's fork (for Madison) tests on an **iPad
(Safari, standalone home-screen app)**. Neither routinely tests the other's
platform, and changes flow both ways by merging each other's branches.

**The rule:** a feature that touches one column below must ship its
counterpart from the other column in the same change — or feature-detect
and hide the control where the platform can't do it. When merging the other
maintainer's work, audit the diff against this table, add whatever's
missing from your column, and flag anything only the other device can
verify instead of assuming it works.

| Concern | iOS / iPadOS (Max verifies) | Android / Fire + desktop (Charlie verifies) |
| --- | --- | --- |
| Home-screen install | `apple-mobile-web-app-*` metas, `apple-touch-icon.png` | `manifest.webmanifest` (`display: standalone`, PNG icons), inline base64 PNG favicon for `file://` |
| Fullscreen (📺) | `webkitRequestFullscreen` fallbacks in `src/lib/fullscreen.ts` | standard Fullscreen API (same file); button absent if neither exists |
| Sound | `webkitAudioContext` fallback, context created only inside a user gesture (`src/lib/sound.ts`) | standard `AudioContext`, same gesture gate |
| Photo share (📷) | `navigator.canShare({files})` probe in `src/App.svelte`; WebKit user-activation can lapse after slow `toBlob` | same probe; button simply absent on Silk/desktops without file share |
| Auto-save | `localStorage`, flushed on `visibilitychange`/`pagehide` (`src/sim/save.ts` + PlayArea glue) | identical — but locked-down kids' browsers may wipe storage; failures stay silent by design |
| Safe areas / viewport | `viewport-fit=cover` + `env(safe-area-inset-*)` paddings | same mechanism; also the 480px landscape-rail media query in `src/lib/layout.ts` + `Toolbar.svelte` |
