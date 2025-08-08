import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { logIOSIssue } from './utils/remoteConsole'
import { deviceInfo } from './utils/deviceDetection'
import { 
  Container, 
  Grid, 
  Card, 
  CardContent, 
  Button, 
  Typography, 
  Box
} from '@mui/material'
import { 
  ArrowLeft,
  BookOpen,
  Play,
  Star
} from 'lucide-react'

// Import all page components
import AlphabetGame from './components/alphabet/AlphabetGame'
import AlphabetGameSimplified from './components/alphabet/AlphabetGameSimplified'
import AlphabetSelection from './components/alphabet/AlphabetSelection'
import AlphabetLearning from './components/alphabet/AlphabetLearning'
import MathGame from './components/math/MathGame'
import MathSelection from './components/math/MathSelection'
import NumberLearning from './components/math/NumberLearning'
import AdditionGame from './components/math/AdditionGame'
import ComparisonGame from './components/math/ComparisonGame'
import FarverSelection from './components/farver/FarverSelection'
import FarvejagtGame from './components/farver/FarvejagtGame'
import RamFarvenGame from './components/farver/RamFarvenGame'
import MemoryGame from './components/learning/MemoryGame'
import ErrorDashboard from './components/admin/ErrorDashboard'
import UpdateBanner from './components/common/UpdateBanner'
import GlobalAudioPermission from './components/common/GlobalAudioPermission'
import { AudioPermissionProvider } from './contexts/AudioPermissionContext'
import { AudioProvider, useAudioContext } from './contexts/AudioContext'
import { useViewportHeight } from './hooks/useViewportHeight'
import DemoPage from './components/demo/DemoPage'

// Simplified Audio System imports
import { SimplifiedAudioProvider } from './contexts/SimplifiedAudioContext'
import SimplifiedAudioPermission from './components/common/SimplifiedAudioPermission'


// Balloon Components
import BalloonBase from './components/common/balloon/BalloonBase'
import { ParticleEffects, createPopParticles, Particle } from './components/common/balloon/ParticleEffects'
import { useBalloonSound } from './components/common/balloon/SoundManager'
import LottieCharacter, { useCharacterState } from './components/common/LottieCharacter'
import { useUpdateChecker } from './hooks/useUpdateChecker'
import { useNativeAppFeel } from './hooks/useNativeAppFeel'
import { LogoLarge } from './components/common/Logo'
import { categoryThemes } from './config/categoryThemes'
import { BUILD_INFO } from './config/version'

// Admin redirect component for query parameter support
const AdminRedirectChecker = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate()
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('admin') === 'errors') {
      navigate('/admin/errors', { replace: true })
    }
  }, [navigate])
  
  return <>{children}</>
}

// Balloon interface
interface HomeBalloon {
  id: string;
  x: number;
  y: number;
  color: string;
  size: number;
  content: string;
  isPopped: boolean;
  angle: number; // Movement angle - required for direction
}

