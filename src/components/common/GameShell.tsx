import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AppBar, Box, Container, IconButton, Toolbar, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { ArrowLeft } from 'lucide-react'
import GameMotif from './GameMotif'
import GameGuide from './GameGuide'
import CelebrationEffect from './CelebrationEffect'
import { getCategoryTheme } from '../../config/categoryThemes'
import type { GuideReaction } from './ThemeMascot'

// Shared in-game scaffold (Game-Page Rework PRD §A). Every game renders its body into this so
// the play surface matches the menus: the dimmed world backdrop (GameMotif), a themed header
// (back / themed title / score — NO redundant section icon), a bottom-corner GameGuide that
// reacts to answers, and the themed CelebrationEffect. Content lives in a no-scroll flex column.

interface GameShellProps {
  categoryId: string                 // 'alphabet' | 'math' | 'colors' | 'english' | 'ordleg'
  title: string
  backRoute: string
  score?: React.ReactNode
  guideReaction?: GuideReaction      // 'cheer' on correct, 'think' on wrong
  celebration?: { show: boolean; intensity?: 'low' | 'medium' | 'high'; onComplete?: () => void }
  // Hide the corner companion on screens whose play area fills the viewport (learning/memory/
  // color grids), where a bottom-corner mascot would overlap interactive content.
  guide?: boolean
  // Tighter title + paddings for vertically dense games (learning grids, memory, etc.).
  dense?: boolean
  children: React.ReactNode
}

const GameShell: React.FC<GameShellProps> = ({
  categoryId,
  title,
  backRoute,
  score,
  guideReaction = null,
  celebration,
  guide = true,
  dense = false,
  children,
}) => {
  const navigate = useNavigate()
  const theme = useTheme()
  const category = getCategoryTheme(categoryId)
  const dark = theme.scene.dark

  return (
    <Box
      sx={{
        position: 'relative',
        isolation: 'isolate', // lets GameMotif's z-index:-1 backdrop sit above the gradient base
        height: '100dvh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: category.gradient,
      }}
    >
      {/* Dimmed world backdrop (static atmosphere — no parallax/ambient/mascot). */}
      <GameMotif categoryId={categoryId} />

      {/* Header: back (left) + score (right). The themed title sits below, centred. */}
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar sx={{ justifyContent: 'space-between', py: 2 }}>
          <IconButton
            onClick={() => navigate(backRoute)}
            color="primary"
            size="large"
            sx={{
              bgcolor: 'rgba(255, 255, 255, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              backdropFilter: 'blur(8px)',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.9)',
                transform: 'scale(1.05)',
              },
            }}
          >
            <ArrowLeft size={24} />
          </IconButton>

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
        }}
      >
        {/* Themed title (dark worlds → light text + glow; light → accent + soft shadow). */}
        <Box sx={{ textAlign: 'center', mb: dense ? { xs: 1, md: 1.5 } : { xs: 2, md: 3 }, flex: '0 0 auto' }}>
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
                fontSize: dense ? { xs: '1.3rem', md: '1.7rem' } : { xs: '1.6rem', md: '2.1rem' },
                textShadow: dark
                  ? '0 0 16px rgba(120,170,255,0.55), 0 2px 8px rgba(0,0,0,0.5)'
                  : `1px 1px 2px ${category.accentColor}33`,
              }}
            >
              {title}
            </Typography>
          </motion.div>
        </Box>

        {/* Per-game body. */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {children}
        </Box>
      </Container>

      {/* Bottom-left corner companion that reacts to answers (omitted where it would overlap a
          full-viewport interactive grid). */}
      {guide && <GameGuide reaction={guideReaction} />}

      {celebration && (
        <CelebrationEffect
          show={celebration.show}
          intensity={celebration.intensity}
          onComplete={celebration.onComplete}
        />
      )}
    </Box>
  )
}

export default GameShell
