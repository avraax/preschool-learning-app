// "Has Azure actually picked up public/da-DK.pls yet?"
//
// THE TRAP THIS EXISTS FOR (measured 2026-09-05). Azure fetches the lexicon by URL and CACHES it, per
// node, and propagation is neither instant nor uniform. Adding the `fire` lexeme and re-baking
// immediately produced a MIXED result: 16 of the 125 clips containing the word got the new
// pronunciation and 109 kept the old one, because different Azure nodes served the run from different
// cached copies of the file. Nothing failed; the batch was just half-applied.
//
// `audio-system.md` already warns that editing the .pls changes nothing audible until the mp3s are
// deleted and re-baked. This is the second half of that rule: deleting and re-baking too EARLY is just
// as wrong, and silently so.
//
// The test is byte equality, which works because Azure TTS is deterministic for identical input
// (verified: the same request twice returns the same md5). Synthesize each grapheme with and without
// the lexicon — if the bytes differ, that lexeme is live on the node serving us.
//
//   npm run lexicon:check     → APPLIED / NOT YET for every lexeme; non-zero exit if any is pending
//
// Run it until clean BEFORE re-baking, or the batch comes out mixed.
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { synthesizeAzure } from '../shared-azure-tts.js'
import { TTS_CONFIG, LEXICON_FILE } from '../shared-tts-config.js'

const V = TTS_CONFIG.voices.primary
const LEX_URL = process.env.AZURE_LEXICON_URI || `https://boernelaering.dk/${LEXICON_FILE}`
const pls = readFileSync('public/' + LEXICON_FILE, 'utf8')
const graphemes = [...pls.matchAll(/<grapheme>([^<]+)<\/grapheme>/g)].map((m) => m[1])
if (!graphemes.length) { console.log('no lexemes in public/' + LEXICON_FILE + ''); process.exit(0) }

const md5 = (b) => createHash('md5').update(b).digest('hex').slice(0, 10)
const gen = async (word, withLex) => {
  const lex = withLex ? `<lexicon uri="${LEX_URL}"/>` : ''
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${V.lang}">` +
    `<voice name="${V.name}">${lex}<prosody rate="${TTS_CONFIG.speakingRate}">${word}</prosody>` +
    `</voice></speak>`
  const b64 = await synthesizeAzure({
    key: process.env.AZURE_SPEECH_KEY, region: process.env.AZURE_SPEECH_REGION,
    ssml, outputFormat: TTS_CONFIG.outputFormat,
  })
  return md5(Buffer.from(b64, 'base64'))
}

console.log(`lexicon: ${LEX_URL}`)
let pending = 0
for (const g of graphemes) {
  const [plain, lexed] = [await gen(g, false), await gen(g, true)]
  const applied = plain !== lexed
  if (!applied) pending++
  console.log(`  ${g.padEnd(10)} ${applied ? 'APPLIED' : 'NOT YET (Azure still serving a cached lexicon)'}`)
}
if (pending) {
  console.log(`\n${pending} lexeme(s) not live yet — do NOT re-bake, the batch would come out mixed.`)
  process.exit(1)
}
console.log('\nAll lexemes live. Safe to delete the affected clips and re-bake.')
