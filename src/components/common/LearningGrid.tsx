import React from 'react'
import { motion } from 'framer-motion'
import { Box, Card, CardContent, Typography } from '@mui/material'

interface LearningGridProps {
  items: (string | number)[]
  currentIndex: number
  onItemClick: (index: number) => void
  disabled?: boolean
}

const LearningGrid: React.FC<LearningGridProps> = ({
  items,
  currentIndex,
  onItemClick,
  disabled = false
}) => {
  // Calculate grid dimensions for optimal layout
  const isAlphabet = items.length === 29
  
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
                sm: '@media (orientation: landscape) { repeat(10, 1fr) } repeat(7, 1fr)',  // Landscape vs portrait
                md: 'repeat(8, 1fr)',  // Desktop: 8 columns (4 rows)
                lg: 'repeat(10, 1fr)'  // Large desktop: 10 columns (3 rows)
              }
            : `repeat(auto-fit, minmax(80px, 1fr))`,
          gap: { xs: '6px', sm: '8px', md: '10px' },
          width: '100%',
          height: '100%',
          overflow: 'hidden',
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
                  border: '3px solid',
                  borderColor: index === currentIndex ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)',
                  borderRadius: '14px',
                  bgcolor: index === currentIndex ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.85)',
                  opacity: disabled ? 0.5 : 1,
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: index === currentIndex ? '0 4px 16px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.1)',
                  outline: 'none',
                  '&:focus': {
                    outline: 'none'
                  },
                  '@media (hover: hover) and (pointer: fine)': {
                    '&:hover': disabled ? {} : {
                      bgcolor: 'rgba(255,255,255,0.98)',
                      boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
                      transform: 'translateY(-2px)'
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
                      fontWeight: 800,
                      color: index === currentIndex ? '#7C3AED' : '#1e293b',
                      fontSize: {
                        xs: 'clamp(1rem, 3.5vw, 1.5rem)',
                        sm: 'clamp(1.2rem, 4vw, 2rem)',
                        md: 'clamp(1.5rem, 5vw, 2.2rem)',
                        lg: 'clamp(1.8rem, 5vw, 2.5rem)'
                      },
                      lineHeight: 1,
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