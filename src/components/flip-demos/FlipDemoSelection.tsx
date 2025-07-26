import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Box, Typography, Grid, Card, CardContent, IconButton } from '@mui/material'
import { ArrowBack } from '@mui/icons-material'
import { motion } from 'framer-motion'

const demos = [
  {
    path: '/flip-demo/css-class',
    title: 'CSS Class Flip',
    description: 'Pure CSS class-based flip animation',
    emoji: '🎨',
    color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  },
  {
    path: '/flip-demo/inline-style',
    title: 'Inline Style Flip',
    description: 'React state with inline styles',
    emoji: '⚛️',
    color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
  },
  {
    path: '/flip-demo/web-animations',
    title: 'Web Animations API',
    description: 'Using Web Animations API',
    emoji: '🎭',
    color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
  },
  {
    path: '/flip-demo/opacity-scale',
    title: 'Opacity & Scale',
    description: 'Simple opacity and scale transition',
    emoji: '✨',
    color: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
  },
  {
    path: '/flip-demo/absolute-positioning',
    title: 'Absolute Position',
    description: 'Two absolutely positioned layers',
    emoji: '🎈',
    color: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
  }
]

const FlipDemoSelection: React.FC = () => {
  const navigate = useNavigate()

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f3e5f5 0%, #e8f5e8 100%)' }}>
      <Container maxWidth="lg" sx={{ pt: 4 }}>
        <Box sx={{ mb: 4 }}>
          <IconButton onClick={() => navigate('/')} sx={{ mb: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h3" sx={{ textAlign: 'center', fontWeight: 'bold', color: 'primary.dark', mb: 2 }}>
            🎴 Card Flip Demos 🎴
          </Typography>
          <Typography variant="h6" sx={{ textAlign: 'center', color: 'text.secondary' }}>
            Choose a flip animation approach to test
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {demos.map((demo, index) => (
            <Grid size={{ xs: 12, md: 6 }} key={demo.path}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card 
                  onClick={() => navigate(demo.path)}
                  sx={{ 
                    cursor: 'pointer',
                    height: '100%',
                    background: demo.color,
                    color: 'white',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      boxShadow: 6
                    }
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h2" sx={{ mr: 2 }}>{demo.emoji}</Typography>
                      <Box>
                        <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                          {demo.title}
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                          {demo.description}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  )
}

export default FlipDemoSelection