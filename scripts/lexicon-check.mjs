// "Is each lexeme in the hosted PLS actually reaching Azure, and does it change anything?"
//
// THE MISTAKE THIS SCRIPT MADE, AND WHY THE SEMANTICS ARE NOW TWO-VALUED (2026-09-05). The first
// version synthesized the BARE GRAPHEME with and without the lexicon and called equal bytes "not
// applied". That is a false negative, and it cost three wrong diagnoses — propagation, a path-keyed
// cache, then the Cache-Control header — each with a fix pushed against it, because "fire" kept
// reporting NOT YET.
//
// A lexeme is only OBSERVABLE where it DISAGREES with the voice's default reading. Azure already says
// the isolated word "fire" correctly; it only code-switches to English inside a sentence. So the bare
// word produced identical bytes with and without a lexeme that was working perfectly.
//
// Testing in context settles it: with the lexicon, "Hvad er fire plus to" is byte-identical to the
// same line with an inline <phoneme> — the reading the owner confirmed by ear. So:
//
//   APPLIED    bytes differ in a real line → the lexeme is live AND changes the audio
//   NO EFFECT  bytes identical → either not live, or live and agreeing with the default.
//              NOT a failure on its own, and never a reason to block a re-bake.
//
// Byte comparison is valid because Azure TTS is deterministic for identical input (verified: the same
// request twice returns the same md5).
//
//   npm run lexicon:check
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { synthesizeAzure } from '../shared-azure-tts.js'
import { TTS_CONFIG, LEXICON_FILE } from '../shared-tts-config.js'
import { collectNarrationClips } from '../shared-narration-clips.js'

const V = TTS_CONFIG.voices.primary
const LEX_URL = process.env.AZURE_LEXICON_URI || `https://boernelaering.dk/${LEXICON_FILE}`
const pls = readFileSync('public/' + LEXICON_FILE, 'utf8')
const graphemes = [...pls.matchAll(/<grapheme>([^<]+)<\/grapheme>/g)].map((m) => m[1])
if (!graphemes.length) { console.log('no lexemes in public/' + LEXICON_FILE); process.exit(0) }

const da = collectNarrationClips().filter((c) => c.lang.startsWith('da'))
/** A REAL line the app speaks containing the word — context is where a lexeme becomes observable. */
const contextFor = (w) => {
  const re = new RegExp('(^|[^a-zæøå])' + w + '($|[^a-zæøå])', 'i')
  return (da.find((c) => /\s/.test(c.text) && re.test(c.text)) || {}).text || w
}

const md5 = (b) => createHash('md5').update(b).digest('hex').slice(0, 10)
const gen = async (text, withLex) => {
  const lex = withLex ? `<lexicon uri="${LEX_URL}"/>` : ''
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${V.lang}">` +
    `<voice name="${V.name}">${lex}<prosody rate="${TTS_CONFIG.speakingRate}">${text}</prosody>` +
    `</voice></speak>`
  const b64 = await synthesizeAzure({
    key: process.env.AZURE_SPEECH_KEY, region: process.env.AZURE_SPEECH_REGION,
    ssml, outputFormat: TTS_CONFIG.outputFormat,
  })
  return md5(Buffer.from(b64, 'base64'))
}

console.log(`lexicon: ${LEX_URL}\n`)
for (const g of graphemes) {
  const text = contextFor(g)
  const [plain, lexed] = [await gen(text, false), await gen(text, true)]
  const verdict = plain !== lexed ? 'APPLIED  ' : 'NO EFFECT'
  console.log(`  ${g.padEnd(8)} ${verdict}  in ${JSON.stringify(text)}`)
}
console.log('\nAPPLIED = live and audibly different here. NO EFFECT = live but agreeing with the')
console.log('default reading, OR not live — it is not a failure and does not block a re-bake.')
