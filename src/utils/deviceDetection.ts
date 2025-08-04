// Device detection utilities for iOS/Safari compatibility

export interface DeviceInfo {
  isIOS: boolean
  isIPad: boolean
  isIPhone: boolean
  isSafari: boolean
  isMobile: boolean
  touchSupported: boolean
  version?: string
}

export function getDeviceInfo(): DeviceInfo {
  const userAgent = navigator.userAgent
  const platform = navigator.platform
  
  // iOS detection
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) || 
    (platform === 'MacIntel' && navigator.maxTouchPoints > 1) // iPad Pro with M1
  
  const isIPad = /iPad/.test(userAgent) || 
    (platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  
  const isIPhone = /iPhone/.test(userAgent)
  
  // Safari detection (including iOS Safari and desktop Safari)
  const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent) ||
    isIOS // iOS devices always use Safari engine
  
  // Mobile detection
  const isMobile = /Mobi|Android/i.test(userAgent) || isIOS
  
  // Touch support detection
  const touchSupported = 'ontouchstart' in window || 
    navigator.maxTouchPoints > 0 || 
    (navigator as any).msMaxTouchPoints > 0
  
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
    version
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

// Event type detection for audio triggers
export const getAudioTriggerEvent = () => {
  return supportsTouchEvents() ? 'touchend' : 'click'
}

// Debug logging for device info (will be used by remote console)
export const logDeviceInfo = () => {
}