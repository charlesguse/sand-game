# Feature Specification: People In Every Skin Tone

**Feature Branch**: `019-skin-tone-people`

**Created**: 2026-09-12

**Status**: Draft

**Input**: Lifecycle issue #66 — "People in every skin tone"

> ## What the maintainer asked for
>
> Follow-on to #61 (spec 018). The people who stroll around her world all come out one
> default yellow. They should come in **skin tones** too, the way real emoji keyboards
> do — the five Fitzpatrick modifiers (🏻 🏼 🏽 🏾 🏿) plus the unmodified default, so
> **six tones**, each combined with every frame and every gender form: 🧍🏽 stands,
> 🚶🏽 walks, 🏃🏽 runs, and 🧍🏽‍♀️ / 🚶🏽‍♀️ / 🏃🏽‍♀️ likewise. A person picks a tone once at
> placement and keeps it for life, exactly like her neutral/man/woman form today
> (spec 018 FR-012).
>
> - **Default yellow stays in the pool** as one of the six. It is the tone the toolbar
>   button already shows, and dropping it would make the button a picture of someone
>   who never appears.
> - **No new control, no reading.** Tone is chosen automatically at placement, like
>   gender: from whichever tones the glyph probe says this device draws as one figure,
>   with **no repeats until every drawable tone has been used**. Keep **two independent
>   bags — gender and tone — not one bag of eighteen**, so three placements come out
>   varied on both axes rather than exhausting one axis while the other stalls.
> - **Sequence order matters and is easy to get wrong**: the modifier goes on the base,
>   *before* the ZWJ and the gender sign.
>
> The existing session-wide glyph probe is to be **extended, not forked**: an
> unsupported tone renders as the figure plus a coloured square beside it — the same
> "split" shape the existing width check catches — so each toned picture is compared
> against its untoned counterpart for the same frame and gender. A tone is usable only
> if *every* frame of *every* drawable gender draws it as one figure. An undrawable tone
> is simply not in the bag; if no modifier is drawable everyone is default and the bag
> collapses to the default alone without stalling. The toolbar button keeps showing the
> untoned neutral standing figure.
>
> Cross-cutting: save/restore and undo/redo round-trip tone as a tolerant optional
> field (missing reads as default, malformed falls back to default, **no format-version
> bump**); frame and facing selection are otherwise unchanged; no new grid-element IDs,
> no new toolbar control, no new sound; vitest covers the probe ladder, the two-bag
> rule under seeded randomness, the round trips, and migration of a spec-018 save with
> no tone field. Existing people behaviour (stroll cadence, poke-to-run, eraser,
> clear-all, cap of 3, the spec-018 legacy-person migration) must not regress.
>
> Decisions the issue recommends answers for: uniform draw over the drawable tones; the
> toolbar button never changes tone; and a constitution amendment at finalize appending
> "and skin tone" to the pets clause added in #64.

## Clarifications

### Session 2026-09-12 — maintainer reply on issue #66

- **Q: On a device where the untoned standing picture is already missing (spec 018 uses
  walking as the idle frame), is a tone judged on the frames actually drawn, or must its
  standing picture be drawable anyway?** → Judge it on the pictures actually drawn. The two
  resolutions run in a fixed, test-pinned order: spec 018's frame ladder first, then the
  tone check against its output. This keeps the most tones on exactly the device most
  likely to have a limited font, and the continuity rule only cares about frames she is
  ever shown in. Where standing *is* drawn, a missing toned stander still fails the tone.
  Folded into FR-012.
- **Q: What happens when a restored person's stored tone is one this device cannot draw?**
  → Keep her stored tone in the save; draw her in the default tone here. Two maintainers
  swap worlds between an iPad and a Fire, and flattening everyone to yellow forever because
  one device's font is poorer would be data loss the child would notice. The substitution
  lives in the resolved picture set — undrawable tones map to that appearance's
  default-tone pictures — so the render path stays a direct lookup with no per-frame branch
  and no allocation. Folded into FR-017.

## User Scenarios & Testing *(mandatory)*

Throughout this spec, and continuing spec 018's vocabulary:

- A **person** is a strolling figure the child places with the existing person button —
  a living figure drawn over the grid, not a stamped block of cells.
