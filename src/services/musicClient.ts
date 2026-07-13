import { Howl } from 'howler'
import { progressStore } from './progressStore'
import { simplifiedAudioController } from '../utils/SimplifiedAudioController'
import { devMusicOn } from '../utils/devHarness'

// Per-world ambient music (UI/UX Overhaul PRD §5.6).
//
// A SEPARATE Howler channel from TTS and SFX. It NEVER routes through SimplifiedAudioController
// (that singleton is TTS-only) — it only *listens* to the controller's play-state so it can DUCK
// under narration. It cross-fade-LOOPS the active world's track (a hand-rolled crossfade at the
// loop point so the seam is inaudible, with an optional body-trim so the loop never hits an
// intro/outro fade), cross-fades on world (theme) change, ducks under TTS, and respects
// `progressStore.settings.musicEnabled` + master mute.
//
// Tracks are per-world (WORLD_MUSIC). Worlds without a track yet are '' → silent (no music).
// Missing/broken files degrade to silence (onloaderror).

const BASE_VOLUME = 0.06 // subtle background bed — sets the mood without pulling focus from the game
const DUCK_RATIO = 0.15 // duck hard under TTS (music nearly disappears so narration stays clear)
const FADE_MS = 800
const DUCK_FADE_MS = 250
const CROSSFADE_MS = 1800 // overlap at the loop point so the restart is inaudible

// Per-world loop URLs (served from /public). Placeholders — swap per world when final loops land.
const WORLD_MUSIC: Record<string, string> = {
  kid: '/sounds/music/kid.mp3', // real loop
  ocean: '/sounds/music/ocean.mp3', // real loop
  space: '/sounds/music/space.mp3', // real loop
  dino: '/sounds/music/dino.mp3', // real loop
}

// Per-world volume multiplier — loudness-matches hot masters to the calm ones (default 1).
const WORLD_GAIN: Record<string, number> = {
  space: 0.3, // "Galaxy/Universe" master is ~11 dB hotter than the others → pull it down to match
}

// Optional per-world loop trim (seconds). When a track has an intro/outro fade or dead air, we
// loop only the full-energy body [loopStart, loopEnd] and crossfade within it, so the seam never
// touches the fade. Omit for tracks that are already even end-to-end.
const WORLD_LOOP: Record<string, { loopStart?: number; loopEnd?: number }> = {
  // "Rainbow Adventures" fades out from ~78s (85s total) → loop the body before the fade.
  kid: { loopEnd: 77.5 },
  // "Aquatic Downtime" fades out from ~255s (262s total) → loop the long body before the fade.
  ocean: { loopEnd: 254 },
  // "Galaxy/Universe" has a quieter ~15s intro then a loud body, fading out ~121s (125s total) →
  // loop only the consistent body (skip the intro dip and the tail fade).
  space: { loopStart: 17, loopEnd: 121 },
  // "Fantasy theme" is even end-to-end (no real fade); trim the last ~0.7s so the crossfade uses
  // clean body material.
  dino: { loopEnd: 153.5 },
}

interface Track {
  world: string
  howl: Howl
  id: number
  loopStart: number
  loopEnd?: number // body end (s); the crossfade happens before this so it never hits a fade
  gain: number // per-world volume multiplier (loudness match)
  loopTimer?: ReturnType<typeof setTimeout>
}

class MusicClient {
  private enabled = false
  private ttsActive = false
  private desiredWorld: string | null = null
  private current: Track | null = null

  constructor() {
    try {
      this.enabled = progressStore.get().settings.musicEnabled || devMusicOn()
      progressStore.subscribe(() => {
        const next = progressStore.get().settings.musicEnabled || devMusicOn()
        if (next === this.enabled) return
        this.enabled = next
        if (next) this.resume()
        else this.stop()
      })
    } catch {
      /* private mode → default off */
    }
    // Duck under TTS (listen only — music is never registered as audio on the controller).
    try {
      simplifiedAudioController.onPlayingStateChange(() => {
        this.ttsActive = simplifiedAudioController.isPlaying()
        this.applyVolume()
      })
    } catch {
      /* ignore */
    }
  }

  private volumeFor(gain: number): number {
    const base = BASE_VOLUME * gain
    return this.ttsActive ? base * DUCK_RATIO : base
  }

  private targetVolume(): number {
    return this.volumeFor(this.current?.gain ?? 1)
  }

  private applyVolume(): void {
    if (!this.current) return
    try {
      this.current.howl.fade(this.current.howl.volume(), this.targetVolume(), DUCK_FADE_MS)
    } catch {
      /* ignore */
    }
  }

  // Per-world URL override (from the theme's scene.music), set alongside setWorld.
  private worldUrl: Record<string, string> = {}

  // Set the active world (call on theme change). `url` (theme scene.music) overrides the default
  // map. Cross-fades if already playing a different world.
  setWorld(world: string, url?: string): void {
    this.desiredWorld = world
    if (url) this.worldUrl[world] = url
    if (!this.enabled) return
    if (this.current?.world === world) return
    this.crossFadeTo(world)
  }

