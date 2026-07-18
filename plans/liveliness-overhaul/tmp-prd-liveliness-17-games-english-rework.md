# Liveliness PRD-17 — English (Engelsk) games rework (per-game UX + learning)

**Date:** 2026-07-17
**Part of:** Games UX & Learning rework (findings: `tmp-prd-liveliness-13-games-ux-audit.md` §D; shared keystone:
`-14`; pattern: `-15`/`-16`).
**Depends on:** **PRD-14 merged** (esp. **W7 `previewBeforeCommit`** — the hear-before-commit engine flag, already
enabled for `english.word` + `english.translate`). Build on it.
**Owner:** Allan. **Target user:** ~5-year-old DANISH boy, iPad, pre-reader (cannot read Danish **or** English);
English is a beginner L2. UI Danish; English words spoken by en-US Ava. No adaptivity. 44px targets.
**Art:** **none needed** — config/logic (game differentiation), audio-state wiring (playback indicator), and layout
(chip navigator). **Zero Gemini.**

> Third grouped per-game rework (audit §I). English section = Lyt og Find, Find det Engelske Ord, Dansk til Engelsk,
> Lær Engelsk. **Learning first.** The audit's headline finding: the two "tap the English word" games are
> **near-duplicates** for a non-reader, and PRD-14's W7 (audition tiles) — while it made them *playable* — made them
> even *more* alike. W1 fixes that. Lyt og Find + Lær Engelsk are pedagogically sound and need only UX polish.

---

## 1. Scope (3 workstreams)

| WS | Game(s) | Change | Priority |
|---|---|---|---|
| **W1** | **Find det Engelske Ord** + **Dansk til Engelsk** | **Differentiate the two into distinct skills** + confirm/tune the W7 two-tap audition for a 5yo | **HIGH** |
| **W2** | **Lyt og Find** | **Real playback indicator** — the equalizer animates only while audio actually plays, settles when idle | MED |
| **W3** | **Lær Engelsk** | **Icon-forward chip navigator** (non-reader can navigate by icon) + a soft bridge from a rough quiz round into the matching theme | MED |

Already handled by PRD-14 (do NOT redo): `previewBeforeCommit` hear-before-commit on the two word games (W7); the
shared vertical rhythm (W1); baked art (PRD-11/-12). Lyt og Find's answer-hiding audio-first prompt is correct —
keep. en-US Ava voice untouched.

## 2. Guardrails
iPad-first no-scroll; 44px; Danish UI; **en-US Ava for English words, Danish voice for Danish** (unchanged); token-
driven (all 4 skins); reduced-motion (motion off, audio kept); no adaptivity; no new **narration** (W3's "Øv ordene"
is a UI button label, not a spoken clip — no prebake). Honor advance-lock/first-try. The 🔊 listen prompt must never
reveal the answer (Lyt og Find invariant).

## 3. Workstream design

