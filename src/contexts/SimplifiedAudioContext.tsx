import React, { createContext, useState, useEffect, useRef, useMemo, useCallback, ReactNode } from 'react'
import { isIOS } from '../utils/deviceDetection'
import { audioDebugSession } from '../utils/remoteConsole'
import { setSimplifiedAudioContext } from '../utils/SimplifiedAudioController'

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
    showPrompt: false
  })

  // Single global AudioContext - create once, reuse forever
  const globalAudioContextRef = useRef<AudioContext | null>(null)
  const speechSynthesisRef = useRef<SpeechSynthesis | null>(null)
  const initializedRef = useRef<boolean>(false)
  const lastUserInteractionRef = useRef<number>(0)

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

  // iOS-optimized audio initialization - immediate, direct, simple
  const initializeAudio = useCallback(async (): Promise<boolean> => {
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

      // 2. Resume AudioContext immediately during user interaction, then VERIFY it is actually
      // running (the old code latched isWorking=true without confirming — PRD §9.2).
      if (globalAudioContextRef.current) {
        if (globalAudioContextRef.current.state === 'suspended') {
          await globalAudioContextRef.current.resume()
          logSimpleAudio('Resumed AudioContext', {
            newState: globalAudioContextRef.current.state
          })
        }
        audioContextWorking = (globalAudioContextRef.current.state === 'running')

        // Recover automatically: if the context later suspends (e.g. iOS backgrounding), flip
        // back to needsUserAction so the next interaction re-prompts instead of going silent.
        globalAudioContextRef.current.onstatechange = () => {
          const ctx = globalAudioContextRef.current
          if (ctx && ctx.state === 'suspended') {
            logSimpleAudio('AudioContext suspended — needs user action', { state: ctx.state })
            markNeedsUserAction()
          }
        }
      }

      // 3. Initialize speechSynthesis with "empty utterance" trick for iOS
      if (speechSynthesisRef.current) {
        try {
          // Create and speak empty utterance to unlock speechSynthesis for the session
          const emptyUtterance = new SpeechSynthesisUtterance('')
          emptyUtterance.volume = 0
          emptyUtterance.rate = 10 // Very fast so it finishes quickly
          
          // This unlocks speechSynthesis for programmatic use throughout the session
          speechSynthesisRef.current.speak(emptyUtterance)
          speechSynthesisWorking = true
          
          // SpeechSynthesis unlocked with empty utterance
        } catch (error) {
          // SpeechSynthesis initialization failed
        }
      }

      const isWorking = audioContextWorking || speechSynthesisWorking
      
      setState(prev => ({
        ...prev,
        isWorking,
        needsUserAction: !isWorking,
        showPrompt: false // Hide prompt on successful initialization
      }))

      initializedRef.current = true
      
      // Audio initialization completed

      return isWorking

    } catch (error) {
      logSimpleAudio('Audio initialization failed', { 
        error: error?.toString(),
        errorType: error?.constructor?.name 
      })
      
      setState(prev => ({
        ...prev,
        isWorking: false,
        needsUserAction: true,
        showPrompt: isIOS() // Only show prompt on iOS where this is more critical
      }))
      
      return false
    }
  }, [markNeedsUserAction])

  const updateUserInteraction = useCallback(() => {
    lastUserInteractionRef.current = Date.now()

    // If we haven't initialized yet (or a prior session suspended), a fresh gesture is our
    // chance to (re)unlock audio — covers both first-run and suspension recovery.
    const ctx = globalAudioContextRef.current
    const suspended = ctx ? ctx.state === 'suspended' : false
    if (!initializedRef.current || suspended) {
      initializeAudio().catch(error => {
        logSimpleAudio('Auto-initialization failed on interaction', { error })
      })
    }
  }, [initializeAudio])

  const hidePrompt = useCallback(() => {
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

  // Show the prompt when audio is needed — on ALL platforms (desktop/Android included), not just
  // iOS (PRD §9.2). A short delay lets a natural interaction unlock audio first without any modal.
  useEffect(() => {
    if (state.needsUserAction && !state.isWorking) {
      const timer = setTimeout(() => {
        setState(prev => (prev.needsUserAction && !prev.isWorking ? { ...prev, showPrompt: true } : prev))
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