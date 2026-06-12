import React, { useState, useEffect } from 'react'
import { Box, Typography, Card, CardContent, Button, Alert, LinearProgress } from '@mui/material'
import { CheckCircle, Error as ErrorIcon, Warning } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'

interface TestResult {
  route: string
  name: string
  status: 'pending' | 'loading' | 'success' | 'error'
  error?: string
  loadTime?: number
}

const ValidationTest: React.FC = () => {
  const navigate = useNavigate()
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [currentTest, setCurrentTest] = useState<number>(-1)
  const [isRunning, setIsRunning] = useState(false)

  const homepageRoutes: Omit<TestResult, 'status'>[] = [
    { route: '/demo/homepages', name: 'Homepage Gallery' },
    { route: '/demo/homepages/space-adventure', name: 'Space Adventure (3D)' },
    { route: '/demo/homepages/underwater-world', name: 'Underwater World' },
    { route: '/demo/homepages/magical-forest', name: 'Magical Forest' },
    { route: '/demo/homepages/toybox-playground', name: 'Toybox Playground (3D)' },
    { route: '/demo/homepages/interactive-storybook', name: 'Interactive Storybook' },
    { route: '/demo/homepages/circus-carnival', name: 'Circus Carnival' },
    { route: '/demo/homepages/cloud-kingdom', name: 'Cloud Kingdom' },
    { route: '/demo/homepages/construction-site', name: 'Construction Site' },
    { route: '/demo/homepages/art-studio', name: 'Art Studio' },
    { route: '/demo/homepages/music-festival', name: 'Music Festival' }
  ]

  useEffect(() => {
    // Initialize test results
    setTestResults(homepageRoutes.map(route => ({ ...route, status: 'pending' })))
  }, [])

  const runTests = async () => {
    setIsRunning(true)
    setCurrentTest(-1)

    for (let i = 0; i < homepageRoutes.length; i++) {
      setCurrentTest(i)
      const route = homepageRoutes[i]
      
      // Update status to loading
      setTestResults(prev => prev.map((test, index) => 
        index === i ? { ...test, status: 'loading' } : test
      ))

      try {
        const startTime = Date.now()
        
        // Simulate navigation to test route loading
        await new Promise<void>((resolve, reject) => {
          const testFrame = document.createElement('iframe')
          testFrame.style.display = 'none'
          testFrame.src = `${window.location.origin}${route.route}`
          
          const timeout = setTimeout(() => {
            document.body.removeChild(testFrame)
            reject(new Error('Load timeout'))
          }, 10000) // 10 second timeout

          testFrame.onload = () => {
            clearTimeout(timeout)
            try {
              // Check for JavaScript errors in the iframe
              const frameDocument = testFrame.contentDocument
              if (frameDocument) {
                const endTime = Date.now()
                const loadTime = endTime - startTime
                
                // Update status to success
                setTestResults(prev => prev.map((test, index) => 
                  index === i ? { ...test, status: 'success', loadTime } : test
                ))
                
                document.body.removeChild(testFrame)
                resolve()
              } else {
                throw new Error('Cannot access iframe content')
              }
            } catch (error) {
              document.body.removeChild(testFrame)
              reject(error)
            }
          }

          testFrame.onerror = (error) => {
            clearTimeout(timeout)
            document.body.removeChild(testFrame)
            reject(new Error(`Load error: ${String(error)}`))
          }

          document.body.appendChild(testFrame)
        })

      } catch (error) {
        // Update status to error
        setTestResults(prev => prev.map((test, index) => 
          index === i ? { 
            ...test, 
            status: 'error', 
            error: error instanceof Error ? error.message : String(error)
          } : test
        ))
      }

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    setIsRunning(false)
    setCurrentTest(-1)
  }

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle sx={{ color: 'success.main' }} />
      case 'error':
        return <ErrorIcon sx={{ color: 'error.main' }} />
      case 'loading':
        return <LinearProgress sx={{ width: '24px', height: '24px', borderRadius: '50%' }} />
      default:
        return <Warning sx={{ color: 'warning.main' }} />
    }
  }

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return 'success.light'
      case 'error': return 'error.light'
      case 'loading': return 'info.light'
      default: return 'grey.300'
    }
  }

  const successCount = testResults.filter(r => r.status === 'success').length
  const errorCount = testResults.filter(r => r.status === 'error').length
  const totalTests = testResults.length

  return (
    <Box sx={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      p: 3
    }}>
      <Box sx={{ maxWidth: '800px', mx: 'auto' }}>
        <Typography
          variant="h3"
          sx={{
            color: 'white',
            fontWeight: 700,
            textAlign: 'center',
            mb: 4,
            textShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }}
        >
          🧪 Homepage Validation Test
        </Typography>

        {/* Test Summary */}
        <Card sx={{ mb: 3, backgroundColor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
          <CardContent>
            <Typography variant="h6" sx={{ color: 'white', mb: 2 }}>
              Test Results: {successCount}/{totalTests} passed
            </Typography>
            {errorCount > 0 && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {errorCount} homepage(s) failed to load properly
              </Alert>
            )}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Button
                variant="contained"
                onClick={runTests}
                disabled={isRunning}
                sx={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
              >
                {isRunning ? 'Running Tests...' : 'Run All Tests'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => navigate('/')}
                sx={{ color: 'white', borderColor: 'white' }}
              >
                Back to Home
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Test Results */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {testResults.map((result, index) => (
            <Card
              key={result.route}
              sx={{
                backgroundColor: getStatusColor(result.status),
                border: currentTest === index ? '2px solid white' : 'none',
                opacity: currentTest === index ? 1 : result.status === 'pending' ? 0.6 : 1
              }}
            >
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {getStatusIcon(result.status)}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {result.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {result.route}
                  </Typography>
                  {result.loadTime && (
                    <Typography variant="caption" color="text.secondary">
                      Loaded in {result.loadTime}ms
                    </Typography>
                  )}
                  {result.error && (
                    <Typography variant="body2" color="error">
                      Error: {result.error}
                    </Typography>
                  )}
                </Box>
                {result.status === 'success' && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => navigate(result.route)}
                  >
                    Visit
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </Box>
      </Box>
    </Box>
  )
}

export default ValidationTest