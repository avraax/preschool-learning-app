import React from 'react'
import { motion } from 'framer-motion'
import { Box, Card, CardContent, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { darken, hexToRgba } from '../../theme/tokens/helpers'

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
  accent
}) => {
  const theme = useTheme()
  const dark = theme.scene.dark
  // Calculate grid dimensions for optimal layout
  const isAlphabet = items.length === 29

  // Lifted-3D depth language (mirrors AnswerTile) — token-driven, no hardcoded section colours.
  const active = accent ?? theme.palette.secondary.main
  const base = theme.palette.primary.main
  const restSurface = 'linear-gradient(180deg, #FFFFFF 0%, #ECF1F8 100%)'
  const activeSurface = `linear-gradient(180deg, #FFFFFF 0%, ${hexToRgba(active, 0.18)} 100%)`
  const ambient = dark ? '0 6px 16px rgba(0,0,0,0.45)' : '0 5px 12px rgba(0,0,0,0.12)'
  const restEdge = darken(base, 0.28)
  const activeEdge = darken(active, 0.28)

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
          // Let the lifted tiles' edge/shadow breathe without being clipped by the stage.
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
          } : {}
        }}
      >
        {items.map((item, index) => (
          <motion.div
            key={`${item}-${index}`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{ height: '100%' }}
          >
            <Card
                onClick={disabled ? undefined : () => onItemClick(index)}
                sx={{
                  height: '100%',
                  cursor: disabled ? 'default' : 'pointer',
                  border: '2px solid',
                  borderColor: index === currentIndex ? active : hexToRgba(base, dark ? 0.5 : 0.32),
                  background: index === currentIndex ? activeSurface : restSurface,
                  borderRadius: '14px',
                  opacity: disabled ? 0.5 : 1,
                  boxShadow: index === currentIndex
                    ? `0 0 0 3px ${hexToRgba(active, 0.4)}, 0 5px 0 ${activeEdge}, ${ambient}`
                    : `0 4px 0 ${restEdge}, ${ambient}`,
                  transition: 'box-shadow 0.2s ease, border-color 0.2s ease, transform 0.08s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  outline: 'none',
                  '&:focus': {
                    outline: 'none'
                  },
                  '&:active': disabled ? {} : {
                    transform: 'translateY(3px)',
                    boxShadow: `0 1px 0 ${index === currentIndex ? activeEdge : restEdge}, ${ambient}`
                  },
                  '@media (hover: hover) and (pointer: fine)': {
                    '&:hover': disabled ? {} : {
                      borderColor: active,
                      boxShadow: `0 6px 0 ${index === currentIndex ? activeEdge : restEdge}, 0 10px 22px ${hexToRgba(active, 0.3)}`
                    }
                  }
                }}
              >
                <CardContent 
                  sx={{ 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    width: '100%',
                    p: { xs: 1, sm: 1.5, md: 2 },
                    '&:last-child': { pb: { xs: 1, sm: 1.5, md: 2 } }
                  }}
                >
                  <Typography 
                    variant="h4"
                    sx={{
                      fontWeight: 700,
                      color: index === currentIndex ? darken(active, 0.35) : darken(base, 0.4),
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
                      }
                    }}
                  >
                    {item}
                  </Typography>
                </CardContent>
              </Card>
            </motion.div>
        ))}
      </Box>
    </Box>
  )
}

export default LearningGrid