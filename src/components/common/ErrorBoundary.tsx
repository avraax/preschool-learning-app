import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Box, Typography, Button, Alert, Card, CardContent } from '@mui/material'
import { Refresh, BugReport } from '@mui/icons-material'
import { 
  EnhancedErrorLog,
  generateErrorId,
  getEnvironmentInfo,
  userActionTracker,
  parseStackTrace
} from '../../utils/errorCapture'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string | null
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    errorId: null
  }

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
      errorId: generateErrorId()
    }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('React Error Boundary caught an error:', error, errorInfo)
    
    this.setState({
      error,
      errorInfo,
      errorId: generateErrorId()
    })

    // Send comprehensive error details to our logging system
    this.logEnhancedError(error, errorInfo)

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  private logEnhancedError(error: Error, errorInfo: ErrorInfo) {
    const enhancedError: EnhancedErrorLog = {
      id: this.state.errorId || generateErrorId(),
      timestamp: new Date().toISOString(),
      level: 'error',
      message: `React Component Error: ${error.message}`,
      stack: error.stack,
      parsedStack: error.stack ? parseStackTrace(error.stack) : undefined,
      fileName: this.extractFileFromStack(error.stack),
      lineNumber: this.extractLineFromStack(error.stack),
      columnNumber: this.extractColumnFromStack(error.stack),
      functionName: this.extractFunctionFromStack(error.stack),
      environment: getEnvironmentInfo(),
      user: {
        sessionId: this.getSessionId(),
        actions: userActionTracker.getActions()
      },
      app: {
        version: (window as any).__APP_VERSION__ || 'unknown',
        buildTime: (window as any).__BUILD_TIME__ || 'unknown',
        route: window.location.pathname,
        component: this.extractComponentFromStack(errorInfo.componentStack),
        state: this.getCurrentUrlParams()
      },
      customData: {
        reactErrorInfo: {
          componentStack: errorInfo.componentStack,
          errorBoundary: 'ErrorBoundary',
          reactVersion: React.version
        }
      },
      tags: ['react-error', 'component-crash', 'error-boundary']
    }

    // Send to our enhanced error logging
    this.sendErrorToAPI(enhancedError)
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

  private extractComponentFromStack(componentStack: string): string | undefined {
    // Extract the component name from React component stack
    const lines = componentStack.split('\n')
    for (const line of lines) {
      const match = line.trim().match(/^in (\w+)/)
      if (match) {
        return match[1]
      }
    }
    return undefined
  }

  private getCurrentUrlParams(): any {
    const params = new URLSearchParams(window.location.search)
    const state: any = {}
    params.forEach((value, key) => {
      state[key] = value
    })
    return Object.keys(state).length > 0 ? state : undefined
  }

  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('børnelæring-session-id')
    if (!sessionId) {
      sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      sessionStorage.setItem('børnelæring-session-id', sessionId)
    }
    return sessionId
  }

  private sendErrorToAPI(enhancedError: EnhancedErrorLog) {
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
    }).catch((error) => {
      console.error('Failed to send error to API:', error)
    })
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    })
  }

  private handleReload = () => {
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            minHeight: '50vh',
            p: 3,
            textAlign: 'center'
          }}
        >
          <Card sx={{ maxWidth: 600, width: '100%' }}>
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3 }}>
                <BugReport sx={{ fontSize: 48, color: 'error.main', mr: 2 }} />
                <Typography variant="h4" component="h1" color="error">
                  Ups! Noget gik galt
                </Typography>
              </Box>

              <Alert severity="error" sx={{ mb: 3 }}>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  Der opstod en uventet fejl i appen. Vi har automatisk logget fejlen for at hjælpe os med at løse problemet.
                </Typography>
                {this.state.errorId && (
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    Fejl ID: {this.state.errorId}
                  </Typography>
                )}
              </Alert>

              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  startIcon={<Refresh />}
                  onClick={this.handleRetry}
                  sx={{ minWidth: 120 }}
                >
                  Prøv igen
                </Button>
                <Button
                  variant="outlined"
                  onClick={this.handleReload}
                  sx={{ minWidth: 120 }}
                >
                  Genindlæs siden
                </Button>
              </Box>

              {/* Development mode: Show error details */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <Box sx={{ mt: 3, textAlign: 'left' }}>
                  <Typography variant="h6" color="error" sx={{ mb: 1 }}>
                    Development Error Details:
                  </Typography>
                  <Box 
                    component="pre" 
                    sx={{ 
                      bgcolor: '#ffebee', 
                      p: 2, 
                      borderRadius: 1, 
                      fontSize: '0.75rem',
                      overflow: 'auto',
                      maxHeight: 300,
                      fontFamily: 'monospace',
                      border: '1px solid #ffcdd2'
                    }}
                  >
                    {this.state.error.message}
                    {'\n\n'}
                    {this.state.error.stack}
                    {this.state.errorInfo && (
                      '\n\nComponent Stack:\n' + this.state.errorInfo.componentStack
                    )}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary