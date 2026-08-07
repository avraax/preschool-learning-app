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
import { renderAuditMarkdown } from './shared-audit-render.js';
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';
// Loaded through Node's type-stripping (>=22.18) — which is why lib/auth.ts and everything it
// imports must use explicit `.ts` extensions on their relative specifiers.
import { auth } from './lib/auth.ts';
import { verifyAccessToken } from './lib/access-token.ts';
import { devBypassEnabled } from './lib/env.ts';
import { corsHeadersFor } from './lib/web-cors.ts';
import { normalizePersisted, progressInvariantViolations } from './src/config/progressSchema.ts';
import { mergeProgress } from './src/config/progressMerge.ts';
import {
  AVATAR_IDS,
  LEGACY_AVATAR_GLYPHS,
  isAvatarId,
  normalizeAvatarId,
} from './src/config/avatars.ts';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// --- better-auth (mirrors api/auth/[...all].ts) ------------------------------------------------
// TWO ordering traps live in these four lines (accounts PRD §4.3):
//  1. `toNodeHandler` MUST be mounted BEFORE express.json(). better-auth reads the raw body itself;
//     if express has already consumed the stream the client just hangs on "pending". This is why the
//     express.json() line below moved DOWN here from the top of the file.
//  2. Express 5 (this repo is on 5.2.1) rejects bare wildcards — `'/api/auth/*'` throws a
//     path-to-regexp "Missing parameter name" error. It has to be a NAMED wildcard: `*splat`.
//  3. CORS has to sit ABOVE the auth mount, not in the general `/api` middleware further down — that
//     one never runs for these paths, so dev had the exact 404-on-OPTIONS hole production had
//     (App Store PRD §4.0.1). Same source as the deployed function, so the two cannot drift.
app.use('/api/auth', (req, res, next) => {
  for (const [k, v] of Object.entries(corsHeadersFor(req.headers.origin))) res.setHeader(k, v);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Max-Age', '600');
    return res.status(204).end();
  }
  next();
});
app.all('/api/auth/*splat', toNodeHandler(auth));

// 5mb to comfortably hold a short base64-encoded audio clip from the mic game.
// Deliberately mounted AFTER the auth handler — see trap 1 above.
app.use(express.json({ limit: '5mb' }));

// CORS mirror of lib/server-utils.ts applyCors(). Not load-bearing in dev (Vite proxies /api so the
// browser sees a same-origin request and never preflights) but kept in sync so the two sources don't
// drift — `Authorization` is what the paid endpoints' access JWT needs.
app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin && isAllowedOrigin(req) ? origin : 'null');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

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
    const url = new URL(origin);
    // Mirrors lib/server-utils.ts: the native shell calls cross-origin from capacitor://localhost.
    if (url.protocol === 'capacitor:' || url.protocol === 'ionic:') return true;
    const host = url.hostname;
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

