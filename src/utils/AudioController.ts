import { Howl } from 'howler'
import { googleTTS, GoogleTTSService } from '../services/googleTTS'
import { isIOS } from './deviceDetection'
import { DANISH_PHRASES, getRandomSuccessPhrase, getRandomEncouragementPhrase, getDanishNumberText } from '../config/danish-phrases'
import { audioDebugSession } from './remoteConsole'

// Enhanced iOS Safari PWA debugging using audioDebugSession
const logAudioDebug = (message: string, data?: any) => {
  // Only log to audioDebugSession if it's active
  if (audioDebugSession.isSessionActive()) {
    const isIOSDevice = isIOS()
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone
    const audioContextState = (window as any).AudioContext ? (() => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const state = ctx.state
        ctx.close()
        return state
      } catch {
        return 'unavailable'
      }
    })() : 'unavailable'
    
    audioDebugSession.addLog('AUDIO_CONTROLLER', {
      message,
      data,
      context: {
        isIOS: isIOSDevice,
        isPWA,
        audioContextState,
        timestamp: new Date().toISOString()
      }
    })
  }
}

// Global reference to audio permission context
// This will be set by the AudioPermissionProvider when it initializes
let globalAudioPermissionContext: any = null

export const setGlobalAudioPermissionContext = (context: any) => {
  globalAudioPermissionContext = context
}

// Audio event listeners for state management
type AudioEventListener = () => void
type AudioCompleteListener = () => void

interface AudioQueueItem {
  id: string
  audioFunction: () => Promise<void>
  onComplete?: AudioCompleteListener
  priority: 'high' | 'normal' | 'low'
}

/**
 * Centralized AudioController class that manages all audio playback in the application
 * Ensures only one audio plays at a time and provides all specialized Danish audio functions
 */
export class AudioController {
  private sounds: Map<string, Howl> = new Map()
  private googleTTS: GoogleTTSService
  private isCurrentlyPlaying: boolean = false
  private audioQueue: AudioQueueItem[] = []
  private processingQueue: boolean = false
  
  // Event listeners
  private playingStateListeners: AudioEventListener[] = []
  private audioCompleteListeners: Map<string, AudioCompleteListener[]> = new Map()
  private navigationCleanupCallbacks: (() => void)[] = []

  constructor() {
    this.googleTTS = googleTTS
    
    logAudioDebug('AudioController initialized', {
      userAgent: navigator.userAgent,
      standalone: (window.navigator as any).standalone,
      displayMode: window.matchMedia('(display-mode: standalone)').matches,
      speechSynthesis: !!window.speechSynthesis,
      audioContextSupport: !!(window as any).AudioContext || !!(window as any).webkitAudioContext
    })
    
    // Preload common phrases for better performance
    this.preloadAudio()
    
    // Setup global navigation cleanup
    this.setupGlobalCleanup()
  }

  // ===== STATE MANAGEMENT =====

  /**
   * Get current playing state
   */
  public isPlaying(): boolean {
    return this.isCurrentlyPlaying
  }

  /**
   * Subscribe to playing state changes
   */
  public onPlayingStateChange(listener: AudioEventListener): () => void {
    this.playingStateListeners.push(listener)
    
    // Return unsubscribe function
    return () => {
      const index = this.playingStateListeners.indexOf(listener)
      if (index > -1) {
        this.playingStateListeners.splice(index, 1)
      }
    }
  }

  /**
   * Subscribe to specific audio completion
   */
  public onAudioComplete(audioId: string, listener: AudioCompleteListener): () => void {
    if (!this.audioCompleteListeners.has(audioId)) {
      this.audioCompleteListeners.set(audioId, [])
    }
    
    this.audioCompleteListeners.get(audioId)!.push(listener)
    
    // Return unsubscribe function
    return () => {
      const listeners = this.audioCompleteListeners.get(audioId)
      if (listeners) {
        const index = listeners.indexOf(listener)
        if (index > -1) {
          listeners.splice(index, 1)
        }
        
        // Clean up empty listener arrays
        if (listeners.length === 0) {
          this.audioCompleteListeners.delete(audioId)
        }
      }
    }
  }

  /**
   * Notify listeners of playing state change
   */
  private notifyPlayingStateChange(): void {
    this.playingStateListeners.forEach(listener => {
      try {
        listener()
      } catch (error) {
        console.error('Error in playing state listener:', error)
      }
    })
  }

