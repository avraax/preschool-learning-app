// Centralized entry audio manager that survives component unmounting
// This ensures entry audio plays even if components mount/unmount rapidly

import { AudioController } from './AudioController'

// Create the centralized audio controller instance
const audioController = new AudioController()

// Track which games have played entry audio
const playedGames: Set<string> = new Set()

// Track pending timeouts
const pendingTimeouts: Map<string, NodeJS.Timeout> = new Map()

// Track if audio is currently being played for a game
const playingGames: Set<string> = new Set()

// Track completion callbacks
const completionCallbacks: Map<string, Array<() => void>> = new Map()

// Track last immediate execution time to prevent React strict mode duplicates
const lastImmediateExecution: Map<string, number> = new Map()

export const entryAudioManager = {
  // Schedule entry audio for a game
  scheduleEntryAudio(gameType: string, delay: number = 1000): void {
    const debugInfo = {
      gameType,
      delay,
      alreadyPlayed: playedGames.has(gameType),
      currentlyPlaying: playingGames.has(gameType),
      alreadyScheduled: pendingTimeouts.has(gameType),
      timestamp: new Date().toISOString(),
      // Additional iOS debugging
      isIOS: navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad'),
      isPWA: window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone,
      documentFocus: document.hasFocus(),
      documentVisible: !document.hidden,
      userAgent: navigator.userAgent.substring(0, 100),
      audioContextExists: typeof window.AudioContext !== 'undefined',
      speechSynthesisAvailable: typeof window.speechSynthesis !== 'undefined',
      timeSincePageLoad: performance.now()
    }
    
    console.log(`🎵 EntryAudioManager: Scheduling entry audio for "${gameType}" with ${delay}ms delay`, debugInfo)
    
    // Check if already played or playing
    if (playedGames.has(gameType) || playingGames.has(gameType)) {
      console.log(`🎵 EntryAudioManager: Skipping "${gameType}" - already played or playing`)
      return
    }
    
    // Check if already scheduled
    if (pendingTimeouts.has(gameType)) {
      console.log(`🎵 EntryAudioManager: Skipping "${gameType}" - already scheduled`)
      return
    }
    
    // Schedule the audio
    const timeoutId = setTimeout(() => {
      console.log(`🎵 EntryAudioManager: Timeout triggered for "${gameType}"`)
      pendingTimeouts.delete(gameType)
      
      // Double-check not already played
      if (playedGames.has(gameType)) {
        console.log(`🎵 EntryAudioManager: Skipping timeout execution for "${gameType}" - already played`)
        return
      }
      
      // Play the audio
      console.log(`🎵 EntryAudioManager: Executing playEntryAudio for "${gameType}"`)
      this.playEntryAudio(gameType)
    }, delay)
    
    pendingTimeouts.set(gameType, timeoutId)
    console.log(`🎵 EntryAudioManager: Successfully scheduled entry audio for "${gameType}"`)
  },
  
  // Play entry audio immediately
  async playEntryAudio(gameType: string): Promise<void> {
    console.log(`🎵 EntryAudioManager: Starting entry audio for "${gameType}"`, {
      gameType,
      playedGames: Array.from(playedGames),
      playingGames: Array.from(playingGames),
      pendingTimeouts: Array.from(pendingTimeouts.keys()),
      callbacksRegistered: completionCallbacks.get(gameType)?.length || 0,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      isIOS: navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad'),
      isPWA: window.matchMedia('(display-mode: standalone)').matches,
      documentFocus: document.hasFocus(),
      documentVisible: !document.hidden
    })
    
    // Cancel any pending timeout
    const pendingTimeout = pendingTimeouts.get(gameType)
    if (pendingTimeout) {
      clearTimeout(pendingTimeout)
      pendingTimeouts.delete(gameType)
      console.log(`🎵 EntryAudioManager: Cancelled pending timeout for "${gameType}"`)
    }
    
    // Mark as playing and played
    playingGames.add(gameType)
    playedGames.add(gameType)
    
    try {
      console.log(`🎵 EntryAudioManager: Calling AudioController.playGameWelcome for "${gameType}"`)
      await audioController.playGameWelcome(gameType)
      console.log(`🎵 EntryAudioManager: Successfully played entry audio for "${gameType}"`)
      
      // Call completion callbacks
      const callbacks = completionCallbacks.get(gameType) || []
      console.log(`🎵 EntryAudioManager: Calling ${callbacks.length} completion callbacks for "${gameType}"`)
      callbacks.forEach((callback, index) => {
        try {
          callback()
          console.log(`🎵 EntryAudioManager: Completion callback ${index + 1} succeeded for "${gameType}"`)
        } catch (error) {
          console.error(`🎵 EntryAudioManager: Error in completion callback ${index + 1} for "${gameType}":`, error)
        }
      })
      completionCallbacks.delete(gameType)
    } catch (error) {
      console.error(`🎵 EntryAudioManager: Error playing entry audio for "${gameType}":`, error, {
        gameType,
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : error?.toString(),
        errorStack: error instanceof Error ? error.stack : 'No stack',
        audioControllerAvailable: !!audioController,
        audioControllerMethods: audioController ? Object.getOwnPropertyNames(Object.getPrototypeOf(audioController)) : [],
        timestamp: new Date().toISOString()
      })
    } finally {
      playingGames.delete(gameType)
      console.log(`🎵 EntryAudioManager: Finished entry audio process for "${gameType}"`)
    }
  },
  
  // Check if entry audio has been played
  hasPlayed(gameType: string): boolean {
    return playedGames.has(gameType)
  },
  
  // Reset entry audio for a specific game
  resetGame(gameType: string): void {
    playedGames.delete(gameType)
    playingGames.delete(gameType)
    lastImmediateExecution.delete(gameType)
    
    const pendingTimeout = pendingTimeouts.get(gameType)
    if (pendingTimeout) {
      clearTimeout(pendingTimeout)
      pendingTimeouts.delete(gameType)
    }
  },
  
  // Reset all entry audio
  resetAll(): void {
    playedGames.clear()
    playingGames.clear()
    lastImmediateExecution.clear()
    
    // Clear all pending timeouts
    pendingTimeouts.forEach((timeout) => clearTimeout(timeout))
    pendingTimeouts.clear()
  },
  
  // Reset entry audio for games in a specific section when navigating away
  // This allows entry audio to play again when returning to sections
  resetSection(sectionPath: string): void {
    console.log(`🎵 EntryAudioManager: Resetting section "${sectionPath}"`)
    
    // Map routes to their associated game types
    const sectionGameTypes: { [key: string]: string[] } = {
      '/alphabet': ['alphabetlearning', 'alphabet'],
      '/math': ['counting', 'numbers', 'addition', 'comparison'],
      '/farver': ['colorhunt', 'colormixing'],
      '/learning/memory': ['memory']
    }
    
    // Find games to reset for this section
    const gamesToReset = sectionGameTypes[sectionPath] || []
    
    gamesToReset.forEach(gameType => {
      if (playedGames.has(gameType)) {
        console.log(`🎵 EntryAudioManager: Resetting game "${gameType}" for section "${sectionPath}"`)
        this.resetGame(gameType)
      }
    })
    
    console.log(`🎵 EntryAudioManager: Section reset complete for "${sectionPath}"`, {
      resetGames: gamesToReset,
      remainingPlayed: Array.from(playedGames)
    })
  },
  
  // Get current state (for debugging)
  getState(): { played: string[], playing: string[], pending: string[] } {
    return {
      played: Array.from(playedGames),
      playing: Array.from(playingGames),
      pending: Array.from(pendingTimeouts.keys())
    }
  },
  
  // Cancel pending audio for a game (used when navigating away)
  cancelPending(gameType: string): void {
    const pendingTimeout = pendingTimeouts.get(gameType)
    if (pendingTimeout) {
      clearTimeout(pendingTimeout)
      pendingTimeouts.delete(gameType)
    }
  },
  
  // Register a callback to be called when entry audio completes
  onComplete(gameType: string, callback: () => void): void {
    // If already played, call immediately but prevent duplicate executions
    if (playedGames.has(gameType) && !playingGames.has(gameType)) {
      const now = Date.now()
      const lastExecution = lastImmediateExecution.get(gameType) || 0
      const timeSinceLastExecution = now - lastExecution
      
      // Prevent duplicate executions within 100ms (React strict mode protection)
      if (timeSinceLastExecution < 100) {
        return
      }
      
      lastImmediateExecution.set(gameType, now)
      callback()
      return // Return here to prevent storing callback after immediate execution
    }
    
    // Clear existing callbacks and add new one (prevents React strict mode duplicates)
    completionCallbacks.set(gameType, [callback])
  },

  // Remove completion callback (for cleanup)
  removeCallback(gameType: string, callback: () => void): void {
    const callbacks = completionCallbacks.get(gameType) || []
    const filteredCallbacks = callbacks.filter(cb => cb !== callback)
    
    if (filteredCallbacks.length === 0) {
      completionCallbacks.delete(gameType)
    } else {
      completionCallbacks.set(gameType, filteredCallbacks)
    }
  }
}

// Expose for debugging in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).entryAudioManager = entryAudioManager
}