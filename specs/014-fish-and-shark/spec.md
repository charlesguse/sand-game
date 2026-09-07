# Feature Specification: Fish And A Shark Living In Her Water

**Feature Branch**: `014-fish-and-shark`

**Created**: 2026-09-07

**Status**: Draft

**Input**: Lifecycle issue #45 — "Fish and a shark living in her water"

> ## What I want
>
> Ambient sea life for any water she draws — no new toolbar buttons, so the toolbar budget (specs 012/013) doesn't grow:
>
> - 🐠 **Fish**: small fish appear on their own inside sufficiently large pools of WATER (a simple size threshold), drifting/bobbing gently within the pool. No pathing, no ground-finding — much simpler motion than the poodle/mermaid: pick a direction, glide, turn at pool edges or at random, closer to the fog/cloud drift already in `src/sim/step.ts` than to `pets.ts`'s pursuit logic.
> - 🦈 **Shark**: rarer, appears only in bigger pools; swims among the fish and playfully "chases" them — but **nothing is ever eaten or removed**. Per the constitution, nothing scary, no failure states: fish scatter and regroup, the shark never actually catches one.
> - Both populations stay capped low (pick numbers that keep 60fps trivially — a handful per pool) and disappear cleanly if their pool dries up, gets erased, or drops below the size threshold. Draining or filling water must never leave one stranded looking broken.
> - No new grid-element IDs needed — track fish/shark as their own lightweight state array (like `PetsState`/`Poodle` in `src/sim/pets.ts`), not as per-cell bytes in the grid.
>
> ## Cross-cutting checklist
>
> - Eraser removes fish/sharks it touches; 🗑️ clear-all removes all of them.
> - State the persistence decision explicitly rather than leaving it implicit: is it fine for fish/sharks to simply respawn from whatever water is present after a reload/undo, rather than being saved and restored individually? (Recommended — much simpler, and she won't miss an individual fish.) If the spec instead saves them individually, cover that round-trip.
> - Grid resize/rotate: re-derive gracefully (respawn-from-water is naturally robust to this) rather than crash or vanish oddly.
> - Vitest coverage for the spawn-threshold rule and the "shark never catches a fish" invariant, no DOM/browser harness (Constitution Principle V).
>
> ## Notes for spec (decisions open — ask if unclear)
>
> - **Pool size thresholds** for "fish appear" vs. "shark appears": pick something that feels rare-but-findable; exact numbers are the spec's call.
> - 🐠 (Unicode 6.0) and 🦈 (Unicode 9.0) are both old, safe emoji per the `CLAUDE.md` Windows-10/Fire caution — no SVG fallback expected, but eyeball both platforms per the CLAUDE.md verification table.
>
> Existing water behavior (flow, evaporation/fog, star-powered weather) must not regress.

## Clarifications

### Session 2026-09-07 (answered by @charlesguse on issue #45)

- **Q: Are 120 cells (fish) and 700 cells (shark) the right "rare but findable"
  calibration, or should the thresholds scale with field size?** → Keep 120 / 700
  as fixed cell counts against the default field. Already calibrated and simple
  to test; scaling by a fraction of the field adds complexity the constitution
  does not ask for here. (FR-003, FR-005)
- **Q: On a canvas of many puddles, should the caps be global with largest pools
  populated first, per-pool only, or spread one-per-pool?** → Global caps,
  largest pools first — consistent with the existing cap pattern in the game and
  it keeps the performance budget bounded however many puddles she draws.
  (FR-006)
- **Q: After the eraser removes a creature, should the pool hold off ~3 seconds,
  stay empty until its water changes, or replace at once?** → ~3 second hold-off,
  then repopulate on its own. The eraser visibly works, and the pond quietly
  refills rather than looking broken or permanently emptied. (FR-025)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fish come to live in her pond (Priority: P1)

The child pours pink water with the brush she already knows until she has a
proper puddle. She keeps pouring. A moment later a little fish is *there* —
she did not press anything, she did not ask for it, it simply came to live in
her water. It glides slowly from one side of the pond to the other, bobbing
gently, turns around when it reaches the edge, and sometimes changes its mind
half-way across for no reason at all. Make the pond bigger and a second and
third fish turn up. The fish never leave the water, never get stuck in the
sand, and never do anything but swim.

**Why this priority**: This is the whole delight in one gesture, and it is
complete on its own — a pond with fish in it is a finished toy moment even if
no shark is ever built. Every other story in this spec depends on fish
existing first.

**Independent Test**: In a headless grid, fill a region with water above the
fish threshold, run the simulation, and assert that fish appear, that their
number matches the pool-size rule, that every fish's position is always inside
a water cell of that pool, that they reverse at pool edges, and that not one
cell of the play field is modified by their presence.

**Acceptance Scenarios**:

1. **Given** a canvas with a small splash of water below the fish threshold, **When** the simulation runs for many seconds, **Then** no fish ever appears.
2. **Given** the child pours water until the pool crosses the fish threshold, **When** the simulation runs, **Then** a fish appears in that pool within about a second, without any button being pressed.
3. **Given** a pool well above the threshold, **When** the simulation runs, **Then** the number of fish grows with the size of the pool but never exceeds the per-pool cap.
4. **Given** fish in a pool, **When** the child watches one, **Then** it glides at a pace she can follow with her eyes and bobs gently as it goes — a drift, not a dart and not a crawl.
5. **Given** a fish approaching the edge of its pool — the shore, the surface, the bottom, a wall of sand, or a placed object — **When** it arrives, **Then** it turns and swims back into the water instead of passing through, tunnelling, or leaving the pool.
6. **Given** fish swimming, **When** the simulation runs, **Then** they sometimes change direction on their own, so the pond never looks like a metronome.
7. **Given** fish anywhere on the field, **When** the simulation runs, **Then** water still flows, evaporates into fog, forms clouds and rains exactly as it did before, grass still drinks, poodles still shake off water, and no cell of the play field is changed by a fish.
8. **Given** a fish on screen, **When** the child looks at it, **Then** it reads instantly as a friendly little fish, with no reading required.

---

### User Story 2 - A shark comes to play in the big lake (Priority: P2)

The child keeps going until she has a real lake, not a pond. Something bigger
turns up: a shark, cruising among her fish. It swings towards one, the fish
scoot out of the way in a little burst, and the shark peels off and cruises
after another one. It is a game of tag that nobody ever wins. No fish ever
disappears, nothing is bitten, nothing is lost — she can count her fish before
and after and there are just as many.

**Why this priority**: The shark is the "wow" the lake earns, and it is the
part with the constitutional risk (nothing scary, no failure states), so it
gets its own story and its own hard invariant. It depends on fish existing,
so it ranks second.

**Independent Test**: In a headless grid, fill a region above the shark
threshold, run the simulation for a long run of steps, and assert that exactly
one shark appears, that the fish count never decreases for any reason
attributable to the shark, that the shark's distance to every fish never drops
below the minimum separation, and that fish which scattered are drifting
normally again shortly afterwards.

**Acceptance Scenarios**:

1. **Given** a pool above the fish threshold but below the shark threshold, **When** the simulation runs for many seconds, **Then** no shark ever appears there.
2. **Given** a pool at or above the shark threshold, **When** the simulation runs, **Then** exactly one shark appears in it — never two.
3. **Given** a shark and fish in the same pool, **When** the shark swings towards a fish, **Then** the fish turns away and scoots off in a short burst, and other nearby fish scatter with it.
4. **Given** a shark chasing a fish for as long as the simulation runs, **When** the fish count is checked at any moment, **Then** it is never lower than it was — no fish is ever caught, eaten, hidden or removed by the shark.
5. **Given** a shark closing on a fish, **When** the gap narrows to the minimum separation, **Then** the shark never gets closer than that and never shares a cell with a fish.
6. **Given** a chase in progress, **When** it has run for a few seconds, **Then** the shark loses interest and cruises off or picks a different fish, so no fish is ever cornered or hounded without end.
7. **Given** fish that have just scattered, **When** a few seconds pass, **Then** they settle back into their ordinary drifting and gather in the pool again.
8. **Given** a shark in a pool with no fish left in it, **When** the simulation runs, **Then** it simply cruises like a fish does — no hunting behaviour with nothing to hunt.
9. **Given** the shark on screen, **When** the child watches it, **Then** nothing about it reads as frightening: no biting, no chomping, no red, no danger sound, no vanishing fish, nothing that could make her think something bad happened.

---

### User Story 3 - Fish come and go without anything looking broken (Priority: P3)

The child does what she always does: she erases half the pond, scribbles sand
into it, presses 🗑️ to start over, undoes a few strokes, rotates the tablet,
and comes back tomorrow to the world that saved itself. Her fish behave
sensibly through all of it. Drain the pond and the fish are simply gone —
never flopping on the sand, never stuck inside a dune, never half-drawn at the
edge of the screen. Fill it back up and fish come back. Rub the eraser over a
fish and that fish is gone straight away and stays gone long enough that it
plainly worked.

**Why this priority**: This is the "never broken" requirement from the
constitution rather than a new delight, but it is what keeps the feature from
producing the toy's first-ever "that looks wrong" moment. It depends on both
stories above.

**Independent Test**: In a headless grid, drive each lifecycle event —
draining a pool below threshold, drawing over it, erasing across a fish,
clearing all, restoring a saved world, restoring an undo state, re-deriving
onto a differently-shaped grid — and assert after each that every remaining
fish and shark sits inside water and inside the grid, that removed ones are
gone, and that nothing throws.

**Acceptance Scenarios**:

1. **Given** a pool with fish in it, **When** the water drains, evaporates, is drawn over with sand, or is erased until the pool is below the fish threshold, **Then** its fish are gone within about a second and not one of them is ever seen outside water.
2. **Given** a lake with a shark, **When** the lake shrinks below the shark threshold but stays above the fish threshold, **Then** the shark leaves and the fish stay.
3. **Given** a pool that splits into two puddles, **When** the simulation runs, **Then** each puddle keeps only the fish its own size earns and the rest are gone; **and given** two pools that merge into one big lake, **Then** the combined lake is populated by the rule for its combined size.
4. **Given** a fish leaving for any reason, **When** the child watches, **Then** it just fades out of the pond — nothing dies, nothing sinks, no bones, no puff, no message.
5. **Given** the eraser dragged across a fish or a shark, **When** the stroke touches it, **Then** it is removed immediately, and that pool does not instantly produce a replacement, so the eraser plainly did something; **and when** about three seconds have passed, **Then** the pool quietly fills back up under the ordinary rule with no action from her.
6. **Given** any number of fish and sharks, **When** the child presses 🗑️, **Then** every one of them is gone along with everything else, and the empty canvas stays empty.
7. **Given** a world with fish and sharks in it, **When** the app is closed and reopened, **Then** her water, sand, objects and poodles restore exactly as they always have, and fish reappear in whatever water restored — the same kind of fish, not necessarily the same individuals.
8. **Given** a save written before this feature existed, **When** it is loaded, **Then** it restores exactly as it does today and gets fish in its water.
9. **Given** fish and a shark on screen, **When** the child presses Undo or Redo, **Then** undo and redo behave exactly as they do today and the populations re-settle to match whatever water the restored state has.
10. **Given** fish and a shark on screen, **When** the tablet is rotated or the fullscreen button re-derives the play field, **Then** nothing crashes, no fish is left outside the play area or outside water, the undo history survives as it does today, and populations re-settle within about a second.

---

### Edge Cases

- **A pool exactly at the threshold**, wobbling one cell either side of it as water sloshes: the population must not flicker in and out every frame — crossing the line has to be steady enough that the child never sees a strobing fish.
- **Very many small pools** (a canvas of puddles, or rain pattering into dozens of dents): total fish and sharks stay under the global caps, so cost cannot grow with the number of puddles she draws, and the biggest pools are the ones that get populated — a qualifying puddle can end up with no fish because the caps were already spent on larger water.
- **A pool that is one cell tall and very wide** (a thin flood across the floor): either it is populated and the fish visibly fit inside it, or it does not qualify — never a fish rendered mostly outside its own water.
- **Water inside a preloaded landscape scene**: the same rule applies with no special-casing, so switching scenes populates the new water and drops the old scene's fish.
- **Star power waved over a populated lake**: water becomes fog, the pool shrinks, and the fish leave under the ordinary rule; the weather cycle itself is untouched.
- **Rain refilling a pond that just lost its fish**: fish come back once it qualifies again, with no memory of the previous ones.
- **A poodle walking or shaking through a populated pool**: neither the poodle nor the fish is disturbed, and neither is removed.
- **A fish's pool cut in half by a stroke of sand drawn straight through it** while the fish is mid-glide.
- **Grid re-derivation to a much smaller play field** where the old positions are out of bounds.
- **The eraser used on the *water* under a fish** rather than on the fish itself.
- **A shark and fish in a pool the child then erases entirely in one stroke.**
- **Photo share (📷) taken mid-chase**: the picture contains whatever was on screen, and taking it changes nothing about the fish.

## Requirements *(mandatory)*

### Functional Requirements

**Fish appearing**

- **FR-001**: The toy MUST place fish into sufficiently large bodies of water on its own, with no button, tool, gesture or menu — the child never asks for fish and can never fail to get them.
- **FR-002**: A body of water MUST be treated as one "pool" — the water cells connected to each other — and its size measured as a count of those cells.
- **FR-003**: A pool MUST get fish once its size reaches the fish threshold, and MUST get none below it. Fish threshold: **120 water cells** — about one large-brush blob, so a few deliberate strokes earn a fish. Thresholds are fixed cell counts calibrated against the 270×160 default field, not a fraction of the field.
- **FR-004**: The number of fish in a pool MUST grow with the pool's size and MUST be capped at **3 fish per pool**.
- **FR-005**: A pool MUST get a shark only once its size reaches the shark threshold (**700 water cells** — a lake, not a pond), and MUST never have more than one shark.
- **FR-006**: Totals across the whole play field MUST be capped at **6 fish and 2 sharks**, whatever the child draws. When more pools qualify than the caps allow, the largest pools MUST be populated first — a big lake fills to its per-pool cap before a smaller puddle gets anything.
- **FR-007**: Newly qualifying water MUST be populated within about a second of qualifying, so the arrival feels like a response to her pouring.
- **FR-008**: The feature MUST add no toolbar control of any kind; the toolbar's control count and layout budget from specs 012/013 MUST be unchanged.

**How they move**

- **FR-009**: Fish MUST move by simple drift — a chosen direction, a steady glide, and a gentle bob — with no pathing, no target-seeking and no ground-finding.
- **FR-010**: Fish MUST turn around at the boundary of their pool, and MUST also change direction occasionally at random.
- **FR-011**: A fish MUST always be inside water belonging to its own pool. It MUST never overlap sand, dirt, grass, flowers, gumdrops, fog, cloud, a placed object, or empty air, and MUST never leave the play field.
- **FR-012**: Fish and sharks MUST NOT modify the play field. No cell's element, colour, or any other per-cell value may be written by this feature, so water flow, evaporation, fog, clouds, rain, grass drinking, star power and every existing element behaviour continue unchanged.
- **FR-013**: Fish MUST be drawn as the 🐠 glyph and sharks as the 🦈 glyph, each facing the way it is swimming, with the shark clearly the larger of the two — no custom artwork assets.
- **FR-014**: The feature MUST add no new sound. It stays fully silent, and the existing 🔊/🔇 behaviour is untouched.

**The shark's game of tag**

- **FR-015**: A shark MUST swim in its own pool among the fish, moving somewhat faster than they do, and MUST head toward a nearby fish in that pool.
- **FR-016**: The shark MUST NEVER catch a fish. No fish may ever be removed, hidden, shrunk, moved off-field, or otherwise changed in count or existence as a result of the shark. The fish population may only ever change through the pool rules of FR-003…FR-006 and the removals of FR-021…FR-023.
- **FR-017**: The shark MUST NEVER come closer to a fish than a fixed minimum separation (default **2 cells**), and MUST never share a cell with one — the near-miss is the whole trick, and it is a hard floor rather than a tendency.
- **FR-018**: When the shark comes near, fish MUST scatter — turn away and move off in a short burst — and MUST return to ordinary drifting within a few seconds.
- **FR-019**: A chase MUST end on its own after a few seconds, with the shark cruising off or choosing another fish, so no fish is ever cornered, trapped, or pursued without relief.
- **FR-020**: With no fish in its pool, the shark MUST simply drift as a fish does.
- **FR-021**: Nothing in the feature may read as frightening or as a failure: no biting, chomping, blood, alarm colour, danger sound, or fish that vanishes at the moment a shark reaches it.

**Leaving cleanly**

- **FR-022**: When a pool falls below a threshold — drained, evaporated, drawn over, erased, or split — the fish and shark it can no longer support MUST be gone within about a second, and MUST never be shown outside water in the meantime.
- **FR-023**: A departure MUST look like a gentle disappearance. Nothing dies, sinks, flops, breaks, or produces a message, a mark, or any other error surface.
- **FR-024**: The eraser MUST remove any fish or shark its stroke passes over, immediately, including on a fast drag whose pointer samples straddle the creature.
- **FR-025**: After the eraser removes a creature, its pool MUST NOT immediately produce a replacement; repopulation of that pool MUST be held off for a short, visible delay of **about 3 seconds** so the eraser is plainly seen to work. Once the hold-off passes, the pool MUST repopulate on its own under the ordinary rule — an erased pool is never permanently emptied, and the child never has to do anything to get her fish back.
- **FR-026**: 🗑️ clear-all MUST remove every fish and shark along with everything else, and the cleared canvas MUST stay empty.

**Saving, undo, and re-derivation**

- **FR-027**: Fish and sharks MUST NOT be saved individually. The saved-world format MUST be unchanged — no new fields, no version bump — so worlds saved before this feature load exactly as they do today.
- **FR-028**: After a reload, populations MUST re-establish from whatever water restored, within about a second. The child gets fish of the same kind in the same water, not the same individual fish, and there is no way for her to notice the difference.
- **FR-029**: Undo and redo MUST behave exactly as they do today. Fish and sharks are not part of an undo state; populations simply re-settle to match the restored water.
- **FR-030**: On any re-derivation of the play field (rotation, resize, fullscreen), populations MUST be re-derived from the new field: nothing out of bounds, nothing outside water, nothing stranded, and no crash. The undo history MUST continue to survive re-derivation exactly as the constitution requires.

**Cost and shape of the state**

- **FR-031**: Fish and sharks MUST be tracked in their own lightweight state alongside the grid — like the existing pets state — and MUST NOT be stored as per-cell values in the play field. No new element identity is introduced, and the per-cell formats used by saving and undo are unchanged.
- **FR-032**: Measuring pools MUST be bounded and spread out over time rather than repeated in full every frame, and its cost MUST NOT grow with how much water the child has drawn beyond a single bounded pass of the play field.
- **FR-033**: With every cap filled, the simulation MUST hold the constitution's performance bar — 60fps target, never below 30fps — at the default field size on the reference devices.

**Verification**

- **FR-034**: Automated tests, running with no DOM and no browser, MUST cover: the spawn-threshold rule at, below and above each threshold; the per-pool and global caps, including that the largest pools are populated first when more pools qualify than the caps allow; the eraser hold-off, including that the pool does repopulate once it elapses; the "shark never catches a fish" invariant over a long run; that no play-field cell is written by the feature; that draining, erasing and clearing remove creatures and leave none outside water; and that re-derivation onto a different field shape leaves every creature in-bounds and in water.

### Key Entities

- **Pool**: a connected body of water in the play field, measured by how many water cells it contains. Not a stored thing the child can see or name — it is re-measured from the water as it is, which is what makes every population automatically correct after drawing, draining, saving, undoing or rotating.
- **Fish**: one drifting creature that belongs to a pool. It has a place in the field, a direction it is gliding, and a gentle bob. It has no needs, no goals, no health, and no effect on anything.
- **Shark**: one larger, faster creature that belongs to a pool and takes an interest in the fish there. It has a place, a direction, a current interest, and a limit on how close it may ever get and how long an interest may last. It can never remove or reach a fish.
- **Sea life state**: the whole collection of fish and sharks, held beside the play field rather than inside it, re-derived from the water rather than saved.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A child who pours water with the largest brush for a few seconds sees her first fish within 2 seconds of the pool becoming big enough, without pressing anything.
- **SC-002**: Across a 10-minute session with a shark and the full complement of fish, the number of fish never decreases for any reason other than the child's own erasing, clearing, or shrinking of the water — the shark accounts for zero removals.
- **SC-003**: At no moment is any fish or shark drawn outside water, outside its pool, or outside the play field — including within one second of a pool being drained, erased, split, or drawn over.
- **SC-004**: The toolbar has exactly the same controls, in the same arrangement, as it does today on every viewport already covered by the layout budget.
- **SC-005**: With all populations at their caps, the simulation holds at least 30fps on a Fire 7 Kids tablet and an iPad at the default field size, and 60fps on a mid-range laptop.
- **SC-006**: After closing and reopening the app, the restored world is indistinguishable from today's restore except that its water has fish in it again within 2 seconds; worlds saved before this feature load with a 100% success rate.
- **SC-007**: Undo and redo depth, timing and behaviour are unchanged, and populations match the restored water within 2 seconds of any undo, redo or rotation.
- **SC-008**: A single eraser stroke across a fish removes it 100% of the time, and no replacement appears in that pool for the hold-off period, so an adult watching over her shoulder can always tell the eraser worked.
- **SC-009**: Two adults asked to watch a chase describe it as playing, not hunting; neither reports anything scary, and neither can find a moment where a fish disappears near the shark.
- **SC-010**: Water flow, evaporation into fog, cloud formation, rain, grass drinking, star power and poodle behaviour are unchanged — every existing automated test continues to pass without modification.

## Manual Verification *(what a maintainer must eyeball, per Constitution Principle V)*

Per the two-platform table in `CLAUDE.md`, this feature is drawn on the canvas
rather than in the toolbar, so glyph coverage is not caught by the existing
toolbar-glyph test and must be looked at on both columns:

- **iPad (Safari, home-screen app) — Max**: 🐠 and 🦈 render as real emoji at the
  sizes used, the chase is legible and unfrightening at that pixel density, and
  the pond does not stutter with all caps filled.
- **Fire 7 Kids tablet (Silk) and desktop Chrome — Charlie**: the same two glyphs
  render as emoji and not as empty boxes (both predate the Emoji 13.0 cutoff that
  bites on Segoe UI Emoji / Fire, so no fallback artwork is expected — but it is
  confirmed by looking, not by assumption), and the frame rate holds on the Fire 7.
- **Both**: rotate the device with a populated lake on screen and confirm nothing
  is stranded, nothing flickers, and the undo history survives.

## Assumptions

- **Persistence is respawn-from-water, as recommended in the issue.** Fish and
  sharks are never saved, never restored individually, and never carried through
  undo/redo. This is the decision the issue asked to be made explicit: she will
  not miss an individual fish, and re-deriving from the water makes reload, undo,
  rotation, resize and scene switching all correct by construction with no
  round-trip to test (FR-027…FR-030).
- **No new element identity and no per-cell storage.** Sea life lives in its own
  state beside the play field, as the issue specifies, so the saved-world and
  undo formats are untouched and old saves keep loading (FR-031).
- **No new toolbar control**, so the canvas-first toolbar budget from specs 012
  and 013 is unaffected and needs no re-derivation.
- **No new sound.** The feature is silent; adding a bloop for a fish is a
  separate decision and is out of scope here.
- **No new way for the child to interact with fish.** She cannot place them,
  poke them, or feed them — the only controls that touch them are the eraser and
  🗑️, which she already knows. A poke-the-fish reaction like the poodle's trick
  is deliberately out of scope for this spec.
- **The numbers are settled**, calibrated against the 270×160 default field
  (43,200 cells) and confirmed by the maintainer: fish at 120 connected water
  cells, shark at 700, 3 fish per pool, 6 fish and 2 sharks overall, minimum
  shark-to-fish separation of 2 cells, and a ~3 second hold-off after an eraser
  removal. They are fixed cell counts rather than a fraction of the field, which
  keeps the rule simple to test; if a non-default field size ever makes them feel
  wrong on a device, that is a retune, not a redesign.
- **Both glyphs predate the platform glyph-coverage caution** in `CLAUDE.md`
  (🐠 Unicode 6.0, 🦈 Unicode 9.0), so no inline SVG fallback is planned — but
  both are on the manual verification list above.
- **Fish are visual only.** They are drawn over the play field like the existing
  poodles and objects, so they appear in a shared photo (📷) exactly as anything
  else on the canvas does, and need nothing added for that to be true.
- Existing water, weather, grass, gumdrop, poodle, undo, save and layout
  behaviour is a dependency of this feature and must not regress.
