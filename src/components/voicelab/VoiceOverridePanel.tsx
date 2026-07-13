// VoiceOverridePanel — dialog to audition Danish voices inside the real games.
// Opened from the "Til de voksne" adult menu (the old floating 🎙️ button was consolidated
// into that menu). THROWAWAY internal tool (see tmp-prd-voicelab.md / voiceOverride.ts).
//
// Picking a voice/speed here sets a runtime override on ttsClient that applies app-wide, so
// every existing game (letters, numbers-as-words, words) is immediately heard with it.
// "Nulstil" clears the override → back to the production voice. Removed once a voice is chosen.

import React, { useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  FormControlLabel,
  Radio,
  RadioGroup,
  Slider,
  Stack,
  Typography,
} from '@mui/material'
import { ttsClient } from '../../services/ttsClient'
import { TTS_CONFIG } from '../../config/tts-config'
import { OVERRIDE_VOICES, VOICE_TIERS } from './voicelabData'
import AdultBackHeader from '../adult/AdultBackHeader'

const FONT = '"Comic Sans MS", "Comic Sans", cursive'
const DEFAULT_RATE = TTS_CONFIG.speakingRate // 1.05

interface VoiceOverridePanelProps {
  open: boolean
  onClose: () => void
}

const VoiceOverridePanel: React.FC<VoiceOverridePanelProps> = ({ open, onClose }) => {
  const existing = ttsClient.getVoiceOverride()
  const [name, setName] = useState(existing?.name ?? OVERRIDE_VOICES[0].name)
  const [rate, setRate] = useState(existing?.speakingRate ?? DEFAULT_RATE)
  const [wasOpen, setWasOpen] = useState(false)

  // The panel stays mounted inside the adult menu now — re-sync from the live override
  // each time it opens (render-time state adjust, not an effect).
  if (open && !wasOpen) {
    setWasOpen(true)
    const current = ttsClient.getVoiceOverride()
    setName(current?.name ?? OVERRIDE_VOICES[0].name)
    setRate(current?.speakingRate ?? DEFAULT_RATE)
  } else if (!open && wasOpen) {
    setWasOpen(false)
  }

  const apply = (nextName: string, nextRate: number) => {
    const entry = OVERRIDE_VOICES.find((v) => v.name === nextName) ?? OVERRIDE_VOICES[0]
    ttsClient.setVoiceOverride({ name: entry.name, lang: entry.lang, speakingRate: nextRate })
  }

  const handleVoice = (nextName: string) => {
    setName(nextName)
    apply(nextName, rate)
  }

  const handleRate = (nextRate: number) => {
    setRate(nextRate)
    apply(name, nextRate)
  }

  const reset = () => {
    ttsClient.setVoiceOverride(null)
    setName(OVERRIDE_VOICES[0].name)
    setRate(DEFAULT_RATE)
  }

  // Play a sample through the live audio path so the override is exercised exactly as in-game.
  const sample = async (kind: 'letter' | 'number' | 'word') => {
    const text = kind === 'letter' ? 'a' : kind === 'number' ? 'fem' : 'hund'
    try {
      await ttsClient.synthesizeAndPlay(text, 'primary', true)
    } catch {
      /* surfaced via existing audio logging; dialog stays usable */
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <AdultBackHeader title="🎙️ Stemme-test" onBack={onClose} />
      <DialogContent sx={{ fontFamily: FONT }}>
        <Typography sx={{ fontFamily: FONT, fontSize: '0.75rem', color: 'text.secondary', mb: 0.5 }}>
          Skifter den danske fortælle-stemme (engelsk sektion upåvirket).
        </Typography>
        <Box sx={{ maxHeight: 200, overflowY: 'auto', pr: 0.5 }}>
          <RadioGroup value={name} onChange={(e) => handleVoice(e.target.value)}>
            {VOICE_TIERS.map((tier) => (
              <Box key={tier.tier} sx={{ mb: 0.5 }}>
                <Typography sx={{ fontFamily: FONT, fontSize: '0.7rem', color: 'text.secondary', mt: 0.75 }}>
                  {tier.tier}
                </Typography>
                {tier.voices.map((v) => (
                  <FormControlLabel
                    key={v.name}
                    value={v.name}
                    control={<Radio size="small" />}
                    sx={{ '& .MuiFormControlLabel-label': { fontFamily: FONT, fontSize: '0.9rem' } }}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        {v.label}
                        <Chip label={v.gender} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                        {v.current && (
                          <Chip label="lead" size="small" color="success" sx={{ height: 18, fontSize: '0.65rem' }} />
                        )}
                      </Box>
                    }
                  />
                ))}
              </Box>
            ))}
          </RadioGroup>
        </Box>

        <Typography sx={{ fontFamily: FONT, fontSize: '0.85rem', mt: 1.5 }}>
          Hastighed: <strong>{rate.toFixed(2)}</strong>
        </Typography>
        <Slider
          value={rate}
          min={0.6}
          max={1.1}
          step={0.05}
          marks={[{ value: DEFAULT_RATE, label: DEFAULT_RATE.toFixed(2) }]}
          onChange={(_, v) => handleRate(v as number)}
          sx={{ mt: 0.5 }}
        />

        <Stack direction="row" spacing={1} sx={{ mt: 1, width: '100%' }}>
          <Button size="small" variant="outlined" onClick={() => sample('letter')} sx={{ fontFamily: FONT, textTransform: 'none', minHeight: 44, flex: 1, minWidth: 0, px: 0.75 }}>
            Bogstav
          </Button>
          <Button size="small" variant="outlined" onClick={() => sample('number')} sx={{ fontFamily: FONT, textTransform: 'none', minHeight: 44, flex: 1, minWidth: 0, px: 0.75 }}>
            Tal
          </Button>
          <Button size="small" variant="outlined" onClick={() => sample('word')} sx={{ fontFamily: FONT, textTransform: 'none', minHeight: 44, flex: 1, minWidth: 0, px: 0.75 }}>
            Ord
          </Button>
        </Stack>

        <Button onClick={reset} size="small" color="inherit" sx={{ fontFamily: FONT, textTransform: 'none', mt: 1.5, width: '100%', whiteSpace: 'nowrap' }}>
          Nulstil stemme
        </Button>
      </DialogContent>
    </Dialog>
  )
}

export default VoiceOverridePanel
