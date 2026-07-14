import { VercelRequest, VercelResponse } from '@vercel/node'
import { v2 } from '@google-cloud/speech'
import { logServerError, applyCors, isAllowedOrigin, rateLimit } from '../lib/server-utils.js'

const { SpeechClient } = v2

// Cap the base64 audio payload. A ≤5s mic clip is a few tens of KB; 1.5MB of base64 (~1.1MB of
// audio) is a generous ceiling that still blocks someone POSTing large blobs to burn STT minutes.
const MAX_AUDIO_BASE64_CHARS = 1_500_000

// Danish is NOT served from `global`; the `short` model is available from the `eu`
// regional endpoint. The trailing `_` recognizer is the inline default recognizer
// (no need to pre-create one).
const STT_LOCATION = 'eu'
const STT_API_ENDPOINT = 'eu-speech.googleapis.com'

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
  // Billing guard: recognition is a paid Google call. Generous for a hold-to-talk game.
  if (!rateLimit(req, res, { scope: 'stt', limit: 40, windowMs: 60_000 })) {
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

    const [response] = await client.recognize({
      recognizer: `projects/${projectId}/locations/${STT_LOCATION}/recognizers/_`,
      config: {
        // Auto-detects container/codec from the file header — supports both
        // WEBM_OPUS (Chrome) and MP4_AAC (Safari). Do NOT set encoding/sampleRate here.
        autoDecodingConfig: {},
        languageCodes: ['da-DK'],
        model: 'short',
        // Child-safety: mask profanity in the transcript (comes back like "f****"). Sig et Ord
        // spells the recognized word aloud, so an unfiltered slur would be celebrated + spelled out.
        features: { profanityFilter: true }
      },
      content: audioBytes
    })

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
