import React, { createContext, useState, useEffect, useRef, ReactNode } from 'react'
import { isIOS } from '../utils/deviceDetection'
import { setGlobalAudioPermissionContext } from '../utils/audio'
import { audioDebugSession } from '../utils/remoteConsole'

// Enhanced iOS Safari PWA debugging using audioDebugSession
const logPermissionDebug = (message: string, data?: any) => {
  // Always log permission issues to console for comprehensive debugging
  console.log(`🔊 AudioPermission: ${message}`, data)
  
  // Also log to audioDebugSession if it's active
  if (audioDebugSession.isSessionActive()) {
    const isIOSDevice = isIOS()
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone
    const audioContextState = (window as any).AudioContext ? (() => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const state = ctx.state
        ctx.close()
        return state
      } catch {
        return 'unavailable'
      }
    })() : 'unavailable'
    const visibility = document.hidden ? 'hidden' : 'visible'
    const hasFocus = document.hasFocus()
    
    audioDebugSession.addLog('AUDIO_PERMISSION', {
      message,
      data,
      context: {
        isIOS: isIOSDevice,
        isPWA,
        audioContextState,
        visibility,
        hasFocus,
        timestamp: new Date().toISOString()
      }
    })
  }
}

export interface AudioPermissionState {
  hasPermission: boolean
  needsPermission: boolean
  showPrompt: boolean
  sessionInitialized: boolean
  lastUserInteraction: number
}

export interface AudioPermissionContextType {
  state: AudioPermissionState
  checkAudioPermission: () => Promise<boolean>
  requestAudioPermission: () => Promise<boolean>
  hidePrompt: () => void
  updateUserInteraction: () => void
  setNeedsPermission: (needs: boolean) => void
}

export const AudioPermissionContext = createContext<AudioPermissionContextType | undefined>(undefined)

interface AudioPermissionProviderProps {
  children: ReactNode
}

