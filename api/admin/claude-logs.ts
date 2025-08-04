import { VercelRequest, VercelResponse } from '@vercel/node'

interface SimpleLogEntry {
  id?: string
  timestamp: string
  level: 'error' | 'warn' | 'info' | 'log'
  message: string
  device: string
  url: string
  userAgent: string
  stack?: string
  fileName?: string
  lineNumber?: number
  functionName?: string
  data?: any
  sessionId?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  try {
    // Parse query parameters
    const {
      limit = '100',
      level,
      device,
      since,
      search,
      format = 'simple'
    } = req.query
    
    // Make internal request to main log-error endpoint
    const protocol = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers.host
    const baseUrl = `${protocol}://${host}`
    
    // Construct query parameters for the main endpoint
    const params = new URLSearchParams()
    params.append('limit', '1000') // Get all available logs
    
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
    let logs = logData.logs || []
    
    // Apply search filter if provided
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase()
      logs = logs.filter((log: any) => 
        log.message.toLowerCase().includes(searchLower) ||
        log.stack?.toLowerCase().includes(searchLower) ||
        log.fileName?.toLowerCase().includes(searchLower) ||
        log.functionName?.toLowerCase().includes(searchLower) ||
        JSON.stringify(log.data || log.customData || {}).toLowerCase().includes(searchLower)
      )
    }
    
    // Apply final limit
    const finalLimit = parseInt(limit as string) || 100
    logs = logs.slice(0, finalLimit)
    
    // Simplify the log entries for Claude's consumption
    const simplifiedLogs: SimpleLogEntry[] = logs.map((log: any) => ({
      id: log.id,
      timestamp: log.timestamp,
      level: log.level,
      message: log.message,
      device: log.device,
      url: log.url,
      userAgent: log.userAgent,
      stack: log.stack,
      fileName: log.fileName,
      lineNumber: log.lineNumber,
      functionName: log.functionName,
      data: log.data || log.customData,
      sessionId: log.sessionId || log.user?.sessionId
    }))
    
    // Return format based on request
    if (format === 'raw') {
      // Just the array of logs
      return res.status(200).json(simplifiedLogs)
    }
    
    if (format === 'markdown') {
      // Markdown format for easy reading
      const markdownContent = `# Error Logs Report
Generated: ${new Date().toISOString()}
Total Logs: ${simplifiedLogs.length}

${simplifiedLogs.map((log, index) => `
## Log ${index + 1} - ${log.level.toUpperCase()}

**Time:** ${log.timestamp}  
**Device:** ${log.device}  
**URL:** ${log.url}  
**Message:** ${log.message}

${log.fileName ? `**File:** ${log.fileName}${log.lineNumber ? `:${log.lineNumber}` : ''}  ` : ''}
${log.functionName ? `**Function:** ${log.functionName}  ` : ''}
${log.sessionId ? `**Session:** ${log.sessionId}  ` : ''}

${log.stack ? `**Stack Trace:**
\`\`\`
${log.stack}
\`\`\`
` : ''}

${log.data ? `**Additional Data:**
\`\`\`json
${JSON.stringify(log.data, null, 2)}
\`\`\`
` : ''}

---
`).join('')}`
      
      res.setHeader('Content-Type', 'text/markdown')
      return res.status(200).send(markdownContent)
    }
    
    // Default: JSON with metadata for Claude
    return res.status(200).json({
      summary: {
        totalLogs: simplifiedLogs.length,
        levels: {
          errors: simplifiedLogs.filter(l => l.level === 'error').length,
          warnings: simplifiedLogs.filter(l => l.level === 'warn').length,
          info: simplifiedLogs.filter(l => l.level === 'info').length,
          logs: simplifiedLogs.filter(l => l.level === 'log').length
        },
        devices: [...new Set(simplifiedLogs.map(l => l.device))],
        timeRange: simplifiedLogs.length > 0 ? {
          earliest: simplifiedLogs[simplifiedLogs.length - 1]?.timestamp,
          latest: simplifiedLogs[0]?.timestamp
        } : null,
        generatedAt: new Date().toISOString()
      },
      logs: simplifiedLogs,
      instructions: {
        description: "This endpoint provides simplified error logs for Claude AI analysis",
        usage: {
          "All logs": "GET /api/admin/claude-logs",
          "Only errors": "GET /api/admin/claude-logs?level=error",
          "Search": "GET /api/admin/claude-logs?search=audio",
          "iOS only": "GET /api/admin/claude-logs?device=ios",
          "Raw array": "GET /api/admin/claude-logs?format=raw",
          "Markdown": "GET /api/admin/claude-logs?format=markdown",
          "Limited": "GET /api/admin/claude-logs?limit=50"
        },
        queryParams: {
          limit: "Number of logs to return (default: 100)",
          level: "Filter by level: error, warn, info, log",
          device: "Filter by device type (partial match)",
          since: "ISO timestamp - only logs after this time",
          search: "Search in message, stack, filename, function, or data",
          format: "Response format: simple (default), raw, markdown"
        }
      }
    })
    
  } catch (error) {
    console.error('Error in claude-logs API:', error)
    
    return res.status(500).json({ 
      error: 'Failed to retrieve error logs for Claude',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      suggestion: "Try the main /api/log-error endpoint if this fails"
    })
  }
}

// Export the configuration for Vercel
export const config = {
  runtime: 'nodejs',
  maxDuration: 15,
}