# Overhaul PRD — English (Engelsk) `-05-`

**Date:** 2026-06-15
**Part of:** Game Experience Overhaul (see `plans/games-overhaul/tmp-prd-overhaul-00-roadmap.md`).
**Depends on:** Foundation (`tmp-prd-overhaul-01-foundation.md`) — **already implemented**, plus the
Math/Alphabet/Ordleg overhauls that proved the round/result/sticker path on `UnifiedQuizGame`.
**Implement in a fresh session** using only this PRD + the Foundation PRD.

---

## Context

English is the **lightest** area in the program. All three Engelsk quizzes are already thin configs
over the shared `UnifiedQuizGame` engine, and that engine has *already* been upgraded by the earlier
overhaul work to fire SFX, micro-celebration, bounded rounds, and the `RoundResultScreen`. So English
does **not** need new mechanics — it needs to **plug into the foundation** that every other section is
already using:

- The 3 quizzes (Lyt og Find, Find det Engelske Ord, Dansk til Engelsk) still run **endless** — they
  never finish, never award stars/stickers, never beat a best. Everything to fix that already exists
  on the engine; they just haven't opted in (`round` + `gameId` are absent from their configs).
- Lær Engelsk (browse) is a passive poster with **no reward or progress**, unlike the now-rewarding
  Lær Tal / Lær Alfabetet browse games.

**Owner decisions this session deliberately keep English easy and minimal** (the son is a beginner at
English, Danish-native, ~5yo, can't read fluently yet):

| Decision | Choice | Consequence |
|---|---|---|
| Distractors | **Keep random across all themes** | `pickDistractorWords` unchanged — no minimal-pairs |
| Round composition | **Mixed themes per round** | `generateQuizItem` unchanged |
| Lineup | **Keep all 4 games**, overhaul only | nothing removed/merged |
| Lær Engelsk reward | **Exploration milestones only** (no challenge) | mirror Lær Tal/Alfabetet |
| Milestone cadence | **Every 9 distinct words** | mirrors Lær Alfabetet |
| Audio-playing cue | **Skip** — repeat button is enough | **no shared-engine change** |

> The owner explicitly **overrode** the roadmap's suggested "minimal-pair distractors / thematic
> grouping / audio cue" for English — random + mixed + repeat-button-only is the chosen design, to
> keep the section gentle for a true beginner. Do not reintroduce those.

**Success looks like:** he plays a short English round, it finishes after 8, he sees his stars vs his
best and earns a sticker into the shared album — and browsing Lær Engelsk now drops a sticker every so
often. Identical reward feel to the rest of the app, with **no change to the actual English content or
difficulty**.

---

## Current state

| Game | Route | File | Mechanic | Engine |
|---|---|---|---|---|
| Lyt og Find | `/english/listen` | `EnglishListenGame.tsx` | hear EN word → tap matching **picture** (4 emoji tiles) | `UnifiedQuizGame` |
| Find det Engelske Ord | `/english/word` | `EnglishWordGame.tsx` | see **picture** → tap correct **written EN word** | `UnifiedQuizGame` |
| Dansk til Engelsk | `/english/translate` | `EnglishTranslateGame.tsx` | hear+see **DA word** → tap correct **EN word** | `UnifiedQuizGame` |
| Lær Engelsk | `/english/learn` | `EnglishLearning.tsx` | browse 9 themes of word-cards, tap to hear EN | hand-rolled (learning) |

Vocabulary: `src/config/englishVocab.ts` — 9 themes, 84 words total (`englishThemes`), with
`quizEnglishWords` (excludes the abstract `greetings` theme → 74 words) and `pickDistractorWords()`.

### Concrete weaknesses (cited)
- **Endless quizzes — no rounds/rewards.** All 3 configs lack `round` + `gameId`, so the engine's
  bounded-round path never triggers. e.g. `EnglishListenGame.tsx:18-47` (config) has no `round`/`gameId`.
  Same for `EnglishWordGame.tsx:18-50` and `EnglishTranslateGame.tsx:19-50`.
- **Browse has no progress.** `EnglishLearning.tsx` tracks nothing across taps and renders `GameShell`
  with **no `celebration` prop** (`EnglishLearning.tsx:42-48`); tapping a word only speaks it
  (`handleWordClick`, `EnglishLearning.tsx:28-39`). No sticker, no milestone, no persistence.

### What already works (do NOT rebuild)
- The 3 quizzes already inherit, from `UnifiedQuizGame`: instant board load, welcome gate, per-tap
  `correct`/`wrong` SFX, `celebrateTier('micro')`, and — **once `round` is set** — the bounded-round
  loop + `RoundResultScreen` + `progressStore.recordRoundResult` wiring at `UnifiedQuizGame.tsx:298-351`.
- Welcome strings exist: `SimplifiedAudioController` `GAME_WELCOME_MESSAGES` has `englishlisten`,
  `englishword`, `englishtranslate` (lines 357-359). No audio-controller change needed.

---

## Target experience

### A. The three quizzes → bounded rounds (config-only, no logic change)

**Before:** infinite loop; correct → next question forever; score chip climbs; nothing finishes.
**After:** an 8-question round; after the 8th correct answer the engine records the result and swaps
the answer grid for `RoundResultScreen` (stars → "Ny rekord!" ribbon → streak readout → sticker reveal
→ Spil igen / Tilbage / Se bog). Wrong answers still don't punish or advance (retry-until-right feel
preserved); they only break that question's first-try flag, lowering the star rating.

