import { useState, useEffect } from 'react'
import { entryAudioManager } from '../utils/entryAudioManager'

/**
 * Configuration options for the useTaskBasedGame hook
 */
interface UseTaskBasedGameOptions {
  /** The game type identifier for entry audio */
  gameType: string
  /** Optional callback when entry audio completes */
  onEntryAudioComplete?: () => void
  /** Delay in ms after entry audio before calling onEntryAudioComplete (default: 500) */
  delay?: number
}

/**
 * Return value from the useTaskBasedGame hook
 */
interface UseTaskBasedGameReturn {
  /** Whether the entry audio has completed playing */
  entryAudioComplete: boolean
  /** Whether the game is ready for user interaction (same as entryAudioComplete) */
  isGameReady: boolean
}

/**
 * Centralized hook for managing task-based game entry audio and state
 * 
 * This hook consolidates the common pattern used across quiz games, math games,
 * and other task-based games that need to:
 * 1. Play entry audio
 * 2. Disable repeat buttons during entry audio
 * 3. Handle empty states while waiting for first task
 * 4. Start the first task after entry audio completes
 * 
 * @param options Configuration for the game
 * @returns State and utilities for managing task-based game behavior
 * 
 * @example
 * ```typescript
 * const { entryAudioComplete, isGameReady } = useTaskBasedGame({
 *   gameType: 'addition',
 *   onEntryAudioComplete: () => generateNewProblem(),
 *   delay: 500
 * })
 * 
 * // Use in repeat button
 * <Button disabled={!entryAudioComplete}>Hør igen</Button>
 * 
 * // Use for empty state handling
 * {options.length > 0 ? renderOptions() : null}
 * ```
 */
export const useTaskBasedGame = ({
  gameType,
  onEntryAudioComplete,
  delay = 500
}: UseTaskBasedGameOptions): UseTaskBasedGameReturn => {
  const [entryAudioComplete, setEntryAudioComplete] = useState(false)

  useEffect(() => {
    // Register callback to handle entry audio completion
    entryAudioManager.onComplete(gameType, () => {
      
      // Mark entry audio as complete (enables repeat buttons)
      setEntryAudioComplete(true)
      
      // Call the provided callback after the specified delay
      if (onEntryAudioComplete) {
        setTimeout(() => {
          console.log(`🎵 useTaskBasedGame: Starting first task for "${gameType}"`)
          onEntryAudioComplete()
        }, delay)
      }
    })
  }, [gameType, onEntryAudioComplete, delay])

  return {
    entryAudioComplete,
    isGameReady: entryAudioComplete // Alias for semantic clarity
  }
}