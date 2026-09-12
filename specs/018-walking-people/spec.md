# Feature Specification: People Who Stand, Walk, And Run

**Feature Branch**: `018-walking-people`

**Created**: 2026-09-12

**Status**: Draft

**Input**: Lifecycle issue #61 — "People who stand, walk, and run: swap 🧑 for the 🧍 family"

> ## What the maintainer asked for
>
> Reverse one decision from #47. That issue said "use 🧑, *not* 🧍" for the person
> object, and it shipped that way (spec 015, `OBJECT_GLYPHS.person` in
> `src/lib/PlayArea.svelte`). Flip it: the person should be the **🧍 family**,
> because unlike 🧑 it has sibling glyphs that read as the same figure doing
> different things — and swapping between those glyphs *is* the animation.
>
> - 🧍 **standing** — the idle frame.
> - 🚶 **walking** — shown while the person is moving, flipped left/right by
>   facing (the `ctx.scale(-1, 1)` trick the poodle/fish/mermaid already use).
> - 🏃 **running** — optional third frame; a good fit for a poke reaction (the way
>   the flamingo hops and the palm shivers when poked) rather than an everyday
>   state.
> - **Men and women too**: every one of those three has ♂/♀ forms
>   (🧍‍♂️ 🧍‍♀️ 🚶‍♂️ 🚶‍♀️ 🏃‍♂️ 🏃‍♀️). Each placed person picks a variant once and keeps it
>   across all their frames — a 🧍‍♀️ walks as 🚶‍♀️ and runs as 🏃‍♀️, never switching
>   mid-stride.
>
> **No new toolbar control.** Keep the existing `'person'` `Tool` id and the
> `tool-person` control in `src/lib/toolbarControls.ts`; only its glyph and what
> it places change. #47 already spent the toolbar budget (320×568 was dropped
> from the guaranteed table to fit 26 controls), so this must be a zero-control
> change.
>
> ## What this changes under the hood
>
> Today a person is a static `PlacedObject` in `src/sim/objects.ts` that stamps
> `OBJECT` cells into the grid. A person who walks can't be that. Recommended:
> **person becomes a pet-style entity** alongside the poodle in `src/sim/pets.ts`
> — x/y/facing/state, standing on solids, stepping up small ledges, wandering
> when bored. Reuse the poodle's ground-following locomotion rather than writing
> new pathing. People should **not** chase her finger — that's the poodle's job.
>
> Consequences the spec must cover:
>
> - `'person'` leaves `OBJECT_KINDS`, but `src/sim/save.ts` and
>   `src/sim/historySave.ts` must still tolerate an old `byKind.person` list and
>   **migrate** those saved placements into walkers at the same positions.
> - **Do not bump `SAVE_VERSION` or `HISTORY_SAVE_VERSION`** — a version mismatch
>   returns null and silently wipes her whole world. Add tolerant optional fields
>   the way `mermaids` was added.
> - No new grid-element IDs are needed — say so explicitly.
> - Cap of 3, oldest evicted, matching poodles and mermaids.
>
> ## Emoji coverage — detect, don't assume (biggest risk)
>
> Two *different* failure modes: **tofu box** (🧍 and its ♂/♀ forms are Emoji
> 12.0; whether Fire 7 Silk draws them is genuinely unknown) and **split
> sequence** (an unsupported ZWJ form like 🧍‍♀️ draws two glyphs side by side, not
> a box). Probe both — the tofu case by rendering and comparing against a known
> unassigned codepoint, the split case with `measureText` (sequence width ≈ base
> width means supported; roughly double means fall back). Fallback ladder:
> gendered → ungendered; 🧍 missing → 🚶 (or 🧑) as the standing frame; the
> toolbar button's glyph goes through the same probe. Build it as a pure function
> taking an injected measurer/renderer so vitest can cover the ladder with no DOM.
>
> ## Cross-cutting checklist
>
> Eraser, clear-all, save/restore (position **and** variant), an explicit
> undo/redo decision (mermaids are in the history, poodles are not — pick a
> precedent and say which), resize/rotate remap, other objects untouched, vitest
> coverage with no DOM, and a both-maintainers eyeball check on their own
> platform (do 🧍/🚶/🏃 read as the same person? which way does 🚶 natively face?).
>
> ## Decisions left open
>
> How a variant is chosen with no reading and no new control; the poke reaction;
> the walk cadence; and a constitution amendment at finalize (Product Constraints
> currently lists "person 🧑").
>
> Existing poodle, mermaid, and placed-object behavior must not regress.