- A **frame** is which picture she is currently drawn as: **standing**, **walking**, or
  **running**.
- A **form** is which person she is on the gender axis — neutral figure, man, or woman.
  Spec 018 calls this her *variant*; this spec says "form" so that "variant" never has
  to mean two things at once.
- A **tone** is which of six skin tones she is: the **default** (the unmodified yellow
  figure) or one of the **five modifier tones**. Default is a tone like any other, not
  the absence of one.
- An **appearance** is a person's (form, tone) pair. It is fixed at placement and never
  changes; a frame is chosen inside it.
- A **picture** is the exact glyph drawn for one (form, tone, frame) combination — 3 × 3
  × 6 = 54 of them.
- A **toned picture** is any picture whose tone is one of the five modifier tones; its
  **untoned counterpart** is the picture with the same form and frame in the default
  tone.
- A **split picture** is what a device draws when it does not support a sequence: the
  figure plus a separate glyph beside it (a gender sign in spec 018's case, a coloured
  square in this one) rather than one figure.
- A **glyph probe** is the once-per-session check of what this device's emoji font can
  actually draw, already built for spec 018 and extended here.
- A **bag** is a no-repeat random chooser: it hands out every option once, in a random
  order, before any option can come up again. Spec 018 has one for forms; this feature
  adds a second, independent one for tones.
- A **spec-018 save** is a world or stored undo history written after spec 018 shipped
  but before this feature: people have a form but no tone.

### User Story 1 - People who look like everyone (Priority: P1)

The child places a person and gets a particular person: some tone of skin, some form.
She places another and gets a different-looking one, and a third different again. Each
of them strolls, pauses, and — when poked — runs, and through all of it stays the same
person: the same skin tone and the same form in every frame, facing either way.

**Why this priority**: This is the whole wish. A world where everybody is the same
default yellow figure is the thing being fixed, and every other story here exists to
keep this one from breaking on a particular device or a particular reload.

**Independent Test**: In plain unit tests, drive the placement path with a seeded source
of randomness and a probe result that reports everything drawable, place people, and
assert each one's tone and form are fixed at placement and unchanged after hundreds of
simulated frames including a poke-run; assert the picture chosen for every (form, tone,
frame) combination is the one belonging to that appearance. Whether the toned figures
*read* as the same person across frames is a maintainer eyeball check on a real device.

**Acceptance Scenarios**:

1. **Given** a device that draws all six tones, **When** the child places a person,
   **Then** that person has one tone out of the six and one form out of the three, and
   she keeps both for as long as she exists.
2. **Given** a person of a given appearance, **When** she changes between standing,
   walking, and running, **Then** every frame shown is that same tone and that same
   form — never a different tone for one frame, never an untoned figure mid-stride.
3. **Given** a walking person, **When** she is drawn facing either way, **Then**
   mirroring behaves exactly as it does today and does not change her tone or form.
4. **Given** any person on any device, **When** she is drawn anywhere — canvas or
   toolbar — **Then** she is one figure: never an empty box, never a figure with a
   coloured square or a gender sign beside it.

---

### User Story 2 - Three people, three different people (Priority: P1)

The child places three people in a row. On a device that can draw them, she gets three
different skin tones *and* three different forms — not three identical figures, and not
three figures that differ on only one axis. She never picks any of this; it just
happens, with no new button and nothing to read.

**Why this priority**: Variety is the point of the feature, and the thing most easily
lost. A single bag of eighteen appearances would let three placements come out as three
different forms in the same tone (or the reverse) and look, to her, like the feature did
not ship.

**Independent Test**: Unit-test the two choosers with seeded randomness: six consecutive
placements on an all-tones-drawable probe result yield six distinct tones; three
consecutive placements yield three distinct forms *and* three distinct tones; a seventh
placement starts a fresh tone cycle; a probe result with only some tones drawable never
yields an undrawable one and never stalls or repeats early within a cycle.

**Acceptance Scenarios**:

1. **Given** a device that draws all six tones and all three forms, **When** the child
   places three people, **Then** their three tones are all different and their three
   forms are all different.
2. **Given** the same device, **When** she places six people over time, **Then** all six
   tones have appeared before any tone appears twice.
