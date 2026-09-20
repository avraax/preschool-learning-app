// "Lyd" — sound effects and music. Two switches, nothing else.
//
// THE NARRATION VOICE IS NOT A SETTING (owner, 2026-09-20: remove the possibility of adjusting the
// speaker, and everything related to it). What used to live here was a voice picker plus a tempo
// slider, and both wrote a `voiceOverride` — which changed the TTS cache key, so EVERY spoken line
// missed its prebaked file and went to live Azure. A guest account cannot call Azure at all, so the
// whole app dropped to Web Speech; and the control was a one-way door on any install where the parent
// later couldn't find it. The override mechanism is gone from the client entirely (`ttsClient` has one
// voice per voiceType now), so an already-persisted `voicelab_voice_override_v3` key is simply inert.
//
// Don't re-add a voice control here. `/voicelab` remains the off-menu tool for auditioning voices.

import React, { useState } from 'react'
import { Stack, Typography } from '@mui/material'
import { Music, Volume2, VolumeX } from 'lucide-react'
import { useProgress } from '../../../hooks/useProgress'
import { audioEverWorked } from '../../../utils/audioEverWorked'
import { PaneSection, ToggleRow } from './paneParts'
import { showDevTools } from '../../../utils/adultDevTools'

const LydPane: React.FC = () => {
  const progress = useProgress()
  const devTools = showDevTools()
  // Read once per open — it only ever flips false->true, and the pane is a modal snapshot.
  const [everWorked] = useState(() => audioEverWorked())

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

      {/* Read-only. The ONE audio fact the adult cannot get anywhere else: whether sound has EVER
          worked on this device, which separates "it has never worked here" from "it worked and then
          stopped". Device-scoped (`bl-audio-ever-worked`), never per-child, and it gates nothing —
          a device where audio worked yesterday can be blocked today (Audio activation PRD-01 §4.5). */}
      {devTools && (
        <PaneSection title="Lyd på denne enhed">
          <Typography sx={{ fontSize: '0.9rem', opacity: 0.85 }}>
            {everWorked ? 'Lyd har virket på denne enhed.' : 'Lyd har endnu ikke virket på denne enhed.'}
          </Typography>
        </PaneSection>
      )}
    </Stack>
  )
}

export default LydPane
