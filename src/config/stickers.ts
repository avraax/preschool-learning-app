// The reward path (Reward Book PRD-01 §6, extended by Reward Horizon PRD-01 §3.2/§3.3).
//
// Chapters of 9, and the totals are DERIVED from this data (see REWARD_SLOTS / CHAPTER_COUNT below) —
// so **a new chapter is content, not engineering**. This flat ORDERED path IS the journey: reaching
// level N+1 awards slot N (see progression.ts `collectedFromLevel`), so the ring in every game header,
// the book at /album, and the ceremony all show the same object at the same time.
//
// **THE ORDER MUST NEVER BE SHUFFLED.** No `shuffle()`, no random pick, no reordering — anywhere in
// this system. Determinism is the whole point: the child can always see the next prize, and the same
// prize is what the ring is filling toward.
//
// **APPEND-ONLY, FOREVER.** `firstAt` is keyed by reward id and `rebuildCollected` walks slots through
// the path, so inserting or reordering silently re-assigns every existing child's book. New chapters
// go on the END. `stickers.test.ts` pins the first 45 ids in exact order to make that mechanical.
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
// The art is NOT gated by a fallback: every surface renders `rewardArt(id)` unconditionally (de-emoji
// PRD-01 W6 deleted the `emoji` field from both `Reward` and `RewardChapter`), and
// `rewardArtCoverage.test.ts` FAILS THE BUILD when a render is missing. That guard going red after a
// chapter is appended is the gate doing its job — key the renders, don't reintroduce a fallback.
// See plans/reward-book/reward-book-art-prompts.md and
// plans/reward-horizon/chapters-6-8-art-prompts.md.

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

