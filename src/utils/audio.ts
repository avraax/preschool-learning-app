import { Howl } from 'howler'
import { googleTTS, GoogleTTSService } from '../services/googleTTS'

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

  async speakNumber(number: number, customSpeed?: number) {
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
    } else {
      numberText = number.toString()
    }

    await this.speak(numberText, 'primary', true, customSpeed)
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
    // Stop Howler.js sounds
    this.sounds.forEach(sound => sound.stop())
    
    // Stop any currently playing Google TTS audio
    this.googleTTS.stopCurrentAudio()
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
      // Split text to get the base prompt without the target word
      // e.g. "Find bogstavet H" -> "Find bogstavet" + "H"
      const textParts = text.split(` ${repeatWord}`)
      const basePrompt = textParts[0] // "Find bogstavet"
      
      // First: speak base prompt
      await this.speak(basePrompt, voiceType, false)
      
      // Very short pause
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Second: speak the target word
      await this.speak(repeatWord, voiceType, false)
      
      // Longer pause
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Stop any potential lingering audio
      this.stopAll()
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Third: repeat the target word
      await this.speak(repeatWord, voiceType, false)
    } catch (error) {
      console.error('Error in speakQuizPromptWithRepeat:', error)
      // Fallback: just speak the original text
      try {
        await this.speak(text, voiceType, false)
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError)
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
    // Speak addition problems with natural emphasis through repetition
    const problemText = `Hvad er ${num1}... ${num1} plus ${num2}... ${num2}?`
    await this.speak(problemText, voiceType, true)
  }

  async announceGameResult(isCorrect: boolean, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<void> {
    if (isCorrect) {
      const successPhrases = [
        'Fantastisk! Du er så dygtig!',
        'Rigtig godt klaret!', 
        'Super! Det var korrekt!',
        'Perfekt! Du kan virkelig det!'
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
}

export const audioManager = new AudioManager()