// Shared TTS cache-key builder (PRD-06).
//
// This is the SINGLE source of the cache/manifest key so the runtime client (ttsClient.ts) and the
// build-time prebake script (prebake-tts.mjs) compute byte-identical keys. If they ever drift, a
// prebaked file would never be found and the app would silently re-pay the Azure round-trip.
//
// The key encodes everything that changes the synthesized audio: voice name, locale, prosody rate,
// whether the da-DK PLS lexicon is applied, and the text itself. `rate` is stringified the same way
// a JS template literal would (`1.05`, `1.2`), which is exactly how the client historically built it.

/**
 * @param {{ name: string, lang: string, rate: number, useLexicon: boolean, text: string }} p
 * @returns {string}
 */
export function ttsCacheKey({ name, lang, rate, useLexicon, text }) {
  return `azure|${name}|${lang}|r${rate}|lex${useLexicon ? 1 : 0}|${text}`
}
