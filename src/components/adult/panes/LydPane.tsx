// "Lyd" — sound effects, music, and the narration voice.
//
// The voice control ABSORBS the old "Stemme-test" panel, slimmed from an audition tool to a real
// SETTING (Settings PRD-01 §2/§8): the tier headings, the gender/"lead" chips and the three sample
// buttons are gone; a curated list, the tempo slider and ONE example remain. The full tool still
// lives at `/voicelab`.
//
// STORAGE IS UNCHANGED — `ttsClient.setVoiceOverride()` → `voicelab_voice_override_v3`. The one added
// nicety: choosing the default voice AT the default tempo CLEARS the override instead of storing a
// redundant one, so the app is provably back on its plain default path.
//
// NO NEW SPOKEN LINES (§9.9). The example plays `letterPhrase('A', 'Abe')` — an already-prebaked,
// already-audited clip — so this work needs no `tts:prebake` and no `/audit` sign-off. (When a
// NON-default voice is selected the sample necessarily goes to live Azure: a prebaked clip is keyed
// on the default voice, which is exactly what auditioning another voice means.)

import React, { useState } from 'react'
import {
  Box,
  Button,
  FormControl,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  Typography,
} from '@mui/material'
import { Music, Play, Volume2, VolumeX } from 'lucide-react'
import { useProgress } from '../../../hooks/useProgress'
import { ttsClient } from '../../../services/ttsClient'
import { TTS_CONFIG } from '../../../config/tts-config'
import { OVERRIDE_VOICES } from '../../voicelab/voicelabData'
import { LETTER_WORDS, letterPhrase } from '../../../config/letterWords'
import { PaneSection } from './paneParts'

const DEFAULT_RATE = TTS_CONFIG.speakingRate // 1.05
const DEFAULT_VOICE = TTS_CONFIG.voices.primary.name

/** Curated: the voices that actually speak Danish. The en-GB audition voices stay in /voicelab. */
const VOICES = OVERRIDE_VOICES.filter((v) => v.lang.startsWith('da'))

/** One already-baked, already-audited line — see the header. */
const SAMPLE_TEXT = letterPhrase('A', LETTER_WORDS.A.word)

const LydPane: React.FC = () => {
  const progress = useProgress()
  const existing = ttsClient.getVoiceOverride()
  const [name, setName] = useState(existing?.name ?? DEFAULT_VOICE)
  const [rate, setRate] = useState(existing?.speakingRate ?? DEFAULT_RATE)

  const apply = (nextName: string, nextRate: number) => {
    // Back at the factory settings → drop the override entirely rather than storing a no-op one.
    if (nextName === DEFAULT_VOICE && nextRate === DEFAULT_RATE) {
      ttsClient.setVoiceOverride(null)
      return
    }
    const entry = VOICES.find((v) => v.name === nextName) ?? VOICES[0]
    ttsClient.setVoiceOverride({ name: entry.name, lang: entry.lang, speakingRate: nextRate })
  }

  const playSample = () => {
    // Never awaited for correctness — a failure is surfaced by the existing audio logging and the
    // pane stays usable.
    void ttsClient.synthesizeAndPlay(SAMPLE_TEXT, 'primary', true).catch(() => {})
  }

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

      <PaneSection title="Oplæsning" hint="Ændrer den danske fortællestemme. Engelsk-sektionen er upåvirket.">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 44 }}>
          <Typography sx={{ flex: '0 0 auto', width: 82, fontSize: '0.9rem' }}>Stemme</Typography>
          <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
            <Select
              value={name}
              onChange={(e) => {
                const v = e.target.value
                setName(v)
                apply(v, rate)
              }}
              inputProps={{ 'aria-label': 'Fortællestemme' }}
            >
              {VOICES.map((v) => (
                <MenuItem key={v.name} value={v.name}>
                  {v.label}
                  {v.name === DEFAULT_VOICE ? ' (standard)' : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 44 }}>
          <Typography sx={{ flex: '0 0 auto', width: 82, fontSize: '0.9rem' }}>Tempo</Typography>
          <Slider
            value={rate}
            min={0.6}
            max={1.1}
            step={0.05}
            marks={[{ value: DEFAULT_RATE, label: 'standard' }]}
            valueLabelDisplay="auto"
            onChange={(_, v) => {
              const next = v as number
              setRate(next)
              apply(name, next)
            }}
            aria-label="Tempo"
            sx={{ flex: 1, mr: 1 }}
          />
        </Box>

        <Button onClick={playSample} startIcon={<Play size={16} />} aria-label="Hør et eksempel" sx={{ mt: 1 }}>
          Hør et eksempel
        </Button>
      </PaneSection>
    </Stack>
  )
}

const ToggleRow: React.FC<{
  icon: React.ReactNode
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}> = ({ icon, label, hint, checked, onChange }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minHeight: 48 }}>
    <Box sx={{ display: 'flex', color: 'text.secondary', flex: '0 0 auto' }}>{icon}</Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: '0.95rem', fontWeight: 600 }}>{label}</Typography>
      {hint && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {hint}
        </Typography>
      )}
    </Box>
    <Switch
      checked={checked}
      onChange={(_, v) => onChange(v)}
      slotProps={{ input: { 'aria-label': `${label} til/fra` } }}
    />
  </Box>
)

export default LydPane
