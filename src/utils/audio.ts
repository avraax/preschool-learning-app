import { Howl } from 'howler'
import { googleTTS, GoogleTTSService } from '../services/googleTTS'
import { isIOS } from './deviceDetection'
import { logAudioIssue, logIOSIssue } from './remoteConsole'

export class AudioManager {
  private sounds: Map<string, Howl> = new Map()
  private googleTTS: GoogleTTSService

  constructor() {
    this.googleTTS = googleTTS
    
    // Preload common phrases for better performance
    this.preloadAudio()
  }

  async speak(text: string, voiceType: 'primary' | 'backup' | 'male' = 'primary', useSSML: boolean = true, customSpeed?: number): Promise<void> {
    // Always use Google TTS with config from shared-tts-config.js
    const customAudioConfig = customSpeed ? { speakingRate: customSpeed } : undefined
    await this.googleTTS.synthesizeAndPlay(text, voiceType, useSSML, customAudioConfig)
  }

  async speakLetter(letter: string) {
    await this.speak(letter)
  }

  async speakNumber(number: number, customSpeed?: number): Promise<void> {
    const danishNumbers = {
      0: 'nul', 1: 'en', 2: 'to', 3: 'tre', 4: 'fire', 5: 'fem',
      6: 'seks', 7: 'syv', 8: 'otte', 9: 'ni', 10: 'ti',
      11: 'elleve', 12: 'tolv', 13: 'tretten', 14: 'fjorten', 15: 'femten',
      16: 'seksten', 17: 'sytten', 18: 'atten', 19: 'nitten', 20: 'tyve'
    }

    let numberText = ''
    
    if (number <= 20) {
      numberText = danishNumbers[number as keyof typeof danishNumbers] || number.toString()
    } else if (number < 100) {
      const tens = Math.floor(number / 10)
      const ones = number % 10
      
      const tensNames = {
        2: 'tyve', 3: 'tredive', 4: 'fyrre', 5: 'halvtreds',
        6: 'tres', 7: 'halvfjerds', 8: 'firs', 9: 'halvfems'
      }
      
      if (ones === 0) {
        numberText = tensNames[tens as keyof typeof tensNames] || number.toString()
      } else {
        const onesText = danishNumbers[ones as keyof typeof danishNumbers]
        const tensText = tensNames[tens as keyof typeof tensNames]
        numberText = `${onesText}og${tensText}`
      }
    } else if (number === 100) {
      numberText = 'et hundrede'
    } else {
      numberText = number.toString()
    }

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
    await this.speak('Godt klaret!')
  }

  async playEncouragementSound() {
    const encouragements = [
      'Prøv igen!',
      'Du kan det!',
      'Næsten der!',
      'Godt forsøg!'
    ]
    const random = encouragements[Math.floor(Math.random() * encouragements.length)]
    await this.speak(random)
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
    const enthusiasticText = `Godt klaret! ${text}!`
    await this.speak(enthusiasticText, voiceType, true)
  }

