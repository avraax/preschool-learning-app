# PRD — Alfabetsangen (sing-along in Lær Alfabetet)

**Authored** 2026-08-01 · **Status:** NOT implemented — owner must supply the audio asset first (§2).
**Scope:** one button in Lær Alfabetet (`/alphabet/learn`). No new route, no new screen.

## Context

Lær Alfabetet is a calm browse: tap a letter, hear `"{bogstav} som {ord}"`, see it bloom. It teaches
letters one at a time, in isolation.

What it can't do is give the child the thing he already half-knows — **the alphabet song**. He has heard
it sung in kindergarten and at home many times. That existing familiarity is the asset: a song he
recognises turns 29 separate facts into one ordered sequence he can already partly recall, and it's the
one piece of alphabet learning the app currently outsources to real life.

This adds a **"Syng alfabetet" button** under the bloom that plays a real sung recording of the Danish
alphabet while the grid highlights each letter in time with the singing.

**The honest constraint that shapes everything below: Azure AI Speech cannot sing.** Neural TTS voices
speak; no amount of SSML prosody produces a melody. So this feature cannot come from the existing audio
stack — it needs a real sung recording shipped as a static MP3 asset, plus a fourth audio channel to
play it. Everything else is wiring.

---

## 1. The song — locked decisions

### Lyric: 29 letters, W included

| Decision | Value |
|---|---|
| Letters | **All 29, W included** |
| Closing line | `niogtyve skal der stå` |
| Length | ~25–35 s |
| Verse | Alphabet + closing line only — **no** second "Hvis man ka' sin abc…" verse |

**Why this matters, and why it is not the version he knows.** The traditional Danish ABC-sangen ends
`v x y z æ ø å — otteogtyve skal der stå` (28) and **omits W entirely**, because "dob-belt-ve" doesn't
fit the melody's rhythm. That is almost certainly the version sung in kindergarten. But this app teaches
**29**: W is in the grid, has a baked Wienerbrød picture, and Bogstav Quiz asks it. Shipping the 28-letter
song would have the app contradict itself, so the owner chose correctness over exact familiarity. The
**melody, tempo and tone carry the recognition** (see §2.1 — they are non-negotiable); the letter count is
the single deliberate deviation.

### Melody: Rameau — public domain

Credited to **Jean-Philippe Rameau (d. 1764)**, the same tune as *Ah! vous dirai-je, Maman* / *Twinkle
Twinkle Little Star*. Long out of copyright, so a **fresh recording infringes nothing**. The traditional
Danish lyric's author is recorded as "unknown"; we sing only the letters plus one short traditional
counting line, which carries minimal risk. Do not add the second verse.

### Line structure — the one real arrangement risk

Twinkle's phrases are 7 notes each. `V W X Y Z Æ Ø Å` is **8** letter-sounds, and W ("dobbelt-ve") is
three syllables — this is exactly why the traditional song dropped it. Two candidate splits:

```
Option A (cram)                     Option B (extra phrase) ← RECOMMENDED
1. A B C D E F G                    1. A B C D E F G
2. H I J K L M N                    2. H I J K L M N
3. O P Q R S T U                    3. O P Q R S T U
4. og der kommer fler' endnu        4. og der kommer fler' endnu
5. V W X Y Z Æ Ø Å   ← 8 in 7       5. V W X Y Z
6. niogtyve skal der stå            6. Æ Ø Å, niogtyve skal der stå
```

**Use Option B.** It removes the cramming problem entirely, and Twinkle's structure tolerates a repeated
phrase — many Danish children's recordings already repeat. Option A is the fallback only if B sounds
padded. Verify by ear either way; this is the line most likely to come back wrong.

---

## 2. Production — AI generation, with a hard acceptance gate

