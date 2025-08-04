import { useEffect, useRef } from 'react'
import { useAudioContext } from '../contexts/AudioContext'

export interface UseAudioOptions {
  /**
   * Automatically stop audio when component unmounts
   * @default true
   */
  stopOnUnmount?: boolean
  
  /**
   * Component identifier for debugging purposes
   */
  componentId?: string
}

export interface UseAudioReturn {
  // Playing state
  isPlaying: boolean
  
  // Core audio functions
  speak: (text: string, voiceType?: 'primary' | 'backup' | 'male', useSSML?: boolean, customSpeed?: number) => Promise<string>
  
  // Specialized Danish audio functions
  speakLetter: (letter: string) => Promise<string>
  speakNumber: (number: number, customSpeed?: number) => Promise<string>
  speakWithEnthusiasm: (text: string, voiceType?: 'primary' | 'backup' | 'male') => Promise<string>
  speakSlowly: (text: string, voiceType?: 'primary' | 'backup' | 'male') => Promise<string>
  speakQuizPromptWithRepeat: (text: string, repeatWord: string, voiceType?: 'primary' | 'backup' | 'male') => Promise<string>
  
  // Game-specific audio functions
  speakMathProblem: (problem: string, voiceType?: 'primary' | 'backup' | 'male') => Promise<string>
  speakAdditionProblem: (num1: number, num2: number, voiceType?: 'primary' | 'backup' | 'male') => Promise<string>
  announceGameResult: (isCorrect: boolean, voiceType?: 'primary' | 'backup' | 'male') => Promise<string>
  announceScore: (score: number, voiceType?: 'primary' | 'backup' | 'male') => Promise<string>
  announcePosition: (currentIndex: number, total: number, itemType?: 'tal' | 'bogstav', voiceType?: 'primary' | 'backup' | 'male') => Promise<string>
  playGameWelcome: (gameType: string, voiceType?: 'primary' | 'backup' | 'male') => Promise<string>
  playGameEntryWithSetup: (gameType: string, setupCallback: () => void, delay?: number) => Promise<void>
  
  // Enhanced consolidated methods
  speakNumberInContext: (number: number, context: 'counting' | 'answer' | 'learning' | 'result' | 'instruction', options?: { prefix?: string; suffix?: string; voiceType?: 'primary' | 'backup' | 'male' }) => Promise<string>
  speakComparisonProblem: (leftNum: number, rightNum: number, leftObjects: string, rightObjects: string, questionType: 'largest' | 'smallest' | 'equal', voiceType?: 'primary' | 'backup' | 'male') => Promise<string>
  announceGameResultWithContext: (isCorrect: boolean, details?: { correctAnswer?: string | number; explanation?: string; voiceType?: 'primary' | 'backup' | 'male' }) => Promise<string>
  
  // Unified game result handlers
  handleCompleteGameResult: (options: { isCorrect: boolean; character: any; celebrate: (intensity: 'low' | 'medium' | 'high') => void; stopCelebration: () => void; incrementScore: () => void; currentScore: number; nextAction?: () => void; correctAnswer?: string | number; explanation?: string; autoAdvanceDelay?: number; isIOS?: boolean; voiceType?: 'primary' | 'backup' | 'male' }) => Promise<void>
  handleGameCompletion: (options: { character: any; celebrate: (intensity: 'high') => void; stopCelebration: () => void; resetAction?: () => void; completionMessage?: string; autoResetDelay?: number; voiceType?: 'primary' | 'backup' | 'male' }) => Promise<void>
  
  // Sound effects
  playSuccessSound: () => Promise<string>
  playEncouragementSound: () => Promise<string>
  playSound: (soundId: string, src?: string) => Promise<void>
  
  // Audio management
  stopAll: () => void
  
  // Event listeners
  onAudioComplete: (audioId: string, listener: () => void) => () => void
  
  // Utility functions
  playWithCallback: (audioFunction: () => Promise<string>, onComplete?: () => void) => Promise<void>
}

/**
 * Custom hook that provides centralized audio functionality to components
 * 
 * This hook:
 * - Provides access to all specialized Danish audio functions
 * - Manages component-level audio cleanup
 * - Ensures only one audio plays at a time globally
 * - Provides convenient callback handling
 * 
 * @param options Configuration options for the hook
 * @returns Object with audio functions and state
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const audio = useAudio()
 * 
 * // Play audio with callback
 * await audio.playWithCallback(
 *   () => audio.speakNumber(5),
 *   () => console.log('Number 5 finished speaking')
 * )
 * 
 * // Check if audio is playing
 * <Button disabled={audio.isPlaying}>Play Audio</Button>
 * 
 * // Use specialized functions
 * await audio.speakAdditionProblem(3, 7)
 * await audio.announceGameResult(true)
 * ```
 */
