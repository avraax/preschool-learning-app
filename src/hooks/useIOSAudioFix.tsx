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
    
    document.addEventListener('click', updateInteraction)
    document.addEventListener('touchstart', updateInteraction)
    document.addEventListener('touchend', updateInteraction)
    
    return () => {
      document.removeEventListener('click', updateInteraction)
      document.removeEventListener('touchstart', updateInteraction)
      document.removeEventListener('touchend', updateInteraction)
    }
  }, [])
  
  const checkIOSAudioPermission = (): boolean => {
    if (!isIOS()) return true
    
    const timeSinceInteraction = Date.now() - lastInteractionRef.current
    if (timeSinceInteraction > 5000) {
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