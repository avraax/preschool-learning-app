// Shared narration-clip enumeration (PRD-11 §3.2) — the single source of the CLOSED narration set.
//
// Both the build-time prebake script (prebake-tts.mjs) and the /audit harness
// (src/components/audit/AuditHarness.tsx) import this so "what gets baked" and "what gets
// auditioned" can never drift. Each entry mirrors an actual runtime speak() call and carries the
// exact ttsCacheKey the client would compute, so every harness row maps 1:1 to a prebaked file.
//
// This is a plain .js ESM module (like the other shared-*.js) so Node (type-stripping) and Vite
// both import it directly. It imports the SAME src/config/*.ts modules the app uses.

import { TTS_CONFIG } from './shared-tts-config.js'
import { ttsCacheKey } from './shared-tts-key.js'

import {
  DANISH_PHRASES,
  DANISH_LETTER_NAMES,
  getDanishLetterName,
  getDanishNumberText,
  rewardLine,
  goldRewardLine,
  collectedCountLine,
  CHAPTER_DONE_LINE,
  BOOK_DONE_LINE,
} from './src/config/danish-phrases.ts'
import { allEnglishWords } from './src/config/englishVocab.ts'
import { HUE_ORDER, SHADES, DANISH_OBJECTS, spokenColor } from './src/config/colorContent.ts'
import { REWARD_CHAPTERS } from './src/config/stickers.ts'
import { REWARD_SLOTS } from './src/config/progression.ts'
import { LETTER_WORDS, WORD_LETTERS, letterPhrase, startsWithPhrase } from './src/config/letterWords.ts'
import { NUMBER_BROWSE_RATE as NUMBER_RATE } from './src/config/numberAutoplay.ts'

// Danish narration + English section voices, straight from the single source of voice truth.
const DA = TTS_CONFIG.voices.primary // da-DK-ChristelNeural / da-DK
const EN = TTS_CONFIG.voices.english // en-US Ava / en-US
export const DEFAULT_RATE = TTS_CONFIG.speakingRate // default prosody rate (1.05)
// Lær Tal speaks numbers (tap AND the "Hør tallene" autoplay) at this rate — re-exported from the app
// config so the enumerator can't drift from what the screen actually asks for. A rate is part of the
// cache key, so drift = every number falling back to live Azure, unauditioned.
export const NUMBER_BROWSE_RATE = NUMBER_RATE

// Welcome titles = the game card titles (SimplifiedAudioController.GAME_WELCOME_MESSAGES values).
// Kept here so the harness and prebake share one list; keep aligned with that map if a game is
// added/renamed.
export const WELCOME_TITLES = [
  'Bogstav Quiz', 'Lær Alfabetet', 'Tal Quiz', 'Lær Tal', 'Plus Opgaver', 'Minus Opgaver',
  'Stav Ordet', 'Sammenlign Tal', 'Hukommelsesspil', 'Farver', 'Farvejagt', 'Ram Farven',
  'Lær Farver', 'Hvilken Farve?', 'Nuancer', 'Lyt og Find', 'Find det Engelske Ord',
  'Dansk til Engelsk', 'Sig et Ord', 'Læs Ordet', 'Hvad Mangler?',
]

/**
 * Enumerate the closed narration set as `{ group, text, voiceName, lang, rate, useLexicon, key }`
 * entries, deduped by cache key (identical requests collapse to one clip; the FIRST group seen
 * wins). This is exactly the set prebake-tts.mjs synthesizes.
 *
 * @returns {Array<{group:string,text:string,voiceName:string,lang:string,rate:number,useLexicon:boolean,key:string}>}
 */
