# Feature Specification: Butterflies Over Her Flowers, Birds On Her Palms

**Feature Branch**: `017-butterflies-and-birds`

**Created**: 2026-09-07

**Status**: Draft

**Input**: Lifecycle issue #46 — "Butterflies over her flowers, birds on her palms"

> ## What I want
>
> More ambient life, paired with what already exists — again no new toolbar buttons:
>
> - 🦋 **Butterflies**: appear near/visit 🌼 flowers (grown from watered grass, spec 007) — a few flutter around existing flowers and drift on to find others. Motion is purely decorative: a gentle non-physical float, not gravity-affected like sand.
> - 🐦 **Birds**: perch on 🌴 palm objects, occasionally hop or fly short distances between palms, or off and back.
> - Same treatment as the fish/shark feature filed alongside this one: lightweight, non-grid state, capped low, no failure states, nothing that can strand or visibly "break."
>
> ## Cross-cutting checklist
>
> - Eraser removes butterflies/birds it touches; 🗑️ clear-all removes them.
> - State the persistence decision explicitly (respawn near flowers/palms after reload/undo, vs. saved individually) rather than leaving it implicit — same call as the concurrently-filed fish/shark feature; recommend respawn-from-context for the same reason (much simpler, nothing she'd miss).
> - Resize/rotate: re-derive gracefully rather than crash or vanish oddly.
> - Vitest coverage for the spawn-near-flowers/perch-on-palm rules, no DOM/browser harness (Constitution Principle V).
>
> ## Notes for spec (decisions open — ask if unclear)
>
> - **No flowers or palms yet in a scene**: butterflies/birds simply don't appear until she grows a flower or places a palm — that's expected, not a bug to work around.
> - 🦋 (Unicode 9.0) and 🐦 (Unicode 1.0) are old, safe emoji per the `CLAUDE.md` Windows-10/Fire caution — no SVG fallback expected, but eyeball both platforms per the CLAUDE.md verification table.
>
> Existing flower-growth (spec 007) and palm-object behavior must not regress.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Butterflies come to her garden (Priority: P1)

The child does what she already knows how to do: she draws grass, pours pink
water on it, and waits for the garden to bloom. The first 🌼 opens — and a
moment later a butterfly is *there*, wobbling through the air above it. She
did not press anything. It circles the flower, hangs about for a few seconds,
then wanders off across the canvas to find another one and does the same
thing there. Grow more flowers and more butterflies turn up. They float — no
falling, no landing in the sand, no being rained on — just a soft crooked
flight that never goes in a straight line.

**Why this priority**: This is the whole delight in one gesture and it stands
alone — a garden with butterflies over it is a finished toy moment even if no
bird is ever built. It also gives her flowers, which today just sit there, a
reason to keep growing.

**Independent Test**: In a headless grid, grow (or place) flower cells, run
the simulation, and assert that butterflies appear only once a flower exists,
that their number follows the flower-count rule and never exceeds the cap,
that each one stays inside the play field and near a flower or in transit
between two, that their path wobbles rather than running straight, that terrain of any kind
under them neither deflects nor detains them, and that not one cell of the play
field is modified by their presence.

**Acceptance Scenarios**:

1. **Given** a canvas with no flowers at all, **When** the simulation runs for many seconds, **Then** no butterfly ever appears — this is the expected, correct behaviour and nothing on screen suggests something is missing.
2. **Given** watered grass that blooms its first flower, **When** the simulation runs, **Then** a butterfly appears near that flower within about a second, with no button pressed.
3. **Given** a garden with many flowers, **When** the simulation runs, **Then** the number of butterflies grows with the number of flowers but never exceeds the global cap.
4. **Given** a butterfly near a flower, **When** the child watches it, **Then** it flutters around that flower for a few seconds — a wobbling, curving float at a pace her eye can follow — and then drifts away toward a different flower.
5. **Given** a butterfly in flight, **When** the simulation runs, **Then** it never falls, never sinks, never sits still on the ground, and is never dragged by water, wind, or any element behaviour — its motion is decorative only.
6. **Given** butterflies anywhere on the field, **When** the simulation runs, **Then** grass still drinks and grows, flowers still bloom exactly as they do today, water still flows and evaporates, and no cell of the play field is changed by a butterfly.
7. **Given** a butterfly on screen, **When** the child looks at it, **Then** it reads instantly as a friendly butterfly, with no reading required.
8. **Given** a butterfly whose route to the next flower crosses a dune of sand, a wall of dirt, or a pond, **When** the simulation runs, **Then** it floats straight over the top of all of it without turning away, stopping, or getting caught in a pocket — the terrain is scenery underneath it, nothing more.

---

### User Story 2 - A bird lives in her palm tree (Priority: P2)

The child taps the 🌴 button and puts a palm on her beach. Shortly after, a
little bird is sitting in it. It stays put mostly, then hops a step along the
top of the tree, and every so often it takes off — a short flight over to
another palm if she has planted one, or a little loop out and back to the
same tree. It always ends up perched on a palm again. Plant a second and a
third palm and each gets a bird of its own.

**Why this priority**: It is the second half of the pairing the issue asks
for and it is independently valuable — palms with birds in them work with no
butterflies present — but the garden path (grass → water → flower) is the one
she walks every session, so butterflies come first.

**Independent Test**: In a headless grid, place palm objects, run the
simulation, and assert that a bird appears per palm up to the cap, that a
perched bird's position sits on its palm, that it periodically hops or flies,
that every flight ends perched on some palm, that every point along a flight
stays inside the play field, that it is never left mid-air with no palm to land
on, and that no play-field cell is written.

**Acceptance Scenarios**:

1. **Given** a canvas with no palms, **When** the simulation runs for many seconds, **Then** no bird ever appears — expected, not a bug.
2. **Given** the child places a palm, **When** the simulation runs, **Then** a bird perches in it within about a second, with no button pressed.
3. **Given** two or three palms on the canvas, **When** the simulation runs, **Then** each palm gets its own bird, up to the global bird cap, and no palm ever holds two birds at once.
4. **Given** a perched bird, **When** the child watches for a while, **Then** it occasionally hops a short step on its perch, so it never looks frozen or like a decal painted on the tree.
5. **Given** two or more palms, **When** a bird takes off, **Then** it flies a short, gentle arc and lands perched on a palm — the same one or another one — and never lands in sand, water, or mid-air.
6. **Given** a single palm, **When** its bird takes off, **Then** it makes a short loop up and around, in full view the whole way, and returns to that same palm — it never disappears off an edge of the screen and comes back.
7. **Given** birds anywhere on the field, **When** the simulation runs, **Then** palms sway and shiver when poked exactly as they do today, objects place and evict as they do today, and no cell of the play field is changed by a bird.
8. **Given** a bird on screen, **When** the child looks at it, **Then** it reads instantly as a friendly little bird, with no reading required.

---

### User Story 3 - They come and go without anything looking broken (Priority: P3)

The child does what she always does: she erases a patch of garden, scribbles
sand over her flowers, presses 🗑️ to start over, undoes a few strokes,
rotates the tablet, switches to a landscape scene, and comes back tomorrow to
the world that saved itself. The butterflies and birds behave sensibly
through all of it. Burn the flowers away with star power and the butterflies
are simply gone — never stuck hovering over bare dirt, never half-drawn at
the edge of the screen. Erase a palm and its bird goes with it, not left
hanging in the air where the tree used to be. Rub the eraser over a butterfly
and that butterfly is gone straight away and stays gone long enough that it
plainly worked.

**Why this priority**: This is the constitution's "never broken" requirement
rather than a new delight, but it is what keeps ambient life from producing
the toy's first "that looks wrong" moment. It depends on both stories above.

**Independent Test**: In a headless grid, drive each lifecycle event —
removing the last flower, erasing a palm, erasing across a creature, clearing
all, switching scenes, restoring a saved world, restoring an undo state,
re-deriving onto a differently-shaped grid — and assert after each that every
remaining butterfly is in-bounds with a flower still on the field, every
remaining bird is in-bounds and perched on or flying between live palms, that
removed ones are gone, and that nothing throws.

**Acceptance Scenarios**:

1. **Given** butterflies over a garden, **When** the last flower is burned, erased, drawn over, or otherwise removed, **Then** every butterfly is gone within about a second and none is ever left hovering over a flowerless canvas.
2. **Given** a bird perched on a palm, **When** that palm is erased, evicted by a fourth palm being placed, or removed by clear-all, **Then** the bird does not stay hanging where the tree was: if another palm remains it flies to it, and if none remains it is gone within about a second.
3. **Given** a butterfly or bird leaving for any reason, **When** the child watches, **Then** it simply flutters out of sight — nothing dies, drops, breaks, or produces a message, a mark, or any other error surface.
4. **Given** the eraser dragged across a butterfly or bird, **When** the stroke touches it, **Then** it is removed immediately, including on a fast drag whose pointer samples straddle it; **and** no replacement appears in that spot for a short, visible hold-off, so the eraser is plainly seen to have worked; **and when** the hold-off passes, the ordinary rule quietly brings the population back with no action from her.
5. **Given** any number of butterflies and birds, **When** the child presses 🗑️, **Then** every one of them is gone along with everything else, and the cleared canvas stays empty.
6. **Given** a world with butterflies and birds in it, **When** the app is closed and reopened, **Then** her sand, water, flowers, objects and poodles restore exactly as they always have, and butterflies and birds reappear around whatever flowers and palms restored — the same kind of creature, not necessarily the same individuals.
7. **Given** a save written before this feature existed, **When** it is loaded, **Then** it restores exactly as it does today and gets butterflies and birds around its flowers and palms.
8. **Given** butterflies and birds on screen, **When** the child presses Undo or Redo, **Then** undo and redo behave exactly as they do today and the populations re-settle to match whatever flowers and palms the restored state has.
9. **Given** butterflies and birds on screen, **When** the tablet is rotated or the fullscreen button re-derives the play field, **Then** nothing crashes, nothing is left outside the play area or stranded away from any flower or palm, the undo history survives as it does today, and populations re-settle within about a second.
10. **Given** the child switches to a preloaded landscape scene, **When** the new scene loads, **Then** the old scene's butterflies and birds are gone and the new scene's flowers and palms (if it has any) get their own within about a second.

---

### Edge Cases

- **A single flower flickering in and out** as grass regrows or star power sweeps past: the butterfly population must not strobe in and out every frame — crossing the "has flowers" line has to be steady enough that the child never sees a flashing butterfly.
- **A canvas covered in flowers** (a whole field of blooms): the total stays under the global cap, so cost cannot grow with how much garden she grows.
- **Flowers packed in one corner versus scattered to both edges**: a butterfly drifting between distant flowers must cross the canvas at a pace that reads as wandering, and must never be left in permanent transit with no flower to arrive at.
- **A butterfly in flight when its destination flower disappears** mid-crossing: it picks a different flower or leaves, and never freezes in place or heads for a spot with nothing there.
- **Butterflies and heavy weather**: fog, cloud, rain and star power sweep across a butterfly's airspace with no effect on it and no effect on them.
- **A palm placed on top of another palm's spot**, or the fourth palm evicting the oldest: bird counts follow the palms that actually exist, with no bird orphaned by the eviction.
- **A palm that is placed high in the sky, half off the edge, or under water**: its bird still perches on it sensibly or the palm simply gets no bird — never a bird drawn outside the play field, and a take-off from a palm near an edge still keeps its whole arc in view.
- **A butterfly whose next flower sits inside a sealed pocket of sand or under a dirt lid**: it floats over the terrain to reach it as normal — there is no pathing to fail and no pocket that can trap it.
- **A bird mid-flight when every palm is erased in the same stroke**: it leaves cleanly instead of circling forever.
- **A poodle trotting or a poked palm shivering under a perched bird**: neither disturbs the other, and neither is removed.
- **Grid re-derivation to a much smaller play field** where the old positions are out of bounds.
- **The eraser used on the flower or palm under a creature** rather than on the creature itself.
- **Photo share (📷) taken mid-flight**: the picture contains whatever was on screen, and taking it changes nothing.
- **Both this feature and the concurrently specified sea life (spec 014) fully populated at once**: all ambient creatures together stay within the performance bar.

## Requirements *(mandatory)*

### Functional Requirements

**Butterflies appearing**

- **FR-001**: The toy MUST place butterflies near flowers on its own, with no button, tool, gesture or menu — the child never asks for butterflies and can never fail to get them.
- **FR-002**: Butterflies MUST appear only while at least one flower exists in the play field, and MUST NOT appear on a canvas with no flowers. A flowerless canvas is correct behaviour, not a defect, and MUST show no placeholder, hint, or empty-state of any kind.
- **FR-003**: The number of butterflies MUST grow with the number of flowers on the field and MUST be capped globally, at **one butterfly per 4 flowers, rounded up, capped at 4 butterflies** on the whole field — so the first flower earns exactly one butterfly and no garden, however large, is ever busier than four. The count is a fixed number of creatures, not a fraction of the field size, and is the same on every device.
- **FR-004**: A newly qualifying garden MUST get its first butterfly within about a second of a flower appearing, so the arrival feels like a response to her watering.
- **FR-005**: The population MUST NOT flicker: brief, momentary changes in flower count MUST NOT cause butterflies to appear and disappear repeatedly within a second or two.

**How butterflies move**

- **FR-006**: Butterfly motion MUST be purely decorative and non-physical: no gravity, no falling, no resting on the ground, no being pushed by water, fog, wind, rain or any element behaviour.
- **FR-007**: A butterfly MUST flutter around a chosen flower for a few seconds, then choose another flower — possibly across the canvas — and drift toward it, repeating for as long as flowers exist.
- **FR-008**: A butterfly's path MUST wobble and curve rather than travel in a straight line, and MUST move at a pace the child's eye can follow — a float, not a dart and not a crawl.
- **FR-009**: A butterfly MUST always be drawn inside the play field, and within it MUST be free to float over any terrain — sand, dirt, grass, water, anything — as a decorative overlay. It MUST NOT path around, turn away from, or collide with solid cells, so it can never be trapped in a pocket of terrain or blocked from reaching a flower.
- **FR-010**: If the flower a butterfly is travelling toward disappears, the butterfly MUST choose another flower or leave — it MUST never freeze, hover indefinitely over nothing, or head for an empty spot.

**Birds appearing and perching**

- **FR-011**: The toy MUST place birds on palm objects on its own, with no button, tool, gesture or menu.
- **FR-012**: Birds MUST appear only while at least one palm exists, MUST be at most **one bird per palm**, and MUST be capped globally at **3 birds** (the existing per-kind object cap). A palm-less canvas correctly shows no birds and no empty-state of any kind.
- **FR-013**: A newly placed palm MUST get its bird within about a second.
- **FR-014**: A perched bird MUST sit on its palm — visually on the tree, not floating beside it, not buried in it — and MUST hop a short step on its perch from time to time so it never reads as frozen.
- **FR-015**: A bird MUST occasionally take a short flight and MUST always end that flight perched on a palm that exists: another palm when one is available, otherwise a loop back to its own. It MUST never land in sand, water, or open air. Every flight MUST stay entirely inside the visible play field from take-off to landing — the "off and back" loop is a loop up and around within view, never out past an edge — so the child never watches her bird vanish off the screen.
- **FR-016**: Bird flights MUST be short and gentle — a readable arc of a couple of seconds, not a dart and not a long migration.

**Shared rules**

- **FR-017**: Butterflies and birds MUST NOT modify the play field. No cell's element, colour, or any other per-cell value may be written by this feature, so flower growth (spec 007), grass drinking, water flow, fog, clouds, rain, star power, gumdrops, poodles and every existing element behaviour continue unchanged.
- **FR-018**: Butterflies MUST be drawn as the 🦋 glyph and birds as the 🐦 glyph, each facing the way it is travelling — no custom artwork assets.
- **FR-019**: The feature MUST add no toolbar control of any kind; the toolbar's control count and layout budget from specs 012/013 MUST be unchanged.
- **FR-020**: The feature MUST add no new sound. It stays fully silent, and the existing 🔊/🔇 behaviour is untouched.
- **FR-021**: Nothing in the feature may read as frightening or as a failure: nothing is caught, eaten, hurt, or lost; no alarm colour, no danger sound, no message, and no creature that vanishes at the moment the child touches something.
- **FR-022**: The feature MUST add no new way for the child to interact with these creatures beyond the tools she already has (eraser and 🗑️); butterflies and birds cannot be placed, poked, fed, or selected.

**Leaving cleanly**

- **FR-023**: When the last flower is gone, every butterfly MUST be gone within about a second; when a palm is gone, its bird MUST fly to a remaining palm or be gone within about a second. Neither may be shown stranded — over a flowerless canvas, where a removed palm used to be, or outside the play field.
- **FR-024**: A departure MUST look like a gentle flutter out of sight. Nothing dies, drops, sinks, breaks, or produces a message, a mark, or any other error surface.
- **FR-025**: The eraser MUST remove any butterfly or bird its stroke passes over, immediately, including on a fast drag whose consecutive pointer samples straddle the creature.
- **FR-026**: After the eraser removes a creature, a replacement MUST NOT appear immediately; repopulation MUST be held off for a short, visible delay of **about 3 seconds** — matching the erase hold-off specified for sea life in spec 014 — so the eraser is plainly seen to work. Once the hold-off passes, the population MUST re-establish on its own under the ordinary rule; an erased garden is never permanently emptied and the child never has to do anything to get her butterflies back.
- **FR-027**: 🗑️ clear-all MUST remove every butterfly and bird along with everything else, and the cleared canvas MUST stay empty.

**Saving, undo, and re-derivation**

- **FR-028**: Butterflies and birds MUST NOT be saved individually. The saved-world format MUST be unchanged — no new fields, no version bump — so worlds saved before this feature load exactly as they do today.
- **FR-029**: After a reload, populations MUST re-establish from whatever flowers and palms restored, within about a second. The child gets the same kind of creature around the same flowers and palms, not the same individuals, and there is no way for her to notice the difference.
- **FR-030**: Undo and redo MUST behave exactly as they do today. Butterflies and birds are not part of an undo state; populations simply re-settle to match the restored flowers and palms.
- **FR-031**: On any re-derivation of the play field (rotation, resize, fullscreen), populations MUST be re-derived from the new field: nothing out of bounds, nothing stranded away from every flower and palm, and no crash. The undo history MUST continue to survive re-derivation exactly as the constitution requires.
- **FR-032**: Switching scenes MUST drop the previous scene's butterflies and birds and populate the new scene's flowers and palms, with no special-casing per scene.

**Cost and shape of the state**

- **FR-033**: Butterflies and birds MUST be tracked in their own lightweight state alongside the play field — like the existing pets and objects state — and MUST NOT be stored as per-cell values in the play field. No new element identity is introduced, and the per-cell formats used by saving and undo are unchanged.
- **FR-034**: Locating flowers MUST be bounded and spread out over time rather than repeated in full every frame, and its cost MUST NOT grow with how many flowers the child has grown beyond a single bounded pass of the play field.
- **FR-035**: With every cap filled — and with the sea life of spec 014 also at its caps, if that feature has shipped — the simulation MUST hold the constitution's performance bar: 60fps target, never below 30fps, at the default field size on the reference devices.

**Verification**

- **FR-036**: Automated tests, running with no DOM and no browser, MUST cover: that no butterfly appears with zero flowers and one appears once a flower exists; the flower-count-to-butterfly-count rule (one per 4 flowers, rounded up) and its global cap of 4; that a butterfly crosses terrain of any kind without being deflected or held up; that no bird appears with zero palms, that each palm gets exactly one bird, and the bird cap; that a perched bird's position lies on its palm, that every flight ends perched on a live palm, and that every sampled point of a flight is inside the play field; that removing the last flower or a palm removes or relocates the right creatures and leaves none stranded; the eraser removal and its hold-off, including that the population does re-establish once the hold-off elapses; that clear-all empties the populations; that no play-field cell is written by the feature; and that re-derivation onto a different field shape leaves every creature in-bounds and correctly anchored.
- **FR-037**: Existing automated tests for flower growth (spec 007), palm objects, poodles, undo/redo, saving and the toolbar layout MUST continue to pass without modification.

### Key Entities

- **Flower**: an existing 🌼 cell in the play field, grown by watered grass. This feature only reads flowers — it never creates, moves, or removes one. Where the flowers are is what makes the butterfly population automatically correct after drawing, burning, saving, undoing or rotating.
- **Palm**: an existing 🌴 placed object with a position and a footprint, capped at three. This feature only reads palms and never places or removes one.
- **Butterfly**: one floating creature with a place in the field, a direction, a wobble, and a flower it is currently visiting or travelling toward. It has no needs, no goals, no health, and no effect on anything.
- **Bird**: one creature with a place in the field, a facing, a palm it belongs to, and a state — perched, hopping, or in a short flight toward a palm. It has no needs, no goals, no health, and no effect on anything.
- **Ambient life state**: the whole collection of butterflies and birds, held beside the play field rather than inside it, re-derived from the flowers and palms rather than saved.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A child who waters her grass until it blooms sees her first butterfly within 2 seconds of the first flower appearing, without pressing anything.
- **SC-002**: A child who places a palm sees a bird perched in it within 2 seconds, without pressing anything.
- **SC-003**: At no moment is any butterfly or bird drawn outside the play field, over a canvas with no flowers (butterflies), or away from every palm (birds) — including within one second of the last flower or palm being removed.
- **SC-004**: Every bird flight, observed over a 10-minute session, ends with the bird perched on a palm; zero flights end in sand, water, or open air.
- **SC-005**: The toolbar has exactly the same controls, in the same arrangement, as it does today on every viewport already covered by the layout budget.
- **SC-006**: With all populations at their caps, the simulation holds at least 30fps on a Fire 7 Kids tablet and an iPad at the default field size, and 60fps on a mid-range laptop.
- **SC-007**: After closing and reopening the app, the restored world is indistinguishable from today's restore except that its flowers have butterflies and its palms have birds again within 2 seconds; worlds saved before this feature load with a 100% success rate.
- **SC-008**: Undo and redo depth, timing and behaviour are unchanged, and populations match the restored flowers and palms within 2 seconds of any undo, redo, rotation or scene switch.
- **SC-009**: A single eraser stroke across a butterfly or bird removes it 100% of the time, and no replacement appears for the hold-off period, so an adult watching over her shoulder can always tell the eraser worked.
- **SC-010**: Flower growth from watered grass, palm placement, sway and poke reactions, grass drinking, water and weather behaviour, poodles, undo, saving and layout are unchanged — every existing automated test continues to pass without modification.
- **SC-011**: Two adults asked to watch the canvas describe the butterflies and birds as decoration that came for her flowers and trees; neither reports anything scary, and neither can find a moment where a creature looks stuck, stranded, or half-drawn.

## Manual Verification *(what a maintainer must eyeball, per Constitution Principle V)*

Per the two-platform table in `CLAUDE.md`, this feature is drawn on the canvas
rather than in the toolbar, so glyph coverage is not caught by the existing
toolbar-glyph test and must be looked at on both columns:

- **iPad (Safari, home-screen app) — Max**: 🦋 and 🐦 render as real emoji at the
  sizes used, the flutter and the perch read clearly at that pixel density, and
  the canvas does not stutter with all caps filled.
- **Fire 7 Kids tablet (Silk) and desktop Chrome — Charlie**: the same two glyphs
  render as emoji and not as empty boxes (both predate the Emoji 13.0 cutoff that
  bites on Segoe UI Emoji / Fire, so no fallback artwork is expected — but it is
  confirmed by looking, not by assumption), and the frame rate holds on the Fire 7.
- **Both**: rotate the device with a full garden and three palms on screen and
  confirm nothing is stranded, nothing flickers, and the undo history survives.

## Assumptions

- **Persistence is respawn-from-context, as recommended in the issue.** Butterflies
  and birds are never saved, never restored individually, and never carried
  through undo/redo. This is the decision the issue asked to be made explicit: she
  will not miss an individual butterfly, and re-deriving from the flowers and palms
  makes reload, undo, rotation, resize and scene switching all correct by
  construction with no round-trip to test (FR-028…FR-032).
- **No new element identity and no per-cell storage.** Ambient life lives in its
  own state beside the play field, as the issue specifies, so the saved-world and
  undo formats are untouched and old saves keep loading (FR-033).
- **Butterflies key off flower *cells*, birds off palm *objects*.** Flowers are
  single cells that can exist in any number, so butterflies are governed by a
  global count-based rule with a global cap; palms are placed objects already
  capped at three, so birds are simply one per palm. Butterflies are not tied to
  any one flower for their lifetime — visiting and moving on is the behaviour the
  issue describes.
- **Only palms get birds.** Rainbows, unicorns and flamingos do not, and nothing
  else on the canvas is a perch.
- **The eraser hold-off matches spec 014's ~3 seconds** so all ambient life in the
  toy behaves the same way under the eraser; if 014 lands first, this feature
  follows whatever value it shipped.
- **The numbers are confirmed, chosen against the 270×160 default field**: one
  butterfly per 4 flowers up to 4 butterflies, one bird per palm up to 3 birds, ~3
  second erase hold-off. They are fixed counts rather than a fraction of the field,
  matching how spec 014 fixed its own thresholds: a simpler rule, simpler tests,
  and no cross-device density parity to maintain. Holding the butterfly cap at 4
  also keeps headroom on a Fire 7 that may be running spec 014's sea life at the
  same time. A retune on a device is a retune, not a redesign.
- **Butterflies fly over everything; there is no pathing.** Terrain is scenery
  underneath a butterfly, never an obstacle: no avoidance, no collision, no
  turning away (FR-009). A turn-away rule was considered and rejected — it buys a
  visual difference she would not notice at a run, and risks a butterfly caught in
  a pocket of terrain, which is exactly the "visibly broken" case the issue rules
  out.
- **Bird flights never leave the visible field.** The issue's "off and back" is
  read as a loop up and around in view, not a trip past an edge (FR-015). Keeping
  every creature on screen at all times means resize, rotation and erase-all-palms
  have no off-field state that could be got wrong.
- **Both glyphs predate the platform glyph-coverage caution** in `CLAUDE.md`
  (🦋 Unicode 9.0, 🐦 Unicode 1.0/6.0 era), so no inline SVG fallback is planned —
  but both are on the manual verification list above.
- **Creatures are visual only.** They are drawn over the play field like the
  existing poodles and objects, so they appear in a shared photo (📷) exactly as
  anything else on the canvas does, and need nothing added for that to be true.
- **No poke reaction.** Palms shiver and flamingos hop when poked today; a
  poke-the-butterfly reaction is deliberately out of scope here.
- **This feature and spec 014 (fish and shark) are independent.** Neither depends
  on the other shipping; they share only the pattern and the erase hold-off value,
  and the performance bar in FR-035 must hold with both populated.
- Existing flower growth (spec 007), palm object behaviour, poodle, undo, save,
  scene and layout behaviour is a dependency of this feature and must not regress.