  async speakSlowly(text: string, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<void> {
    // For difficult words or learning content, speak more slowly
    await this.speak(text, voiceType, true)
  }

  async speakQuizPromptWithRepeat(text: string, repeatWord: string, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<void> {
    try {
      logIOSIssue('Quiz Audio', `Starting speakQuizPromptWithRepeat: "${text}" with repeat word: "${repeatWord}"`)
      
      // iOS-specific: Ensure all audio is properly stopped before starting
      if (isIOS()) {
        this.stopAll()
        await new Promise(resolve => setTimeout(resolve, 200)) // Longer pause for iOS
      }
      
      // Split text to get the base prompt without the target word
      // e.g. "Find bogstavet H" -> "Find bogstavet" + "H"
      let basePrompt = text
      let useRepeat = true
      
      // Try to intelligently split the text
      if (repeatWord && text.includes(repeatWord)) {
        const lastIndex = text.lastIndexOf(repeatWord)
        if (lastIndex > 0) {
          basePrompt = text.substring(0, lastIndex).trim()
        }
      } else {
        // If repeatWord is not in text, just speak the full text
        useRepeat = false
      }
      
      // First: speak base prompt
      logIOSIssue('Quiz Audio', `Speaking base prompt: "${basePrompt}"`)
      await this.speak(basePrompt, voiceType, false)
      
      // Only repeat the word if we found it in the text
      if (useRepeat && repeatWord) {
        // iOS-specific pause adjustment
        const shortPause = isIOS() ? 300 : 50
        await new Promise(resolve => setTimeout(resolve, shortPause))
        
        // Second: speak the target word
        logIOSIssue('Quiz Audio', `Speaking target word first time: "${repeatWord}"`)
        await this.speak(repeatWord, voiceType, false)
        
        // iOS-specific pause adjustment
        const longPause = isIOS() ? 1500 : 1000
        await new Promise(resolve => setTimeout(resolve, longPause))
        
        // Stop any potential lingering audio
        this.stopAll()
        
        // iOS-specific longer cleanup pause
        const stopPause = isIOS() ? 300 : 100
        await new Promise(resolve => setTimeout(resolve, stopPause))
        
        // Third: repeat the target word
        logIOSIssue('Quiz Audio', `Speaking target word second time: "${repeatWord}"`)
        await this.speak(repeatWord, voiceType, false)
      }
      
      logIOSIssue('Quiz Audio', 'Successfully completed speakQuizPromptWithRepeat')
    } catch (error) {
      // Check if this is a navigation interruption (expected)
      const isNavigationInterruption = error instanceof Error && 
        (error.message.includes('interrupted by navigation') || 
         error.message.includes('interrupted by user'))
      
      if (isNavigationInterruption) {
        console.log('🎵 Quiz audio interrupted by navigation (expected)')
        return // Don't log or retry for navigation interruptions
      }
      
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
      .replace(/\+/g, ' plus ')
      .replace(/-/g, ' minus ')
      .replace(/=/g, ' er lig med ')
    await this.speak(mathText, voiceType, true)
  }

  async speakAdditionProblem(num1: number, num2: number, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<void> {
    try {
      logIOSIssue('Addition Problem', `Speaking: ${num1} + ${num2}`)
      
      // Speak addition problems with proper separation for iOS compatibility
      // First: "Hvad er"
      await this.speak('Hvad er', voiceType, false)
      
      // Small pause
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Second: first number
      await this.speakNumber(num1)
      
      // Small pause
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Third: "plus"
      await this.speak('plus', voiceType, false)
      
      // Small pause
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Fourth: second number
      await this.speakNumber(num2)
      
      logIOSIssue('Addition Problem', 'Successfully spoke addition problem')
    } catch (error) {
      logAudioIssue('speakAdditionProblem', error, { num1, num2, voiceType })
      // Fallback: speak as single text
      const fallbackText = `Hvad er ${num1} plus ${num2}`
      await this.speak(fallbackText, voiceType, true)
    }
  }

  async announceGameResult(isCorrect: boolean, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<void> {
    if (isCorrect) {
      const successPhrases = [
        'Fantastisk!',
        'Rigtig godt klaret!', 
        'Super flot!',
        'Perfekt!'
      ]
      const phrase = successPhrases[Math.floor(Math.random() * successPhrases.length)]
      await this.speakWithEnthusiasm(phrase, voiceType)
    } else {
      const encouragementPhrases = [
        'Næsten der! Prøv igen!',
        'Godt forsøg! Du kan det!',
        'Det er okay. Prøv en gang til!',
        'Kom så! Du er så tæt på!'
      ]
      const phrase = encouragementPhrases[Math.floor(Math.random() * encouragementPhrases.length)]
      await this.speak(phrase, voiceType, true)
    }
  }

  // Announce current score or points
  async announceScore(score: number, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<void> {
    let scoreText = ''
    
    if (score === 0) {
      scoreText = 'Du har ingen point endnu'
    } else if (score === 1) {
      scoreText = 'Du har et point'
    } else {
      scoreText = `Du har ${score} point`
    }
    
    await this.speak(scoreText, voiceType, true)
  }

  // Announce current position in learning sequence
  async announcePosition(currentIndex: number, total: number, itemType: 'tal' | 'bogstav' = 'tal', voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<void> {
    const currentNumber = currentIndex + 1
    let positionText = ''
    
    if (itemType === 'tal') {
      positionText = `Du er ved ${itemType} nummer ${currentNumber} af ${total}`
    } else {
      positionText = `Du er ved ${itemType} nummer ${currentNumber} af ${total}`
    }
    
    await this.speak(positionText, voiceType, true)
  }
}

export const audioManager = new AudioManager()