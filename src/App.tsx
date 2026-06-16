import React, { useEffect, useState, useRef, lazy, Suspense } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { logIOSIssue } from './utils/remoteConsole'
import { deviceInfo } from './utils/deviceDetection'
import {
  Container,
  Card,
  CardContent,
  Button,
  Typography,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
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
const FarveQuizGame = lazy(() => import('./components/farver/FarveQuizGame'))
const NuancerGame = lazy(() => import('./components/farver/NuancerGame'))
const FarverLearning = lazy(() => import('./components/farver/FarverLearning'))
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
const StickerAlbum = lazy(() => import('./components/hub/StickerAlbum'))
// Hidden, off-menu internal tool — audition Danish TTS voices. Throwaway (tmp-prd-voicelab.md).
const VoiceLab = lazy(() => import('./components/voicelab/VoiceLab'))
import UpdateBanner from './components/common/UpdateBanner'
import VoiceOverridePanel from './components/voicelab/VoiceOverridePanel'
import ThemeSelector from './components/common/ThemeSelector'
import PersistentWorld from './components/common/scene/PersistentWorld'
import ThemeMascot from './components/common/ThemeMascot'
// Legacy audio system removed - using SimplifiedAudioProvider only
import { useViewportHeight } from './hooks/useViewportHeight'
// Demo system removed

// Simplified Audio System imports
import { SimplifiedAudioProvider } from './contexts/SimplifiedAudioContext'
import SimplifiedAudioPermission from './components/common/SimplifiedAudioPermission'
// import SimplifiedAudioTest from './components/test/SimplifiedAudioTest'
// import AudioSystemComparison from './components/test/AudioSystemComparison'


import LottieCharacter, { useCharacterState } from './components/common/LottieCharacter'
import { useUpdateChecker } from './hooks/useUpdateChecker'
import { useNativeAppFeel } from './hooks/useNativeAppFeel'
import { categoryThemes } from './config/categoryThemes'
import { useProgress } from './hooks/useProgress'
import { progressStore } from './services/progressStore'
import { sfx } from './services/sfxClient'
import { simplifiedAudioController } from './utils/SimplifiedAudioController'
import { totalStickerCount } from './config/stickers'
import { sectionIconImages } from './assets/themes/icons'
import appLogo from './assets/logo.webp'
import { BUILD_INFO } from './config/version'

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
  // This theme has an authored world → use immersive treatments (glassy cards). The world
  // itself (parallax scene + ambient + mascot) is rendered once, app-wide, by <PersistentWorld/>.
  const immersive = theme.scene.layers.length > 0
  const darkScene = theme.scene.dark // dark backdrop (e.g. Rummet) → light title
  const welcomeCharacter = useCharacterState('wave')
  const { state: progress } = useProgress()
  const stickersOwned = Object.keys(progress.stickers.collected).length
  const stickersTotal = totalStickerCount()
  const albumFill = stickersTotal > 0 ? stickersOwned / stickersTotal : 0

  React.useEffect(() => {
    // Welcome animation sequence
    const timer = setTimeout(() => {
      welcomeCharacter.wave()
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <Box
      className="interactive-area"
      sx={{
        position: 'relative',
        height: 'calc(var(--vh, 1vh) * 100)',
        // Immersive skins: transparent so the app-wide <PersistentWorld/> scene shows through.
        // Flat skins keep their own page background + dots (and the rainbow arc below).
        background: immersive ? 'transparent' : `${theme.decor.pageBackground},\n${theme.decor.dots}`,
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
        /* Rainbow arc background — only for flat (non-immersive) skins. Immersive worlds
           supply their own backdrop via <ThemeScene/>, so the arc is hidden to avoid a
           rainbow/light flash before a themed (esp. dark) scene loads on reload. */
        '&::before': {
          content: '""',
          display: immersive ? 'none' : 'block',
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
        {/* Header row: brand lockup (left) + theme selector (right), bounded by the same
            Container margins as the cards below — so they line up with the card grid edges.
            Explicit position+zIndex so the row (and the selector's drop-down popover) reliably
            paints ABOVE the card grid below — the cards use backdrop-filter, which on WebKit
            otherwise paints over siblings that lack their own stacking context. */}
        <Box sx={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: { xs: 1.5, md: 2 } }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* Brand lockup: logo emblem + themed wordmark as one balanced unit. */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.25, md: 2 } }}>
              <Box
                component="img"
                src={appLogo}
                alt=""
                draggable={false}
                sx={{
                  width: { xs: 44, sm: 52, md: 60 },
                  height: { xs: 44, sm: 52, md: 60 },
                  borderRadius: '24%',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                  userSelect: 'none',
                  flexShrink: 0,
                }}
              />
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
            </Box>
          </motion.div>

          {/* Theme selector — right side of the header row, aligned with the card grid edge */}
          <ThemeSelector />
        </Box>

        {/* Main Content */}
        <Box sx={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minHeight: 0
        }}>
          {/* Same compact card template as the section menus (GameSelectionLayout): a centred
              grid of small, capped cards with a fixed 16px gap — identical dimensions. */}
          <Box
            sx={{
              mb: { xs: 2, md: 3 },
              width: '100%',
              maxWidth: 820,
              mx: 'auto',
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
              gridAutoRows: 'auto',
              gap: '16px',
              justifyItems: 'center',
              alignItems: 'center',
              '@media (orientation: landscape)': { gridTemplateColumns: 'repeat(3, 1fr)' }
            }}
          >
            {homeCards.map((card) => {
              const cat = theme.categories[card.id]
              const content = categoryThemes[card.id]
              return (
                <motion.div
                    key={card.id}
                    initial={card.initial}
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    transition={{ duration: 0.6, delay: card.delay }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
                  >
                    <Card
                      onClick={() => navigate(card.route)}
                      sx={{
                        width: '100%',
                        maxWidth: { xs: 260, md: 300 },
                        aspectRatio: '16 / 10',
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
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <CardContent
                        sx={{
                          p: { xs: 1, md: 1.5 },
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center',
                          gap: { xs: 0.5, md: 0.75 }
                        }}
                      >
                        <Box
                          component="img"
                          src={sectionIconImages[card.id]}
                          alt=""
                          draggable={false}
                          sx={{
                            display: 'block',
                            width: { xs: 42, sm: 48, md: 56 },
                            height: { xs: 42, sm: 48, md: 56 },
                            objectFit: 'contain',
                            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.22))',
                            userSelect: 'none',
                          }}
                        />
                        <Typography
                          sx={{
                            fontWeight: 700,
                            fontSize: 'clamp(0.85rem, 2.4vh, 1.2rem)',
                            lineHeight: 1.1,
                            color: cat.accent
                          }}
                        >
                          {content.name}
                        </Typography>
                      </CardContent>
                    </Card>
                  </motion.div>
              )
            })}

            {/* Reward hub — the album entry. A "book that fills" + lifetime stars; reads the
                shared progress store so it grows across sessions (Overhaul Foundation §2). */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
              >
                <Card
                  onClick={() => navigate('/album')}
                  sx={{
                    width: '100%',
                    maxWidth: { xs: 260, md: 300 },
                    aspectRatio: '16 / 10',
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: alpha('#FFB300', 0.7),
                    display: 'flex',
                    flexDirection: 'column',
                    background: immersive
                      ? 'linear-gradient(135deg, rgba(255,250,230,0.7) 0%, rgba(255,240,200,0.5) 100%)'
                      : 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,236,179,0.9) 100%)',
                    backdropFilter: immersive ? 'blur(16px) saturate(1.1)' : 'blur(15px)',
                    WebkitBackdropFilter: immersive ? 'blur(16px) saturate(1.1)' : 'blur(15px)',
                    '&:hover': {
                      borderColor: '#FF9800',
                      boxShadow: `0 8px 32px ${alpha('#FFB300', 0.4)}`,
                      transform: 'translateY(-2px)',
                    },
                    transition: 'all 0.3s ease',
                  }}
                >
                  <CardContent
                    sx={{
                      p: { xs: 1, md: 1.5 },
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      gap: { xs: 0.4, md: 0.6 },
                    }}
                  >
                    <Box sx={{ fontSize: 'clamp(1.5rem, 4vh, 2.2rem)', lineHeight: 1 }}>
                      📖
                    </Box>
                    <Typography
                      sx={{ fontWeight: 700, fontSize: 'clamp(0.8rem, 2.2vh, 1.1rem)', lineHeight: 1.1, color: '#C77800' }}
                    >
                      Min Bog
                    </Typography>
                    {/* Fill bar that visibly grows as the album fills */}
                    <Box
                      sx={{
                        position: 'relative',
                        height: 8,
                        borderRadius: 6,
                        bgcolor: alpha('#C77800', 0.18),
                        overflow: 'hidden',
                        mx: 'auto',
                        width: '80%',
                      }}
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          width: `${Math.round(albumFill * 100)}%`,
                          background: 'linear-gradient(90deg, #FFD86B 0%, #FFB300 100%)',
                          transition: 'width 0.5s ease',
                        }}
                      />
                    </Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 'clamp(0.7rem, 1.8vh, 0.95rem)', color: '#9A5E00' }}>
                      {stickersOwned} / {stickersTotal} · ⭐ {progress.totals.totalStars}
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
          </Box>
        </Box>
      </Container>

      {/* Per-world mascot — rendered INSIDE the page (not in the persistent layer): a persistent
          mascot in the separate world layer made Chrome flicker the scene's compositing on hover;
          in-page it's rock-solid (same as the in-game GameGuide). parallaxDepth 0 → stays put. */}
      <ThemeMascot
        parallaxDepth={0}
        sx={{
          left: 'calc(env(safe-area-inset-left) + 6px)',
          bottom: 'calc(env(safe-area-inset-bottom) + 2px)',
          width: { xs: 128, sm: 156, md: 184 },
          height: { xs: 128, sm: 156, md: 184 },
        }}
      />

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
    // Cleanup SimplifiedAudioController on route changes. This MUST run synchronously: a dynamic
    // import() here defers the stop by a microtask, so for the very navigation that mounts a game it
    // could land AFTER that game's entry welcome had already started — cancelling the title narration
    // (the engine has no queue; any stop kills the current clip). With a static import the cleanup
    // completes before the new route's mount effect fires, so the welcome always survives.
    simplifiedAudioController.triggerNavigationCleanup()
    // SFX is a separate short channel; quiet any lingering cues on navigation too.
    sfx.stopAll()
  }, [location.pathname])
  
  return null // This component only handles side effects
}

