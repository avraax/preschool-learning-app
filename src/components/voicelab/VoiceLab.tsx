// VoiceLab — hidden /voicelab page to audition Azure voices + tune the pronunciation lexicon.
//
// THROWAWAY internal tool (see tmp-prd-audio-rebuild.md §10). NOT in any menu; reachable only by URL.
//
// EXPLICIT EXCEPTION to .claude/rules/audio-system.md: this page drives arbitrary voice names the
// SimplifiedAudioController doesn't model, so it owns a fully self-contained player (one
// HTMLAudioElement + Web Speech). It does NOT touch production audio code, but it DOES call the
// real /api/tts-azure endpoint so samples are heard exactly as in-game (incl. the lexicon).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { TTS_CONFIG } from '../../config/tts-config'
import {
  CURRENT_VOICE,
  MASCOT_SFX,
  MASCOT_SOUNDS,
  SAMPLE_SEGMENTS,
  VOICE_TIERS,
  type MascotSound,
  type VoiceEntry,
} from './voicelabData'

// Single shared playback target — discriminated by source so we can drive both
// Azure (HTTP base64) and the device's Web Speech voice through one selection.
type ActiveVoice =
  | { kind: 'azure'; entry: VoiceEntry }
  | { kind: 'webspeech'; voice: SpeechSynthesisVoice }

const FONT = '"Comic Sans MS", "Comic Sans", cursive'
const AUDIO_MIME = TTS_CONFIG.mime // 'audio/ogg' — match the Azure Opus output

