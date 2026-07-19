import { Howl } from 'howler'
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
  tap: '/sounds/ui/tap.ogg',
  'pick-up': '/sounds/ui/tap.ogg',
  'spring-back': '/sounds/ui/wrong.ogg',
  chomp: '/sounds/ui/drop-snap.ogg',
  match: '/sounds/ui/correct.ogg',
  correct: '/sounds/ui/correct.ogg',
  wrong: '/sounds/ui/wrong.ogg',
  'drop-snap': '/sounds/ui/drop-snap.ogg',
  flip: '/sounds/ui/flip.ogg',
  'streak-up': '/sounds/ui/streak-up.ogg',
  star: '/sounds/ui/star.ogg',
  'sticker-reveal': '/sounds/ui/sticker-reveal.ogg',
  'round-complete': '/sounds/ui/round-complete.ogg',
  'page-complete': '/sounds/ui/page-complete.ogg',
  // Level-up fanfare (Liveliness PRD-01). Aliases the page-complete jingle until a dedicated cue
  // ships (missing files degrade to silence anyway); the biggest celebratory moment in the app.
  'level-up': '/sounds/ui/page-complete.ogg',
  // Navigation cues (Liveliness PRD-02). Reuse existing curated files until dedicated
  // /sounds/ui/{card-pop,nav-*,menu-open,back}.ogg ship; missing files degrade to silence.
  'card-pop': '/sounds/ui/tap.ogg',
  'nav-whoosh': '/sounds/ui/flip.ogg',
  'nav-wave': '/sounds/ui/flip.ogg',
  'nav-warp': '/sounds/ui/flip.ogg',
  'nav-stomp': '/sounds/ui/drop-snap.ogg',
  'menu-open': '/sounds/ui/star.ogg',
  back: '/sounds/ui/flip.ogg',
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
