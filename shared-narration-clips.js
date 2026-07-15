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
  LEVEL_UP_PRAISE,
  LEVEL_UP_TAP,
  LEVELUP_PREBAKE_MAX,
  levelUpLine,
} from './src/config/danish-phrases.ts'
import { allEnglishWords } from './src/config/englishVocab.ts'
import { HUE_ORDER, SHADES, DANISH_OBJECTS, spokenColor } from './src/config/colorContent.ts'
import { STICKER_SETS } from './src/config/stickers.ts'

// Danish narration + English section voices, straight from the single source of voice truth.
const DA = TTS_CONFIG.voices.primary // da-DK-ChristelNeural / da-DK
const EN = TTS_CONFIG.voices.english // en-US Ava / en-US
export const DEFAULT_RATE = TTS_CONFIG.speakingRate // default prosody rate (1.05)
export const NUMBER_BROWSE_RATE = 1.2 // Lær Tal speaks numbers with speakNumber(n, 1.2)

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

  // Numbers 0–100 — quiz/echo rate (default) AND Lær Tal browse rate (1.2).
  for (let n = 0; n <= 100; n++) {
    da('numbers', getDanishNumberText(n), DEFAULT_RATE)
    da('numbers', getDanishNumberText(n), NUMBER_BROWSE_RATE)
  }

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

  // Sticker reveal lines ("Nyt klistermærke! {label}") — closed album pool (mixed-language clip).
  for (const set of STICKER_SETS) for (const s of set.stickers) da('mixed', `Nyt klistermærke! ${s.label}`)

  // Level-up praise (Liveliness PRD-01). The controller rotates templates by level (lvl % len), so
  // enumerate the exact line each level speaks. First level-up is 1→2; tap label reachable at trin 1.
  for (let lvl = 2; lvl <= LEVELUP_PREBAKE_MAX; lvl++) {
    da('levelup', levelUpLine(LEVEL_UP_PRAISE[lvl % LEVEL_UP_PRAISE.length], lvl))
  }
  for (let lvl = 1; lvl <= LEVELUP_PREBAKE_MAX; lvl++) {
    da('levelup', levelUpLine(LEVEL_UP_TAP, lvl))
  }

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
