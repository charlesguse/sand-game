<script lang="ts">
  import { onMount } from 'svelte';
  import {
    BRUSH_RADII,
    OBJECT_FOOTPRINT_SIZE,
    RESIZE_SETTLE_MS,
    isPhoneSized,
    computePlayField,
  } from './layout';
  import { createGrid, clearGrid as clearGridState } from '../sim/grid';
  import { resizeGrid } from '../sim/resize';
  import { loadScene as loadSceneState } from '../sim/scenes';
  import { HistoryManager, restoreWorldState, remapWorldState } from '../sim/history';
  import { serializeWorld, deserializeWorld, resyncNextId } from '../sim/save';
  import { step } from '../sim/step';
  import { applyBrush, applyBrushLine } from '../sim/brush';
  import { applyWand, applyWandLine, unicornsTouchedByWandLine } from '../sim/wand';
  import { createFlashMask, updateFlashMask } from './sparkle';
  import { randomShade } from '../sim/shade';
  import {
    createObjectsState,
    placeObject,
    applyRainbowConversions,
    isUnicornTouched,
    eraseObjectsInBrush,
    eraseObjectsInBrushLine,
    clearObjects,
    OBJECT_KINDS,
  } from '../sim/objects';
  import {
    createPetsState,
    addPoodle,
    stepPets,
    clearPets,
    repositionPoodles,
    pokePoodleAt,
    type PoodleState,
  } from '../sim/pets';
  import {
    type Particle,
    PARTICLE_LIFETIME_MS,
    spawnBurst,
    spawnIdleSparkle,
    tickParticles,
  } from './particles';
  import {
    EMPTY,
    OBJECT,
    type Grid,
    type ObjectKind,
    type PlacedObject,
    type Tool,
    type BrushSize,
    type SceneId,
  } from '../sim/types';
  import { colorFor } from './palette';
  import {
    initSoundOnGesture,
    playPour,
    playPop,
    playBloop,
    playWobble,
    playWhoosh,
    playSweep,
    playChime,
    playTrill,
    type PourKind,
  } from './sound';

  interface Props {
    tool: Tool;
    brushSize: BrushSize;
    onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  }

  let { tool, brushSize, onHistoryChange }: Props = $props();

  const objectsState = createObjectsState();
  const petsState = createPetsState();
  let poodleTarget: { x: number; y: number } | null = null;
  const history = new HistoryManager();
  const particles: Particle[] = [];

  const OBJECT_GLYPHS: Record<ObjectKind, string> = {
    rainbow: '🌈',
    unicorn: '🦄',
    palm: '🌴',
    flamingo: '🦩',
  };
  const PALM_SWAY_RADIANS = 0.06;
  const PALM_SWAY_SPEED = 0.0011;
  const FLAMINGO_BOB_SPEED = 0.0016;
  const FLAMINGO_BOB_PIXELS = 2.5;

  const BURST_COOLDOWN_MS = 2000;
  const IDLE_INTERVAL_MS = 5000;
  const WAND_BURST_COOLDOWN_MS = 2000;
  const WAND_BURST_COUNT = 18; // 3x the ordinary touch celebration's burst size
  const unicornTimers = new Map<
    number,
    { lastBurstAt: number; lastIdleAt: number; lastWandBurstAt: number }
  >();

  // Poke reactions (Task 4): how long a poked flamingo hops / palm shivers, and when each
  // object's reaction started — keyed by object id, swept of expired entries every frame
  // (an entry for an erased object simply expires; drawObjectGlyph never sees dead ids).
  const POKE_REACTION_MS = 600;
  const flamingoHopAt = new Map<number, number>();
  const palmShiverAt = new Map<number, number>();
  // 💖-heavy pool for the tricking poodle's per-frame burst.
  const TRICK_GLYPHS: ReadonlyArray<'✨' | '💖' | '🎉'> = ['💖', '💖', '💖', '✨'];

  // Which brush strokes count as "pouring" a material (as opposed to the eraser, which also
  // runs through applyBrush/applyBrushLine but isn't a pour) — see playPour's call sites below.
  const POUR_TOOLS = new Set<Tool>(['sand', 'water', 'dirt', 'gumdrop', 'grass', 'star']);
  function isPourTool(t: Tool): t is PourKind {
    return POUR_TOOLS.has(t);
  }

  // Tracks each poodle's state from the previous frame so playBloop/playWobble fire once on
  // entry into 'eating'/'shaking' rather than every frame for the whole 20/30-frame duration
  // (spawnBurst below is deliberately per-frame for the sparkle visuals; sound is not).
  const poodlePrevState = new Map<number, PoodleState>();

  const SAVE_KEY = 'madisons-sand-world-v1';
  const SAVE_DEBOUNCE_MS = 2000;

  let container: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let grid: Grid;
  let imageData: ImageData;
  let flashMask: Uint8Array;
  // One entry per active pointer (finger), each holding that pointer's last painted grid
  // position — lets every finger paint its own continuous stroke independently (Task 3).
  const strokes = new Map<number, { x: number; y: number }>();
  let displayWidth = $state(0);
  let displayHeight = $state(0);

  function measureField() {
    const viewportW = window.visualViewport?.width ?? window.innerWidth;
    const viewportH = window.visualViewport?.height ?? window.innerHeight;
    const isPhone = isPhoneSized(viewportW, viewportH);
    return computePlayField(container.clientWidth, container.clientHeight, isPhone);
  }

  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  // Every localStorage touchpoint is wrapped so a quota or privacy failure is silent — the
  // game must be indistinguishable from today when storage is unavailable (no dialogs, no
  // thrown errors reaching the frame loop).
  function saveNow(): void {
    try {
      const json = serializeWorld(grid, objectsState, petsState);
      if (json === '') return; // serializeWorld failed internally; keep whatever save exists
      localStorage.setItem(SAVE_KEY, json);
    } catch {
      // Storage unavailable (private mode, quota). Silent — nothing the child does is ever wrong.
    }
  }

  function scheduleSave(): void {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, SAVE_DEBOUNCE_MS);
  }

  function handleVisibilityHidden(): void {
    if (document.visibilityState === 'hidden') saveNow();
  }

  // Restores a saved world onto the just-created grid, before the first frame. Best-effort and
  // silent: any failure (missing key, corrupt payload, shape refusal) leaves the fresh grid
  // exactly as it was, with no error surfaced.
  function tryRestore(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw === null) return;

      const saved = deserializeWorld(raw);
      if (saved === null) return;

      let state = saved.state;
      // Same anchor resizeGrid uses, so a restored world lines up the same way live
      // re-derivation does. Best-effort carry — loss acceptable here (unlike undo).
      const offsetX = Math.round((grid.width - saved.width) / 2);
      const offsetY = grid.height - saved.height;
      if (saved.width !== grid.width || saved.height !== grid.height) {
        state = remapWorldState(state, saved.width, saved.height, grid.width, grid.height, offsetX, offsetY);
      }

      if (!restoreWorldState(grid, objectsState, state)) return;

      // restoreWorldState deliberately leaves objectsState.nextId untouched (undo/redo needs it
      // to keep climbing across restores). A fresh mount's ObjectsState starts nextId at 0,
      // which would collide with whatever ids the just-restored objects still carry — resync it
      // past the highest restored id so the next placed object never reuses one.
      resyncNextId(objectsState);

      clearPets(petsState);
      for (const poodle of saved.poodles) addPoodle(petsState, poodle.x, poodle.y);
      // Saved coordinates belong to the saved dimensions: shift them by the same offset the
      // terrain just got, and clamp back in bounds (deserializeWorld accepts any finite coords)
      // — otherwise a landscape-save opened in portrait strands poodles outside the grid where
      // they can never walk back in. Offsets are 0 when dims match, leaving just the clamp.
      repositionPoodles(petsState.poodles, grid, offsetX, offsetY);

      // History starts empty after a restore — the restored world is the new baseline.
      history.reset();
      onHistoryChange?.(history.canUndo(), history.canRedo());
    } catch {
      // Silent restore failure — start fresh exactly as if there were no save.
    }
  }

  // Repositions obj by (offsetX, offsetY), re-stamping its OBJECT footprint into newGrid only if
  // the entire offset footprint fits; drops it from the returned list otherwise (never clipped).
  function repositionObjects(
    list: PlacedObject[],
    newGrid: Grid,
    offsetX: number,
    offsetY: number,
  ): PlacedObject[] {
    const kept: PlacedObject[] = [];
    for (const obj of list) {
      const x = obj.x + offsetX;
      const y = obj.y + offsetY;
      if (x < 0 || x + obj.size > newGrid.width || y < 0 || y + obj.size > newGrid.height) continue;
      for (let py = y; py < y + obj.size; py++) {
        for (let px = x; px < x + obj.size; px++) {
          newGrid.elements[py * newGrid.width + px] = OBJECT;
        }
      }
      kept.push({ ...obj, x, y });
    }
    return kept;
  }

  function resize(): void {
    const field = measureField();

    if (field.gridWidth === grid.width && field.gridHeight === grid.height) {
      // Not a re-derivation (FR-025): only the canvas's CSS display size changes.
      displayWidth = field.displayWidth;
      displayHeight = field.displayHeight;
      return;
    }

    // Re-derivation (FR-026): swap to a freshly resized grid, carrying content at a fixed
    // bottom-centre-anchored offset.
    const oldWidth = grid.width;
    const oldHeight = grid.height;
    const { grid: newGrid, offsetX, offsetY } = resizeGrid(grid, field.gridWidth, field.gridHeight);
    for (const kind of OBJECT_KINDS) {
      objectsState.byKind[kind] = repositionObjects(objectsState.byKind[kind], newGrid, offsetX, offsetY);
    }
    repositionPoodles(petsState.poodles, newGrid, offsetX, offsetY);

    grid = newGrid;
    canvas.width = grid.width;
    canvas.height = grid.height;
    imageData = ctx.createImageData(grid.width, grid.height);
    flashMask = createFlashMask(grid.width, grid.height);
    displayWidth = field.displayWidth;
    displayHeight = field.displayHeight;

    if (strokes.size > 0) {
      // End every in-progress stroke cleanly rather than continuing it across the swap
      // (FR-028), discarding rather than committing — history.remap below already nulls out
      // any pending capture, so this is purely resetting the pointer-tracking state to match.
      strokes.clear();
    }

    // Upstream's FR-022 discards the undo/redo history on every re-derivation — a call made when
    // re-derivation only ever happened on a physical device rotation. This fork's fullscreen
    // button turns re-derivation into a one-tap control right next to Undo, and Madison rotates
    // the iPad (or taps fullscreen) constantly, so wiping history there makes Undo useless. We
    // deliberately diverge from FR-022: remap every stored WorldState to the new grid dimensions
    // instead of discarding them. Do not "fix" this back to history.reset().
    history.remap(oldWidth, oldHeight, grid.width, grid.height, offsetX, offsetY);
    onHistoryChange?.(history.canUndo(), history.canRedo());
  }

  let resizeTimer: ReturnType<typeof setTimeout> | undefined;

  function scheduleResize(): void {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, RESIZE_SETTLE_MS);
  }

  function drawObjectGlyph(obj: PlacedObject): void {
    ctx.font = `${obj.size}px sans-serif`;
    const cx = obj.x + obj.size / 2;
    const cy = obj.y + obj.size / 2;

    if (obj.kind === 'flamingo') {
      const bob = Math.sin(lastFrameNow * FLAMINGO_BOB_SPEED + obj.id) * FLAMINGO_BOB_PIXELS;
      // A poked flamingo hops: an extra bounce whose phase is anchored to the poke time, so it
      // starts from zero (no visual jump) and completes a couple of hops over the reaction.
      const hopStart = flamingoHopAt.get(obj.id);
      const hop =
        hopStart !== undefined && lastFrameNow - hopStart < POKE_REACTION_MS
          ? -Math.abs(Math.sin((lastFrameNow - hopStart) * 0.012)) * 6
          : 0;
      ctx.fillText(OBJECT_GLYPHS[obj.kind], cx, cy + bob + hop);
      return;
    }

    if (obj.kind !== 'palm') {
      ctx.fillText(OBJECT_GLYPHS[obj.kind], cx, cy);
      return;
    }

    const baseY = obj.y + obj.size;
    // A poked palm shivers: a fast extra wiggle on top of the slow ambient sway, phase-anchored
    // to the poke so it fades in from zero rather than snapping.
    const shiverStart = palmShiverAt.get(obj.id);
    const shiver =
      shiverStart !== undefined && lastFrameNow - shiverStart < POKE_REACTION_MS
        ? Math.sin((lastFrameNow - shiverStart) * 0.05) * 0.12
        : 0;
    const angle = Math.sin(lastFrameNow * PALM_SWAY_SPEED + obj.id) * PALM_SWAY_RADIANS + shiver;
    ctx.save();
    ctx.translate(cx, baseY);
    ctx.rotate(angle);
    ctx.fillText(OBJECT_GLYPHS[obj.kind], 0, cy - baseY);
    ctx.restore();
  }

  function render(): void {
    const { width, height, elements, shades, hues, glitter, cloud } = grid;
    const data = imageData.data;
    for (let i = 0; i < width * height; i++) {
      const element = elements[i];
      const o = i * 4;
      if (element === EMPTY || element === OBJECT) {
        data[o] = 255;
        data[o + 1] = 255;
        data[o + 2] = 255;
        data[o + 3] = 255;
        continue;
      }
      let [r, g, b] = colorFor(element, shades[i], hues[i], cloud[i] === 1);
      if (glitter[i] === 1) {
        const shimmer = Math.sin(lastFrameNow * 0.006 + i) * 20;
        r = Math.max(0, Math.min(255, r + shimmer));
        g = Math.max(0, Math.min(255, g + shimmer));
        b = Math.max(0, Math.min(255, b + shimmer));
        if (flashMask[i] === 1) {
          r = Math.min(255, r + 60);
          g = Math.min(255, g + 60);
          b = Math.min(255, b + 60);
        }
      }
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const kind of OBJECT_KINDS) {
      for (const obj of objectsState.byKind[kind]) drawObjectGlyph(obj);
    }

    ctx.font = `${OBJECT_FOOTPRINT_SIZE}px sans-serif`;
    const livePoodleIds = new Set(petsState.poodles.map((p) => p.id));
    for (const id of poodlePrevState.keys()) {
      if (!livePoodleIds.has(id)) poodlePrevState.delete(id);
    }
    for (const poodle of petsState.poodles) {
      const wasState = poodlePrevState.get(poodle.id);
      if (poodle.state === 'eating') {
        spawnBurst(particles, poodle.x, poodle.y, lastFrameNow, 4);
        if (wasState !== 'eating') playBloop();
      } else if (poodle.state === 'shaking') {
        spawnBurst(particles, poodle.x, poodle.y, lastFrameNow, 2);
        if (wasState !== 'shaking') playWobble();
      } else if (poodle.state === 'tricking') {
        spawnBurst(particles, poodle.x, poodle.y, lastFrameNow, 2, TRICK_GLYPHS);
      } else if (poodle.state === 'trotting' && Math.random() < 0.08) {
        spawnIdleSparkle(particles, poodle.x, poodle.y, lastFrameNow);
      }
      poodlePrevState.set(poodle.id, poodle.state);

      ctx.save();
      ctx.translate(poodle.x, poodle.y);
      // A tricking poodle spins: her timer counts the trick down frame by frame, so flipping on
      // its 6-frame parity reads as a few full twirls over the trick's duration.
      const trickFlip = poodle.state === 'tricking' && Math.floor(poodle.timer / 6) % 2 === 1 ? -1 : 1;
      if (poodle.facing * trickFlip === -1) ctx.scale(-1, 1);
      ctx.fillText('🐩', 0, 0);
      ctx.restore();
    }

    ctx.font = `${OBJECT_FOOTPRINT_SIZE / 3}px sans-serif`;
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, 1 - (lastFrameNow - p.spawnedAt) / PARTICLE_LIFETIME_MS);
      ctx.fillText(p.glyph, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  function updateUnicorns(now: number): void {
    const liveIds = new Set(objectsState.byKind.unicorn.map((u) => u.id));
    for (const id of unicornTimers.keys()) {
      if (!liveIds.has(id)) unicornTimers.delete(id);
    }

    for (const unicorn of objectsState.byKind.unicorn) {
      const atX = unicorn.x + unicorn.size / 2;
      const atY = unicorn.y + unicorn.size / 2;
      const timers = unicornTimers.get(unicorn.id) ?? {
        lastBurstAt: -Infinity,
        lastIdleAt: now,
        lastWandBurstAt: -Infinity,
      };

      if (isUnicornTouched(grid, unicorn) && now - timers.lastBurstAt >= BURST_COOLDOWN_MS) {
        spawnBurst(particles, atX, atY, now);
        timers.lastBurstAt = now;
      }
      if (now - timers.lastIdleAt >= IDLE_INTERVAL_MS) {
        spawnIdleSparkle(particles, atX, atY, now);
        timers.lastIdleAt = now;
      }

      unicornTimers.set(unicorn.id, timers);
    }
  }

  let lastFrameNow = 0;

  // Drops finished poke reactions. An entry whose object was meanwhile erased simply expires
  // here too — drawObjectGlyph only ever reads entries for objects that still exist.
  function sweepPokeReactions(now: number): void {
    for (const [id, at] of flamingoHopAt) {
      if (now - at >= POKE_REACTION_MS) flamingoHopAt.delete(id);
    }
    for (const [id, at] of palmShiverAt) {
      if (now - at >= POKE_REACTION_MS) palmShiverAt.delete(id);
    }
  }

  function frame(now: number): void {
    lastFrameNow = now;
    step(grid);
    stepPets(grid, petsState, poodleTarget);
    applyRainbowConversions(grid, objectsState.byKind.rainbow);
    updateUnicorns(now);
    sweepPokeReactions(now);
    tickParticles(particles, now);
    updateFlashMask(grid, flashMask);
    render();
    requestAnimationFrame(frame);
  }

  function clientToGrid(clientX: number, clientY: number): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const scaleX = grid.width / rect.width;
    const scaleY = grid.height / rect.height;
    return {
      x: Math.floor((clientX - rect.left) * scaleX),
      y: Math.floor((clientY - rect.top) * scaleY),
    };
  }

  // The unicorn's big celebration burst, cooldown-gated per unicorn — shared by the wand's
  // touch path and a direct poke (Task 4 reuses this exact path by design).
  function fireWandBurst(unicorn: PlacedObject, now: number): void {
    const timers = unicornTimers.get(unicorn.id) ?? {
      lastBurstAt: -Infinity,
      lastIdleAt: now,
      lastWandBurstAt: -Infinity,
    };
    if (now - timers.lastWandBurstAt >= WAND_BURST_COOLDOWN_MS) {
      spawnBurst(particles, unicorn.x + unicorn.size / 2, unicorn.y + unicorn.size / 2, now, WAND_BURST_COUNT);
      timers.lastWandBurstAt = now;
    }
    unicornTimers.set(unicorn.id, timers);
  }

  // `from` is this pointer's own last painted position (or null on its first paint) — passed in
  // by the caller rather than read off shared state, so concurrent pointers never see each
  // other's line continuations.
  function paintAt(pos: { x: number; y: number }, from: { x: number; y: number } | null): void {
    const radius = BRUSH_RADII[brushSize];
    const shade = randomShade();
    if (tool === 'eraser') {
      if (from) {
        eraseObjectsInBrushLine(grid, objectsState, from, pos, radius);
      } else {
        eraseObjectsInBrush(grid, objectsState, pos.x, pos.y, radius);
      }
    }
    if (tool === 'wand') {
      const wandFrom = from ?? pos;
      if (from) {
        applyWandLine(grid, from, pos, radius);
      } else {
        applyWand(grid, pos.x, pos.y, radius);
      }
      playChime();
      const now = performance.now();
      for (const unicorn of unicornsTouchedByWandLine(objectsState, wandFrom, pos, radius)) {
        fireWandBurst(unicorn, now);
      }
    } else if (from) {
      applyBrushLine(grid, tool, from, pos, radius, shade);
      if (isPourTool(tool)) playPour(tool);
    } else {
      applyBrush(grid, tool, pos.x, pos.y, radius, shade);
      if (isPourTool(tool)) playPour(tool);
    }
  }

  // Ends one pointer's stroke: removes it from strokes, and only when that empties the map
  // (the last finger just lifted) commits the whole multi-finger scribble as a single undo step.
  function endStroke(pointerId: number): void {
    if (!strokes.delete(pointerId)) return;
    if (strokes.size === 0) {
      history.commitAction(grid, objectsState);
      scheduleSave();
      onHistoryChange?.(history.canUndo(), history.canRedo());
    }
  }

  // Force-ends every active stroke at once (still exactly one commit, same as endStroke's final
  // pointer case) — used where another action is about to begin its own history entry and any
  // in-progress finger paint must be settled first, no matter how many fingers are down.
  function endAllStrokes(): void {
    if (strokes.size === 0) return;
    strokes.clear();
    history.commitAction(grid, objectsState);
    scheduleSave();
    onHistoryChange?.(history.canUndo(), history.canRedo());
  }

  // The placed object whose footprint contains the point, or null. First match wins; footprints
  // rarely overlap and any of the overlapping objects is a fine poke target.
  function objectAtPoint(pos: { x: number; y: number }): PlacedObject | null {
    for (const kind of OBJECT_KINDS) {
      for (const obj of objectsState.byKind[kind]) {
        if (pos.x >= obj.x && pos.x < obj.x + obj.size && pos.y >= obj.y && pos.y < obj.y + obj.size) {
          return obj;
        }
      }
    }
    return null;
  }

  function handlePointerDown(event: PointerEvent): void {
    initSoundOnGesture();
    // Defensive: a stray second pointerdown for the same id with no pointerup in between
    // (browser quirk) — settle that pointer's old stroke before starting whatever comes next.
    endStroke(event.pointerId);
    const pos = clientToGrid(event.clientX, event.clientY);
    poodleTarget = pos;
    // Poke check (Task 4), before any painting or placing: a tap that lands on an animal is a
    // poke with every tool except the eraser — the eraser must keep erasing objects, so it
    // passes straight through. A poked pointer never enters the stroke map and places nothing.
    if (tool !== 'eraser') {
      if (pokePoodleAt(petsState, pos.x, pos.y)) {
        // The trick's 💖 burst is spawned per-frame off the 'tricking' state in render(),
        // the same way eating and shaking spawn theirs.
        playTrill();
        return;
      }
      const poked = objectAtPoint(pos);
      if (poked !== null) {
        const now = performance.now();
        if (poked.kind === 'unicorn') {
          fireWandBurst(poked, now);
        } else if (poked.kind === 'flamingo') {
          flamingoHopAt.set(poked.id, now);
        } else if (poked.kind === 'palm') {
          palmShiverAt.set(poked.id, now);
        } else {
          spawnBurst(particles, poked.x + poked.size / 2, poked.y + poked.size / 2, now);
        }
        playTrill();
        return;
      }
    }
    if (tool === 'poodle') {
      addPoodle(petsState, pos.x, pos.y);
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    if (tool === 'rainbow' || tool === 'unicorn' || tool === 'palm' || tool === 'flamingo') {
      // Another finger may still be mid-paint (tool switched under it). Its action is pending in
      // history; beginAction below would silently overwrite that capture and swallow the paint
      // stroke's undo step. Settle all strokes first — placement ends the scribble, as it always
      // did in the single-pointer code.
      endAllStrokes();
      history.beginAction(grid, objectsState);
      placeObject(grid, objectsState, tool, pos.x, pos.y);
      history.commitAction(grid, objectsState);
      playPop();
      scheduleSave();
      onHistoryChange?.(history.canUndo(), history.canRedo());
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    if (strokes.size === 0) {
      history.beginAction(grid, objectsState);
    }
    strokes.set(event.pointerId, pos);
    paintAt(pos, null);
    canvas.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent): void {
    const pos = clientToGrid(event.clientX, event.clientY);
    poodleTarget = pos;
    const from = strokes.get(event.pointerId);
    if (from === undefined) return;
    paintAt(pos, from);
    strokes.set(event.pointerId, pos);
  }

  function handlePointerUp(event: PointerEvent): void {
    endStroke(event.pointerId);
  }

  export function clearAll(): void {
    endAllStrokes();
    history.beginAction(grid, objectsState);
    clearGridState(grid);
    clearObjects(objectsState);
    clearPets(petsState);
    particles.length = 0;
    history.commitAction(grid, objectsState);
    playSweep();
    scheduleSave();
    onHistoryChange?.(history.canUndo(), history.canRedo());
  }

  export function loadScene(sceneId: SceneId): void {
    endAllStrokes();
    history.beginAction(grid, objectsState);
    loadSceneState(sceneId, grid, objectsState);
    clearPets(petsState);
    particles.length = 0;
    history.commitAction(grid, objectsState);
    scheduleSave();
    onHistoryChange?.(history.canUndo(), history.canRedo());
  }

  export function undo(): void {
    endAllStrokes();
    history.undo(grid, objectsState);
    playWhoosh();
    // Undo changes the world like any stroke does: without this, the persisted save can keep
    // the pre-undo picture until some later commit happens to schedule one.
    scheduleSave();
    onHistoryChange?.(history.canUndo(), history.canRedo());
  }

  export function redo(): void {
    endAllStrokes();
    history.redo(grid, objectsState);
    playWhoosh();
    scheduleSave();
    onHistoryChange?.(history.canUndo(), history.canRedo());
  }

  /**
   * Renders the picture to a big crisp PNG and hands it to the platform share sheet. Only ever
   * called when App's canShare probe succeeded (the 📷 button is absent otherwise). Nothing in
   * here may surface an error: a rejected share (she cancelled the sheet, or iOS declined) is
   * not an error, and every other failure is silently dropped the same way.
   *
   * Known platform caveat: navigator.share runs after the async toBlob, and WebKit's transient
   * user-activation window can lapse if toBlob is slow, rejecting with NotAllowedError — which
   * this catch then swallows, making the tap a silent no-op on such devices. Eyeball-check the
   * share sheet actually appearing on the target iPad; there is no in-scope way to pre-render.
   */
  export async function sharePhoto(): Promise<void> {
    try {
      const scale = 4;
      const photo = document.createElement('canvas');
      photo.width = grid.width * scale;
      photo.height = grid.height * scale;
      const photoCtx = photo.getContext('2d');
      if (photoCtx === null) return;
      photoCtx.imageSmoothingEnabled = false;
      photoCtx.fillStyle = '#ffffff';
      photoCtx.fillRect(0, 0, photo.width, photo.height);
      photoCtx.drawImage(canvas, 0, 0, photo.width, photo.height);
      const blob = await new Promise<Blob | null>((resolve) => photo.toBlob(resolve, 'image/png'));
      if (blob === null) return;
      const file = new File([blob], 'madisons-sand.png', { type: 'image/png' });
      await navigator.share({ files: [file] });
    } catch {
      // Cancelled or declined — silent, always.
    }
  }

  onMount(() => {
    ctx = canvas.getContext('2d')!;
    const field = measureField();
    grid = createGrid(field.gridWidth, field.gridHeight);
    canvas.width = grid.width;
    canvas.height = grid.height;
    imageData = ctx.createImageData(grid.width, grid.height);
    flashMask = createFlashMask(grid.width, grid.height);
    displayWidth = field.displayWidth;
    displayHeight = field.displayHeight;
    tryRestore();
    const observer = new ResizeObserver(scheduleResize);
    observer.observe(container);
    window.visualViewport?.addEventListener('resize', scheduleResize);
    window.addEventListener('orientationchange', scheduleResize);
    document.addEventListener('visibilitychange', handleVisibilityHidden);
    window.addEventListener('pagehide', saveNow);
    requestAnimationFrame(frame);
    return () => {
      clearTimeout(resizeTimer);
      clearTimeout(saveTimer);
      observer.disconnect();
      window.visualViewport?.removeEventListener('resize', scheduleResize);
      window.removeEventListener('orientationchange', scheduleResize);
      document.removeEventListener('visibilitychange', handleVisibilityHidden);
      window.removeEventListener('pagehide', saveNow);
    };
  });
</script>

<div bind:this={container} class="play-area-container">
  <canvas
    bind:this={canvas}
    style="width: {displayWidth}px; height: {displayHeight}px;"
    class="play-area"
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerUp}
  ></canvas>
</div>

<style>
  .play-area-container {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(180deg, #ffffff 55%, #fbf1f9);
  }

  .play-area {
    display: block;
    image-rendering: pixelated;
    touch-action: none;
    box-shadow: 0 6px 24px rgba(90, 61, 102, 0.1);
  }
</style>
