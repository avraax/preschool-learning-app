// A/B the Danish word "fire" (4), which the owner reports sounding like English "fire" inside
// Plus Opgaver's spoken question (2026-09-05).
//
// THE DIAGNOSTIC THAT DECIDES THE FIX, and why it comes first: `audio-system.md` records that Azure
// da-DK reads a token differently INSIDE a sentence than standing alone, and that "a context-driven
// misread usually can't be respelled, because the token alone is already correct — the sentence is
// what demotes it." So:
//   * if `01-word-alone` is WRONG too  → it is the word, and a da-DK.pls <lexeme> is the right tool
//     (this is a genuine homograph with English "fire", exactly what PLS exists for)
//   * if `01-word-alone` is RIGHT and `02-as-shipped` is wrong → it is CONTEXT, and the lever is
//     phrasing (`05-comma`), not spelling
// Getting that backwards means editing the lexicon for nothing and re-baking 125 clips.
//
// Writes to .audition/ (gitignored). Needs AZURE_SPEECH_KEY/REGION — run with:
//   node --env-file=.env.local scripts/audition-fire.mjs
import { mkdir, writeFile } from 'node:fs/promises'
import { synthesizeAzure } from '../shared-azure-tts.js'
import { TTS_CONFIG, LEXICON_FILE } from '../shared-tts-config.js'

const V = TTS_CONFIG.voices.primary
const RATE = TTS_CONFIG.speakingRate
// The PROD lexicon, because that is what the shipped clips were baked against (Azure cannot fetch
// localhost). It has no "fire" entry today, so it changes nothing for this word — included so the
// A/B differs from the shipped clip in exactly ONE variable.
const LEX = `https://boernelaering.dk/${LEXICON_FILE}`

const speak = (inner) =>
  `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${V.lang}">` +
  `<voice name="${V.name}"><lexicon uri="${LEX}"/>` +
  `<prosody rate="${RATE}">${inner}</prosody></voice></speak>`

const ph = (ipa) => `<phoneme alphabet="ipa" ph="${ipa}">fire</phoneme>`

const CASES = [
  ['01-word-alone',   'fire'],
  ['02-as-shipped',   'Hvad er fire plus to'],
  ['03-ipa-fiːɐ',     `Hvad er ${ph('ˈfiːɐ')} plus to`],
  ['04-ipa-fiːʌ',     `Hvad er ${ph('ˈfiːʌ')} plus to`],
  ['05-comma',        'Hvad er fire, plus to'],
  ['06-control-fem',  'Hvad er fem plus to'],
]

await mkdir('.audition', { recursive: true })
for (const [name, inner] of CASES) {
  try {
    const b64 = await synthesizeAzure({
      key: process.env.AZURE_SPEECH_KEY,
      region: process.env.AZURE_SPEECH_REGION,
      ssml: speak(inner),
      outputFormat: TTS_CONFIG.outputFormat,
    })
    await writeFile(`.audition/${name}.mp3`, Buffer.from(b64, 'base64'))
    console.log(`  ok      ${name}.mp3`)
  } catch (e) {
    // A rejected phoneme fails the WHOLE SSML parse, so this is how an unusable IPA symbol shows up
    // before it is ever put in the lexicon (where it would break every clip).
    console.log(`  FAILED  ${name}  ${String(e?.message || e).slice(0, 160)}`)
  }
}
console.log('\nListen in order. 01 vs 02 is the diagnostic; 06 is a control (fem has no homograph).')