## Clarifications

### Session 2026-09-12 (answered by @charlesguse on issue #61)

- **Q: Is the variant random per placement, or do repeated taps on the person button
  cycle through the variants so the child can pick deliberately?** → Random at
  placement, kept for life — no button cycling. With one tweak: a variant does not
  repeat until every variant the probe says this device can draw has been used once,
  so a set of three always comes out mixed. Same zero-UI cost as plain randomness,
  without the "all three came out the same" weakness; the randomness is injectable so
  tests can seed it. (FR-013, FR-013a, SC-005a)
- **Q: Is the poke reaction a brief run on the third frame, a small hop in place like
  the flamingo, or nothing at all?** → A brief sprint on the running frame — that was
  the point of asking for the third glyph. The runner and its ♂/♀ forms go through the
  same probe as the other frames; on a device that cannot draw the running frame the
  reaction falls back to the flamingo-style hop rather than being dropped.
  (FR-016, FR-016a, FR-017, FR-018)
- **Q: When the standing picture is unavailable, does the idle frame fall back to the
  walking picture or to the person picture 🧑 this feature replaces?** → Fall back to
  the walking picture. Same-person continuity across frames matters more than a
  visually distinct pause frame on a device the maintainers may never see fail, and it
  is the simplest branch to keep correct. (FR-019)

## User Scenarios & Testing *(mandatory)*

Throughout this spec:

- A **person** is the figure the child places with the existing person button. After
  this feature she is a **walker**: a living figure who lives above the grid and is
  drawn over it, like the poodle and the mermaid — not a stamped block of grid cells.
- A **frame** is which picture a person is currently drawn as: **standing**,
  **walking**, or **running**.
- A **variant** is which person a given walker is — the neutral figure, the man, or
  the woman. A walker picks one variant when she is placed and keeps it forever.
- A **facing** is which way a walker is turned: left or right. It is applied by
  mirroring the drawn glyph, the way the poodle, fish, and mermaid already are.
- A **glyph probe** is a check of what the device's emoji font can actually draw:
  whether a picture comes out as a real figure rather than an empty box, and whether
  a man/woman form comes out as **one** figure rather than a person and a gender sign
  side by side.
- A **fallback ladder** is the ordered list of substitutes used when the probe says a
  picture cannot be drawn properly on this device.
- An **old save** is a world (or a stored undo history) written before this feature
  shipped, in which people were stored as placed objects.

### User Story 1 - People who stroll around her world (Priority: P1)

The child taps the person button and taps the canvas. A person appears standing on
the ground there. After a moment she starts to stroll: she walks a few steps one
way, turned the way she is going, stops and stands for a breath, then ambles off
again — up small ledges, along the tops of her hills, never sinking through the
ground and never marching off the edge of the world. She can have up to three
people at once; placing a fourth retires the oldest, exactly as poodles and mermaids
already do. They ignore her finger completely: pouring sand or water never drags a
person across the canvas — only the poodle does that.

**Why this priority**: This is the whole wish. A figure that actually walks around
her world is a complete, delightful toy on its own, and every other story here
depends on it existing.

**Independent Test**: In a plain unit test, build a grid with hills, place people,
advance the sim a few hundred frames, and assert each person is always standing on a
solid surface (or the floor), always inside the grid, that her position changes over
time, that her frame is "walking" exactly on the frames she moves and "standing"
when she pauses, and that her facing matches her direction of travel. Assert a
finger target handed to the pets step moves poodles and never moves people. Whether
the stroll *reads* as a stroll rather than a strobe is a maintainer eyeball check on
a real device.

**Acceptance Scenarios**:

1. **Given** a canvas with ground, **When** the child selects the person tool and
   taps, **Then** a person appears at that spot, settles onto the surface below her,
   and is drawn standing.
2. **Given** a placed person, **When** frames pass with no other input, **Then** she
   alternates between walking a short way and standing still, staying within a
   bounded roaming range of where she settled.
3. **Given** a person walking left, **When** she is drawn, **Then** she is shown in
   the walking frame, mirrored so she faces the way she is moving; **When** she
   pauses, **Then** she is shown in the standing frame.
4. **Given** a person walking toward a one- or two-cell ledge, **When** she reaches
   it, **Then** she steps up onto it; **Given** a taller wall, **Then** she turns
   around instead of climbing or clipping into it.
