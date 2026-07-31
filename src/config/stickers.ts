// The reward path (Reward Book PRD-01 §6).
//
// 45 rewards in 5 chapters of 9. This flat ORDERED path IS the journey: reaching level N+1 awards
// slot N (see progression.ts `collectedFromLevel`), so the ring in every game header, the book at
// /album, and the ceremony all show the same object at the same time.
//
// **THE ORDER MUST NEVER BE SHUFFLED.** No `shuffle()`, no random pick, no reordering — anywhere in
// this system. Determinism is the whole point: the child can always see the next prize, and the same
// prize is what the ring is filling toward.
//
// Danish labels are spoken aloud (TTS) on reveal and when tapped in the book, so keep them simple,
// child-recognisable words.
//
// **This module must stay Node-importable**: shared-narration-clips.js imports it directly (in plain
// Node, type-stripped) to enumerate the closed narration set, so it must not transitively import a
// `.webp` or touch `import.meta.glob`. That's why the art-gated hook (PRD §6.2) is NOT an `art` field
// on `Reward` but a lookup — `rewardArt(reward.id)` from `src/assets/rewards/index.ts`, which globs
// whatever renders have landed. Every render site calls that; a missing render → the emoji shows.
// See plans/reward-book/reward-book-art-prompts.md.

// NB the explicit `.ts` extension: shared-narration-clips.js imports THIS file in plain Node, which
// does not resolve extensionless relative specifiers. Vite/tsc accept it (allowImportingTsExtensions).
import { chapterOfSlot } from './progression.ts'

export interface Reward {
  id: string // stable, unique across ALL chapters (used as the progress key)
  label: string // Danish name, spoken on reveal/tap
  emoji: string // fallback + silhouette source when no baked render exists yet
}

export interface RewardChapter {
  id: string
  title: string // Danish chapter title
  emoji: string // chapter/tab icon
  rewards: Reward[] // exactly CHAPTER_SIZE
}

// Chapters map 1:1 onto the 5 companion growth stages (PRD D3), and the slot map is fixed:
// 1-9 Dyr · 10-18 Køretøjer · 19-27 Mad · 28-36 Natur · 37-45 Havet.
export const REWARD_CHAPTERS: RewardChapter[] = [
  {
    id: 'dyr',
    title: 'Dyr',
    emoji: '🐾',
    rewards: [
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
    rewards: [
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
    rewards: [
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
    rewards: [
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
    rewards: [
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
]

// ----- the path + lookups (built once) -----

// The flat ordered journey. Its length + per-chapter size are asserted against the economy constants
// in src/config/progression.test.ts (this module stays side-effect-free so Node can import it).
export const REWARD_PATH: Reward[] = REWARD_CHAPTERS.flatMap((c) => c.rewards)

const REWARD_BY_ID = new Map<string, Reward>(REWARD_PATH.map((r) => [r.id, r]))
const SLOT_BY_ID = new Map<string, number>(REWARD_PATH.map((r, i) => [r.id, i]))
const CHAPTER_BY_REWARD_ID = new Map<string, RewardChapter>(
  REWARD_CHAPTERS.flatMap((c) => c.rewards.map((r) => [r.id, c] as const)),
)

// The reward at a 0-based slot index (null past the end of the path — see the gold pass in
// progressStore.grantSlot, which wraps instead).
export const rewardAt = (slotIndex0: number): Reward | null => REWARD_PATH[slotIndex0] ?? null
export const chapterAt = (slotIndex0: number): RewardChapter | undefined =>
  REWARD_CHAPTERS[chapterOfSlot(slotIndex0)]
export const slotOfReward = (id: string): number => SLOT_BY_ID.get(id) ?? -1

export const allRewards = (): Reward[] => REWARD_PATH
export const totalRewardCount = (): number => REWARD_PATH.length
export const findReward = (id: string): Reward | undefined => REWARD_BY_ID.get(id)
export const findChapter = (chapterId: string): RewardChapter | undefined =>
  REWARD_CHAPTERS.find((c) => c.id === chapterId)
export const chapterForRewardId = (id: string): RewardChapter | undefined =>
  CHAPTER_BY_REWARD_ID.get(id)
