import React from 'react'
import { Box, Container, Typography, Grid, Card, CardContent, CardActionArea, Chip } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

interface HomepageDesign {
  id: string
  title: string
  description: string
  framework: string
  gradient: string
  route: string
  age: string
  complexity: 'Enkel' | 'Moderat' | 'Avanceret'
  icon: string
}

const homepageDesigns: HomepageDesign[] = [
  {
    id: 'space-adventure',
    title: 'Rummet Eventyr',
    description: 'Utforsk universet med 3D-planeter og stjerner',
    framework: 'Three.js + React Three Fiber',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    route: '/demo/homepages/space-adventure',
    age: '4-6 år',
    complexity: 'Avanceret',
    icon: '🚀'
  },
  {
    id: 'underwater-world',
    title: 'Undervands Verden',
    description: 'Svøm med fisk og havet venner',
    framework: 'Vanta.js + tsParticles',
    gradient: 'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)',
    route: '/demo/homepages/underwater-world',
    age: '4-6 år',
    complexity: 'Moderat',
    icon: '🐠'
  },
  {
    id: 'magical-forest',
    title: 'Magisk Skov',
    description: 'Mød skovens dyr og lær bogstaver',
    framework: 'Lottie + React Spring',
    gradient: 'linear-gradient(135deg, #00b894 0%, #00cec9 100%)',
    route: '/demo/homepages/magical-forest',
    age: '4-6 år',
    complexity: 'Moderat',
    icon: '🌲'
  },
  {
    id: 'toybox-playground',
    title: 'Legetøjs Legeplads',
    description: 'Leg med 3D legetøj og farver',
    framework: 'Three.js + GSAP',
    gradient: 'linear-gradient(135deg, #fd79a8 0%, #fdcb6e 100%)',
    route: '/demo/homepages/toybox-playground',
    age: '4-6 år',
    complexity: 'Avanceret',
    icon: '🧸'
  },
  {
    id: 'interactive-storybook',
    title: 'Interaktiv Eventyrbog',
    description: 'Bliv del af historien med animationer',
    framework: 'Framer Motion + CSS',
    gradient: 'linear-gradient(135deg, #a29bfe 0%, #6c5ce7 100%)',
    route: '/demo/homepages/interactive-storybook',
    age: '4-6 år',
    complexity: 'Moderat',
    icon: '📚'
  },
  {
    id: 'circus-carnival',
    title: 'Cirkus Karneval',
    description: 'Oplev cirkussets magi med konfetti',
    framework: 'GSAP + tsParticles',
    gradient: 'linear-gradient(135deg, #ff7675 0%, #fab1a0 100%)',
    route: '/demo/homepages/circus-carnival',
    age: '4-6 år',
    complexity: 'Avanceret',
    icon: '🎪'
  },
  {
    id: 'cloud-kingdom',
    title: 'Sky Kongerige',
    description: 'Flyv mellem skyer med glasmorfisme',
    framework: 'React Spring + Glasmorfisme',
    gradient: 'linear-gradient(135deg, #81ecec 0%, #74b9ff 100%)',
    route: '/demo/homepages/cloud-kingdom',
    age: '4-6 år',
    complexity: 'Moderat',
    icon: '☁️'
  },
  {
    id: 'construction-site',
    title: 'Byggeplads',
    description: 'Byg og lær med interaktive værktøjer',
    framework: 'Three.js + React DnD',
    gradient: 'linear-gradient(135deg, #fdcb6e 0%, #e17055 100%)',
    route: '/demo/homepages/construction-site',
    age: '4-6 år',
    complexity: 'Avanceret',
    icon: '🚧'
  },
  {
    id: 'art-studio',
    title: 'Kunst Studie',
    description: 'Mal og tegn med digitale pensler',
    framework: 'Canvas API + Paint',
    gradient: 'linear-gradient(135deg, #fd79a8 0%, #a29bfe 100%)',
    route: '/demo/homepages/art-studio',
    age: '4-6 år',
    complexity: 'Moderat',
    icon: '🎨'
  },
  {
    id: 'music-festival',
    title: 'Musik Festival',
    description: 'Dans og lær med visuel lyd',
    framework: 'Web Audio API + Visual',
    gradient: 'linear-gradient(135deg, #00cec9 0%, #55a3ff 100%)',
    route: '/demo/homepages/music-festival',
    age: '4-6 år',
    complexity: 'Avanceret',
    icon: '🎵'
  }
]

