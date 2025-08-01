// Centralized entry audio manager that survives component unmounting
// This ensures entry audio plays even if components mount/unmount rapidly

import { audioManager } from './audio'

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
    // For iOS devices, play immediately without delay to ensure faster response
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const actualDelay = isIOS ? 0 : delay
    
    console.log(`🎵 EntryAudioManager: Scheduling entry audio for "${gameType}" with ${actualDelay}ms delay (iOS: ${isIOS})`)
    
    // Check if already played or playing
    if (playedGames.has(gameType) || playingGames.has(gameType)) {
      console.log(`🎵 EntryAudioManager: Entry audio for "${gameType}" already played/playing, skipping`)
      return
    }
    
    // Check if already scheduled
    if (pendingTimeouts.has(gameType)) {
      console.log(`🎵 EntryAudioManager: Entry audio for "${gameType}" already scheduled, skipping`)
      return
    }
    
    // For iOS with 0 delay, play immediately
    if (actualDelay === 0) {
      console.log(`🎵 EntryAudioManager: Playing entry audio immediately for iOS`)
      this.playEntryAudio(gameType)
      return
    }
    
    // Schedule the audio for non-iOS devices
    const timeoutId = setTimeout(() => {
      console.log(`🎵 EntryAudioManager: Timeout fired for "${gameType}", attempting to play entry audio`)
      pendingTimeouts.delete(gameType)
      
      // Double-check not already played
      if (playedGames.has(gameType)) {
        console.log(`🎵 EntryAudioManager: Entry audio for "${gameType}" already played after timeout, skipping`)
        return
      }
      
      // Play the audio
      this.playEntryAudio(gameType)
    }, actualDelay)
    
    pendingTimeouts.set(gameType, timeoutId)
    console.log(`🎵 EntryAudioManager: Entry audio for "${gameType}" scheduled successfully`)
  },
  
  // Play entry audio immediately
  async playEntryAudio(gameType: string): Promise<void> {
    console.log(`🎵 EntryAudioManager: Starting playEntryAudio for "${gameType}"`)
    
    // Cancel any pending timeout
    const pendingTimeout = pendingTimeouts.get(gameType)
    if (pendingTimeout) {
      console.log(`🎵 EntryAudioManager: Clearing pending timeout for "${gameType}"`)
      clearTimeout(pendingTimeout)
      pendingTimeouts.delete(gameType)
    }
    
    // Mark as playing and played
    playingGames.add(gameType)
    playedGames.add(gameType)
    console.log(`🎵 EntryAudioManager: Marked "${gameType}" as playing and played`)
    
    try {
      console.log(`🎵 EntryAudioManager: Calling audioManager.playGameWelcome("${gameType}")`)
      await audioManager.playGameWelcome(gameType)
      console.log(`🎵 EntryAudioManager: Successfully completed playGameWelcome for "${gameType}"`)
      
      // Call completion callbacks
      const callbacks = completionCallbacks.get(gameType) || []
      console.log(`🎵 EntryAudioManager: Found ${callbacks.length} completion callbacks for "${gameType}"`)
      callbacks.forEach((callback, index) => {
        try {
          console.log(`🎵 EntryAudioManager: Calling completion callback ${index + 1}/${callbacks.length} for "${gameType}"`)
          callback()
        } catch (error) {
          console.error(`🎵 EntryAudioManager: Error in completion callback ${index + 1}:`, error)
        }
      })
      completionCallbacks.delete(gameType)
      console.log(`🎵 EntryAudioManager: All completion callbacks processed for "${gameType}"`)
    } catch (error) {
      console.error(`🎵 EntryAudioManager: Error playing entry audio for "${gameType}":`, error)
    } finally {
      playingGames.delete(gameType)
      console.log(`🎵 EntryAudioManager: Finished playEntryAudio for "${gameType}", removed from playing games`)
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
        console.log(`🎵 EntryAudioManager: Duplicate execution blocked for "${gameType}" (${timeSinceLastExecution}ms ago)`)
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