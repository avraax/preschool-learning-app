import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { audioController } from '../utils/AudioController'

export interface AudioContextType {
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
  
  // Color game audio functions
  speakColorMixingInstructions: (targetColorName: string, voiceType?: 'primary' | 'backup' | 'male') => Promise<string>
  speakColorMixingSuccess: (color1: string, color2: string, resultColor: string, voiceType?: 'primary' | 'backup' | 'male') => Promise<string>
  speakColorHuntInstructions: (targetPhrase: string, voiceType?: 'primary' | 'backup' | 'male') => Promise<string>
  speakNewColorHuntGame: (targetPhrase: string, voiceType?: 'primary' | 'backup' | 'male') => Promise<string>
  
  // Game completion celebration methods
  speakGameCompletionCelebration: (voiceType?: 'primary' | 'backup' | 'male') => Promise<string>
  speakSpecificGameCompletion: (gameType: 'memory' | 'colorHunt' | 'shapes' | 'puzzle', voiceType?: 'primary' | 'backup' | 'male') => Promise<string>
  
  // Sound effects
  playSuccessSound: () => Promise<string>
  playEncouragementSound: () => Promise<string>
  playSound: (soundId: string, src?: string) => Promise<void>
  
  // Audio management
  stopAll: () => void
  emergencyStop: () => void
  
  // Navigation management
  registerNavigationCleanup: (callback: () => void) => () => void
  triggerNavigationCleanup: () => void
  
  // Event listeners
  onAudioComplete: (audioId: string, listener: () => void) => () => void
  
  // Utility functions
  playWithCallback: (audioFunction: () => Promise<string>, onComplete?: () => void) => Promise<void>
  
  // Status
  getTTSStatus: () => {
    cacheStats: { size: number; oldestEntry: number; newestEntry: number }
    queueLength: number
    isPlaying: boolean
  }
}

const AudioContext = createContext<AudioContextType | undefined>(undefined)

interface AudioProviderProps {
  children: ReactNode
}

/**
 * AudioProvider component that provides centralized audio functionality
 * to all child components through React context
 */
export const AudioProvider: React.FC<AudioProviderProps> = ({ children }) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(audioController.isPlaying())

  useEffect(() => {
    // Subscribe to playing state changes from the AudioController
    const unsubscribe = audioController.onPlayingStateChange(() => {
      setIsPlaying(audioController.isPlaying())
    })

    // Initial state sync
    setIsPlaying(audioController.isPlaying())

    return unsubscribe
  }, [])

  // Create context value with all AudioController methods
  const contextValue: AudioContextType = {
    // Playing state
    isPlaying,
    
    // Core audio functions
    speak: audioController.speak.bind(audioController),
    
    // Specialized Danish audio functions
    speakLetter: audioController.speakLetter.bind(audioController),
    speakNumber: audioController.speakNumber.bind(audioController),
    speakWithEnthusiasm: audioController.speakWithEnthusiasm.bind(audioController),
    speakSlowly: audioController.speakSlowly.bind(audioController),
    speakQuizPromptWithRepeat: audioController.speakQuizPromptWithRepeat.bind(audioController),
    
    // Game-specific audio functions
    speakMathProblem: audioController.speakMathProblem.bind(audioController),
    speakAdditionProblem: audioController.speakAdditionProblem.bind(audioController),
    announceGameResult: audioController.announceGameResult.bind(audioController),
    announceScore: audioController.announceScore.bind(audioController),
    announcePosition: audioController.announcePosition.bind(audioController),
    playGameWelcome: audioController.playGameWelcome.bind(audioController),
    playGameEntryWithSetup: audioController.playGameEntryWithSetup.bind(audioController),
    
    // Enhanced consolidated methods
    speakNumberInContext: audioController.speakNumberInContext.bind(audioController),
    speakComparisonProblem: audioController.speakComparisonProblem.bind(audioController),
    announceGameResultWithContext: audioController.announceGameResultWithContext.bind(audioController),
    
    // Unified game result handlers
    handleCompleteGameResult: audioController.handleCompleteGameResult.bind(audioController),
    handleGameCompletion: audioController.handleGameCompletion.bind(audioController),
    
    // Color game audio functions
    speakColorMixingInstructions: audioController.speakColorMixingInstructions.bind(audioController),
    speakColorMixingSuccess: audioController.speakColorMixingSuccess.bind(audioController),
    speakColorHuntInstructions: audioController.speakColorHuntInstructions.bind(audioController),
    speakNewColorHuntGame: audioController.speakNewColorHuntGame.bind(audioController),
    
    // Game completion celebration methods
    speakGameCompletionCelebration: audioController.speakGameCompletionCelebration.bind(audioController),
    speakSpecificGameCompletion: audioController.speakSpecificGameCompletion.bind(audioController),
    
    // Sound effects
    playSuccessSound: audioController.playSuccessSound.bind(audioController),
    playEncouragementSound: audioController.playEncouragementSound.bind(audioController),
    playSound: audioController.playSound.bind(audioController),
    
    // Audio management
    stopAll: audioController.stopAll.bind(audioController),
    emergencyStop: audioController.emergencyStop.bind(audioController),
    
    // Navigation management
    registerNavigationCleanup: audioController.registerNavigationCleanup.bind(audioController),
    triggerNavigationCleanup: audioController.triggerNavigationCleanup.bind(audioController),
    
    // Event listeners
    onAudioComplete: audioController.onAudioComplete.bind(audioController),
    
    // Utility functions
    playWithCallback: audioController.playWithCallback.bind(audioController),
    
    // Status
    getTTSStatus: audioController.getTTSStatus.bind(audioController)
  }

  return (
    <AudioContext.Provider value={contextValue}>
      {children}
    </AudioContext.Provider>
  )
}

/**
 * Custom hook to access the audio context
 * Throws an error if used outside of AudioProvider
 */
export const useAudioContext = (): AudioContextType => {
  const context = useContext(AudioContext)
  
  if (context === undefined) {
    throw new Error('useAudioContext must be used within an AudioProvider')
  }
  
  return context
}