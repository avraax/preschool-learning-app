import React, { createContext, useState, useEffect, useRef, useMemo, useCallback, ReactNode } from 'react'
import { isIOS } from '../utils/deviceDetection'
import { audioDebugSession } from '../utils/remoteConsole'
import { setSimplifiedAudioContext } from '../utils/SimplifiedAudioController'
import { ttsClient } from '../services/ttsClient'
import { shouldShowAudioPrompt } from './audioPromptPolicy'

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

// Simplified state - just what we actually need
interface SimplifiedAudioState {
  isWorking: boolean          // Can we play audio right now?
  needsUserAction: boolean    // Do we need user to click something?
  showPrompt: boolean         // Should we show the permission modal?
  /**
   * Consecutive PLAYBACK failures from `ttsClient` (Practice Loop PRD-01 W4). Kept in state so the two
   * listening games can react — `isWorking` alone was TRUE through the Ogg silence; see
   * `config/narrationHealth.ts` for why that distinction is the whole feature.
   */
  playbackFailures: number
  /**
   * Has audio unlocked at least once this session? Mirrors the `hasUnlockedRef` latch into STATE so the
   * degraded-mode rule can tell "nobody has tapped yet" from "narration died" — before the first unlock,
   * a false `isWorking` is the former (Practice Loop PRD-01 W4; see config/narrationHealth.ts).
   */
  unlockedOnce: boolean
}

export interface SimplifiedAudioContextType {
  state: SimplifiedAudioState
  initializeAudio: () => Promise<boolean>
  updateUserInteraction: () => void
  hidePrompt: () => void
  // Called by the audio engine when playback is blocked / the context suspends, so we re-prompt.
  markNeedsUserAction: () => void
  // Expose the global audio context and speech synthesis for immediate access
  globalAudioContext: AudioContext | null
  speechSynthesis: SpeechSynthesis | null
}

export const SimplifiedAudioContext = createContext<SimplifiedAudioContextType | undefined>(undefined)

interface SimplifiedAudioProviderProps {
  children: ReactNode
}

