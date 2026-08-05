// Azure TTS client + playback engine — the rebuilt core (PRD §5).
//
// One shared <audio> element, one clear resolve/reject/cancel model, a single duration-sized
// timeout, no retry ladder, no page-wide DOM teardown, and a single Web Speech fallback whose
// timeout is armed BEFORE awaiting `voiceschanged`. Cancellation (a newer clip / navigation) is
// a distinct non-error outcome and is never logged.

import { TTS_CONFIG } from '../config/tts-config'
import { logAudioIssue } from '../utils/remoteConsole'
import { loadVoiceOverride, saveVoiceOverride, type VoiceOverride } from '../config/voiceOverride'
import { ttsCacheKey } from '../../shared-tts-key.js'
// The prebaked NARRATION MANIFEST is loaded lazily (Performance PRD-01 W7.1). It is 166 KB of lookup
// table that nothing needs at mount — `ttsClient` consults it on the first spoken line — and it was the
// third-largest thing in the eager preload, behind only MUI and React.
//
// TWO RULES MAKE THIS SAFE, and both matter on the target device:
//
//  1. **The lookup never awaits.** iOS consumes the transient user-activation across an `await`, and the
//     prebaked branch of `synthesizeAndPlay` currently reaches `this.play()` with NO await in front of
//     it — that is what keeps the first tap in-gesture (`.claude/rules/audio-system.md`). So the lookup
//     reads a synchronously-available map or treats it as a MISS. A miss falls through to live Azure,
//     which is the path that already exists for dynamic text: a slower first clip, never silence.
//  2. **The load is kicked at module init**, so the window in which a miss is possible is the few ms
//     between the app's scripts running and the first tap. It is not on the critical path for paint,
//     because it is a dynamic import: fetched after the entry, not preloaded before it.
//
// Do NOT change the cache-key derivation to work around this — `shared-tts-key.js` is the single source
// and `.claude/rules/audio-system.md` owns that contract.
let prebakedManifest: Record<string, string> | null = null
const loadPrebakedManifest = (): void => {
  if (prebakedManifest) return
  void import('../config/prebakedTts')
    .then((m) => {
      prebakedManifest = m.PREBAKED_TTS
    })
    .catch(() => {
      /* best-effort: every lookup site degrades to live Azure, which is the dynamic-text path */
    })
}
loadPrebakedManifest()

/**
 * The prebaked file for a cache key, or `undefined` — including while the manifest is still loading.
 * NEVER async: see rule 1 above.
 */
const prebakedFor = (cacheKey: string): string | undefined => prebakedManifest?.[cacheKey]
import { authorizedFetch } from './authorizedFetch'

type VoiceType = 'primary' | 'backup' | 'male' | 'english'

// A ~50ms silent 8-bit WAV. Played through the shared <audio> element inside the unlock gesture so
// iOS treats that element as user-activated — the FIRST real (post-fetch) narration then plays
// instead of throwing NotAllowedError (PRD-06 §5 / P3). Format is irrelevant to the unlock; PCM WAV
// decodes everywhere.
const SILENT_UNLOCK_CLIP =
  'data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA'

// Prebaked static files live under <BASE>/sounds/tts/. Content-hashed names → immutable, CDN-cacheable.
const prebakedUrl = (file: string): string => `${import.meta.env.BASE_URL}sounds/tts/${file}`

interface CachedAudio {
  audioData: string // base64
  timestamp: number
}

const CACHE_KEY = 'tts_audio_cache_v2'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24h
// Bound by total base64 length. localStorage stores UTF-16 (~2 bytes/char); ~1.4M chars ≈ ~2.8MB,
// comfortably under Safari's ~5MB quota while leaving room for other keys.
const CACHE_MAX_CHARS = 1_400_000

export class TtsClient {
  private cache: Map<string, CachedAudio> = new Map()
  private audio: HTMLAudioElement | null = null
  /** Resolves the in-flight play() promise as "cancelled" when a newer clip/stop arrives. */
  private currentCancel: (() => void) | null = null

  // Monotonic "last request wins" generation token (PRD-06 §3 / P2). Every synthesizeAndPlay and
  // every stop bumps it; a synth/fetch that resolves against a stale generation bails BEFORE
  // playing, so a slow "B" can never pre-empt a later "K". Also keeps isPlaying/duck in sync.
  private epoch = 0

