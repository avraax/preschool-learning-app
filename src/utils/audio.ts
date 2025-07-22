import { Howl } from 'howler'
import { googleTTS, GoogleTTSService } from '../services/googleTTS'

export class AudioManager {
  private sounds: Map<string, Howl> = new Map()
  private speechSynth: SpeechSynthesis
  private danishVoice: SpeechSynthesisVoice | null = null
  private googleTTS: GoogleTTSService
  private useGoogleTTS: boolean = true
  private fallbackToWebSpeech: boolean = true

  constructor() {
    this.speechSynth = window.speechSynthesis
    this.googleTTS = googleTTS
    
    // Configure TTS preferences from environment variables
    this.useGoogleTTS = (import.meta as any).env?.VITE_TTS_USE_GOOGLE !== 'false'
    this.fallbackToWebSpeech = (import.meta as any).env?.VITE_TTS_FALLBACK_TO_WEB_SPEECH !== 'false'
    
    this.initializeDanishVoice()
    
    // Preload common phrases for better performance
    this.preloadAudio()
  }

  private initializeDanishVoice() {
    const loadVoices = () => {
      const voices = this.speechSynth.getVoices()
      this.danishVoice = voices.find(voice => 
        voice.lang.startsWith('da') || 
        voice.lang.startsWith('dk') ||
        voice.name.toLowerCase().includes('danish')
      ) || voices[0]
    }

    if (this.speechSynth.getVoices().length > 0) {
      loadVoices()
    } else {
      this.speechSynth.addEventListener('voiceschanged', loadVoices)
    }
  }

  async speak(text: string, rate: number = 0.8, voiceType: 'primary' | 'backup' | 'male' = 'primary', useSSML: boolean = true): Promise<void> {
    // Try Google TTS first if enabled
    if (this.useGoogleTTS) {
      try {
        await this.googleTTS.synthesizeAndPlay(text, voiceType, useSSML)
        return
      } catch (error) {
        console.warn('⚠️ Google TTS failed, falling back to Web Speech API:', error)
        console.log('💡 TIP: For local development, Google TTS requires a running API server')
        
        // Disable Google TTS temporarily if it fails
        if (!this.fallbackToWebSpeech) {
          throw error
        }
      }
    }

    // Fallback to Web Speech API
    return new Promise((resolve, reject) => {
      if (!this.speechSynth) {
        reject(new Error('Speech synthesis not supported'))
        return
      }

      const utterance = new SpeechSynthesisUtterance(text)
      
      if (this.danishVoice) {
        utterance.voice = this.danishVoice
      }
      
      utterance.lang = 'da-DK'
      utterance.rate = rate
      utterance.pitch = 1.1
      utterance.volume = 1

      utterance.onend = () => resolve()
      utterance.onerror = (event) => reject(event.error)

      this.speechSynth.speak(utterance)
    })
  }

  async speakLetter(letter: string) {
    await this.speak(letter, 0.7)
  }

  async speakNumber(number: number) {
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

    await this.speak(numberText, 0.8)
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
    await this.speak('Godt klaret!', 1.0)
  }

  async playEncouragementSound() {
    const encouragements = [
      'Prøv igen!',
      'Du kan det!',
      'Næsten der!',
      'Godt forsøg!'
    ]
    const random = encouragements[Math.floor(Math.random() * encouragements.length)]
    await this.speak(random, 1.0)
  }

  // Preload common audio for better performance
  private async preloadAudio(): Promise<void> {
    try {
      // Only preload if Google TTS is available
      if (this.useGoogleTTS) {
        await this.googleTTS.preloadCommonPhrases()
      }
    } catch (error) {
      console.warn('Failed to preload audio:', error)
    }
  }

  // Configure TTS preferences
  setTTSConfig(options: {
    useGoogleTTS?: boolean
    fallbackToWebSpeech?: boolean
  }): void {
    if (options.useGoogleTTS !== undefined) {
      this.useGoogleTTS = options.useGoogleTTS
    }
    if (options.fallbackToWebSpeech !== undefined) {
      this.fallbackToWebSpeech = options.fallbackToWebSpeech
    }
  }

  // Get current TTS status
  getTTSStatus(): {
    googleTTSEnabled: boolean
    webSpeechFallback: boolean
    cacheStats: { size: number; oldestEntry: number; newestEntry: number }
  } {
    return {
      googleTTSEnabled: this.useGoogleTTS,
      webSpeechFallback: this.fallbackToWebSpeech,
      cacheStats: this.googleTTS.getCacheStats()
    }
  }

  // Enhanced stop method
  stopAll(): void {
    // Stop Web Speech API
    this.speechSynth.cancel()
    
    // Stop Howler.js sounds
    this.sounds.forEach(sound => sound.stop())
    
    // Stop any currently playing Google TTS audio
    // Note: Individual audio elements created by GoogleTTSService will stop naturally
    // when the AudioManager is stopped, as they're not persistent
  }

  // Clean up audio cache
  cleanAudioCache(): void {
    this.googleTTS.cleanCache()
  }

  // Specialized methods for child-friendly audio
  async speakWithEnthusiasm(text: string, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<void> {
    const enthusiasticText = `Godt klaret! ${text}!`
    await this.speak(enthusiasticText, 0.9, voiceType, true)
  }

  async speakSlowly(text: string, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<void> {
    // For difficult words or learning content, speak more slowly
    await this.speak(text, 0.6, voiceType, true)
  }

  async speakMathProblem(problem: string, voiceType: 'primary' | 'backup' | 'male' = 'primary'): Promise<void> {
    // Add SSML specifically for math problems
    const mathText = problem
      .replace(/\+/g, ' plus ')
      .replace(/-/g, ' minus ')
      .replace(/=/g, ' er lig med ')
    await this.speak(mathText, 0.7, voiceType, true)
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
      await this.speak(phrase, 0.8, voiceType, true)
    }
  }
}

export const audioManager = new AudioManager()