import React, { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Box,
  Typography
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { Mic, MicOff } from 'lucide-react'
import { getCategoryTheme } from '../../config/categoryThemes'
import { darken, hexToRgba, onTileColor } from '../../theme/tokens/helpers'
import { softShadow, contactShadow } from '../../theme/depth'
import GameShell from '../common/GameShell'
import { HeroArt } from '../common/PromptArt'
import TactileTile from '../common/TactileTile'
import TactilePill from '../common/TactilePill'
import RoundResultScreen from '../common/RoundResultScreen'
import type { GuideReaction } from '../common/ThemeMascot'
import { useCelebration } from '../common/CelebrationEffect'
import { useGameState } from '../../hooks/useGameState'
import { useRound } from '../../hooks/useRound'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { progressStore, type RoundOutcome } from '../../services/progressStore'
import { mascotBus } from '../../services/mascotBus'
import { CHARGE, POP } from '../../theme/motion'
import { idlePulse } from '../../theme/idleMotion'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
import { isIOS } from '../../utils/deviceDetection'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'
import { useSpeechInput, SpeechResult } from '../../hooks/useSpeechInput'
import { normalizeSpokenWord, spokenWordArtId } from '../../config/spokenWordInput'
import { letterStepMs } from '../../config/letterClipTiming'
import { MIC_RETRY_LINE, MIC_HOLD_HINT, MIC_READY_LINE } from '../../config/gamePhrases'
import { ordlegArt } from '../../assets/games/ordleg'

// `arming` = the child is holding the button while the mic is still opening (only ever the first press
// of a visit). It exists because the board used to claim "Jeg lytter…" the instant the finger landed,
// while getUserMedia + MediaRecorder hadn't run yet — so the first syllable, often the whole word, was
// never captured. The UI must never say it is listening before the recorder is actually running.
type Phase = 'idle' | 'arming' | 'recording' | 'processing' | 'spelling' | 'retry'

// A transient spoken+written nudge shown in place of the idle call-to-action.
type Coach = 'hold' | 'ready' | null

const MIN_PRESS_MS = 350 // ignore accidental taps (measured from the RECORDER starting, not the press)
const MAX_PRESS_MS = 5000 // safety cap (single words need 3-5s; caps STT cost)
// Belt-and-braces: `useSpeechInput` already races the recognition against its own 12s budget, but a
// screen that can get PERMANENTLY stuck on "Lad mig tænke…" is the worst failure this game has (owner,
// 2026-08-04 — it reached that state on most attempts). So the board itself also refuses to wait
// forever, whatever the hook does. Longer than the hook's budget so the normal path always wins the
// race and this only fires when the hook is the thing wedged. Measured STT round-trip: ~1.0–1.3s.
const PROCESSING_WATCHDOG_MS = 16_000

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Equalizer bar count + per-bar response shaping. The bars are driven by the REAL mic level
// (`speech.getLevel()`) so the row is proof the device is hearing him — a canned loop animates just as
// happily on a dead microphone, which is the single worst thing this screen can lie about. The centre
// bars respond hardest, so the row reads as a voice rather than five identical blocks. When metering
// is unavailable (no AudioContext) the same loop falls back to a synthetic wave.
const BAR_RESPONSE = [0.55, 0.85, 1, 0.85, 0.55]
const BAR_IDLE_SCALE = 0.35

// BIG animated mic + live-level equalizer (§6D). Persistent across idle/recording/processing/
// retry — it never remounts mid-gesture (only its `phase`-driven animate targets change), so the
// hold-to-talk pointer capture that started the recording is never lost. Reduced motion → static
// mic (no pulse, no bar animation); the phase colour/opacity state still communicates the mode.
interface MicHeroProps {
  phase: Phase
  supported: boolean
  isBusy: boolean
  accent: string
  // Readable-on-white accent for the idle caption on light scenes (see theme.onTileColor).
  onTileColor: string
  dark: boolean
  reduce: boolean
  /** Idle call-to-action under the orb, or null while a transient coach line owns the message. */
  caption: string | null
  /** Instantaneous mic level 0..1, or -1 when metering is unavailable. */
  getLevel: () => number
  onPressStart: (e: React.PointerEvent) => void
  onPressEnd: (e?: React.PointerEvent) => void
}

const MicHero: React.FC<MicHeroProps> = ({ phase, supported, isBusy, accent, onTileColor, dark, reduce, caption, getLevel, onPressStart, onPressEnd }) => {
  const recording = phase === 'recording'
  // "I'm listening" pulse — CSS keyframes, same 1.1 / 1s as the framer loop it replaces (PRD-01 W1).
  const micPulse = idlePulse(reduce || !recording, { peak: 1.1, durationS: 1 })
  const barsRef = useRef<Array<HTMLDivElement | null>>([])

  // Level-driven meter. Runs on a rAF loop writing transforms directly — no React state at 60fps.
  useEffect(() => {
    const setAll = (scale: number) => {
      barsRef.current.forEach(el => {
        if (el) el.style.transform = `scaleY(${scale})`
      })
    }
    if (!recording || reduce) {
      setAll(BAR_IDLE_SCALE)
      return
    }
    let raf = 0
    const current = BAR_RESPONSE.map(() => BAR_IDLE_SCALE)
    const startedAt = performance.now()
    const tick = (now: number) => {
      const level = getLevel()
      for (let i = 0; i < BAR_RESPONSE.length; i++) {
        const el = barsRef.current[i]
        if (!el) continue
        const target =
          level >= 0
            ? BAR_IDLE_SCALE + Math.min(1, level * BAR_RESPONSE[i]) * (1 - BAR_IDLE_SCALE)
            // No metering available → a synthetic wave, so the row still reads as "recording".
            : BAR_IDLE_SCALE + (0.5 + 0.5 * Math.sin((now - startedAt) / 250 + i * 0.7)) * 0.55
        // Asymmetric smoothing: jump up with the voice, fall back gently (a raw RMS meter jitters).
        const k = target > current[i] ? 0.5 : 0.18
        current[i] += (target - current[i]) * k
        el.style.transform = `scaleY(${current[i].toFixed(3)})`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [recording, reduce, getLevel])

  if (!supported) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
        <MicOff size={72} color={accent} />
      </Box>
    )
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: { xs: 0.75, md: 1.25 },
        width: '100%',
        height: '100%',
      }}
    >
      {/* Orb zone: a grounded contact-shadow ellipse (the mic RESTS in the world, PRD-10 §3.5) sits
          behind + beneath the clay orb. Static — the mic never idle-floats (a drifting target under a
          still finger is exactly what a 5-year-old's hold cannot survive). */}
      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            left: '50%',
            bottom: '-11%',
            width: '78%',
            height: '20%',
            transform: 'translateX(-50%)',
            background: contactShadow(recording ? '#FF6B6B' : accent, dark ? 1 : 0.9),
            filter: 'blur(8px)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
        {/* "I'm listening" pulse — CSS keyframes, same 1.1 / 1s (Performance PRD-01 W1). It runs only
            while recording, and this element carries no framer transform, so it can own it. */}
        <Box
          {...micPulse.props}
          sx={[
            { display: 'inline-block', position: 'relative', zIndex: 1, transition: reduce ? 'none' : 'transform 0.2s ease' },
            micPulse.sx,
          ]}
        >
          {/* HIT-SLOP WRAPPER. The pressable element is this padded box, not the clay circle, so the
              touch target is ~16px larger than the art on every side (~26px on phone landscape, where the
              stage caps the circle at 52–72px and a small finger has least room). Measured: 168px of art
              → a 200px target on iPad. A `::after` ring was tried first and Chrome did NOT hit-test it
              (proved with elementFromPoint), which is why this is a real box with padding. */}
          <Box
            role="button"
            aria-label="Sig et ord"
            onPointerDown={onPressStart}
            onPointerUp={onPressEnd}
            onPointerCancel={onPressEnd}
            // Hold-to-talk IS a long press, which is the browser's touch-and-hold gesture: on release
            // Chrome/iOS pop the context ("right-click") menu straight over the game (owner, iPad Air
            // emulation). `preventDefault()` on pointerdown does NOT suppress it — the contextmenu
            // event is separate and must be cancelled itself. `WebkitTouchCallout`/`userSelect` below
            // handle the iOS callout bubble; this handles the menu.
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation() }}
            // NO onPointerLeave: it used to end the press, so a finger sliding a few millimetres off
            // the orb aborted the recording mid-word. The press now owns the pointer via
            // setPointerCapture (see handlePressStart) and ends only on up/cancel.
            sx={{
              // The PADDING is the hit-slop (see the comment above): pressable box = art + 16px on every
              // side, 26px on phone landscape. It costs no visual space that the art wasn't already
              // centred in, so the layout is unchanged.
              // Padding grows the target; the matching NEGATIVE MARGIN keeps the layout box exactly the
              // size of the art, so nothing on the board moves because of the slop.
              p: '16px',
              m: '-16px',
              [PHONE_LANDSCAPE]: { p: '26px', m: '-26px' },
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isBusy ? 'default' : 'pointer',
              userSelect: 'none',
              touchAction: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
              pointerEvents: isBusy ? 'none' : 'auto',
            }}
          >
          {/* The clay orb itself — art only, no handlers (the wrapper above owns the gesture). */}
          <Box
            aria-hidden
            sx={{
              width: 'clamp(88px, 24vh, 168px)',
              height: 'clamp(88px, 24vh, 168px)',
              // Phone landscape's whole stage is only ~85px tall (30% of a ~390px-tall body) — the
              // waveform row is dropped there (below) so the mic alone owns the budget; measured via
              // --measure to confirm it clears the frame (was overflowing top+bottom at 96px).
              [PHONE_LANDSCAPE]: { width: 'clamp(52px, 16vh, 72px)', height: 'clamp(52px, 16vh, 72px)' },
              borderRadius: '50%',
              mx: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: recording
                ? `radial-gradient(circle at 50% 40%, #FF8A80 0%, ${accent} 100%)`
                : `linear-gradient(160deg, ${accent} 0%, ${darken(accent, 0.28)} 100%)`,
              border: '6px solid white',
              // Clay depth (matches the tactile language): a layered softShadow drop-shadow + top
              // inner-light highlight — NOT the old flat glossy `0 8px 24px`. The recording halo
              // (the accent ring) stays as a boxShadow ring on top.
              boxShadow: recording
                ? `0 0 0 10px ${hexToRgba(accent, 0.3)}, inset 0 3px 5px rgba(255,255,255,0.45)`
                : 'inset 0 3px 5px rgba(255,255,255,0.45)',
              filter: softShadow(dark ? 1.7 : 1.4),
              opacity: isBusy ? 0.6 : 1,
              transition: 'background 0.2s ease, box-shadow 0.2s ease',
            }}
          >
            <Mic size={44} color="white" />
          </Box>
          </Box>
        </Box>
      </Box>

      {/* Live level meter — real mic amplitude while recording, a still row otherwise/reduced motion.
          Hidden on phone landscape: the ~85px stage there is already fully spent on the mic circle
          alone (measured via --measure — the row was overflowing the frame at any smaller size). */}
      <Box
        aria-hidden
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: '5px',
          height: 26,
          [PHONE_LANDSCAPE]: { display: 'none' },
        }}
      >
        {BAR_RESPONSE.map((_, i) => (
          <Box
            key={i}
            ref={(el: HTMLDivElement | null) => { barsRef.current[i] = el }}
            // Test hook: the level meter is the only on-screen proof the mic is live, so it needs to be
            // measurable without guessing at DOM shape (see the mic E2E probe).
            data-mic-bar={i}
            sx={{
              width: 7,
              height: 26,
              [PHONE_LANDSCAPE]: { width: 4, height: 16 },
              borderRadius: 3,
              transformOrigin: 'bottom',
              transform: `scaleY(${BAR_IDLE_SCALE})`,
              bgcolor: recording ? '#FF8A80' : hexToRgba(accent, dark ? 0.55 : 0.4),
            }}
          />
        ))}
      </Box>

      {/* Call-to-action, RIGHT under the mic (PRD-18 W4): button + label read as one unit instead of
          the label floating low in the body with a dead band between. Hidden on phone-landscape (the
          ~85px stage is already fully spent on the mic circle alone — that fallback lives in the
          body), and stood down while a transient status/coach line owns the message. */}
      {caption && (
        <Typography
          sx={{
            fontSize: { xs: '1.2rem', md: '1.55rem' },
            fontWeight: 700,
            textAlign: 'center',
            px: 2,
            color: dark ? '#FFFFFF' : onTileColor,
            textShadow: dark ? '0 2px 10px rgba(0,0,0,0.5)' : 'none',
            [PHONE_LANDSCAPE]: { display: 'none' },
          }}
        >
          {caption}
        </Typography>
      )}
    </Box>
  )
}