// Home Page Component
const HomePage = () => {
  const navigate = useNavigate()
  const welcomeCharacter = useCharacterState('wave')
  const { play, stopAll } = useBalloonSound()
  const [balloons, setBalloons] = useState<HomeBalloon[]>([])
  const [particles, setParticles] = useState<Particle[]>([])
  const [lastSpawnTime, setLastSpawnTime] = useState<number>(0)
  
  const balloonColors = ['#EF4444', '#3B82F6', '#10B981', '#FDE047', '#8B5CF6', '#F97316', '#EC4899']
  const balloonContents = ['A', 'B', 'C', 'Å', '1', '2', '3', '4', '5']
  
  // Dynamic angle calculation based on logo viewport position
  const calculateDynamicAngle = (logoRect: DOMRect, balloonIndex: number): number => {
    const viewportHeight = window.innerHeight;
    const logoRelativeY = logoRect.top / viewportHeight;
    
    // Circle angles: 0=right, π/2=down, π=left, 3π/2=up
    let minAngle: number;
    let maxAngle: number;
    
    if (logoRelativeY < 0.25) {
      // Logo in top 25% - spawn mostly downward (45° to 135° = π/4 to 3π/4)
      minAngle = Math.PI * 0.25;  // 45° (down-right)
      maxAngle = Math.PI * 0.75;  // 135° (down-left)
    } else if (logoRelativeY > 0.75) {
      // Logo in bottom 25% - allow upward spawning (315° to 45° = 7π/4 to π/4, wrapping around)
      // Use two ranges: 315°-360° and 0°-45°
      if (Math.random() < 0.5) {
        minAngle = Math.PI * 1.75; // 315° (up-right)
        maxAngle = Math.PI * 2;    // 360° (right)
      } else {
        minAngle = 0;              // 0° (right)
        maxAngle = Math.PI * 0.25; // 45° (down-right)
      }
    } else {
      // Logo in middle 50% - wider downward arc (30° to 150° = π/6 to 5π/6)
      minAngle = Math.PI * 0.17;  // 30° (down-right)
      maxAngle = Math.PI * 0.83;  // 150° (down-left)
    }
    
    // More random angle distribution instead of even spacing
    const angleRange = maxAngle - minAngle;
    
    // Create clustered randomness for more natural scattering
    let baseAngle: number;
    if (Math.random() < 0.7) {
      // 70% random within the allowed range
      baseAngle = minAngle + Math.random() * angleRange;
    } else {
      // 30% use balloon index for some structure
      baseAngle = minAngle + (balloonIndex / 10) * angleRange;
    }
    
    const randomOffset = (Math.random() - 0.5) * 0.4; // ±36° randomness (increased)
    const finalAngle = baseAngle + randomOffset;
    
    return finalAngle;
  };

  const spawnBalloons = useCallback((logoElement?: HTMLElement) => {
    // Prevent too rapid spawning (cooldown of 500ms)
    const now = Date.now();
    if (now - lastSpawnTime < 500) {
      return;
    }
    setLastSpawnTime(now);
    
    let centerX, centerY, logoRect;
    
    if (logoElement) {
      // Get actual logo position from DOM element
      logoRect = logoElement.getBoundingClientRect();
      centerX = logoRect.left + logoRect.width / 2;
      centerY = logoRect.top + logoRect.height / 2;
    } else {
      // Fallback to window center
      centerX = window.innerWidth / 2;
      centerY = window.innerHeight / 2;
      logoRect = new DOMRect(centerX - 100, centerY - 100, 200, 200); // Fallback rect
    }
    
    const newBalloons: HomeBalloon[] = [];
    const balloonCount = 10; // Always spawn exactly 10 balloons
    
    for (let i = 0; i < balloonCount; i++) {
      // Calculate dynamic angle based on viewport position
      const angle = calculateDynamicAngle(logoRect, i);
      
      // Calculate balloon size - bigger in general
      const balloonSize = Math.random() * 40 + 80; // 80-120px (was 60-90px)
      
      // Much wider scattering throughout the entire viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const maxViewportDistance = Math.min(viewportWidth, viewportHeight) * 0.6; // Use 60% of viewport
      
      const minDistance = 80; // Start further out
      const maxDistance = Math.max(400, maxViewportDistance); // Much larger maximum distance
      
      // Three distance zones for full viewport coverage
      let spawnDistance: number;
      const zoneRandom = Math.random();
      if (zoneRandom < 0.3) {
        // 30% close balloons (80-200px)
        spawnDistance = minDistance + Math.random() * 120;
      } else if (zoneRandom < 0.7) {
        // 40% medium balloons (200-400px)
        spawnDistance = 200 + Math.random() * 200;
      } else {
        // 30% far balloons (400px to viewport edge)
        spawnDistance = 400 + Math.random() * (maxDistance - 400);
      }
      
      // Calculate spawn position around logo center
      const offsetX = Math.cos(angle) * spawnDistance;
      const offsetY = Math.sin(angle) * spawnDistance;
      
      // Position balloon with better spacing
      const startX = centerX + offsetX - balloonSize / 2;
      const startY = centerY + offsetY - balloonSize / 2;
      
      newBalloons.push({
        id: `home-${Date.now()}-${Math.random()}-${i}`, // Unique ID to prevent duplicates
        x: startX,
        y: startY,
        color: balloonColors[Math.floor(Math.random() * balloonColors.length)],
        size: balloonSize, // Use the pre-calculated size
        content: balloonContents[Math.floor(Math.random() * balloonContents.length)],
        isPopped: false,
        angle: angle // Store the calculated movement angle
      });
    }
    
    setBalloons(newBalloons);
  }, [lastSpawnTime]);

  const popBalloon = useCallback((id: string, x: number, y: number) => {
    const balloon = balloons.find(b => b.id === id);
    
    if (!balloon || balloon.isPopped) {
      return;
    }

    // Mark balloon as popped and remove immediately for instant visual feedback
    setBalloons(prev => prev.filter(b => b.id !== id));

    // Create particle effect
    const newParticles = createPopParticles(x, y, balloon.color);
    setParticles(prev => [...prev, ...newParticles]);

    // Play sound independently - fire and forget
    play('sharp-pop-328170').catch(() => {
      // Silently handle any errors
    });
  }, [balloons, play]);

  const removeParticle = useCallback((particleId: string) => {
    setParticles(prev => prev.filter(p => p.id !== particleId));
  }, []);
  
  React.useEffect(() => {
    // Welcome animation sequence
    const timer = setTimeout(() => {
      welcomeCharacter.wave()
    }, 1000)
    return () => clearTimeout(timer)
  }, [])
  

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      stopAll();
    };
  }, [stopAll])

  return (
    <Box 
      className="interactive-area"
      sx={{ 
        position: 'relative',
        height: 'calc(var(--vh, 1vh) * 100)',
        background: `
          #F8FAFC,
          radial-gradient(circle at 15% 25%, rgba(255, 255, 255, 0.8) 25px, transparent 26px),
          radial-gradient(circle at 85% 15%, rgba(255, 255, 255, 0.8) 30px, transparent 31px),
          radial-gradient(circle at 25% 70%, rgba(255, 255, 255, 0.8) 28px, transparent 29px),
          radial-gradient(circle at 75% 75%, rgba(255, 255, 255, 0.8) 22px, transparent 23px)
        `,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
        /* Enhanced native app properties */
        touchAction: 'pan-x pan-down pinch-zoom',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
        /* Rainbow arc background */
        '&::before': {
          content: '""',
          position: 'absolute',
          bottom: -100,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '150%',
          height: 400,
          background: 'conic-gradient(from 0deg at 50% 100%, #FF0000 0deg, #FF8C00 51deg, #FFD700 102deg, #32CD32 153deg, #1E90FF 204deg, #9932CC 255deg, #8B00FF 306deg, #FF0000 360deg)',
          borderRadius: '50%',
          opacity: 0.9,
          animation: 'rainbowShimmer 8s ease-in-out infinite alternate',
          zIndex: 0
        },
        '@keyframes rainbowShimmer': {
          '0%': { 
            opacity: 0.8,
            transform: 'translateX(-50%) scale(1)'
          },
          '100%': { 
            opacity: 1,
            transform: 'translateX(-50%) scale(1.05)'
          }
        },
      }}
    >
      <Container 
        maxWidth="xl" 
        sx={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          py: { xs: 2, md: 3 },
          position: 'relative',
          zIndex: 2
        }}
      >
        {/* Header with Logo and Welcome Character */}
        <Box sx={{ textAlign: 'center', mb: { xs: 3, md: 4 } }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* App Logo */}
            <Box sx={{ mb: 2, position: 'relative' }}>
              <LogoLarge
                onClick={(e) => {
                  // Spawn balloons when logo is clicked
                  const logoElement = e.currentTarget as HTMLElement;
                  spawnBalloons(logoElement);
                  welcomeCharacter.wave();
                }}
                sx={{
                  cursor: 'pointer',
                  '&:hover': {
                    transform: 'scale(1.05)',
                    filter: 'drop-shadow(0 8px 16px rgba(139, 92, 246, 0.4))'
                  }
                }}
              />
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
              <Typography 
                variant="h1" 
                sx={{ 
                  fontSize: { xs: '2rem', sm: '2.5rem', md: '3.5rem' },
                  fontWeight: 700,
                  color: '#8B5CF6',
                  textShadow: '2px 2px 8px rgba(139, 92, 246, 0.25)',
                  letterSpacing: '0.02em'
                }}
              >
                Børnelæring
              </Typography>
              <motion.div
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.5 }}
              >
                <LottieCharacter
                  character={welcomeCharacter.character}
                  state={welcomeCharacter.state}
                  size={80}
                  onClick={welcomeCharacter.wave}
                />
              </motion.div>
            </Box>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              <Play size={20} color="#F87171" />
              <Typography 
                variant="h5" 
                sx={{ 
                  fontSize: { xs: '1rem', sm: '1.25rem', md: '1.5rem' },
                  color: '#F87171',
                  fontWeight: 600
                }}
              >
                Lær med sjove spil!
              </Typography>
              <BookOpen size={20} color="#F87171" />
            </Box>
          </motion.div>
        </Box>

        {/* Main Content */}
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center',
          minHeight: 0
        }}>
          <Grid 
            container 
            spacing={{ xs: 2, md: 3 }} 
            sx={{ 
              mb: { xs: 2, md: 3 },
              height: { xs: 'auto', md: '60%' },
              maxHeight: { xs: '500px', md: '600px' }
            }}
          >
            {/* Alphabet Card */}
            <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card 
                  onClick={() => navigate('/alphabet')}
                  sx={{ 
                    height: '100%',
                    minHeight: { xs: 180, sm: 220, md: 240 },
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: categoryThemes.alphabet.borderColor,
                    display: 'flex',
                    flexDirection: 'column',
                    background: `linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(227, 242, 253, 0.9) 100%)`,
                    backdropFilter: 'blur(15px)',
                    '&:hover': {
                      borderColor: categoryThemes.alphabet.hoverBorderColor,
                      boxShadow: '0 8px 32px rgba(25, 118, 210, 0.3)',
                      transform: 'translateY(-2px)'
                    },
                    transition: 'all 0.3s ease',
                    // Orientation specific adjustments
                    '@media (orientation: landscape)': {
                      minHeight: { xs: 160, sm: 180, md: 200 }
                    }
                  }}
                >
                  <CardContent 
                    sx={{ 
                      p: { xs: 2, md: 3 },
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      textAlign: 'center'
                    }}
                  >
                    <Box sx={{ mb: 2 }}>
                      <Typography sx={{ fontSize: categoryThemes.alphabet.iconSize, mb: 2 }}>
                        {categoryThemes.alphabet.icon}
                      </Typography>
                      <Typography 
                        variant="h4" 
                        sx={{ 
                          mb: 1, 
                          fontWeight: 700,
                          fontSize: { xs: '1.5rem', md: '1.75rem' },
                          color: categoryThemes.alphabet.accentColor
                        }}
                      >
                        {categoryThemes.alphabet.name}
                      </Typography>
                      <Typography 
                        variant="body1" 
                        color="text.secondary" 
                        sx={{ 
                          fontSize: { xs: '0.875rem', md: '1rem' }
                        }}
                      >
                        {categoryThemes.alphabet.description}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>

            {/* Math Card */}
            <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
              <motion.div
                initial={{ opacity: 0, y: -30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card 
                  onClick={() => navigate('/math')}
                  sx={{ 
                    height: '100%',
                    minHeight: { xs: 180, sm: 220, md: 240 },
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: categoryThemes.math.borderColor,
                    display: 'flex',
                    flexDirection: 'column',
                    background: `linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(243, 229, 245, 0.9) 100%)`,
                    backdropFilter: 'blur(15px)',
                    '&:hover': {
                      borderColor: categoryThemes.math.hoverBorderColor,
                      boxShadow: '0 8px 32px rgba(156, 39, 176, 0.3)',
                      transform: 'translateY(-2px)'
                    },
                    transition: 'all 0.3s ease',
                    // Orientation specific adjustments
                    '@media (orientation: landscape)': {
                      minHeight: { xs: 160, sm: 180, md: 200 }
                    }
                  }}
                >
                  <CardContent 
                    sx={{ 
                      p: { xs: 2, md: 3 },
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      textAlign: 'center'
                    }}
                  >
                    <Box sx={{ mb: 2 }}>
                      <Typography sx={{ fontSize: categoryThemes.math.iconSize, mb: 2 }}>
                        {categoryThemes.math.icon}
                      </Typography>
                      <Typography 
                        variant="h4" 
                        sx={{ 
                          mb: 1, 
                          fontWeight: 700,
                          fontSize: { xs: '1.5rem', md: '1.75rem' },
                          color: categoryThemes.math.accentColor
                        }}
                      >
                        {categoryThemes.math.name}
                      </Typography>
                      <Typography 
                        variant="body1" 
                        color="text.secondary" 
                        sx={{ 
                          fontSize: { xs: '0.875rem', md: '1rem' }
                        }}
                      >
                        {categoryThemes.math.description}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>

            {/* Farver Card */}
            <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card 
                  onClick={() => navigate('/farver')}
                  sx={{ 
                    height: '100%',
                    minHeight: { xs: 180, sm: 220, md: 240 },
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: categoryThemes.colors.borderColor,
                    display: 'flex',
                    flexDirection: 'column',
                    background: `linear-gradient(135deg, rgba(255, 243, 224, 0.95) 0%, rgba(255, 224, 178, 0.95) 100%)`,
                    backdropFilter: 'blur(10px)',
                    '&:hover': {
                      borderColor: categoryThemes.colors.hoverBorderColor,
                      boxShadow: '0 8px 32px rgba(230, 81, 0, 0.3)',
                      transform: 'translateY(-2px)'
                    },
                    transition: 'all 0.3s ease',
                    // Orientation specific adjustments
                    '@media (orientation: landscape)': {
                      minHeight: { xs: 160, sm: 180, md: 200 }
                    }
                  }}
                >
                  <CardContent 
                    sx={{ 
                      p: { xs: 2, md: 3 },
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      textAlign: 'center'
                    }}
                  >
                    <Box sx={{ mb: 2 }}>
                      <Typography sx={{ fontSize: categoryThemes.colors.iconSize, mb: 2 }}>
                        {categoryThemes.colors.icon}
                      </Typography>
                      <Typography 
                        variant="h4" 
                        sx={{ 
                          mb: 1, 
                          fontWeight: 700,
                          fontSize: { xs: '1.5rem', md: '1.75rem' },
                          color: categoryThemes.colors.accentColor
                        }}
                      >
                        {categoryThemes.colors.name}
                      </Typography>
                      <Typography 
                        variant="body1" 
                        color="text.secondary" 
                        sx={{ 
                          fontSize: { xs: '0.875rem', md: '1rem' }
                        }}
                      >
                        {categoryThemes.colors.description}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>

          </Grid>

          {/* Bottom Decoration */}
          <Box sx={{ textAlign: 'center', mt: 'auto', py: 2 }}>
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              <Star size={48} color="#ff9800" />
            </motion.div>
          </Box>
        </Box>
      </Container>
      
      {/* Balloons */}
      {balloons.map((balloon) => (
        <BalloonBase
          key={balloon.id}
          id={balloon.id}
          x={balloon.x}
          y={balloon.y}
          size={balloon.size}
          color={balloon.color}
          content={balloon.content}
          isPopped={balloon.isPopped}
          onClick={popBalloon}
          floatDuration={30} // 30 seconds total animation - longer so balloons naturally exit viewport
          movementAngle={balloon.angle} // Pass the calculated movement angle
        />
      ))}

      {/* Particle Effects */}
      <ParticleEffects particles={particles} onParticleComplete={removeParticle} />
    </Box>
  )
}

