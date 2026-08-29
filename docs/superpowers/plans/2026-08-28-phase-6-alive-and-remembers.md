# Phase 6 — Alive And It Remembers Her: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The game remembers Madison's world between sessions, makes gentle sounds, reacts when she pokes the animals, lets her share a photo of her picture, paints with all her fingers, gives the poodle an idle wander, and grows flowers from watered grass.

**Architecture:** Persistence is a pure serialization codec in `src/sim/save.ts` (node-testable) with `localStorage` glue in `PlayArea.svelte`. Sound is a self-contained WebAudio synth in `src/lib/sound.ts` — zero audio assets, all oscillators, muted-by-default-safe. Pokes and multitouch restructure the pointer path in `PlayArea.svelte`; pet reactions live in `pets.ts` (testable) with render-layer effects. Flowers are one new static element. Photo share follows the fullscreen button's hidden-when-unsupported pattern.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vite + `vite-plugin-singlefile`, vitest (node environment, no DOM), WebAudio API.

**A note on plan-authored code:** four defects in previous phases came from verbatim code in the plan (wrong row indices, a nonexistent `cellSize`, mismatched constants). This plan therefore specifies **exact interfaces and behavioural contracts**, and enumerates test scenarios with their must-fail conditions — but implementers write the test code themselves, RED-first, against the real codebase. When the plan's prose contradicts what you find in the code, the code wins; say so in your report.

## Global Constraints

Copied from `.specify/memory/constitution.md`. Every task's requirements implicitly include these.

- **Single self-contained `index.html`.** No external network requests at runtime; works from `file://`. **No audio files, no image assets** — sound is synthesized, graphics are emoji and pixels. No new runtime dependencies.
- **Playable without reading.** Emoji-presentation glyphs only. Reuse `.control`.
- **No failure states.** Nothing she does is ever "wrong". No dialogs, no errors. A feature the platform can't support is *absent*, not broken (the 📺 button is the precedent). `localStorage` and WebAudio may be unavailable or throw (private mode, autoplay policy) — every touchpoint is guarded and silent.
- **Works with mouse and touch.**
- **Performance is a feature.** 60fps target. Nothing enters the per-cell sim loop or per-pixel render loop; per-frame additions are per-entity or event-driven. Serialization runs debounced, never per-frame.
- **Keep the element set small.** `FLOWER` is the only new element, justified in Task 8's constitution update.
- **Verifiable without a browser harness.** CI has no browser. Plain vitest, `node` environment — so **no `localStorage`, `btoa`, `Buffer`, `AudioContext`, or DOM in any tested module**. Never add browser-automation test infrastructure. Do not modify `vitest.config.ts`.
- TypeScript `strict`, `noUnusedLocals`, `noUnusedParameters`.

## Standing trap: hue-coloured elements and history

`RAINBOW_SAND` and `GUMDROP` colour from `hues`; everything else from `shades`. History packs both into one `colorAux` array via ternaries in `captureWorldState`, `restoreWorldState`, and `worldMatches` — **plus the test-local `visibleSnapshot` helper in `history.test.ts`**. This has caused one shipped bug already. Task 7 adds `FLOWER`, a third hue-coloured element: all four sites must be extended, and the persistence codec (Task 1) inherits correctness from `captureWorldState`, so Task 1 must land before Task 7 needs no extra work there.

---

### Task 1: Her world survives closing the app

**Files:**
- Create: `src/sim/save.ts`
- Modify: `src/lib/PlayArea.svelte` (restore on mount, debounced save)
- Test: `tests/unit/sim/save.test.ts` (create)

**Interfaces (exact — later tasks and the glue depend on these):**

```ts
export const SAVE_VERSION = 1;

export interface SavedWorld {
  version: number;
  width: number;
  height: number;
  state: WorldState;                    // from src/sim/history
  poodles: { x: number; y: number }[];
}

/** Never throws. */
export function serializeWorld(grid: Grid, objects: ObjectsState, pets: PetsState): string;

/** Returns null on ANY invalid input — wrong version, truncated data, corrupt base64,
 *  mismatched array lengths, hand-edited garbage. Never throws. */
export function deserializeWorld(raw: string): SavedWorld | null;
```

