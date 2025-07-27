// Remote console system for iOS debugging without Mac

import { deviceInfo } from './deviceDetection'
import { 
  EnhancedErrorLog, 
  parseStackTrace, 
  generateErrorId, 
  getEnvironmentInfo, 
  userActionTracker,
  setupNetworkInterceptor
} from './errorCapture'

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
      this.setupNetworkInterception()
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
    // Catch unhandled errors with enhanced logging
    window.addEventListener('error', (event) => {
      this.addEnhancedError(
        `Unhandled Error: ${event.message}`,
        event.error,
        {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          eventType: 'unhandled-error'
        }
      )
    })
    
    // Catch unhandled promise rejections (common with audio on iOS)
    window.addEventListener('unhandledrejection', (event) => {
      this.addEnhancedError(
        `Unhandled Promise Rejection: ${event.reason}`,
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        {
          reason: event.reason,
          eventType: 'unhandled-rejection'
        }
      )
    })
  }
  
  private setupNetworkInterception() {
    // Set up network request/response logging
    setupNetworkInterceptor((enhancedError) => {
      this.sendEnhancedErrorToBackend(enhancedError)
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
  }
  
  private addEnhancedError(message: string, error?: Error, additionalData?: any) {
    const enhancedError: EnhancedErrorLog = {
      id: generateErrorId(),
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      stack: error?.stack,
      parsedStack: error?.stack ? parseStackTrace(error.stack) : undefined,
      fileName: error?.stack ? this.extractFileFromStack(error.stack) : undefined,
      lineNumber: this.extractLineFromStack(error?.stack),
      columnNumber: this.extractColumnFromStack(error?.stack),
      functionName: this.extractFunctionFromStack(error?.stack),
      environment: getEnvironmentInfo(),
      user: {
        sessionId: this.getSessionId(),
        actions: userActionTracker.getActions()
      },
      app: {
        version: (window as any).__APP_VERSION__ || 'unknown',
        buildTime: (window as any).__BUILD_TIME__ || 'unknown',
        route: window.location.pathname,
        component: this.getCurrentComponent(),
        state: this.getCurrentState()
      },
      customData: additionalData,
      tags: ['client-error', 'enhanced-capture']
    }
    
    this.sendEnhancedErrorToBackend(enhancedError)
  }
  
  private extractFileFromStack(stack?: string): string | undefined {
    if (!stack) return undefined
    const parsed = parseStackTrace(stack)
    return parsed[0]?.fileName
  }
  
  private extractLineFromStack(stack?: string): number | undefined {
    if (!stack) return undefined
    const parsed = parseStackTrace(stack)
    return parsed[0]?.lineNumber
  }
  
  private extractColumnFromStack(stack?: string): number | undefined {
    if (!stack) return undefined
    const parsed = parseStackTrace(stack)
    return parsed[0]?.columnNumber
  }
  
  private extractFunctionFromStack(stack?: string): string | undefined {
    if (!stack) return undefined
    const parsed = parseStackTrace(stack)
    return parsed[0]?.functionName
  }
  
  private getCurrentComponent(): string | undefined {
    // Try to extract React component name from current DOM
    const reactRoot = document.querySelector('#root')
    if (reactRoot) {
      const reactKey = Object.keys(reactRoot).find(key => key.startsWith('__reactInternalInstance'))
      if (reactKey) {
        try {
          const reactInstance = (reactRoot as any)[reactKey]
          return reactInstance?.type?.name || 'Unknown'
        } catch {
          return undefined
        }
      }
    }
    return undefined
  }
  
  private getCurrentState(): any {
    // Try to capture current URL params as basic state
    const params = new URLSearchParams(window.location.search)
    const state: any = {}
    params.forEach((value, key) => {
      state[key] = value
    })
    return Object.keys(state).length > 0 ? state : undefined
  }
  
  private getDeviceString(): string {
    const { isIOS, isIPad, isIPhone, version } = deviceInfo
    if (isIPad) return `iPad iOS ${version || 'Unknown'}`
    if (isIPhone) return `iPhone iOS ${version || 'Unknown'}`
    if (isIOS) return `iOS ${version || 'Unknown'}`
    return `${navigator.platform} - ${navigator.userAgent.split(' ')[0]}`
  }
  
  
  private sendToBackend(entry: LogEntry) {
    // Send directly to API - keep it simple (legacy format)
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
  
  private sendEnhancedErrorToBackend(enhancedError: EnhancedErrorLog) {
    fetch('/api/log-error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...enhancedError,
        // Legacy compatibility fields
        level: enhancedError.level,
        message: enhancedError.message,
        device: enhancedError.environment.device,
        url: window.location.href,
        sessionId: enhancedError.user.sessionId,
        data: enhancedError.customData
      })
    }).catch(async (error) => {
      try {
        const originalConsole = window.console?.error || (() => {})
        originalConsole('❌ Enhanced error logging failed:', {
          error: error.message,
          enhancedErrorId: enhancedError.id,
          timestamp: enhancedError.timestamp
        })
      } catch {
        // Silent fail to prevent logging loops
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

// Utility function to log audio-specific issues with enhanced capture
export const logAudioIssue = (context: string, error: any, additionalData?: any) => {
  console.error(`🎵 Audio Issue [${context}]:`, error, additionalData)
  
  // Also send enhanced error capture for audio issues
  if (remoteConsole.isActive()) {
    const audioError = error instanceof Error ? error : new Error(String(error))
    remoteConsole['addEnhancedError'](
      `Audio Issue [${context}]: ${audioError.message}`,
      audioError,
      {
        context,
        additionalData,
        category: 'audio-issue'
      }
    )
  }
}

// Utility function to log iOS-specific issues
export const logIOSIssue = (context: string, issue: string, data?: any) => {
  if (deviceInfo.isIOS) {
    console.warn(`🍎 iOS Issue [${context}]: ${issue}`, data)
  }
}

// Audio debugging session tracker
class AudioDebugSession {
  private sessionLogs: any[] = []
  private sessionId: string = ''
  private startTime: number = 0
  private isActive: boolean = false

  startSession(context: string = 'Audio Debug Session') {
    this.sessionId = `audio-debug-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
    this.startTime = Date.now()
    this.sessionLogs = []
    this.isActive = true
    
    this.addLog('SESSION_START', {
      context,
      timestamp: new Date().toISOString(),
      deviceInfo: deviceInfo,
      userAgent: navigator.userAgent,
      url: window.location.href
    })
  }

  addLog(type: string, data: any) {
    if (!this.isActive) return
    
    this.sessionLogs.push({
      timestamp: Date.now(),
      relativeTime: Date.now() - this.startTime,
      type,
      data
    })
  }

  isSessionActive(): boolean {
    return this.isActive
  }

  endSession(context: string = 'Audio Debug Complete') {
    if (!this.isActive) return
    
    this.addLog('SESSION_END', {
      context,
      totalDuration: Date.now() - this.startTime,
      totalLogs: this.sessionLogs.length
    })
    
    // Send comprehensive report to admin dashboard
    const comprehensiveReport = {
      sessionId: this.sessionId,
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date().toISOString(),
      totalDuration: Date.now() - this.startTime,
      device: deviceInfo,
      environment: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        audioContext: (window as any).AudioContext ? 'supported' : 'not supported',
        speechSynthesis: window.speechSynthesis ? 'supported' : 'not supported'
      },
      logs: this.sessionLogs,
      summary: this.generateSummary()
    }

    // Send to API as a special audio debug report
    fetch('/api/log-error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        level: 'info',
        message: `🔊 AUDIO DEBUG REPORT - ${context}`,
        device: `${deviceInfo.isIPad ? 'iPad' : deviceInfo.isIPhone ? 'iPhone' : 'Unknown'} iOS ${deviceInfo.version}`,
        url: window.location.href,
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
        data: comprehensiveReport,
        tags: ['audio-debug', 'comprehensive-report']
      })
    }).catch(error => {
      console.error('Failed to send audio debug report:', error)
    })

    this.isActive = false
    return comprehensiveReport
  }

  private generateSummary() {
    const errorLogs = this.sessionLogs.filter(log => log.type.includes('ERROR') || log.type.includes('FAILED'))
    const successLogs = this.sessionLogs.filter(log => log.type.includes('SUCCESS') || log.type.includes('COMPLETED'))
    const permissionLogs = this.sessionLogs.filter(log => log.type.includes('PERMISSION'))
    
    return {
      totalSteps: this.sessionLogs.length,
      errorCount: errorLogs.length,
      successCount: successLogs.length,
      permissionSteps: permissionLogs.length,
      firstError: errorLogs[0] || null,
      lastSuccess: successLogs[successLogs.length - 1] || null,
      keyEvents: this.sessionLogs.filter(log => 
        log.type.includes('PERMISSION') || 
        log.type.includes('PLAY') || 
        log.type.includes('ERROR') ||
        log.type.includes('SUCCESS')
      )
    }
  }
}

export const audioDebugSession = new AudioDebugSession()

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