5. **Given** three people already placed, **When** the child places a fourth,
   **Then** there are still exactly three and the oldest is the one that left.
6. **Given** a person on the canvas, **When** the child paints, pours, or drags
   anywhere with any tool, **Then** the person is not summoned or steered by it and
   keeps strolling; the poodle's follow-the-finger behaviour is unchanged.
7. **Given** a person standing where the child then pours sand, **Then** sand falls
   past her as it does past a poodle — she is a figure drawn over the world, not a
   wall, and no cell of the grid is made solid by her presence.
8. **Given** a person who ends up buried, off the ground, or at the very edge of the
   grid, **When** frames pass, **Then** she returns to standing on a surface inside
   the grid within a short bounded time — never invisible, never stuck, never lost.

---

### User Story 2 - The same person in every frame (Priority: P1)

Each person the child places is a particular person — some are the neutral figure,
some a man, some a woman — and she stays that person for as long as she exists. A
woman strolls as a walking woman and, when poked, runs as a running woman. She never
changes who she is mid-stride, and she is still the same person after the tablet is
closed and reopened.

**Why this priority**: "The same figure doing different things" is the reason the 🧍
family was chosen over 🧑. If the variant flickered between frames the animation
would read as three different people blinking in and out, which is worse than the
static figure it replaces.

**Independent Test**: Unit-test the frame-selection rule directly: given a walker
with a fixed variant and a state, assert the chosen picture is the one belonging to
that variant in that state, across every variant × state combination, and assert the
variant is unchanged after hundreds of frames of simulated strolling and after a
save/restore round trip. Drive the variant picker with a seeded source of randomness
and assert that consecutive placements never repeat a variant until every drawable
variant has been used, on a font that draws all three and on one that draws only the
neutral figure.

**Acceptance Scenarios**:

1. **Given** a person of a given variant, **When** she changes between standing,
   walking, and running, **Then** every frame shown belongs to that same variant.
2. **Given** a device that can draw all three variants, **When** the child places
   three people one after another, **Then** she gets one neutral figure, one man, and
   one woman — in an order she cannot predict, but never three identical figures.
3. **Given** a device whose emoji font cannot draw a man/woman form as a single
   figure, **When** people are placed, **Then** every person is the neutral figure
   and no person is ever drawn as a figure with a gender sign stuck beside it.
4. **Given** a world with people of different variants, **When** it is saved and
   restored, **Then** each person comes back as the same variant she was.

---

### User Story 3 - Never a broken picture (Priority: P1)

Whatever device the toy is opened on, the person button and the people on the canvas
are always a recognisable person. Where the standing picture is missing from the
device's emoji font, the toy quietly uses one it does have; where the man/woman
pictures would come out as two glyphs jammed together, the toy quietly uses the
plain figure. The child never sees an empty box, never sees a person with a stray
symbol next to them, and is never shown a message about it.

**Why this priority**: The constitution's "feature-detect and hide, never break"
rule, and the fact that the standing picture's support on the Fire tablet is
genuinely unknown. Shipping this without the probe risks the child's person button
becoming an empty box on one maintainer's only device.

**Independent Test**: The probe is a pure function over an injected measurer and
renderer, so unit tests can drive it with fabricated measurements: a font that has
everything, a font missing the standing picture, a font missing the running picture,
a font that splits the gendered sequences, a font that has nothing, and a measurer
that throws or returns zero — asserting the exact chosen picture set in each case,
with no DOM.

**Acceptance Scenarios**:

1. **Given** a device whose font draws all nine pictures properly, **When** the toy
   opens, **Then** the button and the people use the standing/walking/running
   family, including man and woman forms.
2. **Given** a device whose font has no standing picture, **When** the toy opens,
   **Then** the idle frame is drawn with the walking picture instead, so a paused
   person is still the same figure as a strolling one, and nothing anywhere is an
   empty box.
3. **Given** a device whose font splits gendered sequences into two glyphs, **When**
   the toy opens, **Then** only neutral figures are used, everywhere, including on
   the toolbar button.
4. **Given** a device where the probe itself cannot run at all, **When** the toy
   opens, **Then** the toy falls back to the safest picture set it knows and still
   shows a person on the button and on the canvas.
5. **Given** any of the above, **When** the sim runs, **Then** the probe is not
   repeated per person or per frame — the answer is decided once and reused.

---

### User Story 4 - The people she already has are not lost (Priority: P1)

The child opens the toy the day after this ships. The people she placed yesterday
are still there, in the same places — only now they can walk. Nothing she built is
wiped, and there is no message about the change.

