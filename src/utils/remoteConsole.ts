// Remote console system for iOS debugging without Mac

import { deviceInfo } from './deviceDetection'

interface LogEntry {
  timestamp: number
  level: 'log' | 'warn' | 'error' | 'info'
  message: string
  data?: any
  device: string
}

class RemoteConsole {
  private isEnabled = true
  
  constructor() {
    const disableConsole = window.location.search.includes('disable-console=true')
    
    // Enable by default on all devices, but allow disabling via URL parameter
    this.isEnabled = !disableConsole
    
    if (this.isEnabled) {      
      this.interceptConsole()
      this.setupErrorHandling()
      this.logDeviceInfo()
    }
  }
  
  private interceptConsole() {
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info
    }
    
    // Override console methods
    console.log = (...args) => {
      originalConsole.log(...args)
      this.addLog('log', this.formatMessage(args))
    }
    
    console.warn = (...args) => {
      originalConsole.warn(...args)
      this.addLog('warn', this.formatMessage(args))
    }
    
    console.error = (...args) => {
      originalConsole.error(...args)
      this.addLog('error', this.formatMessage(args))
    }
    
    console.info = (...args) => {
      originalConsole.info(...args)
      this.addLog('info', this.formatMessage(args))
    }
  }
  
  private setupErrorHandling() {
    // Catch unhandled errors
    window.addEventListener('error', (event) => {
      this.addLog('error', `Unhandled Error: ${event.message}`, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      })
    })
    
    // Catch unhandled promise rejections (common with audio on iOS)
    window.addEventListener('unhandledrejection', (event) => {
      this.addLog('error', `Unhandled Promise Rejection: ${event.reason}`, {
        reason: event.reason,
        promise: event.promise
      })
    })
  }
  
  private formatMessage(args: any[]): string {
    return args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2)
        } catch {
          return String(arg)
        }
      }
      return String(arg)
    }).join(' ')
  }
  
  private addLog(level: LogEntry['level'], message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      data,
      device: this.getDeviceString()
    }
    
    // Send directly to API - keep it simple
    this.sendToBackend(entry)
    
    // Show critical errors on screen for iOS
    if (level === 'error' && deviceInfo.isIOS) {
      this.showErrorToast(message)
    }
  }
  
  private getDeviceString(): string {
    const { isIOS, isIPad, isIPhone, version } = deviceInfo
    if (isIPad) return `iPad iOS ${version || 'Unknown'}`
    if (isIPhone) return `iPhone iOS ${version || 'Unknown'}`
    if (isIOS) return `iOS ${version || 'Unknown'}`
    return `${navigator.platform} - ${navigator.userAgent.split(' ')[0]}`
  }
  
  private showErrorToast(message: string) {
    // Create a temporary error toast for iOS users
    const toast = document.createElement('div')
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      right: 20px;
      background: #ef4444;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      word-wrap: break-word;
    `
    
    toast.textContent = `🚨 Error: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`
    
    document.body.appendChild(toast)
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast)
      }
    }, 5000)
    
    // Allow manual dismiss by tapping
    toast.addEventListener('touchend', () => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast)
      }
    })
  }
  
  private sendToBackend(entry: LogEntry) {
    // Send directly to API - keep it simple
    const requestBody = {
      level: entry.level,
      message: entry.message,
      data: entry.data,
      device: entry.device,
      url: window.location.href,
      sessionId: this.getSessionId(),
      timestamp: new Date(entry.timestamp).toISOString()
    }
    
    fetch('/api/log-error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    }).catch(async (error) => {
      // Enhanced error logging for debugging - but only if console exists
      try {
        const originalConsole = window.console?.error || (() => {})
        
        // Try to get more info about the fetch error
        if (error && typeof error === 'object') {
          const errorInfo = {
            requestUrl: '/api/log-error',
            requestMethod: 'POST',
            requestBody: {
              ...requestBody,
              message: requestBody.message.length > 200 ? 
                `${requestBody.message.substring(0, 200)}...` : 
                requestBody.message
            },
            errorType: error.constructor?.name || 'Unknown',
            errorMessage: error.message || error.toString(),
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            currentUrl: window.location.href
          }
          
          originalConsole('❌ Remote Console API failed:', errorInfo)
        }
      } catch (loggingError) {
        // If even this fails, give up silently to prevent loops
      }
    })
  }
  
  
  private getSessionId(): string {
    // Simple session ID generation for tracking user sessions
    let sessionId = sessionStorage.getItem('børnelæring-session-id')
    if (!sessionId) {
      sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      sessionStorage.setItem('børnelæring-session-id', sessionId)
    }
    return sessionId
  }
  
  private logDeviceInfo() {
    this.addLog('info', '🔍 Device Info', deviceInfo)
  }
  
  // Public methods for debugging
  public clearLogs(): void {
    // Clear logs via API
    fetch('/api/log-error', { method: 'DELETE' }).catch(() => {})
  }
  
  // Enable/disable console
  public enable(): void {
    this.isEnabled = true
  }
  
  public disable(): void {
    this.isEnabled = false
  }
  
  public isActive(): boolean {
    return this.isEnabled
  }
}

// Global instance
export const remoteConsole = new RemoteConsole()

// Utility function to log audio-specific issues
export const logAudioIssue = (context: string, error: any, additionalData?: any) => {
  console.error(`🎵 Audio Issue [${context}]:`, error, additionalData)
}

// Utility function to log iOS-specific issues
export const logIOSIssue = (context: string, issue: string, data?: any) => {
  if (deviceInfo.isIOS) {
    console.warn(`🍎 iOS Issue [${context}]: ${issue}`, data)
  }
}

// Export logs for debugging (can be called from browser console)
declare global {
  interface Window {
    clearLogs: () => void
    showLogs: () => void
  }
}

// Make debugging functions available globally
window.clearLogs = () => remoteConsole.clearLogs()
window.showLogs = () => {
  console.log('📋 Logs are stored in API - visit the admin dashboard to view them')
}