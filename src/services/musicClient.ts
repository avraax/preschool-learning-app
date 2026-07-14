import { Howl, Howler } from 'howler'
import { progressStore } from './progressStore'
import { simplifiedAudioController } from '../utils/SimplifiedAudioController'
import { devMusicOn } from '../utils/devHarness'
import { SECTION_MENU_PATHS } from '../utils/menuPaths'

// Per-world ambient music (UI/UX Overhaul PRD §5.6).
//
// A SEPARATE Howler channel from TTS and SFX. It NEVER routes through SimplifiedAudioController
// (that singleton is TTS-only) — it only *listens* to the controller's play-state so it can DUCK
// under narration. It cross-fades on world (theme) change, ducks under TTS, and respects
// `progressStore.settings.musicEnabled` + master mute.
//
// iOS PWA note (crash reports WSNHY / STQ9N): music uses Howler's **HTML5-Audio backend**
// (`html5: true`), NOT WebAudio. WebAudio music crashed on iPadOS — when iOS interrupts/suspends
// the audio session (e.g. the instant TTS starts its own playback) Howler's buffer teardown ran on
// an already-freed node and threw `undefined is not an object (evaluating 'a.bufferSource')` in
// `_cleanBuffer`/`_ended`. An <audio> element streams the file, survives session interruptions, has
// no bufferSource to tear down (that code path is WebAudio-only), and doesn't decode the whole
// track into memory (~90 MB PCM for the long ocean loop). We loop the track's full-energy body with
// a **native looping sprite** (so the loop never hits an intro/outro fade) instead of a hand-rolled
// re-play crossfade — iOS blocks off-gesture `play()` on <audio>, so a timer-driven re-play would
// silently die at the first loop point.
//
// Tracks are per-world (WORLD_MUSIC). Worlds without a track are '' → silent (no music).
// Missing/broken files degrade to silence (onloaderror).

const BASE_VOLUME = 0.045 // subtle background bed — sets the mood without pulling focus from the game
const DUCK_RATIO = 0.15 // duck hard under TTS (music nearly disappears so narration stays clear)
const FADE_MS = 800
const DUCK_FADE_MS = 250

const LOOP_SPRITE = '__bed' // the trimmed, looping body region

// Per-world loop URLs (served from /public).
const WORLD_MUSIC: Record<string, string> = {
  kid: '/sounds/music/kid.mp3',
  ocean: '/sounds/music/ocean.mp3',
  space: '/sounds/music/space.mp3',
  dino: '/sounds/music/dino.mp3',
}

// Per-world volume multiplier — loudness-matches hot masters to the calm ones (default 1).
const WORLD_GAIN: Record<string, number> = {
  space: 0.3, // "Galaxy/Universe" master is ~11 dB hotter than the others → pull it down to match
}

// Optional per-world loop trim (seconds). When a track has an intro/outro fade or dead air, we loop
// only the full-energy body [loopStart, loopEnd] so the loop join never touches a fade. Omit for
// tracks that are already even end-to-end (→ a plain full-file native loop).
const WORLD_LOOP: Record<string, { loopStart?: number; loopEnd?: number }> = {
  // "Rainbow Adventures" fades out from ~78s (85s total) → loop the body before the fade.
  kid: { loopEnd: 77.5 },
  // "Aquatic Downtime" fades out from ~255s (262s total) → loop the long body before the fade.
  ocean: { loopEnd: 254 },
  // "Galaxy/Universe" has a quieter ~15s intro then a loud body, fading out ~121s (125s total) →
  // loop only the consistent body (skip the intro dip and the tail fade).
  space: { loopStart: 17, loopEnd: 121 },
  // "Fantasy theme" is even end-to-end (no real fade); trim the last ~0.7s.
  dino: { loopEnd: 153.5 },
}

