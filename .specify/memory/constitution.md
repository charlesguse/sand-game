# Rainbow Sand Constitution

Rainbow Sand is a falling-sand toy built for an almost-5-year-old girl who
loves rainbows, unicorns, and the color pink. Every decision optimizes for
her delight and for shipping something she can play **today**.

## Core Principles

### I. One Self-Contained Page (NON-NEGOTIABLE)

The final artifact is a **single self-contained `index.html`** (inline
CSS/JS, no external network requests at runtime). It MUST work when opened
directly from disk via `file://` — no web server, no CDN, no build step at
play time. The build (`npm run build`) produces `dist/index.html` as that
single file, and the same file is deployed to GitHub Pages. Anything that
breaks `file://` playback (module scripts loaded cross-file, fetch calls,
external assets) is a defect.

### II. Built For An Almost-5-Year-Old

- Controls are big, colorful, emoji-labeled buttons; the game must be fully
  playable **without reading**.
- No failure states, no scores, no timers, no text prompts. Nothing she does
  is ever "wrong"; drawing is the game.
- Works with mouse *and* touch (press-and-drag paints continuously).
- The palette is joyful: pink sand is the star; purples, rainbow colors, and
  sparkle accents everywhere.
- Nothing scary, no ads, no links leading away from the game.

### III. Simple, Dependency-Light Svelte

The stack is **Svelte 5 + Vite** with `vite-plugin-singlefile` to satisfy
Principle I. No other runtime dependencies without a spec explicitly
justifying them. The simulation core is plain TypeScript/JavaScript
operating on a typed-array grid rendered to a `<canvas>`; Svelte owns the UI
shell (toolbar, buttons, layout), not the per-frame hot path. Prefer the
simplest cellular-automaton rules that *look* fun over physical accuracy.

### IV. Performance Is A Feature

The sim MUST stay smooth (target 60fps, acceptable ≥30fps) on a mid-range
laptop and an iPad at the default grid size. Keep the hot loop
allocation-free; render via `putImageData` or equivalent. If a feature
can't stay smooth, shrink the grid or simplify the rule — never ship jank.

### V. Verifiable Without A Browser Harness

CI has no browser. Each feature keeps the build green (`npm run build`
succeeds and emits a single `dist/index.html`) and, where practical, covers
sim rules with plain `vitest` unit tests on the grid logic (no DOM needed).
Visual/feel checks are the maintainer's job at review time; specs should
state what to eyeball. Do not add browser-automation test infrastructure.

## Product Constraints

- **Elements** (target set, keep it small): pink sand, water, purple "magic
  dirt" (a second sand), rainbow 🌈 and unicorn 🦄 emoji objects with simple
  fun interactions, an eraser, and a clear-all. New element types require a
  spec.
- **Scenes**: an empty canvas plus two preloaded landscape scenes,
  selectable at any time from the toolbar.
- **Emoji objects** render as real emoji glyphs (🌈 🦄) drawn on/over the
  canvas — no custom artwork assets.
- **Deployment**: GitHub Pages serves the latest `main` build; the page
  itself is the downloadable artifact.

## Development Workflow

- Features flow through the Wing Commander pipeline: issue → spec →
  plan → tasks → implement ⟲ converge → final PR. Humans merge everything.
- Keep specs small enough to implement in a few bounded agent iterations;
  split rather than sprawl.
- `npm run build` and `npm test` (when tests exist) MUST pass before a final
  PR is mergeable; a broken `main` build blocks all other work.
- Later specs MUST NOT regress earlier features; when touching the sim core,
  preserve existing element behaviors unless the spec says otherwise.

## Governance

This constitution supersedes other practices for this repository. Amendments
arrive as PRs that state what changed and why, and bump the version below
(semver: breaking governance change / new principle / clarification).
Compliance is checked at spec review and final-PR review — the two human
gates. When a spec conflicts with a principle, the spec loses.

**Version**: 1.0.0 | **Ratified**: 2026-08-25 | **Last Amended**: 2026-08-25