**Why this priority**: This is the sharpest regression risk in the feature and the
one the constitution already has an amendment about. A person who used to be a
placed object is stored in a way the new code no longer reads; done carelessly this
silently empties her world, which is the worst outcome the toy can produce.

**Independent Test**: Unit tests that feed the restore paths a saved world and a
saved undo history written in the old shape (people under the placed-object lists,
no walker list at all) and assert: the restore succeeds, the people come back as
walkers at the same positions, the cells their old footprints occupied are not left
behind as invisible solid blocks, and every other object kind is untouched. Repeat
with a save that has neither shape, and with a malformed walker list.

**Acceptance Scenarios**:

1. **Given** a saved world written before this feature, **When** it is restored,
   **Then** every person it holds comes back as a walker at the same place, and the
   rest of the world is exactly as it was.
2. **Given** that same restore, **When** the child paints or erases where an old
   person used to stand, **Then** those cells behave like ordinary empty cells —
   there is no invisible solid block left where the old figure was stamped.
3. **Given** a stored undo history written before this feature, **When** the toy
   opens, **Then** the history is kept and usable, with people in its steps carried
   over as walkers.
4. **Given** a saved world or history whose walker list is missing, empty, or
   malformed, **When** it is restored, **Then** the rest of the world still restores
   and the toy opens normally with no error surface.
5. **Given** a world saved by this feature, **When** it is opened, **Then** it is
   accepted — the saved-world and saved-history format numbers are unchanged by this
   feature.

---

### User Story 5 - Poke a person and she runs (Priority: P2)

The child taps directly on a person. She breaks into a little run for a moment —
the third picture in the family — and then settles back to strolling. Tapping
anywhere else just paints, as always.

**Why this priority**: A lovely payoff for the third frame and consistent with the
flamingo hop, palm shiver, poodle trick, and mermaid trick the toy already has — but
the toy is complete and demonstrable without it.

**Independent Test**: Unit tests poke a person's cell and assert she enters the
running state for a bounded number of frames and then returns to strolling; poke
away from her and assert nothing about her changes; poke with the eraser selected
and assert she is erased instead; and, with a probe result that has no running
picture, assert the poke still produces a bounded hop-in-place reaction rather than
nothing.

**Acceptance Scenarios**:

1. **Given** a strolling person, **When** the child taps directly on her with any
   tool but the eraser, **Then** she runs for a brief moment and that tap paints and
   places nothing.
2. **Given** a person mid-run from a poke, **When** the child pokes her again,
   **Then** the poke is ignored and she finishes her run.
3. **Given** a person, **When** the child taps on her with the eraser selected,
   **Then** she is erased rather than poked.
4. **Given** a poked person, **When** she runs, **Then** the toy gives the same kind
   of feedback it already gives for a poked pet — this feature adds no new sound.
5. **Given** a device whose emoji font cannot draw the running picture, **When** the
   child pokes a person, **Then** she hops in place for a moment the way the flamingo
   does — the poke is never a no-op, and no empty box is ever drawn.

---

### User Story 6 - Everything else still works (Priority: P2)

Erasing, clearing everything, undoing, redoing, and rotating the tablet treat people
exactly the way they treat every other pet, and the rainbow, unicorn, palm, flamingo,
house, and treasure chest are completely unaffected.

**Why this priority**: These are the gaps that forced specs 010, 011, and 013 to
exist. Not optional for shipping; simply not the demo.

**Independent Test**: Unit tests over the erase, clear-all, undo/redo, and grid
re-derivation paths asserting people count, positions, and variants before and
after, plus an unchanged pass of the existing object/poodle/mermaid suites.

**Acceptance Scenarios**:

1. **Given** people on the canvas, **When** the child drags the eraser over one —
   including a fast drag whose samples straddle her — **Then** she is removed, with
   the same reach and feel as erasing a poodle or mermaid.
2. **Given** people on the canvas, **When** the child taps clear-all, **Then** all of
   them are gone along with everything else.
3. **Given** a person the child has just placed, **When** she taps undo, **Then** the
   person is gone; **When** she taps redo, **Then** the person is back, at the same
   place and as the same variant.
4. **Given** people on the canvas, **When** the child rotates the tablet or toggles
   fullscreen and the play area is re-derived, **Then** every person is carried to
   the corresponding place in the new grid — clamped inside it if that place falls
   outside — and none is stranded outside the grid or left hanging in mid-air once
   the next frames run.
