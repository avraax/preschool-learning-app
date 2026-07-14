import React, { useEffect, useState } from 'react'
import { AppBar, Box, Container, IconButton, Toolbar, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { STICKER_SETS } from '../../config/stickers'
import { useProgress } from '../../hooks/useProgress'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'
import { sfx } from '../../services/sfxClient'
import { hexToRgba } from '../../theme/tokens/helpers'
import { devNyt } from '../../utils/devHarness'

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
  const { state, markStickersSeen } = useProgress()
  const audio = useSimplifiedAudioHook({ componentId: 'StickerAlbum', autoInitialize: false })
  const [activeIndex, setActiveIndex] = useState(0)
  const [poppedId, setPoppedId] = useState<string | null>(null)
  const [wiggleId, setWiggleId] = useState<string | null>(null)
  const forceNyt = devNyt()

  const immersive = theme.scene.layers.length > 0
  const dark = theme.scene.dark
  const collected = state.stickers.collected
  const newIds = state.stickers.newIds
  const activeSet = STICKER_SETS[activeIndex]
  const accent = theme.palette.primary.main

  const collectedInSet = activeSet.stickers.filter((s) => collected[s.id]).length
  const setComplete = collectedInSet === activeSet.stickers.length

  // Opening the album marks the "new" stickers as seen (the badges clear on the next visit). The
  // ?nyt=1 harness keeps them so the badge is capturable.
  useEffect(() => {
    if (forceNyt) return
    const t = window.setTimeout(() => markStickersSeen(), 1600)
    return () => window.clearTimeout(t)
  }, [forceNyt, markStickersSeen])
  const totalStickersOwned = Object.keys(collected).length
  const grandTotal = STICKER_SETS.reduce((n, s) => n + s.stickers.length, 0)

  const titleColor = dark ? '#FFFFFF' : theme.decor.titleColor

  const handleStickerTap = (id: string, label: string) => {
    if (!collected[id]) {
      // Not yet earned. A silent no-op reads as "broken" at 5 — give a gentle wiggle + a soft
      // "not yet" tap cue instead (PRD-09 P6). No sad/wrong sound; the slot just nudges.
      setWiggleId(id)
      sfx.play('tap')
      window.setTimeout(() => setWiggleId((cur) => (cur === id ? null : cur)), 500)
      return
    }
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
        // Consistent safe-area top gap (matches GameShell + menus + home).
        paddingTop: 'calc(env(safe-area-inset-top) + 8px)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
        background: immersive
          ? 'transparent'
          : `${theme.decor.pageBackground},\n${theme.decor.dots}`,
      }}
    >
      {/* Header: back (left) + lifetime stats (right) */}
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar sx={{ justifyContent: 'space-between', py: 2, [PHONE_LANDSCAPE]: { py: 0.25, minHeight: '48px !important' } }}>
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
            [PHONE_LANDSCAPE]: { fontSize: '1.05rem', mb: 0.5 },
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
            [PHONE_LANDSCAPE]: { mb: 0.5, gap: 0.5 },
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
            [PHONE_LANDSCAPE]: { mb: 0.25, fontSize: '0.75rem' },
          }}
        >
          {collectedInSet} / {activeSet.stickers.length} samlet
        </Typography>

        {/* Set-complete payoff — a shining "hele siden!" ribbon when every sticker on the page is
            collected (the album teases toward this). */}
        {setComplete && (
          <Box
            component={motion.div}
            initial={reduce ? false : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 16 }}
            sx={{
              alignSelf: 'center',
              px: 2,
              py: 0.4,
              mb: { xs: 0.75, md: 1 },
              borderRadius: '999px',
              position: 'relative',
              overflow: 'hidden',
              background: 'linear-gradient(180deg, #FFD86B 0%, #FFB300 100%)',
              border: '2px solid #FF9800',
              boxShadow: '0 4px 14px rgba(255,152,0,0.45)',
              flex: '0 0 auto',
              [PHONE_LANDSCAPE]: { py: 0.2, mb: 0.25 },
              ...(reduce
                ? {}
                : {
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      inset: 0,
                      background:
                        'linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.7) 50%, transparent 60%)',
                      transform: 'translateX(-120%)',
                      animation: 'albumSetShine 3.2s ease-in-out infinite',
                    },
                    '@keyframes albumSetShine': {
                      '0%': { transform: 'translateX(-120%)' },
                      '60%, 100%': { transform: 'translateX(120%)' },
                    },
                  }),
            }}
          >
            <Typography sx={{ fontFamily: COMIC, fontWeight: 800, color: '#5A3A00', fontSize: 'clamp(0.85rem, 2.8vw, 1.05rem)', position: 'relative', zIndex: 1, [PHONE_LANDSCAPE]: { fontSize: '0.72rem' } }}>
              🎉 Hele siden er samlet!
            </Typography>
          </Box>
        )}

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
              // Phone landscape: 3 square rows are too tall — 5 narrow columns → 2 rows.
              [PHONE_LANDSCAPE]: { gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', maxWidth: 430 },
            }}
          >
            {activeSet.stickers.map((sticker, i) => {
              const entry = collected[sticker.id]
              // ?nyt=1 harness: force the first slot owned+new so the badge is capturable.
              const forcedHere = forceNyt && i === 0
              const owned = !!entry || forcedHere
              const shiny = !!entry && entry.count > 1
              const isNew = forcedHere || newIds.includes(sticker.id)
              const popped = poppedId === sticker.id
              const wiggling = wiggleId === sticker.id
              return (
                <Box
                  key={sticker.id}
                  component={motion.button}
                  type="button"
                  onClick={() => handleStickerTap(sticker.id, sticker.label)}
                  animate={
                    reduce
                      ? { scale: 1 }
                      : popped
                        ? { scale: [1, 1.18, 1], rotate: [0, -6, 6, 0] }
                        : wiggling
                          ? { rotate: [0, -7, 7, -5, 5, 0] }
                          : { scale: 1 }
                  }
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
                  {/* Locked slots show the real sticker as a faint grayscale silhouette (teasing
                      what's still uncollected) rather than a bare "?". */}
                  <Typography
                    component="span"
                    sx={{
                      fontSize: 'clamp(2rem, 11vw, 3.4rem)',
                      lineHeight: 1,
                      filter: owned ? 'none' : 'grayscale(1)',
                      opacity: owned ? 1 : 0.28,
                      userSelect: 'none',
                    }}
                  >
                    {sticker.emoji}
                  </Typography>
                  {/* Faint "?" hint + gentle glint over locked slots — teases without revealing. */}
                  {!owned && (
                    <Box
                      aria-hidden
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                        background:
                          'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.35) 0%, transparent 55%)',
                      }}
                    >
                      <Box component="span" sx={{ fontSize: 'clamp(0.9rem, 3.5vw, 1.4rem)', fontWeight: 800, color: hexToRgba(dark ? '#FFFFFF' : '#000000', 0.28) }}>?</Box>
                    </Box>
                  )}
                  {/* "nyt!" badge on a freshly collected sticker (clears on next album visit). */}
                  {owned && isNew && (
                    <Box
                      data-nyt-badge
                      sx={{
                        position: 'absolute',
                        top: -8,
                        left: -6,
                        px: 0.9,
                        py: 0.15,
                        borderRadius: '999px',
                        background: 'linear-gradient(180deg, #FF6B6B 0%, #E53935 100%)',
                        color: '#fff',
                        fontFamily: COMIC,
                        fontWeight: 800,
                        fontSize: 'clamp(0.6rem, 2vw, 0.8rem)',
                        boxShadow: '0 2px 8px rgba(229,57,53,0.5)',
                        transform: 'rotate(-8deg)',
                        zIndex: 2,
                      }}
                    >
                      nyt!
                    </Box>
                  )}
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
