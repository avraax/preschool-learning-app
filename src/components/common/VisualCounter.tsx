import React from 'react'
import { Box, SxProps, Theme } from '@mui/material'
import { motion } from 'framer-motion'

interface VisualCounterProps {
  number: number
  type?: 'dots' | 'fingers' | 'objects' | 'blocks'
  color?: string
  size?: number
  animated?: boolean
  sx?: SxProps<Theme>
  maxDisplay?: number
}

const VisualCounter: React.FC<VisualCounterProps> = ({
  number,
  type = 'dots',
  color = '#4caf50',
  size = 20,
  animated = true,
  sx = {},
  maxDisplay = 10
}) => {
  // Limit display to maxDisplay items to avoid UI clutter
  const displayNumber = Math.min(number, maxDisplay)
  const showPlusSign = number > maxDisplay

  const renderDots = () => {
    return Array.from({ length: displayNumber }, (_, index) => (
      <motion.div
        key={index}
        initial={animated ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: index * 0.1, duration: 0.3 }}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          backgroundColor: color,
          margin: '2px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}
      />
    ))
  }

  const renderFingers = () => {
    const fingerEmojis = ['👆', '✌️', '🤟', '🖖', '🖐️']
    
    if (displayNumber <= 5) {
      return (
        <motion.div
          initial={animated ? { scale: 0 } : { scale: 1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5 }}
          style={{ fontSize: size * 2.5 }}
        >
          {fingerEmojis[displayNumber - 1] || '🖐️'}
        </motion.div>
      )
    }
    
    // For 6-10, show both hands
    return (
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <motion.div
          initial={animated ? { scale: 0 } : { scale: 1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5 }}
          style={{ fontSize: size * 2 }}
        >
          🖐️
        </motion.div>
        {displayNumber > 5 && (
          <motion.div
            initial={animated ? { scale: 0 } : { scale: 1 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            style={{ fontSize: size * 2 }}
          >
            {fingerEmojis[displayNumber - 6] || '🖐️'}
          </motion.div>
        )}
      </Box>
    )
  }

  const renderObjects = () => {
    const objects = ['🍎', '🌟', '🎈', '🎾', '🎁', '🌺', '🍭', '🎯', '🎨', '🎪']
    
    return Array.from({ length: displayNumber }, (_, index) => (
      <motion.div
        key={index}
        initial={animated ? { scale: 0, rotate: -180 } : { scale: 1, rotate: 0 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: index * 0.15, duration: 0.4 }}
        style={{
          fontSize: size * 1.5,
          margin: '2px',
          display: 'inline-block'
        }}
      >
        {objects[index % objects.length]}
      </motion.div>
    ))
  }

  const renderBlocks = () => {
    return Array.from({ length: displayNumber }, (_, index) => (
      <motion.div
        key={index}
        initial={animated ? { y: 20, opacity: 0 } : { y: 0, opacity: 1 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: index * 0.1, duration: 0.3 }}
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          border: '2px solid #333',
          borderRadius: '4px',
          margin: '1px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
        }}
      />
    ))
  }

  const renderVisual = () => {
    switch (type) {
      case 'fingers':
        return renderFingers()
      case 'objects':
        return renderObjects()
      case 'blocks':
        return renderBlocks()
      case 'dots':
      default:
        return renderDots()
    }
  }

  // Arrange items in rows for better display
  const getGridStyle = () => {
    if (type === 'fingers') {
      return { display: 'flex', justifyContent: 'center', alignItems: 'center' }
    }
    
    const itemsPerRow = Math.min(5, displayNumber)
    const rows = Math.ceil(displayNumber / itemsPerRow)
    
    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${itemsPerRow}, 1fr)`,
      gridTemplateRows: `repeat(${rows}, 1fr)`,
      gap: '4px',
      justifyItems: 'center',
      alignItems: 'center'
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 1,
        ...sx
      }}
    >
      <Box sx={getGridStyle()}>
        {renderVisual()}
      </Box>
      
      {showPlusSign && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          style={{
            marginTop: '8px',
            fontSize: size * 0.8,
            color: '#666',
            fontWeight: 'bold'
          }}
        >
          +{number - maxDisplay} flere
        </motion.div>
      )}
    </Box>
  )
}

export default VisualCounter

// Preset configurations for common use cases
export const VisualCounterPresets = {
  small: { size: 15, maxDisplay: 8 },
  medium: { size: 20, maxDisplay: 10 },
  large: { size: 25, maxDisplay: 12 },
  
  // Themed presets
  colorful: { type: 'objects' as const, animated: true },
  simple: { type: 'dots' as const, color: '#2196f3' },
  playful: { type: 'blocks' as const, color: '#ff9800' },
  natural: { type: 'fingers' as const, animated: true }
}