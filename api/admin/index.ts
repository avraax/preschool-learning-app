import { VercelRequest, VercelResponse } from '@vercel/node'

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
  
  const protocol = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers.host
  const baseUrl = `${protocol}://${host}`
  
  return res.status(200).json({
    title: "Børnelæring Admin API Documentation",
    description: "API endpoints for error logging and administrative access",
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    
    endpoints: {
      
      // Main error logging endpoint
      "log-error": {
        url: `${baseUrl}/api/log-error`,
        methods: ["GET", "POST", "DELETE"],
        description: "Main error logging endpoint used by the application",
        usage: {
          "GET": "Retrieve error logs with filtering",
          "POST": "Log a new error entry",
          "DELETE": "Clear all error logs"
        },
        queryParams: {
          limit: "Number of logs to return (default: 50)",
          level: "Filter by level: error, warn, info, log",
          device: "Filter by device type (partial match)",
          since: "ISO timestamp - only logs after this time"
        },
        examples: [
          `${baseUrl}/api/log-error`,
          `${baseUrl}/api/log-error?level=error&limit=100`,
          `${baseUrl}/api/log-error?device=iphone&since=2024-01-01T00:00:00Z`
        ]
      },
      
      // Comprehensive admin endpoint
      "all-logs": {
        url: `${baseUrl}/api/admin/all-logs`,
        methods: ["GET"],
        description: "Advanced error log retrieval with multiple formats and enhanced filtering",
        queryParams: {
          format: "Response format: json (default), raw, csv, text",
          level: "Filter by level: error, warn, info, log",
          device: "Filter by device type (partial match)",
          since: "ISO timestamp - only logs after this time",
          limit: "Number of logs to return (default: 1000)",
          component: "Filter by component/filename (partial match)",
          tag: "Filter by tag or search in message",
          search: "Full-text search across all fields",
          includeStacks: "Include stack traces (default: false)",
          minifyResponse: "Minified response with essential fields only (default: false)"
        },
        examples: [
          `${baseUrl}/api/admin/all-logs`,
          `${baseUrl}/api/admin/all-logs?format=csv`,
          `${baseUrl}/api/admin/all-logs?search=audio&level=error`,
          `${baseUrl}/api/admin/all-logs?component=AlphabetGame&includeStacks=true`
        ]
      },
      
      // Claude-optimized endpoint
      "claude-logs": {
        url: `${baseUrl}/api/admin/claude-logs`,
        methods: ["GET"],
        description: "Simplified error logs specifically formatted for Claude AI analysis",
        features: [
          "Simplified log structure",
          "Multiple output formats (JSON, Markdown)",
          "Usage instructions included",
          "Search and filtering capabilities"
        ],
        queryParams: {
          limit: "Number of logs to return (default: 100)",
          level: "Filter by level: error, warn, info, log",
          device: "Filter by device type (partial match)",
          since: "ISO timestamp - only logs after this time",
          search: "Search in message, stack, filename, function, or data",
          format: "Response format: simple (default), raw, markdown"
        },
        examples: [
          `${baseUrl}/api/admin/claude-logs`,
          `${baseUrl}/api/admin/claude-logs?format=markdown`,
          `${baseUrl}/api/admin/claude-logs?level=error&search=audio`,
          `${baseUrl}/api/admin/claude-logs?device=ipad&format=raw&limit=50`
        ]
      }
    },
    
    quickLinks: {
      "Dashboard": `${baseUrl}/admin/errors`,
      "All errors (JSON)": `${baseUrl}/api/admin/claude-logs?level=error`,
      "Recent audio issues": `${baseUrl}/api/admin/claude-logs?search=audio&level=error`,
      "iPad issues": `${baseUrl}/api/admin/claude-logs?device=ipad`,
      "Markdown report": `${baseUrl}/api/admin/claude-logs?format=markdown&limit=20`,
      "CSV export": `${baseUrl}/api/admin/all-logs?format=csv`
    },
    
    notes: [
      "All endpoints support CORS for cross-origin requests",
      "Logs are stored in memory and will reset when the Vercel function restarts",
      "Maximum 1000 logs are kept in memory (newest first)",
      "Use the 'claude-logs' endpoint for AI analysis as it provides the most structured format"
    ]
  })
}

// Export the configuration for Vercel
export const config = {
  runtime: 'nodejs',
  maxDuration: 5,
}