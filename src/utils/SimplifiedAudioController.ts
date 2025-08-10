import { Howl } from 'howler'
import { googleTTS, GoogleTTSService } from '../services/googleTTS'
import { isIOS } from './deviceDetection'
import { DANISH_PHRASES, getRandomSuccessPhrase, getRandomEncouragementPhrase, getDanishNumberText } from '../config/danish-phrases'
// Remote console logging removed for production

// Production logging - only critical errors
const logError = (message: string, data?: any) => {
  console.error(`🎵 SimplifiedAudioController Error: ${message}`, data)
}

// Reference to the simplified audio context
let simplifiedAudioContextInstance: any = null

export const setSimplifiedAudioContext = (context: any) => {
  simplifiedAudioContextInstance = context
  // Audio context set
}

/**
 * Simplified AudioController with NO QUEUE - only one audio at a time
 * New audio always cancels current audio immediately
 */
export class SimplifiedAudioController {
  private sounds: Map<string, Howl> = new Map()
  private googleTTS: GoogleTTSService
  private isCurrentlyPlaying: boolean = false
  private currentAudioId: string | null = null
  
  // Simplified event listeners
  private playingStateListeners: (() => void)[] = []
  private navigationCleanupCallbacks: (() => void)[] = []

  constructor() {
    this.googleTTS = googleTTS
    
    // SimplifiedAudioController initialized
    
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

  // ===== SIMPLIFIED SINGLE AUDIO MANAGEMENT (NO QUEUE) =====

  private async playAudio(audioFunction: () => Promise<void>): Promise<string> {
    const audioId = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    // Stack trace removed for production
    
    // Starting new audio playback
    
    // ALWAYS stop current audio first - dead simple
    this.stopCurrentAudio('new_audio_requested')
    
    // Set current audio tracking
    this.currentAudioId = audioId
    this.isCurrentlyPlaying = true
    this.notifyPlayingStateChange()
    
    try {
      // Execute audio function
      await audioFunction()
      // Audio completed successfully
      
    } catch (error) {
      logError('Audio playback error', { 
        audioId,
        error: error?.toString()
      })
      
      // For iOS, don't throw errors for common issues
      if (isIOS() && error instanceof Error && (
        error.message.includes('interrupted') || 
        error.message.includes('not supported') ||
        error.message.includes('suspended')
      )) {
        // iOS audio error - continuing gracefully
      } else {
        throw error
      }
    } finally {
      // Only reset if this is still the current audio
      if (this.currentAudioId === audioId) {
        this.isCurrentlyPlaying = false
        this.currentAudioId = null
        this.notifyPlayingStateChange()
        // Audio finished
      } else {
        // Audio was replaced by new audio
      }
    }
    
    return audioId
  }

  private stopCurrentAudio(_reason: string = 'new_audio_requested'): void {
    // Check if speech synthesis was speaking
    
    // Stopping current audio
    
    // Stop all Howler sounds
    this.sounds.forEach((sound) => {
      try {
        if (sound.playing()) {
          sound.stop()
          // Stopped Howler sound
        }
      } catch {}
    })
    
    // Stop Google TTS (HTML5 audio elements)
    this.googleTTS.stopCurrentAudio()
    
    // Stop Web Speech API aggressively for iOS
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel()
        window.speechSynthesis.cancel()
        setTimeout(() => window.speechSynthesis.cancel(), 10)
        setTimeout(() => window.speechSynthesis.cancel(), 50)
        setTimeout(() => window.speechSynthesis.cancel(), 100)
      } catch {}
    }
    
    // Stop all HTML5 audio elements
    const audioElements = document.querySelectorAll('audio')
    audioElements.forEach((audio) => {
      try {
        audio.pause()
        audio.currentTime = 0
      } catch {}
    })
    
    // Reset state
    this.isCurrentlyPlaying = false
    this.currentAudioId = null
    this.notifyPlayingStateChange()
    
