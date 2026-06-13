import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Container,
  Box,
  Typography,
  IconButton,
  AppBar,
  Toolbar,
  Card,
  Chip
} from '@mui/material'
import { ArrowLeft } from 'lucide-react'
import { categoryThemes } from '../../config/categoryThemes'
import { englishThemes, EnglishWord } from '../../config/englishVocab'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Lær Engelsk: free exploration. Browse a theme's words as cards (picture + English word
// + Danish translation), tap to hear the word in British English. Learning-based pattern:
// direct audio on tap, no entry-audio coordination.
const EnglishLearning: React.FC = () => {
  const navigate = useNavigate()
  const theme = categoryThemes.english
  const audio = useSimplifiedAudioHook({ componentId: 'EnglishLearning', autoInitialize: false })

  const [activeThemeId, setActiveThemeId] = useState(englishThemes[0].id)
  const [playingWord, setPlayingWord] = useState<string | null>(null)

  const activeTheme = englishThemes.find(t => t.id === activeThemeId) || englishThemes[0]

  const handleWordClick = async (word: EnglishWord) => {
    audio.updateUserInteraction()
    audio.cancelCurrentAudio()
    setPlayingWord(word.en)
    try {
      await audio.speakEnglish(word.en)
    } catch (error) {
      // ignore audio errors
    } finally {
      setPlayingWord(null)
    }
  }

  return (
    <Box
      sx={{
        height: '100dvh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: theme.gradient
      }}
    >
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar sx={{ justifyContent: 'space-between', py: 1.5 }}>
          <IconButton
            onClick={() => navigate('/english')}
            color="primary"
            size="large"
            sx={{
              bgcolor: 'rgba(255, 255, 255, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              backdropFilter: 'blur(8px)',
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.9)', transform: 'scale(1.05)' }
            }}
          >
            <ArrowLeft size={24} />
          </IconButton>
          <Typography
            variant="h5"
            sx={{
              color: theme.accentColor,
              fontWeight: 700,
              fontSize: { xs: '1.25rem', md: '1.6rem' },
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            📚 Lær Engelsk
          </Typography>
          <Box sx={{ width: 48 }} />
        </Toolbar>
      </AppBar>

      <Container
        maxWidth="lg"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          py: { xs: 1, md: 2 },
          overflow: 'hidden'
        }}
      >
        {/* Theme selector */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: { xs: 0.75, md: 1 },
            mb: { xs: 1.5, md: 2 },
            flex: '0 0 auto'
          }}
        >
          {englishThemes.map(t => (
            <Chip
              key={t.id}
              label={`${t.emoji} ${t.title}`}
              onClick={() => {
                audio.updateUserInteraction()
                audio.cancelCurrentAudio()
                setActiveThemeId(t.id)
              }}
              sx={{
                fontSize: { xs: '0.9rem', md: '1.05rem' },
                fontWeight: 700,
                py: 2.2,
                px: 0.5,
                minHeight: 44,
                cursor: 'pointer',
                bgcolor: t.id === activeThemeId ? theme.accentColor : 'rgba(255,255,255,0.85)',
                color: t.id === activeThemeId ? 'white' : theme.accentColor,
                border: `2px solid ${theme.borderColor}`,
                '&:hover': { bgcolor: t.id === activeThemeId ? theme.hoverBorderColor : 'white' }
              }}
            />
          ))}
        </Box>

        {/* Word cards grid */}
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' },
              gap: { xs: '10px', md: '16px' },
              width: '100%',
              maxWidth: 900,
              '@media (orientation: landscape)': {
                gridTemplateColumns: { xs: 'repeat(5, 1fr)', md: 'repeat(5, 1fr)' }
              }
            }}
          >
            <AnimatePresence mode="popLayout">
              {activeTheme.words.map((word, index) => (
                <motion.div
                  key={`${activeTheme.id}-${word.en}`}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ delay: index * 0.03, duration: 0.25 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Card
                    onClick={() => handleWordClick(word)}
                    sx={{
                      cursor: 'pointer',
                      border: '3px solid',
                      borderColor: playingWord === word.en ? theme.accentColor : theme.borderColor,
                      bgcolor: 'white',
                      borderRadius: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      p: { xs: 1, md: 1.5 },
                      minHeight: { xs: 96, md: 120 },
                      boxShadow: playingWord === word.en ? `0 0 18px ${theme.accentColor}66` : 2,
                      transition: 'all 0.25s ease',
                      '@media (hover: hover) and (pointer: fine)': {
                        '&:hover': { borderColor: theme.hoverBorderColor, boxShadow: 6 }
                      }
                    }}
                  >
                    <Typography sx={{ fontSize: { xs: '2.25rem', md: '3rem' }, lineHeight: 1 }}>
                      {word.emoji}
                    </Typography>
                    <Typography
                      sx={{
                                                fontSize: { xs: '1rem', md: '1.25rem' },
                        fontWeight: 700,
                        color: theme.accentColor,
                        textAlign: 'center',
                        lineHeight: 1.1,
                        mt: 0.5
                      }}
                    >
                      {word.en}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: { xs: '0.75rem', md: '0.9rem' },
                        color: 'text.secondary',
                        textAlign: 'center',
                        lineHeight: 1
                      }}
                    >
                      {word.da}
                    </Typography>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </Box>
        </Box>
      </Container>
    </Box>
  )
}

export default EnglishLearning
