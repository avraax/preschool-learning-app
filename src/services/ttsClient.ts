// Azure TTS client + playback engine — the rebuilt core (PRD §5).
//
// One shared <audio> element, one clear resolve/reject/cancel model, a single duration-sized
// timeout, no retry ladder, no page-wide DOM teardown, and a single Web Speech fallback whose
// timeout is armed BEFORE awaiting `voiceschanged`. Cancellation (a newer clip / navigation) is
// a distinct non-error outcome and is never logged.

import { TTS_CONFIG } from '../config/tts-config'
import { logAudioIssue } from '../utils/remoteConsole'
import { loadVoiceOverride, saveVoiceOverride, type VoiceOverride } from '../config/voiceOverride'

type VoiceType = 'primary' | 'backup' | 'male' | 'english'

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

  // Circuit breaker for interactive synthesis failures only. It degrades to Web Speech; it
  // NEVER disables audio, and (since there is no startup preload burst) cannot be tripped on launch.
  private failureCount = 0
  private lastFailureTime = 0
  private readonly MAX_FAILURES = 3
  private readonly FAILURE_RESET_MS = 30_000

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

  /** Stop whatever is playing. pause + clear src (NO DOM-wide teardown), one speechSynthesis cancel. */
  stopCurrentAudio(): void {
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
   * Play base64 audio on the shared element. Resolves on `ended` OR on cancellation (a newer clip
   * / stop), rejects only on a real decode/network error or a genuine stall timeout.
   */
  private play(base64: string, mime: string): Promise<void> {
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
        reject(err)
      }
      // Cancellation resolves quietly — callers ignore it, nothing is logged.
      const cancel = () => finishResolve()

      const armTimeout = () => {
        clearTimeout(timer)
        const d = audio.duration
        const ms = isFinite(d) && d > 0 ? d * 1000 + 2000 : 15000
        timer = setTimeout(() => finishReject(new Error('Audio playback timeout')), ms)
      }

      const onEnded = () => finishResolve()
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

      audio.src = `data:${mime};base64,${base64}`
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
    const cacheKey = `azure|${name}|${lang}|r${effectiveSpeed}|lex${useLexicon ? 1 : 0}|${text}`

    const body: Record<string, unknown> = { text, speed: effectiveSpeed, useLexicon }
    if (override) {
      body.voiceName = name
      body.lang = lang
    } else {
      body.voiceType = voiceType
    }
    return { cacheKey, body }
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
      const response = await fetch('/api/tts-azure', {
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
    const lang = (TTS_CONFIG.voices[voiceType] ?? TTS_CONFIG.voices.primary).lang

    let audioData: string
    try {
      audioData = await this.synthesize(text, voiceType, opts?.speakingRate)
    } catch (synthErr) {
      logAudioIssue('Azure synthesis failed → Web Speech', synthErr, { text: text.slice(0, 60) })
      await this.fallbackWebSpeech(text, lang)
      return
    }

    try {
      await this.play(audioData, TTS_CONFIG.mime)
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