  private crossFadeTo(world: string): void {
    const src = this.worldUrl[world] ?? WORLD_MUSIC[world]
    if (!src) {
      this.stop()
      return
    }
    let howl: Howl
    try {
      howl = new Howl({
        src: [src],
        // We hand-roll a crossfade loop (see scheduleLoop) instead of Howler's hard-restart
        // `loop:true`, so the seam is inaudible even for tracks not composed to loop.
        loop: false,
        volume: 0,
        html5: false,
        onloaderror: () => {
          /* missing/broken loop → silent */
        },
        onplayerror: () => {
          /* autoplay/gesture hiccup → silent (resumes on next gesture) */
        },
      })
    } catch {
      return
    }
    const trim = WORLD_LOOP[world] || {}
    const loopStart = trim.loopStart ?? 0
    const gain = WORLD_GAIN[world] ?? 1
    const id = howl.play()
    if (id == null) return
    if (loopStart > 0) {
      try {
        howl.seek(loopStart, id)
      } catch {
        /* ignore */
      }
    }
    try {
      howl.fade(0, this.volumeFor(gain), FADE_MS, id)
    } catch {
      /* ignore */
    }

    const old = this.current
    this.current = { world, howl, id, loopStart, loopEnd: trim.loopEnd, gain }
    // Schedule the first crossfade once the track duration is known.
    if (howl.state() === 'loaded') this.scheduleLoop()
    else howl.once('load', () => this.scheduleLoop())

    if (old) {
      if (old.loopTimer) clearTimeout(old.loopTimer)
      try {
        old.howl.fade(old.howl.volume(), 0, FADE_MS)
      } catch {
        /* ignore */
      }
      window.setTimeout(() => {
        try {
          old.howl.unload()
        } catch {
          /* ignore */
        }
      }, FADE_MS + 80)
    }
  }

  // Crossfade loop: a beat before the track ends, start a fresh instance from the top and
  // crossfade the two over CROSSFADE_MS so the loop join is smooth (no audible restart).
  private scheduleLoop(): void {
    const t = this.current
    if (!t) return
    if (t.loopTimer) clearTimeout(t.loopTimer)
    const dur = t.howl.duration()
    if (!dur || !isFinite(dur)) return
    const effEnd = t.loopEnd ?? dur // loop the body, never into a trailing fade
    const delay = Math.max(1000, (effEnd - t.loopStart - CROSSFADE_MS / 1000) * 1000)
    t.loopTimer = setTimeout(() => this.doCrossfade(), delay)
  }

  private doCrossfade(): void {
    const t = this.current
    if (!t) return
    const target = this.targetVolume()
    let newId: number
    try {
      newId = t.howl.play() // a second concurrent instance from the top
      if (t.loopStart > 0) t.howl.seek(t.loopStart, newId)
      t.howl.fade(0, target, CROSSFADE_MS, newId)
    } catch {
      return
    }
    const oldId = t.id
    try {
      t.howl.fade(target, 0, CROSSFADE_MS, oldId)
    } catch {
      /* ignore */
    }
    window.setTimeout(() => {
      try {
        t.howl.stop(oldId)
      } catch {
        /* ignore */
      }
    }, CROSSFADE_MS + 120)
    t.id = newId
    this.scheduleLoop()
  }

  // Start/resume the desired world's loop (call on the first user gesture / when music is enabled).
  resume(): void {
    if (!this.enabled || !this.desiredWorld) return
    if (this.current) {
      // Already have a track — make sure it's audible and at the right (possibly ducked) volume.
      try {
        this.current.howl.play(this.current.id)
      } catch {
        /* ignore */
      }
      this.applyVolume()
      return
    }
    this.crossFadeTo(this.desiredWorld)
  }

  stop(): void {
    const t = this.current
    this.current = null
    if (!t) return
    if (t.loopTimer) clearTimeout(t.loopTimer)
    try {
      t.howl.fade(t.howl.volume(), 0, FADE_MS)
    } catch {
      /* ignore */
    }
    window.setTimeout(() => {
      try {
        t.howl.unload()
      } catch {
        /* ignore */
      }
    }, FADE_MS + 80)
  }

  // ----- introspection (used by the dev screenshot harness / verification) -----
  /** The world id of the currently-playing loop, or null. */
  playingWorld(): string | null {
    return this.current?.world ?? null
  }

  /** Current music volume (0 when stopped; drops toward DUCK_VOLUME under TTS). */
  currentVolume(): number {
    if (!this.current) return 0
    try {
      return this.current.howl.volume()
    } catch {
      return 0
    }
  }

  isDucked(): boolean {
    return this.ttsActive
  }
}

export const musicClient = new MusicClient()

// DEV: expose for the headless verification harness (see §8 acceptance for Phase 3).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __music?: MusicClient }).__music = musicClient
}
