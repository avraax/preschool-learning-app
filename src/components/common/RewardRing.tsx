import React, { useEffect, useRef, useState } from 'react'
import { Box, type SxProps, type Theme } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { motion, useAnimationControls, AnimatePresence } from 'framer-motion'
import { useProgress } from '../../hooks/useProgress'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { xpBus } from '../../services/xpBus'
import { rewardArt } from '../../assets/rewards'
import { uiArt } from '../../assets/ui'
import { useCelebration } from './CelebrationEffect'
import CelebrationEffect from './CelebrationEffect'

// The corner reward ring (Reward Book PRD-01 W3) — the in-game half of the whole model.
//
// **The ring's centre IS the next prize**, shown as a silhouette; the ring fills around it. The same
// object sits in the same next slot of Min Bog, so nothing has to be explained: play → the ring around
// the next prize fills → it's full → that prize is mine, in my book. There is deliberately **no
// number** here (PRD D9) — a pre-reader reads the picture, and the only count in the app is the book's.
//
// Shown in the in-game header (GameShell) and on the section menus, reading the live store
// (useProgress), so switching games keeps the SAME ring climbing. Transient flourish via `xpBus`:
//   • ring "tick"/"pop" on every grant,
//   • a small "+N" flyer that floats up into the ring,
//   • (in-game only, `flourish`) a non-interrupting burst when a grant crosses a slot,
//   • and the beat that TEACHES the system: on a crossing the silhouette drops its filter for ~900ms
//     so the prize flashes to full colour, then the NEXT silhouette takes its place.
// Reduced motion → the fill still updates, but no spring, flyer, pop or colour flash.

interface RewardRingProps {
  size?: number
  // In-game instance: fire the non-interrupting confetti + fanfare on a mid-game crossing. Menu
  // instances leave this false — the big ceremony (RewardOverlay) owns the celebration there.
  flourish?: boolean
  // Phone-landscape: shrink and hide the "+N" flyer so it never fights the title/score row.
  compact?: boolean
  // Optional tap. Menus/games leave this off (the ring is pure status there, and a stray tap during
  // play must never do anything). HOME passes a handler so tapping it speaks how many rewards are in
  // the book — the affordance the growing companion used to carry before it moved into the Min Bog
  // card. Supplying it also makes the ring focusable/labelled instead of aria-hidden.
  onTap?: () => void
  ariaLabel?: string
  sx?: SxProps<Theme>
}

interface Flyer {
  id: number
  amount: number
}

// How long the just-won prize stays in full colour before the next silhouette replaces it.
const FLASH_MS = 900

