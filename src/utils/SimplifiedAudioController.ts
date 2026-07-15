import { ttsClient, TtsClient } from '../services/ttsClient'
import { isIOS } from './deviceDetection'
import {
  DANISH_PHRASES,
  getDanishNumberText,
  getDanishLetterName,
  LEVEL_UP_PRAISE,
  levelUpLine,
} from '../config/danish-phrases'
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
  private ttsClient: TtsClient
  private isCurrentlyPlaying: boolean = false
  private currentAudioId: string | null = null

  // Simplified event listeners
  private playingStateListeners: (() => void)[] = []
  private navigationCleanupCallbacks: (() => void)[] = []

  constructor() {
    this.ttsClient = ttsClient

    // When playback is blocked by a missing user gesture, re-prompt via the permission layer.
    this.ttsClient.onNeedsUserAction = () => this.notifyNeedsUserAction()

    // No startup preload burst — it used to trip the circuit breaker on launch (PRD §5.1).

    // Setup global navigation cleanup
    this.setupGlobalCleanup()
  }

  /** Ask the permission provider to re-prompt for a user gesture (iOS suspension recovery). */
  private notifyNeedsUserAction(): void {
    if (simplifiedAudioContextInstance?.markNeedsUserAction) {
      simplifiedAudioContextInstance.markNeedsUserAction()
    }
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
    
    // ALWAYS stop current audio first - dead simple
    this.stopCurrentAudio('new_audio_requested')
    
    // Set current audio tracking
    this.currentAudioId = audioId
    this.isCurrentlyPlaying = true
    this.notifyPlayingStateChange()
    
    try {
      // Execute audio function
      await audioFunction()
      
    } catch (error) {
      logError('Audio playback error', { 
        audioId,
        error: error?.toString()
      })
      
      // For iOS, don't throw errors for common issues - just continue gracefully
      if (isIOS() && error instanceof Error && (
        error.message.includes('interrupted') || 
        error.message.includes('not supported') ||
        error.message.includes('suspended') ||
        error.message.includes('AbortError') ||
        error.message.includes('NotSupportedError')
      )) {
        // iOS audio error - continuing gracefully without throwing
      } else {
        throw error
      }
    } finally {
      // Only reset if this is still the current audio
      if (this.currentAudioId === audioId) {
        this.isCurrentlyPlaying = false
        this.currentAudioId = null
        this.notifyPlayingStateChange()
      }
    }
    
    return audioId
  }

  private stopCurrentAudio(_reason: string = 'new_audio_requested'): void {
    // The engine owns the single shared <audio> element + one speechSynthesis.cancel().
    // No page-wide <audio> teardown, no repeated cancel() spam (PRD §5.1 / §1.3).
    this.ttsClient.stopCurrentAudio()

    // Reset state immediately
    this.isCurrentlyPlaying = false
    this.currentAudioId = null
    this.notifyPlayingStateChange()
  }

  // ===== SIMPLIFIED PERMISSION MANAGEMENT =====

  /**
   * Audio readiness check. If audio isn't working yet, (re)initialize within the current gesture
   * and AWAIT the result rather than swallowing this tap — so the FIRST tap after load / after a
   * suspension actually produces audio instead of being silently dropped (PRD-06 §5 / P3).
   * initializeAudio de-dupes concurrent calls and resolves to whether audio is now working.
   */
  private async ensureAudioReady(): Promise<boolean> {
    const ctx = simplifiedAudioContextInstance
    if (!ctx) {
      // No simplified audio context available
      return false
    }

    if (ctx.state?.isWorking) return true

    // Not working — try to (re)unlock now (this call is on the tap's gesture stack) and use the
    // authoritative result. Previously we fired-and-forgot init and returned false, dropping the tap.
    try {
      return await ctx.initializeAudio()
    } catch {
      return false
    }
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
      if (!(await this.ensureAudioReady())) {
        // Audio not ready, skipping speak
        return
      }
      
      const customAudioConfig = customSpeed ? { speakingRate: customSpeed } : undefined
      await this.ttsClient.synthesizeAndPlay(text, voiceType, useSSML, customAudioConfig)
    })
  }

  // ===== SPECIALIZED DANISH AUDIO FUNCTIONS =====

  async speakLetter(letter: string): Promise<string> {
    // Speak the Danish letter NAME via the single-source map (PRD-11: bare glyph for most letters,
    // explicit respelling for X/Z — see DANISH_LETTER_NAMES). Same text the prebake/audit enumerate.
    return this.speak(getDanishLetterName(letter))
  }

  async speakNumber(number: number, customSpeed?: number): Promise<string> {
    // Speaking number
    
    return this.playAudio(async () => {
      this.updateUserInteraction()
      
      if (!(await this.ensureAudioReady())) {
        return
      }
      
      const numberText = getDanishNumberText(number)
      const customAudioConfig = customSpeed ? { speakingRate: customSpeed } : undefined
      await this.ttsClient.synthesizeAndPlay(numberText, 'primary', true, customAudioConfig)
    })
  }

  // Level-up praise (Liveliness PRD-01). Rotates a closed set of praise templates by level so the
  // same level always speaks the same line (deterministic → prebake-friendly, no Math.random), with
  // the level number spoken as Danish words. Routes through speak() so its cache key matches the
  // prebaked Danish phrase path exactly. One call → single TTS channel (no queue).
  async speakLevelUp(level: number): Promise<string> {
    const lvl = Math.max(1, Math.floor(level))
    const template = LEVEL_UP_PRAISE[lvl % LEVEL_UP_PRAISE.length]
    return this.speak(levelUpLine(template, lvl))
  }

  /**
   * Speak text using the en-US Ava (multilingual) voice.
   * Used by the Engelsk section for target words. Danish instruction/feedback audio
   * still goes through speak()/the da-DK path. Plain text (no Danish SSML wrapper).
   */
  async speakEnglish(text: string): Promise<string> {
    return this.playAudio(async () => {
      this.updateUserInteraction()

      if (!(await this.ensureAudioReady())) {
        return
      }

      await this.ttsClient.synthesizeAndPlay(text, 'english', false)
    })
  }

  async speakQuizPromptWithRepeat(text: string, _repeatWord: string, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    // Playing quiz prompt with repeat word
    
    return this.playAudio(async () => {
      this.updateUserInteraction()
      
      if (!(await this.ensureAudioReady())) {
        // Audio not ready for quiz prompt
        return
      }
      
      // Keep it simple - just speak the full text
      await this.ttsClient.synthesizeAndPlay(text, voiceType, false)
    })
  }

  async speakAdditionProblem(num1: number, num2: number, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    // Playing addition problem
    
    return this.playAudio(async () => {
      this.updateUserInteraction()
      
      if (!(await this.ensureAudioReady())) {
        return
      }
      
      const problemText = `${DANISH_PHRASES.gamePrompts.mathQuestion.prefix} ${getDanishNumberText(num1)} ${DANISH_PHRASES.math.plus} ${getDanishNumberText(num2)}`
      await this.ttsClient.synthesizeAndPlay(problemText, voiceType, true)
    })
  }

  async speakSubtractionProblem(num1: number, num2: number, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    // Playing subtraction problem

    return this.playAudio(async () => {
      this.updateUserInteraction()

      if (!(await this.ensureAudioReady())) {
        return
      }

      const problemText = `${DANISH_PHRASES.gamePrompts.mathQuestion.prefix} ${getDanishNumberText(num1)} ${DANISH_PHRASES.math.minus} ${getDanishNumberText(num2)}`
      await this.ttsClient.synthesizeAndPlay(problemText, voiceType, true)
    })
  }

  async announceScore(score: number, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    // Announcing score
    
    return this.playAudio(async () => {
      this.updateUserInteraction()
      
      if (!(await this.ensureAudioReady())) {
        return
      }
      
      if (score === 0) {
        await this.ttsClient.synthesizeAndPlay(DANISH_PHRASES.score.noPoints, voiceType, true)
      } else if (score === 1) {
        await this.ttsClient.synthesizeAndPlay(DANISH_PHRASES.score.onePoint, voiceType, true)
      } else {
        const scoreText = `${DANISH_PHRASES.score.multiplePoints.prefix} ${getDanishNumberText(score)} ${DANISH_PHRASES.score.multiplePoints.suffix}`
        await this.ttsClient.synthesizeAndPlay(scoreText, voiceType, true)
      }
    })
  }

  // Centralized game welcome audio system
  async playGameWelcome(gameType: string, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    // Playing game welcome
    
    this.updateUserInteraction()

    // The welcome simply narrates the game's TITLE — these MUST stay exactly the card titles in
    // src/config/categoryThemes.ts (categoryContent.*.games[].title), which are also the in-game
    // GameShell titles. Keep all three aligned; don't invent a deviation here.
    const GAME_WELCOME_MESSAGES = {
      alphabet: 'Bogstav Quiz',
      alphabetlearning: 'Lær Alfabetet',
      math: 'Tal Quiz',
      numberlearning: 'Lær Tal',
      addition: 'Plus Opgaver',
      subtraction: 'Minus Opgaver',
      spelling: 'Stav Ordet',
      comparison: 'Sammenlign Tal',
      memory: 'Hukommelsesspil',
      colors: 'Farver',
      farvejagt: 'Farvejagt',
      ramfarven: 'Ram Farven',
      farvelaer: 'Lær Farver',
      farvequiz: 'Hvilken Farve?',
      nuancer: 'Nuancer',
      englishlisten: 'Lyt og Find',
      englishword: 'Find det Engelske Ord',
      englishtranslate: 'Dansk til Engelsk',
      micword: 'Sig et Ord',
      laesordet: 'Læs Ordet',
      patterns: 'Hvad Mangler?'
    }
    
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

    // Backgrounding a standalone PWA mid-clip (visibilitychange:hidden) must cancel narration
    // cleanly so the stall timer is disarmed — otherwise it fires on return and the whole sentence
    // re-speaks (in the Web Speech voice) seconds later (PRD-06 §5 / P3). stopAll resolves the play
    // promise as a cancellation (not an error), so no Web Speech fallback is triggered.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.stopAll()
      })
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

  // ===== COMPATIBILITY / LEARNING-MODE HELPERS =====

  async announcePosition(currentIndex: number, totalItems: number, itemType: string): Promise<string> {
    const text = `Du er ved ${itemType} ${currentIndex + 1} ud af ${totalItems}`
    return this.speak(text)
  }

  async speakColorHuntInstructions(phrase: string): Promise<string> {
    return this.speak(phrase)
  }

  async speakColorMixingInstructions(targetColor: string): Promise<string> {
    const text = `Lav ${targetColor} farve ved at blande farverne`
    return this.speak(text)
  }

  /**
   * Read-only permission/readiness snapshot for bug reports. The provider instance is
   * module-private (set via setSimplifiedAudioContext) — this is the only outside window into it.
   */
  getPermissionSnapshot(): {
    available: boolean
    isWorking?: boolean
    needsUserAction?: boolean
    audioContextState?: string
  } {
    if (!simplifiedAudioContextInstance) return { available: false }
    try {
      return {
        available: true,
        isWorking: simplifiedAudioContextInstance.state?.isWorking,
        needsUserAction: simplifiedAudioContextInstance.state?.needsUserAction,
        audioContextState: simplifiedAudioContextInstance.globalAudioContext?.state,
      }
    } catch {
      return { available: false }
    }
  }

  getTTSStatus(): {
    cacheStats: { size: number; oldestEntry: number; newestEntry: number }
    isPlaying: boolean
    currentAudioId: string | null
  } {
    return {
      cacheStats: this.ttsClient.getCacheStats(),
      isPlaying: this.isCurrentlyPlaying,
      currentAudioId: this.currentAudioId
    }
  }
}

// Export singleton instance
export const simplifiedAudioController = new SimplifiedAudioController()