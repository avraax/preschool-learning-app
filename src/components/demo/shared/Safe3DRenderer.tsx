import React, { Suspense, useState, useEffect, Component, ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { Box, Typography, CircularProgress } from '@mui/material'

// Error boundary specifically for 3D rendering
class ThreeErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.warn('React Three Fiber Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }

    return this.props.children
  }
}

// Safe WebGL context detection
const checkWebGLSupport = (): boolean => {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    canvas.remove()
    return !!gl
  } catch {
    return false
  }
}

interface Safe3DRendererProps {
  children: ReactNode
  fallback: ReactNode
  loadingText?: string
  camera?: any
  onCreated?: (state: any) => void
  style?: any
}

export const Safe3DRenderer: React.FC<Safe3DRendererProps> = ({
  children,
  fallback,
  loadingText = "Indlæser 3D...",
  camera = { position: [0, 0, 5], fov: 75 },
  onCreated,
  style = {}
}) => {
  const [webglSupported, setWebglSupported] = useState<boolean | null>(null)
  const [renderError, setRenderError] = useState<string | null>(null)

  useEffect(() => {
    // Delay WebGL check to ensure DOM is ready
    const timer = setTimeout(() => {
      try {
        const supported = checkWebGLSupport()
        setWebglSupported(supported)
        
        if (!supported) {
          setRenderError('WebGL ikke understøttet af din browser')
        }
      } catch (error) {
        console.warn('WebGL check failed:', error)
        setWebglSupported(false)
        setRenderError('3D support kontrol fejlede')
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  // Show loading while checking WebGL support
  if (webglSupported === null) {
    return (
      <Box sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        ...style
      }}>
        <CircularProgress sx={{ color: '#FFD700', mb: 2 }} size={40} />
        <Typography sx={{ color: 'white', fontSize: '1rem' }}>
          {loadingText}
        </Typography>
      </Box>
    )
  }

  // Show fallback if WebGL not supported or error occurred
  if (!webglSupported || renderError) {
    return (
      <Box sx={{ width: '100%', height: '100%', ...style }}>
        {fallback}
      </Box>
    )
  }

  // Render 3D content with error boundary
  return (
    <ThreeErrorBoundary fallback={fallback}>
      <Box sx={{ width: '100%', height: '100%', ...style }}>
        <Suspense fallback={
          <Box sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column'
          }}>
            <CircularProgress sx={{ color: '#FFD700', mb: 2 }} size={40} />
            <Typography sx={{ color: 'white', fontSize: '1rem' }}>
              {loadingText}
            </Typography>
          </Box>
        }>
          <Canvas
            camera={camera}
            onCreated={onCreated}
            gl={{ 
              antialias: true, 
              alpha: true,
              powerPreference: "high-performance"
            }}
            dpr={Math.min(window.devicePixelRatio, 2)} // Limit pixel ratio for performance
          >
            {children}
          </Canvas>
        </Suspense>
      </Box>
    </ThreeErrorBoundary>
  )
}

export default Safe3DRenderer