3. **Given** a device whose font draws only some of the modifier tones, **When** she
   places people, **Then** only drawable tones ever appear, and they too cycle without
   repeating until all of them have been used.
4. **Given** the person button, **When** she taps it repeatedly, **Then** nothing about
   the button changes — tapping it does not cycle tones, and there is no new control,
   no menu, and no text anywhere.
5. **Given** any run of placements, **When** the tones and forms are inspected, **Then**
   the two axes advance independently: exhausting the tone cycle does not hold up the
   form cycle, or the other way round.

---

### User Story 3 - Never a broken picture, on any device (Priority: P1)

On a device whose emoji font cannot draw a toned figure — it would come out as a figure
with a coloured square stuck beside it — that tone quietly never appears. On a device
that can draw none of them, everybody is the default figure and the toy behaves exactly
as it does today. The child is never shown a broken picture and never told anything
about it.

**Why this priority**: The constitution's "feature-detect and hide, never break" rule.
Skin-tone modifiers on 🚶 and 🏃 are old (Emoji 2.0) but on 🧍 they are Emoji 12.0, and
neither maintainer can check the other's device — the Fire 7's Silk font and the iPad's
are both unknowns here.

**Independent Test**: The resolution stays a pure function over the injected probe, so
unit tests can feed it fabricated measurements: every toned picture fine; one tone that
splits on exactly one frame of one form; all five modifier tones splitting; gendered
forms splitting *and* tones splitting; the untoned stander missing so spec 018's frame
ladder has already dropped standing; a probe that throws; a probe that returns zero or
nonsense widths — asserting the exact resolved tone set each time, with no DOM.

**Acceptance Scenarios**:

1. **Given** a font that draws every toned picture as one figure, **When** the toy
   opens, **Then** all six tones are available to be placed.
2. **Given** a font that draws a tone correctly for walking and running but splits it
   for standing, **When** the toy opens, **Then** that tone is not used at all — a
   person is never one figure while she walks and a figure-plus-square while she pauses.
3. **Given** a font that splits every modifier tone, **When** the toy opens, **Then**
   every person is the default tone, placement still works, and the chooser does not
   stall, loop, or fail.
4. **Given** a font that also splits the man/woman forms, **When** the toy opens,
   **Then** spec 018's neutral-only rule still holds and tones are judged only against
   the forms that are actually drawable.
5. **Given** a device where the probe cannot run at all, **When** the toy opens,
   **Then** everybody is the default tone and the toy opens normally, with no message.
6. **Given** any of the above, **When** the sim runs, **Then** the answer was decided
   once for the session and reused — never re-probed per person, per frame, or per draw
   — and the toy still opens without a visible delay on the slowest device it targets.
7. **Given** any probe outcome at all, **When** the toolbar is drawn, **Then** the
   person button shows the untoned neutral standing figure, unchanged from today.
8. **Given** a font that cannot draw the *untoned* standing figure, so spec 018 already
   uses the walking picture when a person pauses, **When** the toy opens, **Then** a tone
   is kept or dropped on the strength of the frames actually drawn there — walking and
   running — and is not dropped merely because its standing picture is missing on a device
   that never shows standing.

---

### User Story 4 - The people she already has come back (Priority: P1)

The child opens the toy the day after this ships. Her people are exactly where she left
them, in the same forms — now simply as default-tone people, since that is the tone they
were. Nothing she built is wiped and there is no message about the change.

**Why this priority**: The constitution has a standing amendment about exactly this
failure. Spec 015 found that a new field in the save format could make the reader reject
her entire world; spec 018 shipped a migration for the same reason. A format change
here that is not tolerant silently empties her world on first launch.

**Independent Test**: Unit tests feed the world-restore and history-restore paths a
spec-018 payload with no tone field, a payload with a tone field containing a value the
toy does not recognise, a payload with an empty tone, and a pre-018 payload with people
still in the placed-object shape; assert each restore succeeds, that people come back at
the same positions with the same forms, that unknown or missing tones read as default,
and that the rest of the world is untouched.

**Acceptance Scenarios**:

1. **Given** a spec-018 save with no tone recorded, **When** it is restored, **Then**
   every person comes back at the same place, in the same form, in the default tone, and
   the rest of the world is exactly as it was.