// Version Display Component
interface VersionDisplayProps {
  updateAvailable?: boolean
}

// Danish words for digits 0–9, used by the grown-up reset gate (reading them is the gate —
// a pre-reader who can count still can't pass it).
const DANISH_DIGIT_WORDS = ['nul', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni']

const VersionDisplay: React.FC<VersionDisplayProps> = ({ updateAvailable = false }) => {
  // Child-resistant parent reset: hold the version label for 3s → a "grown-ups only" gate
  // (type 3 digits shown as Danish WORDS) → wipe all progress. Discreet and out of the child's
  // normal flow (Overhaul Foundation §1).
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [gateOpen, setGateOpen] = useState(false)
  const [gateCode, setGateCode] = useState('')   // the 3-digit answer, e.g. "427"
  const [gateInput, setGateInput] = useState('')
  const [gateDone, setGateDone] = useState(false) // brief "nulstillet" confirmation

  const startHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current)
    holdTimer.current = setTimeout(() => {
      // Fresh random 3-digit challenge each time.
      const code = Array.from({ length: 3 }, () => Math.floor(Math.random() * 10)).join('')
      setGateCode(code)
      setGateInput('')
      setGateDone(false)
      setGateOpen(true)
    }, 3000)
  }
  const cancelHold = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }

  const closeGate = () => {
    setGateOpen(false)
    setGateInput('')
    setGateDone(false)
  }
  const submitGate = () => {
    // Correct → wipe progress + show a brief confirmation. Wrong → silently close, nothing reset.
    if (gateInput.replace(/\D/g, '') === gateCode) {
      progressStore.resetAll()
      setGateDone(true)
    } else {
      closeGate()
    }
  }
  const gateWords = gateCode.split('').map(d => DANISH_DIGIT_WORDS[Number(d)]).join(' · ')

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
    <>
    <Box
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
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
        // Pointer events enabled so the hidden parent-reset long-press works; touch-action none
        // so the hold doesn't get hijacked by scroll/pan gestures.
        pointerEvents: 'auto',
        touchAction: 'none',
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

    {/* Grown-ups-only reset gate (reached only by holding the version label for 3s). */}
    <Dialog open={gateOpen} onClose={closeGate} maxWidth="xs" fullWidth>
      {gateDone ? (
        <DialogContent sx={{ textAlign: 'center', py: 4 }}>
          <Typography sx={{ fontSize: '2.5rem', mb: 1 }}>✅</Typography>
          <Typography sx={{ fontWeight: 700 }}>Al fremgang er nulstillet.</Typography>
          <DialogActions sx={{ justifyContent: 'center', mt: 2 }}>
            <Button onClick={closeGate} variant="contained">Luk</Button>
          </DialogActions>
        </DialogContent>
      ) : (
        <>
          <DialogTitle sx={{ fontWeight: 700 }}>Kun for voksne 🔒</DialogTitle>
          <DialogContent>
            <Typography sx={{ mb: 1 }}>
              Dette nulstiller <strong>alle</strong> klistermærker, rekorder og stjerner.
            </Typography>
            <Typography sx={{ mb: 0.5 }}>Tast tallene for at bekræfte:</Typography>
            <Typography sx={{ fontWeight: 700, fontSize: '1.4rem', textAlign: 'center', my: 1.5 }}>
              {gateWords}
            </Typography>
            <TextField
              autoFocus
              fullWidth
              value={gateInput}
              onChange={(e) => setGateInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitGate() }}
              placeholder="000"
              slotProps={{ htmlInput: { inputMode: 'numeric', pattern: '[0-9]*', maxLength: 3, style: { textAlign: 'center', fontSize: '1.4rem', letterSpacing: '0.5rem' } } }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeGate}>Annullér</Button>
            <Button onClick={submitGate} variant="contained" color="error">Nulstil</Button>
          </DialogActions>
        </>
      )}
    </Dialog>
    </>
  )
}

