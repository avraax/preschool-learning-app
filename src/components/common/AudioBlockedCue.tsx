// "Tryk for lyd" — the NON-BLOCKING audio cue (Audio activation PRD-01 §4.4).
//
// Replaces `SimplifiedAudioPermission.tsx`, the full-screen "Tænd for lyd" modal, which was wrong in
// both directions on the owner's iPad: it covered the board while narration was already audible, and
// dismissing it changed nothing. This is a small chip. Nothing behind it is covered, there is no scrim,
// no dismiss button and no session latch — it appears while the verdict is `blocked` and disappears the
// moment the evidence says audio works (`src/config/audioReadiness.ts`).
//
// Placement: top-centre, in the header band's empty middle. Back sits left and the reward ring right on
// BOTH shells (GameShell puts the game title *below* the toolbar; GameSelectionLayout left-aligns its
// title), and the corner mascot is bottom-left, so this collides with nothing by construction rather
// than by a tuned percentage (`.claude/rules/responsive-design.md`). z-index sits BELOW MUI's modal
// default (1300) so an adult dialog covers it.

import React from 'react'
import { Box } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { VolumeOff } from '@mui/icons-material'
import TactilePill from './TactilePill'
import { useSimplifiedAudio } from '../../contexts/SimplifiedAudioContext'
import { useAuthContext } from '../../contexts/AuthContext'
import { devNoGate } from '../../utils/devHarness'
import { shouldShowAudioCue } from '../../config/audioReadiness'
import { hintPulse } from '../../theme/idleMotion'
import { relLuminance } from '../../theme/tokens/helpers'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { audioDebugSession } from '../../utils/remoteConsole'

const AudioBlockedCue: React.FC = () => {
  const theme = useTheme()
  const { state, initializeAudio, updateUserInteraction } = useSimplifiedAudio()
  const auth = useAuthContext()
  const reduce = useReducedMotion()

  // The whole show/hide decision is the pure, unit-tested `shouldShowAudioCue` — including ?nogate=1
  // (DEV screenshot harness) and `authUiOpen` (ONE blocking overlay at a time: "tryk for lyd" is
  // meaningless before you know who is playing). See config/audioReadiness.ts.
  const show = shouldShowAudioCue({
    readiness: state.readiness,
    authUiOpen: auth?.authUiOpen ?? false,
    devNoGate: devNoGate(),
  })

  // A CSS keyframe animation, never a framer `repeat: Infinity` — `idleMotionBudget.test.ts` would fail
  // the build, and this is exactly the "continuous, stateless" case that rule exists for
  // (`.claude/rules/animation-and-performance.md`). It lives on a NESTED layer because a running CSS
  // animation outranks an inline `transform`, which is what the centring translate below is.
  const pulse = hintPulse(reduce)

  if (!show) return null

  // The APP-level accent, not a section one: this chip is global and can be up on any route, so
  // `getCategoryTheme(...)` would be the wrong altitude. Skin-aware by construction (buildTheme).
  const accent = theme.palette.primary.main
  const onAccent = relLuminance(accent) > 0.5 ? '#1F2937' : '#FFFFFF'

  // **`onClick` ONLY.** The tap-through rule (`.claude/rules/audio-system.md`) is unconditional: acting
  // on `pointerdown`/`touchstart` — or from async work a down-event starts — hands the tap's trailing
  // click to whatever sits behind. This cue is small, so the blast radius is smaller; the rule is not.
  const handleTap = () => {
    console.warn('[audio-unlock] "Tryk for lyd" tapped')
    audioDebugSession.addLog('AUDIO_CUE_TAPPED', { timestamp: Date.now() })
    // In-gesture: updateUserInteraction runs the same unlock path every other tap in the app runs.
    updateUserInteraction()
    initializeAudio().catch(() => {
      /* the verdict reports the outcome; nothing to do here */
    })
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 14px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1200,
      }}
    >
      <Box {...pulse.props} sx={[{ display: 'inline-flex' }, pulse.sx]}>
        <TactilePill
          accent={accent}
          onClick={handleTap}
          ariaLabel="Tryk for lyd"
          sx={{
            color: onAccent,
            // 44px minimum touch target comes from TactilePill's own minHeight; this only pads it out.
            px: 2.5,
            py: 1,
            fontSize: '1rem',
            fontWeight: 700,
          }}
        >
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
            <VolumeOff sx={{ fontSize: 22 }} />
          </Box>
          Tryk for lyd
        </TactilePill>
      </Box>
    </Box>
  )
}

export default AudioBlockedCue
