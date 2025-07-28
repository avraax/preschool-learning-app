import { useEffect } from 'react'

/**
 * Hook to handle dynamic viewport height on iOS devices
 * Fixes the issue where 100vh doesn't account for browser UI elements
 */
export const useViewportHeight = () => {
  useEffect(() => {
    // Function to set the viewport height
    const setViewportHeight = () => {
      // Get the actual viewport height
      const vh = window.innerHeight * 0.01
      
      // Set the custom property on document root
      document.documentElement.style.setProperty('--vh', `${vh}px`)
      
      // Also set a full viewport height property
      document.documentElement.style.setProperty('--full-vh', `${window.innerHeight}px`)
      
      // Log for debugging on iOS
      if (window.navigator.userAgent.match(/iPad|iPhone|iPod/)) {
        console.log(`Viewport height set: ${vh}px (${window.innerHeight}px total)`)
      }
    }

    // Set initial height
    setViewportHeight()

    // Update on resize
    window.addEventListener('resize', setViewportHeight)
    
    // Update on orientation change (important for iOS)
    window.addEventListener('orientationchange', setViewportHeight)
    
    // Update when the viewport changes (iOS Safari specific)
    if ('visualViewport' in window) {
      window.visualViewport?.addEventListener('resize', setViewportHeight)
      window.visualViewport?.addEventListener('scroll', setViewportHeight)
    }

    // Cleanup
    return () => {
      window.removeEventListener('resize', setViewportHeight)
      window.removeEventListener('orientationchange', setViewportHeight)
      if ('visualViewport' in window) {
        window.visualViewport?.removeEventListener('resize', setViewportHeight)
        window.visualViewport?.removeEventListener('scroll', setViewportHeight)
      }
    }
  }, [])
}