**Requirements:**
- Capture via the existing `captureWorldState(grid, objects)` — do not invent a second capture path.
- Typed arrays encode to base64 with a small hand-rolled encoder/decoder (no `btoa`/`Buffer` — neither exists in both environments). ~300 KB per save is acceptable.
- `deserializeWorld` validates that every array's decoded length equals `width * height` before returning; anything off → `null`.
- Glue in `PlayArea.svelte` (untestable component code, expected):
  - **Restore on mount**, before the first frame: read key `madisons-sand-world-v1`; on a hit, if saved dims ≠ derived dims, remap via the existing `remapWorldState` using the same anchor `resizeGrid` uses (`offsetX = round((newW - oldW)/2)`, `offsetY = newH - oldH`) — best-effort carry, loss acceptable here (unlike undo). Then `restoreWorldState` (already shape-guarded, returns boolean — a `false` means start fresh, silently). Re-add saved poodles via `addPoodle`.
  - **Save**: debounce ~2 s after each `commitAction`, plus immediately on `visibilitychange`→hidden and `pagehide`. Every `localStorage` read/write in `try/catch`; a quota or privacy failure is silent.
- History starts empty after a restore — the restored world is the new baseline.

**Test scenarios (write RED-first; each must genuinely fail before implementation):**
1. Round trip: serialize a grid with sand/water/rainbow-sand/gumdrops + objects of every kind + 2 poodles → deserialize → every array cell-for-cell equal, objects and poodles intact.
2. Rainbow-sand and gumdrop hues survive the round trip (the standing trap).
3. `deserializeWorld("")`, `deserializeWorld("not json")`, `deserializeWorld` of valid JSON with a truncated `elements` array, and a wrong `version` → all `null`, none throw.
4. A tampered payload whose `width*height` disagrees with an array length → `null`.
5. Base64 helpers round-trip a `Uint8Array` containing 0, 255, and every value mod pattern — do not trust the happy path.

- [ ] Steps: RED tests → implement codec → GREEN → wire glue → `npm test && npm run build` → grep dist for external refs (expect 0) → commit `feat: her world survives closing the app`

---

### Task 2: Sound

**Files:**
- Create: `src/lib/sound.ts`
- Modify: `src/lib/Toolbar.svelte` (🔊/🔇 toggle), `src/App.svelte`, `src/lib/PlayArea.svelte` (wiring)
- Test: `tests/unit/lib/sound.test.ts` (create)

**Interfaces (exact):**

```ts
export function initSoundOnGesture(): void;   // create/resume AudioContext; idempotent; safe anywhere
export function setMuted(muted: boolean): void;
export function isMuted(): boolean;
export type PourKind = 'sand' | 'water' | 'dirt' | 'gumdrop' | 'grass' | 'star';
export function playPour(kind: PourKind): void;
export function playPop(): void;      // object placed
export function playBloop(): void;    // poodle eats
export function playWobble(): void;   // poodle shakes
export function playTrill(): void;    // pet poked (Task 4 wires this)
export function playWhoosh(): void;   // undo / redo
export function playSweep(): void;    // clear-all
export function playChime(): void;    // wand
```

**Requirements:**
- Pure WebAudio synthesis: oscillators + gain envelopes (+ optional noise via a tiny generated buffer). **Gentle**: master gain ≤ 0.12, every sound ≤ 300 ms, nothing percussive-harsh. Each pour kind gets a slightly different pitch so materials feel different.
- Every function is a **silent no-op** when muted, when `AudioContext` is undefined (node!), or when construction/resume throws. Nothing in this module may ever throw outward.
- iOS autoplay: the context is created/resumed only inside `initSoundOnGesture()`, called from the existing `pointerdown` path. Do not create it at module load.
- Throttle pours internally: at most one pour sound per ~160 ms regardless of call rate.
- Mute button: 🔊/🔇 in the toolbar's actions area, `.control`, aria-label "Sound". Persist choice under `madisons-sand-muted` (try/catch, default unmuted).
- Wire: paint strokes (pour, by tool), object placement (pop), eat (bloop) and shake (wobble) at the same render-layer sites that spawn their sparkles, undo/redo (whoosh), clear-all (sweep), wand (chime). **Do not call audio from `step.ts` or anything in `src/sim/` — the sim stays pure.**

