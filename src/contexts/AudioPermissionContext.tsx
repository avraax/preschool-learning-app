import React, { createContext, useState, useEffect, useRef, ReactNode } from 'react'
import { isIOS } from '../utils/deviceDetection'
import { setGlobalAudioPermissionContext } from '../utils/audio'

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

  const lastInteractionRef = useRef<number>(Date.now())
  const audioTestRef = useRef<HTMLAudioElement | null>(null)
  const sessionPromptShownRef = useRef<boolean>(false)

  // Track user interactions globally
  useEffect(() => {
    const updateInteraction = () => {
      const now = Date.now()
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
      if (!document.hidden) {
        updateInteraction()
        // Check if we need to show permission prompt when app becomes visible
        setTimeout(() => {
          if (state.needsPermission && !state.hasPermission && !sessionPromptShownRef.current) {
            checkAudioPermissionInternal()
          }
        }, 500)
      }
    }

    const handleWindowFocus = () => {
      updateInteraction()
      // Similar check for window focus
      setTimeout(() => {
        if (state.needsPermission && !state.hasPermission && !sessionPromptShownRef.current) {
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
          console.log('Audio cleanup error:', error)
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
    
    // If we have recent interaction OR focus and visibility, audio should work
    if (hasRecentInteraction || (hasDocumentFocus && isDocumentVisible)) {
      audioDebugSession.addLog('PERMISSION_IOS_INTERACTION_SUCCESS', {
        result: true,
        reason: hasRecentInteraction ? 'recent_interaction' : 'focus_and_visibility'
      })
      return true
    }
    
    // Fallback: AudioContext-based test (more reliable than audio element)
    try {
      audioDebugSession.addLog('PERMISSION_IOS_AUDIOCONTEXT_TEST', {
        device: 'iOS',
        testType: 'audiocontext'
      })
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioDebugSession.addLog('PERMISSION_AUDIOCONTEXT_CREATED', {
        state: audioContext.state,
        sampleRate: audioContext.sampleRate
      })
      
      if (audioContext.state === 'running') {
        audioDebugSession.addLog('PERMISSION_AUDIOCONTEXT_RUNNING', {
          result: true
        })
        audioContext.close()
        return true
      } else if (audioContext.state === 'suspended' && (hasRecentInteraction || isDocumentVisible)) {
        // Try to resume if we have recent interaction OR document is visible
        try {
          await audioContext.resume()
          audioDebugSession.addLog('PERMISSION_AUDIOCONTEXT_RESUMED', {
            result: true,
            finalState: audioContext.state
          })
          audioContext.close()
          return true
        } catch (resumeError) {
          audioDebugSession.addLog('PERMISSION_AUDIOCONTEXT_RESUME_FAILED', {
            error: resumeError instanceof Error ? resumeError.message : resumeError?.toString(),
            state: audioContext.state,
            result: false
          })
          audioContext.close()
        }
      } else {
        audioDebugSession.addLog('PERMISSION_AUDIOCONTEXT_SUSPENDED_NO_INTERACTION', {
          state: audioContext.state,
          hasRecentInteraction,
          result: false
        })
        audioContext.close()
      }
    } catch (contextError) {
      audioDebugSession.addLog('PERMISSION_AUDIOCONTEXT_ERROR', {
        error: contextError instanceof Error ? contextError.message : contextError?.toString(),
        errorType: contextError instanceof Error ? contextError.constructor?.name : typeof contextError
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
    const hasRecentInteraction = timeSinceInteraction < 30000 // Extended to 30 seconds for entry audio
    const hasDocumentFocus = document.hasFocus()
    const isDocumentVisible = !document.hidden

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
    
    // iOS Safari has a strict 10-second timeout for audio playback
    // If it's been more than 10 seconds and audio is needed, we need to re-prompt
    if (timeSinceInteraction > 10000 && state.needsPermission) {
      audioDebugSession.addLog('PERMISSION_IOS_TIMEOUT_DETECTED', {
        timeSinceInteraction,
        needsPermission: state.needsPermission,
        action: 'will_show_prompt_for_timeout'
      })
      
      // Reset permission state and show prompt again if not already shown
      setState(prev => ({
        ...prev,
        hasPermission: false,
        showPrompt: !sessionPromptShownRef.current
      }))
      
      // Mark that we've shown the prompt in this session
      if (!sessionPromptShownRef.current) {
        sessionPromptShownRef.current = true
      }
      
      return false
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
    setState(prev => ({ ...prev, needsPermission: needs }))
    
    // If audio is needed and we don't have permission, check if we should show prompt
    if (needs && !state.hasPermission && !sessionPromptShownRef.current) {
      setTimeout(async () => {
        const hasPermission = await checkAudioPermissionInternal()
        if (!hasPermission) {
          setState(prev => ({ ...prev, showPrompt: true }))
          sessionPromptShownRef.current = true
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