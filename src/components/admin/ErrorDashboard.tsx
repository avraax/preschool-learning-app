import React, { useState, useEffect } from 'react'
import { Box, Card, CardContent, Typography, Button, Select, MenuItem, FormControl, InputLabel, Chip, Alert, CircularProgress, Collapse, IconButton, Snackbar, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material'
import { Refresh, Download, ExpandMore, ExpandLess, ContentCopy, DeleteForever } from '@mui/icons-material'
import { useGameParams } from '../../utils/urlParams'

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

interface ErrorLogResponse {
  logs: ErrorLogEntry[]
  totalCount: number
  filteredCount: number
  stats: {
    errors: number
    warnings: number
    info: number
    logs: number
  }
}

const ErrorDashboard: React.FC = () => {
  const { getLogLevel, setLogLevel, getDevice, setDevice, getLimit, setLimit } = useGameParams()
  const [logs, setLogs] = useState<ErrorLogEntry[]>([])
  const [stats, setStats] = useState({ errors: 0, warnings: 0, info: 0, logs: 0 })
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set())
  const [copySuccess, setCopySuccess] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearLoading, setClearLoading] = useState(false)

  // Get filter values from URL params
  const levelFilter = getLogLevel() || 'all'
  const deviceFilter = getDevice() || 'all'
  const limit = getLimit()

  const fetchLogs = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Check if we're in localhost debug mode
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      const debugMode = window.location.search.includes('debug=true')
      
      if (isLocalhost && debugMode) {
        // Read from localStorage for development
        const stored = localStorage.getItem('dev-error-logs') || '[]'
        const allLogs = JSON.parse(stored) as ErrorLogEntry[]
        
        // Apply filters
        let filteredLogs = allLogs
        
        if (levelFilter !== 'all') {
          filteredLogs = filteredLogs.filter(log => log.level === levelFilter)
        }
        
        if (deviceFilter !== 'all') {
          filteredLogs = filteredLogs.filter(log => 
            log.device.toLowerCase().includes(deviceFilter.toLowerCase())
          )
        }
        
        // Apply limit
        filteredLogs = filteredLogs.slice(0, limit)
        
        // Calculate stats
        const stats = {
          errors: allLogs.filter(l => l.level === 'error').length,
          warnings: allLogs.filter(l => l.level === 'warn').length,  
          info: allLogs.filter(l => l.level === 'info').length,
          logs: allLogs.filter(l => l.level === 'log').length
        }
        
        setLogs(filteredLogs)
        setStats(stats)
        setTotalCount(allLogs.length)
        return
      }
      
      // Production API call
      const params = new URLSearchParams()
      params.append('limit', limit.toString())
      
      if (levelFilter !== 'all') {
        params.append('level', levelFilter)
      }
      
      if (deviceFilter !== 'all') {
        params.append('device', deviceFilter)
      }
      
      const requestUrl = `/api/log-error?${params}`
      const response = await fetch(requestUrl)
      
      if (!response.ok) {
        // Enhanced error logging for debugging
        let errorResponseBody = ''
        let errorResponseHeaders: { [key: string]: string } = {}
        
        try {
          errorResponseBody = await response.text()
        } catch (bodyError) {
          errorResponseBody = `Failed to read response body: ${bodyError}`
        }
        
        response.headers.forEach((value, key) => {
          errorResponseHeaders[key] = value
        })
        
        const errorInfo = {
          requestUrl,
          requestMethod: 'GET',
          responseStatus: response.status,
          responseStatusText: response.statusText,
          responseHeaders: errorResponseHeaders,
          responseBody: errorResponseBody,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          currentUrl: window.location.href
        }
        
        console.error('❌ Error Dashboard API failed:', errorInfo)
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data: ErrorLogResponse = await response.json()
      setLogs(data.logs)
      setStats(data.stats)
      setTotalCount(data.totalCount)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [levelFilter, deviceFilter, limit])

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'error'
      case 'warn': return 'warning' 
      case 'info': return 'info'
      case 'log': return 'default'
      default: return 'default'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('da-DK', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const exportLogs = () => {
    const dataStr = JSON.stringify(logs, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `error-logs-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Get unique devices for filter
  const uniqueDevices = [...new Set(logs.map(log => log.device.split(' ')[0]))].sort()

  const toggleLogExpansion = (index: number) => {
    const newExpanded = new Set(expandedLogs)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedLogs(newExpanded)
  }

  const clearAllLogs = async () => {
    setClearLoading(true)
    setError(null)
    
    try {
      // Check if we're in localhost debug mode
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      const debugMode = window.location.search.includes('debug=true')
      
      if (isLocalhost && debugMode) {
        // Clear localStorage for development
        localStorage.removeItem('dev-error-logs')
        await fetchLogs()
        setShowClearConfirm(false)
        return
      }
      
      // Production API call
      const response = await fetch('/api/log-error', {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        // Enhanced error logging for debugging
        let errorResponseBody = ''
        let errorResponseHeaders: { [key: string]: string } = {}
        
        try {
          errorResponseBody = await response.text()
        } catch (bodyError) {
          errorResponseBody = `Failed to read response body: ${bodyError}`
        }
        
        response.headers.forEach((value, key) => {
          errorResponseHeaders[key] = value
        })
        
        const errorInfo = {
          requestUrl: '/api/log-error',
          requestMethod: 'DELETE',
          responseStatus: response.status,
          responseStatusText: response.statusText,
          responseHeaders: errorResponseHeaders,
          responseBody: errorResponseBody,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          currentUrl: window.location.href
        }
        
        console.error('❌ Clear logs API failed:', errorInfo)
        throw new Error(`Failed to clear logs: ${response.status}`)
      }
      
      // Refresh the logs to show empty state
      await fetchLogs()
      setShowClearConfirm(false)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear logs')
    } finally {
      setClearLoading(false)
    }
  }

  const copyLogToClipboard = (log: ErrorLogEntry) => {
    const sections = []
    
    // Basic Info
    sections.push(`Error Log Details
==================`)
    sections.push(`ID: ${log.id || 'N/A'}`)
    sections.push(`Level: ${log.level.toUpperCase()}`)
    sections.push(`Time: ${formatTimestamp(log.timestamp)}`)
    sections.push(`Message: ${log.message}`)
    
    // Source Information
    if (log.fileName || log.functionName || log.lineNumber) {
      sections.push(`\nSource Location:\n------------------`)
      if (log.fileName) sections.push(`File: ${log.fileName}`)
      if (log.functionName) sections.push(`Function: ${log.functionName}`)
      if (log.lineNumber) sections.push(`Line: ${log.lineNumber}${log.columnNumber ? `:${log.columnNumber}` : ''}`)
    }
    
    // Stack Trace
    if (log.stack) {
      sections.push(`\nStack Trace:\n------------------`)
      sections.push(log.stack)
    }
    
    // HTTP Request/Response Context
    if (log.request || log.response) {
      sections.push(`\nHTTP Context:\n------------------`)
      if (log.request) {
        sections.push(`Request: ${log.request.method} ${log.request.url}`)
        if (Object.keys(log.request.queryParams || {}).length > 0) {
          sections.push(`Query Params: ${JSON.stringify(log.request.queryParams, null, 2)}`)
        }
        if (log.request.body) {
          sections.push(`Request Body: ${JSON.stringify(log.request.body, null, 2)}`)
        }
      }
      if (log.response) {
        sections.push(`Response: ${log.response.status} ${log.response.statusText}`)
        if (log.response.duration) sections.push(`Duration: ${log.response.duration}ms`)
        if (log.response.body) {
          sections.push(`Response Body: ${JSON.stringify(log.response.body, null, 2)}`)
        }
      }
    }
    
    // Environment Context
    if (log.environment) {
      sections.push(`\nEnvironment:\n------------------`)
      sections.push(`Device: ${log.environment.device}`)
      sections.push(`Platform: ${log.environment.platform}`)
      sections.push(`Screen: ${log.environment.screenResolution}`)
      sections.push(`Viewport: ${log.environment.viewport}`)
      sections.push(`Language: ${log.environment.language}`)
      sections.push(`Timezone: ${log.environment.timezone}`)
      if (log.environment.connectionType) sections.push(`Connection: ${log.environment.connectionType}`)
      sections.push(`User Agent: ${log.environment.userAgent}`)
    } else {
      // Legacy fallback
      sections.push(`\nEnvironment (Legacy):\n------------------`)
      sections.push(`Device: ${log.device}`)
      sections.push(`User Agent: ${log.userAgent}`)
    }
    
    // User Context & Actions
    if (log.user) {
      sections.push(`\nUser Context:\n------------------`)
      sections.push(`Session ID: ${log.user.sessionId}`)
      if (log.user.userId) sections.push(`User ID: ${log.user.userId}`)
      
      if (log.user.actions && log.user.actions.length > 0) {
        sections.push(`\nRecent User Actions:`)
        log.user.actions.forEach((action, i) => {
          const timeAgo = new Date(log.timestamp).getTime() - action.timestamp
          sections.push(`  ${i + 1}. ${action.type}${action.target ? ` on ${action.target}` : ''}${action.route ? ` (route: ${action.route})` : ''} (${Math.round(timeAgo / 1000)}s before error)`)
        })
      }
    } else {
      // Legacy fallback
      sections.push(`\nUser Context (Legacy):\n------------------`)
      sections.push(`Session ID: ${log.sessionId || 'N/A'}`)
    }
    
    // App Context
    if (log.app) {
      sections.push(`\nApp Context:\n------------------`)
      sections.push(`Version: ${log.app.version}`)
      sections.push(`Build Time: ${log.app.buildTime}`)
      sections.push(`Route: ${log.app.route}`)
      if (log.app.component) sections.push(`Component: ${log.app.component}`)
      if (log.app.state) {
        sections.push(`State: ${JSON.stringify(log.app.state, null, 2)}`)
      }
    } else {
      // Legacy fallback
      sections.push(`\nApp Context (Legacy):\n------------------`)
      sections.push(`URL: ${log.url}`)
    }
    
    // Tags
    if (log.tags && log.tags.length > 0) {
      sections.push(`\nTags: ${log.tags.join(', ')}`)
    }
    
    // Additional Data
    const additionalData = log.customData || log.data
    if (additionalData) {
      sections.push(`\nAdditional Data:\n------------------`)
      sections.push(JSON.stringify(additionalData, null, 2))
    }
    
    sections.push(`\n==================`)
    sections.push(`Copied from Børnelæring Error Dashboard at ${new Date().toISOString()}`)
    
    const logDetails = sections.join('\n')
    
    navigator.clipboard.writeText(logDetails)
      .then(() => {
        setCopySuccess(true)
      })
      .catch((err) => {
        console.error('Failed to copy:', err)
      })
  }

  return (
    <Box sx={{ 
      height: '100vh',
      overflow: 'auto',
      backgroundColor: '#f5f5f5'
    }}>
      <Box sx={{ p: 3, maxWidth: 1200, margin: '0 auto' }}>
        <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold', color: '#1976d2' }}>
          🚨 Error Dashboard - Børnelæring
        </Typography>

      {/* Stats Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
        <Card sx={{ bgcolor: '#e8f5e8' }}>
          <CardContent>
            <Typography variant="h6" color="success.main">Total</Typography>
            <Typography variant="h3" sx={{ fontWeight: 'bold' }}>{totalCount}</Typography>
            <Typography variant="caption" color="text.secondary">
              ({stats.errors + stats.warnings + stats.info + stats.logs} calculated)
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ bgcolor: '#ffebee' }}>
          <CardContent>
            <Typography variant="h6" color="error">Errors</Typography>
            <Typography variant="h3" sx={{ fontWeight: 'bold' }}>{stats.errors}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ bgcolor: '#fff3e0' }}>
          <CardContent>
            <Typography variant="h6" color="warning.main">Warnings</Typography>
            <Typography variant="h3" sx={{ fontWeight: 'bold' }}>{stats.warnings}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ bgcolor: '#e3f2fd' }}>
          <CardContent>
            <Typography variant="h6" color="info.main">Info</Typography>
            <Typography variant="h3" sx={{ fontWeight: 'bold' }}>{stats.info}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ bgcolor: '#f3e5f5' }}>
          <CardContent>
            <Typography variant="h6" color="text.secondary">Logs</Typography>
            <Typography variant="h3" sx={{ fontWeight: 'bold' }}>{stats.logs}</Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>Level</InputLabel>
              <Select value={levelFilter} onChange={(e) => setLogLevel(e.target.value === 'all' ? undefined : e.target.value)} label="Level">
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="error">Error</MenuItem>
                <MenuItem value="warn">Warning</MenuItem>
                <MenuItem value="info">Info</MenuItem>
                <MenuItem value="log">Log</MenuItem>
              </Select>
            </FormControl>

            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>Device</InputLabel>
              <Select value={deviceFilter} onChange={(e) => setDevice(e.target.value === 'all' ? undefined : e.target.value)} label="Device">
                <MenuItem value="all">All</MenuItem>
                {uniqueDevices.map(device => (
                  <MenuItem key={device} value={device}>{device}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl sx={{ minWidth: 100 }}>
              <InputLabel>Limit</InputLabel>
              <Select value={limit} onChange={(e) => setLimit(Number(e.target.value))} label="Limit">
                <MenuItem value={25}>25</MenuItem>
                <MenuItem value={50}>50</MenuItem>
                <MenuItem value={100}>100</MenuItem>
                <MenuItem value={200}>200</MenuItem>
              </Select>
            </FormControl>

            <Button variant="outlined" startIcon={<Refresh />} onClick={fetchLogs} disabled={loading}>
              Refresh
            </Button>

            <Button variant="outlined" startIcon={<Download />} onClick={exportLogs} disabled={logs.length === 0}>
              Export
            </Button>

            <Button 
              variant="outlined" 
              color="error"
              startIcon={<DeleteForever />} 
              onClick={() => setShowClearConfirm(true)} 
              disabled={logs.length === 0 || clearLoading}
            >
              Clear All
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Error loading logs: {error}
        </Alert>
      )}

      {/* Loading */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Logs List */}
      {!loading && logs.length === 0 && (
        <Alert severity="info">
          No error logs found. This is good news! 🎉
        </Alert>
      )}

      {!loading && logs.length > 0 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Recent Logs ({logs.length} shown)
          </Typography>
          
          {logs.map((log, index) => {
            const isExpanded = expandedLogs.has(index)
            
            return (
              <Card 
                key={index} 
                sx={{ 
                  mb: 2, 
                  border: log.level === 'error' ? '2px solid #f44336' : '1px solid #e0e0e0',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: 3
                  }
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Chip 
                          label={log.level.toUpperCase()} 
                          color={getLevelColor(log.level) as any}
                          size="small"
                        />
                        <Chip 
                          label={log.device} 
                          variant="outlined" 
                          size="small"
                        />
                        <Chip 
                          label={formatTimestamp(log.timestamp)} 
                          variant="outlined" 
                          size="small"
                        />
                      </Box>
                      
                      <Box 
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 1,
                          cursor: 'pointer',
                          '&:hover': {
                            '& .expand-icon': {
                              bgcolor: 'action.hover'
                            }
                          }
                        }}
                        onClick={() => toggleLogExpansion(index)}
                      >
                        <Typography variant="body1" sx={{ fontWeight: 'bold', flex: 1 }}>
                          {log.message}
                        </Typography>
                        <IconButton 
                          size="small"
                          className="expand-icon"
                          sx={{ 
                            bgcolor: 'background.paper',
                            border: '1px solid',
                            borderColor: 'divider'
                          }}
                        >
                          {isExpanded ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                      </Box>
                      
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        URL: {log.url}
                      </Typography>
                    </Box>
                  </Box>
                  
                  {/* Expandable Details */}
                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                      
                      {/* Error ID */}
                      {log.id && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          <strong>Error ID:</strong> {log.id}
                        </Typography>
                      )}
                      
                      {/* Source Location */}
                      {(log.fileName || log.functionName || log.lineNumber) && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                            Source Location:
                          </Typography>
                          {log.fileName && (
                            <Typography variant="body2" color="text.secondary" sx={{ pl: 2, mb: 0.5 }}>
                              <strong>File:</strong> {log.fileName}
                            </Typography>
                          )}
                          {log.functionName && (
                            <Typography variant="body2" color="text.secondary" sx={{ pl: 2, mb: 0.5 }}>
                              <strong>Function:</strong> {log.functionName}
                            </Typography>
                          )}
                          {log.lineNumber && (
                            <Typography variant="body2" color="text.secondary" sx={{ pl: 2, mb: 0.5 }}>
                              <strong>Line:</strong> {log.lineNumber}{log.columnNumber ? `:${log.columnNumber}` : ''}
                            </Typography>
                          )}
                        </Box>
                      )}
                      
                      {/* Stack Trace */}
                      {log.stack && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                            Stack Trace:
                          </Typography>
                          <Box 
                            component="pre" 
                            sx={{ 
                              bgcolor: '#ffebee', 
                              p: 2, 
                              borderRadius: 1, 
                              fontSize: '0.75rem',
                              overflow: 'auto',
                              maxHeight: 200,
                              fontFamily: 'monospace',
                              border: '1px solid #ffcdd2'
                            }}
                          >
                            {log.stack}
                          </Box>
                        </Box>
                      )}
                      
                      {/* HTTP Request/Response Context */}
                      {(log.request || log.response) && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                            HTTP Context:
                          </Typography>
                          {log.request && (
                            <Box sx={{ pl: 2, mb: 1 }}>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                <strong>Request:</strong> {log.request.method} {log.request.url}
                              </Typography>
                              {Object.keys(log.request.queryParams || {}).length > 0 && (
                                <Box 
                                  component="pre" 
                                  sx={{ 
                                    bgcolor: '#e3f2fd', 
                                    p: 1, 
                                    borderRadius: 1, 
                                    fontSize: '0.75rem',
                                    overflow: 'auto',
                                    maxHeight: 100,
                                    fontFamily: 'monospace',
                                    mt: 0.5
                                  }}
                                >
                                  Query: {JSON.stringify(log.request.queryParams, null, 2)}
                                </Box>
                              )}
                            </Box>
                          )}
                          {log.response && (
                            <Box sx={{ pl: 2 }}>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                <strong>Response:</strong> {log.response.status} {log.response.statusText}
                                {log.response.duration && ` (${log.response.duration}ms)`}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      )}
                      
                      {/* Environment Info */}
                      {log.environment && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                            Environment:
                          </Typography>
                          <Box sx={{ pl: 2 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                              <strong>Device:</strong> {log.environment.device}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                              <strong>Platform:</strong> {log.environment.platform}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                              <strong>Screen:</strong> {log.environment.screenResolution}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                              <strong>Viewport:</strong> {log.environment.viewport}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                              <strong>Language:</strong> {log.environment.language}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                      
                      {/* User Context & Recent Actions */}
                      {log.user && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                            User Context:
                          </Typography>
                          <Box sx={{ pl: 2 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                              <strong>Session ID:</strong> {log.user.sessionId}
                            </Typography>
                            {log.user.userId && (
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                <strong>User ID:</strong> {log.user.userId}
                              </Typography>
                            )}
                            
                            {log.user.actions && log.user.actions.length > 0 && (
                              <Box sx={{ mt: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                  Recent User Actions:
                                </Typography>
                                <Box 
                                  sx={{ 
                                    bgcolor: '#f3e5f5', 
                                    p: 1.5, 
                                    borderRadius: 1, 
                                    fontSize: '0.75rem',
                                    maxHeight: 150,
                                    overflow: 'auto'
                                  }}
                                >
                                  {log.user.actions.map((action, i) => {
                                    const timeAgo = new Date(log.timestamp).getTime() - action.timestamp
                                    return (
                                      <Typography key={i} variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                                        {i + 1}. {action.type}{action.target ? ` on ${action.target}` : ''}
                                        {action.route ? ` (route: ${action.route})` : ''}
                                        <span style={{ color: '#666', fontSize: '0.9em' }}>
                                          {' '}({Math.round(timeAgo / 1000)}s before error)
                                        </span>
                                      </Typography>
                                    )
                                  })}
                                </Box>
                              </Box>
                            )}
                          </Box>
                        </Box>
                      )}
                      
                      {/* App Context */}
                      {log.app && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                            App Context:
                          </Typography>
                          <Box sx={{ pl: 2 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                              <strong>Version:</strong> {log.app.version}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                              <strong>Route:</strong> {log.app.route}
                            </Typography>
                            {log.app.component && (
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                <strong>Component:</strong> {log.app.component}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      )}
                      
                      {/* Tags */}
                      {log.tags && log.tags.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                            Tags:
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', pl: 2 }}>
                            {log.tags.map((tag, i) => (
                              <Chip key={i} label={tag} size="small" variant="outlined" />
                            ))}
                          </Box>
                        </Box>
                      )}
                      
                      {/* Legacy Session and User Agent (fallback) */}
                      {!log.user && log.sessionId && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          <strong>Session ID (Legacy):</strong> {log.sessionId}
                        </Typography>
                      )}
                      
                      {!log.environment && log.userAgent && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          <strong>User Agent (Legacy):</strong> {log.userAgent}
                        </Typography>
                      )}
                      
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>Timestamp:</strong> {new Date(log.timestamp).toISOString()}
                      </Typography>
                      
                      {/* Additional Data */}
                      {(log.customData || log.data) && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                            Additional Data:
                          </Typography>
                          <Box 
                            component="pre" 
                            sx={{ 
                              bgcolor: '#f5f5f5', 
                              p: 2, 
                              borderRadius: 1, 
                              fontSize: '0.8rem',
                              overflow: 'auto',
                              maxHeight: 300,
                              fontFamily: 'monospace'
                            }}
                          >
                            {JSON.stringify(log.customData || log.data, null, 2)}
                          </Box>
                        </Box>
                      )}
                      
                      {/* Copy Button */}
                      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<ContentCopy />}
                          onClick={() => copyLogToClipboard(log)}
                          sx={{
                            bgcolor: '#1976d2',
                            '&:hover': {
                              bgcolor: '#1565c0'
                            }
                          }}
                        >
                          Copy Complete Error Details
                        </Button>
                      </Box>
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            )
          })}
        </Box>
      )}
      
      {/* Copy Success Snackbar */}
      <Snackbar
        open={copySuccess}
        autoHideDuration={3000}
        onClose={() => setCopySuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setCopySuccess(false)} 
          severity="success" 
          sx={{ width: '100%' }}
        >
          Error details copied to clipboard! ✓
        </Alert>
      </Snackbar>

      {/* Clear Confirmation Dialog */}
      <Dialog
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
      >
        <DialogTitle>Clear All Error Logs?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to clear all {logs.length} error logs? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setShowClearConfirm(false)} 
            disabled={clearLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={clearAllLogs} 
            color="error" 
            variant="contained"
            disabled={clearLoading}
            startIcon={clearLoading ? <CircularProgress size={20} /> : <DeleteForever />}
          >
            {clearLoading ? 'Clearing...' : 'Clear All'}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  )
}

export default ErrorDashboard