---
paths:
  - "src/components/alphabet/*.tsx"
  - "src/components/math/*.tsx"
  - "src/components/farver/*.tsx"
  - "src/components/english/*.tsx"
  - "src/components/ordleg/*.tsx"
  - "src/components/learning/*.tsx"
  - "src/components/common/UnifiedQuizGame.tsx"
---

# Game Development Rules

## Two Game Types

**Task-based** (quiz/problem): the child is asked something and taps/drags an answer.
Examples: AlphabetGame, MathGame, MathOperationGame, ComparisonGame, HvadManglerGame, MemoryGame,
the three English quizzes, LaesOrdetGame, SpellingGame, and the five Farver games
(FarvejagtGame, RamFarvenGame, FarveQuizGame, NuancerGame — all bounded-round drag games).

**Learning-based** (exploration): the child freely browses and taps to hear, no scoring.
Examples: AlphabetLearning, NumberLearning, EnglishLearning, FarverLearning (Lær Farver).
- Direct audio on tap, no entry coordination needed. No round; earns **live per-new-item browse XP**
  via `useBrowseXp(section)` (each distinct item feeds the shared cross-game level — see CLAUDE.md
  Progression). No stickers here (they became level-up trophies).

## Prefer UnifiedQuizGame for new quizzes

Most task-based quizzes are a thin **config** over `src/components/common/UnifiedQuizGame.tsx`
(see AlphabetGame, MathGame, the three English games, LaesOrdetGame, HvadManglerGame). The config
(`UnifiedQuizConfig`) provides:

- **Content**: `generateQuizItem()`, `generateOptions(correct, optionCount)` (return the shuffled tile set
  — use `shuffle()` from `src/utils/shuffle.ts`, never a biased `.sort(() => Math.random())`).
  **`optionCount` is resolved CENTRALLY by the engine** from the difficulty table
  (`optionCountFor(gameId, level)` — 3/4/5, or 3/4/6 for Læs Ordet's picture tiles), so no config
  hand-rolls it; each game still owns *which* distractors it picks and must return exactly that many
  items. The grid's columns + width envelope follow the count via the shared
  `src/components/common/answerGrid.ts` (also used by the hand-rolled `MathOperationGame`) — never
  hardcode `repeat(2)`/`repeat(4)` in a game again, and never leave a row holding a single tile.
- **Chrome**: `title`, `emoji`, `theme` (a `CategoryTheme`), `RepeatButtonComponent`, `backRoute`,
  `showRepeat` (default true). There is **no score/progress chip** — `ScoreChip` and GameShell's
  `score` slot were deleted (owner, 2026-08-02): a per-question pip row was a second progress meter
  inches from the reward ring, and 8 pips is past the subitizing limit. The ring is the only meter.
- **Audio**: `gameWelcomeType` (add the string to `GAME_WELCOME_MESSAGES` in
  `SimplifiedAudioController.playGameWelcome`) + the callbacks `speakQuizPrompt`, `speakClickedItem`,
  `getRepeatAudio`. Optional `speakCorrectFact(item)` speaks a **completed fact** on a correct tap
  INSTEAD of echoing the tapped item (single channel — replaces, never stacks; e.g. Hvad Mangler's
  finished sequence). `skipFirstPrompt` suppresses voicing the first prompt when the welcome already
  said it.
- **Bounded round + rewards** (opt-in): set `round` (a `RoundConfig`, default 8 questions) **and**
  `gameId` (stable progress id, e.g. `'alphabet.quiz'`). **Don't set `starThresholds`** — they come from
  the difficulty spine at finish time (`starThresholdsFor(level)`), which is what makes Svær more
  forgiving; a config that pins its own would opt that game out of the fairness rule. The engine then
  runs the round via `useRound`, ends on `RoundResultScreen`, and records to `progressStore`
  (stars/bests). Absent → legacy endless behavior. Wrong answers never punish; they only
  break the question's first-try flag. Put the `gameId` on the **`RoundConfig`** too (hand-rolls pass
  it to `useRound`; `UnifiedQuizGame` threads `config.gameId` in) so `useRound.completeQuestion`
  grants **live per-task XP** — see CLAUDE.md Progression. Stickers are level-up trophies, not per-round.