const RewardRing: React.FC<RewardRingProps> = ({
  size = 46,
  flourish = false,
  compact = false,
  onTap,
  ariaLabel,
  sx = {},
}) => {
  const theme = useTheme()
  const reduce = useReducedMotion()
  const { nextReward, xpProgress } = useProgress()
  const controls = useAnimationControls()
  const { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration } = useCelebration()

  const next = nextReward()
  const fill = Math.max(0, Math.min(1, xpProgress().fill))

  const [flyers, setFlyers] = useState<Flyer[]>([])
  const flyerId = useRef(0)
  // Full-colour flash of the prize that was just won. Holds the OLD reward's visuals for FLASH_MS,
  // because by the time the bus fires the store already advanced to the next slot.
  const [flash, setFlash] = useState<{ art?: string; emoji: string } | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shownRef = useRef(next)
  shownRef.current = next

  // Ring geometry (mirrors ProgressionCompanion).
  const stroke = Math.max(4, Math.round(size * 0.1))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = c * (1 - fill)

  const ringColor = theme.scene?.progressionCompanion?.ringColor ?? theme.palette.primary.main
  const dark = theme.scene?.dark
  const trackColor = dark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.12)'

  // React to every live grant: tick/pop the ring, spawn a "+N" flyer, and on a crossing flash the won
  // prize to full colour + (in-game) burst. Reads live-store fill on re-render, so the animation only
  // needs the transient beats.
  useEffect(() => {
    return xpBus.subscribe(({ amount, leveledUp }) => {
      if (!reduce) {
        controls.start({
          scale: leveledUp ? [1, 1.35, 1] : [1, 1.14, 1],
          transition: { duration: leveledUp ? 0.55 : 0.35, ease: 'easeOut' },
        })
        if (amount > 0 && !compact) {
          const id = ++flyerId.current
          setFlyers((f) => [...f, { id, amount }])
          setTimeout(() => setFlyers((f) => f.filter((x) => x.id !== id)), 1000)
        }
        // The teaching beat: the silhouette that was filling becomes a real, full-colour prize.
        if (leveledUp) {
          const won = shownRef.current
          if (won) {
            setFlash({ art: rewardArt(won.reward.id), emoji: won.reward.emoji })
            if (flashTimer.current) clearTimeout(flashTimer.current)
            flashTimer.current = setTimeout(() => setFlash(null), FLASH_MS)
          }
        }
      }
      // Non-interrupting mid-game crossing burst (in-game only). The big ceremony is deferred.
      if (leveledUp && flourish) celebrateTier('levelup-mini')
    })
  }, [controls, reduce, compact, flourish, celebrateTier])

  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current)
  }, [])

  // What the centre shows: the flashing won prize, else the next silhouette, else (book full) the gold
  // sparkle. Book-full always resolves to art now (de-emoji W3), so `emoji` is only the per-reward
  // fallback that W6 deletes with the last reward render.
  const art = flash ? flash.art : next ? rewardArt(next.reward.id) : uiArt.sparkle
  const emoji = flash ? flash.emoji : next ? next.reward.emoji : ''
  const bookFull = !next && !flash
  // Silhouette treatment: the real colours must NEVER read while it's unearned — it has to be
  // obviously "not mine yet". White shape on a dark world, dark shape on a light one.
  const silhouette = dark
    ? { filter: 'brightness(0) invert(1)', opacity: 0.45 }
    : { filter: 'brightness(0)', opacity: 0.3 }
  const centreStyle = flash || bookFull ? { filter: 'none', opacity: 1 } : silhouette

  return (
    <Box
      sx={{
        position: 'relative',
        width: size,
        height: size,
        flex: '0 0 auto',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        cursor: onTap ? 'pointer' : 'default',
        WebkitTapHighlightColor: 'transparent',
        ...sx,
      }}
      onClick={onTap}
      {...(onTap
        ? { role: 'button' as const, tabIndex: 0, 'aria-label': ariaLabel }
        : { 'aria-hidden': true })}
    >
      <Box
        component={motion.div}
        animate={controls}
        sx={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}
        >
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={ringColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={reduce ? false : { strokeDashoffset: c }}
            animate={{ strokeDashoffset: dash }}
            transition={reduce ? { duration: 0 } : { duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
            style={{ filter: `drop-shadow(0 0 4px ${ringColor})` }}
          />
        </svg>

        {/* The next prize — a silhouette while unearned, full colour for the win flash. */}
        {art ? (
          <Box
            component="img"
            src={art}
            alt=""
            sx={{
              position: 'relative',
              width: Math.round(size * 0.52),
              height: Math.round(size * 0.52),
              objectFit: 'contain',
              transition: reduce ? 'none' : 'filter 220ms ease, opacity 220ms ease',
              ...centreStyle,
            }}
          />
        ) : (
          <Box
            sx={{
              position: 'relative',
              fontSize: Math.round(size * 0.44),
              lineHeight: 1,
              transition: reduce ? 'none' : 'filter 220ms ease, opacity 220ms ease',
              ...centreStyle,
            }}
          >
            {emoji}
          </Box>
        )}
      </Box>

      {/* "+N" flyers — float up into the ring on each grant. */}
      <AnimatePresence>
        {flyers.map((f) => (
          <Box
            key={f.id}
            component={motion.div}
            initial={{ opacity: 0, y: size * 0.55, scale: 0.7 }}
            animate={{ opacity: [0, 1, 1, 0], y: -size * 0.15, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut', times: [0, 0.25, 0.7, 1] }}
            sx={{
              position: 'absolute',
              left: '50%',
              top: 0,
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              fontFamily: '"Comic Sans MS", "Comic Neue", sans-serif',
              fontWeight: 800,
              fontSize: Math.round(size * 0.4),
              color: ringColor,
              textShadow: '0 1px 4px rgba(0,0,0,0.35), 0 0 8px rgba(255,255,255,0.6)',
              whiteSpace: 'nowrap',
              zIndex: 5,
            }}
          >
            +{f.amount}
          </Box>
        ))}
      </AnimatePresence>

      {/* Non-interrupting mid-game crossing burst (in-game only). */}
      {flourish && (
        <CelebrationEffect
          show={showCelebration}
          intensity={celebrationIntensity}
          duration={celebrationDuration}
          onComplete={stopCelebration}
        />
      )}
    </Box>
  )
}

export default RewardRing