// The slot map is fixed and append-only:
// 1-9 Dyr · 10-18 Køretøjer · 19-27 Mad · 28-36 Natur · 37-45 Havet · 46-54 Hjemmet ·
// 55-63 Leg og musik · 64-72 Fugle og småkryb.
// The first FIVE chapters map 1:1 onto the 5 baked companion growth stages; past that the companion is
// fully grown and stays that way (COMPANION_STAGES in progression.ts, deliberately not CHAPTER_COUNT).
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
  // ----- Reward Horizon PRD-01 §3.3: chapters 6-8, APPENDED, never inserted -------------------
  // Chosen for reward PROXIMITY (a reward made of the activity beats a decorative token), so every
  // label is a plain high-frequency Danish noun that already overlaps the app's own word pools.
  // They deliberately avoid the existing chapters: `Dyr` is mammals, so birds and småkryb are a new
  // set, and `Natur` already owns Sol/Måne/Stjerne/Sky/Regnbue, so there is no weather chapter.
  {
    id: 'hjemmet',
    title: 'Hjemmet',
    rewards: [
      { id: 'hj-seng', label: 'Seng' },
      { id: 'hj-stol', label: 'Stol' },
      { id: 'hj-bord', label: 'Bord' },
      { id: 'hj-doer', label: 'Dør' },
      { id: 'hj-lampe', label: 'Lampe' },
      { id: 'hj-ur', label: 'Ur' },
      { id: 'hj-kop', label: 'Kop' },
      { id: 'hj-ske', label: 'Ske' },
      { id: 'hj-noegle', label: 'Nøgle' },
    ],
  },
  {
    id: 'leg',
    title: 'Leg og musik',
    rewards: [
      { id: 'leg-bold', label: 'Bold' },
      { id: 'leg-bamse', label: 'Bamse' },
      { id: 'leg-dukke', label: 'Dukke' },
      { id: 'leg-klods', label: 'Klods' },
      { id: 'leg-ballon', label: 'Ballon' },
      { id: 'leg-tromme', label: 'Tromme' },
      { id: 'leg-guitar', label: 'Guitar' },
      // Was `leg-floejte` / "Fløjte" (owner, 2026-08-03). The render was fine in the book but a
      // recorder is a thin tube, so it collapsed to an anonymous vertical bar at the ~24px SILHOUETTE
      // the RewardRing previews the next prize at — 8% ink coverage, the lowest in the set, where the
      // guitar (20%) and the spoon (14%) both still read. A chunky instrument fixes it by shape.
      // Safe to change: this is chapter 7, which no child has reached; the append-only rule protects
      // the first 45 slots (see the header) and those are untouched.
      { id: 'leg-xylofon', label: 'Xylofon' },
      { id: 'leg-puslespil', label: 'Puslespil' },
    ],
  },
  {
    id: 'smaakryb',
    title: 'Fugle og småkryb',
    rewards: [
      { id: 'sk-ugle', label: 'Ugle' },
      { id: 'sk-and', label: 'And' },
      { id: 'sk-hoene', label: 'Høne' },
      { id: 'sk-svane', label: 'Svane' },
      { id: 'sk-papegoeje', label: 'Papegøje' },
      { id: 'sk-sommerfugl', label: 'Sommerfugl' },
      { id: 'sk-bi', label: 'Bi' },
      { id: 'sk-myre', label: 'Myre' },
      { id: 'sk-mariehoene', label: 'Mariehøne' },
    ],
  },
  // Reward Pacing PRD-01 D8 / §10, chapter 9. APPENDED — never inserted or reordered: `firstAt` is
  // keyed by reward id and `rebuildCollected` walks slots through the path, so moving anything
  // silently re-assigns every existing child's book.
  //
  // `toej-rygsaek` replaces the PRD's `toej-paraply`: the umbrella is a weather object and moved to
  // chapter 10 to fill one of four slots the PRD had accidentally assigned to rewards that already
  // exist (Natur already owns Sol, Måne, Sky and Regnbue). See
  // `plans/reward-pacing/chapters-9-10-art-prompts.md`.
  {
    id: 'toej',
    title: 'Tøj',
    rewards: [
      { id: 'toej-stoevle', label: 'Støvle' },
      { id: 'toej-hat', label: 'Hat' },
      { id: 'toej-sok', label: 'Sok' },
      { id: 'toej-troeje', label: 'Trøje' },
      { id: 'toej-bukser', label: 'Bukser' },
      { id: 'toej-jakke', label: 'Jakke' },
      { id: 'toej-vante', label: 'Vante' },
      { id: 'toej-rygsaek', label: 'Rygsæk' },
      { id: 'toej-briller', label: 'Briller' },
    ],
  },
  // Reward Pacing PRD-01 D8 / §10, chapter 10. APPEND-ONLY, same rule as above.
  //
  // Four of the PRD's nine subjects are gone, for two different reasons, both recorded in
  // `plans/reward-pacing/chapters-9-10-art-prompts.md`:
  //   * Sol / Måne / Sky / Regnbue were already shipped in chapter 4 (Natur) — a duplicate picture
  //     under a new id, which `stickers.test.ts`'s label-uniqueness guard would have caught here.
  //   * Kælk and Vindmølle rendered fine but FAILED the ~24px ring silhouette (an anonymous low blob,
  //     and a 2px tower) — so the SUBJECT changed, not the render, exactly as leg-floejte → leg-xylofon.
  // Hence Græskar (autumn) and Sandslot (summer), which also give the chapter its four-season spread.
  {
    id: 'vejr',
    title: 'Vejr og årstider',
    rewards: [
      { id: 'vejr-lyn', label: 'Lyn' },
      { id: 'vejr-regndraabe', label: 'Regndråbe' },
      { id: 'vejr-paraply', label: 'Paraply' },
      { id: 'vejr-snemand', label: 'Snemand' },
      { id: 'vejr-sneskovl', label: 'Sneskovl' },
      { id: 'vejr-graeskar', label: 'Græskar' },
      { id: 'vejr-sandslot', label: 'Sandslot' },
      { id: 'vejr-drage', label: 'Drage' },
      { id: 'vejr-luftballon', label: 'Luftballon' },
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

// The economy's two totals, DERIVED from the chapter data (Reward Horizon PRD-01 §3.2). They used to
// be literals in progression.ts, which is what made "add a chapter" an engineering job. They live
// HERE, next to the data they measure, because progression.ts must not import this module — the
// dependency already points the other way and a cycle has to survive plain Node too.
//
// Adding a chapter therefore changes nothing but this file plus its art and narration. See §10 of the
// PRD for the full recipe; the pinned literals in stickers.test.ts are the deliberate "yes, I meant to".
export const CHAPTER_COUNT = REWARD_CHAPTERS.length
export const REWARD_SLOTS = REWARD_PATH.length // === CHAPTER_COUNT * CHAPTER_SIZE

// The reward at a 0-based slot index. `null` past the end of the path — and past the end is where the
// book ENDS: the gold pass (which used to wrap `(slot - 45) % 45` into shiny duplicates) is gone, so
// `owedRewards` clamps at REWARD_SLOTS and this is never called out of range.
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
