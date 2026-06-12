import { Component, ErrorInfo, ReactNode } from 'react'
import { Box, Typography, Button, Card, CardContent } from '@mui/material'
import { Refresh, WarningOutlined } from '@mui/icons-material'
import { motion } from 'framer-motion'

interface Props {
  children: ReactNode
  fallbackComponent?: ReactNode
  designName?: string
  onRetry?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Specialized Error Boundary for React Three Fiber components
 * Provides graceful fallbacks when WebGL or 3D components fail
 */
class ThreeDErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error
    }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('3D Component Error:', error, errorInfo)
    
    // Log specific 3D/WebGL errors
    this.log3DError(error, errorInfo)
  }

  private log3DError(error: Error, errorInfo: ErrorInfo) {
    const is3DError = this.is3DRelatedError(error)
    const errorDetails = {
      type: '3d-component-error',
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      designName: this.props.designName || 'unknown',
      is3DError,
      webGLSupported: this.checkWebGLSupport(),
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    }

    // Send to error logging API
    fetch('/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: 'error',
        message: `3D Component Failure: ${this.props.designName || 'Unknown'}`,
        device: this.getDeviceType(),
        data: errorDetails
      })
    }).catch(err => console.error('Failed to log 3D error:', err))
  }

  private is3DRelatedError(error: Error): boolean {
    const errorString = error.toString().toLowerCase()
    const stackString = (error.stack || '').toLowerCase()
    
    const threeJSKeywords = [
      'three',
      'webgl',
      'canvas',
      'react-three',
      'fiber',
      'drei',
      'shader',
      'renderer',
      'geometry',
      'material',
      'mesh',
      'scene'
    ]
    
    return threeJSKeywords.some(keyword => 
      errorString.includes(keyword) || stackString.includes(keyword)
    )
  }

  private checkWebGLSupport(): boolean {
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      return !!gl
    } catch {
      return false
    }
  }

  private getDeviceType(): string {
    const userAgent = navigator.userAgent.toLowerCase()
    if (userAgent.includes('ipad')) return 'iPad'
    if (userAgent.includes('iphone')) return 'iPhone'
    if (userAgent.includes('android')) return 'Android'
    if (userAgent.includes('mobile')) return 'Mobile'
    return 'Desktop'
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null
    })
    
    if (this.props.onRetry) {
      this.props.onRetry()
    }
  }


  public render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallbackComponent) {
        return this.props.fallbackComponent
      }

      // Default 3D error fallback
      return (
        <Box sx={{
          height: '100vh',
          width: '100vw',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Animated background */}
          <Box sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `
              radial-gradient(circle at 20% 80%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.1) 0%, transparent 50%)
            `,
            animation: 'float 6s ease-in-out infinite'
          }} />

          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Card sx={{
              maxWidth: 500,
              mx: 2,
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
              borderRadius: '24px',
              border: '2px solid rgba(255, 255, 255, 0.2)',
              position: 'relative',
              zIndex: 1
            }}>
              <CardContent sx={{ p: 4, textAlign: 'center' }}>
                <motion.div
                  animate={{ 
                    scale: [1, 1.1, 1],
                    rotate: [0, -5, 5, 0]
                  }}
                  transition={{ 
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <WarningOutlined sx={{ 
                    fontSize: '4rem', 
                    color: '#FFD700',
                    mb: 2,
                    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
                  }} />
                </motion.div>

                <Typography variant="h4" sx={{
                  color: 'white',
                  fontWeight: 700,
                  mb: 2,
                  fontSize: 'clamp(1.5rem, 4vw, 2rem)',
                  textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                }}>
                  🎮 3D Spil ikke tilgængeligt
                </Typography>

                <Typography variant="body1" sx={{
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: 'clamp(1rem, 3vw, 1.2rem)',
                  lineHeight: 1.5,
                  mb: 3,
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                }}>
                  {this.props.designName ? `${this.props.designName} kræver ` : 'Dette spil kræver '}
                  3D-understøttelse som ikke er tilgængelig på din enhed.
                </Typography>

                <Box sx={{ 
                  display: 'flex', 
                  gap: 2, 
                  justifyContent: 'center',
                  flexWrap: 'wrap'
                }}>
                  <Button
                    variant="contained"
                    startIcon={<Refresh />}
                    onClick={this.handleRetry}
                    sx={{
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      color: 'white',
                      borderRadius: '50px',
                      px: 3,
                      py: 1.5,
                      fontWeight: 600,
                      backdropFilter: 'blur(10px)',
                      border: '2px solid rgba(255,255,255,0.3)',
                      '&:hover': {
                        backgroundColor: 'rgba(255,255,255,0.3)',
                        transform: 'scale(1.05)'
                      }
                    }}
                  >
                    Prøv igen
                  </Button>
                  
                  <Button
                    variant="outlined"
                    onClick={() => window.history.back()}
                    sx={{
                      color: 'white',
                      borderColor: 'rgba(255,255,255,0.5)',
                      borderRadius: '50px',
                      px: 3,
                      py: 1.5,
                      fontWeight: 600,
                      backdropFilter: 'blur(10px)',
                      '&:hover': {
                        borderColor: 'white',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        transform: 'scale(1.05)'
                      }
                    }}
                  >
                    Tilbage
                  </Button>
                </Box>

                {/* WebGL info for debugging */}
                {!this.checkWebGLSupport() && (
                  <Typography variant="caption" sx={{
                    display: 'block',
                    mt: 2,
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '0.85rem'
                  }}>
                    💡 Din browser understøtter ikke WebGL
                  </Typography>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <style>{`
            @keyframes float {
              0%, 100% { transform: translateY(0px) rotate(0deg); }
              50% { transform: translateY(-20px) rotate(180deg); }
            }
          `}</style>
        </Box>
      )
    }

    return this.props.children
  }
}

export default ThreeDErrorBoundary