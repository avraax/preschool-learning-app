import React from 'react'
import { Box, Typography, type SxProps, type Theme } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { motion } from 'framer-motion'
import { hexToRgba, onTileColor } from '../../theme/tokens/helpers'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { rewardArt } from '../../assets/rewards'
import type { RewardGrant } from '../../services/progressStore'

// The reward reveal moment. The prize pops into a themed slot with a spring scale + sparkle, under a
// "Nyt klistermærke!" banner.
//
// There is no "shiny" variant any more (Reward Horizon PRD-01 §3.5): the gold pass is deleted, so a
// reward is handed over at most once and the banner is always "Nyt". Re-earning something the child
// already owns is not a horizon — a new chapter is.
//
// Renders the baked soft-3D art. All 45 renders ship since de-emoji W6, so there is no glyph path —
// `rewardArtCoverage.test.ts` is what keeps that assumption honest.
//
// Pure visual; speaking the reward name is left to the caller — there is ONE TTS channel and no queue,
// so a ceremony must compose exactly one utterance rather than let each beat speak.
// Matches the depth language of AnswerTile (top-light surface, coloured rim, layered shadow).

interface StickerRevealProps {
  award: RewardGrant
  accent: string // section accent (themed slot tint)
  delay?: number // entrance delay (staggered when several reveal together)
  size?: number // slot size in px (responsive caller can scale)
  sx?: SxProps<Theme> // outer wrapper (callers scale it down in phone-landscape)
}

const SPARKLES = [
  { left: '6%', top: '10%', s: 14, d: 0 },
  { left: '84%', top: '14%', s: 18, d: 0.08 },
  { left: '50%', top: '-8%', s: 20, d: 0.04 },
  { left: '12%', top: '78%', s: 13, d: 0.12 },
  { left: '88%', top: '74%', s: 15, d: 0.1 },
]

const StickerReveal: React.FC<StickerRevealProps> = ({ award, accent, delay = 0, size = 132, sx = {} }) => {
  const theme = useTheme()
  const reduce = useReducedMotion()
  const dark = theme.scene.dark
  const { reward } = award
  const art = rewardArt(reward.id)

  const lip = hexToRgba(accent, 0.55)
  const ambientShadow = dark ? '0 14px 30px rgba(0,0,0,0.5)' : '0 12px 26px rgba(0,0,0,0.18)'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, ...sx }}>
      {/* Banner */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.35 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
          <Typography
            sx={{
              fontFamily: '"Comic Sans MS", "Comic Neue", sans-serif',
              fontWeight: 700,
              fontSize: 'clamp(1rem, 3.5vw, 1.4rem)',
              // Readable-on-white accent on light scenes (onTileColor); white on dark scenes.
              color: dark ? '#FFFFFF' : onTileColor(accent),
              textShadow: dark ? '0 2px 8px rgba(0,0,0,0.5)' : 'none',
            }}
          >
            Nyt klistermærke!
          </Typography>
        </Box>
      </motion.div>

      {/* Slot + sticker */}
      <Box
        component={motion.div}
        initial={reduce ? false : { scale: 0, rotate: -12 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={
          reduce ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 16, delay: delay + 0.1 }
        }
        sx={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: '26px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '4px solid',
          borderColor: accent,
          background: `linear-gradient(180deg, #FFFFFF 0%, ${hexToRgba(accent, 0.14)} 100%)`,
          boxShadow: `0 8px 0 ${lip}, ${ambientShadow}`,
        }}
      >
        <Box
          component="img"
          src={art}
          alt=""
          sx={{
            width: size * 0.72,
            height: size * 0.72,
            objectFit: 'contain',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        />

        {/* Sparkle pop */}
        {!reduce &&
          SPARKLES.map((sp, i) => (
            <Box
              key={i}
              aria-hidden
              component={motion.div}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 1, 0], scale: [0, 1, 0.4] }}
              transition={{ duration: 0.8, delay: delay + 0.15 + sp.d, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                left: sp.left,
                top: sp.top,
                width: sp.s,
                height: sp.s,
                background:
                  'radial-gradient(circle, #ffffff 0%, rgba(255,247,214,0.95) 45%, rgba(255,210,120,0) 78%)',
                clipPath:
                  'polygon(50% 0%, 58% 42%, 100% 50%, 58% 58%, 50% 100%, 42% 58%, 0% 50%, 42% 42%)',
                filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.9))',
              }}
            />
          ))}
      </Box>

      {/* Name */}
      <motion.div
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + 0.35, duration: 0.3 }}
      >
        <Typography
          sx={{
            fontFamily: '"Comic Sans MS", "Comic Neue", sans-serif',
            fontWeight: 700,
            fontSize: 'clamp(1.1rem, 4vw, 1.5rem)',
            color: dark ? '#FFFFFF' : theme.palette.text.primary,
            textShadow: dark ? '0 2px 8px rgba(0,0,0,0.5)' : 'none',
          }}
        >
          {reward.label}
        </Typography>
      </motion.div>
    </Box>
  )
}

export default StickerReveal
