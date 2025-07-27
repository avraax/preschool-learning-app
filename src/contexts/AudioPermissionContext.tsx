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
    if (!isIOS()) {
      // Non-iOS devices generally don't have strict audio restrictions
      return true
    }

    try {
      // Clean up any existing test audio
      if (audioTestRef.current) {
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

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          audio.removeEventListener('canplay', onCanPlay)
          audio.removeEventListener('error', onError)
          resolve(false)
        }, 1000)

        const onCanPlay = () => {
          clearTimeout(timeout)
          audio.removeEventListener('canplay', onCanPlay)
          audio.removeEventListener('error', onError)
          
          // Try to play
          const playPromise = audio.play()
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                audio.pause()
                resolve(true)
              })
              .catch(() => resolve(false))
          } else {
            resolve(false)
          }
        }

        const onError = () => {
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
      console.log('Audio permission test error:', error)
      return false
    }
  }

  const checkAudioPermissionInternal = async (): Promise<boolean> => {
    const timeSinceInteraction = Date.now() - lastInteractionRef.current
    const hasRecentInteraction = timeSinceInteraction < 10000 // 10 seconds
    const hasDocumentFocus = document.hasFocus()
    const isDocumentVisible = !document.hidden

    // For non-iOS devices, be more permissive
    if (!isIOS()) {
      const hasPermission = hasRecentInteraction || hasDocumentFocus || isDocumentVisible
      setState(prev => ({ ...prev, hasPermission }))
      return hasPermission
    }

    // For iOS, test actual audio capability
    const canPlayAudio = hasRecentInteraction && (hasDocumentFocus || isDocumentVisible)
    
    if (canPlayAudio) {
      const audioWorks = await testAudioPermission()
      setState(prev => ({ ...prev, hasPermission: audioWorks }))
      return audioWorks
    } else {
      setState(prev => ({ ...prev, hasPermission: false }))
      return false
    }
  }

  const checkAudioPermission = async (): Promise<boolean> => {
    return checkAudioPermissionInternal()
  }

  const requestAudioPermission = async (): Promise<boolean> => {
    // When user explicitly requests permission, update interaction time
    lastInteractionRef.current = Date.now()
    
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