5. **Given** rainbows, unicorns, palms, flamingos, houses, and a treasure chest on
   the canvas, **When** any of this feature's paths run, **Then** all of them place,
   draw, convert, erase, save, restore, undo, and remap exactly as they do today.

---

### Edge Cases

- **A person placed in mid-air, or on water**: she falls to the first surface below
  her (or the floor) and stands there; she does not sink through the world and does
  not need rescuing.
- **A person placed on a canvas with no ground at all**: she rests on the floor of
  the grid and strolls along it.
- **A person buried by sand, gumdrops, or grass**: she frees herself within a
  bounded number of frames, exactly as a buried poodle does; she is never left
  inside solid material.
- **The ground under a person is erased out from under her**: she falls and settles
  on whatever is now below.
- **A person hemmed in on both sides by walls taller than she can step**: she turns
  in place / stands rather than jittering against a wall forever. This is not a stuck
  state.
- **A person walking at the left or right edge of the grid**: she turns around; she
  never walks out of the world or wraps around.
- **Three people, three poodles, and three mermaids at once on the largest grid the
  toy uses**: the sim stays smooth.
- **A device whose emoji font draws the standing picture as an empty box**: the
  walking picture stands in as the idle frame, on the canvas *and* on the toolbar
  button; standing and walking then look alike, which is accepted.
- **A device whose emoji font cannot draw the running picture**: the poke reaction
  becomes a hop in place instead of a sprint; the poke still always does something.
- **A device whose emoji font splits 🧍‍♀️ into two glyphs**: only the neutral figure
  is used, every person is that figure, and the no-repeat variant rule collapses
  harmlessly to "always neutral" rather than stalling or breaking.
- **The walking picture faces the opposite way on one maintainer's platform**: the
  mirroring is expressed as a single per-platform "which way does this glyph face"
  constant, so correcting it is a one-value change and not a bug hunt.
- **An old save that holds three people *and* three poodles and three mermaids**:
  migration respects the cap — it never produces more than three people.
- **An old save whose person entries sit partly outside the current grid**: they are
  clamped in-bounds like any other remapped pet rather than dropped.

## Requirements *(mandatory)*

### The person becomes a walker

- **FR-001**: A person MUST be a living figure with a position, a facing, a current
  activity, and a variant — the same class of thing as the poodle and mermaid — and
  MUST NOT be a placed object that stamps solid cells into the grid.
- **FR-002**: The toolbar MUST NOT gain or lose a control. The existing person tool
  id and the existing `tool-person` control MUST be kept exactly as they are; only
  the picture the control shows and the thing it places change. The shipped control
  count MUST be identical before and after this feature.
- **FR-003**: At most **3** people MUST exist at once; placing another retires the
  oldest, matching the poodle and mermaid caps.
- **FR-004**: A person MUST stand on top of solid material (or the grid floor), MUST
  be able to step up ledges of the same small height a poodle can, and MUST turn
  around rather than climbing or clipping through anything taller.
- **FR-005**: A person MUST stroll on her own: alternating short walks with pauses,
  bounded to a limited roaming range around where she last settled, at a cadence that
  reads as an unhurried walk rather than a flicker. She MUST NOT stand perfectly
  still forever, and MUST NOT move every frame.
- **FR-006**: A person MUST NOT respond to the child's finger as a destination. Taps
  and drags anywhere on the canvas MUST NOT summon, steer, or retarget her (the poke
  in FR-016 is the only exception, and it does not move her to the tap). The poodle's
  existing follow-the-finger behaviour MUST be unchanged.
- **FR-007**: If a person's cell becomes solid material, or she is left off the
  ground, or she ends up outside the grid after a re-derivation, she MUST return to
  standing on a surface inside the grid within a bounded number of frames. She MUST
  NOT be deleted, hidden, or require the child to rescue her.
- **FR-008**: Every per-frame search a person performs MUST be bounded by a fixed
  window that does not grow with canvas size, and the per-person step MUST NOT
  allocate on the hot path.
- **FR-009**: This feature MUST NOT add any grid-element ID. People are figure state
  drawn over the grid, exactly like poodles and mermaids; no cell value is added,
  changed, or reserved. This is stated explicitly because the person's predecessor
  *did* occupy cells.

### Frames, facing, and variants

