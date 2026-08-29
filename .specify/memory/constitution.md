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

- **Elements** (keep the set small): pink sand, pink water, purple "magic
  dirt", grass, star power, fog, gumdrops 🍬, and flowers 🌼 — plus an eraser,
  a magic wand, and a clear-all. Flowers are the one sanctioned addition of
  this generation: they cannot be drawn — mature watered grass grows them —
  which is exactly why they exist without growing the toolbar. New element
  types require a spec.
- **Objects and pets**: rainbow 🌈, unicorn 🦄, palm 🌴, and flamingo 🦩
  emoji objects, and up to three poodle 🐩 pets who trot to her finger, chase
  gumdrops, shake off water, wander when bored, and do a trick when poked.
  All render as real emoji glyphs drawn on/over the canvas — no custom
  artwork assets.
- **Sound** is synthesized in code only (WebAudio oscillators — no audio
  files, per Principle I), always mutable via the 🔊/🔇 button, and never
  load-bearing: the game is fully playable silent, and stays silently
  playable where audio is unavailable.
- **Persistence**: her world saves locally and only locally
  (`localStorage`), restoring on the next launch. Nothing she makes ever
  leaves the device except a photo she explicitly shares.
- **Photo sharing** (📷) exists only where the platform offers a file share
  sheet; anywhere else the button is absent, never broken — the same
  hidden-when-unsupported pattern as the 📺 fullscreen button.
- **Scenes**: an empty canvas plus two preloaded landscape scenes,
  selectable at any time from the toolbar.
- **Deployment**: GitHub Pages serves the latest `main` build; the page
  itself is the downloadable artifact.

- **History survives re-derivation**: spec 010's original FR-022 discarded
  the undo/redo history on every grid re-derivation, written when
  re-derivation only happened on a physical rotation. The fullscreen button
  makes re-derivation a one-tap control right next to Undo, and she rotates
  the tablet constantly — wiping history there would make Undo useless. So
  stored history states are remapped to the new grid dimensions instead of
  discarded, keeping only states that remap losslessly. FR-022 is amended
  accordingly; do not "fix" this back to a wipe.

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

**Version**: 1.1.1 | **Ratified**: 2026-08-25 | **Last Amended**: 2026-08-29
