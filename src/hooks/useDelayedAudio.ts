import { useRef, useEffect, useCallback } from 'react'

/**
 * Custom hook for managing delayed audio scheduling across games
 * Consolidates the common pattern of setTimeout + clearTimeout for audio
 * Provides automatic cleanup and cancellation management
 */
export const useDelayedAudio = () => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)

  /**
   * Schedule audio to play after a delay
   * Automatically cancels any previously scheduled audio
   */
  const scheduleAudio = useCallback(
    (audioFunction: () => Promise<any> | void, delay: number = 500) => {
      // Cancel any existing scheduled audio
      cancelScheduledAudio()

      // Schedule new audio with mount checking
      timeoutRef.current = setTimeout(async () => {
        try {
          // Only execute if component is still mounted
          if (mountedRef.current) {
            await audioFunction()
          } else {
            console.log('🎵 useDelayedAudio: Skipping scheduled audio on unmounted component')
          }
        } catch (error) {
          console.error('Error in scheduled audio:', error)
        } finally {
          timeoutRef.current = null
        }
      }, delay)
    },
    []
  )

  /**
   * Cancel any currently scheduled audio
   */
  const cancelScheduledAudio = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  /**
   * Check if audio is currently scheduled
   */
  const hasScheduledAudio = useCallback(() => {
    return timeoutRef.current !== null
  }, [])

  // Automatic cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    
    return () => {
      mountedRef.current = false
      cancelScheduledAudio()
      console.log('🎵 useDelayedAudio: Component unmounted, cleaned up scheduled audio')
    }
  }, [cancelScheduledAudio])

  return {
    scheduleAudio,
    cancelScheduledAudio,
    hasScheduledAudio
  }
}

export default useDelayedAudio