2. **Given** a saved world or stored history whose tone value is missing, empty, or
   unrecognised for one person, **When** it is restored, **Then** that person comes back
   in the default tone and no other person and no part of the world is dropped.
3. **Given** a pre-018 save whose people are still stored as placed objects, **When** it
   is restored, **Then** spec 018's migration still produces walkers at the same
   positions, now in the default tone, honouring the cap of three.
4. **Given** a world saved by this feature, **When** it is opened, **Then** it is
   accepted — this feature changes neither the saved-world format number nor the
   saved-history format number.
5. **Given** a world saved by this feature and opened by a build from before it, **Then**
   the world still loads, with its people in the default tone; the added field is
   ignored, not fatal.

---

### User Story 5 - Tone survives the whole world (Priority: P2)

A person the child made is the same person after she closes and reopens the toy, after
she undoes and redoes, and after she rotates the tablet or goes fullscreen. Her skin
tone travels with her position and her form.

**Why this priority**: Spec 018 made form durable for exactly this reason — a figure
who changes who she is between sessions reads as a different person appearing. Tone has
the same property. It is P2 only because story 1 is demonstrable without it.

**Independent Test**: Unit tests over save/restore, undo/redo, and grid re-derivation
asserting person count, positions, forms, *and* tones before and after; a test that
restores a person whose stored tone the probe reports as undrawable and asserts she draws
as default while the stored tone survives a further save; plus a test that two worlds
differing only in one person's tone are not treated as the same state by the history's
change detection.

**Acceptance Scenarios**:

1. **Given** people of several tones, **When** the world is saved and restored, **Then**
   each person comes back in her own tone — zero tone drift.
2. **Given** a person the child just placed, **When** she undoes and then redoes,
   **Then** the person returns at the same place, in the same form, and in the same
   tone.
3. **Given** people on the canvas, **When** the tablet is rotated or fullscreen is
   toggled and the play area is re-derived, **Then** every person is carried across with
   her tone intact, exactly as her position and form already are.
4. **Given** two otherwise identical worlds that differ only in one person's tone,
   **When** the history decides whether anything changed, **Then** it sees them as
   different.
5. **Given** a world saved on a device that draws all six tones and opened on one whose
   font draws only some, **When** a person's stored tone is one this device cannot draw,
   **Then** she is drawn in the default tone here — never as a figure with a coloured
   square — and her stored tone is kept, so saving again and reopening on the first device
   brings her back in her own tone.

---

### User Story 6 - Everything else still works (Priority: P2)

Strolling, poking, erasing, clearing, the cap of three, the poodles, the mermaids, and
every placed object behave exactly as they did the day before this shipped.

**Why this priority**: Not optional for shipping; simply not the demo. Spec 018 is a
week old and its behaviours are the baseline this feature must not disturb.

**Independent Test**: The existing spec-018 suites pass unchanged, plus tests asserting
stroll cadence, poke-to-run (including the hop fallback when running cannot be drawn),
eraser reach, clear-all, and the cap of three are unaffected by tone.

**Acceptance Scenarios**:

1. **Given** people of any tone, **When** frames pass, **Then** they stroll, pause, step
   up ledges, and turn at edges exactly as before; tone changes nothing about movement.
2. **Given** a person of any tone, **When** the child pokes her, **Then** she runs in her
   own tone and form; **Given** a device that cannot draw the running picture, **Then**
   the spec-018 hop fallback still happens.
3. **Given** people of any tone, **When** the child erases one or clears everything,
   **Then** they are removed exactly as before.
4. **Given** three people already placed, **When** a fourth is placed, **Then** the
   oldest leaves and three remain — the cap is unchanged, and the retired person's tone
   does not disturb the tone cycle.
5. **Given** poodles, mermaids, and every placed object, **When** any path of this
   feature runs, **Then** none of them is affected in any way.

---

### Edge Cases

- **A font that draws the walker in a tone but not the stander** (the concrete risk the
  issue names, since 🧍 with a modifier is Emoji 12.0 while 🚶🏃 with one are Emoji 2.0):
  resolved by the all-or-nothing tone rule — the tone is dropped, because standing is a
  frame she is shown in. If that same font cannot draw the *untoned* stander either, spec
  018 has already replaced the idle frame with walking, and FR-012's fixed ordering means
  the tone is judged on walking and running alone and survives.
