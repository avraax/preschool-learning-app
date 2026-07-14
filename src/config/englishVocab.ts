// Beginner English vocabulary for the Engelsk section.
// Danish-scaffolded: `da` is the Danish translation (used for the Dansk→Engelsk game
// and instructions); `en` is the target English word; `emoji` is the picture.
// Every word has an emoji so it can be used as a picture answer in the quiz games.
import { shuffle } from '../utils/shuffle'

export interface EnglishWord {
  en: string
  da: string
  emoji: string
}

export interface EnglishTheme {
  id: string
  title: string // Danish theme name
  emoji: string // theme icon
  words: EnglishWord[]
}

export const englishThemes: EnglishTheme[] = [
  {
    id: 'animals',
    title: 'Dyr',
    emoji: '🐾',
    words: [
      { en: 'dog', da: 'hund', emoji: '🐕' },
      { en: 'cat', da: 'kat', emoji: '🐱' },
      { en: 'fish', da: 'fisk', emoji: '🐟' },
      { en: 'bird', da: 'fugl', emoji: '🐦' },
      { en: 'cow', da: 'ko', emoji: '🐄' },
      { en: 'horse', da: 'hest', emoji: '🐴' },
      { en: 'pig', da: 'gris', emoji: '🐷' },
      { en: 'duck', da: 'and', emoji: '🦆' },
      { en: 'bear', da: 'bjørn', emoji: '🐻' },
      { en: 'lion', da: 'løve', emoji: '🦁' }
    ]
  },
  {
    id: 'food',
    title: 'Mad',
    emoji: '🍎',
    words: [
      { en: 'apple', da: 'æble', emoji: '🍎' },
      { en: 'banana', da: 'banan', emoji: '🍌' },
      { en: 'milk', da: 'mælk', emoji: '🥛' },
      { en: 'bread', da: 'brød', emoji: '🍞' },
      { en: 'egg', da: 'æg', emoji: '🥚' },
      { en: 'cheese', da: 'ost', emoji: '🧀' },
      { en: 'water', da: 'vand', emoji: '💧' },
      { en: 'cake', da: 'kage', emoji: '🍰' },
      { en: 'ice cream', da: 'is', emoji: '🍦' },
      { en: 'cookie', da: 'småkage', emoji: '🍪' }
    ]
  },
  {
    id: 'objects',
    title: 'Ting',
    emoji: '🧸',
    words: [
      { en: 'ball', da: 'bold', emoji: '⚽' },
      { en: 'car', da: 'bil', emoji: '🚗' },
      { en: 'book', da: 'bog', emoji: '📖' },
      { en: 'chair', da: 'stol', emoji: '🪑' },
      { en: 'bed', da: 'seng', emoji: '🛏️' },
      { en: 'cup', da: 'kop', emoji: '☕' },
      { en: 'shoe', da: 'sko', emoji: '👟' },
      { en: 'hat', da: 'hat', emoji: '🎩' },
      { en: 'door', da: 'dør', emoji: '🚪' },
      { en: 'key', da: 'nøgle', emoji: '🔑' }
    ]
  },
  {
    id: 'numbers',
    title: 'Tal',
    emoji: '🔢',
    words: [
      { en: 'one', da: 'en', emoji: '1️⃣' },
      { en: 'two', da: 'to', emoji: '2️⃣' },
      { en: 'three', da: 'tre', emoji: '3️⃣' },
      { en: 'four', da: 'fire', emoji: '4️⃣' },
      { en: 'five', da: 'fem', emoji: '5️⃣' },
      { en: 'six', da: 'seks', emoji: '6️⃣' },
      { en: 'seven', da: 'syv', emoji: '7️⃣' },
      { en: 'eight', da: 'otte', emoji: '8️⃣' },
      { en: 'nine', da: 'ni', emoji: '9️⃣' },
      { en: 'ten', da: 'ti', emoji: '🔟' }
    ]
  },
  {
    id: 'colors',
    title: 'Farver',
    emoji: '🎨',
    words: [
      { en: 'red', da: 'rød', emoji: '🔴' },
      { en: 'blue', da: 'blå', emoji: '🔵' },
      { en: 'green', da: 'grøn', emoji: '🟢' },
      { en: 'yellow', da: 'gul', emoji: '🟡' },
      { en: 'orange', da: 'orange', emoji: '🟠' },
      { en: 'purple', da: 'lilla', emoji: '🟣' },
      { en: 'pink', da: 'lyserød', emoji: '🩷' },
      { en: 'black', da: 'sort', emoji: '⚫' },
      { en: 'white', da: 'hvid', emoji: '⚪' },
      { en: 'brown', da: 'brun', emoji: '🟤' }
    ]
  },
  {
    id: 'body',
    title: 'Krop',
    emoji: '🧍',
    words: [
      { en: 'hand', da: 'hånd', emoji: '✋' },
      { en: 'foot', da: 'fod', emoji: '🦶' },
      { en: 'eye', da: 'øje', emoji: '👁️' },
      { en: 'ear', da: 'øre', emoji: '👂' },
      { en: 'nose', da: 'næse', emoji: '👃' },
      { en: 'mouth', da: 'mund', emoji: '👄' },
      { en: 'tooth', da: 'tand', emoji: '🦷' },
      { en: 'hair', da: 'hår', emoji: '🦱' }
    ]
  },
  {
    id: 'family',
    title: 'Familie',
    emoji: '👨‍👩‍👧',
    words: [
      { en: 'mom', da: 'mor', emoji: '👩' },
      { en: 'dad', da: 'far', emoji: '👨' },
      { en: 'baby', da: 'baby', emoji: '👶' },
      { en: 'girl', da: 'pige', emoji: '👧' },
      { en: 'boy', da: 'dreng', emoji: '👦' },
      { en: 'grandma', da: 'bedstemor', emoji: '👵' },
      { en: 'grandpa', da: 'bedstefar', emoji: '👴' },
      { en: 'family', da: 'familie', emoji: '👨‍👩‍👧' }
    ]
  },
  {
    id: 'nature',
    title: 'Natur',
    emoji: '🌳',
    words: [
      { en: 'sun', da: 'sol', emoji: '☀️' },
      { en: 'moon', da: 'måne', emoji: '🌙' },
      { en: 'star', da: 'stjerne', emoji: '⭐' },
      { en: 'tree', da: 'træ', emoji: '🌳' },
      { en: 'flower', da: 'blomst', emoji: '🌸' },
      { en: 'rain', da: 'regn', emoji: '🌧️' },
      { en: 'snow', da: 'sne', emoji: '❄️' },
      { en: 'cloud', da: 'sky', emoji: '☁️' }
    ]
  },
  {
    id: 'greetings',
    title: 'Hilsner',
    emoji: '👋',
    words: [
      { en: 'hello', da: 'hej', emoji: '👋' },
      { en: 'goodbye', da: 'farvel', emoji: '🙋' },
      { en: 'thank you', da: 'tak', emoji: '🙏' },
      { en: 'please', da: 'vær så venlig', emoji: '🥺' },
      { en: 'yes', da: 'ja', emoji: '✅' },
      { en: 'no', da: 'nej', emoji: '❌' },
      { en: 'good morning', da: 'godmorgen', emoji: '🌅' },
      { en: 'good night', da: 'godnat', emoji: '🌙' }
    ]
  }
]

// All words flattened (used by the Explore game).
export const allEnglishWords: EnglishWord[] = englishThemes.flatMap(t => t.words)

// Concrete picture words for the quiz games (excludes the abstract greetings,
// which don't work as 4-option picture distractors). Animals, food, objects,
// numbers and colors all have clear, distinct emoji.
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
