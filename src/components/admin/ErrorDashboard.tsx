import React, { useState, useEffect } from 'react'
import { Box, Card, CardContent, Typography, Button, Select, MenuItem, FormControl, InputLabel, Chip, Alert, CircularProgress, Collapse, IconButton, Snackbar, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material'
import { Refresh, Download, ExpandMore, ExpandLess, ContentCopy, DeleteForever } from '@mui/icons-material'

interface ErrorLogEntry {
  timestamp: string
  level: 'error' | 'warn' | 'info' | 'log'
  message: string
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
  const [logs, setLogs] = useState<ErrorLogEntry[]>([])
  const [stats, setStats] = useState({ errors: 0, warnings: 0, info: 0, logs: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [deviceFilter, setDeviceFilter] = useState<string>('all')
  const [limit, setLimit] = useState<number>(50)
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set())
  const [copySuccess, setCopySuccess] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearLoading, setClearLoading] = useState(false)

  const fetchLogs = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams()
      params.append('limit', limit.toString())
      
      if (levelFilter !== 'all') {
        params.append('level', levelFilter)
      }
      
      if (deviceFilter !== 'all') {
        params.append('device', deviceFilter)
      }
      
      const response = await fetch(`/api/log-error?${params}`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data: ErrorLogResponse = await response.json()
      setLogs(data.logs)
      setStats(data.stats)
      
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
      const response = await fetch('/api/log-error', {
        method: 'DELETE'
      })
      
      if (!response.ok) {
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
    const logDetails = `Error Log Details
==================
Level: ${log.level.toUpperCase()}
Time: ${formatTimestamp(log.timestamp)}
Device: ${log.device}
URL: ${log.url}
Session: ${log.sessionId || 'N/A'}
User Agent: ${log.userAgent}

Message:
${log.message}

${log.data ? `Additional Data:
${JSON.stringify(log.data, null, 2)}` : ''}

==================
Copied from Børnelæring Error Dashboard at ${new Date().toISOString()}`

    navigator.clipboard.writeText(logDetails)
      .then(() => {
        setCopySuccess(true)
      })
      .catch((err) => {
        console.error('Failed to copy:', err)
      })
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, margin: '0 auto' }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold', color: '#1976d2' }}>
        🚨 Error Dashboard - Børnelæring
      </Typography>

      {/* Stats Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
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
              <Select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} label="Level">
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="error">Error</MenuItem>
                <MenuItem value="warn">Warning</MenuItem>
                <MenuItem value="info">Info</MenuItem>
                <MenuItem value="log">Log</MenuItem>
              </Select>
            </FormControl>

            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>Device</InputLabel>
              <Select value={deviceFilter} onChange={(e) => setDeviceFilter(e.target.value)} label="Device">
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
                      {/* Session and User Agent */}
                      {log.sessionId && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          <strong>Session ID:</strong> {log.sessionId}
                        </Typography>
                      )}
                      
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>User Agent:</strong> {log.userAgent}
                      </Typography>
                      
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>Timestamp:</strong> {new Date(log.timestamp).toISOString()}
                      </Typography>
                      
                      {/* Additional Data */}
                      {log.data && (
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
                            {JSON.stringify(log.data, null, 2)}
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
  )
}

export default ErrorDashboard