import React, { createContext, useState, useEffect, useRef, useMemo, useCallback, ReactNode } from 'react'
import { isIOS } from '../utils/deviceDetection'
import { audioDebugSession } from '../utils/remoteConsole'
import { setSimplifiedAudioContext } from '../utils/SimplifiedAudioController'
import { ttsClient } from '../services/ttsClient'
import { sfx } from '../services/sfxClient'
import {
  computeAudioReadiness,
  type AudioReadiness,
  type AudioReadinessInput,
} from '../config/audioReadiness'
import {
  probeAnyContextLive,
  probeContextLive,
  readHasBeenActive,
  recoverFrozenContext,
  requestPlaybackAudioSession,
  settleWithin,
  UNLOCK_VERIFY_TIMEOUT_MS,
  userActivationSupported,
} from '../utils/audioLiveness'
import { noteAudioWorked } from '../utils/audioEverWorked'

// Simplified iOS-optimized debugging with remote logging
const logSimpleAudio = (message: string, data?: any) => {
  // Always send to remote logging for production debugging
  audioDebugSession.addLog('SIMPLIFIED_AUDIO', {
    message,
    data,
    isIOS: isIOS(),
    timestamp: new Date().toISOString()
  })
}

/**
 * The raw EVIDENCE, kept separately from the verdict so the verdict is derived on every render and can
 * never go stale (Audio activation PRD-01 §1.3: the old `showPrompt` was a latch that nothing
 * withdrew, so a tap whose unlock resolved *after* a 1500 ms timer left the modal standing over an app
 * that was already talking).
 */
type AudioEvidence = AudioReadinessInput

// Simplified state - just what we actually need
interface SimplifiedAudioState {
  isWorking: boolean          // Can we play audio right now?
  needsUserAction: boolean    // Do we need user to click something?
  /** The evidence-based verdict. `blocked` — and only `blocked` — surfaces the non-blocking cue. */
  readiness: AudioReadiness
  /** The inputs behind `readiness`, snapshotted into bug reports so a report answers "why". */
  evidence: AudioEvidence
  /**
   * Consecutive PLAYBACK failures from `ttsClient` (Practice Loop PRD-01 W4). Kept in state so the two
   * listening games can react — `isWorking` alone was TRUE through the Ogg silence; see
   * `config/narrationHealth.ts` for why that distinction is the whole feature.
   */
  playbackFailures: number
  /**
   * Has audio unlocked at least once this session? Mirrored into STATE so the degraded-mode rule can
   * tell "nobody has tapped yet" from "narration died" — before the first unlock, a false `isWorking`
   * is the former (Practice Loop PRD-01 W4; see config/narrationHealth.ts).
   */
  unlockedOnce: boolean
}

export interface SimplifiedAudioContextType {
  state: SimplifiedAudioState
  initializeAudio: () => Promise<boolean>
  updateUserInteraction: () => void
  // Called by the audio engine when playback is blocked / the context suspends, so we re-arm the
  // silent re-unlock on the next interaction. It does NOT accuse the device — see the note below.
  markNeedsUserAction: () => void
  // Expose the global audio context and speech synthesis for immediate access
  globalAudioContext: AudioContext | null
  speechSynthesis: SpeechSynthesis | null
  /** Diagnostics only: what `audioSession.type` reads back as after the in-gesture request. */
  audioSessionType: string | null
}

export const SimplifiedAudioContext = createContext<SimplifiedAudioContextType | undefined>(undefined)

interface SimplifiedAudioProviderProps {
  children: ReactNode
}

const EMPTY_EVIDENCE: AudioEvidence = {
  hasBeenActive: false,
  primeResult: 'unknown',
  playbackFailures: 0,
  playbackOkOnce: false,
  ctxLive: false,
}

/** `visibilitychange → visible` fires on EVERY iPad app switch, so the re-probe is throttled. */
const RESUME_PROBE_THROTTLE_MS = 3000

