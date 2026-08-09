import React, { useEffect } from 'react'
import { Box, type SxProps, type Theme } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { motion, useAnimationControls } from 'framer-motion'
import { useProgress } from '../../hooks/useProgress'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { onTileColor } from '../../theme/tokens/helpers'
import { xpBus } from '../../services/xpBus'
import { rewardArt } from '../../assets/rewards'
import { uiArt } from '../../assets/ui'
import {
  badgeBottomOffset,
  badgeSize as badgeSizeFor,
  gaugeRotationDeg,
  ringRadius,
  ringStroke,
  sweepFrac,
} from './rewardRingGeometry'

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
// **The ring is a GAUGE with a gap at the bottom, and the badge sits in the gap** (Reward Pacing PRD-01
// D4). On a closed ring the badge is inside the swept path wherever you put it — at bottom-right it
// occluded fill 29%..46%, a quarter of the range in the middle of it. All the geometry is DERIVED from
// the badge in `rewardRingGeometry.ts` (pure, unit-tested at every shipped size); nothing here is a
// tuned percentage.
//
// **THE RING FILLS, AND THAT IS ALL IT DOES** (Endless Play PRD-01 D4). It used to announce a crossing
// three ways over: a full-colour flash of the won prize, a bigger level-up pop, and a soft
// `sticker-reveal` chime — and *then* the actual sticker arrived, up to 90 seconds later, on the round
// result screen. The old comment here called the flash "the beat that TEACHES the whole system"; that
// two-beat ("promise now, payoff later") is an adult's sense of pacing, and for a five-year-old only
// the sticker meant anything. The ceremony now fires IN GAME, at the seam, immediately — so it is the
// entire announcement and the ring has nothing left to promise. **Don't restore the flash as a missing
// beat: its absence is the change.**
//
// Shown in the in-game header (GameShell) and on the section menus, reading the live store
// (useProgress), so switching games keeps the SAME ring climbing. The only transient left is one
// modest pop per grant, via `xpBus`. Reduced motion → the fill still updates, but no pop.
//
// The "+N" flyer is DELETED (Reward Pacing D5). Since the pacing change one answer moves the arc ~4%,
// so the numeral it floated was meaningless to a pre-reader — and it was the second number on a 46px
// control whose whole job is to carry exactly one.

interface RewardRingProps {
  size?: number
  // Phone-landscape: drives the smaller `size` at the call site and lowers the badge's px floor to
  // 16 (20px on a 34px ring is 59% of the diameter — the actual defect behind the old tight fit).
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

const RewardRing: React.FC<RewardRingProps> = ({
  size = 46,
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

  const next = nextReward()
  const fill = Math.max(0, Math.min(1, xpProgress().fill))
  const count = rewardNumber()

  // Gauge geometry — all DERIVED, see rewardRingGeometry.ts. `arc` is the painted sweep's length; the
  // dash gap is deliberately `2c - arc` so the pattern cannot repeat within one revolution (a period
  // of exactly `c` would wrap the fill back around through the gap at low fills).
  const stroke = ringStroke(size)
  const r = ringRadius(size)
  const c = 2 * Math.PI * r
  const arc = c * sweepFrac(size, compact)
  const dashArray = `${arc} ${2 * c - arc}`
  const dash = arc * (1 - fill)

  const ringColor = theme.scene?.progressionCompanion?.ringColor ?? theme.palette.primary.main
  const dark = theme.scene?.dark
  const trackColor = dark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.12)'

  // Badge geometry + colour. The numeral is white, so the DISC has to carry the contrast: a pale skin
  // accent (Havet yellow, Rummet cyan) is unreadable under white text, and `onTileColor` darkens it to
  // AA while being a no-op on an accent that already reads. Same rule as every accent-on-light surface.
  const badgeSize = badgeSizeFor(size, compact)
  const badgeFill = onTileColor(ringColor)

  // React to every live grant with ONE modest pop — the same amplitude whether or not this grant
  // crossed a slot (D4). The old `leveledUp ? 1.35 : 1.14` branch, the 900ms colour flash and the
  // `sticker-reveal` chime are all gone; the ceremony is the announcement. Reads live-store fill on
  // re-render, so the animation only needs the transient beat.
  useEffect(() => {
    return xpBus.subscribe(() => {
      if (reduce) return
      controls.start({ scale: [1, 1.14, 1], transition: { duration: 0.35, ease: 'easeOut' } })
    })
  }, [controls, reduce])

  // What the centre shows: the next silhouette, else (book full) the gold sparkle. Always resolves to
  // art — no glyph path remains.
  const art = next ? rewardArt(next.reward.id) : uiArt.sparkle
  const bookFull = !next
  // Silhouette treatment: the real colours must NEVER read while it's unearned — it has to be
  // obviously "not mine yet". White shape on a dark world, dark shape on a light one.
  const silhouette = dark
    ? { filter: 'brightness(0) invert(1)', opacity: 0.45 }
    : { filter: 'brightness(0)', opacity: 0.3 }
  const centreStyle = bookFull ? { filter: 'none', opacity: 1 } : silhouette

  return (
    <Box
      // Stable hook for the geometry probe (§8.3). NB the <svg> inside is rotated, so ITS
      // getBoundingClientRect is the painted box (size × √2), not the layout box — measure from here.
      data-reward-ring
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
          style={{
            position: 'absolute',
            inset: 0,
            transform: `rotate(${gaugeRotationDeg(size, compact)}deg)`,
          }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={trackColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={dashArray}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={ringColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={dashArray}
            initial={reduce ? false : { strokeDashoffset: arc }}
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

      {/* THE NUMBER, seated in the gauge's gap at bottom centre. Flat opaque disc, one numeral,
          nothing else — see the header. Hidden at 0: an empty badge on a fresh profile teaches
          nothing and is one more thing to decode. The offset is DERIVED (badgeBottomOffset) so the
          badge's centre lands on the ring path, which is what makes the gap's angle exact. */}
      {showCount && count > 0 && (
        <Box
          data-reward-count
          sx={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: badgeBottomOffset(size, compact),
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
            // 700, not 800 (owner, 2026-08-09: the numeral read as "bold and too big"). The disc shrank
            // with it — see `badgeSize` — and the pair now matches ProfileBadge's letter beside it.
            fontWeight: 700,
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

    </Box>
  )
}

export default RewardRing
