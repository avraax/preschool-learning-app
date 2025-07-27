import { useEffect } from 'react'

/**
 * Hook to enhance native app feel on iOS/mobile devices
 * Handles viewport height, prevents zoom, and optimizes touch interactions
 */
export const useNativeAppFeel = () => {
  useEffect(() => {
    // Set CSS custom property for viewport height (iOS fix)
    const setVH = () => {
      const vh = window.innerHeight * 0.01
      document.documentElement.style.setProperty('--vh', `${vh}px`)
    }

    // Set initial viewport height
    setVH()

    // Update on resize (orientation change)
    const handleResize = () => {
      setVH()
    }

    // Prevent zoom on iOS when inputs are focused
    const preventZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault()
      }
    }

    // Prevent double-tap zoom
    let lastTouchEnd = 0
    const preventDoubleTapZoom = (e: TouchEvent) => {
      const now = (new Date()).getTime()
      if (now - lastTouchEnd <= 300) {
        e.preventDefault()
      }
      lastTouchEnd = now
    }

    // Add event listeners
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)
    document.addEventListener('touchstart', preventZoom, { passive: false })
    document.addEventListener('touchend', preventDoubleTapZoom, { passive: false })

    // iOS-specific enhancements
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      // Disable pull-to-refresh
      document.body.style.overscrollBehavior = 'none'
      
      // Prevent elastic bounce
      document.documentElement.style.overscrollBehavior = 'none'
      
      // Disable text size adjustment
      document.documentElement.style.webkitTextSizeAdjust = '100%'
    }

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
      document.removeEventListener('touchstart', preventZoom)
      document.removeEventListener('touchend', preventDoubleTapZoom)
    }
  }, [])

  // Return utility functions for components
  return {
    // Add native app styling to any element
    getNativeAppProps: () => ({
      style: {
        WebkitUserSelect: 'none' as const,
        userSelect: 'none' as const,
        WebkitTouchCallout: 'none' as const,
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation' as const,
      }
    }),

    // Get game-specific touch properties
    getGameProps: () => ({
      className: 'game-element',
      style: {
        touchAction: 'none' as const,
        WebkitUserDrag: 'none' as const,
        WebkitUserSelect: 'none' as const,
        userSelect: 'none' as const,
      }
    }),

    // Get interactive area properties (allows some gestures)
    getInteractiveProps: () => ({
      className: 'interactive-area',
      style: {
        touchAction: 'pan-x pan-down pinch-zoom' as const,
      }
    })
  }
}