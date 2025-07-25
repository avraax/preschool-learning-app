import { VercelRequest, VercelResponse } from '@vercel/node'
import { TextToSpeechClient } from '@google-cloud/text-to-speech'

// Initialize the client with service account credentials from environment variables
let ttsClient: TextToSpeechClient | null = null

function initializeClient() {
  if (ttsClient) return ttsClient

  try {
    // Get credentials from environment variables
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID
    const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL
    let privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY
    const privateKeyBase64 = process.env.GOOGLE_CLOUD_PRIVATE_KEY_BASE64

    if (!projectId || !clientEmail || (!privateKey && !privateKeyBase64)) {
      throw new Error('Missing required Google Cloud environment variables')
    }

    // Handle base64 encoded private key if provided
    if (privateKeyBase64 && !privateKey) {
      privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf-8')
    } else if (privateKey) {
      // Fix common formatting issues
      privateKey = privateKey.replace(/\\n/g, '\n') // Handle escaped newlines
    }

    ttsClient = new TextToSpeechClient({
      projectId,
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      }
    })

    return ttsClient
  } catch (error) {
    console.error('Failed to initialize Google TTS client:', error)
    throw error
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { text, isSSML = false, voice, audioConfig } = req.body

    // Validate input
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required and must be a string' })
    }

    if (text.length > 5000) {
      return res.status(400).json({ error: 'Text too long (max 5000 characters)' })
    }

    // Initialize the TTS client
    const client = initializeClient()

    // Prepare the request for Google Cloud TTS
    const input = isSSML ? { ssml: text } : { text }
    
    const request = {
      input,
      voice: voice || {
        languageCode: 'da-DK',
        name: 'da-DK-Wavenet-F',
        ssmlGender: 'FEMALE'
      },
      audioConfig: audioConfig || {
        audioEncoding: 'MP3',
        speakingRate: 1.0,
        pitch: 1.2,
        volumeGainDb: 0,
        sampleRateHertz: 24000
      }
    }

    // Call Google Cloud TTS
    const [response] = await client.synthesizeSpeech(request as any)
    
    if (!response.audioContent) {
      throw new Error('No audio content received from Google TTS')
    }

    // Convert audio content to base64
    const audioBase64 = Buffer.from(response.audioContent as Uint8Array).toString('base64')

    // Set caching headers (cache for 24 hours)
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400')
    res.setHeader('Content-Type', 'application/json')

    // Return the audio content as base64
    return res.status(200).json({
      audioContent: audioBase64,
      voice: request.voice,
      text: text
    })

  } catch (error) {
    console.error('TTS API error:', error)
    
    // Log error to centralized logging system
    try {
      await fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'error',
          message: `TTS API Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          data: {
            text: req.body.text,
            voice: req.body.voice,
            audioConfig: req.body.audioConfig,
            error: error instanceof Error ? error.stack : error
          },
          device: 'Server API',
          url: '/api/tts',
          timestamp: new Date().toISOString()
        })
      })
    } catch (logError) {
      // Silently fail logging - don't break the main error response
      console.warn('Failed to log TTS error:', logError)
    }
    
    // Return appropriate error response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return res.status(500).json({ 
      error: 'Text-to-speech synthesis failed',
      details: errorMessage
    })
  }
}

// Export the configuration for Vercel
export const config = {
  runtime: 'nodejs',
  maxDuration: 10, // 10 seconds should be enough for TTS
}