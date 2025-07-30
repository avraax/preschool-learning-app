// Centralized entry audio manager that survives component unmounting
// This ensures entry audio plays even if components mount/unmount rapidly

import { audioManager } from './audio'
import { GAME_WELCOME_MESSAGES } from '../hooks/useGameEntryAudio'

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
    console.log(`🎵 EntryAudioManager: Schedule request for "${gameType}" with ${delay}ms delay`)
    
    // Check if already played or playing
    if (playedGames.has(gameType)) {
      console.log(`🎵 EntryAudioManager: "${gameType}" already played, skipping`)
      return
    }
    
    if (playingGames.has(gameType)) {
      console.log(`🎵 EntryAudioManager: "${gameType}" currently playing, skipping`)
      return
    }
    
    // Check if already scheduled
    if (pendingTimeouts.has(gameType)) {
      console.log(`🎵 EntryAudioManager: "${gameType}" already scheduled, skipping duplicate`)
      return
    }
    
    // Schedule the audio
    console.log(`🎵 EntryAudioManager: Creating timeout for "${gameType}"`)
    const timeoutId = setTimeout(() => {
      console.log(`🎵 EntryAudioManager: *** TIMEOUT FIRED for "${gameType}" ***`)
      pendingTimeouts.delete(gameType)
      
      // Double-check not already played
      if (playedGames.has(gameType)) {
        console.log(`🎵 EntryAudioManager: "${gameType}" was played while waiting, skipping`)
        return
      }
      
      // Play the audio
      this.playEntryAudio(gameType)
    }, delay)
    
    pendingTimeouts.set(gameType, timeoutId)
    console.log(`🎵 EntryAudioManager: Timeout scheduled for "${gameType}" (id: ${timeoutId})`)
  },
  
  // Play entry audio immediately
  async playEntryAudio(gameType: string): Promise<void> {
    console.log(`🎵 EntryAudioManager: Playing entry audio for "${gameType}"`)
    
    // Cancel any pending timeout
    const pendingTimeout = pendingTimeouts.get(gameType)
    if (pendingTimeout) {
      console.log(`🎵 EntryAudioManager: Cancelling pending timeout for "${gameType}"`)
      clearTimeout(pendingTimeout)
      pendingTimeouts.delete(gameType)
    }
    
    // Mark as playing and played
    playingGames.add(gameType)
    playedGames.add(gameType)
    
    try {
      await audioManager.playGameWelcome(gameType)
      console.log(`🎵 EntryAudioManager: Successfully played entry audio for "${gameType}"`)
      
      // Call completion callbacks
      const callbacks = completionCallbacks.get(gameType) || []
      console.log(`🎵 EntryAudioManager: Calling ${callbacks.length} completion callbacks for "${gameType}"`)
      callbacks.forEach(callback => {
        try {
          callback()
        } catch (error) {
          console.error(`🎵 EntryAudioManager: Error in completion callback:`, error)
        }
      })
      completionCallbacks.delete(gameType)
    } catch (error) {
      console.error(`🎵 EntryAudioManager: Error playing entry audio for "${gameType}":`, error)
    } finally {
      playingGames.delete(gameType)
    }
  },
  
  // Check if entry audio has been played
  hasPlayed(gameType: string): boolean {
    return playedGames.has(gameType)
  },
  
  // Reset entry audio for a specific game
  resetGame(gameType: string): void {
    console.log(`🎵 EntryAudioManager: Resetting "${gameType}"`)
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
    console.log(`🎵 EntryAudioManager: Resetting all games`)
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
      console.log(`🎵 EntryAudioManager: Cancelling pending audio for "${gameType}"`)
      clearTimeout(pendingTimeout)
      pendingTimeouts.delete(gameType)
    }
  },
  
  // Register a callback to be called when entry audio completes
  onComplete(gameType: string, callback: () => void): void {
    console.log(`🎵 EntryAudioManager: Registering completion callback for "${gameType}"`)
    
    // If already played, call immediately but prevent duplicate executions
    if (playedGames.has(gameType) && !playingGames.has(gameType)) {
      const now = Date.now()
      const lastExecution = lastImmediateExecution.get(gameType) || 0
      const timeSinceLastExecution = now - lastExecution
      
      // Prevent duplicate executions within 100ms (React strict mode protection)
      if (timeSinceLastExecution < 100) {
        console.log(`🎵 EntryAudioManager: "${gameType}" immediate execution blocked - too soon after last execution (${timeSinceLastExecution}ms ago)`)
        return
      }
      
      console.log(`🎵 EntryAudioManager: "${gameType}" already played, calling callback immediately`)
      lastImmediateExecution.set(gameType, now)
      callback()
      return // Return here to prevent storing callback after immediate execution
    }
    
    // Clear existing callbacks and add new one (prevents React strict mode duplicates)
    console.log(`🎵 EntryAudioManager: Replacing any existing callbacks for "${gameType}"`)
    completionCallbacks.set(gameType, [callback])
  },

  // Remove completion callback (for cleanup)
  removeCallback(gameType: string, callback: () => void): void {
    console.log(`🎵 EntryAudioManager: Removing completion callback for "${gameType}"`)
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