    // Audio stopped successfully
  }

  // ===== SIMPLIFIED PERMISSION MANAGEMENT =====

  /**
   * Simplified audio readiness check - more lenient for iOS
   */
  private ensureAudioReady(): boolean {
    if (!simplifiedAudioContextInstance) {
      // No simplified audio context available
      return false
    }

    const { state, initializeAudio } = simplifiedAudioContextInstance
    
    // For iOS, be more lenient - if we've had ANY successful initialization, proceed
    if (isIOS()) {
      // If audio is working, allow it (iOS might have different states than expected)
      if (state.isWorking) {
        // iOS: Audio is working, allowing playback
        return true
      }
    }
    
    if (!state.isWorking && state.needsUserAction) {
      // Audio needs user interaction, attempting initialization
      // Try to initialize if we haven't yet
      initializeAudio().catch(() => {
        // Auto-initialization failed
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
      // User interaction updated
    }
  }

  // ===== CORE AUDIO FUNCTIONS =====

  async speak(text: string, voiceType: 'primary' | 'backup' | 'male' = 'primary', useSSML: boolean = true, customSpeed?: number): Promise<string> {
    this.updateUserInteraction()
    
    // Speaking text

    return this.playAudio(async () => {
      if (!this.ensureAudioReady()) {
        // Audio not ready, skipping speak
        return
      }
      
      const customAudioConfig = customSpeed ? { speakingRate: customSpeed } : undefined
      await this.googleTTS.synthesizeAndPlay(text, voiceType, useSSML, customAudioConfig)
    })
  }

  // ===== SPECIALIZED DANISH AUDIO FUNCTIONS =====

  async speakLetter(letter: string): Promise<string> {
    return this.speak(letter)
  }

  async speakNumber(number: number, customSpeed?: number): Promise<string> {
    // Speaking number
    
    return this.playAudio(async () => {
      this.updateUserInteraction()
      
      if (!this.ensureAudioReady()) {
        return
      }
      
      const numberText = getDanishNumberText(number)
      const customAudioConfig = customSpeed ? { speakingRate: customSpeed } : undefined
      await this.googleTTS.synthesizeAndPlay(numberText, 'primary', true, customAudioConfig)
    })
  }

  async speakWithEnthusiasm(text: string, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    return this.speak(text, voiceType, true)
  }

  async speakSlowly(text: string, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    return this.speak(text, voiceType, true)
  }

  async speakQuizPromptWithRepeat(text: string, _repeatWord: string, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    // Playing quiz prompt with repeat word
    
    return this.playAudio(async () => {
      this.updateUserInteraction()
      
      if (!this.ensureAudioReady()) {
        // Audio not ready for quiz prompt
        return
      }
      
      // Keep it simple - just speak the full text
      await this.googleTTS.synthesizeAndPlay(text, voiceType, false)
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
    // Playing addition problem
    
    return this.playAudio(async () => {
      this.updateUserInteraction()
      
      if (!this.ensureAudioReady()) {
        return
      }
      
      const problemText = `${DANISH_PHRASES.gamePrompts.mathQuestion.prefix} ${getDanishNumberText(num1)} ${DANISH_PHRASES.math.plus} ${getDanishNumberText(num2)}`
      await this.googleTTS.synthesizeAndPlay(problemText, voiceType, true)
    })
  }

  async announceGameResult(isCorrect: boolean, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    // Announcing game result
    
    if (isCorrect) {
      const successPhrase = getRandomSuccessPhrase()
      // Playing success phrase
      return this.speakWithEnthusiasm(successPhrase, voiceType)
    } else {
      const encouragementPhrase = getRandomEncouragementPhrase()
      // Playing encouragement phrase
      return this.speak(encouragementPhrase, voiceType, true)
    }
  }

  async announceScore(score: number, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    // Announcing score
    
    return this.playAudio(async () => {
      this.updateUserInteraction()
      
      if (!this.ensureAudioReady()) {
        return
      }
      
      if (score === 0) {
        await this.googleTTS.synthesizeAndPlay(DANISH_PHRASES.score.noPoints, voiceType, true)
      } else if (score === 1) {
        await this.googleTTS.synthesizeAndPlay(DANISH_PHRASES.score.onePoint, voiceType, true)
      } else {
        const scoreText = `${DANISH_PHRASES.score.multiplePoints.prefix} ${getDanishNumberText(score)} ${DANISH_PHRASES.score.multiplePoints.suffix}`
        await this.googleTTS.synthesizeAndPlay(scoreText, voiceType, true)
      }
    })
  }

  // Centralized game welcome audio system
  async playGameWelcome(gameType: string, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    // Playing game welcome
    
    this.updateUserInteraction()

    // Import game welcome messages dynamically to avoid circular dependencies
    const { GAME_WELCOME_MESSAGES } = await import('../hooks/useGameEntryAudio')
    
    const welcomeMessage = GAME_WELCOME_MESSAGES[gameType as keyof typeof GAME_WELCOME_MESSAGES]
    
    if (!welcomeMessage) {
      // No welcome message found for game type
      return Promise.resolve('')
    }
    
    try {
      const result = await this.speak(welcomeMessage, voiceType, true)
      // Game welcome completed successfully
      return result
    } catch (error) {
      // For iOS, resolve gracefully instead of throwing
      if (isIOS() && error instanceof Error) {
        // iOS welcome audio error - continuing without audio
        return Promise.resolve(`ios_fallback_${Date.now()}`)
      }
      
      logError('playGameWelcome error', { gameType, error })
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

  /**
   * Cancel any currently playing audio immediately (alias for stopCurrentAudio for external use)
   */
  cancelCurrentAudio(): void {
    // Cancelling current audio
    this.stopCurrentAudio('manual_cancellation')
  }

  emergencyStop(): void {
    this.sounds.forEach(sound => {
      try {
        sound.stop()
        sound.unload()
      } catch {}
    })
    this.sounds.clear()
    
    this.googleTTS.stopCurrentAudio()
    
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      try {
        window.speechSynthesis.cancel()
      } catch {}
    }
    
    const audioElements = document.querySelectorAll('audio')
    audioElements.forEach(audio => {
      try {
        audio.pause()
        audio.currentTime = 0
        audio.src = ''
      } catch {}
    })
    
    this.isCurrentlyPlaying = false
    this.currentAudioId = null
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
    // Navigation cleanup triggered - stopping all audio
    
    // Stop all audio immediately
    this.stopCurrentAudio('navigation')
    
    // Run all navigation cleanup callbacks
    this.navigationCleanupCallbacks.forEach((callback, index) => {
      try {
        callback()
      } catch (error) {
        logError(`Error in navigation cleanup callback ${index + 1}`, { error })
      }
    })
    
    // Final cleanup
    this.stopAll()
    
    // Navigation cleanup completed
  }

  private async preloadAudio(): Promise<void> {
    try {
      await this.googleTTS.preloadCommonPhrases()
    } catch (error) {
      // Failed to preload audio
    }
  }

  getTTSStatus(): {
    cacheStats: { size: number; oldestEntry: number; newestEntry: number }
    isPlaying: boolean
    currentAudioId: string | null
  } {
    return {
      cacheStats: this.googleTTS.getCacheStats(),
      isPlaying: this.isCurrentlyPlaying,
      currentAudioId: this.currentAudioId
    }
  }
}

// Export singleton instance
export const simplifiedAudioController = new SimplifiedAudioController()