const complexityColors = {
  'Enkel': '#00b894',
  'Moderat': '#fdcb6e',
  'Avanceret': '#e17055'
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const cardVariants = {
  hidden: { y: 50, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 12
    }
  }
}

export const HomepageGallery: React.FC = () => {
  const navigate = useNavigate()

  const handleCardClick = (route: string) => {
    navigate(route)
  }

  // Enable scrolling for this page specifically
  React.useEffect(() => {
    // Save original styles
    const originalStyles = {
      html: {
        overflow: document.documentElement.style.overflow,
        position: document.documentElement.style.position,
        height: document.documentElement.style.height,
        width: document.documentElement.style.width,
        overscrollBehavior: document.documentElement.style.overscrollBehavior
      },
      body: {
        overflow: document.body.style.overflow,
        position: document.body.style.position,
        height: document.body.style.height,
        width: document.body.style.width
      },
      root: {
        overflow: document.getElementById('root')?.style.overflow || '',
        height: document.getElementById('root')?.style.height || '',
        minHeight: document.getElementById('root')?.style.minHeight || ''
      }
    }

    // Force enable scrolling with inline styles (highest priority)
    document.documentElement.style.cssText = `
      overflow: auto !important;
      position: static !important;
      height: auto !important;
      width: 100% !important;
      overscroll-behavior: auto !important;
    `
    
    document.body.style.cssText = `
      overflow: visible !important;
      position: static !important;
      height: auto !important;
      width: 100% !important;
      margin: 0;
      padding: 0;
    `
    
    const rootEl = document.getElementById('root')
    if (rootEl) {
      rootEl.style.cssText = `
        overflow: visible !important;
        height: auto !important;
        min-height: 100vh !important;
      `
    }

    // Also add a style tag to override the CSS file rules
    const style = document.createElement('style')
    style.id = 'homepage-gallery-scroll-override'
    style.innerHTML = `
      html {
        overflow: auto !important;
        position: static !important;
        height: auto !important;
        width: 100% !important;
        overscroll-behavior: auto !important;
      }
      body {
        overflow: visible !important;
        position: static !important;
        height: auto !important;
        width: 100% !important;
      }
      #root {
        overflow: visible !important;
        height: auto !important;
        min-height: 100vh !important;
      }
    `
    document.head.appendChild(style)

    // Cleanup: restore original styles when component unmounts
    return () => {
      // Remove the style tag
      const styleEl = document.getElementById('homepage-gallery-scroll-override')
      if (styleEl) {
        styleEl.remove()
      }

      // Restore original inline styles
      document.documentElement.style.overflow = originalStyles.html.overflow
      document.documentElement.style.position = originalStyles.html.position
      document.documentElement.style.height = originalStyles.html.height
      document.documentElement.style.width = originalStyles.html.width
      document.documentElement.style.overscrollBehavior = originalStyles.html.overscrollBehavior
      
      document.body.style.overflow = originalStyles.body.overflow
      document.body.style.position = originalStyles.body.position
      document.body.style.height = originalStyles.body.height
      document.body.style.width = originalStyles.body.width
      
      const rootEl = document.getElementById('root')
      if (rootEl) {
        rootEl.style.overflow = originalStyles.root.overflow
        rootEl.style.height = originalStyles.root.height
        rootEl.style.minHeight = originalStyles.root.minHeight
      }

      // Restore the fixed positioning for iOS
      document.documentElement.style.position = 'fixed'
      document.documentElement.style.overflow = 'hidden'
    }
  }, [])

  return (
    <Box sx={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      py: 4
    }}>
      <Container maxWidth="lg">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography
              variant="h2"
              sx={{
                fontWeight: 800,
                fontSize: 'clamp(2rem, 6vw, 4rem)',
                background: 'linear-gradient(45deg, #FF6B6B, #4ECDC4, #45B7D1)',
                backgroundSize: '200% 200%',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'gradientShift 3s ease infinite',
                mb: 2,
                '@keyframes gradientShift': {
                  '0%': { backgroundPosition: '0% 50%' },
                  '50%': { backgroundPosition: '100% 50%' },
                  '100%': { backgroundPosition: '0% 50%' }
                }
              }}
            >
              🎨 Forside Galeri
            </Typography>
            <Typography
              variant="h5"
              sx={{
                color: 'white',
                fontWeight: 600,
                fontSize: 'clamp(1.2rem, 3vw, 1.8rem)',
                opacity: 0.9
              }}
            >
              10 Magiske Forside Designs for Børn
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {homepageDesigns.map((design) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={design.id}>
                <motion.div variants={cardVariants}>
                  <Card
                    sx={{
                      height: '100%',
                      background: design.gradient,
                      borderRadius: '24px',
                      overflow: 'hidden',
                      position: 'relative',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      '&:hover': {
                        transform: 'scale(1.05) rotate(-1deg)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
                      },
                      '&:active': {
                        transform: 'scale(0.98)'
                      }
                    }}
                  >
                    <CardActionArea
                      onClick={() => handleCardClick(design.route)}
                      sx={{
                        height: '100%',
                        position: 'relative',
                        '&:before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: 'rgba(255,255,255,0.1)',
                          backdropFilter: 'blur(10px)',
                          zIndex: 1
                        }
                      }}
                    >
                      <CardContent sx={{
                        position: 'relative',
                        zIndex: 2,
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        p: 3
                      }}>
                        <Box sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          mb: 1
                        }}>
                          <Typography
                            variant="h3"
                            sx={{
                              fontSize: '3rem',
                              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                            }}
                          >
                            {design.icon}
                          </Typography>
                          <Chip
                            label={design.complexity}
                            sx={{
                              backgroundColor: complexityColors[design.complexity],
                              color: 'white',
                              fontWeight: 600,
                              fontSize: '0.9rem'
                            }}
                          />
                        </Box>

                        <Typography
                          variant="h5"
                          sx={{
                            fontWeight: 700,
                            color: 'white',
                            fontSize: 'clamp(1.2rem, 3vw, 1.5rem)',
                            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                            mb: 1
                          }}
                        >
                          {design.title}
                        </Typography>

                        <Typography
                          variant="body1"
                          sx={{
                            color: 'rgba(255,255,255,0.9)',
                            fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)',
                            lineHeight: 1.4,
                            mb: 2,
                            textShadow: '0 1px 2px rgba(0,0,0,0.2)'
                          }}
                        >
                          {design.description}
                        </Typography>

                        <Box sx={{ mt: 'auto' }}>
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'rgba(255,255,255,0.8)',
                              fontSize: '0.85rem',
                              fontWeight: 500,
                              display: 'block',
                              mb: 0.5
                            }}
                          >
                            {design.framework}
                          </Typography>
                          <Chip
                            label={design.age}
                            size="small"
                            sx={{
                              backgroundColor: 'rgba(255,255,255,0.2)',
                              color: 'white',
                              fontWeight: 500
                            }}
                          />
                        </Box>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </motion.div>
              </Grid>
            ))}
          </Grid>

          <Box sx={{ textAlign: 'center', mt: 6, display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Typography
                onClick={() => navigate('/')}
                sx={{
                  display: 'inline-block',
                  px: 4,
                  py: 2,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  borderRadius: '50px',
                  fontWeight: 600,
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  backdropFilter: 'blur(10px)',
                  border: '2px solid rgba(255,255,255,0.3)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.3)',
                    transform: 'translateY(-2px)'
                  }
                }}
              >
                🏠 Tilbage til Forside
              </Typography>
            </motion.div>
            
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Typography
                onClick={() => navigate('/demo/validation')}
                sx={{
                  display: 'inline-block',
                  px: 4,
                  py: 2,
                  backgroundColor: 'rgba(76, 175, 80, 0.3)',
                  color: 'white',
                  borderRadius: '50px',
                  fontWeight: 600,
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  backdropFilter: 'blur(10px)',
                  border: '2px solid rgba(76, 175, 80, 0.5)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    backgroundColor: 'rgba(76, 175, 80, 0.4)',
                    transform: 'translateY(-2px)'
                  }
                }}
              >
                🧪 Test Alle Designs
              </Typography>
            </motion.div>
          </Box>
        </motion.div>
      </Container>
    </Box>
  )
}

export default HomepageGallery