// 404 Not Found Component
const NotFoundPage = () => {
  const navigate = useNavigate()
  const sadCharacter = useCharacterState('encourage')
  
  React.useEffect(() => {
    sadCharacter.encourage()
  }, [])

  return (
    <Box 
      sx={{ 
        height: 'calc(var(--vh, 1vh) * 100)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #dbeafe 0%, #e9d5ff 50%, #fce7f3 100%)',
        overflow: 'hidden'
      }}
    >
      <Container maxWidth="sm" sx={{ textAlign: 'center' }}>
        <Box sx={{ mb: 3 }}>
          <LottieCharacter
            character={sadCharacter.character}
            state={sadCharacter.state}
            size={120}
            onClick={sadCharacter.encourage}
          />
        </Box>
        <Typography variant="h1" sx={{ fontSize: '4rem', mb: 2 }}>🎈</Typography>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>
          Hovsa! 🤔
        </Typography>
        <Typography variant="body1" sx={{ mb: 4, color: 'text.secondary', fontSize: '1.2rem' }}>
          Denne side findes ikke 🔍
        </Typography>
        <Button 
          variant="contained" 
          color="primary" 
          size="large"
          startIcon={<ArrowLeft size={24} />}
          onClick={() => navigate('/')}
          sx={{ py: 1.5, px: 3, fontSize: '1.1rem', borderRadius: 3 }}
        >
          🏠 Hjem
        </Button>
      </Container>
    </Box>
  )
}

