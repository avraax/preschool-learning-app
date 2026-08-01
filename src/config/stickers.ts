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
// `.webp` or touch `import.meta.glob`. That's why the art hook (PRD §6.2) is NOT an `art` field on
// `Reward` but a lookup — `rewardArt(reward.id)` from `src/assets/rewards/index.ts`, which globs the
// baked renders. Every render site calls that.
//
// The art is NO LONGER GATED: all 45 renders ship (16 new + 29 re-trimmed from the game art — see
// `REWARD_REUSE` in scripts/optimize-theme-art.mjs), so de-emoji PRD-01 W6 deleted the `emoji`
// fallback from both `Reward` and `RewardChapter`. `rewardArtCoverage.test.ts` fails the build if a
// render ever goes missing, which is what makes rendering it unconditionally safe.
// See plans/reward-book/reward-book-art-prompts.md.

// NB the explicit `.ts` extension: shared-narration-clips.js imports THIS file in plain Node, which
// does not resolve extensionless relative specifiers. Vite/tsc accept it (allowImportingTsExtensions).
import { chapterOfSlot } from './progression.ts'

export interface Reward {
  id: string // stable, unique across ALL chapters (used as the progress key AND the art key)
  label: string // Danish name, spoken on reveal/tap
}

export interface RewardChapter {
  id: string
  title: string // Danish chapter title
  // No `emoji`: the tab icon is the art of the chapter's FIRST reward (Hund / Bil / Æble / Træ /
  // Fisk), which is already the subject each chapter emoji stood for — so the tabs cost no new art.
  rewards: Reward[] // exactly CHAPTER_SIZE
}

// Chapters map 1:1 onto the 5 companion growth stages (PRD D3), and the slot map is fixed:
// 1-9 Dyr · 10-18 Køretøjer · 19-27 Mad · 28-36 Natur · 37-45 Havet.
export const REWARD_CHAPTERS: RewardChapter[] = [
  {
    id: 'dyr',
    title: 'Dyr',
    rewards: [
      { id: 'dyr-hund', label: 'Hund' },
      { id: 'dyr-kat', label: 'Kat' },
      { id: 'dyr-ko', label: 'Ko' },
      { id: 'dyr-hest', label: 'Hest' },
      { id: 'dyr-gris', label: 'Gris' },
      { id: 'dyr-faar', label: 'Får' },
      { id: 'dyr-kanin', label: 'Kanin' },
      { id: 'dyr-raev', label: 'Ræv' },
      { id: 'dyr-bjoern', label: 'Bjørn' },
    ],
  },
  {
    id: 'koeretoejer',
    title: 'Køretøjer',
    rewards: [
      { id: 'kt-bil', label: 'Bil' },
      { id: 'kt-bus', label: 'Bus' },
      { id: 'kt-tog', label: 'Tog' },
      { id: 'kt-fly', label: 'Fly' },
      { id: 'kt-baad', label: 'Båd' },
      { id: 'kt-cykel', label: 'Cykel' },
      { id: 'kt-lastbil', label: 'Lastbil' },
      { id: 'kt-helikopter', label: 'Helikopter' },
      { id: 'kt-raket', label: 'Raket' },
    ],
  },
  {
    id: 'mad',
    title: 'Mad',
    rewards: [
      { id: 'mad-aeble', label: 'Æble' },
      { id: 'mad-banan', label: 'Banan' },
      { id: 'mad-jordbaer', label: 'Jordbær' },
      { id: 'mad-gulerod', label: 'Gulerod' },
      { id: 'mad-broed', label: 'Brød' },
      { id: 'mad-ost', label: 'Ost' },
      { id: 'mad-is', label: 'Is' },
      { id: 'mad-kage', label: 'Kage' },
      { id: 'mad-pizza', label: 'Pizza' },
    ],
  },
  {
    id: 'natur',
    title: 'Natur',
    rewards: [
      { id: 'natur-trae', label: 'Træ' },
      { id: 'natur-blomst', label: 'Blomst' },
      { id: 'natur-sol', label: 'Sol' },
      { id: 'natur-maane', label: 'Måne' },
      { id: 'natur-stjerne', label: 'Stjerne' },
      { id: 'natur-regnbue', label: 'Regnbue' },
      { id: 'natur-sky', label: 'Sky' },
      { id: 'natur-svamp', label: 'Svamp' },
      { id: 'natur-blad', label: 'Blad' },
    ],
  },
  {
    id: 'havet',
    title: 'Havet',
    rewards: [
      { id: 'hav-fisk', label: 'Fisk' },
      { id: 'hav-haj', label: 'Haj' },
      { id: 'hav-hval', label: 'Hval' },
      { id: 'hav-delfin', label: 'Delfin' },
      { id: 'hav-sael', label: 'Sæl' },
      { id: 'hav-krabbe', label: 'Krabbe' },
      { id: 'hav-blaeksprutte', label: 'Blæksprutte' },
      { id: 'hav-skildpadde', label: 'Skildpadde' },
      { id: 'hav-musling', label: 'Musling' },
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