**Test scenarios:** module imports and every `play*` call runs without throwing in node (no `AudioContext`); mute state round-trips through `setMuted`/`isMuted`; throttle logic (if extracted as a pure helper) gates a second call inside the window and admits one after. Envelope/pitch quality is an ear-check, not a test.

- [ ] Steps: RED → implement → GREEN → wire + button → full verify → commit `feat: gentle sounds, and a mute button`

---

### Task 3: All her fingers paint

**Files:**
- Modify: `src/lib/PlayArea.svelte` (pointer handling)

**Requirements:**
- Replace the single `drawing` flag + `lastGridPos` with `const strokes = new Map<pointerId, { x: number; y: number }>()`. Each active pointer paints its own continuous stroke through the existing `paintAt`/line logic. `setPointerCapture` per pointer stays.
- **History semantics:** `beginAction` when the map goes 0→1, `commitAction` + notify when it returns to 0. One multi-finger scribble = one undo step.
- Object-placement tools (rainbow/unicorn/palm/flamingo/poodle) stay single-shot on pointerdown and never enter the stroke map.
- `poodleTarget` updates from whichever pointer moved last.
- `pointercancel` is treated exactly like `pointerup` — a lost finger must not wedge the map non-empty (that would leave an action permanently uncommitted: a failure state).
- Component code, no automated test (expected). Verification: full suite green, build clean, and reviewer scrutiny on the 0→1/1→0 transitions.

- [ ] Steps: implement → `npm test && npm run build` → grep dist (0) → commit `feat: every finger paints its own stroke`

---

### Task 4: Poke the animals

**Files:**
- Modify: `src/sim/pets.ts` (poodle trick), `src/lib/PlayArea.svelte` (hit-test + reactions + render), `src/lib/sound.ts` consumer wiring
- Test: `tests/unit/sim/pets.test.ts` (extend)

**Interfaces (exact):**

```ts
// pets.ts
export const POKE_RADIUS = 14;               // cells
export function pokePoodleAt(pets: PetsState, x: number, y: number): boolean;
// finds the nearest poodle within POKE_RADIUS; if found and its timer is idle-free,
// sets state 'tricking' with TRICK_DURATION (~36 frames), returns true. Never throws.
```

Add `'tricking'` to `PoodleState`. A tricking poodle holds via the existing `timer` gate, exactly like `eating`/`shaking` — **it must not write or reset any pursuit field** (`pursuitX`, `pursuitBestDist`, `pursuitStaleFrames`, `gumdropCooldown`); the timer-hold pattern already guarantees this if followed.

**Requirements:**
- In `PlayArea.svelte` pointerdown, **before** painting: hit-test the tap against (a) poodles via `pokePoodleAt`, (b) placed objects by footprint (`byKind`, point-in-rect). On a hit with any tool **except the eraser** (eraser must keep erasing objects): trigger the reaction, spawn its effect, play `playTrill`, and do **not** start a paint stroke for that pointer. Eraser taps pass through untouched.
- Reactions, render-layer only, each keyed by object `id` in small timestamp maps cleaned like the existing `unicornTimers`:
  - **Poodle** → 'tricking': render as a spin (flip `facing` a few times over the timer or rotate the glyph) + a 💖-heavy `spawnBurst`.
  - **Unicorn** → reuse the existing wand-burst path.
  - **Flamingo** → a hop: temporarily boosted bob amplitude for ~600 ms.
  - **Palm** → a shiver: temporarily boosted sway amplitude for ~600 ms.
  - **Rainbow** → a plain `spawnBurst`.

