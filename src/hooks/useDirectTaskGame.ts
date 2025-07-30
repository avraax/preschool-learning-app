import { useState, useEffect } from 'react'
import { entryAudioManager } from '../utils/entryAudioManager'

export interface UseDirectTaskGameOptions {
  /** Unique game type identifier */
  gameType: string
  /** Callback function to execute when entry audio completes */
  onEntryAudioComplete: () => void
  /** Delay in ms after entry audio before calling onEntryAudioComplete (default: 500) */
  delay?: number
}

export interface UseDirectTaskGameReturn {
  /** Whether entry audio has completed */
  entryAudioComplete: boolean
}

/**
 * Centralized hook for task-based games following the working pattern from AlphabetGame/MathGame
 * 
 * This hook replaces the problematic useTaskBasedGame hook with the direct pattern
 * that works correctly without loading overlays or infinite loops.
 * 
 * @example
 * ```typescript
 * const { entryAudioComplete } = useDirectTaskGame({
 *   gameType: 'addition',
 *   onEntryAudioComplete: () => generateNewProblem()
 * })
 * 
 * // Show UI immediately with disabled button
 * <Button disabled={!entryAudioComplete}>Gentag</Button>
 * 
 * // Conditionally render content
 * {options.length > 0 ? options.map(...) : null}
 * ```
 */
export const useDirectTaskGame = ({
  gameType,
  onEntryAudioComplete,
  delay = 500
}: UseDirectTaskGameOptions): UseDirectTaskGameReturn => {
  const [entryAudioComplete, setEntryAudioComplete] = useState(false)

  useEffect(() => {
    // Register callback for entry audio completion
    console.log(`🎵 useDirectTaskGame: Registering callback for ${gameType}`)
    
    entryAudioManager.onComplete(gameType, () => {
      console.log(`🎵 useDirectTaskGame: Entry audio completed for ${gameType}`)
      setEntryAudioComplete(true)
      
      // Add configurable delay before calling the game-specific callback
      setTimeout(() => {
        onEntryAudioComplete()
      }, delay)
    })

    // No cleanup needed - entryAudioManager handles this
  }, [gameType, onEntryAudioComplete, delay])

  return {
    entryAudioComplete
  }
}

export default useDirectTaskGame