The **only** change to each game is adding two fields to its `UnifiedQuizConfig`:
```ts
gameId: 'english.listen',                                  // (or english.word / english.translate)
round: { length: 8, starThresholds: { three: 0, two: 2 } } // 3★=0 mistakes, 2★≤2, else 1★
```
- **Global sticker pool** — omit `stickerSetId` (matches every other overhauled game).
- **Distractors & prompts unchanged** — `generateQuizItem` / `generateOptions` / `pickDistractorWords`
  stay exactly as they are (random across `quizEnglishWords`, mixed themes).
- **Audio callbacks unchanged** — Lyt og Find / Find det Ord speak `speakEnglish`; Dansk til Engelsk
  prompts in Danish (`audio.speak`) and speaks the EN word on tap. The green `EnglishRepeatButton`
  stays as the only audio affordance (no new "playing" indicator — owner decision).

**Removed:** nothing.

### B. Lær Engelsk → exploration-milestone stickers (mirror NumberLearning/Lær Alfabetet)

**Before:** browse 9 themes, tap a card to hear the English word; no reward, no memory.
**After:** identical calm browse, **plus** every **9 distinct English words** tapped (across the whole
session, any theme) pops a `StickerReveal` (global-pool sticker), a `sticker` celebration tier, and the
spoken `"Nyt klistermærke! <label>"`. The theme-chip selector and word-card grid are **unchanged**.

**Removed:** nothing. No challenge mode (owner decision).

---

## Foundation hooks

- **Round config (3 quizzes):** `{ length: 8, starThresholds: { three: 0, two: 2 } }`. Identical to
  Alphabet/Ordleg/Math task games.
- **gameIds:** `english.listen`, `english.word`, `english.translate`. New keys; `progressStore`
  handles unknown gameIds via `emptyGameStats()` — no migration needed.
- **Sticker set(s):** **global pool** for all four games (no `stickerSetId`). Round games award via
  `progressStore.recordRoundResult` (engine-driven); browse awards via `progressStore.awardSticker()`.
- **SFX cues:** inherited automatically by the 3 quizzes from `UnifiedQuizGame` — `correct` (via
  `celebrateTier('micro')`), `wrong` (`sfx.play('wrong')`), plus result-screen cues fired inside
  `RoundResultScreen`. Lær Engelsk fires only the `sticker` tier on a milestone (no per-tap SFX, to
  keep the browse calm — matches NumberLearning).
- **Celebration tiers:**
  - Quizzes: `micro` per correct (already firing) → `streak` every 3 (engine) → `round`/`best`/
    `sticker`/`page` all fired inside `RoundResultScreen` (already wired).
  - Lær Engelsk: `sticker` on each 9-word milestone (and `page` is emitted by `recordRoundResult`'s
    page-complete path only — not relevant to the browse award, which uses `awardSticker`).

---

## Learning design

- **What it teaches:** first English vocabulary across 9 concrete themes — listening comprehension
  (Lyt og Find), early EN word reading (Find det Engelske Ord), and DA→EN bridging (Dansk til Engelsk);
  Lær Engelsk is free vocab exposure.
- **Scaffolding:** the prompt word can be replayed any time via the green `EnglishRepeatButton`; wrong
  taps never end a round and aren't punished (retry-until-right). Stars reward first-try accuracy only.
- **Static difficulty (honored):** distractors stay **random** and themes stay **mixed** — no
  minimal-pairs, no per-theme rounds, no level picker. For a beginner this keeps the discrimination
  forgiving (a random 4-up across wildly different emoji/words is easy), which is the intended floor.
  Tuning, if ever wanted, is a future constant edit — not in scope.
- **Why it fits a 5yo:** rounds of 8 are short (attention span), the reward is the shared album he
  already recognises from Math/Alphabet/Ordleg, and the browse keeps a no-fail exploration mode.

