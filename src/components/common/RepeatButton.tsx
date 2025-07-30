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
  /** Category theme to use for styling */
  category?: 'alphabet' | 'math' | 'farver'
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
  label = '🎵 Gentag',
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
      py: 2,
      px: 4,
      fontSize: '1.1rem',
      borderRadius: 3,
      fontWeight: 500
    }

    if (variant === 'primary') {
      return {
        ...baseStyles,
        backgroundColor: theme.accentColor,
        '&:hover': {
          backgroundColor: theme.hoverBorderColor
        }
      }
    } else {
      return {
        ...baseStyles,
        // Secondary variant uses default MUI secondary color
      }
    }
  }

  return (
    <Button
      onClick={onClick}
      variant="contained"
      color={variant}
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
  category?: 'farver'
}

/**
 * Pre-configured repeat button for alphabet games
 */
export const AlphabetRepeatButton: React.FC<AlphabetRepeatButtonProps> = (props) => (
  <RepeatButton {...props} category="alphabet" label="🎵 Gentag" />
)

/**
 * Pre-configured repeat button for math games  
 */
export const MathRepeatButton: React.FC<MathRepeatButtonProps> = (props) => (
  <RepeatButton {...props} category="math" label="🎵 Gentag" variant="secondary" />
)

/**
 * Pre-configured repeat button for color games
 */
export const ColorRepeatButton: React.FC<ColorRepeatButtonProps> = (props) => (
  <RepeatButton {...props} category="farver" label="🎵 Hør igen" />
)