// Device detection utilities for iOS/Safari compatibility with enhanced iPad Pro and PWA detection

export interface DeviceInfo {
  isIOS: boolean
  isIPad: boolean
  isIPhone: boolean
  isSafari: boolean
  isMobile: boolean
  touchSupported: boolean
  version?: string
  // Enhanced PWA and iPad Pro detection
  isPWA: boolean
  isIPadPro: boolean
  isM1iPad: boolean
  displayMode: string
  standalone: boolean
  safariMode: 'browser' | 'pwa' | 'homescreen'
  audioContextSupported: boolean
  speechSynthesisSupported: boolean
}

export function getDeviceInfo(): DeviceInfo {
  const userAgent = navigator.userAgent
  const platform = navigator.platform
  
  // Enhanced iPad Pro detection with M1 Chip recognition
  const isM1iPad = platform === 'MacIntel' && navigator.maxTouchPoints > 1
  const isIPadTraditional = /iPad/.test(userAgent)
  const isIPad = isIPadTraditional || isM1iPad
  
  // Enhanced iPad Pro detection (newer models have higher screen resolution)
  const isIPadPro = isIPad && (
    // Screen resolution indicators for iPad Pro
    (window.screen && (
      (window.screen.width >= 1024 && window.screen.height >= 1366) || // 12.9" Pro
      (window.screen.width >= 834 && window.screen.height >= 1194) ||   // 11" Pro
      (window.screen.width >= 820 && window.screen.height >= 1180)      // 10.9" Air (similar to Pro)
    )) ||
    // M1 chip detection (likely iPad Pro)
    isM1iPad ||
    // User agent clues for iPad Pro
    /iPad.*OS 1[4-9]|iPad.*OS [2-9]\d/.test(userAgent) // iPad Pro typically runs newer iOS
  )
  
  // iOS detection
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) || isM1iPad
  const isIPhone = /iPhone/.test(userAgent)
  
  // Enhanced PWA detection
  const standalone = (window.navigator as any).standalone === true
  const displayMode = window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 
                     window.matchMedia('(display-mode: fullscreen)').matches ? 'fullscreen' :
                     window.matchMedia('(display-mode: minimal-ui)').matches ? 'minimal-ui' : 'browser'
  const isPWA = standalone || displayMode === 'standalone'
  
  // Safari mode detection
  let safariMode: 'browser' | 'pwa' | 'homescreen' = 'browser'
  if (isPWA || standalone) {
    safariMode = 'pwa'
  } else if (isIOS && window.innerHeight === window.screen.height) {
    // Full screen on iOS might indicate home screen web app
    safariMode = 'homescreen'
  }
  
  // Safari detection (including iOS Safari and desktop Safari)
  const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent) ||
    isIOS // iOS devices always use Safari engine
  
  // Mobile detection
  const isMobile = /Mobi|Android/i.test(userAgent) || isIOS
  
  // Touch support detection
  const touchSupported = 'ontouchstart' in window || 
    navigator.maxTouchPoints > 0 || 
    (navigator as any).msMaxTouchPoints > 0
  
  // Audio capability detection
  const audioContextSupported = !!(window as any).AudioContext || !!(window as any).webkitAudioContext
  const speechSynthesisSupported = !!window.speechSynthesis
  
  // iOS version extraction
  let version: string | undefined
  if (isIOS) {
    const match = userAgent.match(/OS (\d+)_?(\d+)?_?(\d+)?/)
    if (match) {
      version = `${match[1]}.${match[2] || 0}.${match[3] || 0}`
    }
  }
  
  return {
    isIOS,
    isIPad,
    isIPhone,
    isSafari,
    isMobile,
    touchSupported,
    version,
    // Enhanced fields
    isPWA,
    isIPadPro,
    isM1iPad,
    displayMode,
    standalone,
    safariMode,
    audioContextSupported,
    speechSynthesisSupported
  }
}

// Global device info instance
export const deviceInfo = getDeviceInfo()

// Utility functions
export const isIOS = () => deviceInfo.isIOS
export const isIPad = () => deviceInfo.isIPad
export const isIPhone = () => deviceInfo.isIPhone
export const isSafari = () => deviceInfo.isSafari
export const isMobile = () => deviceInfo.isMobile
export const supportsTouchEvents = () => deviceInfo.touchSupported

// Enhanced utility functions
export const isPWA = () => deviceInfo.isPWA
export const isIPadPro = () => deviceInfo.isIPadPro
export const isM1iPad = () => deviceInfo.isM1iPad
export const getSafariMode = () => deviceInfo.safariMode
export const supportsAudioContext = () => deviceInfo.audioContextSupported
export const supportsSpeechSynthesis = () => deviceInfo.speechSynthesisSupported

// Event type detection for audio triggers
export const getAudioTriggerEvent = () => {
  return supportsTouchEvents() ? 'touchend' : 'click'
}

// Enhanced debugging function with comprehensive device info
export const logDeviceInfo = () => {
  const info = getDeviceInfo()
  
  console.log('📱 Device Information:', {
    // Basic device info
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    isIOS: info.isIOS,
    isIPad: info.isIPad,
    isIPhone: info.isIPhone,
    isIPadPro: info.isIPadPro,
    isM1iPad: info.isM1iPad,
    
    // PWA and display info
    isPWA: info.isPWA,
    displayMode: info.displayMode,
    standalone: info.standalone,
    safariMode: info.safariMode,
    
    // Browser capabilities
    isSafari: info.isSafari,
    audioContextSupported: info.audioContextSupported,
    speechSynthesisSupported: info.speechSynthesisSupported,
    touchSupported: info.touchSupported,
    
    // Screen info
    screenWidth: window.screen?.width,
    screenHeight: window.screen?.height,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    
    // iOS version
    version: info.version,
    
    // Additional browser info
    maxTouchPoints: navigator.maxTouchPoints,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    
    // Audio specific checks
    speechSynthesisVoicesCount: window.speechSynthesis?.getVoices?.()?.length || 0,
    audioContextState: (() => {
      try {
        const ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)()
        const state = ctx.state
        ctx.close()
        return state
      } catch {
        return 'unavailable'
      }
    })()
  })
}

// iOS Safari PWA specific detection
export const getIOSSafariPWAInfo = () => {
  const info = getDeviceInfo()
  
  return {
    isIOSSafariPWA: info.isIOS && info.isPWA,
    isIOSSafariBrowser: info.isIOS && !info.isPWA,
    safariMode: info.safariMode,
    displayMode: info.displayMode,
    standalone: info.standalone,
    // Audio context behavior differs between PWA and browser
    audioContextBehavior: info.isPWA ? 'pwa-restricted' : 'browser-standard',
    // User interaction requirements
    userInteractionRequired: info.isIOS,
    audioPermissionStrategy: info.isPWA ? 'proactive-testing' : 'reactive-permission'
  }
}