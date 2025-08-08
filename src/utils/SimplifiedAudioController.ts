import { Howl } from 'howler'
import { googleTTS, GoogleTTSService } from '../services/googleTTS'
import { isIOS } from './deviceDetection'
import { DANISH_PHRASES, getRandomSuccessPhrase, getRandomEncouragementPhrase, getDanishNumberText } from '../config/danish-phrases'
import { audioDebugSession } from './remoteConsole'

// Simplified logging for the new audio system
const logSimplifiedAudio = (message: string, data?: any) => {
  console.log(`🎵 SimplifiedAudioController: ${message}`, data)
  
  if (audioDebugSession.isSessionActive()) {
    audioDebugSession.addLog('SIMPLIFIED_AUDIO_CONTROLLER', {
      message,
      data,
      isIOS: isIOS(),
      timestamp: new Date().toISOString()
    })
  }
}

// Reference to the simplified audio context
let simplifiedAudioContextInstance: any = null

export const setSimplifiedAudioContext = (context: any) => {
  simplifiedAudioContextInstance = context
  logSimplifiedAudio('Simplified audio context set', { 
    hasContext: !!context,
    contextState: context?.state 
  })
}

interface AudioQueueItem {
  id: string
  audioFunction: () => Promise<void>
  onComplete?: () => void
  priority: 'high' | 'normal' | 'low'
}

/**
 * Simplified AudioController optimized for iOS Safari reliability
 * Removes complex permission testing and uses direct, immediate audio initialization
 */
export class SimplifiedAudioController {
  private sounds: Map<string, Howl> = new Map()
  private googleTTS: GoogleTTSService
  private isCurrentlyPlaying: boolean = false
  private audioQueue: AudioQueueItem[] = []
  private processingQueue: boolean = false
  
  // Simplified event listeners
  private playingStateListeners: (() => void)[] = []
  private navigationCleanupCallbacks: (() => void)[] = []

  constructor() {
    this.googleTTS = googleTTS
    
    logSimplifiedAudio('SimplifiedAudioController initialized', {
      userAgent: navigator.userAgent.substring(0, 100),
      isIOS: isIOS(),
      speechSynthesis: !!window.speechSynthesis
    })
    
    // Preload common phrases for better performance
    this.preloadAudio()
    
    // Setup global navigation cleanup
    this.setupGlobalCleanup()
  }

  // ===== SIMPLIFIED STATE MANAGEMENT =====

  public isPlaying(): boolean {
    return this.isCurrentlyPlaying
  }

  public onPlayingStateChange(listener: () => void): () => void {
    this.playingStateListeners.push(listener)
    
    return () => {
      const index = this.playingStateListeners.indexOf(listener)
      if (index > -1) {
        this.playingStateListeners.splice(index, 1)
      }
    }
  }

  private notifyPlayingStateChange(): void {
    this.playingStateListeners.forEach(listener => {
      try {
        listener()
      } catch (error) {
        console.error('Error in playing state listener:', error)
      }
    })
  }

  // ===== SIMPLIFIED AUDIO QUEUE MANAGEMENT =====

  private async queueAudio(
    audioFunction: () => Promise<void>, 
    priority: 'high' | 'normal' | 'low' = 'normal',
    onComplete?: () => void
  ): Promise<string> {
    const audioId = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    return new Promise((resolve, reject) => {
      // Stop any currently playing audio immediately
      this.stopCurrentAudio()
      
      const queueItem: AudioQueueItem = {
        id: audioId,
        audioFunction: async () => {
          try {
            await audioFunction()
            resolve(audioId)
          } catch (error) {
            // Log error but be more permissive with iOS audio errors
            logSimplifiedAudio('Audio playback error', { 
              audioId,
              error: error?.toString(),
              isIOS: isIOS()
            })
            
            // For iOS, resolve gracefully instead of rejecting for common errors
            if (isIOS() && error instanceof Error && (
              error.message.includes('interrupted') || 
              error.message.includes('not supported') ||
              error.message.includes('suspended')
            )) {
              logSimplifiedAudio('iOS audio error - resolving gracefully', { audioId })
              resolve(audioId)
            } else {
              reject(error)
            }
          }
        },
        onComplete,
        priority
      }
      
      if (priority === 'high') {
        this.audioQueue.unshift(queueItem)
      } else {
        this.audioQueue.push(queueItem)
      }
      
      if (!this.processingQueue) {
        this.processAudioQueue()
      }
    })
  }

