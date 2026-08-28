# History-survives-resize: implementation report

## Summary

Replaced `history.reset()` in `resize()` (`src/lib/PlayArea.svelte`) with `history.remap(...)`.
Added `remapWorldState()` (`src/sim/history.ts`) and `HistoryManager.remap()`. Undo/redo history
now survives grid re-derivation (fullscreen toggle, iPad rotation) instead of being wiped, which
is a deliberate divergence from upstream's FR-022 (`specs/010-undo-redo/spec.md`). Both new
functions carry doc comments naming FR-022 and explaining why this fork differs, and the call site
in `PlayArea.svelte` carries a matching comment ("Do not 'fix' this back to history.reset().").

## TDD: RED before GREEN

Wrote 8 new tests in `tests/unit/sim/history.test.ts` under a new describe block
`history — remapWorldState re-anchors a snapshot to new grid dimensions (fork divergence from
upstream FR-022, see resize() in PlayArea.svelte)`, covering the 7 scenarios in the spec (the
"remaps to smaller grid" and "canUndo() true after remap" scenarios each got their own test, plus
a second colorAux test for GUMDROP alongside RAINBOW_SAND).

RED run (before implementing `remapWorldState`/`HistoryManager.remap`), all 8 new tests failed for
the expected reason — the functions didn't exist yet:

```
FAIL  ... > canUndo() is still true after a remap that follows a recorded action — the actual bug
TypeError: history.remap is not a function

FAIL  ... > remaps the redo stack too, not just undo
TypeError: history.remap is not a function

FAIL  ... > drops an object that no longer fits, leaving no orphan OBJECT cells in the remapped elements
TypeError: remapWorldState is not a function

FAIL  ... > keeps an object that still fits, shifted by the offset, with its OBJECT footprint present
TypeError: remapWorldState is not a function

FAIL  ... > a RAINBOW_SAND cell keeps its hue through remap then restore
TypeError: remapWorldState is not a function

FAIL  ... > a GUMDROP cell keeps its hue through remap then restore
TypeError: remapWorldState is not a function

Test Files  1 failed (1)
     Tests  8 failed | 40 passed (48)
```

(The two "remaps a captured world..." / "remaps to a smaller grid..." tests that only call
`remapWorldState` directly also failed the same way — `remapWorldState is not a function` — not
shown twice above; full RED output had 8 failures, 40 pre-existing passes.)

GREEN run, after implementing `remapWorldState` and `HistoryManager.remap`:

```
✓ tests/unit/sim/history.test.ts (48 tests) 287ms

Test Files  1 passed (1)
     Tests  48 passed (48)
```

## Full suite

`npm test`:

```
Test Files  21 passed (21)
     Tests  433 passed (433)
   Duration  14.63s
```

425 pre-existing tests + 8 new = 433, all passing. All existing `reset()` tests pass unchanged
(`reset()` itself was not touched — still used at other call sites, e.g. clear-all/load-scene).

## Build

`npm run build`:

```
vite v5.4.21 building for production...
✓ 131 modules transformed.
[plugin vite:singlefile] Inlining: index-BhbXMRA2.js
[plugin vite:singlefile] Inlining: style-CuK22mNU.css
dist/index.html  74.78 kB │ gzip: 26.73 kB
✓ built in 415ms
```

`grep -cE '(src|href)="https?://' dist/index.html` → `0`

## No-orphan-OBJECT-cells guarantee

`remapWorldState` skips copying `OBJECT` cells from the old `elements` array entirely (mirroring
`resizeGrid`), then only stamps `OBJECT` into the new `elements` array while iterating the *kept*
objects in `byKind` — i.e. only after the fits check
(`x < 0 || x + obj.size > newWidth || y < 0 || y + obj.size > newHeight`) has passed. An object
that fails that check is `continue`d past and never reaches the stamping loop. Consequently, every
`OBJECT` value written into the new `elements` array is written by, and only by, the footprint
loop of a kept object — there is no code path that can write `OBJECT` without a corresponding kept
object, and no code path that copies a stale `OBJECT` byte from the old array. This makes orphan
`OBJECT` cells structurally impossible, not just empirically absent.

Verified directly in test `drops an object that no longer fits, leaving no orphan OBJECT cells in
the remapped elements`: places a 24x24 unicorn on a 30x30 grid, remaps to 10x10 (guaranteeing no
fit), asserts `remapped.byKind.unicorn.length === 0` AND scans every cell in `remapped.elements`
asserting none equals `OBJECT`.

## Files changed

- `src/sim/history.ts` — added `remapWorldState()` export and `HistoryManager.remap()` method.
- `src/lib/PlayArea.svelte` — `resize()` now captures `oldWidth`/`oldHeight` before swapping
  `grid`, and calls `history.remap(oldWidth, oldHeight, grid.width, grid.height, offsetX,
  offsetY)` instead of `history.reset()`. `onHistoryChange?.(...)` notification kept.
- `tests/unit/sim/history.test.ts` — 8 new tests, RED-then-GREEN.

## Commit

`fix: undo/redo history survives grid re-derivation instead of being wiped (diverges from upstream FR-022)`