// Navigation Audio Cleanup Component
const NavigationAudioCleanup: React.FC = () => {
  const location = useLocation()
  const audioContext = useAudioContext()
  const previousPathRef = useRef<string>('')
  
  useEffect(() => {
    const currentPath = location.pathname
    const previousPath = previousPathRef.current
    
    console.log('🎵 NavigationAudioCleanup: Route change detected, triggering audio cleanup', {
      fromPath: previousPath,
      toPath: currentPath,
      timestamp: new Date().toISOString(),
      isIOS: navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad'),
      isPWA: window.matchMedia('(display-mode: standalone)').matches,
      audioContextState: audioContext.isPlaying ? 'playing' : 'idle',
      documentFocus: document.hasFocus(),
      documentVisible: !document.hidden,
      referrer: document.referrer,
      userAgent: navigator.userAgent
    })
    
    // Standard audio cleanup
    audioContext.triggerNavigationCleanup()
    
    // Reset entry audio for sections when leaving them
    if (previousPath) {
      // Import entryAudioManager dynamically to avoid circular dependencies
      import('./utils/entryAudioManager').then(({ entryAudioManager }) => {
        // Determine section paths to reset based on navigation
        const getSectionPath = (path: string): string => {
          if (path.startsWith('/alphabet')) return '/alphabet'
          if (path.startsWith('/math')) return '/math'
          if (path.startsWith('/farver')) return '/farver'
          if (path.startsWith('/learning/memory')) return '/learning/memory'
          return path
        }
        
        const previousSection = getSectionPath(previousPath)
        const currentSection = getSectionPath(currentPath)
        
        // If leaving a section, reset its entry audio for future visits
        if (previousSection !== currentSection && ['/alphabet', '/math', '/farver', '/learning/memory'].includes(previousSection)) {
          console.log(`🎵 NavigationAudioCleanup: Leaving section "${previousSection}", resetting entry audio`)
          entryAudioManager.resetSection(previousSection)
        }
      }).catch(error => {
        console.error('🎵 NavigationAudioCleanup: Error importing entryAudioManager:', error)
      })
    }
    
    // Update previous path for next navigation
    previousPathRef.current = currentPath
  }, [location.pathname, audioContext])
  
  return null // This component only handles side effects
}

