import { useState, useEffect, useCallback, useRef } from 'react'
import { BUILD_INFO } from '../config/version'

interface VersionInfo {
  buildTime: number
  version: string
  commitHash: string
}

interface UpdateStatus {
  updateAvailable: boolean
  currentVersion: VersionInfo
  latestVersion: VersionInfo | null
  isChecking: boolean
  error: string | null
  checkForUpdates: () => void
  dismissUpdate: () => void
  applyUpdate: () => void
}

export function useUpdateChecker(): UpdateStatus {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [latestVersion, setLatestVersion] = useState<VersionInfo | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDismissed, setIsDismissed] = useState(false)

  const currentVersion = BUILD_INFO

  // Create a stable reference to the check function
  const checkForUpdatesRef = useRef<() => Promise<void>>()

  const checkForUpdates = useCallback(async () => {
    // Prevent concurrent checks
    if (isChecking) return

    setIsChecking(true)
    setError(null)

    try {
      // Check if we're in development mode
      const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      
      if (isDev) {
        // For development, skip the check
        setIsChecking(false)
        return
      }

      const response = await fetch('/api/version', {
        method: 'GET',
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const remoteVersion: VersionInfo = await response.json()
      setLatestVersion(remoteVersion)

      // Compare build times - if remote is newer, show update
      const hasUpdate = remoteVersion.buildTime > currentVersion.buildTime
      setUpdateAvailable(hasUpdate && !isDismissed)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(`Update check failed: ${errorMessage}`)
      console.warn('🔄 Update check failed:', errorMessage)
    } finally {
      setIsChecking(false)
    }
  }, [currentVersion.buildTime, isDismissed])

  // Update the ref whenever checkForUpdates changes
  checkForUpdatesRef.current = checkForUpdates

  const dismissUpdate = useCallback(() => {
    setIsDismissed(true)
    setUpdateAvailable(false)
    
    // Store dismiss state in localStorage with current version
    try {
      localStorage.setItem('updateDismissed', JSON.stringify({
        buildTime: currentVersion.buildTime,
        dismissedAt: Date.now()
      }))
    } catch (e) {
      console.warn('Could not save dismiss state to localStorage:', e)
    }
  }, [currentVersion.buildTime])

  const applyUpdate = useCallback(() => {
    
    // Clear any cached data
    try {
      localStorage.removeItem('updateDismissed')
    } catch (e) {
      console.warn('Could not clear localStorage:', e)
    }

    // Force a hard reload to get the latest code
    window.location.reload()
  }, [])

  // Check for updates on mount and set up polling
  useEffect(() => {
    // Check if update was previously dismissed for this version
    try {
      const dismissedData = localStorage.getItem('updateDismissed')
      if (dismissedData) {
        const { buildTime } = JSON.parse(dismissedData)
        // If dismissed for current version, start as dismissed
        if (buildTime === currentVersion.buildTime) {
          setIsDismissed(true)
        }
      }
    } catch (e) {
      console.warn('Could not read dismiss state from localStorage:', e)
    }

    // Initial check - only once on mount
    checkForUpdatesRef.current?.()

    // Set up polling interval - check every 10 minutes
    const pollInterval = setInterval(() => {
      if (!document.hidden) {
        checkForUpdatesRef.current?.()
      }
    }, 10 * 60 * 1000) // 10 minutes instead of 5

    // Throttled visibility change handler
    let lastVisibilityCheck = 0
    const handleVisibilityChange = () => {
      const now = Date.now()
      // Only check if page became visible and it's been at least 2 minutes since last check
      if (!document.hidden && (now - lastVisibilityCheck) > 2 * 60 * 1000) {
        lastVisibilityCheck = now
        checkForUpdatesRef.current?.()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Cleanup
    return () => {
      clearInterval(pollInterval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, []) // Remove checkForUpdates from dependencies to prevent loop

  return {
    updateAvailable,
    currentVersion,
    latestVersion,
    isChecking,
    error,
    checkForUpdates,
    dismissUpdate,
    applyUpdate
  }
}