**Test scenarios (pets.ts side):** poke within radius → `true` + state 'tricking' + timer set; poke outside radius → `false`, nothing changes; poke during eating/shaking → `false`/no-op (timer busy); tricking ends and the poodle returns to normal behaviour (walks to a target afterwards); pursuit fields untouched by a poke mid-pursuit (assert values before/after).

- [ ] Steps: RED → implement pets side → GREEN → wire PlayArea reactions → full verify → commit `feat: the animals react when she pokes them`

---

### Task 5: The poodle wanders when bored

**Files:**
- Modify: `src/sim/pets.ts`
- Test: `tests/unit/sim/pets.test.ts` (extend)

**Behavioural contract (exact — the gating exists to keep every existing test green):**
- New per-poodle fields: `idleFrames: number`, `homeX: number` (set on each arrival/settle), plus whatever small wander bookkeeping is needed. `consumedTargetX: number | null` — when the poodle arrives within `ARRIVE_DISTANCE` of the finger target, that target x is **consumed**: while the incoming target stays within 2 cells of the consumed x, it is treated as absent. A touch somewhere new (> 2 cells away) reactivates pursuit. Without this, the stale never-cleared `poodleTarget` means wandering would fight the target forever (yo-yo).
- Wander triggers only when **all** hold: state is `idle`; no gumdrop in scent range and no gumdrop cooldown pending pursuit; target is null **or consumed**; and `idleFrames >= WANDER_IDLE_DELAY` where `WANDER_IDLE_DELAY = 150`.
- Wandering: every `WANDER_PAUSE ≈ 45` frames, one 1-cell step in a drifting direction, staying within ±10 cells of `homeX` and inside grid bounds; **state remains `'idle'`** (this is what keeps the existing `state === 'idle'` assertions green); **no grooming** while wandering (grooming stays a trotting-only behaviour); facing updates so she sees the dog turn.
- `idleFrames` resets on any state other than idle and on any real pursuit/trot.

**Existing tests that constrain you (verify all still pass, unmodified):** "does nothing alarming with no target" (100 frames < 150 delay); "ignores a gumdrop far outside its range" (60 frames); "stops when it arrives instead of jittering" (arrival consumes ~120 of 200 frames); "is trotting while it walks and idle once it arrives" (state stays `'idle'` by contract). If any of these fails, your gating is wrong — fix the code, never the test, and if you believe the contract itself is wrong, stop and report.

**New test scenarios:** after 300+ frames idle on a wide floor with no target, the poodle's x has changed at least once but stayed within ±10 of home and in bounds, state always `'idle'`; a fresh target > 2 cells away interrupts wandering and is pursued; a re-sent consumed target (same x) does not re-trigger pursuit; wandering never converts sand (no grooming).

- [ ] Steps: RED → implement → GREEN (all 449+ existing too) → full verify → commit `feat: a bored poodle sniffs around`

---

### Task 6: Photo for grandma

**Files:**
- Modify: `src/lib/Toolbar.svelte` (📷 button), `src/App.svelte`, `src/lib/PlayArea.svelte` (export fn)

**Requirements:**
- 📷 button, aria-label "Photo", shown only when supported — the 📺 pattern: compute once, `{#if showPhoto}`. Supported ⇔ `navigator.canShare` exists **and** `canShare({ files: [probe] })` is true for a tiny probe `File` (guard the `File` constructor itself in try/catch). Desktop browsers without file-share simply never see the button; that is correct, note it in the commit body.
- On tap: render the play canvas to an offscreen canvas at **4× with `imageSmoothingEnabled = false`** (crisp pixels) on a white background, `toBlob('image/png')` → `File('madisons-sand.png')` → `navigator.share({ files })`. A rejected promise (she cancelled the sheet, or iOS declined) is swallowed silently — cancelling is not an error.
- Nothing here throws; every await is caught.
- Component code, no automated test (expected). Reviewer checks the guard logic and that no path can surface an error.