- **A font that draws toned neutral figures but splits toned gendered ones**: tones are
  judged against the forms that are drawable, so this device may still have six tones of
  neutral figures rather than losing tones it could have drawn.
- **No modifier tone drawable at all**: everybody is default, the tone bag collapses to a
  single option, and the chooser behaves like today's untoned code — no stall, no empty
  bag, no exception.
- **Probe throws or returns zero/garbage widths**: treated the same as "not drawable",
  degrading only the pictures it was asked about, never the whole picture set.
- **A saved world holding a tone this device cannot draw** (saved on the iPad, opened on
  the Fire tablet, or the font changed under an OS update): she is drawn in the default
  tone here while her stored tone is kept, so carrying the world back to the other tablet
  brings her own tone back (FR-017).
- **A world round-tripped through the weaker device** (opened on the Fire tablet, played
  with, saved again, reopened on the iPad): because nothing rewrites the stored tone, the
  people the Fire drew as default come back in their own tones.
- **A hand-edited or corrupt save with a nonsense tone value**: that person reads as
  default tone; the rest of the world still restores.
- **The child places six people over time on a device with only two drawable tones**:
  the tones alternate in cycles of two; no repeat happens inside a cycle.
- **Three people alive at once when the tone bag has five tones left**: the bag is about
  order of placement, not about the three currently alive — two living people may share
  a tone once a cycle wraps. Accepted; the no-repeat rule only promises a run no longer
  than the number of drawable tones comes out mixed.
- **The 54-picture probe on the slowest device**: the session's one probe does more work
  than it did for nine pictures; it must not turn into a visible pause before the toy is
  playable.
- **A person poked mid-cycle, evicted, or erased**: none of these change any surviving
  person's tone, and none replays or rewinds the bag.

## Requirements *(mandatory)*

### Tone as part of who a person is

- **FR-001**: A person MUST have a **tone** alongside her form: one of six — the default
  (unmodified) figure or one of the five skin-tone modifiers. The default MUST be one of
  the six choosable tones, not a "no tone" state excluded from the pool.
- **FR-002**: A person MUST take her tone at the moment she is placed and MUST keep it
  for her whole life: across every frame, every state change, every save and restore,
  every undo and redo, and every grid re-derivation. This extends spec 018 FR-012 to the
  tone axis; a person MUST NOT change tone mid-stride or between sessions.
- **FR-003**: Tone MUST be chosen with no reading and no new control. The child MUST NOT
  be asked, and repeated taps on the person button MUST NOT cycle tones or otherwise
  change what the button does. Placing another person is the only way to get a different
  tone.
- **FR-004**: Every combination of form, tone, and frame MUST have a defined picture —
  three frames × three forms × six tones. Each picture MUST be stated explicitly in one
  table rather than assembled from parts at the point of use, because the sequence order
  is the easiest thing here to get wrong.
- **FR-005**: Each toned picture's composition MUST be: base figure, then the tone
  modifier, then (for a gendered form) the zero-width joiner, the gender sign, and the
  variation selector — the modifier attaches to the base *before* the joiner, never
  after the gender sign. The table MUST be verified against this order by test or review,
  not assumed.

### Choosing a tone: two independent bags

- **FR-006**: Tone selection MUST draw only from the tones the probe reports as drawable
  on this device (FR-009 – FR-013), and MUST NOT repeat a tone until every drawable tone
  has been used once. A run of placements no longer than the number of drawable tones
  therefore always comes out mixed; within that constraint the order MUST be random.
- **FR-007**: The form bag (spec 018 FR-013a) and the tone bag MUST be two independent
  no-repeat cycles, not one combined cycle over form-and-tone pairs. Three consecutive
  placements on a fully capable device MUST therefore yield three distinct forms **and**
  three distinct tones.
- **FR-008**: The randomness behind both bags MUST be an injectable input so tests can
  make a sequence deterministic, following the mechanism spec 018 already uses. Draws
  MUST be uniform over the drawable tones — no tone is rarer or more common than another.

### Probing what this device can draw

