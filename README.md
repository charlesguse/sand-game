# 🌈 Rainbow Sand 🦄

A falling-sand toy for an almost-5-year-old who loves rainbows, unicorns,
and pink. Draw with pink sand, pour water, sprinkle magic purple dirt, and
watch rainbows and unicorns do fun things.

**Play it:** https://charlesguse.github.io/sand-game/ — or download that
single page and double-click it; it runs straight from disk, no server
needed.

## How it's built

This repository is an experiment: the whole game is being built through the
[Wing Commander](https://github.com/charlesguse/wing-commander) spec-driven
pipeline. Each feature starts as a GitHub issue; the `spec-request` label
sends it through spec → plan → tasks → implement → PR, with a human merging
at each gate. See the issues and `specs/` for the full paper trail.

- Stack: Svelte 5 + Vite, built to a **single self-contained `index.html`**
  via `vite-plugin-singlefile`.
- Ground rules: [`.specify/memory/constitution.md`](.specify/memory/constitution.md)

## Local development

```bash
npm install
npm run dev     # dev server
npm run build   # emits dist/index.html — the whole game in one file
npm test        # vitest unit tests on the sim rules
```