### W1 — Differentiate the two word games (LEARNING, flagship)
**Problem (PRD-13 §D):** both games show a **picture** and ask the child to tap an **English word text tile**;
post-W7 both also **audition** the tiles — so for this user they collapse into the same act ("see the thing, hear the
tiles, pick the English word"). The Danish caption on Translate is the only difference. That's one game twice.
**Change — split them into two distinct skills** (recommended default; §6 owner decision):
- **Find det Engelske Ord** = **picture → English word** (meaning→print). Keep the baked **picture** prompt (no
  Danish). Child sees the thing, auditions the English tiles (W7), picks its English name. Skill: *map a known object
  to its English written word.* (Essentially today's game, kept.)
- **Dansk til Engelsk** = **Danish word → English word** (translation, no picture). **Drop the picture**; prompt =
  the **Danish word** (spoken Danish + the Danish text) only. Child hears/sees the Danish word, auditions the English
  tiles, picks the translation. Skill: *Danish → English translation* — a genuinely harder, distinct task (no picture
  crutch), and the classic native-language bridge. Still fully playable by a non-reader via the W7 audition + his
  spoken-Danish comprehension.
- Net: **Find** keeps its picture (recognition), **Translate** loses it (translation) — they now differ by *whether a
  picture supports the choice*, which changes the skill. (Alternative in §6: make Find an English-audio→English-word
  print game instead — owner's call.)
- **Confirm/tune W7 for a 5yo:** the two-tap audition (first tap = hear, second tap = commit) shipped in PRD-14.
  **Play-test it.** If he accidentally commits or is confused, apply PRD-14 W7's documented **fallback: a per-tile
  speaker badge** (tap badge = hear, tap tile body = commit). Pick one and make it consistent across both games.
**Learning check:** each game must teach something the other doesn't; both must stay winnable by audition (no reading
required). Keep both at the beginner floor (random mixed-theme distractors — fair).
**Verify:** Find shows a picture + English-word tiles (audition works, commit records); Translate shows a Danish word
(no picture) + English-word tiles; the two now feel like different tasks; en-US Ava on English tiles, Danish voice on
the Danish prompt; never-fail pulse intact.

### W2 — Lyt og Find: real playback indicator (UX/LEARNING)
**Problem (PRD-13 §D):** the game is pedagogically correct (hear English → tap the matching picture), but the
equalizer under the 🔊 is **decorative** — not synced to actual playback — so a young child has no reliable "it's
speaking now / it's my turn" signal, and may tap "Hør igen" over a still-playing clip (which cancels it).
**Change:** drive the equalizer from **real audio playback state** (read the audio hook's playing state — do NOT
create component-level `isPlaying`; read it per `.claude/rules/audio-system.md`): bars animate **only while the clip
plays**, then settle to a calm pulsing speaker when idle (his turn). Optionally auto-replay the English word once
after a wrong tap (the prompt, not an option) to keep the listening loop alive. Keep the answer-hiding hero (never
reveal the picture). Vertical balance already improved by PRD-14 W1.
**Verify:** capture the `/api/tts-azure` timing — the equalizer moves during playback and is still when idle; a wrong
tap optionally re-speaks the word; the hero never shows the answer.

### W3 — Lær Engelsk: icon-forward chip navigator + quiz bridge (UX/LEARNING)
**Problem (PRD-13 §D):** nine same-size text chips (Dyr/Mad/Ting/Tal/Farver/Krop/Familie/Natur/Hilsner) are a scan
load for a non-reader — several Lucide icons are abstract (Blocks="Ting", Hash="Tal"). And there's no path from a
struggling quiz back to the relevant browse theme.
**Change:**
- **Icon-forward chips:** make the **icon the primary element** (larger) with the Danish label secondary/below, so he
  navigates by icon not text. Keep all 9 themes; consider a clearer icon for the abstract ones. Keep the active-chip
  highlight + the bloom-on-select.
- **Quiz→browse bridge (soft, optional):** after a rough quiz round (e.g. low first-try), offer an **"Øv ordene"**
  action on the result screen that opens **Lær Engelsk on the matching theme**, closing the loop between the test and
  the exposure surface. (UI label only — no narration; route via the transition system, not raw navigate.) If the
  cross-screen wiring is heavy, ship the chip navigator (the core UX win) and mark the bridge a fast-follow.
**Verify:** chips read icon-first and a non-reader can pick a theme by icon; selecting a chip re-blooms + swaps the
grid; (if built) a rough round offers "Øv ordene" → the right theme.

## 4. Danish copy
- W3: **"Øv ordene"** (practice the words) — a UI button label only (no spoken clip). No other new strings; all
  spoken content reused.

## 5. Files to touch
- `src/components/english/EnglishWordGame.tsx` (W1 — keep picture→English)
- `src/components/english/EnglishTranslateGame.tsx` (W1 — drop picture; Danish-word→English)
- `src/components/common/UnifiedQuizGame.tsx` (W2 — equalizer synced to playback; W1 — support a picture-less Danish-
  word prompt if the engine doesn't already render `questionVisual.word` without art — see Appendix; W7 fallback if
  chosen)
- `src/components/english/EnglishLearning.tsx` (W3 — chip navigator)
- *(if W3 bridge)* `src/components/common/RoundResultScreen.tsx` + a themed-nav call (optional)
**Reuse:** the W7 `previewBeforeCommit` path, `speakEnglish`/`speak`, `getCategoryTheme('english')`, the audio hook's
playback state, `useTransitionNav`, existing `englishVocab` themes.

## 6. Owner decisions (defaults chosen)
1. **Differentiation split** — [default: Find = picture→English (kept); Translate = Danish-word→English (drop
   picture)]. Alt: make Find an **English-audio→English-word** (print) game (hear "dog", pick the written word) so the
   trio is picture-meaning (Lyt og Find) / sound-print (Find) / translation (Translate). Owner picks.
2. **W7 model** — [default: keep the two-tap audition from PRD-14]; switch to the per-tile speaker badge only if
   play-test shows confusion.
3. **W3 bridge** — [default: ship the chip navigator now; the "Øv ordene" quiz→browse bridge is a fast-follow if the
   cross-screen wiring is heavy].

## 7. Verification (end-to-end)
- `npm run build` + `npm run lint` clean.
- `ui-screenshot`, iPad + phone, all 4 skins: W1 Find (picture + EN tiles) vs Translate (Danish word, no picture, + EN
  tiles) are visibly different; W2 equalizer tracks real playback (TTS-timing capture); W3 chips are icon-forward.
  Reduced-motion + 0 console errors.
- **W7 behavior:** first tap on a word tile auditions (no score/advance — `bornelaering-progress` snapshot unchanged),
  second tap commits; en-US Ava on English, Danish voice on the Danish prompt.
- **Then play-test** — especially W1 (do the two games feel distinct? is the two-tap clear or does he need the speaker
  badge?).

## Appendix A — verbatim current signatures / anchors (current `master`)

**§A1 — UnifiedQuizGame (W1/W2).** `previewBeforeCommit` flag decl **:124–131**. Preview state `previewValue`
**:165** (reset per question **:251**). Audition/commit gate in `handleItemClick` **:409–424** — if
`config.previewBeforeCommit && selectedItem.value !== previewValue` → set `previewValue`, clear feedback, `await
config.speakClickedItem`, **return** (no score/lock/first-try/hint); a second tap on the same value falls through to
the commit path **:426–501**. Raised-tile visual: `tileStateFor` **:544–551** maps `previewValue` → `'selected'`
(committed feedback wins); actual lift lives in `AnswerTile.tsx`. **W7 fallback (speaker badge)** would edit the gate
(:409) + tile render. **English "listen" hero** (`quizType==='english'`, no questionVisual) **:605–627**: Lucide
`Volume2` (imported :4) + a **decorative** 5-bar equalizer **:614–624** — `scaleY:[…] repeat:Infinity`, **NOT synced
to audio** (only `reduce` gates it; no `audio`/playback reference). **W2:** drive these bars from the audio hook's
real playback state (read it, don't create component `isPlaying`); settle when idle.

**§A2 — Lyt og Find (`EnglishListenGame.tsx`).** `toPictureItem` (answers = baked pictures) **:53–59**;
`quizType:'english'` **:62** (→ the listen hero, no `questionVisual`); `gameId:'english.listen'`; **NO
`previewBeforeCommit`** (pictures self-reveal — leave it off); audio all `speakEnglish` **:92–94**. Difficulty
helpers `themeMatesOf`/`pickWordsForLevel` **:17–44** (duplicated across all 3 quizzes). W2 touches the engine hero,
not this config.

**§A3 — Find det Engelske Ord (`EnglishWordGame.tsx`).** `toWordItem` (answers = English word text, no art)
**:49–54**; `generateQuizItem` sets `questionVisual: { word:'', art: englishArt(englishArtId(word.en)) }` (picture-
only prompt) **:59–68**; `previewBeforeCommit: true` **:91–94**; audio all `speakEnglish` **:97–99**. **W1: keep as
is** (picture→English is the retained skill).

**§A4 — Dansk til Engelsk (`EnglishTranslateGame.tsx`).** `toWordItem` — `audioPrompt`/`repeatWord` hold the **Danish**
`w.da` **:49–55**; `generateQuizItem` sets `questionVisual: { word: word.da, art: englishArt(englishArtId(word.en)) }`
(picture + Danish caption) **:60–70**; `previewBeforeCommit: true` **:93–96**; audio = **Danish** prompt/repeat
(`audio.speak(item.audioPrompt)`) + **English** tile (`speakEnglish(item.value)`) **:98–101**. **W1 change (small):**
drop the picture → `questionVisual: { word: word.da }` (remove `art`) so the prompt is the **Danish word only**;
verify the engine renders a word-only `questionVisual` as a proper large prompt (word-only uses the big size; with a
picture it's a small caption — confirm/adjust in `UnifiedQuizGame` renderHero if the word-only path needs sizing).
Word vs Translate today differ in exactly 3 points (audio fields, `questionVisual.word`, prompt voice) — W1 makes the
picture presence the 4th, distinguishing skill.

**§A5 — Lær Engelsk (`EnglishLearning.tsx`).** `THEME_ICONS` map (9 Lucide icons) **:31–41**. Chip row **:138–183**:
each `<Chip label={<Box>{<ThemeIcon size={18}/>}{t.title}</Box>}>` (icon + Danish title inline, **:155–160**),
`onClick` sets `activeThemeId` + `selectedWord` **:161–166**, active styling `t.id===activeThemeId` **:174–176**;
renders **all 9 themes incl. greetings**. Bloom `PromptFocus` **:87–136**; word-card grid **:185–277** (`TactileTile
variant="card"`, tap → `speakEnglish` + browse XP **:62–77**). **W3:** make the icon primary (larger) + label
secondary in the chip `label` (**:155–160**); keep selection logic; the "Øv ordene" bridge would add an action on
`RoundResultScreen` routing here with a preset `activeThemeId`.

**§A6 — englishVocab (`englishVocab.ts`).** `EnglishWord {en, da}` (**no emoji/art field** — baked WebP only)
**:11–20**; `englishThemes` (9 themes) **:22–159** (animals/food/objects/numbers/colors/body/family/nature = 10/10/10/
10/10/8/8/8; greetings = 8). Quiz pool `quizEnglishWords` = all themes **except greetings** (`t.id !== 'greetings'`)
**:167–169**; `pickDistractorWords` (default pool, non-mutating shuffle) **:172–186**. So body + family ARE in the
quiz pool (baked). W1/W3 don't need vocab edits; the difficulty helper block is duplicated across the 3 quiz files
(optional consolidation).

---
*End PRD-17. Art-free; confirm the §6 differentiation split with the owner at build; verify + play-test, then PRD-18
(Alphabet + Ordleg) closes the backlog.*