- **FR-010**: A person MUST be drawn as the standing picture when she is not moving,
  the walking picture while she is stepping, and the running picture while she is
  reacting to a poke (FR-016) — each subject to the fallback ladder in FR-019. Frame
  choice MUST be a pure function of her state, her variant, and the resolved picture
  set, so it can be unit-tested without a canvas.
- **FR-011**: The drawn picture MUST be mirrored to match her facing, using the same
  horizontal-flip mechanism the poodle, fish, and mermaid already use. The direction
  the source glyph natively faces MUST be expressed as a single named constant, so a
  platform that draws it the other way is a one-value correction rather than a
  rewrite.
- **FR-012**: Each person MUST take a variant — neutral figure, man, or woman — at
  the moment she is placed, and MUST keep that variant for her whole life: across
  every frame, every state change, every save/restore, and every undo/redo. She MUST
  NOT change variant mid-stride.
- **FR-013**: Variants MUST be chosen without any reading and without any new
  control: a person takes her variant automatically at the moment she is placed, and
  the child neither picks one nor is asked. Repeated taps on the person button MUST
  NOT cycle variants or otherwise change what the button does; placing another person
  is the only way to get a different one.
- **FR-013a**: Variant selection MUST draw only from the variants the glyph probe says
  this device can draw as a single figure, and MUST NOT repeat a variant until every
  drawable variant has been used once. A run of placements no longer than the number
  of drawable variants therefore always comes out mixed — on a device that draws all
  three, three people are one neutral figure, one man, and one woman in some order.
  Within that constraint the order MUST be random, and the randomness MUST be an
  injectable input so tests can make the sequence deterministic.
- **FR-014**: If the probe says gendered forms cannot be drawn as a single figure,
  every person MUST be the neutral figure. A gendered form MUST NEVER be drawn on a
  device where it splits into two glyphs.
- **FR-015**: A person's own picture and the toolbar control's picture MUST come from
  the same resolved picture set, so the button and the figures on the canvas can never
  disagree about who a person is.
- **FR-016**: A tap that lands directly on a person MUST make her break into a brief
  run — the running picture, in her own variant — for a bounded moment, after which
  she returns to strolling; that tap MUST NOT paint or place anything. The reach that
  counts as "on her" MUST match the existing poke reach for a poodle or mermaid. A
  poke arriving while she is already reacting MUST be ignored. The eraser MUST remain
  an exception: a tap on her with the eraser erases her (FR-021). This feature MUST
  NOT introduce a new sound.
- **FR-016a**: The running picture and its gendered forms MUST go through the same
  glyph probe as the standing and walking ones (FR-017). If the running picture cannot
  be drawn on this device, the poke reaction MUST degrade to a brief hop in place —
  the flamingo's reaction — rather than being dropped: a poke on a person MUST always
  produce a visible reaction, on every device.

### Emoji coverage — probe, don't assume

- **FR-017**: Before any person picture is used, the toy MUST determine, for this
  device's emoji font, (a) whether each single-figure picture — standing, walking,
  **and running** — draws as a real glyph rather than an empty box, and (b) whether
  each gendered form of all three draws as one figure rather than a figure plus a
  separate gender sign. Both checks MUST be made by
  measurement/observation of the actual font, not assumed from a platform name or a
  user-agent string.
- **FR-018**: The resolution MUST be a pure function that takes the measuring and
  rendering capability as injected inputs and returns the picture set to use. It MUST
  be unit-testable with no DOM and no browser harness, and MUST be covered by tests
  for at least: everything supported, standing picture missing, running picture
  missing, gendered forms splitting, nothing supported, and a measurer that fails or
  returns nonsense.
- **FR-019**: The fallback ladder MUST be: gendered form → neutral form; standing
  picture missing → **the walking picture**, used as the idle frame; running picture
  missing → the hop reaction of FR-016a. Same-figure continuity across frames takes
  priority over idle being visually distinct from walking: on a device with no
  standing picture a person looks the same whether she is pausing or stepping, which
  is accepted. The person picture this feature replaces MUST NOT be used as the idle
  frame, because it is a different-looking figure from the walking and running ones
  and would read as two people swapping places.
- **FR-020**: The probe MUST run at most once per session per picture and its result
  MUST be reused; it MUST NOT run per person, per frame, or per draw. If the probe
  cannot run at all, the toy MUST use the safest known-drawable set rather than
  showing nothing or showing a box. No message, marker, or error surface about
  missing glyphs may ever be shown to the child.

### Cross-cutting (the specs-010/011/013 checklist)

