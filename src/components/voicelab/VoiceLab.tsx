// VoiceLab — hidden /voicelab page to audition every free Danish voice.
//
// THROWAWAY internal tool (see tmp-prd-voicelab.md). NOT in any menu; reachable only by URL.
//
// EXPLICIT EXCEPTION to .claude/rules/audio-system.md: this page drives arbitrary voice
// names the SimplifiedAudioController doesn't model, so it owns a fully self-contained
// player (one HTMLAudioElement + Web Speech) here. It does NOT touch production audio code.
// Plain text only — no SSML — for a fair apples-to-apples comparison (Chirp voices reject SSML).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { TTS_CONFIG } from '../../config/tts-config'
import {
  CURRENT_VOICE,
  SAMPLE_SEGMENTS,
  VOICE_TIERS,
  type VoiceEntry,
} from './voicelabData'

// Single shared playback target — discriminated by source so we can drive both
// Google (HTTP base64) and the device's Web Speech voice through one selection.
type ActiveVoice =
  | { kind: 'google'; entry: VoiceEntry }
  | { kind: 'webspeech'; voice: SpeechSynthesisVoice }

const FONT = '"Comic Sans MS", "Comic Sans", cursive'
// OGG_OPUS per TTS_CONFIG.audioConfig — match the data-URL mime so browsers decode it.
const AUDIO_MIME = 'audio/ogg'