- **Never-fail hint** (PRD-05): `hintAfterNWrong` (2 for every config quiz) pulses the correct
  `AnswerTile` after that many wrong taps (reduced-motion → static glow). The 2 wrongs already broke
  first-try, so no extra star bookkeeping.
- **Custom hero**: `renderHero(item, ctx)` renders a richer subject in the focal zone (`PromptFocus`)
  instead of the default glyph/emoji — used today by Tal Quiz (the shared `ListenHero`, since its answer
  is audio-only) and Hvad Mangler (the sequence with a pulsing "?").
- **Hear-before-commit** (`previewBeforeCommit`) — supported by the engine but **NO game opts in
  today**. It makes a tap a two-step answer: 1st tap AUDITIONS the tile (`speakClickedItem` + the
  shared `'selected'` state — a lifted accent outline, NOT correct/wrong colours) and returns WITHOUT
  scoring; a 2nd tap on the SAME tile commits. english.word/.translate used it (PRD-14 W7) so a
  pre-reader could hear each unreadable English word before choosing — **removed 2026-07-31 after
  play-testing**: the owner's 5-year-old read the ignored first tap as a broken game and kept tapping.
  Their prompts already speak the target word, so single-tap keeps them real print recognition.
  **Before re-enabling it anywhere, solve the discoverability problem** — an unscored first tap needs a
  signal a pre-reader actually reads.
- **First-letter cue** (PRD-18 W1): `questionVisual.emphasizeFirstLetter` renders a word-only prompt
  with an oversized full-strength first grapheme + muted rest — a SILENT decode nudge (Læs Ordet).
  Opt-in **because the word-only prompt render is shared with Dansk til Engelsk** (a plain word) — never
  blanket-change that render; scope via the flag.

Only hand-roll a full component for genuinely novel mechanics (e.g. SpellingGame, SpeakWordGame, and
the dnd-kit Farver games — see `.claude/rules/drag-and-drop.md`). **MathOperationGame (+/−) and
ComparisonGame stay hand-rolled** despite ~cloning the engine's scaffold: they have bespoke
*post-correct-tap* animations (the equation reveal; the krokodille mouth chomping toward the bigger
number) and the engine has no `onCorrectAnimate`-style callback — absorbing them into `UnifiedQuizGame`
needs that hook added first (it would touch all 7 config quizzes, so verify carefully).

## Shared primitives — reuse, don't re-fragment

- **Never-fail hint** → `useNeverFailHint` (`src/hooks/useNeverFailHint.ts`), used by the engine AND
  the hand-rolled games. Each game keeps its OWN reset boundary (per question / slot / board / target)
  and decides whether to nudge the mascot — that variance is **intentional, not drift; don't "unify"
  it**. The hook owns only the wrong-counter + threshold trip + the pulse state.
- **Shuffle** → `shuffle()` (`src/utils/shuffle.ts`), a non-mutating Fisher-Yates. Never the biased
  `.sort(() => Math.random() - 0.5)` idiom, and never sort shared config in place.
- **Drag games** → the `src/components/common/dnd/` primitives (see `.claude/rules/drag-and-drop.md`).
- **Game-board surfaces** → `TactileTile` (pressable clay tile), `PromptFocus` (in-world focal zone),
  `TactilePill` (HUD pills; `AnswerTile`/`RepeatButton` ride these) via `src/theme/depth.ts`
  (`softShadow`/`contactShadow`). New or hand-rolled game surfaces reuse these — don't re-invent tile
  depth, a keyboard-lip button, or a frosted `PromptStage` card (PRD-06 F1/F2/F4). The Foundation's
  swap auto-upgraded only the **shared engines** (`UnifiedQuizGame`/`UnifiedMemoryGame`/`LearningGrid`);
  **hand-rolled games + screens that render `PromptStage` directly still show the old frosted card** and
  must be migrated to `PromptFocus` per area — check with a `PromptStage` import grep before assuming a
  game already upgraded. Dense no-scroll grids (Lær Tal at 1–100 = 10 rows) must pass `TactileTile`'s
  **`compact`** prop — otherwise its 44px min-height + padding overflow the short rows and tiles overlap
  the row below; `LearningGrid` trips it automatically for numbers >60. A 2D grid of many small cells
  additionally needs **`field`**: the primitive's defaults are built for a roomy board, and at chart
  density they broke three ways at once (opaque tops merging into one white slab over the world, an outer
  state ring clipped by the grid's `overflow:hidden` stage, and every tile's drop-shadow pooling into a grey
  wash across the whole board). `field` swaps in a translucent surface, an inset ring and a tight
  shadow — the two props are separate axes, so set both. Measurements + rationale live on the prop's doc
  comment and `depth.ts`'s `fieldShadow()`.