// Fixed-window rate limit. Returns true if allowed; on refusal writes a 429 and returns false.
// `subject` mirrors lib/server-utils.ts: once a route requires an access JWT, key on the token's
// `sub` so the limit means something per account rather than per network.
const rateBuckets = new Map();
function rateLimit(req, res, { scope, limit, windowMs, subject }) {
  const now = Date.now();
  const key = `${scope}:${subject || clientIp(req)}`;
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

// Paid-endpoint gate (mirrors lib/paid-guard.ts). Returns the claims, or null after writing a 401.
// The distinct `code` is what tells the client to mint-and-retry once instead of signing out.
async function requirePaidAccess(req, res) {
  if (devBypassEnabled()) return { sub: 'dev-bypass', sid: 'dev-bypass', exp: 0 };
  const claims = await verifyAccessToken(req.headers.authorization);
  if (claims) return claims;
  res.setHeader('WWW-Authenticate', 'Bearer');
  res.status(401).json({ error: 'Unauthorized', code: 'need_access_token' });
  return null;
}

// --- Azure TTS endpoint (mirrors api/tts-azure.ts via the shared core) ---
const VOICE_TYPES = new Set(['primary', 'backup', 'male', 'english']);
const MAX_AUDIO_BASE64_CHARS = 1_500_000;

app.post('/api/tts-azure', async (req, res) => {
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: 'Forbidden origin' });
  const access = await requirePaidAccess(req, res);
  if (!access) return;
  if (!rateLimit(req, res, { scope: 'tts', limit: 200, windowMs: 60_000, subject: access.sub })) return;
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
// Mirrors api/stt.ts — see the long comment there for WHY the model changed (`short` returns zero
// results for a single isolated Danish word; `chirp_3` hears it). Keep the two in sync.
const STT_MODEL = 'chirp_3';
const STT_MODEL_FALLBACK = 'short';

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
  const access = await requirePaidAccess(req, res);
  if (!access) return;
  if (!rateLimit(req, res, { scope: 'stt', limit: 40, windowMs: 60_000, subject: access.sub })) return;
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

    const recognizeWith = (model) =>
      client.recognize({
        recognizer: `projects/${projectId}/locations/${STT_LOCATION}/recognizers/_`,
        config: {
          autoDecodingConfig: {},
          languageCodes: ['da-DK'],
          model,
          // Child-safety: mask profanity (mirrors api/stt.ts). See that file for rationale.
          features: { profanityFilter: true },
        },
        content: audioBytes,
      });

    let response;
    try {
      [response] = await recognizeWith(STT_MODEL);
    } catch (modelError) {
      const message = String(modelError?.message ?? '');
      if (!/model/i.test(message) || !/does not exist|not supported|INVALID_ARGUMENT/i.test(message)) throw modelError;
      logDevError('STT model fallback', modelError);
      [response] = await recognizeWith(STT_MODEL_FALLBACK);
    }

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

// --- Narration audit checklist (PRD-11 §3.5) — DEV ONLY ---------------------
// The /audit harness POSTs its per-clip verdicts here; we persist them to a committed checklist in
// the repo (docs/audit/narration-audit.json = source of truth + a git-reviewable .md summary) so the
// audit state carries between sessions and is reviewable in git. There is NO production mirror in
// api/*.ts by design: this writes repo files, which only makes sense in local dev.
const AUDIT_DIR = path.resolve('docs', 'audit');
const AUDIT_JSON = path.join(AUDIT_DIR, 'narration-audit.json');
const AUDIT_MD = path.join(AUDIT_DIR, 'narration-audit.md');

app.get('/api/audit-save', (req, res) => {
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: 'Forbidden origin' });
  try {
    if (!fs.existsSync(AUDIT_JSON)) return res.json({ clips: {}, updatedAt: null });
    res.json(JSON.parse(fs.readFileSync(AUDIT_JSON, 'utf-8')));
  } catch (error) {
    logDevError('AuditSave', error);
    res.status(500).json({ error: 'Failed to read audit checklist' });
  }
});

app.post('/api/audit-save', (req, res) => {
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: 'Forbidden origin' });
  try {
    const { clips } = req.body ?? {};
    if (!clips || typeof clips !== 'object') {
      return res.status(400).json({ error: 'clips (object keyed by cache key) is required' });
    }
    const doc = { updatedAt: new Date().toISOString(), clips };
    fs.mkdirSync(AUDIT_DIR, { recursive: true });
    fs.writeFileSync(AUDIT_JSON, JSON.stringify(doc, null, 2));
    fs.writeFileSync(AUDIT_MD, renderAuditMarkdown(doc));
    res.json({ ok: true, count: Object.keys(clips).length });
  } catch (error) {
    logDevError('AuditSave', error);
    res.status(500).json({ error: 'Failed to write audit checklist' });
  }
});

// --- Child profiles (dev mirror of api/profiles.ts) ------------------------------------------------
// Same shapes, same validation, same ownership checks — the two sources MUST stay in sync
// (.claude/rules/api-endpoints.md). Both go through better-auth's adapter, so the row shapes and the
// session resolution are literally the same code as production.
async function devSession(req, res) {
  try {
    const result = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (result?.user?.id && result.session?.id) {
      return { userId: result.user.id, sessionId: result.session.id };
    }
  } catch (error) {
    logDevError('Session', error);
  }
  res.setHeader('WWW-Authenticate', 'Bearer');
  res.status(401).json({ error: 'Unauthorized' });
  return null;
}