  // Circuit breaker for interactive synthesis failures only. It degrades to Web Speech; it
  // NEVER disables audio, and (since there is no startup preload burst) cannot be tripped on launch.
  private failureCount = 0
  private lastFailureTime = 0
  private readonly MAX_FAILURES = 3
  private readonly FAILURE_RESET_MS = 30_000

  /**
   * Consecutive PLAYBACK failures — a `play()` rejection, a decode error, a fetch failure (Practice
   * Loop PRD-01 W4). Distinct from `failureCount`, which counts *synthesis* failures and only chooses
   * between Azure and Web Speech.
   *
   * This is the number the degraded mode reads, because `isWorking` alone is NOT enough: it answers
   * "can we play audio at all", which was already false during the iOS suspension case but **true**
   * during the Ogg failure, where the element existed and the bytes were simply undecodable. That is
   * the exact bug W4 has to catch — two games are unanswerable without narration, and the app has
   * shipped total silence on the target device twice over.
   *
   * Cancellations (the documented no-queue pre-emption) neither increment nor reset it: a cancelled
   * clip is no evidence either way, and treating it as success is how a real failure streak would hide.
   */
  private consecutivePlaybackFailures = 0
  /**
   * Has a clip EVER reported a duration this session? Set by `notePlaybackOk`, **never cleared** — a
   * later iOS suspension does not un-hear what was already heard. This is the signal that makes the
   * readiness verdict (Audio activation PRD-01) stop re-accusing a working device after every app
   * switch, which is what the old `hasUnlockedRef`/`userDismissedRef` pair was approximating.
   */
  private playbackOkOnce = false
  private healthListeners = new Set<() => void>()
  /** DEV/harness only — `?mute-tts=1` pins the counter so the degraded UI is capturable. */
  private forcedPlaybackFailures: number | null = null

  /** App-wide Danish voice override for the VoiceLab panel (throwaway tool). */
  private voiceOverride: VoiceOverride | null = loadVoiceOverride()

  /** Called when playback is blocked by a missing user gesture (NotAllowedError). */
  public onNeedsUserAction: (() => void) | null = null

  constructor() {
    this.loadCacheFromStorage()
  }

  // ===== voice override (VoiceLab) =====
  setVoiceOverride(override: VoiceOverride | null): void {
    this.voiceOverride = override
    saveVoiceOverride(override)
  }
  getVoiceOverride(): VoiceOverride | null {
    return this.voiceOverride
  }

  // ===== shared audio element =====
  private getAudio(): HTMLAudioElement {
    if (!this.audio) {
      this.audio = new Audio()
      this.audio.preload = 'auto'
    }
    return this.audio
  }

  /**
   * iOS unlock (PRD-06 §5): play a tiny silent clip through the SHARED playback element inside the
   * user gesture. Priming the probe AudioContext alone is not enough — narration plays through THIS
   * element, so it must be the one that gets user-activated, or the first post-fetch play() throws
   * NotAllowedError. Safe to call repeatedly; the next real play() overwrites the src.
   *
   * **The result is the app's one real evidence signal** (Audio activation PRD-01 §4.1): resolving is
   * the closest thing to proof that narration is unlocked, `NotAllowedError` is proof that it is not.
   * Both used to be `console.warn`ed and thrown away, which is why the readiness verdict had to guess.
   *
   * NOT `async`, and the `a.src = …` / `a.play()` pair stays SYNCHRONOUS: this is called from inside
   * the unlock gesture and iOS consumes the transient activation across an `await`. Only the *result*
   * became observable; the call shape did not change. The `console.warn`s stay too — the bug-report
   * diagnostics ring reads them, and `[audio-unlock]` is how a production report is debugged today.
   *
   * `'error'` means a decode/format/no-promise problem, i.e. NOT an activation problem — the readiness
   * model treats it as no evidence either way (`consecutivePlaybackFailures` is what sees that class).
   */
  primePlaybackElement(): Promise<'ok' | 'blocked' | 'error'> {
    let a: HTMLAudioElement
    let p: Promise<void> | undefined
    try {
      a = this.getAudio()
      a.src = SILENT_UNLOCK_CLIP
      p = a.play()
    } catch (e) {
      console.warn('[audio-unlock] primePlaybackElement threw:', e)
      return Promise.resolve('error')
    }
    if (!p || typeof p.then !== 'function') {
      // Pre-promise `play()` — nothing to observe, so claim nothing.
      return Promise.resolve('error')
    }
    return p.then(
      () => {
        // [audio-unlock] diagnostic (captured in bug-report diagnostics ring): the narration
        // <audio> element accepted play() → narration is unlocked for the session.
        console.warn('[audio-unlock] playback element primed OK')
        try {
          a.pause()
        } catch {
          /* ignore */
        }
        return 'ok' as const
      },
      (e: unknown) => {
        // Blocked → element NOT user-activated (no gesture / called outside activation). This is
        // the "no sound after tapping" signature; the real speak will surface NotAllowedError too.
        const name = (e as { name?: string })?.name
        console.warn('[audio-unlock] playback element prime BLOCKED:', name || String(e))
        return name === 'NotAllowedError' ? ('blocked' as const) : ('error' as const)
      },
    )
  }

