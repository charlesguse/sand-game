# Feature Specification: A Mermaid And Her Ice Cream

**Feature Branch**: `016-mermaid-ice-cream`

**Created**: 2026-09-07

**Status**: Draft

**Input**: Lifecycle issue #44 — "A mermaid to love, and ice cream she can't resist"

> ## What she asked for
>
> She's asked for a mermaid — there isn't one in the game yet — plus ice cream as
> her treat, mirroring how the poodle 🐩 already chases gumdrops 🍬:
>
> - 🧜 **Mermaid**: a new pet, placed and capped the same way poodles are. Unlike
>   a poodle she doesn't trot on solid ground — she swims/glides through water,
>   staying submerged, gently bobbing/drifting inside connected pools. If she ends
>   up somewhere with no water nearby she should behave gracefully rather than
>   getting stuck or looking broken.
> - 🍦 **Ice cream**: a new paintable element (like 🍬 gumdrop — poured with the
>   brush, not a placed object) that mermaids seek out and eat, using the same
>   scent/pursuit shape already used for gumdrops (bounded-window search,
>   patience/give-up, cooldown) adapted for swimming instead of walking.
> - Use the single-codepoint 🧜 (merperson, U+1F9DC) rather than a gendered ZWJ
>   variant (🧜‍♀️/🧜‍♂️), to avoid any risk of it splitting into two glyphs on older
>   emoji fonts.
> - No sound required; delight should come from the swimming/eating animation
>   itself.
>
> ## Reserved element ID
>
> The element ID list currently ends at flower = 10. **Ice cream MUST use
> grid-element ID 11.** A concurrently-filed feature (house/people/treasure
> chest/diamonds/stars) reserves IDs 12 and 13 — do not take those.
>
> ## Cross-cutting checklist (specs 010/011/013 exist because these got missed)
>
> Eraser, clear-all, save/restore, undo/redo, grid resize/rotate remap, the
> hue-colour predicate, and vitest coverage without a browser harness.
>
> ## Decisions the issue left open
>
> Toolbar cost of two new buttons; the mermaid cap (suggest 3); and whether she
> is confined to her spawning pool or free to roam connected water.
>
> Existing sand/water/poodle/gumdrop behavior must not regress.

## User Scenarios & Testing *(mandatory)*

Throughout this spec:

- A **mermaid** is a pet the child places by tapping the canvas, in the same way
  a poodle is placed today. She is not a grid element: she lives above the grid
  and is drawn over it, like the existing pets and objects.
- **Ice cream** is a paintable element: a substance the child pours onto the
  canvas with the brush, like sand or gumdrops. It occupies grid cells.
- A **pool** is a run of connected water cells — water cells that touch each
  other edge-to-edge, directly or through other water cells.
- **Swimming** means moving from one water cell to another water cell.
- **Reachable water** means water a mermaid can arrive at by swimming only,
  without ever occupying a cell that is not water.
- A **scent window** is a bounded square of cells around a mermaid that she
  searches for ice cream. Its size does not grow with the canvas.

### User Story 1 - A mermaid of her own, swimming in her pool (Priority: P1)

The child taps the mermaid button and taps the water. A mermaid appears in the
pool, under the surface, and drifts gently back and forth inside it — never
hopping out onto the sand, never sinking through the bottom, never freezing in
place. She can place a second and a third. If she taps the mermaid button and
taps somewhere with no water, nothing breaks: the mermaid either finds the water
just next to where she tapped, or waits calmly on the ground until the child
pours water on her, and then starts swimming. Tapping the mermaid herself makes
her do a happy little trick; tapping anywhere else just paints, so pouring water
never yanks her across the pool.

**Why this priority**: This is the thing she asked for. A mermaid that swims in
a pool is a complete, delightful toy on its own even before ice cream exists,
and everything else in this spec depends on her existing and behaving well.

