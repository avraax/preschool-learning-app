// Google Cloud TTS client is used in the serverless API function

// Audio cache interface for browser storage
interface CachedAudio {
  audioData: string // base64 encoded audio
  timestamp: number
  voice: string
  text: string
}

export class GoogleTTSService {
  private cache: Map<string, CachedAudio> = new Map()
  private initPromise: Promise<void> | null = null

  // Child-friendly voice configurations for Danish
  private readonly voiceConfigs = {
    primary: {
      languageCode: 'da-DK',
      name: (import.meta as any).env?.VITE_PREFERRED_DANISH_VOICE || 'da-DK-Wavenet-A', // Try Wavenet-A
      ssmlGender: 'FEMALE' as const
    },
    backup: {
      languageCode: 'da-DK', 
      name: 'da-DK-Wavenet-D', // Another female Wavenet voice
      ssmlGender: 'FEMALE' as const
    },
    male: {
      languageCode: 'da-DK',
      name: 'da-DK-Wavenet-C', // Male option for variety
      ssmlGender: 'MALE' as const
    }
  }

  // Audio configuration optimized for children
  private readonly audioConfig = {
    audioEncoding: 'MP3' as const,
    speakingRate: parseFloat((import.meta as any).env?.VITE_SPEECH_RATE || '1.0'), // Use env var or normal speed
    pitch: parseFloat((import.meta as any).env?.VITE_SPEECH_PITCH || '1.2'), // Slightly higher pitch
    volumeGainDb: 0, // Normal volume
    sampleRateHertz: 24000 // Good quality for speech
  }

  constructor() {
    this.initializeService()
    this.loadCacheFromStorage()
  }

  private async initializeService(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = new Promise(async (resolve) => {
      try {
        // For client-side implementation, we'll use a different approach
        // since we can't include service account credentials directly in browser
        resolve()
      } catch (error) {
        console.error('Failed to initialize Google TTS service:', error)
        resolve() // Don't reject, just log the error
      }
    })

    return this.initPromise
  }

  // Generate cache key for consistent caching
  private generateCacheKey(text: string, voice: string): string {
    return `${voice}_${text.toLowerCase().replace(/[^a-zæøå0-9]/gi, '_')}`
  }

  // Load cached audio from localStorage
  private loadCacheFromStorage(): void {
    try {
      const cached = localStorage.getItem('tts_audio_cache')
      if (cached) {
        const parsedCache = JSON.parse(cached)
        this.cache = new Map(Object.entries(parsedCache))
      }
    } catch (error) {
      console.warn('Failed to load TTS cache from storage:', error)
    }
  }

  // Save cache to localStorage
  private saveCacheToStorage(): void {
    try {
      const cacheObj = Object.fromEntries(this.cache)
      localStorage.setItem('tts_audio_cache', JSON.stringify(cacheObj))
    } catch (error) {
      console.warn('Failed to save TTS cache to storage:', error)
    }
  }

  // Get cached audio or return null
  private getCachedAudio(text: string, voice: string): string | null {
    const cacheKey = this.generateCacheKey(text, voice)
    const cached = this.cache.get(cacheKey)
    
    if (cached) {
      // Check if cache is not too old (24 hours)
      const isExpired = Date.now() - cached.timestamp > 24 * 60 * 60 * 1000
      if (!isExpired) {
        return cached.audioData
      } else {
        this.cache.delete(cacheKey)
      }
    }
    
    return null
  }

  // Cache audio data
  private cacheAudio(text: string, voice: string, audioData: string): void {
    const cacheKey = this.generateCacheKey(text, voice)
    this.cache.set(cacheKey, {
      audioData,
      timestamp: Date.now(),
      voice,
      text
    })
    
    // Limit cache size (keep last 100 items)
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }
    
