# Feature Specification: Undo That Survives Closing The App

**Feature Branch**: `spec-draft/011-persistent-undo-history`

**Created**: 2026-08-30

**Status**: Draft

**Input**: GitHub issue #35 — "Undo still works after closing and reopening the app"

> **The wish** — Since the fork merge (PR #33), her world survives closing the app: auto-save writes the picture to localStorage and it comes back on reopen. But the ↩️/↪️ buttons come back **dimmed** — the restore deliberately resets history ("the restored world is the new baseline", phase-6 plan). The maintainer tested this on the real tablet and wants the undo button to keep working across a close-and-reopen: she should be able to reopen the app and still take back the last thing she did before leaving.
>
> **What this supersedes** — This is a deliberate change to settled behaviour, not a bug: spec 010's **FR-021** ("History MUST NOT be persisted. On page load both histories are empty") and the persistence clause of **FR-025**, both scoped before auto-save existed; and the phase-6 "History starts empty after a restore" baseline in `tryRestore()`.
>
> **Shape of the feature** — Persist the undo/redo stacks alongside the world save and restore them on reopen so ↩️/↪️ light up as they were, or with however many steps survived. Everything stays silent and best-effort: storage failure, corrupt payload, or a partial fit must land her in today's behaviour (world restored, history empty) with no visible difference beyond dimmed buttons. No new controls, no messages.
>
> **Hard constraint the spec must resolve: size** — localStorage quota is typically ~5 MB per origin. The world save alone measured ~286 KB serialized; each history snapshot serializes to roughly the same. 10 undo + 10 redo ≈ 6 MB — **the full stacks cannot fit**. The spec must pick a persistence depth/budget. In-memory depth (10) stays what it is.

## Clarifications

### Session 2026-08-30 (suggested answers supplied on issue #35, adopted)

- **Q: How many steps should be persisted?** → **A fixed byte budget of roughly 2 MB, filled newest-first, rather than a fixed count.** Roughly 5–6 steps at today's measured world size, and a bigger play field degrades to fewer surviving steps instead of hitting a quota error. (FR-008, FR-009)
- **Q: What happens if the viewport differs on reopen — a rotation, or reopening into fullscreen?** → **Reuse spec 010's amended FR-022 remap semantics:** re-anchor each persisted state to the new field the same way live re-derivation does, drop the states that cannot survive losslessly, in silence. The machinery already exists and is already the specified behaviour for rotation. (FR-016)
- **Q: When is the history written?** → **Piggyback on the existing auto-save moments,** adding no write pressure beyond what auto-save already has. (FR-013, and see the open question on cadence.)
- **Q: Can she undo past the reopen boundary, into the world as it was before she left?** → **Yes, and that is the whole point.** The persisted steps simply *are* the tail of last session's undo stack; there is no boundary, no marker, and nothing that feels different at the seam. (FR-003)
- **Q: How are version drift and corruption handled?** → **The same contract as the world save:** versioned wire format, reject anything invalid, silent fallback to an empty history. A history payload that fails MUST NOT prevent the world restore from succeeding. (FR-018, FR-019)

### Open questions (not resolved in this draft)

Two decisions are left marked in the requirements below because both readings are reasonable and they lead to materially different work. The spec states a working assumption for each so it is implementable as written; see **Assumptions**.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Taking back the last thing she did before she closed the app (Priority: P1)

She draws a smear across her garden, then the tablet is taken away, the app is closed, and the world goes away with it. Later she opens the app again. Her picture is there, as it already is today — and this time ↩️ is bright. She taps it and the smear lifts off, exactly as it would have if she had never left. She taps again and the stroke before that comes back too. Nothing tells her anything happened in between; the app simply picked up where she put it down.

**Why this priority**: This is the entire feature in one tap. It delivers on its own even if nothing else in this spec is built, and it is the case the maintainer tested on the real tablet and found wanting.

**Independent Test**: In a headless world, record several actions, serialize the session as a close would, discard everything in memory, deserialize into a fresh session at the same field size, and assert that Undo is available and that each tap restores exactly the world state its counterpart restored in the first session — cell for cell in every visible property, plus every placed object.

**Acceptance Scenarios**:

1. **Given** a session in which she completed several actions and the world was saved, **When** the app is closed and reopened, **Then** her picture comes back as it does today **and** ↩️ is lit.
2. **Given** a reopened app with restored history, **When** she taps ↩️ once, **Then** the world goes back to exactly how it was immediately before her last action of the previous session, with 0 cells and 0 objects differing from what that undo would have restored before she left.
3. **Given** a reopened app with restored history, **When** she taps ↩️ repeatedly, **Then** each tap takes back one more of the previous session's actions, most recent first, until the surviving steps run out.
4. **Given** the surviving steps have all been used, **When** she looks at ↩️, **Then** it is dimmed exactly as it is when the in-session history empties, and tapping it does nothing at all.
5. **Given** a reopened app with restored history, **When** she draws something new, **Then** that action is recorded on top of the restored history as an ordinary action, and one ↩️ takes it back.
6. **Given** a reopened app, **When** she undoes past the point where she left off, **Then** nothing marks the seam — no pause, no message, no flicker, no change in how ↩️ behaves.

---

### User Story 2 - A big picture, a small budget (Priority: P2)

Her world is large and her last session was busy. Not all ten remembered steps can survive a close — there is not room. So the most recent handful come back and the older ones quietly do not. She taps ↩️ four or five times, gets back the mistakes that actually mattered, and then the button dims. She never sees a number, a warning, or a difference between "there were no more steps" and "the rest did not fit".

**Why this priority**: The size constraint is the hard part of this feature and the reason it needs a spec at all. Getting the degradation silent and newest-first is what keeps the feature from either failing loudly or eating the storage the world save depends on.

**Independent Test**: Serialize sessions at a range of play-field sizes with a full ten-step history, and assert that the persisted payload never exceeds the budget, that the steps kept are always the newest ones in order, and that the world save is byte-for-byte unaffected by how many history steps were kept.

**Acceptance Scenarios**:

1. **Given** a full ten-step undo history whose steps together exceed the budget, **When** the session is saved, **Then** only the newest steps that fit are persisted, in order, and nothing indicates that the rest were dropped.
2. **Given** a play field so large that not even one step fits the budget, **When** the app is reopened, **Then** the world is restored as it is today and ↩️ is simply dimmed — indistinguishable from today's behaviour.
3. **Given** a device whose storage refuses the write (quota exhausted, storage disabled, private mode), **When** the session is saved, **Then** the world save is still written and still valid, no history is persisted, and nothing is surfaced to her.
4. **Given** a stale history payload already in storage, **When** a later save cannot persist history, **Then** the stale payload is not left behind to be restored against a newer world.

---

### User Story 3 - Reopening in a different shape (Priority: P3)

She played in portrait, the tablet gets closed, and the next morning it is opened in landscape — or straight into fullscreen. Her picture carries across as it already does. The undo steps that still line up with the new field come with it; the ones that cannot survive the reshape do not, and she is never told which. ↩️ is bright if anything survived and dim if nothing did.

**Why this priority**: Reopening at a different field size is common on a tablet a child carries around, and it is the case where "restore the history" could quietly hand her a wrong-shaped or half-missing picture. It is a real journey, but the feature is already worth shipping for the same-shape case alone.

**Independent Test**: Serialize a session at one field size, deserialize into a fresh session at a different field size, and assert that every restored step is either exactly the re-anchored original (as a live re-derivation would produce) or absent — never a state with silently missing cells or objects, and never a state of the wrong shape.

**Acceptance Scenarios**:

1. **Given** a save made at one field size, **When** the app reopens at a different field size, **Then** the world is restored best-effort as it is today, and each persisted step is re-anchored to the new field the same way a live rotation re-anchors the live history.
2. **Given** a persisted step that cannot be re-anchored without losing cells or objects, **When** the app reopens, **Then** that step is dropped in silence and the steps that did survive keep their relative order.
3. **Given** that no persisted step survives the reshape, **When** she looks at ↩️, **Then** it is dimmed, and the world is still restored exactly as it is today.
4. **Given** a reopen at the same field size, **When** the history is restored, **Then** no re-anchoring happens at all and every persisted step comes back untouched.

---

### Edge Cases

- **Storage unavailable, full, or wiped between sessions** (a locked-down kids' browser clearing site data, private mode, quota exhausted): the world restores if it can and the history is simply empty. No dialog, no retry that she could notice, no difference from today beyond the dimmed button.
- **The history payload is corrupt, truncated, hand-edited, or from an older format version**: it is rejected whole and the history is empty. The world restore is unaffected — a broken history must never cost her the picture.
- **The world save is missing or rejected but a history payload exists**: the history is discarded too. Restoring last session's undo steps onto a fresh empty field would let one ↩️ conjure a picture she never drew in this session.
- **The history payload does not match the world save it is stored beside** (different recorded dimensions, different save version, written by a different session): the history is discarded, silently.
- **A step is dropped from the middle by the re-anchoring** (spec 010's amended FR-022 already permits this on rotation): the surviving steps keep their order and she simply has fewer of them; consecutive ↩️ taps walk the survivors in order.
- **Reopening and immediately drawing**: the new action pushes onto the restored history under the existing depth cap of 10, evicting the oldest restored step when the cap is reached — exactly as an eleventh action does today.
- **Closing and reopening repeatedly without drawing**: the persisted history is stable across a save-with-no-changes; reopening five times in a row leaves the same steps available, and does not accumulate, duplicate, or grow storage.
- **Closing mid-stroke** (the app is backgrounded with her finger down): the in-progress capture is not a completed action and is not persisted; what survives is the completed actions before it, matching how an interrupted stroke is already treated.
- **The app is killed without a chance to save** (a hard crash, a battery cut): whatever was last written is what comes back. This is already true of the world save and stays true of the history; nothing new is promised.
- **All edge cases from specs 001–010** continue to apply unchanged, and now apply with a restored history present as well.

## Requirements *(mandatory)*

This feature extends the existing toy specified in `001-falling-pink-sand` through `010-undo-redo`, plus the auto-save behaviour merged in PR #33. All requirements of those specs remain in force except where explicitly superseded in the **Superseded requirements** section below.

### Functional Requirements

**What survives a close**

- **FR-001**: When the app reopens and a saved world is restored, the undo history MUST be restored alongside it, so that ↩️ is lit whenever at least one persisted step survived, and dimmed otherwise.
- **FR-002**: A restored undo step MUST restore exactly what its in-memory counterpart would have restored in the previous session: every visible property of every cell (element, colour/shade, glitter, grass height, burning, fog/cloud/rain) and every placed object. Fidelity is neither greater nor lesser than spec 010's FR-028 — the same visible-fidelity contract, with the same in-flight countdowns restarting on restore.
- **FR-003**: There MUST be no session boundary in the undo experience: undoing past the reopen walks into the world as it was before she left, with no pause, no message, no marker, and no change in how ↩️ looks or behaves at the seam.
- **FR-004**: Once the surviving persisted steps have been used up, ↩️ MUST dim exactly as it does when an in-session history empties. She MUST NOT be able to tell "there were no more steps" from "the rest did not fit".
- **FR-005**: A new action recorded after a reopen MUST push onto the restored undo history under the existing cap of 10 (spec 010's FR-019), silently evicting the oldest restored step when the cap is reached.
- **FR-006**: A new action recorded after a reopen MUST clear the redo history exactly as it does today (spec 010's FR-017).
- **FR-007**: The redo history MUST be handled as follows on reopen: [NEEDS CLARIFICATION: should any budget left over after the undo steps be spent on persisting redo states (newest-first, so ↪️ can also survive a close), or is redo never persisted — ↪️ always dimmed on reopen — so that every byte of the budget buys an undo step? The issue's own suggestion is "if a choice is forced, persist undo only"; the budget does force a trade, since each persisted redo state costs an undo state.] Whichever is chosen, ↪️ MUST be lit if and only if at least one redo step was restored, and MUST behave in every other respect exactly as spec 010 specifies.

**How much survives — the size constraint**

- **FR-008**: The persisted history MUST be bounded by a **fixed serialized-size budget of approximately 2 MB**, not by a fixed step count, so that a larger play field degrades to fewer surviving steps rather than approaching the storage quota.
- **FR-009**: The budget MUST be filled **newest-first** from the undo stack, and the persisted steps MUST keep their relative order. The steps that survive a close are therefore always the most recent ones.
- **FR-010**: If not even one step fits the budget, zero steps MUST be persisted and the reopen MUST be indistinguishable from today's behaviour (world restored, both buttons dimmed).
- **FR-011**: The in-memory history depth MUST remain 10 in each direction (spec 010's FR-019 and FR-020), unchanged. This feature governs only how much survives a close.
- **FR-012**: The world save MUST take absolute priority over the history. The combined stored footprint MUST stay within the platform's per-origin storage allowance with margin, and if writing the history fails for any reason — quota, storage disabled, an oversized payload — the world save MUST still be written and still be valid, any stale history payload MUST be removed rather than left to be restored against a newer world, and nothing MUST be surfaced to her.

**When it is written**

- **FR-013**: The history MUST be written only at moments the world is already being saved, adding no new save triggers of its own. [NEEDS CLARIFICATION: does the history ride *every* auto-save (matching the world save exactly, so a crash loses nothing more than the world save does), or only the app-is-going-away flush moments (so the write cost — serializing several megabytes on a low-end tablet — is paid once per session rather than every couple of seconds during play)? The first is simpler and matches the world save; the second costs far less on the binding device and still covers every ordinary close.]
- **FR-014**: Persisting the history MUST do no per-frame work: nothing may be serialized, compared, copied, or measured except at a save moment.
- **FR-015**: Persisting the history MUST NOT cause a hitch she can see. The toy MUST stay smooth — target 60 frames per second, acceptable at or above 30 — on a mid-range laptop, an iPad, and a low-end tablet of the Amazon Fire 7 Kids class, while drawing stroke after stroke with a full history and a full play field, weather running and a lawn burning.

**Reopening into a different-shaped field**

- **FR-016**: When the field on reopen differs in cell dimensions from the one the history was captured at, each persisted step MUST be re-anchored to the new field exactly as spec 010's amended FR-022 re-anchors live history on a re-derivation: same anchoring, keep only the steps that survive losslessly, drop the rest in silence, preserve the relative order of the survivors. A step MUST NEVER be restored at the wrong shape or with cells or objects quietly missing.
- **FR-017**: The history MUST be restored only when the world restore itself succeeded **and** the history payload agrees with the world save it accompanies (same format version, same recorded field dimensions, same session lineage). Otherwise the history MUST be silently empty and the world restore MUST proceed unaffected.

**Silence, safety, and non-regression**

- **FR-018**: The persisted history MUST use a versioned wire format that rejects anything invalid — wrong version, truncated data, corrupt encoding, mismatched lengths, hand-edited garbage — returning an empty history rather than throwing, and never surfacing an error.
- **FR-019**: A history payload that fails for any reason MUST NOT prevent the world restore from succeeding: the two are stored and parsed independently, each guarded on its own, so no history failure can cost her the picture.
- **FR-020**: This feature MUST add no control, no message, no confirmation, no dialog, no sound, no setting, and no text of any kind. The only thing she can observe is whether ↩️ (and ↪️, per FR-007) is lit or dimmed on reopen.
- **FR-021**: Nothing she makes MUST leave the device. The persisted history is stored only on the device, exactly as the saved world is, and is never transmitted anywhere.
- **FR-022**: This feature MUST NOT add, remove, or change any element, simulation rule, scene, object behaviour, brush behaviour, toolbar control, or timing. A session in which the app is never closed MUST behave exactly as the current release.
- **FR-023**: Existing behaviour MUST NOT regress: every element, object, tool, scene, and control MUST behave exactly as the earlier specs require, the world save and restore MUST behave exactly as they do today, and all existing automated tests MUST pass — updated only where the superseded requirements below make an assertion obsolete, never weakened to hide a regression.
- **FR-024**: The production build MUST still emit exactly one self-contained page, fully playable when opened directly from disk with no network requests, and the page MUST NOT grow by more than 3 KB over the current release.
- **FR-025**: The behaviour MUST be verifiable without a browser. Serialization, deserialization, budget filling, version and consistency rejection, re-anchoring on a size change, and the restored history's effect on what ↩️ does MUST all be covered by automated tests that need no DOM and no browser harness.
- **FR-026**: The feature MUST behave identically on both maintained platforms — iPadOS Safari (standalone home-screen app) and Android/Fire Silk plus desktop Chrome — using the same storage mechanism as the world save, with no platform-specific control, code path, or capability probe. Where a platform's storage refuses or wipes the data, the fallback of FR-012 and FR-019 is the whole of the difference: the world restores if it can and the button is dim.

### Key Entities

- **Persisted undo history**: The tail of the previous session's undo stack, stored on the device beside the saved world. Holds an ordered list of world states, newest last, each with the same visible fidelity as an in-memory undo step, plus the field dimensions they were captured at and a format version.
- **History budget**: The maximum serialized size the persisted history may occupy (~2 MB). Decides how many steps survive a close; never decides how many steps the running app remembers.
- **Reopen restore**: The moment a saved world and its history are read back into a fresh session. Succeeds wholly, partly (world only), or not at all — and every outcome looks like an ordinary start to her.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After closing the app with at least 3 recorded actions and reopening it at the same field size, ↩️ is lit and each of at least 3 consecutive taps takes back exactly one more of the previous session's actions.
- **SC-002**: For each restored step, 0 cells differ in any visible property and 0 placed objects differ from what the same step restored in the session that recorded it.
- **SC-003**: A close-and-reopen introduces 0 messages, 0 dialogs, 0 confirmations, 0 new controls, and 0 sounds; the only observable difference from today is that ↩️ is lit rather than dimmed.
- **SC-004**: The persisted history never exceeds approximately 2 MB serialized, at every play-field size spec 006 allows, across at least 20 varied saved sessions.
- **SC-005**: When the budget forces steps to be dropped, the steps kept are the newest ones in order in 100% of cases, and 0 dropped steps produce a visible difference from an empty history.
- **SC-006**: With storage that refuses every write, the world save still succeeds in 100% of attempts, 0 history bytes are stored, 0 stale history payloads remain, and the toy behaves identically to today.
- **SC-007**: A corrupt, truncated, wrong-version, or mismatched history payload yields an empty history in 100% of cases, with the world still restored in 100% of cases where the world save itself is valid, and 0 errors reaching the frame loop.
- **SC-008**: Reopening at a different field size restores each persisted step either exactly as a live re-derivation would re-anchor it or not at all: 0 restored steps have missing cells, missing objects, or the wrong shape.
- **SC-009**: On a low-end tablet of the Amazon Fire 7 Kids class, playing normally with a full history in place, the toy renders at least 30 frames per second throughout, targeting 60, and no single frame during a save takes longer than 2 frames' budget.
- **SC-010**: History persistence costs 0 per-frame work: the measured per-frame simulation cost with a full persisted history is within 2% of the cost with none.
- **SC-011**: A session in which the app is never closed produces 100% passing existing acceptance scenarios and automated tests, with changes limited to the assertions made obsolete by the superseded requirements below.
- **SC-012**: The production build still produces exactly 1 output file, opening it directly from disk yields a fully playable toy with 0 network requests, and the page has grown by at most 3 KB.
- **SC-013**: The automated test suite runs to completion without a browser and covers every rule listed in FR-025.
- **SC-014**: Closing and reopening 5 times in a row without drawing leaves the same steps available every time, with 0 growth in stored size and 0 duplicated steps.

### Visual checks for the maintainer *(no automated coverage)*

- **On the Fire 7 Kids tablet (Charlie)**: close the app with a busy picture and several strokes behind it, reopen, and confirm ↩️ is bright, that a tap lifts the last stroke without a stall, and that ordinary play afterwards is as smooth as before. Confirm too that a save while playing does not produce a periodic hiccup — this is the device where the write cost bites.
- **On the iPad standalone home-screen app (Max)**: the same close-and-reopen, plus reopening after a rotation and after toggling fullscreen, and confirm the button state matches what came back and nothing flickers at the restore.
- **Both platforms**: after several days of ordinary use, confirm the world save has not started failing — the history must not have crowded it out of storage.
- The seam is invisible: an adult watching a child undo past the reopen cannot tell where the previous session ended.
- Dimmed ↩️ on reopen (nothing survived) reads as "not now", never as broken or missing.

## Assumptions

- **Working assumption for FR-007 (redo)**: unless the maintainer says otherwise, **redo is not persisted** — the budget is spent entirely on undo steps and ↪️ starts dimmed on reopen. This follows the issue's own tiebreak ("undo steps are worth more than redo steps") and keeps the most rescue value per stored byte. The spec is implementable as written under this assumption.
- **Working assumption for FR-013 (write cadence)**: unless the maintainer says otherwise, the history rides **every** save moment the world save already uses, matching the world save exactly. This is the issue's stated suggestion; the open question exists only because the write cost grows several-fold on the binding device, and the flush-only alternative would cover every ordinary close at a fraction of that cost.
- **Auto-save is the base being extended.** The world save merged in PR #33 — its storage key, its debounced-plus-flush save moments, its versioned format, its silent-failure contract — is taken as given and unchanged. This feature adds a sibling payload; it does not redesign the world save.
- **The persisted history has exactly the fidelity of the in-memory history**, no more. What spec 010's FR-028 excludes from a capture (in-flight countdowns, transient sparkle decoration) is equally absent here, and pets are not part of a history step today and do not become part of one here.
- **Storage-size arithmetic is approximate and platform-dependent.** The ~286 KB world save and ~2 MB budget come from the maintainer's measurement on the real device. Some browsers account for stored strings at two bytes per character, so the same payload can consume roughly twice its character count of the ~5 MB quota; the budget should therefore be sized conservatively and, per FR-012, correctness must never depend on the arithmetic being right — a refused write degrades silently.
- **A restored history is not proof the world is unchanged.** She may have closed the app, the storage may have been partly wiped, or a save may have landed between the two payloads; FR-017's consistency check is what makes a restored step trustworthy, and discarding is always the safe answer.
- **Undo past the reopen is desirable, not a bug.** Walking into the pre-close world is the feature. No boundary is recorded and none is enforced.
- **Target devices** are the Amazon Fire 7 Kids-class tablet and desktop Chrome (Charlie's column) and the iPad standalone home-screen app (Max's column), per `CLAUDE.md`. The Fire 7 remains the binding performance and storage constraint; the iPad is the platform whose storage accounting is least predictable.
- **Verification without a browser**: serialization, budget filling, rejection, re-anchoring, and the restored history's effect on undo are all pure functions of world state and stored bytes, so they are fully unit-testable. The feel checks — the seam being invisible, the save not hitching — are the maintainers' job on their own devices, consistent with the project's no-browser-harness principle.

### Constitution alignment

- **Persistence** ("her world saves locally and only locally, restoring on the next launch") is extended by this feature from the world to the history of that world. Nothing new leaves the device (FR-021).
- **No failure states, no error surfaces**: every failure path in this feature degrades to today's behaviour in silence (FR-010, FR-012, FR-018, FR-019).
- **One self-contained page** and **performance is a feature** are preserved by FR-024, FR-014, and FR-015.
- **History survives re-derivation** (the constitution's 2026-08-29 product constraint) is not weakened: FR-016 reuses exactly those semantics for the reopen case. This spec does not amend the constitution; if the maintainers want "history survives a close" recorded as a standing constraint alongside it, that is a separate constitution PR.

## Superseded requirements

- Spec 010's **FR-021** ("History MUST NOT be persisted. On page load both histories are empty and both buttons are dimmed") is **superseded** by FR-001 and FR-007 of this spec. It was written when nothing in the toy persisted at all — the issue behind spec 010 said "no persistence needed" at a time when a reload lost the picture too. Now that the world itself survives a close, an empty history is an inconsistency rather than a simplification.
- The persistence clause of spec 010's **FR-025** ("MUST NOT introduce any … persistence …") is **superseded** to the extent that this feature persists history; every other clause of FR-025 — no failure state, no message, no confirmation, no score, no way for the child to be wrong, no sound, no control beyond the two buttons — remains in force and is restated here as FR-020.
- Spec 010's **"Reload: nothing is persisted; the field opens empty and both buttons are dim"** edge case is superseded by this spec's User Story 1 and its edge cases.
- The phase-6 "History starts empty after a restore — the restored world is the new baseline" behaviour introduced with auto-save is **superseded** by FR-001: the restored world is no longer a baseline, it is a continuation.
- Spec 010's **FR-019**, **FR-020**, **FR-022** (as amended 2026-08-29), and **FR-028** are **not** superseded and are relied on directly: in-memory depth stays 10 in each direction (FR-011), re-anchoring semantics are reused verbatim (FR-016), and capture fidelity is unchanged (FR-002).
- *Observation, not a change*: spec 010's **SC-020** still asserts the pre-amendment discard-on-re-derivation behaviour and was left stale by that spec's 2026-08-29 amendment. This spec neither revives nor repairs it; flagging it here so it is not mistaken for a requirement this feature must satisfy.
