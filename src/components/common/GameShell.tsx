import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AppBar, Box, Container, Toolbar, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import GameMotif from './GameMotif'
import Mascot from './Mascot'
import BackButton from './BackButton'
import GameIntro from './GameIntro'
import CelebrationEffect from './CelebrationEffect'
import { getCategoryTheme } from '../../config/categoryThemes'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
import { mascotBus } from '../../services/mascotBus'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import type { GuideReaction } from './ThemeMascot'

// Shared in-game scaffold (Game-Page Rework + UI/UX Overhaul PRD §5.3). Every game renders its
// body into this: the dimmed world backdrop (GameMotif), a themed header (back / title / score),
// the reactive corner Mascot, and the themed CelebrationEffect.
//
// Layout: when a `promptStage` is supplied the body becomes a top-anchored 3-zone column
// (title → PromptStage slot sized to ~34–42% of the body / ~26–34% phone-landscape → answer zone),
// eliminating the old "dead vertical band". Games with no prompt (learning/memory grids) omit
// `promptStage` and keep the centred, grid-filling behaviour.

interface GameShellProps {
  categoryId: string                 // 'alphabet' | 'math' | 'colors' | 'english' | 'ordleg'
  title: string
  backRoute: string
  score?: React.ReactNode
  guideReaction?: GuideReaction      // 'cheer' on correct, 'think' on wrong (bridged to mascotBus)
  celebration?: { show: boolean; intensity?: 'low' | 'medium' | 'high'; duration?: number; onComplete?: () => void }
  // Framed focal zone (PromptStage). When set, the body uses the anti-void 3-zone layout.
  promptStage?: React.ReactNode
  // Hide the corner companion on screens whose play area fills the viewport (learning/memory/
  // color grids), where a bottom-corner mascot would overlap interactive content.
  guide?: boolean
  // Tighter title + paddings for vertically dense games (learning grids, memory, etc.).
  dense?: boolean
  // Skippable "Er du klar? … Kør!" game-entry beat (Liveliness PRD-03 §A1). Default true; calm
  // browse screens (the "Lær …" exploration surfaces) pass false — they have no "get ready"
  // semantics. Never shown under reduced motion (purely additive motion polish).
  intro?: boolean
  children: React.ReactNode
}

