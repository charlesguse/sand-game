# Feature Specification: Houses, People, And Treasure

**Feature Branch**: `015-houses-people-treasure`

**Created**: 2026-09-07

**Status**: Draft

**Input**: Lifecycle issue #47 — "A house, some people, and treasure: a chest, diamonds, and stars"

> ## What I want
>
> A grab-bag of placeable treasure/world objects, joining 🌈🦄🌴🦩 as new object
> kinds, using the same footprint/eraser/cap-of-3 machinery already there:
>
> - 🏠 **House**: a placeable object, same size/eviction rules as existing objects
>   (cap 3, oldest evicted). Purely decorative — a home on the canvas.
> - 🧑 **People**: a placeable object (use 🧑, *not* 🧍 — glyph coverage). Also
>   purely decorative, same rules.
> - **Treasure chest**: a placeable object that, like the rainbow's sand
>   conversion, does something when touched — sand or water landing on/near it
>   becomes 💎 diamonds (a new element, not a placed object) rather than sitting
>   there inertly. This gives diamonds a mechanic without needing their own
>   toolbar button. **There is no treasure-chest emoji in Unicode** — ship an
>   inline SVG (the bucket-icon precedent) rather than a substitute glyph like
>   🎁 or 📦.
> - 💎 **Diamonds**: the new element the chest produces — behaves like a
>   solid/settling material (falls and piles, similar to sand/dirt).
> - ⭐ **Stars**: intentionally the vaguest ask here. **Do not reuse the `'star'`
>   tool id or the `STAR_POWER` element/ID** — that name belongs to the existing
>   star-power/weather feature (specs 008–009).
>
> ## Reserved element ID
>
> Element IDs currently end at flowers = 10; a concurrently-filed mermaid/ice-cream
> feature reserves 11. **Diamonds MUST use grid-element ID 12.** If stars end up
> needing a grid element, use ID 13.
>
> ## Cross-cutting checklist
>
> - Eraser removes houses/people/chests it touches, and diamonds it paints over;
>   🗑️ clear-all removes all of them.
> - Save/restore and undo/redo round-trip everything, including diamonds and
>   their fall/settle state.
> - If diamonds end up hue-coloured (sparkle variety), they MUST be added to
>   `usesHueColor` **and** the test-local `visibleSnapshot` in `history.test.ts` —
>   this exact omission has silently broken colour persistence once already. If
>   diamonds are a single fixed colour, this doesn't apply — say so explicitly
>   either way.
> - Resize/rotate remaps the new objects the way the existing reposition logic
>   does, and remaps diamonds as an ordinary element.
> - Vitest coverage for the chest→diamonds conversion rule and the cross-cutting
>   items above, no DOM/browser harness (Constitution Principle V).
>
> ## Notes for spec (decisions open — ask if unclear)
>
> - **Stars — button or ambient?** The toolbar is already tight (specs 012/013
>   exist because of it). Recommended default: decorative stars are **ambient**,
>   not a toolbar control — the same "exists without growing the toolbar"
>   precedent the constitution sets for flowers. Open to a button instead if the
>   spec finds a good reason, but the toolbar-budget tradeoff must be named
>   explicitly either way.
> - **How many chests/houses/people at once**: suggest the existing cap of 3 per
>   kind.
> - **What exactly triggers the chest → diamonds conversion**: match the
>   rainbow's zone-based conversion for consistency, or pick something simpler —
>   spec's call.
>
> Existing rainbow/unicorn/palm/flamingo object behavior must not regress.

Throughout this spec:

- A **placeable object** keeps its existing meaning: a square-footprint decoration
  she drops on the canvas by picking its toolbar control and touching the
  picture — rainbow, unicorn, palm, flamingo today. Its footprint cells are
  solid: material piles on top of it and does not pass through.
- An object's **touch zone** keeps the rainbow's existing meaning: the one-cell
  ring of canvas immediately surrounding the object's footprint.
- **Pourable material** means the three things she can pour that a rainbow
  already transforms: pink sand, purple magic dirt, and water.
- **Diamonds** are the new material a treasure chest makes. They are a *material*
  (something the canvas is made of, like sand), not an *object* (something she
  places, like a palm tree).
- **Ambient decoration** means something that appears on screen without being
  part of the world she builds: it is never placed, never erased, never saved,
  and never undone — the picture is unchanged whether it is drawn or not.
