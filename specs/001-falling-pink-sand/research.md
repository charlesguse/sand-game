# Phase 0 Research: Falling Pink Sand

The spec contains no `[NEEDS CLARIFICATION]` markers. This research resolves
the remaining *implementation-technology* unknowns needed to fill Technical
Context and unblock Phase 1 design. Several of these are decisions the spec
deliberately left as "implementation choice" (see spec Assumptions); they are
called out below and again in the issue comment as decisions made without
a clarification round.

## 1. Grid data structure

- **Decision**: A single `Uint8ClampedArray` of length `width * height`, one
  byte per cell: `0` = empty, `1–255` = grain present, value encodes the
  grain's shade index.
- **Rationale**: One flat typed array is allocation-free to read/write in the
  hot loop, trivially satisfies "grains carry their shade as they move"
  (FR-012) by copying the byte itself, and needs no second parallel array or
  object per grain.
- **Alternatives considered**: Two parallel arrays (`occupied: Uint8Array` +
  `shade: Uint8Array`) — rejected, doubles memory traffic for no benefit
  since occupancy and shade always change together. Array of grain objects —
  rejected, allocates per grain and defeats Principle IV.

## 2. Default grid dimensions

- **Decision**: 270 × 160 cells (270 "across", aspect ratio 27:16 ≈ 1.69,
  close to common laptop/tablet-landscape aspect ratios).
- **Rationale**: Falls inside the spec's "roughly 250–300 cells across"
  default (FR-005, Assumptions) and gives a landscape shape that letterboxes
  cleanly on both laptop (16:9/16:10) and tablet-landscape (4:3-ish)
  viewports.
- **Alternatives considered**: A square grid — rejected, wastes horizontal
  space or lets height dominate depending on device. Exactly 300×300 —
  rejected as oversized relative to the "≥30fps, half-full grid" performance
  budget; shrink-toward-200 is the spec's own escape hatch if profiling shows
  risk (Assumptions), so starting nearer the low end of the range leaves
  headroom.
- **Flag**: made without a clarification round; easy to retune (single
  constant) if the maintainer prefers different proportions.

## 3. Canvas backing resolution and render path

- **Decision**: The `<canvas>` backing store is exactly `width × height`
  pixels (one device pixel per cell). Each simulation step writes an
  `ImageData` buffer sized to match and calls `putImageData` once per frame.
  CSS scales the canvas element up to its on-screen size with
  `image-rendering: pixelated`.
