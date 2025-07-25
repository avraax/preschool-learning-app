// Enhanced error capture utilities for comprehensive debugging

export interface StackFrame {
  fileName?: string
  functionName?: string
  lineNumber?: number
  columnNumber?: number
  source?: string
  isNative?: boolean
  isConstructor?: boolean
}

export interface UserAction {
  timestamp: number
  type: 'click' | 'navigation' | 'input' | 'keypress' | 'scroll'
  target?: string
  value?: string
  coordinates?: { x: number; y: number }
  route?: string
}

export interface RequestInfo {
  url: string
  method: string
  headers: Record<string, string>
  body?: any
  queryParams?: Record<string, string>
  timestamp: number
}

export interface ResponseInfo {
  status: number
  statusText: string
  headers: Record<string, string>
  body?: any
  duration?: number
}

export interface EnhancedErrorLog {
  // Basic Info
  id: string
  timestamp: string
  level: 'error' | 'warn' | 'info' | 'log'
  message: string
  
  // Stack Trace & Source Info
  stack?: string
  parsedStack?: StackFrame[]
  fileName?: string
  lineNumber?: number
  columnNumber?: number
  functionName?: string
  
  // HTTP Context
  request?: RequestInfo
  response?: ResponseInfo
  
  // Environment Context
  environment: {
    userAgent: string
    device: string
    platform: string
    screenResolution: string
    viewport: string
    connectionType?: string
    language: string
    timezone: string
  }
  
  // User Context
  user: {
    sessionId: string
    userId?: string
    actions?: UserAction[]
  }
  
  // App Context
  app: {
    version: string
    buildTime: string
    route: string
    component?: string
    props?: any
    state?: any
  }
  
  // Custom Data
  customData?: any
  tags?: string[]
}

// Stack trace parser
export function parseStackTrace(stack: string): StackFrame[] {
  if (!stack) return []
  
  const frames: StackFrame[] = []
  const lines = stack.split('\n')
  
  for (const line of lines) {
    // Chrome/Edge format: "at functionName (file:line:column)"
    const chromeMatch = line.match(/^\s*at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)$/)
    if (chromeMatch) {
      frames.push({
        functionName: chromeMatch[1],
        fileName: chromeMatch[2],
        lineNumber: parseInt(chromeMatch[3]),
        columnNumber: parseInt(chromeMatch[4]),
        source: line.trim()
      })
      continue
    }
    
    // Chrome/Edge format without function: "at file:line:column"
    const chromeNoFuncMatch = line.match(/^\s*at\s+(.+?):(\d+):(\d+)$/)
    if (chromeNoFuncMatch) {
      frames.push({
        fileName: chromeNoFuncMatch[1],
        lineNumber: parseInt(chromeNoFuncMatch[2]),
        columnNumber: parseInt(chromeNoFuncMatch[3]),
        source: line.trim()
      })
      continue
    }
    
    // Firefox format: "functionName@file:line:column"
    const firefoxMatch = line.match(/^(.+?)@(.+?):(\d+):(\d+)$/)
    if (firefoxMatch) {
      frames.push({
        functionName: firefoxMatch[1],
        fileName: firefoxMatch[2],
        lineNumber: parseInt(firefoxMatch[3]),
        columnNumber: parseInt(firefoxMatch[4]),
        source: line.trim()
      })
      continue
    }
    
    // Safari format similar to Firefox but might have different patterns
    const safariMatch = line.match(/^(.+?)@(.+?):(\d+):?(\d+)?$/)
    if (safariMatch) {
      frames.push({
        functionName: safariMatch[1],
        fileName: safariMatch[2],
        lineNumber: parseInt(safariMatch[3]),
        columnNumber: safariMatch[4] ? parseInt(safariMatch[4]) : undefined,
        source: line.trim()
      })
    }
  }
  
  return frames
}

// Extract request info from fetch arguments
export function extractRequestInfo(args: any[]): RequestInfo {
  const [input, init] = args
  const url = typeof input === 'string' ? input : input.url
  const method = init?.method || 'GET'
  const headers: Record<string, string> = {}
  
  // Extract headers
  if (init?.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((value: string, key: string) => {
        headers[key] = value
      })
    } else if (Array.isArray(init.headers)) {
      init.headers.forEach(([key, value]: [string, string]) => {
        headers[key] = value
      })
    } else {
      Object.assign(headers, init.headers)
    }
  }
  
  // Extract query params
  const urlObj = new URL(url, window.location.origin)
  const queryParams: Record<string, string> = {}
  urlObj.searchParams.forEach((value, key) => {
    queryParams[key] = value
  })
  
  return {
    url: urlObj.href,
    method,
    headers,
    body: init?.body,
    queryParams,
    timestamp: Date.now()
  }
}