- The **guaranteed viewport table** is spec 012's representative list of screen
  sizes at which the toolbar's fit and the drawing region's floors are asserted
  automatically.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The treasure chest turns her sand into diamonds (Priority: P1)

She taps the treasure chest and drops one on the canvas. Then she picks up pink
sand and pours it over the chest. Where the sand lands on and around the chest it
turns into glittering diamonds, which tumble down and pile up beside it. Water
poured over the chest does the same. The chest never runs out — as long as she
keeps pouring, it keeps making treasure, so a chest under a steady stream of sand
becomes a diamond fountain she can watch.

**Why this priority**: This is the only new *behaviour* in the feature and the
reason diamonds exist at all. Everything else here is decoration. It is also the
piece that gives a new material a home without adding a second toolbar control,
which the toolbar cannot afford.

**Independent Test**: Place a chest on a grid, drop sand and water cells into its
touch zone, step the simulation, and assert those cells are now diamonds and that
diamonds fall and pile like the other powders — all headless, no DOM.

**Acceptance Scenarios**:

1. **Given** a chest on the canvas, **When** pink sand comes to rest in the ring
   of cells around it, **Then** those cells become diamonds.
2. **Given** a chest on the canvas, **When** water flows into the ring of cells
   around it, **Then** those cells become diamonds.
3. **Given** a chest that has already made diamonds, **When** more sand arrives,
   **Then** it converts too — the chest has no limit, no cooldown, and no
   used-up state.
4. **Given** diamonds resting on a slope, **When** the simulation runs, **Then**
   they fall and pile the way pink sand does, and sink through water.
5. **Given** a diamond in a chest's ring, **When** the simulation runs, **Then**
   it stays a diamond — a chest never re-converts its own output.
6. **Given** grass, flowers, gumdrops, star power, or fog in a chest's ring,
   **When** the simulation runs, **Then** they are untouched.
7. **Given** a chest whose ring overlaps a rainbow's ring, **When** the
   simulation runs for many steps, **Then** every cell in the overlap settles on
   one material and stays there — nothing flickers between diamond and rainbow
   sand.

---

### User Story 2 - She builds a little world: a house and some people (Priority: P2)

She taps the house and puts one on the hill she made. She taps the people button
and adds a couple of little people next to it. They just stand there being part
of her picture — nothing chases her, nothing changes, nothing is ever wrong. If
she adds a fourth house, the first one she placed makes room for it, exactly the
way a fourth rainbow does today. The eraser sweeps any of them away, and the
rubbish-bin button clears the lot.

**Why this priority**: Pure delight and pure reuse — no new simulation rules, only
new members of a mechanism that already exists. It ships independently of the
chest.

**Independent Test**: Place four houses on a grid and assert three remain and the
oldest is gone; drag an eraser across a house and a person and assert both are
removed whole; clear-all and assert none remain.

**Acceptance Scenarios**:

1. **Given** an empty canvas, **When** she places a house, **Then** it appears
   centred where she touched, fully on the canvas even at the very edge.
2. **Given** three houses, **When** she places a fourth, **Then** the oldest
   house disappears and three remain — and no person or chest is affected.
3. **Given** a house and a person, **When** the eraser passes over either,
   **Then** the whole object is removed, footprint and all, leaving no invisible
   solid patch behind.
4. **Given** any mix of new and existing objects, **When** she presses clear-all,
   **Then** every object and all material — including diamonds — is gone.

---

### User Story 3 - Stars twinkle in her empty sky (Priority: P3)

Above whatever she has built, the empty part of the picture twinkles now and
then: little stars fade in and out in the open sky. She does not place them and
cannot rub them out; they are simply part of the sky, the way flowers simply grow
in watered grass. Where she draws, the twinkling makes way for her picture.

**Why this priority**: The vaguest and least load-bearing part of the request, and
the one deliberately kept off the toolbar. It can ship last or be dropped without
touching anything else.

**Independent Test**: Ask the rule which cells are eligible for a twinkle for a
given canvas, and assert it returns only empty sky cells, never a cell holding
material or covered by an object footprint, and never more than the cap.

**Acceptance Scenarios**:

