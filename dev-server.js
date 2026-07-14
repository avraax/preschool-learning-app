import express from 'express';
import fs from 'fs';
import path from 'path';
import { v2 as speechV2 } from '@google-cloud/speech';
import { TTS_CONFIG } from './shared-tts-config.js';
import {
  buildSsml,
  synthesizeAzure,
  resolveVoice,
  lexiconUriForRequest,
} from './shared-azure-tts.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

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

// --- Shared guards (mirror lib/server-utils.ts) ---
// Origin allow-list: localhost/127/::1 or the request's own host. No Origin (curl, scripts) is
// allowed here — the rate limiter is the real guard for those. Cross-origin is rejected.
function isAllowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const host = new URL(origin).hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return true;
    if (req.headers.host && host === req.headers.host.split(':')[0]) return true;
    return false;
  } catch {
    return false;
  }
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  const first = raw?.split(',')[0]?.trim();
  return first || req.socket?.remoteAddress || 'unknown';
}

// Fixed-window per-IP rate limit. Returns true if allowed; on refusal writes a 429 and returns false.
const rateBuckets = new Map();
function rateLimit(req, res, { scope, limit, windowMs }) {
  const now = Date.now();
  const key = `${scope}:${clientIp(req)}`;
  let bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    rateBuckets.set(key, bucket);
  }
  bucket.count++;
  if (bucket.count > limit) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
    res.status(429).json({ error: 'Too many requests' });
    return false;
  }
  return true;
}

// --- Azure TTS endpoint (mirrors api/tts-azure.ts via the shared core) ---
const VOICE_TYPES = new Set(['primary', 'backup', 'male', 'english']);
const MAX_AUDIO_BASE64_CHARS = 1_500_000;

app.post('/api/tts-azure', async (req, res) => {
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: 'Forbidden origin' });
  if (!rateLimit(req, res, { scope: 'tts', limit: 200, windowMs: 60_000 })) return;
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
    res.status(500).json({ error: 'Text-to-speech synthesis failed' });
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
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: 'Forbidden origin' });
  if (!rateLimit(req, res, { scope: 'stt', limit: 40, windowMs: 60_000 })) return;
  try {
    const { audioContent } = req.body;

    if (!audioContent || typeof audioContent !== 'string') {
      return res.status(400).json({ error: 'audioContent (base64) is required' });
    }
    if (audioContent.length > MAX_AUDIO_BASE64_CHARS) {
      return res.status(413).json({ error: 'audioContent too large' });
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
        // Child-safety: mask profanity (mirrors api/stt.ts). See that file for rationale.
        features: { profanityFilter: true },
      },
      content: audioBytes,
    });

    const alternative = response.results?.[0]?.alternatives?.[0];
    const transcript = alternative?.transcript ?? '';
    const confidence = alternative?.confidence ?? 0;

    res.json({ transcript, confidence });
  } catch (error) {
    logDevError('STT', error);
    res.status(500).json({ error: 'STT recognition failed' });
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

// --- Bug reports (dev mirror of api/bug-report.ts — persists to .bug-reports/ on disk) ---
const BUG_DIR = path.resolve('.bug-reports');
const BUG_ID_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const makeBugId = () =>
  Array.from({ length: 5 }, () => BUG_ID_ALPHABET[Math.floor(Math.random() * BUG_ID_ALPHABET.length)]).join('');

/** All stored reports as { id, date, dir, uploadedAt }, newest first. */
function listBugReports() {
  const out = [];
  if (!fs.existsSync(BUG_DIR)) return out;
  for (const date of fs.readdirSync(BUG_DIR)) {
    const dateDir = path.join(BUG_DIR, date);
    if (!fs.statSync(dateDir).isDirectory()) continue;
    for (const id of fs.readdirSync(dateDir)) {
      const reportPath = path.join(dateDir, id, 'report.json');
      if (fs.existsSync(reportPath)) {
        out.push({ id, date, dir: path.join(dateDir, id), uploadedAt: fs.statSync(reportPath).mtime });
      }
    }
  }
  return out.sort((a, b) => b.uploadedAt - a.uploadedAt);
}

app.post('/api/bug-report', (req, res) => {
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: 'Forbidden origin' });
  if (!rateLimit(req, res, { scope: 'bug-report', limit: 20, windowMs: 60_000 })) return;
  try {
    const { report, screenshot } = req.body ?? {};
    if (!report || typeof report !== 'object') {
      return res.status(400).json({ error: 'report (object) is required' });
    }
    if (
      screenshot !== undefined &&
      (typeof screenshot !== 'string' || !screenshot.startsWith('data:image/jpeg;base64,'))
    ) {
      return res.status(400).json({ error: 'screenshot must be a jpeg data URL' });
    }

    const date = new Date().toISOString().slice(0, 10);
    let id = makeBugId();
    while (fs.existsSync(path.join(BUG_DIR, date, id))) id = makeBugId();
    const dir = path.join(BUG_DIR, date, id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'report.json'),
      JSON.stringify({ id, receivedAt: new Date().toISOString(), ...report }, null, 2),
    );
    let screenshotUrl = null;
    if (screenshot) {
      fs.writeFileSync(
        path.join(dir, 'screenshot.jpg'),
        Buffer.from(screenshot.slice(screenshot.indexOf(',') + 1), 'base64'),
      );
      screenshotUrl = `/api/bug-report?id=${id}&screenshot=1`;
    }
    console.log(`[dev-server] bug report stored: ${dir}`);
    res.json({ ok: true, id, url: `/api/bug-report?id=${id}`, screenshotUrl });
  } catch (error) {
    logDevError('BugReport', error);
    res.status(500).json({ error: 'Failed to store bug report' });
  }
});