// Extract response info
export async function extractResponseInfo(
  response: Response, 
  startTime: number
): Promise<ResponseInfo> {
  const headers: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    headers[key] = value
  })
  
  let body
  try {
    const clone = response.clone()
    const contentType = response.headers.get('content-type') || ''
    
    if (contentType.includes('application/json')) {
      body = await clone.json()
    } else if (contentType.includes('text/')) {
      body = await clone.text()
    } else {
      body = `[Binary data: ${contentType}]`
    }
  } catch (e) {
    body = '[Unable to parse response body]'
  }
  
  return {
    status: response.status,
    statusText: response.statusText,
    headers,
    body,
    duration: Date.now() - startTime
  }
}

// Generate unique error ID
export function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Get environment info
export function getEnvironmentInfo() {
  return {
    userAgent: navigator.userAgent,
    device: getDeviceType(),
    platform: navigator.platform,
    screenResolution: `${screen.width}x${screen.height}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    connectionType: (navigator as any).connection?.effectiveType,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  }
}

// Get device type
function getDeviceType(): string {
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return 'iOS'
  if (/Android/.test(ua)) return 'Android'
  if (/Windows/.test(ua)) return 'Windows'
  if (/Mac/.test(ua)) return 'Mac'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Unknown'
}

// Track user actions
class UserActionTracker {
  private actions: UserAction[] = []
  private maxActions = 10
  
  constructor() {
    this.setupListeners()
  }
  
  private setupListeners() {
    // Click tracking
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      this.addAction({
        timestamp: Date.now(),
        type: 'click',
        target: this.getElementSelector(target),
        coordinates: { x: e.clientX, y: e.clientY }
      })
    })
    
    // Navigation tracking
    window.addEventListener('popstate', () => {
      this.addAction({
        timestamp: Date.now(),
        type: 'navigation',
        route: window.location.pathname
      })
    })
    
    // Input tracking (without values for privacy)
    document.addEventListener('input', (e) => {
      const target = e.target as HTMLElement
      this.addAction({
        timestamp: Date.now(),
        type: 'input',
        target: this.getElementSelector(target)
      })
    })
  }
  
  private getElementSelector(element: HTMLElement): string {
    if (element.id) return `#${element.id}`
    if (element.className) return `.${element.className.split(' ')[0]}`
    return element.tagName.toLowerCase()
  }
  
  private addAction(action: UserAction) {
    this.actions.push(action)
    if (this.actions.length > this.maxActions) {
      this.actions.shift()
    }
  }
  
  getActions(): UserAction[] {
    return [...this.actions]
  }
}

export const userActionTracker = new UserActionTracker()

// Network interceptor
export function setupNetworkInterceptor(onError: (error: EnhancedErrorLog) => void) {
  // Intercept fetch
  const originalFetch = window.fetch
  window.fetch = async function(...args) {
    const startTime = Date.now()
    const requestInfo = extractRequestInfo(args)
    
    try {
      const response = await originalFetch.apply(this, args)
      
      // Log failed requests
      if (!response.ok) {
        const responseInfo = await extractResponseInfo(response, startTime)
        
        onError({
          id: generateErrorId(),
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `HTTP ${response.status}: ${response.statusText}`,
          request: requestInfo,
          response: responseInfo,
          environment: getEnvironmentInfo(),
          user: {
            sessionId: getSessionId(),
            actions: userActionTracker.getActions()
          },
          app: {
            version: (window as any).__APP_VERSION__ || 'unknown',
            buildTime: (window as any).__BUILD_TIME__ || 'unknown',
            route: window.location.pathname
          },
          tags: ['network', 'http-error']
        })
      }
      
      return response
    } catch (error) {
      // Log network failures
      onError({
        id: generateErrorId(),
        timestamp: new Date().toISOString(),
        level: 'error',
        message: error instanceof Error ? error.message : 'Network request failed',
        stack: error instanceof Error ? error.stack : undefined,
        request: requestInfo,
        environment: getEnvironmentInfo(),
        user: {
          sessionId: getSessionId(),
          actions: userActionTracker.getActions()
        },
        app: {
          version: (window as any).__APP_VERSION__ || 'unknown',
          buildTime: (window as any).__BUILD_TIME__ || 'unknown',
          route: window.location.pathname
        },
        tags: ['network', 'fetch-error']
      })
      
      throw error
    }
  }
}

// Get session ID
function getSessionId(): string {
  let sessionId = sessionStorage.getItem('børnelæring-session-id')
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.setItem('børnelæring-session-id', sessionId)
  }
  return sessionId
}