// Music is a MENU / front-page bed only — it must NOT play inside a game (or a content/browse
// screen), so narration + SFX own the mix there. These are the only routes that keep music on;
// everything deeper (games and Lær/browse screens) fades the bed out. Shares the section list with
// scene/routeKind (src/utils/menuPaths.ts) and adds the /album reward hub, where the bed keeps
// playing (the scene, by contrast, dims /album — see menuPaths.ts).
const MENU_PATHS = new Set<string>([...SECTION_MENU_PATHS, '/album'])
function routeAllowsMusic(pathname: string): boolean {
  const p = (pathname || '/').replace(/\/+$/, '')
  return MENU_PATHS.has(p === '' ? '/' : p)
}

interface Track {
  world: string
  howl: Howl
  id: number
  gain: number // per-world volume multiplier (loudness match)
}

class MusicClient {
  private enabled = false
  private ttsActive = false
  private desiredWorld: string | null = null
  private current: Track | null = null
  private worldUrl: Record<string, string> = {}
  private hiddenPaused = false // paused because the app was backgrounded (not user-disabled)
  private inGame = false // suppressed because the current route is a game/content screen (not a menu)
  private lastError: string | null = null

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
    // Stop music when the PWA is backgrounded / closed — iOS otherwise keeps the <audio> element
    // playing after the app is dismissed. Resume when it returns to the foreground.
    try {
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') this.pauseForBackground()
          else this.resumeFromBackground()
        })
      }
      if (typeof window !== 'undefined') {
        window.addEventListener('pagehide', () => this.pauseForBackground())
      }
    } catch {
      /* ignore */
    }
    // Seed the in-game flag from the initial route so music never auto-starts if the app is
    // deep-linked / reloaded straight into a game (the router later keeps it in sync via setRoute).
    try {
      if (typeof window !== 'undefined') this.inGame = !routeAllowsMusic(window.location.pathname)
    } catch {
      /* ignore */
    }
  }

  // Diagnostics breadcrumb — captured by diagnosticsBuffer's console ring, so it lands in bug
  // reports. Kept to meaningful lifecycle events only (no per-frame spam).
  private log(msg: string): void {
    try {
      console.info(`[music] ${msg}`)
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

  // Set the active world (call on theme change). `url` (theme scene.music) overrides the default
  // map. Cross-fades if already playing a different world.
  setWorld(world: string, url?: string): void {
    this.desiredWorld = world
    if (url) this.worldUrl[world] = url
    if (!this.enabled || this.inGame) return
    if (this.current?.world === world) return
    this.crossFadeTo(world)
  }

  // Route → music context. Music is a menu/front-page bed only; entering a game (or a content
  // /browse screen) fades it out, returning to a menu fades it back in. Called on every navigation.
  setRoute(pathname: string): void {
    this.setInGame(!routeAllowsMusic(pathname))
  }

  private setInGame(inGame: boolean): void {
    if (inGame === this.inGame) return
    this.inGame = inGame
    if (inGame) {
      // Entering a game → fade the bed out + unload (stop()); no music under a game.
      this.stop()
      this.log('suppress (entered game)')
    } else {
      // Back to a menu/front page → recreate + fade the bed in (same proven path as first start).
      this.log('unsuppress (back to menu)')
      if (this.enabled && !this.hiddenPaused && this.desiredWorld) this.crossFadeTo(this.desiredWorld)
    }
  }

  private crossFadeTo(world: string): void {
    const src = this.worldUrl[world] ?? WORLD_MUSIC[world]
    if (!src) {
      this.stop()
      return
    }
    const trim = WORLD_LOOP[world] || {}
    const loopStart = trim.loopStart ?? 0
    const gain = WORLD_GAIN[world] ?? 1
    // A trimmed body needs a looping sprite; otherwise fall back to a plain full-file native loop.
    const hasBody = typeof trim.loopEnd === 'number' && trim.loopEnd > loopStart

    let howl: Howl
    try {
      howl = new Howl({
        src: [src],
        html5: true, // iOS-safe: stream via <audio>, no WebAudio bufferSource to crash
        loop: !hasBody,
        ...(hasBody
          ? { sprite: { [LOOP_SPRITE]: [loopStart * 1000, (trim.loopEnd! - loopStart) * 1000, true] } }
          : {}),
        volume: 0,
        onloaderror: (_id, err) => {
          this.lastError = `load:${String(err)}`
          this.log(`loaderror ${world} ${String(err)}`)
        },
        onplayerror: (_id, err) => {
          // autoplay/gesture hiccup — Howler auto-retries on the next unlock; record it.
          this.lastError = `play:${String(err)}`
          this.log(`playerror ${world} ${String(err)}`)
        },
      })
    } catch (e) {
      this.lastError = `create:${String(e)}`
      return
    }

    let id: number | null
    try {
      id = hasBody ? howl.play(LOOP_SPRITE) : howl.play()
    } catch (e) {
      this.lastError = `playthrow:${String(e)}`
      return
    }
    if (id == null) return
    try {
      // Group-level fade (no id): each Howl holds exactly one looping sound, so group volume ==
      // the sound's volume — and applyVolume()/stop()/the health getter all read the group, so
      // driving everything through the group keeps ducking + reporting consistent.
      howl.fade(0, this.volumeFor(gain), FADE_MS)
    } catch {
      /* ignore */
    }

    const old = this.current
    this.current = { world, howl, id, gain }
    this.hiddenPaused = false
    this.log(`play ${world} html5${hasBody ? ' body-loop' : ' full-loop'}`)

    if (old) {
      this.log(`switch ${old.world}→${world}`)
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

  // Start/resume the desired world's loop (call on the first user gesture / when music is enabled).
  resume(): void {
    if (!this.enabled || !this.desiredWorld || this.inGame) return
    if (this.current) {
      // Already have a track — make sure it's audible and at the right (possibly ducked) volume.
      try {
        this.current.howl.play(this.current.id)
      } catch {
        /* ignore */
      }
      this.hiddenPaused = false
      this.applyVolume()
      return
    }
    this.crossFadeTo(this.desiredWorld)
  }

  stop(): void {
    const t = this.current
    this.current = null
    this.hiddenPaused = false
    if (!t) return
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

  // App backgrounded/closed: pause the element so audio doesn't linger behind the PWA on iOS.
  private pauseForBackground(): void {
    if (!this.current || this.hiddenPaused) return
    this.hiddenPaused = true
    try {
      this.current.howl.pause(this.current.id)
    } catch {
      /* ignore */
    }
    this.log('pause (background)')
  }

  // App foregrounded: resume only if we paused it for backgrounding (respect a user disable).
  private resumeFromBackground(): void {
    if (!this.enabled || !this.hiddenPaused || this.inGame) return
    this.hiddenPaused = false
    if (this.current) {
      try {
        this.current.howl.play(this.current.id)
        this.applyVolume()
      } catch {
        /* ignore */
      }
      this.log('resume (foreground)')
    } else if (this.desiredWorld) {
      this.crossFadeTo(this.desiredWorld)
    }
  }

  // ----- introspection (dev screenshot harness / verification / bug reports) -----
  /** The world id of the currently-playing loop, or null. */
  playingWorld(): string | null {
    return this.current?.world ?? null
  }

  /** Current music volume (0 when stopped; drops toward the ducked level under TTS). */
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

  /** Compact health snapshot for bug reports (music-issue triage). */
  getHealth(): {
    enabled: boolean
    ttsActive: boolean
    desiredWorld: string | null
    world: string | null
    playing: boolean
    volume: number
    html5: true
    hiddenPaused: boolean
    inGame: boolean
    ctxState: string | null
    lastError: string | null
  } {
    let playing = false
    let ctxState: string | null = null
    try {
      playing = !!this.current && this.current.howl.playing(this.current.id)
    } catch {
      /* ignore */
    }
    try {
      ctxState = Howler.ctx?.state ?? null
    } catch {
      /* ignore */
    }
    return {
      enabled: this.enabled,
      ttsActive: this.ttsActive,
      desiredWorld: this.desiredWorld,
      world: this.current?.world ?? null,
      playing,
      volume: this.currentVolume(),
      html5: true,
      hiddenPaused: this.hiddenPaused,
      inGame: this.inGame,
      ctxState,
      lastError: this.lastError,
    }
  }
}

export const musicClient = new MusicClient()

// DEV: expose for the headless verification harness (see §8 acceptance for Phase 3).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __music?: MusicClient }).__music = musicClient
}
