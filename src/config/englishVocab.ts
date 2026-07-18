// Beginner English vocabulary for the Engelsk section.
// Danish-scaffolded: `da` is the Danish translation (used for the Dansk→Engelsk game
// and instructions); `en` is the target English word.
// Every word's picture is a baked soft-3D WebP resolved by `englishArt(englishArtId(en))`
// (PRD-11 concrete words + PRD-12 body/family/greetings) — there is NO emoji field anymore
// (the whole section is baked; see `src/assets/games/{english,shared}`).
// Explicit .ts extension so Node's ESM resolver (used by prebake-tts.mjs / shared-narration-clips.js
// via type-stripping) can resolve this too; tsconfig allowImportingTsExtensions + Vite accept it.
import { shuffle } from '../utils/shuffle.ts'

export interface EnglishWord {
  en: string
  da: string
}

export interface EnglishTheme {
  id: string
  title: string // Danish theme name
  words: EnglishWord[]
}

export const englishThemes: EnglishTheme[] = [
  {
    id: 'animals',
    title: 'Dyr',
    words: [
      { en: 'dog', da: 'hund' },
      { en: 'cat', da: 'kat' },
      { en: 'fish', da: 'fisk' },
      { en: 'bird', da: 'fugl' },
      { en: 'cow', da: 'ko' },
      { en: 'horse', da: 'hest' },
      { en: 'pig', da: 'gris' },
      { en: 'duck', da: 'and' },
      { en: 'bear', da: 'bjørn' },
      { en: 'lion', da: 'løve' }
    ]
  },
  {
    id: 'food',
    title: 'Mad',
    words: [
      { en: 'apple', da: 'æble' },
      { en: 'banana', da: 'banan' },
      { en: 'milk', da: 'mælk' },
      { en: 'bread', da: 'brød' },
      { en: 'egg', da: 'æg' },
      { en: 'cheese', da: 'ost' },
      { en: 'water', da: 'vand' },
      { en: 'cake', da: 'kage' },
      { en: 'ice cream', da: 'is' },
      { en: 'cookie', da: 'småkage' }
    ]
  },
  {
    id: 'objects',
    title: 'Ting',
    words: [
      { en: 'ball', da: 'bold' },
      { en: 'car', da: 'bil' },
      { en: 'book', da: 'bog' },
      { en: 'chair', da: 'stol' },
      { en: 'bed', da: 'seng' },
      { en: 'cup', da: 'kop' },
      { en: 'shoe', da: 'sko' },
      { en: 'hat', da: 'hat' },
      { en: 'door', da: 'dør' },
      { en: 'key', da: 'nøgle' }
    ]
  },
  {
    id: 'numbers',
    title: 'Tal',
    words: [
      { en: 'one', da: 'en' },
      { en: 'two', da: 'to' },
      { en: 'three', da: 'tre' },
      { en: 'four', da: 'fire' },
      { en: 'five', da: 'fem' },
      { en: 'six', da: 'seks' },
      { en: 'seven', da: 'syv' },
      { en: 'eight', da: 'otte' },
      { en: 'nine', da: 'ni' },
      { en: 'ten', da: 'ti' }
    ]
  },
  {
    id: 'colors',
    title: 'Farver',
    words: [
      { en: 'red', da: 'rød' },
      { en: 'blue', da: 'blå' },
      { en: 'green', da: 'grøn' },
      { en: 'yellow', da: 'gul' },
      { en: 'orange', da: 'orange' },
      { en: 'purple', da: 'lilla' },
      { en: 'pink', da: 'lyserød' },
      { en: 'black', da: 'sort' },
      { en: 'white', da: 'hvid' },
      { en: 'brown', da: 'brun' }
    ]
  },
  {
    id: 'body',
    title: 'Krop',
    words: [
      { en: 'hand', da: 'hånd' },
      { en: 'foot', da: 'fod' },
      { en: 'eye', da: 'øje' },
      { en: 'ear', da: 'øre' },
      { en: 'nose', da: 'næse' },
      { en: 'mouth', da: 'mund' },
      { en: 'tooth', da: 'tand' },
      { en: 'hair', da: 'hår' }
    ]
  },
  {
    id: 'family',
    title: 'Familie',
    words: [
      { en: 'mom', da: 'mor' },
      { en: 'dad', da: 'far' },
      { en: 'baby', da: 'baby' },
      { en: 'girl', da: 'pige' },
      { en: 'boy', da: 'dreng' },
      { en: 'grandma', da: 'bedstemor' },
      { en: 'grandpa', da: 'bedstefar' },
      { en: 'family', da: 'familie' }
    ]
  },
  {
    id: 'nature',
    title: 'Natur',
    words: [
      { en: 'sun', da: 'sol' },
      { en: 'moon', da: 'måne' },
      { en: 'star', da: 'stjerne' },
      { en: 'tree', da: 'træ' },
      { en: 'flower', da: 'blomst' },
      { en: 'rain', da: 'regn' },
      { en: 'snow', da: 'sne' },
      { en: 'cloud', da: 'sky' }
    ]
  },
  {
    id: 'greetings',
    title: 'Hilsner',
    words: [
      { en: 'hello', da: 'hej' },
      { en: 'goodbye', da: 'farvel' },
      { en: 'thank you', da: 'tak' },
      { en: 'please', da: 'vær så venlig' },
      { en: 'yes', da: 'ja' },
      { en: 'no', da: 'nej' },
      { en: 'good morning', da: 'godmorgen' },
      { en: 'good night', da: 'godnat' }
    ]
  }
]

// All words flattened (used by the Explore game).
export const allEnglishWords: EnglishWord[] = englishThemes.flatMap(t => t.words)

// Concrete picture words for the quiz games (excludes the abstract greetings,
// which don't work as 4-option picture distractors). Animals, food, objects,
// numbers, colors, body, family and nature all have clear, distinct pictures.
export const quizEnglishWords: EnglishWord[] = englishThemes
  .filter(t => t.id !== 'greetings')
  .flatMap(t => t.words)

// Pick `count` distinct random words from a pool, always including `correct`.
export const pickDistractorWords = (
  correct: EnglishWord,
  count: number,
  pool: EnglishWord[] = quizEnglishWords
): EnglishWord[] => {
  const options: EnglishWord[] = [correct]
  const shuffled = shuffle(pool)
  for (const w of shuffled) {
    if (options.length >= count) break
    if (!options.find(o => o.en === w.en)) {
      options.push(w)
    }
  }
  return shuffle(options)
}