const PROFILE_MAX = 8;
// Avatars are IDs from a closed set (de-emoji PRD-01), not emoji — the DB column keeps its
// `avatarEmoji` name to avoid a migration, but the value is `'fox'`. Mirrors api/profiles.ts.
const AVATAR_ERROR = `avatarId must be one of: ${AVATAR_IDS.join(', ')}`;
const cleanAvatar = (v) => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s || s.length > 24) return null;
  if (isAvatarId(s)) return s;
  return LEGACY_AVATAR_GLYPHS.has(s) ? normalizeAvatarId(s) : null;
};
const cleanName = (v) => {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'string') return undefined;
  const s = v.trim().replace(/\s+/g, ' ');
  return s ? s.slice(0, 24) : null;
};
const profileShape = (r) => ({
  id: r.id,
  name: r.name ?? undefined,
  avatarId: normalizeAvatarId(r.avatarEmoji),
  createdAt: new Date(r.createdAt).getTime(),
});

app.all('/api/profiles', async (req, res) => {
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: 'Forbidden origin' });
  const session = await devSession(req, res);
  if (!session) return;
  if (!rateLimit(req, res, { scope: 'profiles', limit: 60, windowMs: 60_000, subject: session.userId })) return;
  try {
    const ctx = await auth.$context;
    const db = ctx.adapter;
    const owned = async (id) => {
      const row = await db.findOne({ model: 'childProfile', where: [{ field: 'id', value: id }] });
      return row && row.userId === session.userId && !row.deletedAt ? row : null;
    };

    if (req.method === 'GET') {
      const rows = await db.findMany({
        model: 'childProfile',
        where: [{ field: 'userId', value: session.userId }],
        sortBy: { field: 'createdAt', direction: 'asc' },
      });
      return res.json({ profiles: rows.filter((r) => !r.deletedAt).map(profileShape) });
    }

    if (req.method === 'POST') {
      const avatarEmoji = cleanAvatar(req.body?.avatarId);
      if (!avatarEmoji) return res.status(400).json({ error: AVATAR_ERROR });
      const existing = await db.findMany({
        model: 'childProfile',
        where: [{ field: 'userId', value: session.userId }],
      });
      if (existing.filter((r) => !r.deletedAt).length >= PROFILE_MAX) {
        return res.status(409).json({ error: 'For mange profiler' });
      }
      const created = await db.create({
        model: 'childProfile',
        data: {
          userId: session.userId,
          name: cleanName(req.body?.name) ?? null,
          avatarEmoji,
          createdAt: new Date(),
          deletedAt: null,
        },
      });
      return res.json({ profile: profileShape(created) });
    }

    if (req.method === 'PATCH') {
      if (typeof req.body?.id !== 'string') return res.status(400).json({ error: 'id is required' });
      const row = await owned(req.body.id);
      if (!row) return res.status(404).json({ error: 'Ukendt profil' });
      const update = {};
      const name = cleanName(req.body.name);
      if (name !== undefined) update.name = name;
      if (req.body.avatarId !== undefined) {
        const avatarEmoji = cleanAvatar(req.body.avatarId);
        if (!avatarEmoji) return res.status(400).json({ error: AVATAR_ERROR });
        update.avatarEmoji = avatarEmoji;
      }
      if (!Object.keys(update).length) return res.json({ profile: profileShape(row) });
      const updated = await db.update({
        model: 'childProfile',
        where: [{ field: 'id', value: row.id }],
        update,
      });
      return res.json({ profile: profileShape(updated ?? { ...row, ...update }) });
    }

    if (req.method === 'DELETE') {
      const id = typeof req.body?.id === 'string' ? req.body.id : req.query.id;
      if (typeof id !== 'string') return res.status(400).json({ error: 'id is required' });
      const row = await owned(id);
      if (!row) return res.status(404).json({ error: 'Ukendt profil' });
      await db.update({
        model: 'childProfile',
        where: [{ field: 'id', value: row.id }],
        update: { deletedAt: new Date() },
      });
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    logDevError('Profiles', error);
    res.status(500).json({ error: 'Profil-handlingen mislykkedes' });
  }
});

