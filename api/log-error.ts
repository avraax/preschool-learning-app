import { VercelRequest, VercelResponse } from '@vercel/node'

interface ErrorLogEntry {
  // Enhanced error format
  id?: string
  timestamp: string
  level: 'error' | 'warn' | 'info' | 'log'
  message: string
  
  // Stack trace & source info
  stack?: string
  parsedStack?: Array<{
    fileName?: string
    functionName?: string
    lineNumber?: number
    columnNumber?: number
    source?: string
  }>
  fileName?: string
  lineNumber?: number
  columnNumber?: number
  functionName?: string
  
  // HTTP context
  request?: {
    url: string
    method: string
    headers: Record<string, string>
    body?: any
    queryParams?: Record<string, string>
    timestamp: number
  }
  response?: {
    status: number
    statusText: string
    headers: Record<string, string>
    body?: any
    duration?: number
  }
  
  // Environment context
  environment?: {
    userAgent: string
    device: string
    platform: string
    screenResolution: string
    viewport: string
    connectionType?: string
    language: string
    timezone: string
  }
  
  // User context
  user?: {
    sessionId: string
    userId?: string
    actions?: Array<{
      timestamp: number
      type: 'click' | 'navigation' | 'input' | 'keypress' | 'scroll'
      target?: string
      value?: string
      coordinates?: { x: number; y: number }
      route?: string
    }>
  }
  
  // App context
  app?: {
    version: string
    buildTime: string
    route: string
    component?: string
    props?: any
    state?: any
  }
  
  // Custom data and tags
  customData?: any
  tags?: string[]
  
  // Legacy fields for backward compatibility
  data?: any
  device: string
  userAgent: string
  url: string
  userId?: string
  sessionId?: string
}

// In-memory storage for Phase 1 (will persist during Vercel function lifecycle)
let errorLogs: ErrorLogEntry[] = []
const MAX_LOGS = 1000 // Keep last 1000 errors

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  try {
    if (req.method === 'POST') {
      // Log a new error with enhanced format support
      const errorEntry: ErrorLogEntry = {
        // Enhanced fields
        id: req.body.id || `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: req.body.timestamp || new Date().toISOString(),
        level: req.body.level || 'error',
        message: req.body.message || 'Unknown error',
        
        // Stack trace & source info
        stack: req.body.stack,
        parsedStack: req.body.parsedStack,
        fileName: req.body.fileName,
        lineNumber: req.body.lineNumber,
        columnNumber: req.body.columnNumber,
        functionName: req.body.functionName,
        
        // HTTP context
        request: req.body.request,
        response: req.body.response,
        
        // Environment context
        environment: req.body.environment,
        
        // User context
        user: req.body.user,
        
        // App context
        app: req.body.app,
        
        // Custom data and tags
        customData: req.body.customData,
        tags: req.body.tags,
        
        // Legacy fields for backward compatibility
        data: req.body.data,
        device: req.body.device || req.body.environment?.device || 'Unknown device',
        userAgent: req.headers['user-agent'] || req.body.environment?.userAgent || 'Unknown',
        url: req.body.url || 'Unknown URL',
        userId: req.body.userId || req.body.user?.userId,
        sessionId: req.body.sessionId || req.body.user?.sessionId
      }
      
      // Add to memory storage
      errorLogs.unshift(errorEntry)
      
      // Keep only the most recent logs
      if (errorLogs.length > MAX_LOGS) {
        errorLogs = errorLogs.slice(0, MAX_LOGS)
      }
      
      // Log to Vercel function logs as well (for backup)
      console.log(`[ERROR LOG] ${errorEntry.device} - ${errorEntry.message}`, {
        id: errorEntry.id,
        level: errorEntry.level,
        url: errorEntry.url,
        timestamp: errorEntry.timestamp,
        fileName: errorEntry.fileName,
        lineNumber: errorEntry.lineNumber,
        functionName: errorEntry.functionName,
        tags: errorEntry.tags,
        data: errorEntry.data || errorEntry.customData
      })
      
      return res.status(200).json({ 
        success: true, 
        message: 'Error logged successfully',
        logCount: errorLogs.length,
        errorId: errorEntry.id
      })
      
    } else if (req.method === 'GET') {
      // Retrieve error logs (admin dashboard)
      const { limit = 50, level, device, since } = req.query
      
      let filteredLogs = errorLogs
      
      // Filter by level if specified
      if (level && typeof level === 'string') {
        filteredLogs = filteredLogs.filter(log => log.level === level)
      }
      
      // Filter by device if specified
      if (device && typeof device === 'string') {
        filteredLogs = filteredLogs.filter(log => 
          log.device.toLowerCase().includes(device.toLowerCase())
        )
      }
      
      // Filter by timestamp if specified
      if (since && typeof since === 'string') {
        const sinceDate = new Date(since)
        filteredLogs = filteredLogs.filter(log => 
          new Date(log.timestamp) > sinceDate
        )
      }
      
      // Limit results
      const limitNum = parseInt(limit as string) || 50
      filteredLogs = filteredLogs.slice(0, limitNum)
      
      return res.status(200).json({
        logs: filteredLogs,
        totalCount: errorLogs.length,
        filteredCount: filteredLogs.length,
        stats: {
          errors: errorLogs.filter(l => l.level === 'error').length,
          warnings: errorLogs.filter(l => l.level === 'warn').length,
          info: errorLogs.filter(l => l.level === 'info').length,
          logs: errorLogs.filter(l => l.level === 'log').length
        }
      })
      
    } else if (req.method === 'DELETE') {
      // Clear all error logs
      const previousCount = errorLogs.length
      errorLogs = []
      
      console.log(`[ERROR LOG] Cleared ${previousCount} error logs`)
      
      return res.status(200).json({ 
        success: true, 
        message: `Cleared ${previousCount} error logs`,
        clearedCount: previousCount
      })
      
    } else {
      return res.status(405).json({ error: 'Method not allowed' })
    }
    
  } catch (error) {
    console.error('Error logging API error:', error)
    
    return res.status(500).json({ 
      error: 'Failed to process error log',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Export the configuration for Vercel
export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
}