**Independent Test**: Build a grid with a pool, place mermaids, advance the sim
for a few hundred frames in a plain unit test, and assert she is always in a
water cell, always inside the pool she started in, and that her position changes
over time. Repeat with no water at all, with a pool one cell wide, and with the
pool drained mid-run. Poke her cell and assert she enters her trick state; poke a
water cell away from her and assert her heading is unchanged. Whether the
drifting *feels* lovely is a maintainer eyeball check on a real device.

**Acceptance Scenarios**:

1. **Given** a pool of water, **When** the child places a mermaid on a water
   cell, **Then** a mermaid appears there and, over the following frames, moves
   between water cells of that pool without ever occupying a non-water cell.
2. **Given** a mermaid drifting in a pool, **When** many frames pass with no
   ice cream and no other input, **Then** she keeps making small unhurried moves
   inside the pool rather than standing still forever or leaving it.
3. **Given** three mermaids already placed, **When** the child places a fourth,
   **Then** there are still exactly three mermaids and the oldest one is the one
   that left — the same rule the poodles already follow.
4. **Given** the child places a mermaid on dry sand a few cells from a pool,
   **When** the placement happens, **Then** she ends up in that pool rather than
   stranded on the sand.
5. **Given** the child places a mermaid on a canvas with no water anywhere,
   **When** frames pass, **Then** she rests where she was placed — visible,
   whole, doing nothing alarming — and **When** the child later pours water over
   her, **Then** she starts swimming in the new pool.
6. **Given** a mermaid swimming in a pool, **When** the child pours sand into the
   pool and buries her, **Then** within a short time she is back in a water cell
   or resting on top of the sand, never invisible and never stuck inside solid
   material.
7. **Given** a mermaid swimming in a pool, **When** the water drains away
   entirely, **Then** she comes to rest on whatever is below her and resumes
   swimming when water returns.
8. **Given** a mermaid drifting in a pool, **When** the child taps directly on
   her with any tool but the eraser, **Then** she does a brief happy trick, the
   toy gives the poke feedback it already gives for a poked poodle, and that tap
   paints and places nothing.
9. **Given** a mermaid drifting in a pool, **When** the child taps or drags
   anywhere else — including elsewhere in her own water, and including pouring
   more water — **Then** she is not summoned: she keeps drifting or keeps
   pursuing whatever she was pursuing, and the tap paints as normal.
10. **Given** a mermaid who is eating or mid-trick, **When** the child pokes her,
    **Then** the poke is ignored and she finishes what she was doing.

---

### User Story 2 - Ice cream she can pour (Priority: P1)

The child taps the ice cream button and drags across the canvas. Ice cream pours
out of her finger in scoops of different flavour colours, at whichever brush size
she has chosen, exactly like gumdrops do — no reading, no menus, no way to get it
wrong.

**Why this priority**: The treat has to exist before it can be chased, and
pouring colourful ice cream is fun by itself.

**Independent Test**: Paint ice cream onto a grid at each brush size in a unit
test and assert the expected cells hold ice cream, that their flavour colours
survive a round trip through save/restore and undo/redo, that a poured cell falls
and comes to rest cell-for-cell the way a gumdrop poured in the same place does,
and that no other element's behaviour changed.

**Acceptance Scenarios**:

1. **Given** the ice cream tool is selected, **When** the child presses and drags
   on the canvas, **Then** ice cream cells appear continuously along the drag at
   the selected brush size.
2. **Given** ice cream has been poured, **When** the child looks at it, **Then**
   different scoops show different flavour colours drawn from the toy's joyful
   palette.
3. **Given** a world containing ice cream, **When** it is saved and restored,
   **Then** every un-eaten ice cream cell comes back in the same place **and in
   the same flavour colour**.
4. **Given** a world containing ice cream, **When** the child undoes and redoes,
   **Then** the ice cream cells and their flavour colours are exactly as they
   were.
5. **Given** ice cream on the canvas, **When** the child pours sand, water, dirt,
   grass, star power, gumdrops, or uses the wand, **Then** all of those elements
   behave exactly as they do today.
