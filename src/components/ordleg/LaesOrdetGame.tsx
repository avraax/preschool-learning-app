import React, { useRef } from 'react'
import UnifiedQuizGame, { UnifiedQuizConfig, QuizItem } from '../common/UnifiedQuizGame'
import { getCategoryTheme } from '../../config/categoryThemes'
import { stickerSetForSection } from '../../config/stickers'
import { OrdlegScoreChip } from '../common/ScoreChip'
import { OrdlegRepeatButton } from '../common/RepeatButton'
import { progressStore, type DifficultyLevel } from '../../services/progressStore'
import { shuffle } from '../../utils/shuffle'
import { ordlegArt } from '../../assets/games/ordleg'

// Læs Ordet: the written Danish word is shown (no picture); the child reads it and
// taps the matching picture from 4 options. The word is NOT read aloud — the child must
// read it themselves (that's the whole point). Easiest level: short, familiar 2–3 letter
// words for a beginning reader who can't spell yet.
//
// Visual uplift (PRD-10 §3.3): the prompt WORD stays type (reading it IS the lesson), but the
// answer *pictures* become baked soft-3D word-pictures — `art` is the ASCII art id (§4; Danish
// glyphs aliased: æg→aeg, ræv→raev). Resolved via `ordlegArt(w.art)`; `emoji` is the art-gated
// fallback until the batch lands. The whole pool is concrete/depictable, so once art lands a
// question never mixes baked art with emoji tiles.
interface ReadingWord {
  word: string
  emoji: string
  art: string
}

const READING_WORDS: ReadingWord[] = [
  { word: 'ko', emoji: '🐄', art: 'ko' },
  { word: 'is', emoji: '🍦', art: 'is' },
  { word: 'æg', emoji: '🥚', art: 'aeg' },
  { word: 'ur', emoji: '⌚', art: 'ur' },
  { word: 'so', emoji: '🐖', art: 'so' },
  { word: 'kat', emoji: '🐱', art: 'kat' },
  { word: 'sol', emoji: '☀️', art: 'sol' },
  { word: 'hus', emoji: '🏠', art: 'hus' },
  { word: 'bil', emoji: '🚗', art: 'bil' },
  { word: 'bog', emoji: '📖', art: 'bog' },
  { word: 'mus', emoji: '🐭', art: 'mus' },
  { word: 'and', emoji: '🦆', art: 'and' },
  { word: 'sko', emoji: '👟', art: 'sko' },
  { word: 'hat', emoji: '🎩', art: 'hat' },
  { word: 'ost', emoji: '🧀', art: 'ost' },
  { word: 'tog', emoji: '🚂', art: 'tog' },
  { word: 'bus', emoji: '🚌', art: 'bus' },
  { word: 'ræv', emoji: '🦊', art: 'raev' },
  { word: 'ged', emoji: '🐐', art: 'ged' },
  { word: 'haj', emoji: '🦈', art: 'haj' },
  { word: 'abe', emoji: '🐒', art: 'abe' },
  { word: 'ski', emoji: '🎿', art: 'ski' }
]

// Let (Overhaul §5.7/Appendix A): restrict the PROMPT word to the shortest (2-letter) entries —
// gentler than Normal's 2–3-letter mix. Distractor pictures still draw from the full list (below)
// so the option pool never runs dry. Ordleg's floor never grows past 3 letters at any level.
const TWO_LETTER_WORDS = READING_WORDS.filter(w => w.word.length === 2)

const LaesOrdetGame: React.FC = () => {
  const toItem = (w: ReadingWord): QuizItem => ({
    value: w.word,
    display: w.emoji,
    audioPrompt: w.word,
    repeatWord: w.word,
    // The option's baked soft-3D picture (§3.1 answer-tile art path); undefined until the art batch
    // lands → the tile falls back to the `display` emoji, no code change.
    art: ordlegArt(w.art)
  })

  // Anti-repeat guard (PRD-05 P4): remember the last few prompt words so the small Let pool doesn't
  // show the same word back-to-back. Persists across questions (LaesOrdetGame has no state, so it
  // renders once and this ref is stable).
  const recentRef = useRef<string[]>([])

  const config: UnifiedQuizConfig = {
    quizType: 'ordleg',

    generateQuizItem: () => {
      const level: DifficultyLevel = progressStore.difficultyFor('ordleg')
      // Let draws only 2-letter prompt words (gentler); Normal/Svær keep today's full 2–3-letter
      // pool — Svær's extra challenge is MORE distractor pictures below, never longer words.
      const pool = level === 'let' ? TWO_LETTER_WORDS : READING_WORDS
      // Avoid the most-recent words (window shrinks to fit a small pool so there's always a choice).
      const window = Math.min(3, Math.max(1, pool.length - 1))
      const recent = new Set(recentRef.current.slice(-window))
      const candidates = pool.filter((w) => !recent.has(w.word))
      const choices = candidates.length > 0 ? candidates : pool
      const w = choices[Math.floor(Math.random() * choices.length)]
      recentRef.current.push(w.word)
      if (recentRef.current.length > 6) recentRef.current.shift()
      return {
        ...toItem(w),
        // Word shown as text, no picture in the prompt — the child must read it.
        questionVisual: { emoji: '', word: w.word.toUpperCase() }
      }
    },

    generateOptions: (correct: QuizItem) => {
      const level: DifficultyLevel = progressStore.difficultyFor('ordleg')
      // Svær: more distractor PICTURES (6 instead of 4) — the one difficulty axis left once word
      // length is fixed gentle at every level.
      const optionCount = level === 'svaer' ? 6 : 4
      const correctWord = READING_WORDS.find(w => w.word === correct.value) || READING_WORDS[0]
      const options: QuizItem[] = [toItem(correctWord)]
      const shuffled = shuffle(READING_WORDS)
      for (const w of shuffled) {
        if (options.length >= optionCount) break
        if (!options.find(o => o.value === w.word)) options.push(toItem(w))
      }
      return shuffle(options)
    },

    title: 'Læs Ordet',
    emoji: '📖',
    teacherCharacter: 'owl',
    // Live, skin-aware ordleg theme (§3.6) — the static `categoryThemes.ordleg` is bound to the kid
    // tokens and would show kid-skin colours on Havet/Rummet/Dino.
    theme: getCategoryTheme('ordleg'),
    backRoute: '/ordleg',

    ScoreChipComponent: OrdlegScoreChip,
    RepeatButtonComponent: OrdlegRepeatButton,
    // No "Gentag" button — there's nothing to repeat; the child reads the word silently.
    showRepeat: false,

    gameWelcomeType: 'laesordet',

    // Bounded round of 8 + shared reward flow (Overhaul Ordleg §1). The engine handles
    // everything: rounds, first-try/streak tracking, celebration tiers, wrong SFX, and the
    // RoundResultScreen → progressStore.recordRoundResult('ordleg.read', …).
    round: { length: 8, starThresholds: { three: 0, two: 2 }, stickerSetId: stickerSetForSection('ordleg') },
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