- **Rationale**: Matches constitution Principle IV's explicit guidance
  ("render via `putImageData` or equivalent"); one pixel per cell means the
  simulation grid *is* the image buffer, so there is no separate
  cell-to-pixel mapping step in the hot path. Chunky, crisply-visible grains
  are also appropriate for the target user (spec: "grains stay individually
  visible").
- **Alternatives considered**: Draw each grain as a scaled `fillRect` —
  rejected, O(occupied cells) draw calls per frame is far slower than one
  `putImageData` call at this grid size. WebGL — rejected as unjustified
  complexity/dependency for a 270×160 grid (Principle III).
- **Flag**: made without a clarification round.

## 4. Simulation step order (fall / slide / rest)

- **Decision**: Iterate rows bottom-to-top (excluding the bottom row, which
  can't fall further), and within a row iterate left-to-right but read from
  the *previous* tick's snapshot for that row and below while writing into
  the same buffer in place, since a bottom-up scan never re-reads a cell it
  has already moved a grain into this tick. For the diagonal tie-break when
  both below-left and below-right are empty, use `Math.random() < 0.5`.
- **Rationale**: Bottom-up in-place scanning is the standard falling-sand
  approach — it lets a single mutable grid satisfy FR-006–FR-010 without a
  double-buffer allocation per tick (Principle IV). `Math.random()` is
  sufficient because FR-007 only requires the choice be random, not
  reproducible; unit tests validate the rule structurally (a moved grain
  always lands in an available diagonal cell) rather than pinning an exact
  seed.
- **Alternatives considered**: Double-buffered grid (read from old, write to
  new) — rejected, doubles memory traffic and allocates a second buffer per
  tick for no rule benefit here. Seeded PRNG for deterministic tests —
  rejected as unneeded complexity; tests can run many trials or temporarily
  stub `Math.random` instead.

## 5. Pointer/touch input handling

- **Decision**: Use the Pointer Events API (`pointerdown`/`pointermove`
  /`pointerup`/`pointercancel`) on the canvas element, with
  `element.setPointerCapture(event.pointerId)` on `pointerdown` and
  `touch-action: none` in CSS on the play area.
- **Rationale**: Pointer Events unify mouse and touch handling behind one
  code path (FR-016), `touch-action: none` is the standards-based way to
  suppress scroll/pan/pinch-zoom/double-tap-zoom during drawing (FR-017,
  SC-004), and pointer capture keeps a drag tracked even if the pointer
  leaves the canvas bounds or the window (edge case: "pointer released
  outside the window").
- **Alternatives considered**: Separate `mouse*`/`touch*` listeners —
  rejected, doubles the event-handling code and is exactly what Pointer
  Events was introduced to replace.

## 6. Continuous stroke deposition (no gaps)

- **Decision**: On every pointer move, convert both the previous and current
  client coordinates to grid cells, then walk a Bresenham line between them
  and apply the brush footprint at each intermediate cell.
- **Rationale**: Directly satisfies FR-014 and SC-005 ("no gaps between
  sampled positions, even during a fast drag") without needing a higher
  event sampling rate, which the browser doesn't guarantee anyway.
- **Alternatives considered**: Only applying the brush at each raw pointer
  event — rejected, explicitly fails the fast-drag edge case in the spec.

## 7. Brush footprint and sizes

- **Decision**: Circular footprint via squared-distance test
  (`dx*dx + dy*dy <= r*r`). Radii: small = 2 cells (diameter 5), medium = 5
  cells (diameter 11, default per FR-023), large = 9 cells (diameter 19) —
  large is ~3.8× the small footprint's width, inside the spec's "roughly
  4–5×" guidance (Assumptions).
- **Rationale**: A circle is the simplest footprint that still reads as a
  "brush" and needs no shape asset. The three radii are visually and
  functionally distinct at the chosen grid resolution.
- **Alternatives considered**: Square/diamond brush — rejected, a circle
  looks more like a "pour" and is what the spec's brush-size button glyphs
  (round, increasing size) already imply.
- **Flag**: exact radii made without a clarification round; spec explicitly
  allows this ("exact values are an implementation choice as long as SC-005
  and FR-025 hold" — Assumptions).

## 8. Sand tool application rate

- **Decision**: While pressed, the sand tool re-applies "fill every currently
  empty cell in the brush footprint" once per animation frame (same cadence
  as the simulation step), not gated by any additional timer.
- **Rationale**: Because the tool only fills cells that are still empty
  (FR-018), a stationary brush fills its own footprint within a few frames
  and then stalls — new sand only appears as filled cells at the footprint's
  lower edge free up by falling away. That naturally produces a "stream"
  bounded by the brush size without a separate pour-rate constant, matching
  the spec's "large brush does not instantly fill the screen" assumption.
- **Alternatives considered**: A fixed grains-per-second budget independent
  of frame rate — rejected as an unnecessary second tunable; frame-rate-tied
  application is simpler and self-limiting given FR-018's "only into empty
  cells" constraint.

## 9. Viewport scaling and letterboxing

- **Decision**: On load and on `resize`, compute
  `scale = min(viewportW / gridW, viewportH / gridH)`, set the canvas
  element's CSS `width`/`height` to `gridW*scale`/`gridH*scale`, and center
  it in its container with flexbox (auto margins produce the letterbox
  bars). Pointer-to-cell mapping divides `(clientX/Y - canvasRect.left/top)`
  by the same `scale`.
- **Rationale**: This is the standard "contain" scaling strategy, keeps the
  grid's aspect ratio fixed (FR-034), and needs no grid resize or data
  migration — only the CSS presentation changes (FR-033). Reusing `scale`
  for pointer mapping keeps drawing accurate after any resize (FR-035).
- **Alternatives considered**: CSS `object-fit: contain` directly on
  `<canvas>` — rejected because it would leave the backing-store size fixed
  at grid resolution while the *displayed* size is what CSS controls; the
  explicit scale factor is still needed for pointer mapping either way, so
  computing it once in JS is simpler than mixing two scaling mechanisms.

## 10. Svelte 5 reactivity boundary

- **Decision**: Tool selection, brush size, and any UI-facing derived state
  use Svelte 5 runes (`$state`). The grid (`Uint8ClampedArray`) and the
  `step`/`applyBrush` functions live entirely outside Svelte's reactivity —
  `PlayArea.svelte` holds a plain reference to the grid and drives
  `requestAnimationFrame` itself, calling into `src/sim/*` as plain function
  calls.
- **Rationale**: Directly implements constitution Principle III ("Svelte
  owns the UI shell... not the per-frame hot path"); wrapping a large typed
  array in Svelte's reactivity system would add proxy overhead to every cell
  access for no UI benefit (nothing about individual cells is rendered via
  Svelte bindings).
- **Alternatives considered**: Svelte stores/runes for grid state — rejected
  per Principle IV/V performance and testability goals — plain functions on
  a typed array are also what makes `vitest` testing possible with zero DOM.

## 11. Testing approach

- **Decision**: `vitest` with the default `node` test environment (no
  `jsdom`) for `tests/unit/sim/*`, calling `src/sim/*` functions directly on
  grid arrays. No Svelte component tests are added in this feature.
- **Rationale**: Satisfies constitution Principle V and FR-031/SC-009
  exactly — falling/sliding/resting rules (FR-006–FR-010) are pure functions
  of grid state, needing no DOM. Constitution explicitly says not to add
  browser-automation test infrastructure; component/visual behavior is a
  maintainer eyeball check per the spec's "Visual checks" section.
- **Alternatives considered**: `@testing-library/svelte` + `jsdom` for
  component tests — rejected as out of scope for this plan; would add
  dependencies and browser-shaped test infra the constitution and spec both
  steer away from.

## 12. Build tooling

- **Decision**: `vite` + `@sveltejs/vite-plugin-svelte` + `vite-plugin-singlefile`
  (`viteSingleFile()` plugin, applied last), TypeScript via `vite`'s native
  esbuild transform (no separate `tsc` build step; `tsc --noEmit` optionally
  used only for type-checking in CI, not for emitting).
- **Rationale**: This is the stack the constitution and README already
  mandate; `vite-plugin-singlefile` is purpose-built to inline all JS/CSS
  into one HTML file, directly satisfying FR-029/FR-030/SC-008.
- **Alternatives considered**: None — this is a constitution-mandated,
  non-negotiable choice (Principle I, III), not an open research question.

All Technical Context unknowns are resolved; nothing carries forward to
Phase 1 as unresolved.
