import { Howl } from 'howler'
import { progressStore } from './progressStore'

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
  | 'correct'
  | 'wrong'
  | 'drop-snap'
  | 'flip'
  | 'streak-up'
  | 'star'
  | 'sticker-reveal'
  | 'round-complete'
  | 'page-complete'

const CUE_FILES: Record<SfxCue, string> = {
  tap: '/sounds/ui/tap.ogg',
  correct: '/sounds/ui/correct.ogg',
  wrong: '/sounds/ui/wrong.ogg',
  'drop-snap': '/sounds/ui/drop-snap.ogg',
  flip: '/sounds/ui/flip.ogg',
  'streak-up': '/sounds/ui/streak-up.ogg',
  star: '/sounds/ui/star.ogg',
  'sticker-reveal': '/sounds/ui/sticker-reveal.ogg',
  'round-complete': '/sounds/ui/round-complete.ogg',
  'page-complete': '/sounds/ui/page-complete.ogg',
}

// Per-cue base volume — keep cues subtle so they don't fight narration.
const CUE_VOLUME: Partial<Record<SfxCue, number>> = {
  tap: 0.35,
  correct: 0.5,
  wrong: 0.45,
  'drop-snap': 0.5,
  flip: 0.4,
  'streak-up': 0.5,
  star: 0.5,
  'sticker-reveal': 0.55,
  'round-complete': 0.55,
  'page-complete': 0.6,
}

interface PlayOptions {
  rate?: number // playback rate (e.g. ascending star "tings")
  volume?: number // overrides the per-cue base volume
}

class SfxClient {
  private enabled = true
  private preloaded = false
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
        volume: CUE_VOLUME[cue] ?? 0.5,
        preload: true,
        html5: false, // WebAudio: low-latency + supports per-play rate; cues are tiny
        onloaderror: () => {
          /* missing/broken file → silent no-op */
        },
        onplayerror: () => {
          /* gesture/decoding hiccup → silent */
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
    if (!this.enabled) return
    const howl = this.getHowl(cue)
    if (!howl) return
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
