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
  // Dense numbers grid (Lær Tal on Normal/Svær = 1–100): 10 rows can't each be ≥44px on a no-scroll
  // iPad, so give the tiles a compact mode (they fill their short rows cleanly instead of holding the
  // 44px floor and overlapping the row below) + a tighter gap + a smaller numeral. 1–60 (Let) is
  // unaffected — 6 roomy rows.
  const dense = !isAlphabet && items.length > 60

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
            // Numbers (W3 / PRD-15): a deliberate 10-column hundreds-chart so each column = a units
            // digit and each row = a tens band (10/20/30… stack in one column) — the base-10 pattern
            // is the lesson. With 1–60 that's 10×6, tiles comfortably ≥44px, no scroll. (Was
            // `auto-fit minmax(72px)` = "however many 72px tracks fit" → ~13 scrambled columns.)
            : 'repeat(10, 1fr)',
          gap: dense ? { xs: '3px', md: '5px' } : { xs: '6px', sm: '8px', md: '10px' },
          width: '100%',
          height: '100%',
          // Let the tiles' soft contact shadows breathe without being clipped by the stage.
          overflow: 'visible',
          p: dense ? 0.25 : { xs: 0.5, sm: 1, md: 1.5 },
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
            // Phone landscape, numbers (W3): keep the aligned 10-column hundreds-chart (inherited
            // from the base) so tens still stack — only tighten the gap/padding for the short height.
            // 1–60 → 10 cols × 6 rows fits an ≤480px-tall landscape phone.
            [PHONE_LANDSCAPE]: {
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
              compact={dense}
              hint={isActive}
              disabled={disabled}
              sx={{ opacity: disabled ? 0.5 : 1 }}
            >
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  color: isActive ? darken(active, 0.35) : darken(base, 0.4),
                  fontSize: dense
                    ? { xs: 'clamp(0.85rem, 2.4vw, 1.15rem)', md: 'clamp(1rem, 2.4vw, 1.35rem)' }
                    : {
                        xs: 'clamp(1rem, 3.5vw, 1.5rem)',
                        sm: 'clamp(1.2rem, 4vw, 2rem)',
                        md: 'clamp(1.5rem, 5vw, 2.2rem)',
                        lg: 'clamp(1.8rem, 5vw, 2.5rem)'
                      },
                  lineHeight: 1,
                  // Adjust font size in landscape orientation
                  '@media (orientation: landscape)': dense
                    ? { fontSize: { xs: 'clamp(0.8rem, 2vw, 1.1rem)', md: 'clamp(0.95rem, 2vw, 1.3rem)' } }
                    : {
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