function App() {
  const location = useLocation()
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

  // Preload the SFX palette on the first user gesture (the same gesture that unlocks audio).
  useEffect(() => {
    const onFirstGesture = () => {
      sfx.preload()
      window.removeEventListener('pointerdown', onFirstGesture)
      window.removeEventListener('keydown', onFirstGesture)
    }
    window.addEventListener('pointerdown', onFirstGesture, { once: false })
    window.addEventListener('keydown', onFirstGesture, { once: false })
    return () => {
      window.removeEventListener('pointerdown', onFirstGesture)
      window.removeEventListener('keydown', onFirstGesture)
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

        {/* Throwaway voice-audition tool — floating 🎙️ override panel (tmp-prd-voicelab.md) */}
        <VoiceOverridePanel />

        {/* Full-viewport, no-scroll surface that hosts the persistent world + the routed pages.
            Relative so the world's ABSOLUTE layers (and mascot) position against it — absolute
            instead of fixed because Chrome blanks fixed layers during touch pan gestures. Height
            uses the SAME basis as #root/pages (--vh) — mixing 100dvh here left a sub-pixel seam
            at the bottom under fractional-DPR emulation. */}
        <Box sx={{ position: 'relative', height: 'calc(var(--vh, 1vh) * 100)', overflow: 'hidden' }}>

        {/* App-wide immersive world: rendered once behind the router, so the parallax scene /
            ambient drift / mascot never unmount on navigation (no restart or flicker). Renders
            nothing for flat skins. */}
        <PersistentWorld />

        {/* Foreground pages render over the steady world. Positioned wrapper ABOVE the world
            layer (z-index:0). Cross-fade removed while diagnosing a compositing flicker — the
            promoted opacity layer was painting white over the scene. */}
        <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Suspense fallback={<Box sx={{ height: '100dvh' }} />}>
        <Routes location={location}>
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
        <Route path="/farver/laer" element={<FarverLearning />} />
        <Route path="/farver/jagt" element={<FarvejagtGame />} />
        <Route path="/farver/quiz" element={<FarveQuizGame />} />
        <Route path="/farver/ram-farven" element={<RamFarvenGame />} />
        <Route path="/farver/nuancer" element={<NuancerGame />} />

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
        <Route path="/learning/memory/:type/:size" element={<MemoryGame />} />
        {/* Old size-less bookmarks → default to the 20-pair board (MemoryGame defaults size). */}
        <Route path="/learning/memory/:type" element={<MemoryGame />} />

        {/* Sticker album / reward hub */}
        <Route path="/album" element={<StickerAlbum />} />

        {/* Hidden internal tool — not in any menu, reachable only by URL */}
        <Route path="/voicelab" element={<VoiceLab />} />

        {/* 404 Not Found */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
        </Box>
        </Box>
      </>
    </SimplifiedAudioProvider>
  )
}

export default App