export const useAudio = (options: UseAudioOptions = {}): UseAudioReturn => {
  const {
    stopOnUnmount = true,
    componentId
  } = options
  
  const audioContext = useAudioContext()
  const mountedRef = useRef(true)
  const activeAudioIds = useRef<Set<string>>(new Set())

  // Component lifecycle management
  useEffect(() => {
    mountedRef.current = true
    
    if (componentId) {
      console.log(`🎵 useAudio: Component "${componentId}" mounted`)
    }
    
    return () => {
      mountedRef.current = false
      
      if (componentId) {
        console.log(`🎵 useAudio: Component "${componentId}" unmounting`)
      }
      
      // Stop audio on unmount if enabled
      if (stopOnUnmount) {
        // Only stop audio for this specific component, not entry audio
        // Entry audio is managed by entryAudioManager and should survive component unmounting
        console.log(`🎵 useAudio: Component "${componentId}" stopping audio on unmount`)
        
        // Clean up any registered audio complete listeners for this component
        activeAudioIds.current.clear()
        
        // TODO: Implement component-specific audio stopping instead of global stopAll()
        // For now, we'll be less aggressive about stopping all audio on unmount
        // to prevent interrupting entry audio during rapid mount/unmount cycles
      }
    }
  }, [stopOnUnmount, componentId, audioContext])

  /**
   * Enhanced audio function that supports completion callbacks
   */
  const playWithCallback = async (
    audioFunction: () => Promise<string>, 
    onComplete?: () => void
  ): Promise<void> => {
    try {
      const audioId = await audioFunction()
      
      if (onComplete && mountedRef.current) {
        // Track this audio ID for cleanup
        activeAudioIds.current.add(audioId)
        
        // Register completion callback
        const unsubscribe = audioContext.onAudioComplete(audioId, () => {
          // Remove from tracking
          activeAudioIds.current.delete(audioId)
          
          // Call callback only if component is still mounted
          if (mountedRef.current && onComplete) {
            onComplete()
          }
        })
        
        // Clean up subscription if component unmounts before audio completes
        if (!mountedRef.current) {
          unsubscribe()
          activeAudioIds.current.delete(audioId)
        }
      }
    } catch (error) {
      console.error('Error in playWithCallback:', error)
      throw error
    }
  }

  // Wrapper functions that include component lifecycle checks
  const createSafeAudioFunction = <T extends (...args: any[]) => Promise<string>>(
    audioFunction: T
  ): T => {
    return ((...args: any[]) => {
      if (!mountedRef.current) {
        console.warn('🎵 useAudio: Attempted to play audio on unmounted component')
        return Promise.resolve('')
      }
      
      return audioFunction(...args)
    }) as T
  }

  // Special wrapper for void-returning functions
  const createSafeVoidAudioFunction = <T extends (...args: any[]) => Promise<void>>(
    audioFunction: T
  ): T => {
    return ((...args: any[]) => {
      if (!mountedRef.current) {
        console.warn('🎵 useAudio: Attempted to play audio on unmounted component')
        return Promise.resolve()
      }
      
      return audioFunction(...args)
    }) as T
  }

  // Return all audio functions with lifecycle safety
  return {
    // Playing state
    isPlaying: audioContext.isPlaying,
    
    // Core audio functions (wrapped for safety)
    speak: createSafeAudioFunction(audioContext.speak),
    
    // Specialized Danish audio functions (wrapped for safety)
    speakLetter: createSafeAudioFunction(audioContext.speakLetter),
    speakNumber: createSafeAudioFunction(audioContext.speakNumber),
    speakWithEnthusiasm: createSafeAudioFunction(audioContext.speakWithEnthusiasm),
    speakSlowly: createSafeAudioFunction(audioContext.speakSlowly),
    speakQuizPromptWithRepeat: createSafeAudioFunction(audioContext.speakQuizPromptWithRepeat),
    
    // Game-specific audio functions (wrapped for safety)
    speakMathProblem: createSafeAudioFunction(audioContext.speakMathProblem),
    speakAdditionProblem: createSafeAudioFunction(audioContext.speakAdditionProblem),
    announceGameResult: createSafeAudioFunction(audioContext.announceGameResult),
    announceScore: createSafeAudioFunction(audioContext.announceScore),
    announcePosition: createSafeAudioFunction(audioContext.announcePosition),
    playGameWelcome: createSafeAudioFunction(audioContext.playGameWelcome),
    playGameEntryWithSetup: createSafeVoidAudioFunction(audioContext.playGameEntryWithSetup),
    
    // Enhanced consolidated methods
    speakNumberInContext: createSafeAudioFunction(audioContext.speakNumberInContext),
    speakComparisonProblem: createSafeAudioFunction(audioContext.speakComparisonProblem),
    announceGameResultWithContext: createSafeAudioFunction(audioContext.announceGameResultWithContext),
    
    // Unified game result handlers
    handleCompleteGameResult: createSafeVoidAudioFunction(audioContext.handleCompleteGameResult),
    handleGameCompletion: createSafeVoidAudioFunction(audioContext.handleGameCompletion),
    
    // Sound effects (wrapped for safety)
    playSuccessSound: createSafeAudioFunction(audioContext.playSuccessSound),
    playEncouragementSound: createSafeAudioFunction(audioContext.playEncouragementSound),
    playSound: (soundId: string, src?: string) => {
      if (!mountedRef.current) {
        console.warn('🎵 useAudio: Attempted to play sound on unmounted component')
        return Promise.resolve()
      }
      return audioContext.playSound(soundId, src)
    },
    
    // Audio management
    stopAll: audioContext.stopAll,
    
    // Event listeners
    onAudioComplete: audioContext.onAudioComplete,
    
    // Utility functions
    playWithCallback
  }
}

export default useAudio