1. **Given** a canvas with an empty upper region, **When** the toy is running,
   **Then** stars appear and fade there over time.
2. **Given** she fills the sky with sand, **When** the sand covers a twinkling
   cell, **Then** the twinkle is gone from there and her material is fully
   visible — a star never hides or replaces anything she drew.
3. **Given** stars are twinkling, **When** she presses undo, redo, or clear-all,
   or reloads the toy, **Then** the picture is exactly what those actions
   promise — stars are not part of what is saved, undone, or cleared.

---

### Edge Cases

- **Chest at the canvas edge**: the touch zone is clipped to the canvas; a chest
  nudged fully on-canvas at placement behaves normally with a partial ring.
- **Chest evicted while its diamonds remain**: diamonds already made are ordinary
  material and stay exactly where they are; only the chest disappears.
- **An object placed on top of diamonds**: the footprint takes those cells, the
  same as placing an object on any material today.
- **Chest ring overlapping a rainbow ring**: resolved deterministically by
  FR-011; no cell may alternate between the two materials.
- **A chest inside a pond**: the water in the ring becomes diamonds, which then
  fall through the remaining water and pile at the bottom — an expected, allowed
  outcome, not a bug.
- **A world saved before this feature exists**: on first launch of the new
  version, her old picture MUST still come back (FR-028). Today's restore rejects
  a saved world outright when any object kind's list is missing, which for a
  pre-upgrade save would silently discard everything she made — including her
  undo history.
- **A fast eraser drag straddling a chest**: the existing interpolated erase
  applies to the new kinds too, so a quick flick past a chest cannot skip it.
- **Rotation or a fullscreen toggle while diamonds are mid-fall**: diamonds remap
  like any other material and objects remap like existing objects; nothing is
  lost that the existing remap would have kept.
- **The toolbar at its smallest guaranteed screen**: three new controls do not fit
  (FR-031); resolving that is a maintainer decision, not an implementation trick.

## Requirements *(mandatory)*

### Functional Requirements

**The three new placeable objects**

- **FR-001**: The toy MUST offer three new placeable object kinds — **house**,
  **person**, and **treasure chest** — placed exactly the way rainbow, unicorn,
  palm and flamingo are placed today: pick the control, touch the canvas, the
  object lands centred on the touch and nudged to sit fully on the canvas.
- **FR-002**: The new kinds MUST use the same footprint size as existing objects,
  and their footprint cells MUST be solid in the same way, so material piles on
  them instead of passing through.
- **FR-003**: Each new kind MUST cap at **three at once**, evicting the oldest of
  *that kind* when a fourth is placed. Caps stay per-kind: a fourth house never
  removes a person or a chest.
- **FR-004**: House and person MUST be purely decorative — they never move,
  convert, grow, consume, or react to anything. Nothing she can do to them can
  fail.
- **FR-005**: The person control and its on-canvas figure MUST use 🧑, **not**
  🧍: 🧍 is Emoji 12.0 and draws as an empty box on the Fire tablet and Windows 10
  fonts one maintainer verifies on.
- **FR-006**: The house control and its on-canvas figure MUST use 🏠, which has
  universal glyph coverage on both maintainers' platforms.
- **FR-007**: Unicode has no treasure-chest character. The chest MUST therefore be
  drawn from shapes defined in code — for its toolbar control **and** for its
  appearance on the canvas — following the bucket-icon precedent. It MUST NOT
  fall back to a substitute glyph (🎁, 📦, 💰) and MUST NOT introduce an external
  image asset, which would break the single-file `file://` build (Constitution
  Principle I).

**What a treasure chest does**

- **FR-008**: Every chest MUST continuously convert **pourable material** —
  pink sand, purple magic dirt, and water — in its **touch zone** into diamonds.
  The zone is the same one-cell ring around the footprint the rainbow already
  uses, so the two objects read the same to a child: "put it near the thing and
  the thing changes it".
- **FR-009**: A chest MUST NOT convert: diamonds (its own output), rainbow sand,
  grass, flowers, gumdrops, star power, fog, object footprints, or empty space.
  Leaving fog alone keeps the weather feature's cloud bookkeeping entirely with
  the rainbow.
- **FR-010**: Conversion MUST be endless: no counter, no cooldown, no capacity, no
  "chest is used up" state. A chest under a continuous stream of sand keeps
  producing diamonds indefinitely (Constitution Principle II — nothing runs out,
  nothing fails).