The owner chose AI music generation over recording it himself. Recorded reservation: AI generators
*invent* melodies and arrangements, and this feature needs an exact tune **and** an exact delivery.
**Partial mitigation:** the melody is *Twinkle Twinkle Little Star* — ubiquitous enough that Suno v5 /
ElevenLabs Music reproduce it reliably **when named explicitly in the prompt**, so raw melody drift is a
smaller risk than for an obscure tune. The two risks that remain, in order of likelihood:

1. **Tempo and tone drifting from how it's actually sung** (§2.1) — these tools add production polish by
   default, and polish is what destroys recognition.
2. **Danish letter-name pronunciation** — the same failure modes that already shipped twice in this app's
   spoken narration.

Both are caught by the gate in §2.3, which is written to be failed rather than argued with.

**Tooling:** ElevenLabs Music (licensed training data, cleanest commercial position) or Suno v5 Pro
(full commercial rights on paid tiers). Generate **several takes** and pick by ear.

### 2.1 Musical fidelity — the "official way" requirement

**This is the feature's whole point and it outranks convenience.** The song only works if it is the song
he has already been sung — in kindergarten, at home. Same melody is necessary but *not sufficient*:
**tone and tempo must match the customary way it is sung.** A technically-correct take at the wrong speed,
or with a stylised arrangement, is a *different* song to a 5-year-old and the recognition — the entire
reason for building this — is lost.

**Work reference-first, not prompt-first.** Pick ONE canonical reference recording, then match it:

| Role | Recording |
|---|---|
| **Primary reference** | [ABC-sangen — Syng med Sigurd (Sigurd Barrett)](https://www.youtube.com/watch?v=oHQwUsVyxAw) — Barrett is Denmark's canonical children's-music figure (DR); a piano-led, unhurried sing-along is as close to "the official way" as exists |
| Cross-check | [ABC-sangen — Danske børnesange](https://www.youtube.com/watch?v=-D7_q81aWys) · [ABC sang — dansk alfabet](https://www.youtube.com/watch?v=ckjfSnCTFgA) |
| **Anti-reference — do NOT sound like this** | [Popsi og Krelle's "funky version"](https://www.youtube.com/watch?v=4WIxpjeeBSo) — same letters, restyled; the exact failure mode to avoid |

**Method:** measure the reference's tempo (BPM) and note its feel, then hold the take to it.

| Attribute | Requirement |
|---|---|
| Tempo | **Match the reference's BPM** (measure it; don't guess). Unhurried — roughly one letter per beat, with room to hear each name. Deviation should be inaudible in an A/B. |
| Metre | Straight 4/4, major key, no rubato, no ritardando, no key change |
| Voice | One warm adult voice (or adult leading children), plain and un-stylised — no vibrato showcase, no runs, no ad-libs, no harmonies |
| Accompaniment | Sparse and acoustic — soft piano or music box. **No drum kit, no bass groove, no synth pad, no reverb wash** |
| Register | Comfortable for a 5-year-old to sing along with; nothing high or belted |
| Character | A sing-along a parent could join, not a performance |

### 2.2 Generation brief (adapt per tool)

> A gentle Danish children's sing-along of the alphabet, sung in **Danish (da-DK)** by one warm adult
> voice, to the melody of *Twinkle Twinkle Little Star* / *Ah! vous dirai-je, Maman*. Traditional
> kindergarten sing-along style: **unhurried, straight 4/4, major key**, sparse soft-piano accompaniment,
> **no drums, no bass, no synths, no reverb**, no vocal ad-libs or harmonies. Plain and warm, the way a
> parent sings it — not a produced pop or funk arrangement. Every letter sung as its **Danish letter
> name**, clearly separated, one letter per beat. Lyrics exactly:
> `A B C D E F G / H I J K L M N / O P Q R S T U / og der kommer fler' endnu / V W X Y Z / Æ Ø Å,
> niogtyve skal der stå`

### 2.3 Acceptance gate — do not ship a take that fails any of these

0. **Blind A/B against the primary reference.** Play the Sigurd Barrett recording, then the take. A Danish
   parent must hear *the same song sung the same way* — not a cover, not a remix, not a different tempo.
   **This is the gate most likely to fail and the one that matters most.** If the take is recognisably
   faster, slower, or more produced than the reference, reject it however good it sounds on its own.
   **Judge tempo, tone, arrangement and melody — not the letter count.** The reference will almost
   certainly sing the traditional 28 (no W) and end on `otteogtyve`, so the take is *supposed* to diverge
   at exactly that point. W and the closing count are the one sanctioned deviation (§1); everything else
   must be indistinguishable.
1. **All 29 letters present, in order**, W included.
2. **Every letter name is the Danish one.** Check the ones this codebase has already been bitten by:
   **I** (must be the letter name with stød, not the preposition), **Z** (`zet`, not English "zee"),
   **W** (`dobbelt-ve`), **X** (`eks`), **Y**, **Q** (`ku`), **J**, **Æ Ø Å**. See
   `.claude/rules/audio-system.md` § *Pronunciation fixes (da-DK)* — the same failure modes apply to a
   singer, and this app already shipped two of them.
3. **Melody is recognisably Twinkle**, not an invented tune.
4. **Letters are individually distinguishable** — the karaoke timing map depends on it.
5. Ends on `niogtyve skal der stå`.
6. Clean audio: no clipping, no vocal artefacts, ≤35 s.
7. **Tone and tempo match §2.1** — sparse acoustic accompaniment, plain un-stylised voice, no drums or
   groove, sing-along rather than performance.

**Expect this to need the fallback.** Adding "must match the customary tempo and tone" on top of "must
pronounce 29 Danish letter names correctly" is a demanding brief for a text-to-music model: these tools
are built to produce *appealing* music, and their default instinct is to add production polish — a beat, a
groove, a fuller arrangement — which is precisely what breaks recognition. Generating many takes and
tightening the prompt is worth trying, but **if a handful of rounds doesn't clear gate 0, stop and record a
human** (owner/family singing it, or a hired native Danish singer briefed with the reference recording and
§2.1). A human singing along to the reference clears gates 0, 2 and 7 essentially for free, which is why
this was the original recommendation and why it remains the documented fallback. Never ship a take that
mispronounces a letter or sounds like a different song — this app exists to teach the alphabet, and either
failure teaches the wrong thing.

### 2.4 Asset delivery

| Item | Value |
|---|---|
| Format | **MP3** — mandatory, non-negotiable |
| Path | `public/sounds/song/alfabetsangen-v1.mp3` |
| Encoding | mono, ~48–64 kbps (matches the TTS clips), target < 400 KB |
| Re-encode with | `scripts/transcode-sfx.mjs` (ffmpeg-static already a devDependency) |

**MP3 is a hard requirement, not a preference.** The compatibility floor is iOS/iPadOS 17 (the owner's
oldest iPad caps at 17.7), which cannot decode Ogg — shipping Ogg once silenced *all* audio on that
device. Guarded by `src/services/audioFormat.test.ts`.

**Filename is versioned (`-v1`)** because `vercel.json` caches `/sounds/(.*)` for 1 day; bump the suffix
to force a fresh fetch when the recording is replaced. Do **not** add it under `/sounds/tts/`, which is
`immutable` and reserved for prebaked narration.

---

## 3. Implementation

### 3.1 A fourth audio channel — `songClient`

The app has three channels and the song fits none of them:

| Channel | Why not |
|---|---|
| `SimplifiedAudioController` (TTS) | Single-audio, no queue — any narration would kill the song mid-verse. It is also the thing the song must silence. |
| `sfx` (Howler short cues) | Cues play in full and must stay short; PRD-07 explicitly trimmed multi-second clips out of it. |
| `musicClient` | A **looping, world-keyed, menu-only** ambient bed that fades out on game routes — which is exactly where this button lives. |

**Add `src/services/songClient.ts`** — a small singleton, modelled on `musicClient`'s proven patterns
(HTML5 audio playback, `pagehide`/`visibilitychange` teardown, iOS gesture handling) but far simpler: one
track, no loop, no crossfade, no world map.

```
songClient.play(src)      // starts playback; resolves/emits on end
songClient.stop()         // hard stop, resets to 0
songClient.isPlaying      // for the button's playing state
songClient.currentTime    // read by the karaoke driver
```

**iOS gesture rule — the trap that has already cost this codebase real debugging time:** iOS consumes
the transient user activation across an `await`. `play()` **must** be called synchronously inside the tap
handler, before any `await`. Preload the element (`preload="auto"`) when the button mounts so `play()`
has data ready. See `.claude/rules/audio-system.md` for the full iOS section.

### 3.2 Karaoke highlight — the timing map

**Reuse what exists; write almost nothing.** `LearningGrid` already passes `hint={index === currentIndex}`
into `TactileTile`, which renders a reduced-motion-aware accent ring. Driving `currentIndex` from the
song's playback position *is* the karaoke effect — no new highlight UI at all.

- Add `SONG_CUES: { letter: string; tMs: number }[]` — **29 hand-authored timestamps**.
- Drive with a **`requestAnimationFrame` loop** reading `songClient.currentTime`, not `timeupdate`
  (which fires ~4×/s — too coarse when letters are ~1 s apart). Cancel the loop on stop/unmount.
- **Sequencing constraint:** timings are specific to the chosen recording, so the map can only be
  authored **after** the audio is final. If the recording is ever replaced, the map must be re-tuned.

### 3.3 The button

`PromptFocus` already has a `repeat` slot rendered as a floating pill beneath the subject — the quizzes
put "Hør igen" there and **Lær Alfabetet currently leaves it empty**. Drop the song button in with no
layout work.

- Build on **`TactilePill`** (the shared soft-3D pill `RepeatButton` itself uses), label
  **"Syng alfabetet"**, switching to a stop affordance while playing.
- **Icon: a `lucide-react` icon (e.g. `Music`), never `♫` or a music emoji.** `src/config/noEmoji.test.ts`
  fails the build on any `Extended_Pictographic` glyph in `src/**`; U+266B trips it. Precedent for lucide
  on a child-facing surface: `RepeatButton`'s `Volume2`, and the Lyt og Find listen hero.
- Fire `sfx.play('tap')` on press ("every tap is felt").

### 3.4 Behaviour during playback

| Concern | Decision |
|---|---|
| Bloom | **Follows the song** — glyph + baked picture + word advance with each sung letter, via the existing `currentIndex` → `PromptFocus` path. `CHARGE` is 0.25 s, so a ~1 s cadence is comfortable. |
| Tap on a letter | **Stops the song, then speaks that letter normally.** Matches the app's "new audio cancels current" feel; a tap must never be dead (the PRD-14 W7 lesson). |
| Starting the song | Call the controller's stop/cancel first so narration can't play under it. |
| Leaving the screen | `songClient.stop()` on unmount — nothing may sing over the next screen. |
| Reduced motion | Song plays normally; the ring is static rather than breathing (already handled inside `TactileTile`). |
| `musicEnabled = false` | **Button hidden/disabled** — the song obeys the adult music toggle. Read `progressStore.get().settings.musicEnabled` (the same source `musicClient` watches). |
| Replay / re-press | Pressing while playing **stops**; pressing again restarts from 0. |

### 3.5 Explicit non-goals

- **Not a prebaked TTS clip.** Do **not** add it to `shared-narration-clips.js`, the prebake manifest, or
  the `/audit` set — those enumerate *spoken* closed-set narration. `npm run tts:prebake` would prune it.
- **No XP.** Browse XP is deliberately once-ever per letter and anti-farm gated in the store. A 30 s song
  sweeping all 29 letters would mint the section's entire browse XP in one tap and make tapping the grid
  pointless. The song must **not** call `awardBrowseXp` or `markBrowsed`.
- **No offline guarantee.** The app is network-only with no service worker; a cold launch without network
  already fails at the document fetch. Don't design around caching the song.
- **No new route or menu tile.** The button lives inside Lær Alfabetet only.
- **No lowercase letters, no new art.** Out of scope.

### 3.6 Files

| File | Change |
|---|---|
| `src/services/songClient.ts` | **New** — the one-track audio channel |
| `src/config/alphabetSong.ts` | **New** — asset path, lyric reference, `SONG_CUES` timing map |
| `src/components/alphabet/AlphabetLearning.tsx` | Song button in `PromptFocus`'s `repeat` slot; rAF driver setting `currentIndex`; stop-on-tap; stop-on-unmount |
| `public/sounds/song/alfabetsangen-v1.mp3` | **New** — owner-supplied asset |
| `src/services/songClient.test.ts` | **New** — cue-map invariants (see §4) |
| `.claude/rules/audio-system.md` | Add the fourth channel + "TTS cannot sing" to the architecture section |
| `.claude/rules/games-catalog.md` | One line on the Lær Alfabetet sing-along |

---

## 4. Verification

**Automated** (`npm test`, `node --test`):
1. `SONG_CUES` covers **all 29 letters, exactly once, in `DANISH_ALPHABET` order** with
   **strictly increasing** `tMs` — catches a hand-authored map that skips or transposes a letter.
2. The cue letters match the `LETTER_WORDS` / grid letter set (no drift if the manifest changes).
3. The asset path ends in `.mp3` — extend or mirror `src/services/audioFormat.test.ts`'s reasoning.
4. `npm test` (full suite), `npm run lint`, `npm run build` all clean — the build **must** be run, since
   `noEmoji.test.ts` is what catches an icon glyph slipping into the button.

**Re-break to prove the tests bite** (project convention — it caught a vacuous test in the session that
authored this PRD): drop one letter from `SONG_CUES` and swap two timestamps; the suite must fail on each,
with a message naming the letter. A drift test that compares two things which move together passes
vacuously.

**Manual, on device:**
5. `npm run dev` + `npm run dev:api` (both in **Windows PowerShell**, not WSL — WSL makes every `/api`
   call 502). Open `/alphabet/learn`.
6. Press "Syng alfabetet": audio starts, ring travels A→Å **in time with the singing**, bloom follows.
   Verify sync at the start, middle and end — drift accumulates.
7. Tap a letter mid-song: song stops immediately, tapped letter speaks, button returns to idle. **Never
   two voices at once.**
8. Press Back mid-song: nothing sings over the menu.
9. Turn music off in "Til de voksne": the button is gone/disabled. Turn it on: it returns.
10. `prefers-reduced-motion`: song plays, ring static, no flicker.
11. **iPad (iOS 17.7 floor)** — the whole point of MP3. First press must produce sound with no prior
    interaction on the page, and again after backgrounding/returning.
12. Phone landscape (844×390) and portrait: the pill doesn't overflow the focal band; use the
    `ui-screenshot` skill and re-capture `docs/ui-reference/**/alphabet-learn.jpg` (already stale — it
    predates the current PromptFocus/baked-art bloom).

**Owner sign-off gate:** the recording passes **all eight** acceptance criteria in §2.3 — gate 0 (the blind
A/B against the reference) included — before any of the wiring is considered done. A take that fails gate 0
is not a "good enough for now" asset: it silently removes the feature's reason to exist.

---

## 5. Suggested order

1. **Owner:** listen to the §2.1 primary reference and measure its BPM first, *then* generate takes against
   it; run the §2.3 gate (starting with the blind A/B) and switch to a human singer if a few rounds don't
   clear it. Drop the approved MP3 in place.
2. Build `songClient` + the button + stop/unmount behaviour (works with no timing map — the song simply
   plays).
3. Author `SONG_CUES` against the final recording; add the rAF driver and bloom-follow.
4. Tests, re-break, guardrail updates, device pass.

Steps 2 and 3 are separable: the button can ship and be verified before the karaoke sync exists.
