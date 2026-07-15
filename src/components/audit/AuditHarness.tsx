// AuditHarness — dev-only /audit page (PRD-11 §3). Plays EVERY clip in the closed narration set so a
// native ear can flag each OK/wrong and capture the verdict. The systematic discovery mechanism for
// the pronunciation audit; stays useful for re-verification after fixes.
//
// EXPLICIT EXCEPTION to .claude/rules/audio-system.md (same as VoiceLab): this workshop tool owns a
// fully self-contained player (one HTMLAudioElement + Web Speech) so it can drive prebaked files,
// arbitrary voices, lexicon on/off, and candidate IPA directly. It does NOT touch production audio
// code, but it plays the real prebaked .ogg files and calls the real /api/tts-azure so clips are
// heard exactly as the child hears them. Gated to dev builds by the route guard in App.tsx.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { ChevronDown, ChevronRight, Play, Volume2 } from 'lucide-react'
import { TTS_CONFIG } from '../../config/tts-config'
import { PREBAKED_TTS } from '../../config/prebakedTts'
import { VOICE_TIERS } from '../voicelab/voicelabData'
import { buildAuditClips, GROUP_LABELS, GROUP_ORDER, type AuditClip, type AuditGroup } from './auditClips'

const AUDIO_MIME = TTS_CONFIG.mime
const LS_KEY = 'bornelaering-narration-audit-v1'
const prebakedUrl = (file: string) => `${import.meta.env.BASE_URL}sounds/tts/${file}`

type Verdict = 'ok' | 'wrong' | null
interface ClipRecord {
  verdict: Verdict
  note: string
  candidateIpa: string
  text: string
  group: AuditGroup
  updatedAt: number
}
type Records = Record<string, ClipRecord>
type FilterMode = 'all' | 'unaudited' | 'wrong' | 'ok'

const emptyRecord = (clip: AuditClip): ClipRecord => ({
  verdict: null,
  note: '',
  candidateIpa: '',
  text: clip.text,
  group: clip.group,
  updatedAt: 0,
})

