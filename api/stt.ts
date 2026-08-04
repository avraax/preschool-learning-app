import { VercelRequest, VercelResponse } from '@vercel/node'
import { v2 } from '@google-cloud/speech'
import { logServerError, applyCors, isAllowedOrigin, rateLimit } from '../lib/server-utils.js'
import { requirePaidAccess } from '../lib/paid-guard.js'

const { SpeechClient } = v2

// Cap the base64 audio payload. A ≤5s mic clip is a few tens of KB; 1.5MB of base64 (~1.1MB of
// audio) is a generous ceiling that still blocks someone POSTing large blobs to burn STT minutes.
const MAX_AUDIO_BASE64_CHARS = 1_500_000

// Danish is NOT served from `global`; the trailing `_` recognizer is the inline default recognizer
// (no need to pre-create one).
const STT_LOCATION = 'eu'
const STT_API_ENDPOINT = 'eu-speech.googleapis.com'

// **The model is the whole game.** Sig et Ord sends ONE isolated word, and `short` — what shipped —
// returns **zero results** for that: measured 2026-08-04 over 16 common Danish words at four
// distortion levels, `eu/short` heard 0–1 of 16 while a full SENTENCE from the same voice transcribed
// at confidence 0.94. It is not a credentials, container, level or length problem (all controlled for):
// the da-DK `short`/`long` models simply discard a lone monosyllable. `chirp_3` heard 12/16 clean and
// 8–10/16 with child-like pitch/noise/rush, so this line is the difference between a game that works
// and one that always says "det hørte jeg ikke helt".
//
// `chirp_3` is only in the EU multi-region (`chirp`/`chirp_2` are NOT in `eu` — they need
// europe-west4, and chirp_2 measured worse: 8/16 clean, 3/16 distorted). EU data residency is kept.
// FALLBACK is deliberate: model availability is a Google-side fact, so an INVALID_ARGUMENT about the
// model retries once on `short` rather than turning the game off.
const STT_MODEL = 'chirp_3'
const STT_MODEL_FALLBACK = 'short'

let speechClient: InstanceType<typeof SpeechClient> | null = null
let cachedProjectId: string | null = null

function initializeClient() {
  if (speechClient && cachedProjectId) {
    return { client: speechClient, projectId: cachedProjectId }
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID
  const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL
  let privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY
  const privateKeyBase64 = process.env.GOOGLE_CLOUD_PRIVATE_KEY_BASE64

  if (!projectId || !clientEmail || (!privateKey && !privateKeyBase64)) {
    throw new Error('Missing required Google Cloud environment variables')
  }

  if (privateKeyBase64 && !privateKey) {
    privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf-8')
  } else if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n')
  }

  speechClient = new SpeechClient({
    apiEndpoint: STT_API_ENDPOINT,
    projectId,
    credentials: {
      client_email: clientEmail,
      private_key: privateKey
    }
  })
  cachedProjectId = projectId

  return { client: speechClient, projectId }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: 'Forbidden origin' })
  }
  // HARD GATE (accounts PRD §4.6): recognition is a paid Google call, so it requires a
  // server-minted access JWT. 401 { code: 'need_access_token' } tells the client to mint-and-retry
  // once rather than to log the adult out.
  const access = await requirePaidAccess(req, res)
  if (!access) return
  // Billing guard, now keyed on the ACCOUNT rather than the IP: two iPads behind one CGNAT no
  // longer share a bucket. Generous for a hold-to-talk game.
  if (!rateLimit(req, res, { scope: 'stt', limit: 40, windowMs: 60_000, subject: access.sub })) {
    return
  }

  try {
    const { audioContent } = req.body

    if (!audioContent || typeof audioContent !== 'string') {
      return res.status(400).json({ error: 'audioContent (base64) is required' })
    }
    if (audioContent.length > MAX_AUDIO_BASE64_CHARS) {
      return res.status(413).json({ error: 'audioContent too large' })
    }

    const audioBytes = Buffer.from(audioContent, 'base64')
    if (audioBytes.length === 0) {
      return res.status(400).json({ error: 'audioContent is empty' })
    }

    const { client, projectId } = initializeClient()

    const recognizeWith = (model: string) =>
      client.recognize({
        recognizer: `projects/${projectId}/locations/${STT_LOCATION}/recognizers/_`,
        config: {
          // Auto-detects container/codec from the file header — supports both WEBM_OPUS (Chrome) and
          // MP4_AAC (Safari); both verified end-to-end 2026-08-04. Do NOT set encoding/sampleRate here.
          autoDecodingConfig: {},
          languageCodes: ['da-DK'],
          model,
          // Child-safety: mask profanity in the transcript (comes back like "f****"). Sig et Ord
          // spells the recognized word aloud, so an unfiltered slur would be celebrated + spelled out.
          // `chirp_3` ACCEPTS this flag; whether it honours it is not documented, so the client also
          // carries a Danish blocklist (`normalizeSpokenWord`) — belt and braces on the one thing here
          // that must not fail.
          features: { profanityFilter: true }
        },
        content: audioBytes
      })

    let response
    try {
      ;[response] = await recognizeWith(STT_MODEL)
    } catch (modelError) {
      // Only a MODEL-availability error earns the fallback; anything else is a real failure.
      const message = String((modelError as { message?: string })?.message ?? '')
      if (!/model/i.test(message) || !/does not exist|not supported|INVALID_ARGUMENT/i.test(message)) throw modelError
      await logServerError(req, 'STT model fallback', modelError)
      ;[response] = await recognizeWith(STT_MODEL_FALLBACK)
    }

    const alternative = response.results?.[0]?.alternatives?.[0]
    const transcript = alternative?.transcript ?? ''
    const confidence = alternative?.confidence ?? 0

    return res.status(200).json({ transcript, confidence })
  } catch (error) {
    // Full detail goes to the server log only — never leaked to the client (PRD-03 §P3).
    await logServerError(req, 'STT', error)
    return res.status(500).json({ error: 'Speech-to-text recognition failed' })
  }
}

export const config = {
  runtime: 'nodejs',
  maxDuration: 15
}
