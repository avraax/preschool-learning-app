import React, { useEffect, Suspense } from 'react'
import { lazyWithReload as lazy } from './utils/lazyWithReload'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { logIOSIssue } from './utils/remoteConsole'
import { deviceInfo } from './utils/deviceDetection'
import {
  Container,
  Button,
  Typography,
  Box
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
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
const DevScene = lazy(() => import('./components/dev/DevRoutes').then((m) => ({ default: m.DevScene })))
// DEV-only narration-audit harness (PRD-11) — plays every closed-set clip for a native-ear pass.
const AuditHarness = lazy(() => import('./components/audit/AuditHarness'))
import UpdateBanner from './components/common/UpdateBanner'
import AdultCorner from './components/adult/AdultCorner'
import PersistentWorld from './components/common/scene/PersistentWorld'
import LevelUpOverlay from './components/common/LevelUpOverlay'
import LevelUpWatcher from './components/common/LevelUpWatcher'
import HomePage from './components/home/HomePage'
import { TransitionProvider } from './components/common/transition/TransitionProvider'
import TransitionOverlay from './components/common/transition/TransitionOverlay'
// Legacy audio system removed - using SimplifiedAudioProvider only
import { useViewportHeight } from './hooks/useViewportHeight'

// Simplified Audio System imports
import { SimplifiedAudioProvider } from './contexts/SimplifiedAudioContext'
import SimplifiedAudioPermission from './components/common/SimplifiedAudioPermission'
import LottieCharacter, { useCharacterState } from './components/common/LottieCharacter'
import { useUpdateChecker } from './hooks/useUpdateChecker'
import { useNativeAppFeel } from './hooks/useNativeAppFeel'
import { sfx } from './services/sfxClient'
import { musicClient } from './services/musicClient'
import { recordRoute } from './services/diagnosticsBuffer'
import { simplifiedAudioController } from './utils/SimplifiedAudioController'

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
      {/* Themed route transitions (Liveliness PRD-02) — provides navigateWithTransition/goBack to
          the menus + games and drives the opaque wipe overlay below. */}
      <TransitionProvider>
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

        {/* Cross-game progression (Liveliness PRD-01): the level-up ceremony fires from any play
            context via levelUpBus; the watcher is the reload/cross-tab safety net. Both mounted
            once at app root, above the world layer. */}
        <LevelUpOverlay />
        <LevelUpWatcher />

        {/* Foreground pages render over the steady world. Positioned wrapper ABOVE the world
            layer (z-index:0). The themed wipe overlay (below) covers the page mount/unmount, so the
            page swaps instantly here — no per-page cross-fade (that promoted opacity layer painted
            white over the scene; see the flicker rules in PRD-02). */}
        <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Box key={location.pathname}>
        <Suspense fallback={<Box sx={{ height: '100dvh' }} />}>
        <Routes location={location}>
        {/* Home Routes */}
        <Route path="/" element={<HomePage />} />

        {/* Alphabet Routes */}
        <Route path="/alphabet" element={<AlphabetSelection />} />
        <Route path="/alphabet/learn" element={<AlphabetLearning />} />
        <Route path="/alphabet/quiz" element={<AlphabetGame />} />

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
        {import.meta.env.DEV && <Route path="/dev/scene" element={<DevScene />} />}
        {/* DEV-only narration-audit harness (PRD-11 §3) — never in production builds. */}
        {import.meta.env.DEV && <Route path="/audit" element={<AuditHarness />} />}

        {/* 404 Not Found */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
      </Box>
        </Box>

        {/* Themed OPAQUE wipe overlay — above pages (z1) + mascots (z6), below the level-up
            ceremony. Only paints while a transition is in flight; the world is never touched. */}
        <TransitionOverlay />
        </Box>
        </>
      </TransitionProvider>
    </SimplifiedAudioProvider>
  )
}

export default App
