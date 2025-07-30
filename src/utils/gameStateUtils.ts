import { useState } from 'react'

/**
 * Utility function to render content only when items array is not empty
 * 
 * @param items Array of items to check
 * @param renderItems Function to render the items when they exist
 * @returns React node or null
 * 
 * @example
 * ```typescript
 * // Instead of: {options.length > 0 ? renderOptions() : null}
 * // Use: renderWithEmptyState(options, renderOptions)
 * ```
 */
export const renderWithEmptyState = <T>(
  items: T[], 
  renderItems: (items: T[]) => React.ReactNode
): React.ReactNode => {
  return items.length > 0 ? renderItems(items) : null
}

/**
 * Hook for managing game options with built-in empty state handling
 * 
 * @param initialValue Initial value for the options array
 * @returns Object with options state and utility functions
 * 
 * @example
 * ```typescript
 * const { options, setOptions, hasOptions, renderOptions } = useGameOptions<string>()
 * 
 * // Set options
 * setOptions(['A', 'B', 'C', 'D'])
 * 
 * // Check if options exist
 * if (hasOptions) { ... }
 * 
 * // Render with automatic empty state handling
 * {renderOptions((opts) => opts.map(opt => <Card key={opt}>{opt}</Card>))}
 * ```
 */
export const useGameOptions = <T>(initialValue: T[] = []) => {
  const [options, setOptions] = useState<T[]>(initialValue)
  
  return {
    /** Current options array */
    options,
    /** Function to update options */
    setOptions,
    /** Whether options array has items */
    hasOptions: options.length > 0,
    /** Render options with automatic empty state handling */
    renderOptions: (renderer: (items: T[]) => React.ReactNode) => 
      renderWithEmptyState(options, renderer),
    /** Reset options to empty array */
    clearOptions: () => setOptions([])
  }
}

/**
 * Hook for managing game problems/questions with built-in empty state handling
 * 
 * @param initialValue Initial value for the current problem
 * @returns Object with problem state and utility functions
 * 
 * @example
 * ```typescript
 * interface MathProblem { num1: number; num2: number; answer: number }
 * 
 * const { 
 *   currentProblem, 
 *   setCurrentProblem, 
 *   hasProblem, 
 *   renderProblem 
 * } = useGameProblem<MathProblem>()
 * 
 * // Render with automatic null handling
 * {renderProblem((problem) => <div>{problem.num1} + {problem.num2} = ?</div>)}
 * ```
 */
export const useGameProblem = <T>(initialValue: T | null = null) => {
  const [currentProblem, setCurrentProblem] = useState<T | null>(initialValue)
  
  return {
    /** Current problem object */
    currentProblem,
    /** Function to update current problem */
    setCurrentProblem,
    /** Whether a problem is currently set */
    hasProblem: currentProblem !== null,
    /** Render problem with automatic null handling */
    renderProblem: (renderer: (problem: T) => React.ReactNode) => 
      currentProblem ? renderer(currentProblem) : null,
    /** Clear current problem */
    clearProblem: () => setCurrentProblem(null)
  }
}

/**
 * Utility type for common game state patterns
 */
export interface GameStateUtilities<T> {
  items: T[]
  setItems: (items: T[]) => void
  hasItems: boolean
  renderItems: (renderer: (items: T[]) => React.ReactNode) => React.ReactNode
  clearItems: () => void
}

/**
 * Utility type for problem-based games
 */
export interface ProblemStateUtilities<T> {
  currentProblem: T | null
  setCurrentProblem: (problem: T | null) => void
  hasProblem: boolean
  renderProblem: (renderer: (problem: T) => React.ReactNode) => React.ReactNode
  clearProblem: () => void
}

/**
 * Constants for common empty state messages
 */
export const EMPTY_STATE_MESSAGES = {
  loading: '🎵 Indlæser...',
  listening: '🎵 Lytter...',
  preparing: '🎵 Forbereder...',
  waiting: '⏳ Venter...',
} as const

/**
 * Helper function to check if game is in empty state and should show placeholder
 * 
 * @param hasContent Whether the game has content to display
 * @param entryAudioComplete Whether entry audio has finished
 * @returns Whether to show empty state
 */
export const shouldShowEmptyState = (
  hasContent: boolean, 
  entryAudioComplete: boolean
): boolean => {
  return !hasContent && !entryAudioComplete
}