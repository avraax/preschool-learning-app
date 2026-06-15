# Overhaul PRD — Alphabet (`-03-`)

**Date:** 2026-06-15
**Part of:** Game Experience Overhaul (see `plans/games-overhaul/tmp-prd-overhaul-00-roadmap.md`).
**Depends on:** Foundation PRD (`plans/games-overhaul/tmp-prd-overhaul-01-foundation.md`) — **already
implemented** (progress store, `useRound`, `RoundResultScreen`, `StickerReveal`, `sfxClient`,
celebration tiers). Bogstav Quiz is the wired reference game (Foundation smoke test).

> **Self-containment:** written so a fresh implement session builds it with near-zero re-exploration.
> Verbatim current signatures + exact `file:line` integration points are in **Appendix A**. Read this
> whole file plus the Foundation PRD before coding.

## Context

Alphabet is two games. The son (~5) **knows every letter**, so plain letter recognition is trivial —
the genuine learning is **first-sound / word association** (precursor to reading, his emergent
frontier). The overhaul inventory found:

- **Bogstav Quiz** mixes ~50% trivial "hør bogstavet" with ~50% word-association; distractors are
  fully random; it was the Foundation round/reward smoke test so rounds already work.
- **Lær Alfabetet** is a passive A–Å poster — tap a letter, hear its name; no goal, no reward.

**Success looks like:** Bogstav Quiz becomes an all-word-association round that actually trains the
first-sound skill and ends on the shared reward screen; Lær Alfabetet becomes a calm browse that
quietly drips exploration stickers — both at or above today's immersive polish, identical reward
language to Math.

**Static difficulty only** (standing constraint): no adaptive difficulty, no in-game level pickers.
Tuning = editing the named constants in a later session.

### Scope

| Game | Route | Component | Type |
|---|---|---|---|
| Bogstav Quiz | `/alphabet/quiz` | `AlphabetGame.tsx` | `UnifiedQuizGame` config |
| Lær Alfabetet | `/alphabet/learn` | `AlphabetLearning.tsx` | hand-rolled browse |

**Out of scope:** the alphabet **Memory** game (`/learning/memory/letters`) is the shared engine,
handled in `-07-`.

## Current state (with concrete weaknesses)

- **`AlphabetGame.tsx`** — thin `UnifiedQuizGame` config. `generateQuizItem` (`:50-75`) flips a coin:
  ~50% word-association (show emoji from `LETTER_WORDS`, ask "Hvad starter [word] med?"), ~50%
  hear-the-letter ("Find bogstavet X"). `generateOptions` (`:77-93`) picks 3 **random** wrong letters
  from the full 29-letter `DANISH_ALPHABET`. Round is **already wired** (`gameId: 'alphabet.quiz'`,
  `round: { length: 8, starThresholds: { three: 0, two: 2 } }` at `:109-112`) → rewards/SFX/tiers all
  flow through the engine today. **Weakness:** half the questions are trivial for him; the word-mode
  half is the only real learning.
- **`AlphabetLearning.tsx`** — learning-based A–Å browse via `LearningGrid` (`:222-227`); `goToLetter`
  (`:85-105`) speaks the letter name. **No goal, no reward, no progress memory.**

## Target experience

### 1. Bogstav Quiz — `AlphabetGame.tsx` (tiny change)

**Before:** ~50/50 hear-letter vs word-association; random distractors; rounds already on.
**After:**
- **All word-association.** `generateQuizItem` always picks a letter from `WORD_LETTERS`, shows its
  emoji (NOT the word text — he must recognise the starting sound from the picture), and asks
  "Hvad starter [word] med?". **Remove** the `useWordMode` coin-flip and the hear-the-letter branch.
- **Distractors stay random** (`generateOptions` unchanged) — owner decision.
- **Round/reward/SFX/tiers unchanged** — already provided by the engine (`round`/`gameId` at
  `:109-112`; the engine fires `celebrateTier('micro'/'streak')`, `sfx.play('wrong')`, renders
  `RoundResultScreen`, records to `progressStore`). Nothing to add here.