// --- Progress sync (dev mirror of api/progress.ts) -------------------------------------------------
// Both halves import the SAME pure modules (src/config/progressSchema.ts + progressMerge.ts), so the
// validation, the merge and the anti-rollback check are literally the same code as production.
app.all('/api/progress', async (req, res) => {
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: 'Forbidden origin' });
  const session = await devSession(req, res);
  if (!session) return;
  if (!rateLimit(req, res, { scope: 'progress', limit: 240, windowMs: 60_000, subject: session.userId })) return;
  try {
    const ctx = await auth.$context;
    const db = ctx.adapter;
    const profileId = req.method === 'GET' ? req.query.profileId : req.body?.profileId;
    if (typeof profileId !== 'string' || !profileId) {
      return res.status(400).json({ error: 'profileId is required' });
    }
    const profile = await db.findOne({ model: 'childProfile', where: [{ field: 'id', value: profileId }] });
    if (!profile || profile.userId !== session.userId || profile.deletedAt) {
      return res.status(404).json({ error: 'Ukendt profil' });
    }
    const existing = await db.findOne({
      model: 'profileProgress',
      where: [{ field: 'profileId', value: profileId }],
    });

    if (req.method === 'GET') {
      if (!existing) return res.status(404).json({ error: 'Ingen fremgang gemt endnu' });
      return res.json({
        rev: Number(existing.rev),
        epoch: existing.epoch,
        updatedAt: new Date(existing.updatedAt).getTime(),
        blob: existing.doc,
      });
    }

    if (req.method === 'PUT') {
      const incoming = normalizePersisted(req.body?.blob);
      if (!incoming) return res.status(400).json({ error: 'blob is not a valid v4 document' });
      const violations = progressInvariantViolations(incoming);
      if (violations.length) return res.status(422).json({ error: 'blob failed validation', violations });
      const baseRev = Number(req.body?.baseRev) || 0;

      if (!existing) {
        const created = await db.create({
          model: 'profileProgress',
          data: { profileId, doc: incoming, rev: 1, epoch: incoming.sync.epoch, updatedAt: new Date() },
        });
        return res.json({ rev: Number(created.rev) });
      }
      const serverRev = Number(existing.rev);
      if (baseRev !== serverRev) return res.status(409).json({ rev: serverRev, blob: existing.doc });

      const stored = normalizePersisted(existing.doc);
      let next = incoming;
      if (stored) {
        // Anti-rollback: ledger entries are monotonic by construction, so a decrease is a stale replay
        // or a tamper. A HIGHER epoch is a declared reset and may drop everything.
        if (incoming.sync.epoch === stored.sync.epoch) {
          for (const [device, before] of Object.entries(stored.ledger)) {
            const after = incoming.ledger[device];
            if (!after || after.xp < before.xp || after.slots < before.slots) {
              return res.status(409).json({ rev: serverRev, blob: existing.doc, reason: `ledger[${device}] regressed` });
            }
          }
        } else if (incoming.sync.epoch < stored.sync.epoch) {
          return res.status(409).json({ rev: serverRev, blob: existing.doc, reason: 'epoch regressed' });
        }
        next = mergeProgress(stored, incoming, { now: Date.now(), deviceId: 'server' }).merged;
      }
      const nextRev = serverRev + 1;
      await db.update({
        model: 'profileProgress',
        where: [{ field: 'profileId', value: profileId }],
        update: { doc: next, rev: nextRev, epoch: next.sync.epoch, updatedAt: new Date() },
      });
      return res.json({ rev: nextRev });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    logDevError('Progress', error);
    res.status(500).json({ error: 'Synkronisering mislykkedes' });
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
  console.log(`[dev-server] Audit:       POST/GET http://localhost:${PORT}/api/audit-save  (→ docs/audit/)`);
  console.log(`[dev-server] Version:     GET  http://localhost:${PORT}/api/version`);
});
