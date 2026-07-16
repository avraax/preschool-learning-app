import React from 'react'
import { Box } from '@mui/material'
import { Volume2 } from 'lucide-react'
import { VolumeUp } from '@mui/icons-material'
import { getCategoryTheme } from '../../config/categoryThemes'
import { relLuminance } from '../../theme/tokens/helpers'
import TactilePill from './TactilePill'

/**
 * Props for the RepeatButton component
 */
interface RepeatButtonProps {
  /** Function to call when button is clicked */
  onClick: () => void
  /** Whether the button should be disabled */
  disabled?: boolean
  /** Button text label */
  label?: string
  /** Size of the button */
  size?: 'small' | 'medium' | 'large'
  /** Category theme to use for styling (keys must match categoryThemes) */
  category?: 'alphabet' | 'math' | 'colors' | 'english' | 'ordleg'
  /** Use Lucide React icons instead of MUI icons */
  useLucideIcons?: boolean
}

/**
 * Centralized repeat/replay ("Hør igen") button for task-based games.
 *
 * As of Liveliness PRD-06 F4 it is built on the shared `TactilePill` soft-3D material (accent-filled
 * clay pill, grounded soft shadow, press-travel) so it reads as ONE family with the score chip and
 * the level ring — replacing the old plain-MUI `variant="contained"` + `boxShadow:2/4` look. The 5
 * per-category color variants, the disabled state, the speaker icon, the Danish label, and ≥44px
 * touch target are all kept.
 */
export const RepeatButton: React.FC<RepeatButtonProps> = ({
  onClick,
  disabled = false,
  label = 'Hør igen',
  size = 'large',
  category = 'alphabet',
  useLucideIcons = true,
}) => {
  // Accent from the ACTIVE skin (getCategoryTheme, not the static map) so the pill matches the
  // section title + numeral + score chip on every skin — the F4 "one HUD family" goal.
  const accent = getCategoryTheme(category).accentColor
  // Legible content colour on the accent pill (dark text on light/warm accents, white otherwise) —
  // shares ScoreChip's rule so the whole HUD family stays consistent.
  const onAccent = relLuminance(accent) > 0.5 ? '#1F2937' : '#FFFFFF'

  // Choose appropriate icon based on preference
  const IconComponent = useLucideIcons ? Volume2 : VolumeUp
  const iconSize = useLucideIcons ? (size === 'small' ? 20 : 24) : undefined

  return (
    <TactilePill
      accent={accent}
      onClick={onClick}
      disabled={disabled}
      ariaLabel={label}
      sx={{
        color: onAccent,
        gap: size === 'small' ? 0.75 : 1,
        px: size === 'small' ? 2 : 3.5,
        py: size === 'small' ? 0.75 : 1.5,
        fontSize: size === 'small' ? '0.9rem' : '1.1rem',
        fontWeight: 700,
      }}
    >
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
        {useLucideIcons ? <IconComponent size={iconSize} /> : <IconComponent />}
      </Box>
      {label}
    </TactilePill>
  )
}

/**
 * Type-safe props for specific game categories
 */
export interface AlphabetRepeatButtonProps extends Omit<RepeatButtonProps, 'category'> {
  category?: 'alphabet'
}

export interface MathRepeatButtonProps extends Omit<RepeatButtonProps, 'category'> {
  category?: 'math'
}

export interface ColorRepeatButtonProps extends Omit<RepeatButtonProps, 'category'> {
  category?: 'colors'
}

export interface EnglishRepeatButtonProps extends Omit<RepeatButtonProps, 'category'> {
  category?: 'english'
}

export interface OrdlegRepeatButtonProps extends Omit<RepeatButtonProps, 'category'> {
  category?: 'ordleg'
}

/**
 * Pre-configured repeat button for alphabet games
 */
export const AlphabetRepeatButton: React.FC<AlphabetRepeatButtonProps> = (props) => (
  <RepeatButton {...props} category="alphabet" label="Hør igen" />
)

/**
 * Pre-configured repeat button for math games
 */
export const MathRepeatButton: React.FC<MathRepeatButtonProps> = (props) => (
  <RepeatButton {...props} category="math" label="Hør igen" />
)

/**
 * Pre-configured repeat button for color games
 */
export const ColorRepeatButton: React.FC<ColorRepeatButtonProps> = (props) => (
  <RepeatButton {...props} category="colors" label="Hør igen" />
)

/**
 * Pre-configured repeat button for English games (green theme)
 */
export const EnglishRepeatButton: React.FC<EnglishRepeatButtonProps> = (props) => (
  <RepeatButton {...props} category="english" label="Hør igen" />
)

/**
 * Pre-configured repeat button for Ordleg games (teal theme)
 */
export const OrdlegRepeatButton: React.FC<OrdlegRepeatButtonProps> = (props) => (
  <RepeatButton {...props} category="ordleg" label="Hør igen" />
)
