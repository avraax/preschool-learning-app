import { useEffect, useRef } from 'react'
import { entryAudioManager } from '../utils/entryAudioManager'

// Game-specific welcome messages in Danish
const GAME_WELCOME_MESSAGES = {
  alphabet: 'Velkommen til "Bogstav Quiz".',
  alphabetlearning: 'Velkommen til "Lær Alfabetet".',
  addition: 'Velkommen til "Plus Opgaver".',
  math: 'Velkommen til "Tal Quiz".',
  numberlearning: 'Velkommen til "Lær Tal".',
  comparison: 'Velkommen til "Tal sammenligning".',
  memory: 'Velkommen til "Hukommelsesspillet".',
  farvejagt: 'Velkommen til "Farvejagt".',
  ramfarven: 'Velkommen til "Farveblanding".'
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
    // Don't play if disabled
    if (!enabled) {
      return
    }
    
    // Don't schedule if already played
    if (entryAudioManager.hasPlayed(gameType)) {
      return
    }
    
    // Don't schedule multiple times from same component
    if (hasScheduled.current) {
      return
    }
    
    // Schedule the entry audio using the centralized manager
    hasScheduled.current = true
    entryAudioManager.scheduleEntryAudio(gameType, delay)

    // No cleanup needed - the centralized manager handles the timeout
    // This prevents the timeout from being cancelled when component unmounts
  }, [gameType, delay, enabled])

  // Return function to manually replay entry audio
  const replayEntryAudio = () => {
    entryAudioManager.playEntryAudio(gameType)
  }

  // Function to reset entry audio state (useful for testing)
  const resetEntryAudio = () => {
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