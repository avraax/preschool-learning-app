import React from 'react'
import { Button } from '@mui/material'
import { Refresh, RestartAlt } from '@mui/icons-material'
import { categoryThemes, getCategoryTheme } from '../../config/categoryThemes'

/**
 * Props for the RestartButton component
 */
interface RestartButtonProps {
  /** Function to call when button is clicked */
  onClick: () => void
  /** Category theme to use for styling */
  category: 'alphabet' | 'math' | 'colors'
  /** Whether the button should be disabled */
  disabled?: boolean
  /** Button text label */
  label?: string
  /** Size of the button */
  size?: 'small' | 'medium' | 'large'
  /** Visual variant of the button */
  variant?: 'contained' | 'outlined'
  /** Custom icon override */
  icon?: React.ReactNode
}

/**
 * Centralized restart/new game button component with category-based theming
 * 
 * Provides consistent styling, theming, and behavior across all games that need
 * restart functionality. Automatically applies appropriate category colors and
 * ensures high visibility and accessibility.
 * 
 * @example
 * ```typescript
 * // Basic usage
 * <RestartButton onClick={restartGame} category="math" />
 * 
 * // With custom styling and label
 * <RestartButton 
 *   onClick={startNewGame}
 *   category="colors"
 *   label="Start forfra"
 *   size="large"
 *   variant="outlined"
 * />
 * ```
 */
export const RestartButton: React.FC<RestartButtonProps> = ({
  onClick,
  category,
  disabled = false,
  label = 'Ny spil',
  size = 'medium',
  variant = 'contained',
  icon
}) => {
  // Get theme colors based on category
  const theme = getCategoryTheme(category)
  
  // Choose appropriate icon
  const getIcon = () => {
    if (icon) return icon
    return <Refresh sx={{ fontSize: size === 'small' ? '18px' : '20px' }} />
  }

  // Build button styles based on category theme and variant
  const getButtonStyles = () => {
    const baseStyles = {
      fontSize: size === 'small' ? '0.8rem' : size === 'large' ? '1.1rem' : '1rem',
      py: size === 'small' ? 0.5 : size === 'large' ? 2 : 1.5,
      px: size === 'small' ? 1.5 : size === 'large' ? 4 : 3,
      borderRadius: 3,
      fontWeight: 600,
      textTransform: 'none' as const,
      transition: 'all 0.3s ease',
      boxShadow: variant === 'contained' ? 2 : 1
    }

    if (variant === 'contained') {
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
      // outlined variant
      return {
        ...baseStyles,
        backgroundColor: 'white',
        color: theme.accentColor,
        border: `2px solid ${theme.accentColor}`,
        '&:hover': {
          backgroundColor: theme.accentColor,
          color: 'white',
          boxShadow: 4,
          transform: 'translateY(-2px)'
        },
        '&:active': {
          transform: 'translateY(0px)',
          boxShadow: 2
        },
        '&:disabled': {
          borderColor: 'grey.400',
          color: 'grey.400',
          backgroundColor: 'white'
        }
      }
    }
  }

  return (
    <Button
      onClick={onClick}
      variant={variant}
      size={size}
      disabled={disabled}
      startIcon={getIcon()}
      sx={getButtonStyles()}
    >
      {label}
    </Button>
  )
}

/**
 * Type-safe props for specific game categories
 */
export interface AlphabetRestartButtonProps extends Omit<RestartButtonProps, 'category'> {
  category?: 'alphabet'
}

export interface MathRestartButtonProps extends Omit<RestartButtonProps, 'category'> {
  category?: 'math'
}

export interface ColorRestartButtonProps extends Omit<RestartButtonProps, 'category'> {
  category?: 'colors'
}

/**
 * Pre-configured restart button for alphabet games
 * Uses blue theme and "Ny spil" label
 */
export const AlphabetRestartButton: React.FC<AlphabetRestartButtonProps> = (props) => (
  <RestartButton {...props} category="alphabet" label="Ny spil" />
)

/**
 * Pre-configured restart button for math games
 * Uses purple theme and "Ny spil" label
 */
export const MathRestartButton: React.FC<MathRestartButtonProps> = (props) => (
  <RestartButton {...props} category="math" label="Ny spil" />
)

/**
 * Pre-configured restart button for color games
 * Uses orange theme and "Start forfra" label
 */
export const ColorRestartButton: React.FC<ColorRestartButtonProps> = (props) => (
  <RestartButton {...props} category="colors" label="Start forfra" />
)