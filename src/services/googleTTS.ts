// Google Cloud TTS client is used in the serverless API function
import { TTS_CONFIG } from '../config/tts-config'
import { isIOS } from '../utils/deviceDetection'
import { logAudioIssue, logIOSIssue } from '../utils/remoteConsole'
import { DANISH_PHRASES } from '../config/danish-phrases'

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

  // Circuit breaker for iOS TTS failures
  private failureCount = 0
  private lastFailureTime = 0
  private readonly MAX_FAILURES = 3
  private readonly FAILURE_RESET_TIME = 30000 // 30 seconds

  // Use shared configuration
  private readonly voiceConfigs = {
    primary: TTS_CONFIG.voice,
    backup: {
      languageCode: 'da-DK', 
      name: 'da-DK-Wavenet-F', // Same as primary for consistency (no other female Wavenet available)
      ssmlGender: 'FEMALE' as const
    },
    male: {
      languageCode: 'da-DK',
      name: 'da-DK-Wavenet-G', // Latest male Wavenet voice
      ssmlGender: 'MALE' as const
    }
  }

  // Use shared audio configuration
  private readonly audioConfig = TTS_CONFIG.audioConfig

  // Stop any currently playing audio
  stopCurrentAudio(): void {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause()
        this.currentAudio.currentTime = 0
        this.currentAudio.src = '' // Clear the source to stop loading
        this.currentAudio.load() // Reset the audio element
      } catch (error) {
      }
      this.currentAudio = null
    }
    
    // Also stop Web Speech API if it's running
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      try {
        window.speechSynthesis.cancel()
      } catch (error) {
      }
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
      // Don't automatically resume AudioContext on every interaction
      // Let audio playback methods handle AudioContext resumption when needed
    }
    
    // Track various user interactions - more comprehensive for iOS
    document.addEventListener('click', updateInteraction, { passive: true })
    document.addEventListener('touchstart', updateInteraction, { passive: true })
    document.addEventListener('touchend', updateInteraction, { passive: true })
    document.addEventListener('pointerdown', updateInteraction, { passive: true })
    document.addEventListener('pointerup', updateInteraction, { passive: true })
    document.addEventListener('keydown', updateInteraction, { passive: true })
    
    // Enhanced iOS PWA specific tracking - only update interaction time
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.lastUserInteraction = Date.now()
        // Remove proactive AudioContext resumption - let audio playback trigger it
      }
    })
    
    // Enhanced focus tracking for PWA - only update interaction time  
    window.addEventListener('focus', () => {
      this.lastUserInteraction = Date.now()
      // Remove proactive AudioContext resumption - let audio playback trigger it
    })
    
    // Track page load events as user interactions (for navigation)
    window.addEventListener('pageshow', () => {
      this.lastUserInteraction = Date.now()
      // Remove proactive AudioContext resumption - let audio playback trigger it
    })
    
    // iOS Safari PWA specific: Track app launch/resume events
    if (isIOS() && (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone)) {
      // PWA app state change tracking
      document.addEventListener('resume', () => {
        this.lastUserInteraction = Date.now()
        // Remove proactive resume - only resume when actually needed for audio playback
      })
      
      // Remove aggressive 5-second interval - was causing "AudioContext already running" conflicts
      // AudioContext will be resumed on-demand when audio is actually needed
    }
  }
  
  // Remove unused proactive AudioContext resumption method
  // This was causing "AudioContext already running" conflicts

  // Enhanced iOS Safari PWA compatible AudioContext resumption
  private async resumeAudioContext(): Promise<void> {
    const timeSinceInteraction = Date.now() - this.lastUserInteraction
    const hasDocumentFocus = document.hasFocus()
    const isDocumentVisible = !document.hidden
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone
    
    // Enhanced logging for iOS Safari PWA debugging
    const debugInfo = {
      timeSinceInteraction,
      hasDocumentFocus,
      isDocumentVisible,
      isPWA,
      isIOS: isIOS(),
      audioContextExists: !!this.audioContext,
      audioContextState: this.audioContext?.state || 'none'
    }
    
    logAudioIssue('AudioContext resume attempt', debugInfo)
    
    // More lenient check for PWA mode - PWAs need more permissive audio context handling
    const shouldTryResume = isPWA ? 
      (timeSinceInteraction < 30000 || hasDocumentFocus || isDocumentVisible) : // PWA: 30 second window
      (timeSinceInteraction < 10000 || hasDocumentFocus || isDocumentVisible)   // Browser: 10 second window
    
    if (!shouldTryResume) {
      logAudioIssue('AudioContext resume skipped - insufficient interaction', debugInfo)
      return
    }
    
    // Reuse existing AudioContext or create new one
    if (!this.audioContext) {
      try {
        // Check for existing global AudioContext first
        const globalAudioContext = (window as any).__globalAudioContext
        
        if (globalAudioContext && globalAudioContext.state !== 'closed') {
          this.audioContext = globalAudioContext
          logAudioIssue('AudioContext reused from global reference', { 
            state: this.audioContext?.state 
          })
        } else {
          // Create new AudioContext and store global reference
          this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
          ;(window as any).__globalAudioContext = this.audioContext
          
          logAudioIssue('AudioContext created and stored globally', { 
            state: this.audioContext.state, 
            sampleRate: this.audioContext.sampleRate 
          })
        }
      } catch (error) {
        logAudioIssue('Failed to create AudioContext', { 
          error: error instanceof Error ? error.message : error?.toString(),
          errorType: error instanceof Error ? error.constructor?.name : typeof error
        })
        return
      }
    }
    
    // Resume suspended AudioContext (with null check)
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume()
        logAudioIssue('AudioContext resumed successfully', { 
          newState: this.audioContext.state,
          isPWA,
          timeSinceInteraction
        })
      } catch (error) {
        logAudioIssue('AudioContext resume failed', { 
          error: error instanceof Error ? error.message : error?.toString(),
          state: this.audioContext.state,
          isPWA,
          timeSinceInteraction
        })
      }
    } else if (this.audioContext && this.audioContext.state === 'running') {
      // AudioContext is already running - no action needed, don't log as an issue
      return
    }
  }

  private async initializeService(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = new Promise((resolve) => {
      // For client-side implementation, we'll use a different approach
      // since we can't include service account credentials directly in browser
      resolve()
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
    
    // Circuit breaker: Check if we should temporarily stop trying
    const now = Date.now()
    if (this.failureCount >= this.MAX_FAILURES) {
      if (now - this.lastFailureTime < this.FAILURE_RESET_TIME) {
        throw new Error('TTS service temporarily disabled due to repeated failures')
      } else {
        // Reset circuit breaker after timeout
        this.failureCount = 0
      }
    }
    
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
        const errorResponseHeaders: { [key: string]: string } = {}
        
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
      
      // Reset failure count on success
      this.failureCount = 0
      
      return audioData

    } catch (error) {
      console.error('❌ Google TTS synthesis failed:', error)
      
      // Track failure for circuit breaker
      this.failureCount++
      this.lastFailureTime = Date.now()
      
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
    const { audioDebugSession } = await import('../utils/remoteConsole')
    audioDebugSession.addLog('GOOGLE_TTS_PLAY_AUDIO_FROM_DATA', {
      audioDataLength: base64AudioData.length
    })
    
    return new Promise((resolve, reject) => {
      try {
        audioDebugSession.addLog('GOOGLE_TTS_STOP_CURRENT_AUDIO', {})
        // Stop any currently playing audio first
        this.stopCurrentAudio()
        
        audioDebugSession.addLog('GOOGLE_TTS_CREATE_AUDIO_ELEMENT', {})
        const audio = this.createAudioFromData(base64AudioData)
        this.currentAudio = audio
        audioDebugSession.addLog('GOOGLE_TTS_AUDIO_ELEMENT_CREATED', {})
        
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
        
        let isCompleted = false
        
        // Fallback completion detection using timeupdate  
        const checkCompletion = () => {
          if (audio.currentTime > 0 && audio.currentTime >= audio.duration - 0.1) {
            clearTimeoutAndResolve()
          }
        }
        
        // Check completion via pause event
        const checkPauseCompletion = () => {
          // If paused at the end, consider it complete
          if (audio.currentTime > 0 && audio.currentTime >= audio.duration - 0.1) {
            clearTimeoutAndResolve()
          }
        }
        
        const clearTimeoutAndResolve = () => {
          if (isCompleted) return
          isCompleted = true
          clearTimeout(playbackTimeout)
          // Remove all event listeners to prevent memory leaks
          audio.removeEventListener('ended', clearTimeoutAndResolve)
          audio.removeEventListener('timeupdate', checkCompletion)
          audio.removeEventListener('pause', checkPauseCompletion)
          audio.removeEventListener('error', clearTimeoutAndRejectHandler)
          this.currentAudio = null
          resolve()
        }
        
        const clearTimeoutAndRejectHandler = (error: any) => {
          if (isCompleted) return
          isCompleted = true
          clearTimeout(playbackTimeout)  
          // Remove all event listeners to prevent memory leaks
          audio.removeEventListener('ended', clearTimeoutAndResolve)
          audio.removeEventListener('timeupdate', checkCompletion)
          audio.removeEventListener('pause', checkPauseCompletion)
          audio.removeEventListener('error', clearTimeoutAndRejectHandler)
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
        
        // Primary completion event
        audio.addEventListener('ended', () => {
          clearTimeoutAndResolve()
        })
        
        // Fallback completion detection using timeupdate
        audio.addEventListener('timeupdate', checkCompletion)
        
        // Additional completion events  
        audio.addEventListener('pause', checkPauseCompletion)
        
        audio.addEventListener('error', (error) => {
          // Check if this is due to navigation/interruption (expected error)
          const isNavigationError = isCompleted || 
            !audio.src || 
            audio.src === '' || 
            audio.readyState === 0 ||
            (audio.currentTime === 0 && isNaN(audio.duration))
          
          if (isNavigationError) {
            clearTimeoutAndRejectHandler(new Error('Audio interrupted by navigation'))
          } else {
            // Log unexpected audio errors
            logAudioIssue('Audio Playback Error', error, { 
              isIOS: isIOS(),
              audioDataLength: base64AudioData.length,
              userAgent: navigator.userAgent,
              currentTime: audio.currentTime,
              duration: audio.duration,
              readyState: audio.readyState,
              networkState: audio.networkState,
              src: audio.src ? 'present' : 'empty'
            })
            clearTimeoutAndRejectHandler(error)
          }
        })
        
        // Add load event to log when audio is ready
        audio.addEventListener('loadeddata', () => {
        })
        
        // iOS-specific play handling
        if (isIOS()) {
          // Check if we need user interaction - be more lenient for navigation scenarios
          const timeSinceInteraction = Date.now() - this.lastUserInteraction
          const hasRecentInteraction = timeSinceInteraction < 10000 // Increased from 3s to 10s
          const hasDocumentFocus = document.hasFocus()
          const isDocumentVisible = !document.hidden
          
          // More forgiving check: allow if any of these conditions are met
          const canPlayAudio = hasRecentInteraction || (hasDocumentFocus && isDocumentVisible)
          
          if (!canPlayAudio) {
            const errorMsg = `Need user interaction to play audio (${Math.round(timeSinceInteraction/1000)}s since last interaction, focus: ${hasDocumentFocus}, visible: ${isDocumentVisible}, context: ${this.audioContext?.state})`
            logAudioIssue('iOS Audio Permission', errorMsg, {
              timeSinceInteraction,
              hasRecentInteraction,
              hasDocumentFocus,
              isDocumentVisible,
              audioContext: this.audioContext?.state,
              documentHidden: document.hidden,
              pageVisibility: document.visibilityState
            })
            clearTimeoutAndRejectHandler(new Error('iOS audio requires recent user interaction'))
            return
          }
          
          audioDebugSession.addLog('GOOGLE_TTS_IOS_RESUME_CONTEXT', {})
          // Ensure audio context is running first
          this.resumeAudioContext().then(() => {
            audioDebugSession.addLog('GOOGLE_TTS_IOS_CONTEXT_RESUMED', {})
            // Add a longer delay for iOS to ensure context is ready
            setTimeout(() => {
              audioDebugSession.addLog('GOOGLE_TTS_IOS_CALLING_PLAY', {})
              audio.play().then(() => {
                audioDebugSession.addLog('GOOGLE_TTS_IOS_PLAY_SUCCESS', {})
              }).catch((playError) => {
                audioDebugSession.addLog('GOOGLE_TTS_IOS_PLAY_ERROR', {
                  errorName: playError.name,
                  errorMessage: playError.message,
                  timeSinceInteraction,
                  audioContextState: this.audioContext?.state,
                  audioSrcLength: audio.src.length
                })
                logAudioIssue('iOS Audio Play Error', playError, {
                  errorName: playError.name,
                  errorMessage: playError.message,
                  timeSinceInteraction,
                  audioContextState: this.audioContext?.state,
                  audioSrc: audio.src.substring(0, 50) + '...'
                })
                clearTimeoutAndRejectHandler(playError)
              })
            }, 100) // Longer delay for iOS
          }).catch((contextError) => {
            audioDebugSession.addLog('GOOGLE_TTS_IOS_CONTEXT_ERROR', {
              error: contextError instanceof Error ? contextError.message : contextError?.toString(),
              errorType: contextError instanceof Error ? contextError.constructor?.name : typeof contextError
            })
            logAudioIssue('iOS Audio Context Error', contextError)
            clearTimeoutAndRejectHandler(contextError)
          })
        } else {
          audioDebugSession.addLog('GOOGLE_TTS_NON_IOS_CALLING_PLAY', {})
          audio.play().then(() => {
            audioDebugSession.addLog('GOOGLE_TTS_NON_IOS_PLAY_SUCCESS', {})
          }).catch((error) => {
            audioDebugSession.addLog('GOOGLE_TTS_NON_IOS_PLAY_ERROR', {
              error: error instanceof Error ? error.message : error?.toString(),
              errorType: error instanceof Error ? error.constructor?.name : typeof error
            })
            clearTimeoutAndRejectHandler(error)
          })
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

      // Stop any existing speech synthesis first to prevent interference
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel()
        // Wait a bit for the cancellation to take effect
        setTimeout(() => this.startWebSpeech(text, resolve, reject), 100)
      } else {
        this.startWebSpeech(text, resolve, reject)
      }
    })
  }

  private startWebSpeech(text: string, resolve: () => void, reject: (error: Error) => void): void {
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

        // Add timeout for Web Speech API - longer for iOS
        const timeoutDuration = isIOS() ? 8000 : 5000
        const speechTimeout = setTimeout(() => {
          window.speechSynthesis.cancel()
          reject(new Error(`Web Speech API timeout after ${timeoutDuration/1000}s`))
        }, timeoutDuration)

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
  }

  // Synthesize and play in one step
  async synthesizeAndPlay(
    text: string, 
    voiceType: 'primary' | 'backup' | 'male' = 'primary',
    useSSML: boolean = true,
    customAudioConfig?: Partial<typeof TTS_CONFIG.audioConfig>
  ): Promise<void> {
    const { audioDebugSession } = await import('../utils/remoteConsole')
    audioDebugSession.addLog('GOOGLE_TTS_SYNTHESIZE_AND_PLAY', {
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      textLength: text.length,
      voiceType,
      useSSML,
      customAudioConfig,
      isIOS: isIOS()
    })
    
    // iOS-specific: Try Google TTS first, then fallback to Web Speech
    if (isIOS()) {
      try {
        audioDebugSession.addLog('GOOGLE_TTS_IOS_PRIMARY_ATTEMPT', {})
        const audioData = await this.synthesizeSpeech(text, voiceType, useSSML, customAudioConfig)
        audioDebugSession.addLog('GOOGLE_TTS_IOS_SYNTHESIS_SUCCESS', {
          audioDataLength: audioData.length
        })
        await this.playAudioFromData(audioData)
        audioDebugSession.addLog('GOOGLE_TTS_IOS_PLAYBACK_SUCCESS', {})
        return // Success with Google TTS
      } catch (googleTTSError) {
        // Check if this is a navigation interruption
        const isNavigationInterruption = googleTTSError instanceof Error && 
          (googleTTSError.message.includes('interrupted by navigation') || 
           googleTTSError.message.includes('interrupted by user'))
        
        if (isNavigationInterruption) {
          throw googleTTSError
        }
        
        // Enhanced error information for empty error objects
        const errorInfo = {
          text,
          voiceType,
          useSSML,
          errorMessage: googleTTSError instanceof Error ? googleTTSError.message : 'Unknown error',
          errorType: typeof googleTTSError,
          errorKeys: Object.keys(googleTTSError || {}),
          audioContextState: this.audioContext?.state,
          userAgent: navigator.userAgent
        }
        
        logAudioIssue('iOS Google TTS Failed', googleTTSError, errorInfo)
        
        // Add delay before fallback to prevent rapid failures
        await new Promise(resolve => setTimeout(resolve, 200))
        
        // Try Web Speech as fallback
        try {
          await this.fallbackToWebSpeech(text)
          return
        } catch (webSpeechError) {
          logAudioIssue('iOS Web Speech Also Failed', webSpeechError, { text, originalError: googleTTSError })
          throw new Error(`Both audio methods failed on iOS: ${googleTTSError}`)
        }
      }
    }
    
    try {
      audioDebugSession.addLog('GOOGLE_TTS_NON_IOS_ATTEMPT', {})
      const audioData = await this.synthesizeSpeech(text, voiceType, useSSML, customAudioConfig)
      audioDebugSession.addLog('GOOGLE_TTS_NON_IOS_SYNTHESIS_SUCCESS', {
        audioDataLength: audioData.length
      })
      await this.playAudioFromData(audioData)
      audioDebugSession.addLog('GOOGLE_TTS_NON_IOS_PLAYBACK_SUCCESS', {})
    } catch (error) {
      // Check if this is a navigation interruption (expected)
      const isNavigationInterruption = error instanceof Error && 
        (error.message.includes('interrupted by navigation') || 
         error.message.includes('interrupted by user'))
      
      if (isNavigationInterruption) {
        throw error // Re-throw but don't log as error
      }
      
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
    const commonPhrases = DANISH_PHRASES.preload

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