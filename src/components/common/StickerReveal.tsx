import React from 'react'
import { Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { motion } from 'framer-motion'
import { hexToRgba, onTileColor } from '../../theme/tokens/helpers'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import type { StickerAward } from '../../services/progressStore'

// The sticker reveal moment (Overhaul Foundation — System 2). A sticker pops into a themed slot
// with a spring scale + sparkle, under a "Nyt klistermærke!" banner. Shiny duplicates get extra
// shimmer (a positive "ooh, a shiny!" — never a "you already have this" sadness).
//
// Pure visual; speaking the sticker name is left to the caller (RoundResultScreen composes one
// TTS line for the whole result so clips don't cancel each other — there is only one TTS channel).
// Matches the depth language of AnswerTile (top-light surface, coloured rim, layered shadow).

interface StickerRevealProps {
  award: StickerAward
  accent: string // section accent (themed slot tint)
  delay?: number // entrance delay (staggered when several reveal together)
  size?: number // slot size in px (responsive caller can scale)
}

const SPARKLES = [
  { left: '6%', top: '10%', s: 14, d: 0 },
  { left: '84%', top: '14%', s: 18, d: 0.08 },
  { left: '50%', top: '-8%', s: 20, d: 0.04 },
  { left: '12%', top: '78%', s: 13, d: 0.12 },
  { left: '88%', top: '74%', s: 15, d: 0.1 },
]

const StickerReveal: React.FC<StickerRevealProps> = ({ award, accent, delay = 0, size = 132 }) => {
  const theme = useTheme()
  const reduce = useReducedMotion()
  const dark = theme.scene.dark
  const { sticker, isShiny } = award

  const lip = hexToRgba(accent, 0.55)
  const ambientShadow = dark ? '0 14px 30px rgba(0,0,0,0.5)' : '0 12px 26px rgba(0,0,0,0.18)'
  const shinyGold = '#FFC83D'
  const ringColor = isShiny ? shinyGold : accent

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      {/* Banner */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.35 }}
      >
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
          {isShiny ? 'Skinnende! ✨' : 'Nyt klistermærke!'}
        </Typography>
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
          borderColor: ringColor,
          background: isShiny
            ? `linear-gradient(180deg, #FFFDF5 0%, ${hexToRgba(shinyGold, 0.28)} 100%)`
            : `linear-gradient(180deg, #FFFFFF 0%, ${hexToRgba(accent, 0.14)} 100%)`,
          boxShadow: isShiny
            ? `0 0 0 4px ${hexToRgba(shinyGold, 0.4)}, 0 8px 0 ${hexToRgba(shinyGold, 0.6)}, ${ambientShadow}`
            : `0 8px 0 ${lip}, ${ambientShadow}`,
        }}
      >
        <Typography
          component="span"
          sx={{ fontSize: size * 0.5, lineHeight: 1, userSelect: 'none' }}
        >
          {sticker.emoji}
        </Typography>

        {/* Shiny shimmer sweep */}
        {isShiny && !reduce && (
          <Box
            aria-hidden
            component={motion.div}
            initial={{ x: '-120%' }}
            animate={{ x: '120%' }}
            transition={{ delay: delay + 0.4, duration: 1.1, repeat: Infinity, repeatDelay: 1.2 }}
            sx={{
              position: 'absolute',
              inset: 0,
              borderRadius: '22px',
              background:
                'linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.85) 50%, transparent 65%)',
              pointerEvents: 'none',
            }}
          />
        )}

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
          {sticker.label}
          {award.count > 1 ? ` ×${award.count}` : ''}
        </Typography>
      </motion.div>
    </Box>
  )
}

export default StickerReveal