// PROMINENT spell-out banner (§6D) — replaces the old small letter-reveal boxes. Each recognized
// letter pops in with `motion.POP`; the whole word is spoken via the existing per-letter audio in
// `runSpellingSequence` (unchanged). Reduced motion → letters still appear (opacity only, instant).
interface SpellBannerProps {
  word: string
  letters: string[]
  revealCount: number
  accent: string
  dark: boolean
  reduce: boolean
}

const SpellBanner: React.FC<SpellBannerProps> = ({ word, letters, revealCount, accent, dark, reduce }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: { xs: 1, md: 1.75 }, width: '100%', [PHONE_LANDSCAPE]: { gap: 0.4 } }}>
    <Typography
      data-spell-banner
      sx={{
        fontSize: 'clamp(1.8rem, 8vh, 3.6rem)',
        fontWeight: 800,
        letterSpacing: '0.08em',
        lineHeight: 1,
        // Spelled-back word banner: white on dark scenes, readable-on-white accent on light scenes
        // (Ordleg's orange accent fails on white on Rummet/Dino). See onTileColor.
        color: dark ? '#FFFFFF' : onTileColor(accent),
        textShadow: dark ? '0 2px 10px rgba(0,0,0,0.5)' : 'none',
        [PHONE_LANDSCAPE]: { fontSize: '1.15rem' },
      }}
    >
      {word.toUpperCase()}
    </Typography>
    <Box sx={{ display: 'flex', gap: { xs: 1, md: 1.5 }, flexWrap: 'wrap', justifyContent: 'center', [PHONE_LANDSCAPE]: { gap: 0.5 } }}>
      {letters.map((letter, index) => {
        const revealed = index < revealCount
        const glyph = (
          <Typography
            sx={{
              fontSize: { xs: '1.6rem', sm: '1.9rem', md: '2.8rem' },
              fontWeight: 700,
              // Revealed letters sit on a white clay tile — the raw Ordleg accent (orange on
              // Rummet/Dino) was illegible there; onTileColor darkens only the too-light accents.
              color: onTileColor(accent),
              userSelect: 'none',
              [PHONE_LANDSCAPE]: { fontSize: '1.05rem' },
            }}
          >
            {letter}
          </Typography>
        )
        return (
          <motion.div
            key={`${word}-${index}`}
            initial={reduce ? false : { opacity: 0, scale: 0.5 }}
            animate={
              reduce
                ? { opacity: revealed ? 1 : 0.3 }
                : { opacity: revealed ? 1 : 0.3, scale: revealed ? 1 : 0.88 }
            }
            transition={reduce ? { duration: 0 } : POP}
          >
            <Box
              sx={{
                width: { xs: 56, sm: 64, md: 84 },
                height: { xs: 56, sm: 64, md: 84 },
                // Phone-landscape stage budget is only ~80px total; the mic-hero fix above showed
                // this size class needs real margin, not a razor-edge fit — shrunk accordingly.
                [PHONE_LANDSCAPE]: { width: 36, height: 36 },
              }}
            >
              {/* Revealed letter = tactile clay display tile (TactileTile, non-interactive) — retires
                  the old #ECF1F8 gradient + `0 6px 0` keyboard lip (PRD-10 §3.5). Unrevealed = a faint
                  dashed placeholder (the letter shows dimmed via the parent motion opacity). The letter
                  stays Comic Sans type. */}
              {revealed ? (
                <TactileTile interactive={false} accent={accent} variant="tile">
                  {glyph}
                </TactileTile>
              ) : (
                <Box
                  sx={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '18px',
                    border: `3px dashed ${hexToRgba(accent, dark ? 0.5 : 0.3)}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {glyph}
                </Box>
              )}
            </Box>
          </motion.div>
        )
      })}
    </Box>
  </Box>
)

const SpeakWordGame: React.FC = () => {
  const muiTheme = useTheme()
  // Live, skin-aware ordleg theme (§3.6) — static `categoryThemes.ordleg` shows kid-skin colours on
  // Havet/Rummet/Dino. Re-runs on skin change (muiTheme drives the re-render).
  const theme = getCategoryTheme('ordleg')
  const reduce = useReducedMotion()
  const audio = useSimplifiedAudioHook({ componentId: 'SpeakWordGame', autoInitialize: false })
  const speech = useSpeechInput()

  const { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration } = useCelebration()

  // In-round word count + bounded round (Overhaul Ordleg §3). Open-ended: a "question" = one
  // recognized word; there is NO target word and NO STT grading.
  const { incrementScore, resetScore } = useGameState()
  // Sig et Ord is on the difficulty EXEMPT list (open-ended by design — there is no target word to
  // grade), so it keeps fixed star thresholds: nothing gets harder at Svær here, so loosening them
  // would just be a free 3★. See `EXEMPT` in src/config/difficulty.ts.
  const round = useRound({ length: 8, starThresholds: { three: 0, two: 2 }, gameId: 'ordleg.mic' })
  const firstTryRef = useRef(true)
  const [roundOutcome, setRoundOutcome] = useState<RoundOutcome | null>(null)

  const [phase, setPhaseState] = useState<Phase>('idle')
  const [coach, setCoach] = useState<Coach>(null)
  const [recognizedWord, setRecognizedWord] = useState('')
  const [revealCount, setRevealCount] = useState(0)
  const [guideReaction, setGuideReaction] = useState<GuideReaction>(null)
  const guideReactionTimer = useRef<NodeJS.Timeout | null>(null)

  // Cue the corner guide, clearing the reaction a beat later so it settles + re-fires.
  const reactGuide = (reaction: GuideReaction) => {
    setGuideReaction(reaction)
    if (guideReactionTimer.current) clearTimeout(guideReactionTimer.current)
    guideReactionTimer.current = setTimeout(() => setGuideReaction(null), 1100)
  }

  const phaseRef = useRef<Phase>('idle')
  const setPhase = (p: Phase) => {
    phaseRef.current = p
    setPhaseState(p)
  }

  const recordStartRef = useRef(0)
  const maxTimerRef = useRef<NodeJS.Timeout | null>(null)
  const endingRef = useRef(false)
  const mountedRef = useRef(true)
  // One id per recognition attempt. The watchdog ORPHANS an attempt by bumping this, so a recognition
  // that resolves after we've already coached the child never advances the round a second time.
  const attemptRef = useRef(0)
  // Is the child's finger still down? The arming continuation needs to know, since the mic can finish
  // opening after they let go (first press of a visit).
  const pressActiveRef = useRef(false)
  const pressTargetRef = useRef<{ el: HTMLElement; id: number } | null>(null)

  const clearMaxTimer = () => {
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current)
      maxTimerRef.current = null
    }
  }

  useEffect(() => {
    // `true` HERE, not just as the useRef initial value. React StrictMode mounts → cleans up → remounts
    // in dev, and a ref only takes its initial value once — so without this line the cleanup below
    // stranded `mountedRef` at false on the live mount, every `if (!mountedRef.current) return` after an
    // await bailed, and the game froze on "Lad mig tænke…" forever (owner, 2026-08-04: "most of the
    // times"). This is the exact trap in `.claude/rules/game-development.md`; the file has always had
    // the broken shape, so the freeze predates this rework.
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearMaxTimer()
      if (guideReactionTimer.current) clearTimeout(guideReactionTimer.current)
      // Hand the mic back to the OS immediately (the hook does this too — the indicator must clear
      // whichever teardown runs first).
      speech.release()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Open the mic for the visit. Chrome/Edge tell us whether access is already granted, so we only
  // pre-open when it is (an unexplained permission dialog on arrival is worse friction than the
  // one-time prompt on the first press). Safari has no 'microphone' permission name — the query throws
  // and we warm optimistically: within one app session a second visit to this game then costs nothing,
  // and a refusal is silent (the press path re-primes inside the gesture).
  useEffect(() => {
    let cancelled = false
    const warm = async () => {
      if (!speech.isSupported) return
      try {
        const status = await navigator.permissions?.query({ name: 'microphone' as PermissionName })
        if (cancelled) return
        if (!status || status.state === 'granted') void speech.prime({ silent: true })
      } catch {
        if (!cancelled) void speech.prime({ silent: true })
      }
    }
    void warm()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The mic is unusable only once an attempt has actually been refused — never on 'unknown', which is
  // the cold state, and never latched: a later prime() can still succeed (the adult grants access in
  // Settings, or another app releases the device), which is what the retry on the fallback screen is for.
  const micBlocked = !speech.isSupported || speech.permission === 'denied' || speech.permission === 'error'
  const supported = !micBlocked

  const releaseCapture = () => {
    const target = pressTargetRef.current
    pressTargetRef.current = null
    if (!target) return
    try {
      if (target.el.hasPointerCapture(target.id)) target.el.releasePointerCapture(target.id)
    } catch {
      /* ignore */
    }
  }

  // Both press handlers are held in refs so the window-level safety net (below) and the max-length
  // timer always call the CURRENT closure without re-subscribing on every render.
  const pressEndRef = useRef<(e?: React.PointerEvent) => void>(() => {})

  const beginRecording = useCallback((): boolean => {
    if (!speech.startRecording()) return false
    recordStartRef.current = Date.now()
    setPhase('recording')
    // The mascot "listens" while recording (§6D) — a distinct cue from the correct/wrong reaction
    // fired later in handleResult.
    mascotBus.emit('hint')
    clearMaxTimer()
    maxTimerRef.current = setTimeout(() => { pressEndRef.current() }, MAX_PRESS_MS)
    return true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePressStart = (e: React.PointerEvent) => {
    // Suppress the iOS long-press callout menu and keep the gesture for getUserMedia.
    e.preventDefault()
    if (phaseRef.current !== 'idle') return

    setCoach(null)
    // Stop any playback before recording so TTS doesn't feed into the mic.
    audio.updateUserInteraction()
    audio.stopAll()

    endingRef.current = false
    pressActiveRef.current = true
    // Own the pointer for the whole press: without this, a finger drifting off the 88–168px orb fired
    // pointerleave and killed the recording mid-word.
    try {
      const el = e.currentTarget as HTMLElement
      el.setPointerCapture(e.pointerId)
      pressTargetRef.current = { el, id: e.pointerId }
    } catch {
      /* pointer capture is a nicety, not a requirement */
    }

    // Warm mic (the normal case): recording starts synchronously, so "Jeg lytter…" is true from the
    // first frame and nothing of the word is lost.
    if (beginRecording()) return

    // First press of the visit (or the OS took the device back): open it inside THIS gesture — iOS
    // requires the user activation for getUserMedia.
    setPhase('arming')
    void (async () => {
      const ok = await speech.prime()
      if (!mountedRef.current) return
      if (!ok) {
        // permission state now drives the fallback screen
        setPhase('idle')
        pressActiveRef.current = false
        return
      }
      if (!pressActiveRef.current) {
        // They let go while the mic was opening. Say so out loud — the next press is instant.
        setPhase('idle')
        setCoach('ready')
        void audio.speak(MIC_READY_LINE).catch(() => {})
        return
      }
      if (!beginRecording()) setPhase('idle')
    })()
  }

  const handlePressEnd = async (e?: React.PointerEvent) => {
    if (e) e.preventDefault()
    releaseCapture()
    pressActiveRef.current = false

    // Still opening the mic — the arming continuation sees pressActive=false and coaches from there.
    if (phaseRef.current === 'arming') return
    if (phaseRef.current !== 'recording') return
    if (endingRef.current) return
    endingRef.current = true
    clearMaxTimer()

    // Measured from the RECORDER starting, not from the press: those differ on the arming path, and
    // the old version could send a clip far shorter than the press looked.
    const duration = Date.now() - recordStartRef.current

    if (duration < MIN_PRESS_MS) {
      // Too short to have captured a word. This used to reset SILENTLY, which reads as a dead button;
      // a 5-year-old can't read a hint, so say it.
      speech.cancel()
      setPhase('idle')
      setCoach('hold')
      void audio.speak(MIC_HOLD_HINT).catch(() => {})
      endingRef.current = false
      return
    }

    const attempt = ++attemptRef.current
    setPhase('processing')
    let result: SpeechResult | null
    try {
      result = await speech.stopAndRecognize()
    } catch {
      result = null
    }
    if (!mountedRef.current) return
    // The watchdog already gave up on this attempt and coached the child — dropping it here is what
    // stops a late answer from advancing the round twice.
    if (attemptRef.current !== attempt) return
    await handleResult(result)
  }
  pressEndRef.current = handlePressEnd

  // Watchdog: "Lad mig tænke…" must never be a terminal state. See PROCESSING_WATCHDOG_MS.
  useEffect(() => {
    if (phase !== 'processing') return
    const attempt = attemptRef.current
    const timer = setTimeout(() => {
      if (!mountedRef.current || attemptRef.current !== attempt || phaseRef.current !== 'processing') return
      attemptRef.current++ // orphan the in-flight recognition
      void friendlyRetry()
    }, PROCESSING_WATCHDOG_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Safety net: if the pointerup never reaches the orb (capture lost, element re-laid-out, a
  // system gesture), the press would otherwise hang until the 5s cap. Window-level up/cancel ends it.
  // Double-firing is harmless — `endingRef` + the phase check make the second call a no-op.
  useEffect(() => {
    if (phase !== 'recording' && phase !== 'arming') return
    const end = () => { void pressEndRef.current() }
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [phase])

  const finishRound = (firstTryCorrect: number, longestStreak: number) => {
    const outcome = progressStore.recordRoundResult(
      'ordleg.mic',
      { correct: firstTryCorrect, total: round.length, longestStreak },
      { starThresholds: { three: 0, two: 2 } },
    )
    setRoundOutcome(outcome)
  }

  const handleReplay = () => {
    stopCelebration()
    setRoundOutcome(null)
    round.reset()
    resetScore()
    firstTryRef.current = true
    setCoach(null)
    setPhase('idle')
    endingRef.current = false
  }

  // Friendly retry — no failure feeling. Stays on the SAME question (doesn't advance or count); this is
  // the only thing that breaks "first try". Shared by "nothing recognized" and the watchdog.
  const friendlyRetry = async () => {
    firstTryRef.current = false
    setPhase('retry')
    reactGuide('think')
    try {
      await audio.speak(MIC_RETRY_LINE)
    } catch { /* ignore */ }
    if (!mountedRef.current) return
    setPhase('idle')
    endingRef.current = false
    // The mic may have been dropped while we waited; re-open it during the idle beat.
    if (!speech.isPrimed) void speech.prime({ silent: true })
  }

  const handleResult = async (result: SpeechResult | null) => {
    const word = normalizeSpokenWord(result?.transcript ?? '')

    if (!word) {
      await friendlyRetry()
      return
    }

    setRecognizedWord(word)
    setRevealCount(0)
    setPhase('spelling')
    reactGuide('cheer')
    incrementScore()

    await runSpellingSequence(word)

    if (!mountedRef.current) return

    // One recognized word = one completed question. Advance the round (or finish it).
    const r = round.completeQuestion(firstTryRef.current)
    if (!r.done && r.streak > 0 && r.streak % 3 === 0) {
      celebrateTier('streak')
      mascotBus.emit('streak') // mascot does its streak pose, matching the shared quiz engine
    }
    if (r.done) {
      finishRound(r.firstTryCorrect, r.longestStreak)
    } else {
      firstTryRef.current = true // fresh question
      setPhase('idle')
    }
    endingRef.current = false
    // Insurance: iPadOS can end the track while the app talks (a call, Siri, another app). Re-open it
    // during the idle beat so the next press is still instant rather than paying "Et øjeblik…".
    if (!speech.isPrimed) void speech.prime({ silent: true })
  }

  const runSpellingSequence = async (word: string) => {
    const upper = word.toUpperCase()
    const letters = upper.split('')

    // Read the whole word back.
    try {
      await audio.speak(word)
    } catch { /* ignore */ }
    await wait(200)
    if (!mountedRef.current) return

    // Spell it out, paced on each letter's MEASURED spoken length — fire-and-forget, never awaited.
    // Awaiting `speakLetter` waits out Azure's 0.4–0.7s of trailing silence per letter, which is what
    // made the spell-out plod (~1.5–1.9s a letter for names that take 0.42–1.04s to say). The next
    // clip cancels the previous tail (single channel, no queue), so stepping on the letter's own
    // duration + playback startup is both faster and safe. See `src/config/letterClipTiming.ts` and
    // the DWELL note in `.claude/rules/audio-system.md`.
    for (let i = 0; i < letters.length; i++) {
      if (!mountedRef.current) return
      setRevealCount(i + 1)
      void audio.speakLetter(letters[i]).catch(() => {})
      await wait(letterStepMs(letters[i]))
    }

    await wait(150)
    if (!mountedRef.current) return

    // Celebrate and say the whole word again.
    celebrateTier('micro')
    try {
      await audio.speak(word)
    } catch { /* ignore */ }

    await wait(isIOS() ? 1500 : 2000)
    if (!mountedRef.current) return
    stopCelebration()
  }

  const isBusy = phase === 'processing' || phase === 'spelling'
  const letters = recognizedWord.toUpperCase().split('')
  const dark = muiTheme.scene.dark
  const idleCta = 'Hold knappen og sig et ord!'
  // One message at a time: a transient status/coach line replaces the idle call-to-action rather than
  // stacking under it.
  const statusLine =
    phase === 'arming' ? 'Et øjeblik…'
      : phase === 'recording' ? 'Jeg lytter…'
        : phase === 'processing' ? 'Lad mig tænke…'
          : phase === 'retry' ? 'Det hørte jeg ikke helt – prøv igen!'
            : coach === 'hold' ? 'Hold knappen nede, mens du siger ordet!'
              : coach === 'ready' ? 'Nu er mikrofonen klar – prøv igen!'
                : idleCta
  const showingIdleCta = statusLine === idleCta
  // Match-bloom (§3.5, owner decision §6.3): when the recognized word matches a known Ordleg
  // word-picture, bloom that baked soft-3D object above the spelled letters — a "you said KAT!"
  // payoff that fills the reveal. Art-gated: undefined until the batch lands → letters-only reveal.
  const bloomArt = ordlegArt(spokenWordArtId(recognizedWord))

  return (
    <GameShell
      categoryId="ordleg"
      title="Sig et Ord"
      backRoute="/ordleg"
      dense
      guideReaction={guideReaction}
      celebration={{ show: showCelebration, intensity: celebrationIntensity, duration: celebrationDuration, onComplete: stopCelebration }}
      // NO `promptStage` — deliberately (owner, 2026-08-04: "it looked better when the elements in this
      // game were centered vertically"). GameShell's prompt slot is a FIXED 40% band at the TOP with the
      // body under it, which is right for a prompt-then-answer board. This game has no such split: the mic
      // IS the whole board, and at idle the body below it is empty, so the group sat in the top 40% with
      // half the screen unused. Same reasoning as Sammenlign Tal (see `.claude/rules/game-development.md`)
      // — a game whose focal content IS its interaction owns its column, and GameShell then centres it.
    >
      {roundOutcome ? (
        <RoundResultScreen
          outcome={roundOutcome}
          categoryId="ordleg"
          backRoute="/ordleg"
          onReplay={handleReplay}
        />
      ) : (
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 0,
            overflow: 'hidden',
            gap: { xs: 1.5, md: 2 },
          }}
        >
          {/* The mic, grounded IN the calm world (PRD-10 §3.5) — a static light-pool beneath it, NO
              frosted PromptStage card. Deliberately NOT PromptFocus: its idle-float would drift the mic
              under a still finger (aborting the hold-to-talk gesture) and its per-phase chargeKey would
              remount MicHero mid-gesture (losing the pointer capture — the "never remounts mid-gesture"
              invariant). So: bespoke + static, and now a normal flex child so the whole group centres. */}
          {!micBlocked && (
            <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
              {/* Grounding light-pool — a warm pool of light the mic seats in (reused from PromptFocus:
                  warm-white core → accent edge; brighter on dark worlds). Static. */}
              <Box
                aria-hidden
                sx={{
                  position: 'absolute',
                  left: '50%',
                  top: '48%',
                  transform: 'translate(-50%, -50%)',
                  width: 'clamp(180px, 34vh, 300px)',
                  height: 'clamp(180px, 34vh, 300px)',
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${hexToRgba('#FFFFFF', dark ? 0.32 : 0.5)} 0%, ${hexToRgba(theme.accentColor, 0.2)} 40%, ${hexToRgba(theme.accentColor, 0)} 70%)`,
                  filter: 'blur(12px)',
                  pointerEvents: 'none',
                  zIndex: 0,
                  [PHONE_LANDSCAPE]: { display: 'none' },
                }}
              />
              <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MicHero
                  phase={phase}
                  supported={supported}
                  isBusy={isBusy}
                  accent={theme.accentColor}
                  onTileColor={theme.onTileColor}
                  dark={dark}
                  reduce={reduce}
                  caption={showingIdleCta ? idleCta : null}
                  getLevel={speech.getLevel}
                  onPressStart={handlePressStart}
                  onPressEnd={handlePressEnd}
                />
              </Box>
            </Box>
          )}

          {micBlocked ? (
            // Mic unavailable / refused. Adult-facing (the child can't act on it) and RECOVERABLE:
            // the retry re-runs getUserMedia, which succeeds the moment access is granted — the old
            // screen latched until the app was reloaded.
            <Box sx={{ textAlign: 'center', px: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <Typography
                sx={{
                  fontSize: { xs: '1.1rem', md: '1.4rem' },
                  fontWeight: 700,
                  color: theme.onTileColor,
                }}
              >
                Mikrofonen er ikke tændt.
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: { xs: '0.95rem', md: '1.1rem' }, maxWidth: 460 }}>
                {speech.permission === 'denied'
                  ? 'Til de voksne: giv appen adgang til mikrofonen (Indstillinger → Safari → Mikrofon), og tryk så her.'
                  : 'Til de voksne: mikrofonen svarer ikke. Luk andre apps, der bruger den, og tryk så her.'}
              </Typography>
              <TactilePill accent={theme.accentColor} onClick={() => { void speech.prime() }}>
                <Typography sx={{ fontWeight: 700, fontSize: { xs: '1rem', md: '1.15rem' }, color: theme.onTileColor }}>
                  Prøv igen
                </Typography>
              </TactilePill>
            </Box>
          ) : phase === 'spelling' && recognizedWord ? (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? { duration: 0 } : CHARGE}
              style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', minHeight: 0 }}
            >
              {/* Match-bloom: the baked soft-3D object for the recognized word blooms above the
                  spelled letters (§3.5). A HeroArt on its own light-pool. Art-gated (absent → the
                  letters alone). Hidden on phone-landscape, where the body budget is spent on the
                  banner. */}
              {bloomArt && (
                <Box
                  component={motion.div}
                  initial={reduce ? false : { opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={reduce ? { duration: 0 } : POP}
                  sx={{
                    position: 'relative',
                    flex: '0 1 auto',
                    minHeight: 0,
                    // 30%, not 42%: the column now spans the WHOLE body (no 40% prompt band), so the mic
                    // shares this space with the bloom and the banner. Measured at 1254×872, 1024×768,
                    // 768×1024, 844×390 and 375×667 — the reveal must not overflow, and a centred flex
                    // column overflows at BOTH ends (it would eat the mic above it).
                    maxHeight: '30%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    [PHONE_LANDSCAPE]: { display: 'none' },
                  }}
                >
                  <Box
                    aria-hidden
                    sx={{
                      position: 'absolute',
                      left: '50%',
                      top: '52%',
                      transform: 'translate(-50%, -50%)',
                      width: '150%',
                      height: '150%',
                      borderRadius: '50%',
                      background: `radial-gradient(circle, ${hexToRgba('#FFFFFF', dark ? 0.3 : 0.5)} 0%, ${hexToRgba(theme.accentColor, 0.18)} 42%, ${hexToRgba(theme.accentColor, 0)} 70%)`,
                      filter: 'blur(12px)',
                      pointerEvents: 'none',
                      zIndex: 0,
                    }}
                  />
                  <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', minHeight: 0 }}>
                    <HeroArt src={bloomArt} />
                  </Box>
                </Box>
              )}
              <SpellBanner
                word={recognizedWord}
                letters={letters}
                revealCount={revealCount}
                accent={theme.accentColor}
                dark={dark}
                reduce={reduce}
              />
            </motion.div>
          ) : (
            // Status + coach lines live in the body under the mic. The IDLE call-to-action moved UP
            // next to the mic (MicHero caption, PRD-18 W4) so button+label are one unit — EXCEPT on
            // phone-landscape, where the mic's caption is hidden (tight ~85px stage), so the idle CTA
            // is surfaced here instead (guarded to phone-landscape only). A coach/status line always
            // shows here, on every viewport. Open-ended: never suggest a word.
            <Typography
              sx={{
                fontSize: { xs: '1.25rem', md: '1.6rem' },
                fontWeight: 700,
                textAlign: 'center',
                px: 2,
                // White on dark immersive scenes; readable-on-white accent on light scenes.
                color: dark ? '#FFFFFF' : theme.onTileColor,
                textShadow: dark ? '0 2px 10px rgba(0,0,0,0.5)' : 'none',
                // The idle CTA is a phone-landscape-only fallback; on iPad/phone-portrait the mic
                // caption owns it, so an idle body line would be a dead duplicate — collapse it there.
                ...(showingIdleCta ? { display: 'none', [PHONE_LANDSCAPE]: { display: 'block' } } : null),
              }}
            >
              {statusLine}
            </Typography>
          )}
        </Box>
      )}
    </GameShell>
  )
}

export default SpeakWordGame
