// VoiceOverridePanel — small floating 🎙️ button + popover to audition Danish voices
// inside the real games. THROWAWAY internal tool (see tmp-prd-voicelab.md / voiceOverride.ts).
//
// Picking a voice/speed here sets a runtime override on ttsClient that applies app-wide, so
// every existing game (letters, numbers-as-words, words) is immediately heard with it.
// "Nulstil" clears the override → back to the production voice. Removed once a voice is chosen.

import React, { useState } from 'react'
import {
  Box,
  Button,
  Chip,
  FormControlLabel,
  IconButton,
  Popover,
  Radio,
  RadioGroup,
  Slider,
  Stack,
  Typography,
} from '@mui/material'
import { Mic } from 'lucide-react'
import { ttsClient } from '../../services/ttsClient'
import { TTS_CONFIG } from '../../config/tts-config'
import { OVERRIDE_VOICES, VOICE_TIERS } from './voicelabData'

const FONT = '"Comic Sans MS", "Comic Sans", cursive'
const DEFAULT_RATE = TTS_CONFIG.speakingRate // 0.9

const VoiceOverridePanel: React.FC = () => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const existing = ttsClient.getVoiceOverride()
  const [name, setName] = useState(existing?.name ?? OVERRIDE_VOICES[0].name)
  const [rate, setRate] = useState(existing?.speakingRate ?? DEFAULT_RATE)

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
      /* surfaced via existing audio logging; popover stays usable */
    }
  }

  const overrideActive = !!ttsClient.getVoiceOverride()

  return (
    <>
      <IconButton
        onClick={(e) => setAnchorEl(e.currentTarget)}
        aria-label="Stemme-test"
        sx={{
          position: 'fixed',
          bottom: 52, // sits just above the version chip (bottom: 8)
          right: 10,
          zIndex: 1002,
          width: 36,
          height: 36,
          opacity: 0.5,
          bgcolor: overrideActive ? 'primary.main' : 'rgba(255,255,255,0.55)',
          color: overrideActive ? 'primary.contrastText' : 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255,255,255,0.3)',
          '&:hover': { opacity: 1 },
        }}
      >
        <Mic size={18} />
      </IconButton>

      <Popover
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Box sx={{ p: 2, width: 260, fontFamily: FONT }}>
          <Typography sx={{ fontFamily: FONT, fontWeight: 700, mb: 1 }}>🎙️ Stemme-test</Typography>

          <Typography sx={{ fontFamily: FONT, fontSize: '0.75rem', color: 'text.secondary', mb: 0.5 }}>
            Skifter den danske fortælle-stemme (engelsk sektion uupåvirket).
          </Typography>
          <Box sx={{ maxHeight: 260, overflowY: 'auto', pr: 0.5 }}>
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

          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Button size="small" variant="outlined" onClick={() => sample('letter')} sx={{ fontFamily: FONT, textTransform: 'none', minHeight: 44, flex: 1 }}>
              Bogstav
            </Button>
            <Button size="small" variant="outlined" onClick={() => sample('number')} sx={{ fontFamily: FONT, textTransform: 'none', minHeight: 44, flex: 1 }}>
              Tal
            </Button>
            <Button size="small" variant="outlined" onClick={() => sample('word')} sx={{ fontFamily: FONT, textTransform: 'none', minHeight: 44, flex: 1 }}>
              Ord
            </Button>
          </Stack>

          <Button onClick={reset} size="small" color="inherit" sx={{ fontFamily: FONT, textTransform: 'none', mt: 1.5, width: '100%' }}>
            Nulstil (nuværende stemme)
          </Button>
        </Box>
      </Popover>
    </>
  )
}

export default VoiceOverridePanel
