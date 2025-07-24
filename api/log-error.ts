import { VercelRequest, VercelResponse } from '@vercel/node'

interface ErrorLogEntry {
  timestamp: string
  level: 'error' | 'warn' | 'info' | 'log'
  message: string
  data?: any
  device: string
  userAgent: string
  url: string
  userId?: string // Optional: for user tracking
  sessionId?: string // Optional: for session tracking
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
      // Log a new error
      const errorEntry: ErrorLogEntry = {
        timestamp: new Date().toISOString(),
        level: req.body.level || 'error',
        message: req.body.message || 'Unknown error',
        data: req.body.data,
        device: req.body.device || 'Unknown device',
        userAgent: req.headers['user-agent'] || 'Unknown',
        url: req.body.url || 'Unknown URL',
        userId: req.body.userId,
        sessionId: req.body.sessionId
      }
      
      // Add to memory storage
      errorLogs.unshift(errorEntry)
      
      // Keep only the most recent logs
      if (errorLogs.length > MAX_LOGS) {
        errorLogs = errorLogs.slice(0, MAX_LOGS)
      }
      
      // Log to Vercel function logs as well (for backup)
      console.log(`[ERROR LOG] ${errorEntry.device} - ${errorEntry.message}`, {
        level: errorEntry.level,
        url: errorEntry.url,
        timestamp: errorEntry.timestamp,
        data: errorEntry.data
      })
      
      return res.status(200).json({ 
        success: true, 
        message: 'Error logged successfully',
        logCount: errorLogs.length
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