- **FR-009**: Tone support MUST be determined by extending the existing once-per-session
  person-glyph resolution, not by adding a second parallel probe. It MUST keep the
  existing shape: a pure function over injected rendering/measuring capability,
  unit-testable with no DOM and no browser harness (constitution Principle V).
- **FR-010**: An unsupported tone draws as the figure plus a separate coloured square —
  the same split shape the existing width check already detects. Each toned picture MUST
  therefore be checked both for an empty box and, by width, against **its untoned
  counterpart for the same frame and the same form**, not against some single reference
  glyph.
- **FR-011**: Tone support MUST be **all-or-nothing per tone**: a tone is usable only if
  *every* frame of *every* drawable form draws it as one figure. A tone that works for
  one frame but not another MUST NOT be used at all, because a person must look like the
  same figure across her frames (spec 018 FR-019's continuity rule).
- **FR-012**: The tone check MUST be evaluated against the pictures the toy will actually
  draw after spec 018's own fallbacks have been applied — not against raw table entries
  that this device never shows. The two resolutions MUST run in a fixed order: **spec
  018's frame ladder first, then the tone check against that ladder's output**. So on a
  device whose *untoned* standing picture is missing and whose idle frame is therefore the
  walking picture, a tone is judged on the frames actually drawn there (walking and
  running) and its standing picture being undrawable MUST NOT disqualify it. Where
  standing *is* drawn, a missing toned standing picture still disqualifies the tone under
  FR-011. This ordering MUST be pinned by test, not left implicit.
- **FR-013**: An undrawable tone MUST simply be absent from the bag. If no modifier tone
  is drawable, the bag MUST collapse to the default alone and keep working — no stall, no
  empty selection, no exception, and no visible difference from today's behaviour.
- **FR-014**: A split or empty-box picture MUST NEVER be drawn, on the canvas or the
  toolbar, by any code path. The child MUST NEVER be shown a message, marker, or error
  surface about a missing tone.
- **FR-015**: The toolbar person button MUST keep showing the untoned neutral standing
  figure resolved by spec 018. It MUST NOT change tone at any time — it is a fixed
  landmark for a child who cannot read.
- **FR-016**: The probe MUST still run at most once per session and its result MUST be
  reused; it MUST NOT run per person, per frame, or per draw. Extending it from nine
  pictures to fifty-four MUST NOT introduce a startup delay a child would notice on the
  slowest target device; if the probe work grows enough to threaten that, the probe's own
  repeated work (for example, re-deriving the same baseline for every comparison) MUST be
  reduced rather than the coverage of FR-011 being weakened.

### Persistence, history, and migration

- **FR-017**: Save/restore and undo/redo MUST round-trip each person's tone alongside her
  position and form. When a restored person's stored tone is one *this* device cannot draw
  (a world saved on one maintainer's tablet and opened on the other's, or a font changed by
  an OS update), her stored tone MUST be **kept** — in memory and in everything written
  back out — while she is **drawn in the default tone for this session**, so she looks
  right again on a device whose font can draw her. Restore MUST NOT permanently rewrite her
  tone to default, and no save or history write MUST replace a stored tone with the one
  that happened to be drawn. The substitution MUST live in the resolved picture set: every
  undrawable tone maps to that appearance's default-tone pictures, so drawing stays the
  direct lookup of FR-022 with no per-frame branch and no allocation.
- **FR-018**: Tone MUST be carried as a **tolerant optional field** in both the
  saved-world and the saved-history shapes: a missing tone reads as default, an
  unrecognised or malformed tone reads as default for that person only, and neither ever
  causes the whole payload — or any other person in it — to be rejected. This follows the
  constitution's "absence means none of this yet, never corrupt" amendment and spec 018
  FR-025.
- **FR-019**: The saved-world format version and the saved-history format version MUST NOT
  be changed by this feature.
- **FR-020**: Restoring a spec-018 save or stored history — people with a form but no
  tone — MUST produce people at the same positions, in the same forms, in the default
  tone. Spec 018's own migration of pre-018 placed-object people MUST continue to work
  unchanged, producing default-tone walkers.
- **FR-021**: Whatever mechanism decides that the world has changed enough to record a
  new history step MUST treat a difference in tone as a difference, so that a tone can
  never be silently lost by being folded into an earlier state.

### Rendering and scope limits

- **FR-022**: Picture selection MUST gain the tone dimension while remaining a **direct
  lookup** — a pure function of the person's state, form, and tone against the resolved
  picture set — with no per-frame string building and no allocation on the render path
  (constitution Principle IV). Whether that is a third dimension on the existing lookup
  or a combined appearance key is the implementation's call.
- **FR-023**: Frame selection, facing, mirroring, stroll cadence, poke-to-run and its hop
  fallback, the eraser, clear-all, the cap of three, and grid remapping MUST be unchanged
  by this feature beyond carrying tone along.
- **FR-024**: This feature MUST NOT add a grid-element ID, a toolbar control, a sound, a
  runtime dependency, or an asset file, and MUST NOT break single-file `file://` playback.
- **FR-025**: No existing behaviour or test may be weakened to accommodate this feature.
  Poodles, mermaids, ambient life, and every placed object MUST be untouched.

### Verification and follow-up

- **FR-026**: The feature MUST ship plain unit tests with no DOM and no browser harness,
  covering at minimum: the extended probe ladder (all tones drawable; one tone undrawable
  on exactly one frame of one form; no modifier tone drawable; gendered forms undrawable
  *and* tones undrawable; a probe that throws; a probe returning zero or non-finite
  widths); the two-bag no-repeat rule under seeded randomness (six placements yield six
  distinct tones; three placements yield three distinct forms *and* three distinct tones;
  a single-drawable-tone device never stalls); the FR-012 ordering (frame ladder first,
  tone check against its output — a tone whose standing picture is missing survives on a
  device where standing is not drawn, and is dropped on one where it is); save and history
  round-trip of tone; restore of a person whose stored tone this device cannot draw,
  asserting she draws as default while the stored tone survives a further save; restore of
  a spec-018 payload with no tone field; restore of a payload with a malformed tone; and
  the composition order of FR-005.
- **FR-027**: Two checks MUST be flagged for maintainer eyeballing on each platform
  rather than assumed, since neither maintainer can verify the other's device (CLAUDE.md):
  (a) do the toned figures read as the *same* person across standing, walking, and
  running, and (b) are the toned man/woman forms one figure rather than a figure plus a
  square. Desktop Chrome on Windows 11 is known to draw all nine untoned pictures as
  single figures (verified 2026-09-12); the toned forms are *expected* to work there too
  but MUST be probed, not assumed. Fire 7 Silk and iPad Safari are the unknowns, and this
  spec MUST NOT assert an answer for either.
- **FR-028**: The constitution's pets clause (amended in #64) says people "keep the
  neutral/man/woman form they were born with". Appending "and skin tone" MUST be flagged
  as a follow-up documentation amendment with a version bump at finalize, the way spec
  018 handled its own clause — it is not part of this feature's code change.

### Key Entities

- **Tone**: which of six skin tones a person is — default or one of five modifiers.
  Chosen once at placement from the drawable set, never changed, round-trips through save
  and undo as a tolerant optional field that defaults to default. A stored tone this device
  cannot draw is still hers: kept as stored, drawn as default only for this session.
- **Appearance**: a person's (form, tone) pair. Fixed for life; the frame varies inside
  it. The unit that "the same person across frames" is measured against.
- **Picture set**: the resolved answer to "what can this device draw", extended from spec
  018's nine pictures to fifty-four plus the drawable-tone list, and holding the fallback
  that sends every undrawable tone to the default-tone pictures of the same appearance so
  drawing never has to branch. Decided once per session and shared by the canvas and the
  toolbar.
- **Tone bag**: the no-repeat chooser over drawable tones, independent of the existing
  form bag, driven by injectable randomness, collapsing harmlessly to a single option when
  only the default tone is drawable.
- **Spec-018 person record**: a saved person with a position and a form but no tone. Read
  as a default-tone person; never written in that shape again.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a probe result reporting all six tones and all three forms drawable, 6
  consecutive placements yield 6 distinct tones and 3 consecutive placements yield 3
  distinct forms *and* 3 distinct tones — in 100% of seeded runs.
- **SC-002**: On a probe result reporting no drawable modifier tone, 100% of placements
  are the default tone, and 0 placements fail, stall, or raise.
- **SC-003**: Across every probe outcome tested — including a tone that splits on exactly
  one frame, a probe that throws, and a probe returning nonsense widths — the resolved
  picture set yields 0 empty boxes and 0 split pictures reachable by any code path, on the
  canvas and on the toolbar.
- **SC-004**: 100% of placed people survive a save/restore cycle, an undo/redo cycle, and
  a grid re-derivation with the same count, the same positions (within the existing remap
  tolerance), the same form, and **the same tone** — zero tone drift. This holds on a
  device that cannot draw a stored tone too: she is drawn default there, but 100% of stored
  tones come back unchanged on the next save.
- **SC-005**: 100% of people in a spec-018 save or stored history restore successfully as
  default-tone people; a payload with one malformed tone still restores every person, with
  only the malformed one falling back to default. Restoring such a payload never returns
  "no world".
- **SC-006**: The saved-world and saved-history format numbers are byte-for-byte unchanged
  by this feature, and a world written by this feature still loads in a build from before
  it.
- **SC-007**: The shipped toolbar control count and the person button's picture are
  unchanged, and a child can get people of different skin tones using only the existing
  picture button and her finger — no reading, no new control, no menu.
- **SC-008**: With three people of any tones, three poodles, and three mermaids on the
  default grid, the sim holds the constitution's frame-rate target (60fps target, ≥30fps
  acceptable) on the maintainers' devices, and the per-frame work per person is unchanged
  from spec 018.
