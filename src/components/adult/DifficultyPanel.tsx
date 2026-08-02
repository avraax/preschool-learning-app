import React from 'react'
import {
  Box,
  Dialog,
  DialogContent,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { SlidersHorizontal } from 'lucide-react'
import AdultBackHeader from './AdultBackHeader'
import { useProgress } from '../../hooks/useProgress'
import type { DifficultyLevel, SectionId } from '../../services/progressStore'

// "Sværhedsgrad" adult panel (UI/UX Overhaul PRD §5.7). A STATIC, manual difficulty selector —
// no adaptivity, nothing here reads the child's performance. A global Let/Normal/Svær choice plus
// optional per-section overrides. Games read the effective level (perSection ?? global) when generating
// content and regenerate the current question on a change, so a tweak lands without a refresh.
//
// The three levels now MEAN something app-wide (Difficulty PRD-01 §3) — one shared spine, defined in
// src/config/difficulty.ts and explained to the adult below. Before that, "Normal" only ever meant
// "whatever this game already did", so the levels drifted per game.

interface DifficultyPanelProps {
  open: boolean
  onClose: () => void
}

const LEVELS: { v: DifficultyLevel; label: string }[] = [
  { v: 'let', label: 'Let' },
  { v: 'normal', label: 'Normal' },
  { v: 'svaer', label: 'Svær' },
]

// What each level means, in the adult's language. Deliberately about the CHILD's experience, not the
// parameters: the point is that Normal is his comfortable everyday level and the stretch lives in Svær.
const LEVEL_HELP: { label: string; body: string }[] = [
  { label: 'Let', body: 'Ting han allerede kan. 3 svarmuligheder, små tal, og svarene ligner ikke hinanden.' },
  { label: 'Normal', body: 'Hans hverdagsniveau — kan det med lidt tanke. 4 svarmuligheder, tal op til 20, og forvekslinger han kan klare.' },
  { label: 'Svær', body: 'Næste års niveau. 5 svarmuligheder, kun svar der ligner hinanden — og minus hen over tierne. Stjernerne er lidt mildere her, så et sværere niveau ikke koster belønninger.' },
]

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'alphabet', label: 'Alfabetet' },
  { id: 'math', label: 'Tal' },
  { id: 'colors', label: 'Farver' },
  { id: 'english', label: 'Engelsk' },
  { id: 'ordleg', label: 'Ordleg' },
]

const DifficultyPanel: React.FC<DifficultyPanelProps> = ({ open, onClose }) => {
  const { state, setDifficulty } = useProgress()
  const diff = state.settings.difficulty
  const per = diff.perSection ?? {}

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <AdultBackHeader title="Sværhedsgrad" icon={<SlidersHorizontal size={20} aria-hidden />} onBack={onClose} />
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
          Vælg et niveau for alle spil. <strong>Normal</strong> er standard. Du kan give enkelte
          sektioner et andet niveau nedenfor. Niveauet ændrer sig aldrig af sig selv — kun her.
        </Typography>

        {/* What the three levels mean. Same spine in every spil, so this explanation holds everywhere. */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 2 }}>
          {LEVEL_HELP.map((l) => (
            <Typography key={l.label} variant="body2" sx={{ color: 'text.secondary' }}>
              <strong>{l.label}:</strong> {l.body}
            </Typography>
          ))}
        </Box>

        <Typography sx={{ fontWeight: 700, mb: 0.75 }}>Alle spil</Typography>
        <ToggleButtonGroup
          exclusive
          fullWidth
          value={diff.global}
          onChange={(_, v: DifficultyLevel | null) => v && setDifficulty({ global: v })}
          aria-label="Global sværhedsgrad"
          size="small"
        >
          {LEVELS.map((l) => (
            <ToggleButton key={l.v} value={l.v} aria-label={`Global: ${l.label}`} sx={{ fontWeight: 700 }}>
              {l.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Divider sx={{ my: 2 }} />

        <Typography sx={{ fontWeight: 700, mb: 0.75 }}>Pr. sektion</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {SECTIONS.map((s) => {
            const value = per[s.id] ?? ''
            return (
              <Box key={s.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ minWidth: 78, fontSize: '0.9rem' }}>{s.label}</Typography>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={value}
                  onChange={(_, v: DifficultyLevel | '' | null) =>
                    setDifficulty({ section: s.id, level: v === '' || v == null ? null : v })
                  }
                  aria-label={`${s.label} sværhedsgrad`}
                  sx={{ flex: 1 }}
                >
                  <ToggleButton value="" aria-label={`${s.label}: som global`} sx={{ fontSize: '0.72rem', px: 1 }}>
                    Som global
                  </ToggleButton>
                  {LEVELS.map((l) => (
                    <ToggleButton key={l.v} value={l.v} aria-label={`${s.label}: ${l.label}`} sx={{ fontSize: '0.72rem', px: 1 }}>
                      {l.label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>
            )
          })}
        </Box>
      </DialogContent>
    </Dialog>
  )
}

export default DifficultyPanel
