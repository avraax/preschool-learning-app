import express from 'express';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { v2 as speechV2 } from '@google-cloud/speech';
import { TTS_CONFIG } from './shared-tts-config.js';

const app = express();
const PORT = 3001;

// 5mb to comfortably hold a short base64-encoded audio clip from the mic game.
app.use(express.json({ limit: '5mb' }));

// --- TTS Client ---
let ttsClient = null;

function initializeTtsClient() {
  if (ttsClient) return ttsClient;

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL;
  const privateKeyBase64 = process.env.GOOGLE_CLOUD_PRIVATE_KEY_BASE64;
  let privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY;

  if (!projectId || !clientEmail || (!privateKey && !privateKeyBase64)) {
    throw new Error(
      'Missing Google Cloud env vars. Ensure .env.local has GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_CLIENT_EMAIL, and GOOGLE_CLOUD_PRIVATE_KEY_BASE64'
    );
  }

  if (privateKeyBase64 && !privateKey) {
    privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');
  } else if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  ttsClient = new TextToSpeechClient({
    projectId,
    credentials: { client_email: clientEmail, private_key: privateKey },
  });
  console.log(`[dev-server] TTS client initialized (project: ${projectId})`);
  return ttsClient;
}

// --- TTS endpoint ---
app.post('/api/tts', async (req, res) => {
  try {
    const { text, isSSML = false, voice, audioConfig } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required and must be a string' });
    }

    const client = initializeTtsClient();
    const input = isSSML ? { ssml: text } : { text };
    const request = {
      input,
      voice: voice || TTS_CONFIG.voice,
      audioConfig: audioConfig || TTS_CONFIG.audioConfig,
    };

    const [response] = await client.synthesizeSpeech(request);

    if (!response.audioContent) {
      throw new Error('No audio content received from Google TTS');
    }

    const audioBase64 = Buffer.from(response.audioContent).toString('base64');
    res.json({ audioContent: audioBase64, voice: request.voice, text });
  } catch (error) {
    console.error('[dev-server] TTS error:', error.message);
    res.status(500).json({ error: 'TTS synthesis failed', details: error.message });
  }
});

// --- Speech-to-Text (STT) client + endpoint ---
const { SpeechClient } = speechV2;
const STT_LOCATION = 'eu';
const STT_API_ENDPOINT = 'eu-speech.googleapis.com';

let sttClient = null;
let sttProjectId = null;

function initializeSttClient() {
  if (sttClient) return { client: sttClient, projectId: sttProjectId };

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL;
  const privateKeyBase64 = process.env.GOOGLE_CLOUD_PRIVATE_KEY_BASE64;
  let privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY;

  if (!projectId || !clientEmail || (!privateKey && !privateKeyBase64)) {
    throw new Error(
      'Missing Google Cloud env vars. Ensure .env.local has GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_CLIENT_EMAIL, and GOOGLE_CLOUD_PRIVATE_KEY_BASE64'
    );
  }

  if (privateKeyBase64 && !privateKey) {
    privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');
  } else if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  sttClient = new SpeechClient({
    apiEndpoint: STT_API_ENDPOINT,
    projectId,
    credentials: { client_email: clientEmail, private_key: privateKey },
  });
  sttProjectId = projectId;
  console.log(`[dev-server] STT client initialized (project: ${projectId}, region: ${STT_LOCATION})`);
  return { client: sttClient, projectId };
}

app.post('/api/stt', async (req, res) => {
  try {
    const { audioContent } = req.body;

    if (!audioContent || typeof audioContent !== 'string') {
      return res.status(400).json({ error: 'audioContent (base64) is required' });
    }

    const audioBytes = Buffer.from(audioContent, 'base64');
    if (audioBytes.length === 0) {
      return res.status(400).json({ error: 'audioContent is empty' });
    }

    const { client, projectId } = initializeSttClient();

    const [response] = await client.recognize({
      recognizer: `projects/${projectId}/locations/${STT_LOCATION}/recognizers/_`,
      config: {
        autoDecodingConfig: {},
        languageCodes: ['da-DK'],
        model: 'short',
      },
      content: audioBytes,
    });

    const alternative = response.results?.[0]?.alternatives?.[0];
    const transcript = alternative?.transcript ?? '';
    const confidence = alternative?.confidence ?? 0;

    res.json({ transcript, confidence });
  } catch (error) {
    console.error('[dev-server] STT error:', error.message);
    res.status(500).json({ error: 'STT recognition failed', details: error.message });
  }
});

// --- Error logging endpoint (in-memory) ---
let errorLogs = [];
const MAX_LOGS = 200;

app.post('/api/log-error', (req, res) => {
  const entry = {
    id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: req.body.timestamp || new Date().toISOString(),
    level: req.body.level || 'error',
    message: req.body.message || 'Unknown error',
    data: req.body.data,
    device: req.body.device || 'dev',
    url: req.body.url || '',
  };
  errorLogs.unshift(entry);
  if (errorLogs.length > MAX_LOGS) errorLogs = errorLogs.slice(0, MAX_LOGS);
  res.json({ success: true, logCount: errorLogs.length, errorId: entry.id });
});

app.get('/api/log-error', (req, res) => {
  const { limit = 50, level, device } = req.query;
  let logs = errorLogs;
  if (level) logs = logs.filter((l) => l.level === level);
  if (device) logs = logs.filter((l) => l.device.toLowerCase().includes(device.toLowerCase()));
  logs = logs.slice(0, parseInt(limit) || 50);
  res.json({ logs, totalCount: errorLogs.length, filteredCount: logs.length });
});

app.delete('/api/log-error', (_req, res) => {
  const count = errorLogs.length;
  errorLogs = [];
  res.json({ success: true, clearedCount: count });
});

// --- Version endpoint ---
app.get('/api/version', (_req, res) => {
  res.json({ version: '1.0.0-dev', buildTime: Date.now(), commitHash: 'dev' });
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`[dev-server] API server running at http://localhost:${PORT}`);
  console.log(`[dev-server] TTS:       POST http://localhost:${PORT}/api/tts`);
  console.log(`[dev-server] STT:       POST http://localhost:${PORT}/api/stt`);
  console.log(`[dev-server] Logging:   POST/GET http://localhost:${PORT}/api/log-error`);
  console.log(`[dev-server] Version:   GET  http://localhost:${PORT}/api/version`);
});