  /** Stop whatever is playing. pause + clear src (NO DOM-wide teardown), one speechSynthesis cancel. */
  stopCurrentAudio(): void {
    // Invalidate any in-flight synth/fetch so it can't resolve and play after this stop (P2).
    this.epoch++
    if (this.currentCancel) {
      const cancel = this.currentCancel
      this.currentCancel = null
      cancel()
    }
    if (this.audio) {
      try {
        this.audio.pause()
        this.audio.removeAttribute('src')
        this.audio.load()
      } catch {
        /* ignore */
      }
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel()
      } catch {
        /* ignore */
      }
    }
  }

  // ===== playback =====
  /**
   * Play an audio `src` (a `data:` URL for dynamic/cached clips, or a static `/sounds/tts/…` file
   * URL for prebaked clips) on the shared element. Resolves on `ended` OR on cancellation (a newer
   * clip / stop), rejects only on a real decode/network error or a genuine stall timeout.
   */
  private play(src: string): Promise<void> {
    const audio = this.getAudio()

    // A newer clip pre-empts the current one.
    if (this.currentCancel) {
      const prev = this.currentCancel
      this.currentCancel = null
      prev()
    }

    return new Promise<void>((resolve, reject) => {
      let done = false
      let timer: ReturnType<typeof setTimeout> | undefined

      const teardown = () => {
        clearTimeout(timer)
        audio.removeEventListener('ended', onEnded)
        audio.removeEventListener('error', onError)
        audio.removeEventListener('loadedmetadata', armTimeout)
        if (this.currentCancel === cancel) this.currentCancel = null
      }
      const finishResolve = () => {
        if (done) return
        done = true
        teardown()
        resolve()
      }
      const finishReject = (err: unknown) => {
        if (done) return
        done = true
        teardown()
        // Every path into here is a real playback failure — decode error, timeout, NotAllowedError.
        // Cancellations go through finishResolve instead and are deliberately neutral (see the field).
        this.notePlaybackFailure()
        reject(err)
      }
      // Cancellation resolves quietly — callers ignore it, nothing is logged.
      const cancel = () => finishResolve()

      const armTimeout = () => {
        clearTimeout(timer)
        // The element accepted playback and reported a duration — the strongest "audio really works"
        // signal there is, and precisely what the Ogg case could never reach (W4).
        this.notePlaybackOk()
        const d = audio.duration
        const ms = isFinite(d) && d > 0 ? d * 1000 + 2000 : 15000
        timer = setTimeout(() => finishReject(new Error('Audio playback timeout')), ms)
      }

      const onEnded = () => {
        this.notePlaybackOk()
        finishResolve()
      }
      const onError = () => {
        // src cleared / empty network state ⇒ this is a stop/navigation cancellation, not an error.
        if (!audio.getAttribute('src') || audio.networkState === HTMLMediaElement.NETWORK_EMPTY) {
          finishResolve()
          return
        }
        // Attach the original MediaError as `cause` (assigned, not via the ES2022 options form).
        const err = new Error('Audio playback error')
        ;(err as Error & { cause?: unknown }).cause = audio.error ?? undefined
        finishReject(err)
      }

      this.currentCancel = cancel
      audio.addEventListener('ended', onEnded)
      audio.addEventListener('error', onError)
      audio.addEventListener('loadedmetadata', armTimeout)

      audio.src = src
      audio.load()
      // Conservative fallback timeout until metadata gives us a real duration.
      timer = setTimeout(() => finishReject(new Error('Audio playback timeout')), 15000)

      audio.play().then(armTimeout).catch((e: unknown) => {
        const name = (e as { name?: string })?.name
        if (name === 'AbortError') {
          // play() interrupted by a newer load() — a cancellation, not an error.
          finishResolve()
        } else if (name === 'NotAllowedError') {
          this.onNeedsUserAction?.()
          finishReject(e)
        } else {
          finishReject(e)
        }
      })
    })
  }

  // ===== synthesis =====
  private resolveRequest(text: string, voiceType: VoiceType, speed?: number) {
    const base = TTS_CONFIG.voices[voiceType] ?? TTS_CONFIG.voices.primary
    const baseDanish = base.lang.startsWith('da')
    // The override applies to the Danish narration voiceTypes only (the bulk of the app); the
    // English section keeps its own voice. The override carries its own locale.
    const override = baseDanish ? this.voiceOverride : null
    const name = override?.name ?? base.name
    const lang = override?.lang ?? base.lang
    const effectiveSpeed = override?.speakingRate ?? speed ?? TTS_CONFIG.speakingRate
    // Lexicon is da-DK only — gate on the EFFECTIVE locale so an en-* override doesn't ship a
    // mismatched lexicon.
    const useLexicon = lang.startsWith('da')
    // Built via the shared key so the prebake manifest and this client can't drift (PRD-06).
    const cacheKey = ttsCacheKey({ name, lang, rate: effectiveSpeed, useLexicon, text })

    const body: Record<string, unknown> = { text, speed: effectiveSpeed, useLexicon }
    if (override) {
      body.voiceName = name
      body.lang = lang
    } else {
      body.voiceType = voiceType
    }
    return { cacheKey, body }
  }

  /**
   * Warm the browser HTTP cache for a set of prebaked clips. Best-effort and fire-and-forget: a miss,
   * a 404 or an offline device changes nothing.
   *
   * Why this exists: the prebaked branch of `synthesizeAndPlay` points the shared `<audio>` element at
   * a static URL, so the file is fetched only when playback begins (~250ms measured in dev). A clip
   * played on its own never notices, but a TIMED sequence does — the alphabet autoplay steps every
   * ~1.1s, and that startup cost is taken out of the letter's speaking time, cutting the end off the
   * longest names. Warming the files first turns the step into (almost) pure speaking time.
   */
  prefetchPrebaked(texts: string[], voiceType: VoiceType = 'primary', speed?: number): void {
    for (const text of texts) {
      // `speed` is part of the cache key — Lær Tal speaks numbers faster than the default, so omitting
      // it here would warm a DIFFERENT file than the one the run plays.
      const { cacheKey } = this.resolveRequest(text, voiceType, speed)
      const file = prebakedFor(cacheKey)
      if (!file) continue // dynamic text, or a VoiceLab override is active → nothing static to warm
      // The body must be READ for the response to land in the HTTP cache.
      void fetch(prebakedUrl(file), { cache: 'force-cache' })
        .then((r) => r.arrayBuffer())
        .catch(() => { /* best-effort */ })
    }
  }

  /**
   * Warm ONE line so it plays with no startup cost when it's finally needed, taking whichever path
   * actually serves it: a prebaked clip gets its file fetched into the HTTP cache (~250ms saved), a
   * dynamic line gets synthesized and cached (~1.1s saved). Fire-and-forget, plays nothing, and never
   * touches the shared `<audio>` element or the epoch — so it can't cancel what's currently speaking.
   *
   * Why this exists: the math games' fact lines used to be synthesized ON the correct tap — the one
   * moment that must feel immediate. Warming moves that cost to question-generation time, while the
   * child is still working the problem out. Callers don't need to know which path applies, so this stays
   * correct if a line moves in or out of the prebaked set.
   */
  warmDynamic(text: string, voiceType: VoiceType = 'primary', speed?: number): void {
    const { cacheKey } = this.resolveRequest(text, voiceType, speed)
    if (prebakedFor(cacheKey)) {
      this.prefetchPrebaked([text], voiceType, speed) // static file → warm the HTTP cache
      return
    }
    if (this.getCached(cacheKey)) return // already synthesized this session
    void this.synthesize(text, voiceType, speed).catch(() => { /* best-effort */ })
  }

  async synthesize(text: string, voiceType: VoiceType = 'primary', speed?: number): Promise<string> {
    const { cacheKey, body } = this.resolveRequest(text, voiceType, speed)

    const cached = this.getCached(cacheKey)
    if (cached) return cached

    // Circuit breaker: after repeated failures, fail fast so the caller drops to Web Speech.
    const now = Date.now()
    if (this.failureCount >= this.MAX_FAILURES && now - this.lastFailureTime < this.FAILURE_RESET_MS) {
      throw new Error('TTS temporarily degraded (circuit breaker open)')
    }
    if (now - this.lastFailureTime >= this.FAILURE_RESET_MS) this.failureCount = 0

    try {
      const response = await authorizedFetch('/api/tts-azure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        let detail = ''
        try {
          detail = (await response.json())?.details ?? ''
        } catch {
          /* ignore */
        }
        throw new Error(`TTS API ${response.status}${detail ? ` — ${detail}` : ''}`)
      }
      const data = await response.json()
      const audioData: string = data.audioContent
      this.failureCount = 0
      this.cacheAudio(cacheKey, audioData)
      return audioData
    } catch (error) {
      this.failureCount++
      this.lastFailureTime = Date.now()
      throw error
    }
  }

  /** Synthesize then play. On a real (non-cancellation) failure, fall back to Web Speech ONCE. */
  async synthesizeAndPlay(
    text: string,
    voiceType: VoiceType = 'primary',
    _useSSML: boolean = true,
    opts?: { speakingRate?: number },
  ): Promise<void> {
    // Claim this generation; a later speak/stop bumps epoch and we bail after our fetch resolves.
    const gen = ++this.epoch
    const lang = (TTS_CONFIG.voices[voiceType] ?? TTS_CONFIG.voices.primary).lang
    const { cacheKey } = this.resolveRequest(text, voiceType, opts?.speakingRate)

    // 1. Prebaked static file (the closed content set, default voice only) — no fetch, no Azure,
    //    no first-tap latency. A VoiceLab override changes the cacheKey so it misses here on purpose.
    const prebakedFile = prebakedFor(cacheKey)
    if (prebakedFile) {
      try {
        await this.play(prebakedUrl(prebakedFile))
        return
      } catch (playErr) {
        const name = (playErr as { name?: string })?.name
        if (name === 'NotAllowedError') {
          await this.fallbackWebSpeech(text, lang)
          return
        }
        // A stale manifest (404) or decode miss → fall through to live Azure, unless superseded.
        if (gen !== this.epoch) return
      }
    }

    // 2. Dynamic / non-prebaked text → Azure (client + edge cache still apply).
    let audioData: string
    try {
      audioData = await this.synthesize(text, voiceType, opts?.speakingRate)
    } catch (synthErr) {
      if (gen !== this.epoch) return // a newer clip already superseded this one — stay silent
      logAudioIssue('Azure synthesis failed → Web Speech', synthErr, { text: text.slice(0, 60) })
      await this.fallbackWebSpeech(text, lang)
      return
    }

    // Last-tap-wins: if a newer speak/stop arrived while we were fetching, do NOT play this clip.
    if (gen !== this.epoch) return

    try {
      await this.play(`data:${TTS_CONFIG.mime};base64,${audioData}`)
    } catch (playErr) {
      const name = (playErr as { name?: string })?.name
      if (name === 'NotAllowedError') {
        // Gesture missing — surface to the permission layer; do not spam logs.
        await this.fallbackWebSpeech(text, lang)
        return
      }
      logAudioIssue('Audio playback failed → Web Speech', playErr, { text: text.slice(0, 60) })
      await this.fallbackWebSpeech(text, lang)
    }
  }

  /** Single Web Speech fallback. Never rejects (best-effort); timeout armed before voiceschanged. */
  private fallbackWebSpeech(text: string, lang: string): Promise<void> {
    return new Promise<void>((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        resolve()
        return
      }
      const synth = window.speechSynthesis

      const speak = () => {
        try {
          synth.cancel()
          const u = new SpeechSynthesisUtterance(text)
          u.lang = lang
          u.rate = 0.85
          const prefix = lang.slice(0, 2)
          const match = synth.getVoices().find((v) => v.lang?.startsWith(prefix))
          if (match) u.voice = match

          let settled = false
          const finish = () => {
            if (settled) return
            settled = true
            clearTimeout(hardCap)
            resolve()
          }
          const hardCap = setTimeout(finish, 15000)
          u.onend = finish
          u.onerror = finish
          synth.speak(u)
        } catch {
          resolve()
        }
      }

      if (synth.getVoices().length === 0) {
        let fired = false
        const onVoices = () => {
          if (fired) return
          fired = true
          synth.removeEventListener('voiceschanged', onVoices)
          speak()
        }
        synth.addEventListener('voiceschanged', onVoices)
        // Arm the fallback BEFORE awaiting voiceschanged so we can't hang forever (PRD §5.1).
        setTimeout(() => {
          if (fired) return
          fired = true
          synth.removeEventListener('voiceschanged', onVoices)
          speak()
        }, 1000)
      } else {
        speak()
      }
    })
  }

  // ===== cache =====
  private loadCacheFromStorage(): void {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (!raw) return
      this.cache = new Map(Object.entries(JSON.parse(raw)))
      this.cleanCache()
    } catch {
      this.cache = new Map()
    }
  }

  /** Sweep expired entries (called on load — the old cleanCache was defined but never invoked). */
  cleanCache(): void {
    const now = Date.now()
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > CACHE_TTL_MS) this.cache.delete(key)
    }
  }

  private totalChars(): number {
    let total = 0
    for (const v of this.cache.values()) total += v.audioData.length
    return total
  }

  private evictOldestUntilUnder(limit: number): void {
    // Map preserves insertion order; oldest writes are first.
    while (this.totalChars() > limit && this.cache.size > 0) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey === undefined) break
      this.cache.delete(oldestKey)
    }
  }

  private saveCacheToStorage(): void {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(this.cache)))
    } catch (e) {
      // QuotaExceededError → evict aggressively and retry once; otherwise skip persistence quietly.
      if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
        this.evictOldestUntilUnder(CACHE_MAX_CHARS / 2)
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(this.cache)))
        } catch {
          /* give up on persistence; in-memory cache still serves this session */
        }
      }
    }
  }

  private getCached(key: string): string | null {
    const hit = this.cache.get(key)
    if (!hit) return null
    if (Date.now() - hit.timestamp > CACHE_TTL_MS) {
      this.cache.delete(key)
      return null
    }
    return hit.audioData
  }

  private cacheAudio(key: string, audioData: string): void {
    this.cache.set(key, { audioData, timestamp: Date.now() })
    this.evictOldestUntilUnder(CACHE_MAX_CHARS)
    this.saveCacheToStorage()
  }

  // ===== playback health (Practice Loop PRD-01 W4) =====

  private notePlaybackOk(): void {
    // `playbackOkOnce` is the strongest "the child heard something" signal the app can produce, and it
    // is what stops a transient iOS suspend from re-accusing the device (Audio activation PRD-01 §3).
    // Set BEFORE the early-out below, and emit on the flip even when the failure count was already 0 —
    // otherwise the very first successful clip (the common case) would never reach the verdict.
    const firstOk = !this.playbackOkOnce
    this.playbackOkOnce = true
    if (this.consecutivePlaybackFailures === 0 && !firstOk) return
    this.consecutivePlaybackFailures = 0
    this.emitHealth()
  }

  private notePlaybackFailure(): void {
    this.consecutivePlaybackFailures++
    this.emitHealth()
  }

  private emitHealth(): void {
    this.healthListeners.forEach((l) => {
      try {
        l()
      } catch {
        /* a listener must never break playback */
      }
    })
  }

  /** Subscribe to playback-health changes (the degraded-mode signal). Returns an unsubscribe. */
  onHealthChange(listener: () => void): () => void {
    this.healthListeners.add(listener)
    return () => this.healthListeners.delete(listener)
  }

  /**
   * DEV/harness only: pin the consecutive-failure count so the degraded board can be screenshotted
   * without breaking real audio. Called from `?mute-tts=1` (see `utils/devHarness.ts`), which is gated
   * `DEV || __HARNESS__` so this path is statically absent from a deploy build.
   */
  forcePlaybackFailures(n: number | null): void {
    this.forcedPlaybackFailures = n
    this.emitHealth()
  }

  /** Read-only circuit-breaker + playback health — snapshotted into bug reports. */
  getHealth(): {
    failureCount: number
    lastFailureTime: number
    circuitOpen: boolean
    consecutivePlaybackFailures: number
    playbackOkOnce: boolean
  } {
    const now = Date.now()
    return {
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      circuitOpen:
        this.failureCount >= this.MAX_FAILURES && now - this.lastFailureTime < this.FAILURE_RESET_MS,
      consecutivePlaybackFailures: this.forcedPlaybackFailures ?? this.consecutivePlaybackFailures,
      playbackOkOnce: this.playbackOkOnce,
    }
  }

  getCacheStats(): { size: number; oldestEntry: number; newestEntry: number } {
    const timestamps = Array.from(this.cache.values()).map((v) => v.timestamp)
    return {
      size: this.cache.size,
      oldestEntry: timestamps.length ? Math.min(...timestamps) : 0,
      newestEntry: timestamps.length ? Math.max(...timestamps) : 0,
    }
  }
}

export const ttsClient = new TtsClient()
