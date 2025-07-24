import React from 'react'
import { motion } from 'framer-motion'
import { Box, Grid, Card, CardContent, Typography } from '@mui/material'

interface LearningGridProps {
  items: (string | number)[]
  currentIndex: number
  isAutoPlay: boolean
  onItemClick: (index: number) => void
}

const LearningGrid: React.FC<LearningGridProps> = ({
  items,
  currentIndex,
  isAutoPlay,
  onItemClick
}) => {
  return (
    <Box sx={{ 
      flex: 1, 
      display: 'flex', 
      flexDirection: 'column',
      justifyContent: 'flex-start', // Align to top
      alignItems: 'center',
      overflow: 'hidden',
      minHeight: 0
    }}>
      <Grid 
        container 
        spacing={0} // No spacing - we'll use gap instead
        sx={{ 
          maxWidth: '100%',
          width: 'fit-content',
          gap: '8px', // Exactly 8px gap between all items
          maxHeight: '100%',
          overflow: 'auto',
          pr: 1,
          pb: 1, // Add padding bottom for scrollbar
        }}
      >
        {items.map((item, index) => (
          <Grid size={{ xs: 1.2, sm: 1, md: 0.8 }} key={`${item}-${index}`}>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Card 
                onClick={() => onItemClick(index)}
                sx={{ 
                  minHeight: { xs: 45, md: 50 },
                  cursor: 'pointer',
                  border: '2px solid',
                  borderColor: index === currentIndex ? 'secondary.main' : 'primary.200',
                  bgcolor: index === currentIndex ? 'secondary.50' : 
                           index < currentIndex && isAutoPlay ? 'success.50' : 'white',
                  transition: 'all 0.3s ease',
                  '&:hover': {
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
                    p: 1,
                    '&:last-child': { pb: 1 }
                  }}
                >
                  <Typography 
                    variant="body1"
                    sx={{ 
                      fontWeight: 700,
                      color: index === currentIndex ? 'secondary.dark' : 'primary.dark',
                      fontSize: { xs: '0.8rem', sm: '1rem' }
                    }}
                  >
                    {item}
                  </Typography>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}

export default LearningGrid