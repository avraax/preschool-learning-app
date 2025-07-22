// Local development server with TTS API support
import express from 'express';
import path from 'path';
import fs from 'fs';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

// Middleware
app.use(express.json());
app.use(express.static('dist')); // Serve built files

// Initialize Google TTS client
let ttsClient = null;

function initializeClient() {
  if (ttsClient) return ttsClient;

  try {
    // Read credentials from google-cloud-key.json
    const keyFile = JSON.parse(fs.readFileSync('./google-cloud-key.json', 'utf8'));
    
    ttsClient = new TextToSpeechClient({
      projectId: keyFile.project_id,
      keyFile: './google-cloud-key.json'
    });

    console.log('✅ Google TTS client initialized');
    return ttsClient;
  } catch (error) {
    console.error('❌ Failed to initialize Google TTS client:', error);
    throw error;
  }
}

// TTS API endpoint
app.post('/api/tts', async (req, res) => {
  console.log('🎙️ TTS request received:', { text: req.body.text?.substring(0, 50) });
  
  try {
    const { text, isSSML = false, voice, audioConfig } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required and must be a string' });
    }

    const client = initializeClient();
    const input = isSSML ? { ssml: text } : { text };
    
    const request = {
      input,
      voice: voice || {
        languageCode: 'da-DK',
        name: 'da-DK-Wavenet-A',
        ssmlGender: 'FEMALE'
      },
      audioConfig: audioConfig || {
        audioEncoding: 'MP3',
        speakingRate: 0.7,
        pitch: 1.1,
        volumeGainDb: 0,
        sampleRateHertz: 24000
      }
    };

    const [response] = await client.synthesizeSpeech(request);
    
    if (!response.audioContent) {
      throw new Error('No audio content received from Google TTS');
    }

    const audioBase64 = Buffer.from(response.audioContent).toString('base64');
    
    console.log('✅ TTS synthesis successful');
    
    res.json({
      audioContent: audioBase64,
      voice: request.voice,
      text: text
    });

  } catch (error) {
    console.error('❌ TTS error:', error);
    res.status(500).json({ 
      error: 'Text-to-speech synthesis failed',
      details: error.message
    });
  }
});

// Serve index.html for all routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`🚀 Development server running at http://localhost:${port}`);
  console.log('📝 Make sure to run "npm run build" first!');
});