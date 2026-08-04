import React from 'react'
import UnifiedQuizGame, { UnifiedQuizConfig, QuizItem } from '../common/UnifiedQuizGame'
import { getCategoryTheme } from '../../config/categoryThemes'
import { OrdlegRepeatButton } from '../common/RepeatButton'
import { progressStore } from '../../services/progressStore'
import { ORDLEG_READ } from '../../config/difficulty'
import { READING_ROUND_LENGTH, READING_WORDS, type OrdlegWord } from '../../config/ordlegWords'
import { ordlegWordKey, readingPromptPool } from '../../config/promptPools'
import { usePromptBag } from '../../hooks/usePromptBag'
import { shuffle } from '../../utils/shuffle'
import { ordlegArt } from '../../assets/games/ordleg'

// Læs Ordet: the written Danish word is shown (no picture); the child reads it and
// taps the matching picture from 4 options. The word is NOT read aloud — the child must
// read it themselves (that's the whole point). Easiest level: short, familiar 2–3 letter
// words for a beginning reader who can't spell yet.
//
// Visual uplift (PRD-10 §3.3): the prompt WORD stays type (reading it IS the lesson), but the
// answer *pictures* are baked soft-3D word-pictures — `art` is the ASCII art id (§4; Danish glyphs
// aliased: æg→aeg, ræv→raev), resolved via `ordlegArt(w.art)`. The whole pool is concrete/depictable
// and fully baked (PRD-12 dropped the emoji fallback), so a question is always all-picture tiles.
//
// The word list itself moved to `src/config/ordlegWords.ts` (Difficulty PRD-01 W5): this game SPEAKS
// the tapped picture's name, and a list stranded in a `.tsx` can never be enumerated for prebake — so
// most of these words were quietly falling through to live Azure.

const LaesOrdetGame: React.FC = () => {
  const toItem = (w: OrdlegWord): QuizItem => ({
    value: w.word,
    // The tile renders the baked picture (`art`); `display` is only the non-visual label (never an
    // emoji) used if art were ever missing.
    display: w.word,
    audioPrompt: w.word,
    repeatWord: w.word,
    // The option's baked soft-3D picture (§3.1 answer-tile art path).
    art: ordlegArt(w.art)
  })

  // Prompt words come from a BAG (Practice Loop PRD-01 W1), and the old recent-3 window is DELETED
  // rather than kept beside it — it bounded ADJACENCY, not frequency, so the 9-word Let pool could
  // still hand out four words across a round of 8 while five went unasked. That is also why growing
  // this pool from 5 to 9 words (2026-08-03, against "reads as stuck rather than easy") didn't fix what
  // it was bought for: sampling with replacement repeats at any pool size.
  // `gameId` also wires W2's re-ask + front-load (order only — never the level).
  const wordBag = usePromptBag<OrdlegWord>({
    key: ordlegWordKey,
    window: READING_ROUND_LENGTH,
    gameId: 'ordleg.read',
  })

  const config: UnifiedQuizConfig = {
    quizType: 'ordleg',

    generateQuizItem: () => {
      // Let draws only 2-letter prompt words (gentler); Normal/Svær keep the full 2–3-letter pool —
      // Svær's extra challenge is MORE distractor pictures below, never longer words (standing owner
      // rule: he can't spell yet), which is why `wordMaxLen` never exceeds 3. The per-level filter is
      // `readingPromptPool` so the simulation in promptBag.test.ts measures this exact pool.
      const w = wordBag.draw(readingPromptPool(progressStore.difficultyFor('ordleg')))
      return {
        ...toItem(w),
        // Word shown as text, no picture in the prompt — the child must read it (never spoken: the
        // whole point of the game). Every letter renders identically; PRD-18 W1's larger/bolder
        // first-letter decode cue was removed 2026-08-03 (owner: too much focus, and it made the
        // uppercase remainder read as lowercase).
        questionVisual: { emoji: '', word: w.word.toUpperCase() }
      }
    },

    // `optionCount` now arrives from the engine's shared axis (Difficulty PRD-01 W3) — 3 / 4 / **6**,
    // the 6 kept because these tiles are PICTURES rather than glyphs, so they stay readable in a 3×2 grid.
    generateOptions: (correct: QuizItem, optionCount: number) => {
      const { sharedInitials } = ORDLEG_READ[progressStore.difficultyFor('ordleg')]
      const correctWord = READING_WORDS.find(w => w.word === correct.value) || READING_WORDS[0]
      const correctInitial = correctWord.word[0]
      // Let/Normal (PRD-14 W2 / audit §F): distractor pictures must NOT share the correct word's
      // initial letter, so decoding the FIRST SOUND is a winning strategy instead of a trap. The word
      // is still never read aloud (silent decoding IS the exercise). Svær allows shared initials as its
      // extra challenge, alongside the 6-picture grid.
      const distractorPool =
        sharedInitials ? READING_WORDS : READING_WORDS.filter(w => w.word[0] !== correctInitial)
      const options: QuizItem[] = [toItem(correctWord)]
      for (const w of shuffle(distractorPool)) {
        if (options.length >= optionCount) break
        if (!options.find(o => o.value === w.word)) options.push(toItem(w))
      }
      // Safety top-up (keeps the option count stable if a filtered pool ever ran short).
      if (options.length < optionCount) {
        for (const w of shuffle(READING_WORDS)) {
          if (options.length >= optionCount) break
          if (!options.find(o => o.value === w.word)) options.push(toItem(w))
        }
      }
      return shuffle(options)
    },

    title: 'Læs Ordet',
    teacherCharacter: 'owl',
    // Live, skin-aware ordleg theme (§3.6) — the static `categoryThemes.ordleg` is bound to the kid
    // tokens and would show kid-skin colours on Havet/Rummet/Dino.
    theme: getCategoryTheme('ordleg'),
    backRoute: '/ordleg',

    RepeatButtonComponent: OrdlegRepeatButton,
    // No "Gentag" button — there's nothing to repeat; the child reads the word silently.
    showRepeat: false,

    gameWelcomeType: 'laesordet',

    // Bounded round of 8 + shared reward flow (Overhaul Ordleg §1). The engine handles
    // everything: rounds, first-try/streak tracking, celebration tiers, wrong SFX, and the
    // RoundResultScreen → progressStore.recordRoundResult('ordleg.read', …).
    // Star thresholds come from the difficulty spine (Difficulty PRD-01 W6).
    // From config, not a literal: `ordlegWords.test.ts` guards every level's word pool against it, so
    // a pool can never again be smaller than the round it has to fill (Let had 5 words for 8 questions).
    round: { length: READING_ROUND_LENGTH },
    gameId: 'ordleg.read',

    // Never-fail hint (PRD-05 P1): after 2 wrong picture taps the correct picture pulses.
    hintAfterNWrong: 2,

    // The prompt word is NEVER spoken (reading it aloud would defeat the exercise), so both
    // the prompt and the repeat audio are no-ops. Tapping a picture still names the child's
    // choice; the correct/wrong cue still plays (handled by UnifiedQuizGame).
    speakQuizPrompt: async () => '',
    speakClickedItem: async (item: QuizItem, audio: any) => audio.speak(String(item.value)),
    getRepeatAudio: async () => ''
  }

  return <UnifiedQuizGame config={config} />
}

export default LaesOrdetGame