- **FR-011**: Where a chest's zone overlaps a rainbow's zone, the result MUST be
  deterministic and stable: chest conversion is applied **after** rainbow
  conversion within the same simulation step, so a cell the rainbow has already
  turned into rainbow sand stays rainbow sand (FR-009), and a cell still holding
  pourable material becomes a diamond. No cell may alternate between diamond and
  rainbow sand across steps.
- **FR-012**: Conversion MUST NOT allocate per step, and MUST keep the simulation
  inside its frame budget with the maximum three chests all converting at once
  (Constitution Principle IV).

**Diamonds**

- **FR-013**: Diamonds MUST be a new material occupying **grid-element ID 12**, as
  reserved by the lifecycle issue. ID 11 stays reserved for the concurrently-filed
  mermaid/ice-cream feature and MUST NOT be taken.
- **FR-014**: Diamonds MUST behave as a settling powder — identical rules to pink
  sand: they fall, they pile at the same angle of repose, and they sink through
  water. No new movement rule is introduced.
- **FR-015**: Diamonds MUST be visibly treasure: they MUST read as sparkling,
  reusing the existing per-cell sparkle marking rather than a new visual system.
- **FR-016**: **Diamonds are a single fixed colour** with the ordinary per-cell
  shade variation the other powders use. They are therefore **not** hue-coloured:
  the shared hue-colour predicate (`usesHueColor`) and the test-local
  `visibleSnapshot` in the history tests are deliberately left **unchanged** by
  this feature. This is the explicit statement the lifecycle issue asked for. If
  planning or implementation ever changes diamonds to a hue-varied sparkle
  instead, both of those MUST be updated in the same change — that omission has
  silently broken colour persistence across undo/redo and restore once already.
- **FR-017**: There MUST be no diamond toolbar control and no diamond tool. A
  chest is the only source of diamonds — this is the whole point of giving them a
  mechanic (Constitution: flowers exist without growing the toolbar; diamonds
  follow that precedent).
- **FR-018**: The eraser MUST remove diamonds like any other painted material, and
  the magic wand MUST treat diamonds like any other material it passes over
  (adding sparkle), with no special case.

**Stars**

- **FR-019**: Stars MUST ship as **ambient decoration**, not as a toolbar control
  and not as a placeable object. **Named tradeoff**: a star control would be a
  fourth new control on a toolbar that already cannot fit the three this feature
  adds at the smallest guaranteed viewport (FR-031); ambient stars cost zero
  toolbar budget and follow the flowers precedent the constitution sets.
  [NEEDS CLARIFICATION: confirm ambient stars, or ship a placeable star object
  with its own toolbar control instead? A control makes stars something she
  chooses and something that saves/undoes with her picture, at the cost of a
  fourth control on a toolbar that is already over budget at 320×568.]
- **FR-020**: A star twinkle MUST appear only in **empty sky** — a canvas cell
  holding no material and covered by no object footprint — in the upper region of
  the canvas. It MUST NOT cover, replace, dim, or displace anything she has drawn.
- **FR-021**: Stars MUST NOT be part of the world: not saved, not restored, not
  captured by undo/redo, not removable by the eraser, and unaffected by clear-all
  (the sky keeps twinkling over an empty canvas).
- **FR-022**: Stars MUST NOT reuse the existing `'star'` tool identifier or the
  `STAR_POWER` material and its element ID — those belong to the star-power and
  weather features (specs 008–009), and reusing either would conflate two
  unrelated things. As ambient decoration under FR-019, stars need **no** new
  element ID at all, so reserved ID 13 stays unused; it is claimed only if the
  clarification in FR-019 turns stars into a placed thing.
- **FR-023**: The number of live twinkles MUST be capped and the effect MUST NOT
  allocate per frame, so the sky costs a fixed, small amount of the frame budget
  (Constitution Principle IV).

**Cross-cutting: the new things behave like the old things**

- **FR-024**: The eraser MUST remove a house, person, or chest **whole** when it
  touches any part of the footprint — including on a fast drag, where the erase is
  interpolated between pointer samples exactly as it is for existing objects — and
  MUST leave no invisible solid cells behind.
