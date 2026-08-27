# Feature Specification: Star-Powered Weather

**Feature Branch**: `spec-draft/009-star-powered-weather`

**Created**: 2026-08-27

**Status**: Draft

**Input**: GitHub issue #21 — "Star-powered weather: water to fog to cloud to rain"

> Follow-up to the star power feature: when **star power meets water**, instead of just fizzling, it kicks off a little weather cycle, a variation on what Sand Saga does:
>
> - Star power heats/charms water into **fog** (or mist/sparkle-steam — spec may pick the kid-friendliest framing).
> - Fog **rises** and gathers at the top into **clouds**.
> - Clouds eventually **rain** the water back down.
> - The loop should be mesmerizing to watch for an almost-5-year-old: gentle, pretty, no failure states, and it must settle rather than run away (bounded amounts of fog/cloud, conservation-ish behavior so the play area doesn't fill with cloud forever).
> - No new toolbar button expected — this is emergent behavior from existing elements (star power + water), though the spec may decide otherwise if a control genuinely helps.
> - Must respect the phone-support constraints from spec 006 (viewport-derived grid, 43,200-cell budget) and stay smooth on an Amazon Fire 7 Kids tablet.
>
> Depends on the star power feature being on main first.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Making sparkle-mist off the lake (Priority: P1)

The child taps the ⭐ star button she already knows and drags it across her lake. Where the star power touches the water, the water turns into pale, twinkling **fog** — a pearly sparkle-mist — and the mist immediately starts drifting upward, wobbling gently as it goes, like steam off a bath. The lake's surface dips a little where she waved. She can do it again and again, anywhere there is water, and nothing is broken, nothing is lost, and nothing is scary — it just looks magical.

**Why this priority**: Turning water into rising mist is the gesture the whole feature hangs on. It is the first thing the child discovers and it is already delightful on its own, even before a single cloud has formed — a lake that steams when you wave a star over it is a complete toy moment.

**Independent Test**: In a headless grid, place a body of water, apply the ⭐ brush over it and place drawn star power beside it, run the simulation, and assert that exactly one fog cell appears for each water cell charmed, that fog appears nowhere else, that fog rises at the specified pace with a wobble, that fog under the surface bubbles up through the water, and that no other cell is changed.

**Acceptance Scenarios**:

1. **Given** a lake and the ⭐ tool selected, **When** the child drags the brush across the water, **Then** the water cells inside the brush footprint become fog, one for one, and nothing else in the footprint changes.
2. **Given** star power the child drew in the empty cells just above a lake, **When** the simulation runs, **Then** the star power goes out as it always did and one water cell next to it becomes fog, so a stroke along the waterline sets the whole shoreline steaming.
3. **Given** fog anywhere on the field, **When** the simulation runs, **Then** it drifts upward at a pace the child can follow with her eyes — a slow, visible climb, not a jump to the top and not a crawl.
4. **Given** fog rising, **When** the child watches a plume, **Then** it wanders from side to side as it climbs so it spreads and breathes like real mist, rather than rising in a rigid straight column.
5. **Given** fog made deep inside a lake, **When** the simulation runs, **Then** it bubbles up through the water to the surface and keeps going, and the water it passes settles back down behind it.
6. **Given** fog on the field, **When** the child looks at it, **Then** it reads instantly as pretty, harmless mist — pale, pearly, twinkling — and never as smoke, steam-from-a-fire, or anything grey and dirty.
7. **Given** a pile of sand, dirt, glitter, grass, or a placed object, **When** fog reaches it from below, **Then** the fog is stopped, slips sideways, and nothing the child built is moved, damaged, or lifted away.
8. **Given** fog anywhere at all, **When** the simulation runs on and on, **Then** no fog lasts forever — mist that never reaches the top eventually turns back into a single drop of water and falls.

---

### User Story 2 - Clouds gathering at the top (Priority: P2)

The mist keeps climbing until it reaches the sky at the top of the play area, where it cannot go any higher. There it settles into a soft, fluffy **cloud**. More mist arrives and the cloud grows fatter and hangs down further, so the child watches a real cloud build itself out of her lake over a handful of seconds. The cloud just sits up there looking pretty while she goes on playing underneath it.

**Why this priority**: The cloud is the payoff for watching the mist rise and the setup for the rain. It depends on User Story 1 but is separately visible and separately testable, and a sky with a cloud in it is worth the watching on its own.

**Independent Test**: In a headless grid, release fog with a clear path to the top, run the simulation, and assert that fog which cannot rise any further because of the play field's ceiling or an existing cloud becomes cloud, that cloud cells never move, that clouds grow downward as more fog arrives, and that nothing else changes.

**Acceptance Scenarios**:

1. **Given** fog rising with nothing above it, **When** it reaches the top of the play area, **Then** it becomes cloud and stops rising.
2. **Given** a cloud already at the top, **When** more fog arrives underneath it, **Then** that fog becomes cloud too, so the cloud thickens downward and a steaming lake builds a visibly bigger cloud than a single wave of the star does.
3. **Given** cloud on the field, **When** the simulation runs, **Then** it stays exactly where it formed — it does not fall, sink, slide along the sky, or drift away.
4. **Given** cloud on the field, **When** the child looks at it, **Then** it reads as a soft fluffy cloud and is obviously a different thing from the thin mist below it, at a glance and with no reading.
5. **Given** cloud overhead, **When** the child pours sand or water through it, **Then** her grains fall straight through the cloud without piling up on it — a cloud is sky, not a shelf.
6. **Given** cloud overhead, **When** the child plays underneath it, **Then** nothing about the cloud interferes with drawing, erasing, scenes, or any other tool.

---

### User Story 3 - Rain falling back down (Priority: P3)

After a few seconds of hanging there, the cloud starts to rain. Drops let go one at a time, raggedly, so it patters rather than dumping, and they fall all the way down as ordinary water — filling the lake back up, watering the grass into a taller garden, and putting out any star power still burning below. The cloud thins out as it rains and finally disappears, and the field is back to how it started. Then the child waves the star again and the whole thing goes round once more.

**Why this priority**: The rain closes the loop and is what makes the feature a *cycle* rather than a disappearing act — the water she "used up" comes back. It depends on clouds existing, so it ranks third, but it is the reason the feature is bounded and kid-safe.

**Independent Test**: In a headless grid, form cloud cells, run the simulation, and assert that every cloud cell becomes exactly one water cell within the specified time, that the drops fall under the existing water rules, that the totals conserve, and that the field ends with zero fog and zero cloud.

**Acceptance Scenarios**:

1. **Given** a cloud, **When** a few seconds pass, **Then** it begins to rain — drops leave the cloud one at a time at slightly different moments, so it patters instead of falling as one block.
2. **Given** rain falling, **When** the child looks at it, **Then** it is ordinary water: it falls, splashes into pools, flows and levels exactly as the water she pours from the 💧 button does.
3. **Given** rain landing in the lake, **When** the simulation runs, **Then** the lake fills back up — what the star took away comes back.
4. **Given** rain landing on grass that can still grow, **When** the simulation runs, **Then** the grass drinks it and grows exactly as spec 007 says, so a storm waters the whole garden at once with no new rule.
5. **Given** grass burning under a cloud, **When** the rain reaches it, **Then** the burning stops just as it does when the child pours water herself.
6. **Given** any cloud at all, **When** the simulation keeps running, **Then** every last cloud cell has rained and disappeared within a few seconds — no cloud can hang in the sky forever.
7. **Given** a whole cycle from wave to rain, **When** the child counts what came back, **Then** she gets back exactly the water she started with, apart from what her grass drank or a rainbow caught — no water is created and none quietly vanishes.

---

### User Story 4 - It always settles, and it belongs with everything else (Priority: P4)

However hard the child leans on it, the weather calms down by itself. Mist and cloud can never take over the screen; if she waves the star over a whole ocean, the sky fills to a point and then simply stops taking more until it has rained some back. The sponge rubs mist out, the bin clears it, scenes wipe it, turning the tablet sideways keeps it. And on a cheap little tablet, a full sky of cloud with rain coming down stays as smooth as pouring sand.

**Why this priority**: These are the boundedness and integration promises that make the feature safe to ship for an almost-5-year-old. Most follow from existing rules, so they rank last — but the issue's "it must settle rather than run away" lives here.

**Independent Test**: In headless tests, drive the cycle to its ceiling from extreme starting states, run to a standstill, and assert fog and cloud return to zero within the settling bound and never exceed the ceiling; then exercise the eraser, clear-all, wand, object rules, scene generators, and play-field re-derivation against a field containing fog and cloud.

**Acceptance Scenarios**:

1. **Given** a play field mostly full of water, **When** the child charms as much of it as she possibly can, **Then** the sky fills only up to its limit and no further charming happens, with no message, no refusal the child can notice, and no way to be wrong.
2. **Given** any amount of fog and cloud, **When** the child stops drawing and just watches, **Then** within a few tens of seconds the sky is empty again and the field is at rest.
3. **Given** fog and cloud on the field, **When** the child drags the sponge through them, **Then** they are removed on the spot, leaving the cells empty and no drops behind.
4. **Given** fog and cloud on the field, **When** the child taps the bin, **Then** everything is cleared immediately, with no confirmation.
5. **Given** a sky full of cloud, **When** the child taps a scene button, **Then** the field is replaced by that scene with no error, and the scene arrives with clear skies exactly as specs 004 and 007 describe it.
6. **Given** fog drifting across a spot where the child wants to draw, **When** she paints there with any element brush, **Then** her element goes down where she asked — a wisp of mist never blocks her drawing.
7. **Given** fog and cloud on a phone, **When** the child turns the phone, **Then** whatever fits is carried across under the existing preservation rule, the weather goes on running normally, and no message appears.
8. **Given** the sky at its limit with rain falling, a lake below, grass drinking, and a lawn burning, on a low-end tablet, **When** the child watches, **Then** the toy stays smooth.
9. **Given** any use of the weather cycle at all, **When** the child plays, **Then** no message, confirmation, score, or failure state can appear, nothing is frightening, and everything can be undone by erasing, clearing, or drawing again.

---

### Edge Cases

- **Waving the star at a puddle only one cell deep**: those cells become mist and rise; the puddle is gone for the moment and comes back when it rains. Nothing else in the child's drawing is touched.
- **Waving the star where there is no water at all**: star power behaves exactly as spec 008 says — it shines, burns the grass it touches, and winks out. No mist appears from nothing.
- **Fog made under a lid of sand**: it rises to the underside of the sand, cannot go further, wanders sideways looking for a way out, and if it stays stuck it turns back into a drop of water and falls. It never lifts, cracks, or tunnels through what the child built.
- **Fog under a wide roof of grass**: the same — grass is solid to fog, so a lawn cannot be turned into a rain shadow that traps mist forever.
- **Fog rising through falling rain**: they pass each other, the lighter mist going up and the drop coming down, with nothing lost either way.
- **Sand poured through a cloud**: the grains fall straight through and the cloud closes over them, because cloud is the lightest thing on the field and never holds anything up.
- **A rainbow placed up in the sky**: it catches fog and cloud exactly as it already catches water and turns them into rainbow sand — the storm becomes treasure. This is spec 003's existing rule applying unchanged, and it takes water out of the cycle in a way the child chose, not a bug.
- **A unicorn standing in the mist**: it celebrates under the existing "an element is touching me" rule, with no new burst type.
- **Charming while the sky is already full**: charming simply does not happen — the ⭐ brush still shines where it can and the water stays water, with nothing on screen to tell her off.
- **A burn front reaching a puddle**: it goes out and the water is untouched, exactly as spec 008 requires (see FR-007) — a firebreak the child pours is still a permanent firebreak.
- **Rain falling on a burning lawn**: it puts the burn out under spec 008's quench rule, which means a storm the child started can rescue a lawn she set alight — an emergent rescue, no new rule.
- **Rain falling on grass at spec 007's ceilings**: the grass is fully grown and stops drinking, so the rain pools as ordinary water instead of growing an endless garden.
- **Grass drinking the rain**: this is the one place water leaves the cycle, and it is spec 007's rule doing it. The lake gets a little lower and the garden gets a little taller; both are bounded by spec 007's height and field ceilings.
- **Erasing mist, cloud, or rain mid-flight**: it is simply gone, with nothing left behind — erasing is erasing, and the water it would have become is not owed back.
- **Fog at the play field's edge**: it wanders inside the walls only; nothing wraps and no fog exists outside the play field.
- **Play-field re-derivation on rotation**: fog and cloud are carried across on the same best-effort, bottom-centre-anchored basis as every other element. Their timers need not survive; they go on rising, gathering, and raining afterwards.
- **Tapping a scene mid-storm**: the field is wiped and the scene is generated fresh with clear skies, exactly as tapping a scene has always worked.
- **Reload**: nothing is persisted; the field opens empty exactly as it does today.
- **All the edge cases from the pink-sand, water/dirt, rainbow/unicorn, landscape-scenes, sparkle-wand, phone-support, grass, and star-power features** continue to apply unchanged, and now apply with weather on the field as well.

## Requirements *(mandatory)*

This feature extends the existing toy specified in `001-falling-pink-sand`, `002-water-and-purple-dirt`, `003-rainbow-unicorn-magic`, `004-landscape-scenes`, `005-sparkle-magic-wand`, `006-phone-support`, `007-water-drinking-grass`, and `008-star-power-burns-grass`. All requirements of those specs remain in force except where explicitly superseded in the **Superseded requirements** section below. **This feature depends on `008-star-power-burns-grass` being implemented on `main` first**: star power is what starts the weather.

Throughout: **charming** is the act of turning a water cell into a fog cell. **Fog** is the rising sparkle-mist; **cloud** is the gathered mass fog becomes at the top; **rain** is ordinary water released by a cloud. A cell's **neighbours** are the eight cells around it; **orthogonal neighbours** are the four sharing an edge. A star power cell is **fuelled** or **unfuelled** exactly as spec 008 defines. The **sky ceiling** is the top row of the play field. All timings are stated in simulation steps as well as seconds (at the toy's 60 steps per second) so they hold identically at every play-field size derived under spec 006.