- **FR-021**: The eraser MUST remove a person it touches, with the same reach as
  erasing a poodle or mermaid, and MUST do so along an interpolated drag so a fast
  swipe cannot skip over her.
- **FR-022**: Clear-all MUST remove every person, along the same path that already
  clears poodles and mermaids.
- **FR-023**: Save and restore MUST round-trip every person's position **and
  variant**. A woman MUST NOT come back as a man or as a neutral figure.
- **FR-024**: People MUST be part of the undo/redo history, following the **mermaid**
  precedent rather than the poodle one: placing a person is undoable and redoable,
  and a restored step brings back the same people with the same positions and
  variants. This precedent is chosen because a person is undoable *today* (as a
  placed object) and dropping her out of the history would be a visible regression
  for the child.
- **FR-025**: The saved-world format version and the saved-history format version
  MUST NOT be changed. People MUST be carried in tolerant optional fields the way the
  mermaid lists were added: a missing field reads as "no people", a malformed entry
  is skipped or reads as empty, and neither ever rejects the whole payload.
- **FR-026**: Restoring an old save or an old stored history that holds people in the
  previous placed-object shape MUST migrate them into walkers at the same positions,
  honouring the cap of 3, clamped in-bounds. The people the child already placed MUST
  NOT be lost.
- **FR-027**: That migration MUST also release the cells the old person footprints
  occupied, so a restored world never contains invisible solid blocks where a person
  used to be stamped — except where another surviving object still covers them.
- **FR-028**: A grid re-derivation (resize, rotation, fullscreen toggle) MUST remap
  people the way poodles are remapped today — shifted by the same offset, clamped
  in-bounds, never dropped — with their roaming anchor moved with them so strolling
  keeps working afterwards.
- **FR-029**: Every other object kind (rainbow, unicorn, palm, flamingo, house,
  treasure chest) and both existing pets MUST behave exactly as they do today:
  placement, drawing, conversions, poke reactions, erase, clear-all, save, restore,
  undo/redo, and remap. No existing test may be weakened to accommodate this feature.

### Platform, verification, and follow-up

- **FR-030**: The feature MUST NOT break single-file `file://` playback, MUST NOT add
  a runtime dependency, and MUST NOT add an asset file: the people are drawn glyphs,
  chosen at runtime by the probe.
