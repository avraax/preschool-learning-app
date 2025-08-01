import { Howl } from 'howler'
import { googleTTS, GoogleTTSService } from '../services/googleTTS'
import { isIOS } from './deviceDetection'
import { DANISH_PHRASES, getRandomSuccessPhrase, getRandomEncouragementPhrase, getDanishNumberText } from '../config/danish-phrases'

// Global reference to audio permission context
// This will be set by the AudioPermissionProvider when it initializes
let globalAudioPermissionContext: any = null

export const setGlobalAudioPermissionContext = (context: any) => {
  globalAudioPermissionContext = context
}

export const getGlobalAudioPermissionContext = () => {
  return globalAudioPermissionContext
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
    
    console.log(`🎵 AudioController.queueAudio: Adding audio to queue with ID: ${audioId}, priority: ${priority}`)
    
    // Create a promise that resolves when this specific audio completes
    return new Promise((resolve, reject) => {
      // Stop any currently playing audio immediately
      console.log(`🎵 AudioController.queueAudio: Stopping current audio before queuing new audio`)
      this.stopCurrentAudio()
      
      const queueItem: AudioQueueItem = {
        id: audioId,
        audioFunction: async () => {
          try {
            await audioFunction()
            console.log(`🎵 AudioController.queueAudio: Audio ${audioId} completed successfully`)
            resolve(audioId)
          } catch (error) {
            console.log(`🎵 AudioController.queueAudio: Audio ${audioId} failed:`, error)
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
        console.log(`🎵 AudioController.queueAudio: Added high priority audio to front of queue`)
      } else {
        this.audioQueue.push(queueItem)
        console.log(`🎵 AudioController.queueAudio: Added normal priority audio to end of queue`)
      }
      
      console.log(`🎵 AudioController.queueAudio: Queue length now: ${this.audioQueue.length}`)
      
      // Process queue if not already processing
      if (!this.processingQueue) {
        console.log(`🎵 AudioController.queueAudio: Starting queue processing`)
        this.processAudioQueue()
      } else {
        console.log(`🎵 AudioController.queueAudio: Queue already being processed`)
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
          console.log(`🎵 AudioController: Navigation interruption detected, clearing queue`)
          this.audioQueue.length = 0
          break
        } else {
          // Only log as error if it's not a navigation interruption
          console.error(`Error processing audio queue item ${queueItem.id}:`, error)
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
        console.log('🎵 Error stopping Howler sound:', error)
      }
    })
    
    // Stop Google TTS audio
    this.googleTTS.stopCurrentAudio()
    
    // Stop Web Speech API
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      try {
        window.speechSynthesis.cancel()
      } catch (error) {
        console.log('🎵 Error cancelling Web Speech API:', error)
      }
    }
  }

  // ===== PERMISSION MANAGEMENT =====

  /**
   * Check if audio permission is available
   */
  private async checkAudioPermission(): Promise<boolean> {
    if (!globalAudioPermissionContext) {
      return true
    }

    try {
      globalAudioPermissionContext.setNeedsPermission(true)
      const hasPermission = await globalAudioPermissionContext.checkAudioPermission()
      
      if (!hasPermission) {
        const requestResult = await globalAudioPermissionContext.requestAudioPermission()
        return requestResult
      }
      
      return hasPermission
    } catch (error) {
      return false
    }
  }

  /**
   * Update user interaction in global context
   */
  updateUserInteraction(): void {
    if (globalAudioPermissionContext) {
      globalAudioPermissionContext.updateUserInteraction()
    }
  }

  // ===== CORE AUDIO FUNCTIONS =====

  /**
   * Basic speak function with queue management
   */
  async speak(text: string, voiceType: 'primary' | 'backup' | 'male' = 'primary', useSSML: boolean = true, customSpeed?: number): Promise<string> {
    console.log(`🎵 AudioController.speak: Queuing audio for text: "${text}"`)
    
    return this.queueAudio(async () => {
      console.log(`🎵 AudioController.speak: Processing queued audio for text: "${text}"`)
      
      // Update user interaction timestamp
      this.updateUserInteraction()
      
      // Check audio permission before speaking
      const hasPermission = await this.checkAudioPermission()
      if (!hasPermission) {
        console.warn(`🎵 AudioController.speak: No audio permission, skipping: "${text}"`)
        return
      }
      
      console.log(`🎵 AudioController.speak: Permission granted, calling googleTTS for: "${text}"`)
      const customAudioConfig = customSpeed ? { speakingRate: customSpeed } : undefined
      
      try {
        await this.googleTTS.synthesizeAndPlay(text, voiceType, useSSML, customAudioConfig)
        console.log(`🎵 AudioController.speak: Successfully completed synthesis for: "${text}"`)
      } catch (error) {
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
      return this.speakWithEnthusiasm(getRandomSuccessPhrase(), voiceType)
    } else {
      return this.speak(getRandomEncouragementPhrase(), voiceType, true)
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
    console.log(`🎵 AudioController.playGameWelcome: Starting welcome audio for "${gameType}"`)
    
    // Import game welcome messages dynamically to avoid circular dependencies
    const { GAME_WELCOME_MESSAGES } = await import('../hooks/useGameEntryAudio')
    
    const welcomeMessage = GAME_WELCOME_MESSAGES[gameType as keyof typeof GAME_WELCOME_MESSAGES]
    
    if (!welcomeMessage) {
      console.warn(`🎵 AudioController.playGameWelcome: No welcome message defined for game type: ${gameType}`)
      return Promise.resolve('')
    }

    console.log(`🎵 AudioController.playGameWelcome: Found welcome message for "${gameType}": "${welcomeMessage}"`)
    console.log(`🎵 AudioController.playGameWelcome: Calling speak() with message`)
    
    try {
      const result = await this.speak(welcomeMessage, voiceType, true)
      console.log(`🎵 AudioController.playGameWelcome: Successfully completed speak() for "${gameType}"`)
      return result
    } catch (error) {
      console.error(`🎵 AudioController.playGameWelcome: Error in speak() for "${gameType}":`, error)
      throw error
    }
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
    console.log('🚨 AudioController: Emergency stop all audio')
    
    // Stop all Howler.js sounds
    this.sounds.forEach(sound => {
      try {
        sound.stop()
        sound.unload()
      } catch (error) {
        console.log('🎵 Error in emergency stop:', error)
      }
    })
    this.sounds.clear()
    
    // Stop Google TTS
    this.googleTTS.stopCurrentAudio()
    
    // Global Web Speech API stop
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      try {
        window.speechSynthesis.cancel()
        console.log('🔇 Emergency cancelled Web Speech API')
      } catch (error) {
        console.log('🎵 Error cancelling Web Speech API:', error)
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
        console.log('🎵 Error stopping audio element:', error)
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
      console.log('🎵 AudioController: Navigation detected, cleaning up all audio')
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
    console.log('🎵 AudioController: Registering navigation cleanup callback')
    this.navigationCleanupCallbacks.push(callback)
    
    // Return unsubscribe function
    return () => {
      const index = this.navigationCleanupCallbacks.indexOf(callback)
      if (index > -1) {
        this.navigationCleanupCallbacks.splice(index, 1)
        console.log('🎵 AudioController: Unregistered navigation cleanup callback')
      }
    }
  }

  /**
   * Trigger navigation cleanup - called by React Router navigation detection
   */
  public triggerNavigationCleanup(): void {
    console.log(`🎵 AudioController: Triggering navigation cleanup for ${this.navigationCleanupCallbacks.length} callbacks`)
    
    // Call all registered cleanup callbacks
    this.navigationCleanupCallbacks.forEach((callback, index) => {
      try {
        callback()
        console.log(`🎵 AudioController: Navigation cleanup callback ${index + 1} executed successfully`)
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
}

// Export singleton instance
export const audioController = new AudioController()

// Maintain backward compatibility by re-exporting as audioManager
export const audioManager = audioController