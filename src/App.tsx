import React, { useEffect, useState, useCallback, useRef, lazy, Suspense } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
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
import { useTheme, alpha } from '@mui/material/styles'
import {
  ArrowLeft
} from 'lucide-react'

// Route page components are lazy-loaded so the home screen ships a small initial
// bundle and each section's code loads on demand.
const AlphabetGame = lazy(() => import('./components/alphabet/AlphabetGame'))
const AlphabetSelection = lazy(() => import('./components/alphabet/AlphabetSelection'))
const AlphabetLearning = lazy(() => import('./components/alphabet/AlphabetLearning'))
const MathGame = lazy(() => import('./components/math/MathGame'))
const MathSelection = lazy(() => import('./components/math/MathSelection'))
const NumberLearning = lazy(() => import('./components/math/NumberLearning'))
const MathOperationGame = lazy(() => import('./components/math/MathOperationGame'))
const ComparisonGame = lazy(() => import('./components/math/ComparisonGame'))
const HvadManglerGame = lazy(() => import('./components/math/HvadManglerGame'))
const FarverSelection = lazy(() => import('./components/farver/FarverSelection'))
const FarvejagtGame = lazy(() => import('./components/farver/FarvejagtGame'))
const RamFarvenGame = lazy(() => import('./components/farver/RamFarvenGame'))
const EnglishSelection = lazy(() => import('./components/english/EnglishSelection'))
const EnglishListenGame = lazy(() => import('./components/english/EnglishListenGame'))
const EnglishWordGame = lazy(() => import('./components/english/EnglishWordGame'))
const EnglishTranslateGame = lazy(() => import('./components/english/EnglishTranslateGame'))
const EnglishLearning = lazy(() => import('./components/english/EnglishLearning'))
const OrdlegSelection = lazy(() => import('./components/ordleg/OrdlegSelection'))
const LaesOrdetGame = lazy(() => import('./components/ordleg/LaesOrdetGame'))
const SpellingGame = lazy(() => import('./components/ordleg/SpellingGame'))
const SpeakWordGame = lazy(() => import('./components/ordleg/SpeakWordGame'))
const MemoryGame = lazy(() => import('./components/learning/MemoryGame'))
import UpdateBanner from './components/common/UpdateBanner'
import ThemeSelector from './components/common/ThemeSelector'
import ThemeScene from './components/common/scene/ThemeScene'
import ThemeMascot from './components/common/ThemeMascot'
import { useParallax } from './components/common/scene/useParallax'
import { useReducedMotion } from './hooks/useReducedMotion'
// Legacy audio system removed - using SimplifiedAudioProvider only
import { useViewportHeight } from './hooks/useViewportHeight'
// Demo system removed

// Simplified Audio System imports
import { SimplifiedAudioProvider } from './contexts/SimplifiedAudioContext'
import SimplifiedAudioPermission from './components/common/SimplifiedAudioPermission'
// import SimplifiedAudioTest from './components/test/SimplifiedAudioTest'
// import AudioSystemComparison from './components/test/AudioSystemComparison'


// Balloon Components
import BalloonBase from './components/common/balloon/BalloonBase'
import { ParticleEffects, createPopParticles, Particle } from './components/common/balloon/ParticleEffects'
import { useBalloonSound } from './components/common/balloon/SoundManager'
import LottieCharacter, { useCharacterState } from './components/common/LottieCharacter'
import { useUpdateChecker } from './hooks/useUpdateChecker'
import { useNativeAppFeel } from './hooks/useNativeAppFeel'
import { categoryThemes } from './config/categoryThemes'
import { sectionIconImages } from './assets/themes/icons'
import { BUILD_INFO } from './config/version'

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

// Home section cards — content/layout config; all styling comes from theme tokens
// (theme.categories[id]) at render time so a reskin remaps every card automatically.
type HomeCardId = 'alphabet' | 'math' | 'colors' | 'english' | 'ordleg'
const homeCards: Array<{
  id: HomeCardId
  route: string
  initial: { opacity: number; x?: number; y?: number }
  delay: number
}> = [
  { id: 'alphabet', route: '/alphabet', initial: { opacity: 0, x: -30 }, delay: 0 },
  { id: 'math', route: '/math', initial: { opacity: 0, y: -30 }, delay: 0.1 },
  { id: 'colors', route: '/farver', initial: { opacity: 0, x: 30 }, delay: 0.2 },
  { id: 'english', route: '/english', initial: { opacity: 0, y: 30 }, delay: 0.3 },
  { id: 'ordleg', route: '/ordleg', initial: { opacity: 0, x: 30 }, delay: 0.4 },
]