- **Baked game-art** (pictorial subjects, per-section) → `src/assets/games/<section>/index.ts`
  eager-`import.meta.glob`s `*.webp` keyed by content id → a sync `letterArt()`-style helper.
  **Art-gated**: empty until the owner's keyed WebP are dropped in (auto-registers, no code change);
  consumers fall back to emoji/glyph until then. Use ASCII aliases (`AE`/`OE`/`AA`) for filesystem-awkward
  glyphs. Render hooks: quiz hero via `QuizItem.questionVisual.art` (→ `HeroArt`), Memory via
  `MemoryItemDisplay.iconArt`, browse bloom via `PromptFocus`. **Glyphs stay type — only depicted
  subjects are baked** (recognising the letter/number IS the lesson). Art generation + keying:
  `.claude/rules/scene-assets.md`.

## Interaction-language parity (hand-rolled task games)

Hand-rolled task games must match `UnifiedQuizGame`'s feedback language — the engine does all of this
internally, so only hand-rolled games can drift (this drift has bitten several games at once):

- A synchronous **`sfx.play('tap')` "every tap is felt" tick** at the TOP of the tap handler (right
  after `audio.cancelCurrentAudio()`, before the correct/wrong branch) so every press is felt even
  before the resolution sound.
- **`mascotBus.emit('streak')` alongside `celebrateTier('streak')`** on the streak milestone (the
  `r.streak % 3 === 0` line) so the corner mascot does its streak pose.
- `correct`/`wrong` mascot comes free via GameShell's `guideReaction` bridge (set `guideReaction`
  cheer/think); `round` comes free via `RoundResultScreen`'s own `'round'` emit; `welcome` comes free
  via the themed wipe's `mascotBus.emit('welcome')` game-arrival cue. So a hand-rolled game only needs
  `tap` + `streak` + `hint` wired by hand.
