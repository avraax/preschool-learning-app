import { useState, useEffect, useCallback } from 'react'
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

  const checkForUpdates = useCallback(async () => {
    if (isChecking) return

    setIsChecking(true)
    setError(null)

    try {
      // Check if we're in development mode
      const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      
      let apiUrl
      if (isDev) {
        // For development, check against a mock API or return false
        setIsChecking(false)
        return
      } else {
        // For production, use the version API
        apiUrl = '/api/version'
      }

      const response = await fetch(apiUrl, {
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
  }, [currentVersion, isDismissed, isChecking])

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
    console.log('🔄 Applying update - reloading page')
    
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

    // Initial check
    checkForUpdates()

    // Set up smart polling
    let pollInterval: NodeJS.Timeout
    let visibilityListener: () => void

    const startPolling = () => {
      // Check every 5 minutes when document is visible
      pollInterval = setInterval(() => {
        if (!document.hidden) {
          checkForUpdates()
        }
      }, 5 * 60 * 1000) // 5 minutes
    }

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Page became visible - check for updates immediately
        checkForUpdates()
      }
    }

    visibilityListener = handleVisibilityChange
    document.addEventListener('visibilitychange', visibilityListener)
    
    // Start polling
    startPolling()

    // Cleanup
    return () => {
      if (pollInterval) clearInterval(pollInterval)
      if (visibilityListener) {
        document.removeEventListener('visibilitychange', visibilityListener)
      }
    }
  }, [checkForUpdates, currentVersion.buildTime])

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