### Functional Requirements

**Fog and cloud**

- **FR-001**: The play field MUST support fog and cloud alongside empty, pink sand, water, magic purple dirt, rainbow sand, grass, and star power. Each cell MUST still hold at most one thing. Fog and cloud MAY be one new lightweight element in two states rather than two separate element types; the choice is left to the plan, and either way the element set grows by at most one entry so it stays as small as the constitution asks.
- **FR-002**: Fog MUST read as pretty, harmless sparkle-mist — pale pearly whites and palest lavender-pinks with a soft twinkle, carrying per-cell shade variation from the same per-cell shade mechanism the other elements use. It MUST NOT read as grey smoke, soot, or anything dirty or alarming, and MUST be distinguishable at a glance from water, glitter, star power, pink sand, purple dirt, rainbow sand, grass, and cloud.
- **FR-003**: Cloud MUST read as a soft, fluffy, brighter mass — clearly the same family as fog but obviously thicker and settled — and MUST be distinguishable from fog at a glance.
- **FR-004**: Fog and cloud MUST be the lightest things on the field: any powder or water occupying the cell directly above a fog or cloud cell MUST sink into it, the two exchanging places. Fog and cloud MUST NOT support, hold up, or delay any grain by more than one simulation step, and MUST NOT pile, stack, or act as ground.
- **FR-005**: Grass, star power, placed 🌈 and 🦄 objects, and the play field's walls, floor, and ceiling MUST block fog and cloud: fog and cloud MUST NOT enter, exchange places with, displace, damage, convert, or move any of them.
- **FR-006**: Fog and cloud MUST be inert towards everything else: they MUST NOT ignite, quench, consume, convert, or grow anything. Only water quenches star power (spec 008), and only water is drunk by grass (spec 007) — fog and cloud do neither.