---

## Visual/asset spec

- **No new art.** The 3 quizzes render `RoundResultScreen` and `StickerReveal` (Foundation hero
  surfaces) unchanged — they already meet Principle 0 (themed across all 6 skins, no-scroll,
  reduced-motion, `AnswerTile` depth language).
- **Lær Engelsk:** keep the existing theme-chip selector + word-card grid exactly as-is (it already
  reads `theme.accentColor` / `muiTheme.scene.dark` and is responsive). The only added surface is the
  same fixed-overlay `StickerReveal` block used by `NumberLearning.tsx:217-232` (accent =
  `categoryThemes.english.accentColor`). All styling stays token-driven; no hardcoded colors added.
- **Theme tokens:** everything reads from `categoryThemes.english` / `useTheme()` as today.

---

## Data & content

- **No vocabulary changes** — `src/config/englishVocab.ts` is untouched (`englishThemes`,
  `quizEnglishWords`, `pickDistractorWords` all stay).
- **New constants only:**
  - gameIds: `'english.listen'`, `'english.word'`, `'english.translate'`.
  - round config (all three): `{ length: 8, starThresholds: { three: 0, two: 2 } }`.
  - `EnglishLearning`: `const EXPLORE_MILESTONE = 9`.
- **No new sticker sets** — global pool (`STICKER_SETS` in `src/config/stickers.ts`) is used as-is.

---

## Files to touch

**Modified (4 files):**
- `src/components/english/EnglishListenGame.tsx` — add `gameId: 'english.listen'` + `round` to config.
- `src/components/english/EnglishWordGame.tsx` — add `gameId: 'english.word'` + `round` to config.
- `src/components/english/EnglishTranslateGame.tsx` — add `gameId: 'english.translate'` + `round`.
- `src/components/english/EnglishLearning.tsx` — add exploration-milestone stickers + celebration
  wiring (mirror `NumberLearning.tsx`).
- `CLAUDE.md` — add an "English games (Game Experience Overhaul)" line to the architecture notes
  (bounded rounds of 8 / global pool for the 3 quizzes; Lær Engelsk milestone every 9 distinct words;
  distractors stay random, themes mixed).

**Reuse (do NOT reinvent):**
- `UnifiedQuizGame` (round path already built), `RoundResultScreen`, `StickerReveal`, `useCelebration`,
  `progressStore.awardSticker`, `GameShell` (`celebration` prop), `categoryThemes.english`,
  `englishVocab`. Copy the milestone block verbatim-ish from `NumberLearning.tsx`.

---

## Verification (end-to-end, iPad-sized viewport)

Run both dev servers in **Windows PowerShell** (`npm run dev` + `npm run dev:api` — never WSL). Then:

1. **Rounds end:** `/english/listen`, `/english/word`, `/english/translate` — answer 8 questions; each
   swaps to `RoundResultScreen` after the 8th correct. Stars: 3★ with 0 mistakes, 2★ with 1–2, 1★ with 3+.
2. **Reward choreography:** stars fly in → "Ny rekord!" ribbon on a new best (old→new) → streak readout
   → sticker reveal → Spil igen / Tilbage / Se bog all work. "Spil igen" starts a fresh 8.
3. **Persistence:** earn a sticker → reload → `/album` + total stars + per-game bests survive. Private
   window → still playable, no crash.
4. **Browse milestone:** `/english/learn` — tap 9 distinct words → a sticker pops (`sticker` tier +
   spoken name); tapping the same words again does not double-count; tapping the chip selector switches
   themes without resetting the distinct-set.
5. **No regressions:** distractors are still random/mixed; the green repeat button still replays the
   prompt; no new "audio playing" indicator appeared.
6. `npm run build` and `npm run lint` clean. Use `ui-screenshot` on an iPad viewport across a couple of
   the 6 themes; zero console errors; no scroll in portrait or landscape.

---

## Open questions resolved this session

