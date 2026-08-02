import React, { useEffect, useRef, useState } from 'react'
import { Box, type SxProps, type Theme } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { motion, useAnimationControls, AnimatePresence } from 'framer-motion'
import { useProgress } from '../../hooks/useProgress'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { onTileColor } from '../../theme/tokens/helpers'
import { xpBus } from '../../services/xpBus'
import { rewardArt } from '../../assets/rewards'
import { uiArt } from '../../assets/ui'
import { useCelebration } from './CelebrationEffect'
import CelebrationEffect from './CelebrationEffect'

// The corner reward ring (Reward Book PRD-01 W3) — the in-game half of the whole model.
//
// **The ring's centre IS the next prize**, shown as a silhouette; the ring fills around it. The same
// object sits in the same next slot of Min Bog, so nothing has to be explained: play → the ring around
// the next prize fills → it's full → that prize is mine, in my book.
//
// **The badge is THE number** (Reward Horizon PRD-01 D1, reversing Reward Book D9's "no number
// anywhere"). It equals `progressStore.rewardNumber()` — how many pictures are in the book — and it is
// never a distance: no "n of 72", no percentage, no "x to go". Only the ring's fill signals nearness.
// It is drawn PLAIN on purpose (flat disc, one numeral, no soft-3D, no gradient, no shadow): decorating
// a symbolic progress element measurably increases the cognitive load for a preschooler.
//
// It also does not move on a mid-game crossing — the sticker has not been handed over yet
// (`grantPendingRewards` runs in the ceremony, which is gated off game routes). The prize flashes here;
// the number ticks there. That two-beat is the model, not a lag.
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
  // The count badge. On by default — it is the number, not decor, so it survives phone-landscape too.
  showCount?: boolean
  // Optional tap. GAMES leave this off (the ring is pure status there, and a stray tap during play
  // must never do anything). Home and the section menus pass a handler that navigates to Min Bog —
  // **the ring is the only door** (Reward Horizon PRD-01 D3). Routing deliberately stays at the CALL
  // SITE, not in here. Supplying it also makes the ring focusable/labelled instead of aria-hidden.
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
  showCount = true,
  onTap,
  ariaLabel,
  sx = {},
}) => {
  const theme = useTheme()
  const reduce = useReducedMotion()
  const { nextReward, xpProgress, rewardNumber } = useProgress()
  const controls = useAnimationControls()
  const { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration } = useCelebration()

  const next = nextReward()
  const fill = Math.max(0, Math.min(1, xpProgress().fill))
  const count = rewardNumber()

  const [flyers, setFlyers] = useState<Flyer[]>([])
  const flyerId = useRef(0)
  // Full-colour flash of the prize that was just won. Holds the OLD reward's visuals for FLASH_MS,
  // because by the time the bus fires the store already advanced to the next slot.
  const [flash, setFlash] = useState<{ art?: string } | null>(null)
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

  // Badge geometry + colour. The numeral is white, so the DISC has to carry the contrast: a pale skin
  // accent (Havet yellow, Rummet cyan) is unreadable under white text, and `onTileColor` darkens it to
  // AA while being a no-op on an accent that already reads. Same rule as every accent-on-light surface.
  const badgeSize = Math.max(20, Math.round(size * 0.46))
  const badgeFill = onTileColor(ringColor)

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
            setFlash({ art: rewardArt(won.reward.id) })
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
  // sparkle. Always resolves to art since W6 landed all 45 renders — no glyph path remains.
  const art = flash ? flash.art : next ? rewardArt(next.reward.id) : uiArt.sparkle
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
        {art && (
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
        )}
      </Box>

      {/* THE NUMBER. Flat opaque disc, one numeral, nothing else — see the header. Hidden at 0: an
          empty badge on a fresh profile teaches nothing and is one more thing to decode. */}
      {showCount && count > 0 && (
        <Box
          data-reward-count
          sx={{
            position: 'absolute',
            right: -Math.round(size * 0.06),
            bottom: -Math.round(size * 0.06),
            minWidth: badgeSize,
            height: badgeSize,
            px: count >= 100 ? 0.5 : 0, // widens to a pill at 3 digits
            borderRadius: '999px',
            bgcolor: badgeFill,
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: '"Comic Sans MS", "Comic Neue", sans-serif',
            fontWeight: 800,
            fontSize: Math.round(badgeSize * 0.62),
            lineHeight: 1,
            // Deliberately NO softShadow/contactShadow/gradient/border — see the header.
            pointerEvents: 'none',
            zIndex: 4,
          }}
        >
          {count}
        </Box>
      )}

      {/* "+N" flyers — float up into the ring on each grant. Spawned left of centre so they don't fly
          straight through the badge in the bottom-right. */}
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
              left: '30%',
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