const VoiceLab: React.FC = () => {
  // ---- self-contained single-audio player --------------------------------
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // busyKey identifies which (item, mode) tap is currently fetching/playing so we can
  // show a per-tap "spiller…" state. errorMsg surfaces failures inline (page never crashes).
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [webVoices, setWebVoices] = useState<SpeechSynthesisVoice[]>([])
  const [active, setActive] = useState<ActiveVoice>({ kind: 'google', entry: CURRENT_VOICE })
  const [segmentId, setSegmentId] = useState(SAMPLE_SEGMENTS[0].id)
  const [showAllChirp3, setShowAllChirp3] = useState(false)

  // One shared HTMLAudioElement for all Google playback (single-audio, no queue).
  useEffect(() => {
    audioRef.current = new Audio()
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [])

  // <meta name="robots" content="noindex"> only while on this page.
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => {
      document.head.removeChild(meta)
    }
  }, [])

  // Web Speech Danish voices — async; voices are often empty on first call.
  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const load = () => {
      const da = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith('da'))
      setWebVoices(da)
    }
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  const stopAll = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.src = ''
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }, [])

  // Clean up audio when leaving the page.
  useEffect(() => () => stopAll(), [stopAll])

  const playGoogle = useCallback(async (text: string, entry: VoiceEntry) => {
    // Chirp voices reject the `pitch` parameter (Google returns INVALID_ARGUMENT — it does
    // NOT silently ignore it). Drop pitch for them and keep speakingRate; the child would
    // hear their natural pitch anyway (PRD §9). Other tiers keep the full app audioConfig.
    const isChirp = entry.name.includes('Chirp')
    const audioConfig = isChirp
      ? { ...TTS_CONFIG.audioConfig, pitch: undefined }
      : { ...TTS_CONFIG.audioConfig }
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        isSSML: false,
        voice: { languageCode: 'da-DK', name: entry.name, ssmlGender: entry.ssmlGender },
        audioConfig,
      }),
    })
    if (!res.ok) {
      let detail = ''
      try {
        detail = (await res.json())?.details || ''
      } catch {
        /* ignore */
      }
      throw new Error(`${entry.name}: HTTP ${res.status}${detail ? ` — ${detail}` : ''}`)
    }
    const { audioContent } = await res.json()
    const audio = audioRef.current
    if (!audio) throw new Error('Audio ikke understøttet')
    audio.src = `data:${AUDIO_MIME};base64,${audioContent}`
    await audio.play()
  }, [])

  const playWebSpeech = useCallback((text: string, voice: SpeechSynthesisVoice) => {
    return new Promise<void>((resolve, reject) => {
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'da-DK'
      u.voice = voice
      u.rate = 0.8
      u.pitch = 1.1
      u.onend = () => resolve()
      u.onerror = (e) => reject(new Error(`Web Speech: ${e.error || 'fejl'}`))
      window.speechSynthesis.speak(u)
    })
  }, [])

  // Play `text` with either the active voice or the A/B reference (the current default).
  const play = useCallback(
    async (text: string, key: string, mode: 'active' | 'ref') => {
      stopAll()
      setErrorMsg(null)
      setBusyKey(`${key}:${mode}`)
      try {
        if (mode === 'ref') {
          await playGoogle(text, CURRENT_VOICE)
        } else if (active.kind === 'google') {
          await playGoogle(text, active.entry)
        } else {
          await playWebSpeech(text, active.voice)
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : String(err))
      } finally {
        setBusyKey((k) => (k === `${key}:${mode}` ? null : k))
      }
    },
    [active, playGoogle, playWebSpeech, stopAll],
  )

  const activeLabel = useMemo(() => {
    if (active.kind === 'google') return active.entry.name
    return `Enhed: ${active.voice.name}`
  }, [active])

  const segment = SAMPLE_SEGMENTS.find((s) => s.id === segmentId) ?? SAMPLE_SEGMENTS[0]

  const isGoogleActive = (e: VoiceEntry) => active.kind === 'google' && active.entry.name === e.name
  const isWebActive = (v: SpeechSynthesisVoice) =>
    active.kind === 'webspeech' && active.voice.voiceURI === v.voiceURI

  const voiceButton = (entry: VoiceEntry) => (
    <Button
      key={entry.name}
      onClick={() => setActive({ kind: 'google', entry })}
      variant={isGoogleActive(entry) ? 'contained' : 'outlined'}
      size="small"
      sx={{
        fontFamily: FONT,
        textTransform: 'none',
        minHeight: 44,
        borderRadius: 2,
        justifyContent: 'flex-start',
      }}
    >
      {entry.label}
      <Chip
        label={entry.gender}
        size="small"
        sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
        color={entry.gender === 'F' ? 'secondary' : 'info'}
      />
      {entry.current && (
        <Chip label="Nuværende" size="small" color="success" sx={{ ml: 1, height: 20, fontSize: '0.7rem' }} />
      )}
    </Button>
  )

  return (
    // The app's global CSS pins #root to overflow:hidden (no-scroll game layouts), so this
    // page owns its own scroll container instead of relying on the document scrolling.
    <Box
      sx={{
        height: 'calc(var(--vh, 1vh) * 100)',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
    <Container maxWidth="lg" sx={{ py: 3, fontFamily: FONT }}>
      <Typography variant="h4" sx={{ fontFamily: FONT, fontWeight: 700, mb: 0.5 }}>
        🎙️ VoiceLab
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
        Skjult værktøj til at sammenligne danske stemmer. Vælg en stemme, og tryk på en prøve.
      </Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Aktiv stemme: <strong>{activeLabel}</strong>
      </Typography>

      {errorMsg && (
        <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, bgcolor: 'error.light', color: 'error.contrastText' }}>
          ⚠️ {errorMsg}
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
        {/* ---- voice picker ------------------------------------------------ */}
        <Box sx={{ flex: '0 0 auto', width: { xs: '100%', md: 300 } }}>
          <Typography variant="h6" sx={{ fontFamily: FONT, mb: 1 }}>
            Stemmer
          </Typography>
          {VOICE_TIERS.map((tier) => {
            const isChirp3 = tier.tier === 'Chirp3-HD'
            const visible = isChirp3 && !showAllChirp3 ? tier.voices.filter((v) => v.shortlist) : tier.voices
            return (
              <Box key={tier.tier} sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontFamily: FONT, color: 'text.secondary' }}>
                  {tier.tier}
                </Typography>
                <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                  {visible.map(voiceButton)}
                </Stack>
                {isChirp3 && (
                  <Button
                    onClick={() => setShowAllChirp3((s) => !s)}
                    size="small"
                    sx={{ fontFamily: FONT, textTransform: 'none', mt: 0.5 }}
                  >
                    {showAllChirp3 ? 'Vis kun udvalgte' : 'Vis alle Chirp3-HD'}
                  </Button>
                )}
              </Box>
            )
          })}

          <Divider sx={{ my: 1.5 }} />
          <Typography variant="subtitle2" sx={{ fontFamily: FONT, color: 'text.secondary' }}>
            Enhedens stemme (Web Speech)
          </Typography>
          {webVoices.length === 0 ? (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
              Ingen danske enhedsstemmer fundet.
            </Typography>
          ) : (
            <Stack spacing={0.75} sx={{ mt: 0.5 }}>
              {webVoices.map((v) => (
                <Button
                  key={v.voiceURI}
                  onClick={() => setActive({ kind: 'webspeech', voice: v })}
                  variant={isWebActive(v) ? 'contained' : 'outlined'}
                  size="small"
                  sx={{ fontFamily: FONT, textTransform: 'none', minHeight: 44, borderRadius: 2, justifyContent: 'flex-start' }}
                >
                  Enhed: {v.name}
                </Button>
              ))}
            </Stack>
          )}
        </Box>

        {/* ---- samples ----------------------------------------------------- */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <ToggleButtonGroup
            value={segmentId}
            exclusive
            onChange={(_, v) => v && setSegmentId(v)}
            sx={{ mb: 2, flexWrap: 'wrap' }}
          >
            {SAMPLE_SEGMENTS.map((s) => (
              <ToggleButton key={s.id} value={s.id} sx={{ fontFamily: FONT, textTransform: 'none', minHeight: 44 }}>
                {s.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {segment.groups.map((group, gi) => (
            <Box key={gi} sx={{ mb: 2 }}>
              {group.label && (
                <Typography variant="subtitle2" sx={{ fontFamily: FONT, color: 'text.secondary', mb: 0.5 }}>
                  {group.label}
                </Typography>
              )}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {group.items.map((item, ii) => {
                  const key = `${segment.id}:${gi}:${ii}`
                  const activeBusy = busyKey === `${key}:active`
                  const refBusy = busyKey === `${key}:ref`
                  return (
                    <Box
                      key={key}
                      sx={{
                        display: 'flex',
                        alignItems: 'stretch',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}
                    >
                      <Button
                        onClick={() => play(item, key, 'active')}
                        sx={{ fontFamily: FONT, textTransform: 'none', minHeight: 44, px: 1.5, gap: 0.5 }}
                      >
                        {activeBusy ? <CircularProgress size={16} /> : null}
                        {item}
                      </Button>
                      <Button
                        onClick={() => play(item, key, 'ref')}
                        title={`Afspil med ${CURRENT_VOICE.label} (nuværende)`}
                        sx={{
                          fontFamily: FONT,
                          textTransform: 'none',
                          minHeight: 44,
                          minWidth: 44,
                          px: 1,
                          borderLeft: '1px solid',
                          borderColor: 'divider',
                          color: 'text.secondary',
                        }}
                      >
                        {refBusy ? <CircularProgress size={16} /> : '↔'}
                      </Button>
                    </Box>
                  )
                })}
              </Box>
            </Box>
          ))}

          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            ↔ = afspil samme tekst med <strong>{CURRENT_VOICE.name}</strong> (nuværende) til A/B-sammenligning.
          </Typography>
        </Box>
      </Box>
    </Container>
    </Box>
  )
}

export default VoiceLab
