// "Lyd" — sound effects and music. Two switches, and nothing else.
//
// THE NARRATION VOICE IS NOT A SETTING (owner, 2026-09-20: remove the possibility of adjusting the
// speaker, and everything related to it). What used to live here was a voice picker plus a tempo
// slider, and both wrote a `voiceOverride` — which changed the TTS cache key, so EVERY spoken line
// missed its prebaked file and went to live Azure. A guest account cannot call Azure at all, so the
// whole app dropped to Web Speech; and the control was a one-way door on any install where the parent
// later couldn't find it. The override mechanism is gone from the client entirely (`ttsClient` has one
// voice per voiceType now), so an already-persisted `voicelab_voice_override_v3` key is simply inert.
//
// NOR IS "Lyd på denne enhed" (owner, 2026-09-20: "don't know what it's for" — which is the verdict on
// a row, not a request for better wording). It printed whether audio had EVER worked on this device,
// which is a debugging fact rather than something an adult can act on: it gated nothing and offered no
// control. **The signal itself is untouched** — `noteAudioWorked` still records it and
// `getPermissionSnapshot().everWorked` still carries it into every bug report, which is where it was
// always actually read from. Only the row is gone.
//
// Don't re-add a voice control or a diagnostic readout here. `/voicelab` remains the off-menu tool for
// auditioning voices, and the bug report is where device audio facts belong.

import React from 'react'
import { Stack } from '@mui/material'
import { Music, Volume2, VolumeX } from 'lucide-react'
import { useProgress } from '../../../hooks/useProgress'
import { ToggleRow } from './paneParts'

const LydPane: React.FC = () => {
  const progress = useProgress()

  return (
    <Stack spacing={2.5}>
      <Stack>
        <ToggleRow
          icon={progress.state.settings.sfxEnabled ? <Volume2 size={19} /> : <VolumeX size={19} />}
          label="Lydeffekter"
          checked={progress.state.settings.sfxEnabled}
          onChange={(v) => progress.setSetting('sfxEnabled', v)}
        />
        <ToggleRow
          icon={<Music size={19} />}
          label="Musik"
          hint="Spiller kun på menu-skærmene."
          checked={progress.state.settings.musicEnabled}
          onChange={(v) => progress.setSetting('musicEnabled', v)}
        />
      </Stack>
    </Stack>
  )
}

export default LydPane
