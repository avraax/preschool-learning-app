import React, { useEffect, useRef, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { motion, AnimatePresence } from 'framer-motion'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'
import { progressStore, type StickerAward } from '../../services/progressStore'
import { levelUpBus, type LevelUpEvent } from '../../services/levelUpBus'
import { mascotBus } from '../../services/mascotBus'
import { sfx } from '../../services/sfxClient'
import CelebrationEffect from './CelebrationEffect'
import ProgressionCompanion from './ProgressionCompanion'
import StickerReveal from './StickerReveal'

// The level-up ceremony (Liveliness PRD-01) — a dedicated full-screen overlay mounted once at app
// root so ANY play context (round-result, browse, memory) fires it via `levelUpBus`. Beats: opaque
// scrim (pointer-inert until armed) → biggest confetti + fanfare SFX → mascot cheer → the companion
// grows + ring fills + level badge pops → one spoken Danish praise line. Auto-dismisses (~3.2s) or on
// tap; on dismiss it advances the celebrated-level cursor so it never re-fires (reload/cross-tab
// safe). Reduced motion → no confetti/growth animation, but reward + spoken praise are kept.

const COMIC = '"Comic Sans MS", "Comic Neue", sans-serif'
const DISMISS_MS = 3200

const LevelUpOverlay: React.FC = () => {
  const theme = useTheme()
  const reduce = useReducedMotion()
  const audio = useSimplifiedAudioHook({ componentId: 'LevelUpOverlay', autoInitialize: false })
  const [event, setEvent] = useState<LevelUpEvent | null>(null)
  // The ONE trophy sticker of this level-up (Liveliness PRD-04): stickers became the keepsake of a
  // level-up, so the ceremony grants + reveals exactly one, from ANY path that fires it (round
  // result, browse/menu, safety-net watcher). Granted once per ceremony (grantedRef), cleared on
  // dismiss so the next level-up gets a fresh one.
  const [trophy, setTrophy] = useState<StickerAward | null>(null)
  const grantedRef = useRef(false)
  const spokenRef = useRef(false)
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Subscribe to the bus. While an overlay is already showing, a further emit keeps the HIGHEST
  // level (a multi-level jump collapses to one climactic reveal).
  useEffect(() => {
    return levelUpBus.subscribe((e) => {
      setEvent((prev) =>
        prev ? { level: Math.max(prev.level, e.level), section: e.section ?? prev.section } : e,
      )
    })
  }, [])

  const dismiss = () => {
    if (!event) return
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    dismissTimer.current = null
    // Advance the celebrated cursor so neither this tab nor another re-fires for this level.
    progressStore.markLevelCelebrated(event.level)
    setEvent(null)
    setTrophy(null)
    grantedRef.current = false
    spokenRef.current = false
  }

  // Run the ceremony beats when an event appears.
  useEffect(() => {
    if (!event) return
    // Grant the ONE trophy sticker of this level-up (once per ceremony) and reveal it below. A
    // completed page adds a page-complete fanfare. Reuses the store's next-uncollected → shiny logic.
    if (!grantedRef.current) {
      grantedRef.current = true
      const { award, pageCompleted } = progressStore.grantLevelUpSticker()
      setTrophy(award)
      if (pageCompleted) sfx.play('page-complete')
    }
    // Fanfare + mascot cheer (SFX is a separate channel; safe over the spoken praise).
    sfx.play('level-up')
    mascotBus.emit('round')
    // One spoken praise line (single TTS channel), guarded so a fast dismiss can't double-speak.
    if (!spokenRef.current) {
      spokenRef.current = true
      audio.updateUserInteraction()
      audio.speakLevelUp(event.level).catch(() => {})
    }
    dismissTimer.current = setTimeout(() => dismiss(), DISMISS_MS)
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
      dismissTimer.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.level])

  const dark = theme.scene?.dark
  const level = event?.level ?? 1

  return (
    <AnimatePresence>
      {event && (
        <Box
          component={motion.div}
          onClick={dismiss}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.2 }}
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 12000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: { xs: 2, md: 3 },
            textAlign: 'center',
            cursor: 'pointer',
            // Opaque-enough scrim so the moment reads as its own screen (no compositing flicker of
            // the world behind it). Warm on light worlds, deep on dark worlds.
            background: dark
              ? 'radial-gradient(circle at 50% 42%, rgba(30,40,80,0.86) 0%, rgba(6,10,30,0.94) 100%)'
              : 'radial-gradient(circle at 50% 42%, rgba(255,250,235,0.92) 0%, rgba(255,226,150,0.9) 100%)',
          }}
        >
          {/* Biggest confetti tier, layered above the scrim. */}
          <CelebrationEffect show intensity="high" duration={3400} sx={{ zIndex: 12001 }} />

          {/* Growth reveal — enlarged companion, grows + ring fills to the new level. */}
          <Box sx={{ position: 'relative', zIndex: 12002 }}>
            <ProgressionCompanion
              level={level}
              interactive={false}
              celebrating={!reduce}
              size={180}
              sx={{ [PHONE_LANDSCAPE]: { transform: 'scale(0.7)' } }}
            />
          </Box>

          <Box sx={{ position: 'relative', zIndex: 12002 }}>
            <Typography
              component={motion.div}
              initial={reduce ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 14, delay: 0.15 }}
              sx={{
                fontFamily: theme.titleFontFamily ?? COMIC,
                fontWeight: 800,
                fontSize: 'clamp(2rem, 8vw, 3.4rem)',
                [PHONE_LANDSCAPE]: { fontSize: '1.6rem' },
                color: dark ? '#FFFFFF' : '#6B3F00',
                textShadow: dark ? '0 0 18px rgba(120,170,255,0.6), 0 2px 10px rgba(0,0,0,0.5)' : 'none',
              }}
            >
              Trin {level}! 🎉
            </Typography>
          </Box>

          {/* Trophy sticker of this level-up (Liveliness PRD-04) — the keepsake for the album. */}
          {trophy && (
            <Box sx={{ position: 'relative', zIndex: 12002 }}>
              <StickerReveal
                award={trophy}
                accent={dark ? '#FFD86B' : '#C77800'}
                delay={reduce ? 0 : 0.5}
                size={110}
              />
            </Box>
          )}
        </Box>
      )}
    </AnimatePresence>
  )
}

export default LevelUpOverlay
