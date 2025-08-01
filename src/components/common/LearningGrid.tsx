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
                onPointerDown={disabled ? undefined : () => onItemClick(index)}  // Use pointer events to avoid VoiceOver
                role="presentation"  // Prevent VoiceOver from announcing as button
                aria-disabled="true"  // Explicitly disable for screen readers
                tabIndex={-1}  // Remove from tab order
                sx={{ 
                  height: '100%',
                  cursor: disabled ? 'default' : 'pointer',
                  border: '2px solid',
                  borderColor: index === currentIndex ? 'secondary.main' : 'primary.200',
                  bgcolor: index === currentIndex ? 'secondary.50' : 'white',
                  opacity: disabled ? 0.5 : 1,
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  WebkitUserSelect: 'none',  // Prevent text selection on iOS
                  userSelect: 'none',
                  WebkitTouchCallout: 'none',  // Disable iOS callout menu
                  speak: 'none' as any,  // Legacy CSS to prevent speech
                  '&:hover': disabled ? {} : {
                    borderColor: 'primary.main',
                    bgcolor: 'primary.50',
                    boxShadow: 4
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
                    aria-hidden="true"  // Prevent VoiceOver from reading the text
                    aria-label=""  // Empty label to prevent announcements
                    role="img"  // Treat as decorative image instead of text
                    sx={{ 
                      fontWeight: 700,
                      color: index === currentIndex ? 'secondary.dark' : 'primary.dark',
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