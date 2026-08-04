import React from 'react'
import { Box, Typography } from '@mui/material'
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
  /**
   * DEGRADED MODE (Practice Loop PRD-01 W4). When narration is dead, the answer is printed here — the
   * spoken number for Tal Quiz, the English word for Lyt og Find.
   *
   * This **deliberately re-creates the giveaway the owner removed**: the board now restates its own
   * answer and the task degrades to shape-matching. That is the correct trade ONLY here, because these
   * two boards are unanswerable in silence, and the alternative is a child tapping at random until an
   * adult notices. Pass `undefined` whenever narration is healthy — the caller reads
   * `audio.narrationHealthy`, never `isAudioReady` (see `config/narrationHealth.ts`).
   */
  reveal?: string
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
const ListenHero: React.FC<ListenHeroProps> = ({ accent, speaking, reveal }) => {
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
      {/* The equalizer is HIDDEN in degraded mode — partly because bars that report on playback are
          meaningless when nothing can play, and partly because the focal band has no room for both:
          phone landscape gives it ~95px total, and measured with the bars still in, the revealed word
          overlapped the "Hør igen" pill by 2px at 844×390 and 667×375. Reserving by removing the
          element beats shaving pixels off it (responsive-design.md). */}
      {reveal ? null : (
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
      )}
      {/* Degraded mode: the answer, as type. See the `reveal` prop for why this giveaway is correct
          here and nowhere else. It appears and disappears with the live health signal, so a round
          recovers mid-play the moment a clip actually sounds. No warning glyph beside it — no emoji
          ships, child surfaces take baked art only, and a warning is for the adult, who already gets
          audio health in the bug report. */}
      {reveal ? (
        <Typography
          data-narration-fallback
          sx={{
            fontWeight: 800,
            color: accent,
            lineHeight: 1,
            letterSpacing: '0.04em',
            userSelect: 'none',
            fontSize: 'clamp(1.6rem, 6vh, 3rem)',
            [PHONE_LANDSCAPE]: { fontSize: '1.1rem' },
          }}
        >
          {reveal}
        </Typography>
      ) : null}
    </Box>
  )
}

export default ListenHero
