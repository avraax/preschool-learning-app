// Sticker album content (Overhaul Foundation — System 2).
//
// The shared collectible pool. Stickers are emoji-based in v1 (consistent with the app's emoji
// content). Sets are APP-WIDE pages, not per-section: any game awards from the global pool.
// Adding a set or sticker is data-only — append below and the album page picks it up.
//
// Danish labels are spoken aloud (TTS) on reveal and when tapped in the album, so keep them
// simple, child-recognisable words.

export type StickerRarity = 'normal' | 'shiny'

export interface Sticker {
  id: string // stable, unique across ALL sets (used as the progress key)
  label: string // Danish name, spoken on reveal/tap
  emoji: string
  rarity?: StickerRarity
}

export interface StickerSet {
  id: string
  title: string // Danish page title
  emoji: string // page/tab icon
  stickers: Sticker[]
}

export const STICKER_SETS: StickerSet[] = [
  {
    id: 'dyr',
    title: 'Dyr',
    emoji: '🐾',
    stickers: [
      { id: 'dyr-hund', label: 'Hund', emoji: '🐕' },
      { id: 'dyr-kat', label: 'Kat', emoji: '🐱' },
      { id: 'dyr-ko', label: 'Ko', emoji: '🐄' },
      { id: 'dyr-hest', label: 'Hest', emoji: '🐴' },
      { id: 'dyr-gris', label: 'Gris', emoji: '🐷' },
      { id: 'dyr-faar', label: 'Får', emoji: '🐑' },
      { id: 'dyr-kanin', label: 'Kanin', emoji: '🐰' },
      { id: 'dyr-raev', label: 'Ræv', emoji: '🦊' },
      { id: 'dyr-bjoern', label: 'Bjørn', emoji: '🐻' },
    ],
  },
  {
    id: 'koeretoejer',
    title: 'Køretøjer',
    emoji: '🚗',
    stickers: [
      { id: 'kt-bil', label: 'Bil', emoji: '🚗' },
      { id: 'kt-bus', label: 'Bus', emoji: '🚌' },
      { id: 'kt-tog', label: 'Tog', emoji: '🚂' },
      { id: 'kt-fly', label: 'Fly', emoji: '✈️' },
      { id: 'kt-baad', label: 'Båd', emoji: '⛵' },
      { id: 'kt-cykel', label: 'Cykel', emoji: '🚲' },
      { id: 'kt-lastbil', label: 'Lastbil', emoji: '🚚' },
      { id: 'kt-helikopter', label: 'Helikopter', emoji: '🚁' },
      { id: 'kt-raket', label: 'Raket', emoji: '🚀' },
    ],
  },
  {
    id: 'mad',
    title: 'Mad',
    emoji: '🍎',
    stickers: [
      { id: 'mad-aeble', label: 'Æble', emoji: '🍎' },
      { id: 'mad-banan', label: 'Banan', emoji: '🍌' },
      { id: 'mad-jordbaer', label: 'Jordbær', emoji: '🍓' },
      { id: 'mad-gulerod', label: 'Gulerod', emoji: '🥕' },
      { id: 'mad-broed', label: 'Brød', emoji: '🍞' },
      { id: 'mad-ost', label: 'Ost', emoji: '🧀' },
      { id: 'mad-is', label: 'Is', emoji: '🍦' },
      { id: 'mad-kage', label: 'Kage', emoji: '🍰' },
      { id: 'mad-pizza', label: 'Pizza', emoji: '🍕' },
    ],
  },
  {
    id: 'natur',
    title: 'Natur',
    emoji: '🌳',
    stickers: [
      { id: 'natur-trae', label: 'Træ', emoji: '🌳' },
      { id: 'natur-blomst', label: 'Blomst', emoji: '🌸' },
      { id: 'natur-sol', label: 'Sol', emoji: '☀️' },
      { id: 'natur-maane', label: 'Måne', emoji: '🌙' },
      { id: 'natur-stjerne', label: 'Stjerne', emoji: '⭐' },
      { id: 'natur-regnbue', label: 'Regnbue', emoji: '🌈' },
      { id: 'natur-sky', label: 'Sky', emoji: '☁️' },
      { id: 'natur-svamp', label: 'Svamp', emoji: '🍄' },
      { id: 'natur-blad', label: 'Blad', emoji: '🍁' },
    ],
  },
  {
    id: 'havet',
    title: 'Havet',
    emoji: '🌊',
    stickers: [
      { id: 'hav-fisk', label: 'Fisk', emoji: '🐟' },
      { id: 'hav-haj', label: 'Haj', emoji: '🦈' },
      { id: 'hav-hval', label: 'Hval', emoji: '🐳' },
      { id: 'hav-delfin', label: 'Delfin', emoji: '🐬' },
      { id: 'hav-sael', label: 'Sæl', emoji: '🦭' },
      { id: 'hav-krabbe', label: 'Krabbe', emoji: '🦀' },
      { id: 'hav-blaeksprutte', label: 'Blæksprutte', emoji: '🐙' },
      { id: 'hav-skildpadde', label: 'Skildpadde', emoji: '🐢' },
      { id: 'hav-musling', label: 'Musling', emoji: '🐚' },
    ],
  },
  {
    id: 'smaakryb',
    title: 'Småkryb',
    emoji: '🐞',
    stickers: [
      { id: 'kryb-sommerfugl', label: 'Sommerfugl', emoji: '🦋' },
      { id: 'kryb-bi', label: 'Bi', emoji: '🐝' },
      { id: 'kryb-mariehoene', label: 'Mariehøne', emoji: '🐞' },
      { id: 'kryb-myre', label: 'Myre', emoji: '🐜' },
      { id: 'kryb-edderkop', label: 'Edderkop', emoji: '🕷️' },
      { id: 'kryb-snegl', label: 'Snegl', emoji: '🐌' },
      { id: 'kryb-larve', label: 'Larve', emoji: '🐛' },
      { id: 'kryb-bille', label: 'Bille', emoji: '🪲' },
      { id: 'kryb-graeshoppe', label: 'Græshoppe', emoji: '🦗' },
    ],
  },
  {
    id: 'legetoej',
    title: 'Legetøj',
    emoji: '🧸',
    stickers: [
      { id: 'leg-bold', label: 'Bold', emoji: '⚽' },
      { id: 'leg-ballon', label: 'Ballon', emoji: '🎈' },
      { id: 'leg-bamse', label: 'Bamse', emoji: '🧸' },
      { id: 'leg-drage', label: 'Drage', emoji: '🪁' },
      { id: 'leg-terning', label: 'Terning', emoji: '🎲' },
      { id: 'leg-robot', label: 'Robot', emoji: '🤖' },
      { id: 'leg-puslespil', label: 'Puslespil', emoji: '🧩' },
      { id: 'leg-tromme', label: 'Tromme', emoji: '🥁' },
      { id: 'leg-guitar', label: 'Guitar', emoji: '🎸' },
    ],
  },
]

