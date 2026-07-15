import { useEffect, useMemo, useState } from 'react'
import { simplifiedAudioController } from '../utils/SimplifiedAudioController'
import { useSimplifiedAudio as useSimplifiedAudioContext } from '../contexts/SimplifiedAudioContext'

// Interface for component-level audio operations
export interface SimplifiedAudioHook {
  // Playing state
  isPlaying: boolean
  
  // Core audio functions
  speak: (text: string, voiceType?: 'primary' | 'backup' | 'male', useSSML?: boolean, customSpeed?: number) => Promise<string>
  
  // Specialized Danish audio functions
  speakLetter: (letter: string) => Promise<string>
  speakNumber: (number: number, customSpeed?: number) => Promise<string>
  speakEnglish: (text: string) => Promise<string>
  speakLevelUp: (level: number) => Promise<string>
  speakQuizPromptWithRepeat: (text: string, repeatWord: string, voiceType?: 'primary' | 'backup' | 'male') => Promise<string>

  // Game-specific audio functions
  speakAdditionProblem: (num1: number, num2: number, voiceType?: 'primary' | 'backup' | 'male') => Promise<string>
  speakSubtractionProblem: (num1: number, num2: number, voiceType?: 'primary' | 'backup' | 'male') => Promise<string>
  announceScore: (score: number, voiceType?: 'primary' | 'backup' | 'male') => Promise<string>
  playGameWelcome: (gameType: string, voiceType?: 'primary' | 'backup' | 'male') => Promise<string>

  // Audio management
  stopAll: () => void
  cancelCurrentAudio: () => void
  updateUserInteraction: () => void
  
  // Navigation management
  registerNavigationCleanup: (callback: () => void) => () => void
  
  // Status
  getTTSStatus: () => {
    cacheStats: { size: number; oldestEntry: number; newestEntry: number }
    isPlaying: boolean
    currentAudioId: string | null
  }
  
  // Additional game-specific methods
  announcePosition: (currentIndex: number, totalItems: number, itemType: string) => Promise<string>
  speakColorHuntInstructions: (phrase: string) => Promise<string>
  speakColorMixingInstructions: (targetColor: string) => Promise<string>

  // Audio readiness from context
  isAudioReady: boolean
  needsUserAction: boolean
  initializeAudio: () => Promise<boolean>
}

interface UseSimplifiedAudioOptions {
  componentId?: string
  autoInitialize?: boolean
}

// Stable method set (PRD-02 §3). Every method is just a bind of the SimplifiedAudioController
// singleton, so we bind them ONCE at module load instead of allocating 30 fresh closures on every
// render of every mounted game. This is the fixed part of the hook's return value — only the
// reactive fields (isPlaying / isAudioReady / needsUserAction / initializeAudio) change per render.
// Keeping this identity stable makes every downstream `useEffect`/`useCallback` dependency array
// that includes the audio hook honest (no re-run per render) and lets effect cleanups actually run
// on unmount instead of every render.
const STABLE_AUDIO_METHODS = {
  // Core audio functions - bound to SimplifiedAudioController
  speak: simplifiedAudioController.speak.bind(simplifiedAudioController),

  // Specialized Danish audio functions
  speakLetter: simplifiedAudioController.speakLetter.bind(simplifiedAudioController),
  speakNumber: simplifiedAudioController.speakNumber.bind(simplifiedAudioController),
  speakEnglish: simplifiedAudioController.speakEnglish.bind(simplifiedAudioController),
  speakLevelUp: simplifiedAudioController.speakLevelUp.bind(simplifiedAudioController),
  speakQuizPromptWithRepeat: simplifiedAudioController.speakQuizPromptWithRepeat.bind(simplifiedAudioController),

  // Game-specific audio functions
  speakAdditionProblem: simplifiedAudioController.speakAdditionProblem.bind(simplifiedAudioController),
  speakSubtractionProblem: simplifiedAudioController.speakSubtractionProblem.bind(simplifiedAudioController),
  announceScore: simplifiedAudioController.announceScore.bind(simplifiedAudioController),
  playGameWelcome: simplifiedAudioController.playGameWelcome.bind(simplifiedAudioController),

  // Audio management
  stopAll: simplifiedAudioController.stopAll.bind(simplifiedAudioController),
  cancelCurrentAudio: simplifiedAudioController.cancelCurrentAudio.bind(simplifiedAudioController),
  updateUserInteraction: simplifiedAudioController.updateUserInteraction.bind(simplifiedAudioController),

  // Navigation management
  registerNavigationCleanup: simplifiedAudioController.registerNavigationCleanup.bind(simplifiedAudioController),

  // Status
  getTTSStatus: simplifiedAudioController.getTTSStatus.bind(simplifiedAudioController),

  // Additional game-specific methods
  announcePosition: simplifiedAudioController.announcePosition.bind(simplifiedAudioController),
  speakColorHuntInstructions: simplifiedAudioController.speakColorHuntInstructions.bind(simplifiedAudioController),
  speakColorMixingInstructions: simplifiedAudioController.speakColorMixingInstructions.bind(simplifiedAudioController),
} as const

/**
 * Simplified audio hook that provides easy access to audio functionality
 * Optimized for iOS Safari reliability with simplified permission handling
 */
export const useSimplifiedAudioHook = (options: UseSimplifiedAudioOptions = {}): SimplifiedAudioHook => {
  const { componentId: _componentId = 'UnknownComponent', autoInitialize = true } = options
  const [isPlaying, setIsPlaying] = useState<boolean>(simplifiedAudioController.isPlaying())
  
  // Get the simplified audio context for permission state
  const audioContext = useSimplifiedAudioContext()
  
  useEffect(() => {
    // Subscribe to playing state changes from the SimplifiedAudioController
    const unsubscribe = simplifiedAudioController.onPlayingStateChange(() => {
      setIsPlaying(simplifiedAudioController.isPlaying())
    })

    // Initial state sync
    setIsPlaying(simplifiedAudioController.isPlaying())

    return unsubscribe
  }, [])

  // Auto-initialize audio if requested and not already working
  useEffect(() => {
    if (autoInitialize && !audioContext.state.isWorking && audioContext.state.needsUserAction) {
      // Mark that this component needs audio
      audioContext.updateUserInteraction()
    }
  }, [autoInitialize, audioContext.state.isWorking, audioContext.state.needsUserAction])

  // Component initialized - no logging needed in production

  // Reactive fields read from context (audio readiness/permission).
  const isAudioReady = audioContext.state.isWorking
  const needsUserAction = audioContext.state.needsUserAction
  const initializeAudio = audioContext.initializeAudio

  // Stable return identity (PRD-02 §3): the object only changes when a reactive field changes, so
  // consumers that put `audio` in a dependency array don't re-run/re-cleanup on every render. The
  // methods come from the module-level stable set (bound once); nothing here relies on the object's
  // identity changing (that would be a bug) — reactive state flows through the fields below.
  return useMemo<SimplifiedAudioHook>(() => ({
    ...STABLE_AUDIO_METHODS,
    // Playing state
    isPlaying,
    // Audio readiness from context
    isAudioReady,
    needsUserAction,
    initializeAudio,
  }), [isPlaying, isAudioReady, needsUserAction, initializeAudio])
}

// Backward compatibility export
export const useSimplifiedAudio = useSimplifiedAudioHook