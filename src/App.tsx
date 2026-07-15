import React, { useEffect, Suspense } from 'react'
import { lazyWithReload as lazy } from './utils/lazyWithReload'
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
// DEV-only screenshot-harness routes (never registered in production builds).
const DevMascot = lazy(() => import('./components/dev/DevRoutes').then((m) => ({ default: m.DevMascot })))
const DevRoundResult = lazy(() => import('./components/dev/DevRoutes').then((m) => ({ default: m.DevRoundResult })))
// DEV-only narration-audit harness (PRD-11) — plays every closed-set clip for a native-ear pass.
const AuditHarness = lazy(() => import('./components/audit/AuditHarness'))
import UpdateBanner from './components/common/UpdateBanner'
import AdultCorner from './components/adult/AdultCorner'
import PersistentWorld from './components/common/scene/PersistentWorld'
import ThemeMascot from './components/common/ThemeMascot'
// Legacy audio system removed - using SimplifiedAudioProvider only
import { useViewportHeight } from './hooks/useViewportHeight'
import { useReducedMotion } from './hooks/useReducedMotion'
// Demo system removed

// Simplified Audio System imports
import { SimplifiedAudioProvider } from './contexts/SimplifiedAudioContext'
import SimplifiedAudioPermission from './components/common/SimplifiedAudioPermission'
import LottieCharacter, { useCharacterState } from './components/common/LottieCharacter'
import { useUpdateChecker } from './hooks/useUpdateChecker'
import { useNativeAppFeel } from './hooks/useNativeAppFeel'
import { categoryThemes } from './config/categoryThemes'
import { useProgress } from './hooks/useProgress'
import { sfx } from './services/sfxClient'
import { musicClient } from './services/musicClient'
import { recordRoute } from './services/diagnosticsBuffer'
import { PHONE_ANY, PHONE_LANDSCAPE } from './theme/phoneMedia'
import { simplifiedAudioController } from './utils/SimplifiedAudioController'
import { totalStickerCount } from './config/stickers'
import { sectionIconImages } from './assets/themes/icons'
import appLogo from './assets/logo.webp'

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
  // Frosted card glass. Dark worlds need MORE opaque light glass so the accent label stays AA
  // (a translucent card over a dark scene turns muddy grey and kills contrast). Matches menus.
  const cardGlass = darkScene
    ? 'linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.84) 100%)'
    : 'linear-gradient(135deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.46) 100%)'
  const { state: progress } = useProgress()
  const stickersOwned = Object.keys(progress.stickers.collected).length
  const stickersTotal = totalStickerCount()
  const albumFill = stickersTotal > 0 ? stickersOwned / stickersTotal : 0

  return (
    <Box
      className="interactive-area"
      sx={{
        position: 'relative',
        // Real visible viewport (covers the full screen in an iOS standalone PWA). `dvh` where
        // supported, the JS --vh hack as the fallback for older engines.
        height: 'calc(var(--vh, 1vh) * 100)',
        '@supports (height: 100dvh)': { height: '100dvh' },
        // Immersive skins: transparent so the app-wide <PersistentWorld/> scene shows through.
        // Flat skins keep their own page background + dots (and the rainbow arc below).
        background: immersive ? 'transparent' : `${theme.decor.pageBackground},\n${theme.decor.dots}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        // Consistent safe-area top gap (matches GameShell + the section menus).
        paddingTop: 'calc(env(safe-area-inset-top) + 8px)',
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
          zIndex: 2,
          [PHONE_LANDSCAPE]: { py: 0.75 },
        }}
      >
        {/* Header row: brand lockup (left), bounded by the same Container margins as the cards
            below — so it lines up with the card grid edges. (The theme picker moved into the
            "Til de voksne" adult menu — AdultCorner.) Explicit position+zIndex so the row reliably
            paints ABOVE the card grid below — the cards use backdrop-filter, which on WebKit
            otherwise paints over siblings that lack their own stacking context. */}
        <Box sx={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: { xs: 1.5, md: 2 }, [PHONE_LANDSCAPE]: { mb: 0.75 } }}>
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
                  [PHONE_LANDSCAPE]: { width: 32, height: 32 },
                }}
              />
              <Typography
                variant="h1"
                sx={{
                  fontFamily: theme.titleFontFamily,
                  fontSize: { xs: '1.75rem', sm: '2.25rem', md: '2.75rem' },
                  fontWeight: 700,
                  [PHONE_LANDSCAPE]: { fontSize: '1.3rem' },
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
              // Fixed-width columns (capped to the card width) centred as a group → the gap
              // between columns equals the gap between rows (uniform 16px). Matches the menus.
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, minmax(0, 270px))', md: 'repeat(3, minmax(0, 270px))' },
              gridAutoRows: 'auto',
              gap: '16px',
              justifyContent: 'center',
              alignItems: 'center',
              '@media (orientation: landscape)': { gridTemplateColumns: 'repeat(3, minmax(0, 270px))' },
              // Phone landscape: two 270px-capped rows don't fit a ≤480px-tall viewport —
              // all five sections go in ONE compact row instead.
              [PHONE_LANDSCAPE]: { gap: '10px', gridTemplateColumns: 'repeat(5, minmax(0, 150px))', mb: 1 },
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
                    style={{ width: '100%' }}
                  >
                    <Card
                      onClick={() => navigate(card.route)}
                      sx={{
                        width: '100%',
                        aspectRatio: '16 / 10',
                        cursor: 'pointer',
                        border: '2px solid',
                        borderColor: cat.border,
                        display: 'flex',
                        flexDirection: 'column',
                        // Immersive worlds: frosted "ocean glass" so the scene shows through
                        // the cards (still high-contrast for the dark themed text/icons).
                        background: immersive ? cardGlass : cat.cardSurface,
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
                            // AA-guaranteed on the frosted card (fixes warm-accent legibility).
                            color: cat.onCard
                          }}
                        >
                          {content.name}
                        </Typography>
                      </CardContent>
                    </Card>
                  </motion.div>
              )
            })}
          </Box>

          {/* Reward shelf — Min Bog. Its own distinct golden bar BELOW the learning grid (not a
              section card): it's a different KIND of thing (the child's reward collection), so it
              gets its own place + a warm glow + shimmer + a "book that fills" bar. Reads the shared
              progress store so it grows across sessions (Overhaul Foundation §2). */}
          <Box
            component={motion.div}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            // Match the grid's centred content width (2-col = 556, 3-col = 842) so the shelf
            // lines up with the cards above it.
            sx={{ width: '100%', maxWidth: { xs: 556, md: 842 }, mx: 'auto' }}
          >
            <Card
              onClick={() => navigate('/album')}
              sx={{
                width: '100%',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '18px',
                border: '3px solid',
                borderColor: alpha('#FFB300', 0.85),
                background: immersive
                  ? darkScene
                    ? 'linear-gradient(135deg, rgba(255,248,222,0.96) 0%, rgba(255,226,140,0.94) 100%)'
                    : 'linear-gradient(135deg, rgba(255,247,214,0.82) 0%, rgba(255,228,150,0.7) 100%)'
                  : 'linear-gradient(135deg, rgba(255,250,235,0.97) 0%, rgba(255,221,130,0.95) 100%)',
                backdropFilter: immersive ? 'blur(16px) saturate(1.1)' : 'blur(15px)',
                WebkitBackdropFilter: immersive ? 'blur(16px) saturate(1.1)' : 'blur(15px)',
                boxShadow: `0 6px 26px ${alpha('#FFB300', 0.45)}`,
                '&:hover': {
                  borderColor: '#FF9800',
                  boxShadow: `0 10px 36px ${alpha('#FFB300', 0.6)}`,
                  transform: 'translateY(-2px)',
                },
                transition: 'box-shadow 0.3s ease, border-color 0.3s ease, transform 0.3s ease',
                // Gentle gold shimmer sweep — marks it as the special "reward" (off for reduced motion).
                '@media (prefers-reduced-motion: no-preference)': {
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: '-30%',
                    width: '30%',
                    background: 'linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)',
                    transform: 'skewX(-18deg)',
                    animation: 'minBogShimmer 4.5s ease-in-out infinite',
                    pointerEvents: 'none',
                  },
                },
                '@keyframes minBogShimmer': {
                  '0%': { left: '-30%' },
                  '55%': { left: '130%' },
                  '100%': { left: '130%' },
                },
              }}
            >
              <CardContent
                sx={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: { xs: 1.5, md: 2.5 },
                  px: { xs: 2, md: 3 },
                  py: { xs: 1.25, md: 1.75 },
                  '&:last-child': { pb: { xs: 1.25, md: 1.75 } },
                  [PHONE_LANDSCAPE]: { py: 0.5, '&:last-child': { pb: 0.5 }, gap: 1 },
                }}
              >
                <Box sx={{ fontSize: { xs: '2.2rem', md: '2.8rem' }, lineHeight: 1, flex: '0 0 auto', [PHONE_LANDSCAPE]: { fontSize: '1.4rem' } }}>📖</Box>
                <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.1rem', md: '1.35rem' }, color: '#6B3F00', lineHeight: 1, [PHONE_LANDSCAPE]: { fontSize: '0.95rem' } }}>
                    Min Bog
                  </Typography>
                  {/* Fill bar that visibly grows as the album fills */}
                  <Box sx={{ position: 'relative', height: 12, borderRadius: 6, bgcolor: alpha('#C77800', 0.2), overflow: 'hidden', width: '100%', [PHONE_LANDSCAPE]: { height: 8 } }}>
                    {/* Fill grows with a springy overshoot as stickers are gained (Min Bog "fills"). */}
                    <Box sx={{ position: 'absolute', inset: 0, width: `${Math.round(albumFill * 100)}%`, background: 'linear-gradient(90deg, #FFD86B 0%, #FFB300 100%)', boxShadow: '0 0 10px rgba(255,179,0,0.6)', transition: 'width 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)' }} />
                  </Box>
                </Box>
                <Typography sx={{ flex: '0 0 auto', fontWeight: 800, fontSize: { xs: '0.95rem', md: '1.15rem' }, color: '#5C3800', whiteSpace: 'nowrap', [PHONE_LANDSCAPE]: { fontSize: '0.8rem' } }}>
                  {stickersOwned} / {stickersTotal} · ⭐ {progress.totals.totalStars}
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Container>

      {/* Per-world mascot — rendered INSIDE the page (not in the persistent layer): a persistent
          mascot in the separate world layer made Chrome flicker the scene's compositing on hover;
          in-page it's rock-solid (same as the in-game Mascot). parallaxDepth 0 → stays put. */}
      <ThemeMascot
        parallaxDepth={0}
        sx={{
          left: 'calc(env(safe-area-inset-left) + 6px)',
          bottom: 'calc(env(safe-area-inset-bottom) + 2px)',
          width: { xs: 128, sm: 156, md: 184 },
          height: { xs: 128, sm: 156, md: 184 },
          // Phones: the big home mascot covered the Engelsk card (sweep + report BAZ3R).
          [PHONE_ANY]: { width: 64, height: 64 },
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
    // Diagnostics breadcrumb (bug reports) — record the route trail the child followed.
    recordRoute(location.pathname)
    // Cleanup SimplifiedAudioController on route changes. This MUST run synchronously: a dynamic
    // import() here defers the stop by a microtask, so for the very navigation that mounts a game it
    // could land AFTER that game's entry welcome had already started — cancelling the title narration
    // (the engine has no queue; any stop kills the current clip). With a static import the cleanup
    // completes before the new route's mount effect fires, so the welcome always survives.
    simplifiedAudioController.triggerNavigationCleanup()
    // SFX is a separate short channel; quiet any lingering cues on navigation too.
    sfx.stopAll()
    // Background music is a menu/front-page bed only — fade it out on entering a game (or a
    // content/browse screen) and back in on returning to a menu. Music never routes through the
    // audio controller; this just tells the separate music channel where we are.
    musicClient.setRoute(location.pathname)
  }, [location.pathname])
  
  return null // This component only handles side effects
}

// Crash-test probe — visiting any route with ?crash-test=1 throws during render, exercising
// the AppErrorBoundary fallback AND the automatic crash upload end-to-end. Inert otherwise.
const CrashTestProbe: React.FC = () => {
  const location = useLocation()
  if (new URLSearchParams(location.search).get('crash-test') === '1') {
    throw new Error('Manuel crash-test (?crash-test=1)')
  }
  return null
}

function App() {
  const location = useLocation()
  const reduceMotion = useReducedMotion()
  // Initialize viewport height for iOS
  useViewportHeight()
  
  // Initialize update checker
  const updateStatus = useUpdateChecker()
  
  // Initialize native app feel optimizations
  useNativeAppFeel()
  
  // DEV MODE: Set to true to preview the update announcement pill without waiting for a real update.
  const DEV_SHOW_UPDATE_BANNER = false // Change to true to test the banner

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
      // Start ambient music now that a gesture has unlocked WebAudio (no-op if music is disabled).
      musicClient.resume()
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
        
        {/* Update announcement — a dismissible bottom-centre pill that points the adult to the
            ⚙️ menu (PRD-09 P4). The actual apply-update is the hold-gated menu item, never a
            child-tappable button. */}
        <UpdateBanner
          show={updateStatus.updateAvailable || DEV_SHOW_UPDATE_BANNER}
          onDismiss={updateStatus.dismissUpdate}
        />

        {/* Global Audio Permission System */}
        {/* Legacy GlobalAudioPermission removed */}

        {/* "Til de voksne" corner button — hold 2s → adult menu (bug reporter, voice test,
            SFX toggle, progress reset, version info, and the gated "⬆️ Opdater app"). Stays
            bottom-right; the update pill is bottom-centre so it no longer dodges onto the mascot. */}
        <AdultCorner
          updateAvailable={updateStatus.updateAvailable || DEV_SHOW_UPDATE_BANNER}
          onApplyUpdate={updateStatus.applyUpdate}
        />

        {/* Render-crash test hook for the global error boundary (?crash-test=1) */}
        <CrashTestProbe />

        {/* Full-viewport, no-scroll surface that hosts the persistent world + the routed pages.
            Relative so the world's ABSOLUTE layers (and mascot) position against it — absolute
            instead of fixed because Chrome blanks fixed layers during touch pan gestures. Height
            uses the SAME basis as #root/pages (--vh) — mixing 100dvh here left a sub-pixel seam
            at the bottom under fractional-DPR emulation. */}
        <Box sx={{ position: 'relative', height: 'calc(var(--vh, 1vh) * 100)', '@supports (height: 100dvh)': { height: '100dvh' }, overflow: 'hidden' }}>

        {/* App-wide immersive world: rendered once behind the router, so the parallax scene /
            ambient drift / mascot never unmount on navigation (no restart or flicker). Renders
            nothing for flat skins. */}
        <PersistentWorld />

        {/* Foreground pages render over the steady world. Positioned wrapper ABOVE the world
            layer (z-index:0). Cross-fade removed while diagnosing a compositing flicker — the
            promoted opacity layer was painting white over the scene. */}
        <Box sx={{ position: 'relative', zIndex: 1 }}>
        {/* Fast shared page transition (UI/UX Overhaul PRD §5.8). A keyed fade-in over the steady
            PersistentWorld — the outgoing page unmounts, the new one fades up from the scene (never
            a white flash, since immersive pages are transparent). Instant under reduced motion. */}
        <motion.div
          key={location.pathname}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
        >
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

        {/* DEV-only screenshot-harness routes (stripped from production builds). */}
        {import.meta.env.DEV && <Route path="/dev/mascot" element={<DevMascot />} />}
        {import.meta.env.DEV && <Route path="/dev/round-result" element={<DevRoundResult />} />}
        {/* DEV-only narration-audit harness (PRD-11 §3) — never in production builds. */}
        {import.meta.env.DEV && <Route path="/audit" element={<AuditHarness />} />}

        {/* 404 Not Found */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
      </motion.div>
        </Box>
        </Box>
      </>
    </SimplifiedAudioProvider>
  )
}

export default App