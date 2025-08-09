import { Howl } from 'howler'
import { googleTTS, GoogleTTSService } from '../services/googleTTS'
import { isIOS } from './deviceDetection'
import { DANISH_PHRASES, getRandomSuccessPhrase, getRandomEncouragementPhrase, getDanishNumberText } from '../config/danish-phrases'
import { audioDebugSession } from './remoteConsole'

// Simplified logging for the new audio system with remote logging
const logSimplifiedAudio = (message: string, data?: any) => {
  console.log(`🎵 SimplifiedAudioController: ${message}`, data)
  
  // Always send to remote logging for production debugging
  audioDebugSession.addLog('SIMPLIFIED_AUDIO_CONTROLLER', {
    message,
    data,
    isIOS: isIOS(),
    timestamp: new Date().toISOString()
  })
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

  // ===== SIMPLIFIED SINGLE AUDIO MANAGEMENT (NO QUEUE) =====

  private async playAudio(audioFunction: () => Promise<void>): Promise<string> {
    const audioId = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const stackTrace = new Error().stack
    
    logSimplifiedAudio('🔴 PLAY_AUDIO_START', { 
      audioId,
      isCurrentlyPlaying: this.isCurrentlyPlaying,
      currentAudioId: this.currentAudioId,
      caller: stackTrace?.split('\n')[2]?.trim()
    })
    
    // ALWAYS stop current audio first - dead simple
    this.stopCurrentAudio('new_audio_requested')
    
    // Set current audio tracking
    this.currentAudioId = audioId
    this.isCurrentlyPlaying = true
    this.notifyPlayingStateChange()
    
    try {
      logSimplifiedAudio('🎵 AUDIO_START', { audioId })
      await audioFunction()
      logSimplifiedAudio('✅ AUDIO_COMPLETE', { audioId })
      
    } catch (error) {
      logSimplifiedAudio('❌ AUDIO_ERROR', { 
        audioId,
        error: error?.toString()
      })
      
      // For iOS, don't throw errors for common issues
      if (isIOS() && error instanceof Error && (
        error.message.includes('interrupted') || 
        error.message.includes('not supported') ||
        error.message.includes('suspended')
      )) {
        logSimplifiedAudio('iOS audio error - continuing gracefully', { audioId })
      } else {
        throw error
      }
    } finally {
      // Only reset if this is still the current audio
      if (this.currentAudioId === audioId) {
        this.isCurrentlyPlaying = false
        this.currentAudioId = null
        this.notifyPlayingStateChange()
        logSimplifiedAudio('🏁 AUDIO_FINISHED', { audioId })
      } else {
        logSimplifiedAudio('🔄 AUDIO_WAS_REPLACED', { 
          audioId,
          currentAudioId: this.currentAudioId
        })
      }
    }
    
    return audioId
  }

  private stopCurrentAudio(reason: string = 'new_audio_requested'): void {
    const wasSpeaking = window.speechSynthesis?.speaking
    
    logSimplifiedAudio('🛑 STOP_CURRENT_AUDIO', { 
      reason,
      wasSpeaking,
      isCurrentlyPlaying: this.isCurrentlyPlaying,
      currentAudioId: this.currentAudioId
    })
    
    // Stop all Howler sounds
    this.sounds.forEach((sound, key) => {
      try {
        if (sound.playing()) {
          sound.stop()
          logSimplifiedAudio('🔇 Stopped Howler', { key })
        }
      } catch (error) {}
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
      } catch (error) {}
    }
    
    // Stop all HTML5 audio elements
    const audioElements = document.querySelectorAll('audio')
    audioElements.forEach((audio) => {
      try {
        audio.pause()
        audio.currentTime = 0
      } catch (error) {}
    })
    
    // Reset state
    this.isCurrentlyPlaying = false
    this.currentAudioId = null
    this.notifyPlayingStateChange()
    
    logSimplifiedAudio('✅ STOP_COMPLETE', { reason })
  }

  // ===== SIMPLIFIED PERMISSION MANAGEMENT =====

  /**
   * Simplified audio readiness check - more lenient for iOS
   */
  private ensureAudioReady(): boolean {
    if (!simplifiedAudioContextInstance) {
      logSimplifiedAudio('No simplified audio context available')
      return false
    }

    const { state, initializeAudio } = simplifiedAudioContextInstance
    
    // For iOS, be more lenient - if we've had ANY successful initialization, proceed
    if (isIOS()) {
      // If audio is working, allow it (iOS might have different states than expected)
      if (state.isWorking) {
        logSimplifiedAudio('iOS: Audio is working, allowing playback')
        return true
      }
    }
    
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
    this.updateUserInteraction()
    
    logSimplifiedAudio('🗣️ SPEAK_CALLED', { 
      text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
      voiceType,
      useSSML,
      customSpeed
    })

    return this.playAudio(async () => {
      if (!this.ensureAudioReady()) {
        logSimplifiedAudio('Audio not ready, skipping speak')
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
    logSimplifiedAudio('🔢 SPEAK_NUMBER_CALLED', { number })
    
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

  async speakQuizPromptWithRepeat(text: string, repeatWord: string, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    logSimplifiedAudio('🎯 QUIZ_PROMPT_CALLED', { 
      text,
      repeatWord,
      isCurrentlyPlaying: this.isCurrentlyPlaying
    })
    
    return this.playAudio(async () => {
      this.updateUserInteraction()
      
      if (!this.ensureAudioReady()) {
        logSimplifiedAudio('Audio not ready for quiz prompt')
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
    logSimplifiedAudio('➕ ADDITION_PROBLEM_CALLED', { num1, num2 })
    
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

  async announceScore(score: number, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    logSimplifiedAudio('🏆 ANNOUNCE_SCORE_CALLED', { score })
    
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

  /**
   * Cancel any currently playing audio immediately (alias for stopCurrentAudio for external use)
   */
  cancelCurrentAudio(): void {
    logSimplifiedAudio('cancelCurrentAudio called')
    this.stopCurrentAudio('manual_cancellation')
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
    logSimplifiedAudio('Navigation cleanup triggered - stopping all audio')
    
    // Stop all audio immediately
    this.stopCurrentAudio('navigation')
    
    // Run all navigation cleanup callbacks
    this.navigationCleanupCallbacks.forEach((callback, index) => {
      try {
        callback()
      } catch (error) {
        logSimplifiedAudio(`Error in navigation cleanup callback ${index + 1}`, { error })
      }
    })
    
    // Final cleanup
    this.stopAll()
    
    logSimplifiedAudio('Navigation cleanup completed')
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