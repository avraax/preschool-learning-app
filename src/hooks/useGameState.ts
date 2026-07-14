import { useState, useCallback } from 'react'
import { simplifiedAudioController } from '../utils/SimplifiedAudioController'

/**
 * Game state interface for score and narration management
 */
interface GameState {
  /** Current score value */
  score: number
  /** Whether score narration is currently playing */
  isScoreNarrating: boolean
}

/**
 * Return type for the useGameState hook
 */
interface GameStateHook {
  /** Current score */
  score: number
  /** Set score to specific value */
  setScore: (score: number) => void
  /** Increment score by 1 */
  incrementScore: () => void
  /** Reset score to 0 */
  resetScore: () => void
  /** Whether score narration is currently playing */
  isScoreNarrating: boolean
  /** Handle score chip click with narration */
  handleScoreClick: () => Promise<void>
}

/**
 * Centralized game state management hook
 * 
 * Consolidates score state and narration logic that was duplicated across all games.
 * Provides consistent score management and audio narration handling.
 * 
 * @param initialScore - Starting score value (default: 0)
 * @returns Game state and handlers
 * 
 * @example
 * ```typescript
 * const {
 *   score,
 *   incrementScore,
 *   resetScore,
 *   isScoreNarrating,
 *   handleScoreClick
 * } = useGameState()
 * 
 * // Increment score on correct answer
 * const handleCorrectAnswer = () => {
 *   incrementScore()
 *   // ... celebration logic
 * }
 * 
 * // Use in ScoreChip component
 * <ScoreChip
 *   score={score}
 *   disabled={isScoreNarrating}
 *   onClick={handleScoreClick}
 *   category="math"
 * />
 * ```
 */
export const useGameState = (initialScore: number = 0): GameStateHook => {
  const [gameState, setGameState] = useState<GameState>({
    score: initialScore,
    isScoreNarrating: false
  })

  /**
   * Set score to a specific value
   */
  const setScore = useCallback((newScore: number) => {
    setGameState(prev => ({
      ...prev,
      score: Math.max(0, newScore) // Ensure score doesn't go below 0
    }))
  }, [])

  /**
   * Increment score by 1
   */
  const incrementScore = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      score: prev.score + 1
    }))
  }, [])

  /**
   * Reset score to 0
   */
  const resetScore = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      score: 0
    }))
  }, [])

  /**
   * Handle score chip click with audio narration
   * Prevents overlapping audio by managing narration state
   */
  const handleScoreClick = useCallback(async () => {
    // Always cancel current audio for fast tapping
    simplifiedAudioController.cancelCurrentAudio()
    
    setGameState(prev => ({
      ...prev,
      isScoreNarrating: true
    }))

    try {
      await simplifiedAudioController.announceScore(gameState.score)
    } catch (error) {
      // Ignore audio errors gracefully
    } finally {
      setGameState(prev => ({
        ...prev,
        isScoreNarrating: false
      }))
    }
  }, [gameState.score])

  return {
    score: gameState.score,
    setScore,
    incrementScore,
    resetScore,
    isScoreNarrating: gameState.isScoreNarrating,
    handleScoreClick
  }
}