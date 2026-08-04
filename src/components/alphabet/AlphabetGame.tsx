import React from 'react'
import UnifiedQuizGame, { UnifiedQuizConfig, QuizItem } from '../common/UnifiedQuizGame'
import { DANISH_PHRASES } from '../../config/danish-phrases'
import { categoryThemes } from '../../config/categoryThemes'
import { AlphabetRepeatButton } from '../common/RepeatButton'
import { progressStore } from '../../services/progressStore'
import { ALPHABET_QUIZ } from '../../config/difficulty'
import { confusablePoolFor, confusablesFor, shapeMatesFor } from '../../config/letterConfusables'
import { shuffle } from '../../utils/shuffle'
import { LETTER_WORDS, startsWithPhrase, startsWithQuestion } from '../../config/letterWords'
import { ALPHABET_ROUND, alphabetPromptPool } from '../../config/promptPools'
import { usePromptBag } from '../../hooks/usePromptBag'
import { letterArt } from '../../assets/games/alphabet'

// Full Danish alphabet including special characters
const DANISH_ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Æ', 'Ø', 'Å']

// Which letters are confusable with which is DATA (src/config/letterConfusables.ts) — two tiers, the
// tight look-/sound-alike groups (M/N, B/D/P, Æ/Ø/Å…) and the broader shape/sound families. It lives in
// config so `difficulty.test.ts` can assert Svær never has to fall back to random letters; see that
// module's header for why the broad tier exists at all.

// Word-association mode: child sees an emoji + Danish word and picks the starting letter.
// Only letters with a clear, child-friendly Danish word are included (Q, W, X omitted).
// LETTER_WORDS + WORD_LETTERS are the shared canonical table (src/config/letterWords.ts),
// also used by Lær Alfabetet — kept in one place so the two never drift.

const AlphabetGame: React.FC = () => {
  // Prompt letters come from a BAG, not a random pick (Practice Loop PRD-01 W1): 8 questions sampled
  // with replacement from 28 letters repeated something ~66% of rounds, which is why a child could be
  // asked the same picture twice while 20 letters went unasked. One shuffled pass = 8 distinct letters,
  // every time.
  // The no-repeat WINDOW is the round length, so a round can't repeat even across a bag refill.
  const letterBag = usePromptBag<string>({ window: ALPHABET_ROUND })

  // Configuration for alphabet quiz
  const alphabetConfig: UnifiedQuizConfig = {
    // Quiz identification
    quizType: 'alphabet',

    // Content generation — all word-association (Overhaul -03-). The child sees a picture and picks
    // the letter the word starts with — training the first-sound/reading-precursor skill. The old
    // ~50% "hear the letter" recognition mode was retired (he knows every letter already).
    generateQuizItem: () => {
      const letter = letterBag.draw(alphabetPromptPool())
      const { word } = LETTER_WORDS[letter]
      return {
        value: letter,
        display: letter,
        audioPrompt: startsWithQuestion(word),
        repeatWord: word,
        // Show only the picture — NOT the word — so the child must recognise the starting letter from
        // the image, not just read it off the label. The subject is the baked soft-3D object (PRD-07;
        // the whole 29-letter set is baked and shipping).
        questionVisual: { art: letterArt(letter) }
      }
    },
    
    // Distractor POLICY is the difficulty axis (Difficulty PRD-01 §4.2), and this is where Svær used to
    // be DEAD: `level === 'normal' || level === 'svaer'` seeded the identical group, so the two levels
    // were byte-identical. Now:
    //   Let    (`exclude`) — every confusable, tight AND broad, kept OUT: maximally dissimilar, 3 tiles.
    //   Normal (`seed`)    — the tight group first, random top-up: unchanged behaviour, 4 tiles.
    //   Svær   (`only`)    — the confusable pool is the WHOLE set (tight first, then the shape/sound
    //                        families), random only if it somehow ran short: 5 tiles.
    // Q/W/X can only ever appear as distractors (never the asked letter — see WORD_LETTERS above).
    generateOptions: (correctAnswer: QuizItem, optionCount: number) => {
      const toLetterItem = (letter: string): QuizItem => ({
        value: letter,
        display: letter,
        audioPrompt: DANISH_PHRASES.gamePrompts.findLetter(letter),
        repeatWord: letter
      })

      const { confusables } = ALPHABET_QUIZ[progressStore.difficultyFor('alphabet')]
      const correctLetter = correctAnswer.value as string
      const need = optionCount - 1

      const preferred =
        confusables === 'only'
          ? // Tight group first (the sharpest confusions), then the broad families — shuffled WITHIN
            // each tier so the ordering stays a preference, not a fixed answer pattern.
            [...shuffle(confusablesFor(correctLetter)), ...shuffle(shapeMatesFor(correctLetter))]
          : confusables === 'seed'
            ? shuffle(confusablesFor(correctLetter))
            : []
      // Let excludes BOTH tiers, so nothing on the board is a near-miss.
      const excluded = confusables === 'exclude' ? new Set(confusablePoolFor(correctLetter)) : null

      const picks: string[] = []
      for (const letter of preferred) {
        if (picks.length >= need) break
        if (!picks.includes(letter)) picks.push(letter)
      }
      let guard = 0
      while (picks.length < need && guard++ < 500) {
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
    RepeatButtonComponent: AlphabetRepeatButton,
    
    // Audio configuration
    gameWelcomeType: 'alphabet',

    // Bounded round (Overhaul Foundation §3) — reference wiring / smoke test. 8 questions, then the
    // result/reward hero. Star thresholds come from the difficulty spine (Difficulty PRD-01 W6).
    gameId: 'alphabet.quiz',
    // ONE round length: the bag's no-repeat window reads the same constant (Practice Loop PRD-01 W1).
    round: { length: ALPHABET_ROUND },

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
      // Shared builder — carries the sentence-context respellings (Z → 'zet'). NOTE: I is still
      // known-wrong in this sentence-FINAL position; the comma fix that works for "I, som Is" doesn't
      // transfer here (see startsWithPhrase).
      return data
        ? audio.speak(startsWithPhrase(item.value as string, data.word))
        : audio.speakLetter(item.value)
    },

    getRepeatAudio: async (item: QuizItem, audio: any) => {
      return audio.speakQuizPromptWithRepeat(item.audioPrompt, item.repeatWord)
    }
  }

  return <UnifiedQuizGame config={alphabetConfig} />
}

export default AlphabetGame