- **Distractors:** keep **random across all themes** (owner override of the roadmap's minimal-pair idea).
- **Round composition:** **mixed themes** per round (no per-theme rounds).
- **Lineup:** **all 4 games kept**; nothing removed/merged; the two reading games stay despite the son
  not reading fluently yet.
- **Lær Engelsk:** **exploration milestones only**, **every 9 distinct words** (mirrors Lær Alfabetet);
  no challenge mode.
- **Audio-playing cue:** **skipped** — the existing `EnglishRepeatButton` is sufficient; the 3 quizzes
  therefore require **no `UnifiedQuizGame` change**, only config additions.
- **Sticker pool:** **global** for all four (no per-section bias).
- **Round length / thresholds:** **8**, **3★=0 / 2★≤2** — consistent with all other task games.

---

## Appendix A — Embedded implementation reference (verbatim, so a clean session needs no re-exploration)

Cited from the repo at write time (2026-06-15).

### A.1 `UnifiedQuizConfig` (already supports rounds) — `src/components/common/UnifiedQuizGame.tsx:38-78`
```ts
export interface UnifiedQuizConfig {
  quizType: 'alphabet' | 'counting' | 'arithmetic' | 'english' | 'ordleg'
  generateQuizItem: () => QuizItem
  generateOptions: (correctAnswer: QuizItem) => QuizItem[]
  title: string
  emoji: string
  teacherCharacter: 'owl' | 'fox'
  theme: CategoryTheme
  backRoute: string
  ScoreChipComponent: React.ComponentType<any>
  RepeatButtonComponent: React.ComponentType<any>
  showRepeat?: boolean        // default true
  gameWelcomeType: string
  speakQuizPrompt: (item: QuizItem, audio: any) => Promise<string>
  speakClickedItem: (item: QuizItem, audio: any) => Promise<string>
  getRepeatAudio: (item: QuizItem, audio: any) => Promise<string>

  // Bounded-round mode (Foundation §3). OPTIONAL — absent → endless behavior.
  round?: RoundConfig         // see useRound.ts
  gameId?: string             // stable id, e.g. 'alphabet.quiz'
  skipFirstPrompt?: boolean
}
```
The engine's round loop is **already wired** at `UnifiedQuizGame.tsx:298-351`
(`round.completeQuestion` → `finishRound` → `progressStore.recordRoundResult` →
`setRoundOutcome` → renders `<RoundResultScreen>` at lines 393-399). **Nothing in the engine changes.**

### A.2 `RoundConfig` — `src/hooks/useRound.ts:14-18`
```ts
export interface RoundConfig {
  length: number // questions per round (e.g. 8)
  starThresholds?: { three: number; two: number } // MISTAKES allowed; default 3★=0, 2★≤2
  stickerSetId?: string // optional sticker-pool bias
}
```

### A.3 Reference wiring already shipped — `src/components/alphabet/AlphabetGame.tsx:100-101`
```ts
gameId: 'alphabet.quiz',
round: { length: 8, starThresholds: { three: 0, two: 2 } },
```
Copy this two-line shape into each English config (with the right `gameId`). This is the **entire**
change for the 3 quizzes.

### A.4 The three current English configs (exact insertion sites)

**`src/components/english/EnglishListenGame.tsx`** — config object `EnglishListenGame.tsx:18-47`.
Insert after `gameWelcomeType: 'englishlisten',` (line 40):
```ts
gameWelcomeType: 'englishlisten',
gameId: 'english.listen',
round: { length: 8, starThresholds: { three: 0, two: 2 } },
```

**`src/components/english/EnglishWordGame.tsx`** — config `EnglishWordGame.tsx:18-50`. Insert after
`gameWelcomeType: 'englishword',` (line 44):
```ts
gameWelcomeType: 'englishword',
gameId: 'english.word',
round: { length: 8, starThresholds: { three: 0, two: 2 } },
```

**`src/components/english/EnglishTranslateGame.tsx`** — config `EnglishTranslateGame.tsx:19-50`. Insert
after `gameWelcomeType: 'englishtranslate',` (line 44):
```ts
gameWelcomeType: 'englishtranslate',
gameId: 'english.translate',
round: { length: 8, starThresholds: { three: 0, two: 2 } },
```
> Do **not** touch `generateQuizItem`, `generateOptions`, or the audio callbacks in any of the three.

### A.5 Lær Engelsk milestone — pattern to copy from `src/components/math/NumberLearning.tsx`

The current browse file is `src/components/english/EnglishLearning.tsx` (full source below for context).
Apply these edits, copying the cited NumberLearning blocks:

**Imports (add):**
```ts
import StickerReveal from '../common/StickerReveal'
import { useCelebration } from '../common/CelebrationEffect'
import { progressStore, type StickerAward } from '../../services/progressStore'
```

**Constant (module scope):**
```ts
const ENGLISH_ACCENT = categoryThemes.english.accentColor
const EXPLORE_MILESTONE = 9 // award a sticker every N distinct English words tapped
```

**State/refs (inside component) — mirrors `NumberLearning.tsx:42-48`:**
```ts
const { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration } = useCelebration()
const exploredRef = useRef<Set<string>>(new Set())
const milestoneRef = useRef(0)
const [stickerAward, setStickerAward] = useState<StickerAward | null>(null)
const stickerTimer = useRef<NodeJS.Timeout | null>(null)
```
(also add a cleanup `useEffect` that clears `stickerTimer` on unmount, like `NumberLearning.tsx:70-75`.)

**Award helper — mirrors `NumberLearning.tsx:100-118`:**
```ts
const maybeAwardExploration = () => {
  const size = exploredRef.current.size
  const milestone = Math.floor(size / EXPLORE_MILESTONE)
  if (milestone > milestoneRef.current) {
    milestoneRef.current = milestone
    const award = progressStore.awardSticker()
    setStickerAward(award)
    celebrateTier('sticker')
    if (stickerTimer.current) clearTimeout(stickerTimer.current)
    stickerTimer.current = setTimeout(() => setStickerAward(null), 3600)
    try { audio.speak(`Nyt klistermærke! ${award.sticker.label}`).catch(() => {}) } catch { /* ignore */ }
  }
}
```

**Hook it into the existing tap handler** — current `handleWordClick`
(`EnglishLearning.tsx:28-39`). After `setPlayingWord(word.en)` add:
```ts
exploredRef.current.add(word.en)
maybeAwardExploration()
```
> Note: `maybeAwardExploration` calls `audio.speak(...)` for the sticker name; the existing
> `await audio.speakEnglish(word.en)` still runs in the same handler. The TTS engine has no queue
> (new audio cancels current), so call the award **before** `speakEnglish` is awaited, OR accept that
> the sticker-name announcement (Danish) plays and the word follows — match NumberLearning, which
> awards then speaks. Simplest: keep `speakEnglish` as the awaited word, and let `maybeAwardExploration`
> (which only speaks on the rare milestone) run first; on a milestone tap the Danish sticker line wins,
> which is the desired celebratory moment.

**Wire celebration into `GameShell`** — current shell open tag `EnglishLearning.tsx:42-48` has no
`celebration`. Add the prop (mirrors `NumberLearning.tsx:142-148`):
```tsx
<GameShell
  categoryId="english"
  title="Lær Engelsk"
  backRoute="/english"
  dense
  guide={false}
  celebration={{ show: showCelebration, intensity: celebrationIntensity, duration: celebrationDuration, onComplete: stopCelebration }}
>
```

**Render the reveal overlay** — copy `NumberLearning.tsx:216-232` just before `</GameShell>`:
```tsx
{stickerAward && (
  <Box
    onClick={() => setStickerAward(null)}
    sx={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}
  >
    <StickerReveal award={stickerAward} accent={ENGLISH_ACCENT} size={140} />
  </Box>
)}
```

### A.6 `StickerReveal` usage (verbatim from NumberLearning) — `src/components/math/NumberLearning.tsx:230`
```tsx
<StickerReveal award={stickerAward} accent={MATH_ACCENT} size={140} />
```
`StickerReveal` props: `{ award: StickerAward; accent: string; size?: number }`.

### A.7 `progressStore.awardSticker` — `src/services/progressStore.ts:240-245`
```ts
awardSticker(setId?: string): StickerAward   // omit setId → global pool; persists + notifies
```
Returns `StickerAward { sticker: Sticker; setId; setTitle; isNew; isShiny; count }`
(`progressStore.ts:49-56`).

### A.8 `useCelebration` — `src/components/common/CelebrationEffect.tsx`
```ts
useCelebration() => { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration }
// celebrateTier(tier: 'micro'|'streak'|'round'|'best'|'sticker'|'page')
```

### A.9 `GameShell` celebration prop — `src/components/common/GameShell.tsx`
```tsx
celebration?: { show: boolean; intensity?: 'low'|'medium'|'high'; duration?: number; onComplete?: () => void }
```

### A.10 Current `EnglishLearning.tsx` (full, for the implement session's reference)
The browse component as it exists now (theme-chip selector + word-card grid; `handleWordClick` at
lines 28-39; `GameShell` open tag at lines 42-48 with **no** `celebration`). Keep the selector and grid
exactly; only add the milestone machinery above. (Source: `src/components/english/EnglishLearning.tsx`.)

### A.11 Welcome strings already present — `src/utils/SimplifiedAudioController.ts:357-359`
```ts
englishlisten: 'Lyt og Find',
englishword: 'Find det Engelske Ord',
englishtranslate: 'Dansk til Engelsk',
```
No audio-controller change needed.

### A.12 Vocabulary (unchanged) — `src/config/englishVocab.ts`
`englishThemes` (9 themes, 84 words), `quizEnglishWords` (excludes `greetings` → 74), and
`pickDistractorWords(correct, count, pool=quizEnglishWords)` — all used **as-is**. No edits.
