import React from 'react'
import UnifiedQuizGame, { UnifiedQuizConfig, QuizItem } from '../common/UnifiedQuizGame'
import { DANISH_PHRASES } from '../../config/danish-phrases'
import { categoryThemes } from '../../config/categoryThemes'
import { stickerSetForSection } from '../../config/stickers'
import { AlphabetScoreChip } from '../common/ScoreChip'
import { AlphabetRepeatButton } from '../common/RepeatButton'
import { progressStore, type DifficultyLevel } from '../../services/progressStore'
import { shuffle } from '../../utils/shuffle'
import { LETTER_WORDS, WORD_LETTERS } from '../../config/letterWords'
import { letterArt } from '../../assets/games/alphabet'

// Full Danish alphabet including special characters
const DANISH_ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Æ', 'Ø', 'Å']

// Svær (Overhaul §5.7/Appendix A): letters commonly confused — visually similar shapes, or
// Danish vowels that sound alike — biasing distractors toward a genuine reading challenge
// instead of uniformly random letters. Let uses these same groups the OTHER way: distractors
// are kept OUT of the correct letter's group, so they read as maximally easy/dissimilar.
const CONFUSABLE_GROUPS: string[][] = [
  ['M', 'N'],
  ['Æ', 'Ø', 'Å'],
  ['B', 'D', 'P'],
  ['E', 'Æ'],
  ['O', 'Å'],
  ['I', 'Y'],
]

const confusablesFor = (letter: string): string[] => {
  const set = new Set<string>()
  for (const group of CONFUSABLE_GROUPS) {
    if (group.includes(letter)) {
      for (const g of group) if (g !== letter) set.add(g)
    }
  }
  return [...set]
}

// Word-association mode: child sees an emoji + Danish word and picks the starting letter.
// Only letters with a clear, child-friendly Danish word are included (Q, W, X omitted).
// LETTER_WORDS + WORD_LETTERS are the shared canonical table (src/config/letterWords.ts),
// also used by Lær Alfabetet — kept in one place so the two never drift.

const AlphabetGame: React.FC = () => {
  // Configuration for alphabet quiz
  const alphabetConfig: UnifiedQuizConfig = {
    // Quiz identification
    quizType: 'alphabet',

    // Content generation — all word-association (Overhaul -03-). The child sees a picture and picks
    // the letter the word starts with — training the first-sound/reading-precursor skill. The old
    // ~50% "hear the letter" recognition mode was retired (he knows every letter already).
    generateQuizItem: () => {
      const letter = WORD_LETTERS[Math.floor(Math.random() * WORD_LETTERS.length)]
      const { word } = LETTER_WORDS[letter]
      return {
        value: letter,
        display: letter,
        audioPrompt: `Hvad starter ${word} med?`,
        repeatWord: word,
        // Show only the picture — NOT the word — so the child must recognise the starting letter from
        // the image, not just read it off the label. The subject is the baked soft-3D object (PRD-07;
        // the whole 29-letter set is baked and shipping).
        questionVisual: { art: letterArt(letter) }
      }
    },
    
    generateOptions: (correctAnswer: QuizItem) => {
      const toLetterItem = (letter: string): QuizItem => ({
        value: letter,
        display: letter,
        audioPrompt: DANISH_PHRASES.gamePrompts.findLetter(letter),
        repeatWord: letter
      })

      const level: DifficultyLevel = progressStore.difficultyFor('alphabet')

      const correctLetter = correctAnswer.value as string
      // Near-confusable distractors are now the DEFAULT (PRD-14 W2 / audit §A2). Normal + Svær both
      // seed with the correct letter's confusable group (M/N, Æ/Ø/Å, B/D/P, look-/sound-alike vowels)
      // so a right answer means the child actually told them apart — not just spotted an outlier. Let
      // still EXCLUDES that group so its distractors stay maximally dissimilar (easiest). Q/W/X can
      // only ever appear as random top-ups (never the correct answer — see WORD_LETTERS above).
      const preferred = level === 'normal' || level === 'svaer' ? shuffle(confusablesFor(correctLetter)) : []
      const excluded = level === 'let' ? new Set(confusablesFor(correctLetter)) : null

      const picks: string[] = []
      for (const letter of preferred) {
        if (picks.length >= 3) break
        picks.push(letter)
      }
      while (picks.length < 3) {
        const randomLetter = DANISH_ALPHABET[Math.floor(Math.random() * DANISH_ALPHABET.length)]
        if (randomLetter === correctLetter || picks.includes(randomLetter)) continue
        if (excluded && excluded.has(randomLetter)) continue
        picks.push(randomLetter)
      }

      const options: QuizItem[] = [correctAnswer, ...picks.map(toLetterItem)]
      return shuffle(options)
    },
    
    // Display configuration
    title: 'Bogstav Quiz',
    teacherCharacter: 'owl',
    theme: categoryThemes.alphabet,
    backRoute: '/alphabet',
    
    // Component configuration
    ScoreChipComponent: AlphabetScoreChip,
    RepeatButtonComponent: AlphabetRepeatButton,
    
    // Audio configuration
    gameWelcomeType: 'alphabet',

    // Bounded round (Overhaul Foundation §3) — reference wiring / smoke test. 8 questions,
    // then the result/reward hero. 3★ = no mistakes, 2★ ≤ 2, else 1★. Global sticker pool.
    gameId: 'alphabet.quiz',
    round: { length: 8, starThresholds: { three: 0, two: 2 }, stickerSetId: stickerSetForSection('alphabet') },

    // Never-fail hint (PRD-05 P1): after 2 wrong taps the correct letter tile pulses.
    hintAfterNWrong: 2,

    // Audio methods
    speakQuizPrompt: async (item: QuizItem, audio: any) => {
      return audio.speakQuizPromptWithRepeat(item.audioPrompt, item.repeatWord)
    },
    
    speakClickedItem: async (item: QuizItem, audio: any) => {
      return audio.speakLetter(item.value)
    },

    // Reinforce the skill on a correct answer (PRD-14 W3 / audit §A3): speak the completed fact
    // "{ord} starter med {bogstav}" (e.g. "Wienerbrød starter med W") instead of echoing the bare
    // letter name — turning a right tap into a repeat of the first-sound lesson. Every askable letter
    // (WORD_LETTERS) has a LETTER_WORDS entry; guard anyway and fall back to the letter name. New
    // closed-set phrase → prebaked + auditioned (see docs/audit).
    speakCorrectFact: async (item: QuizItem, audio: any) => {
      const data = LETTER_WORDS[item.value as string]
      return data ? audio.speak(`${data.word} starter med ${item.value}`) : audio.speakLetter(item.value)
    },

    getRepeatAudio: async (item: QuizItem, audio: any) => {
      return audio.speakQuizPromptWithRepeat(item.audioPrompt, item.repeatWord)
    }
  }

  return <UnifiedQuizGame config={alphabetConfig} />
}

export default AlphabetGame