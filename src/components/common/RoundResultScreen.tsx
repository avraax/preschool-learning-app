import React, { useEffect, useMemo, useRef, useState } from 'react'
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
import { rewardBus } from '../../services/rewardBus'
import { progressStore } from '../../services/progressStore'
import { levelFromXp } from '../../config/progression'
import { rewardArt } from '../../assets/rewards'
import CelebrationEffect from './CelebrationEffect'
import type { RoundOutcome } from '../../services/progressStore'

// The round result screen (Overhaul Foundation — System 3 + 5). Renders INSIDE GameShell's body
// (replacing the answer grid), so the themed backdrop/header/score stay put. Choreographs the beats —
// stars fly in, a "Ny rekord!" ribbon on a new best, a streak readout, the REWARD METER, then the
// action buttons — each a juice beat (confetti + SFX + one spoken Danish summary). No-scroll, themed
// across all skins, reduced-motion friendly.
//
// Reward Book PRD-01 W7: this screen no longer reveals rewards. It shows the meter filling toward the
// next prize — the visible "this round earned that" link — and hands the actual reveal to the app-root
// ceremony (rewardBus). The old sticker choreography here was unreachable dead code anyway
// (outcome.stickers was hardcoded empty), including an unconditional 'sticker-reveal' SFX that fired
// on every single round with nothing to show.

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
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  // Fast-forward (PRD-09 P1): a tap during the ceremony jumps straight to the interactive buttons.
  // The actions row stays pointer-inert until `buttonsReady`, so an excited tap-burst where the
  // answer tiles used to be can't navigate/replay before the reward is even seen.
  const [ff, setFf] = useState(false)
  const [buttonsReady, setButtonsReady] = useState(false)

  const { stars, anyNewBest, longestStreak } = outcome

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

  // Timeline (ms). Reduced motion collapses the stagger. The star span is the ACTUAL star count
  // (not a fixed 3), so a 1★ result doesn't sit through three empty star-steps of dead air.
  const t = reduce ? { starBase: 0, starStep: 60 } : { starBase: 450, starStep: 340 }
  const starsSpan = stars * t.starStep
  // Reward-meter beat: the bar fills toward the next prize after the stars/ribbon, on EVERY round.
  const xpAt = t.starBase + starsSpan + (anyNewBest ? 700 : 250) + 400
  const buttonsAt = xpAt + (reduce ? 120 : 850)
  // Framer delay (s); 0 once fast-forwarded so every beat snaps to its end state.
  const dly = (ms: number) => (ff ? 0 : ms / 1000)

  // Progress toward the NEXT REWARD, before → after this round. On a crossing the meter simply fills
  // to full ("you filled it up!") and the ceremony reveals the prize as the climactic beat, so this
  // screen never draws the reveal itself.
  const leveledUp = outcome.xp.global.leveledUp
  const before = levelFromXp(outcome.xp.global.xpBefore)
  const after = levelFromXp(outcome.xp.global.xpAfter)
  const meterFrom = before.xpForThisLevel ? before.xpIntoLevel / before.xpForThisLevel : 0
  const meterTo = leveledUp ? 1 : after.xpForThisLevel ? after.xpIntoLevel / after.xpForThisLevel : 0
  // The prize the meter is filling toward — the same silhouette as the corner ring and the book.
  const nextPrize = progressStore.nextReward()
  const nextPrizeArt = nextPrize ? rewardArt(nextPrize.reward.id) : undefined
  // Silhouette treatment, identical to RewardRing/Min Bog so the three surfaces read as one object.
  const silhouette = dark
    ? { filter: 'brightness(0) invert(1)', opacity: 0.45 }
    : { filter: 'brightness(0)', opacity: 0.3 }
  const rewardEmittedRef = useRef(false)

  // One composed Danish summary (single TTS channel — avoid clip cancellation). Guarded so the
  // scheduled play and a fast-forward tap can't double-speak. The reward's OWN line is spoken by the
  // ceremony, not here, so the two moments never talk over each other.
  const speakSummary = () => {
    if (spokenRef.current) return
    spokenRef.current = true
    const parts: string[] = [`Godt klaret! Du fik ${stars} ${stars === 1 ? 'stjerne' : 'stjerner'}.`]
    if (anyNewBest) parts.push('Ny rekord!')
    if (longestStreak >= 3) parts.push(`${longestStreak} i træk!`)
    audio.updateUserInteraction()
    audio.speak(parts.join(' ')).catch(() => {})
  }

  // Tap anywhere during the ceremony → skip to the buttons. A "skip", not a "cancel": the round is
  // already recorded in the store and every beat snaps into place; we just still speak the summary.
  // No-op once the buttons are live.
  const fastForward = () => {
    if (ff || buttonsReady) return
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    speakSummary()
    setFf(true)
    setButtonsReady(true)
  }

  // Fire SFX beats + schedule the spoken summary and the buttons reveal on mount.
  useEffect(() => {
    const timers = timersRef.current
    // round-complete jingle on entry
    sfx.play('round-complete')
    // ascending star "tings"
    for (let i = 0; i < stars; i++) {
      timers.push(
        setTimeout(() => sfx.play('star', { rate: 1 + i * 0.18 }), t.starBase + i * t.starStep),
      )
    }
    // Mascot celebrates the round (bus → corner Mascot). The reward's own reaction belongs to the
    // ceremony, which emits 'round' again when it opens.
    mascotBus.emit('round')

    // Spoken summary, then reveal + arm the action buttons.
    timers.push(setTimeout(() => speakSummary(), reduce ? 300 : 700))
    timers.push(setTimeout(() => setButtonsReady(true), buttonsAt))

    return () => {
      timers.forEach(clearTimeout)
      timersRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reward handoff. Hand off to the app-root <RewardOverlay/> as the climactic final beat once the
  // buttons are ready (or on fast-forward). The crossing usually happened MID-ROUND via live per-task
  // XP (NOT captured in outcome.xp, which is only the round-end bonus), so this MUST trigger off the
  // STORE cursor — `globalLevel() > lastCelebratedLevel` — never outcome.xp.global.leveledUp. The
  // overlay grants + reveals every owed reward and advances the cursor on dismiss. Guarded so it fires
  // exactly once. (This surface is a game route, so RewardWatcher stays quiet here — this direct emit
  // is what plays the ceremony on the result.)
  useEffect(() => {
    if (!buttonsReady || rewardEmittedRef.current) return
    const level = progressStore.globalLevel()
    if (level <= progressStore.get().progression.lastCelebratedLevel) return
    rewardEmittedRef.current = true
    rewardBus.emit({ level, section: outcome.xp.section })
  }, [buttonsReady, outcome])

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
      onClick={fastForward}
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
        // While the ceremony plays, the whole surface is a "skip" target (PRD-09 P1).
        cursor: buttonsReady ? 'default' : 'pointer',
        [PHONE_LANDSCAPE]: { gap: 0.5 },
      }}
    >
      {/* Local hero confetti (GameShell's own celebration is idle here). */}
      <CelebrationEffect show intensity="high" duration={2600} />

      {/* Keyed so a fast-forward tap REMOUNTS every beat (PRD-09 P1): framer won't reschedule an
          already-pending delayed animation just because we lower its delay, so we re-run them from
          scratch with `dly()` → 0. The confetti + the useEffect SFX/TTS beats live outside, so they
          don't re-fire. */}
      <React.Fragment key={ff ? 'ff' : 'play'}>
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
          // Readable-on-white accent on light scenes (onTileColor); white on dark scenes.
          color: dark ? '#FFFFFF' : category.onTileColor,
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
                  : { type: 'spring', stiffness: 360, damping: 10, delay: dly(t.starBase + i * t.starStep) }
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
            delay: dly(t.starBase + starsSpan + 150),
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
          transition={{ delay: dly(t.starBase + starsSpan + 350) }}
          sx={{
            fontFamily: COMIC,
            fontWeight: 700,
            fontSize: 'clamp(1rem, 3.4vw, 1.3rem)',
            // Gold on dark scenes; readable-on-white accent on light scenes.
            color: dark ? '#FFE7A8' : category.onTileColor,
          }}
        >
          🔥 {longestStreak} i træk!
        </Typography>
      )}

      {/* Reward-meter beat — the bar fills toward the NEXT PRIZE, whose silhouette sits at the head
          of it. That's the visible "this round earned that" link, and it's the same object the corner
          ring was filling around all round. Text-free (pre-reader): no number anywhere. */}
      <Box
        component={motion.div}
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: dly(xpAt) }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 1, md: 1.25 },
          width: 'min(340px, 82%)',
        }}
      >
        {/* The next prize, as a silhouette — book full → a gold ✨. */}
        <Box
          aria-hidden
          sx={{
            flex: '0 0 auto',
            width: phoneLandscape ? 28 : 36,
            height: phoneLandscape ? 28 : 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: phoneLandscape ? '1.15rem' : '1.5rem',
            lineHeight: 1,
          }}
        >
          {nextPrize ? (
            nextPrizeArt ? (
              <Box
                component="img"
                src={nextPrizeArt}
                alt=""
                draggable={false}
                sx={{ width: '100%', height: '100%', objectFit: 'contain', ...silhouette }}
              />
            ) : (
              <Box component="span" sx={silhouette}>
                {nextPrize.reward.emoji}
              </Box>
            )
          ) : (
            '✨'
          )}
        </Box>
        {/* Fill bar */}
        <Box
          sx={{
            position: 'relative',
            flex: 1,
            height: 14,
            borderRadius: 7,
            bgcolor: dark ? 'rgba(255,255,255,0.2)' : hexToRgba(accent, 0.16),
            overflow: 'hidden',
            [PHONE_LANDSCAPE]: { height: 10 },
          }}
        >
          <Box
            component={motion.div}
            initial={reduce ? false : { width: `${Math.round(meterFrom * 100)}%` }}
            animate={{ width: `${Math.round(meterTo * 100)}%` }}
            transition={reduce ? { duration: 0 } : { delay: dly(xpAt) + 0.15, duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
            sx={{
              position: 'absolute',
              inset: 0,
              borderRadius: 7,
              background: `linear-gradient(90deg, ${hexToRgba(accent, 0.85)} 0%, ${accent} 100%)`,
              boxShadow: `0 0 10px ${hexToRgba(accent, 0.6)}`,
            }}
          />
        </Box>
      </Box>

      {/* Actions — pointer-inert until visible so a tap during the ceremony fast-forwards instead
          of hitting an invisible button where the answer tiles used to be (PRD-09 P1). */}
      <Box
        component={motion.div}
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: dly(buttonsAt) }}
        sx={{
          display: 'flex',
          gap: { xs: 1, md: 1.5 },
          flexWrap: 'wrap',
          justifyContent: 'center',
          mt: 0.5,
          pointerEvents: buttonsReady ? 'auto' : 'none',
        }}
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
      </React.Fragment>
    </Box>
  )
}

export default RoundResultScreen
