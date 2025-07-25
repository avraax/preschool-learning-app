// Google Cloud TTS client is used in the serverless API function
import { TTS_CONFIG } from '../config/tts-config'
import { isIOS } from '../utils/deviceDetection'
import { logAudioIssue, logIOSIssue } from '../utils/remoteConsole'

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
  private currentAudio: HTMLAudioElement | null = null
  private audioContext: AudioContext | null = null
  private lastUserInteraction: number = Date.now()

  // Use shared configuration
  private readonly voiceConfigs = {
    primary: TTS_CONFIG.voice,
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

  // Use shared audio configuration
  private readonly audioConfig = TTS_CONFIG.audioConfig

  // Stop any currently playing audio
  stopCurrentAudio(): void {
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio.currentTime = 0
      this.currentAudio = null
    }
  }

  constructor() {
    this.initializeService()
    this.loadCacheFromStorage()
    this.setupUserInteractionTracking()
  }

  // Track user interactions for iOS audio requirements
  private setupUserInteractionTracking(): void {
    const updateInteraction = () => {
      this.lastUserInteraction = Date.now()
      this.resumeAudioContext()
    }
    
    // Track various user interactions
    document.addEventListener('click', updateInteraction, { passive: true })
    document.addEventListener('touchstart', updateInteraction, { passive: true })
    document.addEventListener('touchend', updateInteraction, { passive: true })
  }

  // Resume audio context for iOS
  private async resumeAudioContext(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume()
        logIOSIssue('Audio Context', 'Audio context resumed successfully')
      } catch (error) {
        logAudioIssue('Audio Context Resume', error)
      }
    }
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
    // Include audio config in cache key to bust cache when settings change
    const configKey = `${this.audioConfig.speakingRate}_${this.audioConfig.pitch}`
    return `${voice}_${configKey}_${text.toLowerCase().replace(/[^a-zæøå0-9]/gi, '_')}`
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
    useSSML: boolean = true,
    customAudioConfig?: Partial<typeof TTS_CONFIG.audioConfig>
  ): Promise<string> {
    await this.initializeService()
    
    const voice = this.voiceConfigs[voiceType]
    const inputText = useSSML ? this.createChildFriendlySSML(text) : text
    const finalAudioConfig = customAudioConfig ? { ...this.audioConfig, ...customAudioConfig } : this.audioConfig
    const cacheKey = `${text}_${voiceType}_${useSSML}_${finalAudioConfig.speakingRate}_${finalAudioConfig.pitch}`
    
    // Check cache first
    const cachedAudio = this.getCachedAudio(cacheKey, voice.name)
    if (cachedAudio) {
      return cachedAudio
    }

    try {
      // For client-side implementation, we'll call a server endpoint
      // This avoids exposing service account credentials in the browser
      const requestBody = {
        text: inputText,
        isSSML: useSSML,
        voice,
        audioConfig: customAudioConfig ? { ...this.audioConfig, ...customAudioConfig } : this.audioConfig
      }
      
      const requestHeaders = {
        'Content-Type': 'application/json'
      }
      
      // Synthesis request prepared
      
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        // Capture comprehensive error information
        let errorResponseBody = ''
        let errorResponseHeaders: { [key: string]: string } = {}
        
        try {
          errorResponseBody = await response.text()
        } catch (bodyError) {
          errorResponseBody = `Failed to read response body: ${bodyError}`
        }
        
        // Extract response headers
        response.headers.forEach((value, key) => {
          errorResponseHeaders[key] = value
        })
        
        const comprehensiveErrorInfo = {
          // Request information
          requestUrl: '/api/tts',
          requestMethod: 'POST',
          requestHeaders: requestHeaders,
          requestBody: {
            ...requestBody,
            text: inputText.length > 200 ? `${inputText.substring(0, 200)}...` : inputText // Truncate long text
          },
          
          // Response information
          responseStatus: response.status,
          responseStatusText: response.statusText,
          responseHeaders: errorResponseHeaders,
          responseBody: errorResponseBody,
          
          // Context information
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          currentUrl: window.location.href,
          isIOS: isIOS(),
          voiceType: voiceType,
          useSSML: useSSML
        }
        
        // Log to console for immediate debugging
        console.error('❌ TTS API failed with comprehensive error info:', comprehensiveErrorInfo)
        
        // Log to remote error tracking
        logAudioIssue('TTS HTTP Request Failed', `HTTP ${response.status}: ${response.statusText}`, comprehensiveErrorInfo)
        
        throw new Error(`TTS API failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const audioData = data.audioContent
      
      // Synthesis completed successfully

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
      try {
        // Stop any currently playing audio first
        this.stopCurrentAudio()
        
        const audio = this.createAudioFromData(base64AudioData)
        this.currentAudio = audio
        
        // Add timeout to prevent hanging (especially important for iOS)
        const timeoutDuration = isIOS() ? 5000 : 10000 // Shorter timeout for iOS
        const playbackTimeout = setTimeout(() => {
          logAudioIssue('Audio Playback Timeout', `Audio playback timed out after ${timeoutDuration/1000} seconds`, {
            isIOS: isIOS(),
            audioDataLength: base64AudioData.length
          })
          // Try to clean up the audio element
          if (this.currentAudio) {
            this.currentAudio.pause()
            this.currentAudio.src = ''
            this.currentAudio = null
          }
          reject(new Error('Audio playback timeout'))
        }, timeoutDuration)
        
        const clearTimeoutAndResolve = () => {
          clearTimeout(playbackTimeout)
          this.currentAudio = null
          resolve()
        }
        
        const clearTimeoutAndReject = (error: any) => {
          clearTimeout(playbackTimeout)
          this.currentAudio = null
          reject(error)
        }
        
        // iOS-specific event handling
        if (isIOS()) {
          // Use loadstart event for iOS 17.4+ compatibility
          audio.addEventListener('loadstart', () => {
            logIOSIssue('Audio Playback', 'Audio loading started (iOS)')
          })
          
          // Listen for canplaythrough as well
          audio.addEventListener('canplaythrough', () => {
            logIOSIssue('Audio Playback', 'Audio can play through (iOS)')
          })
        }
        
        audio.addEventListener('ended', () => {
          logIOSIssue('Audio Playback', 'Audio ended successfully')
          clearTimeoutAndResolve()
        })
        
        audio.addEventListener('error', (error) => {
          logAudioIssue('Audio Playback Error', error, { 
            isIOS: isIOS(),
            audioDataLength: base64AudioData.length,
            userAgent: navigator.userAgent
          })
          clearTimeoutAndReject(error)
        })
        
        // iOS-specific play handling
        if (isIOS()) {
          // Check if we need user interaction
          const timeSinceInteraction = Date.now() - this.lastUserInteraction
          if (timeSinceInteraction > 5000) { // More than 5 seconds since last interaction
            logAudioIssue('iOS Audio Permission', 'Need user interaction to play audio', {
              timeSinceInteraction,
              audioContext: this.audioContext?.state
            })
            // Try to resume audio context first
            this.resumeAudioContext().then(() => {
              // Add a small delay before playing on iOS
              setTimeout(() => {
                audio.play().catch((playError) => {
                  logAudioIssue('iOS Audio Play Error', playError, {
                    errorName: playError.name,
                    errorMessage: playError.message,
                    timeSinceInteraction,
                    audioContextState: this.audioContext?.state
                  })
                  clearTimeoutAndReject(playError)
                })
              }, 50)
            })
          } else {
            // Recent interaction, should be able to play
            setTimeout(() => {
              audio.play().catch((playError) => {
                logAudioIssue('iOS Audio Play Error', playError, {
                  errorName: playError.name,
                  errorMessage: playError.message
                })
                clearTimeoutAndReject(playError)
              })
            }, 50)
          }
        } else {
          audio.play().catch((error) => clearTimeoutAndReject(error))
        }
        
      } catch (setupError) {
        logAudioIssue('Audio Setup Error', setupError)
        reject(setupError)
      }
    })
  }

  // Fallback to Web Speech API for iOS when Google TTS fails
  private async fallbackToWebSpeech(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        logAudioIssue('Web Speech API', 'Speech synthesis not supported')
        reject(new Error('Speech synthesis not supported'))
        return
      }

      // Clean text for Web Speech (remove SSML tags)
      const cleanText = text.replace(/<[^>]*>/g, '')
      
      // iOS-specific: Ensure voices are loaded
      const loadVoicesAndSpeak = () => {
        const utterance = new SpeechSynthesisUtterance(cleanText)
        utterance.lang = 'da-DK'
        utterance.rate = 0.8
        utterance.pitch = 1.1

        // Try to find a Danish voice
        const voices = window.speechSynthesis.getVoices()
        const danishVoice = voices.find(voice => voice.lang.startsWith('da'))
        if (danishVoice) {
          utterance.voice = danishVoice
        }

        // Add timeout for Web Speech API
        const speechTimeout = setTimeout(() => {
          window.speechSynthesis.cancel()
          reject(new Error('Web Speech API timeout'))
        }, 5000)

        utterance.onend = () => {
          clearTimeout(speechTimeout)
          resolve()
        }
        utterance.onerror = (error) => {
          clearTimeout(speechTimeout)
          const errorInfo = {
            error: error.error || 'unknown',
            charIndex: error.charIndex,
            elapsedTime: error.elapsedTime,
            text: cleanText,
            voiceCount: window.speechSynthesis.getVoices().length,
            hasUserInteraction: document.hasFocus()
          }
          logAudioIssue('Web Speech API Error', errorInfo, { fullError: error })
          reject(new Error(`Web Speech failed: ${error.error || 'unknown error'}`))
        }

        // Stop any current speech
        window.speechSynthesis.cancel()
        
        // iOS fix: Small delay before speaking
        if (isIOS()) {
          setTimeout(() => {
            window.speechSynthesis.speak(utterance)
          }, 100)
        } else {
          window.speechSynthesis.speak(utterance)
        }
      }

      // iOS voices might not be loaded immediately
      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.addEventListener('voiceschanged', loadVoicesAndSpeak, { once: true })
        // Trigger voice loading
        window.speechSynthesis.getVoices()
      } else {
        loadVoicesAndSpeak()
      }
    })
  }

  // Synthesize and play in one step
  async synthesizeAndPlay(
    text: string, 
    voiceType: 'primary' | 'backup' | 'male' = 'primary',
    useSSML: boolean = true,
    customAudioConfig?: Partial<typeof TTS_CONFIG.audioConfig>
  ): Promise<void> {
    // iOS-specific: Try Google TTS first, then fallback to Web Speech
    // This is reversed from before as Web Speech seems to be failing
    if (isIOS()) {
      try {
        console.log('🎵 iOS detected, trying Google TTS first')
        const audioData = await this.synthesizeSpeech(text, voiceType, useSSML, customAudioConfig)
        await this.playAudioFromData(audioData)
        return // Success with Google TTS
      } catch (googleTTSError) {
        logAudioIssue('iOS Google TTS Failed', googleTTSError, { text })
        // Try Web Speech as fallback
        try {
          console.log('🔄 iOS: Falling back to Web Speech API')
          await this.fallbackToWebSpeech(text)
          return
        } catch (webSpeechError) {
          logAudioIssue('iOS Web Speech Also Failed', webSpeechError, { text })
          throw new Error(`Both audio methods failed on iOS: ${googleTTSError}`)
        }
      }
    }
    
    try {
      const audioData = await this.synthesizeSpeech(text, voiceType, useSSML, customAudioConfig)
      await this.playAudioFromData(audioData)
    } catch (error) {
      logAudioIssue('Google TTS Failed', error, { 
        text, 
        voiceType, 
        useSSML,
        isIOS: isIOS(),
        userAgent: navigator.userAgent 
      })
      
      // Fallback to Web Speech API for non-iOS or if iOS Web Speech also failed
      if (!isIOS()) {
        try {
          console.log('🔄 Falling back to Web Speech API')
          await this.fallbackToWebSpeech(text)
        } catch (fallbackError) {
          logAudioIssue('Both TTS methods failed', fallbackError, { 
            originalError: error,
            fallbackError: fallbackError 
          })
          throw new Error(`Audio synthesis failed: ${error}`)
        }
      } else {
        // iOS already tried Web Speech, so just throw
        throw new Error(`Audio synthesis failed on iOS: ${error}`)
      }
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