- **FR-025**: Clear-all MUST remove every house, person, and chest and every
  diamond, leaving the canvas as empty as it does today.
- **FR-026**: Saving and restoring her world MUST round-trip the new objects
  (kind, position, size, identity) and diamonds (position, colour, sparkle, and
  their in-progress fall/settle state) so that a restored world is
  cell-for-cell identical to the saved one.
- **FR-027**: Undo/redo MUST round-trip the same things, both within a session and
  across the persisted undo history, cell-for-cell.
- **FR-028**: A world **or** undo history saved by a version of the toy from
  *before* this feature MUST still restore. A saved payload that has no entry for
  a newly added object kind MUST be read as "no objects of that kind", never as a
  corrupt payload. Today both restore paths reject the whole payload when any
  kind's list is missing, so without this requirement the first launch after this
  feature ships would silently throw away everything she had made (Constitution
  Principle II — failures stay silent, but her picture must not be the thing that
  is lost).
- **FR-029**: Resizing or rotating the screen MUST remap the new objects the way
  existing objects are remapped, and diamonds as an ordinary material; stored
  undo states MUST be remapped, not discarded (constitution amendment to spec 010
  FR-022).
- **FR-030**: Existing behaviour MUST NOT regress: rainbows still convert sand,
  dirt, water and fog to rainbow sand; unicorns still respond to being touched;
  palms, flamingos and poodles are unchanged; per-kind caps and eviction for the
  existing kinds are unchanged.

**Toolbar budget**

- **FR-031**: Adding three placeable controls raises the shipped control count
  from 23 to 26 where neither fullscreen nor photo sharing is available, and from
  25 to 28 where both are. Under spec 012's own sizing rule this **does not fit**
  at the 320×568 "small phone" row of the guaranteed viewport table: even at the
  44-pixel touch-target floor and the tightest legal spacing, 26 controls wrap to
  five rows, and the drawing region then falls below the 65% portrait area floor.
  (At 320×568 the count today is feasible at 23 and already recorded as infeasible
  at 25; 26 and 28 both land in the infeasible band. Every other row of the table
  still fits.) Per spec 012 FR-012 this MUST surface as a build-time failure of
  the existing automated check with the shortfall named — never as a quietly
  widened band, a control below 44 pixels, or a hidden control — and per FR-012c
  its resolution is an explicit maintainer decision.
  [NEEDS CLARIFICATION: how should the 320×568 shortfall be resolved? Options:
  (a) drop 320×568 from the guaranteed table with the reasoning recorded — spec
  012 FR-012c explicitly sanctions this and notes no device either maintainer
  ships to is smaller than the 375×667 iPhone SE 3; (b) merge or drop an existing
  control to pay for the new ones; (c) ship fewer than three new placeables.]
- **FR-032**: The new controls MUST be declared in the same single source of truth
  the toolbar renders from and the automated check reads, so the check stresses
  the real, shipped count with no hand-maintained constant (spec 012 FR-013).

**Verification**

- **FR-033**: The chest→diamond conversion rule, diamond settling, the per-kind
  cap and eviction, whole-object erase, clear-all, save/restore round-trip,
  undo/redo round-trip, backward-compatible restore (FR-028), and the resize remap
  MUST all be covered by headless unit tests on the simulation logic. No browser
  automation and no DOM harness may be added (Constitution Principle V).
- **FR-034**: What the maintainers eyeball at review: that the drawn chest reads
  as a treasure chest at footprint size on a real screen; that diamonds read as
  sparkling treasure and are distinguishable from pink sand and gumdrops; that
  🧑 and 🏠 render as glyphs (not boxes) on the Fire tablet and on iPad; and that
  the ambient sky twinkle is pretty rather than distracting.

**Governance**

- **FR-035**: This feature changes two things the constitution's Product
  Constraints enumerate, so it MUST ship with a constitution amendment stating
  what changed and why: (a) diamonds join the element list and house/person/chest
  join the objects list; (b) the objects list's "all render as real emoji glyphs
  drawn on/over the canvas — no custom artwork assets" clause is amended to allow
  shapes **drawn in code** for an object with no Unicode glyph, which is
  precisely the chest's case and keeps the single-file rule intact (no asset
  files). Merging the amendment is the human gate's call.

### Key Entities