const AuditHarness: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const clips = useMemo(() => buildAuditClips(), [])

  const [records, setRecords] = useState<Records>({})
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // Global controls (§3.3–3.4)
  const [forceLiveAll, setForceLiveAll] = useState(false)
  const [lexiconOn, setLexiconOn] = useState(true)
  const [altVoice, setAltVoice] = useState('') // '' = none (use each clip's own voice)
  const [filter, setFilter] = useState<FilterMode>('all')
  const [search, setSearch] = useState('')
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(GROUP_ORDER.map((g) => [g, g === 'letters'])),
  )
  const [expandedIpa, setExpandedIpa] = useState<Record<string, boolean>>({})

  const allVoices = useMemo(() => VOICE_TIERS.flatMap((t) => t.voices), [])

  // ---- audio element lifecycle ----
  useEffect(() => {
    audioRef.current = new Audio()
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [])

  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => {
      document.head.removeChild(meta)
    }
  }, [])

  const stopAll = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }, [])

  useEffect(() => () => stopAll(), [stopAll])

  // ---- verdict persistence: localStorage + committed checklist merge on mount ----
  useEffect(() => {
    let local: Records = {}
    try {
      local = JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') as Records
    } catch {
      local = {}
    }
    // Pull the committed checklist (shared truth in git) and merge newest-wins per key.
    fetch('/api/audit-save')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((doc: { clips?: Records }) => {
        const committed = doc?.clips ?? {}
        const merged: Records = { ...committed }
        for (const [k, v] of Object.entries(local)) {
          if (!merged[k] || (v.updatedAt ?? 0) > (merged[k].updatedAt ?? 0)) merged[k] = v
        }
        setRecords(merged)
      })
      .catch(() => setRecords(local))
  }, [])

  const persist = useCallback((next: Records) => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next))
    } catch {
      /* private mode / quota — in-memory still works this session */
    }
  }, [])

  // Debounced auto-save of the committed checklist (dev-server writes docs/audit/*).
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const scheduleCommit = useCallback((next: Records) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      setSaveState('saving')
      fetch('/api/audit-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clips: next }),
      })
        .then((r) => (r.ok ? setSaveState('saved') : setSaveState('error')))
        .catch(() => setSaveState('error'))
    }, 800)
  }, [])

  const updateRecord = useCallback(
    (clip: AuditClip, patch: Partial<ClipRecord>) => {
      setRecords((prev) => {
        const base = prev[clip.key] ?? emptyRecord(clip)
        const next: Records = {
          ...prev,
          [clip.key]: { ...base, ...patch, text: clip.text, group: clip.group, updatedAt: Date.now() },
        }
        persist(next)
        scheduleCommit(next)
        return next
      })
    },
    [persist, scheduleCommit],
  )

  // ---- playback ----
  const playPrebaked = useCallback(
    async (file: string, key: string) => {
      stopAll()
      setErrorMsg(null)
      setBusyKey(key)
      try {
        const audio = audioRef.current
        if (!audio) throw new Error('Audio ikke understøttet')
        audio.src = prebakedUrl(file)
        await audio.play()
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : String(err))
      } finally {
        setBusyKey((k) => (k === key ? null : k))
      }
    },
    [stopAll],
  )

  const playLive = useCallback(
    async (
      clip: AuditClip,
      key: string,
      opts: { voiceName?: string; lang?: string; useLexicon?: boolean; ipa?: string; text?: string } = {},
    ) => {
      stopAll()
      setErrorMsg(null)
      setBusyKey(key)
      try {
        const voiceName = opts.voiceName ?? clip.voiceName
        const lang = opts.lang ?? clip.lang
        const useLexicon = (opts.useLexicon ?? (lexiconOn && clip.useLexicon)) && lang.startsWith('da')
        const body: Record<string, unknown> = {
          text: opts.text ?? clip.text,
          voiceName,
          lang,
          speed: clip.rate,
          useLexicon,
        }
        if (opts.ipa) body.ipa = opts.ipa
        const res = await fetch('/api/tts-azure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          let detail = ''
          try {
            detail = (await res.json())?.error || ''
          } catch {
            /* ignore */
          }
          throw new Error(`HTTP ${res.status}${detail ? ` — ${detail}` : ''}`)
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
    [lexiconOn, stopAll],
  )

  // The primary play button: what the child actually hears (prebaked), unless forced live / dynamic.
  const playPrimary = useCallback(
    (clip: AuditClip) => {
      const file = PREBAKED_TTS[clip.key]
      if (!forceLiveAll && file) return playPrebaked(file, `${clip.key}:primary`)
      return playLive(clip, `${clip.key}:primary`)
    },
    [forceLiveAll, playLive, playPrebaked],
  )

  // ---- export / import ----
  const download = useCallback(() => {
    const blob = new Blob([JSON.stringify({ updatedAt: new Date().toISOString(), clips: records }, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'narration-audit.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [records])

  // ---- derived stats ----
  const stats = useMemo(() => {
    let ok = 0
    let wrong = 0
    for (const clip of clips) {
      const v = records[clip.key]?.verdict
      if (v === 'ok') ok++
      else if (v === 'wrong') wrong++
    }
    return { ok, wrong, unaudited: clips.length - ok - wrong, total: clips.length }
  }, [clips, records])

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase()
    const out: Record<AuditGroup, AuditClip[]> = {
      letters: [], numbers: [], phrases: [], colours: [], mixed: [], english: [],
    }
    for (const clip of clips) {
      const v = records[clip.key]?.verdict ?? null
      if (filter === 'ok' && v !== 'ok') continue
      if (filter === 'wrong' && v !== 'wrong') continue
      if (filter === 'unaudited' && v !== null) continue
      if (q && !clip.text.toLowerCase().includes(q) && !clip.key.toLowerCase().includes(q)) continue
      out[clip.group].push(clip)
    }
    return out
  }, [clips, records, filter, search])

  const FONT = '"Comic Sans MS", "Comic Sans", cursive'

  const renderRow = (clip: AuditClip) => {
    const rec = records[clip.key] ?? emptyRecord(clip)
    const file = PREBAKED_TTS[clip.key]
    const hasPrebaked = !!file
    const primaryBusy = busyKey === `${clip.key}:primary`
    const isDanish = clip.lang.startsWith('da')
    const showIpa = !!expandedIpa[clip.key]

    return (
      <Box
        key={clip.key}
        sx={{
          border: '1px solid',
          borderColor: rec.verdict === 'wrong' ? 'error.main' : rec.verdict === 'ok' ? 'success.main' : 'divider',
          borderRadius: 2,
          p: 1,
          bgcolor: rec.verdict === 'wrong' ? 'rgba(244,67,54,0.06)' : rec.verdict === 'ok' ? 'rgba(76,175,80,0.06)' : 'transparent',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <IconButton
            size="small"
            onClick={() => playPrimary(clip)}
            title={!forceLiveAll && hasPrebaked ? 'Afspil prebaked (som barnet hører den)' : 'Afspil live (Azure)'}
            sx={{ bgcolor: 'action.hover' }}
          >
            {primaryBusy ? <CircularProgress size={18} /> : <Play size={18} />}
          </IconButton>

          <Typography sx={{ fontFamily: FONT, fontWeight: 700, fontSize: '1.05rem', minWidth: 140 }}>
            {clip.text}
          </Typography>

          <Chip size="small" label={clip.lang} sx={{ height: 20, fontSize: '0.65rem' }} />
          {clip.rate !== TTS_CONFIG.speakingRate && (
            <Chip size="small" label={`r${clip.rate}`} sx={{ height: 20, fontSize: '0.65rem' }} />
          )}
          {clip.dynamic ? (
            <Chip size="small" color="warning" label="dynamisk (kun live)" sx={{ height: 20, fontSize: '0.65rem' }} />
          ) : hasPrebaked ? (
            <Chip size="small" color="success" variant="outlined" label="prebaked ✓" sx={{ height: 20, fontSize: '0.65rem' }} />
          ) : (
            <Chip size="small" color="error" variant="outlined" label="prebaked ✗" sx={{ height: 20, fontSize: '0.65rem' }} />
          )}

          <Box sx={{ flex: 1 }} />

          {/* A/B: lexicon off (Danish only) */}
          {isDanish && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => playLive(clip, `${clip.key}:nolex`, { useLexicon: false })}
              disabled={busyKey === `${clip.key}:nolex`}
              sx={{ fontFamily: FONT, textTransform: 'none', minHeight: 32 }}
              title="Afspil live UDEN leksikon"
            >
              {busyKey === `${clip.key}:nolex` ? <CircularProgress size={14} /> : 'lex ✗'}
            </Button>
          )}

          {/* A/B: alternate voice */}
          {altVoice && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                const entry = allVoices.find((v) => v.name === altVoice)
                if (entry) playLive(clip, `${clip.key}:alt`, { voiceName: entry.name, lang: entry.lang })
              }}
              disabled={busyKey === `${clip.key}:alt`}
              sx={{ fontFamily: FONT, textTransform: 'none', minHeight: 32 }}
              title={`Afspil med ${altVoice}`}
            >
              {busyKey === `${clip.key}:alt` ? <CircularProgress size={14} /> : <Volume2 size={14} />}
            </Button>
          )}

          {/* Candidate IPA toggle */}
          <Button
            size="small"
            variant={showIpa ? 'contained' : 'outlined'}
            onClick={() => setExpandedIpa((p) => ({ ...p, [clip.key]: !p[clip.key] }))}
            sx={{ fontFamily: FONT, textTransform: 'none', minHeight: 32 }}
          >
            IPA
          </Button>

          {/* Verdict */}
          <ToggleButtonGroup
            size="small"
            exclusive
            value={rec.verdict}
            onChange={(_, v) => updateRecord(clip, { verdict: v as Verdict })}
          >
            <ToggleButton value="ok" color="success" sx={{ minHeight: 32, px: 1.5 }}>
              ✓ OK
            </ToggleButton>
            <ToggleButton value="wrong" color="error" sx={{ minHeight: 32, px: 1.5 }}>
              ✗ Fejl
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Note line */}
        <Box sx={{ display: 'flex', gap: 1, mt: 0.75, alignItems: 'center' }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Note (hvad er galt / hvordan skal det lyde)…"
            value={rec.note}
            onChange={(e) => updateRecord(clip, { note: e.target.value })}
            sx={{ '& .MuiInputBase-input': { fontFamily: FONT, fontSize: '0.85rem' } }}
          />
          <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
            {file ?? '—'}
          </Typography>
        </Box>

        {/* Candidate IPA / respelling A/B (§3.4.3) */}
        {showIpa && (
          <Box sx={{ display: 'flex', gap: 1, mt: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              label="Kandidat IPA (inline <phoneme>)"
              value={rec.candidateIpa}
              onChange={(e) => updateRecord(clip, { candidateIpa: e.target.value })}
              sx={{ flex: 1, minWidth: 200, '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.9rem' } }}
            />
            <Button
              size="small"
              variant="contained"
              onClick={() => playLive(clip, `${clip.key}:ipa`, { ipa: rec.candidateIpa })}
              disabled={!rec.candidateIpa || busyKey === `${clip.key}:ipa`}
              sx={{ fontFamily: FONT, textTransform: 'none', minHeight: 36 }}
            >
              {busyKey === `${clip.key}:ipa` ? <CircularProgress size={16} /> : 'Hør IPA'}
            </Button>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
              eller test en anden stavemåde:
            </Typography>
            <RespellingTester clip={clip} onPlay={(text, k) => playLive(clip, k, { text })} busyKey={busyKey} />
          </Box>
        )}
      </Box>
    )
  }

  return (
    <Box sx={{ height: 'calc(var(--vh, 1vh) * 100)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <Container maxWidth="lg" sx={{ py: 2 }}>
        <Typography variant="h4" sx={{ fontFamily: FONT, fontWeight: 700, mb: 0.5 }}>
          🎧 Narration-audit (PRD-11)
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
          Dev-værktøj: afspil hver klip i det lukkede narrations-sæt, og markér OK/fejl. Standard =
          den prebaked fil barnet hører; slå «Tving live» til for at høre et fix via Azure før re-bake.
        </Typography>

        {/* Stats + global controls */}
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 5,
            bgcolor: 'background.paper',
            borderBottom: '1px solid',
            borderColor: 'divider',
            py: 1,
            mb: 1.5,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1.5,
            alignItems: 'center',
          }}
        >
          <Chip color="success" label={`OK ${stats.ok}`} />
          <Chip color="error" label={`Fejl ${stats.wrong}`} />
          <Chip label={`Uhørt ${stats.unaudited}`} />
          <Chip variant="outlined" label={`I alt ${stats.total}`} />

          <Divider orientation="vertical" flexItem />

          <FormControlLabel
            control={<Switch checked={forceLiveAll} onChange={(e) => setForceLiveAll(e.target.checked)} />}
            label="Tving live"
            sx={{ '& .MuiFormControlLabel-label': { fontFamily: FONT } }}
          />
          <FormControlLabel
            control={<Switch checked={lexiconOn} onChange={(e) => setLexiconOn(e.target.checked)} />}
            label={`Leksikon ${lexiconOn ? 'til' : 'fra'}`}
            sx={{ '& .MuiFormControlLabel-label': { fontFamily: FONT } }}
          />
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel>Alt. stemme (A/B)</InputLabel>
            <Select label="Alt. stemme (A/B)" value={altVoice} onChange={(e) => setAltVoice(e.target.value)}>
              <MenuItem value="">
                <em>Ingen</em>
              </MenuItem>
              {VOICE_TIERS.map((tier) => [
                <MenuItem key={tier.tier} disabled sx={{ opacity: 0.7, fontWeight: 700 }}>
                  {tier.tier}
                </MenuItem>,
                ...tier.voices.map((v) => (
                  <MenuItem key={v.name} value={v.name} sx={{ pl: 3 }}>
                    {v.label} ({v.lang})
                  </MenuItem>
                )),
              ])}
            </Select>
          </FormControl>

          <Box sx={{ flex: 1 }} />

          <Button variant="outlined" size="small" onClick={download} sx={{ fontFamily: FONT, textTransform: 'none' }}>
            ⬇ Download JSON
          </Button>
          <Typography sx={{ fontSize: '0.75rem', color: saveState === 'error' ? 'error.main' : 'text.secondary', minWidth: 90 }}>
            {saveState === 'saving' ? 'Gemmer…' : saveState === 'saved' ? '✓ Gemt i repo' : saveState === 'error' ? '⚠ repo-gem fejl' : ''}
          </Typography>
        </Box>

        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, v) => v && setFilter(v)}>
            <ToggleButton value="all" sx={{ fontFamily: FONT, textTransform: 'none' }}>Alle</ToggleButton>
            <ToggleButton value="unaudited" sx={{ fontFamily: FONT, textTransform: 'none' }}>Uhørte</ToggleButton>
            <ToggleButton value="wrong" sx={{ fontFamily: FONT, textTransform: 'none' }}>Fejl</ToggleButton>
            <ToggleButton value="ok" sx={{ fontFamily: FONT, textTransform: 'none' }}>OK</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            size="small"
            placeholder="Søg tekst…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 200, '& .MuiInputBase-input': { fontFamily: FONT } }}
          />
        </Box>

        {errorMsg && (
          <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, bgcolor: 'error.light', color: 'error.contrastText' }}>
            ⚠️ {errorMsg}
          </Box>
        )}

        {/* Groups */}
        {GROUP_ORDER.map((group) => {
          const list = grouped[group]
          const open = openGroups[group]
          const groupClips = clips.filter((c) => c.group === group)
          const groupOk = groupClips.filter((c) => records[c.key]?.verdict === 'ok').length
          return (
            <Box key={group} sx={{ mb: 1.5 }}>
              <Box
                onClick={() => setOpenGroups((p) => ({ ...p, [group]: !p[group] }))}
                sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', py: 0.75 }}
              >
                {open ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                <Typography sx={{ fontFamily: FONT, fontWeight: 700, fontSize: '1.15rem' }}>
                  {GROUP_LABELS[group]}
                </Typography>
                <Chip size="small" label={`${groupOk}/${groupClips.length} OK`} />
                {list.length !== groupClips.length && (
                  <Chip size="small" variant="outlined" label={`viser ${list.length}`} />
                )}
              </Box>
              {open && (
                <Stack spacing={0.75} sx={{ pl: 1 }}>
                  {list.length === 0 ? (
                    <Typography variant="caption" sx={{ color: 'text.disabled', pl: 2 }}>
                      (ingen klip matcher filteret)
                    </Typography>
                  ) : (
                    list.map(renderRow)
                  )}
                </Stack>
              )}
            </Box>
          )
        })}
      </Container>
    </Box>
  )
}

// Small inline respelling tester — type an alternate spelling, hear it live in the clip's own voice.
const RespellingTester: React.FC<{
  clip: AuditClip
  onPlay: (text: string, key: string) => void
  busyKey: string | null
}> = ({ clip, onPlay, busyKey }) => {
  const [text, setText] = useState('')
  const key = `${clip.key}:respell`
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      <TextField
        size="small"
        placeholder="stavemåde…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        sx={{ width: 150 }}
      />
      <Button
        size="small"
        variant="outlined"
        onClick={() => onPlay(text, key)}
        disabled={!text || busyKey === key}
        sx={{ textTransform: 'none', minHeight: 36 }}
      >
        {busyKey === key ? <CircularProgress size={16} /> : 'Hør'}
      </Button>
    </Box>
  )
}

export default AuditHarness
