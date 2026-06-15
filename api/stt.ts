import { VercelRequest, VercelResponse } from '@vercel/node'
import { v2 } from '@google-cloud/speech'
import { logServerError, applyCors, isAllowedOrigin } from '../lib/server-utils.js'

const { SpeechClient } = v2

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

  try {
    const { audioContent } = req.body

    if (!audioContent || typeof audioContent !== 'string') {
      return res.status(400).json({ error: 'audioContent (base64) is required' })
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
        model: 'short'
      },
      content: audioBytes
    })

    const alternative = response.results?.[0]?.alternatives?.[0]
    const transcript = alternative?.transcript ?? ''
    const confidence = alternative?.confidence ?? 0

    return res.status(200).json({ transcript, confidence })
  } catch (error) {
    await logServerError(req, 'STT', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return res.status(500).json({
      error: 'Speech-to-text recognition failed',
      details: errorMessage
    })
  }
}

export const config = {
  runtime: 'nodejs',
  maxDuration: 15
}
