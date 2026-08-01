# PRD — Hør alfabetet (autoplay A→Å in Lær Alfabetet)

**Authored** 2026-08-01 · **Status:** NOT implemented · **Supersedes** `tmp-prd-alfabetsangen.md` (deleted)
**Scope:** one button in Lær Alfabetet (`/alphabet/learn`). No new route, no new screen, no new audio.

## Context

Lær Alfabetet teaches letters one tap at a time, in isolation. What it can't do is give the child **the
alphabet as a sequence** — A to Å in order, at a pace he can follow and say along with. That ordering is
its own piece of knowledge, and the app currently leaves it entirely to kindergarten and to his parents.

This adds a **"Hør alfabetet" button** under the bloom. Press it and the app speaks the letter names from
A to Å at a steady tempo, grouped the way the alphabet is actually recited, with the grid highlight and
the bloom travelling in step.

**Why this replaced a sung version.** The first plan was a real sung Alfabetsangen recording. Azure TTS
cannot sing, so that needed an audio asset from outside the app: AI music generation (which invents
melodies and mispronounces Danish letter names) or a licensed recording (no reusable Danish ABC recording
exists — the melody is public domain, but every recording of it is owned). Owner decision: drop the
singing. **Speaking the letters in order delivers the actual learning goal — the sequence — with no audio
asset, no licence, and no third party involved.** The song PRD is deleted; git history keeps it if it is
ever revisited.

---

## 1. Locked decisions

| Decision | Value |
|---|---|
| What is spoken | **The letter name only** — `audio.speakLetter(letter)`, exactly what a memory card or a spelling tile already says. No "som {ord}" line. |
| Tempo | **~700 ms of silence between letters** → ~38 s for the full run |
| Phrasing | **Grouped, with a longer breath between groups**: `A–G · H–N · O–U · V–Z · Æ Ø Å` |
| Group pause | **~1.4 s** (about double the letter gap) |
| Button label | **"Hør alfabetet"** — consistent with the quizzes' "Hør igen" |
| Highlight | Grid ring **and** the bloom follow, advancing *just before* each letter is spoken |
| Tap a letter mid-run | **Stops the run**, then speaks that letter normally |
| Press the button mid-run | **Stops.** Pressing again restarts from A |
| End of run | Stops at Å, button returns to idle. No loop, no celebration |

The five groups are `7 + 7 + 7 + 5 + 3 = 29` — both how the alphabet is recited and the phrasing the song
uses.

**Not gated on the music toggle.** This is **narration, not music**, so `musicEnabled` does not apply (an
earlier draft said it would, back when it was a song). There is no "narration off" setting, so the button
is always available.

---

## 2. Why this is nearly free to build

Three things already exist and do most of the work:

1. **Every letter name is already a prebaked, signed-off clip.** `speakLetter` → `getDanishLetterName` →
   `DANISH_LETTER_NAMES` (`src/config/danish-phrases.ts`), all 29 enumerated in
   `shared-narration-clips.js`, prebaked to MP3 and approved in `docs/audit/`. Verified 2026-08-01: all 29
   present in the manifest, all 29 `verdict: ok`. **No new audio, no `tts:prebake` run, no `/audit` pass.**
2. **The sequencer pattern already ships.** `runSpellingSequence` in
   `src/components/ordleg/SpeakWordGame.tsx` (~line 519) is this exact loop: advance a visual counter,
   `await audio.speakLetter(…)`, `await wait(gap)`, bail if unmounted. `SpellingGame` does the same per
   letter. Copy that shape; do not invent a new mechanism.
   **It is also the iOS feasibility proof** — those games already speak many letters in sequence from one
   tap, so playback continuing across `await`s outside the original gesture is known to work on the floor
   device.
3. **The highlight needs no new UI.** `LearningGrid` already passes `hint={index === currentIndex}` into
   `TactileTile`'s reduced-motion-aware accent ring, and `PromptFocus` already blooms
   `DANISH_ALPHABET[currentIndex]`. Driving `currentIndex` *is* the whole visual effect.

Compared with the song plan this drops: the MP3 asset, a fourth audio channel (`songClient`), the
hand-authored 29-timestamp map, the rAF driver, all licensing, and the entire production/acceptance gate.

---

## 3. Implementation

### 3.1 The sequencer

Add to `AlphabetLearning.tsx`, modelled on `runSpellingSequence`:

```
for each group in ALPHABET_GROUPS:
  for each letter in group:
    if aborted -> return
    setCurrentIndex(indexOf(letter))     // highlight leads the sound
    await audio.speakLetter(letter)
    await wait(LETTER_GAP_MS)
  await wait(GROUP_GAP_MS - LETTER_GAP_MS)
```

**Cancellation needs a run token, not just `mountedRef`.** The precedent only guards unmount, but this run
must also abort when the child taps a letter or re-presses the button. Use an incrementing `runIdRef`:
capture it at the start, and after **every** `await` bail if `runIdRef.current` has moved on. `mountedRef`
stays as the unmount guard.

Because `SimplifiedAudioController` has **no queue** — new audio cancels current — a tap during the run
already silences the in-flight letter; the run token is what stops the *loop* from carrying on and talking
over it.

Keep `LETTER_GAP_MS`, `GROUP_GAP_MS` and `ALPHABET_GROUPS` together as the tuning levers — tempo is the
thing most likely to need adjusting after a real play-test.

### 3.2 The button

`PromptFocus` has a `repeat` slot rendered as a floating pill under the subject — the quizzes put "Hør
igen" there and **Lær Alfabetet leaves it empty today**. Drop the button in; no layout work.

