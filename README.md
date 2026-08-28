# 🌈 Madison's Sand 🦄

A falling-sand toy for Madison, who is almost 5 and likes rainbows, unicorns,
sparkles, poodles and the colour pink. Draw with pink sand, pour pink water,
sprinkle magic purple dirt, and watch rainbows and unicorns do fun things.

**Play it:** https://m8j8k.github.io/madisons-sand-game/ — or download that
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

## Setting it up on an iPad

Two steps, and the second one matters more than anything in the code.

**1. Add it to the Home Screen.** Open the game in Safari, tap Share → *Add to
Home Screen*. Launched from that icon it runs standalone — no address bar, no
tab strip. There is also a 📺 button in the toolbar for fullscreen in a normal
browser tab.

**2. Turn on Guided Access.** This is what actually stops a small child from
falling out of the game. No web page can block the iPad's own edge gestures —
the app switcher, Control Center, and the swipe-up home indicator are system
level and unreachable from a web page. Guided Access is Apple's answer:

- Settings → Accessibility → Guided Access → turn it **on**
- Set a passcode under *Passcode Settings*
- Open the game, then **triple-click the side button** to start a session
- Optionally circle any screen area you want disabled before tapping *Start*
- Triple-click again and enter the passcode to end the session

While a session is running the iPad is locked to the game. That is the setup
that lets you hand her the iPad and walk away.