**Charming water into fog**

- **FR-007**: When an **unfuelled** star power cell (one the child drew, per spec 008) is extinguished by orthogonally adjacent water, exactly one of those adjacent water cells MUST be charmed into fog in the same simulation step. A **fuelled** star power cell — a blade of grass that caught — MUST be extinguished exactly as spec 008 requires and MUST leave the water untouched, so a puddle remains the permanent firebreak spec 008 promises. Only star power the child drew herself steams water: the weather is something she *does* with the star, never something a fire does to her, and spec 008's promise that one drop of water always wins is not quietly superseded here — a firebreak that could be misted away would be a step toward a losing state.
- **FR-008**: The ⭐ brush MUST charm every water cell inside its footprint into fog, so dragging the star across a lake sets it steaming even below the surface. The brush MUST still place no star power inside a water cell, and its behaviour on empty cells, grass, powders, glitter, and objects is exactly as spec 008 requires.
- **FR-009**: Charming MUST be the only way fog is created. Fog MUST NOT appear in an empty cell, from a powder, from grass, from glitter, from an object, or from a cloud, and MUST NOT appear anywhere the child did not send star power.
- **FR-010**: Charming MUST replace the water cell in place — exactly one fog cell per water cell charmed, in the cell the water occupied — and MUST change no other cell.
- **FR-011**: Charming MUST NOT happen while fog and cloud together already occupy 20% or more of the play field's cells. When the sky is full, the ⭐ brush and star power's contact with water simply leave the water alone, with no message, refusal, or visible failure.