- **Consequence (accepted):** `WORD_LETTERS` omits **Q, W, X** (no child-friendly Danish word), so
  those three are never the correct answer in this mode. Acceptable — he knows them and they're rare;
  they still appear as random distractors. Do **not** invent forced words for them.

### 2. Lær Alfabetet — `AlphabetLearning.tsx` (mirror `NumberLearning.tsx`, plain)

**Before:** passive poster.
**After — clone the Lær Tal browse pattern exactly:**
- **Keep** the calm browse: the current-letter card + `LearningGrid`, taps speak the letter name
  (`audio.speakLetter`). **No word/picture enrichment, no challenge mode** (owner decision; matches
  Math's Lær Tal, which dropped its challenge in commit `11af5a3`).
- **Add session-local exploration-milestone stickers**, copied structurally from `NumberLearning.tsx`:
  - `exploredRef = useRef<Set<string>>(new Set())`, `milestoneRef = useRef(0)`,
    `stickerAward` state, `stickerTimer` ref.
  - `useCelebration()` → `{ showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration }`; pass `celebration={{…}}` to `GameShell` (Lær Alfabetet currently passes none).
  - On each tap: add the letter to `exploredRef`; when `floor(size / EXPLORE_MILESTONE)` crosses a new
    integer, call `progressStore.awardSticker()`, set `stickerAward`, `celebrateTier('sticker')`,
    auto-dismiss after ~3.6s, and speak `"Nyt klistermærke! [label]"` (browse has no competing TTS).
  - Render the same fixed-overlay `StickerReveal` (`accent={categoryThemes.alphabet.accentColor}`,
    `size={140}`) as `NumberLearning.tsx:216-232`.
- **`EXPLORE_MILESTONE = 9`** for alphabet (vs 12 for the 100-number set). Rationale: 29 letters → 3
  awards (at 9 / 18 / 27 distinct), a satisfying cadence; also echoes the 9-stickers-per-album-page
  motif. Tunable constant.
- **No round, no `gameId`, no `recordRoundResult`** — exploration stickers are session-local via
  `awardSticker()`, exactly like Lær Tal. (The sticker itself still persists in the store as usual.)

## Foundation hooks (how each game plugs in)

| Game | gameId | round | star thresholds | sticker set | tiers fired | SFX |
|---|---|---|---|---|---|---|
| Bogstav Quiz | `alphabet.quiz` | length 8 (already set) | 3★=0, 2★≤2 (already set) | global pool | micro, streak, + round/best/sticker/page in result | correct, wrong + result cues (engine) |
| Lær Alfabetet | — (no round) | — | — | global pool | sticker (on browse milestone) | sticker-reveal (via `celebrateTier('sticker')`) |

- **Sticker pool = global** for both (no `stickerSetId`).
- For Bogstav Quiz, the engine's `recordRoundResult` already awards 1 round sticker + a best-bonus and
  detects page-complete — nothing extra.
- `celebrateTier` already fires the tier's SFX — do **not** also call `sfx.play` for those cues.

## Learning design

- **All word-association** targets the one alphabet skill he hasn't mastered: mapping a picture/word
  to its **starting letter** — the foundation of sounding out words. Recognition (which he's past) is
  retired from the quiz.
- **No phonics phonemes** in v1 (owner decision): we keep letter **names** + the association **word**.
  (A 29-letter Danish phoneme map remains a clean future add if desired — flagged, not built.)
- **Random distractors kept** (owner decision) — simplest; the picture→letter mapping is itself the
  discrimination.
- **No punishment:** wrong answers never end a round or scold (gentle `wrong` SFX only); they only
  break the question's first-try flag (stars/streak). Always ≥1 star. (All handled by the engine.)
- **Lær Alfabetet** stays a low-pressure browse; stickers reward curiosity, not correctness.

## Visual/asset spec

- **No new raster art.** Bogstav Quiz reuses the existing `questionVisual` emoji prompt (already
  rendered by the engine at `UnifiedQuizGame.tsx:402+`) and `AnswerTile` letters. Lær Alfabetet reuses
  the existing current-letter `Card`, `LearningGrid`, and the shared `StickerReveal`.
- Everything meets **Principle 0**: theme-token colours only (`categoryThemes.alphabet.*` /
  `useTheme()` / `getCategoryTheme('alphabet')`), correct across all 6 skins incl. dark immersive
  scenes, `clamp()` sizing, no-scroll full-viewport, reduced-motion aware (Framer + `CelebrationEffect`
  already honour it).

## Data & content (concrete, complete)

- **Bogstav Quiz word list = the existing `LETTER_WORDS`** in `AlphabetGame.tsx:13-40` (25 letters;
  Q/W/X omitted by design). Keep verbatim:
  A Abe🐒, B Bil🚗, C Cykel🚲, D Drage🐉, E Elefant🐘, F Fisk🐟, G Giraf🦒, H Hund🐕, I Is🍦,
  J Jul🎄, K Kat🐱, L Løve🦁, M Mus🐭, N Næsehorn🦏, O Orm🪱, P Panda🐼, R Raket🚀, S Sol☀️,
  T Tog🚂, U Ugle🦉, V Vandmelon🍉, Y Yoghurt🥛, Z Zebra🦓, Æ Æble🍎, Ø Ørn🦅, Å Ål🐍.
- **Bogstav Quiz prompt:** `audioPrompt = \`Hvad starter ${word} med?\``, `repeatWord = word`,
  `questionVisual = { emoji }` (emoji only, no word text). `value`/`display` = the letter.
- **Bogstav Quiz distractors:** unchanged `generateOptions` — 3 random letters from the 29-letter
  `DANISH_ALPHABET`, deduped vs the answer, shuffled.
- **Round length 8, thresholds 3★=0 / 2★≤2** — already set; keep.
- **Lær Alfabetet:** `DANISH_ALPHABET` (29 letters, unchanged). `EXPLORE_MILESTONE = 9`.

## Files to touch

**Modified**
- `src/components/alphabet/AlphabetGame.tsx` — `generateQuizItem` → always word-association (delete the
  coin-flip + hear-the-letter branch). Everything else (round, gameId, options, audio callbacks) stays.
- `src/components/alphabet/AlphabetLearning.tsx` — add exploration-milestone stickers
  (`useCelebration` + `progressStore.awardSticker` + `StickerReveal` overlay + `GameShell` celebration
  prop), mirroring `NumberLearning.tsx`.
- `CLAUDE.md` — note the alphabet behavior under the overhaul/progress section (Bogstav Quiz =
  all word-association; Lær Alfabetet = browse + exploration stickers). `alphabet.quiz` gameId already
  exists.

**No new files. No new SFX assets. No new audio strings** (welcome strings `alphabet` /
`alphabetlearning` already exist in `GAME_WELCOME_MESSAGES`).

**Reuse (do not reinvent)** — `UnifiedQuizGame` + its round path (`src/components/common/UnifiedQuizGame.tsx`),
`progressStore.awardSticker`/`RoundOutcome` (`src/services/progressStore.ts`), `StickerReveal`
(`src/components/common/StickerReveal.tsx`), `useCelebration().celebrateTier`
(`src/components/common/CelebrationEffect.tsx`), `sfx` (`src/services/sfxClient.ts`), `GameShell`,
`LearningGrid`, `AnswerTile`, `getCategoryTheme('alphabet')`/`categoryThemes.alphabet`,
`DANISH_PHRASES`, `audio.speakLetter`. **`NumberLearning.tsx` is the literal template** for the
Lær Alfabetet sticker work.

## Verification (end-to-end, iPad-sized viewport)

Run both dev servers in **Windows PowerShell** (`npm run dev` + `npm run dev:api` — never WSL; see
project memory). Then:

1. **Bogstav Quiz is all word-association:** every question shows a picture (no word text) and asks
   "Hvad starter … med?"; the hear-the-letter prompt never appears. Round ends after **8** →
   `RoundResultScreen` (correct stars for 0 / 2 / 3 first-try mistakes); replay + "Se bog" + "Tilbage"
   work; "Ny rekord!" shows on a new best.
2. **Lær Alfabetet:** browse still calm + speaks each letter name; ~every **9** distinct letters tapped
   pops a `StickerReveal` with `sticker` celebration + spoken name; overlay auto-dismisses and taps
   through.
3. **Persistence:** stickers/stars/bests survive reload; private window → in-memory, no crash.
4. **SFX/juice:** Bogstav Quiz fires `correct`/`wrong` + `streak-up` every 3rd first-try + the
   result-screen cues; mute (`progressStore.settings.sfxEnabled`) silences SFX but not TTS.
5. **Quality floor:** both surfaces render correctly and at-or-above current polish in **all 6
   themes**, portrait + landscape, **no scroll**; reduced-motion degrades gracefully.
6. `npm run build` and `npm run lint` clean. Use the `ui-screenshot` skill to confirm layouts + zero
   console errors.

## Open questions resolved this session

- Bogstav Quiz = **all word-association** (hear-the-letter mode removed).
- **No phonics** phonemes in v1 — letter **name + association word** only.
- Bogstav Quiz distractors = **random** (kept).
- Lær Alfabetet = **calm browse + session-local exploration stickers**, **no challenge**, **no
  word/picture enrichment** (mirrors Lær Tal).
- Exploration milestone = **every 9 distinct letters**; sticker pool **global**.
- PRD filed as **`-03-alphabet.md`** (corrects the kickoff prompt's `-02-`, which is Math).

## Appendix A — Embedded implementation reference

Verbatim contracts of the code this PRD extends, cited from the repo at write time (2026-06-15).

### `AlphabetGame.tsx` — the only change point
Current `generateQuizItem` (`src/components/alphabet/AlphabetGame.tsx:50-75`) flips `useWordMode`.
Replace the whole function body with the word-only branch (drop the coin-flip + the
`DANISH_ALPHABET`-random hear-the-letter return):
```ts
generateQuizItem: () => {
  const letter = WORD_LETTERS[Math.floor(Math.random() * WORD_LETTERS.length)]
  const { word, emoji } = LETTER_WORDS[letter]
  return {
    value: letter,
    display: letter,
    audioPrompt: `Hvad starter ${word} med?`,
    repeatWord: word,
    questionVisual: { emoji },   // emoji only — no word text
  }
}
```
- `generateOptions` (`:77-93`) — **unchanged** (3 random from `DANISH_ALPHABET`).
- `round`/`gameId` (`:109-112`) — **unchanged** (`alphabet.quiz`, length 8, 3★=0/2★≤2).
- Audio callbacks (`:115-125`) — **unchanged** (`speakQuizPromptWithRepeat`, `speakLetter`).
- `LETTER_WORDS` (`:13-40`) + `WORD_LETTERS = Object.keys(LETTER_WORDS)` (`:41`) — **keep verbatim**.

### `UnifiedQuizGame` round path — `src/components/common/UnifiedQuizGame.tsx` (already implemented)
```ts
// config interface (:38-71)
round?: RoundConfig            // present → bounded round + RoundResultScreen
gameId?: string                // e.g. 'alphabet.quiz'
// state (:104-112): useCelebration() → celebrateTier; useRound(config.round); firstAttemptRef; roundOutcome
// generateNewQuestion (:141-142): firstAttemptRef.current = true
// correct tap (:279): celebrateTier('micro')
// wrong tap (:283-284): firstAttemptRef.current = false; sfx.play('wrong')
// advance/finish (:298-309):
//   if (!round.enabled) generateNewQuestion()
//   else { const r = round.completeQuestion(firstAttemptRef.current)
//          if (!r.done && r.streak%3===0) celebrateTier('streak')
//          if (r.done) finishRound(r.firstTryCorrect, r.longestStreak) else generateNewQuestion() }
// finishRound (:343-349): progressStore.recordRoundResult(gameId, {correct, total:round.length, longestStreak},
//                          { starThresholds, stickerSetId }) → setRoundOutcome
// handleReplay (:354-357): reset round+score, regenerate
// render (:393-402): roundOutcome ? <RoundResultScreen outcome categoryId backRoute onReplay/> : (…questionVisual emoji prompt + grid…)
```
The `questionVisual.emoji` is rendered as the prompt above the grid (`:402+`). Nothing in the engine
needs changing for Alphabet.

### `NumberLearning.tsx` — literal template for Lær Alfabetet stickers
`src/components/math/NumberLearning.tsx` (the calm-browse + exploration-sticker reference):
```ts
const EXPLORE_MILESTONE = 12                                   // alphabet: use 9
const { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration } = useCelebration()
const exploredRef = useRef<Set<number>>(new Set())            // alphabet: Set<string>
const milestoneRef = useRef(0)
const [stickerAward, setStickerAward] = useState<StickerAward | null>(null)
const stickerTimer = useRef<NodeJS.Timeout | null>(null)

const maybeAwardExploration = () => {                          // :100-118
  const size = exploredRef.current.size
  const milestone = Math.floor(size / EXPLORE_MILESTONE)
  if (milestone > milestoneRef.current) {
    milestoneRef.current = milestone
    const award = progressStore.awardSticker()
    setStickerAward(award); celebrateTier('sticker')
    if (stickerTimer.current) clearTimeout(stickerTimer.current)
    stickerTimer.current = setTimeout(() => setStickerAward(null), 3600)
    try { audio.speak(`Nyt klistermærke! ${award.sticker.label}`).catch(() => {}) } catch {}
  }
}
// in tap handler: exploredRef.current.add(value); maybeAwardExploration()
// GameShell gets: celebration={{ show: showCelebration, intensity: celebrationIntensity, duration: celebrationDuration, onComplete: stopCelebration }}
// overlay (:216-232): {stickerAward && <Box fixed onClick={()=>setStickerAward(null)}><StickerReveal award={stickerAward} accent={MATH_ACCENT} size={140}/></Box>}
```
For Alphabet: `import StickerReveal from '../common/StickerReveal'`,
`import { useCelebration } from '../common/CelebrationEffect'`,
`import { progressStore, type StickerAward } from '../../services/progressStore'`; use
`Set<string>` keyed by the letter; `accent = categoryThemes.alphabet.accentColor`; cleanup
`stickerTimer` in the existing unmount effect (`AlphabetLearning.tsx:55-60`).

### `progressStore` / `StickerReveal` — signatures
```ts
progressStore.awardSticker(setId?: string): StickerAward     // next uncollected from global/this set
// StickerAward: { sticker: { id; label; emoji; rarity? }, isNew, isShiny, ... }  (see progressStore.ts)
// <StickerReveal award={StickerAward} accent={hex} size={number} />
```

### `AlphabetLearning.tsx` — current shape (extend, don't rewrite)
- `goToLetter(index)` (`:85-105`) — speaks `audio.speakLetter(letter)`; **add** the explore-set add +
  `maybeAwardExploration()` here.
- Unmount cleanup effect (`:55-60`) — add `stickerTimer` clear.
- `GameShell` (`:111-153`) — add the `celebration` prop.
- Render body (`:154-238`) — append the `StickerReveal` overlay before `</GameShell>`.

### Theme + welcome strings
- `categoryThemes.alphabet` content at `src/config/categoryThemes.ts:44-70` (games list; **no title
  changes**). Accent via `categoryThemes.alphabet.accentColor` / `getCategoryTheme('alphabet')`.
- Welcome strings already present: `alphabet → 'Bogstav Quiz'`, `alphabetlearning → 'Lær Alfabetet'`
  (`SimplifiedAudioController.ts:345-346`).
- `getDanishLetterName` / `speakLetter` unchanged (`danish-phrases.ts:159-170`,
  `SimplifiedAudioController.ts:200-203`).

### Layout / rules
- No-scroll full-viewport, `gridAutoRows: minmax(0,1fr)`, landscape overrides, ≥44px targets,
  `clamp()` typography — see `.claude/rules/responsive-design.md` and the existing alphabet/number
  grids. Comic Sans for child-facing text; Danish only.

## Deferred / not in this PRD
Alphabet **Memory** (`-07-`); a Danish **phoneme/phonics** map (flagged, not built); animated letter
formation/tracing; word/picture enrichment of the Lær Alfabetet browse; near/confusable distractors
for Bogstav Quiz (kept random per owner); persisting exploration progress across sessions (kept
session-local, like Lær Tal).
