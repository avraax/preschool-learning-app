import { useState, useEffect, useRef } from 'react'
import { isIOS } from '../utils/deviceDetection'

export const useIOSAudioFix = () => {
  const [showIOSPrompt, setShowIOSPrompt] = useState(false)
  const lastInteractionRef = useRef<number>(Date.now())
  
  useEffect(() => {
    // Track user interactions for iOS
    const updateInteraction = () => {
      lastInteractionRef.current = Date.now()
      setShowIOSPrompt(false) // Hide prompt on any interaction
    }
    
    // Track more interaction types for iOS
    document.addEventListener('click', updateInteraction)
    document.addEventListener('touchstart', updateInteraction)
    document.addEventListener('touchend', updateInteraction)
    document.addEventListener('pointerdown', updateInteraction)
    document.addEventListener('pointerup', updateInteraction)
    document.addEventListener('keydown', updateInteraction)
    
    // Also track page visibility changes
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateInteraction()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('click', updateInteraction)
      document.removeEventListener('touchstart', updateInteraction)
      document.removeEventListener('touchend', updateInteraction)
      document.removeEventListener('pointerdown', updateInteraction)
      document.removeEventListener('pointerup', updateInteraction)
      document.removeEventListener('keydown', updateInteraction)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])
  
  const checkIOSAudioPermission = (): boolean => {
    if (!isIOS()) return true
    
    const timeSinceInteraction = Date.now() - lastInteractionRef.current
    // Use stricter timing to match GoogleTTS service
    if (timeSinceInteraction > 3000 || document.hidden || !document.hasFocus()) {
      setShowIOSPrompt(true)
      return false
    }
    
    return true
  }
  
  const handleIOSAudioError = (error: any) => {
    if (isIOS() && error?.name === 'NotAllowedError') {
      setShowIOSPrompt(true)
    }
  }
  
  const hideIOSPrompt = () => {
    setShowIOSPrompt(false)
    lastInteractionRef.current = Date.now()
  }
  
  return {
    showIOSPrompt,
    checkIOSAudioPermission,
    handleIOSAudioError,
    hideIOSPrompt,
    updateInteraction: () => { lastInteractionRef.current = Date.now() }
  }
}