**Fog rises**

- **FR-012**: Fog MUST rise: one cell upward every 3–5 simulation steps (12–20 cells per second), so a plume is watched climbing rather than teleporting to the top or crawling.
- **FR-013**: Fog MUST wander sideways as it climbs — at most one cell to either side per upward move, with no bias to either side — so plumes spread, breathe, and look alive.
- **FR-014**: Fog MUST rise through water, exchanging places with a water cell directly above it, so fog made below the surface bubbles up to the top of a lake and the water closes behind it.
- **FR-015**: Fog that can neither rise nor wander MUST wait in place without damaging, pushing, or passing through whatever blocks it.
- **FR-016**: Fog MUST NOT last forever. A fog cell that has been unable to rise for 300 consecutive simulation steps (5 seconds), and in any case every fog cell that has existed for 1,800 simulation steps (30 seconds) without becoming cloud, MUST condense into exactly one water cell in place, which then falls under the existing water rules.

**Clouds gather**

- **FR-017**: Fog that cannot rise because the cell directly above it is the play field's sky ceiling or an existing cloud cell MUST become cloud. Fog blocked by ordinary matter — powder, grass, an object — MUST NOT become cloud; it wanders and eventually condenses under FR-016, so clouds only ever form in the sky. Clouds belong where a child expects clouds, which needs no explanation, and the mist's visible climb all the way to the top *is* the show; fog that drips back into a drop under a sand shelf is a small secret for her to find rather than an indoor cloud that reads as a glitch.
- **FR-018**: Cloud MUST NOT move: it does not rise, fall, drift sideways, or slide along the sky. A cloud cell stays where it formed until it rains, is erased, is cleared, or a play-field re-derivation moves it. Clouds therefore grow downward from the sky ceiling as more fog arrives, and a lake that steams for longer builds a visibly bigger cloud.
- **FR-019**: Cloud MUST NOT block the child's play in any way beyond occupying its own cell: grains fall through it (FR-004), brushes paint through it (FR-026), and it never stops, deflects, or absorbs anything.

**Rain falls back**

- **FR-020**: Every cloud cell MUST rain within 180–480 simulation steps (3–8 seconds) of forming, varying from cell to cell so a cloud patters raggedly rather than dumping all at once, and no cloud cell may last longer than 600 simulation steps (10 seconds).
- **FR-021**: Raining MUST turn the cloud cell into exactly one water cell in that same cell, which then falls, pools, flows, and levels under the existing water rules.
- **FR-022**: Rain MUST be ordinary water in every respect, with no rules of its own: grass drinks it (spec 007), it quenches star power (spec 008), a rainbow converts it (spec 003), the wand glitters it (spec 005), the eraser removes it, and it can be charmed again by fresh star power.

