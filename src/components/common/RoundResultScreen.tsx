import React, { useEffect, useMemo, useRef } from 'react'
import { Box, Button, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { RotateCcw, Home, BookOpen } from 'lucide-react'
import { getCategoryTheme } from '../../config/categoryThemes'
import { hexToRgba } from '../../theme/tokens/helpers'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'
import { sfx } from '../../services/sfxClient'
import { mascotBus } from '../../services/mascotBus'
import CelebrationEffect from './CelebrationEffect'
import StickerReveal from './StickerReveal'
import type { RoundOutcome } from '../../services/progressStore'

// The round result / reward hero screen (Overhaul Foundation — System 3 + 5). Renders INSIDE
// GameShell's body (replacing the answer grid), so the themed backdrop/header/score stay put.
// Choreographs the reward beats — stars fly in, a "Ny rekord!" ribbon on a new best, a streak
// readout, the sticker reveal(s), then the action buttons — each a juice beat (confetti + SFX +
// one spoken Danish summary). No-scroll, themed across all skins, reduced-motion friendly.

interface RoundResultScreenProps {
  outcome: RoundOutcome
  categoryId: string
  backRoute: string
  onReplay: () => void
}

const COMIC = '"Comic Sans MS", "Comic Neue", sans-serif'

const RoundResultScreen: React.FC<RoundResultScreenProps> = ({
  outcome,
  categoryId,
  backRoute,
  onReplay,
}) => {
  const theme = useTheme()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  // Prop-level compact (sx can't reach the StickerReveal size prop).
  const phoneLandscape = useMediaQuery(PHONE_LANDSCAPE.replace('@media ', ''))
  const audio = useSimplifiedAudioHook({ componentId: 'RoundResultScreen', autoInitialize: false })
  const category = getCategoryTheme(categoryId)
  const accent = category.accentColor
  const dark = theme.scene.dark
  const spokenRef = useRef(false)

  const { stars, anyNewBest, longestStreak, stickers, pageCompleted } = outcome

  // Improved bests, as old→new lines for the ribbon.
  const bestLines = useMemo(() => {
    const lines: string[] = []
    if (outcome.newBests.streak)
      lines.push(`Længste stime: ${outcome.previousBests.streak} → ${longestStreak}`)
    if (outcome.newBests.stars)
      lines.push(`Stjerner: ${outcome.previousBests.stars} → ${stars}`)
    if (outcome.newBests.count)
      lines.push(`Rigtige: ${outcome.previousBests.count} → ${outcome.correct}`)
    return lines.slice(0, 2)
  }, [outcome, longestStreak, stars])

  // Timeline (ms). Reduced motion collapses the stagger.
  const t = reduce
    ? { starBase: 0, starStep: 60, sticker: 200 }
    : { starBase: 450, starStep: 340, sticker: 0 }
  const stickerAt = t.starBase + 3 * t.starStep + (anyNewBest ? 700 : 250) + 400
  const buttonsAt = stickerAt + 800

  // Fire SFX beats + the single spoken summary on mount.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    // round-complete jingle on entry
    sfx.play('round-complete')
    // ascending star "tings"
    for (let i = 0; i < stars; i++) {
      timers.push(
        setTimeout(() => sfx.play('star', { rate: 1 + i * 0.18 }), t.starBase + i * t.starStep),
      )
    }
    // sticker chime
    timers.push(setTimeout(() => sfx.play('sticker-reveal'), stickerAt))
    // page-complete fanfare (one-off)
    if (pageCompleted) timers.push(setTimeout(() => sfx.play('page-complete'), stickerAt + 500))

    // Mascot celebrates the round, then reacts again to the sticker reveal (bus → corner Mascot).
    mascotBus.emit('round')
    if (stickers.length) timers.push(setTimeout(() => mascotBus.emit('sticker'), stickerAt))

    // One composed Danish summary (single TTS channel — avoid clip cancellation).
    if (!spokenRef.current) {
      spokenRef.current = true
      const parts: string[] = [`Godt klaret! Du fik ${stars} ${stars === 1 ? 'stjerne' : 'stjerner'}.`]
      if (anyNewBest) parts.push('Ny rekord!')
      if (longestStreak >= 3) parts.push(`${longestStreak} i træk!`)
      const names = stickers.map((s) => s.sticker.label).join(' og ')
      parts.push(
        `Du fik ${stickers.length > 1 ? 'nye klistermærker' : 'et nyt klistermærke'}: ${names}.`,
      )
      if (pageCompleted) parts.push(`Du har samlet hele ${pageCompleted.title} siden!`)
      timers.push(
        setTimeout(() => {
          audio.updateUserInteraction()
          audio.speak(parts.join(' ')).catch(() => {})
        }, reduce ? 300 : 700),
      )
    }

    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const starSlots = [0, 1, 2]

  const buttonBase = {
    fontFamily: COMIC,
    fontWeight: 700,
    borderRadius: '16px',
    textTransform: 'none' as const,
    minHeight: 52,
    px: { xs: 2, md: 3 },
    fontSize: 'clamp(0.95rem, 2.6vw, 1.15rem)',
    [PHONE_LANDSCAPE]: { minHeight: 44, fontSize: '0.85rem', px: 1.5 },
  }

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: { xs: 1.25, md: 2 },
        overflow: 'hidden',
        textAlign: 'center',
        [PHONE_LANDSCAPE]: { gap: 0.5 },
      }}
    >
      {/* Local hero confetti (GameShell's own celebration is idle here). Bigger on page-complete. */}
      <CelebrationEffect show intensity="high" duration={pageCompleted ? 3400 : 2600} />

      {/* Headline */}
      <Typography
        component={motion.h2}
        initial={reduce ? false : { opacity: 0, y: -14, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        sx={{
          fontFamily: theme.titleFontFamily,
          fontWeight: 700,
          fontSize: 'clamp(1.6rem, 6vw, 2.6rem)',
          [PHONE_LANDSCAPE]: { fontSize: '1.25rem' },
          color: dark ? '#FFFFFF' : accent,
          textShadow: dark ? '0 0 16px rgba(120,170,255,0.5), 0 2px 8px rgba(0,0,0,0.5)' : 'none',
          m: 0,
        }}
      >
        Færdig! 🎉
      </Typography>

      {/* Stars */}
      <Box sx={{ display: 'flex', gap: { xs: 1, md: 1.5 } }}>
        {starSlots.map((i) => {
          const earned = i < stars
          return (
            <Box
              key={i}
              component={motion.div}
              initial={reduce ? false : { scale: 0, rotate: -40 }}
              animate={{ scale: earned ? 1 : 0.78, rotate: 0 }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 360, damping: 10, delay: (t.starBase + i * t.starStep) / 1000 }
              }
              sx={{
                fontSize: 'clamp(2.6rem, 11vw, 4.2rem)',
                [PHONE_LANDSCAPE]: { fontSize: '2rem' },
                lineHeight: 1,
                filter: earned
                  ? 'drop-shadow(0 4px 10px rgba(255,180,0,0.55))'
                  : 'grayscale(1)',
                opacity: earned ? 1 : 0.35,
                userSelect: 'none',
              }}
            >
              ⭐
            </Box>
          )
        })}
      </Box>

      {/* Ny rekord ribbon */}
      {anyNewBest && (
        <Box
          component={motion.div}
          initial={reduce ? false : { opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 16,
            delay: (t.starBase + 3 * t.starStep + 150) / 1000,
          }}
          sx={{
            px: 2.5,
            py: 0.75,
            borderRadius: '999px',
            background: 'linear-gradient(180deg, #FFD86B 0%, #FFB300 100%)',
            border: '3px solid #FF9800',
            boxShadow: '0 6px 16px rgba(255,152,0,0.45)',
          }}
        >
          <Typography sx={{ fontFamily: COMIC, fontWeight: 700, color: '#5A3A00', fontSize: 'clamp(1rem, 3.6vw, 1.3rem)' }}>
            🏆 Ny rekord!
          </Typography>
          {bestLines.map((l) => (
            <Typography key={l} sx={{ fontFamily: COMIC, fontWeight: 600, color: '#7A4F00', fontSize: 'clamp(0.75rem, 2.6vw, 0.95rem)' }}>
              {l}
            </Typography>
          ))}
        </Box>
      )}

      {/* Streak readout */}
      {longestStreak >= 3 && (
        <Typography
          component={motion.div}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: (t.starBase + 3 * t.starStep + 350) / 1000 }}
          sx={{
            fontFamily: COMIC,
            fontWeight: 700,
            fontSize: 'clamp(1rem, 3.4vw, 1.3rem)',
            color: dark ? '#FFE7A8' : accent,
          }}
        >
          🔥 {longestStreak} i træk!
        </Typography>
      )}

      {/* Sticker reveal(s) */}
      <Box sx={{ display: 'flex', gap: { xs: 2, md: 3 }, flexWrap: 'wrap', justifyContent: 'center' }}>
        {stickers.map((award, i) => (
          <StickerReveal
            key={`${award.sticker.id}-${i}`}
            award={award}
            accent={accent}
            delay={stickerAt / 1000 + i * 0.45}
            size={phoneLandscape ? 76 : 110}
          />
        ))}
      </Box>

      {/* Actions */}
      <Box
        component={motion.div}
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: buttonsAt / 1000 }}
        sx={{ display: 'flex', gap: { xs: 1, md: 1.5 }, flexWrap: 'wrap', justifyContent: 'center', mt: 0.5 }}
      >
        <Button
          variant="contained"
          onClick={onReplay}
          startIcon={<RotateCcw size={22} />}
          sx={{
            ...buttonBase,
            bgcolor: accent,
            color: '#fff',
            boxShadow: `0 6px 18px ${hexToRgba(accent, 0.5)}`,
            '&:hover': { bgcolor: accent, filter: 'brightness(1.05)' },
          }}
        >
          Spil igen
        </Button>
        <Button
          variant="outlined"
          onClick={() => navigate('/album')}
          startIcon={<BookOpen size={22} />}
          sx={{
            ...buttonBase,
            color: dark ? '#fff' : accent,
            borderColor: accent,
            borderWidth: 2,
            bgcolor: 'rgba(255,255,255,0.7)',
            '&:hover': { borderWidth: 2, borderColor: accent, bgcolor: 'rgba(255,255,255,0.9)' },
          }}
        >
          Se bog
        </Button>
        <Button
          variant="text"
          onClick={() => navigate(backRoute)}
          startIcon={<Home size={22} />}
          sx={{ ...buttonBase, color: dark ? '#fff' : theme.palette.text.primary }}
        >
          Tilbage
        </Button>
      </Box>
    </Box>
  )
}

export default RoundResultScreen
