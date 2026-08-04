// WHAT the never-fail hint SAYS, per game (Practice Loop PRD-01 W3).
//
// A wrong answer used to teach nothing: a soft `wrong` SFX, a broken first-try flag, and after two
// wrongs a pulsing tile. That is a pointer, not an explanation — and the app already speaks the right
// sentence ("Wienerbrød starter med W"), but only on the CORRECT tap, i.e. only to the child who did not
// need it. So the hint now speaks the line that NAMES THE ANSWER.
//
// It must not read as punishment: this is identification, the same distinction that lets Ram Farven name
// a wrong-but-real mix ("rød og gul bliver orange") without ever saying "forkert".
//
// ## The rule, and why it costs no new narration
//
// **Speak the already-baked line that names the answer; where none exists, re-speak the prompt; where
// the prompt must stay silent, stay silent.** Every line below was verified against `prebakedTts.ts`
// before being written, and `hintLines.test.ts` re-verifies it on every run — a hint that reached live
// Azure would be an unauditioned clip paid for at the one moment the child is already stuck.
//
// This table is DATA read by the games AND by that test. A test with its own copy of the lines would
// pass against a value nothing renders (`adultSettingsIa`'s lesson).
//
// PURE + Node-importable → relative imports need an explicit `.ts` extension.
import { DANISH_PHRASES, getDanishLetterName } from './danish-phrases.ts'
import { colorObjectFactText, sequenceFactText, sequenceNumbers, sequenceStarts } from './gamePhrases.ts'
import { LETTER_WORDS, WORD_LETTERS, startsWithPhrase } from './letterWords.ts'
import { quizEnglishWords } from './englishVocab.ts'
import { spellingWordsFor } from './ordlegWords.ts'
import { quizObjectPool, spokenColor, type QuizObject } from './colorContent.ts'
import { LEVELS, MATH_COUNTING } from './difficulty.ts'

/** Which voice speaks a hint — Danish narration, or the en-US voice for the English section. */
export type HintVoice = 'da' | 'en'

export interface HintSpec {
  /** `null` → this game's hint is deliberately SILENT, and `reason` says why. */
  voice: HintVoice | null
  /** Required for a silent hint, and used to record a deviation or a reuse. */
  reason?: string
  /** EVERY line this hint can ever speak — what the prebake guard walks. Empty for a silent hint. */
  lines: () => readonly string[]
}

// ---- The line builders the GAMES call ------------------------------------------------------------
// One per shape of hint. Each is the exact string enumerated in `shared-narration-clips.js`, reached
// through the same builder the rest of the app uses.

/** Bogstav Quiz: "Wienerbrød starter med W" — already built, baked and audited for the correct tap. */
export const alphabetHintLine = (letter: string): string =>
  startsWithPhrase(letter, LETTER_WORDS[letter]?.word ?? letter)

/** Tal Quiz: re-speak the prompt, "Find tallet 37". The fact IS the prompt for a listen-only board. */
export const numberHintLine = (n: number): string => DANISH_PHRASES.gamePrompts.findNumber(n)

/** Both English quizzes: re-speak the English word (the prompt), in the English voice. */
export const englishHintLine = (en: string): string => en

/** Hvilken Farve?: "æblet er rødt" — the same identification line a correct drop speaks. */
export const colorQuizHintLine = (o: QuizObject): string =>
  colorObjectFactText(o.objectNameDefinite, spokenColor(o.color, o.neuter))

/**
 * Stav Ordet: the NAME of the letter the hint is pulsing.
 *
 * DEVIATION from PRD §5.2, which asked for `letterPhrase(letter, word)` ("K som Kat"). Two reasons, the
 * first fatal: that template means "{letter} as in {word}", so it is only true when the word STARTS with
 * the letter — for a letter in the middle it produces "O som ko", which teaches a child learning letter
 * shapes something false. And it would need 156 new clips (one per letter×word), against §5.2's own
 * "near-zero new narration" rule. The letter NAME is baked for all 29, and it is already this game's
 * own language: placing a letter echoes exactly this.
 */
export const spellingHintLine = (letter: string): string => getDanishLetterName(letter)

// ---- The table ----------------------------------------------------------------------------------

