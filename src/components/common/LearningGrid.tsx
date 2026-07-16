import React from 'react'
import { Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
import { darken } from '../../theme/tokens/helpers'
import TactileTile from './TactileTile'

// LearningGrid — the "Lær …" browse grid (letters / numbers / etc.). As of Liveliness PRD-06 F1
// each cell is the shared `TactileTile` clay primitive, so the calm browse reads as the same
// tactile material as the quiz boards. The currently-spoken cell wears a gentle accent hint ring
// (via TactileTile's `hint`) so a pre-reader can see where they are; reduced-motion → static ring.

interface LearningGridProps {
  items: (string | number)[]
  currentIndex: number
  onItemClick: (index: number) => void
  disabled?: boolean
  // Section accent (e.g. categoryThemes.alphabet.accentColor) — highlights the active cell.
  // Defaults to the theme's secondary so callers that don't pass one still read as themed.
  accent?: string
}

const LearningGrid: React.FC<LearningGridProps> = ({
  items,
  currentIndex,
  onItemClick,
  disabled = false,
  accent,
}) => {
  const theme = useTheme()
  // Calculate grid dimensions for optimal layout
  const isAlphabet = items.length === 29

  const active = accent ?? theme.palette.secondary.main
  const base = theme.palette.primary.main

  return (
    <Box sx={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      minHeight: 0,
      width: '100%'
    }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: isAlphabet
            ? {
                xs: 'repeat(6, 1fr)',  // Mobile portrait: 6 columns (5 rows)
                sm: 'repeat(7, 1fr)',  // Tablet portrait: 7 columns
                md: 'repeat(8, 1fr)',  // Desktop: 8 columns (4 rows)
                lg: 'repeat(10, 1fr)'  // Large desktop: 10 columns (3 rows)
              }
            : `repeat(auto-fit, minmax(72px, 1fr))`,
          gap: { xs: '6px', sm: '8px', md: '10px' },
          width: '100%',
          height: '100%',
          // Let the tiles' soft contact shadows breathe without being clipped by the stage.
          overflow: 'visible',
          p: { xs: 0.5, sm: 1, md: 1.5 },
          gridAutoRows: 'minmax(0, 1fr)',
          // Ensure good aspect ratio by limiting max height
          '& > *': {
            maxHeight: {
              xs: '80px',
              sm: '100px',
              md: '120px',
              lg: '140px'
            }
          },
          // Orientation-specific adjustments
          '@media (orientation: landscape)': isAlphabet ? {
            gridTemplateColumns: {
              xs: 'repeat(10, 1fr)',  // Landscape mobile: 10 columns (3 rows)
              sm: 'repeat(10, 1fr)',  // Landscape tablet: 10 columns
              md: 'repeat(10, 1fr)'   // Landscape desktop: 10 columns
            }
          } : {
            // Phone landscape, numbers (100 tiles): 72px-min columns → ~11 cols × 10 rows,
            // which compresses tiles into unreadable stripes at ≤480px height. Narrower
            // columns trade width for height: ~17 cols × 6 rows of readable tiles.
            [PHONE_LANDSCAPE]: {
              gridTemplateColumns: 'repeat(auto-fit, minmax(42px, 1fr))',
              gap: '4px',
              p: 0.25,
            }
          }
        }}
      >
        {items.map((item, index) => {
          const isActive = index === currentIndex
          return (
            <TactileTile
              key={`${item}-${index}`}
              onActivate={disabled ? undefined : () => onItemClick(index)}
              accent={active}
              variant="card"
              hint={isActive}
              disabled={disabled}
              sx={{ opacity: disabled ? 0.5 : 1 }}
            >
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  color: isActive ? darken(active, 0.35) : darken(base, 0.4),
                  fontSize: {
                    xs: 'clamp(1rem, 3.5vw, 1.5rem)',
                    sm: 'clamp(1.2rem, 4vw, 2rem)',
                    md: 'clamp(1.5rem, 5vw, 2.2rem)',
                    lg: 'clamp(1.8rem, 5vw, 2.5rem)'
                  },
                  lineHeight: 1,
                  // Adjust font size in landscape orientation
                  '@media (orientation: landscape)': {
                    fontSize: {
                      xs: 'clamp(1rem, 3vw, 1.3rem)',
                      sm: 'clamp(1.2rem, 3.5vw, 1.8rem)',
                      md: 'clamp(1.5rem, 4vw, 2rem)'
                    }
                  },
                  [PHONE_LANDSCAPE]: { fontSize: '0.8rem' }
                }}
              >
                {item}
              </Typography>
            </TactileTile>
          )
        })}
      </Box>
    </Box>
  )
}

export default LearningGrid
