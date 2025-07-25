import React from 'react'
import { Box, Typography, SxProps, Theme } from '@mui/material'
import { motion } from 'framer-motion'

interface LetterAssociationProps {
  letter: string
  showAssociation?: boolean
  animated?: boolean
  size?: 'small' | 'medium' | 'large'
  sx?: SxProps<Theme>
}

// Danish letter associations with familiar objects/animals
const DANISH_LETTER_ASSOCIATIONS: Record<string, { emoji: string; word: string }> = {
  'A': { emoji: '🍎', word: 'Æble' },
  'B': { emoji: '🏈', word: 'Bold' },
  'C': { emoji: '🚗', word: 'Bil (Car)' },
  'D': { emoji: '🐉', word: 'Drage' },
  'E': { emoji: '🐘', word: 'Elefant' },
  'F': { emoji: '🐠', word: 'Fisk' },
  'G': { emoji: '🐸', word: 'Grøde' },
  'H': { emoji: '🏠', word: 'Hus' },
  'I': { emoji: '🍨', word: 'Is' },
  'J': { emoji: '✈️', word: 'Jetfly' },
  'K': { emoji: '🐱', word: 'Kat' },
  'L': { emoji: '🦁', word: 'Løve' },
  'M': { emoji: '🐭', word: 'Mus' },
  'N': { emoji: '🌙', word: 'Nat' },
  'O': { emoji: '🐙', word: 'Oktopus' },
  'P': { emoji: '🍕', word: 'Pizza' },
  'Q': { emoji: '👸', word: 'Dronning (Queen)' },
  'R': { emoji: '🌈', word: 'Regnbue' },
  'S': { emoji: '☀️', word: 'Sol' },
  'T': { emoji: '🌳', word: 'Træ' },
  'U': { emoji: '⌚', word: 'Ur' },
  'V': { emoji: '💧', word: 'Vand' },
  'W': { emoji: '🐺', word: 'Ulv (Wolf)' },
  'X': { emoji: '❌', word: 'X-mark' },
  'Y': { emoji: '🧘', word: 'Yoga' },
  'Z': { emoji: '🦓', word: 'Zebra' },
  'Æ': { emoji: '🥚', word: 'Æg' },
  'Ø': { emoji: '👁️', word: 'Øje' },
  'Å': { emoji: '🌊', word: 'Å (River)' }
}

const LetterAssociation: React.FC<LetterAssociationProps> = ({
  letter,
  showAssociation = true,
  animated = true,
  size = 'medium',
  sx = {}
}) => {
  const association = DANISH_LETTER_ASSOCIATIONS[letter.toUpperCase()]
  
  if (!association) {
    return (
      <Box sx={{ textAlign: 'center', ...sx }}>
        <Typography 
          variant="h1" 
          sx={{ 
            fontSize: size === 'small' ? '2rem' : size === 'large' ? '4rem' : '3rem',
            fontWeight: 700 
          }}
        >
          {letter}
        </Typography>
      </Box>
    )
  }

  const sizeConfig = {
    small: { letterSize: '2rem', emojiSize: '1.5rem', wordSize: '0.8rem' },
    medium: { letterSize: '3rem', emojiSize: '2rem', wordSize: '1rem' },
    large: { letterSize: '4rem', emojiSize: '2.5rem', wordSize: '1.2rem' }
  }

  const config = sizeConfig[size]

  return (
    <Box 
      sx={{ 
        textAlign: 'center', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        gap: 1,
        ...sx 
      }}
    >
      {/* Letter */}
      <motion.div
        initial={animated ? { scale: 0 } : { scale: 1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Typography 
          variant="h1" 
          sx={{ 
            fontSize: config.letterSize,
            fontWeight: 700,
            color: 'primary.dark',
            lineHeight: 1
          }}
        >
          {letter.toUpperCase()}
        </Typography>
      </motion.div>

      {/* Association Visual */}
      {showAssociation && (
        <>
          <motion.div
            initial={animated ? { scale: 0, rotate: -180 } : { scale: 1, rotate: 0 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            style={{ fontSize: config.emojiSize }}
          >
            {association.emoji}
          </motion.div>

          <motion.div
            initial={animated ? { opacity: 0, y: 10 } : { opacity: 1, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
          >
            <Typography 
              variant="body2" 
              sx={{ 
                fontSize: config.wordSize,
                fontWeight: 600,
                color: 'text.secondary',
                textAlign: 'center'
              }}
            >
              {association.word}
            </Typography>
          </motion.div>
        </>
      )}
    </Box>
  )
}

export default LetterAssociation

// Hook for getting letter association data
export const useLetterAssociation = (letter: string) => {
  const association = DANISH_LETTER_ASSOCIATIONS[letter.toUpperCase()]
  
  return {
    hasAssociation: !!association,
    emoji: association?.emoji,
    word: association?.word,
    fullAssociation: association
  }
}

// Helper component for displaying multiple letters
export const LetterGrid: React.FC<{
  letters: string[]
  showAssociations?: boolean
  animated?: boolean
  size?: 'small' | 'medium' | 'large'
  columns?: number
}> = ({ 
  letters, 
  showAssociations = true, 
  animated = true, 
  size = 'medium',
  columns = 3 
}) => {
  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gap: 2,
      justifyItems: 'center'
    }}>
      {letters.map((letter, index) => (
        <motion.div
          key={letter}
          initial={animated ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1, duration: 0.4 }}
        >
          <LetterAssociation
            letter={letter}
            showAssociation={showAssociations}
            animated={animated}
            size={size}
          />
        </motion.div>
      ))}
    </Box>
  )
}