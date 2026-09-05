import React, { useEffect } from 'react'
import { Box, type SxProps, type Theme } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { motion, useAnimationControls } from 'framer-motion'
import { useProgress } from '../../hooks/useProgress'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { onTileColor } from '../../theme/tokens/helpers'
import { xpBus } from '../../services/xpBus'
import { uiArt } from '../../assets/ui'
import {
  badgeBottomOffset,
  badgeSize as badgeSizeFor,
  centreArtSize,
  gaugeRotationDeg,
  ringRadius,
  ringStroke,
  sweepFrac,
} from './rewardRingGeometry'

// The corner reward ring (Reward Book PRD-01 W3) — and, since Corner identity PRD-01, the ONLY thing
// in that corner.
//
// **The centre IS THE CHILD'S BOOK** — the same baked book object Min Bog wears in its own title, at
// full colour, always. It is theirs and they own it, so it is never dimmed, never a silhouette and
// never gated on progress. Read as one sentence, the control says: *this is my book · the ring around
// it is the next sticker coming · the number is how many I have.* Three facts, one object.
//
// **THE NEXT-PRIZE SILHOUETTE IS DELETED** (Corner identity PRD-01 §2.2), reversing this file's own
// founding decision — *"the ring's centre IS the next prize"* — deliberately and in the open, so
// nobody re-derives it from its own justification. Three things were wrong with it at once:
//   • It was the last survivor of the promise/payoff two-beat that Endless Play PRD-01 D4 already
//     deleted everywhere else, on the finding that for a five-year-old only the sticker meant anything.
//   • It was ILLEGIBLE. 25px of art at `opacity: 0.3` under `filter: brightness(0)` is not identifiable
//     as an object, whatever the object is; the silhouette test in `.claude/rules/scene-assets.md`
//     judges a subject at ~24px in FULL ink, which is a much easier bar than 30% of it.
//   • Against the full-colour portrait 12px away it made the pair look mismatched at equal geometry —
//     same box, roughly triple the ink — which is what the owner reported as "different dimensions".
// **Do not restore it as a missing beat: its absence is the change.** The prize is still previewed,
// in Min Bog, where it is drawn at a size a child can read.
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
  // It renders AT ZERO as well; see the render below for why that reversed.
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
  const { xpProgress, rewardNumber } = useProgress()
  const controls = useAnimationControls()

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

        {/* THE CHILD'S BOOK. Full colour, always — no `filter`, no `opacity`, no branch on progress.
            Sized through `centreArtSize(size)`, which is DERIVED from `size` in the pure geometry
            module like every other quantity here (see it for why it is no longer the flat `size * 0.52`
            the silhouette used). `size` remains the ring's ONE dimension and the book must never
            acquire one of its own — see rewardSurfaces.test.ts on the 7.5px off-centre defect an `sx`
            resize produced. There is nothing to transition any more, so the old filter/opacity
            transition is gone with the states it crossfaded between. */}
        <Box
          component="img"
          src={uiArt.book}
          alt=""
          draggable={false}
          sx={{
            position: 'relative',
            width: centreArtSize(size),
            height: centreArtSize(size),
            objectFit: 'contain',
            userSelect: 'none',
          }}
        />
      </Box>

      {/* THE NUMBER, seated in the gauge's gap at bottom centre. Flat opaque disc, one numeral,
          nothing else — see the header. The offset is DERIVED (badgeBottomOffset) so the badge's
          centre lands on the ring path, which is what makes the gap's angle exact.

          **IT SHOWS AT ZERO** (Corner identity PRD-01 §2.3), reversing this file's own "an empty
          badge on a fresh profile teaches nothing and is one more thing to decode". That was true of
          a bare numeral floating beside a 30%-opacity smudge: a fresh corner was a grey circle with
          nothing in it, saying nothing about book, sticker or reward. With a recognisable book behind
          it the 0 has a referent, and the corner reads "my book · nothing in it yet · this ring is
          filling" — a complete and honest picture on day one. `count >= 100` still widens to a pill. */}
      {showCount && (
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
            // with it — see `badgeSize`. (It was sized to match `ProfileBadge`'s letter disc beside
            // it; that badge is deleted and identity is a pill in the title row now, but the weight
            // was the owner's call about THIS numeral and stands on its own.)
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
