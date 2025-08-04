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

// Import the existing error logs from the main log-error endpoint
// This is a workaround to access the same in-memory storage
const getErrorLogs = (): ErrorLogEntry[] => {
  // Since Vercel functions don't share memory directly, this endpoint
  // will need to make an internal request to the main endpoint
  return []
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  try {
    // Parse query parameters for filtering
    const {
      format = 'json',
      level,
      device,
      since,
      limit = '1000',
      component,
      tag,
      search,
      includeStacks = 'false',
      minifyResponse = 'false'
    } = req.query
    
    // Make internal request to main log-error endpoint to get all logs
    const protocol = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers.host
    const baseUrl = `${protocol}://${host}`
    
    // Construct query parameters for the main endpoint
    const params = new URLSearchParams()
    params.append('limit', '1000') // Get maximum logs
    
    if (level && typeof level === 'string') {
      params.append('level', level)
    }
    
    if (device && typeof device === 'string') {
      params.append('device', device)
    }
    
    if (since && typeof since === 'string') {
      params.append('since', since)
    }
    
    // Fetch logs from main endpoint
    const response = await fetch(`${baseUrl}/api/log-error?${params}`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch logs: ${response.status} ${response.statusText}`)
    }
    
    const logData = await response.json()
    let logs: ErrorLogEntry[] = logData.logs || []
    
    // Apply additional filtering
    if (component && typeof component === 'string') {
      logs = logs.filter(log => 
        log.app?.component?.toLowerCase().includes(component.toLowerCase()) ||
        log.fileName?.toLowerCase().includes(component.toLowerCase())
      )
    }
    
    if (tag && typeof tag === 'string') {
      logs = logs.filter(log => 
        log.tags?.includes(tag) ||
        log.message.toLowerCase().includes(tag.toLowerCase())
      )
    }
    
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase()
      logs = logs.filter(log => 
        log.message.toLowerCase().includes(searchLower) ||
        log.stack?.toLowerCase().includes(searchLower) ||
        log.fileName?.toLowerCase().includes(searchLower) ||
        log.functionName?.toLowerCase().includes(searchLower) ||
        JSON.stringify(log.data || log.customData || {}).toLowerCase().includes(searchLower)
      )
    }
    
    // Apply final limit
    const finalLimit = parseInt(limit as string) || 1000
    logs = logs.slice(0, finalLimit)
    
    // Optionally remove stack traces to reduce response size
    if (includeStacks === 'false') {
      logs = logs.map(log => ({
        ...log,
        stack: undefined,
        parsedStack: undefined
      }))
    }
    
    // Optionally minify the response
    if (minifyResponse === 'true') {
      logs = logs.map(log => ({
        id: log.id,
        timestamp: log.timestamp,
        level: log.level,
        message: log.message,
        device: log.device,
        url: log.url,
        fileName: log.fileName,
        lineNumber: log.lineNumber,
        functionName: log.functionName,
        data: log.data || log.customData
      }))
    }
    
    // Return different formats based on request
    switch (format) {
      case 'raw':
        // Raw JSON array (no wrapper)
        return res.status(200).json(logs)
        
      case 'csv':
        // CSV format for spreadsheet analysis
        const csvHeaders = ['timestamp', 'level', 'message', 'device', 'url', 'fileName', 'lineNumber', 'functionName']
        const csvRows = logs.map(log => [
          log.timestamp,
          log.level,
          `"${log.message.replace(/"/g, '""')}"`,
          log.device,
          log.url,
          log.fileName || '',
          log.lineNumber || '',
          log.functionName || ''
        ])
        
        const csvContent = [csvHeaders.join(','), ...csvRows.map(row => row.join(','))].join('\n')
        
        res.setHeader('Content-Type', 'text/csv')
        res.setHeader('Content-Disposition', `attachment; filename="error-logs-${new Date().toISOString().split('T')[0]}.csv"`)
        return res.status(200).send(csvContent)
        
      case 'text':
        // Human-readable text format
        const textContent = logs.map(log => {
          const lines = [
            `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`,
            `  Device: ${log.device}`,
            `  URL: ${log.url}`
          ]
          
          if (log.fileName) {
            lines.push(`  File: ${log.fileName}${log.lineNumber ? `:${log.lineNumber}` : ''}`)
          }
          
          if (log.functionName) {
            lines.push(`  Function: ${log.functionName}`)
          }
          
          if (log.data || log.customData) {
            lines.push(`  Data: ${JSON.stringify(log.data || log.customData)}`)
          }
          
          return lines.join('\n')
        }).join('\n\n')
        
        res.setHeader('Content-Type', 'text/plain')
        return res.status(200).send(textContent)
        
      default:
        // JSON format with metadata (default)
        return res.status(200).json({
          logs,
          metadata: {
            totalReturned: logs.length,
            totalAvailable: logData.totalCount || 0,
            filters: {
              level: level || 'all',
              device: device || 'all',
              since: since || 'none',
              component: component || 'all',
              tag: tag || 'all',
              search: search || 'none'
            },
            stats: logData.stats || {
              errors: 0,
              warnings: 0,
              info: 0,
              logs: 0
            },
            generatedAt: new Date().toISOString(),
            apiVersion: '1.0.0'
          }
        })
    }
    
  } catch (error) {
    console.error('Error in all-logs API:', error)
    
    return res.status(500).json({ 
      error: 'Failed to retrieve error logs',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
}

// Export the configuration for Vercel
export const config = {
  runtime: 'nodejs',
  maxDuration: 30, // Allow longer timeout for large log retrieval
}