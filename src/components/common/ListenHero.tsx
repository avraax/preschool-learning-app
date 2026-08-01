import React from 'react'
import { Box } from '@mui/material'
import { motion } from 'framer-motion'
import { Volume2 } from 'lucide-react'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'

interface ListenHeroProps {
  /** Section accent for the speaker + bars. */
  accent: string
  /**
   * REAL playback state — pass `audio.isPlaying` from the hook, never a component-level flag
   * (see `.claude/rules/audio-system.md`). Bars dance while the app speaks, settle when it's the
   * child's turn.
   */
  speaking: boolean
}

/**
 * The "listen" focal-zone hero: a speaker glyph + equalizer bars, deliberately carrying NO picture,
 * numeral or glyph — for tasks whose prompt lives entirely in the audio and where showing the
 * subject would hand over the answer.
 *
 * Used by Lyt og Find (audio → picture) and Tal Quiz's numeral band (spoken number → numeral; the
 * numeral used to be printed above tiles that included it, which made the tap pure shape-matching).
 * The speaker pulses ONLY when idle ("your turn — tap, or Hør igen") and holds steady while the clip
 * plays, so the two states never both animate. Reduced motion → both static.
 */
const ListenHero: React.FC<ListenHeroProps> = ({ accent, speaking }) => {
  const reduce = useReducedMotion()
  return (
    // The column must FIT the focal zone, which is only ~50px tall in phone landscape: the old
    // 51px glyph + 24px bars overflowed upward and the speaker was clipped by GameShell's
    // overflow:hidden root (visible in the shipped Lyt og Find phone capture). Hence minHeight:0 +
    // the compact phone sizes below rather than a taller column.
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        minHeight: 0,
        maxHeight: '100%',
        [PHONE_LANDSCAPE]: { gap: 0.4 },
      }}
    >
      <Box
        aria-hidden
        component={motion.div}
        animate={reduce || speaking ? undefined : { scale: [1, 1.09, 1] }}
        transition={reduce || speaking ? undefined : { duration: 1.7, repeat: Infinity, ease: 'easeInOut' }}
        sx={{
          display: 'flex',
          color: accent,
          '& svg': { width: 'clamp(3.5rem, 14vh, 7rem)', height: 'auto' },
          // Sized with headroom for the 1.09 idle pulse — the zone leaves only ~47px once the
          // "Hør igen" pill takes its share, so the resting glyph has to stay well under that.
          [PHONE_LANDSCAPE]: { '& svg': { width: 'clamp(1.3rem, 8vh, 1.7rem)' } },
        }}
      >
        <Volume2 strokeWidth={2.25} />
      </Box>
      <Box
        aria-hidden
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '4px',
          height: 24,
          flex: '0 0 auto',
          [PHONE_LANDSCAPE]: { height: 10, gap: '3px' },
        }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <Box
            key={i}
            component={motion.div}
            // Dance only while audio actually plays; otherwise settle to a calm low resting bar.
            animate={reduce ? undefined : speaking ? { scaleY: [0.4, 1, 0.5, 0.9, 0.4] } : { scaleY: 0.3 }}
            transition={
              reduce
                ? undefined
                : speaking
                  ? { duration: 0.9, repeat: Infinity, delay: i * 0.1, ease: 'easeInOut' }
                  : { duration: 0.3, ease: 'easeOut' }
            }
            sx={{
              width: 6,
              height: '100%',
              transformOrigin: 'bottom',
              borderRadius: 3,
              bgcolor: accent,
              opacity: reduce || speaking ? 1 : 0.55,
              [PHONE_LANDSCAPE]: { width: 4 },
            }}
          />
        ))}
      </Box>
    </Box>
  )
}

export default ListenHero