export function collectNarrationClips() {
  const raw = []
  const da = (group, text, rate = DEFAULT_RATE) =>
    raw.push({ group, text, voiceName: DA.name, lang: DA.lang, rate, useLexicon: true })
  const en = (group, text) =>
    raw.push({ group, text, voiceName: EN.name, lang: EN.lang, rate: DEFAULT_RATE, useLexicon: false })

  // Letters — speakLetter() sends the Danish letter NAME.
  for (const glyph of Object.keys(DANISH_LETTER_NAMES)) da('letters', getDanishLetterName(glyph))

  // Letter↔word association lines (PRD-14 W3). Two closed sets over the shared LETTER_WORDS table:
  //   "{bogstav} som {ord}"    — Lær Alfabetet tap + Hukommelse match (speakMatchedItem), all 29 letters
  //   "{ord} starter med {bogstav}" — Bogstav Quiz correct-answer fact (speakCorrectFact), askable letters
  // Built by the SAME two helpers the components call (they carry the per-letter pronunciation fixes:
  // Z respelled 'zet', I comma-isolated), so the baked keys match the runtime requests exactly.
  for (const letter of Object.keys(LETTER_WORDS)) {
    da('letters', letterPhrase(letter, LETTER_WORDS[letter].word))
  }
  for (const letter of WORD_LETTERS) {
    const data = LETTER_WORDS[letter]
    if (data) da('letters', startsWithPhrase(letter, data.word))
  }

  // Numbers 0–100 — quiz/echo rate (default) AND Lær Tal browse rate (1.2).
  for (let n = 0; n <= 100; n++) {
    da('numbers', getDanishNumberText(n), DEFAULT_RATE)
    da('numbers', getDanishNumberText(n), NUMBER_BROWSE_RATE)
  }

  // Tal Quiz prompts — "Find tallet N", 1–100 (the game's range ceiling at Svær). This IS the whole
  // question now that the numeral and the counting-object row were both removed as giveaways
  // (2026-08-01), so it must be a prebaked clip and not a live Azure round-trip per question.
  for (let n = 1; n <= 100; n++) da('numbers', DANISH_PHRASES.gamePrompts.findNumber(n))

  // Fixed spoken phrases.
  DANISH_PHRASES.success.forEach((t) => da('phrases', t))
  DANISH_PHRASES.encouragement.forEach((t) => da('phrases', t))
  da('phrases', DANISH_PHRASES.score.noPoints)
  da('phrases', DANISH_PHRASES.score.onePoint)
  WELCOME_TITLES.forEach((t) => da('phrases', t))

  // Colours: hue names, shade names, and the object reinforcement lines ("{objektet} er {farve}").
  for (const hue of HUE_ORDER) {
    da('colours', hue)
    ;(SHADES[hue] ?? []).forEach((s) => da('colours', s.name))
    ;(DANISH_OBJECTS[hue] ?? []).forEach((o) =>
      da('colours', `${o.objectNameDefinite} er ${spokenColor(hue, o.neuter)}`),
    )
  }

  // The Reward Book (Reward Book PRD-01 §9). Three lines per reward — the ceremony's reveal line, its
  // gold-pass variant, and the bare label spoken when the reward is tapped in Min Bog. All 45 rewards
  // are a CLOSED set, so this is the whole reachable inventory.
  for (const chapter of REWARD_CHAPTERS) {
    for (const r of chapter.rewards) {
      da('mixed', rewardLine(r.label)) // "Nyt klistermærke! {label}"
      da('mixed', goldRewardLine(r.label)) // "Skinnende klistermærke! {label}"
      da('mixed', r.label) // Min Bog slot tap
    }
  }

  // Ceremony escalations + the home companion's spoken count (1..45 — the book can't exceed 45, so
  // the count line is closed too).
  da('levelup', CHAPTER_DONE_LINE)
  da('levelup', BOOK_DONE_LINE)
  for (let n = 1; n <= REWARD_SLOTS; n++) da('levelup', collectedCountLine(n))

  // English words — spoken via the en-US voice, no lexicon.
  for (const w of allEnglishWords) en('english', w.en)

  // De-dupe by cache key (identical requests collapse to one file); first group seen wins.
  const byKey = new Map()
  for (const e of raw) {
    const key = ttsCacheKey({ name: e.voiceName, lang: e.lang, rate: e.rate, useLexicon: e.useLexicon, text: e.text })
    if (!byKey.has(key)) byKey.set(key, { ...e, key })
  }
  return [...byKey.values()]
}
