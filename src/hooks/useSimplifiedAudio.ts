import { useEffect, useState } from 'react'
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
  speakWithEnthusiasm: (text: string, voiceType?: 'primary' | 'backup' | 'male') => Promise<string>
  speakSlowly: (text: string, voiceType?: 'primary' | 'backup' | 'male') => Promise<string>
  speakQuizPromptWithRepeat: (text: string, repeatWord: string, voiceType?: 'primary' | 'backup' | 'male') => Promise<string>
  
  // Game-specific audio functions
  speakMathProblem: (problem: string, voiceType?: 'primary' | 'backup' | 'male') => Promise<string>
  speakAdditionProblem: (num1: number, num2: number, voiceType?: 'primary' | 'backup' | 'male') => Promise<string>
  announceGameResult: (isCorrect: boolean, voiceType?: 'primary' | 'backup' | 'male') => Promise<string>
  announceScore: (score: number, voiceType?: 'primary' | 'backup' | 'male') => Promise<string>
  playGameWelcome: (gameType: string, voiceType?: 'primary' | 'backup' | 'male') => Promise<string>
  
  // Sound effects
  playSuccessSound: () => Promise<string>
  playEncouragementSound: () => Promise<string>
  
  // Audio management
  stopAll: () => void
  emergencyStop: () => void
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
  
  // Audio readiness from context
  isAudioReady: boolean
  needsUserAction: boolean
  initializeAudio: () => Promise<boolean>
}

interface UseSimplifiedAudioOptions {
  componentId?: string
  autoInitialize?: boolean
}

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

  return {
    // Playing state
    isPlaying,
    
    // Core audio functions - bound to SimplifiedAudioController
    speak: simplifiedAudioController.speak.bind(simplifiedAudioController),
    
    // Specialized Danish audio functions
    speakLetter: simplifiedAudioController.speakLetter.bind(simplifiedAudioController),
    speakNumber: simplifiedAudioController.speakNumber.bind(simplifiedAudioController),
    speakWithEnthusiasm: simplifiedAudioController.speakWithEnthusiasm.bind(simplifiedAudioController),
    speakSlowly: simplifiedAudioController.speakSlowly.bind(simplifiedAudioController),
    speakQuizPromptWithRepeat: simplifiedAudioController.speakQuizPromptWithRepeat.bind(simplifiedAudioController),
    
    // Game-specific audio functions
    speakMathProblem: simplifiedAudioController.speakMathProblem.bind(simplifiedAudioController),
    speakAdditionProblem: simplifiedAudioController.speakAdditionProblem.bind(simplifiedAudioController),
    announceGameResult: simplifiedAudioController.announceGameResult.bind(simplifiedAudioController),
    announceScore: simplifiedAudioController.announceScore.bind(simplifiedAudioController),
    playGameWelcome: simplifiedAudioController.playGameWelcome.bind(simplifiedAudioController),
    
    // Sound effects
    playSuccessSound: simplifiedAudioController.playSuccessSound.bind(simplifiedAudioController),
    playEncouragementSound: simplifiedAudioController.playEncouragementSound.bind(simplifiedAudioController),
    
    // Audio management
    stopAll: simplifiedAudioController.stopAll.bind(simplifiedAudioController),
    emergencyStop: simplifiedAudioController.emergencyStop.bind(simplifiedAudioController),
    cancelCurrentAudio: simplifiedAudioController.cancelCurrentAudio.bind(simplifiedAudioController),
    updateUserInteraction: simplifiedAudioController.updateUserInteraction.bind(simplifiedAudioController),
    
    // Navigation management
    registerNavigationCleanup: simplifiedAudioController.registerNavigationCleanup.bind(simplifiedAudioController),
    
    // Status
    getTTSStatus: simplifiedAudioController.getTTSStatus.bind(simplifiedAudioController),
    
    // Audio readiness from context
    isAudioReady: audioContext.state.isWorking,
    needsUserAction: audioContext.state.needsUserAction,
    initializeAudio: audioContext.initializeAudio
  }
}

// Backward compatibility export
export const useSimplifiedAudio = useSimplifiedAudioHook