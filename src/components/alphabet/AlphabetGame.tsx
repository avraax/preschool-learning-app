import React, { useRef } from 'react'
import UnifiedQuizGame, { UnifiedQuizConfig, QuizItem } from '../common/UnifiedQuizGame'
import { DANISH_PHRASES } from '../../config/danish-phrases'
import { categoryThemes } from '../../config/categoryThemes'
import { AlphabetRepeatButton } from '../common/RepeatButton'
import { progressStore } from '../../services/progressStore'
import { ALPHABET_QUIZ } from '../../config/difficulty'
import { confusablePoolFor, confusablesFor, shapeMatesFor } from '../../config/letterConfusables'
import { shuffle } from '../../utils/shuffle'
import { LETTER_QUIZ_WORDS, startsWithPhrase, startsWithQuestion, type QuizWord } from '../../config/letterWords'
import { ALPHABET_ROUND, alphabetPromptPool } from '../../config/promptPools'
import { alphabetHintLine } from '../../config/hintLines'
import { makePromptBag, type PromptBag } from '../../config/promptBag'
import { usePromptBag } from '../../hooks/usePromptBag'
import { wordArt } from '../../assets/games/wordArt'

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
  // `gameId` also wires W2: a missed letter is re-asked ~3 questions later, and the letters he misses
  // most lead each new pass. Order only — never the level (see config/practiceWeights.ts).
  const letterBag = usePromptBag<string>({ window: ALPHABET_ROUND, gameId: 'alphabet.quiz' })
  // WHICH picture a drawn letter shows cycles through that letter's words (Game Depth PRD-01 §3.6), one
  // small bag per letter, so B is a car, then a bus, then a banana … before any comes back. The LETTER
  // bag above is unchanged (pool 28, practice ledger keyed by letter).
  const wordBags = useRef(new Map<string, PromptBag<QuizWord>>())
  const nextWordFor = (letter: string): QuizWord => {
    const words = LETTER_QUIZ_WORDS[letter]
    let bag = wordBags.current.get(letter)
    if (!bag) {
      bag = makePromptBag(words, { key: (q) => q.word, window: 2 })
      wordBags.current.set(letter, bag)
    }
    return bag.next()
  }

  // Configuration for alphabet quiz
  const alphabetConfig: UnifiedQuizConfig = {
    // Quiz identification
    quizType: 'alphabet',

    // Content generation — all word-association (Overhaul -03-). The child sees a picture and picks
    // the letter the word starts with — training the first-sound/reading-precursor skill. The old
    // ~50% "hear the letter" recognition mode was retired (he knows every letter already).
    generateQuizItem: () => {
      const letter = letterBag.draw(alphabetPromptPool())
      const { word, art } = nextWordFor(letter)
      return {
        value: letter,
        display: letter,
        audioPrompt: startsWithQuestion(word),
        // The SHOWN word travels on the item: the correct-answer fact and the hint both read it, so
        // neither can name a different picture than the one on screen.
        repeatWord: word,
        // Show only the picture — NOT the word — so the child must recognise the starting letter from
        // the image, not just read it off the label. Baked soft-3D art from whichever section owns it.
        questionVisual: { art: wordArt(art) }
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

    gameId: 'alphabet.quiz',
    // ONE constant, two jobs (Endless Play PRD-01 W2): the `taskXp` normaliser AND the bag's no-repeat
    // window. Play itself is endless — nothing counts down to it.
    tasksInRound: ALPHABET_ROUND,

    // Never-fail hint (PRD-05 P1): after 2 wrong taps the correct letter tile pulses — and SPEAKS the
    // first-sound fact (Practice Loop PRD-01 W3), the same already-baked line the correct tap says.
    // Until now that sentence was only ever heard by the child who didn't need it.
    hintAfterNWrong: 2,
    speakHint: async (item: QuizItem, audio: any) =>
      audio.speak(alphabetHintLine(item.value as string, item.repeatWord)),

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
      // Shared builder — carries the per-letter fixes (Z → 'zet'; I and R override the frame). The word
      // is the one ON SCREEN (`repeatWord`), not the letter's canonical word.
      return item.repeatWord
        ? audio.speak(startsWithPhrase(item.value as string, String(item.repeatWord)))
        : audio.speakLetter(item.value)
    },

    getRepeatAudio: async (item: QuizItem, audio: any) => {
      return audio.speakQuizPromptWithRepeat(item.audioPrompt, item.repeatWord)
    }
  }

  return <UnifiedQuizGame config={alphabetConfig} />
}

export default AlphabetGame