import { VercelRequest, VercelResponse } from '@vercel/node'
import { buildSsml, synthesizeAzure, resolveVoice, lexiconUriForRequest } from '../shared-azure-tts.js'
import { TTS_CONFIG } from '../shared-tts-config.js'
import { logServerError, applyCors, isAllowedOrigin } from '../lib/server-utils.js'

const VOICE_TYPES = new Set(['primary', 'backup', 'male', 'english'])

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
    const {
      text,
      voiceType = 'primary',
      voiceName,
      lang,
      speed,
      pitch,
      useLexicon = true,
      ipa,
    } = req.body ?? {}

    // ---- input validation at the trust boundary (no `as any`) ----
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required and must be a string' })
    }
    if (text.length > 5000) {
      return res.status(400).json({ error: 'Text too long (max 5000 characters)' })
    }
    if (typeof voiceType !== 'string' || (!voiceName && !VOICE_TYPES.has(voiceType))) {
      return res.status(400).json({ error: 'Invalid voiceType' })
    }
    if (speed !== undefined && (typeof speed !== 'number' || speed < 0.25 || speed > 3)) {
      return res.status(400).json({ error: 'Invalid speed (0.25–3)' })
    }
    if (voiceName !== undefined && typeof voiceName !== 'string') {
      return res.status(400).json({ error: 'Invalid voiceName' })
    }
    if (pitch !== undefined && (typeof pitch !== 'string' || !/^[+-]?\d{1,3}%$/.test(pitch))) {
      return res.status(400).json({ error: 'Invalid pitch (e.g. "+20%" / "-25%")' })
    }
    if (ipa !== undefined && (typeof ipa !== 'string' || ipa.length > 200)) {
      return res.status(400).json({ error: 'Invalid ipa' })
    }

    // Resolve the voice: explicit (VoiceLab auditioning) or by type (the games).
    const resolved = voiceName
      ? { name: voiceName, lang: typeof lang === 'string' ? lang : 'da-DK' }
      : resolveVoice(voiceType)

    // Lexicon is da-DK only and opt-out-able (VoiceLab A/B "with/without lexicon").
    const isDanish = resolved.lang.startsWith('da')
    const proto = (req.headers['x-forwarded-proto'] as string) || 'https'
    const lexiconUri = useLexicon && isDanish ? lexiconUriForRequest(req.headers.host, proto) : null

    const ssml = buildSsml({
      text,
      voiceName: resolved.name,
      lang: resolved.lang,
      speed,
      pitch: typeof pitch === 'string' ? pitch : null,
      lexiconUri,
      ipa: typeof ipa === 'string' ? ipa : null,
    })

    const audioContent = await synthesizeAzure({
      key: process.env.AZURE_SPEECH_KEY,
      region: process.env.AZURE_SPEECH_REGION,
      ssml,
      outputFormat: TTS_CONFIG.outputFormat,
    })

    // Cache for 24h at the edge as well as in the client localStorage cache.
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400')
    res.setHeader('Content-Type', 'application/json')
    return res.status(200).json({ audioContent })
  } catch (error) {
    console.error('Azure TTS API error:', error)
    await logServerError(req, 'TTS', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return res.status(500).json({ error: 'Text-to-speech synthesis failed', details: errorMessage })
  }
}

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
}