  private async processAudioQueue(): Promise<void> {
    if (this.processingQueue || this.audioQueue.length === 0) {
      return
    }
    
    this.processingQueue = true
    
    while (this.audioQueue.length > 0) {
      const queueItem = this.audioQueue.shift()!
      
      try {
        this.isCurrentlyPlaying = true
        this.notifyPlayingStateChange()
        
        await queueItem.audioFunction()
        
        if (queueItem.onComplete) {
          queueItem.onComplete()
        }
        
      } catch (error) {
        if (error instanceof Error && error.message.includes('interrupted by navigation')) {
          this.audioQueue.length = 0
          break
        }
      } finally {
        this.isCurrentlyPlaying = false
        this.notifyPlayingStateChange()
      }
    }
    
    this.processingQueue = false
  }

  private stopCurrentAudio(): void {
    this.audioQueue.length = 0
    
    this.sounds.forEach(sound => {
      try {
        sound.stop()
      } catch (error) {}
    })
    
    this.googleTTS.stopCurrentAudio()
    
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      try {
        window.speechSynthesis.cancel()
      } catch (error) {}
    }
  }

  // ===== SIMPLIFIED PERMISSION MANAGEMENT =====

  /**
   * Simplified audio readiness check - no complex testing, just check if we have initialized context
   */
  private ensureAudioReady(): boolean {
    if (!simplifiedAudioContextInstance) {
      logSimplifiedAudio('No simplified audio context available')
      return false
    }

    const { state, initializeAudio } = simplifiedAudioContextInstance
    
    if (!state.isWorking && state.needsUserAction) {
      logSimplifiedAudio('Audio needs user interaction, attempting initialization')
      // Try to initialize if we haven't yet
      initializeAudio().catch((error: any) => {
        logSimplifiedAudio('Auto-initialization failed', { error })
      })
      return false
    }

    return state.isWorking
  }

  /**
   * Update user interaction in simplified context
   */
  updateUserInteraction(): void {
    if (simplifiedAudioContextInstance) {
      simplifiedAudioContextInstance.updateUserInteraction()
      logSimplifiedAudio('User interaction updated via simplified context')
    }
  }

  // ===== CORE AUDIO FUNCTIONS =====

  async speak(text: string, voiceType: 'primary' | 'backup' | 'male' = 'primary', useSSML: boolean = true, customSpeed?: number): Promise<string> {
    // Always update user interaction immediately when speak is called
    this.updateUserInteraction()
    
    logSimplifiedAudio('speak called', { 
      text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
      voiceType,
      useSSML,
      customSpeed,
      isPlaying: this.isCurrentlyPlaying
    })

    return this.queueAudio(async () => {
      // Check if audio is ready (but don't do complex testing)
      if (!this.ensureAudioReady()) {
        logSimplifiedAudio('Audio not ready, skipping speak', { text: text.substring(0, 50) })
        return
      }
      
      const customAudioConfig = customSpeed ? { speakingRate: customSpeed } : undefined
      
      try {
        await this.googleTTS.synthesizeAndPlay(text, voiceType, useSSML, customAudioConfig)
        logSimplifiedAudio('speak completed successfully')
      } catch (error) {
        logSimplifiedAudio('speak error', { 
          text: text.substring(0, 50),
          error: error?.toString()
        })
        throw error
      }
    })
  }

  // ===== SPECIALIZED DANISH AUDIO FUNCTIONS =====

  async speakLetter(letter: string): Promise<string> {
    return this.speak(letter)
  }

  async speakNumber(number: number, customSpeed?: number): Promise<string> {
    return this.queueAudio(async () => {
      this.updateUserInteraction()
      
      if (!this.ensureAudioReady()) {
        return
      }
      
      const numberText = getDanishNumberText(number)
      const customAudioConfig = customSpeed ? { speakingRate: customSpeed } : undefined

      try {
        await this.googleTTS.synthesizeAndPlay(numberText, 'primary', true, customAudioConfig)
      } catch (error) {
        // For iOS, be more resilient to audio errors during number sequences
        if (isIOS() && error instanceof Error) {
          logSimplifiedAudio('iOS number speech error, continuing', { number, error: error.message })
          return // Don't throw, just continue
        }
        throw error
      }
    })
  }

  async speakWithEnthusiasm(text: string, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    return this.speak(text, voiceType, true)
  }

  async speakSlowly(text: string, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    return this.speak(text, voiceType, true)
  }

  async speakQuizPromptWithRepeat(text: string, repeatWord: string, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    logSimplifiedAudio('speakQuizPromptWithRepeat called', { 
      text,
      repeatWord,
      audioReady: simplifiedAudioContextInstance?.state?.isWorking
    })
    
    return this.queueAudio(async () => {
      this.updateUserInteraction()
      
      if (!this.ensureAudioReady()) {
        logSimplifiedAudio('Audio not ready, aborting speakQuizPromptWithRepeat', {
          audioContextState: simplifiedAudioContextInstance?.state
        })
        return
      }
      
      logSimplifiedAudio('About to play quiz prompt', { 
        text,
        repeatWord,
        isIOS: isIOS()
      })
      
      try {
        // Enhanced approach with better logging
        if (isIOS()) {
          logSimplifiedAudio('iOS: Speaking full text', { text })
          await this.googleTTS.synthesizeAndPlay(text, voiceType, false)
          logSimplifiedAudio('iOS: Successfully spoke full text')
        } else {
          // Non-iOS can handle the split approach
          if (repeatWord && text.includes(repeatWord)) {
            const lastIndex = text.lastIndexOf(repeatWord)
            if (lastIndex > 0) {
              const basePrompt = text.substring(0, lastIndex).trim()
              
              logSimplifiedAudio('Non-iOS: Speaking split prompt', { 
                basePrompt,
                repeatWord
              })
              
              await this.googleTTS.synthesizeAndPlay(basePrompt, voiceType, false)
              await new Promise(resolve => setTimeout(resolve, 400))
              this.updateUserInteraction() // Refresh interaction for second part
              await this.googleTTS.synthesizeAndPlay(repeatWord, voiceType, false)
              
              logSimplifiedAudio('Non-iOS: Successfully spoke split prompt')
            } else {
              logSimplifiedAudio('Non-iOS: repeatWord not found in text, speaking full text', { text })
              await this.googleTTS.synthesizeAndPlay(text, voiceType, false)
            }
          } else {
            logSimplifiedAudio('Non-iOS: No repeatWord or not found, speaking full text', { text })
            await this.googleTTS.synthesizeAndPlay(text, voiceType, false)
          }
        }
        
        logSimplifiedAudio('speakQuizPromptWithRepeat completed successfully')
        
      } catch (error) {
        logSimplifiedAudio('speakQuizPromptWithRepeat error', { 
          text,
          error: error?.toString(),
          errorName: error?.constructor?.name
        })
        
        // Enhanced fallback logging
        try {
          logSimplifiedAudio('Trying fallback: simple text speech', { text })
          await this.googleTTS.synthesizeAndPlay(text, voiceType, false)
          logSimplifiedAudio('Fallback succeeded')
        } catch (fallbackError) {
          logSimplifiedAudio('Fallback also failed', { 
            fallbackError: fallbackError?.toString()
          })
          throw fallbackError
        }
      }
    })
  }

  async speakMathProblem(problem: string, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    const mathText = problem
      .replace(/\+/g, ` ${DANISH_PHRASES.math.plus} `)
      .replace(/-/g, ` ${DANISH_PHRASES.math.minus} `)
      .replace(/=/g, ` ${DANISH_PHRASES.math.equals} `)
    return this.speak(mathText, voiceType, true)
  }

  async speakAdditionProblem(num1: number, num2: number, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    return this.queueAudio(async () => {
      this.updateUserInteraction()
      
      if (!this.ensureAudioReady()) {
        return
      }
      
      try {
        // Simplified for iOS - speak as one complete phrase
        const problemText = `${DANISH_PHRASES.gamePrompts.mathQuestion.prefix} ${getDanishNumberText(num1)} ${DANISH_PHRASES.math.plus} ${getDanishNumberText(num2)}`
        await this.googleTTS.synthesizeAndPlay(problemText, voiceType, true)
      } catch (error) {
        logSimplifiedAudio('speakAdditionProblem error', { error })
        const fallbackText = DANISH_PHRASES.gamePrompts.mathQuestion.addition(num1, num2)
        await this.googleTTS.synthesizeAndPlay(fallbackText, voiceType, true)
      }
    })
  }

  async announceGameResult(isCorrect: boolean, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    logSimplifiedAudio('announceGameResult called', { 
      isCorrect,
      audioReady: simplifiedAudioContextInstance?.state?.isWorking
    })
    
    if (isCorrect) {
      const successPhrase = getRandomSuccessPhrase()
      logSimplifiedAudio('Playing success phrase', { successPhrase })
      return this.speakWithEnthusiasm(successPhrase, voiceType)
    } else {
      const encouragementPhrase = getRandomEncouragementPhrase()
      logSimplifiedAudio('Playing encouragement phrase', { encouragementPhrase })
      return this.speak(encouragementPhrase, voiceType, true)
    }
  }

  // Centralized game welcome audio system
  async playGameWelcome(gameType: string, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    logSimplifiedAudio('playGameWelcome called', { gameType })
    
    this.updateUserInteraction()

    // Import game welcome messages dynamically to avoid circular dependencies
    const { GAME_WELCOME_MESSAGES } = await import('../hooks/useGameEntryAudio')
    
    const welcomeMessage = GAME_WELCOME_MESSAGES[gameType as keyof typeof GAME_WELCOME_MESSAGES]
    
    if (!welcomeMessage) {
      logSimplifiedAudio('No welcome message found for game type', { gameType })
      return Promise.resolve('')
    }
    
    try {
      const result = await this.speak(welcomeMessage, voiceType, true)
      logSimplifiedAudio('playGameWelcome completed successfully', { gameType })
      return result
    } catch (error) {
      // For iOS, resolve gracefully instead of throwing
      if (isIOS() && error instanceof Error) {
        logSimplifiedAudio('iOS welcome audio error - continuing without audio', { gameType, error: error.message })
        return Promise.resolve(`ios_fallback_${Date.now()}`)
      }
      
      logSimplifiedAudio('playGameWelcome error', { gameType, error })
      throw error
    }
  }

  async playSuccessSound(): Promise<string> {
    return this.speak(getRandomSuccessPhrase())
  }

  async playEncouragementSound(): Promise<string> {
    return this.speak(getRandomEncouragementPhrase())
  }

  // ===== CLEANUP AND MANAGEMENT =====

  stopAll(): void {
    this.stopCurrentAudio()
    this.isCurrentlyPlaying = false
    this.notifyPlayingStateChange()
  }

  emergencyStop(): void {
    this.sounds.forEach(sound => {
      try {
        sound.stop()
        sound.unload()
      } catch (error) {}
    })
    this.sounds.clear()
    
    this.googleTTS.stopCurrentAudio()
    
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      try {
        window.speechSynthesis.cancel()
      } catch (error) {}
    }
    
    const audioElements = document.querySelectorAll('audio')
    audioElements.forEach(audio => {
      try {
        audio.pause()
        audio.currentTime = 0
        audio.src = ''
      } catch (error) {}
    })
    
    this.audioQueue.length = 0
    this.isCurrentlyPlaying = false
    this.processingQueue = false
    this.notifyPlayingStateChange()
  }

  private setupGlobalCleanup(): void {
    const cleanup = () => {
      this.triggerNavigationCleanup()
      this.stopAll()
    }

    window.addEventListener('beforeunload', cleanup)
    window.addEventListener('pagehide', cleanup)
    
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', cleanup)
    }
  }

  public registerNavigationCleanup(callback: () => void): () => void {
    this.navigationCleanupCallbacks.push(callback)
    
    return () => {
      const index = this.navigationCleanupCallbacks.indexOf(callback)
      if (index > -1) {
        this.navigationCleanupCallbacks.splice(index, 1)
      }
    }
  }

  public triggerNavigationCleanup(): void {
    this.navigationCleanupCallbacks.forEach((callback, index) => {
      try {
        callback()
      } catch (error) {
        logSimplifiedAudio(`Error in navigation cleanup callback ${index + 1}`, { error })
      }
    })
    
    this.stopAll()
  }

  private async preloadAudio(): Promise<void> {
    try {
      await this.googleTTS.preloadCommonPhrases()
    } catch (error) {
      logSimplifiedAudio('Failed to preload audio', { error })
    }
  }

  getTTSStatus(): {
    cacheStats: { size: number; oldestEntry: number; newestEntry: number }
    queueLength: number
    isPlaying: boolean
  } {
    return {
      cacheStats: this.googleTTS.getCacheStats(),
      queueLength: this.audioQueue.length,
      isPlaying: this.isCurrentlyPlaying
    }
  }
}

// Export singleton instance
export const simplifiedAudioController = new SimplifiedAudioController()