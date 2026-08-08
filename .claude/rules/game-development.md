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

**Creating a new quiz, or reaching for a board primitive?** The `UnifiedQuizGame` config reference and
the shared-primitives catalogue moved to `.claude/rules/game-authoring.md` — read it before hand-rolling
anything, because re-fragmenting these is the mistake it exists to prevent.

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

## Guarding a game feature: config data must be IMPORTABLE, and the wiring needs its own guard

Two ways a game guard passes while the feature is broken. Both hit in one session, on the same change.

- **If a test needs to read a list, that list belongs in `src/config/`** — not in the `.tsx`. Pulling
  `TARGET_PRIORITY` out of `RamFarvenGame.tsx` with a regex matched every single-quoted lowercase word in
  the file, so the guard was satisfied by anything and proved nothing. Moving it to `colorMixing.ts` let
  the test import it and assert what actually mattered (**every goal a level asks for is mixable from
  that level's droplets**). This is the same rule as "data stranded in a `.tsx` can never be enumerated
  for prebake" — testability is the second reason, and it applies to any per-level content list.
- **A config/data test cannot see whether the component USES the config.** Every table can be perfect
  while the feature is entirely absent: deleting the single `desaturate={greyObject}` prop reverts
  Hvilken Farve to the pixel match, and reverting Ram Farven's goal ring to a percentage-sized absolute
  disc brings back the label overlap — with every data test green in both cases. Pair the data test with
  a **source-read guard** on the consuming component (comments stripped — see the `codeOf` helper in
  `src/components/rewardSurfaces.test.ts`), asserting the wiring exists and, where it matters, its
  CARDINALITY: exactly one `desaturate=` site, since two would grey the answer reveal too.
- Then prove both halves with `/re-break` — mutate the table for one entry and the component for another.
  A table-only break can pass while the component ignores the table completely.

## Interaction-language parity (hand-rolled task games)

Hand-rolled task games must match `UnifiedQuizGame`'s feedback language — the engine does all of this
internally, so only hand-rolled games can drift (this drift has bitten several games at once):

- A synchronous **`sfx.play('tap')` "every tap is felt" tick** at the TOP of the tap handler (right
  after `audio.cancelCurrentAudio()`, before the correct/wrong branch) so every press is felt even
  before the resolution sound.
- **`mascotBus.emit('streak')` alongside `celebrateTier('streak')`** on the streak milestone (the
  `r.streak % 3 === 0` line) so the corner mascot does its streak pose.
- `correct`/`wrong` mascot comes free via GameShell's `guideReaction` bridge (set `guideReaction`
  cheer/think); `round` comes free via `RewardOverlay`'s `'round'` emit when the ceremony opens (its
  only trigger now); `welcome` comes free
  via the themed wipe's `mascotBus.emit('welcome')` game-arrival cue. So a hand-rolled game only needs
  `tap` + `streak` + `hint` wired by hand.
- **Never `await` narration in a tap handler.** Resolve the answer synchronously — score,
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

## Five rules for a game board, and why each one exists

1. Show the full UI immediately — no loading overlay, no "Lytter…" screen. A 5-year-old reads a blank
   board as broken and taps somewhere else.
2. Gate interaction and content on `gameReady` (`{gameReady && options.length > 0 ? … : null}`), so the
   board is visible before it is answerable rather than answerable before it is populated.
3. Use the matching `RepeatButton` variant and disable it while its own clip plays, or the child
   re-triggers a line that cancels itself.
4. Call `audio.updateUserInteraction()` before audio in a tap handler (iOS drops playback without a
   recent gesture) and `audio.cancelCurrentAudio()` for fast tapping.
5. No component-level audio/`isPlaying` state — read it from the hook, for the reason in
   `audio-system.md`.

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