app.get('/api/bug-report', (req, res) => {
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: 'Forbidden origin' });
  // Dev mirror keeps reads open when no key is configured (local .bug-reports/ debugging stays
  // frictionless); when BUG_REPORT_READ_KEY IS set, require it — so the prod gate is testable here.
  // Production (api/bug-report.ts) is stricter: fail-closed (denies reads when the env is unset).
  const readKey = process.env.BUG_REPORT_READ_KEY;
  if (readKey && req.query.key !== readKey) {
    return res.status(401).json({ error: 'Invalid key' });
  }
  try {
    const all = listBugReports();
    const id = req.query.id ? String(req.query.id).toUpperCase() : null;
    if (id) {
      const hit = all.find((r) => r.id === id);
      if (!hit) return res.status(404).json({ error: `No report ${id}` });
      const shotPath = path.join(hit.dir, 'screenshot.jpg');
      if (req.query.screenshot === '1') {
        if (!fs.existsSync(shotPath)) return res.status(404).json({ error: 'No screenshot' });
        return res.type('image/jpeg').send(fs.readFileSync(shotPath));
      }
      return res.json({
        id,
        uploadedAt: hit.uploadedAt,
        url: `/api/bug-report?id=${id}`,
        screenshotUrl: fs.existsSync(shotPath) ? `/api/bug-report?id=${id}&screenshot=1` : null,
        report: JSON.parse(fs.readFileSync(path.join(hit.dir, 'report.json'), 'utf-8')),
      });
    }

    const n = Math.min(Math.max(parseInt(req.query.list ?? '20', 10) || 20, 1), 100);
    const reports = all.slice(0, n).map((r) => ({
      id: r.id,
      date: r.date,
      uploadedAt: r.uploadedAt,
      size: fs.statSync(path.join(r.dir, 'report.json')).size,
      url: `/api/bug-report?id=${r.id}`,
      screenshotUrl: fs.existsSync(path.join(r.dir, 'screenshot.jpg'))
        ? `/api/bug-report?id=${r.id}&screenshot=1`
        : null,
    }));
    if (req.query.expand === '1') {
      for (const r of reports.slice(0, 10)) {
        try {
          const full = JSON.parse(
            fs.readFileSync(path.join(BUG_DIR, r.date, r.id, 'report.json'), 'utf-8'),
          );
          r.summary = {
            type: full.type,
            category: full.category,
            route: full.app?.route,
            version: full.app?.version,
            note: typeof full.note === 'string' ? full.note.slice(0, 120) : undefined,
            error: typeof full.error?.message === 'string' ? full.error.message.slice(0, 160) : undefined,
          };
        } catch {
          /* summary is best-effort */
        }
      }
    }
    res.json({ reports, total: reports.length });
  } catch (error) {
    logDevError('BugReport', error);
    res.status(500).json({ error: 'Failed to read bug reports' });
  }
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
  console.log(`[dev-server] Bug reports: POST/GET http://localhost:${PORT}/api/bug-report  (→ .bug-reports/)`);
  console.log(`[dev-server] Version:     GET  http://localhost:${PORT}/api/version`);
});
