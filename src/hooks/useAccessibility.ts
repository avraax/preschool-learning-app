import { useState, useEffect } from 'react'

interface AccessibilitySettings {
  prefersReducedMotion: boolean
  prefersHighContrast: boolean
  screenReaderMode: boolean
  largeText: boolean
}

export const useAccessibility = () => {
  const [settings, setSettings] = useState<AccessibilitySettings>({
    prefersReducedMotion: false,
    prefersHighContrast: false,
    screenReaderMode: false,
    largeText: false
  })

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = () => {
      setSettings(prev => ({
        ...prev,
        prefersReducedMotion: mediaQuery.matches
      }))
    }

    handleChange() // Set initial value
    mediaQuery.addListener(handleChange)

    // Check for high contrast preference
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)')
    const handleContrastChange = () => {
      setSettings(prev => ({
        ...prev,
        prefersHighContrast: highContrastQuery.matches
      }))
    }

    handleContrastChange()
    highContrastQuery.addListener(handleContrastChange)

    // Check for screen reader usage (basic detection)
    const checkScreenReader = () => {
      const hasAriaLive = document.querySelector('[aria-live]')
      const hasAriaLabel = document.querySelector('[aria-label]')
      setSettings(prev => ({
        ...prev,
        screenReaderMode: !!(hasAriaLive || hasAriaLabel)
      }))
    }

    // Check after a brief delay to allow DOM to settle
    setTimeout(checkScreenReader, 1000)

    return () => {
      mediaQuery.removeListener(handleChange)
      highContrastQuery.removeListener(handleContrastChange)
    }
  }, [])

  const getAnimationProps = () => {
    if (settings.prefersReducedMotion) {
      return {
        initial: {},
        animate: {},
        transition: { duration: 0 },
        whileHover: {},
        whileTap: {}
      }
    }
    return null // Use default animations
  }

  const getConfettiProps = () => {
    if (settings.prefersReducedMotion) {
      return {
        numberOfPieces: 20,
        gravity: 0.8,
        recycle: false
      }
    }
    return null // Use default settings
  }

  return {
    settings,
    getAnimationProps,
    getConfettiProps,
    shouldReduceAnimation: settings.prefersReducedMotion,
    shouldUseHighContrast: settings.prefersHighContrast,
    isScreenReaderMode: settings.screenReaderMode
  }
}

// Global accessibility styles
export const accessibilityStyles = {
  reducedMotion: {
    '*, *::before, *::after': {
      animationDuration: '0.01ms !important',
      animationIterationCount: '1 !important',
      transitionDuration: '0.01ms !important',
      scrollBehavior: 'auto !important'
    }
  },
  
  highContrast: {
    filter: 'contrast(150%)',
    '*': {
      textShadow: 'none !important',
      boxShadow: 'none !important'
    }
  },

  focusVisible: {
    '&:focus-visible': {
      outline: '3px solid #4285f4',
      outlineOffset: '2px',
      borderRadius: '4px'
    }
  },

  largeText: {
    fontSize: '1.2em'
  }
}

// Hook for managing focus and keyboard navigation
export const useFocusManagement = () => {
  const [currentFocus, setCurrentFocus] = useState<string | null>(null)

  const handleKeyDown = (event: KeyboardEvent, onActivate?: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onActivate?.()
    }
  }

  const setFocus = (elementId: string) => {
    setCurrentFocus(elementId)
    const element = document.getElementById(elementId)
    if (element) {
      element.focus()
    }
  }

  return {
    currentFocus,
    setFocus,
    handleKeyDown
  }
}

// ARIA announcements for screen readers
export const announceToScreenReader = (message: string) => {
  const announcement = document.createElement('div')
  announcement.setAttribute('aria-live', 'polite')
  announcement.setAttribute('aria-atomic', 'true')
  announcement.style.position = 'absolute'
  announcement.style.left = '-10000px'
  announcement.style.width = '1px'
  announcement.style.height = '1px'
  announcement.style.overflow = 'hidden'
  
  document.body.appendChild(announcement)
  announcement.textContent = message
  
  setTimeout(() => {
    document.body.removeChild(announcement)
  }, 1000)
}

// Performance optimization hook
export const usePerformanceOptimization = () => {
  const [isLowPerformance, setIsLowPerformance] = useState(false)

  useEffect(() => {
    // Check device capabilities
    const checkPerformance = () => {
      // Check for hardware acceleration
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      const hasWebGL = !!gl

      // Check memory (if available)
      const memory = (navigator as any).deviceMemory
      const hasLowMemory = memory && memory < 4

      // Check connection speed
      const connection = (navigator as any).connection
      const hasSlowConnection = connection && (
        connection.effectiveType === 'slow-2g' || 
        connection.effectiveType === '2g'
      )

      setIsLowPerformance(!hasWebGL || hasLowMemory || hasSlowConnection)
    }

    checkPerformance()
  }, [])

  const getOptimizedSettings = () => {
    if (isLowPerformance) {
      return {
        animationDuration: 0.2,
        particleCount: 50,
        enableShadows: false,
        enableComplexAnimations: false
      }
    }
    
    return {
      animationDuration: 0.5,
      particleCount: 150,
      enableShadows: true,
      enableComplexAnimations: true
    }
  }

  return {
    isLowPerformance,
    getOptimizedSettings
  }
}