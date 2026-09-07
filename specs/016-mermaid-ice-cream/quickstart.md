# Quickstart: validating "A Mermaid And Her Ice Cream"

This feature has no DOM/browser test harness (constitution Principle V) —
validation is plain `vitest` over `src/sim/*`, plus one maintainer eyeball
pass on a real device for feel. No new build step, no new dependency.

## Prerequisites

```bash
npm install   # only if node_modules isn't already present
```

## Automated validation

```bash
npm test        # the merge gate — must stay green (FR-034: no existing test may weaken)
npm run build   # must still emit a single dist/index.html (FR-032, SC-007)
```

`npm test` is expected to grow the following coverage (FR-033), mapped to
each user story's Independent Test in spec.md — see data-model.md and
contracts/sim-and-shell-contracts.md for the exact shapes involved:

| Rule | Where it's exercised | Shape of the check |
|---|---|---|
| Swims only between water cells, never leaves the pool | `tests/unit/sim/pets.test.ts` (or a new `mermaid.test.ts`) | Build a pool with `createGrid`/`setCell`, `addMermaid`, run `stepMermaids` a few hundred frames, assert every position is `WATER` and inside the original pool's bounds |
| Drifts, never stands perfectly still | same | Run many frames with no ice cream; assert position changes over time (research.md §3: no boredom delay) |
| Placed off-water snaps to nearby water within a bounded window | same | Place on dry sand a few cells from a pool; assert she ends up in the pool (FR-008) |
| Placed with no water anywhere rests, then swims once water arrives | same | Empty grid, `addMermaid`; assert `state === 'resting'` and position unchanged over many frames; then paint `WATER` under her; assert she transitions to swimming |
| Buried, frees herself within a bounded number of frames | same | Pour `SAND`/`GUMDROP`/`ICE_CREAM` onto her cell; assert she's never left inside a solid cell for more than a small bounded frame count (SC-002) |
| Cap of 3, oldest evicted | same | `addMermaid` a 4th time; assert exactly 3 remain, oldest gone (FR-002, mirrors `POODLE_CAP`'s existing test) |
| Poke → trick; poke elsewhere → no reaction; poke mid-pursuit/mid-trick → ignored | same | `pokeMermaidAt` at her position vs. elsewhere vs. while `timer > 0` (FR-011) |
| Swims to ice cream and eats it; give-up + cooldown when unreachable | same | Mermaid at one end of a pool, ice cream at the other: assert the cell empties and `state === 'eating'` within a bounded frame count (SC-001). Ice cream behind a sand wall / on dry land / in a different pool: assert she gives up (returns to drifting) within `MERMAID_PATIENCE`-scale frames and ignores scent for `iceCreamCooldown` frames after (FR-019/FR-020) |
| Poodles ignore ice cream, mermaids ignore gumdrops | `tests/unit/sim/pets.test.ts` | Both pets + both treats on one grid; assert each only reacts to its own treat (FR-022) |
| Eating is silent | wherever eating is asserted | No new sound-producing call is exercised — this is really enforced by *not writing* a call, but a `sound.test.ts` addition can assert `playBloop`/`playWobble`-equivalent mermaid functions don't exist |
| Ice cream pours, falls, and rests exactly like a gumdrop | `tests/unit/sim/gumdrop.test.ts` (or a new `iceCream.test.ts`) | Paint `ICE_CREAM` via `applyBrush`/`applyBrushLine` at each brush size; run `step()`; assert cell-for-cell parity with an identical gumdrop pour (FR-015) |
| Ice cream is hue-coloured and survives round trips | same, plus `history.test.ts`/`save.test.ts` | Paint, capture round trip through undo/redo and serialize/deserialize; assert `hues[i]` unchanged (FR-014, FR-026, FR-027) |
| `usesHueColor`/`visibleSnapshot` both know about `ICE_CREAM` | `tests/unit/sim/history.test.ts` | The existing `visibleSnapshot` test helper must read hue (not shade) for `ICE_CREAM` cells, or colour-drift assertions elsewhere will false-pass (FR-014) |
| No existing element's behaviour changes | `tests/unit/sim/{grid,step,brush,grass,flower,starPower,gumdrop}.test.ts` | Run unchanged — this is the regression net (FR-016, FR-034) |
| Eraser removes ice cream and mermaids; clear-all removes both | `tests/unit/sim/{brush,pets}.test.ts` | Ice cream: paint then erase, assert `EMPTY` (already true today once `ICE_CREAM` exists — confirms no other code path needs to change). Mermaids: `eraseMermaidsInBrush`/`Line` within/outside `POKE_RADIUS`. Clear-all: `clearPets` empties both arrays (FR-024, FR-025) |
| Save/restore round-trips mermaids and ice cream (incl. colour) | `tests/unit/sim/save.test.ts` | `serializeWorld`→`deserializeWorld` round trip with mermaids placed and ice cream painted; assert count/position/colour preserved (FR-026) |
| Undo/redo round-trips mermaids and ice cream (incl. colour), no drift across many cycles | `tests/unit/sim/history.test.ts` | `HistoryManager` cycle with a mermaid placed and ice cream painted; repeat undo/redo N times; assert no drift (FR-027) |
| Grid re-derivation remaps mermaids (clamped, never dropped) and ice cream cells | `tests/unit/sim/resize.test.ts`, `history.test.ts` | `repositionMermaids` offset+clamp assertions mirroring the existing `repositionPoodles` tests; `remapWorldState`/`HistoryManager.remap` with a mermaid near an edge |
| Pre-feature saves restore cleanly with no mermaids/ice cream and no error | `tests/unit/sim/save.test.ts`, `historySave.test.ts` | Feed a wire payload shaped like today's (no `mermaids` key) into `deserializeWorld`/`deserializeHistory`; assert it succeeds with `mermaids: []` (FR-029) |
| Toolbar stays within the 44px floor at 25/27 controls, every representative viewport | `tests/unit/lib/layout.test.ts` (no file edit needed — it already derives counts from `shippedToolbarControls(...).length`) | Existing sweep re-runs automatically against the new counts once `toolbarControls.ts` lists the two new entries (SC-006) |
| Both new glyphs render, no banned-era emoji | `tests/unit/shell/toolbarGlyphs.test.ts` | Extend with the same "not Emoji 13.0+" shape already checked for the sand bucket, applied to confirm 🧜/🍦 aren't accidentally swapped for a newer glyph (FR-031) |

## Manual / eyeball validation (constitution Principle V: not automatable)

1. `npm run dev`, open in a desktop browser.
2. Paint a pool of water, tap 🧜 then tap into it — confirm she settles under
   the surface and drifts gently (not jerkily, not frozen).
3. Paint 🍦 into the same pool; watch her notice, glide over, and eat it with
   a sparkle + a little beat (no sound should play for the eating itself).
4. Drop ice cream on dry land or behind a sand wall; confirm she tries for a
   while then calmly resumes drifting, never pressing against a wall forever.
5. Poke her directly — trick; poke elsewhere in her own water — no reaction,
   the tap just paints.
6. Bury her in sand; confirm she frees herself within a second or two, never
   invisible, never stuck.
7. Toggle fullscreen / resize the window (re-derivation); confirm she's still
   there, inside the grid, not lost.
8. Close and reopen the tab (or toggle to another tab and back, to trigger the
   visibility-flush save); confirm mermaids and ice cream both come back.
9. **Flag for Charlie** (Fire tablet / Windows desktop Chrome, per
   CLAUDE.md's platform table): confirm 🧜 and 🍦 render as real glyphs, not
   empty boxes, and that the toolbar still meets the 44px floor with 2 more
   controls on the smallest supported phone viewport.

## Expected outcome

Every item above passes with `npm test` green and `npm run build` still
emitting one self-contained `dist/index.html` that plays from `file://`
(SC-007). No existing test is weakened or deleted to get there (FR-034).