// Version Display Component
interface VersionDisplayProps {
  updateAvailable?: boolean
}

const VersionDisplay: React.FC<VersionDisplayProps> = ({ updateAvailable = false }) => {
  const buildDateTime = new Date(BUILD_INFO.buildTime)
  
  const releaseDate = buildDateTime.toLocaleDateString('da-DK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
  
  const releaseTime = buildDateTime.toLocaleTimeString('da-DK', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  return (
    <Box
      sx={{
        position: 'fixed',
        // Dynamic positioning: bottom-left when update available, bottom-right otherwise
        bottom: 8,
        right: updateAvailable ? 'auto' : 8,
        left: updateAvailable ? 8 : 'auto',
        zIndex: 1001, // Just above update banner (1000) but below modals
        fontSize: { xs: '0.65rem', sm: '0.75rem' }, // Responsive font size
        color: 'rgba(0, 0, 0, 0.6)',
        textAlign: updateAvailable ? 'left' : 'right',
        lineHeight: 1.2,
        pointerEvents: 'none',
        userSelect: 'none',
        fontFamily: 'monospace',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        padding: '4px 8px',
        borderRadius: '4px',
        backdropFilter: 'blur(4px)',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        // Smooth transition animation
        transition: 'all 0.3s ease-in-out',
        // Ensure visibility on mobile
        maxWidth: '120px'
      }}
    >
      <Box component="div" sx={{ fontWeight: 600 }}>v{BUILD_INFO.version}</Box>
      <Box component="div" sx={{ fontSize: { xs: '0.55rem', sm: '0.65rem' } }}>
        {releaseDate} {releaseTime}
      </Box>
    </Box>
  )
}

function App() {
  // Initialize viewport height for iOS
  useViewportHeight()
  
  // Initialize update checker
  const updateStatus = useUpdateChecker()
  
  // Initialize native app feel optimizations
  useNativeAppFeel()
  
  // DEV MODE: Set to true to test update banner styling
  // This allows you to see and adjust the UpdateBanner without waiting for a real update
  const DEV_SHOW_UPDATE_BANNER = false // Change to true to test the banner
  const DEV_SHOW_APPLYING_STATE = false // Change to true to test the "applying" state
  
  useEffect(() => {
    // Initialize remote console and log device info
    
    // Log any iOS-specific initialization
    if (deviceInfo.isIOS) {
      logIOSIssue('App Initialization', 'iOS device detected, enhanced debugging active')
    }
  }, [])

  return (
    <AudioPermissionProvider>
      <AudioProvider>
        {/* Navigation Audio Cleanup - handles React Router navigation */}
        <NavigationAudioCleanup />
        
        {/* Update Button - shown in lower right when update available */}
        <UpdateBanner
          show={updateStatus.updateAvailable || DEV_SHOW_UPDATE_BANNER}
          onUpdate={DEV_SHOW_UPDATE_BANNER ? () => {
          } : updateStatus.applyUpdate}
          isApplying={DEV_SHOW_APPLYING_STATE}
        />
        
        {/* Global Audio Permission System */}
        <GlobalAudioPermission />
        
        {/* Version Display - repositions to bottom-left when update available */}
        <VersionDisplay updateAvailable={updateStatus.updateAvailable || DEV_SHOW_UPDATE_BANNER} />
        
        <Routes>
        {/* Home Routes */}
        <Route path="/" element={
          <AdminRedirectChecker>
            <HomePage />
          </AdminRedirectChecker>
        } />
        
        {/* Alphabet Routes */}
        <Route path="/alphabet" element={<AlphabetSelection />} />
        <Route path="/alphabet/learn" element={<AlphabetLearning />} />
        <Route path="/alphabet/quiz" element={<AlphabetGame />} />
        
        {/* Simplified Audio Test Routes */}
        <Route path="/alphabet/quiz-simplified" element={
          <SimplifiedAudioProvider>
            <SimplifiedAudioPermission />
            <AlphabetGameSimplified />
          </SimplifiedAudioProvider>
        } />
        
        {/* Math Routes */}
        <Route path="/math" element={<MathSelection />} />
        <Route path="/math/counting" element={<MathGame />} />
        <Route path="/math/numbers" element={<NumberLearning />} />
        <Route path="/math/addition" element={<AdditionGame />} />
        <Route path="/math/comparison" element={<ComparisonGame />} />
        
        {/* Farver Routes */}
        <Route path="/farver" element={<FarverSelection />} />
        <Route path="/farver/jagt" element={<FarvejagtGame />} />
        <Route path="/farver/ram-farven" element={<RamFarvenGame />} />
        
        {/* Learning Routes */}
        <Route path="/learning/memory/:type" element={<MemoryGame />} />
        
        {/* Admin Routes */}
        <Route path="/admin/errors" element={<ErrorDashboard />} />
        
        {/* Legacy redirect for old admin access */}
        <Route path="/admin" element={<Navigate to="/admin/errors" replace />} />
        
        {/* Demo Routes */}
        <Route path="/demo" element={<DemoPage />} />
        
        {/* 404 Not Found */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </AudioProvider>
    </AudioPermissionProvider>
  )
}

export default App