  /**
   * Notify listeners of audio completion
   */
  private notifyAudioComplete(audioId: string): void {
    const listeners = this.audioCompleteListeners.get(audioId)
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener()
        } catch (error) {
          console.error('Error in audio complete listener:', error)
        }
      })
      
      // Clean up one-time listeners
      this.audioCompleteListeners.delete(audioId)
    }
  }

  // ===== AUDIO QUEUE MANAGEMENT =====

  /**
   * Add audio to queue and process
   */
  private async queueAudio(
    audioFunction: () => Promise<void>, 
    priority: 'high' | 'normal' | 'low' = 'normal',
    onComplete?: AudioCompleteListener
  ): Promise<string> {
    const audioId = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Create a promise that resolves when this specific audio completes
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
            console.error(`🎵 AudioController.queueAudio: Audio ${audioId} failed:`, error)
            reject(error)
          }
        },
        onComplete: () => {
          if (onComplete) {
            onComplete()
          }
        },
        priority
      }
      
      // For high priority, add to front of queue
      if (priority === 'high') {
        this.audioQueue.unshift(queueItem)
      } else {
        this.audioQueue.push(queueItem)
      }
      
      // Process queue if not already processing
      if (!this.processingQueue) {
        this.processAudioQueue()
      }
    })
  }

  /**
   * Process the audio queue
   */
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
        
        // Call completion callback if provided
        if (queueItem.onComplete) {
          queueItem.onComplete()
        }
        
        // Notify audio complete listeners
        this.notifyAudioComplete(queueItem.id)
        
      } catch (error) {
        // Check if this is a navigation interruption (expected) first
        const isNavigationInterruption = error instanceof Error && 
          (error.message.includes('interrupted by navigation') || 
           error.message.includes('interrupted by user'))
        
        if (isNavigationInterruption) {
          // Clear queue on navigation interruption - this is expected, not an error
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

  /**
   * Stop current audio and clear queue
   */
  private stopCurrentAudio(): void {
    // Clear the queue of pending audio
    this.audioQueue.length = 0
    
    // Stop Howler.js sounds
    this.sounds.forEach(sound => {
      try {
        sound.stop()
      } catch (error) {
      }
    })
    
    // Stop Google TTS audio
    this.googleTTS.stopCurrentAudio()
    
    // Stop Web Speech API
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      try {
        window.speechSynthesis.cancel()
      } catch (error) {
      }
    }
  }

  // ===== PERMISSION MANAGEMENT =====

  /**
   * Check if audio permission is available
   */
  private async checkAudioPermission(): Promise<boolean> {
    logAudioDebug('checkAudioPermission called', {
      hasGlobalContext: !!globalAudioPermissionContext,
      timestamp: Date.now()
    })

    if (!globalAudioPermissionContext) {
      logAudioDebug('No global audio permission context, allowing by default')
      return true
    }

    try {
      globalAudioPermissionContext.setNeedsPermission(true)
      logAudioDebug('Set needs permission to true')
      
      const hasPermission = await globalAudioPermissionContext.checkAudioPermission()
      logAudioDebug('checkAudioPermission result', { hasPermission })
      
      if (!hasPermission) {
        logAudioDebug('No permission, requesting audio permission')
        const requestResult = await globalAudioPermissionContext.requestAudioPermission()
        logAudioDebug('requestAudioPermission result', { requestResult })
        return requestResult
      }
      
      return hasPermission
    } catch (error) {
      logAudioDebug('Error in checkAudioPermission', { error: error?.toString() })
      return false
    }
  }

  /**
   * Update user interaction in global context
   */
  updateUserInteraction(): void {
    const timestamp = Date.now()
    logAudioDebug('updateUserInteraction called', { 
      hasGlobalContext: !!globalAudioPermissionContext,
      timestamp 
    })
    
    if (globalAudioPermissionContext) {
      globalAudioPermissionContext.updateUserInteraction()
      logAudioDebug('User interaction updated in global context')
    } else {
      logAudioDebug('No global context for user interaction update')
    }
  }

  // ===== CORE AUDIO FUNCTIONS =====

  /**
   * Basic speak function with queue management
   */
  async speak(text: string, voiceType: 'primary' | 'backup' | 'male' = 'primary', useSSML: boolean = true, customSpeed?: number): Promise<string> {
    logAudioDebug('speak called', { 
      text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
      voiceType,
      useSSML,
      customSpeed,
      queueLength: this.audioQueue.length
    })

    return this.queueAudio(async () => {
      logAudioDebug('speak executing in queue', { text: text.substring(0, 50) + '...' })
      
      // Update user interaction timestamp
      this.updateUserInteraction()
      
      // Check audio permission before speaking
      const hasPermission = await this.checkAudioPermission()
      if (!hasPermission) {
        logAudioDebug('speak aborted - no audio permission', { text })
        return
      }
      
      const customAudioConfig = customSpeed ? { speakingRate: customSpeed } : undefined
      
      try {
        logAudioDebug('Calling googleTTS.synthesizeAndPlay', { 
          text: text.substring(0, 50) + '...',
          voiceType,
          useSSML,
          customAudioConfig
        })
        
        await this.googleTTS.synthesizeAndPlay(text, voiceType, useSSML, customAudioConfig)
        logAudioDebug('googleTTS.synthesizeAndPlay completed successfully', { text: text.substring(0, 50) + '...' })
      } catch (error) {
        logAudioDebug('Error in googleTTS.synthesizeAndPlay', { 
          text: text.substring(0, 50) + '...',
          error: error?.toString(),
          errorName: error?.constructor?.name,
          errorMessage: (error as any)?.message
        })
        console.error(`🎵 AudioController.speak: Error in googleTTS for: "${text}"`, error)
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
      
      const hasPermission = await this.checkAudioPermission()
      if (!hasPermission) {
        return
      }
      
      const numberText = getDanishNumberText(number)

      // Retry logic for number counting - important for auto-play reliability
      let lastError: Error | null = null
      const maxRetries = 2
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          await this.googleTTS.synthesizeAndPlay(numberText, 'primary', true, customSpeed ? { speakingRate: customSpeed } : undefined)
          return // Success, exit the retry loop
        } catch (error: any) {
          lastError = error
          
          // Check if this is a navigation interruption (expected)
          const isNavigationInterruption = error instanceof Error && 
            (error.message.includes('interrupted by navigation') || 
             error.message.includes('interrupted by user'))
          
          if (isNavigationInterruption) {
            throw error // Don't retry for navigation interruptions
          }
          
          // Wait a bit before retrying (but not on last attempt)
          // Use longer delay for iOS to allow audio context to recover
          if (attempt < maxRetries - 1) {
            const retryDelay = isIOS() ? 500 : 300
            await new Promise(resolve => setTimeout(resolve, retryDelay))
          }
        }
      }
      
      // If all retries failed, throw the last error
      if (lastError) {
        console.error('All number speech attempts failed:', lastError)
        throw lastError
      }
    })
  }

  async speakWithEnthusiasm(text: string, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    // Just speak the text with enthusiasm, don't add extra words
    return this.speak(text, voiceType, true)
  }

  async speakSlowly(text: string, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    // For difficult words or learning content, speak more slowly
    return this.speak(text, voiceType, true)
  }

  async speakQuizPromptWithRepeat(text: string, repeatWord: string, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    return this.queueAudio(async () => {
      this.updateUserInteraction()
      
      const hasPermission = await this.checkAudioPermission()
      if (!hasPermission) {
        return
      }
      
      try {
        // Split text to separate the base prompt from the target word
        // e.g. "Find bogstavet H" -> "Find bogstavet" + pause + "H"
        if (repeatWord && text.includes(repeatWord)) {
          const lastIndex = text.lastIndexOf(repeatWord)
          if (lastIndex > 0) {
            const basePrompt = text.substring(0, lastIndex).trim()
            
            // Speak the base prompt
            await this.googleTTS.synthesizeAndPlay(basePrompt, voiceType, false)
            
            // Add pause before the target word
            const pauseDuration = isIOS() ? 600 : 400
            await new Promise(resolve => setTimeout(resolve, pauseDuration))
            
            // iOS CRITICAL: Update user interaction before second audio call
            // This prevents iOS permission timeout between audio segments
            this.updateUserInteraction()
            
            // Speak the target word once
            await this.googleTTS.synthesizeAndPlay(repeatWord, voiceType, false)
          } else {
            // If we can't split it, just speak the full text
            await this.googleTTS.synthesizeAndPlay(text, voiceType, false)
          }
        } else {
          // If repeatWord is not in text, just speak the full text
          await this.googleTTS.synthesizeAndPlay(text, voiceType, false)
        }
        
      } catch (error) {
        // Check if this is a navigation interruption (expected)
        const isNavigationInterruption = error instanceof Error && 
          (error.message.includes('interrupted by navigation') || 
           error.message.includes('interrupted by user'))
        
        if (isNavigationInterruption) {
          return // Don't log or retry for navigation interruptions
        }
        
        console.error('speakQuizPromptWithRepeat error:', error)
        
        // iOS-specific fallback: try a simpler approach
        if (isIOS()) {
          try {
            // Stop everything and wait
            this.stopCurrentAudio()
            await new Promise(resolve => setTimeout(resolve, 500))
            
            // Just speak the full text once on iOS fallback
            await this.googleTTS.synthesizeAndPlay(text, voiceType, false)
          } catch (iosFallbackError) {
            console.error('iOS fallback error:', iosFallbackError)
          }
        } else {
          // Original fallback for non-iOS
          try {
            await this.googleTTS.synthesizeAndPlay(text, voiceType, false)
          } catch (fallbackError) {
            console.error('General fallback error:', fallbackError)
          }
        }
      }
    })
  }

  async speakMathProblem(problem: string, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    // Use natural speech patterns with pauses for math problems
    const mathText = problem
      .replace(/\+/g, ` ${DANISH_PHRASES.math.plus} `)
      .replace(/-/g, ` ${DANISH_PHRASES.math.minus} `)
      .replace(/=/g, ` ${DANISH_PHRASES.math.equals} `)
    return this.speak(mathText, voiceType, true)
  }

  async speakAdditionProblem(num1: number, num2: number, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    return this.queueAudio(async () => {
      this.updateUserInteraction()
      
      const hasPermission = await this.checkAudioPermission()
      if (!hasPermission) {
        return
      }
      
      try {
        // Speak addition problems with proper separation for iOS compatibility
        // First: "Hvad er"
        await this.googleTTS.synthesizeAndPlay(DANISH_PHRASES.gamePrompts.mathQuestion.prefix, voiceType, false)
        
        // Small pause
        await new Promise(resolve => setTimeout(resolve, 300))
        
        // Second: first number
        await this.googleTTS.synthesizeAndPlay(getDanishNumberText(num1), 'primary', true)
        
        // Small pause
        await new Promise(resolve => setTimeout(resolve, 200))
        
        // Third: "plus"
        await this.googleTTS.synthesizeAndPlay(DANISH_PHRASES.math.plus, voiceType, false)
        
        // Small pause
        await new Promise(resolve => setTimeout(resolve, 200))
        
        // Fourth: second number
        await this.googleTTS.synthesizeAndPlay(getDanishNumberText(num2), 'primary', true)
      } catch (error) {
        console.error('speakAdditionProblem error:', error)
        // Fallback: speak as single text
        const fallbackText = DANISH_PHRASES.gamePrompts.mathQuestion.addition(num1, num2)
        await this.googleTTS.synthesizeAndPlay(fallbackText, voiceType, true)
      }
    })
  }

  async announceGameResult(isCorrect: boolean, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    if (isCorrect) {
      const result = await this.speakWithEnthusiasm(getRandomSuccessPhrase(), voiceType)
      return result
    } else {
      const result = await this.speak(getRandomEncouragementPhrase(), voiceType, true)
      return result
    }
  }

  // Announce current score or points
  async announceScore(score: number, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    return this.queueAudio(async () => {
      this.updateUserInteraction()
      
      const hasPermission = await this.checkAudioPermission()
      if (!hasPermission) {
        return
      }
      
      try {
        if (score === 0) {
          await this.googleTTS.synthesizeAndPlay(DANISH_PHRASES.score.noPoints, voiceType, true)
        } else if (score === 1) {
          await this.googleTTS.synthesizeAndPlay(DANISH_PHRASES.score.onePoint, voiceType, true)
        } else {
          // For scores > 1, speak each part separately for better pronunciation
          await this.googleTTS.synthesizeAndPlay(DANISH_PHRASES.score.multiplePoints.prefix, voiceType, false)
          await new Promise(resolve => setTimeout(resolve, 200))
          await this.googleTTS.synthesizeAndPlay(getDanishNumberText(score), 'primary', true)
          await new Promise(resolve => setTimeout(resolve, 200))
          await this.googleTTS.synthesizeAndPlay(DANISH_PHRASES.score.multiplePoints.suffix, voiceType, false)
        }
      } catch (error) {
        console.error('Error in announceScore:', error)
        // Fallback to simple text
        const scoreText = score === 0 ? DANISH_PHRASES.score.noPoints
                        : score === 1 ? DANISH_PHRASES.score.onePoint
                        : `${DANISH_PHRASES.score.multiplePoints.prefix} ${score} ${DANISH_PHRASES.score.multiplePoints.suffix}`
        await this.googleTTS.synthesizeAndPlay(scoreText, voiceType, true)
      }
    })
  }

  // Announce current position in learning sequence
  async announcePosition(currentIndex: number, total: number, itemType: 'tal' | 'bogstav' = 'tal', voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    const currentNumber = currentIndex + 1
    const positionText = DANISH_PHRASES.position.template(itemType, currentNumber, total)
    
    return this.speak(positionText, voiceType, true)
  }

  // Centralized game welcome audio system
  async playGameWelcome(gameType: string, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    logAudioDebug('playGameWelcome called', { 
      gameType,
      voiceType,
      timestamp: Date.now()
    })

    // Import game welcome messages dynamically to avoid circular dependencies
    const { GAME_WELCOME_MESSAGES } = await import('../hooks/useGameEntryAudio')
    
    const welcomeMessage = GAME_WELCOME_MESSAGES[gameType as keyof typeof GAME_WELCOME_MESSAGES]
    
    logAudioDebug('Game welcome message lookup', { 
      gameType,
      welcomeMessage: welcomeMessage || 'NOT_FOUND',
      hasMessage: !!welcomeMessage
    })
    
    if (!welcomeMessage) {
      logAudioDebug('No welcome message found for game type', { gameType })
      return Promise.resolve('')
    }
    
    try {
      logAudioDebug('About to speak welcome message', { gameType, welcomeMessage })
      const result = await this.speak(welcomeMessage, voiceType, true)
      logAudioDebug('playGameWelcome completed successfully', { gameType, result })
      return result
    } catch (error) {
      logAudioDebug('Error in playGameWelcome', { 
        gameType,
        error: error?.toString(),
        errorName: error?.constructor?.name,
        errorMessage: (error as any)?.message
      })
      console.error(`🎵 AudioController.playGameWelcome: Error in speak() for "${gameType}":`, error)
      throw error
    }
  }

  /**
   * Centralized method for playing game entry audio and then executing setup callback
   * Consolidates the common pattern used across all task-based games
   * @param gameType - The type of game (e.g., 'alphabet', 'math', 'addition')
   * @param setupCallback - Function to call after entry audio completes
   * @param delay - Delay in ms before calling setupCallback (default: 500)
   */
  async playGameEntryWithSetup(
    gameType: string,
    setupCallback: () => void,
    delay: number = 500
  ): Promise<void> {
    // Play the game welcome audio
    await this.playGameWelcome(gameType)
    
    // Wait for the specified delay, then execute the setup callback
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          setupCallback()
          resolve()
        } catch (error) {
          console.error(`🎵 AudioController.playGameEntryWithSetup: Error in setup callback for "${gameType}":`, error)
          resolve() // Still resolve to prevent hanging
        }
      }, delay)
    })
  }

  /**
   * Context-aware number speaking for different educational scenarios
   * Consolidates various number speaking patterns across games
   */
  async speakNumberInContext(
    number: number,
    context: 'counting' | 'answer' | 'learning' | 'result' | 'instruction',
    options?: { prefix?: string; suffix?: string; voiceType?: 'primary' | 'backup' | 'male' }
  ): Promise<string> {
    const { prefix = '', suffix = '', voiceType = 'primary' } = options || {}
    
    const contextPhrases = {
      counting: `${number}`,
      answer: `Svaret er ${number}`,
      learning: `Dette er tallet ${number}`,
      result: `Du fik ${number} rigtige!`,
      instruction: `Tæl til ${number}`
    }
    
    const baseText = contextPhrases[context] || `${number}`
    const fullText = `${prefix}${baseText}${suffix}`.trim()
    
    return this.speak(fullText, voiceType, true)
  }

  /**
   * Enhanced comparison problem speaking
   * Consolidates the complex pattern from ComparisonGame
   */
  async speakComparisonProblem(
    leftNum: number,
    rightNum: number,
    leftObjects: string,
    rightObjects: string,
    questionType: 'largest' | 'smallest' | 'equal',
    voiceType: 'primary' | 'backup' | 'male' = 'primary'
  ): Promise<string> {
    return this.queueAudio(async () => {
      // Danish numbers mapping (inline to avoid import issues)
      const DANISH_NUMBERS = ['nul', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni', 'ti']
      
      // Speak left side
      const leftText = `${DANISH_NUMBERS[leftNum] || leftNum} ${leftObjects}`
      await this.speak(leftText, voiceType, true)
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Speak right side  
      const rightText = `${DANISH_NUMBERS[rightNum] || rightNum} ${rightObjects}`
      await this.speak(rightText, voiceType, true)
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Ask the comparison question
      let questionText: string
      if (questionType === 'equal') {
        questionText = 'Er der lige mange på begge sider?'
      } else if (questionType === 'largest') {
        questionText = 'Hvor er der flest?'
      } else {
        questionText = 'Hvor er der færrest?'
      }
      
      await this.speak(questionText, voiceType, true)
    })
  }

  /**
   * Enhanced math result announcement with context
   * Consolidates success/error patterns from multiple games
   */
  async announceGameResultWithContext(
    isCorrect: boolean,
    details?: { 
      correctAnswer?: string | number;
      explanation?: string;
      voiceType?: 'primary' | 'backup' | 'male';
    }
  ): Promise<string> {
    const { correctAnswer, explanation, voiceType = 'primary' } = details || {}
    
    if (isCorrect) {
      // Success announcement
      const { getRandomSuccessPhrase } = await import('../config/danish-phrases')
      return this.speak(getRandomSuccessPhrase(), voiceType, true)
    } else {
      // Error with helpful feedback - speak all parts as one message
      let message = 'Prøv igen!'
      
      if (correctAnswer !== undefined) {
        message += ` Det rigtige svar er ${correctAnswer}.`
      }
      
      if (explanation) {
        message += ` ${explanation}`
      }
      
      return this.speak(message, voiceType, true)
    }
  }

  /**
   * Play audio with callback when complete
   * Used for sequencing audio and UI actions
   */
  async playWithCallback(
    audioFunction: () => Promise<string>,
    onComplete?: () => void
  ): Promise<void> {
    if (!onComplete) {
      // No callback needed, just play the audio
      await audioFunction()
      return
    }
    
    // Create a promise that resolves when the audio completes and callback is called
    return new Promise((resolve, reject) => {
      const wrappedAudioFunction = async (): Promise<void> => {
        try {
          // Call the actual audio function (which returns an audioId)
          await audioFunction()
        } catch (error) {
          console.error('🎵 AudioController.playWithCallback: Error in audio function:', error)
          throw error
        }
      }
      
      // Queue audio with completion callback that resolves the promise
      this.queueAudio(wrappedAudioFunction, 'normal', () => {
        try {
          onComplete()
          resolve()
        } catch (error) {
          reject(error)
        }
      }).catch(error => {
        console.error('🎵 AudioController.playWithCallback: Error in queueAudio:', error)
        reject(error)
      })
    })
  }

  /**
   * Unified game result handler with character animation, celebration, and audio
   * Consolidates the common pattern found across all games
   */
  async handleCompleteGameResult(options: {
    isCorrect: boolean;
    character: any; // LottieCharacter instance
    celebrate: (intensity: 'low' | 'medium' | 'high') => void;
    stopCelebration: () => void;
    incrementScore: () => void;
    currentScore: number;
    nextAction?: () => void;
    correctAnswer?: string | number;
    explanation?: string;
    autoAdvanceDelay?: number;
    isIOS?: boolean;
    voiceType?: 'primary' | 'backup' | 'male';
  }): Promise<void> {
    const {
      isCorrect,
      character,
      celebrate,
      stopCelebration,
      incrementScore,
      currentScore,
      nextAction,
      correctAnswer,
      explanation,
      autoAdvanceDelay,
      isIOS = false,
      voiceType = 'primary'
    } = options

    if (isCorrect) {
      incrementScore()
      character.celebrate()
      const celebrationIntensity = currentScore > 5 ? 'high' : 'medium'
      celebrate(celebrationIntensity)
      
      // Play success audio directly without nested queuing
      try {
        await this.announceGameResult(true, voiceType)
        
        if (nextAction) {
          // Shorter delay for iOS to preserve user interaction window
          const delayTime = isIOS ? 1000 : (autoAdvanceDelay || 3000)
          setTimeout(() => {
            stopCelebration()
            character.wave()
            nextAction()
          }, delayTime)
        }
      } catch (error) {
        console.error('🎵 AudioController.handleCompleteGameResult: Error playing success audio:', error)
        // Still trigger next action even if audio fails
        if (nextAction) {
          setTimeout(() => {
            stopCelebration()
            character.wave()
            nextAction()
          }, 2000)
        }
      }
    } else {
      character.think()
      try {
        await this.announceGameResultWithContext(false, { 
          correctAnswer, 
          explanation, 
          voiceType 
        })
        
        // Allow immediate interaction after audio completes
        if (nextAction) {
          nextAction()
        }
      } catch (error) {
        console.error('🎵 AudioController.handleCompleteGameResult: Error playing error audio:', error)
        // Still trigger next action even if audio fails
        if (nextAction) {
          nextAction()
        }
      }
    }
  }

  /**
   * Specialized completion celebration for full game completion
   * Used when completing entire games (like collecting all items)
   */
  async handleGameCompletion(options: {
    character: any;
    celebrate: (intensity: 'high') => void;
    stopCelebration: () => void;
    resetAction?: () => void;
    completionMessage?: string;
    autoResetDelay?: number;
    voiceType?: 'primary' | 'backup' | 'male';
  }): Promise<void> {
    const {
      character,
      celebrate,
      stopCelebration,
      resetAction,
      completionMessage = 'Fantastisk! Du klarede det hele!',
      autoResetDelay = 3000,
      voiceType = 'primary'
    } = options

    // Big celebration for game completion
    character.celebrate()
    celebrate('high')
    
    setTimeout(async () => {
      try {
        await this.speak(completionMessage, voiceType, true)
      } catch (error) {
        console.error('Error playing completion message:', error)
      }
      
      // Auto-reset after celebration
      if (resetAction) {
        setTimeout(() => {
          stopCelebration()
          character.point()
          resetAction()
        }, autoResetDelay)
      }
    }, 300)
  }

  async playSuccessSound(): Promise<string> {
    return this.speak(getRandomSuccessPhrase())
  }

  async playEncouragementSound(): Promise<string> {
    return this.speak(getRandomEncouragementPhrase())
  }

  // ===== SOUND EFFECTS =====

  playSound(soundId: string, src?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let sound = this.sounds.get(soundId)
      
      if (!sound && src) {
        sound = new Howl({
          src: [src],
          volume: 0.7,
          onend: () => resolve(),
          onloaderror: () => reject(new Error(`Failed to load sound: ${soundId}`))
        })
        this.sounds.set(soundId, sound)
      }
      
      if (sound) {
        sound.play()
        if (!src) resolve()
      } else {
        reject(new Error(`Sound not found: ${soundId}`))
      }
    })
  }

  // ===== CLEANUP AND MANAGEMENT =====

  /**
   * Stop all audio immediately
   */
  stopAll(): void {
    this.stopCurrentAudio()
    this.isCurrentlyPlaying = false
    this.notifyPlayingStateChange()
  }

  /**
   * Emergency stop - more aggressive cleanup
   */
  emergencyStop(): void {
    // Stop all Howler.js sounds
    this.sounds.forEach(sound => {
      try {
        sound.stop()
        sound.unload()
      } catch (error) {
      }
    })
    this.sounds.clear()
    
    // Stop Google TTS
    this.googleTTS.stopCurrentAudio()
    
    // Global Web Speech API stop
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      try {
        window.speechSynthesis.cancel()
      } catch (error) {
      }
    }
    
    // Stop all audio elements globally
    const audioElements = document.querySelectorAll('audio')
    audioElements.forEach(audio => {
      try {
        audio.pause()
        audio.currentTime = 0
        audio.src = ''
      } catch (error) {
      }
    })
    
    // Clear queue and state
    this.audioQueue.length = 0
    this.isCurrentlyPlaying = false
    this.processingQueue = false
    this.notifyPlayingStateChange()
  }

  /**
   * Setup global cleanup for navigation events
   */
  private setupGlobalCleanup(): void {
    const cleanup = () => {
      this.triggerNavigationCleanup()
      this.stopAll()
    }

    // Listen for navigation events
    window.addEventListener('beforeunload', cleanup)
    window.addEventListener('pagehide', cleanup)
    
    // Listen for React Router navigation (browser back/forward)
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', cleanup)
    }
  }

  /**
   * Register a callback to be called when navigation cleanup is triggered
   * This allows React components to register for navigation events
   */
  public registerNavigationCleanup(callback: () => void): () => void {
    this.navigationCleanupCallbacks.push(callback)
    
    // Return unsubscribe function
    return () => {
      const index = this.navigationCleanupCallbacks.indexOf(callback)
      if (index > -1) {
        this.navigationCleanupCallbacks.splice(index, 1)
      }
    }
  }

  /**
   * Trigger navigation cleanup - called by React Router navigation detection
   */
  public triggerNavigationCleanup(): void {
    // Call all registered cleanup callbacks
    this.navigationCleanupCallbacks.forEach((callback, index) => {
      try {
        callback()
      } catch (error) {
        console.error(`🎵 AudioController: Error in navigation cleanup callback ${index + 1}:`, error)
      }
    })
    
    // Stop all audio
    this.stopAll()
  }

  // Clean up audio cache
  cleanAudioCache(): void {
    this.googleTTS.cleanCache()
  }

  // Preload common audio for better performance
  private async preloadAudio(): Promise<void> {
    try {
      await this.googleTTS.preloadCommonPhrases()
    } catch (error) {
      console.warn('Failed to preload audio:', error)
    }
  }

  // Get current TTS status
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

  // ===== CENTRALIZED COLOR MIXING AUDIO METHODS =====

  /**
   * Announces the start of a color mixing game with target color
   */
  async speakColorMixingInstructions(targetColorName: string, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    return this.queueAudio(async () => {
      this.updateUserInteraction()
      
      const hasPermission = await this.checkAudioPermission()
      if (!hasPermission) return

      const message = `Lav ${targetColorName} ved at blande to farver!`
      await this.googleTTS.synthesizeAndPlay(message, voiceType, true)
    })
  }

  /**
   * Announces a successful color mixing result with celebration
   */
  async speakColorMixingSuccess(color1: string, color2: string, resultColor: string, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    return this.queueAudio(async () => {
      this.updateUserInteraction()
      
      const hasPermission = await this.checkAudioPermission()
      if (!hasPermission) return

      const message = `${color1} og ${color2} bliver til ${resultColor}!`
      await this.googleTTS.synthesizeAndPlay(message, voiceType, true)
    })
  }

  /**
   * Announces color hunt game instructions with target color
   */
  async speakColorHuntInstructions(targetPhrase: string, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    return this.queueAudio(async () => {
      this.updateUserInteraction()
      
      const hasPermission = await this.checkAudioPermission()
      if (!hasPermission) return

      const message = `${targetPhrase} og træk dem til cirklen.`
      await this.googleTTS.synthesizeAndPlay(message, voiceType, true)
    })
  }

  /**
   * Announces new game start with color hunt instructions
   */
  async speakNewColorHuntGame(targetPhrase: string, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    return this.queueAudio(async () => {
      this.updateUserInteraction()
      
      const hasPermission = await this.checkAudioPermission()
      if (!hasPermission) return

      const message = `Nyt spil! ${targetPhrase} og træk dem til cirklen.`
      await this.googleTTS.synthesizeAndPlay(message, voiceType, true)
    })
  }

  // ===== CENTRALIZED GAME INSTRUCTION METHODS =====

  /**
   * Standard success celebration phrases
   */
  async speakGameCompletionCelebration(voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    const celebrations = [
      'Fantastisk!',
      'Perfekt!',
      'Godt klaret!'
    ]
    const randomCelebration = celebrations[Math.floor(Math.random() * celebrations.length)]
    
    return this.speak(randomCelebration, voiceType, true)
  }

  /**
   * Game-specific completion messages
   */
  async speakSpecificGameCompletion(gameType: 'memory' | 'colorHunt' | 'shapes' | 'puzzle', voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<string> {
    const messages = {
      memory: 'Fantastisk! Du fandt alle parrene!',
      colorHunt: 'Fantastisk! Du fandt alle farverne!',
      shapes: 'Fantastisk! Du har bygget det!',
      puzzle: 'Godt klaret! Du løste opgaven!'
    }
    
    return this.speak(messages[gameType], voiceType, true)
  }
}

// Export singleton instance
export const audioController = new AudioController()

// Maintain backward compatibility by re-exporting as audioManager
export const audioManager = audioController