- **House**: a placeable, purely decorative object. Kind identity, position,
  footprint size, and creation order (for eviction) — nothing else.
- **Person**: a placeable, purely decorative object with the same attributes as a
  house.
- **Treasure chest**: a placeable object with the same attributes, plus one
  behaviour — it converts pourable material in its touch zone to diamonds, for as
  long as it exists.
- **Diamond**: a material occupying grid-element ID 12: a settling powder with a
  fixed colour, a per-cell shade, and a sparkle marking. Produced only by a chest.
- **Star twinkle**: an ambient, render-only decoration keyed to an empty sky cell.
  It has a position and a fade phase, is capped in number, and belongs to no
  saved, undone, or erasable state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Pouring sand or water onto a chest produces visible diamonds within
  one second of the material arriving, every time, with no action from her beyond
  pouring.
- **SC-002**: A chest converts material for an unbounded number of simulation
  steps: after 10,000 steps under a continuous stream, it is still converting.
- **SC-003**: Each of the three new kinds tops out at exactly three on the canvas,
  and placing a fourth removes the oldest of that kind and nothing else.
- **SC-004**: The eraser removes 100% of a touched house, person, or chest — zero
  leftover solid cells — including when consecutive pointer samples straddle the
  object.
- **SC-005**: Saving a world containing all three new kinds plus diamonds mid-fall
  and restoring it yields a cell-for-cell identical picture, including diamond
  colour and sparkle, in 100% of trials.
- **SC-006**: Undo and redo of any action in such a world yield a cell-for-cell
  identical picture, in-session and after a reload.
- **SC-007**: A world and an undo history saved by the previous version of the toy
  still restore after upgrade — nothing she made is lost.
- **SC-008**: Rotating the screen with all three kinds placed and diamonds falling
  keeps every object at its remapped position and loses no undo state that today's
  remap would have kept.
- **SC-009**: With three chests all converting a continuous stream, the simulation
  holds its frame-rate target (60fps target, ≥30fps acceptable) on the reference
  laptop and iPad at the default grid size.
- **SC-010**: The toy still ships as a single self-contained page that runs from
  `file://` with no external requests, and both maintainers' platforms show
  glyphs — not boxes — for every new control.
- **SC-011**: Every existing object and element behaviour covered by today's test
  suite still passes unchanged.
- **SC-012**: The toolbar's automated check runs against the real shipped control
  count and either passes at every guaranteed viewport or fails naming the
  viewport, arrangement, thickness required and thickness available — never
  passes by hiding, shrinking below 44 pixels, or widening the band.

## Assumptions

- **Cap of three per kind** is adopted as the lifecycle issue suggested, matching
  rainbow/unicorn/palm/flamingo, so eviction reads identically for every kind.
- **The rainbow's zone rule is adopted for the chest** rather than a simpler
  trigger, so the two "put it near the thing" objects behave the same way and one
  tested zone rule serves both.
- **Purple magic dirt is converted as well as sand and water.** The issue names
  "sand or water"; dirt is included because it is the third thing she can pour and
  the rainbow already treats all three alike — pouring anything pourable onto
  treasure should make treasure. Excluding it would be the only "nothing happens"
  outcome in the feature.
- **Rainbow sand is not converted**, which is what makes the rainbow/chest overlap
  stable rather than order-sensitive in both directions (FR-011).
- **Diamonds are a fixed colour, not hue-varied** (FR-016) — rainbow sand already
  owns the many-colours look, and a fixed colour keeps the known hue-persistence
  trap entirely out of this change.
- **Stars are ambient and stateless**, so they need no element ID, no save format
  change, and no toolbar slot; reserved ID 13 is left unclaimed unless the FR-019
  clarification says otherwise.
- **The "sky" for stars is the upper region of the canvas**, defined by empty
  cells rather than by any weather or time-of-day state, so the effect does not
  couple to the star-power/weather feature.
- Object footprint size, placement nudging, per-kind lists, whole-object erase,
  reposition-on-resize, and the save/history capture paths are **reused as-is** —
  this feature adds kinds to an existing mechanism rather than a parallel one.
- Placing an object over existing material overwrites those cells, as it does
  today; that is unchanged and not re-specified here.
- The concurrently-filed mermaid/ice-cream feature owns element ID 11; this spec
  assumes no other coordination with it beyond not taking that ID.
