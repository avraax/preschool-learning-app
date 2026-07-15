import React, { useEffect, useRef } from 'react'
import { Box, type SxProps, type Theme } from '@mui/material'
import { motion } from 'framer-motion'
import type { AmbientMotion } from '../../theme/tokens/types'
import { useLivingCard } from '../../hooks/useLivingCard'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { sfx } from '../../services/sfxClient'
import ThemedBurst, { type ThemedBurstHandle } from './ThemedBurst'

// A menu card that's ALIVE (Liveliness PRD-02 §5). Wraps a card's visual (the MUI <Card>) with:
//   • an idle-breathe wrapper (CSS, phased by index),
//   • a framer squash layer that pops on tap (and wiggles on an idle-attract nudge),
//   • a themed particle burst on tap.
// On tap it fires `card-pop`, pops + bursts, then calls `onActivate` (which triggers the wipe).
// Shared by the home cards and the section-menu tiles so both feel identical. The two motion
// layers are nested so the CSS breathe transform and the framer transforms never conflict.

interface LivingCardProps {
  index: number
  frozen?: boolean
  attract?: boolean // one-shot idle-attract nudge (parent toggles true→false)
  burstMotion: AmbientMotion
  onActivate: () => void
  sx?: SxProps<Theme> // applied to the outer breathe wrapper (e.g. width: '100%')
  children: React.ReactNode
}

const LivingCard: React.FC<LivingCardProps> = ({
  index,
  frozen = false,
  attract = false,
  burstMotion,
  onActivate,
  sx,
  children,
}) => {
  const { breatheSx, controls, bump, wiggle } = useLivingCard({ index, frozen })
  const reduce = useReducedMotion()
  const burstRef = useRef<ThemedBurstHandle>(null)

  // Idle-attract: a one-shot wiggle + gentle burst when the parent flags this card (motion only).
  useEffect(() => {
    if (!attract || reduce) return
    wiggle()
    const raf = requestAnimationFrame(() => burstRef.current?.fire())
    return () => cancelAnimationFrame(raf)
  }, [attract, reduce, wiggle])

  const handleClick = () => {
    // SFX (audio) is kept under reduced motion; the squash + burst (motion) are skipped.
    sfx.play('card-pop')
    if (!reduce) {
      bump()
      burstRef.current?.fire()
    }
    onActivate()
  }

  return (
    // Caller layout (e.g. width) on the outer box; breathe (CSS) and squash (framer) live on
    // SEPARATE nested boxes so their transforms never conflict.
    <Box sx={sx}>
      <Box sx={breatheSx}>
        <Box
          component={motion.div}
          animate={controls}
          onClick={handleClick}
          sx={{ position: 'relative', cursor: 'pointer', borderRadius: '16px' }}
        >
          {children}
          {/* Burst overlays the card; particles rise above it (host overflow is visible). */}
          <ThemedBurst ref={burstRef} motionKind={burstMotion} originTop="45%" />
        </Box>
      </Box>
    </Box>
  )
}

export default LivingCard