export const AudioPermissionProvider: React.FC<AudioPermissionProviderProps> = ({ children }) => {
  const [state, setState] = useState<AudioPermissionState>({
    hasPermission: false,
    needsPermission: false,
    showPrompt: false,
    sessionInitialized: false,
    lastUserInteraction: Date.now()
  })

  logPermissionDebug('AudioPermissionProvider initialized', {
    initialState: state,
    userAgent: navigator.userAgent,
    speechSynthesisVoices: window.speechSynthesis?.getVoices?.()?.length || 0
  })

  const lastInteractionRef = useRef<number>(Date.now())
  const audioTestRef = useRef<HTMLAudioElement | null>(null)
  const sessionPromptShownRef = useRef<boolean>(false)

  // Track user interactions globally
  useEffect(() => {
    const updateInteraction = () => {
      const now = Date.now()
      logPermissionDebug('User interaction detected', { 
        timestamp: now,
        interactionType: 'global_update',
        previousInteraction: lastInteractionRef.current,
        timeSincePrevious: now - lastInteractionRef.current
      })
      
      lastInteractionRef.current = now
      setState(prev => ({
        ...prev,
        lastUserInteraction: now,
        showPrompt: false // Hide prompt on any interaction
      }))
    }

    // Comprehensive interaction tracking
    const events = [
      'click', 'touchstart', 'touchend', 'pointerdown', 'pointerup', 
      'keydown', 'mousedown', 'focus'
    ]
    
    events.forEach(event => {
      document.addEventListener(event, updateInteraction, { passive: true })
    })

    // Track app visibility and focus changes as potential session starts
    const handleVisibilityChange = () => {
      logPermissionDebug('Visibility change', { 
        hidden: document.hidden,
        needsPermission: state.needsPermission,
        hasPermission: state.hasPermission,
        sessionPromptShown: sessionPromptShownRef.current
      })
      
      if (!document.hidden) {
        updateInteraction()
        // Check if we need to show permission prompt when app becomes visible
        setTimeout(() => {
          if (state.needsPermission && !state.hasPermission && !sessionPromptShownRef.current) {
            logPermissionDebug('Checking permission after visibility change')
            checkAudioPermissionInternal()
          }
        }, 500)
      }
    }

    const handleWindowFocus = () => {
      logPermissionDebug('Window focus change', { 
        hasFocus: document.hasFocus(),
        needsPermission: state.needsPermission,
        hasPermission: state.hasPermission,
        sessionPromptShown: sessionPromptShownRef.current
      })
      
      updateInteraction()
      // Similar check for window focus
      setTimeout(() => {
        if (state.needsPermission && !state.hasPermission && !sessionPromptShownRef.current) {
          logPermissionDebug('Checking permission after focus change')
          checkAudioPermissionInternal()
        }
      }, 500)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleWindowFocus)
    window.addEventListener('pageshow', updateInteraction)

    // Initial session setup
    if (!state.sessionInitialized) {
      setState(prev => ({ ...prev, sessionInitialized: true }))
      // Small delay to allow app to settle
      setTimeout(() => {
        updateInteraction()
      }, 100)
    }

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateInteraction)
      })
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleWindowFocus)
      window.removeEventListener('pageshow', updateInteraction)
      
      // Cleanup audio test element
      if (audioTestRef.current) {
        try {
          audioTestRef.current.pause()
          audioTestRef.current.src = ''
          audioTestRef.current.load()
        } catch (error) {
        }
      }
    }
  }, [state.needsPermission, state.hasPermission])

  // Test if audio can be played without user interaction
  const testAudioPermission = async (): Promise<boolean> => {
    const { audioDebugSession } = await import('../utils/remoteConsole')
    audioDebugSession.addLog('PERMISSION_TEST_START', {
      isIOS: isIOS(),
      timestamp: Date.now()
    })
    
    if (!isIOS()) {
      audioDebugSession.addLog('PERMISSION_NON_IOS_SUCCESS', {
        device: 'non-iOS',
        result: true
      })
      return true
    }

    // First try: Simple interaction-based permission check
    // If we have recent user interaction and the page is focused, assume audio will work
    const timeSinceInteraction = Date.now() - (lastInteractionRef.current || 0)
    const hasRecentInteraction = timeSinceInteraction < 5000 // 5 seconds
    const hasDocumentFocus = document.hasFocus()
    const isDocumentVisible = !document.hidden
    
    audioDebugSession.addLog('PERMISSION_IOS_INTERACTION_CHECK', {
      timeSinceInteraction,
      hasRecentInteraction,
      hasDocumentFocus,
      isDocumentVisible
    })
    
    // If we have recent interaction and focus, audio should work
    if (hasRecentInteraction && hasDocumentFocus && isDocumentVisible) {
      audioDebugSession.addLog('PERMISSION_IOS_INTERACTION_SUCCESS', {
        result: true,
        reason: 'recent_interaction_with_focus'
      })
      return true
    }
    
    // Fallback: Simple iOS permission assumption
    // On iOS, if we have recent user interaction, assume audio will work
    // Avoid creating AudioContext instances that could conflict with the main audio system
    try {
      audioDebugSession.addLog('PERMISSION_IOS_SIMPLE_CHECK', {
        device: 'iOS',
        testType: 'interaction_based'
      })
      
      // For iOS, if we have user interaction within reasonable time, assume permission
      if (hasRecentInteraction) {
        audioDebugSession.addLog('PERMISSION_IOS_INTERACTION_GRANTED', {
          result: true,
          reason: 'recent_interaction_on_iOS'
        })
        return true
      } else {
        audioDebugSession.addLog('PERMISSION_IOS_NO_RECENT_INTERACTION', {
          hasRecentInteraction,
          timeSinceInteraction,
          result: false
        })
      }
    } catch (error) {
      audioDebugSession.addLog('PERMISSION_IOS_CHECK_ERROR', {
        error: error instanceof Error ? error.message : error?.toString(),
        errorType: error instanceof Error ? error.constructor?.name : typeof error
      })
    }

    // Fallback: Original silent audio test
    audioDebugSession.addLog('PERMISSION_IOS_CAPABILITY_TEST', {
      device: 'iOS',
      testType: 'silent_audio_fallback'
    })
    
    try {
      // Clean up any existing test audio
      if (audioTestRef.current) {
        audioDebugSession.addLog('PERMISSION_CLEANUP_PREVIOUS', {})
        audioTestRef.current.pause()
        audioTestRef.current.src = ''
      }

      // Create a silent audio test
      const audio = new Audio()
      audioTestRef.current = audio
      
      // Use a very short, silent base64 audio for testing
      audio.src = 'data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAATL4'
      audio.volume = 0
      audio.muted = true

      audioDebugSession.addLog('PERMISSION_TEST_AUDIO_CREATED', {
        audioSrcLength: audio.src.length,
        volume: audio.volume,
        muted: audio.muted
      })

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          audioDebugSession.addLog('PERMISSION_TEST_TIMEOUT', {
            timeoutDuration: 1000,
            result: false
          })
          audio.removeEventListener('canplay', onCanPlay)
          audio.removeEventListener('error', onError)
          resolve(false)
        }, 1000)

        const onCanPlay = () => {
          audioDebugSession.addLog('PERMISSION_TEST_CAN_PLAY', {})
          clearTimeout(timeout)
          audio.removeEventListener('canplay', onCanPlay)
          audio.removeEventListener('error', onError)
          
          // Try to play
          const playPromise = audio.play()
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                audioDebugSession.addLog('PERMISSION_TEST_PLAY_SUCCESS', {
                  result: true
                })
                audio.pause()
                resolve(true)
              })
              .catch((error) => {
                audioDebugSession.addLog('PERMISSION_TEST_PLAY_FAILED', {
                  error: error.message || error.toString(),
                  errorType: error.constructor?.name,
                  result: false
                })
                resolve(false)
              })
          } else {
            audioDebugSession.addLog('PERMISSION_TEST_NO_PROMISE', {
              playPromise: 'undefined',
              result: false
            })
            resolve(false)
          }
        }

        const onError = (error: any) => {
          // Extract detailed error information for iOS debugging
          const errorDetails = {
            error: error.message || error.toString(),
            errorType: error.constructor?.name || typeof error,
            eventType: error.type,
            target: error.target ? {
              readyState: error.target.readyState,
              networkState: error.target.networkState,
              error: error.target.error ? {
                code: error.target.error.code,
                message: error.target.error.message
              } : null,
              src: error.target.src ? 'present' : 'missing'
            } : null,
            audioElement: {
              readyState: audio.readyState,
              networkState: audio.networkState,
              duration: audio.duration,
              currentTime: audio.currentTime,
              paused: audio.paused,
              muted: audio.muted,
              volume: audio.volume
            },
            result: false
          }
          
          audioDebugSession.addLog('PERMISSION_TEST_AUDIO_ERROR', errorDetails)
          clearTimeout(timeout)
          audio.removeEventListener('canplay', onCanPlay)
          audio.removeEventListener('error', onError)
          resolve(false)
        }

        audio.addEventListener('canplay', onCanPlay)
        audio.addEventListener('error', onError)
        audio.load()
      })
    } catch (error) {
      audioDebugSession.addLog('PERMISSION_TEST_EXCEPTION', {
        error: error instanceof Error ? error.message : error?.toString(),
        errorType: error instanceof Error ? error.constructor?.name : typeof error,
        result: false
      })
      return false
    }
  }

  const checkAudioPermissionInternal = async (): Promise<boolean> => {
    const { audioDebugSession } = await import('../utils/remoteConsole')
    const timeSinceInteraction = Date.now() - lastInteractionRef.current
    const hasRecentInteraction = timeSinceInteraction < 10000 // 10 seconds
    const hasDocumentFocus = document.hasFocus()
    const isDocumentVisible = !document.hidden

    logPermissionDebug('checkAudioPermissionInternal called', {
      timeSinceInteraction,
      hasRecentInteraction,
      hasDocumentFocus,
      isDocumentVisible,
      currentState: state
    })

    audioDebugSession.addLog('PERMISSION_CHECK_INTERNAL', {
      timeSinceInteraction,
      hasRecentInteraction,
      hasDocumentFocus,
      isDocumentVisible,
      isIOS: isIOS()
    })

    // For non-iOS devices, be more permissive
    if (!isIOS()) {
      const hasPermission = hasRecentInteraction || hasDocumentFocus || isDocumentVisible
      audioDebugSession.addLog('PERMISSION_NON_IOS_RESULT', {
        hasPermission
      })
      setState(prev => ({ ...prev, hasPermission }))
      return hasPermission
    }

    // For iOS: Always try the technical test first to see if audio actually works
    audioDebugSession.addLog('PERMISSION_IOS_RUNNING_TECHNICAL_TEST', {
      action: 'test_if_audio_works_before_modal'
    })
    
    const audioWorks = await testAudioPermission()
    
    if (audioWorks) {
      audioDebugSession.addLog('PERMISSION_IOS_TECHNICAL_TEST_SUCCESS', {
        result: true,
        action: 'audio_works_no_modal_needed'
      })
      setState(prev => ({ ...prev, hasPermission: true }))
      return true
    } else {
      audioDebugSession.addLog('PERMISSION_IOS_TECHNICAL_TEST_FAILED', {
        result: false,
        action: 'audio_failed_will_show_modal'
      })
      setState(prev => ({ ...prev, hasPermission: false }))
      return false
    }
  }

  const checkAudioPermission = async (): Promise<boolean> => {
    return checkAudioPermissionInternal()
  }

  const requestAudioPermission = async (): Promise<boolean> => {
    const { audioDebugSession } = await import('../utils/remoteConsole')
    
    logPermissionDebug('requestAudioPermission called', {
      timestamp: Date.now(),
      sessionPromptShown: sessionPromptShownRef.current,
      currentState: state
    })
    
    // When user explicitly requests permission, update interaction time
    lastInteractionRef.current = Date.now()
    
    audioDebugSession.addLog('PERMISSION_REQUEST_USER_CLICK', {
      timestamp: Date.now(),
      sessionPromptShown: sessionPromptShownRef.current
    })
    
    // For iOS with recent interaction, run the technical test now
    if (isIOS()) {
      audioDebugSession.addLog('PERMISSION_REQUEST_IOS_TECHNICAL_TEST', {
        action: 'running_test_after_user_click'
      })
      
      const audioWorks = await testAudioPermission()
      
      if (audioWorks) {
        audioDebugSession.addLog('PERMISSION_REQUEST_SUCCESS', {
          result: true
        })
        setState(prev => ({
          ...prev,
          hasPermission: true,
          showPrompt: false
        }))
        sessionPromptShownRef.current = true
        return true
      } else {
        audioDebugSession.addLog('PERMISSION_REQUEST_FAILED', {
          result: false,
          action: 'show_modal'
        })
        // Show prompt if technical test still fails
        setState(prev => ({
          ...prev,
          hasPermission: false,
          showPrompt: true
        }))
        sessionPromptShownRef.current = true
        return false
      }
    }
    
    // For non-iOS, use original logic
    const hasPermission = await checkAudioPermissionInternal()
    
    if (hasPermission) {
      setState(prev => ({
        ...prev,
        hasPermission: true,
        showPrompt: false
      }))
      sessionPromptShownRef.current = true
    } else if (state.needsPermission && !sessionPromptShownRef.current) {
      // Only show prompt once per session when actually needed
      setState(prev => ({
        ...prev,
        showPrompt: true
      }))
      sessionPromptShownRef.current = true
    }
    
    return hasPermission
  }

  const hidePrompt = () => {
    setState(prev => ({ ...prev, showPrompt: false }))
    lastInteractionRef.current = Date.now()
    // Don't reset sessionPromptShownRef here to prevent showing again immediately
  }

  const updateUserInteraction = () => {
    lastInteractionRef.current = Date.now()
    setState(prev => ({
      ...prev,
      lastUserInteraction: Date.now(),
      showPrompt: false
    }))
  }

  const setNeedsPermission = (needs: boolean) => {
    logPermissionDebug('setNeedsPermission called', {
      needs,
      currentNeedsPermission: state.needsPermission,
      hasPermission: state.hasPermission,
      sessionPromptShown: sessionPromptShownRef.current
    })
    
    setState(prev => ({ ...prev, needsPermission: needs }))
    
    // If audio is needed and we don't have permission, check if we should show prompt
    if (needs && !state.hasPermission && !sessionPromptShownRef.current) {
      logPermissionDebug('Audio needed but no permission, checking audio capability')
      setTimeout(async () => {
        const hasPermission = await checkAudioPermissionInternal()
        if (!hasPermission) {
          logPermissionDebug('Audio capability check failed, showing prompt')
          setState(prev => ({ ...prev, showPrompt: true }))
          sessionPromptShownRef.current = true
        } else {
          logPermissionDebug('Audio capability check passed, no prompt needed')
        }
      }, 100)
    }
  }

  const value: AudioPermissionContextType = {
    state,
    checkAudioPermission,
    requestAudioPermission,
    hidePrompt,
    updateUserInteraction,
    setNeedsPermission
  }

  // Set global reference for AudioManager
  useEffect(() => {
    setGlobalAudioPermissionContext(value)
    
    return () => {
      setGlobalAudioPermissionContext(null)
    }
  }, [value])

  return (
    <AudioPermissionContext.Provider value={value}>
      {children}
    </AudioPermissionContext.Provider>
  )
}