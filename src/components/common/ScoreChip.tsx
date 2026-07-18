import React from 'react'
import { Box } from '@mui/material'
import { Star } from 'lucide-react'
import { getCategoryTheme } from '../../config/categoryThemes'
import { hexToRgba, relLuminance } from '../../theme/tokens/helpers'
import TactilePill from './TactilePill'

// Unified round-progress chip (UI/UX Overhaul PRD §5.4; tactile material added in Liveliness PRD-06
// F4). ONE design across every section: an accent pill with a pip ring showing `answered/total`
// (round questions, Farvejagt boards, etc.) plus an optional star record readout. It now sits on the
// shared `TactilePill` soft-3D material so it reads as one family with "Hør igen" + the level ring
// (replacing the old flat `bgcolor:accent` + single glow).
//
// - `total > 0` → pip ring (filled = answered). This is the standard bounded-round display.
// - `customLabel` → free text (e.g. Memory "Par: X/P"), still inside the same pill.
// - `value` → a plain number fallback for endless/exploration screens with no fixed total.
// Content colour flips to dark on light accents (gold/orange) so it's always legible on the pill.

type CategoryId = 'alphabet' | 'math' | 'colors' | 'english' | 'ordleg'

interface ScoreChipProps {
  category: CategoryId
  /** Filled pips (questions answered / boards cleared this round). */
  answered?: number
  /** Total pips (round length). Renders the pip ring when > 0. */
  total?: number
  /** Best-stars record shown as a star + N. Hidden when falsy. */
  record?: number
  /** Plain numeric fallback when there is no fixed total (endless/exploration). */
  value?: number
  /** Full label override (kept inside the pill), e.g. Memory "Par: X/P". */
  customLabel?: string
  disabled?: boolean
  onClick?: () => void
}

export const ScoreChip: React.FC<ScoreChipProps> = ({
  category,
  answered = 0,
  total = 0,
  record = 0,
  value,
  customLabel,
  disabled = false,
  onClick,
}) => {
  const theme = getCategoryTheme(category)
  const accent = theme.accentColor
  // Legible content colour on the accent pill (dark text on light/warm accents, white otherwise).
  const onAccent = relLuminance(accent) > 0.5 ? '#1F2937' : '#FFFFFF'
  const pipFilled = disabled ? '#6B7280' : onAccent
  const pipEmpty = disabled ? '#9CA3AF' : hexToRgba(onAccent, 0.32)

  return (
    <TactilePill
      accent={accent}
      onClick={onClick}
      disabled={disabled}
      ariaLabel={customLabel ?? (total > 0 ? `${answered} af ${total}` : `Point: ${value ?? 0}`)}
      sx={{
        color: disabled ? undefined : onAccent,
        px: 1.6,
        fontWeight: 800,
        fontSize: '1.1rem',
        lineHeight: 1,
      }}
    >
      {customLabel != null ? (
        <Box component="span">{customLabel}</Box>
      ) : total > 0 ? (
        <Box aria-hidden sx={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          {Array.from({ length: total }).map((_, i) => (
            <Box
              key={i}
              sx={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                bgcolor: i < answered ? pipFilled : pipEmpty,
                transition: 'background-color 0.25s ease',
              }}
            />
          ))}
        </Box>
      ) : (
        <Box component="span">{value ?? 0}</Box>
      )}

      {record > 0 && (
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.95rem' }}>
          <Star size={15} fill="currentColor" strokeWidth={0} aria-hidden style={{ display: 'block' }} />{record}
        </Box>
      )}
    </TactilePill>
  )
}

// Pre-configured per-category chips (bind the category only — one shared design).
type CategoryChipProps = Omit<ScoreChipProps, 'category'>

export const AlphabetScoreChip: React.FC<CategoryChipProps> = (props) => <ScoreChip {...props} category="alphabet" />
export const MathScoreChip: React.FC<CategoryChipProps> = (props) => <ScoreChip {...props} category="math" />
export const ColorScoreChip: React.FC<CategoryChipProps> = (props) => <ScoreChip {...props} category="colors" />
export const ColorProgressChip: React.FC<CategoryChipProps> = (props) => <ScoreChip {...props} category="colors" />
export const EnglishScoreChip: React.FC<CategoryChipProps> = (props) => <ScoreChip {...props} category="english" />
export const OrdlegScoreChip: React.FC<CategoryChipProps> = (props) => <ScoreChip {...props} category="ordleg" />