/** Every number Tal Quiz can ask, across levels — the range its hint line spans. */
const countingRange = (): number[] => {
  const max = Math.max(...LEVELS.map((l) => MATH_COUNTING[l].max))
  return Array.from({ length: max }, (_, i) => i + 1)
}

/** Every letter Stav Ordet can pulse, across levels. */
const spellingLetters = (): string[] => {
  const out = new Set<string>()
  for (const level of LEVELS) {
    for (const w of spellingWordsFor(level)) {
      for (const ch of w.word.toUpperCase()) out.add(ch)
    }
  }
  return [...out]
}

/**
 * Keyed by `gameId`, TOTAL over every game that has a never-fail hint — `hintLines.test.ts` derives that
 * set from the components themselves, so a new game with a hint must land here with a decision.
 */
export const HINT_LINES: Record<string, HintSpec> = {
  'alphabet.quiz': {
    voice: 'da',
    lines: () => WORD_LETTERS.map(alphabetHintLine),
  },
  'math.counting': {
    voice: 'da',
    reason: 'the board shows nothing but a speaker by design, so re-speaking the prompt IS the fact',
    lines: () => countingRange().map(numberHintLine),
  },
  'math.patterns': {
    voice: 'da',
    reason: "reuses its existing speakCorrectFact — the finished sequence read back, already baked",
    lines: () => sequenceStarts.map((s) => sequenceFactText(sequenceNumbers(s))),
  },
  'english.listen': {
    voice: 'en',
    lines: () => quizEnglishWords.map((w) => englishHintLine(w.en)),
  },
  'english.word': {
    voice: 'en',
    lines: () => quizEnglishWords.map((w) => englishHintLine(w.en)),
  },
  'colors.quiz': {
    voice: 'da',
    // The 'colour' pool is a superset of the 'grey' one, so this covers every level.
    lines: () => quizObjectPool('colour').map(colorQuizHintLine),
  },
  'ordleg.spelling': {
    voice: 'da',
    reason: 'the letter NAME, not "K som Kat" — see spellingHintLine for why that template is wrong here',
    lines: () => spellingLetters().map(spellingHintLine),
  },

  // ---- Deliberately SILENT ------------------------------------------------------------------------
  'ordleg.read': {
    voice: null,
    reason:
      'Læs Ordet never reads its prompt word aloud — silent decoding IS the exercise (standing owner rule). ' +
      'The hint stays the picture pulse alone. This is a CONTENT FACT, not an omission: do not "fix" it.',
    lines: () => [],
  },

  // ---- Deferred: hand-rolled games outside W3's scope ---------------------------------------------
  // Each of these has a never-fail hint and no spoken line yet. They are listed so the table stays
  // total and each carries a decision — not because speaking them would be wrong.
  'colors.farvejagt': {
    voice: null,
    reason:
      'the hint pulses ONE of several correct objects, and the prompt already names the colour ' +
      '("Find alle røde ting") with a repeat button — there is no single answer to identify',
    lines: () => [],
  },
  'colors.nuancer': {
    voice: null,
    reason:
      'the answer is an ORDERING (light→dark), which no sentence names; its instruction is already ' +
      'spoken and repeatable',
    lines: () => [],
  },
  'colors.ramfarven': {
    voice: null,
    reason:
      'deferred — its recipe line ("rød og blå bliver lilla") would work and is already baked, but the ' +
      'recipe reveal is this game\'s reward for a correct mix; handing it over at hint time needs the ' +
      "owner's call, not a code decision",
    lines: () => [],
  },
  'math.comparison': {
    voice: null,
    reason:
      'deferred — outside PRD-01 §5.2\'s list. Its fact line ("otte er større end to") exists and is ' +
      'baked, so this is one line of wiring whenever it is wanted',
    lines: () => [],
  },
  'math.addition': {
    voice: null,
    reason:
      'deferred — outside PRD-01 §5.2\'s list. `mathFactText` ("tre plus fire er syv") exists and is baked',
    lines: () => [],
  },
  'math.subtraction': {
    voice: null,
    reason:
      'deferred — outside PRD-01 §5.2\'s list. `mathFactText` exists and is baked',
    lines: () => [],
  },
}

/** The spec for a game, or `null` if that game has no never-fail hint at all. */
export const hintSpecFor = (gameId: string | undefined): HintSpec | null =>
  (gameId ? HINT_LINES[gameId] : undefined) ?? null
