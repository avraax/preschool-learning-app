import { Howl, Howler } from 'howler'
import { progressStore } from './progressStore'
import { guardHowlCleanBuffer } from './howlerGuard'

// Patch Howler's iOS _cleanBuffer crash once, at module load, before any Howl is built (see
// howlerGuard.ts for the full rationale).
guardHowlCleanBuffer((Howl as unknown as { prototype: Parameters<typeof guardHowlCleanBuffer>[0] }).prototype)

// App-wide sound-effects layer (Overhaul Foundation — System 4).
//
// A SEPARATE, overlap-friendly channel from TTS. SFX never cancel TTS and vice-versa — they are
// short (<~600ms) and may play over narration. This is the documented Howler exception to the
// audio rules: it lives in a service (mirroring balloon/SoundManager), NEVER inline in components,
// and NEVER routes through SimplifiedAudioController (that singleton is TTS-only and cancels on
// each new play).
//
// Files are curated/reused from the per-theme mascot packs into /sounds/ui/. Missing files
// degrade to silence (Howler onloaderror) — no errors thrown.
//
// Mute respects progressStore.settings.sfxEnabled, read live (the store is the source of truth).

export type SfxCue =
  | 'tap'
  | 'pick-up'
  | 'spring-back'
  | 'chomp'
  | 'match'
  | 'correct'
  | 'wrong'
  | 'drop-snap'
  | 'flip'
  | 'streak-up'
  | 'star'
  | 'sticker-reveal'
  | 'round-complete'
  | 'page-complete'
  | 'level-up'
  // Navigation cues (Liveliness PRD-02): a subtle pop on tapping a card, a per-skin travel whoosh
  // fired at cover start, a soft arrive chime when a menu reveals, and a softer reverse whoosh on back.
  | 'card-pop'
  | 'nav-whoosh'
  | 'nav-wave'
  | 'nav-warp'
  | 'nav-stomp'
  | 'menu-open'
  | 'back'

// New drag/game cues (pick-up/spring-back/chomp/match) reuse curated files for now (real sound,
// distinct cue names); swap to dedicated files when available — missing files degrade to silence.
const CUE_FILES: Record<SfxCue, string> = {
  tap: '/sounds/ui/tap.mp3',
  'pick-up': '/sounds/ui/tap.mp3',
  'spring-back': '/sounds/ui/wrong.mp3',
  chomp: '/sounds/ui/drop-snap.mp3',
  match: '/sounds/ui/correct.mp3',
  correct: '/sounds/ui/correct.mp3',
  wrong: '/sounds/ui/wrong.mp3',
  'drop-snap': '/sounds/ui/drop-snap.mp3',
  flip: '/sounds/ui/flip.mp3',
  'streak-up': '/sounds/ui/streak-up.mp3',
  star: '/sounds/ui/star.mp3',
  'sticker-reveal': '/sounds/ui/sticker-reveal.mp3',
  'round-complete': '/sounds/ui/round-complete.mp3',
  'page-complete': '/sounds/ui/page-complete.mp3',
  // Level-up fanfare (Liveliness PRD-01). Aliases the page-complete jingle until a dedicated cue
  // ships (missing files degrade to silence anyway); the biggest celebratory moment in the app.
  'level-up': '/sounds/ui/page-complete.mp3',
  // Navigation cues (Liveliness PRD-02). Reuse existing curated files until dedicated
  // /sounds/ui/{card-pop,nav-*,menu-open,back}.mp3 ship; missing files degrade to silence.
  'card-pop': '/sounds/ui/tap.mp3',
  'nav-whoosh': '/sounds/ui/flip.mp3',
  'nav-wave': '/sounds/ui/flip.mp3',
  'nav-warp': '/sounds/ui/flip.mp3',
  'nav-stomp': '/sounds/ui/drop-snap.mp3',
  'menu-open': '/sounds/ui/star.mp3',
  back: '/sounds/ui/flip.mp3',
}

// Per-cue base volume — keep cues subtle so they don't fight narration.
const CUE_VOLUME: Partial<Record<SfxCue, number>> = {
  tap: 0.35,
  'pick-up': 0.4,
  'spring-back': 0.4,
  chomp: 0.55,
  match: 0.5,
  correct: 0.5,
  wrong: 0.45,
  'drop-snap': 0.5,
  flip: 0.4,
  'streak-up': 0.5,
  star: 0.5,
  'sticker-reveal': 0.55,
  'round-complete': 0.55,
  'page-complete': 0.6,
  'level-up': 0.6,
  'card-pop': 0.35,
  'nav-whoosh': 0.35,
  'nav-wave': 0.35,
  'nav-warp': 0.4,
  'nav-stomp': 0.4,
  'menu-open': 0.3,
  back: 0.3,
}