**Bounded, conserving, and always settles**

- **FR-023**: The cycle MUST conserve: one water cell in gives one fog cell, one fog cell gives one cloud cell or one water cell, and one cloud cell gives one water cell. No simulation rule in this feature may create water, fog, or cloud out of nothing, and the total number of water, fog, and cloud cells MUST NOT increase under any simulation rule. It may decrease only through rules the earlier specs already define — grass drinking, rainbow conversion, and the child's own drawing tools.
- **FR-024**: The weather MUST always settle by itself: from any state, with no further drawing and no star power remaining, the play field MUST contain 0 fog cells and 0 cloud cells within 45 seconds and then be at rest.
- **FR-025**: There MUST be no feedback that keeps the weather going on its own: fog and cloud MUST NOT create star power, MUST NOT charm water, and rain MUST NOT charm anything. Star power is the only thing that starts a cycle, so a wave of the star produces one round of mist, cloud, and rain and then stops. One gesture, one round: this is the strongest possible guarantee against the runaway the issue warns about, and "wave again to make more weather" keeps the child the author of every storm. A single big-brush drag across a lake already staggers its mist, cloud, and rain across roughly 15–25 seconds, which is show enough.
- **FR-026**: Every element brush and the eraser MUST treat fog and cloud as they treat empty cells: a brush paints its element straight into a fog or cloud cell and the mist there is simply gone, and the eraser clears fog and cloud from its whole footprint leaving those cells empty and no water behind. A drifting wisp MUST NEVER stop the child drawing where she wants.

**Tools and toolbar**

- **FR-027**: This feature MUST NOT add any toolbar control. The whole cycle is emergent from the ⭐ star power and 💧 water tools the child already has, and the toolbar MUST be exactly what spec 008 leaves it — same controls, same order, same fit on a phone under spec 006.
- **FR-028**: Clear-all MUST remove all fog and cloud along with everything else, immediately and with no confirmation.
- **FR-029**: Pink sand MUST remain the tool selected when the page loads, and the ⭐ tool's selection behaviour is unchanged from spec 008.

**Interaction with existing features**

