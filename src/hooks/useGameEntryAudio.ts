import { useEffect, useRef } from 'react'
import { entryAudioManager } from '../utils/entryAudioManager'

// Game-specific welcome messages in Danish
const GAME_WELCOME_MESSAGES = {
  alphabet: '"Bogstav Quiz".',
  alphabetlearning: 'Lær Alfabetet',
  addition: 'Plus Opgaver',
  math: 'Tal Quiz',
  numberlearning: 'Lær Tal',
  comparison: 'Sammenlign tal',
  memory: 'Hukommelsesspillet',
  farvejagt: 'Farvejagt',
  ramfarven: 'Farveblanding'
}

type GameType = keyof typeof GAME_WELCOME_MESSAGES

interface UseGameEntryAudioOptions {
  gameType: GameType
  delay?: number  // Delay before playing entry audio (default: 1000ms)
  enabled?: boolean // Whether to play entry audio (default: true)
}

/**
 * Custom hook for centralized game entry audio
 * Provides consistent welcome messages across all games
 * 
 * @param options Configuration options for the game entry audio
 * 
 * Usage:
 * ```typescript
 * // In game component
 * useGameEntryAudio({ 
 *   gameType: 'alphabet',
 *   delay: 1200 // Optional custom delay
 * })
 * ```
 */
export const useGameEntryAudio = ({ 
  gameType, 
  delay = 1000, 
  enabled = true 
}: UseGameEntryAudioOptions) => {
  const hasScheduled = useRef(false)

  useEffect(() => {
    console.log(`🎵 useGameEntryAudio: Hook called for game "${gameType}"`, {
      gameType,
      delay,
      enabled,
      hasAlreadyScheduled: hasScheduled.current,
      hasAlreadyPlayed: entryAudioManager.hasPlayed(gameType),
      timestamp: new Date().toISOString(),
      isIOS: navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad'),
      isPWA: window.matchMedia('(display-mode: standalone)').matches,
      documentFocus: document.hasFocus(),
      documentVisible: !document.hidden,
      entryAudioManagerState: entryAudioManager.getState()
    })
    
    // Don't play if disabled
    if (!enabled) {
      console.log(`🎵 useGameEntryAudio: Entry audio disabled for "${gameType}"`)
      return
    }
    
    // Don't schedule if already played
    if (entryAudioManager.hasPlayed(gameType)) {
      console.log(`🎵 useGameEntryAudio: Entry audio already played for "${gameType}"`)
      return
    }
    
    // Don't schedule multiple times from same component
    if (hasScheduled.current) {
      console.log(`🎵 useGameEntryAudio: Entry audio already scheduled from this component for "${gameType}"`)
      return
    }
    
    // Schedule the entry audio using the centralized manager
    console.log(`🎵 useGameEntryAudio: Scheduling entry audio for "${gameType}" with ${delay}ms delay`)
    hasScheduled.current = true
    entryAudioManager.scheduleEntryAudio(gameType, delay)

    // No cleanup needed - the centralized manager handles the timeout
    // This prevents the timeout from being cancelled when component unmounts
  }, [gameType, delay, enabled])

  // Return function to manually replay entry audio
  const replayEntryAudio = () => {
    console.log(`🎵 useGameEntryAudio: Manual replay requested for "${gameType}"`, {
      gameType,
      timestamp: new Date().toISOString()
    })
    entryAudioManager.playEntryAudio(gameType)
  }

  // Function to reset entry audio state (useful for testing)
  const resetEntryAudio = () => {
    console.log(`🎵 useGameEntryAudio: Reset requested for "${gameType}"`, {
      gameType,
      timestamp: new Date().toISOString()
    })
    entryAudioManager.resetGame(gameType)
    hasScheduled.current = false
  }

  return {
    replayEntryAudio,
    resetEntryAudio,
    hasPlayedEntry: entryAudioManager.hasPlayed(gameType)
  }
}

// Export game welcome messages for use in AudioManager
export { GAME_WELCOME_MESSAGES }