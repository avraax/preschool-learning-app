import React from 'react'
import { Button } from '@mui/material'
import { Volume2 } from 'lucide-react'
import { VolumeUp } from '@mui/icons-material'
import { categoryThemes } from '../../config/categoryThemes'

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
  /** Visual variant of the button */
  variant?: 'primary' | 'secondary'
  /** Size of the button */
  size?: 'small' | 'medium' | 'large'
  /** Category theme to use for styling (keys must match categoryThemes) */
  category?: 'alphabet' | 'math' | 'colors' | 'english' | 'ordleg'
  /** Use Lucide React icons instead of MUI icons */
  useLucideIcons?: boolean
}

/**
 * Centralized repeat/replay button component for task-based games
 * 
 * Provides consistent styling, theming, and behavior across all games that need
 * audio repeat functionality. Automatically handles disabled states and applies
 * appropriate category theming.
 * 
 * @example
 * ```typescript
 * // Basic usage
 * <RepeatButton onClick={repeatQuestion} disabled={!entryAudioComplete} />
 * 
 * // With custom styling and theme
 * <RepeatButton 
 *   onClick={repeatProblem}
 *   disabled={!isReady}
 *   label="Hør igen"
 *   variant="secondary"
 *   category="math"
 *   size="large"
 * />
 * ```
 */
export const RepeatButton: React.FC<RepeatButtonProps> = ({
  onClick,
  disabled = false,
  label = 'Hør igen',
  variant = 'primary',
  size = 'large',
  category = 'alphabet',
  useLucideIcons = true
}) => {
  // Get theme colors based on category
  const theme = categoryThemes[category] || categoryThemes.alphabet
  
  // Choose appropriate icon based on preference
  const IconComponent = useLucideIcons ? Volume2 : VolumeUp
  const iconSize = useLucideIcons ? 24 : undefined

  // Build button styles based on variant and category
  const getButtonStyles = () => {
    const baseStyles = {
      py: size === 'small' ? 1 : size === 'large' ? 2 : 2,
      px: size === 'small' ? 2 : size === 'large' ? 4 : 4,
      fontSize: size === 'small' ? '0.9rem' : size === 'large' ? '1.1rem' : '1.1rem',
      borderRadius: 3,
      fontWeight: 600,
      textTransform: 'none' as const,
      transition: 'all 0.3s ease',
      boxShadow: 2
    }

    if (variant === 'primary') {
      return {
        ...baseStyles,
        backgroundColor: theme.accentColor,
        color: 'white',
        border: `2px solid ${theme.accentColor}`,
        '&:hover': {
          backgroundColor: theme.hoverBorderColor,
          borderColor: theme.hoverBorderColor,
          boxShadow: 4,
          transform: 'translateY(-2px)'
        },
        '&:active': {
          transform: 'translateY(0px)',
          boxShadow: 2
        },
        '&:disabled': {
          backgroundColor: 'grey.400',
          borderColor: 'grey.400',
          color: 'grey.600'
        }
      }
    } else {
      // Secondary variant with enhanced category theming
      return {
        ...baseStyles,
        backgroundColor: theme.accentColor,
        color: 'white',
        border: `2px solid ${theme.accentColor}`,
        '&:hover': {
          backgroundColor: theme.hoverBorderColor,
          borderColor: theme.hoverBorderColor,
          boxShadow: 4,
          transform: 'translateY(-2px)'
        },
        '&:active': {
          transform: 'translateY(0px)',
          boxShadow: 2
        },
        '&:disabled': {
          backgroundColor: 'grey.400',
          borderColor: 'grey.400',
          color: 'grey.600'
        }
      }
    }
  }

  return (
    <Button
      onClick={onClick}
      variant="contained"
      size={size}
      disabled={disabled}
      startIcon={useLucideIcons ? <IconComponent size={iconSize} /> : <IconComponent />}
      sx={getButtonStyles()}
    >
      {label}
    </Button>
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
  <RepeatButton {...props} category="math" label="Hør igen" variant="secondary" />
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