- **FR-030**: The sparkle wand MUST leave fog and cloud exactly as they are — neither glittered, nor emptied, nor retyped — and MUST NOT sprinkle into them, since they are not empty cells. Every other wand behaviour is unchanged.
- **FR-031**: Placed 🌈 rainbows MUST convert fog and cloud into rainbow sand exactly as they already convert water, under spec 003's unchanged rule. Placed 🦄 unicorns MUST celebrate when fog or cloud touches them under the existing "an element is touching me" rule, with no new burst type. Fog, cloud, and rain MUST never damage, move, resize, or remove an object.
- **FR-032**: Grass MUST be unchanged by this feature: it drinks rain because rain is ordinary water, under spec 007's unchanged pacing, height ceiling, and field ceiling; it never drinks fog or cloud; and fog and cloud never grow, wilt, or move it.
- **FR-033**: Star power MUST be unchanged by this feature except for FR-007 and FR-008: fog and cloud are not fuel, so a burn MUST NOT spread into or through them (spec 008's FR-014 unchanged), and they MUST NOT quench star power — only water does.
- **FR-034**: Play-field re-derivation (spec 006) MUST carry fog and cloud across on exactly the same best-effort, bottom-centre-anchored basis as every other element. A cell's rise, condense, or rain timer need not survive a re-derivation, but the cell MUST remain fog or cloud and MUST go on through the cycle normally afterwards.
- **FR-035**: Scene loading MUST continue to work exactly as it does today with fog, cloud, and rain on the field: a scene tap MUST remove every existing element cell, object, and particle before placing the chosen scene's contents, immediately and with no confirmation. No scene may be seeded with fog or cloud — the ⬜ empty, 🏔️ hills-and-lake, and 🏝️ beach scenes are exactly as specs 004 and 007 leave them, and every scene arrives at rest with clear skies.
- **FR-036**: This feature MUST NOT introduce any failure state, message, confirmation, score, or way for the child to be wrong, and MUST NOT introduce sound, persistence, or any control. Everything the weather does MUST be undoable by ordinary play: erase it, clear it, or wait for it to rain out.

**Performance, non-regression, and verification**

- **FR-037**: The simulation MUST stay smooth — target 60 frames per second, acceptable at or above 30 — on a mid-range laptop, a tablet, and a low-end tablet of the Amazon Fire 7 Kids class, at any play-field size derived under spec 006, in the worst case of fog and cloud at the FR-011 ceiling with rain falling, a full lake below, grass drinking at spec 007's ceiling, and a lawn burning.
- **FR-038**: The per-step cost of the weather rules MUST NOT depend on anything beyond the play field's cell count, and the simulation's hot loop MUST remain allocation-free. The twinkle on fog and cloud MUST be a rendering effect that allocates nothing per frame and MUST NOT raise the number of simultaneous sparkle flashes or live sparkle glyphs above the fixed caps spec 005 already sets.
- **FR-039**: The weather rules MUST be identical at every play-field size and shape derived under spec 006; only the number of cells and the on-screen scale differ, and the FR-011 ceiling is a proportion of the field rather than a fixed count.
- **FR-040**: Existing behaviour MUST NOT regress: with no fog and no cloud on the field, every element, object, tool, scene, and control MUST behave exactly as specified by the earlier specs, and all existing automated tests MUST pass — updated only where the superseded requirements below make an assertion obsolete, never weakened to hide a regression.
- **FR-041**: The production build MUST still emit exactly one self-contained page, fully playable when opened directly from disk with no network requests.
- **FR-042**: The project MUST provide automated tests, runnable without a browser, covering at minimum: charming by the ⭐ brush and by drawn star power, one fog cell per water cell, in place (FR-007, FR-008, FR-010); fuelled star power leaving water untouched and a one-cell water stripe still stopping a burn with 0 far-side cells catching (FR-007, spec 008 SC-007); fog appearing by no other means (FR-009); the sky ceiling refusing further charming with no other effect (FR-011); the rise rate and the sideways wander bounds, including zero net bias (FR-012, FR-013); fog bubbling up through water and the water closing behind it (FR-014); fog blocked by grass, powders, objects, and walls without moving them (FR-005, FR-015); stuck fog and long-lived fog condensing to exactly one water cell (FR-016); fog becoming cloud only at the sky ceiling or under cloud (FR-017); cloud never moving and clouds growing downward (FR-018); every cloud cell raining within its bounds into exactly one water cell (FR-020, FR-021); rain behaving identically to poured water, including grass drinking it and it quenching star power (FR-022); conservation across a full cycle, with total water plus fog plus cloud never increasing (FR-023); settling to 0 fog and 0 cloud within 45 seconds from adversarial starting states (FR-024); no self-sustaining feedback (FR-025); brushes painting through fog and cloud and the eraser and clear-all removing them without leaving water (FR-026, FR-028); the wand leaving them untouched (FR-030); rainbow conversion and unicorn celebration applying under the existing rules (FR-031); re-derivation carrying them across (FR-034); scene loading clearing them and no scene containing any (FR-035); and that a field with no fog and no cloud produces byte-identical simulation behaviour to spec 008's toy (FR-040).

### Key Entities

- **Fog**: The rising sparkle-mist. Created only by charming water, it climbs with a sideways wobble, bubbles up through water, is blocked by solid matter, becomes cloud at the sky, and condenses back into a drop if it never gets there.
- **Cloud**: Gathered fog at the sky ceiling. It does not move, it grows downward as more fog arrives, and every cell of it rains within a few seconds.
- **Rain**: Not a new thing — an ordinary water cell released by a cloud, obeying every existing water rule.
- **Charming**: The act by which star power turns exactly one water cell into exactly one fog cell — by the ⭐ brush over water, or by drawn star power being quenched beside it.
- **Sky ceiling**: The top row of the play field, where rising fog runs out of room and becomes cloud.
- **Sky limit**: The proportion of the play field (20%) that fog and cloud together may occupy, above which no more water is charmed.
- **Element**: Extended from spec 008 — a cell now holds empty, pink sand, water, magic purple dirt, rainbow sand, grass, star power, fog, or cloud.

### Superseded requirements

- Spec 008's **FR-019** (there must be no steam, fog, cloud, rain, evaporation, or humidity, because the weather cycle is out of scope and belongs to its own follow-up feature) is superseded by this document, which *is* that follow-up feature.
- Spec 008's **FR-017** (quenching never spends the water) and **SC-009** (100% of the water cells involved are still present afterwards) are superseded **only** for unfuelled, child-drawn star power: one adjacent water cell becomes fog per such quench, and it comes back as rain (FR-007, FR-023). For fuelled star power — the burn front — both hold exactly as spec 008 wrote them, so spec 008's **SC-007** (a one-cell water stripe protects the far lawn completely) is unchanged.
- Spec 008's **FR-018** (the ⭐ brush must not place star power into a cell holding water) is extended rather than weakened: the brush still places no star power inside water, but the water inside its footprint is now charmed into fog (FR-008). Spec 008's edge case "a ⭐ drag through the lake simply does nothing" no longer holds — it now makes mist.
- Spec 002's **FR-003** (an element never changes into another element) and **SC-005** (element counts stay constant across a run with no drawing) are further superseded for water, fog, and cloud, in the same way spec 007 superseded them for water and spec 008 for grass. Pink sand and purple dirt counts remain exactly constant under all conditions, and the combined water-plus-fog-plus-cloud total never increases (FR-023).
- Spec 002's **FR-001** (the element set) is superseded by FR-001 of this spec, which adds fog and cloud. Spec 002's **FR-017** (the toolbar's element set) is unchanged: this feature adds no control (FR-027).
- Spec 003's **FR-014** (rainbow conversion) is unchanged and applies to fog and cloud exactly as it applies to water (FR-031). Spec 003's **SC-005** (total occupied cells stay constant under the simulation) is superseded to the extent that fog condensing, cloud raining, and charming all replace one cell with one cell — the total occupied count is unchanged by those — while a fog cell erased or a raindrop drunk by grass changes it under rules the earlier specs already sanction.
- Spec 005's **FR-017** (that feature adds no new element type) is unaffected; the new fog and cloud come from this spec, not from the wand, and glitter is unchanged in every respect.
- Spec 007's **FR-007**–**FR-015** (grass drinking and growth) are unchanged and now apply to rain as to any other water (FR-032).
- Spec 004's **FR-012** (what scene contents are composed of) is unchanged: no scene contains fog or cloud (FR-035).
- The toolbar-fit requirements of specs 002 (**FR-025**), 004 (**FR-007**), 005 (**FR-005**), 006 (**FR-018**, **FR-020**, **FR-020a**, **FR-021**), 007 (**FR-024**), and 008 (**FR-026**) are unchanged and continue to hold, because this feature adds no control.
- The constitution's product constraint that "new element types require a spec" is engaged and satisfied by this document: fog and cloud (which may be one element in two states) are what this feature adds.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A 4–5 year old who already knows the ⭐ button can make mist rise off water within 10 seconds of being pointed at the lake, with no adult instruction and without reading anything.
- **SC-002**: A single ⭐ drag across a body of water turns 100% of the water cells inside its footprint into fog, one for one, and changes 0 cells of pink sand, purple dirt, rainbow sand, glitter, grass, and 0 placed objects.
- **SC-003**: Drawn star power quenched beside water produces exactly 1 fog cell per quenching star power cell — never 0 and never more.
- **SC-004**: Star power that arrived by burning grass changes 0 water cells: with a one-cell water stripe between two lawns, 0 cells of the far lawn ever catch and 100% of the stripe's water cells are still there afterwards, exactly as spec 008 requires.
- **SC-005**: Fog rises between 12 and 20 cells per second through clear space, and a plume's sideways wander stays within 1 cell per upward move with a net horizontal drift of 0 over a long run.
- **SC-006**: Fog created below the surface of a body of water reaches the surface in 100% of cases, and 0 water cells are lost or gained in the process.
- **SC-007**: Fog changes, moves, or damages 0 cells of grass, powder, glitter, star power, and 0 placed objects, and 0 fog or cloud cells ever exist outside the play field.
- **SC-008**: 100% of fog cells that cannot reach the sky condense into exactly 1 water cell within 5 seconds of getting stuck, and 0 fog cells anywhere survive longer than 30 seconds without becoming cloud.
- **SC-009**: 100% of fog cells that reach the sky ceiling or the underside of a cloud become cloud, and 0 cloud cells form anywhere else.
- **SC-010**: Across any run of the simulation, 0 cloud cells move from the cell they formed in.
- **SC-011**: 100% of cloud cells rain within 10 seconds of forming, each producing exactly 1 water cell, and the moments at which the cells of one cloud rain are spread out rather than identical.
- **SC-012**: Advancing the simulation on a field of rain-made water and an identical field of poured water produces 0 differing cells — rain is water with no special behaviour.
- **SC-013**: Across a full cycle with no drawing, the total of water plus fog plus cloud cells never increases at any step, and returns to its starting value apart from cells drunk by grass, converted by a rainbow, or removed by the child — 0 cells created from nothing.
- **SC-014**: Fog and cloud together never occupy more than 20% of the play field's cells, from any starting arrangement including a field entirely full of water charmed as hard as possible.
- **SC-015**: From any state with no further drawing and no star power left, the field holds 0 fog cells and 0 cloud cells within 45 seconds and is then at rest.
- **SC-016**: Powder or water resting directly above a fog or cloud cell sinks through it within 1 simulation step in 100% of cases — 0 grains are held up by the sky.
- **SC-017**: A single drag of any element brush through a region of fog and cloud places that element in 100% of the covered fog and cloud cells; a single drag of the eraser through fog and cloud leaves 0 occupied cells inside the footprint and produces 0 water cells; tapping clear-all leaves 0 occupied cells anywhere.
- **SC-018**: A wand pass over fog and cloud leaves 0 of those cells glittered, emptied, retyped, or sprinkled into.
- **SC-019**: The toolbar after this feature has exactly the controls spec 008 leaves it — 0 controls added, 0 removed, 0 reordered — and on a phone-sized viewport 100% of them remain fully visible at once in both orientations at or above the minimum touch target, with 0 pixels of page scroll.
- **SC-020**: On a low-end tablet of the Amazon Fire 7 Kids class, with fog and cloud at the sky limit, rain falling, a lake below, grass drinking, and a lawn burning, the toy renders at least 30 frames per second, targeting 60.
- **SC-021**: The measured per-step simulation cost with a full sky and rain falling is within 20% of the cost of the same field full of falling sand.
- **SC-022**: The number of simultaneous sparkle flashes and live sparkle glyphs never exceeds spec 005's existing caps, however much weather is on the field.
- **SC-023**: A play field containing no fog and no cloud behaves identically to the previous release — 100% of existing acceptance scenarios and automated tests pass, with changes limited to the assertions made obsolete by the superseded requirements above.
- **SC-024**: A child cannot reach any state that shows a message, a confirmation, an error, or a score through the weather cycle — 0 such states exist, and 100% of what the weather does can be undone by erasing, clearing, or waiting for the rain.
- **SC-025**: A production build still produces exactly one output file, and opening that file directly from disk yields a fully playable toy with 0 network requests.
- **SC-026**: The automated test suite runs to completion without a browser and covers every rule listed in FR-042, including the stuck-fog, full-sky, firebreak, buried, erased, and re-derivation cases.

### Visual checks for the maintainer *(no automated coverage)*

- Waving the star over the lake and watching it steam is satisfying the very first time, with no explanation.
- The mist reads as pretty sparkle-mist, never as smoke — a child should think "magic steam", never "something is burning".
- A rising plume looks alive: it wobbles, spreads, and thins rather than marching up in a straight line.
- Fog bubbling up through the lake looks like bubbles, not like water glitching.
- The cloud building itself at the top over several seconds is worth watching all by itself.
- Rain patters — drops let go at different moments — rather than the cloud falling as a block.
- The full loop, lake to mist to cloud to rain to lake, is watchable end to end without getting boring or feeling slow.
- Rain landing on the garden and the grass growing taller reads as an obvious reward, not as a surprise.
- Nothing in the whole cycle is scary, sad, or looks like something breaking.
- On a Fire 7 tablet specifically: a full sky with rain coming down stays smooth in a small hand.

## Assumptions

- **Builds on the existing toy**: this feature assumes specs 001–008 are the base being extended, and specifically that **star power (spec 008) is implemented on `main`** before this feature is planned or built — star power is the only thing that starts the weather.
- **Fog is the framing.** The issue left the naming open; this spec calls it *fog* in the rules and presents it as pearly **sparkle-mist**, with the gathered form called a *cloud*. Nothing in the toy is labelled with text, so the framing lives entirely in how it looks — pale, twinkly, and pretty rather than grey and smoky.
- **The cycle conserves.** One water cell becomes one fog cell becomes one cloud cell becomes one water cell. This single decision is what makes the feature bounded: the play area can never fill with cloud beyond the water the child poured, the lake always comes back, and "conservation-ish" from the issue is met exactly rather than approximately.
- **Water leaves the cycle only by rules that already exist.** Grass drinking rain (spec 007) and a rainbow converting mist (spec 003) are the two ways the total can fall, and both are bounded by their own specs and chosen by the child.
- **Three independent guarantees make it settle** rather than run away: a sky limit that refuses new fog at 20% of the field (FR-011), a lifetime after which stray fog condenses back into a drop (FR-016), and a hold time after which every cloud cell must rain (FR-020). Any one of them alone would leave a gap; together they bound the sky in space and in time.
- **One gesture, one round** (FR-025). Confirmed in clarification: nothing but star power ever starts a cycle, so the weather can never feed itself. It is the strongest settle guarantee available and the right interaction for this player — she stays the author of the storm, and if she wants more she waves again.
- **Clouds only ever form against the sky** (FR-017). Confirmed in clarification: a cloud where a child expects a cloud needs no explanation, the mist's climb to the top is the part worth watching, and fog trapped under a sand shelf turning back into a drop where it is gives her a small secret to find instead of an indoor cloud.
- **The burn front does not steam water** (FR-007). Keeping fuelled star power's contact with water exactly as spec 008 wrote it preserves the promise that a pour of water is a permanent firebreak, which is the child's only control over a burn. Confirmed in clarification: spec 008 locked that promise in deliberately because a burnable firebreak is a step toward a losing state, so the sight of a burning shoreline steaming is knowingly given up.
- **No new control** (FR-027), as the issue expected. The gesture is the ⭐ tool she already has, aimed at water instead of grass, which is the most discoverable thing possible for a child who cannot read — and the toolbar is already at its limit on a phone under spec 006.
- **Fog and cloud are air, not furniture.** Nothing rests on them and brushes paint straight through them, so drifting weather can never get in the way of the child's drawing or hold her sand up in mid-air.
- **Star power's own rules are untouched** apart from what it does at the waterline: it still shines, still burns grass into glitter, still cannot spread through anything but grass, and still goes out in water.
- **No sound, no persistence, no new settings**, consistent with the rest of the toy.
- **Target devices** are a mid-range laptop, a tablet, a mid-range phone, and a low-end tablet of the Amazon Fire 7 Kids class, which remains the binding performance constraint. The 43,200-cell budget from spec 006 is unchanged, and the weather adds no per-cell work that scales with anything but the cell count.
- **Verification without a browser**: charming, rising, gathering, raining, condensing, conservation, and settling are all pure functions of grid state and step count, so they are fully unit-testable; the visual and feel checks are the maintainer's job on a real device, consistent with the project's no-browser-harness principle.