// Home Page Component
const HomePage = () => {
  const navigate = useNavigate()
  const theme = useTheme()
  const reduceMotion = useReducedMotion()
  // Parallax driver lives on the page root so the scene AND the mascot (separate planes)
  // share one synced offset via inherited CSS vars.
  const sceneRootRef = useRef<HTMLDivElement>(null)
  useParallax(sceneRootRef, { disabled: reduceMotion })
  // This theme has an authored world → use immersive treatments (glassy cards, world mascot).
  const immersive = theme.scene.layers.length > 0
  const darkScene = theme.scene.dark // dark backdrop (e.g. Rummet) → light title
  const welcomeCharacter = useCharacterState('wave')
  const { play, stopAll } = useBalloonSound()
  const [balloons, setBalloons] = useState<HomeBalloon[]>([])
  const [particles, setParticles] = useState<Particle[]>([])
  const [lastSpawnTime, setLastSpawnTime] = useState<number>(0)

  const balloonColors = theme.decor.balloonColors
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
      ref={sceneRootRef}
      className="interactive-area"
      sx={{
        position: 'relative',
        height: 'calc(var(--vh, 1vh) * 100)',
        background: `${theme.decor.pageBackground},\n${theme.decor.dots}`,
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
          background: theme.decor.rainbow,
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
      {/* Immersive theme world (parallax scene + ambient objects) — behind all content.
          Renders nothing for themes without an authored world (flat look). */}
      <ThemeScene />

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
        {/* Header with title and Welcome Character */}
        <Box sx={{ textAlign: 'center', mb: { xs: 1.5, md: 2 } }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
              <Typography
                variant="h1"
                sx={{
                  fontFamily: theme.titleFontFamily,
                  fontSize: { xs: '1.75rem', sm: '2.25rem', md: '2.75rem' },
                  fontWeight: 700,
                  // Dark worlds need a light title; otherwise the themed title colour.
                  color: darkScene ? '#FFFFFF' : theme.decor.titleColor,
                  // Title treatment: dark scenes get a glow + dark shadow for contrast;
                  // light immersive scenes get a soft white halo; flat themes keep the
                  // original subtle shadow.
                  textShadow: darkScene
                    ? '0 0 18px rgba(120,170,255,0.6), 0 2px 10px rgba(0,0,0,0.55)'
                    : immersive
                      ? '0 1px 0 rgba(255,255,255,0.7), 0 0 16px rgba(255,255,255,0.5), 0 3px 8px rgba(0,30,50,0.35)'
                      : `2px 2px 8px ${alpha(theme.decor.titleColor, 0.25)}`,
                  letterSpacing: '0.02em'
                }}
              >
                Børnelæring
              </Typography>
              {/* On immersive worlds the per-world mascot is the playful character, so the
                  generic welcome bear is hidden (it's off-theme e.g. underwater). */}
              {!immersive && (
                <motion.div
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.8, duration: 0.5 }}
                >
                  <LottieCharacter
                    character={welcomeCharacter.character}
                    state={welcomeCharacter.state}
                    size={80}
                    onClick={() => {
                      // Balloon easter-egg (previously on the logo)
                      spawnBalloons();
                      welcomeCharacter.wave();
                    }}
                  />
                </motion.div>
              )}
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
              justifyContent: 'center'
            }}
          >
            {homeCards.map((card) => {
              const cat = theme.categories[card.id]
              const content = categoryThemes[card.id]
              return (
                <Grid key={card.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <motion.div
                    initial={card.initial}
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    transition={{ duration: 0.6, delay: card.delay }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{ height: '100%' }}
                  >
                    <Card
                      onClick={() => navigate(card.route)}
                      sx={{
                        height: '100%',
                        minHeight: { xs: 120, sm: 150, md: 170 },
                        cursor: 'pointer',
                        border: '2px solid',
                        borderColor: cat.border,
                        display: 'flex',
                        flexDirection: 'column',
                        // Immersive worlds: frosted "ocean glass" so the scene shows through
                        // the cards (still high-contrast for the dark themed text/icons).
                        background: immersive
                          ? 'linear-gradient(135deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.46) 100%)'
                          : cat.cardSurface,
                        backdropFilter: immersive ? 'blur(16px) saturate(1.1)' : cat.cardBlur,
                        WebkitBackdropFilter: immersive ? 'blur(16px) saturate(1.1)' : cat.cardBlur,
                        '&:hover': {
                          borderColor: cat.hoverBorder,
                          boxShadow: `0 8px 32px ${alpha(cat.accent, 0.3)}`,
                          transform: 'translateY(-2px)'
                        },
                        transition: 'all 0.3s ease',
                        '@media (orientation: landscape)': {
                          minHeight: { xs: 110, sm: 130, md: 140 }
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
                        <Box sx={{ mb: { xs: 0.5, md: 1 } }}>
                          <Box
                            component="img"
                            src={sectionIconImages[card.id]}
                            alt=""
                            draggable={false}
                            sx={{
                              display: 'block',
                              mx: 'auto',
                              width: { xs: 58, sm: 64, md: 76 },
                              height: { xs: 58, sm: 64, md: 76 },
                              objectFit: 'contain',
                              mb: { xs: 0.5, md: 1 },
                              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.22))',
                              userSelect: 'none',
                            }}
                          />
                          <Typography
                            variant="h4"
                            sx={{
                              mb: 1,
                              fontWeight: 700,
                              fontSize: { xs: '1.5rem', md: '1.75rem' },
                              color: cat.accent
                            }}
                          >
                            {content.name}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </motion.div>
                </Grid>
              )
            })}

          </Grid>
        </Box>
      </Container>

      {/* Theme selector — collapsed corner control, overlays the page (no layout cost) */}
      <ThemeSelector />

      {/* Per-world mascot — sits on the sandy floor (bottom-left); tap to hear it speak and
          spawn its own bubble burst. Renders nothing for themes without a mascot. */}
      <ThemeMascot
        sx={{
          left: 'calc(env(safe-area-inset-left) + 6px)',
          bottom: 'calc(env(safe-area-inset-bottom) + 2px)',
          width: { xs: 128, sm: 156, md: 184 },
          height: { xs: 128, sm: 156, md: 184 },
        }}
      />

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
  const theme = useTheme()
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
        background: theme.decor.notFoundBackground,
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

// Simplified Navigation Audio Cleanup Component
const NavigationAudioCleanup: React.FC = () => {
  const location = useLocation()
  
  useEffect(() => {
    // Cleanup SimplifiedAudioController on route changes
    import('./utils/SimplifiedAudioController').then(({ simplifiedAudioController }) => {
      simplifiedAudioController.triggerNavigationCleanup()
    }).catch(() => {
      // Silent fail if module not available
    })
  }, [location.pathname])
  
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
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        padding: '3px 7px',
        borderRadius: '6px',
        backdropFilter: 'blur(6px)',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        opacity: 0.75,
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
  const theme = useTheme()
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
    <SimplifiedAudioProvider>
      <SimplifiedAudioPermission />
      <>
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
        {/* Legacy GlobalAudioPermission removed */}
        
        {/* Version Display - repositions to bottom-left when update available */}
        <VersionDisplay updateAvailable={updateStatus.updateAvailable || DEV_SHOW_UPDATE_BANNER} />
        
        <Suspense fallback={<Box sx={{ height: '100dvh', background: theme.decor.pageBackground }} />}>
        <Routes>
        {/* Home Routes */}
        <Route path="/" element={<HomePage />} />
        
        {/* Alphabet Routes */}
        <Route path="/alphabet" element={<AlphabetSelection />} />
        <Route path="/alphabet/learn" element={<AlphabetLearning />} />
        <Route path="/alphabet/quiz" element={<AlphabetGame />} />
        
        {/* Temporarily disabled for production build */}
        {/* <Route path="/audio-test" element={
          <SimplifiedAudioProvider>
            <SimplifiedAudioPermission />
            <SimplifiedAudioTest />
          </SimplifiedAudioProvider>
        } />
        <Route path="/audio-comparison" element={<AudioSystemComparison />} /> */}
        
        {/* Math Routes */}
        <Route path="/math" element={<MathSelection />} />
        <Route path="/math/counting" element={<MathGame />} />
        <Route path="/math/numbers" element={<NumberLearning />} />
        <Route path="/math/addition" element={<MathOperationGame operation="addition" />} />
        <Route path="/math/subtraction" element={<MathOperationGame operation="subtraction" />} />
        <Route path="/math/comparison" element={<ComparisonGame />} />
        <Route path="/math/patterns" element={<HvadManglerGame />} />
        
        {/* Farver Routes */}
        <Route path="/farver" element={<FarverSelection />} />
        <Route path="/farver/jagt" element={<FarvejagtGame />} />
        <Route path="/farver/ram-farven" element={<RamFarvenGame />} />

        {/* English Routes */}
        <Route path="/english" element={<EnglishSelection />} />
        <Route path="/english/listen" element={<EnglishListenGame />} />
        <Route path="/english/word" element={<EnglishWordGame />} />
        <Route path="/english/translate" element={<EnglishTranslateGame />} />
        <Route path="/english/learn" element={<EnglishLearning />} />

        {/* Ordleg Routes */}
        <Route path="/ordleg" element={<OrdlegSelection />} />
        <Route path="/ordleg/read" element={<LaesOrdetGame />} />
        <Route path="/ordleg/spelling" element={<SpellingGame />} />
        <Route path="/ordleg/mic" element={<SpeakWordGame />} />
        
        {/* Learning Routes */}
        <Route path="/learning/memory/:type" element={<MemoryGame />} />

        {/* 404 Not Found */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
      </>
    </SimplifiedAudioProvider>
  )
}

export default App