6. **Given** ice cream poured above a pool, **When** frames pass, **Then** it
   falls and comes to rest in the water exactly as a gumdrop would — it does not
   float to the surface — and it stays there un-melted until a mermaid eats it or
   the child erases it.
7. **Given** ice cream poured on dry land far from any water, **When** many
   frames pass, **Then** it simply rests there as decoration: it does not melt,
   does not move, and nothing about the toy looks broken for it being
   unreachable.

---

### User Story 3 - She swims for the ice cream (Priority: P1)

The child drops ice cream into the pool where her mermaid is swimming. The
mermaid notices, glides over to it, and eats it — the ice cream disappears with a
sparkle and she does a happy little beat before drifting on. If the child puts
ice cream somewhere the mermaid can't swim to, the mermaid tries for a while and
then goes back to drifting instead of pressing herself against a wall forever.

**Why this priority**: This is the second half of the wish and the whole reason
ice cream exists. It is also where the "pet gets stuck" failure mode lives, so
the give-up behaviour is part of the P1 slice, not a follow-up.

**Independent Test**: In a unit test, put a mermaid at one end of a pool and ice
cream at the other; advance frames and assert the ice cream cell becomes empty
within a bounded number of frames and the mermaid entered her eating state. Then
put ice cream outside the water, or behind a wall of sand, and assert she gives
up within a bounded number of frames and resumes ordinary drifting.

**Acceptance Scenarios**:

1. **Given** a mermaid in a pool and ice cream within her scent window in the
   same pool, **When** frames pass, **Then** she moves closer to it and
   eventually the ice cream cell is empty and she is in her eating state.
2. **Given** a mermaid mid-pursuit, **When** the ice cream is erased or covered
   before she arrives, **Then** she stops pursuing it and returns to drifting
   without any stuck or twitching state.
3. **Given** ice cream far outside her scent window, **When** frames pass,
   **Then** she does not react to it at all.
4. **Given** ice cream she cannot swim to — on dry land, in a different pool, or
   walled off — **When** she has tried for a while without getting closer,
   **Then** she gives up, ignores ice cream for a cooldown period, and drifts
   normally in the meantime.
5. **Given** several ice cream cells within range, **When** she eats one,
   **Then** she finishes her eating beat and may then pursue another.
6. **Given** a poodle and a mermaid on the same canvas with both gumdrops and ice
   cream, **When** frames pass, **Then** the poodle chases only gumdrops and the
   mermaid chases only ice cream.
7. **Given** she eats ice cream, **When** the eating happens, **Then** it is
   silent — no new sound is played, muted or not.

---

### User Story 4 - Nothing about her gets lost (Priority: P2)

Whatever the child does next — erasing, clearing everything, closing the tablet
and coming back tomorrow, undoing, or rotating the tablet — her mermaids and her
ice cream behave the way every other part of the toy already does.

**Why this priority**: These are the exact gaps that forced specs 010, 011, and
013 to exist. They are P2 only because the toy is demonstrable without them; they
are not optional for shipping.

**Independent Test**: Unit tests over the erase, clear, save/restore,
undo/redo, and grid-re-derivation paths asserting mermaid count/positions and ice
cream cells/colours before and after.

**Acceptance Scenarios**:

1. **Given** mermaids and ice cream on the canvas, **When** the child uses the
   eraser over them, **Then** the ice cream cells it touches are erased and a
   mermaid it touches is removed — the same reach and feel as erasing a poodle.
2. **Given** mermaids and ice cream on the canvas, **When** the child taps
   clear-all, **Then** both are gone along with everything else.
3. **Given** mermaids and ice cream on the canvas, **When** the toy is closed and
   reopened, **Then** the same number of mermaids come back in the same places
   and every un-eaten ice cream cell is restored.
4. **Given** mermaids and ice cream on the canvas, **When** the child rotates the
   tablet or toggles fullscreen and the play area is re-derived, **Then** no
   mermaid is lost — each is carried to the corresponding place in the new grid,
   clamped inside it if the corresponding place falls outside — and ice cream
   cells are remapped exactly like every other element.