- **SC-009**: The session's glyph probe still runs exactly once, covers all fifty-four
  pictures, and adds no delay a child would notice before the toy is playable on the
  slowest target device.
- **SC-010**: The existing test suite passes unchanged, and the build still emits a single
  self-contained `dist/index.html` that plays from `file://`.

## Assumptions

- **Uniform draw over drawable tones** *(the issue's recommendation, taken)*: every
  drawable tone is equally likely; the no-repeat bag already guarantees variety, so
  weighting would add tuning surface for no visible gain.
- **The toolbar button never changes tone** *(the issue's recommendation, taken)*: it stays
  the untoned neutral standing figure so it remains a stable landmark for a non-reader, and
  so the button can never disagree with itself between sessions. The cost is that the
  button's tone is one of six rather than a picture of "any person", which is accepted.
- **Default is a tone, not the absence of one**: it sits in the bag with the other five, so
  the figure the button shows is a figure that actually appears.
- **Two bags, not eighteen pairs** *(FR-007, per the issue)*: keeping the axes independent
  is what makes three placements differ on both. A combined bag of eighteen would let three
  placements share a tone or a form for a long time.
- **Tone is per placement, not per living person**: the no-repeat promise is about the
  order people are placed, not about the at-most-three alive at once. Two living people may
  share a tone after the cycle wraps; making the bag exclude currently-alive tones would
  cost a coupling between the chooser and the roster for a barely visible gain.
- **The bag is per session**: like spec 018's form bag, it starts fresh when the toy opens
  and is not saved. A restored world's people keep their own tones regardless.
- **Tone rides in the existing person records** *(FR-018, FR-019)*: one optional field
  added to the saved-world and saved-history person shapes, tolerant of absence, with no
  version bump — the pattern the constitution mandates and spec 018 followed for people
  themselves.
- **Spec-018 people are default-tone people**: they were drawn untoned, so restoring them
  as default tone is not a change to what the child saw, it is the same picture.
- **The probe is extended, never forked** *(FR-009, per the issue)*: the existing tofu check
  and split-width check already detect exactly the failure a missing tone produces, so the
  same two checks are applied to more pictures against per-(form, frame) baselines.
- **Emoji-version facts taken as given from the issue**: toned 🚶/🏃 are Emoji 2.0 and toned
  🧍 is Emoji 12.0, so a font that draws the walker in a tone but not the stander is a real
  possibility rather than a theoretical one — which is why FR-011 is all-or-nothing and
  FR-012 is called out as a decision rather than assumed.
- **Movement, sound, elements, and the toolbar are untouched**: this feature changes only
  which picture a person is drawn with and what travels with her through save, history, and
  remap.
