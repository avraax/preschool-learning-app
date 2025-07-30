import React from 'react'
import { Chip } from '@mui/material'
import { Star } from '@mui/icons-material'
import { Award } from 'lucide-react'
import { categoryThemes, getCategoryTheme } from '../../config/categoryThemes'

/**
 * Props for the ScoreChip component
 */
interface ScoreChipProps {
  /** Current score value */
  score: number
  /** Category theme to use for styling */
  category: 'alphabet' | 'math' | 'colors'
  /** Display format for the score */
  format?: 'standard' | 'stars' | 'progress'
  /** Target value for progress format (e.g., "5/10") */
  target?: number
  /** Whether the chip should be disabled during narration */
  disabled?: boolean
  /** Click handler for score narration */
  onClick?: () => void
  /** Custom label override */
  customLabel?: string
}

/**
 * Centralized score display component with category-based theming
 * 
 * Provides consistent styling, theming, and behavior across all games that display scores.
 * Automatically handles disabled states during narration and applies appropriate category colors.
 * 
 * @example
 * ```typescript
 * // Basic usage
 * <ScoreChip score={5} category="math" onClick={handleScoreClick} />
 * 
 * // With custom format and disabled state
 * <ScoreChip 
 *   score={3}
 *   target={10}
 *   category="colors"
 *   format="progress"
 *   disabled={isNarrating}
 *   onClick={handleScoreClick}
 * />
 * ```
 */
export const ScoreChip: React.FC<ScoreChipProps> = ({
  score,
  category,
  format = 'standard',
  target,
  disabled = false,
  onClick,
  customLabel
}) => {
  // Get theme colors based on category
  const theme = getCategoryTheme(category)
  
  // Generate label based on format
  const getLabel = () => {
    if (customLabel) return customLabel
    
    switch (format) {
      case 'stars':
        return `${score} ⭐`
      case 'progress':
        return target ? `${score}/${target}` : `${score}`
      case 'standard':
      default:
        return `Point: ${score}`
    }
  }

  // Choose appropriate icon based on format
  const getIcon = () => {
    switch (format) {
      case 'stars':
        return <Award size={20} />
      case 'progress':
        return <Star sx={{ fontSize: '20px' }} />
      case 'standard':
      default:
        return <Star sx={{ fontSize: '20px' }} />
    }
  }

  // Build styles based on category theme and disabled state
  const getChipStyles = () => {
    return {
      fontSize: '1.2rem',
      py: 1,
      fontWeight: 'bold',
      backgroundColor: disabled ? 'grey.300' : theme.accentColor,
      color: disabled ? 'grey.600' : 'white',
      boxShadow: disabled ? 0 : 2,
      cursor: disabled ? 'default' : (onClick ? 'pointer' : 'default'),
      opacity: disabled ? 0.6 : 1,
      border: `2px solid ${disabled ? 'transparent' : theme.borderColor}`,
      transition: 'all 0.3s ease',
      '&:hover': onClick && !disabled ? {
        backgroundColor: theme.hoverBorderColor,
        boxShadow: 4,
        transform: 'scale(1.05)'
      } : {},
      '&:active': onClick && !disabled ? {
        transform: 'scale(0.98)'
      } : {}
    }
  }

  return (
    <Chip
      icon={getIcon()}
      label={getLabel()}
      disabled={disabled}
      onClick={onClick}
      sx={getChipStyles()}
    />
  )
}

/**
 * Type-safe props for specific game categories
 */
export interface AlphabetScoreChipProps extends Omit<ScoreChipProps, 'category'> {
  category?: 'alphabet'
}

export interface MathScoreChipProps extends Omit<ScoreChipProps, 'category'> {
  category?: 'math'
}

export interface ColorScoreChipProps extends Omit<ScoreChipProps, 'category'> {
  category?: 'colors'
}

/**
 * Pre-configured score chip for alphabet games
 * Uses stars format and blue theme
 */
export const AlphabetScoreChip: React.FC<AlphabetScoreChipProps> = (props) => (
  <ScoreChip {...props} category="alphabet" format="stars" />
)

/**
 * Pre-configured score chip for math games
 * Uses standard format and purple theme
 */
export const MathScoreChip: React.FC<MathScoreChipProps> = (props) => (
  <ScoreChip {...props} category="math" format="standard" />
)

/**
 * Pre-configured score chip for color games
 * Uses stars format and orange theme
 */
export const ColorScoreChip: React.FC<ColorScoreChipProps> = (props) => (
  <ScoreChip {...props} category="colors" format="stars" />
)

/**
 * Pre-configured score chip for color hunt progress display
 * Uses progress format and orange theme
 */
export const ColorProgressChip: React.FC<ColorScoreChipProps> = (props) => (
  <ScoreChip {...props} category="colors" format="progress" />
)