// Which set each section biases its awards toward (PRD-09 P3 — per-section page payoffs). A game
// draws from its section's set until that page is full, then falls back to the global uncollected
// pool (see progressStore.grantSticker), so the album still completes across a multi-week tail.
export type StickerSection = 'alphabet' | 'math' | 'colors' | 'english' | 'ordleg'
const SECTION_STICKER_SET: Record<StickerSection, string> = {
  alphabet: 'dyr',
  math: 'koeretoejer',
  colors: 'natur',
  english: 'mad',
  ordleg: 'havet',
}
export const stickerSetForSection = (section: StickerSection): string =>
  SECTION_STICKER_SET[section]

// ----- lookups (built once) -----

const ALL_STICKERS: Sticker[] = STICKER_SETS.flatMap((s) => s.stickers)
const STICKER_BY_ID = new Map<string, Sticker>(ALL_STICKERS.map((s) => [s.id, s]))
const SET_BY_STICKER_ID = new Map<string, StickerSet>(
  STICKER_SETS.flatMap((set) => set.stickers.map((s) => [s.id, set] as const)),
)

export const allStickers = (): Sticker[] => ALL_STICKERS
export const totalStickerCount = (): number => ALL_STICKERS.length
export const findSticker = (id: string): Sticker | undefined => STICKER_BY_ID.get(id)
export const findSet = (setId: string): StickerSet | undefined =>
  STICKER_SETS.find((s) => s.id === setId)
export const setForStickerId = (id: string): StickerSet | undefined => SET_BY_STICKER_ID.get(id)

// The pool a game awards from: a specific set if `setId` is given (and valid), else everything.
export const stickerPool = (setId?: string): Sticker[] => {
  if (!setId) return ALL_STICKERS
  const set = findSet(setId)
  return set ? set.stickers : ALL_STICKERS
}
