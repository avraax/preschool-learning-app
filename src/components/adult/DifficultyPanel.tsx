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
import AdultBackHeader from './AdultBackHeader'
import { useProgress } from '../../hooks/useProgress'
import type { DifficultyLevel, SectionId } from '../../services/progressStore'

// "Sværhedsgrad" adult panel (UI/UX Overhaul PRD §5.7). A STATIC, manual difficulty selector —
// no adaptivity. A global Let/Normal/Svær choice plus optional per-section overrides. Normal ==
// today's exact tuning, so leaving everything on Normal is regression-safe. Child UI is unchanged;
// games read the effective level (perSection ?? global) when generating content.

interface DifficultyPanelProps {
  open: boolean
  onClose: () => void
}

const LEVELS: { v: DifficultyLevel; label: string }[] = [
  { v: 'let', label: 'Let' },
  { v: 'normal', label: 'Normal' },
  { v: 'svaer', label: 'Svær' },
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
      <AdultBackHeader title="Sværhedsgrad 🎚️" onBack={onClose} />
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
          Vælg et niveau for alle spil. <strong>Normal</strong> er standard. Du kan give enkelte
          sektioner et andet niveau nedenfor.
        </Typography>

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