- [ ] Steps: implement → full verify → commit `feat: share a photo of her picture`

---

### Task 7: Flowers

**Files:**
- Modify: `src/sim/types.ts` (`FLOWER = 10`), `src/sim/element.ts` (`isSolid`), `src/sim/step.ts` (spawn in the grass-absorb path), `src/lib/palette.ts` (colours), `src/sim/history.ts` (**the standing trap: all three ternaries**), `tests/unit/sim/history.test.ts` (`visibleSnapshot` helper)
- Test: `tests/unit/sim/flower.test.ts` (create), `tests/unit/sim/history.test.ts` (extend)

**Requirements:**
- `FLOWER = 10`; in `isSolid`; **not** in `isPowder`; **no step branch at all** — an element the dispatch chain doesn't match is static, exactly like the top of a grass blade. It never moves, never falls.
- Spawn: in `step.ts`'s existing grass-water-absorb path (read the code — where grass drinks and `grassCooldown` is set): when the absorbing grass cell's `grassHeight ≥ 2` and the cell directly above is `EMPTY`, a 1-in-6 chance sets that cell to `FLOWER` with `hues = randomHue()`. Flowers only ever *grow* — there is no flower tool, which is the point: watering the garden makes magic happen.
- Colour: `FLOWER_COLORS` in `palette.ts` — 5–6 pastels (pinks, lilac, white, soft yellow), indexed `hue % len`, branch in `colorFor` before the fallback.
- **History (the trap):** extend the `RAINBOW_SAND || GUMDROP` ternaries to include `FLOWER` in `captureWorldState`, `restoreWorldState`, `worldMatches`, **and** the `visibleSnapshot` helper inside `history.test.ts`. The persistence codec inherits this via `captureWorldState` — assert it anyway.
- Eraser clears flowers via the generic path (verify, don't assume). Star power, scenes, wand: no special handling.

**Test scenarios:** a watered grass column eventually (bounded frames, seeded/looped) grows a `FLOWER` above it; a flower never moves across 200 steps and sand rests on it; no flower spawns without water absorption; flower hue survives an undo/redo round trip (the trap test); flower hue survives serialize/deserialize; eraser removes it.

- [ ] Steps: RED → implement → GREEN → full verify → commit `feat: watered grass grows flowers`

---

### Task 8: The constitution catches up, and the docs

**Files:**
- Modify: `.specify/memory/constitution.md`, `README.md`

**Requirements:**
- The constitution still describes the upstream project. Rewrite the **product** sections for Madison's fork (this closes a dropped item from Phase 1): named for Madison; element set now includes gumdrops and flowers (flowers justified here as the sanctioned new element — they grow rather than being drawn, keeping the toolbar small); entities (poodle) and objects (palm, flamingo) listed; sound is synthesized only, always mutable, never load-bearing (the game is fully playable silent); the world persists locally and only locally (nothing leaves the device except a photo she explicitly shares); photo sharing exists only where the platform offers a share sheet. **Engineering principles I–V stay verbatim** — single file, no reading, no failure states, performance, no browser harness. Note the one deliberate upstream divergence (history survives re-derivation) with its rationale.
- README: a short "What's in Madison's version" list; mention the 🔇 button and the 📷 button; keep the Guided Access section and upstream credit intact.
- Doc-only; no tests. Commit `docs: Madison's constitution`.

---

## Verification

`npm test && npm run build`; dist grep for external refs = 0. **Eyeball/ear checks:** sounds are gentle and mutable, mute persists; reload restores her world including poodles; two-finger painting draws two strokes and one undo removes both; each animal reacts to a poke; the bored poodle wanders and comes when called afterwards; flowers appear over watered grass and read as distinct from grass and gumdrops; 📷 shares a crisp big PNG on the iPad and is absent on desktop; everything still runs from `file://`.
