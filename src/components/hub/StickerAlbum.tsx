import React, { useState } from 'react'
import { AppBar, Box, Container, IconButton, Toolbar, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { STICKER_SETS } from '../../config/stickers'
import { useProgress } from '../../hooks/useProgress'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'
import { sfx } from '../../services/sfxClient'
import { hexToRgba } from '../../theme/tokens/helpers'

// The sticker album (Overhaul Foundation — System 2) at /album. A themed "book" with one page
// per set: collected stickers are bright; uncollected are faint "?" silhouettes. Tapping a
// collected sticker pops it and speaks its Danish name (no fail state). Full-viewport no-scroll,
// themed across all 6 skins (transparent over the persistent immersive world; gradient + dots on
// flat skins — mirrors GameShell / HomePage so it sits at the visual quality floor).

const COMIC = '"Comic Sans MS", "Comic Neue", sans-serif'

const StickerAlbum: React.FC = () => {
  const theme = useTheme()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const { state } = useProgress()
  const audio = useSimplifiedAudioHook({ componentId: 'StickerAlbum', autoInitialize: false })
  const [activeIndex, setActiveIndex] = useState(0)
  const [poppedId, setPoppedId] = useState<string | null>(null)

  const immersive = theme.scene.layers.length > 0
  const dark = theme.scene.dark
  const collected = state.stickers.collected
  const activeSet = STICKER_SETS[activeIndex]
  const accent = theme.palette.primary.main

  const collectedInSet = activeSet.stickers.filter((s) => collected[s.id]).length
  const totalStickersOwned = Object.keys(collected).length
  const grandTotal = STICKER_SETS.reduce((n, s) => n + s.stickers.length, 0)

  const titleColor = dark ? '#FFFFFF' : theme.decor.titleColor

  const handleStickerTap = (id: string, label: string) => {
    if (!collected[id]) return
    setPoppedId(id)
    sfx.play('drop-snap')
    audio.updateUserInteraction()
    audio.cancelCurrentAudio()
    audio.speak(label).catch(() => {})
    window.setTimeout(() => setPoppedId((cur) => (cur === id ? null : cur)), 600)
  }

  return (
    <Box
      sx={{
        position: 'relative',
        isolation: 'isolate',
        height: '100dvh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: immersive
          ? 'transparent'
          : `${theme.decor.pageBackground},\n${theme.decor.dots}`,
      }}
    >
      {/* Header: back (left) + lifetime stats (right) */}
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar sx={{ justifyContent: 'space-between', py: 2 }}>
          <IconButton
            onClick={() => navigate('/')}
            color="primary"
            size="large"
            sx={{
              bgcolor: 'rgba(255, 255, 255, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              backdropFilter: 'blur(8px)',
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.9)', transform: 'scale(1.05)' },
            }}
          >
            <ArrowLeft size={24} />
          </IconButton>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <StatPill label={`⭐ ${state.totals.totalStars}`} accent={accent} />
            <StatPill label={`📒 ${totalStickersOwned} / ${grandTotal}`} accent={accent} />
          </Box>
        </Toolbar>
      </AppBar>

      <Container
        maxWidth="md"
        sx={{ flex: 1, display: 'flex', flexDirection: 'column', py: { xs: 1, md: 2 }, overflow: 'hidden' }}
      >
        {/* Title */}
        <Typography
          sx={{
            textAlign: 'center',
            fontFamily: theme.titleFontFamily,
            fontWeight: 700,
            fontSize: { xs: '1.6rem', md: '2.1rem' },
            color: titleColor,
            textShadow: dark
              ? '0 0 16px rgba(120,170,255,0.55), 0 2px 8px rgba(0,0,0,0.5)'
              : `1px 1px 2px ${hexToRgba(theme.decor.titleColor, 0.2)}`,
            mb: { xs: 1, md: 1.5 },
            flex: '0 0 auto',
          }}
        >
          📖 Min Klistermærkebog
        </Typography>

        {/* Page tabs */}
        <Box
          sx={{
            display: 'flex',
            gap: { xs: 0.75, md: 1.25 },
            justifyContent: 'center',
            flexWrap: 'wrap',
            mb: { xs: 1, md: 1.5 },
            flex: '0 0 auto',
          }}
        >
          {STICKER_SETS.map((set, i) => {
            const done = set.stickers.every((s) => collected[s.id])
            const active = i === activeIndex
            return (
              <Box
                key={set.id}
                component="button"
                onClick={() => {
                  sfx.play('tap')
                  setActiveIndex(i)
                }}
                sx={{
                  cursor: 'pointer',
                  border: '2px solid',
                  borderColor: active ? accent : hexToRgba(accent, 0.3),
                  borderRadius: '14px',
                  px: { xs: 1.25, md: 2 },
                  py: { xs: 0.5, md: 0.75 },
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  fontFamily: COMIC,
                  fontWeight: 700,
                  fontSize: 'clamp(0.85rem, 2.6vw, 1.05rem)',
                  color: active ? '#fff' : dark ? '#fff' : theme.palette.text.primary,
                  background: active
                    ? accent
                    : dark
                      ? 'rgba(255,255,255,0.12)'
                      : 'rgba(255,255,255,0.8)',
                  boxShadow: active ? `0 4px 14px ${hexToRgba(accent, 0.45)}` : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <span>{set.emoji}</span>
                <span>{set.title}</span>
                {done && <span aria-label="komplet">✅</span>}
              </Box>
            )
          })}
        </Box>

        {/* Per-page progress */}
        <Typography
          sx={{
            textAlign: 'center',
            fontFamily: COMIC,
            fontWeight: 700,
            color: dark ? '#FFE7A8' : accent,
            fontSize: 'clamp(0.9rem, 2.8vw, 1.1rem)',
            mb: { xs: 1, md: 1.5 },
            flex: '0 0 auto',
          }}
        >
          {collectedInSet} / {activeSet.stickers.length} samlet
        </Typography>

        {/* Sticker grid (3 columns) */}
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: { xs: '10px', sm: '14px', md: '18px' },
              width: '100%',
              maxWidth: { xs: 360, sm: 440, md: 520 },
              '& > *': { aspectRatio: '1 / 1' },
            }}
          >
            {activeSet.stickers.map((sticker) => {
              const entry = collected[sticker.id]
              const owned = !!entry
              const shiny = owned && entry.count > 1
              const popped = poppedId === sticker.id
              return (
                <Box
                  key={sticker.id}
                  component={motion.button}
                  type="button"
                  onClick={() => handleStickerTap(sticker.id, sticker.label)}
                  animate={popped && !reduce ? { scale: [1, 1.18, 1], rotate: [0, -6, 6, 0] } : { scale: 1 }}
                  transition={{ duration: 0.5 }}
                  sx={{
                    position: 'relative',
                    border: '3px solid',
                    borderColor: owned
                      ? shiny
                        ? '#FFB300'
                        : hexToRgba(accent, 0.55)
                      : hexToRgba(dark ? '#FFFFFF' : '#000000', 0.12),
                    borderRadius: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: owned ? 'pointer' : 'default',
                    background: owned
                      ? shiny
                        ? 'linear-gradient(180deg, #FFFDF5 0%, rgba(255,200,61,0.25) 100%)'
                        : 'linear-gradient(180deg, #FFFFFF 0%, #ECF1F8 100%)'
                      : dark
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(255,255,255,0.45)',
                    boxShadow: owned
                      ? `0 6px 0 ${shiny ? hexToRgba('#FFB300', 0.6) : hexToRgba(accent, 0.5)}, 0 8px 18px rgba(0,0,0,0.15)`
                      : 'inset 0 2px 8px rgba(0,0,0,0.08)',
                    WebkitTapHighlightColor: 'transparent',
                    outline: 'none',
                  }}
                >
                  <Typography
                    component="span"
                    sx={{
                      fontSize: 'clamp(2rem, 11vw, 3.4rem)',
                      lineHeight: 1,
                      filter: owned ? 'none' : 'grayscale(1)',
                      opacity: owned ? 1 : 0.25,
                      userSelect: 'none',
                    }}
                  >
                    {owned ? sticker.emoji : '❔'}
                  </Typography>
                  {owned && (
                    <Typography
                      sx={{
                        fontFamily: COMIC,
                        fontWeight: 700,
                        fontSize: 'clamp(0.6rem, 2vw, 0.85rem)',
                        color: theme.palette.text.primary,
                        lineHeight: 1.1,
                        mt: 0.25,
                      }}
                    >
                      {sticker.label}
                    </Typography>
                  )}
                  {shiny && (
                    <Box
                      aria-hidden
                      sx={{
                        position: 'absolute',
                        top: 4,
                        right: 6,
                        fontSize: 'clamp(0.7rem, 2.4vw, 1rem)',
                      }}
                    >
                      ✨
                    </Box>
                  )}
                </Box>
              )
            })}
          </Box>
        </Box>
      </Container>
    </Box>
  )
}

const StatPill: React.FC<{ label: string; accent: string }> = ({ label, accent }) => (
  <Box
    sx={{
      px: 1.5,
      py: 0.5,
      borderRadius: '999px',
      bgcolor: accent,
      color: '#fff',
      fontFamily: COMIC,
      fontWeight: 700,
      fontSize: '1rem',
      boxShadow: `0 4px 14px ${hexToRgba(accent, 0.4)}`,
    }}
  >
    {label}
  </Box>
)

export default StickerAlbum
