import { useState, useCallback } from 'react'

/**
 * Centralized game score state.
 *
 * The score-NARRATION half of this hook is gone (`isScoreNarrating` / `handleScoreClick`, which
 * called `announceScore`). It existed solely to make the header score chip tappable, and that chip
 * was deleted — see `GameShell`'s header comment. What is left is the plain counter the games still
 * increment during a round.
 */
interface GameState {
  /** Current score value */
  score: number
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
}

/**
 * Consolidates the score state that was duplicated across all games.
 *
 * @param initialScore - Starting score value (default: 0)
 *
 * @example
 * ```typescript
 * const { score, incrementScore, resetScore } = useGameState()
 *
 * const handleCorrectAnswer = () => {
 *   incrementScore()
 *   // ... celebration logic
 * }
 * ```
 */
export const useGameState = (initialScore: number = 0): GameStateHook => {
  const [gameState, setGameState] = useState<GameState>({
    score: initialScore,
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

  return {
    score: gameState.score,
    setScore,
    incrementScore,
    resetScore,
  }
}