export const SimplifiedAudioProvider: React.FC<SimplifiedAudioProviderProps> = ({ children }) => {
  const [state, setState] = useState<SimplifiedAudioState>(() => {
    const health = ttsClient.getHealth()
    const evidence: AudioEvidence = {
      ...EMPTY_EVIDENCE,
      playbackFailures: health.consecutivePlaybackFailures,
      playbackOkOnce: health.playbackOkOnce,
    }
    return {
      isWorking: false,
      needsUserAction: true,
      readiness: computeAudioReadiness(evidence),
      evidence,
      playbackFailures: health.consecutivePlaybackFailures,
      unlockedOnce: false,
    }
  })

  // Single global AudioContext - create once, reuse forever
  const globalAudioContextRef = useRef<AudioContext | null>(null)
  const speechSynthesisRef = useRef<SpeechSynthesis | null>(null)
  const initializedRef = useRef<boolean>(false)
  const lastUserInteractionRef = useRef<number>(0)
  // De-dupe concurrent init attempts (a tap fires updateUserInteraction AND speak→ensureAudioReady,
  // both of which may call initializeAudio) so we never create two AudioContexts (PRD-06 §5).
  const initPromiseRef = useRef<Promise<boolean> | null>(null)
  const audioSessionTypeRef = useRef<string | null>(null)
  const lastResumeProbeRef = useRef<number>(0)
  // The latest prime verdict, mirrored out of state so `updateUserInteraction` can read it
  // synchronously. A recorded `'blocked'` must never survive a fresh gesture unexamined — see there.
  const primeResultRef = useRef<'unknown' | 'ok' | 'blocked'>('unknown')

  // Fold new evidence in and re-derive the verdict. There is deliberately NO latch anywhere in here:
  // every field is either monotone by construction (`playbackOkOnce`, `hasBeenActive`) or a live
  // reading, so the cue appears and disappears purely on what the evidence says.
  const noteEvidence = useCallback((patch: Partial<AudioEvidence>) => {
    setState((prev) => {
      const evidence: AudioEvidence = { ...prev.evidence, ...patch }
      const readiness = computeAudioReadiness(evidence)
      if (
        readiness === prev.readiness &&
        evidence.hasBeenActive === prev.evidence.hasBeenActive &&
        evidence.primeResult === prev.evidence.primeResult &&
        evidence.playbackFailures === prev.evidence.playbackFailures &&
        evidence.playbackOkOnce === prev.evidence.playbackOkOnce &&
        evidence.ctxLive === prev.evidence.ctxLive
      ) {
        return prev
      }
      return { ...prev, evidence, readiness }
    })
  }, [])

  // Start debug session for remote logging
  useEffect(() => {
    audioDebugSession.startSession('SimplifiedAudioSystem')
    logSimpleAudio('SimplifiedAudioProvider initialized', {
      isIOS: isIOS(),
      userActivationSupported: userActivationSupported(),
      userAgent: navigator.userAgent.substring(0, 100)
    })

    return () => {
      audioDebugSession.endSession('SimplifiedAudioSystem')
    }
  }, [])

  // Initialize speech synthesis reference
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      speechSynthesisRef.current = window.speechSynthesis
      logSimpleAudio('SpeechSynthesis available', {
        voices: speechSynthesisRef.current.getVoices().length
      })
    }
  }, [])

  // Flip state back to "needs a gesture" so the next user interaction re-runs initializeAudio. Used on
  // autoplay block / AudioContext suspension.
  //
  // **This must never feed the `blocked` verdict.** An interruption ENDS IN `suspended`, not `running`
  // (WebKit's own `LayoutTests/webaudio/audiocontext-state-interrupted.html`: "running AudioContexts
  // will not resume after an interruption ends"), so this transition is the NORMAL aftermath of every
  // iPad app switch, Siri invocation and phone call. Accusing the device here is what made the old
  // modal bounce back after every dismiss. It only re-arms silent re-unlock — nothing else.
  const markNeedsUserAction = useCallback(() => {
    setState(prev => (prev.needsUserAction && !prev.isWorking ? prev : { ...prev, isWorking: false, needsUserAction: true }))
  }, [])

  /** Probe liveness on our context AND Howler's, re-read at probe time (Howler rebuilds its own). */
  const probeLiveness = useCallback(async (): Promise<boolean> => {
    const live = await probeAnyContextLive([
      () => globalAudioContextRef.current,
      () => sfx.getWebAudioContext(),
    ])
    noteEvidence({ ctxLive: live, hasBeenActive: readHasBeenActive() })
    return live
  }, [noteEvidence])

  // iOS-optimized audio initialization - immediate, direct, simple. Re-entrant calls in the same
  // tick share one in-flight promise (PRD-06 §5) so we never create two AudioContexts.
  const initializeAudio = useCallback((): Promise<boolean> => {
    if (initPromiseRef.current) return initPromiseRef.current

    const run = async (): Promise<boolean> => {
    logSimpleAudio('initializeAudio called', {
      alreadyInitialized: initializedRef.current,
      timeSinceLastInteraction: Date.now() - lastUserInteractionRef.current
    })

    // Update user interaction timestamp immediately
    lastUserInteractionRef.current = Date.now()

    try {
      // 0. FIRST statement of the synchronous block, before resume(): ask for the `playback` audio
      // session. Since iOS 17 the default session type is `ambient`, which is SILENCED BY THE DEVICE
      // MUTE STATE — a candidate root cause of the "sometimes audio really IS off" half of the report.
      // Feature-detected and try/caught inside the helper; one line, no behaviour anywhere else.
      audioSessionTypeRef.current = requestPlaybackAudioSession()

      // 1. Initialize AudioContext immediately (if not already done)
      if (!globalAudioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        if (AudioContextClass) {
          globalAudioContextRef.current = new AudioContextClass()
          logSimpleAudio('Created new AudioContext', {
            state: globalAudioContextRef.current.state
          })
        }
      }
      // [audio-unlock] diagnostic (captured in bug-report diagnostics ring).
      console.warn('[audio-unlock] initializeAudio: ctxState=', globalAudioContextRef.current?.state,
        'speechAvail=', !!speechSynthesisRef.current, 'audioSession=', audioSessionTypeRef.current)

      // 2. CRITICAL iOS ORDERING: everything that needs the user-activation (transient activation)
      // must run SYNCHRONOUSLY here, BEFORE the first `await`. iOS/WebKit consumes the activation
      // across an await, so we kick resume() (without awaiting), prime the narration <audio> element,
      // and unlock speechSynthesis first — then await only to VERIFY. Priming after the
      // await (the old order) silently failed on iOS → narration never unlocked → "no sound after
      // tapping the unlock button". (PRD-06 §5 / P3; iOS reports 'interrupted' too, not just 'suspended'.)
      //
      // WebKit is stricter than the Web Audio spec here: `shouldDocumentAllowWebAudioToAutoPlay` in
      // `AudioContext.cpp` requires `hasTransientActivation()` — the sticky `hasHadUserInteraction()`
      // branch is a site quirk for zoom.com. So this ordering is load-bearing, not defensive.
      let resumePromise: Promise<void> = Promise.resolve()
      if (globalAudioContextRef.current) {
        // Recover automatically: if the context later suspends OR is interrupted (iOS call/Siri/
        // backgrounding), flip back to needsUserAction so the next interaction re-unlocks silently.
        // Deliberately NOT evidence of blocking — see markNeedsUserAction.
        globalAudioContextRef.current.onstatechange = () => {
          const ctx = globalAudioContextRef.current
          const s = ctx?.state as string | undefined
          if (ctx && (s === 'suspended' || s === 'interrupted')) {
            logSimpleAudio('AudioContext not running — needs user action', { state: s })
            markNeedsUserAction()
          }
        }
        if (globalAudioContextRef.current.state !== 'running') {
          resumePromise = globalAudioContextRef.current.resume().catch(() => {})
        }
      }

      // 2b. Prime the shared narration <audio> element inside THIS gesture (PRD-06 §5) — BEFORE any
      // await. Narration plays through ttsClient's element, so that element is the one that must
      // become user-activated; resuming the probe context is not sufficient. Its RESULT is the app's
      // one real evidence signal, so we keep the promise and await it below (after the sync block).
      const primePromise = ttsClient.primePlaybackElement()
      // A fresh attempt SUPERSEDES the previous verdict: while this prime is in flight there is no
      // negative evidence, so any recorded `'blocked'` is withdrawn now rather than when the new
      // result lands. Without this, the tap that first sets `hasBeenActive` would compose with the
      // stale block from the pre-gesture auto-init and flash the cue for the length of the round trip.
      primeResultRef.current = 'unknown'
      noteEvidence({ primeResult: 'unknown' })

      // 2c. Unlock speechSynthesis with an "empty utterance" — also in-gesture, before any await.
      // The call is KEPT (it costs nothing and does unlock Web Speech) but it is NO LONGER EVIDENCE:
      // `speak()` not throwing observes nothing at all — no onstart, no onend — and OR'ing that lie
      // into the verdict is what let a single non-throwing call latch the whole session as "working"
      // (Audio activation PRD-01 §1.1).
      if (speechSynthesisRef.current) {
        try {
          const emptyUtterance = new SpeechSynthesisUtterance('')
          emptyUtterance.volume = 0
          emptyUtterance.rate = 10 // Very fast so it finishes quickly
          speechSynthesisRef.current.speak(emptyUtterance)
        } catch (error) {
          // SpeechSynthesis initialization failed
        }
      }

      // 2d. NOW it's safe to await: the activation has already been spent on the calls above.
      //
      // **Both awaits are BOUNDED** (`settleWithin`), and that is load-bearing: on iOS a
      // `resume()` promise can NEVER settle, and one bare `await` on it took the whole app mute for a
      // session — report J62KA, iPhone iOS 18.7, `/alphabet/learn`, no letter made a sound while the
      // Howler music bed played on. `initializeAudio()` never resolved, so `initPromiseRef` never
      // cleared, so every later `speak()` awaited the same dead promise. Verification is allowed to
      // fail to ARRIVE; it is not allowed to hang. Both are raced together so the cap is one window,
      // not two. Never re-introduce a bare `await` here.
      const [resumeOutcome, primeOutcome] = await Promise.all([
        settleWithin(resumePromise, UNLOCK_VERIFY_TIMEOUT_MS),
        settleWithin(primePromise, UNLOCK_VERIFY_TIMEOUT_MS),
      ])
      // A prime that never ANSWERED is no evidence — `'unknown'`, never `'blocked'`. Same rule as the
      // `'error'` case below: fail toward silence, never toward a false accusation of the device.
      const primeResult = primeOutcome === 'settled' ? await primePromise : ('unknown' as const)
      if (resumeOutcome === 'timeout' || primeOutcome === 'timeout') {
        // [audio-unlock] diagnostic: this is the J62KA signature, now survivable and NAMED in the ring.
        console.warn('[audio-unlock] verify timed out — resume=', resumeOutcome, 'prime=', primeOutcome,
          'ctxState=', globalAudioContextRef.current?.state, '— playing anyway')
      }
      logSimpleAudio('Unlock verified', {
        ctxState: globalAudioContextRef.current?.state,
        primeResult,
        resumeOutcome,
        primeOutcome,
      })

      const health = ttsClient.getHealth()
      // A decode/format error is not an activation problem, so it is no evidence either way.
      primeResultRef.current = primeResult === 'error' ? 'unknown' : primeResult
      const evidence: AudioEvidence = {
        hasBeenActive: readHasBeenActive(),
        primeResult: primeResultRef.current,
        playbackFailures: health.consecutivePlaybackFailures,
        playbackOkOnce: health.playbackOkOnce,
        // The clock probe AWAITS, so it must not run inside the gesture — it runs in the effect below,
        // after this call has returned. Carry the previous reading rather than clearing it.
        ctxLive: false,
      }

      // `isWorking` is what gates playback (`ensureAudioReady` SKIPS a speak when it is false) and the
      // games' welcome. So it is deliberately PERMISSIVE — anything but a proven block — because
      // attempting playback is how evidence gets gathered in the first place. What changed is the
      // bottom: it can now go FALSE on real proof, where before only a suspended probe context (an
      // object that never makes a sound) could lower it, and the speechSynthesis lie kept raising it.
      const readinessNow = computeAudioReadiness(evidence)
      const isWorking = readinessNow !== 'blocked'
      // [audio-unlock] diagnostic (captured in bug-report diagnostics ring).
      console.warn('[audio-unlock] after resume: ctxState=', globalAudioContextRef.current?.state,
        'primeResult=', primeResult, 'readiness=', readinessNow, 'isWorking=', isWorking)

      setState((prev) => {
        const merged: AudioEvidence = {
          ...evidence,
          // Monotone signals never go backwards; ctxLive is owned by the probe, not by this call.
          hasBeenActive: prev.evidence.hasBeenActive || evidence.hasBeenActive,
          playbackOkOnce: prev.evidence.playbackOkOnce || evidence.playbackOkOnce,
          ctxLive: prev.evidence.ctxLive,
        }
        return {
          ...prev,
          evidence: merged,
          readiness: computeAudioReadiness(merged),
          isWorking,
          needsUserAction: !isWorking,
          unlockedOnce: prev.unlockedOnce || isWorking,
        }
      })

      initializedRef.current = true

      // The clock probe, kicked AFTER the gesture's synchronous work: it awaits ~120ms, and an await
      // burns the transient activation.
      void probeLiveness()

      return isWorking

    } catch (error) {
      console.warn('[audio-unlock] initializeAudio threw:', error)
      logSimpleAudio('Audio initialization failed', {
        error: error?.toString(),
        errorType: error?.constructor?.name
      })

      // A THROW here is not proof that audio is blocked, so it must not accuse the device: flip the
      // two re-unlock booleans and leave the verdict to the evidence. (This branch used to force
      // `showPrompt: isIOS()`, which was wrong in both directions — on iOS it re-armed the modal past
      // its own dismiss guards, and everywhere else it CLOSED the modal from an async continuation,
      // which is the mid-gesture close that made a tap fall through to the page behind.)
      setState(prev => ({
        ...prev,
        isWorking: false,
        needsUserAction: true,
      }))

      return false
    }
    }

    const p = run()
    initPromiseRef.current = p
    p.finally(() => {
      if (initPromiseRef.current === p) initPromiseRef.current = null
    })
    return p
  }, [markNeedsUserAction, probeLiveness, noteEvidence])

  const updateUserInteraction = useCallback(() => {
    lastUserInteractionRef.current = Date.now()

    // If we haven't initialized yet (or a prior session suspended), a fresh gesture is our
    // chance to (re)unlock audio — covers both first-run and suspension recovery.
    //
    // `primeResultRef === 'blocked'` is the third trigger and it is load-bearing: a block recorded
    // OUTSIDE a gesture (the hook's `autoInitialize` runs at mount) must be re-tested by the first real
    // tap, or the verdict would stay `blocked` on a device where the tap would have unlocked it —
    // the same false accusation this PRD removed, just with a different latch.
    const ctx = globalAudioContextRef.current
    const s = ctx?.state as string | undefined
    const suspended = s === 'suspended' || s === 'interrupted'
    if (!initializedRef.current || suspended || primeResultRef.current === 'blocked') {
      initializeAudio().catch(error => {
        logSimpleAudio('Auto-initialization failed on interaction', { error })
      })
    }
  }, [initializeAudio])

  // Track user interactions for iOS compatibility. This is ALSO where `hasBeenActive` is sampled: the
  // first-gesture-anywhere unlock is the pattern every reference implementation uses (Howler's
  // `_unlockAudio`, Tone.js, PlayCanvas, Chrome's own autoplay guidance), and the child has to tap the
  // home menu to reach any game — so there is no job left for a primer surface to do.
  useEffect(() => {
    const handleUserInteraction = () => {
      updateUserInteraction()
      if (readHasBeenActive()) noteEvidence({ hasBeenActive: true })
    }

    // Only track the most essential interaction events
    const events = ['click', 'touchstart', 'keydown']
    events.forEach(event => {
      document.addEventListener(event, handleUserInteraction, { passive: true })
    })

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleUserInteraction)
      })
    }
  }, [updateUserInteraction, noteEvidence])

  // Mirror `ttsClient`'s playback health into state so the two audio-only games can degrade and
  // RECOVER mid-round (Practice Loop PRD-01 W4), and so the readiness verdict sees a clip that
  // actually sounded. A subscription, not a poll: the recovery must land on the first clip that plays,
  // not up to a second later.
  useEffect(() => {
    const sync = () => {
      const health = ttsClient.getHealth()
      setState(prev => {
        const evidence: AudioEvidence = {
          ...prev.evidence,
          playbackFailures: health.consecutivePlaybackFailures,
          playbackOkOnce: prev.evidence.playbackOkOnce || health.playbackOkOnce,
        }
        const readiness = computeAudioReadiness(evidence)
        if (
          prev.playbackFailures === health.consecutivePlaybackFailures &&
          prev.evidence.playbackOkOnce === evidence.playbackOkOnce &&
          prev.readiness === readiness
        ) {
          return prev
        }
        return { ...prev, playbackFailures: health.consecutivePlaybackFailures, evidence, readiness }
      })
    }
    sync()
    return ttsClient.onHealthChange(sync)
  }, [])

  // Record "audio has worked on this device" once the verdict says so (device-scoped, NOT progress —
  // see utils/audioEverWorked.ts). It gates NOTHING; it is an adult-facing line and a report field.
  useEffect(() => {
    if (state.readiness === 'live') noteAudioWorked()
  }, [state.readiness])

  // Coming back from the app switcher: re-probe the clock, and if a context claims `running` while its
  // clock is frozen, perform WebKit 263627's documented suspend()→resume() recovery. THROTTLED — this
  // fires on every iPad app switch (the same hazard `.claude/rules/auth.md` documents for `validate()`).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastResumeProbeRef.current < RESUME_PROBE_THROTTLE_MS) return
      lastResumeProbeRef.current = now
      void (async () => {
        const ctx = globalAudioContextRef.current
        const live = await probeLiveness()
        if (!live && ctx && (ctx.state as string) === 'running') {
          logSimpleAudio('Context running with a frozen clock — recovering (WebKit 263627)', {})
          console.warn('[audio-unlock] frozen clock while running — suspend/resume recovery')
          await recoverFrozenContext(ctx)
          const again = await probeContextLive(ctx)
          noteEvidence({ ctxLive: again })
        }
      })()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [probeLiveness, noteEvidence])

  // Memoized so the Provider value and the controller-registration effect below only
  // change when something meaningful changes (previously this object was recreated every
  // render, re-registering the controller context on every render).
  const value = useMemo<SimplifiedAudioContextType>(() => ({
    state,
    initializeAudio,
    updateUserInteraction,
    markNeedsUserAction,
    globalAudioContext: globalAudioContextRef.current,
    speechSynthesis: speechSynthesisRef.current,
    audioSessionType: audioSessionTypeRef.current
  }), [state, initializeAudio, updateUserInteraction, markNeedsUserAction])

  // Connect this context to the SimplifiedAudioController
  useEffect(() => {
    setSimplifiedAudioContext(value)

    return () => {
      setSimplifiedAudioContext(null)
    }
  }, [value])

  return (
    <SimplifiedAudioContext.Provider value={value}>
      {children}
    </SimplifiedAudioContext.Provider>
  )
}

// Hook to use the simplified audio context
export const useSimplifiedAudio = (): SimplifiedAudioContextType => {
  const context = React.useContext(SimplifiedAudioContext)

  if (context === undefined) {
    throw new Error('useSimplifiedAudio must be used within a SimplifiedAudioProvider')
  }

  return context
}