5. **Given** a saved world from before this feature existed, **When** it is
   restored, **Then** the toy opens normally with no mermaids and no ice cream,
   and never shows an error.

---

### Edge Cases

- **A mermaid placed with no water anywhere**: she rests where she was placed on
  whatever surface is below her (or the floor), stays visible, and starts
  swimming as soon as water reaches her.
- **A mermaid placed near, but not in, water**: she is drawn into the nearest
  water within a bounded distance of the tap; beyond that distance she rests
  instead. She never walks across dry land to get there.
- **A pool exactly one cell wide, or one cell tall**: she stays in it, bobbing
  in place if there is nowhere to drift to; this is not a stuck state.
- **The pool she is in splits in two, or merges with another**: she keeps
  swimming in whatever water she is connected to at that moment. She never
  teleports between disconnected pools.
- **She is buried by sand, grass, gumdrops, or ice cream**: she frees herself
  within a bounded number of frames and never remains inside solid material.
- **Water drains from under her while she is mid-pursuit**: pursuit ends
  gracefully; she settles.
- **Ice cream poured directly onto her own cell**: she eats it rather than
  ignoring it or having it silently vanish.
- **Ice cream that ends up out of reach** (on dry land, on a mountain top, in a
  sealed pocket): she gives up on it and it simply stays there as decoration,
  un-melted, until the child pours water to it or erases it.
- **A poke that lands on a mermaid mid-pursuit**: she does her trick and then
  resumes the pursuit; the poke never becomes a paint stroke or a new
  destination.
- **A poke with the eraser selected**: erases her, exactly as FR-024 requires —
  the eraser is never a poke.
- **Three mermaids and three poodles at once, on the largest grid the toy uses**:
  the sim stays smooth.
- **Two new toolbar buttons on the smallest supported phone**: every control
  still meets the 44px touch floor and the drawing region still keeps its
  guaranteed share of the screen.
- **The mermaid glyph is missing from a platform's emoji font**: the control and
  the pet must still be recognisable, never an empty box.

## Requirements *(mandatory)*

### Functional Requirements

#### The mermaid

- **FR-001**: The toy MUST offer a mermaid control in the toolbar's pets/objects
  group; tapping it and then tapping the canvas places a mermaid, using the same
  gesture and feel as placing a poodle.
- **FR-002**: At most **3** mermaids MUST exist at once; placing another retires
  the oldest, matching the existing poodle cap behaviour.
- **FR-003**: The mermaid MUST be drawn using the single-codepoint merperson
  emoji 🧜 (U+1F9DC). A gendered zero-width-joiner variant (🧜‍♀️ / 🧜‍♂️) MUST NOT be
  used anywhere — toolbar control or canvas — because it can split into two
  glyphs on older emoji fonts.
- **FR-004**: A mermaid MUST move only between water cells. She MUST NOT occupy,
  cross, or come to rest in a non-water cell while reachable water exists.
- **FR-005**: A mermaid MUST stay submerged: while reachable water exists, her
  position is a water cell.
- **FR-006**: With nothing to pursue, a mermaid MUST drift: small, unhurried
  moves through the water around her, bounded to a limited range from where she
  settled, at a cadence slower than a poodle's trot. She MUST NOT stand
  perfectly still indefinitely while she has water to move in.
- **FR-007**: A mermaid MUST be confined to the water she is connected to. She
  MUST NOT cross dry land, empty space, or solid material to reach another pool.
- **FR-008**: When placed on a cell that is not water, a mermaid MUST be settled
  into the nearest water cell within a bounded search window around the tap. If
  there is none, she MUST rest at rest-position (on top of the first solid cell
  below her, or the floor) and MUST begin swimming as soon as her cell becomes
  water. She MUST NOT be refused, hidden, or removed for being placed out of
  water — there are no failure states.
