import { Howl } from 'howler'
import { googleTTS, GoogleTTSService } from '../services/googleTTS'
import { isIOS } from './deviceDetection'
import { logAudioIssue, logIOSIssue } from './remoteConsole'
import { DANISH_PHRASES, getRandomSuccessPhrase, getRandomEncouragementPhrase, getDanishNumberText } from '../config/danish-phrases'

// Global reference to audio permission context
// This will be set by the AudioPermissionProvider when it initializes
let globalAudioPermissionContext: any = null

export const setGlobalAudioPermissionContext = (context: any) => {
  globalAudioPermissionContext = context
}

export class AudioManager {
  private sounds: Map<string, Howl> = new Map()
  private googleTTS: GoogleTTSService

  constructor() {
    this.googleTTS = googleTTS
    
    // Preload common phrases for better performance
    this.preloadAudio()
  }

  // Check if audio permission is available
  private async checkAudioPermission(): Promise<boolean> {
    const { audioDebugSession } = await import('../utils/remoteConsole')
    audioDebugSession.addLog('AUDIO_MANAGER_PERMISSION_CHECK', {
      hasGlobalContext: !!globalAudioPermissionContext
    })
    
    if (!globalAudioPermissionContext) {
      audioDebugSession.addLog('AUDIO_MANAGER_NO_CONTEXT_FALLBACK', {
        result: true
      })
      return true
    }

    try {
      audioDebugSession.addLog('AUDIO_MANAGER_SET_NEEDS_PERMISSION', {})
      globalAudioPermissionContext.setNeedsPermission(true)
      
      audioDebugSession.addLog('AUDIO_MANAGER_CHECK_CURRENT_STATUS', {})
      const hasPermission = await globalAudioPermissionContext.checkAudioPermission()
      audioDebugSession.addLog('AUDIO_MANAGER_PERMISSION_STATUS', {
        hasPermission
      })
      
      if (!hasPermission) {
        audioDebugSession.addLog('AUDIO_MANAGER_REQUEST_PERMISSION', {})
        const requestResult = await globalAudioPermissionContext.requestAudioPermission()
        audioDebugSession.addLog('AUDIO_MANAGER_PERMISSION_REQUEST_RESULT', {
          requestResult
        })
        return requestResult
      }
      
      audioDebugSession.addLog('AUDIO_MANAGER_PERMISSION_AVAILABLE', {
        result: hasPermission
      })
      return hasPermission
    } catch (error) {
      audioDebugSession.addLog('AUDIO_MANAGER_PERMISSION_ERROR', {
        error: error instanceof Error ? error.message : error?.toString(),
        errorType: error instanceof Error ? error.constructor?.name : typeof error
      })
      return false
    }
  }

  // Update user interaction in global context
  updateUserInteraction(): void {
    if (globalAudioPermissionContext) {
      globalAudioPermissionContext.updateUserInteraction()
    }
  }

  async speak(text: string, voiceType: 'primary' | 'backup' | 'male' = 'primary', useSSML: boolean = true, customSpeed?: number): Promise<void> {
    const { audioDebugSession } = await import('../utils/remoteConsole')
    audioDebugSession.addLog('AUDIO_MANAGER_SPEAK_CALLED', {
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      textLength: text.length,
      voiceType,
      useSSML,
      customSpeed
    })
    
    // Update user interaction timestamp
    this.updateUserInteraction()
    audioDebugSession.addLog('AUDIO_MANAGER_USER_INTERACTION_UPDATED', {})
    
    // Check audio permission before speaking
    const hasPermission = await this.checkAudioPermission()
    audioDebugSession.addLog('AUDIO_MANAGER_FINAL_PERMISSION_CHECK', {
      hasPermission
    })
    
    if (!hasPermission) {
      audioDebugSession.addLog('AUDIO_MANAGER_PERMISSION_DENIED_SKIP', {
        result: 'skipped'
      })
      return
    }
    
    audioDebugSession.addLog('AUDIO_MANAGER_CALLING_GOOGLE_TTS', {
      customAudioConfig: customSpeed ? { speakingRate: customSpeed } : undefined
    })
    
    const customAudioConfig = customSpeed ? { speakingRate: customSpeed } : undefined
    try {
      await this.googleTTS.synthesizeAndPlay(text, voiceType, useSSML, customAudioConfig)
      audioDebugSession.addLog('AUDIO_MANAGER_TTS_SUCCESS', {
        result: 'completed'
      })
    } catch (error) {
      audioDebugSession.addLog('AUDIO_MANAGER_TTS_FAILED', {
        error: error instanceof Error ? error.message : error?.toString(),
        errorType: error instanceof Error ? error.constructor?.name : typeof error
      })
      throw error
    }
  }