- Build on **`TactilePill`** (what `RepeatButton` itself uses), label **"Hør alfabetet"**, swapping to a
  stop affordance while running.
- **Icon: `lucide-react` only** (e.g. `Play` / `Square`, or `Volume2` to match `RepeatButton`). **Never an
  emoji or a dingbat** — `src/config/noEmoji.test.ts` fails the build on any pictographic glyph in
  `src/**`. Precedent for lucide on a child-facing surface: `RepeatButton`, and Lyt og Find's listen hero.
- `sfx.play('tap')` on press ("every tap is felt").
- Set the existing `hasInteractedRef` on press so a late welcome can't talk over the run.

### 3.3 Existing behaviour to preserve

- `goToLetter` (the tap handler) must **abort the run first** (bump `runIdRef`), then behave exactly as it
  does today — including `awardBrowseXp`, which stays tap-only.
- Stop the run on unmount; nothing may keep speaking over the next screen.
- Reduced motion: unchanged — audio plays normally, the ring is static rather than breathing (already
  handled inside `TactileTile`).

### 3.4 A useful side effect — treat the first run as an audit

This is the **first time all 29 letter names play back-to-back**, which makes a wrong one obvious in a way
no test can be. Two known-suspect entries in `DANISH_LETTER_NAMES` to listen for:

- **`Z: 'zæt'`** — the 2026-08-01 session established that `zet` is what sounds right *inside a sentence*,
  but the standalone name was never re-checked, so the map may still be wrong.
- **`X: 'eks'`** — the other hand-written respelling; the other 27 are bare glyphs.

Note also that 191 clips were **bulk-approved without a listen pass** on 2026-08-01, so an `ok` verdict is
not proof any more. If a letter sounds wrong here, don't trust the manifest: fix `DANISH_LETTER_NAMES`,
re-run `npm run tts:prebake`, and re-mark it in `/audit`.

### 3.5 Non-goals

- **No new audio asset**, no `songClient`, no MP3, no licensing — all dropped with the song approach.
- **No XP.** Browse XP is deliberately once-ever per letter and anti-farm gated in the store; a 38 s run
  touching all 29 would mint the section's whole browse allowance in one press and make tapping the grid
  pointless. The run must **not** call `awardBrowseXp` / `markBrowsed`.
- **No prebake or audit work** — every clip it plays already ships and is signed off.
- **No new route, no menu tile, no singing, no lowercase letters, no new art.**
- **No pause/resume, no adult-facing speed control.** One fixed tempo, tuned in code.

### 3.6 Files

| File | Change |
|---|---|
| `src/components/alphabet/AlphabetLearning.tsx` | The sequencer, the run token, the button in `PromptFocus`'s `repeat` slot, abort-on-tap, abort-on-unmount |
| `src/config/alphabetGroups.ts` | **New** — `ALPHABET_GROUPS` + the two tempo constants, exported so a test can assert coverage |
| `src/config/alphabetGroups.test.ts` | **New** — grouping invariants (§4) |
| `tmp-prd-alfabetsangen.md` | **Delete** — superseded |
| `.claude/rules/games-catalog.md` | One line on the Lær Alfabetet autoplay |

`.claude/rules/audio-system.md` needs **no** change — this uses the existing TTS channel exactly as
documented, which is the point.

---

## 4. Verification

**Automated:**
1. `ALPHABET_GROUPS` flattened equals `DANISH_ALPHABET` — **all 29 letters, exactly once, in order**. This
   is the one thing that can silently break (a letter dropped from a group, a group out of order) and it
   is invisible without a test.
2. Every letter resolves to a non-empty `getDanishLetterName`, and each name is in the prebaked manifest —
   proving the run never falls back to live Azure mid-sequence.
3. `npm test`, `npm run lint`, `npm run build` clean. The build matters: `noEmoji.test.ts` is what catches
   an emoji slipping into the button.

**Re-break to prove the tests bite** (project convention — a vacuous test slipped through on 2026-08-01):
remove one letter from a group, and separately swap two groups; the suite must fail on each, naming the
letter.

**Manual:**
4. `npm run dev` + `npm run dev:api`, both in **Windows PowerShell** (WSL makes every `/api` call 502).
5. Press "Hør alfabetet": all 29 letters, A→Å, in order, ring and bloom in step. Listen for the group
   breaths and confirm the tempo feels right — this is the main tuning pass.
6. **Listen to every letter name** (§3.4), Z and X especially.
7. Tap a letter mid-run → run stops immediately, tapped letter speaks, button returns to idle. **Never two
   voices at once, and the run must not resume.**
8. Press the button mid-run → stops. Press again → restarts from A.
9. Press Back mid-run → nothing speaks over the menu.
10. Let it finish → stops cleanly on Å, no loop.
11. Rapid-fire: press, tap, press, tap. No overlap, no stuck ring, no orphaned run.
12. **iPad (iOS 17.7 floor)**: the run continues past the first letter, and survives backgrounding.
13. Phone landscape (844×390) and portrait: the pill fits the focal band. Re-capture
    `docs/ui-reference/**/alphabet-learn.jpg` with the `ui-screenshot` skill — it is already stale.

---

## 5. Suggested order

1. `ALPHABET_GROUPS` + tempo constants + the grouping test.
2. The sequencer and the run token, wired to a temporary always-visible button.
3. The `TactilePill` button with its playing/stopped states.
4. Abort-on-tap, abort-on-unmount, the rapid-fire pass.
5. Tempo tuning by ear, then the letter-name listen (§3.4).
6. Delete the song PRD, update `games-catalog.md`, re-capture screenshots.

Nothing here is blocked on an external deliverable — unlike the song version, this is buildable and
verifiable end-to-end in one sitting.