- **FR-009**: If a mermaid's cell becomes solid material, she MUST return to a
  water or free cell within a bounded number of frames. She MUST NOT remain
  inside solid material, MUST NOT be deleted, and MUST NOT require the child to
  do anything to rescue her.
- **FR-010**: Every per-frame search a mermaid performs MUST be bounded by a
  fixed window that does not grow with canvas size, and the mermaid step MUST NOT
  allocate on the hot path.
- **FR-011**: A mermaid MUST react to a **direct poke only**. A tap that lands on
  the mermaid herself MUST make her do a brief happy trick — the same shape of
  reaction, and the same feedback the toy already gives when a poodle or a placed
  object is poked, so **no new sound is introduced** (FR-023) — and that tap MUST
  NOT also paint, place, or move anything. A tap anywhere else MUST NOT summon
  her: she MUST NOT swim toward taps, including taps that land in her own water,
  so ordinary painting can never drag her around. Ice cream is the only way the
  child steers her. A poke that arrives while she is already busy (eating, or
  mid-trick) MUST be ignored rather than interrupting her, matching the poodle's
  rule. The eraser MUST remain an exception: a tap on her with the eraser erases
  her (FR-024) instead of poking her.

#### Ice cream

- **FR-012**: The toy MUST offer an ice cream control in the toolbar's elements
  group. It paints ice cream cells continuously under press-and-drag at every
  brush size, exactly like gumdrops. It MUST NOT be a placed object.
- **FR-013**: Ice cream MUST use grid-element ID **11**. IDs **12** and **13**
  MUST NOT be used by this feature — they are reserved by a concurrently-filed
  feature.
