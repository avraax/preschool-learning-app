import React, { useEffect, useRef, useState } from 'react'
import { Box, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { motion, AnimatePresence } from 'framer-motion'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'
import { progressStore, type RewardGrant } from '../../services/progressStore'
import { rewardBus, type RewardEvent } from '../../services/rewardBus'
import { mascotBus } from '../../services/mascotBus'
import { sfx } from '../../services/sfxClient'
import { CHAPTER_SIZE } from '../../config/progression'
import { rewardLine, goldRewardLine, CHAPTER_DONE_LINE, BOOK_DONE_LINE } from '../../config/danish-phrases'
import { useCelebration } from './CelebrationEffect'
import CelebrationEffect from './CelebrationEffect'
import ProgressionCompanion from './ProgressionCompanion'
import StickerReveal from './StickerReveal'

// The reward ceremony (Reward Book PRD-01 W4) — a dedicated full-screen overlay mounted once at app
// root so ANY play context (round-result, browse, memory) fires it via `rewardBus`.
//
// **The reward is the headline.** The old "Trin {level}! 🎉" line is gone (PRD D9): the child sees the
// prize the corner ring had been filling around, land in their book. Beats: opaque scrim → confetti +
// fanfare → mascot cheer → the reward pops (StickerReveal) → a 9-dot chapter strip shows WHERE it went
// → exactly ONE spoken line. Closing a chapter escalates to the 'page' tier + a companion stage-up and
// speaks the chapter line instead; filling the book is a one-time finale.
//
// Auto-dismisses or on tap; on dismiss it advances the celebrated-level cursor so it never re-fires
// (reload/cross-tab safe). Reduced motion → no confetti/growth animation, but the reward + the spoken
// line are kept.

const COMIC = '"Comic Sans MS", "Comic Neue", sans-serif'
const DISMISS_MS = 3200
const CHAPTER_DISMISS_MS = 4600
// Extra owed slots (rare — a fast-tier round crossing two, or a browse binge) trail in fast, silently.
const TRAIL_MS = 400

const RewardOverlay: React.FC = () => {
  const theme = useTheme()
  const reduce = useReducedMotion()
  // Prop-level compact, NOT a `transform: scale()`: a transform shrinks pixels but leaves the layout
  // box full height, so the tallest variant (a chapter close = reward + strip + companion + banner)
  // overflowed a 390px-tall phone-landscape viewport — the banner fell off the bottom and the reward
  // was clipped at the top. Real sizes keep the column inside the viewport.
  const phoneLandscape = useMediaQuery(PHONE_LANDSCAPE.replace('@media ', ''))
  const audio = useSimplifiedAudioHook({ componentId: 'RewardOverlay', autoInitialize: false })
  const { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration } = useCelebration()
  const [event, setEvent] = useState<RewardEvent | null>(null)
  // Every reward this ceremony hands over. Normally exactly one; more when a single round crossed two
  // fast-tier slots. Granted ONCE per ceremony (grantedRef), cleared on dismiss.
  const [grants, setGrants] = useState<RewardGrant[]>([])
  const grantedRef = useRef(false)
  const spokenRef = useRef(false)
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Subscribe to the bus. While an overlay is already showing, a further emit keeps the HIGHEST level
  // (a multi-slot jump collapses to one climactic ceremony).
  useEffect(() => {
    return rewardBus.subscribe((e) => {
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
    setGrants([])
    grantedRef.current = false
    spokenRef.current = false
  }

  // Run the ceremony beats when an event appears.
  useEffect(() => {
    if (!event) return
    // Hand over EVERY owed slot in one commit (once per ceremony).
    let owed: RewardGrant[] = grants
    if (!grantedRef.current) {
      grantedRef.current = true
      owed = progressStore.grantPendingRewards()
      setGrants(owed)
    }
    const headline = owed[0]
    const chapterDone = owed.some((g) => g.chapterCompleted)
    const bookDone = owed.some((g) => g.bookCompleted)

    // Fanfare + mascot cheer (SFX is a separate channel; safe over the spoken line). A completed
    // chapter escalates the tier; the finished book gets the biggest one.
    sfx.play('level-up')
    mascotBus.emit('round')
    // Chapter completion is the ONE extra tier (PRD D6) → 'page'. A finished BOOK skips straight back
    // to the biggest tier ('levelup' at full intensity) for the one-time finale.
    celebrateTier(chapterDone && !bookDone ? 'page' : 'levelup')

    // Exactly ONE spoken line — a single TTS channel with no queue means anything more cancels
    // itself. Closing a chapter/book speaks THAT instead of the reward's name.
    if (!spokenRef.current && headline) {
      spokenRef.current = true
      const line = bookDone
        ? BOOK_DONE_LINE
        : chapterDone
          ? CHAPTER_DONE_LINE
          : headline.gold
            ? goldRewardLine(headline.reward.label)
            : rewardLine(headline.reward.label)
      audio.updateUserInteraction()
      audio.speakReward(line).catch(() => {})
    }

    dismissTimer.current = setTimeout(
      () => dismiss(),
      chapterDone || bookDone ? CHAPTER_DISMISS_MS : DISMISS_MS,
    )
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
      dismissTimer.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.level])

  const dark = theme.scene?.dark
  const headline = grants[0] ?? null
  const chapterDone = grants.some((g) => g.chapterCompleted)
  const bookDone = grants.some((g) => g.bookCompleted)
  const accent = dark ? '#FFD86B' : '#C77800'

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
            gap: phoneLandscape ? 0.75 : { xs: 1.5, md: 2.5 },
            textAlign: 'center',
            cursor: 'pointer',
            // Opaque-enough scrim so the moment reads as its own screen (no compositing flicker of
            // the world behind it). Warm on light worlds, deep on dark worlds.
            background: dark
              ? 'radial-gradient(circle at 50% 42%, rgba(30,40,80,0.86) 0%, rgba(6,10,30,0.94) 100%)'
              : 'radial-gradient(circle at 50% 42%, rgba(255,250,235,0.92) 0%, rgba(255,226,150,0.9) 100%)',
          }}
        >
          {/* Confetti, layered above the scrim — tier chosen in the beats effect above. */}
          <CelebrationEffect
            show={showCelebration}
            intensity={celebrationIntensity}
            duration={celebrationDuration}
            onComplete={stopCelebration}
            sx={{ zIndex: 12001 }}
          />

          {/* THE REWARD is the headline. */}
          {headline && (
            <Box sx={{ position: 'relative', zIndex: 12002 }}>
              <StickerReveal
                award={headline}
                accent={accent}
                delay={reduce ? 0 : 0.15}
                size={phoneLandscape ? 96 : 150}
              />
            </Box>
          )}

          {/* Where it went: a 9-dot chapter strip with the just-filled dot popping. Position without
              reading — the child sees "that's the 4th one on this page". */}
          {headline && (
            <Box sx={{ position: 'relative', zIndex: 12002, display: 'flex', gap: 0.75 }}>
              {Array.from({ length: CHAPTER_SIZE }, (_, i) => {
                const filled = i <= headline.slotInChapter
                const isJustFilled = i === headline.slotInChapter
                return (
                  <Box
                    key={i}
                    component={motion.div}
                    initial={reduce || !isJustFilled ? false : { scale: 0.2, opacity: 0 }}
                    animate={isJustFilled && !reduce ? { scale: [0.2, 1.5, 1], opacity: 1 } : { scale: 1, opacity: 1 }}
                    transition={reduce ? { duration: 0 } : { duration: 0.5, delay: 0.6, ease: 'easeOut' }}
                    sx={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      [PHONE_LANDSCAPE]: { width: 10, height: 10 },
                      bgcolor: filled ? accent : 'transparent',
                      border: '2px solid',
                      borderColor: filled ? accent : dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.2)',
                      boxShadow: isJustFilled ? `0 0 10px ${accent}` : 'none',
                    }}
                  />
                )
              })}
            </Box>
          )}

          {/* Extra owed rewards (rare) trail in fast behind the headline, with no extra speech. */}
          {grants.length > 1 && (
            <Box sx={{ position: 'relative', zIndex: 12002, display: 'flex', gap: 1.5 }}>
              {grants.slice(1).map((g, i) => (
                <StickerReveal
                  key={g.reward.id}
                  award={g}
                  accent={accent}
                  delay={reduce ? 0 : 0.6 + ((i + 1) * TRAIL_MS) / 1000}
                  size={phoneLandscape ? 54 : 74}
                />
              ))}
            </Box>
          )}

          {/* Chapter / book completion: the only extra ceremony tier (PRD D6). The companion steps up
              INSIDE this moment, so "a page is full" and "my companion grew" are one event. */}
          {(chapterDone || bookDone) && (
            <>
              <Box sx={{ position: 'relative', zIndex: 12002 }}>
                <ProgressionCompanion
                  interactive={false}
                  showBadge={false}
                  celebrating={!reduce}
                  size={phoneLandscape ? 64 : 120}
                />
              </Box>
              <Typography
                component={motion.div}
                initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 14, delay: 0.9 }}
                sx={{
                  position: 'relative',
                  zIndex: 12002,
                  fontFamily: theme.titleFontFamily ?? COMIC,
                  fontWeight: 800,
                  fontSize: 'clamp(1.4rem, 5.5vw, 2.4rem)',
                  [PHONE_LANDSCAPE]: { fontSize: '1.2rem' },
                  color: dark ? '#FFFFFF' : '#6B3F00',
                  textShadow: dark ? '0 0 18px rgba(120,170,255,0.6), 0 2px 10px rgba(0,0,0,0.5)' : 'none',
                }}
              >
                {bookDone ? 'Hele bogen er samlet!' : '🎉 Hele siden er samlet!'}
              </Typography>
            </>
          )}
        </Box>
      )}
    </AnimatePresence>
  )
}

export default RewardOverlay
