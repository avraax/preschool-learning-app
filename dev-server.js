import express from 'express';
import { v2 as speechV2 } from '@google-cloud/speech';
import { TTS_CONFIG } from './shared-tts-config.js';
import {
  buildSsml,
  synthesizeAzure,
  resolveVoice,
  lexiconUriForRequest,
} from './shared-azure-tts.js';

const app = express();
const PORT = 3001;

// 5mb to comfortably hold a short base64-encoded audio clip from the mic game.
app.use(express.json({ limit: '5mb' }));

// --- in-process error log (dev mirror of /api/log-error) ---
let errorLogs = [];
const MAX_LOGS = 200;

function logDevError(scope, error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[dev-server] ${scope} error:`, message);
  errorLogs.unshift({
    id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    level: 'error',
    message: `${scope} API Error: ${message}`,
    data: { stack: error instanceof Error ? error.stack : undefined },
    device: 'Server API',
    url: `/api/${scope.toLowerCase()}`,
  });
  if (errorLogs.length > MAX_LOGS) errorLogs = errorLogs.slice(0, MAX_LOGS);
}

// --- Azure TTS endpoint (mirrors api/tts-azure.ts via the shared core) ---
const VOICE_TYPES = new Set(['primary', 'backup', 'male', 'english']);

app.post('/api/tts-azure', async (req, res) => {
  try {
    const { text, voiceType = 'primary', voiceName, lang, speed, pitch, useLexicon = true, ipa } = req.body ?? {};

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required and must be a string' });
    }
    if (text.length > 5000) {
      return res.status(400).json({ error: 'Text too long (max 5000 characters)' });
    }
    if (typeof voiceType !== 'string' || (!voiceName && !VOICE_TYPES.has(voiceType))) {
      return res.status(400).json({ error: 'Invalid voiceType' });
    }
    if (speed !== undefined && (typeof speed !== 'number' || speed < 0.25 || speed > 3)) {
      return res.status(400).json({ error: 'Invalid speed (0.25–3)' });
    }
    if (pitch !== undefined && (typeof pitch !== 'string' || !/^[+-]?\d{1,3}%$/.test(pitch))) {
      return res.status(400).json({ error: 'Invalid pitch (e.g. "+20%" / "-25%")' });
    }

    const resolved = voiceName
      ? { name: voiceName, lang: typeof lang === 'string' ? lang : 'da-DK' }
      : resolveVoice(voiceType);

    const isDanish = resolved.lang.startsWith('da');
    const proto = req.headers['x-forwarded-proto'] || 'http';
    const lexiconUri = useLexicon && isDanish ? lexiconUriForRequest(req.headers.host, proto) : null;

    const ssml = buildSsml({
      text,
      voiceName: resolved.name,
      lang: resolved.lang,
      speed,
      pitch: typeof pitch === 'string' ? pitch : null,
      lexiconUri,
      ipa: typeof ipa === 'string' ? ipa : null,
    });

    const audioContent = await synthesizeAzure({
      key: process.env.AZURE_SPEECH_KEY,
      region: process.env.AZURE_SPEECH_REGION,
      ssml,
      outputFormat: TTS_CONFIG.outputFormat,
    });

    res.json({ audioContent });
  } catch (error) {
    logDevError('TTS', error);
    res.status(500).json({ error: 'Text-to-speech synthesis failed', details: error.message });
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
    logDevError('STT', error);
    res.status(500).json({ error: 'STT recognition failed', details: error.message });
  }
});

// --- Error logging endpoint (in-memory; dev mirror of api/log-error.ts) ---
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
  console.log(`[dev-server] TTS (Azure): POST http://localhost:${PORT}/api/tts-azure`);
  console.log(`[dev-server] STT:         POST http://localhost:${PORT}/api/stt`);
  console.log(`[dev-server] Logging:     POST/GET http://localhost:${PORT}/api/log-error`);
  console.log(`[dev-server] Version:     GET  http://localhost:${PORT}/api/version`);
});