- **FR-014**: Ice cream **is hue-coloured** (flavour variety: each poured cell
  takes a colour from the toy's joyful palette). Because of that, ice cream MUST
  be added to the shared hue-colour predicate that the history and save codecs
  key on (`usesHueColor`), **and** to the test-local `visibleSnapshot` helper in
  the history tests. This is stated explicitly because the alternative —
  a single fixed colour, for which neither addition would be needed — was
  considered and rejected in favour of flavour variety (see Assumptions).
- **FR-015**: Ice cream MUST behave in the world **exactly like a gumdrop**: it
  falls and rests as a solid wherever it lands, reusing the existing gumdrop rule
  rather than introducing new physics. Ice cream that lands in water settles in
  that water, where a swimming mermaid can reach it. Ice cream that lands on dry
  land rests there as decoration until the child pours water to it — that is not
  a failure state and MUST NOT be treated as one. Ice cream MUST NOT float or
  rise to the surface, and MUST NOT melt, dissolve, or disappear on its own:
  nothing the child made vanishes without her doing it. No new movement rule and
  no per-cell timer is added.
- **FR-016**: Ice cream MUST NOT change the behaviour of any existing element.
  Sand, water, dirt, rainbow sand, grass, star power, fog, gumdrops, and flowers
  MUST behave exactly as they do today, and poodles MUST continue to chase
  gumdrops unchanged.

#### Seeking and eating

- **FR-017**: A mermaid MUST detect ice cream within a bounded scent window
  around her and swim toward the nearest one, using the same pursuit shape as the
  poodle/gumdrop rule (bounded-window search, closest target, re-target when a
  nearer one appears) adapted to swimming.
- **FR-018**: When a mermaid reaches ice cream, that cell MUST become empty, she
  MUST enter a brief visible eating state, and the toy MUST show the same kind of
  sparkle feedback it already shows when a poodle eats a gumdrop.
- **FR-019**: A mermaid MUST give up on a pursuit that stops making progress:
  after a bounded number of frames without getting closer, she abandons that
  target and ignores ice cream scent for a cooldown period, returning to ordinary
  drifting. She MUST NOT press against an obstacle indefinitely and MUST NOT be
  permanently unable to drift.
- **FR-020**: A mermaid MUST NOT pursue ice cream she cannot swim to, for longer
  than the give-up period; specifically she never leaves the water to reach it.
- **FR-021**: Ice cream poured onto a mermaid's own cell MUST be eaten rather
  than silently discarded or ignored.
- **FR-022**: Poodles MUST ignore ice cream and mermaids MUST ignore gumdrops.
- **FR-023**: Eating MUST be silent — this feature adds no sounds.

#### Cross-cutting (the specs-010/011/013 checklist)

- **FR-024**: The eraser MUST remove ice cream cells it touches and MUST remove a
  mermaid it touches, using the same reach and feel as erasing a poodle.
- **FR-025**: Clear-all MUST remove every mermaid and every ice cream cell.
- **FR-026**: Save and restore MUST round-trip mermaids (count and positions) and
  every un-eaten ice cream cell **including its flavour colour**.
- **FR-027**: Undo and redo MUST round-trip mermaids and ice cream cells
  **including flavour colour**, with no colour drift across any number of
  undo/redo cycles.
- **FR-028**: A grid re-derivation (resize, rotation, fullscreen toggle) MUST
  remap mermaids the way poodles are remapped today — shifted by the same offset
  and clamped in-bounds rather than dropped — and MUST remap ice cream cells like
  any other element.
- **FR-029**: Restoring a saved world written before this feature existed MUST
  succeed, yielding no mermaids and no ice cream, with no error surface.

#### Platform and shell

- **FR-030**: The two new controls raise the shipped toolbar control count from
  24 to 26. They MUST fit within the existing scale-to-44px-floor toolbar system
  with no new mechanism: on every viewport in the representative table used by
  specs 006/012/013, every control stays at or above the 44px touch floor and the
  drawing region keeps the share of the screen those specs guarantee. This cost
  MUST be named explicitly in the plan.
- **FR-031**: Both new controls MUST be recognisable without reading, on both
  maintainers' platforms. The mermaid glyph (🧜, Emoji 5.0) and the ice cream
  glyph (🍦, Emoji 1.0) are expected to render on iOS/iPadOS, Android/Fire, and
  desktop Chrome; if either draws as an empty box on the Fire tablet or on
  Windows' emoji font, that control MUST ship an inline SVG icon instead, the way
  the sand bucket already does. Verification on the platform the other maintainer
  owns MUST be flagged for that maintainer rather than assumed.
- **FR-032**: The feature MUST NOT break single-file `file://` playback and MUST
  NOT add runtime dependencies.

#### Verification

- **FR-033**: The feature MUST ship plain unit tests, with no DOM or browser
  harness, covering at minimum: the swim-and-eat rule, the give-up/cooldown rule,
  the confined-to-connected-water rule, the no-water and buried graceful-rest
  rules, the poke-does-a-trick / tap-elsewhere-does-not-summon rule, the
  ice-cream-falls-and-rests-like-a-gumdrop rule, the save/restore round trip, the
  undo/redo round trip (colour included), and the re-derivation remap.
- **FR-034**: The whole existing test suite MUST continue to pass; no existing
  sand, water, poodle, or gumdrop test may be weakened to accommodate this
  feature.

### Key Entities

- **Mermaid**: a pet, not a grid element. Has a position, a facing, a current
  activity (drifting, swimming toward something, eating, doing a trick after a
  poke, resting out of water), the target she is pursuing, and the bookkeeping
  needed to give up on a target and to cool down afterward. Capped at 3. Saved as
  a position; restored into a fresh pet with default activity.
- **Ice cream**: a grid element with ID 11 and a flavour colour, poured with the
  brush. Falls and rests as a solid like a gumdrop; never floats and never melts.
  Consumed (cell emptied) when a mermaid eats it. Participates in save/restore,
  undo/redo, erase, clear-all, and grid remapping exactly like the other
  paintable elements.
- **Pool / connected water**: not a stored object — the run of water cells a
  mermaid can currently swim through. It changes shape constantly as the child
  pours and erases, and defines the boundary of where she may go.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a headless sim with a pool spanning the canvas, a mermaid placed
  at one end reaches and eats ice cream placed at the other end within 10 seconds
  of simulated play, in 100% of runs.
- **SC-002**: Over 2,000 simulated frames on adversarial terrain (walls, split
  pools, ice cream on dry land, sand poured on her), a mermaid is never inside
  solid material for more than a short bounded interval, never leaves the water
  she is connected to, and always resumes drifting within the give-up period —
  0 stuck states across the whole run.
- **SC-003**: 100% of placed mermaids survive a save/restore cycle, an
  undo/redo cycle, and a grid rotation — same count, same positions (within the
  remap tolerance), zero lost pets.
- **SC-004**: 100% of painted ice cream cells come back with an identical flavour
  colour after save/restore and after any number of undo/redo cycles — zero
  colour drift.
- **SC-005**: With 3 mermaids and 3 poodles on the default grid, the sim holds
  the constitution's frame-rate target (60fps target, ≥30fps acceptable) on the
  maintainers' devices, and the added per-frame work is independent of canvas
  size.
- **SC-006**: With 26 controls, every viewport in the representative table keeps
  every control at or above 44px and keeps the drawing region at or above the
  share specs 006/012/013 guarantee — no viewport regresses.
- **SC-007**: The existing test suite passes unchanged, and the build still emits
  a single self-contained `dist/index.html` that plays from `file://`.
- **SC-008**: A child can place a mermaid and feed her without any reading, using
  only the two new picture buttons and her finger.

## Assumptions

- **Cap of 3**: matches the poodle cap the issue suggested. Three mermaids plus
  three poodles is the worst case the performance criteria are written against.
  Raising it is a later, cheap change if the swimming turns out to be cheap.
- **Confined to connected water**: the issue offered "confined to her spawning
  pool" or "free to roam any connected body of water" and asked for whichever is
  easiest to keep bug-free. This spec picks the rule that makes both descriptions
  the same thing: she moves only from water cell to water cell, so she is
  naturally inside whatever pool she is connected to, and if the child joins two
  pools she may swim into the new water. No pool identity is stored, so nothing
  can go stale when the child reshapes the water.
- **Flavour colours, not one fixed colour**: ice cream is hue-coloured for the
  same reason gumdrops and flowers are — it is prettier, and it is the palette
  the toy already has. The cost is exactly the two additions named in FR-014, and
  they are mandatory, not optional.
- **Placement snapping**: tapping near water places her in the water. The search
  is a bounded window around the tap so placement cost is constant.
- **No new sounds**: per the issue. The poke trick in FR-011 reuses the feedback
  the toy already gives for a poked pet, so it adds no sound of its own.
- **Ice cream falls like a gumdrop** *(resolved on #44)*: of the three options
  put to the maintainer — gumdrop physics, floating, or melting — gumdrop physics
  was chosen. It reuses a proven, tested rule verbatim instead of inventing the
  sim's first floating element for one item, and melting was declined because
  something the child made disappearing on its own cuts against the toy's no-loss
  feel. Ice cream resting on dry land is decoration, not a failure state.
- **Poke, not summon** *(resolved on #44)*: of full poodle parity, poke-only, and
  no touch response, poke-only was chosen. The child's finger is also the
  paintbrush, so a follow-the-tap rule would have her yanked around by ordinary
  water-pouring; poke-only keeps her pettable without fighting the brush.
- **Eraser reach for a mermaid** matches whatever radius the eraser already uses
  for a poodle rather than introducing a second rule.
- **Save format**: the saved world gains a mermaid list alongside the existing
  poodle list; the save version is bumped if the format's shape requires it, and
  older saves still restore (FR-029).
- **Toolbar placement**: the mermaid control sits with the pets/objects controls
  and the ice cream control with the element controls, so the groups keep their
  existing meaning.
- **Element IDs 12 and 13 stay untouched**, so this feature and the concurrently
  filed house/people/treasure feature can be merged in either order.