    this.saveCacheToStorage()
  }

  // Convert text to child-friendly SSML
  private createChildFriendlySSML(text: string): string {
    // Apply child-friendly speech patterns with SSML
    let ssml = text
    
    // Add pauses after sentences for clarity
    ssml = ssml.replace(/[.!?]/g, '$&<break time="500ms"/>')
    
    // Slow down numbers for better comprehension
    ssml = ssml.replace(/\b(\d+)\b/g, '<say-as interpret-as="number" format="cardinal"><prosody rate="slow">$1</prosody></say-as>')
    
    // Emphasize letters when spelled out
    ssml = ssml.replace(/\b[A-ZÆØÅ]\b/g, '<emphasis level="moderate"><prosody pitch="+10%">$&</prosody></emphasis>')
    
    // Add enthusiasm to positive words
    const positiveWords = ['godt', 'super', 'fantastisk', 'flot', 'rigtig', 'korrekt', 'perfekt']
    positiveWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi')
      ssml = ssml.replace(regex, `<emphasis level="strong"><prosody pitch="+20%" rate="medium">$&</prosody></emphasis>`)
    })
    
    // Wrap in SSML speak tag without additional rate changes
    return `<speak version="1.0" xml:lang="da-DK">
      ${ssml}
    </speak>`
  }

  // Enhanced synthesis method with SSML support
  async synthesizeSpeech(
    text: string, 
    voiceType: 'primary' | 'backup' | 'male' = 'primary',
    useSSML: boolean = true
  ): Promise<string> {
    await this.initializeService()
    
    const voice = this.voiceConfigs[voiceType]
    const inputText = useSSML ? this.createChildFriendlySSML(text) : text
    const cacheKey = `${text}_${voiceType}_${useSSML}`
    
    // Check cache first
    const cachedAudio = this.getCachedAudio(cacheKey, voice.name)
    if (cachedAudio) {
      return cachedAudio
    }

    try {
      // For client-side implementation, we'll call a server endpoint
      // This avoids exposing service account credentials in the browser
      console.log('🎙️ Attempting Google TTS synthesis:', { 
        voice: voice.name, 
        rate: this.audioConfig.speakingRate,
        pitch: this.audioConfig.pitch,
        textLength: text.length 
      })
      
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: inputText,
          isSSML: useSSML,
          voice,
          audioConfig: this.audioConfig
        })
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error('❌ TTS API failed:', response.status, errorData)
        throw new Error(`TTS API failed: ${response.status}`)
      }

      const data = await response.json()
      const audioData = data.audioContent
      
      console.log('✅ Google TTS synthesis successful')

      // Cache the result
      this.cacheAudio(cacheKey, voice.name, audioData)
      
      return audioData

    } catch (error) {
      console.error('❌ Google TTS synthesis failed:', error)
      console.log('ℹ️ Will fall back to Web Speech API')
      throw error
    }
  }

  // Create audio element from base64 data
  createAudioFromData(base64AudioData: string): HTMLAudioElement {
    const audio = new Audio()
    audio.src = `data:audio/mp3;base64,${base64AudioData}`
    audio.preload = 'auto'
    return audio
  }

  // Play audio directly from base64 data
  async playAudioFromData(base64AudioData: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = this.createAudioFromData(base64AudioData)
      
      audio.addEventListener('ended', () => resolve())
      audio.addEventListener('error', (error) => reject(error))
      
      audio.play().catch(reject)
    })
  }

  // Synthesize and play in one step
  async synthesizeAndPlay(
    text: string, 
    voiceType: 'primary' | 'backup' | 'male' = 'primary',
    useSSML: boolean = true
  ): Promise<void> {
    try {
      const audioData = await this.synthesizeSpeech(text, voiceType, useSSML)
      await this.playAudioFromData(audioData)
    } catch (error) {
      console.error('Failed to synthesize and play audio:', error)
      throw error
    }
  }

  // Preload common phrases for better performance
  async preloadCommonPhrases(): Promise<void> {
    const commonPhrases = [
      'Godt klaret!',
      'Prøv igen!',
      'Du kan det!',
      'Næsten der!',
      'Godt forsøg!',
      'plus',
      'minus',
      'er lig med'
    ]

    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ'.split('')
    const numbers = Array.from({length: 20}, (_, i) => (i + 1).toString())

    const allPhrases = [...commonPhrases, ...letters, ...numbers]

    // Preload in batches to avoid overwhelming the API
    const batchSize = 5
    for (let i = 0; i < allPhrases.length; i += batchSize) {
      const batch = allPhrases.slice(i, i + batchSize)
      await Promise.all(
        batch.map(phrase => 
          this.synthesizeSpeech(phrase).catch(error => 
            console.warn(`Failed to preload "${phrase}":`, error)
          )
        )
      )
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  // Clean old cache entries
  cleanCache(): void {
    const now = Date.now()
    const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > maxAge) {
        this.cache.delete(key)
      }
    }
    
    this.saveCacheToStorage()
  }

  // Get cache statistics
  getCacheStats(): { size: number; oldestEntry: number; newestEntry: number } {
    const timestamps = Array.from(this.cache.values()).map(v => v.timestamp)
    return {
      size: this.cache.size,
      oldestEntry: Math.min(...timestamps) || 0,
      newestEntry: Math.max(...timestamps) || 0
    }
  }
}

// Export singleton instance
export const googleTTS = new GoogleTTSService()