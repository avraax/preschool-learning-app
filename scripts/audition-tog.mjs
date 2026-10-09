// Audition candidate IPA for "tog" (train). Azure reads the bare word as the verb "tog" (took, "to'").
// Inline <phoneme> stands in for the lexeme, so no deploy is needed to hear a candidate. Each candidate
// is rendered in the three shapes the app speaks: bare lowercase (Læs Ordet tile), capitalised (Min Bog),
// and in a sentence. "00-default" is the live reading, as the known-wrong control.
//
//   node --env-file=.env.local scripts/audition-tog.mjs
import { mkdir, writeFile } from 'node:fs/promises'
import { synthesizeAzure } from '../shared-azure-tts.js'
import { TTS_CONFIG, LEXICON_FILE } from '../shared-tts-config.js'

const V = TTS_CONFIG.voices.primary
const LEX = `https://boernelaering.dk/${LEXICON_FILE}`
const CANDIDATES = { '00-default': null, '01-tʌwʔ': 'tʌwʔ', '02-tɔwʔ': 'tɔwʔ', '03-tɒwʔ': 'tɒwʔ' }
const LINES = { bare: ['', 'tog', ''], cap: ['', 'Tog', ''], sentence: ['T som ', 'Tog', ''] }

await mkdir('.audition/tog', { recursive: true })
for (const [cname, ipa] of Object.entries(CANDIDATES)) {
  for (const [lname, [pre, word, post]] of Object.entries(LINES)) {
    const w = ipa ? `<phoneme alphabet="ipa" ph="${ipa}">${word}</phoneme>` : word
    const ssml =
      `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${V.lang}">` +
      `<voice name="${V.name}"><lexicon uri="${LEX}"/>` +
      `<prosody rate="${TTS_CONFIG.speakingRate}">${pre}${w}${post}</prosody></voice></speak>`
    const name = `${cname}-${lname}`
    try {
      const b64 = await synthesizeAzure({
        key: process.env.AZURE_SPEECH_KEY, region: process.env.AZURE_SPEECH_REGION,
        ssml, outputFormat: TTS_CONFIG.outputFormat,
      })
      await writeFile(`.audition/tog/${name}.mp3`, Buffer.from(b64, 'base64'))
      console.log(`  ok      ${name}.mp3`)
    } catch (e) {
      console.log(`  FAILED  ${name}  ${String(e?.message || e).slice(0, 120)}`)
    }
  }
}