const GameShell: React.FC<GameShellProps> = ({
  categoryId,
  title,
  backRoute,
  score,
  guideReaction = null,
  celebration,
  promptStage,
  guide = true,
  dense = false,
  intro = true,
  children,
}) => {
  const theme = useTheme()
  const category = getCategoryTheme(categoryId)
  const dark = theme.scene.dark
  const immersive = theme.scene.layers.length > 0
  const reduce = useReducedMotion()
  // The entry beat plays once per game mount (a route change remounts GameShell). Never under
  // reduced motion — there it stays today's silent-instant load.
  const [showIntro, setShowIntro] = useState(intro && !reduce)
  // Phone landscape: play-surface first — the title moves INTO the header row (between back
  // and score) so its own row's height goes to the game body instead.
  const phoneLandscape = useMediaQuery(PHONE_LANDSCAPE.replace('@media ', ''))

  // Bridge the legacy `guideReaction` prop onto the mascot bus so EVERY game that already reports
  // cheer/think gets a reactive mascot with no per-file wiring. Richer events (streak/round/hint/
  // sticker) are emitted directly by games that opt in.
  useEffect(() => {
    if (guideReaction === 'cheer') mascotBus.emit('correct')
    else if (guideReaction === 'think') mascotBus.emit('wrong')
  }, [guideReaction])

  return (
    <Box
      sx={{
        position: 'relative',
        isolation: 'isolate', // lets GameMotif's z-index:-1 backdrop sit above the gradient base
        height: '100dvh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'calc(env(safe-area-inset-top) + 8px)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
        background: immersive ? 'transparent' : category.gradient,
      }}
    >
      {/* Calm in-game backdrop for FLAT skins (CSS accent). Immersive skins get their dimmed
          world from the persistent layer, so GameMotif renders nothing there. */}
      <GameMotif categoryId={categoryId} />

      {/* Header: back (left) + score (right). The themed title sits below, centred. */}
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar
          sx={{
            justifyContent: 'space-between',
            py: 2,
            [PHONE_LANDSCAPE]: { py: 0.25, minHeight: '48px !important' },
          }}
        >
          {/* Shared animated back button — reverses the themed wipe (PRD-02 §8). */}
          <BackButton to={backRoute} variant="game" />

          {phoneLandscape && (
            <Typography
              sx={{
                fontFamily: theme.titleFontFamily,
                fontWeight: 700,
                fontSize: '1rem',
                color: dark ? '#FFFFFF' : category.accentColor,
                textShadow: dark
                  ? '0 0 16px rgba(120,170,255,0.55), 0 2px 8px rgba(0,0,0,0.5)'
                  : `1px 1px 2px ${category.accentColor}33`,
                minWidth: 0,
                px: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </Typography>
          )}

          {score}
        </Toolbar>
      </AppBar>

      <Container
        maxWidth="lg"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          py: dense ? { xs: 1, md: 2 } : { xs: 2, md: 3 },
          overflow: 'hidden',
          [PHONE_LANDSCAPE]: { py: 0.5 },
        }}
      >
        {/* Themed title (dark worlds → light text + glow; light → accent + soft shadow).
            Phone landscape renders it inline in the toolbar instead — no title row at all. */}
        {!phoneLandscape && (
          <Box
            sx={{
              textAlign: 'center',
              mb: promptStage ? { xs: 1, md: 1.5 } : dense ? { xs: 1, md: 1.5 } : { xs: 2, md: 3 },
              flex: '0 0 auto',
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Typography
                variant="h3"
                sx={{
                  fontFamily: theme.titleFontFamily,
                  color: dark ? '#FFFFFF' : category.accentColor,
                  fontWeight: 700,
                  fontSize: { xs: '1.6rem', md: '2.1rem' },
                  textShadow: dark
                    ? '0 0 16px rgba(120,170,255,0.55), 0 2px 8px rgba(0,0,0,0.5)'
                    : `1px 1px 2px ${category.accentColor}33`,
                }}
              >
                {title}
              </Typography>
            </motion.div>
          </Box>
        )}

        {/* Per-game body. With a PromptStage: top-anchored 3-zone column (stage sized to a fixed
            fraction so no game floats in a void). Without: centred, grid-filling (learning/memory). */}
        {promptStage ? (
          <Box data-game-body sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Box
              sx={{
                flex: phoneLandscape ? '30 1 0' : '40 1 0',
                minHeight: 0,
                display: 'flex',
                mb: { xs: 1, md: 1.5 },
                [PHONE_LANDSCAPE]: { mb: 0.5 },
              }}
            >
              {promptStage}
            </Box>
            <Box sx={{ flex: phoneLandscape ? '70 1 0' : '60 1 0', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              {children}
            </Box>
          </Box>
        ) : (
          <Box data-game-body sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0 }}>
            {children}
          </Box>
        )}
      </Container>

      {/* Reactive corner mascot (bus-driven). Omitted where it would overlap a full-viewport grid. */}
      {guide && <Mascot />}

      {celebration && (
        <CelebrationEffect
          show={celebration.show}
          intensity={celebration.intensity}
          duration={celebration.duration}
          onComplete={celebration.onComplete}
        />
      )}

      {/* Game-entry "Er du klar? … Kør!" beat (Liveliness PRD-03 §A1). A themed curtain over the
          already-live board; lifts (AnimatePresence exit fade) after a short, skippable moment. */}
      <AnimatePresence>
        {showIntro && <GameIntro categoryId={categoryId} onDismiss={() => setShowIntro(false)} />}
      </AnimatePresence>
    </Box>
  )
}

export default GameShell
