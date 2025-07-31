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
  
  // Sound effects
  playSuccessSound: () => Promise<string>
  playEncouragementSound: () => Promise<string>
  playSound: (soundId: string, src?: string) => Promise<void>
  
  // Audio management
  stopAll: () => void
  emergencyStop: () => void
  
  // Event listeners
  onAudioComplete: (audioId: string, listener: () => void) => () => void
  
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
    
    // Sound effects
    playSuccessSound: audioController.playSuccessSound.bind(audioController),
    playEncouragementSound: audioController.playEncouragementSound.bind(audioController),
    playSound: audioController.playSound.bind(audioController),
    
    // Audio management
    stopAll: audioController.stopAll.bind(audioController),
    emergencyStop: audioController.emergencyStop.bind(audioController),
    
    // Event listeners
    onAudioComplete: audioController.onAudioComplete.bind(audioController),
    
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