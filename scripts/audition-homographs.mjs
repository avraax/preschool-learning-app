// Audition every Danish word the app speaks that is ALSO an ordinary English word — the code-switch
// class the owner caught `fire` in (2026-09-05: "Hvad er fire plus to" read with English "fire").
//
// Each clip is the word IN ITS REAL SENTENCE, taken from `collectNarrationClips()`, because that is
// where the misread happens: the owner confirmed the bare word "fire" sounds correct and only the
// sentence is wrong. Auditioning bare tokens would therefore have told us nothing — which is the trap
// `audio-system.md` warns about ("never as bare tokens, which is exactly the reading that isn't broken").
//
// Two anchors are included on purpose: `fire` (confirmed WRONG) and `fem` (confirmed RIGHT). If those
// two do not sound as expected, the batch itself is untrustworthy and nothing else in it should be
// acted on.
//
//   node --env-file=.env.local scripts/audition-homographs.mjs
import { mkdir, writeFile } from 'node:fs/promises'
import { synthesizeAzure } from '../shared-azure-tts.js'
import { TTS_CONFIG, LEXICON_FILE } from '../shared-tts-config.js'
import { collectNarrationClips } from '../shared-narration-clips.js'

const V = TTS_CONFIG.voices.primary
const LEX = `https://boernelaering.dk/${LEXICON_FILE}`
const da = collectNarrationClips().filter((c) => c.lang.startsWith('da'))

// `fly` was MISSING from this list and shipped wrong — the owner caught it by ear in the sticker
// ceremony ("Nyt klistermærke! Fly", read as English "fly away"). The list was built from words that
// appear in QUIZ sentences, and sticker labels were never swept, so a whole surface was outside it.
// Anything the app speaks that is also an English word belongs here, wherever the line comes from.
const CANDIDATES = ['to','tre','fire','fem','ni','ti','en','is','kat','hund','bil','sol','ost','hat',
  'bold','bus','ko','and','ting','kan','hold','fly','tog','ur','sok','ko','bi','hval','blad']

const pick = (w) => {
  const re = new RegExp('(^|[^a-zæøå])' + w + '($|[^a-zæøå])', 'i')
  return (da.find((c) => /\s/.test(c.text) && re.test(c.text)) || {}).text
}

await mkdir('.audition/homographs', { recursive: true })
let i = 0
for (const w of CANDIDATES) {
  const text = pick(w)
  if (!text) { console.log(`  skip    ${w} — never in a sentence`); continue }
  i++
  const tag = w === 'fire' ? '-ANCHOR-known-wrong' : w === 'fem' ? '-ANCHOR-known-ok' : ''
  const name = `${String(i).padStart(2, '0')}-${w}${tag}`
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${V.lang}">` +
    `<voice name="${V.name}"><lexicon uri="${LEX}"/>` +
    `<prosody rate="${TTS_CONFIG.speakingRate}">${text}</prosody></voice></speak>`
  try {
    const b64 = await synthesizeAzure({
      key: process.env.AZURE_SPEECH_KEY, region: process.env.AZURE_SPEECH_REGION,
      ssml, outputFormat: TTS_CONFIG.outputFormat,
    })
    await writeFile(`.audition/homographs/${name}.mp3`, Buffer.from(b64, 'base64'))
    console.log(`  ok      ${name}.mp3   ${JSON.stringify(text)}`)
  } catch (e) {
    console.log(`  FAILED  ${name}  ${String(e?.message || e).slice(0, 120)}`)
  }
}
console.log('\nFlag any that sound English. One lexicon edit + ONE re-bake covers all of them together.')
