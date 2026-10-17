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
  // `star`, `sticker-reveal` and `round-complete` are DELETED (Endless Play PRD-01 §8): the star
  // beats and the round jingle went with the result screen, and the crossing chime went with the
  // ring's flourish — the ceremony is the entire announcement now. The mp3s stay under
  // `public/sounds/ui/`; a cue name nothing plays is what this list exists to keep out.
  | 'page-complete'
  | 'level-up'
  // Navigation cues (Liveliness PRD-02): a per-skin travel whoosh fired at cover start, and a softer
  // reverse on back — ONE sound per hop. The arrive chime on a menu reveal (`menu-open`) is DELETED
  // (2026-10-04, owner: a gong after every hop), and so is the `card-pop` on tapping a card (2026-10-17,
  // owner: a pop and then the whoosh is two sounds).
  | 'nav-whoosh'
  | 'nav-wave'
  | 'nav-warp'
  | 'nav-stomp'
  | 'back'
  // Fyld Båden (Harbour PRD-01): alias curated files until the harbour pack lands in /sounds/ui/.
  | 'fish-land'
  | 'box-land'
  | 'bundle'
  | 'horn'
  | 'splash'
  // Fyld Båden's two long sounds (owner's downloads, baked by scripts/bake-harbour-sounds.mjs): a quiet
  // looping harbour bed, and the diesel motor swelled in and out around each arrival and departure.
  | 'harbour-ambience'
  | 'boat-motor'
  // Krea's studio (Krea PRD-01 §2.3.14), synthesised by scripts/bake-krea-sounds.mjs. No ambience: it is
  // quiet while creating. Drawing and erasing make NO sound at all (owner, 2026-10-16: the crayon
  // scratch loop read as noise) — only picking, stamping, filling, undo and the paper do.
  | 'krea-shimmer'
  | 'krea-twinkle'
  | 'krea-stamp'
  | 'krea-undo'
  | 'krea-paper'
  | 'krea-pick'
  | 'krea-fill'
  | 'krea-tada'
  // Perleplade (Krea PRD-02): a bead lifted, pressed onto a peg, rolling home. Synthesised too.
  | 'bead-pick'
  | 'bead-place'
  | 'bead-back'
  | 'bead-popoff'

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
  'page-complete': '/sounds/ui/page-complete.mp3',
  // Level-up fanfare (Liveliness PRD-01). Aliases the page-complete jingle until a dedicated cue
  // ships (missing files degrade to silence anyway); the biggest celebratory moment in the app.
  'level-up': '/sounds/ui/page-complete.mp3',
  // Navigation cues (Liveliness PRD-02). One calm travel pair for every skin (owner 2026-10-17 picked a
  // soft rise and its mirror by ear); the per-skin names stay so a skin can get its own file again.
  // correct/wrong/tap/nav-forward/nav-back are baked by scripts/bake-ui-sounds.mjs.
  'nav-whoosh': '/sounds/ui/nav-forward.mp3',
  'nav-wave': '/sounds/ui/nav-forward.mp3',
  'nav-warp': '/sounds/ui/nav-forward.mp3',
  'nav-stomp': '/sounds/ui/nav-forward.mp3',
  back: '/sounds/ui/nav-back.mp3',
  // Kenney "Impact Sounds" (CC0): impactSoft_medium_002 (a fish lands) / impactWood_heavy_001 (a box).
  'fish-land': '/sounds/ui/fish-land.mp3',
  'box-land': '/sounds/ui/box-land.mp3',
  bundle: '/sounds/ui/streak-up.mp3',
  // The owner's ship's horn (dragon-studio, baked by scripts/bake-harbour-sounds.mjs): a correct send.
  horn: '/sounds/ui/boat-horn.mp3',
  splash: '/sounds/ui/flip.mp3',
  'harbour-ambience': '/sounds/ui/harbour-ambience.mp3',
  'boat-motor': '/sounds/ui/boat-motor.mp3',
  'krea-shimmer': '/sounds/ui/krea-shimmer.mp3',
  'krea-twinkle': '/sounds/ui/krea-twinkle.mp3',
  'krea-stamp': '/sounds/ui/krea-stamp.mp3',
  'krea-undo': '/sounds/ui/krea-undo.mp3',
  'krea-paper': '/sounds/ui/krea-paper.mp3',
  'krea-pick': '/sounds/ui/krea-pick.mp3',
  'krea-fill': '/sounds/ui/krea-fill.mp3',
  'krea-tada': '/sounds/ui/krea-tada.mp3',
  'bead-pick': '/sounds/ui/bead-pick.mp3',
  'bead-place': '/sounds/ui/bead-place.mp3',
  'bead-back': '/sounds/ui/bead-back.mp3',
  'bead-popoff': '/sounds/ui/bead-popoff.mp3',
}

// Not part of the first-gesture preload: a 40 s bed is ~320 KB and ~5 MB decoded, and only Fyld Båden
// plays these — they load when that game first asks for them.
const LAZY_CUES: ReadonlySet<SfxCue> = new Set<SfxCue>(['harbour-ambience', 'boat-motor'])

