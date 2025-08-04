import { useEffect, useState } from 'react'
import { useAudio } from './useAudio'
import { entryAudioManager } from '../utils/entryAudioManager'

/**
 * Centralized hook for handling game entry audio and setup callbacks
 * Consolidates the common pattern used across all task-based games
 * 
 * @param gameType - The type of game (e.g., 'alphabet', 'math', 'addition')
 * @param setupCallback - Function to call after entry audio completes
 * @param delay - Delay in ms before calling setupCallback (default: 500)
 * @returns Object with ready state and isPlaying state
 */
export function useGameAudioSetup(
  gameType: string,
  setupCallback: () => void,
  delay: number = 500
) {
  const audio = useAudio({ componentId: gameType })
  const [ready, setReady] = useState(false)
  
  useEffect(() => {
    // Create callback function to avoid stale closures
    const callback = () => {
      setReady(true)
      // Use a timeout to match existing game behavior
      setTimeout(() => {
        setupCallback()
      }, delay)
    }
    
    // Register with entryAudioManager for compatibility
    // This ensures the game works with the existing entry audio system
    entryAudioManager.onComplete(gameType, callback)
    
    // Cleanup on unmount
    return () => {
      entryAudioManager.removeCallback(gameType, callback)
    }
  }, [gameType, setupCallback, delay])
  
  return {
    ready,
    isPlaying: audio.isPlaying,
    // Expose audio instance for additional operations if needed
    audio
  }
}