  async speakLetter(letter: string) {
    await this.speak(letter)
  }

  async speakNumber(number: number, customSpeed?: number): Promise<void> {
    const numberText = getDanishNumberText(number)

    // Retry logic for number counting - important for auto-play reliability
    let lastError: Error | null = null
    const maxRetries = 2
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await this.speak(numberText, 'primary', true, customSpeed)
        return // Success, exit the retry loop
      } catch (error: any) {
        lastError = error
        
        // Check if this is a navigation interruption (expected)
        const isNavigationInterruption = error instanceof Error && 
          (error.message.includes('interrupted by navigation') || 
           error.message.includes('interrupted by user'))
        
        if (isNavigationInterruption) {
          console.log('🎵 Number speech interrupted by navigation (expected)')
          throw error // Don't retry for navigation interruptions
        }
        
        // Enhanced error information for iOS debugging
        const errorInfo = {
          number, 
          numberText,
          isIOS: isIOS(),
          attempt: attempt + 1,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorType: typeof error,
          audioContextState: (window as any).AudioContext ? 'supported' : 'not supported'
        }
        
        logAudioIssue(`Number speech attempt ${attempt + 1}`, error, errorInfo)
        
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
      logAudioIssue('All number speech attempts failed', lastError, { 
        number, 
        numberText,
        maxRetries 
      })
      throw lastError
    }
  }

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

  async playSuccessSound() {
    await this.speak(getRandomSuccessPhrase())
  }

  async playEncouragementSound() {
    await this.speak(getRandomEncouragementPhrase())
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
  } {
    return {
      cacheStats: this.googleTTS.getCacheStats()
    }
  }

  // Enhanced stop method
  stopAll(): void {
    console.log('🔇 AudioManager: Stopping all audio')
    
    // Stop Howler.js sounds
    this.sounds.forEach(sound => {
      try {
        sound.stop()
        sound.unload() // Also unload to free memory
      } catch (error) {
        console.log('🎵 Error stopping Howler sound:', error)
      }
    })
    
    // Stop any currently playing Google TTS audio
    this.googleTTS.stopCurrentAudio()
  }
  
  // Emergency stop - more aggressive cleanup
  emergencyStop(): void {
    console.log('🚨 AudioManager: Emergency stop all audio')
    
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
  }

  // Clean up audio cache
  cleanAudioCache(): void {
    this.googleTTS.cleanCache()
  }

  // Specialized methods for child-friendly audio
  async speakWithEnthusiasm(text: string, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<void> {
    // Just speak the text with enthusiasm, don't add extra words
    await this.speak(text, voiceType, true)
  }

  async speakSlowly(text: string, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<void> {
    // For difficult words or learning content, speak more slowly
    await this.speak(text, voiceType, true)
  }

  async speakQuizPromptWithRepeat(text: string, repeatWord: string, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<void> {
    const { audioDebugSession } = await import('./remoteConsole')
    const sessionId = `quiz-audio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Start comprehensive logging session
    audioDebugSession.startSession(`Quiz Audio Debug - ${sessionId}`)
    
    const debugContext = {
      sessionId,
      text,
      repeatWord,
      voiceType,
      isIOS: isIOS(),
      userAgent: navigator.userAgent,
      currentUrl: window.location.href,
      timestamp: new Date().toISOString(),
      timeSincePageLoad: Date.now() - (window.performance?.timing?.navigationStart || 0)
    }
    
    audioDebugSession.addLog('QUIZ_AUDIO_START', debugContext)
    
    try {
      // Check initial permission state
      const initialPermission = await this.checkAudioPermission()
      audioDebugSession.addLog('QUIZ_AUDIO_INITIAL_PERMISSION', {
        hasPermission: initialPermission,
        audioContextSupported: !!(window.AudioContext || (window as any).webkitAudioContext)
      })
      
      // iOS-specific: Ensure all audio is properly stopped before starting
      if (isIOS()) {
        this.stopAll()
        await new Promise(resolve => setTimeout(resolve, 200))
        audioDebugSession.addLog('QUIZ_AUDIO_IOS_PREP', {
          stoppedAudio: true,
          pauseDuration: 200
        })
      }
      
      // Split text to separate the base prompt from the target word
      if (repeatWord && text.includes(repeatWord)) {
        const lastIndex = text.lastIndexOf(repeatWord)
        if (lastIndex > 0) {
          const basePrompt = text.substring(0, lastIndex).trim()
          
          audioDebugSession.addLog('QUIZ_AUDIO_SPLIT_APPROACH', {
            basePrompt,
            targetWord: repeatWord,
            splitIndex: lastIndex
          })
          
          // Speak the base prompt
          await this.speak(basePrompt, voiceType, false)
          audioDebugSession.addLog('QUIZ_AUDIO_BASE_COMPLETE', {
            basePrompt,
            success: true
          })
          
          // Add pause before the target word
          const pauseDuration = isIOS() ? 600 : 400
          await new Promise(resolve => setTimeout(resolve, pauseDuration))
          
          // Update user interaction before second audio call
          this.updateUserInteraction()
          const midPermission = await this.checkAudioPermission()
          audioDebugSession.addLog('QUIZ_AUDIO_MID_PERMISSION', {
            hasPermission: midPermission,
            pauseDuration,
            interactionUpdated: true
          })
          
          // Speak the target word
          await this.speak(repeatWord, voiceType, false)
          audioDebugSession.addLog('QUIZ_AUDIO_TARGET_COMPLETE', {
            targetWord: repeatWord,
            success: true
          })
        } else {
          audioDebugSession.addLog('QUIZ_AUDIO_NO_SPLIT', {
            reason: 'repeat_word_not_found_properly'
          })
          await this.speak(text, voiceType, false)
        }
      } else {
        audioDebugSession.addLog('QUIZ_AUDIO_FULL_TEXT', {
          reason: 'no_repeat_word_or_not_in_text'
        })
        await this.speak(text, voiceType, false)
      }
      
      audioDebugSession.addLog('QUIZ_AUDIO_SUCCESS', {
        totalDuration: Date.now() - parseInt(sessionId.split('-')[2])
      })
      audioDebugSession.endSession('Quiz audio completed successfully')
      
    } catch (error) {
      // Comprehensive error logging
      const errorDetails = {
        error: error instanceof Error ? error.message : error?.toString(),
        errorType: error instanceof Error ? error.constructor?.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
        timeSinceStart: Date.now() - parseInt(sessionId.split('-')[2]),
        audioContextSupported: !!(window.AudioContext || (window as any).webkitAudioContext),
        currentPermission: await this.checkAudioPermission().catch(() => false)
      }
      
      audioDebugSession.addLog('QUIZ_AUDIO_ERROR', errorDetails)
      
      // Check if this is a navigation interruption (expected)
      const isNavigationInterruption = error instanceof Error && 
        (error.message.includes('interrupted by navigation') || 
         error.message.includes('interrupted by user'))
      
      if (isNavigationInterruption) {
        audioDebugSession.addLog('QUIZ_AUDIO_NAVIGATION_INTERRUPT', {
          expected: true
        })
        audioDebugSession.endSession('Quiz audio interrupted by navigation (expected)')
        return
      }
      
      audioDebugSession.endSession('Quiz audio failed with error')
      logAudioIssue('speakQuizPromptWithRepeat', error, { text, repeatWord, voiceType })
      
      // iOS-specific fallback: try a simpler approach
      if (isIOS()) {
        try {
          // Stop everything and wait
          this.stopAll()
          await new Promise(resolve => setTimeout(resolve, 500))
          
          // Just speak the full text once on iOS fallback
          logIOSIssue('Quiz Audio', 'Using iOS fallback: speaking full text once')
          await this.speak(text, voiceType, false)
        } catch (iosFallbackError) {
          logAudioIssue('iOS fallback', iosFallbackError, { text, repeatWord })
        }
      } else {
        // Original fallback for non-iOS
        try {
          await this.speak(text, voiceType, false)
        } catch (fallbackError) {
          logAudioIssue('General fallback', fallbackError, { text, repeatWord })
        }
      }
    }
  }

  async speakMathProblem(problem: string, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<void> {
    // Use natural speech patterns with pauses for math problems
    const mathText = problem
      .replace(/\+/g, ` ${DANISH_PHRASES.math.plus} `)
      .replace(/-/g, ` ${DANISH_PHRASES.math.minus} `)
      .replace(/=/g, ` ${DANISH_PHRASES.math.equals} `)
    await this.speak(mathText, voiceType, true)
  }

  async speakAdditionProblem(num1: number, num2: number, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<void> {
    try {
      logIOSIssue('Addition Problem', `Speaking: ${num1} + ${num2}`)
      
      // Speak addition problems with proper separation for iOS compatibility
      // First: "Hvad er"
      await this.speak(DANISH_PHRASES.gamePrompts.mathQuestion.prefix, voiceType, false)
      
      // Small pause
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Second: first number
      await this.speakNumber(num1)
      
      // Small pause
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Third: "plus"
      await this.speak(DANISH_PHRASES.math.plus, voiceType, false)
      
      // Small pause
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Fourth: second number
      await this.speakNumber(num2)
      
      logIOSIssue('Addition Problem', 'Successfully spoke addition problem')
    } catch (error) {
      logAudioIssue('speakAdditionProblem', error, { num1, num2, voiceType })
      // Fallback: speak as single text
      const fallbackText = DANISH_PHRASES.gamePrompts.mathQuestion.addition(num1, num2)
      await this.speak(fallbackText, voiceType, true)
    }
  }

  async announceGameResult(isCorrect: boolean, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<void> {
    if (isCorrect) {
      await this.speakWithEnthusiasm(getRandomSuccessPhrase(), voiceType)
    } else {
      await this.speak(getRandomEncouragementPhrase(), voiceType, true)
    }
  }

  // Announce current score or points
  async announceScore(score: number, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<void> {
    try {
      if (score === 0) {
        await this.speak(DANISH_PHRASES.score.noPoints, voiceType, true)
      } else if (score === 1) {
        await this.speak(DANISH_PHRASES.score.onePoint, voiceType, true)
      } else {
        // For scores > 1, speak each part separately for better pronunciation
        await this.speak(DANISH_PHRASES.score.multiplePoints.prefix, voiceType, false)
        await new Promise(resolve => setTimeout(resolve, 200))
        await this.speakNumber(score)
        await new Promise(resolve => setTimeout(resolve, 200))
        await this.speak(DANISH_PHRASES.score.multiplePoints.suffix, voiceType, false)
      }
    } catch (error) {
      console.error('Error in announceScore:', error)
      // Fallback to simple text
      const scoreText = score === 0 ? DANISH_PHRASES.score.noPoints
                      : score === 1 ? DANISH_PHRASES.score.onePoint
                      : `${DANISH_PHRASES.score.multiplePoints.prefix} ${score} ${DANISH_PHRASES.score.multiplePoints.suffix}`
      await this.speak(scoreText, voiceType, true)
    }
  }

  // Announce current position in learning sequence
  async announcePosition(currentIndex: number, total: number, itemType: 'tal' | 'bogstav' = 'tal', voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<void> {
    const currentNumber = currentIndex + 1
    const positionText = DANISH_PHRASES.position.template(itemType, currentNumber, total)
    
    await this.speak(positionText, voiceType, true)
  }
}

export const audioManager = new AudioManager()