interface PlayOptions {
  rate?: number // playback rate (e.g. ascending star "tings")
  volume?: number // overrides the per-cue base volume
}

class SfxClient {
  private enabled = true
  private preloaded = false
  private loggedCtxState = false
  private howls = new Map<SfxCue, Howl>()

  constructor() {
    try {
      this.enabled = progressStore.get().settings.sfxEnabled
    } catch {
      /* keep default */
    }
    // Stay in sync with the mute toggle (store is the source of truth).
    try {
      progressStore.subscribe(() => {
        this.enabled = progressStore.get().settings.sfxEnabled
      })
    } catch {
      /* ignore */
    }
  }

  // Build (and cache) the Howl for one cue. Howler overlaps multiple plays on a single Howl, so
  // one instance per cue is enough — no per-play decode.
  private getHowl(cue: SfxCue): Howl | null {
    let howl = this.howls.get(cue)
    if (howl) return howl
    const src = CUE_FILES[cue]
    if (!src) return null
    try {
      howl = new Howl({
        src: [src],
        // Be explicit instead of letting Howler infer from the URL: it maps a `.ogg` extension to a
        // `canPlayType('audio/ogg; codecs="vorbis"')` probe, which Safari fails (our old cues were
        // Opus-in-Ogg, and Apple has no Ogg container at all before iOS 18.4) → it refused to load
        // and every cue was silent on older iPads. MP3 + a stated format can't be mis-probed.
        format: ['mp3'],
        volume: CUE_VOLUME[cue] ?? 0.5,
        preload: true,
        html5: false, // WebAudio: low-latency + supports per-play rate; cues are tiny
        onloaderror: (_id, err) => {
          // [audio-unlock] diagnostic: a decode/codec failure surfaces HERE → SFX silently do
          // nothing. Captured in the bug-report diagnostics ring.
          console.warn('[audio-unlock] SFX load error:', cue, src, err)
        },
        onplayerror: (_id, err) => {
          console.warn('[audio-unlock] SFX play error:', cue, err)
        },
      })
      this.howls.set(cue, howl)
      return howl
    } catch {
      return null
    }
  }

  // Preload the whole palette. Call on the first user gesture (same one that unlocks audio).
  preload(): void {
    if (this.preloaded) return
    this.preloaded = true
    ;(Object.keys(CUE_FILES) as SfxCue[]).forEach((cue) => this.getHowl(cue))
  }

  play(cue: SfxCue, opts: PlayOptions = {}): void {
    // DEV screenshot harness: record every fired cue (+ rate) so verification can assert distinct
    // cues and ascending streak pitch. Recorded even when muted/missing, so the LOG reflects intent.
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      const w = window as unknown as { __sfxLog?: Array<{ cue: string; rate: number }> }
      if (!w.__sfxLog) w.__sfxLog = []
      w.__sfxLog.push({ cue, rate: opts.rate ?? 1 })
      if (w.__sfxLog.length > 80) w.__sfxLog.shift()
    }
    if (!this.enabled) return
    const howl = this.getHowl(cue)
    if (!howl) return
    // [audio-unlock] diagnostic: log Howler's WebAudio context state on the FIRST play attempt
    // (captured in bug-report ring). 'suspended' here = SFX blocked because Howler's context never
    // resumed in a gesture; 'running' = the context is live and any silence is elsewhere (codec/mute).
    if (!this.loggedCtxState) {
      this.loggedCtxState = true
      console.warn('[audio-unlock] first SFX play — Howler.ctx state:', Howler.ctx?.state ?? 'none', 'enabled:', this.enabled)
    }
    try {
      const id = howl.play()
      if (id != null) {
        if (opts.volume != null) howl.volume(opts.volume, id)
        if (opts.rate != null) howl.rate(opts.rate, id)
      }
    } catch {
      /* never let an SFX failure surface */
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    try {
      progressStore.setSetting('sfxEnabled', enabled)
    } catch {
      /* ignore */
    }
  }

  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Howler's WebAudio context, **re-read on every call** (Audio activation PRD-01 §4.2). Howler unlocks
   * in the CAPTURE phase and, on iPad (48 kHz ≠ 44.1 kHz), *closes and rebuilds* `Howler.ctx` inside the
   * first touch — so a cached reference goes stale silently, and the liveness probe must ask again each
   * time. Exposed here rather than importing `howler` into a util, so `Howler` stays behind this
   * service (`.claude/rules/audio-system.md`: never touch Howler directly outside it).
   */
  getWebAudioContext(): AudioContext | null {
    try {
      return (Howler.ctx as AudioContext | undefined) ?? null
    } catch {
      return null
    }
  }

  stopAll(): void {
    this.howls.forEach((howl) => {
      try {
        howl.stop()
      } catch {
        /* ignore */
      }
    })
  }
}

export const sfx = new SfxClient()