// Per-cue base volume — keep cues subtle so they don't fight narration.
// The answer + travel files (bake-ui-sounds.mjs) measure correct -21.9 / wrong -27.5 / tap -28.3 /
// nav-forward -28.5 / nav-back -32.2 LUFS, so these land at ≈ -29 / -34.5 / -37.4 / -34.5 / -38.2
// effective: correct a touch under the old cue, everything else well under narration.
const CUE_VOLUME: Partial<Record<SfxCue, number>> = {
  tap: 0.35,
  'pick-up': 0.4,
  'spring-back': 0.45,
  chomp: 0.55,
  match: 0.45,
  correct: 0.45,
  wrong: 0.45,
  'drop-snap': 0.5,
  flip: 0.4,
  'streak-up': 0.5,
  'page-complete': 0.6,
  'level-up': 0.6,
  // Forward stays a touch louder than back as the bigger move (owner 2026-10-04: stomp ≈ -34.5, back ≈
  // -37.9 LUFS effective — the new pair keeps that balance).
  'nav-whoosh': 0.5,
  'nav-wave': 0.5,
  'nav-warp': 0.5,
  'nav-stomp': 0.5,
  back: 0.5,
  'fish-land': 0.5,
  'box-land': 0.55,
  bundle: 0.5,
  // Baked at -24 LUFS → ~-28 effective: the loudest cue in the game, on purpose — it IS the reward beat.
  horn: 0.6,
  splash: 0.4,
  // Baked at -32 / -26 LUFS → ~-38 LUFS effective for the bed (under narration and every cue: it is
  // atmosphere; owner 2026-10-15 asked for "a bit louder" than the first ~-42) and ~-34 for the motor.
  'harbour-ambience': 0.5,
  'boat-motor': 0.4,
  'krea-shimmer': 0.45,
  'krea-twinkle': 0.45,
  'krea-stamp': 0.6,
  'krea-undo': 0.5,
  'krea-paper': 0.5,
  'krea-pick': 0.4,
  'krea-fill': 0.5,
  'krea-tada': 0.6,
  'bead-pick': 0.4,
  'bead-place': 0.45,
  'bead-back': 0.4,
  'bead-popoff': 0.55,
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
  /** The playing sound id of each running loop (one per cue). */
  private loops = new Map<SfxCue, number>()

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
        // Sounds switched off mid-loop: the bed stops too, rather than playing on until the screen ends.
        if (!this.enabled) for (const cue of [...this.loops.keys()]) this.stopLoop(cue, 0)
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
    ;(Object.keys(CUE_FILES) as SfxCue[]).filter((cue) => !LAZY_CUES.has(cue)).forEach((cue) => this.getHowl(cue))
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

  /**
   * Start a looping bed, fading in from silence. Idempotent: a cue that is already looping keeps going.
   * WebAudio gain, so the fade (and the level) are real on iOS, unlike an <audio> element's volume.
   */
  startLoop(cue: SfxCue, fadeInMs = 1500): void {
    this.logCue(cue)
    if (!this.enabled || this.loops.has(cue)) return
    const howl = this.getHowl(cue)
    if (!howl) return
    try {
      const id = howl.play()
      howl.loop(true, id)
      howl.fade(0, CUE_VOLUME[cue] ?? 0.5, fadeInMs, id)
      this.loops.set(cue, id)
    } catch {
      /* never let an SFX failure surface */
    }
  }

  /** Fade a running loop out and stop it. */
  stopLoop(cue: SfxCue, fadeOutMs = 800): void {
    const id = this.loops.get(cue)
    const howl = this.howls.get(cue)
    this.loops.delete(cue)
    if (id == null || !howl) return
    try {
      if (fadeOutMs <= 0) {
        howl.stop(id)
        return
      }
      howl.fade(howl.volume(id) as number, 0, fadeOutMs, id)
      setTimeout(() => {
        try {
          howl.stop(id)
        } catch {
          /* ignore */
        }
      }, fadeOutMs + 50)
    } catch {
      /* ignore */
    }
  }

  /** One swell: fade in, hold, fade out, stop — the motor as a boat comes in or leaves. */
  swell(cue: SfxCue, { fadeInMs, holdMs, fadeOutMs }: { fadeInMs: number; holdMs: number; fadeOutMs: number }): void {
    this.logCue(cue)
    if (!this.enabled) return
    const howl = this.getHowl(cue)
    if (!howl) return
    try {
      const id = howl.play()
      const peak = CUE_VOLUME[cue] ?? 0.5
      howl.fade(0, peak, fadeInMs, id)
      setTimeout(() => {
        try {
          howl.fade(howl.volume(id) as number, 0, fadeOutMs, id)
        } catch {
          /* ignore */
        }
      }, fadeInMs + holdMs)
      setTimeout(() => {
        try {
          howl.stop(id)
        } catch {
          /* ignore */
        }
      }, fadeInMs + holdMs + fadeOutMs + 50)
    } catch {
      /* never let an SFX failure surface */
    }
  }

  // DEV screenshot harness: the same cue log `play` keeps.
  private logCue(cue: SfxCue): void {
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      const w = window as unknown as { __sfxLog?: Array<{ cue: string; rate: number }> }
      if (!w.__sfxLog) w.__sfxLog = []
      w.__sfxLog.push({ cue, rate: 1 })
      if (w.__sfxLog.length > 80) w.__sfxLog.shift()
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
    this.loops.clear()
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
