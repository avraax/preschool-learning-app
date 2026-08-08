// "Læring" — the static, manual difficulty selector (absorbs the old "Sværhedsgrad" panel).
//
// NO adaptivity by design: nothing here reads the child's performance, and the level never changes on
// its own. What the three levels MEAN is defined ONCE in `src/config/difficulty.ts` (Difficulty
// PRD-01 §3) and holds in every game, which is what makes a single explanation honest.
//
// TWO CHANGES from the old panel, both from Settings PRD-01 §8:
//   * It is labelled as PER CHILD. `difficulty` has always lived in `progressStore.settings`, which is
//     per-profile — the UI simply never said so, and a parent tuning it had no idea which child it hit.
//   * The explanation is PROGRESSIVE. The old panel printed all three paragraphs at once, so the adult
//     read two descriptions of levels they had not chosen before finding the one they had.

import React, { useState } from 'react'
import { Box, Button, Collapse, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useProgress } from '../../../hooks/useProgress'
import { SECTION_LABELS } from '../../../config/adultSectionLabels'
import type { DifficultyLevel, SectionId } from '../../../services/progressStore'
import { PHONE_ANY } from '../../../theme/phoneMedia'
import { PaneSection } from './paneParts'

const LEVELS: { v: DifficultyLevel; label: string }[] = [
  { v: 'let', label: 'Let' },
  { v: 'normal', label: 'Normal' },
  { v: 'svaer', label: 'Svær' },
]

// What each level means, in the adult's language. Deliberately about the CHILD's experience, not the
// parameters: the point is that Normal is his comfortable everyday level and the stretch lives in Svær.
//
// Svær's old closing sentence — "Stjernerne er lidt mildere her, så et sværere niveau ikke koster
// belønninger" — is GONE (Endless Play PRD-01 W3). The fairness rule it stated is now true BY
// CONSTRUCTION: stars were the only way a harder level could have cost rewards, and XP has always been
// difficulty-independent. The rule lives here as a comment rather than as reassurance the adult has to
// read; don't restate it in the copy.
const LEVEL_HELP: Record<DifficultyLevel, string> = {
  let: 'Ting han allerede kan. 3 svarmuligheder, små tal, og svarene ligner ikke hinanden.',
  normal:
    'Hans hverdagsniveau — kan det med lidt tanke. 4 svarmuligheder, tal op til 20, og forvekslinger han kan klare.',
  svaer:
    'Næste års niveau. 5 svarmuligheder, kun svar der ligner hinanden — og minus hen over tierne.',
}

const SECTIONS: SectionId[] = ['alphabet', 'math', 'colors', 'english', 'ordleg']

export interface LaeringPaneProps {
  /** The active child's name, so the pane can say WHOSE difficulty this is. */
  childName?: string
}

const LaeringPane: React.FC<LaeringPaneProps> = ({ childName }) => {
  const { state, setDifficulty } = useProgress()
  const diff = state.settings.difficulty
  const per = diff.perSection ?? {}
  const [showPerSection, setShowPerSection] = useState(
    () => Object.values(per).some((v) => v != null),
  )

  return (
    <Stack spacing={2.5}>
      <PaneSection
        title={childName ? `Sværhedsgrad for ${childName}` : 'Sværhedsgrad'}
        caps={!childName}
        hint="Gælder alle spil. Niveauet ændrer sig aldrig af sig selv — kun her."
      >
        <ToggleButtonGroup
          exclusive
          fullWidth
          value={diff.global}
          onChange={(_, v: DifficultyLevel | null) => v && setDifficulty({ global: v })}
          aria-label="Global sværhedsgrad"
        >
          {LEVELS.map((l) => (
            <ToggleButton key={l.v} value={l.v} aria-label={`Global: ${l.label}`} sx={{ fontWeight: 700 }}>
              {l.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {/* ONLY the chosen level's paragraph. */}
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.25 }}>
          {LEVEL_HELP[diff.global]}
        </Typography>
      </PaneSection>

      <Box>
        <Button
          onClick={() => setShowPerSection((s) => !s)}
          aria-expanded={showPerSection}
          aria-label="Tilpas pr. sektion"
          endIcon={showPerSection ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
          sx={{ px: 0 }}
        >
          Tilpas pr. sektion
        </Button>
        <Collapse in={showPerSection} unmountOnExit>
          <Stack spacing={1} sx={{ pt: 1 }}>
            {SECTIONS.map((id) => {
              const label = SECTION_LABELS[id]
              const value = per[id] ?? ''
              return (
                <Box
                  key={id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    [PHONE_ANY]: { flexDirection: 'column', alignItems: 'stretch', gap: 0.5 },
                  }}
                >
                  <Typography sx={{ flex: '0 0 auto', width: 82, fontSize: '0.875rem' }}>
                    {label}
                  </Typography>
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={value}
                    onChange={(_, v: DifficultyLevel | '' | null) =>
                      setDifficulty({ section: id, level: v === '' || v == null ? null : v })
                    }
                    aria-label={`${label} sværhedsgrad`}
                    sx={{ flex: 1 }}
                  >
                    <ToggleButton value="" aria-label={`${label}: som global`} sx={{ fontSize: '0.72rem', px: 1 }}>
                      Som global
                    </ToggleButton>
                    {LEVELS.map((l) => (
                      <ToggleButton
                        key={l.v}
                        value={l.v}
                        aria-label={`${label}: ${l.label}`}
                        sx={{ fontSize: '0.72rem', px: 1 }}
                      >
                        {l.label}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Box>
              )
            })}
          </Stack>
        </Collapse>
      </Box>
    </Stack>
  )
}

export default LaeringPane