- **NEVER `await` narration in a tap handler** (2026-08-02). Resolve the answer SYNCHRONOUSLY — score,
  `celebrateTier`, any reveal — then fire the echo/fact with `void audio.speak(…).catch(() => {})` and
  schedule the advance on a fixed dwell from the tap: `DWELL_FACT` if a sentence was spoken, else
  `DWELL_CORRECT()` (`src/theme/motion.ts` documents the measured basis). Awaiting had put the whole
  celebration AFTER the clip — measured 4s on Plus Opgaver, whose confetti and answer-reveal then landed
  in the same frame as the next problem. The Farver drag games were always the correct pattern; copy
  those. Two bonuses: the advance timer is now created synchronously, so the unmount cleanup always has
  it to clear (PRD-02 P4's `mountedRef` guard is retired in the games that no longer await), and a
  `.catch` on the promise keeps a rejection from reaching the crash reporter.
- **An `AnimatePresence mode="wait"` swap must exit on a TWEEN, never a spring** — use `EXIT_FAST`
  (`src/theme/motion.ts`). `mode="wait"` holds the incoming element until the outgoing one's animation
  completes, and a spring on `opacity: 0` takes ~1s to settle: Plus Opgaver's `?`→answer reveal was
  measured 1043ms late even though the state flipped on the tap. The ENTER keeps its bouncy `POP`; only
  the leaving element has to get out of the way fast.
- **A dynamic (non-prebaked) line a game can compose EARLY should be warmed early** — `audio.warmSpeech(text)`
  at question-generation time (see the math games' `factText`). Azure costs ~1.1s, and paying it on the
  correct tap is paying it at the one moment that must feel instant. Build the text in ONE helper used by
  both the warm and the playback: the cache is keyed on the exact string, so any drift silently misses.

## Entry-audio pattern for hand-rolled task-based games

There is **no** `entryAudioManager` and **no** `useTaskBasedGame` hook. The real pattern is a
welcome message followed by a readiness gate:

```typescript
const audio = useSimplifiedAudioHook({ componentId: 'MyGame', autoInitialize: false })
const [gameReady, setGameReady] = useState(false)
const [audioInitialized, setAudioInitialized] = useState(false)
const hasInitialized = useRef(false)

useEffect(() => {
  if (hasInitialized.current) return
  hasInitialized.current = true
  if (audio.isAudioReady) { setAudioInitialized(true); playWelcomeAndStart() }
}, [])

useEffect(() => {                 // start once audio becomes ready (if it wasn't at mount)
  if (audio.isAudioReady && !audioInitialized && !hasInitialized.current) {
    hasInitialized.current = true; setAudioInitialized(true); playWelcomeAndStart()
  }
}, [audio.isAudioReady, audioInitialized])

const playWelcomeAndStart = async () => {
  try {
    await audio.playGameWelcome('myGameType')      // add the string to GAME_WELCOME_MESSAGES
    setTimeout(() => { setGameReady(true); generateNewProblem() }, isIOS() ? 1000 : 1500)
  } catch { setGameReady(true); generateNewProblem() }
}
```

## Strict Rules

1. **MUST** show full UI immediately — never use loading overlays or "Lytter..." screens.
2. **MUST** gate interaction/content on `gameReady` (conditional render: `{gameReady && options.length > 0 ? ... : null}`).
3. **MUST** use the right `RepeatButton` variant and disable it appropriately.
4. **MUST** call `audio.updateUserInteraction()` before audio in tap handlers (iOS), and `audio.cancelCurrentAudio()` for fast tapping.
5. **MUST NOT** create component-level audio/`isPlaying` state — use the hook (see `audio-system.md`).

## Advance-lock, timers & unmount hygiene (task-based games)

A correct answer must resolve a question **exactly once**, and nothing may fire after the child
leaves the screen. Both `UnifiedQuizGame` and the hand-rolled task games (`MathOperationGame`,
`ComparisonGame`, `SpellingGame`) follow this (drag games have the equivalent "advance-guard" — see
`drag-and-drop.md`):

- **Advance-lock**: an `isAdvancing` **ref** set synchronously on a correct tap **before any
  `await`**, checked at the very top of the tap handler, released when the next question generates.
  A `setLocked`/state flag alone is too late — a same-tick double-tap reads the stale value. This
  stops double-record (double stickers/stars on the last question) and stops a tap during the
  celebration dwell from breaking the earned first-try.
- **Track every `setTimeout`** (prompt/echo/advance) in refs and clear them in a **dedicated
  empty-dep unmount effect** — not the init effect's cleanup, which re-runs when its deps change.
- **The advance timer is scheduled AFTER the echo `await`**, so clearing timers on unmount is not
  enough: navigating away during the echo lets the post-await continuation schedule a timer that
  speaks the next prompt over the menu. Guard the continuation with a `mounted` ref checked right
  after each `await`.
- **The `mounted` ref must own its own empty-dep effect** (`true` on mount, `false` on cleanup). If
  it's cleared inside a shared init-effect cleanup that early-returns on re-run, React StrictMode's
  dev mount→cleanup→remount strands it `false` and freezes all advances.

## RepeatButton Variants

From `src/components/common/RepeatButton.tsx`:
- `AlphabetRepeatButton` — blue
- `MathRepeatButton` — purple
- `ColorRepeatButton` — orange
- `EnglishRepeatButton` — green
- `OrdlegRepeatButton` — teal


## Audio in Games

Always use the `useSimplifiedAudioHook()` hook. See `audio-system.md` for the full rules.

## Theming

Use centralized themes from `src/config/categoryThemes.ts`:
```typescript
import { getCategoryTheme } from '../../config/categoryThemes'
const theme = getCategoryTheme('alphabet') // or 'math' | 'colors' | 'english' | 'ordleg'
```