const VoiceLab: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [webVoices, setWebVoices] = useState<SpeechSynthesisVoice[]>([])
  const [active, setActive] = useState<ActiveVoice>({ kind: 'azure', entry: CURRENT_VOICE })
  const [segmentId, setSegmentId] = useState(SAMPLE_SEGMENTS[0].id)
  const [useLexicon, setUseLexicon] = useState(true)

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

  useEffect(() => () => stopAll(), [stopAll])

  const playAzure = useCallback(
    async (text: string, entry: VoiceEntry) => {
      const res = await fetch('/api/tts-azure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voiceName: entry.name,
          lang: entry.lang,
          useLexicon, // da-DK only; server ignores for non-da voices
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
    },
    [useLexicon],
  )

  const playWebSpeech = useCallback((text: string, voice: SpeechSynthesisVoice) => {
    return new Promise<void>((resolve, reject) => {
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'da-DK'
      u.voice = voice
      u.rate = 0.85
      u.onend = () => resolve()
      u.onerror = (e) => reject(new Error(`Web Speech: ${e.error || 'fejl'}`))
      window.speechSynthesis.speak(u)
    })
  }, [])

  // Play `text` with either the active voice or the A/B reference (the lead default, Christel).
  const play = useCallback(
    async (text: string, key: string, mode: 'active' | 'ref') => {
      stopAll()
      setErrorMsg(null)
      setBusyKey(`${key}:${mode}`)
      try {
        if (mode === 'ref') {
          await playAzure(text, CURRENT_VOICE)
        } else if (active.kind === 'azure') {
          await playAzure(text, active.entry)
        } else {
          await playWebSpeech(text, active.voice)
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : String(err))
      } finally {
        setBusyKey((k) => (k === `${key}:${mode}` ? null : k))
      }
    },
    [active, playAzure, playWebSpeech, stopAll],
  )

  // Mascot tap-sound auditioner: each candidate plays with its mascot's fixed voice + pitch/rate
  // (lexicon off — these are nonsense vocalizations). Lock one per mascot once it sounds right.
  const playMascot = useCallback(
    async (text: string, sound: MascotSound, key: string) => {
      stopAll()
      setErrorMsg(null)
      setBusyKey(key)
      try {
        const res = await fetch('/api/tts-azure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            voiceName: sound.voiceName,
            lang: sound.lang,
            pitch: sound.pitch,
            speed: sound.rate,
            useLexicon: false,
          }),
        })
        if (!res.ok) {
          let detail = ''
          try {
            detail = (await res.json())?.details || ''
          } catch {
            /* ignore */
          }
          throw new Error(`${sound.label}: HTTP ${res.status}${detail ? ` — ${detail}` : ''}`)
        }
        const { audioContent } = await res.json()
        const audio = audioRef.current
        if (!audio) throw new Error('Audio ikke understøttet')
        audio.src = `data:${AUDIO_MIME};base64,${audioContent}`
        await audio.play()
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : String(err))
      } finally {
        setBusyKey((k) => (k === key ? null : k))
      }
    },
    [stopAll],
  )

  // Real SFX auditioner: play a static sound file (CC-BY) straight through the shared <audio>.
  const playFile = useCallback(
    async (url: string, key: string) => {
      stopAll()
      setErrorMsg(null)
      setBusyKey(key)
      try {
        const audio = audioRef.current
        if (!audio) throw new Error('Audio ikke understøttet')
        audio.src = url
        await audio.play()
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : String(err))
      } finally {
        setBusyKey((k) => (k === key ? null : k))
      }
    },
    [stopAll],
  )

  const activeLabel = useMemo(() => {
    if (active.kind === 'azure') return active.entry.name
    return `Enhed: ${active.voice.name}`
  }, [active])

  const segment = SAMPLE_SEGMENTS.find((s) => s.id === segmentId) ?? SAMPLE_SEGMENTS[0]

  const isAzureActive = (e: VoiceEntry) => active.kind === 'azure' && active.entry.name === e.name
  const isWebActive = (v: SpeechSynthesisVoice) =>
    active.kind === 'webspeech' && active.voice.voiceURI === v.voiceURI

  const voiceButton = (entry: VoiceEntry) => (
    <Button
      key={entry.name}
      onClick={() => setActive({ kind: 'azure', entry })}
      variant={isAzureActive(entry) ? 'contained' : 'outlined'}
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
        <Chip label="Lead" size="small" color="success" sx={{ ml: 1, height: 20, fontSize: '0.7rem' }} />
      )}
    </Button>
  )

  return (
    <Box
      sx={{
        height: 'calc(var(--vh, 1vh) * 100)',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <Container maxWidth="lg" sx={{ py: 3, fontFamily: FONT }}>
        <Typography variant="h4" sx={{ fontFamily: FONT, fontWeight: 700, mb: 0.5 }}>
          🎙️ VoiceLab (Azure)
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
          Skjult værktøj til at sammenligne Azure-stemmer og finjustere udtale-leksikonet. Vælg en
          stemme, og tryk på en prøve.
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Aktiv stemme: <strong>{activeLabel}</strong>
        </Typography>

        <FormControlLabel
          control={<Switch checked={useLexicon} onChange={(e) => setUseLexicon(e.target.checked)} />}
          label={`Udtale-leksikon (da-DK): ${useLexicon ? 'til' : 'fra'}`}
          sx={{ mb: 2, '& .MuiFormControlLabel-label': { fontFamily: FONT } }}
        />

        {errorMsg && (
          <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, bgcolor: 'error.light', color: 'error.contrastText' }}>
            ⚠️ {errorMsg}
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
          <Box sx={{ flex: '0 0 auto', width: { xs: '100%', md: 300 } }}>
            <Typography variant="h6" sx={{ fontFamily: FONT, mb: 1 }}>
              Stemmer
            </Typography>
            {VOICE_TIERS.map((tier) => (
              <Box key={tier.tier} sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontFamily: FONT, color: 'text.secondary' }}>
                  {tier.tier}
                </Typography>
                <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                  {tier.voices.map(voiceButton)}
                </Stack>
              </Box>
            ))}

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
                          title={`Afspil med ${CURRENT_VOICE.label} (lead)`}
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
              ↔ = afspil samme tekst med <strong>{CURRENT_VOICE.name}</strong> (lead) til A/B-sammenligning.
            </Typography>
          </Box>
        </Box>

        {/* ---- Mascot tap-sounds: audition candidates, pick one per mascot ---- */}
        <Divider sx={{ my: 3 }} />
        <Typography variant="h6" sx={{ fontFamily: FONT, mb: 0.5 }}>
          🐾 Maskot-lyde
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Lyden maskotten siger når man trykker på den (spawner et tema-pust). Hør forslagene og
          vælg én pr. maskot — hver har sin egen stemme + tonehøjde.
        </Typography>

        <Stack spacing={2}>
          {MASCOT_SOUNDS.map((sound) => (
            <Box key={sound.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
              <Typography sx={{ fontFamily: FONT, fontWeight: 700, mb: 1 }}>
                {sound.emoji} {sound.label}{' '}
                <Typography component="span" sx={{ fontFamily: FONT, fontWeight: 400, fontSize: '0.8rem', color: 'text.secondary' }}>
                  — spawner {sound.burst} · {sound.voiceName.replace('da-DK-', '').replace('Neural', '')} · tone {sound.pitch}
                </Typography>
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {sound.candidates.map((text, i) => {
                  const key = `mascot:${sound.id}:${i}`
                  return (
                    <Button
                      key={key}
                      onClick={() => playMascot(text, sound, key)}
                      variant="outlined"
                      sx={{ fontFamily: FONT, textTransform: 'none', minHeight: 44, px: 1.5, gap: 0.5, borderRadius: 2 }}
                    >
                      {busyKey === key ? <CircularProgress size={16} /> : '🔊'} {text}
                    </Button>
                  )
                })}
              </Box>
            </Box>
          ))}
        </Stack>

        {/* ---- Real SFX (CC-BY) — audition the candidate sound files per mascot ---- */}
        <Divider sx={{ my: 3 }} />
        <Typography variant="h6" sx={{ fontFamily: FONT, mb: 0.5 }}>
          🔊 Rigtige lyde (SFX)
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Rigtige lydeffekter (CC-BY, Google Sound Library). Hør forslagene og vælg din favorit (eller
          en lille liste) pr. maskot. NB: vand/rum er gode — dino/bjørn mangler et rigtigt brøl, så de
          bruger nærmeste søde/skabnings-lyde indtil videre.
        </Typography>

        <Stack spacing={2}>
          {MASCOT_SFX.map((m) => (
            <Box key={m.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
              <Typography sx={{ fontFamily: FONT, fontWeight: 700, mb: 1 }}>
                {m.emoji} {m.label}{' '}
                <Typography component="span" sx={{ fontFamily: FONT, fontWeight: 400, fontSize: '0.8rem', color: 'text.secondary' }}>
                  — spawner {m.burst}
                </Typography>
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {m.files.map((f) => {
                  const key = `sfx:${f.file}`
                  return (
                    <Button
                      key={key}
                      onClick={() => playFile(f.file, key)}
                      variant="outlined"
                      sx={{ fontFamily: FONT, textTransform: 'none', minHeight: 44, px: 1.5, gap: 0.5, borderRadius: 2 }}
                    >
                      {busyKey === key ? <CircularProgress size={16} /> : '🔊'} {f.label}
                    </Button>
                  )
                })}
              </Box>
            </Box>
          ))}
        </Stack>
      </Container>
    </Box>
  )
}

export default VoiceLab