export const SimplifiedAudioProvider: React.FC<SimplifiedAudioProviderProps> = ({ children }) => {
  const [state, setState] = useState<SimplifiedAudioState>({
    isWorking: false,
    needsUserAction: true,
    showPrompt: false,
    playbackFailures: ttsClient.getHealth().consecutivePlaybackFailures,
    unlockedOnce: false
  })

  // Single global AudioContext - create once, reuse forever
  const globalAudioContextRef = useRef<AudioContext | null>(null)
  const speechSynthesisRef = useRef<SpeechSynthesis | null>(null)
  const initializedRef = useRef<boolean>(false)
  const lastUserInteractionRef = useRef<number>(0)
  // De-dupe concurrent init attempts (a tap fires updateUserInteraction AND speak→ensureAudioReady,
  // both of which may call initializeAudio) so we never create two AudioContexts (PRD-06 §5).
  const initPromiseRef = useRef<Promise<boolean> | null>(null)
  // Once audio has unlocked once, OR the user has explicitly closed the modal, we must NEVER auto-
  // re-show the big blocking permission modal. On iOS the AudioContext routinely flips to
  // suspended/interrupted right after the unlock gesture (WebKit does this when the priming
  // utterance ends / on focus hiccups), which used to re-arm the modal 1.5s later — so neither the
  // "Start lyd nu" button nor the ✕ could keep it closed (it bounced back). Suspension recovery is
  // already handled silently by the document-wide interaction listeners (they re-run initializeAudio
  // on the next tap), so the modal is a first-run primer only.
  const hasUnlockedRef = useRef<boolean>(false)
  const userDismissedRef = useRef<boolean>(false)

  // Start debug session for remote logging
  useEffect(() => {
    audioDebugSession.startSession('SimplifiedAudioSystem')
    logSimpleAudio('SimplifiedAudioProvider initialized', { 
      isIOS: isIOS(),
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

  // Flip state back to "needs a gesture". Re-arms the prompt path; the next user interaction
  // re-runs initializeAudio. Used on autoplay block / AudioContext suspension.
  const markNeedsUserAction = useCallback(() => {
    setState(prev => (prev.needsUserAction && !prev.isWorking ? prev : { ...prev, isWorking: false, needsUserAction: true }))
  }, [])

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
      let audioContextWorking = false
      let speechSynthesisWorking = false

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
        'speechAvail=', !!speechSynthesisRef.current)

      // 2. CRITICAL iOS ORDERING: everything that needs the user-activation (transient activation)
      // must run SYNCHRONOUSLY here, BEFORE the first `await`. iOS/WebKit consumes the activation
      // across an await, so we kick resume() (without awaiting), prime the narration <audio> element,
      // and unlock speechSynthesis first — then await resume() only to VERIFY. Priming after the
      // await (the old order) silently failed on iOS → narration never unlocked → "no sound after
      // tapping Start lyd nu". (PRD-06 §5 / P3; iOS reports 'interrupted' too, not just 'suspended'.)
      let resumePromise: Promise<void> = Promise.resolve()
      if (globalAudioContextRef.current) {
        // Recover automatically: if the context later suspends OR is interrupted (iOS call/Siri/
        // backgrounding), flip back to needsUserAction so the next interaction re-unlocks silently.
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
      // become user-activated; resuming the probe context is not sufficient.
      ttsClient.primePlaybackElement()

      // 2c. Unlock speechSynthesis with an "empty utterance" — also in-gesture, before any await.
      if (speechSynthesisRef.current) {
        try {
          const emptyUtterance = new SpeechSynthesisUtterance('')
          emptyUtterance.volume = 0
          emptyUtterance.rate = 10 // Very fast so it finishes quickly
          speechSynthesisRef.current.speak(emptyUtterance)
          speechSynthesisWorking = true
        } catch (error) {
          // SpeechSynthesis initialization failed
        }
      }

      // 2d. NOW it's safe to await the resume() we kicked off, and verify the context actually runs.
      await resumePromise
      if (globalAudioContextRef.current) {
        audioContextWorking = (globalAudioContextRef.current.state === 'running')
        logSimpleAudio('Resumed AudioContext', { newState: globalAudioContextRef.current.state })
      }

      const isWorking = audioContextWorking || speechSynthesisWorking
      // [audio-unlock] diagnostic (captured in bug-report diagnostics ring).
      console.warn('[audio-unlock] after resume: ctxState=', globalAudioContextRef.current?.state,
        'audioCtxWorking=', audioContextWorking, 'speechWorking=', speechSynthesisWorking, 'isWorking=', isWorking)
      // Latch: audio has unlocked at least once this session → the big modal must never auto-return
      // (a later transient iOS suspension recovers silently on the next interaction, no modal).
      if (isWorking) hasUnlockedRef.current = true
      // …and into state, for the W4 degraded-mode rule (the ref alone is invisible to React).
      if (isWorking) setState((prev) => (prev.unlockedOnce ? prev : { ...prev, unlockedOnce: true }))

      // NOTE: this deliberately does NOT touch `showPrompt`. Only `hidePrompt` closes the modal, and
      // it is only ever called from a CLICK handler — see the click-through note there. Hiding from
      // here used to be a third, invisible dismiss path: the document-wide `touchstart` listener below
      // calls updateUserInteraction → initializeAudio, whose async continuation resolved and unmounted
      // the modal BETWEEN touchstart and the click that same tap produces. The browser then hit-tested
      // the click against whatever the modal had been covering, so one tap on "Start lyd nu" also
      // pressed the answer tile / section object behind it (owner-reported, 2026-08-03).
      setState(prev => ({
        ...prev,
        isWorking,
        needsUserAction: !isWorking,
      }))

      initializedRef.current = true
      
      // Audio initialization completed

      return isWorking

    } catch (error) {
      console.warn('[audio-unlock] initializeAudio threw:', error)
      logSimpleAudio('Audio initialization failed', {
        error: error?.toString(),
        errorType: error?.constructor?.name
      })

      // Same rule as the success path: don't touch `showPrompt` here. This used to force it to
      // `isIOS()`, which was wrong in both directions — on iOS it re-armed the modal past the
      // `userDismissed` / `hasUnlockedOnce` guards in `shouldShowAudioPrompt` (the un-dismissable-modal
      // bug those guards exist to prevent), and everywhere else it CLOSED the modal from an async
      // continuation, which is the mid-gesture close that made a tap fall through to the page behind.
      // Flipping these two booleans is enough: the effect below re-runs and re-shows the modal after
      // its delay if and only if the policy still wants it.
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
  }, [markNeedsUserAction])

  const updateUserInteraction = useCallback(() => {
    lastUserInteractionRef.current = Date.now()

    // If we haven't initialized yet (or a prior session suspended), a fresh gesture is our
    // chance to (re)unlock audio — covers both first-run and suspension recovery.
    const ctx = globalAudioContextRef.current
    const s = ctx?.state as string | undefined
    const suspended = s === 'suspended' || s === 'interrupted'
    if (!initializedRef.current || suspended) {
      initializeAudio().catch(error => {
        logSimpleAudio('Auto-initialization failed on interaction', { error })
      })
    }
  }, [initializeAudio])

  const hidePrompt = useCallback(() => {
    // Explicit close (the button, the ✕, or a tap on the scrim): keep it closed for the session. The
    // next real interaction still silently (re)unlocks audio via updateUserInteraction — we just never
    // force the blocking modal back on the child.
    //
    // **This is the ONLY thing that may set `showPrompt: false`, and every caller must be a `click`
    // handler.** A click is the LAST event a tap produces and its target is resolved before the handler
    // runs, so unmounting the modal here cannot retarget anything. Close the modal from `touchstart`/
    // `pointerdown` — or from an async continuation that can land in that window, which is how
    // initializeAudio used to do it — and the tap's trailing click lands on whatever was behind it.
    userDismissedRef.current = true
    setState(prev => ({ ...prev, showPrompt: false }))
    updateUserInteraction()
  }, [updateUserInteraction])

  // Track user interactions for iOS compatibility
  useEffect(() => {
    const handleUserInteraction = () => {
      updateUserInteraction()
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
  }, [])

  // Mirror `ttsClient`'s playback-failure count into state so the two audio-only games can degrade and
  // RECOVER mid-round (Practice Loop PRD-01 W4). A subscription, not a poll: the recovery must land on
  // the first clip that plays, not up to a second later.
  useEffect(() => {
    const sync = () =>
      setState(prev => {
        const next = ttsClient.getHealth().consecutivePlaybackFailures
        return prev.playbackFailures === next ? prev : { ...prev, playbackFailures: next }
      })
    sync()
    return ttsClient.onHealthChange(sync)
  }, [])

  // Show the prompt when audio is needed — on ALL platforms (desktop/Android included), not just
  // iOS (PRD §9.2). A short delay lets a natural interaction unlock audio first without any modal.
  // Guard: only ever show it BEFORE the first successful unlock and only if the user hasn't already
  // closed it — otherwise a transient iOS AudioContext suspend/interrupt would re-pop the modal and
  // it would read as "can't be dismissed" (both the button and the ✕ are defeated by the re-arm).
  useEffect(() => {
    const inputs = () => ({
      needsUserAction: state.needsUserAction,
      isWorking: state.isWorking,
      hasUnlockedOnce: hasUnlockedRef.current,
      userDismissed: userDismissedRef.current,
    })
    if (shouldShowAudioPrompt(inputs())) {
      const timer = setTimeout(() => {
        // Re-check the refs at fire time — audio may have unlocked (or the user dismissed) during the delay.
        if (shouldShowAudioPrompt(inputs())) {
          setState(prev => (prev.needsUserAction && !prev.isWorking ? { ...prev, showPrompt: true } : prev))
        }
      }, 1500)

      return () => clearTimeout(timer)
    }
  }, [state.needsUserAction, state.isWorking])

  // Memoized so the Provider value and the controller-registration effect below only
  // change when something meaningful changes (previously this object was recreated every
  // render, re-registering the controller context on every render).
  const value = useMemo<SimplifiedAudioContextType>(() => ({
    state,
    initializeAudio,
    updateUserInteraction,
    hidePrompt,
    markNeedsUserAction,
    globalAudioContext: globalAudioContextRef.current,
    speechSynthesis: speechSynthesisRef.current
  }), [state, initializeAudio, updateUserInteraction, hidePrompt, markNeedsUserAction])

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