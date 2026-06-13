// TTS Voice Evaluation Script (PRD Part 1)
//
// Generates audio samples comparing the current production voice (da-DK-Wavenet-F)
// to candidate Chirp3-HD voices across the app's typical phrases, so a human can
// listen and decide whether to switch. This script does NOT change the production
// voice — that decision requires your ears. If Chirp3-HD clearly wins, the only
// change needed is the `name` field in shared-tts-config.js.
//
// Usage (needs Google Cloud creds in .env.local, same as dev:api):
//   node --env-file=.env.local tts-voice-eval.mjs
//   (or: npm run tts:eval)
//
// Output: ./tts-samples/  — .ogg files + index.html for side-by-side A/B listening.
//
// NOTE: Chirp3-HD is billed at ~$30/1M characters with no documented free tier.
// These samples total well under 1,000 characters, so the cost is a fraction of a cent.

import { TextToSpeechClient } from '@google-cloud/text-to-speech'
import { TTS_CONFIG } from './shared-tts-config.js'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

// --- Voices under test ---
const CURRENT_VOICE = { id: 'current-Wavenet-F', name: 'da-DK-Wavenet-F', label: 'Nuværende (Wavenet-F)' }
const CANDIDATE_VOICES = [
  { id: 'Chirp3-HD-Kore', name: 'da-DK-Chirp3-HD-Kore', label: 'Chirp3-HD Kore' },
  { id: 'Chirp3-HD-Aoede', name: 'da-DK-Chirp3-HD-Aoede', label: 'Chirp3-HD Aoede' },
  { id: 'Chirp3-HD-Achernar', name: 'da-DK-Chirp3-HD-Achernar', label: 'Chirp3-HD Achernar' },
  { id: 'Chirp3-HD-Leda', name: 'da-DK-Chirp3-HD-Leda', label: 'Chirp3-HD Leda' },
]
const ALL_VOICES = [CURRENT_VOICE, ...CANDIDATE_VOICES]

// --- Test phrases covering typical app usage ---
const PHRASES = [
  { id: 'welcome', text: 'Hej! Velkommen til spillet' },
  { id: 'math', text: 'Hvad er tre plus fem?' },
  { id: 'praise', text: 'Godt klaret! Det var rigtigt!' },
  { id: 'letter', text: 'A som i abe' },
  { id: 'colorhunt', text: 'Find alle de røde ting' },
]

const OUT_DIR = path.resolve('tts-samples')

function buildClient() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID
  const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL
  const privateKeyBase64 = process.env.GOOGLE_CLOUD_PRIVATE_KEY_BASE64
  let privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY

  if (!projectId || !clientEmail || (!privateKey && !privateKeyBase64)) {
    throw new Error(
      'Missing Google Cloud env vars. Run with: node --env-file=.env.local tts-voice-eval.mjs'
    )
  }

  if (privateKeyBase64 && !privateKey) {
    privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf-8')
  } else if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n')
  }

  return new TextToSpeechClient({
    projectId,
    credentials: { client_email: clientEmail, private_key: privateKey },
  })
}

async function synthesize(client, voiceName, text) {
  const baseAudioConfig = {
    audioEncoding: 'OGG_OPUS',
    speakingRate: TTS_CONFIG.audioConfig.speakingRate,
    pitch: TTS_CONFIG.audioConfig.pitch,
    sampleRateHertz: TTS_CONFIG.audioConfig.sampleRateHertz,
  }

  const request = {
    input: { text },
    voice: { languageCode: 'da-DK', name: voiceName },
    audioConfig: baseAudioConfig,
  }

  try {
    const [response] = await client.synthesizeSpeech(request)
    return response.audioContent
  } catch (err) {
    // Some Chirp3-HD voices reject pitch — retry without it.
    if (/pitch/i.test(err.message || '')) {
      const { pitch, ...noPitch } = baseAudioConfig
      const [response] = await client.synthesizeSpeech({ ...request, audioConfig: noPitch })
      return response.audioContent
    }
    throw err
  }
}

function renderIndexHtml() {
  const rows = PHRASES.map((phrase) => {
    const cells = ALL_VOICES.map((voice) => {
      const file = `${voice.id}__${phrase.id}.ogg`
      return `      <td><audio controls preload="none" src="${file}"></audio></td>`
    }).join('\n')
    return `    <tr>\n      <th class="phrase">${phrase.text}</th>\n${cells}\n    </tr>`
  }).join('\n')

  const headers = ALL_VOICES.map((v) => `<th>${v.label}</th>`).join('')

  return `<!doctype html>
<html lang="da">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TTS Voice Evaluation</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; background: #f8fafc; }
    h1 { font-size: 1.4rem; }
    p { color: #475569; max-width: 720px; }
    table { border-collapse: collapse; margin-top: 16px; background: white; }
    th, td { border: 1px solid #e2e8f0; padding: 10px 12px; text-align: center; }
    th.phrase { text-align: left; background: #f1f5f9; font-weight: 600; }
    thead th { background: #1976d2; color: white; position: sticky; top: 0; }
    audio { width: 220px; }
  </style>
</head>
<body>
  <h1>🎙️ TTS Voice Evaluation — Wavenet-F vs Chirp3-HD</h1>
  <p>Listen across each row (same phrase, different voices). Only switch the production
  voice if a Chirp3-HD voice is <strong>clearly</strong> better — especially on Danish
  stød and soft 'd'. To switch, update <code>name</code> in <code>shared-tts-config.js</code>.</p>
  <table>
    <thead>
      <tr><th class="phrase">Phrase</th>${headers}</tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
</body>
</html>`
}

async function main() {
  console.log('🎙️  TTS Voice Evaluation — generating samples...\n')
  const client = buildClient()
  await mkdir(OUT_DIR, { recursive: true })

  let ok = 0
  let failed = 0

  for (const voice of ALL_VOICES) {
    for (const phrase of PHRASES) {
      const fileName = `${voice.id}__${phrase.id}.ogg`
      try {
        const audio = await synthesize(client, voice.name, phrase.text)
        if (!audio) throw new Error('No audio content returned')
        await writeFile(path.join(OUT_DIR, fileName), audio, 'binary')
        console.log(`  ✓ ${fileName}`)
        ok++
      } catch (err) {
        console.error(`  ✗ ${fileName} — ${err.message}`)
        failed++
      }
    }
  }

  await writeFile(path.join(OUT_DIR, 'index.html'), renderIndexHtml(), 'utf-8')

  console.log(`\nDone. ${ok} samples generated, ${failed} failed.`)
  console.log(`Open tts-samples/index.html in a browser to compare voices.`)
  if (failed > 0) {
    console.log('Some Chirp3-HD voices may be unavailable on your project/region — check the names above.')
  }
}

main().catch((err) => {
  console.error('\nFatal error:', err.message)
  process.exit(1)
})
