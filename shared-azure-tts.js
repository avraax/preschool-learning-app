// Shared Azure AI Speech synthesis core — imported by BOTH the dev server (dev-server.js)
// and the Vercel function (api/tts-azure.ts) so the two cannot drift (PRD §9.1).
//
// Builds SSML in JS (UTF-8 by default) and POSTs it with `charset=utf-8`. This is mandatory:
// non-ASCII IPA (e.g. ɛ, ʔ) in the body returns HTTP 400 unless the body is real UTF-8 (PRD §0).
// NB: Azure da-DK accepts the stød glottal stop as ʔ (U+0294), NOT the look-alike ˀ (U+02C0).

import { TTS_CONFIG } from './shared-tts-config.js';

/** XML-escape text destined for an SSML element body or attribute. */
export function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Resolve a voiceType ('primary'|'backup'|'male'|'english') to an Azure voice. */
export function resolveVoice(voiceType) {
  return TTS_CONFIG.voices[voiceType] || TTS_CONFIG.voices.primary;
}

/**
 * Build a complete SSML document for one utterance.
 *  - `lexiconUri` (da-DK only) is referenced inside <voice> for permanent pronunciation fixes.
 *  - `ipa` wraps the whole text in an inline <phoneme> (used by VoiceLab for one-off auditioning).
 *  - `speed` becomes an Azure <prosody rate> multiplier (1.0 = natural).
 *  - `pitch` (optional, e.g. "+35%" / "-25%") gives a voice a distinct character — used by the
 *    VoiceLab mascot-sound auditioner so each mascot sounds different without new voices.
 */
export function buildSsml({ text, voiceName, lang, speed, pitch, lexiconUri, ipa }) {
  const safeLang = escapeXml(lang || 'da-DK');
  const safeVoice = escapeXml(voiceName);
  const rate = typeof speed === 'number' && speed > 0 ? speed : TTS_CONFIG.speakingRate;
  const pitchAttr = typeof pitch === 'string' && pitch ? ` pitch="${escapeXml(pitch)}"` : '';

  const inner = ipa
    ? `<phoneme alphabet="ipa" ph="${escapeXml(ipa)}">${escapeXml(text)}</phoneme>`
    : escapeXml(text);

  const lexiconTag = lexiconUri ? `<lexicon uri="${escapeXml(lexiconUri)}"/>` : '';

  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${safeLang}">` +
    `<voice name="${safeVoice}">` +
    lexiconTag +
    `<prosody rate="${rate}"${pitchAttr}>${inner}</prosody>` +
    `</voice></speak>`
  );
}

/**
 * Synthesize SSML through the Azure REST endpoint. Returns base64 audio.
 * Throws on a non-2xx response (with the Azure error body attached) or missing credentials.
 */
export async function synthesizeAzure({ key, region, ssml, outputFormat }) {
  if (!key || !region) {
    throw new Error('Missing Azure Speech credentials (AZURE_SPEECH_KEY / AZURE_SPEECH_REGION)');
  }

  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      // charset=utf-8 + a UTF-8 body is REQUIRED for inline IPA / lexicon non-ASCII chars.
      'Content-Type': 'application/ssml+xml; charset=utf-8',
      'X-Microsoft-OutputFormat': outputFormat || TTS_CONFIG.outputFormat,
      // Azure rejects requests without a non-empty User-Agent.
      'User-Agent': 'bornelaering-tts',
    },
    body: ssml,
  });

  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      /* ignore */
    }
    const err = new Error(`Azure TTS failed: ${res.status} ${res.statusText}${detail ? ` — ${detail.slice(0, 300)}` : ''}`);
    err.status = res.status;
    throw err;
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) {
    throw new Error('Azure TTS returned an empty audio body');
  }
  return buf.toString('base64');
}

/**
 * Derive the public lexicon URL for da-DK. Prefers AZURE_LEXICON_URI; otherwise serves the
 * app's own public/da-DK.pls (Azure must be able to fetch it, so only for real public hosts —
 * never localhost, where Azure cannot reach back). Returns null when no usable URL exists.
 */
export function lexiconUriForRequest(host, proto) {
  if (process.env.AZURE_LEXICON_URI) return process.env.AZURE_LEXICON_URI;
  if (host && !host.includes('localhost') && !host.startsWith('127.') && !host.startsWith('[::1]')) {
    return `${proto || 'https'}://${host}/da-DK.pls`;
  }
  return null;
}