- **FR-031**: The feature MUST ship plain unit tests with no DOM and no browser
  harness, covering at minimum: the glyph-probe fallback ladder (FR-018's cases),
  migration of old saved people and old saved history steps, frame and facing
  selection across states and variants, the seeded no-repeat variant cycle (FR-013a)
  including the single-drawable-variant case, variant stability across a save/restore
  and an undo/redo cycle, the cap and eviction, poke behaviour including the
  hop fallback when the running picture is undrawable (FR-016a), and eraser and
  clear-all.
- **FR-032**: Two checks MUST be flagged for maintainer eyeballing rather than
  assumed, one per platform, because neither maintainer can verify the other's
  device: (a) do the standing, walking, and running pictures read as the *same*
  figure in that platform's emoji font, and (b) which way does the walking picture
  natively face there. The spec MUST NOT assert an answer for the platform its author
  cannot run.
- **FR-033**: The constitution's Product Constraints currently lists "person 🧑" among
  the placed objects. Moving the person to a strolling figure MUST be flagged as a
  follow-up documentation amendment (with a version bump) at finalize, the way the
  treasure chest was handled — it is not part of this feature's code change.

### Key Entities

- **Person (walker)**: a living figure, not a grid element and not a placed object.
  Has a position, a facing, a current activity (standing, walking, reacting to a
  poke), a roaming anchor, the timers her stroll and her reaction need, and a variant
  fixed at placement. Capped at 3, oldest evicted. Saved as a position plus a variant;
  restored into a fresh figure with a default activity, the way mermaids already are.
- **Variant**: which person a walker is — neutral, man, or woman. Chosen once from
  the set the device can actually draw, never changed, round-trips through save and
  undo. The chooser holds a shuffled cycle of the drawable variants so none repeats
  until all have been used.
- **Picture set**: the resolved answer to "what can this device draw" — one picture
  per (variant, frame) plus the toolbar button's picture. Decided once per session
  from the probe and shared by the canvas and the toolbar.
- **Old saved person**: a person in the previous placed-object shape, found in an old
  save or an old stored history step. Read only to be migrated into a walker; never
  written in that shape again.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Over 2,000 simulated frames on adversarial terrain (hills, ledges,
  walls, pits, sand poured on her, ground erased from under her), a person is never
  outside the grid, never inside solid material for longer than a short bounded
  interval, and always resumes strolling — 0 stuck states across the whole run.
- **SC-002**: In a headless sim, a person's position changes over time and she spends
  a meaningful share of frames standing and a meaningful share walking — she neither
  freezes for the whole run nor moves on every single frame.
- **SC-003**: 100% of placed people survive a save/restore cycle, an undo/redo cycle,
  and a grid rotation with the same count, the same positions (within the remap
  tolerance), and **the same variant** — zero lost people, zero variant drift.
- **SC-004**: 100% of people held in an old save or old stored history come back as
  walkers at their old positions, and 0 invisible solid cells remain where their
  footprints were. Restoring such a save never returns "no world".
- **SC-005**: The glyph fallback ladder produces a drawable picture in 100% of probe
  outcomes tested, including the everything-missing and probe-unavailable cases —
  0 empty boxes and 0 split sequences reachable by any code path. A poke produces a
  visible reaction in 100% of those outcomes too, including the one with no running
  picture.
- **SC-005a**: On a probe result that reports all three variants drawable, 3
  consecutive placements yield 3 distinct variants in 100% of seeded runs; on a result
  that reports only the neutral figure, 100% of placements are that figure.
- **SC-006**: The shipped toolbar control count is unchanged by this feature, and
  every viewport in the representative table used by specs 006/012/013 keeps the
  guarantees those specs make.
- **SC-007**: With 3 people, 3 poodles, and 3 mermaids on the default grid, the sim
  holds the constitution's frame-rate target (60fps target, ≥30fps acceptable) on the
  maintainers' devices, and the added per-frame work is independent of canvas size.
- **SC-008**: The existing test suite passes unchanged, and the build still emits a
  single self-contained `dist/index.html` that plays from `file://`.
- **SC-009**: A child can place a walking person and poke her using only the existing
  picture button and her finger — no reading, no new control, no menu.

## Assumptions

- **Walker, not placed object** *(the issue's recommendation, taken)*: reusing the
  poodle's ground-following locomotion — standing on solids, small ledge steps,
  bounded roaming — rather than inventing new pathing. The cost is that the person
  stops occupying grid cells, which is what FR-027's footprint release is for.
- **People ignore the finger**: per the issue, following the finger stays the
  poodle's job. The child's finger is also her paintbrush, so a person who chased it
  would be dragged around by ordinary painting — the same reasoning that made the
  mermaid poke-only in spec 016.
- **Undo precedent: mermaids, not poodles** *(FR-024)*: a person is in the undo
  history today because she is a placed object. Following the poodle precedent would
  silently remove her from undo, which the child would experience as "undo stopped
  working on people". Cost: people join the per-step history payload, as mermaids
  already have.
- **Cap of 3**: matches poodles and mermaids, and is the worst case the performance
  criterion is written against.
- **Stroll cadence**: slower than the poodle's trot, with pauses between walks, so it
  reads as an amble rather than a strobe. The exact interval is an implementation
  tuning value the maintainers can eyeball and adjust; the spec constrains only that
  she neither freezes nor moves every frame.
- **Strolling near a house is not required**: the issue calls it "a lovely touch, but
  not required". It is out of scope here to keep the change bounded; the roaming
  anchor makes it a cheap later addition.
- **Variant selection is a shuffled cycle, not independent draws** *(FR-013a,
  answering #61)*: random order, but no variant repeats until every drawable variant
  has been used once, so a set of three on a fully-capable device is always mixed.
  This costs nothing in UI over plain randomness and removes the "all three came out
  the same" outcome. The randomness is injected so tests can pin the order.
- **Save/history formats gain optional fields only** *(FR-025)*: a people list
  alongside the existing poodle and mermaid lists, tolerant of absence. No version
  bump, per the issue's explicit warning and the constitution's "absence means none
  of this yet, never corrupt" amendment.
- **Migration reads, never writes, the old shape**: once a world is saved by this
  feature, people live in the new field; the old placed-object person list is read
  for migration and then simply not written again. Saves written by this feature and
  opened by an older build will show no people rather than failing — an accepted
  one-way cost of the change.
- **No new sounds and no new element IDs**, per the issue.
- **Emoji support facts taken as given from the issue**: the walking and running
  pictures are old enough to be safe everywhere the toy runs; the standing picture and
  all gendered forms are the uncertain ones. The probe covers all of them anyway
  rather than trusting that split.
